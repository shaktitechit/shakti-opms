/**
 * @fileoverview Daily digests for today's + overdue pending follow-ups (in-app + email).
 * @module jobs/followUpDailyReminder
 */
const { FOLLOWUP_REMINDER_TZ } = require('../config/env');
const { getModels } = require('../data/mongoRegistry');
const notificationHelper = require('../utils/notificationHelper');
const emailHelper = require('../modules/messages/helpers/email.helper');
const { logger } = require('../utils/logger');

const CLOSED_LEAD_STATUSES = new Set(['won', 'lost', 'converted']);
const EMAIL_TEMPLATE = 'lead_followups_digest';
const SUBJECT_MAX_LEN = 140;

function ymdInTz(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Convert a wall-clock date/time in `timeZone` to a UTC Date. */
function zonedDateTimeToUtc(ymd, hms, timeZone) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const [hh, mm, ss] = hms.split(':').map(Number);
  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, ss || 0);

  for (let i = 0; i < 3; i += 1) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(utcMs))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value])
    );
    const gotMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const wantedMs = Date.UTC(y, mo - 1, d, hh, mm, ss || 0);
    utcMs += wantedMs - gotMs;
  }

  return new Date(utcMs);
}

function dayBoundsInTz(date, timeZone) {
  const ymd = ymdInTz(date, timeZone);
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextYmd = next.toISOString().slice(0, 10);
  return {
    start: zonedDateTimeToUtc(ymd, '00:00:00', timeZone),
    endExclusive: zonedDateTimeToUtc(nextYmd, '00:00:00', timeZone),
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(timeStr) {
  if (!timeStr || !String(timeStr).trim()) return '';
  return String(timeStr).trim();
}

function formatFollowUpDate(fu, timeZone) {
  if (!fu.follow_up_date) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(fu.follow_up_date));
}

function partyName(lead = {}) {
  const party = lead.party_id;
  if (party && typeof party === 'object') {
    return party.party_name || party.legal_name || '';
  }
  return lead.company_name || lead.name || 'Unknown party';
}

function formatRequirements(lead = {}) {
  const parts = [];
  if (lead.requirement && String(lead.requirement).trim()) {
    parts.push(String(lead.requirement).trim());
  }
  if (Array.isArray(lead.products) && lead.products.length) {
    const productLine = lead.products
      .map((p) => {
        const name = p.product_name || 'Product';
        const qty = p.quantity != null ? ` × ${p.quantity}` : '';
        const unit = p.unit && p.unit !== 'pcs' ? ` ${p.unit}` : '';
        return `${name}${qty}${unit}`;
      })
      .join(', ');
    if (productLine) parts.push(productLine);
  }
  return parts.filter(Boolean).join(' | ') || '—';
}

function whenLabel(fu, { timeZone, includeDate }) {
  const datePart = includeDate ? formatFollowUpDate(fu, timeZone) : '';
  const time = formatTime(fu.follow_up_time);
  return [datePart, time].filter(Boolean).join(' ') || '—';
}

function formatNotifLine(fu, opts) {
  const lead = fu.lead || {};
  const leadNo = lead.lead_no ? `#${lead.lead_no}` : 'Lead';
  const party = partyName(lead);
  const req = formatRequirements(lead);
  const when = whenLabel(fu, opts);
  const type = fu.type || 'call';
  return `${when} · ${type} · ${leadNo} · ${party} · ${req}`;
}

function truncateSubject(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= SUBJECT_MAX_LEN) return s;
  return `${s.slice(0, SUBJECT_MAX_LEN - 1).trim()}…`;
}

function buildEmailSubject({ isOverdue, count, dateLabel, followUps }) {
  const prefix = isOverdue
    ? count === 1
      ? 'Overdue follow-up'
      : `Overdue follow-ups (${count})`
    : count === 1
      ? "Today's follow-up"
      : `Today's follow-ups (${count})`;

  const snippets = followUps.map((fu) => {
    const lead = fu.lead || {};
    const party = partyName(lead);
    const req = formatRequirements(lead);
    return req && req !== '—' ? `${party} — ${req}` : party;
  });

  if (snippets.length === 1) {
    return truncateSubject(`${prefix}: ${snippets[0]} · ${dateLabel}`);
  }

  return truncateSubject(`${prefix}: ${snippets.join('; ')} · ${dateLabel}`);
}

function buildFollowUpsRows(followUps, { timeZone, includeDate }) {
  return followUps
    .map((fu, idx) => {
      const lead = fu.lead || {};
      const leadNo = lead.lead_no ? `#${escapeHtml(lead.lead_no)}` : '—';
      const party = escapeHtml(partyName(lead));
      const req = escapeHtml(formatRequirements(lead));
      const type = escapeHtml(fu.type || 'call');
      const when = escapeHtml(whenLabel(fu, { timeZone, includeDate }));
      const notes = escapeHtml(fu.notes || '—');
      return `
              <tr>
                <td class="muted">${idx + 1}</td>
                <td>${leadNo}</td>
                <td class="party">${party}</td>
                <td class="req">${req}</td>
                <td>${type}</td>
                <td>${when}</td>
                <td class="muted">${notes}</td>
              </tr>`;
    })
    .join('\n');
}

function groupByAssignee(rows) {
  /** @type {Map<string, typeof rows>} */
  const byUser = new Map();
  for (const fu of rows) {
    const status = fu.lead?.status;
    if (status && CLOSED_LEAD_STATUSES.has(status)) continue;

    const assigneeId = fu.lead?.assigned_to ? String(fu.lead.assigned_to) : null;
    const fallbackId = fu.created_by ? String(fu.created_by) : null;
    const userId = assigneeId || fallbackId;
    if (!userId) continue;
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId).push(fu);
  }
  return byUser;
}

/**
 * @param {object} params
 * @param {string} params.kind
 * @param {string} params.timeZone
 * @param {boolean} params.force
 * @param {import('mongoose').FilterQuery<any>} params.query
 * @param {boolean} params.isOverdue
 * @param {boolean} [params.includeDateInLines]
 */
async function sendGroupedDigest({
  kind,
  timeZone,
  force,
  query,
  isOverdue,
  includeDateInLines = false,
}) {
  const { LeadFollowUp, User, FollowUpDigestLog } = getModels();

  const now = new Date();
  const digestDate = ymdInTz(now, timeZone);
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);

  const rows = await LeadFollowUp.find(query)
    .populate({
      path: 'lead',
      select:
        'lead_no name company_name phone email status priority assigned_to requirement products party_id',
      populate: { path: 'party_id', select: 'party_name legal_name' },
    })
    .sort({ follow_up_date: 1, follow_up_time: 1 })
    .lean();

  const byUser = groupByAssignee(rows);
  const userIds = [...byUser.keys()];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name email').lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const notified = [];
  let skipped = 0;
  let eligibleFollowUps = 0;

  for (const [userId, followUps] of byUser.entries()) {
    eligibleFollowUps += followUps.length;

    if (!force) {
      try {
        await FollowUpDigestLog.create({
          kind,
          user: userId,
          digest_date: digestDate,
          follow_up_count: followUps.length,
          sent_at: new Date(),
        });
      } catch (err) {
        if (err && err.code === 11000) {
          skipped += 1;
          continue;
        }
        throw err;
      }
    }

    const user = userMap.get(userId);
    const count = followUps.length;
    const lines = followUps.map((fu) =>
      formatNotifLine(fu, { timeZone, includeDate: includeDateInLines })
    );
    const title = isOverdue ? `Overdue follow-ups (${count})` : `Today's follow-ups (${count})`;
    const message =
      count === 1
        ? `${isOverdue ? 'Overdue: ' : ''}${lines[0]}`
        : count <= 5
          ? lines.join(' | ')
          : `${lines.slice(0, 5).join(' | ')} … +${count - 5} more`;

    const subject = buildEmailSubject({ isOverdue, count, dateLabel, followUps });
    const followUpsRows = buildFollowUpsRows(followUps, {
      timeZone,
      includeDate: includeDateInLines || isOverdue,
    });

    try {
      const created = await notificationHelper.createForUser(userId, {
        title,
        message,
        type: isOverdue ? 'warning' : 'info',
        module: 'lead',
        entity_type: isOverdue ? 'follow_up_overdue_digest' : 'follow_up_digest',
      });
      if (!created) {
        throw new Error('notification-service createForUser returned empty');
      }

      if (user?.email) {
        try {
          await emailHelper.sendTemplateEmail(user.email, EMAIL_TEMPLATE, {
            subject,
            recipientName: user.name || 'there',
            dateLabel,
            count: String(count),
            digestSubtitle: isOverdue
              ? `Overdue Follow-up Reminder · ${dateLabel}`
              : `Today's Follow-up Agenda · ${dateLabel}`,
            introText: isOverdue
              ? `You have <strong>${count}</strong> overdue follow-up${count === 1 ? '' : 's'} (due before <strong>${escapeHtml(dateLabel)}</strong>). Party and requirements for each are listed below.`
              : `You have <strong>${count}</strong> follow-up${count === 1 ? '' : 's'} scheduled for <strong>${escapeHtml(dateLabel)}</strong>. Party and requirements for each are listed below.`,
            tableTitle: isOverdue ? 'Overdue follow-ups' : "Today's follow-ups",
            badgeLabel: isOverdue ? 'OVERDUE' : 'TODAY',
            badgeClass: isOverdue ? 'badge-overdue' : 'badge-today',
            headerVariant: isOverdue ? 'overdue' : '',
            actionVariant: isOverdue ? 'overdue' : '',
            actionTitle: isOverdue ? 'Action required' : 'Plan your day',
            actionText: isOverdue
              ? 'Please complete or reschedule every overdue item below. Priority parties and their requirements are included for quick context.'
              : 'Please complete each scheduled interaction below. Party names and requirements are included so you can prepare before calling or visiting.',
            followUpsRows,
          });
        } catch (err) {
          logger.error(`[followUpDailyReminder] email failed for ${user.email}: ${err.message}`);
        }
      }

      if (force) {
        await FollowUpDigestLog.findOneAndUpdate(
          { kind, user: userId, digest_date: digestDate },
          {
            $set: { follow_up_count: followUps.length, sent_at: new Date() },
            $setOnInsert: { kind, user: userId, digest_date: digestDate },
          },
          { upsert: true }
        );
      }

      notified.push(userId);
    } catch (err) {
      if (!force) {
        await FollowUpDigestLog.deleteOne({
          kind,
          user: userId,
          digest_date: digestDate,
        }).catch(() => {});
      }
      logger.error(`[followUpDailyReminder] ${kind} notify failed for user ${userId}: ${err.message}`);
    }
  }

  const summary = {
    kind,
    dateLabel,
    digestDate,
    recipientCount: notified.length,
    followUpCount: eligibleFollowUps,
    skipped,
    notified,
  };
  logger.info(
    `[followUpDailyReminder] kind=${kind} sent=${summary.recipientCount} skipped=${summary.skipped} followUps=${summary.followUpCount} date=${digestDate}`
  );
  return summary;
}

/**
 * Send today's pending follow-up reminders grouped by lead assignee.
 * @param {{ timeZone?: string, force?: boolean }} [options]
 */
async function runTodaysFollowUpReminders(options = {}) {
  const timeZone = options.timeZone || FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata';
  const { start, endExclusive } = dayBoundsInTz(new Date(), timeZone);

  return sendGroupedDigest({
    kind: 'todays_followups',
    timeZone,
    force: Boolean(options.force),
    isOverdue: false,
    includeDateInLines: false,
    query: {
      deletedAt: null,
      status: 'pending',
      follow_up_date: { $gte: start, $lt: endExclusive },
    },
  });
}

/**
 * Send overdue pending follow-up reminders (before start of today) grouped by assignee.
 * @param {{ timeZone?: string, force?: boolean }} [options]
 */
async function runOverdueFollowUpReminders(options = {}) {
  const timeZone = options.timeZone || FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata';
  const { start } = dayBoundsInTz(new Date(), timeZone);

  return sendGroupedDigest({
    kind: 'overdue_followups',
    timeZone,
    force: Boolean(options.force),
    isOverdue: true,
    includeDateInLines: true,
    query: {
      deletedAt: null,
      status: 'pending',
      follow_up_date: { $lt: start },
    },
  });
}

/** Run both digests (today then overdue). */
async function runAllFollowUpReminders(options = {}) {
  const today = await runTodaysFollowUpReminders(options);
  const overdue = await runOverdueFollowUpReminders(options);
  return { today, overdue };
}

module.exports = {
  runTodaysFollowUpReminders,
  runOverdueFollowUpReminders,
  runAllFollowUpReminders,
};
