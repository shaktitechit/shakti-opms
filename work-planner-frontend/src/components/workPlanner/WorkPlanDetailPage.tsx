"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetPlanQuery,
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
  useScheduleNextVisitMutation,
} from "@/store/api/workPlannerApiSlice";
import { isManager, readSessionFromStorage } from "@/utils/authStorage";
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
  formatPlanDate,
  formatTime,
  isLeavePlan,
  isVisitsPlan,
  isWindowEnded,
  isWorkTaskPlan,
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
import { CompleteVisitModal } from "./CompleteVisitModal";
import { CompleteWorkModal } from "./CompleteWorkModal";
import { NextVisitPlanModal } from "./NextVisitPlanModal";
import { RejectWorkPlanModal } from "./RejectWorkPlanModal";
import { ExpenseListSection } from "./ExpenseListSection";
import { DayEndSection } from "./DayEndSection";
import { DayEndMailModal } from "./DayEndMailModal";
import { DayEndViewModal } from "./DayEndViewModal";

interface WorkPlanDetailPageProps {
  planId: string;
}

export function WorkPlanDetailPage({ planId }: WorkPlanDetailPageProps) {
  const router = useRouter();
  const sessionUser = readSessionFromStorage()?.user;
  const managerRole = isManager(sessionUser);

  const { data: plan, isLoading: loading, refetch: loadPlan } = useGetPlanQuery(planId);
  const [actionLoading, setActionLoading] = useState(false);

  const [submitPlanMut] = useSubmitPlanMutation();
  const [approvePlanMut] = useApprovePlanMutation();
  const [rejectPlanMut] = useRejectPlanMutation();
  const [completePlanMut] = useCompletePlanMutation();
  const [checkInMut] = useCheckInMutation();
  const [checkOutMut] = useCheckOutMutation();
  const [removeVisitMut] = useRemoveVisitMutation();
  const [removeWorkMut] = useRemoveWorkMutation();
  const [addVisitMut] = useAddVisitMutation();
  const [updateVisitMut] = useUpdateVisitMutation();
  const [addWorkMut] = useAddWorkMutation();
  const [updateWorkMut] = useUpdateWorkMutation();
  const [completeVisitMut] = useCompleteVisitMutation();
  const [scheduleNextVisitMut] = useScheduleNextVisitMutation();

  // Modals state
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<WorkPlanVisitRecord | null>(null);

  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<WorkPlanWorkRecord | null>(null);

  const [completeVisitTarget, setCompleteVisitTarget] = useState<WorkPlanVisitRecord | null>(null);
  const [completeWorkTarget, setCompleteWorkTarget] = useState<WorkPlanWorkRecord | null>(null);
  const [nextVisitTarget, setNextVisitTarget] = useState<WorkPlanVisitRecord | null>(null);

  const [rejectPlanModalOpen, setRejectPlanModalOpen] = useState(false);
  const [dayEndMailModalOpen, setDayEndMailModalOpen] = useState(false);
  const [dayEndViewModalOpen, setDayEndViewModalOpen] = useState(false);

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

  // Visit Actions
  async function handleCheckIn(visitId: string) {
    try {
      await checkInMut({ planId, visitId }).unwrap();
      toast.success("Checked in to visit");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Check-in failed";
      toast.error(msg);
    }
  }

  async function handleCheckOut(visitId: string) {
    try {
      await checkOutMut({ planId, visitId }).unwrap();
      toast.success("Checked out of visit");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Check-out failed";
      toast.error(msg);
    }
  }

  async function handleRemoveVisit(visitId: string) {
    if (!confirm("Are you sure you want to remove this visit?")) return;
    try {
      await removeVisitMut({ planId, visitId }).unwrap();
      toast.success("Visit removed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove visit";
      toast.error(msg);
    }
  }

  async function handleRemoveWork(workId: string) {
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

  const isWindowOpen = canAddExpenseForPlanDate(plan.plan_date);
  const windowEnded = isWindowEnded(plan.plan_date);
  const canCompleteChildAction = managerRole || isWindowOpen;
  const showStructureActions = managerRole || (!isCompleted && !windowEnded);

  const allVisitsFinished =
    visits.length > 0 &&
    visits.every(
      (v) =>
        v.status === "completed" ||
        v.status === "cancelled" ||
        v.status === "skipped"
    );

  const allTasksFinished =
    works.length > 0 &&
    works.every((w) => w.status === "completed" || w.status === "cancelled");

  const canCompletePlan =
    isPlanned &&
    canCompleteChildAction &&
    (visitsPlan ? allVisitsFinished : taskPlan ? allTasksFinished : true);

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
            <p className="text-xs text-muted">
              Executive: <span className="font-medium text-foreground">{salesUserLabel(plan.sales_user)}</span>
              {plan.location ? ` • Location: ${plan.location}` : ""}
              {plan.plan_type ? ` • Type: ${plan.plan_type}` : ""}
              {plan.is_discussed_with_manager ? (
                <span className="inline-flex items-center gap-1 ml-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                  • <MessageSquare className="h-3 w-3 inline" /> Discussed with Manager
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
                  ? !canCompleteChildAction
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

          <Link
            href={`/dashboard/plans/new?copy=${planId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <Copy className="h-4 w-4 text-muted" />
            Copy
          </Link>
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
            <p className="text-xs text-foreground whitespace-pre-line">
              {plan.remarks}
            </p>
          </div>
        ) : null}

        {/* Manager Discussion Card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">
              Manager Discussion
            </h3>
          </div>
          {plan.is_discussed_with_manager ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Discussed with Manager
                </span>
              </div>
              <div className="text-muted">
                <span className="font-medium text-foreground">Manager:</span>{" "}
                {plan.discussed_manager_name ||
                  (typeof plan.discussed_manager_id === "object"
                    ? plan.discussed_manager_id?.name
                    : "") ||
                  "Manager"}
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
              This plan was not marked as discussed with a manager.
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
      </div>

      {/* Section 1: Field Visits (Visits plan only) */}
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
              >
                <Plus className="h-4 w-4" />
                Add Visit
              </button>
            )}
          </div>

          {!canCompleteChildAction && !isCompleted && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 font-medium">
              <span>ℹ️ {visitWindowHint(plan.plan_date)}</span>
            </div>
          )}

          {visits.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">
              No field visits logged for this plan yet.{showStructureActions && " Click \u201cAdd Visit\u201d to create one."}
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

                    {v.contact_person || v.phone ? (
                      <div className="flex items-center gap-4 text-xs text-foreground">
                        {v.contact_person && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="h-3.5 w-3.5 text-muted" />
                            {v.contact_person}
                          </span>
                        )}
                        {v.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-muted" />
                            {v.phone}
                          </span>
                        )}
                      </div>
                    ) : null}

                    {v.check_in_time || v.check_out_time ? (
                      <div className="flex items-center gap-3 text-xs text-muted font-medium">
                        <Clock className="h-3.5 w-3.5 text-muted" />
                        <span>In: {formatTime(v.check_in_time)}</span>
                        <span>•</span>
                        <span>Out: {formatTime(v.check_out_time)}</span>
                      </div>
                    ) : null}

                    {v.outcome ? (
                      <div className="rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-500">
                        <span className="font-semibold">Outcome: </span>
                        {v.outcome}
                      </div>
                    ) : null}

                    {/* Visit actions */}
                    {showStructureActions && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                          {!v.check_in_time && (
                            <button
                              type="button"
                              disabled={!canCompleteChildAction}
                              onClick={() => handleCheckIn(vId)}
                              title={!canCompleteChildAction ? visitWindowHint(plan.plan_date) : "Check In"}
                              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                canCompleteChildAction
                                  ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                                  : "bg-surface-muted border border-border text-muted cursor-not-allowed"
                              }`}
                            >
                              Check In
                            </button>
                          )}
                          {v.check_in_time && !v.check_out_time && (
                            <button
                              type="button"
                              disabled={!canCompleteChildAction}
                              onClick={() => handleCheckOut(vId)}
                              title={!canCompleteChildAction ? visitWindowHint(plan.plan_date) : "Check Out"}
                              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                canCompleteChildAction
                                  ? "bg-amber-600 text-white hover:bg-amber-700"
                                  : "bg-surface-muted border border-border text-muted cursor-not-allowed"
                              }`}
                            >
                              Check Out
                            </button>
                          )}
                          {v.status !== "completed" && (
                            <button
                              type="button"
                              disabled={!canCompleteChildAction}
                              onClick={() => setCompleteVisitTarget(v)}
                              title={!canCompleteChildAction ? visitWindowHint(plan.plan_date) : "Complete visit"}
                              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                canCompleteChildAction
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : "bg-surface-muted border border-border text-muted cursor-not-allowed"
                              }`}
                            >
                              Complete
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setNextVisitTarget(v)}
                            className="rounded border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-card transition"
                          >
                            Schedule Next
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVisit(v);
                              setVisitModalOpen(true);
                            }}
                            className="rounded p-1 text-muted hover:bg-card hover:text-foreground transition"
                            title="Edit visit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveVisit(vId)}
                            className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                            title="Remove visit"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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

      {/* Section 2: Tasks / Work Entries (Work Task plans only) */}
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </button>
            )}
          </div>

          {!canCompleteChildAction && !isCompleted && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 font-medium">
              <span>ℹ️ {taskWindowHint(plan.plan_date)}</span>
            </div>
          )}

          {works.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">
              No work tasks added to this plan.{showStructureActions && " Click \u201cAdd Task\u201d to log your task."}
            </p>
          ) : (
            <div className="space-y-3">
              {works.map((w, idx) => {
                const wId = w._id || w.id || String(idx);
                return (
                  <div
                    key={wId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted/50 p-3"
                  >
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
                        {w.outcome && (
                          <p className="text-xs text-emerald-500 font-medium">
                            Outcome: {w.outcome}
                          </p>
                        )}
                      </div>
                    </div>

                    {showStructureActions && (
                      <div className="flex items-center gap-2">
                        {w.status !== "completed" && (
                          <button
                            type="button"
                            disabled={!canCompleteChildAction}
                            onClick={() => setCompleteWorkTarget(w)}
                            title={!canCompleteChildAction ? taskWindowHint(plan.plan_date) : "Complete task"}
                            className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                              canCompleteChildAction
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-surface-muted border border-border text-muted cursor-not-allowed"
                            }`}
                          >
                            Complete
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWork(w);
                            setWorkModalOpen(true);
                          }}
                          className="rounded p-1 text-muted hover:bg-card hover:text-foreground transition"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveWork(wId)}
                          className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
          canCompleteChildAction={canCompleteChildAction}
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

      {completeVisitTarget && (
        <CompleteVisitModal
          open={Boolean(completeVisitTarget)}
          isSaving={actionLoading}
          onClose={() => setCompleteVisitTarget(null)}
          onConfirm={async (payload) => {
            setActionLoading(true);
            try {
              const vId = completeVisitTarget._id || completeVisitTarget.id || "";
              await completeVisitMut({ planId, visitId: vId, body: payload }).unwrap();
              toast.success("Visit completed");
              setCompleteVisitTarget(null);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to complete visit";
              toast.error(msg);
            } finally {
              setActionLoading(false);
            }
          }}
        />
      )}

      {completeWorkTarget && (
        <CompleteWorkModal
          open={Boolean(completeWorkTarget)}
          isSaving={actionLoading}
          taskTitle={completeWorkTarget.title}
          onClose={() => setCompleteWorkTarget(null)}
          onConfirm={async (remarks) => {
            setActionLoading(true);
            try {
              const wId = completeWorkTarget._id || completeWorkTarget.id || "";
              await updateWorkMut({
                planId,
                workId: wId,
                body: { status: "completed", completion_remarks: remarks, outcome: remarks },
              }).unwrap();
              toast.success("Task completed");
              setCompleteWorkTarget(null);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to complete task";
              toast.error(msg);
            } finally {
              setActionLoading(false);
            }
          }}
        />
      )}

      {nextVisitTarget && (
        <NextVisitPlanModal
          open={Boolean(nextVisitTarget)}
          isSaving={actionLoading}
          partyLabel={typeof nextVisitTarget.party === "object" ? nextVisitTarget.party?.party_name : nextVisitTarget.party_name}
          currentPlanDate={plan.plan_date}
          onClose={() => setNextVisitTarget(null)}
          onConfirm={async (nextDate) => {
            setActionLoading(true);
            try {
              const vId = nextVisitTarget._id || nextVisitTarget.id || "";
              await scheduleNextVisitMut({ planId, visitId: vId, plan_date: nextDate }).unwrap();
              toast.success("Next visit scheduled");
              setNextVisitTarget(null);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to schedule next visit";
              toast.error(msg);
            } finally {
              setActionLoading(false);
            }
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
    </div>
  );
}

export default WorkPlanDetailPage;
