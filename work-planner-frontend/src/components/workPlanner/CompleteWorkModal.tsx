"use client";

import { useEffect, useState } from "react";

export type CompleteWorkModalProps = {
  open: boolean;
  isSaving: boolean;
  taskTitle?: string;
  onClose: () => void;
  onConfirm: (remarks: string) => void | Promise<void>;
};

export function CompleteWorkModal({
  open,
  isSaving,
  taskTitle,
  onClose,
  onConfirm,
}: CompleteWorkModalProps) {
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!open) setRemarks("");
  }, [open]);

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

  const canSubmit = Boolean(remarks.trim()) && !isSaving;

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
            Complete work task
          </h2>
          <p className="mt-1 text-sm text-muted">
            {taskTitle
              ? `Add completion remarks for “${taskTitle}”.`
              : "Add completion remarks for this work task."}
          </p>
        </div>
        <div className="px-5 py-4">
          <label className="mb-1.5 block text-xs font-medium text-muted">
            Completion remarks *
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            disabled={isSaving}
            className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            placeholder="What was done / the outcome of this task?"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4 bg-surface-muted/50">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void onConfirm(remarks.trim())}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompleteWorkModal;
