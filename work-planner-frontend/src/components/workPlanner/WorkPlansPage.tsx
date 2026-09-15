"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Copy, Download, ExternalLink, Plus, RefreshCw, Trash2, Search, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useGetPlansQuery, useDeletePlanMutation } from "@/store/api/workPlannerApiSlice";
import { isManager, readSessionFromStorage } from "@/utils/authStorage";
import type { WorkPlanRecord } from "@/types/workPlanner";
import { ConfirmDeleteWorkPlanModal } from "./ConfirmDeleteWorkPlanModal";
import { DownloadWorkPlansModal } from "./DownloadWorkPlansModal";
import { DownloadExpensesModal } from "./DownloadExpensesModal";
import {
  WORK_PLAN_STATUS_TABS,
  WORK_PLAN_TYPE_TABS,
  canEditPlan,
  formatPlanDate,
  planIdOf,
  renderPlanStatusBadge,
  salesUserLabel,
} from "./workPlanUtils";

export function WorkPlansPage() {
  const searchParams = useSearchParams();

  const user = readSessionFromStorage()?.user;
  const managerRole = isManager(user);

  const initialStatus = searchParams.get("status") || "all";
  const initialPlanType = searchParams.get("plan_type") || "all";
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [planTypeFilter, setPlanTypeFilter] = useState(initialPlanType);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [expenseReportOpen, setExpenseReportOpen] = useState(false);

  const [deletePlanMut] = useDeletePlanMutation();

  const queryParams = useMemo(() => {
    const q: Record<string, string | number | undefined> = {
      page: currentPage,
      limit: itemsPerPage,
    };
    if (statusFilter && statusFilter !== "all") q.status = statusFilter;
    if (planTypeFilter && planTypeFilter !== "all") q.plan_type = planTypeFilter;
    if (dateFrom) q.from = dateFrom;
    if (dateTo) q.to = dateTo;
    return q;
  }, [currentPage, itemsPerPage, statusFilter, planTypeFilter, dateFrom, dateTo]);

  const { data: plansRes, isLoading: loading, refetch: loadData } = useGetPlansQuery(queryParams);

  const plans = plansRes?.data || [];
  const total = plansRes?.total || 0;
  const pages = plansRes?.pages || 0;

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  const filteredPlans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((r) => {
      const sales = salesUserLabel(r.sales_user).toLowerCase();
      const remarks = (r.remarks || "").toLowerCase();
      const location = (r.location || "").toLowerCase();
      const status = (r.status || "").toLowerCase();
      const planType = (r.plan_type || "visits").toLowerCase();
      return (
        sales.includes(q) ||
        remarks.includes(q) ||
        location.includes(q) ||
        status.includes(q) ||
        planType.includes(q)
      );
    });
  }, [plans, searchQuery]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePlanMut(deleteTarget.id).unwrap();
      toast.success("Work plan deleted");
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete plan";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Work Plans Management
          </h1>
          <p className="text-xs text-muted">
            {managerRole
              ? "Oversee team work plans, review visits, and approve claims"
              : "Plan and track daily field visits, tasks, and expense entries"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/plans/calendar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            Calendar View
          </Link>
          <button
            type="button"
            onClick={() => setDownloadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Work Plan Report
          </button>
          <button
            type="button"
            onClick={() => setExpenseReportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Expense Report
          </button>
          <Link
            href="/dashboard/plans/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover shadow-xs transition"
          >
            <Plus className="h-4 w-4" />
            New Work Plan
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5">
        {WORK_PLAN_STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setStatusFilter(tab.id);
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === tab.id
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by executive, location, remarks..."
            className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        <select
          value={planTypeFilter}
          onChange={(e) => {
            setPlanTypeFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
        >
          {WORK_PLAN_TYPE_TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table view */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-muted font-semibold text-muted">
              <tr>
                <th className="px-4 py-3">Plan Date</th>
                <th className="px-4 py-3">Executive</th>
                <th className="px-4 py-3">Plan Type</th>
                <th className="px-4 py-3">Location / City</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    Loading work plans…
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    No work plans found for selected filters.
                  </td>
                </tr>
              ) : (
                filteredPlans.map((r) => {
                  const id = planIdOf(r);
                  const canEdit = canEditPlan(r.status, { isAdmin: managerRole });
                  const visitsCount = r.visit_count ?? (r.visits?.length || 0);
                  const worksCount = r.work_count ?? (r.works?.length || 0);

                  return (
                    <tr key={id} className="hover:bg-surface-muted/50 transition">
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        {formatPlanDate(r.plan_date)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {salesUserLabel(r.sales_user)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                          {r.plan_type || "Visits"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {r.location || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted font-medium">
                        {r.plan_type === "Work From Home" || r.plan_type === "Work From Office"
                          ? `${worksCount} task${worksCount === 1 ? "" : "s"}`
                          : r.plan_type === "Leave"
                          ? "Leave"
                          : `${visitsCount} visit${visitsCount === 1 ? "" : "s"}`}
                      </td>
                      <td className="px-4 py-3">{renderPlanStatusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/plans/${id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <Link
                            href={`/dashboard/plans/new?copy=${id}`}
                            className="rounded p-1 text-muted hover:bg-primary/10 hover:text-primary transition"
                            title="Copy plan"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Link>
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  id,
                                  label: `Plan for ${formatPlanDate(r.plan_date)}`,
                                })
                              }
                              className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                              title="Delete plan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <div className="text-muted">
              Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
              <span className="font-semibold text-foreground">{pages}</span> ({total} total plans)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= pages || loading}
                onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {deleteTarget ? (
        <ConfirmDeleteWorkPlanModal
          planId={deleteTarget.id}
          planLabel={deleteTarget.label}
          isDeleting={isDeleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {downloadOpen ? (
        <DownloadWorkPlansModal
          open={downloadOpen}
          plans={filteredPlans}
          onClose={() => setDownloadOpen(false)}
        />
      ) : null}

      {expenseReportOpen ? (
        <DownloadExpensesModal
          open={expenseReportOpen}
          onClose={() => setExpenseReportOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default WorkPlansPage;
