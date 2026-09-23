"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, RefreshCw, Search, FileSpreadsheet, Eye, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  useGetExpensesQuery,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
} from "@/store/api/workPlannerApiSlice";
import { isWpElevated, readSessionFromStorage } from "@/utils/authStorage";
import { resolvePublicAssetUrl, withFileAccessToken } from "@/lib/env";
import type { WorkPlanExpenseRecord } from "@/types/workPlanner";
import { DownloadExpensesModal } from "./DownloadExpensesModal";
import { DownloadWorkPlansModal } from "./DownloadWorkPlansModal";
import { RejectExpenseModal } from "./RejectExpenseModal";
import { FilePreviewModal, useFilePreview } from "./FilePreviewModal";
import {
  EXPENSE_CATEGORY_LABELS,
  formatCurrency,
  formatPlanDate,
  renderExpenseStatusBadge,
  salesUserLabel,
} from "./workPlanUtils";

type OwnershipScope = "mine" | "team";

export function ExpensesPage() {
  const searchParams = useSearchParams();
  const sessionUser = readSessionFromStorage()?.user;
  const sessionToken = readSessionFromStorage()?.token;
  const elevatedRole = isWpElevated(sessionUser);
  const { previewDoc, previewBlobUrl, previewLoading, openPreview, closePreview, downloadFile } =
    useFilePreview(sessionToken);

  const initialSearch = searchParams.get("search") || searchParams.get("q") || "";
  const initialScope = (searchParams.get("scope") === "team" ? "team" : "mine") as OwnershipScope;
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [ownershipScope, setOwnershipScope] = useState<OwnershipScope>(
    elevatedRole ? initialScope : "mine"
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [workPlanReportOpen, setWorkPlanReportOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ planId: string; expenseId: string } | null>(null);

  const [approveExpenseMut] = useApproveExpenseMutation();
  const [rejectExpenseMut] = useRejectExpenseMutation();

  const queryParams = useMemo(() => {
    const q: Record<string, string | number | undefined> = {
      page: currentPage,
      limit: 20,
    };
    if (statusFilter !== "all") q.status = statusFilter;
    if (dateFrom) q.from = dateFrom;
    if (dateTo) q.to = dateTo;
    if (elevatedRole) {
      q.scope = ownershipScope;
    }
    return q;
  }, [currentPage, statusFilter, dateFrom, dateTo, elevatedRole, ownershipScope]);

  const { data: expensesRes, isLoading: loading, refetch: loadExpenses } = useGetExpensesQuery(queryParams);

  const expenses = expensesRes?.data || [];
  const total = expensesRes?.total || 0;
  const pages = expensesRes?.pages || 0;

  async function handleApproveExpense(planId: string, expenseId: string) {
    try {
      await approveExpenseMut({ planId, expenseId }).unwrap();
      toast.success("Expense approved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve expense";
      toast.error(msg);
    }
  }

  async function handleRejectExpenseConfirm(reason: string) {
    if (!rejectTarget) return;
    try {
      await rejectExpenseMut({
        planId: rejectTarget.planId,
        expenseId: rejectTarget.expenseId,
        rejection_reason: reason,
      }).unwrap();
      toast.success("Expense rejected");
      setRejectTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject expense";
      toast.error(msg);
    }
  }

  const filteredExpenses = expenses.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cat = (EXPENSE_CATEGORY_LABELS[e.category] || e.category || "").toLowerCase();
    const desc = (e.description || "").toLowerCase();
    const userLabel = salesUserLabel(e.sales_user).toLowerCase();
    return cat.includes(q) || desc.includes(q) || userLabel.includes(q);
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Expense Claims Management
          </h1>
          <p className="text-xs text-muted">
            {elevatedRole
              ? ownershipScope === "mine"
                ? "Your own field visit expenses — track submissions and reimbursements"
                : "Team expense claims — review, approve, and audit field claims"
              : "Track and submit your field visit expense claims"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDownloadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Expense Report
          </button>
          <button
            type="button"
            onClick={() => setWorkPlanReportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Work Plan Report
          </button>
        </div>
      </div>

      {/* My Expenses vs Team Expenses (admin / manager) */}
      {elevatedRole && (
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5">
          <button
            type="button"
            onClick={() => {
              setOwnershipScope("mine");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              ownershipScope === "mine"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            My Expenses
          </button>
          <button
            type="button"
            onClick={() => {
              setOwnershipScope("team");
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              ownershipScope === "team"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            Team Expenses
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5">
        {["all", "submitted", "approved", "rejected", "draft"].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => {
              setStatusFilter(st);
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
              statusFilter === st
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search category, description, executive..."
            className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

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
          onClick={loadExpenses}
          disabled={loading}
          className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-muted font-semibold text-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Executive</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 font-right">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    Loading expense claims…
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    No expense claims found.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp, idx) => {
                  const expId = exp._id || exp.id || String(idx);
                  const planId =
                    exp.work_plan_id ||
                    (typeof exp.work_plan === "string"
                      ? exp.work_plan
                      : (exp.work_plan as { _id?: string; id?: string })?._id ||
                        (exp.work_plan as { _id?: string; id?: string })?.id) ||
                    "";
                  const categoryName = EXPENSE_CATEGORY_LABELS[exp.category] || exp.category;

                  return (
                    <tr key={expId} className="hover:bg-surface-muted/50 transition">
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        {formatPlanDate(exp.expense_date)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {salesUserLabel(exp.sales_user)}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {categoryName}
                      </td>
                      <td className="px-4 py-3 text-muted max-w-xs font-sans">
                        <div className="truncate">{exp.description || "—"}</div>
                        {exp.receipt_attachment ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            {(() => {
                              const att = exp.receipt_attachment;
                              const url = typeof att === "object" ? att.url : undefined;
                              const docName =
                                typeof att === "object"
                                  ? att.original_name || att.file_name || "Receipt"
                                  : "Receipt";
                              const mimeType = typeof att === "object" ? att.mime_type || "" : "";
                              const baseUrl = url ? resolvePublicAssetUrl(url) : "#";
                              const fullUrl = withFileAccessToken(baseUrl, sessionToken);
                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openPreview({
                                        name: docName,
                                        url: fullUrl,
                                        mime: mimeType,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
                                    title="Preview receipt document"
                                  >
                                    <Eye className="h-3 w-3" />
                                    {docName}
                                  </button>
                                  <a
                                    href={fullUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-muted hover:text-foreground transition p-0.5"
                                    title="Open in new tab"
                                  >
                                    <Paperclip className="h-3 w-3" />
                                  </a>
                                </>
                              );
                            })()}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-4 py-3">{renderExpenseStatusBadge(exp.status)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {elevatedRole && exp.status === "submitted" && planId ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApproveExpense(planId, expId)}
                              className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectTarget({ planId, expenseId: expId })}
                              className="rounded bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20 transition"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <div className="text-muted">
              Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
              <span className="font-semibold text-foreground">{pages}</span> ({total} items)
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

      {downloadOpen && (
        <DownloadExpensesModal
          open={downloadOpen}
          expenses={filteredExpenses}
          onClose={() => setDownloadOpen(false)}
        />
      )}

      {workPlanReportOpen && (
        <DownloadWorkPlansModal
          open={workPlanReportOpen}
          onClose={() => setWorkPlanReportOpen(false)}
        />
      )}

      {rejectTarget && (
        <RejectExpenseModal
          open={Boolean(rejectTarget)}
          isRejecting={false}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectExpenseConfirm}
        />
      )}

      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
      />
    </div>
  );
}

export default ExpensesPage;
