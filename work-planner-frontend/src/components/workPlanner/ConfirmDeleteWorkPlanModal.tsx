"use client";

import { useEffect } from "react";

export type ConfirmDeleteWorkPlanModalProps = {
  planId: string | null;
  planLabel: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDeleteWorkPlanModal({
  planId,
  planLabel,
  isDeleting,
  onClose,
  onConfirm,
}: ConfirmDeleteWorkPlanModalProps) {
  const open = planId != null && planId !== "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, isDeleting, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={() => !isDeleting && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Delete work plan?
          </h2>
          <p className="mt-2 text-sm text-muted">
            This will soft-delete{" "}
            <span className="font-medium text-foreground">
              {planLabel.trim() || planId}
            </span>{" "}
            and its visits/expenses.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4 bg-surface-muted/50">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
