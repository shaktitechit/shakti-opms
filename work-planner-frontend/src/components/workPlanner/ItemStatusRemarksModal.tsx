"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Send,
  ClipboardCheck,
  Check,
} from "lucide-react";
import { DayEndRichEditor } from "./DayEndRichEditor";
import { stripHtml } from "./workPlanUtils";
import { toast } from "sonner";

export type WorkflowStatus = "pending" | "in_progress" | "completed";

export type CompleteVisitAnswers = {
  meeting_with_doctor: boolean;
  meeting_with_purchase: boolean;
  meeting_with_finance: boolean;
  meeting_with_engineer: boolean;
  new_product_introduced: boolean;
  order_received: boolean;
};

export const VISIT_COMPLETION_QUESTIONS: Array<{
  key: keyof CompleteVisitAnswers;
  label: string;
}> = [
  { key: "meeting_with_doctor", label: "Meeting with doctor?" },
  { key: "meeting_with_purchase", label: "Meeting with purchase?" },
  { key: "meeting_with_finance", label: "Meeting with finance?" },
  { key: "meeting_with_engineer", label: "Meeting with engineer/technician?" },
  { key: "new_product_introduced", label: "New product introduced?" },
  { key: "order_received", label: "Order received?" },
];

export interface ItemStatusRemarksModalProps {
  open: boolean;
  itemType: "visit" | "task";
  title: string;
  currentStatus: string;
  initialPendingRemarks?: string;
  initialInProgressRemarks?: string;
  initialOutcome?: string;
  initialVisitAnswers?: Partial<CompleteVisitAnswers>;
  isSaving?: boolean;
  onClose: () => void;
  onConfirm: (data: {
    status: WorkflowStatus;
    remarks: string;
    visitAnswers?: CompleteVisitAnswers;
  }) => Promise<void> | void;
}

export function ItemStatusRemarksModal({
  open,
  itemType,
  title,
  currentStatus,
  initialPendingRemarks = "",
  initialInProgressRemarks = "",
  initialOutcome = "",
  initialVisitAnswers,
  isSaving = false,
  onClose,
  onConfirm,
}: ItemStatusRemarksModalProps) {
  // Determine default selected target status (defaulting to next logical stage or current status)
  const defaultSelectedStatus = (): WorkflowStatus => {
    const s = String(currentStatus || "").toLowerCase();
    if (s === "created") return "in_progress";
    if (s === "pending") return "in_progress";
    if (s === "in_progress") return "completed";
    return "completed";
  };

  const [selectedStatus, setSelectedStatus] = useState<WorkflowStatus>(defaultSelectedStatus);
  const [remarks, setRemarks] = useState("");
  const [visitAnswers, setVisitAnswers] = useState<Record<keyof CompleteVisitAnswers, boolean | null>>({
    meeting_with_doctor: null,
    meeting_with_purchase: null,
    meeting_with_finance: null,
    meeting_with_engineer: null,
    new_product_introduced: null,
    order_received: null,
  });

  // Sync initial values when modal opens
  useEffect(() => {
    if (open) {
      const initStatus = defaultSelectedStatus();
      setSelectedStatus(initStatus);
      if (initStatus === "pending") {
        setRemarks(initialPendingRemarks || "");
      } else if (initStatus === "in_progress") {
        setRemarks(initialInProgressRemarks || "");
      } else {
        setRemarks(initialOutcome || "");
      }

      setVisitAnswers({
        meeting_with_doctor:
          typeof initialVisitAnswers?.meeting_with_doctor === "boolean"
            ? initialVisitAnswers.meeting_with_doctor
            : null,
        meeting_with_purchase:
          typeof initialVisitAnswers?.meeting_with_purchase === "boolean"
            ? initialVisitAnswers.meeting_with_purchase
            : null,
        meeting_with_finance:
          typeof initialVisitAnswers?.meeting_with_finance === "boolean"
            ? initialVisitAnswers.meeting_with_finance
            : null,
        meeting_with_engineer:
          typeof initialVisitAnswers?.meeting_with_engineer === "boolean"
            ? initialVisitAnswers.meeting_with_engineer
            : null,
        new_product_introduced:
          typeof initialVisitAnswers?.new_product_introduced === "boolean"
            ? initialVisitAnswers.new_product_introduced
            : null,
        order_received:
          typeof initialVisitAnswers?.order_received === "boolean"
            ? initialVisitAnswers.order_received
            : null,
      });
    }
  }, [open, currentStatus, initialPendingRemarks, initialInProgressRemarks, initialOutcome, initialVisitAnswers]);

  // Update prefilled remarks when target status changes
  const handleStatusChange = (newStatus: WorkflowStatus) => {
    setSelectedStatus(newStatus);
    if (newStatus === "pending") {
      setRemarks(initialPendingRemarks || "");
    } else if (newStatus === "in_progress") {
      setRemarks(initialInProgressRemarks || "");
    } else if (newStatus === "completed") {
      setRemarks(initialOutcome || "");
    }
  };

  const isVisit = itemType === "visit";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If visit is being completed, ensure mandatory checklist questions are answered
    if (isVisit && selectedStatus === "completed") {
      const unanswered = VISIT_COMPLETION_QUESTIONS.find((q) => visitAnswers[q.key] === null);
      if (unanswered) {
        toast.error(`Please answer checklist question: "${unanswered.label}"`);
        return;
      }
    }

    const cleanText = stripHtml(remarks).trim();
    if (!cleanText) {
      toast.error(
        selectedStatus === "completed"
          ? "Please provide outcome or completion remarks"
          : selectedStatus === "pending"
          ? "Please enter pending remarks / reason"
          : "Please enter in-progress status remarks"
      );
      return;
    }

    try {
      const finalAnswers: CompleteVisitAnswers | undefined =
        isVisit && selectedStatus === "completed"
          ? {
              meeting_with_doctor: Boolean(visitAnswers.meeting_with_doctor),
              meeting_with_purchase: Boolean(visitAnswers.meeting_with_purchase),
              meeting_with_finance: Boolean(visitAnswers.meeting_with_finance),
              meeting_with_engineer: Boolean(visitAnswers.meeting_with_engineer),
              new_product_introduced: Boolean(visitAnswers.new_product_introduced),
              order_received: Boolean(visitAnswers.order_received),
            }
          : undefined;

      await onConfirm({
        status: selectedStatus,
        remarks: remarks.trim(),
        visitAnswers: finalAnswers,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status & remarks");
    }
  };

  if (!open) return null;

  const STATUS_OPTIONS: Array<{
    id: WorkflowStatus;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "pending",
      label: "Pending",
      description: "Postpone or mark on hold with pending reason",
      icon: <Clock className="h-4 w-4 text-slate-500" />,
    },
    {
      id: "in_progress",
      label: "In Progress",
      description: "Work/Visit is currently active or underway",
      icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
    },
    {
      id: "completed",
      label: "Completed",
      description: isVisit
        ? "Complete visit with outcome checklist & notes"
        : "Successfully finished with final outcome & notes",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0 bg-card">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  {currentStatus === "completed" ? "Edit Remarks & Outcome" : "Update Remarks & Status"}
                </h2>
                <span className="rounded bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-muted uppercase">
                  {isVisit ? "Field Visit" : "Work Task"}
                </span>
              </div>
              <p className="text-xs font-semibold text-muted truncate max-w-sm mt-0.5">
                {title}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Workflow Progress Breadcrumb */}
            <div className="rounded-xl border border-border bg-surface-muted/50 p-3 text-xs space-y-2">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Workflow Progression
              </div>
              <div className="flex items-center justify-between gap-1 overflow-x-auto">
                <span
                  className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
                    currentStatus === "created"
                      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                      : "text-muted"
                  }`}
                >
                  1. Created
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                <span
                  className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
                    selectedStatus === "pending" || currentStatus === "pending"
                      ? "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/20"
                      : "text-muted"
                  }`}
                >
                  2. Pending
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                <span
                  className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
                    selectedStatus === "in_progress" || currentStatus === "in_progress"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                      : "text-muted"
                  }`}
                >
                  3. In Progress
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
                <span
                  className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${
                    selectedStatus === "completed" || currentStatus === "completed"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "text-muted"
                  }`}
                >
                  4. Completed
                </span>
              </div>
            </div>

            {/* Target Status Selection Cards */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Select Target Status Stage <span className="text-rose-500">*</span>
              </label>
              <div className="grid gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = selectedStatus === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleStatusChange(opt.id)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left transition cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-2xs"
                          : "border-border bg-card hover:bg-surface-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">{opt.icon}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              {opt.label}
                            </span>
                            {isSelected && (
                              <span className="rounded bg-primary px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted">{opt.description}</p>
                        </div>
                      </div>

                      <div className="h-4 w-4 rounded-full border border-border flex items-center justify-center shrink-0">
                        {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mandatory Visit Checklist Form (in case of Visit + Completed status) */}
            {isVisit && selectedStatus === "completed" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">
                      Mandatory Visit Checklist Questions
                    </span>
                  </div>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    Required
                  </span>
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Please specify responses for all checklist questions before marking this visit completed.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {VISIT_COMPLETION_QUESTIONS.map((q) => {
                    const val = visitAnswers[q.key];
                    return (
                      <div
                        key={q.key}
                        className={`flex flex-col justify-between rounded-lg border p-2.5 transition ${
                          val === null
                            ? "border-border bg-card"
                            : val === true
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-border bg-surface-muted/40"
                        }`}
                      >
                        <span className="text-xs font-medium text-foreground mb-2">
                          {q.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              setVisitAnswers((prev) => ({ ...prev, [q.key]: true }))
                            }
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer ${
                              val === true
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-card border border-border text-foreground hover:bg-surface-muted"
                            }`}
                          >
                            {val === true && <Check className="h-3.5 w-3.5" />}
                            Yes
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              setVisitAnswers((prev) => ({ ...prev, [q.key]: false }))
                            }
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition cursor-pointer ${
                              val === false
                                ? "bg-slate-700 dark:bg-slate-600 text-white shadow-xs"
                                : "bg-card border border-border text-foreground hover:bg-surface-muted"
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Remarks Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>
                  {selectedStatus === "completed"
                    ? isVisit
                      ? "Outcome & Summary Notes"
                      : "Outcome & Final Completion Remarks"
                    : selectedStatus === "pending"
                    ? "Pending Remarks / Delay Reason"
                    : "In-Progress Status Remarks"}{" "}
                  <span className="text-rose-500">*</span>
                </span>
              </label>
              <DayEndRichEditor
                value={remarks}
                onChange={setRemarks}
                minHeight="130px"
                placeholder={
                  selectedStatus === "completed"
                    ? isVisit
                      ? "What was discussed? Next steps, meeting takeaways, or decisions..."
                      : "Describe the outcome, meeting takeaways, key decisions, or task output..."
                    : selectedStatus === "pending"
                    ? "State reason for keeping this item pending / on hold..."
                    : "Provide current status update, work underway, or meeting details..."
                }
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border shrink-0 bg-surface-muted/30">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition cursor-pointer ${
                selectedStatus === "completed"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-primary hover:bg-primary-hover"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {currentStatus === "completed"
                    ? "Update Remarks & Outcome"
                    : selectedStatus === "completed" && isVisit
                    ? "Complete Visit"
                    : "Update Status & Remarks"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
