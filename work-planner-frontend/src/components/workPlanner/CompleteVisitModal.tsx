"use client";

import { useEffect, useState } from "react";

export type CompleteVisitAnswers = {
  meeting_with_doctor: boolean;
  meeting_with_purchase: boolean;
  meeting_with_finance: boolean;
  meeting_with_engineer: boolean;
  new_product_introduced: boolean;
  order_received: boolean;
};

export type CompleteVisitPayload = CompleteVisitAnswers & {
  outcome: string;
};

export type CompleteVisitModalProps = {
  open: boolean;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (payload: CompleteVisitPayload) => void | Promise<void>;
};

const QUESTIONS: { key: keyof CompleteVisitAnswers; label: string }[] = [
  { key: "meeting_with_doctor", label: "Meeting with doctor?" },
  { key: "meeting_with_purchase", label: "Meeting with purchase?" },
  { key: "meeting_with_finance", label: "Meeting with finance?" },
  { key: "meeting_with_engineer", label: "Meeting with engineer/technician?" },
  { key: "new_product_introduced", label: "New product introduced?" },
  { key: "order_received", label: "Order received?" },
];

type YesNo = boolean | null;

function YesNoRadios({
  name,
  label,
  value,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  value: YesNo;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-muted">
        {label}
      </legend>
      <div className="flex items-center gap-4">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
          <input
            type="radio"
            name={name}
            checked={value === true}
            disabled={disabled}
            onChange={() => onChange(true)}
            className="h-3.5 w-3.5 border-border text-primary focus:ring-primary/20"
          />
          Yes
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
          <input
            type="radio"
            name={name}
            checked={value === false}
            disabled={disabled}
            onChange={() => onChange(false)}
            className="h-3.5 w-3.5 border-border text-primary focus:ring-primary/20"
          />
          No
        </label>
      </div>
    </fieldset>
  );
}

export function CompleteVisitModal({
  open,
  isSaving,
  onClose,
  onConfirm,
}: CompleteVisitModalProps) {
  const [outcome, setOutcome] = useState("");
  const [answers, setAnswers] = useState<Record<keyof CompleteVisitAnswers, YesNo>>({
    meeting_with_doctor: null,
    meeting_with_purchase: null,
    meeting_with_finance: null,
    meeting_with_engineer: null,
    new_product_introduced: null,
    order_received: null,
  });

  useEffect(() => {
    if (!open) {
      setOutcome("");
      setAnswers({
        meeting_with_doctor: null,
        meeting_with_purchase: null,
        meeting_with_finance: null,
        meeting_with_engineer: null,
        new_product_introduced: null,
        order_received: null,
      });
    }
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

  const allAnswered = QUESTIONS.every((q) => answers[q.key] !== null);
  const isValid = outcome.trim() !== "" && allAnswered;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSaving) return;
    void onConfirm({
      outcome: outcome.trim(),
      meeting_with_doctor: Boolean(answers.meeting_with_doctor),
      meeting_with_purchase: Boolean(answers.meeting_with_purchase),
      meeting_with_finance: Boolean(answers.meeting_with_finance),
      meeting_with_engineer: Boolean(answers.meeting_with_engineer),
      new_product_introduced: Boolean(answers.new_product_introduced),
      order_received: Boolean(answers.order_received),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={() => !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Complete visit
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Log visit outcomes and answers to finish this visit.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Outcome / Summary notes <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                rows={3}
                disabled={isSaving}
                className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                placeholder="What was discussed? Next steps?"
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-surface-muted/50 p-3.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Mandatory Check-list Questions
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUESTIONS.map((q) => (
                  <YesNoRadios
                    key={q.key}
                    name={q.key}
                    label={q.label}
                    value={answers[q.key]}
                    disabled={isSaving}
                    onChange={(next) =>
                      setAnswers((prev) => ({ ...prev, [q.key]: next }))
                    }
                  />
                ))}
              </div>
            </div>
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
              type="submit"
              disabled={!isValid || isSaving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {isSaving ? "Saving…" : "Complete Visit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
