"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  MessageSquare,
  Send,
  Loader2,
  Calendar,
  User,
  History,
  Mail,
  Bell,
  Sparkles,
  Info,
} from "lucide-react";
import { DayEndRichEditor } from "./DayEndRichEditor";
import { formatDateTime, stripHtml } from "./workPlanUtils";
import { readSessionFromStorage, roleLabel } from "@/utils/authStorage";
import type { AuthorityRemarkItem } from "@/types/workPlanner";
import {
  useAddWorkPlanAuthorityRemarkMutation,
  useAddVisitAuthorityRemarkMutation,
  useAddWorkAuthorityRemarkMutation,
} from "@/store/api/workPlannerApiSlice";
import { toast } from "sonner";

export interface SeniorRemarksModalProps {
  open: boolean;
  itemType: "plan" | "visit" | "task";
  title: string;
  planId: string;
  itemId?: string; // visitId or workId
  planDate?: string;
  currentStatus?: string;
  assigneeName?: string;
  initialRemarks?: string;
  authorityRemarksHistory?: AuthorityRemarkItem[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function SeniorRemarksModal({
  open,
  itemType,
  title,
  planId,
  itemId,
  planDate,
  currentStatus,
  assigneeName,
  initialRemarks = "",
  authorityRemarksHistory = [],
  onClose,
  onSuccess,
}: SeniorRemarksModalProps) {
  const sessionUser = readSessionFromStorage()?.user;
  const currentRoleName = roleLabel(sessionUser);

  const [remarks, setRemarks] = useState("");
  const [addPlanRemark, { isLoading: isSavingPlan }] = useAddWorkPlanAuthorityRemarkMutation();
  const [addVisitRemark, { isLoading: isSavingVisit }] = useAddVisitAuthorityRemarkMutation();
  const [addWorkRemark, { isLoading: isSavingWork }] = useAddWorkAuthorityRemarkMutation();

  const isSaving = isSavingPlan || isSavingVisit || isSavingWork;

  useEffect(() => {
    if (open) {
      setRemarks(initialRemarks || "");
    }
  }, [open, initialRemarks]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = remarks.trim();
    if (!clean || clean === "<p></p>") {
      toast.error("Please enter a senior remark or directive.");
      return;
    }

    try {
      if (itemType === "plan") {
        await addPlanRemark({
          planId,
          body: { manager_remarks: clean },
        }).unwrap();
      } else if (itemType === "visit") {
        if (!itemId) throw new Error("Missing visit ID");
        await addVisitRemark({
          planId,
          visitId: itemId,
          body: { manager_remarks: clean },
        }).unwrap();
      } else {
        if (!itemId) throw new Error("Missing task ID");
        await addWorkRemark({
          planId,
          workId: itemId,
          body: { manager_remarks: clean },
        }).unwrap();
      }

      toast.success(
        `Senior directive saved. Email & in-app notice dispatched to ${assigneeName || "executive"}.`
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to record senior remark");
    }
  };

  const typeLabel =
    itemType === "visit" ? "Field Visit" : itemType === "task" ? "Work Task" : "Work Plan";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-purple-500/30 bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Senior Directive &amp; Remarks
                </h3>
                <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300">
                  {typeLabel}
                </span>
              </div>
              <p className="text-xs text-muted">
                Official supervisory instructions &amp; managerial review guidance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Item Meta Card */}
          <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground truncate max-w-[340px]">
                {title || `${typeLabel} Details`}
              </span>
              {currentStatus && (
                <span className="rounded-md bg-secondary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground border border-secondary/30">
                  Status: {currentStatus.replace("_", " ")}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-1 border-t border-border/50">
              {assigneeName && (
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Concerned Executive: <strong className="text-foreground">{assigneeName}</strong>
                  </span>
                </div>
              )}
              {planDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Plan Date: <strong className="text-foreground">{planDate}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Automated Notification Alert Banner */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-start gap-2.5 text-xs text-muted">
            <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold shrink-0 mt-0.5">
              <Mail className="h-4 w-4" />
              <Bell className="h-4 w-4" />
            </div>
            <p className="leading-relaxed">
              Submitting will automatically record this directive under your name (
              <strong className="text-foreground">{sessionUser?.name || "Senior"}</strong> &bull;{" "}
              <span className="text-purple-600 dark:text-purple-400 font-semibold">{currentRoleName}</span>
              ) and trigger an <strong className="text-foreground">instant Email</strong> and{" "}
              <strong className="text-foreground">In-App Alert</strong> to the concerned executive.
            </p>
          </div>

          {/* Directive Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                Senior Instruction / Guidance Note <span className="text-rose-500">*</span>
              </span>
              <span className="text-[11px] font-normal text-muted">Rich Text Supported</span>
            </label>
            <DayEndRichEditor
              value={remarks}
              onChange={setRemarks}
              minHeight="140px"
              placeholder="Type supervisory directives, review comments, follow-up instructions, or meeting guidance..."
            />
          </div>

          {/* Senior Remarks History */}
          {Array.isArray(authorityRemarksHistory) && authorityRemarksHistory.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold text-foreground">
                    Previous Directives &amp; Remarks ({authorityRemarksHistory.length})
                  </h4>
                </div>
                <span className="text-[10px] text-muted font-medium">Chronological Log</span>
              </div>

              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {authorityRemarksHistory.map((item, idx) => {
                  const authorName =
                    item.user_name ||
                    (typeof item.user === "object" ? item.user?.name : "Senior Authority");
                  const role = item.role || "Senior Authority";
                  const roleLower = String(role).toLowerCase();
                  const badgeTone = roleLower.includes("admin")
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : roleLower.includes("coordinator")
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20";

                  return (
                    <div
                      key={item._id || idx}
                      className="rounded-xl border border-border bg-card p-3 space-y-1.5 text-xs shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{authorName}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeTone}`}
                          >
                            {role}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                      <div
                        className="text-muted text-[11px] prose prose-xs dark:prose-invert max-w-none bg-surface-muted/30 p-2 rounded-lg"
                        dangerouslySetInnerHTML={{ __html: item.remark }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving &amp; Notifying...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Save Directive &amp; Notify Junior
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
