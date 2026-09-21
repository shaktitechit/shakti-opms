"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { WorkPlanWorkRecord } from "@/types/workPlanner";
import { formatPlanDate, formatAuditUser, formatDateTime } from "./workPlanUtils";

export type WorkFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: WorkPlanWorkRecord | null;
  planDate?: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void | Promise<void>;
};

const inputClass =
  "w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const labelClass = "mb-1.5 block text-xs font-medium text-muted";

function ymdFromPlanDate(planDate?: string | null): string {
  if (!planDate) return "";
  const trimmed = String(planDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function timeFromIso(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combinePlanDateAndTime(
  planDate: string | undefined | null,
  time: string,
): string | undefined {
  if (!time) return undefined;
  const ymd = ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10);
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const local = new Date(`${ymd}T${normalizedTime}`);
  if (isNaN(local.getTime())) {
    const d = new Date(time);
    if (!isNaN(d.getTime())) return d.toISOString();
    return time;
  }
  return local.toISOString();
}

export function WorkFormModal({
  open,
  mode,
  initial,
  planDate,
  isSaving,
  onClose,
  onSubmit,
}: WorkFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plannedStartTime, setPlannedStartTime] = useState("");
  const [plannedEndTime, setPlannedEndTime] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const planDateYmd = ymdFromPlanDate(planDate);
  const planDateLabel = planDateYmd
    ? formatPlanDate(`${planDateYmd}T00:00:00`)
    : "—";

  useEffect(() => {
    if (open) {
      if (initial) {
        setTitle(initial.title || "");
        setDescription(initial.description || "");
        setPlannedStartTime(timeFromIso(initial.planned_start_time));
        setPlannedEndTime(timeFromIso(initial.planned_end_time));
      } else {
        setTitle("");
        setDescription("");
        setPlannedStartTime("");
        setPlannedEndTime("");
      }
      setErrors({});
    }
  }, [open, initial]);

  if (!open) return null;

  function handleSave() {
    const errs: Record<string, string> = {};
    if (!title.trim()) {
      errs.title = "Task title/description is required";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      planned_start_time: combinePlanDateAndTime(planDate, plannedStartTime),
      planned_end_time: combinePlanDateAndTime(planDate, plannedEndTime),
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={() => !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {mode === "create" ? "Add Work Task" : "Edit Work Task"}
            </h2>
            <p className="text-xs text-muted">
              For plan date: <span className="font-medium">{planDateLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className={labelClass}>
              Task Title / Summary <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              placeholder="e.g. Documentation, Client calls, Remote support"
              className={inputClass}
            />
            {errors.title ? (
              <p className="mt-1 text-xs text-rose-500">{errors.title}</p>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>Task Description / Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              rows={3}
              placeholder="Detailed notes on planned activities..."
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Planned Start Time</label>
              <input
                type="time"
                value={plannedStartTime}
                onChange={(e) => setPlannedStartTime(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Planned End Time</label>
              <input
                type="time"
                value={plannedEndTime}
                onChange={(e) => setPlannedEndTime(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </div>
          </div>

          {initial && (initial.created_by || initial.updated_by || initial.createdAt || initial.updatedAt) && (
            <div className="rounded-lg border border-border bg-surface-muted/60 p-3 space-y-1.5 text-xs text-muted">
              <div className="font-semibold text-foreground">Audit Information</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {(initial.created_by || initial.created_by_role) && (
                  <div>
                    <span className="font-medium text-foreground">Created By:</span>{" "}
                    {formatAuditUser(initial.created_by, initial.created_by_role)}
                    {initial.createdAt && ` on ${formatDateTime(initial.createdAt)}`}
                  </div>
                )}
                {(initial.updated_by || initial.updated_by_role) && (
                  <div>
                    <span className="font-medium text-foreground">Updated By:</span>{" "}
                    {formatAuditUser(initial.updated_by, initial.updated_by_role)}
                    {initial.updatedAt && ` on ${formatDateTime(initial.updatedAt)}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 bg-surface-muted/50">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition"
          >
            {isSaving ? "Saving…" : mode === "create" ? "Add Task" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkFormModal;
