"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Home,
  IndianRupee,
  MapPin,
  Sun,
  ShieldCheck,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useGetStatsQuery } from "@/store/api/workPlannerApiSlice";
import type { WorkPlannerStats } from "@/types/workPlanner";

type StatCard = {
  key: string;
  label: string;
  value: number | string;
  sub?: string;
  href: string;
  accent: string;
  iconWrap: string;
  iconTone: string;
  Icon: LucideIcon;
};

function formatMoney(n?: number) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export type WorkPlannerStatsWidgetsProps = {
  fromDate?: string;
  toDate?: string;
};

export function WorkPlannerStatsWidgets({ fromDate, toDate }: WorkPlannerStatsWidgetsProps = {}) {
  const queryParams = fromDate && toDate ? { from: fromDate, to: toDate } : undefined;
  const { data, isLoading: loading } = useGetStatsQuery(queryParams);

  const typeCounts = data?.by_plan_type ?? {};
  const planCount = data?.total_plans ?? 0;

  const querySuffix = fromDate && toDate ? `&from=${fromDate}&to=${toDate}` : "";
  const baseQuery = fromDate && toDate ? `?from=${fromDate}&to=${toDate}` : "";

  const cards: StatCard[] = [
    {
      key: "today",
      label: "Total Plans",
      value: planCount,
      sub: `${data?.total_visits ?? 0} visits · ${data?.total_works ?? 0} tasks`,
      href: `/dashboard/plans${baseQuery}`,
      accent: "bg-primary",
      iconWrap: "bg-primary/10",
      iconTone: "text-primary",
      Icon: CalendarDays,
    },
    {
      key: "type-visits",
      label: "Visits",
      value: typeCounts.Visits ?? 0,
      href: `/dashboard/plans?plan_type=Visits${querySuffix}`,
      accent: "bg-cyan-500",
      iconWrap: "bg-cyan-500/10",
      iconTone: "text-cyan-500",
      Icon: MapPin,
    },
    {
      key: "type-leave",
      label: "Leave",
      value: typeCounts.Leave ?? 0,
      href: `/dashboard/plans?plan_type=Leave${querySuffix}`,
      accent: "bg-amber-500",
      iconWrap: "bg-amber-500/10",
      iconTone: "text-amber-500",
      Icon: Sun,
    },
    {
      key: "type-wfh",
      label: "Work From Home",
      value: typeCounts["Work From Home"] ?? 0,
      href: `/dashboard/plans?plan_type=Work From Home${querySuffix}`,
      accent: "bg-purple-500",
      iconWrap: "bg-purple-500/10",
      iconTone: "text-purple-500",
      Icon: Home,
    },
    {
      key: "type-wfo",
      label: "Work From Office",
      value: typeCounts["Work From Office"] ?? 0,
      href: `/dashboard/plans?plan_type=Work From Office${querySuffix}`,
      accent: "bg-teal-500",
      iconWrap: "bg-teal-500/10",
      iconTone: "text-teal-500",
      Icon: Building2,
    },
    {
      key: "planned",
      label: "Planned",
      value: data?.by_status?.planned ?? data?.approved ?? 0,
      href: `/dashboard/plans?status=planned${querySuffix}`,
      accent: "bg-blue-500",
      iconWrap: "bg-blue-500/10",
      iconTone: "text-blue-500",
      Icon: ShieldCheck,
    },
  ];

  const statusCards: StatCard[] = [
    {
      key: "completed",
      label: "Completed",
      value: data?.completed ?? 0,
      href: `/dashboard/plans?status=completed${querySuffix}`,
      accent: "bg-emerald-500",
      iconWrap: "bg-emerald-500/10",
      iconTone: "text-emerald-500",
      Icon: CheckCircle,
    },
  ];

  const expenseCards: StatCard[] = [
    {
      key: "exp-total",
      label: "Total Expenses",
      value: `₹${formatMoney(data?.expense_total)}`,
      href: `/dashboard/expenses${baseQuery}`,
      accent: "bg-teal-500",
      iconWrap: "bg-teal-500/10",
      iconTone: "text-teal-500",
      Icon: IndianRupee,
    },
    {
      key: "exp-pending",
      label: "Pending Expense Approvals",
      value: data?.expense_pending_approval ?? 0,
      href: `/dashboard/expenses?status=submitted${querySuffix}`,
      accent: "bg-primary",
      iconWrap: "bg-primary/10",
      iconTone: "text-primary",
      Icon: ShieldCheck,
    },
    {
      key: "exp-approved",
      label: "Approved Expenses",
      value: data?.expense_approved_count ?? 0,
      href: `/dashboard/expenses?status=approved${querySuffix}`,
      accent: "bg-emerald-500",
      iconWrap: "bg-emerald-500/10",
      iconTone: "text-emerald-500",
      Icon: Wallet,
    },
  ];

  const trend = data?.monthly_trend ?? [];
  const expenseTrend = data?.expense_monthly_trend ?? [];

  return (
    <div className="space-y-3 font-sans w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Work Planner Overview
          </h3>
          <p className="text-xs text-muted">
            Field visits, tasks, leave, and expense claims summary
          </p>
        </div>
        <Link
          href="/dashboard/plans"
          className="text-xs font-semibold text-primary hover:underline"
        >
          View all plans →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 w-full">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className={`group relative overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-xs transition hover:border-primary ${
              loading ? "opacity-70 animate-pulse" : ""
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-0.5 ${card.accent}`} />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-muted">
                  {card.label}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {card.value}
                </div>
                {card.sub ? (
                  <div className="mt-0.5 text-[10px] text-muted">
                    {card.sub}
                  </div>
                ) : null}
              </div>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconWrap}`}
              >
                <card.Icon className={`h-4 w-4 ${card.iconTone}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 w-full">
        {statusCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className={`group relative overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-xs transition hover:border-primary ${
              loading ? "opacity-70 animate-pulse" : ""
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-0.5 ${card.accent}`} />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-muted">
                  {card.label}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {card.value}
                </div>
              </div>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconWrap}`}
              >
                <card.Icon className={`h-4 w-4 ${card.iconTone}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 w-full">
        {expenseCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className={`group relative overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-xs transition hover:border-primary ${
              loading ? "opacity-70 animate-pulse" : ""
            }`}
          >
            <div className={`absolute inset-x-0 top-0 h-0.5 ${card.accent}`} />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-muted">
                  {card.label}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {card.value}
                </div>
              </div>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconWrap}`}
              >
                <card.Icon className={`h-4 w-4 ${card.iconTone}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {trend.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Monthly Plan Trend
          </div>
          <div className="flex flex-wrap gap-2">
            {trend.map((m) => (
              <div
                key={`${m.year}-${m.month}`}
                className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs"
              >
                <span className="font-medium text-foreground">
                  {m.year}-{String(m.month).padStart(2, "0")}
                </span>
                <span className="ml-2 tabular-nums text-muted font-bold">{m.count} plans</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {expenseTrend.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Monthly Approved Expenses
          </div>
          <div className="flex flex-wrap gap-2">
            {expenseTrend.map((m) => (
              <div
                key={`exp-${m.year}-${m.month}`}
                className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs"
              >
                <span className="font-medium text-foreground">
                  {m.year}-{String(m.month).padStart(2, "0")}
                </span>
                <span className="ml-2 tabular-nums text-emerald-500 font-bold">
                  ₹{formatMoney(m.amount)}
                </span>
                <span className="ml-1 text-muted">({m.count} claims)</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
