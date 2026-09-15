"use client";

import { useEffect, useState } from "react";
import { Calendar, Filter } from "lucide-react";
import { formatPlanDate } from "./workPlanUtils";

export type DateFilterPreset = "today" | "7d" | "current_month" | "last_month" | "custom";

export type DateRange = {
  from: string;
  to: string;
  preset: DateFilterPreset;
};

export type DashboardDateFilterProps = {
  onChange: (range: DateRange) => void;
};

export function toYmdString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function calculateDateRange(
  preset: DateFilterPreset,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const now = new Date();

  if (preset === "today") {
    const ymd = toYmdString(now);
    return { from: ymd, to: ymd };
  }

  if (preset === "7d") {
    const to = toYmdString(now);
    const fromDate = new Date(now);
    fromDate.setDate(now.getDate() - 6);
    const from = toYmdString(fromDate);
    return { from, to };
  }

  if (preset === "current_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toYmdString(firstDay), to: toYmdString(lastDay) };
  }

  if (preset === "last_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toYmdString(firstDay), to: toYmdString(lastDay) };
  }

  // Custom
  const defaultYmd = toYmdString(now);
  return {
    from: customFrom || defaultYmd,
    to: customTo || defaultYmd,
  };
}

const PRESETS: Array<{ id: DateFilterPreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "current_month", label: "Current Month" },
  { id: "last_month", label: "Last Month" },
  { id: "custom", label: "Custom Date" },
];

export function DashboardDateFilter({ onChange }: DashboardDateFilterProps) {
  const [preset, setPreset] = useState<DateFilterPreset>("today");
  const todayYmd = toYmdString(new Date());
  const [customFrom, setCustomFrom] = useState(todayYmd);
  const [customTo, setCustomTo] = useState(todayYmd);

  // Trigger onChange when preset or custom dates change
  useEffect(() => {
    const range = calculateDateRange(preset, customFrom, customTo);
    onChange({
      from: range.from,
      to: range.to,
      preset,
    });
  }, [preset, customFrom, customTo, onChange]);

  const activeRange = calculateDateRange(preset, customFrom, customTo);

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs transition space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Filter className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Date Filter
            </h4>
            <p className="text-[11px] text-muted">
              Showing data from{" "}
              <span className="font-semibold text-foreground">
                {formatPlanDate(`${activeRange.from}T00:00:00`)}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-foreground">
                {formatPlanDate(`${activeRange.to}T00:00:00`)}
              </span>
            </p>
          </div>
        </div>

        {/* Custom Date Inputs */}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted text-[11px] font-medium">From:</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted text-[11px] font-medium">To:</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => {
          const isActive = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-surface-muted text-muted hover:bg-surface-muted/80 hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardDateFilter;
