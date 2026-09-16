import React from "react";
import type { WorkPlanStatus, WorkPlanVisitStatus } from "@/types/workPlanner";

export const WORK_PLAN_STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "planned", label: "Planned" },
  { id: "completed", label: "Completed" },
] as const;

export const WORK_PLAN_TYPE_TABS = [
  { id: "all", label: "All types" },
  { id: "Visits", label: "Visits" },
  { id: "Leave", label: "Leave" },
  { id: "Work From Home", label: "Work From Home" },
  { id: "Work From Office", label: "Work From Office" },
] as const;

export function planTypeOf(planType?: string | null): string {
  return (planType && String(planType).trim()) || "Visits";
}

export function isVisitsPlan(planType?: string | null): boolean {
  const t = planTypeOf(planType);
  return t === "Visits" || t === "Field Visit";
}

export function isWorkTaskPlan(planType?: string | null): boolean {
  const t = planTypeOf(planType);
  return t === "Work From Home" || t === "Work From Office";
}

export function isLeavePlan(planType?: string | null): boolean {
  return planTypeOf(planType) === "Leave";
}

export function planTypeShort(planType?: string | null): string {
  const t = planTypeOf(planType);
  if (t === "Work From Home") return "WFH";
  if (t === "Work From Office") return "WFO";
  return t;
}

export function planActivityLabel(plan: {
  plan_type?: string | null;
  visit_count?: number;
  work_count?: number;
  works?: unknown[];
}): string {
  const type = planTypeOf(plan.plan_type);
  if (type === "Leave") return "Leave";
  if (isWorkTaskPlan(type)) {
    const n =
      Number(plan.work_count) ||
      (Array.isArray(plan.works) ? plan.works.length : 0) ||
      0;
    return `${n} task${n === 1 ? "" : "s"}`;
  }
  const n = Number(plan.visit_count) || 0;
  return `${n} visit${n === 1 ? "" : "s"}`;
}

export const WORK_PLAN_EXPENSE_STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "submitted", label: "Pending Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;

export function formatPlanDate(dateVal: unknown): string {
  if (!dateVal) return "—";
  const d = new Date(String(dateVal));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateVal: unknown): string {
  if (!dateVal) return "—";
  const d = new Date(String(dateVal));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(dateVal: unknown): string {
  if (!dateVal) return "—";
  const d = new Date(String(dateVal));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amountVal: unknown): string {
  const num = Number(amountVal) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  da: "Daily Allowance (DA)",
  stay: "Hotel & Lodging Stay",
  travel: "Field Travel & Transit",
  conveyance: "Local Conveyance",
  other: "Other Expense",
};

export function salesUserLabel(
  salesUser: string | { _id?: string; name?: string; email?: string } | undefined
): string {
  if (!salesUser) return "—";
  if (typeof salesUser === "string") return salesUser;
  return salesUser.name || salesUser.email || salesUser._id || "—";
}

export function partyLabel(
  party: string | { _id?: string; party_name?: string } | undefined,
  fallbackName?: string,
): string {
  if (fallbackName && fallbackName.trim()) return fallbackName.trim();
  if (!party) return "—";
  if (typeof party === "string") return party;
  return party.party_name || party._id || "—";
}

export function visitPartyLabel(visit: {
  party?: string | { _id?: string; party_name?: string };
  party_name?: string;
  party_type?: string;
}): string {
  const name = partyLabel(visit.party, visit.party_name);
  if (visit.party_type === "new_party") return `${name} (New party)`;
  if (visit.party_type === "new_lead") return `${name} (New lead)`;
  return name;
}

export function planIdOf(row: { _id?: string; id?: string } | null | undefined): string {
  if (!row) return "";
  return String(row._id || row.id || "");
}

export function renderPlanStatusBadge(status: string | undefined) {
  const s = (status || "planned") as WorkPlanStatus;
  const map: Record<
    WorkPlanStatus,
    { wrap: string; dot: string; label: string }
  > = {
    draft: {
      wrap: "text-muted bg-surface-muted ring-border",
      dot: "bg-muted",
      label: "Draft",
    },
    planned: {
      wrap: "text-blue-500 bg-blue-500/10 ring-blue-500/20",
      dot: "bg-blue-500",
      label: "Planned",
    },
    submitted: {
      wrap: "text-primary bg-primary/10 ring-primary/20",
      dot: "bg-primary",
      label: "Pending Approval",
    },
    approved: {
      wrap: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20",
      dot: "bg-emerald-500",
      label: "Approved",
    },
    rejected: {
      wrap: "text-rose-500 bg-rose-500/10 ring-rose-500/20",
      dot: "bg-rose-500",
      label: "Rejected",
    },
    completed: {
      wrap: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/20",
      dot: "bg-emerald-500",
      label: "Completed",
    },
  };
  const meta = map[s] || map.planned;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset ${meta.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function renderExpenseStatusBadge(status: string | undefined) {
  const s = status || "draft";
  const map: Record<string, { wrap: string; label: string }> = {
    draft: {
      wrap: "bg-surface-muted text-muted ring-border",
      label: "Draft",
    },
    submitted: {
      wrap: "bg-primary/10 text-primary ring-primary/20",
      label: "Pending Approval",
    },
    approved: {
      wrap: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
      label: "Approved",
    },
    rejected: {
      wrap: "bg-rose-500/10 text-rose-500 ring-rose-500/20",
      label: "Rejected",
    },
  };
  const meta = map[s] || map.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.wrap}`}
    >
      {meta.label}
    </span>
  );
}

export function renderVisitStatusBadge(status: string | undefined) {
  const s = (status || "pending") as WorkPlanVisitStatus;
  const labels: Record<WorkPlanVisitStatus, string> = {
    pending: "Pending",
    checked_in: "Checked In",
    completed: "Completed",
    cancelled: "Cancelled",
    skipped: "Skipped",
    rescheduled: "Rescheduled",
  };
  const tones: Record<WorkPlanVisitStatus, string> = {
    pending: "bg-surface-muted text-muted ring-border",
    checked_in: "bg-amber-500/10 text-amber-500 ring-amber-500/20",
    completed: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
    cancelled: "bg-rose-500/10 text-rose-500 ring-rose-500/20",
    skipped: "bg-surface-muted text-muted ring-border",
    rescheduled: "bg-purple-500/10 text-purple-500 ring-purple-500/20",
  };
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset ${tones[s] || tones.pending}`}
    >
      {labels[s] || s}
    </span>
  );
}

export function renderWorkStatusBadge(status: string | undefined) {
  const s = status || "pending";
  const map: Record<string, { wrap: string; label: string }> = {
    pending: {
      wrap: "bg-surface-muted text-muted ring-border",
      label: "Pending",
    },
    in_progress: {
      wrap: "bg-amber-500/10 text-amber-500 ring-amber-500/20",
      label: "In Progress",
    },
    completed: {
      wrap: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
      label: "Completed",
    },
  };
  const meta = map[s] || map.pending;
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-inset ${meta.wrap}`}
    >
      {meta.label}
    </span>
  );
}

export function canEditPlan(
  status: string | undefined,
  opts?: { isAdmin?: boolean },
): boolean {
  if (opts?.isAdmin) {
    return true;
  }
  const s = status || "planned";
  return s === "planned" || s === "draft" || s === "rejected";
}

export const EXPENSE_ADD_WINDOW_DAYS = 3;

export function canAddExpenseForPlanDate(
  planDate: unknown,
  now: Date = new Date(),
): boolean {
  if (!planDate) return false;
  const pDate = new Date(String(planDate));
  if (Number.isNaN(pDate.getTime())) return false;

  const pYear = pDate.getUTCFullYear();
  const pMonth = pDate.getUTCMonth();
  const pDay = pDate.getUTCDate();

  const nDate = new Date(now);
  const nYear = nDate.getFullYear();
  const nMonth = nDate.getMonth();
  const nDay = nDate.getDate();

  const start = new Date(Date.UTC(pYear, pMonth, pDay, 0, 0, 0, 0));
  const end = new Date(Date.UTC(pYear, pMonth, pDay + (EXPENSE_ADD_WINDOW_DAYS - 1), 23, 59, 59, 999));
  const current = new Date(Date.UTC(nYear, nMonth, nDay, 12, 0, 0, 0));

  return current.getTime() >= start.getTime() && current.getTime() <= end.getTime();
}

export function isWindowEnded(
  planDate: unknown,
  now: Date = new Date(),
): boolean {
  if (!planDate) return false;
  const pDate = new Date(String(planDate));
  if (Number.isNaN(pDate.getTime())) return false;

  const pYear = pDate.getUTCFullYear();
  const pMonth = pDate.getUTCMonth();
  const pDay = pDate.getUTCDate();

  const nDate = new Date(now);
  const nYear = nDate.getFullYear();
  const nMonth = nDate.getMonth();
  const nDay = nDate.getDate();

  const end = new Date(
    Date.UTC(pYear, pMonth, pDay + (EXPENSE_ADD_WINDOW_DAYS - 1), 23, 59, 59, 999)
  );
  const current = new Date(Date.UTC(nYear, nMonth, nDay, 12, 0, 0, 0));

  return current.getTime() > end.getTime();
}

const WINDOW_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "June",
  "July",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

function formatWindowDate(d: Date): string {
  const day = d.getUTCDate();
  const month = WINDOW_MONTH_NAMES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function planItemWindowHint(
  item: "Expenses" | "Visits" | "Tasks" | "Work plans",
  planDate: unknown,
  action: string = item === "Expenses" ? "added" : "completed"
): string {
  if (!planDate) {
    return `${item} can only be ${action} from the work plan day through the next 2 days (3 days total). Earlier or later entries are not allowed.`;
  }
  const pDate = new Date(String(planDate));
  if (Number.isNaN(pDate.getTime())) {
    return `${item} can only be ${action} from the work plan day through the next 2 days (3 days total). Earlier or later entries are not allowed.`;
  }
  const start = new Date(
    Date.UTC(pDate.getUTCFullYear(), pDate.getUTCMonth(), pDate.getUTCDate())
  );
  const end = new Date(
    Date.UTC(pDate.getUTCFullYear(), pDate.getUTCMonth(), pDate.getUTCDate() + 2)
  );

  return `${item} can only be ${action} from ${formatWindowDate(start)} through ${formatWindowDate(end)} (3 days total). Earlier or later entries are not allowed.`;
}

export function expenseAddWindowHint(planDate: unknown): string {
  return planItemWindowHint("Expenses", planDate, "added");
}

export function visitWindowHint(planDate: unknown): string {
  return planItemWindowHint("Visits", planDate, "completed");
}

export function taskWindowHint(planDate: unknown): string {
  return planItemWindowHint("Tasks", planDate, "completed");
}

export function workPlanWindowHint(planDate: unknown): string {
  return planItemWindowHint("Work plans", planDate, "completed");
}

export function formatDiscussionMethod(method?: string | null): string {
  if (!method) return "—";
  switch (method) {
    case "on_call":
      return "On Call";
    case "on_direct_meeting":
      return "Direct Meeting";
    case "on_email":
      return "On Email";
    case "other":
      return "Other";
    default:
      return method.replace(/_/g, " ");
  }
}
