/**
 * @fileoverview Work Planner: business rules and mongoose persistence with portal role support.
 * @module modules/workPlanner/workPlanner.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');
const {
  sendWorkPlanCompletedEmail,
  sendCustomDayEndEmail,
  sendCustomWorkPlanCreationEmail,
  getWorkPlannerManagers,
  renderVisitsTable,
  renderTasksTable,
} = require('./workPlanNotification.service');
const {
  EDITABLE_PLAN_STATUSES,
  EDITABLE_EXPENSE_STATUSES,
  TERMINAL_VISIT_STATUSES,
  TRAVEL_SUB_CATEGORIES,
  startOfDay,
  endOfDay,
  isAdminDept,
  isWpElevated,
  isExpenseAddWindowOpen,
  isExpenseAddWindowEnded,
  isExpenseReceiptRequired,
} = require('./workPlanner.constants');
const {
  canAccessSalesUser,
  applySalesUserFilter,
} = require('./teamVisibility.service');

function userId(user) {
  return user?._id || user?.id;
}

function getUserRole(user) {
  if (!user) return 'Executive';
  if (user.role) return String(user.role);
  if (user.user_role) return String(user.user_role);
  if (Array.isArray(user.roles) && user.roles.length > 0) return String(user.roles[0]);
  if (Array.isArray(user.role_codes) && user.role_codes.length > 0) return String(user.role_codes[0]);
  return 'Executive';
}

/** Aggregate $match needs ObjectId; req.user ids are strings (see toReqUser). */
function asObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function parseCsvInts(value) {
  if (value == null || value === '') return [];
  const parts = Array.isArray(value) ? value : String(value).split(',');
  return parts
    .map((part) => parseInt(String(part).trim(), 10))
    .filter((n) => Number.isFinite(n));
}

function toValidDate(val, baseDate) {
  if (val == null || val === '') return undefined;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const timeMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*([AP]M)?$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      const base = baseDate ? new Date(baseDate) : new Date();
      if (isNaN(base.getTime())) return undefined;
      base.setHours(hours, minutes, seconds, 0);
      return base;
    }
  }
  return undefined;
}

/** Date-range (`from`/`to`) or year+month (`years`, `months` 1–12) match on a date field. */
function planDatePeriodMatch(query = {}, datePath = 'plan_date') {
  if (query.from || query.to) {
    const range = {};
    if (query.from) range.$gte = startOfDay(query.from);
    if (query.to) range.$lte = endOfDay(query.to);
    return { [datePath]: range };
  }

  if (query.years == null && query.months == null) return {};

  const years = parseCsvInts(query.years);
  const months = parseCsvInts(query.months);
  if (years.length === 0 || months.length === 0) {
    return { $expr: { $eq: [0, 1] } };
  }

  const clauses = [
    { $in: [{ $year: `$${datePath}` }, years] },
    { $in: [{ $month: `$${datePath}` }, months] },
  ];
  return { $expr: { $and: clauses } };
}

function sameId(a, b) {
  return String(a) === String(b);
}

function isOwner(plan, user) {
  return sameId(plan.sales_user?._id || plan.sales_user, userId(user));
}

async function assertCanView(plan, user) {
  if (await canAccessSalesUser(user, plan.sales_user)) return;
  throw new ApiError(403, 'You do not have access to this work plan');
}

async function assertCanEditStructure(plan, user) {
  if (!(await canAccessSalesUser(user, plan.sales_user))) {
    throw new ApiError(403, 'Only the plan owner or their manager can edit this work plan');
  }
  // Admin / manager (within team scope) may keep editing after submit/approve/completed.
  if (isWpElevated(user)) {
    return;
  }
  // Executive owners may edit planned, draft, or rejected plans.
  if (!EDITABLE_PLAN_STATUSES.includes(plan.status)) {
    throw new ApiError(400, `Cannot edit a work plan in status "${plan.status}"`);
  }
}

async function assertCanEditVisits(plan, user) {
  if (!(await canAccessSalesUser(user, plan.sales_user))) {
    throw new ApiError(403, 'Only the plan owner or their manager can edit this work plan');
  }
  if (isWpElevated(user)) {
    return;
  }
  // Executive owners may edit visits/tasks on planned, draft, rejected, approved, submitted, or completed plans.
  if (!['planned', 'draft', 'rejected', 'approved', 'submitted', 'completed'].includes(plan.status)) {
    throw new ApiError(400, `Cannot edit visits for a work plan in status "${plan.status}"`);
  }
}

function assertValidPlanDateForUser(planDateInput, user) {
  if (isWpElevated(user)) return;
  const pDate = startOfDay(planDateInput);
  const minAllowed = startOfDay(new Date());
  minAllowed.setUTCDate(minAllowed.getUTCDate() - 2);

  if (pDate.getTime() < minAllowed.getTime()) {
    throw new ApiError(
      400,
      'Executives cannot create or edit work plans for dates earlier than 2 days before today',
    );
  }
}

async function logActivity(user, planId, action, message, extra = {}) {
  await activityService.create({
    actor: userId(user),
    entity_type: 'work_plan',
    entity_id: planId,
    action,
    message,
    ...extra,
  });
}

function parseStandaloneId(id) {
  if (typeof id !== 'string' || !id.startsWith('standalone_')) return null;
  const parts = id.split('_');
  // standalone_<userId>_<YYYY-MM-DD>
  const salesUserId = parts[1];
  const dateStr = parts.slice(2).join('_');
  return { salesUserId, dateStr };
}

async function loadPlanOrThrow(id) {
  const parsed = parseStandaloneId(id);
  if (parsed) {
    const { User, WorkPlanVisit, WorkPlanWork } = getModels();
    const userDoc =
      parsed.salesUserId && mongoose.Types.ObjectId.isValid(parsed.salesUserId)
        ? await User.findById(parsed.salesUserId).select('name email department').lean()
        : null;
    const planDate =
      parsed.dateStr && parsed.dateStr !== 'nodate' ? startOfDay(parsed.dateStr) : new Date();

    const [visitCount, workCount] = await Promise.all([
      parsed.salesUserId
        ? WorkPlanVisit.countDocuments({
            sales_user: parsed.salesUserId,
            work_plan: null,
            deletedAt: null,
            ...(parsed.dateStr && parsed.dateStr !== 'nodate'
              ? { plan_date: { $gte: startOfDay(parsed.dateStr), $lte: endOfDay(parsed.dateStr) } }
              : {}),
          })
        : 0,
      parsed.salesUserId
        ? WorkPlanWork.countDocuments({
            sales_user: parsed.salesUserId,
            work_plan: null,
            deletedAt: null,
            ...(parsed.dateStr && parsed.dateStr !== 'nodate'
              ? { plan_date: { $gte: startOfDay(parsed.dateStr), $lte: endOfDay(parsed.dateStr) } }
              : {}),
          })
        : 0,
    ]);

    const planType =
      visitCount > 0 && workCount > 0
        ? 'Tasks & Visits'
        : visitCount > 0
        ? 'Visits'
        : 'Work From Office';

    return {
      _id: id,
      id: id,
      is_standalone: true,
      plan_date: planDate,
      sales_user: userDoc || parsed.salesUserId,
      status: 'planned',
      plan_type: planType,
      location: 'HQ / Territory',
      remarks: '',
      is_discussed_with_manager: false,
      visit_count: visitCount,
      work_count: workCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(404, 'Work plan not found');
  }

  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null })
    .populate('sales_user', 'name email department')
    .populate('approved_by', 'name email')
    .populate('discussed_manager_id', 'name email department')
    .populate('day_end.attachments')
    .lean();
  if (!plan) throw new ApiError(404, 'Work plan not found');
  return plan;
}

async function loadVisits(planId) {
  const { WorkPlanVisit } = getModels();
  const parsed = parseStandaloneId(planId);
  let filter;
  if (parsed) {
    const planDate = parsed.dateStr && parsed.dateStr !== 'nodate' ? startOfDay(parsed.dateStr) : null;
    filter = {
      sales_user: parsed.salesUserId,
      work_plan: null,
      deletedAt: null,
      ...(planDate ? { plan_date: { $gte: startOfDay(planDate), $lte: endOfDay(planDate) } } : {}),
    };
  } else if (!mongoose.Types.ObjectId.isValid(planId)) {
    return [];
  } else {
    filter = { work_plan: planId, deletedAt: null };
  }

  const rows = await WorkPlanVisit.find(filter)
    .populate('party', 'party_name mobile email contact_person contacts billing_address shipping_address')
    .populate('created_by', 'name email')
    .populate('updated_by', 'name email')
    .sort({ sequence: 1 })
    .lean();
  return rows.map(toPlain);
}

async function loadExpenses(planId) {
  if (parseStandaloneId(planId) || !mongoose.Types.ObjectId.isValid(planId)) {
    return [];
  }
  const { WorkPlanExpense } = getModels();
  const { withFreshExpenseAttachmentUrls } = require('../../services/fileManagement');
  const rows = await WorkPlanExpense.find({ work_plan: planId, deletedAt: null })
    .populate('receipt_attachment')
    .populate('start_reading_image')
    .populate('end_reading_image')
    .populate('approved_by', 'name email')
    .populate('created_by', 'name email')
    .sort({ expense_date: 1, createdAt: 1 })
    .lean();
  return Promise.all(rows.map((row) => withFreshExpenseAttachmentUrls(toPlain(row))));
}

function buildExpenseTotals(expenses) {
  let expense_total = 0;
  let expense_approved_total = 0;
  const visit_expense_totals = {};

  for (const exp of expenses) {
    const amount = Number(exp.amount) || 0;
    expense_total += amount;
    if (exp.status === 'approved') expense_approved_total += amount;
    const visitKey = exp.work_plan_visit
      ? String(exp.work_plan_visit._id || exp.work_plan_visit)
      : null;
    if (visitKey) {
      visit_expense_totals[visitKey] = (visit_expense_totals[visitKey] || 0) + amount;
    }
  }

  return { expense_total, expense_approved_total, visit_expense_totals };
}

async function getWithVisits(id) {
  const plan = await loadPlanOrThrow(id);
  const { withFreshViewUrl } = require('../../services/fileManagement');
  if (plan.day_end && Array.isArray(plan.day_end.attachments)) {
    plan.day_end.attachments = await Promise.all(
      plan.day_end.attachments.map((att) => withFreshViewUrl(att))
    );
  }
  const [visits, works, expenses] = await Promise.all([loadVisits(id), loadWorks(id), loadExpenses(id)]);
  const totals = buildExpenseTotals(expenses);
  return { ...toPlain(plan), visits, works, expenses, ...totals };
}

async function renumberVisits(planId) {
  if (parseStandaloneId(planId) || !mongoose.Types.ObjectId.isValid(planId)) return;
  const { WorkPlanVisit } = getModels();
  const visits = await WorkPlanVisit.find({ work_plan: planId, deletedAt: null })
    .sort({ sequence: 1 })
    .lean();
  for (let i = 0; i < visits.length; i += 1) {
    await WorkPlanVisit.updateOne(
      { _id: visits[i]._id },
      { $set: { sequence: (i + 1) * 1000 } }
    );
  }
  for (let i = 0; i < visits.length; i += 1) {
    await WorkPlanVisit.updateOne({ _id: visits[i]._id }, { $set: { sequence: i + 1 } });
  }
}

async function maybeCompletePlan(planId, user) {
  // Plan completion is manual via Complete Work Plan button
  return;
}

async function maybeCompleteWorkPlan(planId, user) {
  // Plan completion is manual via Complete Work Plan button
  return;
}

async function completePlan(id, user, dayEndData = null) {
  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (!isOwner(plan, user) && !isAdminDept(user)) {
    throw new ApiError(403, 'Only the plan owner can complete this work plan');
  }
  if (!['planned', 'approved'].includes(plan.status)) {
    throw new ApiError(400, 'Only active planned work plans can be completed');
  }
  if (!isAdminDept(user) && !isExpenseAddWindowOpen(plan.plan_date)) {
    throw new ApiError(
      400,
      'Work plans can only be completed within the 3-day window from the work plan date',
    );
  }

  plan.status = 'completed';
  plan.updated_by = userId(user);

  if (dayEndData && typeof dayEndData === 'object') {
    const validAttachmentIds = Array.isArray(dayEndData.attachment_ids)
      ? dayEndData.attachment_ids.filter((aid) => aid && mongoose.Types.ObjectId.isValid(aid))
      : [];

    plan.day_end = {
      completed_at: new Date(),
      from_email: dayEndData.from_email || user.email,
      to_email: dayEndData.to_email || '',
      cc_emails: Array.isArray(dayEndData.cc_emails)
        ? dayEndData.cc_emails.map((e) => String(e).trim()).filter(Boolean)
        : [],
      subject: dayEndData.subject || `Day End Report — ${user.name || user.email}`,
      body_html: dayEndData.body_html || '',
      attachments: validAttachmentIds,
    };
  }

  await plan.save();
  await logActivity(user, id, 'status_changed', 'Work plan marked completed via Day End');

  // Trigger completion notification emails
  if (dayEndData && dayEndData.to_email) {
    sendCustomDayEndEmail(id, user, dayEndData).catch((err) =>
      console.error('[workPlanner.service] Day End custom email error:', err?.message || err)
    );
  } else {
    sendWorkPlanCompletedEmail(id, user).catch((err) =>
      console.error('[workPlanner.service] completion email error:', err?.message || err)
    );
  }

  return get(id, user);
}

async function getDayEndDraft(id, user) {
  const plan = await loadPlanOrThrow(id);
  await assertCanView(plan, user);

  const [visits, works, expenses] = await Promise.all([
    loadVisits(id),
    loadWorks(id),
    loadExpenses(id),
  ]);

  const managers = await getWorkPlannerManagers();
  const managerList = managers.map((m) => ({
    _id: String(m._id),
    name: m.name || m.email.split('@')[0],
    email: m.email,
    department: m.department || '',
  }));

  const planType = plan.plan_type || 'Visits';
  const targetUserId = plan.sales_user?._id || plan.sales_user || user._id;

  let userSettings = null;
  try {
    userSettings = await getUserSettings(targetUserId, user);
  } catch (e) {
    // fallback if user settings not found
  }

  const pts = userSettings?.planTypeSettings?.[planType];
  const ptsManagerEmail = pts?.assignedManagerEmail;
  const globalManagerEmail = userSettings?.assignedManagerEmail;

  // Primary recipient priority:
  // 1. Plan-type assigned manager email
  // 2. Global assigned manager email
  // 3. Discussed manager email
  // 4. First manager in roster
  let firstManagerEmail =
    ptsManagerEmail ||
    globalManagerEmail ||
    (plan.discussed_manager_id && plan.discussed_manager_id.email ? plan.discussed_manager_id.email : '') ||
    (managerList.length > 0 ? managerList[0].email : '');

  // CC list priority:
  // 1. Plan-type CC emails (if non-empty)
  // 2. Global CC emails (if non-empty)
  const ptsCc = pts?.ccEmails || [];
  const globalCc = userSettings?.ccEmails || [];
  const configuredCc = ptsCc.length > 0 ? ptsCc : globalCc;

  const ccEmails = configuredCc.filter(
    (email) => email && email.toLowerCase() !== firstManagerEmail.toLowerCase()
  );

  const executiveName = user.name || user.email?.split('@')[0] || 'Executive';
  const executiveEmail = user.email || '';
  const fromAddress = `${executiveName} <${executiveEmail}>`;

  const planDateStr = plan.plan_date
    ? new Date(plan.plan_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB');

  const subject = `Day End Report — ${executiveName} (${planDateStr})`;
  const expensesTotal = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const visitsTableHtml = renderVisitsTable(visits);
  const tasksTableHtml = renderTasksTable(works);

  const defaultHtmlBody = `
<div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">Day End Report — Summary</h2>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Executive:</strong> ${executiveName} (${executiveEmail})</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Plan Date:</strong> ${planDateStr}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Plan Type:</strong> ${plan.plan_type || 'Visits'} | <strong>Location:</strong> ${plan.location || 'N/A'}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Total Expenses Logged:</strong> ₹${expensesTotal.toLocaleString('en-IN')}</p>
  </div>

  <h3 style="color: #0f172a; font-size: 16px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-top: 24px;">Field Visits (${visits.length})</h3>
  ${visitsTableHtml}

  <h3 style="color: #0f172a; font-size: 16px; border-bottom: 2px solid #059669; padding-bottom: 6px; margin-top: 24px;">Tasks / Work Items (${works.length})</h3>
  ${tasksTableHtml}

  <h3 style="color: #0f172a; font-size: 16px; border-bottom: 2px solid #475569; padding-bottom: 6px; margin-top: 24px;">Key Highlights & Day End Remarks</h3>
  <p style="font-size: 14px; color: #334155; padding: 12px; background: #f1f5f9; border-radius: 6px;">
    ${plan.remarks ? plan.remarks : 'Please add any specific highlights, order wins, follow-ups, or escalations here...'}
  </p>
</div>
  `.trim();

  return {
    plan_id: String(plan._id),
    plan_date: plan.plan_date,
    from: fromAddress,
    from_email: executiveEmail,
    to: firstManagerEmail,
    cc: ccEmails,
    subject,
    body_html: defaultHtmlBody,
    managers: managerList,
  };
}

async function list(query = {}, user) {
  const { WorkPlan, WorkPlanVisit, WorkPlanWork } = getModels();
  const filter = { deletedAt: null };

  await applySalesUserFilter(filter, user, query);

  if (query.status) filter.status = query.status;
  if (query.plan_type && query.plan_type !== 'all') {
    if (query.plan_type === 'Visits') {
      filter.$or = [
        { plan_type: 'Visits' },
        { plan_type: { $exists: false } },
        { plan_type: null },
        { plan_type: '' },
      ];
    } else {
      filter.plan_type = query.plan_type;
    }
  }

  if (query.date) {
    filter.plan_date = {
      $gte: startOfDay(query.date),
      $lte: endOfDay(query.date),
    };
  } else if (query.from || query.to) {
    filter.plan_date = {};
    if (query.from) filter.plan_date.$gte = startOfDay(query.from);
    if (query.to) filter.plan_date.$lte = endOfDay(query.to);
  }

  if (query.party) {
    const planIds = await WorkPlanVisit.distinct('work_plan', {
      party: query.party,
      deletedAt: null,
    });
    filter._id = { $in: planIds };
  }

  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WorkPlan.countDocuments(filter),
    WorkPlan.find(filter)
      .populate('sales_user', 'name email department')
      .populate('approved_by', 'name email')
      .populate('discussed_manager_id', 'name email department')
      .sort({ plan_date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const planIds = rows.map((r) => r._id);
  const [visitCounts, workCounts] = await Promise.all([
    WorkPlanVisit.aggregate([
      { $match: { work_plan: { $in: planIds }, deletedAt: null } },
      { $group: { _id: '$work_plan', count: { $sum: 1 } } },
    ]),
    WorkPlanWork.aggregate([
      { $match: { work_plan: { $in: planIds }, deletedAt: null } },
      { $group: { _id: '$work_plan', count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map(visitCounts.map((c) => [String(c._id), c.count]));
  const workCountMap = new Map(workCounts.map((c) => [String(c._id), c.count]));

  const includeVisits =
    query.include_visits === '1' ||
    query.include_visits === 1 ||
    query.include_visits === true ||
    query.include_visits === 'true';
  const includeWorks =
    query.include_works === '1' ||
    query.include_works === 1 ||
    query.include_works === true ||
    query.include_works === 'true';

  const visitsByPlan = new Map();
  if (includeVisits && planIds.length) {
    const allVisits = await WorkPlanVisit.find({
      work_plan: { $in: planIds },
      deletedAt: null,
    })
      .populate(
        'party',
        'party_name mobile email contact_person contacts billing_address shipping_address',
      )
      .sort({ sequence: 1 })
      .lean();
    for (const visit of allVisits) {
      const key = String(visit.work_plan);
      if (!visitsByPlan.has(key)) visitsByPlan.set(key, []);
      visitsByPlan.get(key).push(toPlain(visit));
    }
  }

  const worksByPlan = new Map();
  if (includeWorks && planIds.length) {
    const allWorks = await WorkPlanWork.find({
      work_plan: { $in: planIds },
      deletedAt: null,
    })
      .sort({ sequence: 1 })
      .lean();
    for (const work of allWorks) {
      const key = String(work.work_plan);
      if (!worksByPlan.has(key)) worksByPlan.set(key, []);
      worksByPlan.get(key).push(toPlain(work));
    }
  }

  let standaloneRows = [];
  if (includeVisits || includeWorks || query.include_standalone) {
    const standaloneFilter = { work_plan: null, deletedAt: null };
    await applySalesUserFilter(standaloneFilter, user, query);

    if (query.date) {
      standaloneFilter.plan_date = {
        $gte: startOfDay(query.date),
        $lte: endOfDay(query.date),
      };
    } else if (query.from || query.to) {
      standaloneFilter.plan_date = {};
      if (query.from) standaloneFilter.plan_date.$gte = startOfDay(query.from);
      if (query.to) standaloneFilter.plan_date.$lte = endOfDay(query.to);
    }

    let standaloneVisits = [];
    let standaloneWorks = [];
    if (includeVisits || query.include_standalone) {
      standaloneVisits = await WorkPlanVisit.find(standaloneFilter)
        .populate('sales_user', 'name email department')
        .populate(
          'party',
          'party_name mobile email contact_person contacts billing_address shipping_address',
        )
        .sort({ sequence: 1 })
        .lean();
    }
    if (includeWorks || query.include_standalone) {
      standaloneWorks = await WorkPlanWork.find(standaloneFilter)
        .populate('sales_user', 'name email department')
        .sort({ sequence: 1 })
        .lean();
    }

    const standaloneGroups = new Map();
    for (const v of standaloneVisits) {
      const sUserId = String(v.sales_user?._id || v.sales_user || '');
      const dateStr = v.plan_date ? new Date(v.plan_date).toISOString().slice(0, 10) : 'nodate';
      const groupKey = `${sUserId}_${dateStr}`;
      if (!standaloneGroups.has(groupKey)) {
        standaloneGroups.set(groupKey, {
          sales_user: v.sales_user,
          plan_date: v.plan_date,
          visits: [],
          works: [],
        });
      }
      standaloneGroups.get(groupKey).visits.push(toPlain(v));
    }
    for (const w of standaloneWorks) {
      const sUserId = String(w.sales_user?._id || w.sales_user || '');
      const dateStr = w.plan_date ? new Date(w.plan_date).toISOString().slice(0, 10) : 'nodate';
      const groupKey = `${sUserId}_${dateStr}`;
      if (!standaloneGroups.has(groupKey)) {
        standaloneGroups.set(groupKey, {
          sales_user: w.sales_user,
          plan_date: w.plan_date,
          visits: [],
          works: [],
        });
      }
      standaloneGroups.get(groupKey).works.push(toPlain(w));
    }

    for (const [, group] of standaloneGroups.entries()) {
      const dateStr = group.plan_date ? new Date(group.plan_date).toISOString().slice(0, 10) : 'nodate';
      const sUserId = String(group.sales_user?._id || group.sales_user || '');
      const virtualId = `standalone_${sUserId}_${dateStr}`;
      standaloneRows.push({
        _id: virtualId,
        id: virtualId,
        is_standalone: true,
        plan_date: group.plan_date,
        sales_user: group.sales_user,
        status: 'planned',
        plan_type: group.visits.length > 0 ? 'Visits' : 'Tasks',
        location: 'HQ / Territory',
        visit_count: group.visits.length,
        work_count: group.works.length,
        ...(includeVisits ? { visits: group.visits } : {}),
        ...(includeWorks ? { works: group.works } : {}),
        createdAt: group.visits[0]?.createdAt || group.works[0]?.createdAt || new Date(),
        updatedAt: group.visits[0]?.updatedAt || group.works[0]?.updatedAt || new Date(),
      });
    }
  }

  const combinedData = [
    ...rows.map((r) => {
      const id = String(r._id);
      const visits = includeVisits ? visitsByPlan.get(id) || [] : undefined;
      const works = includeWorks ? worksByPlan.get(id) || [] : undefined;
      return {
        ...toPlain(r),
        visit_count: countMap.get(id) || (visits ? visits.length : 0),
        work_count: workCountMap.get(id) || (works ? works.length : 0),
        ...(includeVisits ? { visits } : {}),
        ...(includeWorks ? { works } : {}),
      };
    }),
    ...standaloneRows,
  ];

  return {
    total: total + standaloneRows.length,
    page,
    limit,
    pages: Math.ceil((total + standaloneRows.length) / limit) || 0,
    data: combinedData,
  };
}

async function get(id, user) {
  const plan = await loadPlanOrThrow(id);
  await assertCanView(plan, user);
  const { withFreshViewUrl } = require('../../services/fileManagement');
  if (plan.day_end && Array.isArray(plan.day_end.attachments)) {
    plan.day_end.attachments = await Promise.all(
      plan.day_end.attachments.map((att) => withFreshViewUrl(att))
    );
  }
  const [visits, works, expenses] = await Promise.all([loadVisits(id), loadWorks(id), loadExpenses(id)]);
  const totals = buildExpenseTotals(expenses);
  return { ...toPlain(plan), visits, works, expenses, ...totals };
}

async function create(body, user) {
  const { WorkPlan, WorkPlanVisit, WorkPlanWork } = getModels();
  assertValidPlanDateForUser(body.plan_date, user);
  let salesUserId = userId(user);
  if (body.sales_user && String(body.sales_user) !== String(userId(user))) {
    if (!isWpElevated(user)) {
      throw new ApiError(403, 'Only managers or admins can create plans for other users');
    }
    if (!(await canAccessSalesUser(user, body.sales_user))) {
      throw new ApiError(403, 'You can only create plans for yourself or your team members');
    }
    salesUserId = body.sales_user;
  }
  const planDate = startOfDay(body.plan_date);

  try {
    const doc = await WorkPlan.create({
      plan_date: planDate,
      sales_user: salesUserId,
      status: 'planned',
      remarks: body.remarks?.trim() || undefined,
      location: body.location?.trim() || undefined,
      plan_type: body.plan_type?.trim() || 'Visits',
      is_discussed_with_manager: Boolean(body.is_discussed_with_manager),
      discussed_manager_id: body.discussed_manager_id || undefined,
      discussed_manager_name: body.discussed_manager_name?.trim() || undefined,
      discussion_method: body.discussion_method?.trim() || undefined,
      created_by: userId(user),
      updated_by: userId(user),
    });

    // Automatically link any pre-existing standalone visits and works for this date to the new plan
    await WorkPlanVisit.updateMany(
      { sales_user: salesUserId, plan_date: { $gte: planDate, $lte: endOfDay(body.plan_date) }, work_plan: null, deletedAt: null },
      { $set: { work_plan: doc._id } }
    );
    await WorkPlanWork.updateMany(
      { sales_user: salesUserId, plan_date: { $gte: planDate, $lte: endOfDay(body.plan_date) }, work_plan: null, deletedAt: null },
      { $set: { work_plan: doc._id } }
    );
    await renumberVisits(doc._id);
    await renumberWorks(doc._id);

    await logActivity(user, doc._id, 'created', `Work plan created for ${planDate.toISOString().slice(0, 10)}`);
    return get(doc._id, user);
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ApiError(409, 'A work plan already exists for this sales user on the selected date');
    }
    throw err;
  }
}

async function update(id, body, user) {
  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  await assertCanEditStructure(plan, user);

  if (body.plan_date !== undefined) {
    assertValidPlanDateForUser(body.plan_date, user);
    plan.plan_date = startOfDay(body.plan_date);
  }
  if (body.remarks !== undefined) {
    plan.remarks = typeof body.remarks === 'string' ? body.remarks.trim() : body.remarks;
  }
  if (body.location !== undefined) {
    plan.location =
      typeof body.location === 'string' ? body.location.trim() : body.location;
  }
  if (body.plan_type !== undefined) {
    plan.plan_type =
      typeof body.plan_type === 'string' ? body.plan_type.trim() : body.plan_type;
  }
  if (body.is_discussed_with_manager !== undefined) {
    plan.is_discussed_with_manager = Boolean(body.is_discussed_with_manager);
  }
  if (body.discussed_manager_id !== undefined) {
    plan.discussed_manager_id = body.discussed_manager_id || undefined;
  }
  if (body.discussed_manager_name !== undefined) {
    plan.discussed_manager_name =
      typeof body.discussed_manager_name === 'string'
        ? body.discussed_manager_name.trim()
        : body.discussed_manager_name;
  }
  if (body.discussion_method !== undefined) {
    plan.discussion_method =
      typeof body.discussion_method === 'string'
        ? body.discussion_method.trim()
        : body.discussion_method;
  }
  // Rejected plans return to draft when edited
  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.approved_by = undefined;
    plan.approved_at = undefined;
    plan.submitted_at = undefined;
  }

  plan.updated_by = userId(user);

  try {
    await plan.save();
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ApiError(409, 'A work plan already exists for this sales user on the selected date');
    }
    throw err;
  }

  await logActivity(user, plan._id, 'updated', 'Work plan updated');
  return get(plan._id, user);
}

async function remove(id, user) {
  if (parseStandaloneId(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(404, 'Work plan not found');
  }
  const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  if (!isAdminDept(user) && !isOwner(plan, user)) {
    throw new ApiError(403, 'Only the plan owner can delete this work plan');
  }
  if (plan.status === 'completed' && !isAdminDept(user)) {
    throw new ApiError(400, 'Completed work plans cannot be deleted');
  }

  const now = new Date();
  plan.deletedAt = now;
  plan.updated_by = userId(user);
  await plan.save();
  await WorkPlanVisit.updateMany({ work_plan: id, deletedAt: null }, { $set: { deletedAt: now } });
  await WorkPlanWork.updateMany({ work_plan: id, deletedAt: null }, { $set: { deletedAt: now } });
  await WorkPlanExpense.updateMany({ work_plan: id, deletedAt: null }, { $set: { deletedAt: now } });

  await logActivity(user, plan._id, 'deleted', 'Work plan deleted');
  return toPlain(plan.toObject());
}

async function submit(id, user, body = {}) {
  if (parseStandaloneId(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Cannot submit a virtual work plan directly; please save it as a work plan first');
  }
  const { WorkPlan, WorkPlanVisit, WorkPlanWork } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  if (!isOwner(plan, user) && !isAdminDept(user)) {
    throw new ApiError(403, 'Only the plan owner can submit this work plan');
  }
  if (!EDITABLE_PLAN_STATUSES.includes(plan.status)) {
    throw new ApiError(400, `Cannot submit a work plan in status "${plan.status}"`);
  }

  const planType = plan.plan_type || 'Visits';
  if (planType === 'Visits') {
    const visitCount = await WorkPlanVisit.countDocuments({ work_plan: id, deletedAt: null });
    if (visitCount < 1) {
      throw new ApiError(400, 'Work plan cannot be submitted without at least one visit');
    }
  } else if (planType === 'Work From Home' || planType === 'Work From Office') {
    const workCount = await WorkPlanWork.countDocuments({ work_plan: id, deletedAt: null });
    if (workCount < 1) {
      throw new ApiError(400, 'Work plan cannot be submitted without at least one work task');
    }
  } else if (planType === 'Tasks & Visits') {
    const visitCount = await WorkPlanVisit.countDocuments({ work_plan: id, deletedAt: null });
    const workCount = await WorkPlanWork.countDocuments({ work_plan: id, deletedAt: null });
    if (visitCount < 1 && workCount < 1) {
      throw new ApiError(400, 'Work plan cannot be submitted without at least one visit or work task');
    }
  }

  plan.status = 'planned';
  plan.submitted_at = new Date();
  plan.rejection_reason = undefined;
  plan.updated_by = userId(user);
  await plan.save();

  await logActivity(user, plan._id, 'submitted', 'Work plan saved as planned and email dispatched');

  // Trigger creation email notification
  sendCustomWorkPlanCreationEmail(plan._id, user, body).catch((err) => {
    const { logger } = require('../../utils/logger');
    logger.error(`[WorkPlanService] Failed to send creation email for plan ${id}: ${err.message}`);
  });

  return get(plan._id, user);
}

async function approve(id, user) {
  if (parseStandaloneId(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(404, 'Work plan not found');
  }
  if (!isWpElevated(user)) {
    throw new ApiError(403, 'Only manager or admin can approve work plans');
  }
  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (plan.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted work plans can be approved');
  }

  plan.status = 'approved';
  plan.approved_by = userId(user);
  plan.approved_at = new Date();
  plan.rejection_reason = undefined;
  plan.updated_by = userId(user);
  await plan.save();

  await logActivity(user, plan._id, 'approved', 'Work plan approved');
  await notificationService.createForUser(plan.sales_user, {
    title: 'Work plan approved',
    message: `Your work plan for ${plan.plan_date.toISOString().slice(0, 10)} was approved.`,
    type: 'success',
    module: 'system',
    entity_type: 'work_plan',
    entity_id: plan._id,
  });

  return get(plan._id, user);
}

async function reject(id, body, user) {
  if (parseStandaloneId(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(404, 'Work plan not found');
  }
  if (!isWpElevated(user)) {
    throw new ApiError(403, 'Only manager or admin can reject work plans');
  }
  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (plan.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted work plans can be rejected');
  }

  plan.status = 'rejected';
  plan.rejection_reason = body.rejection_reason.trim();
  plan.approved_by = undefined;
  plan.approved_at = undefined;
  plan.updated_by = userId(user);
  await plan.save();

  await logActivity(user, plan._id, 'rejected', `Work plan rejected: ${plan.rejection_reason}`);
  await notificationService.createForUser(plan.sales_user, {
    title: 'Work plan rejected',
    message: `Your work plan for ${plan.plan_date.toISOString().slice(0, 10)} was rejected. Reason: ${plan.rejection_reason}`,
    type: 'warning',
    module: 'system',
    entity_type: 'work_plan',
    entity_id: plan._id,
  });

  return get(plan._id, user);
}

async function addStandaloneVisit(body, user) {
  const { WorkPlan, WorkPlanVisit, Party } = getModels();

  let salesUserId = userId(user);
  if (body.sales_user || body.salesUserId) {
    const requestedUser = String(body.sales_user || body.salesUserId);
    if (requestedUser !== String(userId(user))) {
      if (!isWpElevated(user)) {
        throw new ApiError(403, 'Only managers or admins can plan visits for other users');
      }
      if (!(await canAccessSalesUser(user, requestedUser))) {
        throw new ApiError(403, 'You can only plan visits for yourself or your team members');
      }
      salesUserId = requestedUser;
    }
  }

  const rawDate = body.plan_date || body.planDate || new Date();
  const planDate = startOfDay(rawDate);
  const userRole = getUserRole(user);

  const partyType = body.party_type || (body.party ? 'existing' : 'new_party');
  let partyDoc = null;
  if (partyType === 'existing' && body.party) {
    partyDoc = await Party.findOne({ _id: body.party, deletedAt: null }).lean();
  }

  const partyName =
    body.party_name?.trim() ||
    partyDoc?.party_name ||
    undefined;

  // Check if a work plan already exists for this sales user on that date
  const existingPlan = await WorkPlan.findOne({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(rawDate) },
    deletedAt: null,
  });

  if (existingPlan) {
    const maxSeq = await WorkPlanVisit.findOne({
      work_plan: existingPlan._id,
      deletedAt: null,
    })
      .sort({ sequence: -1 })
      .select('sequence')
      .lean();

    const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

    const visit = await WorkPlanVisit.create({
      work_plan: existingPlan._id,
      sales_user: salesUserId,
      plan_date: planDate,
      sequence,
      party_type: partyType,
      party: partyType === 'existing' ? body.party : undefined,
      party_name: partyName,
      contact_person: body.contact_person?.trim() || undefined,
      contact_number: body.contact_number?.trim() || undefined,
      contact_email: body.contact_email?.trim()?.toLowerCase() || undefined,
      contacts: body.contacts,
      address: body.address?.trim() || undefined,
      planned_start_time: toValidDate(body.planned_start_time, planDate),
      planned_end_time: toValidDate(body.planned_end_time, planDate),
      purpose: body.purpose?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
      status: body.status || 'created',
      pending_remarks: body.pending_remarks?.trim() || undefined,
      in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
      created_by: userId(user),
      created_by_role: userRole,
      updated_by: userId(user),
      updated_by_role: userRole,
    });

    if (existingPlan.status === 'rejected') {
      existingPlan.status = 'draft';
      existingPlan.rejection_reason = undefined;
      existingPlan.submitted_at = undefined;
      existingPlan.updated_by = userId(user);
      await existingPlan.save();
    }

    await renumberVisits(existingPlan._id);
    await logActivity(user, existingPlan._id, 'created', `Visit added to work plan for ${planDate.toISOString().slice(0, 10)}`);
    return toPlain(visit);
  }

  const maxSeq = await WorkPlanVisit.findOne({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(rawDate) },
    work_plan: null,
    deletedAt: null,
  })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();

  const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

  const visit = await WorkPlanVisit.create({
    work_plan: null,
    sales_user: salesUserId,
    plan_date: planDate,
    sequence,
    party_type: partyType,
    party: partyType === 'existing' ? body.party : undefined,
    party_name: partyName,
    contact_person: body.contact_person?.trim() || undefined,
    contact_number: body.contact_number?.trim() || undefined,
    contact_email: body.contact_email?.trim()?.toLowerCase() || undefined,
    contacts: body.contacts,
    address: body.address?.trim() || undefined,
    planned_start_time: toValidDate(body.planned_start_time, planDate),
    planned_end_time: toValidDate(body.planned_end_time, planDate),
    purpose: body.purpose?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
    status: body.status || 'created',
    pending_remarks: body.pending_remarks?.trim() || undefined,
    in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
    created_by: userId(user),
    created_by_role: userRole,
    updated_by: userId(user),
    updated_by_role: userRole,
  });

  await logActivity(user, salesUserId, 'created', `Standalone visit created for ${planDate.toISOString().slice(0, 10)}`);
  return toPlain(visit);
}

async function updateStandaloneVisit(visitId, body, user) {
  const { WorkPlanVisit, Party } = getModels();
  const visit = await WorkPlanVisit.findOne({ _id: visitId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');

  const admin = isAdminDept(user);
  if (!admin && visit.sales_user && String(visit.sales_user) !== String(userId(user))) {
    if (!(await canAccessSalesUser(user, visit.sales_user))) {
      throw new ApiError(403, 'You do not have permission to edit this visit');
    }
  }

  if (body.party_type !== undefined || body.party !== undefined) {
    const nextPartyType =
      body.party_type !== undefined
        ? String(body.party_type)
        : visit.party_type || (visit.party ? 'existing' : 'new_party');

    visit.party_type = nextPartyType;

    if (nextPartyType === 'existing') {
      const partyId = body.party !== undefined ? body.party : visit.party;
      if (partyId) {
        const partyDoc = await Party.findOne({ _id: partyId, deletedAt: null }).lean();
        if (partyDoc) {
          visit.party = partyId;
          if (body.party_name === undefined && !visit.party_name) {
            visit.party_name = partyDoc.party_name;
          }
        }
      }
    } else {
      visit.party = undefined;
    }
  }

  const baseDate = visit.plan_date || new Date();
  if (body.party_name !== undefined) visit.party_name = body.party_name?.trim() || undefined;
  if (body.contact_person !== undefined) visit.contact_person = body.contact_person?.trim() || undefined;
  if (body.contact_number !== undefined) visit.contact_number = body.contact_number?.trim() || undefined;
  if (body.contact_email !== undefined) {
    visit.contact_email = body.contact_email?.trim()?.toLowerCase() || undefined;
  }
  if (body.contacts !== undefined) visit.contacts = body.contacts;
  if (body.address !== undefined) visit.address = body.address?.trim() || undefined;
  if (body.sequence !== undefined) visit.sequence = Number(body.sequence);
  if (body.planned_start_time !== undefined) {
    visit.planned_start_time = toValidDate(body.planned_start_time, baseDate);
  }
  if (body.planned_end_time !== undefined) {
    visit.planned_end_time = toValidDate(body.planned_end_time, baseDate);
  }
  if (body.purpose !== undefined) visit.purpose = body.purpose?.trim() || undefined;
  if (body.notes !== undefined) visit.notes = body.notes?.trim() || undefined;
  if (body.outcome !== undefined) visit.outcome = body.outcome?.trim() || undefined;
  if (body.meeting_with_doctor !== undefined) visit.meeting_with_doctor = Boolean(body.meeting_with_doctor);
  if (body.meeting_with_purchase !== undefined) visit.meeting_with_purchase = Boolean(body.meeting_with_purchase);
  if (body.meeting_with_finance !== undefined) visit.meeting_with_finance = Boolean(body.meeting_with_finance);
  if (body.meeting_with_engineer !== undefined) visit.meeting_with_engineer = Boolean(body.meeting_with_engineer);
  if (body.new_product_introduced !== undefined) visit.new_product_introduced = Boolean(body.new_product_introduced);
  if (body.order_received !== undefined) visit.order_received = Boolean(body.order_received);

  visit.updated_by = userId(user);
  visit.updated_by_role = getUserRole(user);

  await visit.save();
  return toPlain(visit);
}

async function removeStandaloneVisit(visitId, user) {
  const { WorkPlanVisit } = getModels();
  const visit = await WorkPlanVisit.findOne({ _id: visitId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');

  const admin = isAdminDept(user);
  const isManagerCreated = ['Manager', 'Admin', 'Super Admin', 'manager', 'admin', 'super_admin'].includes(
    String(visit.created_by_role || '').trim()
  );
  if (!admin && isManagerCreated) {
    throw new ApiError(403, 'Visits created by a Manager cannot be removed by an Executive');
  }

  visit.deletedAt = new Date();
  await visit.save();
  return { success: true };
}

async function addVisit(planId, body, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const parsed = parseStandaloneId(planId);
    const salesUserId = parsed?.salesUserId || body.sales_user || userId(user);
    const planDate = parsed?.dateStr && parsed.dateStr !== 'nodate' ? parsed.dateStr : body.plan_date;
    return addStandaloneVisit({ ...body, sales_user: salesUserId, plan_date: planDate }, user);
  }

  const { WorkPlan, WorkPlanVisit, Party } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  const partyType = body.party_type || (body.party ? 'existing' : '');
  let partyDoc = null;
  if (partyType === 'existing') {
    partyDoc = await Party.findOne({ _id: body.party, deletedAt: null }).lean();
    if (!partyDoc) throw new ApiError(404, 'Party not found');
  }

  const maxSeq = await WorkPlanVisit.findOne({ work_plan: planId, deletedAt: null })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();
  const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

  const partyName =
    body.party_name?.trim() ||
    partyDoc?.party_name ||
    undefined;

  const userRole = getUserRole(user);

  const existingVisitId = body._id || body.visit_id || body.id;
  if (existingVisitId) {
    const existingVisit = await WorkPlanVisit.findOne({ _id: existingVisitId, deletedAt: null });
    if (existingVisit) {
      existingVisit.work_plan = planId;
      existingVisit.sales_user = plan.sales_user;
      existingVisit.plan_date = plan.plan_date;
      existingVisit.sequence = sequence;
      if (body.planned_start_time !== undefined) {
        existingVisit.planned_start_time = toValidDate(body.planned_start_time, plan.plan_date);
      }
      if (body.planned_end_time !== undefined) {
        existingVisit.planned_end_time = toValidDate(body.planned_end_time, plan.plan_date);
      }
      existingVisit.updated_by = userId(user);
      existingVisit.updated_by_role = userRole;
      await existingVisit.save();

      if (plan.status === 'rejected') {
        plan.status = 'draft';
        plan.rejection_reason = undefined;
        plan.submitted_at = undefined;
        plan.updated_by = userId(user);
        await plan.save();
      }

      await renumberVisits(planId);
      await logActivity(user, planId, 'updated', `Visit reassigned (sequence ${sequence})`);
      return getWithVisits(planId);
    }
  }

  const visit = await WorkPlanVisit.create({
    work_plan: planId,
    sales_user: plan.sales_user,
    plan_date: plan.plan_date,
    sequence,
    party_type: partyType,
    party: partyType === 'existing' ? body.party : undefined,
    party_name: partyName,
    contact_person: body.contact_person?.trim() || undefined,
    contact_number: body.contact_number?.trim() || undefined,
    contact_email: body.contact_email?.trim()?.toLowerCase() || undefined,
    contacts: body.contacts,
    address: body.address?.trim() || undefined,
    planned_start_time: toValidDate(body.planned_start_time, plan.plan_date),
    planned_end_time: toValidDate(body.planned_end_time, plan.plan_date),
    purpose: body.purpose?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
    status: body.status || 'created',
    pending_remarks: body.pending_remarks?.trim() || undefined,
    in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
    created_by: userId(user),
    created_by_role: userRole,
    updated_by: userId(user),
    updated_by_role: userRole,
  });

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberVisits(planId);
  await logActivity(user, planId, 'updated', `Visit added (sequence ${sequence})`);
  return getWithVisits(planId);
}

async function updateVisit(planId, visitId, body, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    return updateStandaloneVisit(visitId, body, user);
  }

  const { WorkPlan, WorkPlanVisit, Party } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  await assertCanEditVisits(plan, user);

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');

  const admin = isAdminDept(user);
  if (!admin && !['created', 'pending', 'in_progress', 'rescheduled', 'checked_in', 'completed'].includes(visit.status)) {
    throw new ApiError(400, `Cannot edit a visit in status "${visit.status}"`);
  }

  if (body.party_type !== undefined || body.party !== undefined) {
    const nextPartyType =
      body.party_type !== undefined
        ? String(body.party_type)
        : visit.party_type || (visit.party ? 'existing' : 'new_party');

    visit.party_type = nextPartyType;

    if (nextPartyType === 'existing') {
      const partyId = body.party !== undefined ? body.party : visit.party;
      if (partyId) {
        const partyDoc = await Party.findOne({ _id: partyId, deletedAt: null }).lean();
        if (partyDoc) {
          visit.party = partyId;
          if (body.party_name === undefined && !visit.party_name) {
            visit.party_name = partyDoc.party_name;
          }
        }
      }
    } else {
      visit.party = undefined;
    }
  }

  if (body.party_name !== undefined) visit.party_name = body.party_name?.trim() || undefined;
  if (body.contact_person !== undefined) visit.contact_person = body.contact_person?.trim() || undefined;
  if (body.contact_number !== undefined) visit.contact_number = body.contact_number?.trim() || undefined;
  if (body.contact_email !== undefined) {
    visit.contact_email = body.contact_email?.trim()?.toLowerCase() || undefined;
  }
  if (body.contacts !== undefined) visit.contacts = body.contacts;
  if (body.sequence !== undefined) visit.sequence = Number(body.sequence);
  if (body.planned_start_time !== undefined) {
    visit.planned_start_time = toValidDate(body.planned_start_time, plan.plan_date);
  }
  if (body.planned_end_time !== undefined) {
    visit.planned_end_time = toValidDate(body.planned_end_time, plan.plan_date);
  }
  if (body.purpose !== undefined) visit.purpose = body.purpose?.trim() || undefined;
  if (body.notes !== undefined) visit.notes = body.notes?.trim() || undefined;
  if (body.status !== undefined) visit.status = body.status;
  if (body.pending_remarks !== undefined) visit.pending_remarks = body.pending_remarks?.trim() || undefined;
  if (body.in_progress_remarks !== undefined) visit.in_progress_remarks = body.in_progress_remarks?.trim() || undefined;
  if (body.outcome !== undefined) visit.outcome = body.outcome?.trim() || undefined;
  if (body.meeting_with_doctor !== undefined) visit.meeting_with_doctor = Boolean(body.meeting_with_doctor);
  if (body.meeting_with_purchase !== undefined) visit.meeting_with_purchase = Boolean(body.meeting_with_purchase);
  if (body.meeting_with_finance !== undefined) visit.meeting_with_finance = Boolean(body.meeting_with_finance);
  if (body.meeting_with_engineer !== undefined) visit.meeting_with_engineer = Boolean(body.meeting_with_engineer);
  if (body.new_product_introduced !== undefined) visit.new_product_introduced = Boolean(body.new_product_introduced);
  if (body.order_received !== undefined) visit.order_received = Boolean(body.order_received);

  visit.updated_by = userId(user);
  visit.updated_by_role = getUserRole(user);

  await visit.save();

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberVisits(planId);
  await logActivity(user, planId, 'updated', `Visit updated (${visitId})`);
  return getWithVisits(planId);
}

async function removeVisit(planId, visitId, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    return removeStandaloneVisit(visitId, user);
  }

  const { WorkPlan, WorkPlanVisit } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');

  const admin = isAdminDept(user);
  const isManagerCreated = ['Manager', 'Admin', 'Super Admin', 'manager', 'admin', 'super_admin'].includes(
    String(visit.created_by_role || '').trim()
  );
  if (!admin && isManagerCreated) {
    throw new ApiError(403, 'Visits created by a Manager cannot be removed by an Executive');
  }

  if (!admin && !['pending', 'rescheduled'].includes(visit.status)) {
    throw new ApiError(400, `Cannot delete a visit in status "${visit.status}"`);
  }

  visit.deletedAt = new Date();
  await visit.save();
  await renumberVisits(planId);

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await logActivity(user, planId, 'updated', `Visit deleted (${visitId})`);
  return getWithVisits(planId);
}

async function checkIn(planId, visitId, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const visit = await updateStandaloneVisit(visitId, {
      status: 'checked_in',
      actual_check_in: new Date(),
    }, user);
    await logActivity(user, visit.sales_user || userId(user), 'status_changed', `Checked in to visit ${visit.sequence}`);
    return visit;
  }

  const { WorkPlan, WorkPlanVisit } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (!isOwner(plan, user) && !isAdminDept(user)) {
    throw new ApiError(403, 'Only the plan owner can check in');
  }
  if (!['planned', 'approved', 'draft'].includes(plan.status)) {
    throw new ApiError(400, 'Visits can only be executed on planned work plans');
  }
  if (!isAdminDept(user) && !isExpenseAddWindowOpen(plan.plan_date)) {
    throw new ApiError(
      400,
      'Visits can only be executed within the 3-day window from the work plan date',
    );
  }

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');
  if (!['pending', 'rescheduled'].includes(visit.status)) {
    throw new ApiError(400, `Cannot check in a visit in status "${visit.status}"`);
  }

  visit.status = 'checked_in';
  visit.actual_check_in = new Date();
  await visit.save();

  await logActivity(user, planId, 'status_changed', `Checked in to visit ${visit.sequence}`);
  return getWithVisits(planId);
}

async function checkOut(planId, visitId, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const visit = await updateStandaloneVisit(visitId, {
      actual_check_out: new Date(),
    }, user);
    await logActivity(user, visit.sales_user || userId(user), 'status_changed', `Checked out from visit ${visit.sequence}`);
    return visit;
  }

  const { WorkPlan, WorkPlanVisit } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (!isOwner(plan, user) && !isAdminDept(user)) {
    throw new ApiError(403, 'Only the plan owner can check out');
  }
  if (!['planned', 'approved', 'draft'].includes(plan.status)) {
    throw new ApiError(400, 'Visits can only be executed on planned work plans');
  }
  if (!isAdminDept(user) && !isExpenseAddWindowOpen(plan.plan_date)) {
    throw new ApiError(
      400,
      'Visits can only be executed within the 3-day window from the work plan date',
    );
  }

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');
  if (visit.status !== 'checked_in') {
    throw new ApiError(400, 'Visit must be checked in before check out');
  }

  visit.actual_check_out = new Date();
  await visit.save();

  await logActivity(user, planId, 'status_changed', `Checked out from visit ${visit.sequence}`);
  return getWithVisits(planId);
}

async function completeVisit(planId, visitId, body, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const outcomeText = typeof body?.outcome === 'string' ? body.outcome.trim() : (body?.outcome ? String(body.outcome).trim() : '');
    if (!outcomeText) {
      throw new ApiError(400, 'Outcome / completion remarks are required to complete a visit');
    }
    const visit = await updateStandaloneVisit(visitId, {
      status: 'completed',
      outcome: outcomeText,
      meeting_with_doctor: Boolean(body?.meeting_with_doctor),
      meeting_with_purchase: Boolean(body?.meeting_with_purchase),
      meeting_with_finance: Boolean(body?.meeting_with_finance),
      meeting_with_engineer: Boolean(body?.meeting_with_engineer),
      new_product_introduced: Boolean(body?.new_product_introduced),
      order_received: Boolean(body?.order_received),
    }, user);
    await logActivity(user, visit.sales_user || userId(user), 'status_changed', `Visit ${visit.sequence} completed`);
    return visit;
  }

  const { WorkPlan, WorkPlanVisit } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);

  if (!isAdminDept(user) && !isExpenseAddWindowOpen(plan.plan_date)) {
    throw new ApiError(
      400,
      'Visits can only be completed within the 3-day window from the work plan date',
    );
  }

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');
  if (!['created', 'pending', 'in_progress', 'checked_in', 'rescheduled', 'completed'].includes(visit.status)) {
    throw new ApiError(400, `Cannot complete a visit in status "${visit.status}"`);
  }

  const outcomeText = typeof body?.outcome === 'string' ? body.outcome.trim() : (body?.outcome ? String(body.outcome).trim() : '');
  if (!outcomeText) {
    throw new ApiError(400, 'Outcome / completion remarks are required to complete a visit');
  }

  visit.status = 'completed';
  visit.outcome = outcomeText;
  visit.meeting_with_doctor = Boolean(body.meeting_with_doctor);
  visit.meeting_with_purchase = Boolean(body.meeting_with_purchase);
  visit.meeting_with_finance = Boolean(body.meeting_with_finance);
  visit.meeting_with_engineer = Boolean(body.meeting_with_engineer);
  visit.new_product_introduced = Boolean(body.new_product_introduced);
  visit.order_received = Boolean(body.order_received);
  if (!visit.actual_check_out) visit.actual_check_out = new Date();
  if (!visit.actual_check_in) visit.actual_check_in = visit.actual_check_out;
  await visit.save();

  await logActivity(user, planId, 'status_changed', `Visit ${visit.sequence} completed`);
  await maybeCompletePlan(planId, user);
  return getWithVisits(planId);
}

async function stats(query = {}, user) {
  const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();
  const filter = { deletedAt: null };

  await applySalesUserFilter(filter, user, query);

  Object.assign(filter, planDatePeriodMatch(query));

  let salesUserMatch = {};
  let planAggMatch = { ...filter };
  if (filter.sales_user) {
    if (filter.sales_user.$in) {
      salesUserMatch = { 'plan.sales_user': { $in: filter.sales_user.$in } };
    } else if (filter.sales_user.$ne) {
      salesUserMatch = { 'plan.sales_user': { $ne: filter.sales_user.$ne } };
    } else {
      const salesUserOid = asObjectId(filter.sales_user);
      if (salesUserOid) {
        salesUserMatch = { 'plan.sales_user': salesUserOid };
        planAggMatch = { ...filter, sales_user: salesUserOid };
      }
    }
  }

  const today = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const nestedPlanDateMatch = planDatePeriodMatch(query, 'plan.plan_date');
  const planNotDraftMatch = { 'plan.deletedAt': null };
  const todayFilter = {
    deletedAt: null,
    plan_date: { $gte: today, $lte: todayEnd },
    ...(filter.sales_user ? { sales_user: filter.sales_user } : {}),
  };

  const [
    totalPlans,
    todayPlans,
    pendingApproval,
    approved,
    completed,
    rejected,
    statusGroups,
    visitAgg,
    workAgg,
    typeGroups,
    monthlyTrend,
    expenseAgg,
    expenseMonthlyTrend,
  ] = await Promise.all([
    WorkPlan.countDocuments(filter),
    WorkPlan.countDocuments(todayFilter),
    WorkPlan.countDocuments({ ...filter, status: 'submitted' }),
    WorkPlan.countDocuments({ ...filter, status: 'approved' }),
    WorkPlan.countDocuments({ ...filter, status: 'completed' }),
    WorkPlan.countDocuments({ ...filter, status: 'rejected' }),
    WorkPlan.aggregate([
      { $match: planAggMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    WorkPlanVisit.aggregate([
      {
        $lookup: {
          from: 'workplans',
          localField: 'work_plan',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      {
        $match: {
          deletedAt: null,
          'plan.deletedAt': null,
          ...nestedPlanDateMatch,
          ...planNotDraftMatch,
          ...salesUserMatch,
        },
      },
      {
        $group: {
          _id: '$work_plan',
          visit_count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          plans_with_visits: { $sum: 1 },
          total_visits: { $sum: '$visit_count' },
        },
      },
    ]),
    WorkPlanWork.aggregate([
      {
        $lookup: {
          from: WorkPlan.collection.name,
          localField: 'work_plan',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      {
        $match: {
          deletedAt: null,
          'plan.deletedAt': null,
          ...nestedPlanDateMatch,
          ...planNotDraftMatch,
          ...salesUserMatch,
        },
      },
      {
        $group: {
          _id: '$work_plan',
          work_count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          plans_with_works: { $sum: 1 },
          total_works: { $sum: '$work_count' },
        },
      },
    ]),
    WorkPlan.aggregate([
      { $match: planAggMatch },
      {
        $group: {
          _id: { $ifNull: ['$plan_type', 'Visits'] },
          count: { $sum: 1 },
        },
      },
    ]),
    WorkPlan.aggregate([
      { $match: planAggMatch },
      {
        $group: {
          _id: {
            year: { $year: '$plan_date' },
            month: { $month: '$plan_date' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]),
    WorkPlanExpense.aggregate([
      {
        $lookup: {
          from: 'workplans',
          localField: 'work_plan',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      {
        $match: {
          deletedAt: null,
          'plan.deletedAt': null,
          ...nestedPlanDateMatch,
          ...planNotDraftMatch,
          ...salesUserMatch,
        },
      },
      {
        $group: {
          _id: null,
          expense_total: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0],
            },
          },
          expense_pending_approval: {
            $sum: {
              $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0],
            },
          },
          expense_approved_count: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, 1, 0],
            },
          },
        },
      },
    ]),
    WorkPlanExpense.aggregate([
      {
        $lookup: {
          from: 'workplans',
          localField: 'work_plan',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      {
        $match: {
          deletedAt: null,
          status: 'approved',
          'plan.deletedAt': null,
          ...nestedPlanDateMatch,
          ...planNotDraftMatch,
          ...salesUserMatch,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$expense_date' },
            month: { $month: '$expense_date' },
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]),
  ]);

  const visitSummary = visitAgg[0] || { plans_with_visits: 0, total_visits: 0 };
  const averageVisits =
    visitSummary.plans_with_visits > 0
      ? Math.round((visitSummary.total_visits / visitSummary.plans_with_visits) * 10) / 10
      : 0;

  const workSummary = workAgg[0] || { plans_with_works: 0, total_works: 0 };
  const averageWorks =
    workSummary.plans_with_works > 0
      ? Math.round((workSummary.total_works / workSummary.plans_with_works) * 10) / 10
      : 0;

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g._id, g.count]));
  const byPlanType = Object.fromEntries(
    typeGroups.map((g) => [g._id || 'Visits', g.count])
  );
  const expenseSummary = expenseAgg[0] || {
    expense_total: 0,
    expense_pending_approval: 0,
    expense_approved_count: 0,
  };

  return {
    total_plans: totalPlans,
    today_plans: todayPlans,
    pending_approval: pendingApproval,
    approved,
    completed,
    rejected,
    average_visits: averageVisits,
    average_works: averageWorks,
    total_visits: visitSummary.total_visits || 0,
    total_works: workSummary.total_works || 0,
    by_status: byStatus,
    by_plan_type: byPlanType,
    monthly_trend: monthlyTrend.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      count: m.count,
    })),
    expense_total: expenseSummary.expense_total || 0,
    expense_pending_approval: expenseSummary.expense_pending_approval || 0,
    expense_approved_count: expenseSummary.expense_approved_count || 0,
    expense_monthly_trend: expenseMonthlyTrend.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      amount: m.amount,
      count: m.count,
    })),
  };
}

async function assertCanManageExpense(plan, user) {
  if (!(await canAccessSalesUser(user, plan.sales_user))) {
    throw new ApiError(403, 'Only the plan owner or manager can manage expenses');
  }
}

async function assertCanEditExpense(expense, plan, user) {
  await assertCanManageExpense(plan, user);
  if (isWpElevated(user)) {
    if (expense.status === 'approved') {
      throw new ApiError(400, 'Cannot edit an approved expense');
    }
    return;
  }
  if (!EDITABLE_EXPENSE_STATUSES.includes(expense.status)) {
    throw new ApiError(400, `Cannot edit an expense in status "${expense.status}"`);
  }
}

async function resolveExpenseVisit(planId, visitId) {
  if (!visitId) return null;
  const { WorkPlanVisit } = getModels();
  const visit = await WorkPlanVisit.findOne({
    _id: visitId,
    work_plan: planId,
    deletedAt: null,
  }).lean();
  if (!visit) throw new ApiError(400, 'work_plan_visit must belong to this work plan');
  return visit._id;
}

function applyExpenseFields(expense, body, { isCreate = false } = {}) {
  if (isCreate || body.expense_date !== undefined) {
    expense.expense_date = startOfDay(body.expense_date);
  }
  if (isCreate || body.category !== undefined) {
    expense.category = String(body.category).trim();
  }
  if (isCreate || body.category !== undefined || body.sub_category !== undefined) {
    if (expense.category === 'Travel') {
      const sub = String(body.sub_category || expense.sub_category || '').trim();
      if (!TRAVEL_SUB_CATEGORIES.includes(sub)) {
        throw new ApiError(
          400,
          `sub_category must be one of: ${TRAVEL_SUB_CATEGORIES.join(', ')} when category is Travel`,
        );
      }
      expense.sub_category = sub;
    } else {
      expense.sub_category = undefined;
    }
  }
  if (isCreate || body.amount !== undefined) {
    expense.amount = Number(body.amount);
  }
  if (isCreate || body.payment_mode !== undefined) {
    expense.payment_mode = String(body.payment_mode).trim();
  }
  if (body.vendor_name !== undefined) {
    expense.vendor_name =
      typeof body.vendor_name === 'string' ? body.vendor_name.trim() : body.vendor_name;
  }
  if (body.bill_number !== undefined) {
    expense.bill_number =
      typeof body.bill_number === 'string' ? body.bill_number.trim() : body.bill_number;
  }
  if (body.bill_date !== undefined) {
    expense.bill_date =
      body.bill_date === null || body.bill_date === ''
        ? undefined
        : startOfDay(body.bill_date);
  }
  if (body.description !== undefined) {
    expense.description =
      typeof body.description === 'string' ? body.description.trim() : body.description;
  }
  if (body.receipt_attachment !== undefined) {
    expense.receipt_attachment =
      body.receipt_attachment === null || body.receipt_attachment === ''
        ? null
        : body.receipt_attachment;
  }

  const isPrivateBike =
    expense.category === 'Travel' && expense.sub_category === 'Private Bike';

  if (isPrivateBike) {
    if (isCreate || body.start_reading !== undefined) {
      expense.start_reading = Number(body.start_reading);
    }
    if (isCreate || body.closing_reading !== undefined) {
      expense.closing_reading = Number(body.closing_reading);
    }
    if (body.start_reading_image !== undefined) {
      expense.start_reading_image =
        body.start_reading_image === null || body.start_reading_image === ''
          ? null
          : body.start_reading_image;
    }
    if (body.end_reading_image !== undefined) {
      expense.end_reading_image =
        body.end_reading_image === null || body.end_reading_image === ''
          ? null
          : body.end_reading_image;
    }
  } else if (
    isCreate ||
    body.category !== undefined ||
    body.sub_category !== undefined
  ) {
    expense.start_reading = undefined;
    expense.closing_reading = undefined;
    expense.start_reading_image = null;
    expense.end_reading_image = null;
  }
}

function assertPrivateBikeExpense(expense) {
  if (expense.category !== 'Travel' || expense.sub_category !== 'Private Bike') {
    return;
  }
  const start = Number(expense.start_reading);
  const closing = Number(expense.closing_reading);
  if (!Number.isFinite(start) || start < 0) {
    throw new ApiError(400, 'start_reading is required for Private Bike expenses');
  }
  if (!Number.isFinite(closing) || closing < 0) {
    throw new ApiError(400, 'closing_reading is required for Private Bike expenses');
  }
  if (closing < start) {
    throw new ApiError(400, 'closing_reading must be greater than or equal to start_reading');
  }
}

async function listAllExpenses(query = {}, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const planFilter = { deletedAt: null };

  await applySalesUserFilter(planFilter, user, query);

  const planIds = await WorkPlan.find(planFilter).distinct('_id');

  const filter = {
    deletedAt: null,
    work_plan: { $in: planIds },
  };

  if (query.status) {
    if (isAdminDept(user) && query.status === 'draft') {
      filter.status = { $in: [] };
    } else {
      filter.status = query.status;
    }
  } else if (isAdminDept(user)) {
    filter.status = { $ne: 'draft' };
  }

  if (query.from || query.to) {
    filter.expense_date = {};
    if (query.from) filter.expense_date.$gte = startOfDay(query.from);
    if (query.to) filter.expense_date.$lte = endOfDay(query.to);
  }

  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const { withFreshExpenseAttachmentUrls } = require('../../services/fileManagement');
  const [total, rows] = await Promise.all([
    WorkPlanExpense.countDocuments(filter),
    WorkPlanExpense.find(filter)
      .populate({
        path: 'work_plan',
        select: 'plan_date sales_user location status',
        populate: { path: 'sales_user', select: 'name email department' },
      })
      .populate({
        path: 'work_plan_visit',
        select: 'sequence party_type party party_name contact_person',
        populate: { path: 'party', select: 'party_name' },
      })
      .populate('receipt_attachment')
      .populate('start_reading_image')
      .populate('end_reading_image')
      .populate('approved_by', 'name email')
      .populate('created_by', 'name email')
      .sort({ expense_date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const data = await Promise.all(
    rows.map(async (row) => {
      const item = await withFreshExpenseAttachmentUrls(toPlain(row));
      if (!item.sales_user && item.work_plan && typeof item.work_plan === 'object' && item.work_plan.sales_user) {
        item.sales_user = item.work_plan.sales_user;
      }
      return item;
    }),
  );

  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 0,
    data,
  };
}

async function listExpenses(planId, user) {
  const plan = await loadPlanOrThrow(planId);
  await assertCanView(plan, user);
  const expenses = await loadExpenses(planId);
  const totals = buildExpenseTotals(expenses);
  return { expenses, ...totals };
}

function assertSalesExpenseReceipt(expense, user) {
  return;
}

async function addExpense(planId, body, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanManageExpense(plan, user);

  if (!isAdminDept(user) && !isExpenseAddWindowOpen(plan.plan_date)) {
    throw new ApiError(
      400,
      'Expenses can only be added from the work plan day through the next 2 days (3 days total). Earlier or later entries are not allowed.',
    );
  }

  const visitId = await resolveExpenseVisit(planId, body.work_plan_visit || null);

  const expense = new WorkPlanExpense({
    work_plan: planId,
    work_plan_visit: visitId,
    status: 'draft',
    created_by: userId(user),
    updated_by: userId(user),
  });
  applyExpenseFields(expense, body, { isCreate: true });
  assertPrivateBikeExpense(expense);
  assertSalesExpenseReceipt(expense, user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'created',
    `Expense created (${expense.category}, ${expense.amount})`,
  );
  return getWithVisits(planId);
}

async function updateExpense(planId, expenseId, body, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  await assertCanEditExpense(expense, plan, user);

  if (body.work_plan_visit !== undefined) {
    expense.work_plan_visit = await resolveExpenseVisit(
      planId,
      body.work_plan_visit || null,
    );
  }
  applyExpenseFields(expense, body, { isCreate: false });

  if (expense.status === 'rejected') {
    expense.status = 'draft';
    expense.rejection_reason = undefined;
    expense.approved_by = undefined;
    expense.approved_at = undefined;
  }

  assertPrivateBikeExpense(expense);
  assertSalesExpenseReceipt(expense, user);
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'updated',
    `Expense updated (${expense.category}, ${expense.amount})`,
  );
  return getWithVisits(planId);
}

async function removeExpense(planId, expenseId, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  await assertCanManageExpense(plan, user);

  if (!isAdminDept(user) && !EDITABLE_EXPENSE_STATUSES.includes(expense.status)) {
    throw new ApiError(400, 'Only draft or rejected expenses can be deleted');
  }
  if (isAdminDept(user) && expense.status === 'approved') {
    throw new ApiError(400, 'Cannot delete an approved expense');
  }

  expense.deletedAt = new Date();
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(user, planId, 'deleted', `Expense deleted (${expense.category}, ${expense.amount})`);
  return getWithVisits(planId);
}

async function submitExpense(planId, expenseId, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanManageExpense(plan, user);

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  if (!EDITABLE_EXPENSE_STATUSES.includes(expense.status)) {
    throw new ApiError(400, `Cannot submit an expense in status "${expense.status}"`);
  }

  expense.status = 'submitted';
  expense.rejection_reason = undefined;
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'submitted',
    `Expense submitted for approval (${expense.category}, ${expense.amount})`,
  );
  return getWithVisits(planId);
}

async function approveExpense(planId, expenseId, user) {
  if (!isAdminDept(user)) {
    throw new ApiError(403, 'Only manager can approve expenses');
  }
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  if (expense.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted expenses can be approved');
  }

  expense.status = 'approved';
  expense.approved_by = userId(user);
  expense.approved_at = new Date();
  expense.rejection_reason = undefined;
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'approved',
    `Expense approved (${expense.category}, ${expense.amount})`,
  );
  await notificationService.createForUser(plan.sales_user, {
    title: 'Expense approved',
    message: `Your expense of ${expense.amount} (${expense.category}) was approved.`,
    type: 'success',
    module: 'system',
    entity_type: 'work_plan',
    entity_id: plan._id,
  });

  return getWithVisits(planId);
}

async function rejectExpense(planId, expenseId, body, user) {
  if (!isAdminDept(user)) {
    throw new ApiError(403, 'Only manager can reject expenses');
  }
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  if (expense.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted expenses can be rejected');
  }

  expense.status = 'rejected';
  expense.rejection_reason = body.rejection_reason.trim();
  expense.approved_by = userId(user);
  expense.approved_at = new Date();
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'rejected',
    `Expense rejected: ${expense.rejection_reason}`,
  );
  await notificationService.createForUser(plan.sales_user, {
    title: 'Expense rejected',
    message: `Your expense of ${expense.amount} (${expense.category}) was rejected. Reason: ${expense.rejection_reason}`,
    type: 'warning',
    module: 'system',
    entity_type: 'work_plan',
    entity_id: plan._id,
  });

  return getWithVisits(planId);
}

async function submitAllExpenses(planId, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanManageExpense(plan, user);

  const result = await WorkPlanExpense.updateMany(
    {
      work_plan: planId,
      deletedAt: null,
      status: { $in: [...EDITABLE_EXPENSE_STATUSES] },
    },
    {
      $set: {
        status: 'submitted',
        updated_by: userId(user),
      },
      $unset: { rejection_reason: 1 },
    },
  );

  const count = result.modifiedCount || result.nModified || 0;
  if (count < 1) {
    throw new ApiError(400, 'No draft or rejected expenses to submit');
  }

  await logActivity(
    user,
    planId,
    'submitted',
    `All day expenses submitted for approval (${count})`,
  );
  return getWithVisits(planId);
}

async function approveAllExpenses(planId, user) {
  if (!isAdminDept(user)) {
    throw new ApiError(403, 'Only manager can approve expenses');
  }
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const now = new Date();
  const result = await WorkPlanExpense.updateMany(
    {
      work_plan: planId,
      deletedAt: null,
      status: 'submitted',
    },
    {
      $set: {
        status: 'approved',
        approved_by: userId(user),
        approved_at: now,
        updated_by: userId(user),
      },
      $unset: { rejection_reason: 1 },
    },
  );

  const count = result.modifiedCount || result.nModified || 0;
  if (count < 1) {
    throw new ApiError(400, 'No submitted expenses to approve');
  }

  await logActivity(
    user,
    planId,
    'approved',
    `All day expenses approved (${count})`,
  );
  await notificationService.createForUser(plan.sales_user, {
    title: 'Expenses approved',
    message: `${count} expense(s) on your work plan for ${plan.plan_date.toISOString().slice(0, 10)} were approved.`,
    type: 'success',
    module: 'system',
    entity_type: 'work_plan',
    entity_id: plan._id,
  });

  return getWithVisits(planId);
}

async function rejectAllExpenses(planId, body, user) {
  if (!isAdminDept(user)) {
    throw new ApiError(403, 'Only manager can reject expenses');
  }
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const reason = body.rejection_reason.trim();
  const result = await WorkPlanExpense.updateMany(
    {
      work_plan: planId,
      deletedAt: null,
      status: 'submitted',
    },
    {
      $set: {
        status: 'rejected',
        rejection_reason: reason,
        approved_by: userId(user),
        approved_at: new Date(),
        updated_by: userId(user),
      },
    },
  );

  const count = result.modifiedCount || result.nModified || 0;
  if (count < 1) {
    throw new ApiError(400, 'No submitted expenses to reject');
  }

  await logActivity(
    user,
    planId,
    'rejected',
    `All day expenses rejected (${count}): ${reason}`,
  );
  await notificationService.createForUser(plan.sales_user, {
    title: 'Expenses rejected',
    message: `${count} expense(s) on your work plan for ${plan.plan_date.toISOString().slice(0, 10)} were rejected. Reason: ${reason}`,
    type: 'warning',
    module: 'system',
    entity_type: 'work_plan',
    entity_id: plan._id,
  });

  return getWithVisits(planId);
}

async function loadWorks(planId) {
  const { WorkPlanWork } = getModels();
  const parsed = parseStandaloneId(planId);
  let filter;
  if (parsed) {
    const planDate = parsed.dateStr && parsed.dateStr !== 'nodate' ? startOfDay(parsed.dateStr) : null;
    filter = {
      sales_user: parsed.salesUserId,
      work_plan: null,
      deletedAt: null,
      ...(planDate ? { plan_date: { $gte: startOfDay(planDate), $lte: endOfDay(planDate) } } : {}),
    };
  } else if (!mongoose.Types.ObjectId.isValid(planId)) {
    return [];
  } else {
    filter = { work_plan: planId, deletedAt: null };
  }

  const rows = await WorkPlanWork.find(filter)
    .populate('created_by', 'name email')
    .populate('updated_by', 'name email')
    .sort({ sequence: 1 })
    .lean();
  return rows.map(toPlain);
}

async function renumberWorks(planId) {
  if (parseStandaloneId(planId) || !mongoose.Types.ObjectId.isValid(planId)) return;
  const { WorkPlanWork } = getModels();
  const works = await WorkPlanWork.find({ work_plan: planId, deletedAt: null })
    .sort({ sequence: 1 })
    .lean();
  for (let i = 0; i < works.length; i += 1) {
    await WorkPlanWork.updateOne(
      { _id: works[i]._id },
      { $set: { sequence: i + 1 } }
    );
  }
}

async function addStandaloneWork(body, user) {
  const { WorkPlan, WorkPlanWork } = getModels();

  let salesUserId = userId(user);
  if (body.sales_user || body.salesUserId) {
    const requestedUser = String(body.sales_user || body.salesUserId);
    if (requestedUser !== String(userId(user))) {
      if (!isWpElevated(user)) {
        throw new ApiError(403, 'Only managers or admins can plan tasks for other users');
      }
      if (!(await canAccessSalesUser(user, requestedUser))) {
        throw new ApiError(403, 'You can only plan tasks for yourself or your team members');
      }
      salesUserId = requestedUser;
    }
  }

  const rawDate = body.plan_date || body.planDate || new Date();
  const planDate = startOfDay(rawDate);
  const userRole = getUserRole(user);

  // Check if a work plan already exists for this sales user on that date
  const existingPlan = await WorkPlan.findOne({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(rawDate) },
    deletedAt: null,
  });

  if (existingPlan) {
    const maxSeq = await WorkPlanWork.findOne({
      work_plan: existingPlan._id,
      deletedAt: null,
    })
      .sort({ sequence: -1 })
      .select('sequence')
      .lean();

    const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

    const work = await WorkPlanWork.create({
      work_plan: existingPlan._id,
      sales_user: salesUserId,
      plan_date: planDate,
      sequence,
      title: (body.title || 'Task').trim(),
      description: body.description?.trim() || undefined,
      planned_start_time: toValidDate(body.planned_start_time, planDate),
      planned_end_time: toValidDate(body.planned_end_time, planDate),
      status: body.status || 'created',
      pending_remarks: body.pending_remarks?.trim() || undefined,
      in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
      created_by: userId(user),
      created_by_role: userRole,
      updated_by: userId(user),
      updated_by_role: userRole,
    });

    if (existingPlan.status === 'rejected') {
      existingPlan.status = 'draft';
      existingPlan.rejection_reason = undefined;
      existingPlan.submitted_at = undefined;
      existingPlan.updated_by = userId(user);
      await existingPlan.save();
    }

    await renumberWorks(existingPlan._id);
    await logActivity(user, existingPlan._id, 'created', `Task added to work plan for ${planDate.toISOString().slice(0, 10)}`);
    return toPlain(work);
  }

  const maxSeq = await WorkPlanWork.findOne({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(rawDate) },
    work_plan: null,
    deletedAt: null,
  })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();

  const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

  const work = await WorkPlanWork.create({
    work_plan: null,
    sales_user: salesUserId,
    plan_date: planDate,
    sequence,
    title: (body.title || 'Task').trim(),
    description: body.description?.trim() || undefined,
    planned_start_time: toValidDate(body.planned_start_time, planDate),
    planned_end_time: toValidDate(body.planned_end_time, planDate),
    status: body.status || 'created',
    pending_remarks: body.pending_remarks?.trim() || undefined,
    in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
    created_by: userId(user),
    created_by_role: userRole,
    updated_by: userId(user),
    updated_by_role: userRole,
  });

  await logActivity(user, salesUserId, 'created', `Standalone task created for ${planDate.toISOString().slice(0, 10)}`);
  return toPlain(work);
}

async function updateStandaloneWork(workId, body, user) {
  const { WorkPlanWork } = getModels();
  const work = await WorkPlanWork.findOne({ _id: workId, deletedAt: null });
  if (!work) throw new ApiError(404, 'Work task not found');

  const admin = isAdminDept(user);
  if (!admin && work.sales_user && String(work.sales_user) !== String(userId(user))) {
    if (!(await canAccessSalesUser(user, work.sales_user))) {
      throw new ApiError(403, 'You do not have permission to edit this task');
    }
  }

  const baseDate = work.plan_date || new Date();
  if (body.title !== undefined) work.title = body.title.trim();
  if (body.description !== undefined) work.description = body.description?.trim() || undefined;
  if (body.planned_start_time !== undefined) {
    work.planned_start_time = toValidDate(body.planned_start_time, baseDate);
  }
  if (body.planned_end_time !== undefined) {
    work.planned_end_time = toValidDate(body.planned_end_time, baseDate);
  }
  if (body.status !== undefined) {
    work.status = body.status;
  }
  if (body.completion_remarks !== undefined) {
    work.completion_remarks = body.completion_remarks?.trim() || undefined;
  }
  if (body.pending_remarks !== undefined) {
    work.pending_remarks = body.pending_remarks?.trim() || undefined;
  }
  if (body.in_progress_remarks !== undefined) {
    work.in_progress_remarks = body.in_progress_remarks?.trim() || undefined;
  }
  if (body.sequence !== undefined) work.sequence = Number(body.sequence);

  work.updated_by = userId(user);
  work.updated_by_role = getUserRole(user);

  await work.save();
  return toPlain(work);
}

async function removeStandaloneWork(workId, user) {
  const { WorkPlanWork } = getModels();
  const work = await WorkPlanWork.findOne({ _id: workId, deletedAt: null });
  if (!work) throw new ApiError(404, 'Work task not found');

  const admin = isAdminDept(user);
  const isManagerCreated = ['Manager', 'Admin', 'Super Admin', 'manager', 'admin', 'super_admin'].includes(
    String(work.created_by_role || '').trim()
  );
  if (!admin && isManagerCreated) {
    throw new ApiError(403, 'Tasks created by a Manager cannot be removed by an Executive');
  }

  work.deletedAt = new Date();
  await work.save();
  return { success: true };
}

async function addWork(planId, body, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const parsed = parseStandaloneId(planId);
    const salesUserId = parsed?.salesUserId || body.sales_user || userId(user);
    const planDate = parsed?.dateStr && parsed.dateStr !== 'nodate' ? parsed.dateStr : body.plan_date;
    return addStandaloneWork({ ...body, sales_user: salesUserId, plan_date: planDate }, user);
  }

  const { WorkPlan, WorkPlanWork } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  const maxSeq = await WorkPlanWork.findOne({ work_plan: planId, deletedAt: null })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();
  const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;
  const userRole = getUserRole(user);

  const existingWorkId = body._id || body.work_id || body.id;
  if (existingWorkId) {
    const existingWork = await WorkPlanWork.findOne({ _id: existingWorkId, deletedAt: null });
    if (existingWork) {
      existingWork.work_plan = planId;
      existingWork.sales_user = plan.sales_user;
      existingWork.plan_date = plan.plan_date;
      existingWork.sequence = sequence;
      if (body.planned_start_time !== undefined) {
        existingWork.planned_start_time = toValidDate(body.planned_start_time, plan.plan_date);
      }
      if (body.planned_end_time !== undefined) {
        existingWork.planned_end_time = toValidDate(body.planned_end_time, plan.plan_date);
      }
      existingWork.updated_by = userId(user);
      existingWork.updated_by_role = userRole;
      await existingWork.save();

      if (plan.status === 'rejected') {
        plan.status = 'draft';
        plan.rejection_reason = undefined;
        plan.submitted_at = undefined;
        plan.updated_by = userId(user);
        await plan.save();
      }

      await renumberWorks(planId);
      await logActivity(user, planId, 'updated', `Work task reassigned (sequence ${sequence})`);
      return getWithVisits(planId);
    }
  }

  await WorkPlanWork.create({
    work_plan: planId,
    sales_user: plan.sales_user,
    plan_date: plan.plan_date,
    sequence,
    title: body.title.trim(),
    description: body.description?.trim() || undefined,
    planned_start_time: toValidDate(body.planned_start_time, plan.plan_date),
    planned_end_time: toValidDate(body.planned_end_time, plan.plan_date),
    status: body.status || 'created',
    pending_remarks: body.pending_remarks?.trim() || undefined,
    in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
    created_by: userId(user),
    created_by_role: userRole,
    updated_by: userId(user),
    updated_by_role: userRole,
  });

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberWorks(planId);
  await logActivity(user, planId, 'updated', `Work task added (sequence ${sequence})`);
  return getWithVisits(planId);
}

async function updateWork(planId, workId, body, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    return updateStandaloneWork(workId, body, user);
  }

  const { WorkPlan, WorkPlanWork } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  const work = await WorkPlanWork.findOne({ _id: workId, work_plan: planId, deletedAt: null });
  if (!work) throw new ApiError(404, 'Work task not found');

  if (body.title !== undefined) work.title = body.title.trim();
  if (body.description !== undefined) work.description = body.description?.trim() || undefined;
  if (body.planned_start_time !== undefined) {
    work.planned_start_time = toValidDate(body.planned_start_time, plan.plan_date);
  }
  if (body.planned_end_time !== undefined) {
    work.planned_end_time = toValidDate(body.planned_end_time, plan.plan_date);
  }
  if (body.status !== undefined) {
    work.status = body.status;
  }
  if (body.completion_remarks !== undefined) {
    work.completion_remarks = body.completion_remarks?.trim() || undefined;
  }
  if (body.pending_remarks !== undefined) {
    work.pending_remarks = body.pending_remarks?.trim() || undefined;
  }
  if (body.in_progress_remarks !== undefined) {
    work.in_progress_remarks = body.in_progress_remarks?.trim() || undefined;
  }
  if (body.sequence !== undefined) work.sequence = Number(body.sequence);

  work.updated_by = userId(user);
  work.updated_by_role = getUserRole(user);

  await work.save();

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberWorks(planId);
  await logActivity(user, planId, 'updated', `Work task updated (sequence ${work.sequence})`);
  await maybeCompleteWorkPlan(planId, user);
  return getWithVisits(planId);
}

async function removeWork(planId, workId, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    return removeStandaloneWork(workId, user);
  }

  const { WorkPlan, WorkPlanWork } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  const work = await WorkPlanWork.findOne({ _id: workId, work_plan: planId, deletedAt: null });
  if (!work) throw new ApiError(404, 'Work task not found');

  const admin = isAdminDept(user);
  const isManagerCreated = ['Manager', 'Admin', 'Super Admin', 'manager', 'admin', 'super_admin'].includes(
    String(work.created_by_role || '').trim()
  );
  if (!admin && isManagerCreated) {
    throw new ApiError(403, 'Tasks created by a Manager cannot be removed by an Executive');
  }

  work.deletedAt = new Date();
  await work.save();

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberWorks(planId);
  await logActivity(user, planId, 'updated', `Work task removed (ID: ${workId})`);
  return getWithVisits(planId);
}

async function getUserSettings(targetUserId, currentUser) {
  const { UserWorkPlannerSettings } = getModels();
  const uid = asObjectId(targetUserId);
  if (!uid) {
    throw new ApiError(400, 'Invalid user ID');
  }
  const isSelf = String(targetUserId) === String(userId(currentUser));
  if (!isSelf && !(await canAccessSalesUser(currentUser, targetUserId))) {
    throw new ApiError(403, 'You do not have access to this user\'s settings');
  }

  let settings = await UserWorkPlannerSettings.findOne({ user: uid })
    .populate('assigned_manager', 'name email department')
    .populate('plan_type_settings.assigned_manager', 'name email department')
    .lean();

  if (!settings) {
    return {
      userId: String(targetUserId),
      assignedManagerId: '',
      assignedManagerName: '',
      assignedManagerEmail: '',
      ccEmails: [],
      planTypeSettings: {},
      customWorkTemplates: [],
    };
  }

  const managerObj = settings.assigned_manager || {};
  const planTypeSettingsObj = {};
  if (Array.isArray(settings.plan_type_settings)) {
    settings.plan_type_settings.forEach((pts) => {
      if (pts && pts.plan_type) {
        const mgr = pts.assigned_manager || {};
        planTypeSettingsObj[pts.plan_type] = {
          plan_type: pts.plan_type,
          assignedManagerId: mgr._id ? String(mgr._id) : (pts.assigned_manager ? String(pts.assigned_manager) : ''),
          assignedManagerName: mgr.name || '',
          assignedManagerEmail: mgr.email || '',
          ccEmails: Array.isArray(pts.cc_emails) ? pts.cc_emails : [],
        };
      }
    });
  }

  return {
    userId: String(settings.user),
    assignedManagerId: managerObj._id ? String(managerObj._id) : (settings.assigned_manager ? String(settings.assigned_manager) : ''),
    assignedManagerName: managerObj.name || '',
    assignedManagerEmail: managerObj.email || '',
    ccEmails: settings.cc_emails || [],
    planTypeSettings: planTypeSettingsObj,
    customWorkTemplates: (settings.custom_work_templates || []).map((t) => ({
      id: String(t._id || t.id),
      title: t.title,
      description: t.description || '',
      planned_start_time: t.planned_start_time || '',
      planned_end_time: t.planned_end_time || '',
      work_type: t.work_type || 'default',
    })),
    updatedAt: settings.updatedAt,
  };
}

async function updateUserSettings(targetUserId, payload, currentUser) {
  const { UserWorkPlannerSettings } = getModels();
  const uid = asObjectId(targetUserId);
  if (!uid) {
    throw new ApiError(400, 'Invalid user ID');
  }
  if (!isWpElevated(currentUser)) {
    throw new ApiError(403, 'Only managers or admins can update user settings');
  }
  if (!(await canAccessSalesUser(currentUser, targetUserId))) {
    throw new ApiError(403, 'You can only update settings for your team members');
  }

  const updateFields = {
    user: uid,
    updated_by: userId(currentUser),
  };

  if (payload.assignedManagerId !== undefined) {
    updateFields.assigned_manager = payload.assignedManagerId ? asObjectId(payload.assignedManagerId) : null;
  }
  if (Array.isArray(payload.ccEmails)) {
    updateFields.cc_emails = payload.ccEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  }
  if (payload.planTypeSettings && typeof payload.planTypeSettings === 'object') {
    const ptsList = [];
    Object.entries(payload.planTypeSettings).forEach(([planType, pts]) => {
      if (pts && typeof pts === 'object') {
        ptsList.push({
          plan_type: planType,
          assigned_manager: pts.assignedManagerId ? asObjectId(pts.assignedManagerId) : null,
          cc_emails: Array.isArray(pts.ccEmails) ? pts.ccEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : [],
        });
      }
    });
    updateFields.plan_type_settings = ptsList;
  }

  if (Array.isArray(payload.customWorkTemplates)) {
    updateFields.custom_work_templates = payload.customWorkTemplates.map((t) => ({
      title: String(t.title || '').trim(),
      description: String(t.description || '').trim(),
      planned_start_time: String(t.planned_start_time || '').trim(),
      planned_end_time: String(t.planned_end_time || '').trim(),
      work_type: t.work_type === 'optional' ? 'optional' : 'default',
    }));
  }

  await UserWorkPlannerSettings.findOneAndUpdate(
    { user: uid },
    { $set: updateFields, $setOnInsert: { created_by: userId(currentUser) } },
    { new: true, upsert: true }
  );

  await logActivity(currentUser, targetUserId, 'updated_user_settings', `Updated Work Planner settings for user ${targetUserId}`);

  return getUserSettings(targetUserId, currentUser);
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  submit,
  approve,
  reject,
  completePlan,
  addVisit,
  updateVisit,
  removeVisit,
  addStandaloneVisit,
  updateStandaloneVisit,
  removeStandaloneVisit,
  checkIn,
  checkOut,
  completeVisit,
  listAllExpenses,
  listExpenses,
  addExpense,
  updateExpense,
  removeExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  submitAllExpenses,
  approveAllExpenses,
  rejectAllExpenses,
  stats,
  loadWorks,
  addWork,
  updateWork,
  removeWork,
  addStandaloneWork,
  updateStandaloneWork,
  removeStandaloneWork,
  getDayEndDraft,
  getUserSettings,
  updateUserSettings,
};
