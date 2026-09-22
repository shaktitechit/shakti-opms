"use client";

import React, { useState } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  Clock,
  Paperclip,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  AlertTriangle,
  Users,
} from "lucide-react";
import type { WorkPlanRecord } from "@/types/workPlanner";
import { WORK_PLANNER_SERVICE_URL, withAccessToken } from "@/lib/env";
import { readSessionFromStorage } from "@/utils/authStorage";
import { workPlanWindowHint } from "./workPlanUtils";

interface DayEndSectionProps {
  plan: WorkPlanRecord;
  isCompleted: boolean;
  canCompletePlan: boolean;
  canCompleteAction: boolean;
  actionLoading: boolean;
  onOpenMailModal: () => void;
  onOpenViewModal: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType?: string, fileName?: string) {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return <FileText className="h-4 w-4 text-rose-500 shrink-0" />;
  }
  if (
    mime.includes("image") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp")
  ) {
    return <ImageIcon className="h-4 w-4 text-sky-500 shrink-0" />;
  }
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv")
  ) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
  return <File className="h-4 w-4 text-slate-400 shrink-0" />;
}

export function DayEndSection({
  plan,
  isCompleted,
  canCompletePlan,
  canCompleteAction,
  actionLoading,
  onOpenMailModal,
  onOpenViewModal,
}: DayEndSectionProps) {
  const [bodyExpanded, setBodyExpanded] = useState(true);
  const sessionToken = readSessionFromStorage()?.token;

  const visits = plan.visits || [];
  const works = plan.works || [];
  const completedVisits = visits.filter((v) => v.status === "completed").length;
  const completedWorks = works.filter((w) => w.status === "completed").length;
  const expenses = plan.expenses || [];
  const totalExpense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const dayEnd = plan.day_end;

  const formattedCompletedDate = dayEnd?.completed_at
    ? new Date(dayEnd.completed_at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Day End Report</h2>
            <p className="text-xs text-muted">
              {isCompleted
                ? "Official day end report submitted and dispatched to management"
                : "Complete your day activities and dispatch the official email report"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Day End Completed
              {formattedCompletedDate && (
                <span className="text-[11px] font-normal text-muted">({formattedCompletedDate})</span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              Pending Day End Submission
            </span>
          )}

          {dayEnd && (
            <button
              type="button"
              onClick={onOpenViewModal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted" />
              Open Full Screen
            </button>
          )}
        </div>
      </div>

      {/* Case 1: Day End has been submitted */}
      {dayEnd ? (
        <div className="space-y-4 text-xs">
          {/* Email Header Card */}
          <div className="rounded-xl border border-border bg-surface/50 p-4 space-y-2.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-14 font-semibold text-muted text-right">From:</span>
                <span className="font-medium text-foreground">{dayEnd.from_email || "Executive"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 font-semibold text-muted text-right">To:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{dayEnd.to_email || "Manager"}</span>
              </div>
            </div>

            {dayEnd.cc_emails && dayEnd.cc_emails.length > 0 && (
              <div className="flex items-start gap-2 pt-0.5">
                <span className="w-14 font-semibold text-muted text-right pt-0.5">Cc:</span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {dayEnd.cc_emails.map((cc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground"
                    >
                      <Users className="h-3 w-3 text-muted" />
                      {cc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-0.5 border-t border-border/60">
              <span className="w-14 font-semibold text-muted text-right">Subject:</span>
              <span className="font-bold text-foreground text-sm">{dayEnd.subject || "Day End Report"}</span>
            </div>
          </div>

          {/* Attachments Section */}
          {dayEnd.attachments && dayEnd.attachments.length > 0 && (
            <div className="rounded-xl border border-border bg-surface/30 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                <Paperclip className="h-3.5 w-3.5 text-muted" />
                <span>Attached Files ({dayEnd.attachments.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {dayEnd.attachments.map((att) => (
                  <a
                    key={att._id}
                    href={
                      att._id
                        ? withAccessToken(
                            `${WORK_PLANNER_SERVICE_URL}/api/work-planner/attachments/${att._id}/view`,
                            sessionToken
                          )
                        : att.url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-surface-muted transition shadow-2xs group"
                  >
                    {getFileIcon(att.mime_type, att.original_name)}
                    <span className="font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                      {att.original_name || att.file_name}
                    </span>
                    <span className="text-[10px] text-muted">({formatFileSize(att.size)})</span>
                    <ExternalLink className="h-3 w-3 text-muted ml-0.5" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rendered HTML Email Content */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div
              className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-2 cursor-pointer select-none"
              onClick={() => setBodyExpanded(!bodyExpanded)}
            >
              <span className="font-semibold text-muted uppercase tracking-wider text-[11px]">
                Email Body Content
              </span>
              <button
                type="button"
                className="text-muted hover:text-foreground flex items-center gap-1 text-xs"
              >
                {bodyExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>Hide Body</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>View Body</span>
                  </>
                )}
              </button>
            </div>

            {bodyExpanded && (
              <div className="p-5 max-h-[500px] overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{
                    __html: dayEnd.body_html || "<p>No body recorded.</p>",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ) : isCompleted ? (
        /* Legacy completed without day_end record */
        <div className="rounded-xl border border-border bg-surface/30 p-4 text-xs text-muted">
          This work plan was marked as completed. (Day End email log was not captured for plans completed prior to this update).
        </div>
      ) : (
        /* Case 2: Plan is in progress / ready for Day End */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {visits.length > 0 && (
              <div className="rounded-xl border border-border bg-surface/40 p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-muted">Field Visits Progress</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-foreground">{completedVisits}</span>
                  <span className="text-xs text-muted">/ {visits.length} completed</span>
                </div>
              </div>
            )}

            {works.length > 0 && (
              <div className="rounded-xl border border-border bg-surface/40 p-3.5 space-y-1">
                <span className="text-[11px] font-medium text-muted">Tasks Progress</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-foreground">{completedWorks}</span>
                  <span className="text-xs text-muted">/ {works.length} completed</span>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-surface/40 p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-muted">Logged Expenses</span>
              <div className="text-xl font-bold text-foreground">
                ₹{totalExpense.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* Submission Callout Banner */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                <Send className="h-4 w-4" />
                <span>Ready to wrap up today's work?</span>
              </div>
              <p className="text-xs text-muted max-w-xl">
                Click <strong>Submit Day End Report</strong> to open the full-screen mail panel. You will be able to review summary tables, format remarks with rich text editor, attach receipts/documents, and email your manager.
              </p>
              {!canCompletePlan && (
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 pt-1">
                  ⚠️ {workPlanWindowHint(plan.plan_date)}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!canCompletePlan || actionLoading}
              onClick={onOpenMailModal}
              title={
                !canCompletePlan
                  ? !canCompleteAction
                    ? workPlanWindowHint(plan.plan_date)
                    : "Complete all visits and tasks before submitting Day End"
                  : "Submit Day End Report"
              }
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-xs shrink-0 cursor-pointer ${
                canCompletePlan
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  : "bg-surface-muted border border-border text-muted cursor-not-allowed"
              }`}
            >
              <Mail className="h-4 w-4" />
              Submit Day End Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DayEndSection;
