"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useGetPlansQuery } from "@/store/api/workPlannerApiSlice";
import type { WorkPlanRecord, WorkPlanStatus } from "@/types/workPlanner";
import {
  formatPlanDate,
  planActivityLabel,
  planIdOf,
  planTypeShort,
  salesUserLabel,
} from "./workPlanUtils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const STATUS_DOT: Record<WorkPlanStatus, string> = {
  draft: "bg-muted",
  planned: "bg-blue-500",
  submitted: "bg-primary",
  approved: "bg-emerald-500",
  rejected: "bg-rose-500",
  completed: "bg-emerald-500",
};

const STATUS_CHIP: Record<WorkPlanStatus, string> = {
  draft: "bg-surface-muted text-muted",
  planned: "bg-blue-500/10 text-blue-500",
  submitted: "bg-primary/10 text-primary",
  approved: "bg-emerald-500/10 text-emerald-500",
  rejected: "bg-rose-500/10 text-rose-500",
  completed: "bg-emerald-500/10 text-emerald-500",
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function planDayKey(planDate: unknown): string {
  if (!planDate) return "";
  const d = new Date(String(planDate));
  if (isNaN(d.getTime())) return "";
  return toYmd(d);
}

function buildMonthCells(month: Date) {
  const first = startOfMonth(month);
  const startPad = first.getDay();
  const daysInMonth = endOfMonth(month).getDate();
  const cells: Array<{ date: Date | null; ymd: string | null }> = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ date: null, ymd: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    cells.push({ date, ymd: toYmd(date) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, ymd: null });
  }
  return cells;
}

export function WorkPlanCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);

  const fromYmd = useMemo(() => toYmd(startOfMonth(currentMonth)), [currentMonth]);
  const toYmdVal = useMemo(() => toYmd(endOfMonth(currentMonth)), [currentMonth]);

  const { data: plansRes, isLoading: loading, refetch: loadMonthPlans } = useGetPlansQuery({
    from: fromYmd,
    to: toYmdVal,
    limit: 200,
    include_visits: "true",
    include_works: "true",
  });
  const plans = plansRes?.data || [];

  const monthLabel = useMemo(() => {
    return currentMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }, [currentMonth]);

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const cells = useMemo(() => buildMonthCells(currentMonth), [currentMonth]);

  const plansByDay = useMemo(() => {
    const map = new Map<string, WorkPlanRecord[]>();
    for (const p of plans) {
      const k = planDayKey(p.plan_date);
      if (!k) continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return map;
  }, [plans]);

  const selectedPlans = useMemo(() => {
    if (!selectedYmd) return [];
    return plansByDay.get(selectedYmd) || [];
  }, [selectedYmd, plansByDay]);

  function prevMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  function goToday() {
    const now = new Date();
    setCurrentMonth(startOfMonth(now));
    setSelectedYmd(toYmd(now));
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Calendar Top Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-border p-1.5 hover:bg-surface-muted transition"
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-bold text-foreground min-w-[160px]">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-border p-1.5 hover:bg-surface-muted transition"
            title="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-card transition"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <List className="h-4 w-4 text-muted" />
            List View
          </Link>
          <button
            type="button"
            onClick={loadMonthPlans}
            disabled={loading}
            className="rounded-lg border border-border p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-center text-xs font-bold text-muted">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2.5">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {cells.map((cell, idx) => {
            if (!cell.date || !cell.ymd) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[110px] bg-surface-muted/30"
                />
              );
            }

            const isToday = cell.ymd === todayYmd;
            const isSelected = cell.ymd === selectedYmd;
            const dayPlans = plansByDay.get(cell.ymd) || [];

            return (
              <div
                key={cell.ymd}
                onClick={() => setSelectedYmd(cell.ymd)}
                className={`group relative flex flex-col justify-between min-h-[110px] p-1.5 transition cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 ring-2 ring-inset ring-primary"
                    : "hover:bg-surface-muted"
                } ${isToday ? "bg-amber-500/10" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>

                  {dayPlans.length === 0 ? (
                    <Link
                      href={`/dashboard/plans/new?date=${cell.ymd}`}
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground transition"
                      title="Add plan for this day"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>

                <div className="mt-1 flex-1 space-y-1 overflow-y-auto max-h-[80px]">
                  {dayPlans.map((p) => {
                    const id = planIdOf(p);
                    const typeLabel = planTypeShort(p.plan_type);
                    const actLabel = planActivityLabel(p);
                    const userName = salesUserLabel(p.sales_user);
                    const dotClass = STATUS_DOT[p.status] || STATUS_DOT.draft;
                    const chipClass = STATUS_CHIP[p.status] || STATUS_CHIP.draft;

                    return (
                      <Link
                        key={id}
                        href={`/dashboard/plans/${id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block rounded bg-surface-muted/90 p-1 text-[10px] font-medium text-foreground transition hover:bg-primary/15 border border-border/50 space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-1 overflow-hidden">
                          <span className="truncate font-bold text-foreground" title={userName}>
                            {userName}
                          </span>
                          <span className={`shrink-0 rounded px-1 py-0.2 text-[9px] font-semibold capitalize ${chipClass}`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted truncate">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
                          <span className="truncate">{typeLabel}: {actLabel}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Drawer/Modal */}
      {selectedYmd ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Plans for {formatPlanDate(selectedYmd)}
              </h3>
              <p className="text-xs text-muted">
                {selectedPlans.length} work plan(s) recorded for this day
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/plans/new?date=${selectedYmd}`}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Plan for Day
              </Link>
              <button
                type="button"
                onClick={() => setSelectedYmd(null)}
                className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 divide-y divide-border">
            {selectedPlans.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">
                No work plan scheduled for {formatPlanDate(selectedYmd)}.
              </p>
            ) : (
              selectedPlans.map((p) => {
                const id = planIdOf(p);
                return (
                  <div key={id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {salesUserLabel(p.sales_user)}
                        </span>
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold ${STATUS_CHIP[p.status]}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {p.plan_type || "Visits"} · {planActivityLabel(p)} · {p.location || "No location set"}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/plans/${id}`}
                      className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-primary hover:bg-surface-muted transition"
                    >
                      Open Plan →
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default WorkPlanCalendarPage;
