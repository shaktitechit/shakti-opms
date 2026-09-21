"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Briefcase,
  ChevronRight,
  Send,
} from "lucide-react";
import { toast } from "sonner";

export type WorkflowStatus = "pending" | "in_progress" | "completed";

export interface ItemStatusRemarksModalProps {
  open: boolean;
  itemType: "visit" | "task";
  title: string;
  currentStatus: string;
  initialPendingRemarks?: string;
  initialInProgressRemarks?: string;
  initialOutcome?: string;
  isSaving?: boolean;
  onClose: () => void;
  onConfirm: (data: {
    status: WorkflowStatus;
    remarks: string;
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
    }
  }, [open, currentStatus, initialPendingRemarks, initialInProgressRemarks, initialOutcome]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
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
      await onConfirm({
        status: selectedStatus,
        remarks: remarks.trim(),
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status & remarks");
    }
  };

  if (!open) return null;

  const isVisit = itemType === "visit";

  const STATUS_OPTIONS: Array<{
    id: WorkflowStatus;
    label: string;
    description: string;
    badgeStyle: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "pending",
      label: "Pending",
      description: "Postpone or mark on hold with pending reason",
      badgeStyle: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
      icon: <Clock className="h-4 w-4 text-slate-500" />,
    },
    {
      id: "in_progress",
      label: "In Progress",
      description: "Work/Visit is currently active or underway",
      badgeStyle: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
      icon: <AlertCircle className="h-4 w-4 text-amber-500" />,
    },
    {
      id: "completed",
      label: "Completed",
      description: "Successfully finished with final outcome & notes",
      badgeStyle: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Update Remarks &amp; Status
                </h2>
                <span className="rounded bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-muted uppercase">
                  {isVisit ? "Field Visit" : "Work Task"}
                </span>
              </div>
              <p className="text-xs font-semibold text-foreground truncate max-w-xs mt-0.5">
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

        {/* Workflow Progress Breadcrumb */}
        <div className="rounded-xl border border-border bg-surface-muted/50 p-3 text-xs space-y-2">
          <div className="text-[11px] font-semibold text-muted uppercase">Workflow Progression</div>
          <div className="flex items-center justify-between gap-1">
            <span className={`px-2 py-1 rounded text-[11px] font-bold ${currentStatus === "created" ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20" : "text-muted"}`}>
              1. Created
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
            <span className={`px-2 py-1 rounded text-[11px] font-bold ${currentStatus === "pending" || selectedStatus === "pending" ? "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/20" : "text-muted"}`}>
              2. Pending
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
            <span className={`px-2 py-1 rounded text-[11px] font-bold ${currentStatus === "in_progress" || selectedStatus === "in_progress" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20" : "text-muted"}`}>
              3. In Progress
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" />
            <span className={`px-2 py-1 rounded text-[11px] font-bold ${currentStatus === "completed" || selectedStatus === "completed" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "text-muted"}`}>
              4. Completed
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Status Selection Cards */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Select Target Status Stage <span className="text-rose-500">*</span>
            </label>
            <div className="grid gap-2.5">
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

          {/* Dynamic Remarks Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>
                {selectedStatus === "completed"
                  ? "Outcome & Final Completion Remarks"
                  : selectedStatus === "pending"
                  ? "Pending Remarks / Delay Reason"
                  : "In-Progress Status Remarks"}{" "}
                <span className="text-rose-500">*</span>
              </span>
            </label>
            <textarea
              rows={3}
              required
              autoFocus
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                selectedStatus === "completed"
                  ? "Describe the outcome, meeting takeaways, key decisions, or task output..."
                  : selectedStatus === "pending"
                  ? "State reason for keeping this item pending / on hold..."
                  : "Provide current status update, work underway, or meeting details..."
              }
              className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary-hover disabled:opacity-50 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving Status &amp; Remarks...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Update Status &amp; Remarks
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
