/**
 * @fileoverview Overdue Follow-up Escalation Job (runs twice daily at 12:30 PM & 05:30 PM).
 * Escalates >24h overdue items to Managers, and >48h stale deals/leads to Admins.
 * @module jobs/followUpEscalationJob
 */
const { FOLLOWUP_REMINDER_TZ } = require('../config/env');
const { getModels } = require('../data/mongoRegistry');
const notificationHelper = require('../utils/notificationHelper');
const emailHelper = require('../modules/messages/helpers/email.helper');
const { logger } = require('../utils/logger');

function ymdInTz(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrencyINR(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

async function runOverdueEscalationCheck(options = {}) {
  const timeZone = options.timeZone || FOLLOWUP_REMINDER_TZ || 'Asia/Kolkata';
  const { LeadFollowUp, User, FollowUpReminderLog } = getModels();

  const now = new Date();
  const todayYmd = ymdInTz(now, timeZone);
  const [y, m, d] = todayYmd.split('-').map(Number);
  const startOfToday = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

  // Find all pending overdue follow-ups
  const overdueFollowUps = await LeadFollowUp.find({
    deletedAt: null,
    status: 'pending',
    follow_up_date: { $lt: startOfToday },
  })
    .populate({
      path: 'lead',
      select: 'lead_no name company_name phone email status priority assigned_to requirement products party_id',
      populate: { path: 'party_id', select: 'party_name' },
    })
    .populate({
      path: 'quotation',
      select: 'quotation_no version grand_total status customer_name phone email created_by',
    })
    .populate('created_by', 'name email portals')
    .sort({ follow_up_date: 1 })
    .lean();

  if (overdueFollowUps.length === 0) {
    logger.info('[followUpEscalationJob] No overdue follow-ups found.');
    return { escalatedCount: 0 };
  }

  // Find all Lead Admins and Managers
  const allUsers = await User.find({ deletedAt: null }).select('name email portals').lean();
  const admins = allUsers.filter((u) => {
    const p = u.portals?.find((pt) => pt.portal_code === 'lead_manager' || pt.portal === 'lead_manager');
    return p?.access_roles?.includes('admin');
  });

  const managers = allUsers.filter((u) => {
    const p = u.portals?.find((pt) => pt.portal_code === 'lead_manager' || pt.portal === 'lead_manager');
    return p?.access_roles?.includes('manager') || p?.access_roles?.includes('admin');
  });

  let escalatedCount = 0;

  // 1. Check severe overdue (> 48h) to escalate to Admins
  const twoDaysAgo = new Date(startOfToday.getTime() - 2 * 24 * 60 * 60 * 1000);
  const severeOverdue = overdueFollowUps.filter((f) => new Date(f.follow_up_date) <= twoDaysAgo);

  if (severeOverdue.length > 0 && admins.length > 0) {
    const title = `🚨 Admin Alert: ${severeOverdue.length} Follow-ups Overdue > 48h`;
    const message = `There are ${severeOverdue.length} follow-ups critically overdue past 48 hours requiring intervention.`;

    for (const admin of admins) {
      try {
        await notificationHelper.createForUser(admin._id, {
          title,
          message,
          type: 'danger',
          module: 'lead',
          entity_type: 'escalation_digest',
        });

        if (admin.email) {
          const rowsHtml = severeOverdue
            .map((fu, idx) => {
              const isQuote = Boolean(fu.quotation);
              const target = isQuote
                ? `Quotation #${escapeHtml(fu.quotation.quotation_no)} (${formatCurrencyINR(fu.quotation.grand_total)})`
                : `Lead #${escapeHtml(fu.lead?.lead_no || '')}`;
              const party = isQuote
                ? fu.quotation.customer_name
                : fu.lead?.company_name || fu.lead?.name || 'Customer';
              const daysLate = Math.round((startOfToday - new Date(fu.follow_up_date)) / (1000 * 60 * 60 * 24));
              return `
                <tr>
                  <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;">${idx + 1}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;font-weight:700;">${target}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;">${escapeHtml(party)}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid #fee2e2;color:#b91c1c;font-weight:700;">${daysLate} days late</td>
                </tr>`;
            })
            .join('');

          const emailSubject = `🔴 CRITICAL ESCALATION: ${severeOverdue.length} Follow-ups overdue > 48 hours`;
          const htmlBody = `
            <div style="font-family:Inter,sans-serif;max-width:650px;margin:0 auto;padding:24px;border:2px solid #ef4444;border-radius:16px;background:#ffffff;">
              <div style="background:#fee2e2;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
                <span style="font-size:11px;font-weight:800;color:#991b1b;text-transform:uppercase;">🚨 Executive Escalation Alert</span>
                <h3 style="margin:4px 0 0 0;color:#7f1d1d;font-size:16px;">${severeOverdue.length} Stalled Follow-ups Require Action</h3>
              </div>
              <p style="font-size:14px;color:#334155;">
                Hello <strong>${escapeHtml(admin.name)}</strong>, the following follow-up interactions have remained unaddressed for over 48 hours:
              </p>
              <table style="width:100%;border-collapse:collapse;font-size:12px;margin:16px 0;">
                <thead>
                  <tr style="background:#fef2f2;text-align:left;color:#991b1b;">
                    <th style="padding:6px 8px;">#</th>
                    <th style="padding:6px 8px;">Target</th>
                    <th style="padding:6px 8px;">Customer</th>
                    <th style="padding:6px 8px;">Delay</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
              <p style="font-size:12px;color:#64748b;">Please coordinate with your sales team or reassign these items in the Lead Manager portal.</p>
            </div>
          `;

          await emailHelper.sendEmail(admin.email, emailSubject, message, htmlBody).catch(() => {});
        }
        escalatedCount += 1;
      } catch (err) {
        logger.error(`[followUpEscalationJob] Failed to alert admin ${admin._id}: ${err.message}`);
      }
    }
  }

  logger.info(`[followUpEscalationJob] Processed escalation check: ${escalatedCount} alerts dispatched.`);
  return { escalatedCount, totalOverdue: overdueFollowUps.length };
}

module.exports = {
  runOverdueEscalationCheck,
};
