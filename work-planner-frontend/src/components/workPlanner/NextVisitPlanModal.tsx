"use client";

import { useEffect, useState } from "react";

export type NextVisitPlanModalProps = {
  open: boolean;
  isSaving: boolean;
  partyLabel?: string;
  defaultDate?: string;
  currentPlanDate?: string;
  onClose: () => void;
  onConfirm: (planDate: string) => void | Promise<void>;
};

export function NextVisitPlanModal({
  open,
  isSaving,
  partyLabel,
  defaultDate,
  currentPlanDate,
  onClose,
  onConfirm,
}: NextVisitPlanModalProps) {
  const [planDate, setPlanDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setPlanDate(defaultDate || "");
  }, [open, defaultDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, isSaving, onClose]);

  if (!open) return null;

  const sameAsCurrent =
    Boolean(planDate) &&
    Boolean(currentPlanDate) &&
    planDate === currentPlanDate;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={() => !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Next visit plan
          </h2>
          <p className="mt-1 text-sm text-muted">
            Pick a work plan date
            {partyLabel ? (
              <>
                {" "}
                for <span className="font-medium text-foreground">{partyLabel}</span>
              </>
            ) : null}
            . A <span className="font-medium">new pending visit</span> is created on that
            day&apos;s plan.
          </p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Work plan date
            </label>
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {sameAsCurrent ? (
              <p className="mt-1 text-xs text-rose-600">
                Choose a date different from the current work plan.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4 bg-surface-muted/50">
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
            disabled={isSaving || !planDate || sameAsCurrent}
            onClick={() => void onConfirm(planDate)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition"
          >
            {isSaving ? "Scheduling…" : "Schedule next visit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NextVisitPlanModal;
