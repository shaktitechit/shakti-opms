"use client";

import { useEffect, useState } from "react";

export type InProgressWorkModalProps = {
  open: boolean;
  isSaving: boolean;
  taskTitle?: string;
  initialRemarks?: string;
  onClose: () => void;
  onConfirm: (remarks: string) => void | Promise<void>;
};

export function InProgressWorkModal({
  open,
  isSaving,
  taskTitle,
  initialRemarks = "",
  onClose,
  onConfirm,
}: InProgressWorkModalProps) {
  const [remarks, setRemarks] = useState(initialRemarks);

  useEffect(() => {
    if (open) {
      setRemarks(initialRemarks || "");
    }
  }, [open, initialRemarks]);

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
            Mark task as In Progress
          </h2>
          <p className="mt-1 text-sm text-muted">
            {taskTitle
              ? `Add in-progress remarks for “${taskTitle}”.`
              : "Add in-progress remarks for this work task."}
          </p>
        </div>
        <div className="px-5 py-4">
          <label className="mb-1.5 block text-xs font-medium text-muted">
            In-progress remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            disabled={isSaving}
            className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            placeholder="Current status / ongoing progress details..."
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
            disabled={isSaving}
            onClick={() => void onConfirm(remarks.trim())}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Mark In Progress"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InProgressWorkModal;
