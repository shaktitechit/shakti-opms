/**
 * @fileoverview Lead Follow-up Management service: scheduling, recording outcomes and alerts.
 * @module modules/leads/leadFollowUp.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');
const notificationService = require('../notifications/notification.service');
const { isLeadAdmin, isLeadManager } = require('./lead.service');

/**
 * Schedule a new follow-up for a lead.
 */
async function createForLead(leadId, body, user) {
  const { Lead, LeadFollowUp } = getModels();
  const lead = await Lead.findOne({ _id: leadId, deletedAt: null });
  if (!lead) throw new ApiError(404, 'Lead not found');

  if (!isLeadAdmin(user)) {
    const assignedId = lead.assigned_to ? String(lead.assigned_to) : null;
    if (!assignedId || assignedId !== String(user._id)) {
      throw new ApiError(403, 'You do not have permission to schedule follow-ups for this lead');
    }
  }

  const followUpDate = new Date(body.follow_up_date);

  const doc = await LeadFollowUp.create({
    lead: leadId,
    follow_up_date: followUpDate,
    follow_up_time: body.follow_up_time ? String(body.follow_up_time).trim() : '',
    type: body.type || 'call',
    notes: body.notes ? String(body.notes).trim() : '',
    status: 'pending',
    created_by: user._id,
    updated_by: user._id,
  });

  // Update lead's next follow-up pointer & last activity
  lead.next_follow_up_at = followUpDate;
  lead.last_activity_at = new Date();
  if (lead.status === 'new' || lead.status === 'assigned') {
    lead.status = 'follow_up';
  }
  await lead.save();

  const plain = toPlain(doc.toObject());

  await activityService.create({
    actor: user._id,
    entity_type: 'lead',
    entity_id: lead._id,
    action: 'created',
    message: `Follow-up scheduled (${body.type || 'call'}) for ${followUpDate.toLocaleDateString()}`,
    new_value: plain,
  });

  // Notify assignee if scheduled by someone else (e.g. manager)
  if (lead.assigned_to && String(lead.assigned_to) !== String(user._id)) {
    await notificationService.createForUser(lead.assigned_to, {
      title: 'Follow-up Scheduled',
      message: `A ${body.type || 'call'} follow-up was scheduled for Lead #${lead.lead_no} on ${followUpDate.toLocaleDateString()}`,
      type: 'info',
      module: 'lead',
      entity_type: 'lead',
      entity_id: lead._id,
    });
  }

  return plain;
}

/**
 * List all follow-ups for a single lead.
 */
async function listForLead(leadId, user) {
  const { Lead, LeadFollowUp } = getModels();
  if (user && !isLeadAdmin(user)) {
    const lead = await Lead.findOne({ _id: leadId, deletedAt: null });
    if (!lead) throw new ApiError(404, 'Lead not found');
    const assignedId = lead.assigned_to ? String(lead.assigned_to) : null;
    if (!assignedId || assignedId !== String(user._id)) {
      throw new ApiError(403, 'You do not have permission to view follow-ups for this lead');
    }
  }
  const rows = await LeadFollowUp.find({ lead: leadId, deletedAt: null })
    .populate('created_by', 'name email')
    .populate('completed_by', 'name email')
    .sort({ follow_up_date: -1 })
    .lean();
  return rows.map(toPlain);
}

/**
 * Complete a follow-up, record outcome, and optionally schedule the next one.
 */
async function complete(followUpId, body, user) {
  const { Lead, LeadFollowUp } = getModels();
  const fu = await LeadFollowUp.findOne({ _id: followUpId, deletedAt: null });
  if (!fu) throw new ApiError(404, 'Follow-up not found');

  const lead = await Lead.findOne({ _id: fu.lead, deletedAt: null });
  if (!lead) throw new ApiError(404, 'Associated lead not found');

  if (!isLeadAdmin(user)) {
    const assignedId = lead.assigned_to ? String(lead.assigned_to) : null;
    if (!assignedId || assignedId !== String(user._id)) {
      throw new ApiError(403, 'You do not have permission to complete follow-ups for this lead');
    }
  }

  fu.status = 'completed';
  fu.outcome = String(body.outcome).trim();
  fu.completed_at = new Date();
  fu.completed_by = user._id;
  fu.updated_by = user._id;

  let nextFu = null;
  if (body.next_follow_up_date) {
    const nextDate = new Date(body.next_follow_up_date);
    fu.next_follow_up_date = nextDate;

    // Create the next scheduled follow-up
    nextFu = await LeadFollowUp.create({
      lead: lead._id,
      follow_up_date: nextDate,
      follow_up_time: body.next_follow_up_time || '',
      type: body.next_type || fu.type,
      notes: body.next_notes || '',
      status: 'pending',
      created_by: user._id,
      updated_by: user._id,
    });

    lead.next_follow_up_at = nextDate;
  } else {
    // Check if there are other pending follow-ups
    const nextPending = await LeadFollowUp.findOne({
      lead: lead._id,
      status: 'pending',
      deletedAt: null,
      _id: { $ne: fu._id },
    }).sort({ follow_up_date: 1 });

    lead.next_follow_up_at = nextPending ? nextPending.follow_up_date : null;
  }

  if (lead.status === 'new' || lead.status === 'assigned') {
    lead.status = 'follow_up';
  }
  lead.last_contacted_at = new Date();
  lead.last_activity_at = new Date();
  await lead.save();
  await fu.save();

  const plain = toPlain(fu.toObject());

  await activityService.create({
    actor: user._id,
    entity_type: 'lead',
    entity_id: lead._id,
    action: 'status_changed',
    message: `Follow-up completed: ${body.outcome}`,
    new_value: plain,
  });

  return {
    completed: plain,
    next: nextFu ? toPlain(nextFu.toObject()) : null,
  };
}

/**
 * Get follow-up list for calendar/agenda view.
 */
async function getCalendar(query = {}, user) {
  const { LeadFollowUp } = getModels();
  const q = { deletedAt: null };

  if (query.from_date || query.to_date) {
    q.follow_up_date = {};
    if (query.from_date) {
      const from = new Date(query.from_date);
      from.setHours(0, 0, 0, 0);
      q.follow_up_date.$gte = from;
    }
    if (query.to_date) {
      const to = new Date(query.to_date);
      to.setHours(23, 59, 59, 999);
      q.follow_up_date.$lte = to;
    }
  }

  if (query.status && query.status !== 'all') {
    q.status = query.status;
  }

  if (query.type && query.type !== 'all') {
    q.type = query.type;
  }

  const isAdmin = isLeadAdmin(user);
  const isMgr = isLeadManager(user);
  const hasQuotationAccess = isAdmin || isMgr;
  const userIdStr = String(user._id);

  if (!hasQuotationAccess) {
    q.quotation = null;
    q.lead = { $ne: null };
  } else if (query.entity_type === 'lead') {
    q.quotation = null;
    q.lead = { $ne: null };
  } else if (query.entity_type === 'quotation') {
    q.quotation = { $ne: null };
  }

  const rows = await LeadFollowUp.find(q)
    .populate({
      path: 'lead',
      select: 'lead_no name company_name phone email status priority assigned_to estimated_value party_id requirement_details',
      populate: [
        { path: 'assigned_to', select: 'name email department' },
        { path: 'party_id', select: 'party_name legal_name district state' },
      ],
    })
    .populate({
      path: 'quotation',
      select: 'quotation_no version grand_total status customer_name kind_attn phone email subject party_id created_by sales_person_name sales_person_user lead',
      populate: [
        { path: 'sales_person_user', select: 'name email department' },
        { path: 'party_id', select: 'party_name legal_name' },
      ],
    })
    .populate('created_by', 'name email department')
    .populate('completed_by', 'name email department')
    .sort({ follow_up_date: 1 })
    .lean();

  // Filter based on user scope
  if (!isAdmin) {
    if (isMgr) {
      // Manager: quotation follow-ups on own created quotations, lead follow-ups on own assigned leads
      return rows
        .filter((r) => {
          const fuCreator = r.created_by?._id ? String(r.created_by._id) : (r.created_by ? String(r.created_by) : null);
          if (r.quotation) {
            const qCreator = r.quotation?.created_by?._id ? String(r.quotation.created_by._id) : (r.quotation?.created_by ? String(r.quotation.created_by) : null);
            const qRep = r.quotation?.sales_person_user?._id ? String(r.quotation.sales_person_user._id) : (r.quotation?.sales_person_user ? String(r.quotation.sales_person_user) : null);
            return qCreator === userIdStr || qRep === userIdStr || fuCreator === userIdStr;
          }
          if (r.lead) {
            const leadAssignee = r.lead?.assigned_to?._id ? String(r.lead.assigned_to._id) : (r.lead?.assigned_to ? String(r.lead.assigned_to) : null);
            return leadAssignee === userIdStr || fuCreator === userIdStr;
          }
          return fuCreator === userIdStr;
        })
        .map(toPlain);
    } else {
      // Executive: strictly see their assigned or created lead follow-ups (no quotations)
      return rows
        .filter((r) => {
          if (r.quotation) return false;
          const assignedId = r.lead?.assigned_to?._id ? String(r.lead.assigned_to._id) : (r.lead?.assigned_to ? String(r.lead.assigned_to) : null);
          const fuCreator = r.created_by?._id ? String(r.created_by._id) : (r.created_by ? String(r.created_by) : null);
          return assignedId === userIdStr || fuCreator === userIdStr;
        })
        .map(toPlain);
    }
  }

  // If admin filtered by assigned_to
  if (isAdmin && query.assigned_to && query.assigned_to !== 'all') {
    const targetAssignee = String(query.assigned_to);
    return rows
      .filter((r) => {
        const leadAssignee = r.lead?.assigned_to?._id ? String(r.lead.assigned_to._id) : (r.lead?.assigned_to ? String(r.lead.assigned_to) : null);
        const qRep = r.quotation?.sales_person_user?._id ? String(r.quotation.sales_person_user._id) : (r.quotation?.sales_person_user ? String(r.quotation.sales_person_user) : null);
        const qCreator = r.quotation?.created_by?._id ? String(r.quotation.created_by._id) : (r.quotation?.created_by ? String(r.quotation.created_by) : null);
        const fuCreator = r.created_by?._id ? String(r.created_by._id) : (r.created_by ? String(r.created_by) : null);
        return leadAssignee === targetAssignee || qRep === targetAssignee || qCreator === targetAssignee || fuCreator === targetAssignee;
      })
      .map(toPlain);
  }

  return rows.map(toPlain);
}

/**
 * Get urgent follow-ups summary (overdue + due today) scoped by user role.
 * Powers the frontend persistent unskippable banner & intercept action modal.
 */
async function getUrgentSummary(user, timeZone = 'Asia/Kolkata') {
  const { LeadFollowUp } = getModels();
  const now = new Date();

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );

  const [y, m, d] = [Number(parts.year), Number(parts.month), Number(parts.day)];
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const startOfToday = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const endOfToday = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  const allPending = await LeadFollowUp.find({
    deletedAt: null,
    status: 'pending',
    follow_up_date: { $lte: endOfToday },
  })
    .populate({
      path: 'lead',
      select: 'lead_no name company_name phone email status priority assigned_to requirement products party_id contacts',
      populate: [
        { path: 'party_id', select: 'party_name legal_name' },
        { path: 'assigned_to', select: 'name email' },
      ],
    })
    .populate({
      path: 'quotation',
      select: 'quotation_no version grand_total status customer_name kind_attn phone email subject party_id created_by lead',
    })
    .sort({ follow_up_date: 1, follow_up_time: 1 })
    .lean();

  const isAdmin = isLeadAdmin(user);
  const userStr = String(user._id);

  // Filter based on user scope
  const filtered = allPending.filter((fu) => {
    if (isAdmin) return true;
    const leadAssignee = fu.lead?.assigned_to?._id ? String(fu.lead.assigned_to._id) : (fu.lead?.assigned_to ? String(fu.lead.assigned_to) : null);
    const qCreator = fu.quotation?.created_by ? String(fu.quotation.created_by) : null;
    const fuCreator = fu.created_by ? String(fu.created_by) : null;
    return leadAssignee === userStr || qCreator === userStr || fuCreator === userStr;
  });

  const overdue = [];
  const dueToday = [];
  const upcomingSoon = [];

  for (const item of filtered) {
    const isPast = new Date(item.follow_up_date) < startOfToday;
    if (isPast) {
      overdue.push(item);
    } else {
      dueToday.push(item);
      if (item.follow_up_time) {
        const timeParts = item.follow_up_time.split(':');
        if (timeParts.length >= 2) {
          const itemMins = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
          if (itemMins >= currentMinutes && itemMins <= currentMinutes + 60) {
            upcomingSoon.push(item);
          }
        }
      }
    }
  }

  const quoteCount = filtered.filter((f) => f.quotation).length;
  const leadCount = filtered.filter((f) => f.lead && !f.quotation).length;

  return {
    total_urgent: filtered.length,
    overdue_count: overdue.length,
    today_count: dueToday.length,
    upcoming_soon_count: upcomingSoon.length,
    quote_count: quoteCount,
    lead_count: leadCount,
    overdue: overdue.map(toPlain),
    due_today: dueToday.map(toPlain),
    upcoming_soon: upcomingSoon.map(toPlain),
  };
}

module.exports = {
  createForLead,
  listForLead,
  complete,
  getCalendar,
  getUrgentSummary,
};
