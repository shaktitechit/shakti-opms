"use client";

import React from "react";
import {
  Mail,
  X,
  Users,
  Paperclip,
  ExternalLink,
  Calendar,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
} from "lucide-react";
import type { WorkPlanDayEnd } from "@/types/workPlanner";
import { WORK_PLANNER_SERVICE_URL, withAccessToken } from "@/lib/env";
import { readSessionFromStorage } from "@/utils/authStorage";

interface DayEndViewModalProps {
  dayEnd?: WorkPlanDayEnd;
  isOpen: boolean;
  onClose: () => void;
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

export function DayEndViewModal({ dayEnd, isOpen, onClose }: DayEndViewModalProps) {
  if (!isOpen || !dayEnd) return null;

  const sessionToken = readSessionFromStorage()?.token;

  const formattedDate = dayEnd.completed_at
    ? new Date(dayEnd.completed_at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs">
      <div className="flex flex-col h-[90vh] w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Submitted Day End Mail</h3>
              <p className="text-xs text-muted">Sent on {formattedDate}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Metadata Fields */}
        <div className="border-b border-border bg-card p-4 space-y-2 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-16 font-semibold text-muted text-right">From:</span>
            <span className="font-medium text-foreground">{dayEnd.from_email || "Executive"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-16 font-semibold text-muted text-right">To:</span>
            <span className="font-medium text-foreground">{dayEnd.to_email || "Manager"}</span>
          </div>
          {dayEnd.cc_emails && dayEnd.cc_emails.length > 0 && (
            <div className="flex items-start gap-3">
              <span className="w-16 font-semibold text-muted text-right pt-0.5">Cc:</span>
              <div className="flex flex-wrap gap-1.5">
                {dayEnd.cc_emails.map((cc, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-foreground"
                  >
                    <Users className="h-3 w-3 text-muted" />
                    {cc}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="w-16 font-semibold text-muted text-right">Subject:</span>
            <span className="font-bold text-foreground">{dayEnd.subject || "Day End Report"}</span>
          </div>

          {/* Attachments */}
          {dayEnd.attachments && dayEnd.attachments.length > 0 && (
            <div className="flex items-start gap-3 pt-1">
              <span className="w-16 font-semibold text-muted text-right pt-1">Attached:</span>
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs text-foreground hover:bg-surface transition"
                  >
                    {getFileIcon(att.mime_type, att.original_name)}
                    <span className="font-medium">{att.original_name || att.file_name}</span>
                    <span className="text-[10px] text-muted">({formatFileSize(att.size)})</span>
                    <ExternalLink className="h-3 w-3 text-muted ml-0.5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rendered HTML Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-surface/20">
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: dayEnd.body_html || "<p>No content recorded.</p>" }}
          />
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-surface px-5 py-3 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default DayEndViewModal;
