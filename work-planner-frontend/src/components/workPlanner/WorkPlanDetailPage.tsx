"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  MapPin,
  Plus,
  Send,
  XCircle,
  Building2,
  Phone,
  UserCheck,
  CheckSquare,
  DollarSign,
  Briefcase,
  Trash2,
  MessageSquare,
  Mail,
  ShieldCheck,
  CalendarClock,
  Camera,
  RotateCcw,
  Users,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetPlanQuery,
  useLazyGetPlansQuery,
  useSubmitPlanMutation,
  useApprovePlanMutation,
  useRejectPlanMutation,
  useCompletePlanMutation,
  useCheckInMutation,
  useCheckOutMutation,
  useRemoveVisitMutation,
  useRemoveWorkMutation,
  useAddVisitMutation,
  useUpdateVisitMutation,
  useAddWorkMutation,
  useUpdateWorkMutation,
  useCompleteVisitMutation,
  useAddWorkPlanAuthorityRemarkMutation,
} from "@/store/api/workPlannerApiSlice";
import { isWpAdmin, isWpManager, isWpElevated, readSessionFromStorage } from "@/utils/authStorage";
import { resolvePublicAssetUrl, withFileAccessToken } from "@/lib/env";
import type {
  DayEndPayload,
  WorkPlanRecord,
  WorkPlanVisitRecord,
  WorkPlanWorkRecord,
} from "@/types/workPlanner";
import {
  canAddExpenseForPlanDate,
  expenseAddWindowHint,
  formatDiscussionMethod,
  formatLocalityCity,
  getVisitLocationDisplay,
  formatPlanDate,
  formatTime,
  formatAuditUser,
  isDayEndEligible,
  isLeavePlan,
  isVisitsPlan,
  isWindowEnded,
  isWorkTaskPlan,
  isPlanDate3DaysExpired,
  renderPlanStatusBadge,
  renderVisitStatusBadge,
  renderWorkStatusBadge,
  salesUserLabel,
  taskWindowHint,
  visitWindowHint,
  workPlanWindowHint,
} from "./workPlanUtils";

import { VisitFormModal } from "./VisitFormModal";
import { WorkFormModal } from "./WorkFormModal";
import { ItemStatusRemarksModal } from "./ItemStatusRemarksModal";
import { SeniorRemarksModal } from "./SeniorRemarksModal";
import { RejectWorkPlanModal } from "./RejectWorkPlanModal";
import { ExpenseListSection } from "./ExpenseListSection";
import { DayEndSection } from "./DayEndSection";
import { DayEndMailModal } from "./DayEndMailModal";
import { DayEndViewModal } from "./DayEndViewModal";
import { CopyWorkPlanModal } from "./CopyWorkPlanModal";
import { ChangePlanTypeModal } from "./ChangePlanTypeModal";
import { PlanAiAnalysisModal } from "./PlanAiAnalysisModal";

interface WorkPlanDetailPageProps {
  planId: string;
}

function RichTextDisplay({ content, className = "" }: { content?: string; className?: string }) {
  if (!content) return null;
  const isHtml = /<[a-z][\s\S]*>/i.test(content);
  if (isHtml) {
    return (
      <div
        className={`prose prose-xs dark:prose-invert max-w-none break-words ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return <div className={`whitespace-pre-line ${className}`}>{content}</div>;
}

export function WorkPlanDetailPage({ planId }: WorkPlanDetailPageProps) {
  const router = useRouter();
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const sessionToken = useMemo(() => readSessionFromStorage()?.token, []);
  const adminRole = isWpAdmin(sessionUser);
  const managerRole = isWpManager(sessionUser);
  const elevatedRole = isWpElevated(sessionUser);
  const currentUserId = String(sessionUser?._id || (sessionUser as any)?.id || "");

  function isManagerOrAdminCreatedItem(item?: Record<string, any>): boolean {
    if (!item) return false;
    const role = String(item.created_by_role || "").toLowerCase().trim();
    return ["manager", "admin", "super_admin", "super admin"].includes(role);
  }

  const { data: plan, isLoading: loading, refetch: loadPlan } = useGetPlanQuery(planId);
  const [lazyGetPlans] = useLazyGetPlansQuery();
  const [actionLoading, setActionLoading] = useState(false);

  const [submitPlanMut] = useSubmitPlanMutation();
  const [approvePlanMut] = useApprovePlanMutation();
  const [rejectPlanMut] = useRejectPlanMutation();
  const [completePlanMut] = useCompletePlanMutation();
  const [removeVisitMut] = useRemoveVisitMutation();
  const [removeWorkMut] = useRemoveWorkMutation();
  const [addVisitMut] = useAddVisitMutation();
  const [updateVisitMut] = useUpdateVisitMutation();
  const [addWorkMut] = useAddWorkMutation();
  const [updateWorkMut] = useUpdateWorkMutation();
  const [completeVisitMut] = useCompleteVisitMutation();
  const [checkInMut] = useCheckInMutation();
  const [checkOutMut] = useCheckOutMutation();
  const [addPlanAuthorityRemarkMut] = useAddWorkPlanAuthorityRemarkMutation();

  // Modals state
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<WorkPlanVisitRecord | null>(null);

  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<WorkPlanWorkRecord | null>(null);

  const [statusRemarksTarget, setStatusRemarksTarget] = useState<{
    type: "visit" | "task";
    item: WorkPlanVisitRecord | WorkPlanWorkRecord;
  } | null>(null);

  const [seniorRemarksTarget, setSeniorRemarksTarget] = useState<{
    type: "plan" | "visit" | "task";
    item?: any;
    id?: string;
    title: string;
    currentStatus?: string;
    remarks?: string;
    history?: any[];
  } | null>(null);

  const [rejectPlanModalOpen, setRejectPlanModalOpen] = useState(false);
  const [dayEndMailModalOpen, setDayEndMailModalOpen] = useState(false);
  const [dayEndViewModalOpen, setDayEndViewModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [changePlanTypeModalOpen, setChangePlanTypeModalOpen] = useState(false);
  const [planAiModalOpen, setPlanAiModalOpen] = useState(false);

  // Plan Actions
  async function handleSubmitPlan() {
    setActionLoading(true);
    try {
      await submitPlanMut(planId).unwrap();
      toast.success("Work plan submitted for approval");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit plan";
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprovePlan() {
    setActionLoading(true);
    try {
      await approvePlanMut(planId).unwrap();
      toast.success("Work plan approved successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve plan";
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectPlanConfirm(reason: string) {
    setActionLoading(true);
    try {
      await rejectPlanMut({ id: planId, rejection_reason: reason }).unwrap();
      toast.success("Work plan rejected");
      setRejectPlanModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject plan";
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendAndCompleteDayEnd(payload: DayEndPayload) {
    setActionLoading(true);
    try {
      await completePlanMut({ id: planId, body: payload }).unwrap();
      await loadPlan();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveVisit(visitId: string, visitItem?: WorkPlanVisitRecord) {
    if (!elevatedRole && visitItem && isManagerOrAdminCreatedItem(visitItem)) {
      toast.error("Visits created by a Portal Admin or Portal Manager cannot be removed by Executives.");
      return;
    }
    if (!confirm("Are you sure you want to remove this visit?")) return;
    try {
      await removeVisitMut({ planId, visitId }).unwrap();
      toast.success("Visit removed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove visit";
      toast.error(msg);
    }
  }

  async function handleRemoveWork(workId: string, workItem?: WorkPlanWorkRecord) {
    const isDefaultTask = workItem?.work_type === "default" || (workItem as any)?.is_default_task;
    if (isDefaultTask) {
      toast.error("Default work tasks cannot be removed.");
      return;
    }
    if (!elevatedRole && workItem && isManagerOrAdminCreatedItem(workItem)) {
      toast.error("Tasks created by a Portal Admin or Portal Manager cannot be removed by Executives.");
      return;
    }
    if (!confirm("Are you sure you want to remove this task?")) return;
    try {
      await removeWorkMut({ planId, workId }).unwrap();
      toast.success("Task removed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove task";
      toast.error(msg);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted font-sans">
        Loading work plan details…
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="space-y-4 font-sans text-center py-12">
        <p className="text-muted">Work plan not found.</p>
        <Link href="/dashboard/plans" className="text-xs font-semibold text-primary hover:underline">
          Back to Plans List
        </Link>
      </div>
    );
  }

  const isPlanned = plan.status === "planned" || plan.status === "approved" || plan.status === "draft";
  const isCompleted = plan.status === "completed";
  const visits = plan.visits || [];
  const works = plan.works || [];

  const visitsPlan = isVisitsPlan(plan.plan_type);
  const taskPlan = isWorkTaskPlan(plan.plan_type);
  const leavePlan = isLeavePlan(plan.plan_type);

  const is3DaysExpired = isPlanDate3DaysExpired(plan.plan_date);
  const isWindowOpen = canAddExpenseForPlanDate(plan.plan_date);
  const windowEnded = isWindowEnded(plan.plan_date);
  const canCompleteAction = isWindowOpen && !is3DaysExpired;
  const showStructureActions = !isCompleted && !windowEnded && !is3DaysExpired;

  const allowedStatuses = new Set(["pending", "in_progress", "completed"]);

  const allVisitsFinished =
    visits.length > 0 &&
    visits.every((v) => v.status && allowedStatuses.has(v.status));

  const allTasksFinished =
    works.length > 0 &&
    works.every((w) => w.status && allowedStatuses.has(w.status));

  const canCompletePlan =
    isPlanned &&
    canCompleteAction &&
    (visitsPlan ? allVisitsFinished : taskPlan ? allTasksFinished : isDayEndEligible(visits, works));

  return (
    <div className="space-y-6 font-sans">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/plans"
            className="rounded-lg border border-border p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">
                Work Plan ({formatPlanDate(plan.plan_date)})
              </h1>
              {renderPlanStatusBadge(plan.status)}
            </div>
            <p className="text-xs text-muted flex items-center flex-wrap gap-y-1">
              <span>Executive: <span className="font-medium text-foreground">{salesUserLabel(plan.sales_user)}</span></span>
              {plan.location ? <span> • Location: <span className="text-foreground">{plan.location}</span></span> : ""}
              {plan.plan_type ? (
                <button
                  type="button"
                  onClick={() => showStructureActions && setChangePlanTypeModalOpen(true)}
                  disabled={!showStructureActions}
                  className={`inline-flex items-center gap-1 font-semibold transition ml-1 px-2 py-0.5 rounded-md border text-[11px] ${
                    showStructureActions
                      ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                      : "border-border bg-surface-muted text-foreground cursor-default"
                  }`}
                  title={showStructureActions ? "Click to change work plan type" : `Plan Type: ${plan.plan_type}`}
                >
                  <Layers className="h-3 w-3" />
                  <span>Type: {plan.plan_type}</span>
                  {showStructureActions && <Edit3 className="h-2.5 w-2.5 text-primary/70 ml-0.5" />}
                </button>
              ) : null}
              {plan.is_discussed_with_manager ? (
                <span className="inline-flex items-center gap-1 ml-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                  • <MessageSquare className="h-3 w-3 inline" /> Discussed with Manager / Coordinator
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {!isCompleted && !leavePlan && (
            <button
              type="button"
              disabled={!canCompletePlan || actionLoading}
              onClick={() => setDayEndMailModalOpen(true)}
              title={
                !canCompletePlan
                  ? !canCompleteAction
                    ? workPlanWindowHint(plan.plan_date)
                    : visitsPlan
                    ? "Complete all visits before submitting Day End"
                    : taskPlan
                    ? "Complete all tasks before submitting Day End"
                    : ""
                  : "Submit Day End and complete work plan"
              }
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition shadow-xs ${
                canCompletePlan
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  : "bg-surface-muted border border-border text-muted cursor-not-allowed"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              Day End
            </button>
          )}

          {isCompleted && plan.day_end && (
            <button
              type="button"
              onClick={() => setDayEndViewModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <Mail className="h-4 w-4" />
              View Day End Email
            </button>
          )}

          {/* 360 AI Analysis Trigger */}
          <button
            type="button"
            onClick={() => setPlanAiModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition cursor-pointer shadow-xs"
            title="Generate 360° AI Analysis for this work plan, visits, and tasks"
          >
            <Sparkles className="h-4 w-4 text-purple-500" />
            AI 360° Analysis
          </button>

          <button
            type="button"
            onClick={() => setCopyModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
          >
            <Copy className="h-4 w-4 text-muted" />
            Copy
          </button>
          {showStructureActions && (
            <button
              type="button"
              onClick={() => setChangePlanTypeModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
              title="Change the plan type / category"
            >
              <Layers className="h-4 w-4 text-muted" />
              Change Type
            </button>
          )}
          {showStructureActions && (
            <Link
              href={`/dashboard/plans/new?edit=${planId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              <Edit3 className="h-4 w-4 text-muted" />
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Completion Warning Banner */}
      {!isCompleted && !leavePlan && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>Important Notice Before Day End Submission</span>
          </div>
          <p className="text-muted">
            Please make sure all field visits/tasks for this day are added and completed before clicking <strong>Day End</strong>. Completing visits, tasks, and work plans must be done within their allowed 3-day window. Once Day End is submitted, an email report is sent to managers and visits/tasks cannot be added or edited.
          </p>
          <p className="text-muted font-medium pt-0.5">
            ℹ️ {workPlanWindowHint(plan.plan_date)}
          </p>
        </div>
      )}

      {/* Leave Info Banner */}
      {leavePlan && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
            <Calendar className="h-5 w-5" />
            <span>Leave Scheduled</span>
          </div>
          <p className="text-xs text-foreground">
            This work plan is recorded as <span className="font-semibold">Leave</span> for {salesUserLabel(plan.sales_user)}. Neither field visits nor work tasks are scheduled for this day.
          </p>
          {plan.remarks && (
            <div className="pt-2 border-t border-amber-500/20 text-xs text-muted">
              <span className="font-semibold text-foreground">Reason / Remarks: </span>
              {plan.remarks}
            </div>
          )}
        </div>
      )}

      {/* Plan Info & Discussion Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plan.remarks ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold text-muted mb-1">
              Plan Objectives / Remarks
            </h3>
            <RichTextDisplay content={plan.remarks} className="text-xs text-foreground" />
          </div>
        ) : null}

        {/* Manager Discussion Card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">
              Manager / Coordinator Discussion
            </h3>
          </div>
          {plan.is_discussed_with_manager ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Discussed with Manager / Coordinator
                </span>
              </div>
              <div className="text-muted">
                <span className="font-medium text-foreground">Discussed with:</span>{" "}
                {plan.discussed_manager_name ||
                  (typeof plan.discussed_manager_id === "object"
                    ? plan.discussed_manager_id?.name
                    : "") ||
                  "Manager / Coordinator"}
              </div>
              <div className="text-muted">
                <span className="font-medium text-foreground">Method:</span>{" "}
                <span className="font-medium text-foreground">
                  {formatDiscussionMethod(plan.discussion_method)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">
              This plan was not marked as discussed with a manager or coordinator.
            </p>
          )}
        </div>

        {plan.rejection_reason ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
            <h3 className="text-xs font-semibold text-rose-500 mb-1">
              Rejection Reason
            </h3>
            <p className="text-xs text-rose-500">
              {plan.rejection_reason}
            </p>
          </div>
        ) : null}

        {/* Plan Senior Remarks Card — visible to plan owners, executives, and seniors */}
        {(() => {
          const planOwnerId = plan.sales_user
            ? typeof plan.sales_user === "object"
              ? String((plan.sales_user as any)._id || (plan.sales_user as any).id || "")
              : String(plan.sales_user)
            : "";
          const isSeniorViewing = elevatedRole && currentUserId !== planOwnerId;
          const hasSeniorRemarks = Boolean(plan.manager_remarks) || (Array.isArray(plan.authority_remarks) && plan.authority_remarks.length > 0);
          return isSeniorViewing || hasSeniorRemarks ? (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>Senior Directives & Remarks</span>
              </div>
              {isSeniorViewing && (
                <button
                  type="button"
                  onClick={() => {
                    setSeniorRemarksTarget({
                      type: "plan",
                      id: plan._id,
                      title: `Work Plan (${formatPlanDate(plan.plan_date)})`,
                      currentStatus: plan.status,
                      remarks: plan.manager_remarks,
                      history: plan.authority_remarks,
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition cursor-pointer"
                >
                  <Edit3 className="h-3 w-3" />
                  {plan.manager_remarks ? "Update Senior Remark" : "Add Senior Remark"}
                </button>
              )}
            </div>
            {plan.manager_remarks ? (
              <RichTextDisplay content={plan.manager_remarks} className="text-xs text-foreground" />
            ) : (
              <p className="text-xs text-muted italic">No senior remarks recorded yet.</p>
            )}
            {plan.authority_remarks && plan.authority_remarks.length > 0 && (
              <div className="pt-2 border-t border-purple-500/10 space-y-1">
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  Senior Remarks History ({plan.authority_remarks.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {plan.authority_remarks.map((item, idx) => (
                    <div key={idx} className="rounded bg-card/70 p-2 text-[11px] border border-border/50">
                      <div className="flex items-center justify-between text-[10px] text-muted mb-0.5">
                        <span className="font-semibold text-foreground">
                          {item.user_name || "Senior Authority"} ({item.role || "Senior Authority"})
                        </span>
                        <span>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</span>
                      </div>
                      <RichTextDisplay content={item.remark} className="text-xs text-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          ) : null;
        })()}
      </div>

      {/* Section 1: Field Visits */}
      {visitsPlan && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                Field Visits ({visits.length})
              </h2>
            </div>
            {showStructureActions && (
              <button
                type="button"
                onClick={() => {
                  setEditingVisit(null);
                  setVisitModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Visit
              </button>
            )}
          </div>

          {!canCompleteAction && !isCompleted && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 font-medium">
              <span>ℹ️ {visitWindowHint(plan.plan_date)}</span>
            </div>
          )}

          {visits.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">
              No field visits logged for this plan yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visits.map((v, idx) => {
                const vId = v._id || v.id || String(idx);
                const partyName = typeof v.party === "object" && v.party ? (v.party as { party_name?: string }).party_name || "Party" : "Party";
                return (
                  <div
                    key={vId}
                    className="rounded-xl border border-border bg-surface-muted/50 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted" />
                          <h3 className="text-sm font-bold text-foreground">
                            {partyName}
                          </h3>
                        </div>
                        {v.purpose ? (
                          <p className="text-xs text-muted mt-0.5">
                            Purpose: {v.purpose}
                          </p>
                        ) : null}
                      </div>
                      {renderVisitStatusBadge(v.status)}
                    </div>

                    {(() => {
                      const visitContacts = Array.isArray(v.contacts) && v.contacts.length > 0
                        ? v.contacts
                        : (v.contact_person || v.contact_number || v.phone || v.contact_email)
                          ? [
                              {
                                contact_person: v.contact_person,
                                contact_number: v.contact_number || v.phone,
                                contact_email: v.contact_email,
                              },
                            ]
                          : [];

                      if (visitContacts.length === 0) return null;

                      return (
                        <div className="space-y-1.5 rounded-lg border border-border/60 bg-surface-muted/30 p-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            <span>Contacts ({visitContacts.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {visitContacts.map((c, cIdx) => (
                              <div
                                key={cIdx}
                                className="flex flex-col gap-0.5 rounded-md border border-border/50 bg-card p-2 text-xs"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold text-foreground flex items-center gap-1 truncate">
                                    <UserCheck className="h-3.5 w-3.5 text-muted shrink-0" />
                                    {c.contact_person || "Contact"}
                                  </span>
                                  {cIdx === 0 && visitContacts.length > 1 && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted mt-0.5">
                                  {c.contact_number && (
                                    <a
                                      href={`tel:${c.contact_number}`}
                                      className="flex items-center gap-1 text-foreground/80 hover:text-primary transition"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Phone className="h-3 w-3 text-muted" />
                                      <span>{c.contact_number}</span>
                                    </a>
                                  )}
                                  {c.contact_email && (
                                    <a
                                      href={`mailto:${c.contact_email}`}
                                      className="flex items-center gap-1 text-foreground/80 hover:text-primary transition truncate max-w-[180px]"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Mail className="h-3 w-3 text-muted shrink-0" />
                                      <span className="truncate">{c.contact_email}</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {v.pending_remarks ? (
                      <div className="rounded-lg bg-slate-500/10 p-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold block mb-1">Pending Remarks:</span>
                        <RichTextDisplay content={v.pending_remarks} />
                      </div>
                    ) : null}

                    {v.in_progress_remarks ? (
                      <div className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
                        <span className="font-semibold block mb-1">In-Progress Remarks:</span>
                        <RichTextDisplay content={v.in_progress_remarks} />
                      </div>
                    ) : null}

                    {v.actual_check_in ? (
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span className="font-semibold text-foreground">Check-in:</span>
                        <span>{new Date(v.actual_check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {v.actual_check_out && (
                          <>
                            <span className="font-semibold text-foreground">Check-out:</span>
                            <span>{new Date(v.actual_check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </>
                        )}
                      </div>
                    ) : null}

                    {(v.check_in_selfie_url || v.check_out_selfie_url || v.outcome_selfie_url) ? (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-primary" />
                          Verified Client Selfies
                        </span>
                        <div className="flex flex-wrap items-center gap-3">
                          {v.check_in_selfie_url ? (() => {
                            const checkInUrl = withFileAccessToken(resolvePublicAssetUrl(v.check_in_selfie_url), sessionToken);
                            return (
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-muted">Check-In Selfie</span>
                              <div className="relative group w-44 h-40 rounded-xl overflow-hidden border border-border shadow-xs bg-black">
                                <img
                                  src={checkInUrl}
                                  alt="Check In Selfie"
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-200 cursor-pointer"
                                  onClick={() => window.open(checkInUrl, "_blank")}
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/75 to-transparent p-2 text-[10px] text-white flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1 text-amber-300 font-bold">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    <span>{v.actual_check_in ? new Date(v.actual_check_in).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Timestamp"}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-sky-300 font-semibold truncate">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{getVisitLocationDisplay(v.check_in_address || v.check_out_address || v.address, v.check_in_lat ?? v.check_out_lat, v.check_in_lng ?? v.check_out_lng)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            );
                          })() : null}
                          {(v.check_out_selfie_url || (v.outcome_selfie_url && v.outcome_selfie_url !== v.check_in_selfie_url)) ? (() => {
                            const checkOutRaw = v.check_out_selfie_url || v.outcome_selfie_url || "";
                            const checkOutUrl = withFileAccessToken(resolvePublicAssetUrl(checkOutRaw), sessionToken);
                            return (
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-muted">Check-Out Selfie</span>
                              <div className="relative group w-44 h-40 rounded-xl overflow-hidden border border-border shadow-xs bg-black">
                                <img
                                  src={checkOutUrl}
                                  alt="Check Out Selfie"
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-200 cursor-pointer"
                                  onClick={() => window.open(checkOutUrl, "_blank")}
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/75 to-transparent p-2 text-[10px] text-white flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1 text-amber-300 font-bold">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    <span>{v.actual_check_out ? new Date(v.actual_check_out).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Timestamp"}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-sky-300 font-semibold truncate">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{getVisitLocationDisplay(v.check_out_address || v.check_in_address || v.address, v.check_out_lat ?? v.check_in_lat, v.check_out_lng ?? v.check_in_lng)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            );
                          })() : null}
                        </div>
                      </div>
                    ) : null}

                    {v.outcome ? (
                      <div className="rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:text-emerald-400">
                        <span className="font-semibold block mb-1">Outcome:</span>
                        <RichTextDisplay content={v.outcome} />
                      </div>
                    ) : null}

                    {(() => {
                      const hasRemarks = Boolean(v.manager_remarks) || (Array.isArray(v.authority_remarks) && v.authority_remarks.length > 0);
                      return hasRemarks ? (
                      <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-2 text-xs text-purple-700 dark:text-purple-300 space-y-1">
                        <div className="flex items-center gap-1 font-bold">
                          <ShieldCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Senior Directive / Remark:</span>
                        </div>
                        {v.manager_remarks ? <RichTextDisplay content={v.manager_remarks} /> : null}
                        {v.authority_remarks && v.authority_remarks.length > 0 && (
                          <div className="pt-1 border-t border-purple-500/20 space-y-1 text-[11px]">
                            {v.authority_remarks.map((r: any, idx: number) => (
                              <div key={r._id || idx} className="flex items-start justify-between gap-1">
                                <span className="font-semibold text-purple-800 dark:text-purple-200">
                                  {r.user_name || "Senior Authority"} ({r.role || "Manager"}):
                                </span>
                                <span className="flex-1 text-right">{r.remark}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      ) : null;
                    })()}

                    {v.rescheduled_date ? (
                      <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-2 text-xs text-indigo-700 dark:text-indigo-300">
                        <div className="flex items-center gap-1 font-bold">
                          <CalendarClock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Rescheduled to: {formatPlanDate(v.rescheduled_date)}</span>
                        </div>
                      </div>
                    ) : null}

                    {(v.created_by || v.updated_by) && (
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted pt-1">
                        {v.created_by && (
                          <span>Created by: {formatAuditUser(v.created_by, v.created_by_role)}</span>
                        )}
                        {v.updated_by && (
                          <span>Updated by: {formatAuditUser(v.updated_by, v.updated_by_role)}</span>
                        )}
                      </div>
                    )}

                    {/* Visit actions */}
                    {(elevatedRole || showStructureActions) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                        <div className="flex flex-wrap items-center gap-2">
                          {elevatedRole && (
                            <button
                              type="button"
                              onClick={() =>
                                setSeniorRemarksTarget({
                                  type: "visit",
                                  item: v,
                                  id: v._id || v.id,
                                  title:
                                    typeof v.party === "object"
                                      ? (v.party as any)?.party_name || "Field Visit"
                                      : v.party_name || "Field Visit",
                                  currentStatus: v.status,
                                  remarks: v.manager_remarks,
                                  history: v.authority_remarks,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition cursor-pointer"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>Senior Remarks</span>
                              {Array.isArray(v.authority_remarks) && v.authority_remarks.length > 0 && (
                                <span className="ml-0.5 rounded-full bg-purple-500/20 px-1.5 py-0.2 text-[10px] font-bold">
                                  {v.authority_remarks.length}
                                </span>
                              )}
                            </button>
                          )}

                          {v.status === "completed" ? (
                            <button
                              type="button"
                              disabled={!canCompleteAction && !elevatedRole}
                              onClick={() => setStatusRemarksTarget({ type: "visit", item: v })}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit Outcome</span>
                            </button>
                          ) : v.status === "checked_in" ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={!canCompleteAction && !elevatedRole}
                                onClick={() => setStatusRemarksTarget({ type: "visit", item: v })}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-3 py-1.5 text-xs font-bold shadow-xs hover:bg-sky-700 transition disabled:opacity-50 cursor-pointer"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>Check Out</span>
                              </button>
                              <button
                                type="button"
                                disabled={!canCompleteAction && !elevatedRole}
                                onClick={() => setStatusRemarksTarget({ type: "visit", item: v })}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold shadow-xs hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Complete Outcome</span>
                              </button>
                            </div>
                          ) : v.status === "checked_out" ? (
                            <button
                              type="button"
                              disabled={!canCompleteAction && !elevatedRole}
                              onClick={() => setStatusRemarksTarget({ type: "visit", item: v })}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold shadow-xs hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Complete Outcome</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!canCompleteAction && !elevatedRole}
                              onClick={() => setStatusRemarksTarget({ type: "visit", item: v })}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold shadow-xs hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>{elevatedRole ? "Update Status" : "Check In"}</span>
                            </button>
                          )}
                        </div>

                            <div className="flex items-center gap-1">
                              {showStructureActions && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingVisit(v);
                                    setVisitModalOpen(true);
                                  }}
                                  className="rounded p-1 text-muted hover:bg-card hover:text-foreground transition cursor-pointer"
                                  title="Edit visit"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {showStructureActions && (elevatedRole || !isManagerOrAdminCreatedItem(v)) ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVisit(vId, v)}
                                  className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                                  title="Remove visit"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 2: Tasks / Work Entries */}
      {taskPlan && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                Work Tasks ({works.length})
              </h2>
            </div>
            {showStructureActions && (
              <button
                type="button"
                onClick={() => {
                  setEditingWork(null);
                  setWorkModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </button>
            )}
          </div>

          {!canCompleteAction && !isCompleted && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 font-medium">
              <span>ℹ️ {taskWindowHint(plan.plan_date)}</span>
            </div>
          )}

          {works.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">
              No work tasks added to this plan.
            </p>
          ) : (
            <div className="space-y-3">
              {works.map((w, idx) => {
                const wId = w._id || w.id || String(idx);
                const isDefaultTask = w.work_type === "default" || (w as any).is_default_task;
                const canRemoveWork = !isDefaultTask && (elevatedRole || !isManagerOrAdminCreatedItem(w));
                return (
                  <div
                    key={wId}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted/50 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-4 w-4 text-muted" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              {w.title}
                            </span>
                            {renderWorkStatusBadge(w.status)}
                          </div>
                          {w.description && (
                            <p className="text-xs text-muted">
                              {w.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Work Task actions */}
                      {(elevatedRole || showStructureActions) && (
                        <div className="flex items-center gap-2">
                          {elevatedRole && (
                            <button
                              type="button"
                              onClick={() =>
                                setSeniorRemarksTarget({
                                  type: "task",
                                  item: w,
                                  id: w._id || w.id,
                                  title: w.title || "Work Task",
                                  currentStatus: w.status,
                                  remarks: w.manager_remarks,
                                  history: w.authority_remarks,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition cursor-pointer"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>Senior Remarks</span>
                              {Array.isArray(w.authority_remarks) && w.authority_remarks.length > 0 && (
                                <span className="ml-0.5 rounded-full bg-purple-500/20 px-1.5 py-0.2 text-[10px] font-bold">
                                  {w.authority_remarks.length}
                                </span>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={!canCompleteAction && !elevatedRole}
                            onClick={() => setStatusRemarksTarget({ type: "task", item: w })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 text-primary px-3 py-1 text-xs font-bold hover:bg-primary/20 transition disabled:opacity-50 cursor-pointer"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>{w.status === "completed" ? "Edit Outcome" : "Update Status"}</span>
                          </button>
                              {showStructureActions && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingWork(w);
                                    setWorkModalOpen(true);
                                  }}
                                  className="rounded p-1 text-muted hover:bg-card hover:text-foreground transition cursor-pointer"
                                  title="Edit task"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {showStructureActions && canRemoveWork ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveWork(wId, w)}
                                  className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                                  title="Remove task"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                        </div>
                      )}
                    </div>

                    {w.pending_remarks ? (
                      <div className="text-xs text-slate-600 dark:text-slate-400 font-medium pl-7">
                        <span className="font-semibold">Pending Remarks: </span>
                        <RichTextDisplay content={w.pending_remarks} className="inline-block" />
                      </div>
                    ) : null}

                    {w.in_progress_remarks ? (
                      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium pl-7">
                        <span className="font-semibold">In-Progress Remarks: </span>
                        <RichTextDisplay content={w.in_progress_remarks} className="inline-block" />
                      </div>
                    ) : null}

                    {(w.completion_remarks || w.outcome) ? (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium pl-7">
                        <span className="font-semibold">Outcome: </span>
                        <RichTextDisplay content={w.completion_remarks || w.outcome} className="inline-block" />
                      </div>
                    ) : null}

                    {(() => {
                      const hasRemarks = Boolean(w.manager_remarks) || (Array.isArray(w.authority_remarks) && w.authority_remarks.length > 0);
                      return hasRemarks ? (
                      <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-2 text-xs text-purple-700 dark:text-purple-300 ml-7 space-y-1">
                        <div className="flex items-center gap-1 font-bold">
                          <ShieldCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Senior Directive / Remark:</span>
                        </div>
                        {w.manager_remarks ? <RichTextDisplay content={w.manager_remarks} /> : null}
                        {w.authority_remarks && w.authority_remarks.length > 0 && (
                          <div className="pt-1 border-t border-purple-500/20 space-y-1 text-[11px]">
                            {w.authority_remarks.map((r: any, idx: number) => (
                              <div key={r._id || idx} className="flex items-start justify-between gap-1">
                                <span className="font-semibold text-purple-800 dark:text-purple-200">
                                  {r.user_name || "Senior Authority"} ({r.role || "Manager"}):
                                </span>
                                <span className="flex-1 text-right">{r.remark}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      ) : null;
                    })()}

                    {w.rescheduled_date ? (
                      <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-2 text-xs text-indigo-700 dark:text-indigo-300 ml-7">
                        <div className="flex items-center gap-1 font-bold">
                          <CalendarClock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Rescheduled to: {formatPlanDate(w.rescheduled_date)}</span>
                        </div>
                      </div>
                    ) : null}

                    {(w.created_by || w.updated_by) && (
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted pl-7">
                        {w.created_by && (
                          <span>Created by: {formatAuditUser(w.created_by, w.created_by_role)}</span>
                        )}
                        {w.updated_by && (
                          <span>Updated by: {formatAuditUser(w.updated_by, w.updated_by_role)}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 3: Expense Claims (non-leave plans) */}
      {!leavePlan && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Expense Claims
            </h2>
          </div>

          <ExpenseListSection plan={plan} isManager={managerRole} onRefresh={() => { loadPlan(); }} />
        </div>
      )}

      {/* Section 4: Day End Section */}
      {!leavePlan && (
        <DayEndSection
          plan={plan}
          isCompleted={isCompleted}
          canCompletePlan={canCompletePlan}
          canCompleteAction={canCompleteAction}
          actionLoading={actionLoading}
          onOpenMailModal={() => setDayEndMailModalOpen(true)}
          onOpenViewModal={() => setDayEndViewModalOpen(true)}
        />
      )}


      {/* Modals */}
      {visitModalOpen && (
        <VisitFormModal
          open={visitModalOpen}
          mode={editingVisit ? "edit" : "create"}
          initial={editingVisit}
          planDate={plan.plan_date}
          salesUserId={
            typeof plan.sales_user === "object"
              ? plan.sales_user?._id || (plan.sales_user as { id?: string })?.id
              : plan.sales_user
          }
          planOwnerId={
            typeof plan.sales_user === "object"
              ? String((plan.sales_user as any)?._id || (plan.sales_user as any)?.id || "")
              : String(plan.sales_user || "")
          }
          isSaving={actionLoading}
          onClose={() => {
            setVisitModalOpen(false);
            setEditingVisit(null);
          }}
          onSubmit={async (body) => {
            setActionLoading(true);
            try {
              if (editingVisit) {
                const vId = editingVisit._id || editingVisit.id || "";
                await updateVisitMut({ planId, visitId: vId, body }).unwrap();
                toast.success("Visit updated");
              } else {
                await addVisitMut({ planId, body }).unwrap();
                toast.success("Visit added");
              }
              setVisitModalOpen(false);
              setEditingVisit(null);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to save visit";
              toast.error(msg);
            } finally {
              setActionLoading(false);
            }
          }}
        />
      )}

      {workModalOpen && (
        <WorkFormModal
          open={workModalOpen}
          mode={editingWork ? "edit" : "create"}
          initial={editingWork}
          planDate={plan.plan_date}
          salesUserId={
            typeof plan.sales_user === "object"
              ? plan.sales_user?._id || (plan.sales_user as { id?: string })?.id
              : plan.sales_user
          }
          planOwnerId={
            typeof plan.sales_user === "object"
              ? String((plan.sales_user as any)?._id || (plan.sales_user as any)?.id || "")
              : String(plan.sales_user || "")
          }
          isSaving={actionLoading}
          onClose={() => {
            setWorkModalOpen(false);
            setEditingWork(null);
          }}
          onSubmit={async (body) => {
            setActionLoading(true);
            try {
              if (editingWork) {
                const wId = editingWork._id || editingWork.id || "";
                await updateWorkMut({ planId, workId: wId, body }).unwrap();
                toast.success("Task updated");
              } else {
                await addWorkMut({ planId, body }).unwrap();
                toast.success("Task added");
              }
              setWorkModalOpen(false);
              setEditingWork(null);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to save task";
              toast.error(msg);
            } finally {
              setActionLoading(false);
            }
          }}
        />
      )}

      {statusRemarksTarget && (
        <ItemStatusRemarksModal
          open={Boolean(statusRemarksTarget)}
          itemType={statusRemarksTarget.type}
          title={
            statusRemarksTarget.type === "visit"
              ? typeof (statusRemarksTarget.item as WorkPlanVisitRecord).party === "object"
                ? ((statusRemarksTarget.item as WorkPlanVisitRecord).party as any)?.party_name || "Field Visit"
                : (statusRemarksTarget.item as WorkPlanVisitRecord).party_name || "Field Visit"
              : (statusRemarksTarget.item as WorkPlanWorkRecord).title || "Work Task"
          }
          currentStatus={statusRemarksTarget.item.status || "created"}
          initialPendingRemarks={statusRemarksTarget.item.pending_remarks}
          initialInProgressRemarks={statusRemarksTarget.item.in_progress_remarks}
          initialOutcome={
            statusRemarksTarget.type === "visit"
              ? (statusRemarksTarget.item as WorkPlanVisitRecord).outcome
              : (statusRemarksTarget.item as WorkPlanWorkRecord).completion_remarks || (statusRemarksTarget.item as WorkPlanWorkRecord).outcome
          }
          initialManagerRemarks={statusRemarksTarget.item.manager_remarks}
          initialRescheduledDate={statusRemarksTarget.item.rescheduled_date}
          authorityRemarksHistory={statusRemarksTarget.item.authority_remarks}
          planOwnerId={
            typeof plan.sales_user === "object"
              ? String((plan.sales_user as any)?._id || (plan.sales_user as any)?.id || "")
              : String(plan.sales_user || "")
          }
          initialVisitAnswers={
            statusRemarksTarget.type === "visit"
              ? {
                  meeting_with_doctor: (statusRemarksTarget.item as WorkPlanVisitRecord).meeting_with_doctor,
                  meeting_with_purchase: (statusRemarksTarget.item as WorkPlanVisitRecord).meeting_with_purchase,
                  meeting_with_finance: (statusRemarksTarget.item as WorkPlanVisitRecord).meeting_with_finance,
                  meeting_with_engineer: (statusRemarksTarget.item as WorkPlanVisitRecord).meeting_with_engineer,
                  new_product_introduced: (statusRemarksTarget.item as WorkPlanVisitRecord).new_product_introduced,
                  order_received: (statusRemarksTarget.item as WorkPlanVisitRecord).order_received,
                }
              : undefined
          }
          visitRecord={
            statusRemarksTarget.type === "visit"
              ? (statusRemarksTarget.item as WorkPlanVisitRecord)
              : undefined
          }
          isSaving={actionLoading}
          onClose={() => setStatusRemarksTarget(null)}
          onConfirm={async ({ status, remarks, managerRemarks, rescheduledDate, visitAnswers, selfieUrl, lat, lng }) => {
            setActionLoading(true);
            try {
              if (statusRemarksTarget.type === "visit") {
                const v = statusRemarksTarget.item as WorkPlanVisitRecord;
                const vId = v._id || v.id || "";
                const body: Record<string, any> = {
                  status,
                  manager_remarks: managerRemarks !== undefined ? managerRemarks : undefined,
                  rescheduled_date: status === "rescheduled" ? rescheduledDate : undefined,
                  selfie_url: selfieUrl || undefined,
                  lat: lat || undefined,
                  lng: lng || undefined,
                };
                if (status === "checked_in") {
                  body.in_progress_remarks = remarks;
                  await checkInMut({
                    planId,
                    visitId: vId,
                    body,
                  }).unwrap();
                } else if (status === "completed") {
                  body.outcome = remarks;
                  if (visitAnswers) {
                    Object.assign(body, visitAnswers);
                  }
                  await completeVisitMut({
                    planId,
                    visitId: vId,
                    body,
                  }).unwrap();
                } else if (status === "pending") {
                  body.pending_remarks = remarks;
                  await updateVisitMut({
                    planId,
                    visitId: vId,
                    body,
                  }).unwrap();
                } else {
                  body.remarks = remarks;
                  await updateVisitMut({
                    planId,
                    visitId: vId,
                    body,
                  }).unwrap();
                }
                toast.success(`Visit status updated to ${status.replace("_", " ")}`);
              } else {
                const w = statusRemarksTarget.item as WorkPlanWorkRecord;
                const wId = w._id || w.id || "";
                const body: Record<string, any> = {
                  status,
                  manager_remarks: managerRemarks !== undefined ? managerRemarks : undefined,
                  rescheduled_date: status === "rescheduled" ? rescheduledDate : undefined,
                };
                if (status === "completed") {
                  body.completion_remarks = remarks;
                  body.outcome = remarks;
                  await updateWorkMut({
                    planId,
                    workId: wId,
                    body,
                  }).unwrap();
                } else if (status === "pending") {
                  body.pending_remarks = remarks;
                  await updateWorkMut({
                    planId,
                    workId: wId,
                    body,
                  }).unwrap();
                } else if (status === "in_progress") {
                  body.in_progress_remarks = remarks;
                  await updateWorkMut({
                    planId,
                    workId: wId,
                    body,
                  }).unwrap();
                } else {
                  body.remarks = remarks;
                  await updateWorkMut({
                    planId,
                    workId: wId,
                    body,
                  }).unwrap();
                }
                toast.success(`Task status updated to ${status.replace("_", " ")}`);
              }
              setStatusRemarksTarget(null);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to update status";
              toast.error(msg);
            } finally {
              setActionLoading(false);
            }
          }}
        />
      )}

      {/* Unified Senior Directives & Remarks Modal */}
      {seniorRemarksTarget && (
        <SeniorRemarksModal
          open={Boolean(seniorRemarksTarget)}
          itemType={seniorRemarksTarget.type}
          title={seniorRemarksTarget.title}
          planId={planId}
          itemId={seniorRemarksTarget.id}
          planDate={formatPlanDate(plan.plan_date)}
          currentStatus={seniorRemarksTarget.currentStatus}
          assigneeName={salesUserLabel(plan.sales_user)}
          initialRemarks={seniorRemarksTarget.remarks}
          authorityRemarksHistory={seniorRemarksTarget.history}
          onClose={() => setSeniorRemarksTarget(null)}
          onSuccess={() => {
            loadPlan();
          }}
        />
      )}

      <DayEndMailModal
        planId={planId}
        plan={plan}
        sessionUser={sessionUser}
        isOpen={dayEndMailModalOpen}
        onClose={() => setDayEndMailModalOpen(false)}
        onCompleteSuccess={() => {
          setDayEndMailModalOpen(false);
          loadPlan();
        }}
        onSendAndComplete={handleSendAndCompleteDayEnd}
        loading={actionLoading}
      />

      <DayEndViewModal
        dayEnd={plan.day_end}
        isOpen={dayEndViewModalOpen}
        onClose={() => setDayEndViewModalOpen(false)}
      />

      {copyModalOpen && (
        <CopyWorkPlanModal
          open={copyModalOpen}
          sourcePlanId={planId}
          sourcePlanDate={plan.plan_date}
          sourcePlanType={plan.plan_type}
          sourceExecutiveName={salesUserLabel(plan.sales_user)}
          sourceSalesUserId={
            typeof plan.sales_user === "object" && plan.sales_user
              ? String(plan.sales_user._id || plan.sales_user.id)
              : String(plan.sales_user || "")
          }
          onClose={() => setCopyModalOpen(false)}
        />
      )}

      {changePlanTypeModalOpen && (
        <ChangePlanTypeModal
          open={changePlanTypeModalOpen}
          planId={planId}
          currentPlanType={plan.plan_type}
          planDate={plan.plan_date}
          isCompleted={isCompleted}
          onClose={() => setChangePlanTypeModalOpen(false)}
          onSuccess={() => loadPlan()}
        />
      )}

      {planAiModalOpen && (
        <PlanAiAnalysisModal
          open={planAiModalOpen}
          planId={planId}
          planDate={plan.plan_date}
          executiveName={salesUserLabel(plan.sales_user)}
          onClose={() => setPlanAiModalOpen(false)}
        />
      )}
    </div>
  );
}

export default WorkPlanDetailPage;
