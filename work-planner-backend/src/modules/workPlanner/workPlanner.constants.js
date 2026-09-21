/**
 * @fileoverview Work Planner status enums and helpers with portal role support.
 * @module modules/workPlanner/workPlanner.constants
 */

const PLAN_STATUSES = Object.freeze([
  'planned',
  'completed',
  'draft',
  'submitted',
  'approved',
  'rejected',
]);

const VISIT_STATUSES = Object.freeze([
  'created',
  'pending',
  'in_progress',
  'checked_in',
  'completed',
  'cancelled',
  'skipped',
  'rescheduled',
]);

const WORK_STATUSES = Object.freeze([
  'created',
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);

const TERMINAL_VISIT_STATUSES = Object.freeze(['completed', 'cancelled', 'skipped']);

const EDITABLE_PLAN_STATUSES = Object.freeze(['planned', 'draft', 'rejected']);

const VISIT_PARTY_TYPES = Object.freeze(['existing', 'new_party', 'new_lead', 'existing_lead']);

const EXPENSE_STATUSES = Object.freeze(['draft', 'submitted', 'approved', 'rejected']);

const EDITABLE_EXPENSE_STATUSES = Object.freeze(['draft', 'rejected']);

const EXPENSE_CATEGORIES = Object.freeze([
  'Travel',
  'Accommodation',
  'Food',
  'Communication',
  'Client Entertainment',
  'Marketing',
  'Office',
  'Miscellaneous',
]);

const TRAVEL_SUB_CATEGORIES = Object.freeze([
  'Cab',
  'Auto',
  'Bus',
  'Bike Ride',
  'Private Bike',
  'Train',
  'Parking',
]);

const EXPENSE_PAYMENT_MODES = Object.freeze([
  'Cash',
  'UPI',
  'Card',
  'Bank Transfer',
  'Company Card',
]);

function startOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Sales / Executive may add expenses only on plan day through plan day + 2 (3 calendar days). */
const EXPENSE_ADD_WINDOW_DAYS = 3;

/** Sales / Executive must attach image/PDF receipt when amount is greater than this. */
const EXPENSE_RECEIPT_REQUIRED_ABOVE = 499;

function isExpenseAddWindowOpen(planDate, now = new Date()) {
  if (!planDate) return false;
  const pDate = new Date(planDate);
  if (Number.isNaN(pDate.getTime())) return false;

  const pYear = pDate.getUTCFullYear();
  const pMonth = pDate.getUTCMonth();
  const pDay = pDate.getUTCDate();

  const nowIST = new Date(new Date(now).getTime() + 5.5 * 60 * 60 * 1000);
  const nYear = nowIST.getUTCFullYear();
  const nMonth = nowIST.getUTCMonth();
  const nDay = nowIST.getUTCDate();

  const end = new Date(Date.UTC(pYear, pMonth, pDay + (EXPENSE_ADD_WINDOW_DAYS - 1), 23, 59, 59, 999));
  const current = new Date(Date.UTC(nYear, nMonth, nDay, 12, 0, 0, 0));

  return current.getTime() <= end.getTime();
}

function isExpenseAddWindowEnded(planDate, now = new Date()) {
  if (!planDate) return false;
  const pDate = new Date(planDate);
  if (Number.isNaN(pDate.getTime())) return false;

  const pYear = pDate.getUTCFullYear();
  const pMonth = pDate.getUTCMonth();
  const pDay = pDate.getUTCDate();

  const nowIST = new Date(new Date(now).getTime() + 5.5 * 60 * 60 * 1000);
  const nYear = nowIST.getUTCFullYear();
  const nMonth = nowIST.getUTCMonth();
  const nDay = nowIST.getUTCDate();

  const end = new Date(
    Date.UTC(pYear, pMonth, pDay + (EXPENSE_ADD_WINDOW_DAYS - 1), 23, 59, 59, 999),
  );
  const current = new Date(Date.UTC(nYear, nMonth, nDay, 12, 0, 0, 0));

  return current.getTime() > end.getTime();
}

function isExpenseReceiptRequired(amount) {
  return Number(amount) > EXPENSE_RECEIPT_REQUIRED_ABOVE;
}

/**
 * Manager role on work_planner portal.
 * Evaluates portal assignment `work_planner` role `manager`.
 */
function isManager(user) {
  if (!user) return false;
  const roles = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(Array.isArray(user.role_codes) ? user.role_codes : []),
    user.role,
    user.department,
  ].filter(Boolean).map((r) => String(r).toLowerCase());

  if (roles.some((r) => ['super_admin', 'admin', 'manager'].includes(r))) return true;

  const portalAccess = Array.isArray(user.portals)
    ? user.portals.find((p) => p && String(p.portal_code || '').toLowerCase() === 'work_planner')
    : null;
  if (portalAccess && Array.isArray(portalAccess.access_roles)) {
    return portalAccess.access_roles.some((r) =>
      ['manager', 'admin', 'super_admin'].includes(String(r).toLowerCase())
    );
  }
  return false;
}

function isExecutive(user) {
  if (!user) return false;
  const roles = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(Array.isArray(user.role_codes) ? user.role_codes : []),
    user.role,
    user.department,
  ].filter(Boolean).map((r) => String(r).toLowerCase());

  if (roles.some((r) => ['executive', 'sales'].includes(r))) return true;

  const portalAccess = Array.isArray(user.portals)
    ? user.portals.find((p) => p && String(p.portal_code || '').toLowerCase() === 'work_planner')
    : null;
  if (portalAccess && Array.isArray(portalAccess.access_roles)) {
    return portalAccess.access_roles.some((r) =>
      ['executive', 'sales'].includes(String(r).toLowerCase())
    );
  }
  return false;
}

function isAdminDept(user) {
  return isManager(user);
}

function isSalesDept(user) {
  return isExecutive(user);
}

module.exports = {
  PLAN_STATUSES,
  VISIT_STATUSES,
  WORK_STATUSES,
  TERMINAL_VISIT_STATUSES,
  EDITABLE_PLAN_STATUSES,
  VISIT_PARTY_TYPES,
  EXPENSE_STATUSES,
  EDITABLE_EXPENSE_STATUSES,
  EXPENSE_CATEGORIES,
  TRAVEL_SUB_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
  startOfDay,
  endOfDay,
  EXPENSE_ADD_WINDOW_DAYS,
  EXPENSE_RECEIPT_REQUIRED_ABOVE,
  isExpenseAddWindowOpen,
  isExpenseAddWindowEnded,
  isExpenseReceiptRequired,
  isManager,
  isExecutive,
  isAdminDept,
  isSalesDept,
};
