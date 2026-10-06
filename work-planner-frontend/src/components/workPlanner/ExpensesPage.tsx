"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Download,
  RefreshCw,
  Search,
  FileSpreadsheet,
  Eye,
  Paperclip,
  Users,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetExpensesQuery,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useGetTeamTreeQuery,
  useGetMyTeamQuery,
} from "@/store/api/workPlannerApiSlice";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import { isWpAdmin, isWpElevated, isWpManager, readSessionFromStorage } from "@/utils/authStorage";
import { resolvePublicAssetUrl, withFileAccessToken } from "@/lib/env";
import type {
  WorkPlanExpenseRecord,
  WorkPlanExpenseAttachment,
  AuthorityRemarkItem,
  SeniorRemarkFeedItem,
} from "@/types/workPlanner";
import { DownloadExpensesModal } from "./DownloadExpensesModal";
import { DownloadWorkPlansModal } from "./DownloadWorkPlansModal";
import { RejectExpenseModal } from "./RejectExpenseModal";
import { FilePreviewModal, useFilePreview } from "./FilePreviewModal";
import { SeniorRemarksModal } from "./SeniorRemarksModal";
import { DirectiveThreadModal } from "./DirectiveThreadModal";
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
  const adminRole = isWpAdmin(sessionUser);
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
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [workPlanReportOpen, setWorkPlanReportOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ planId: string; expenseId: string } | null>(null);

  // Senior remarks & directive threads state
  const [threadModalOpen, setThreadModalOpen] = useState(false);
  const [selectedThreadItem, setSelectedThreadItem] = useState<SeniorRemarkFeedItem | null>(null);
  const [seniorRemarksTarget, setSeniorRemarksTarget] = useState<{
    planId: string;
    expenseId: string;
    title: string;
    currentStatus?: string;
    assigneeName?: string;
    remarks?: string;
    history?: AuthorityRemarkItem[];
  } | null>(null);

  const [approveExpenseMut] = useApproveExpenseMutation();
  const [rejectExpenseMut] = useRejectExpenseMutation();

  // Team hierarchy & user data
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !adminRole });
  const { data: tree } = useGetTeamTreeQuery(undefined, { skip: !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: !elevatedRole || adminRole });

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
      if (ownershipScope === "team" && selectedExecutive !== "all") {
        q.sales_user = selectedExecutive;
      }
    }
    return q;
  }, [currentPage, statusFilter, dateFrom, dateTo, elevatedRole, ownershipScope, selectedExecutive]);

  const { data: expensesRes, isLoading: loading, refetch: loadExpenses } = useGetExpensesQuery(queryParams);

  const expenses = expensesRes?.data || [];
  const total = expensesRes?.total || 0;
  const pages = expensesRes?.pages || 0;

  const executiveOptions = useMemo<Array<{ id: string; name: string; email?: string }>>(() => {
    const list: Array<{ id: string; name: string; email?: string }> = [];
    const seen = new Set<string>();

    const addExec = (id?: string, name?: string, email?: string) => {
      if (!id || !name || seen.has(id)) return;
      seen.add(id);
      list.push({ id, name, email });
    };

    if (Array.isArray(usersData)) {
      usersData.forEach((u: any) => addExec(String(u._id || u.id), u.name, u.email));
    }
    if (adminRole && tree) {
      const all: Array<{ _id?: string; id?: string; name: string; email?: string }> = [
        ...(tree.executives || []),
        ...(tree.managers || []),
        ...(tree.coordinators || []),
      ];
      all.forEach((u) => addExec(String(u._id || u.id), u.name, u.email));
    }
    if (myTeamData?.members) {
      (myTeamData.members as Array<{ _id?: string; id?: string; name: string; email?: string }>).forEach((m) =>
        addExec(String(m._id || m.id), m.name, m.email)
      );
    }
    if (Array.isArray(expenses)) {
      expenses.forEach((e: any) => {
        if (e.sales_user && typeof e.sales_user === "object" && e.sales_user.name) {
          addExec(String(e.sales_user._id || e.sales_user.id), e.sales_user.name, e.sales_user.email);
        }
        if (e.created_by && typeof e.created_by === "object" && e.created_by.name) {
          addExec(String(e.created_by._id || e.created_by.id), e.created_by.name, e.created_by.email);
        }
      });
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [adminRole, usersData, tree, myTeamData, expenses]);

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
    const userLabel = salesUserLabel(e.sales_user, executiveOptions).toLowerCase();
    return cat.includes(q) || desc.includes(q) || userLabel.includes(q);
  });

  function buildExpenseThreadItem(exp: WorkPlanExpenseRecord, pId: string): SeniorRemarkFeedItem {
    const authRemarks = Array.isArray(exp.authority_remarks) ? exp.authority_remarks : [];
    const r = authRemarks.length > 0 ? authRemarks[authRemarks.length - 1] : ({} as any);
    const sUserId =
      typeof exp.sales_user === "object" && exp.sales_user
        ? String(exp.sales_user._id || (exp.sales_user as any).id || "")
        : String(exp.sales_user || "");
    const sUserName = salesUserLabel(exp.sales_user, executiveOptions);
    const expId = exp._id || exp.id || "";
    const categoryName = EXPENSE_CATEGORY_LABELS[exp.category] || exp.category;
    const amountStr = exp.amount != null ? `₹${exp.amount}` : "";
    const expTitle = `${categoryName} Claim ${amountStr ? `(${amountStr})` : ""} - ${exp.description || "Expense"}`;

    return {
      id: String(r._id || `${expId}_expense`),
      remark_id: String(r._id || "latest"),
      target_type: "expense",
      plan_id: String(pId || ""),
      target_id: String(expId),
      plan_date: exp.expense_date || undefined,
      title: expTitle,
      location: exp.vendor_name || exp.sub_category || exp.bill_number || "",
      sales_user: {
        _id: sUserId,
        name: sUserName,
        email: typeof exp.sales_user === "object" ? (exp.sales_user as any).email || "" : "",
      },
      senior_user: {
        _id: String(r.user || ""),
        name: r.user_name || "Senior Authority",
        role: r.role || "Senior Authority",
      },
      remark: r.remark || exp.manager_remarks || "",
      remark_type: r.remark_type || "instruction",
      priority: r.priority || "medium",
      expected_followup_date: r.expected_followup_date || null,
      status: r.status || "pending_response",
      followup_remarks: Array.isArray(r.followup_remarks) ? r.followup_remarks : [],
      resolution_remarks: r.resolution_remarks || "",
      resolved_at: r.resolved_at || null,
      resolved_by: r.resolved_by || null,
      resolved_by_name: r.resolved_by_name || "",
      created_at: r.created_at || (exp as any).updatedAt || (exp as any).createdAt || new Date().toISOString(),
    };
  }

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

        {elevatedRole && ownershipScope === "team" && executiveOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted shrink-0" />
            <select
              value={selectedExecutive}
              onChange={(e) => {
                setSelectedExecutive(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="all">All Team Members</option>
              {executiveOptions.map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.name}
                </option>
              ))}
            </select>
          </div>
        )}

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

      {/* Mobile Card List (< md) & Desktop Table (>= md) */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted">
              Loading expense claims…
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No expense claims found.
            </div>
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
              const isBike = exp.category === "Travel" && exp.sub_category === "Private Bike";

              const attList: (WorkPlanExpenseAttachment | string)[] = [];
              if (Array.isArray(exp.attachments) && exp.attachments.length > 0) {
                attList.push(...exp.attachments);
              } else if (exp.receipt_attachment) {
                attList.push(exp.receipt_attachment);
              }

              const authRemarks = Array.isArray(exp.authority_remarks) ? exp.authority_remarks : [];
              const hasSeniorRemarks = authRemarks.length > 0 || Boolean(exp.manager_remarks && exp.manager_remarks.trim());
              const latestRemark = authRemarks.length > 0 ? authRemarks[authRemarks.length - 1] : null;

              return (
                <div key={expId} className="p-4 space-y-2.5 hover:bg-surface-muted/30 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          {categoryName}
                        </span>
                        {exp.sub_category && (
                          <span className="text-[11px] text-muted">
                            • {exp.sub_category}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                        <span>{formatPlanDate(exp.expense_date)}</span>
                        <span>•</span>
                        <span className="font-medium text-foreground">{salesUserLabel(exp.sales_user, executiveOptions)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-foreground">
                        {formatCurrency(exp.amount)}
                      </div>
                      <div className="mt-0.5">{renderExpenseStatusBadge(exp.status)}</div>
                    </div>
                  </div>

                  {/* Bike KM info */}
                  {isBike && exp.start_reading != null && exp.closing_reading != null && (
                    <div className="rounded-lg bg-surface-muted p-2 text-[11px] text-primary font-medium">
                      🏍️ Bike Odometer: {exp.start_reading} → {exp.closing_reading} KM ({Math.max(0, exp.closing_reading - exp.start_reading)} KM @ ₹3.5/km)
                    </div>
                  )}

                  {/* Description */}
                  {exp.description && (
                    <p className="text-xs text-muted leading-relaxed">
                      {exp.description}
                    </p>
                  )}

                  {/* Attachments / Receipts */}
                  {attList.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {attList.map((att, attIdx) => {
                        const attObj = typeof att === "object" && att !== null ? (att as any) : null;
                        const rawUrl =
                          attObj
                            ? attObj.url || (attObj._id ? `/api/work-planner/attachments/${attObj._id}/view` : "") || (attObj.id ? `/api/work-planner/attachments/${attObj.id}/view` : "") || (attObj.storage_path || "")
                            : typeof att === "string"
                            ? att
                            : "";
                        const docName =
                          attObj
                            ? attObj.original_name || attObj.file_name || `Receipt #${attIdx + 1}`
                            : `Receipt #${attIdx + 1}`;
                        const mimeType = attObj ? attObj.mime_type || "" : "";
                        const baseUrl = rawUrl ? resolvePublicAssetUrl(rawUrl, sessionToken) : "#";
                        const fullUrl = withFileAccessToken(baseUrl, sessionToken);
                        return (
                          <div key={attIdx} className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openPreview({
                                  name: docName,
                                  url: fullUrl,
                                  mime: mimeType,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              <span>{docName}</span>
                            </button>
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-muted hover:text-foreground"
                            >
                              <Paperclip className="h-3 w-3" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Senior Remarks Directive & Thread */}
                  {hasSeniorRemarks && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          {latestRemark?.remark_type === "appreciation" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                              <Sparkles className="h-2.5 w-2.5" />
                              <span>Appreciation</span>
                            </span>
                          ) : latestRemark?.remark_type === "objection" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              <span>Objection</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              <span>Directive</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const item = buildExpenseThreadItem(exp, planId);
                            setSelectedThreadItem(item);
                            setThreadModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-primary/20 px-2 py-1 text-[11px] font-bold text-primary"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>Thread</span>
                          {(latestRemark?.followup_remarks?.length || 0) > 0 && (
                            <span className="rounded-full bg-primary/30 px-1 text-[9px]">
                              {latestRemark?.followup_remarks?.length}
                            </span>
                          )}
                        </button>
                      </div>

                      {latestRemark?.remark ? (
                        <div
                          className="text-[11px] text-foreground font-medium line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: latestRemark.remark }}
                        />
                      ) : exp.manager_remarks ? (
                        <div
                          className="text-[11px] text-foreground font-medium line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: exp.manager_remarks }}
                        />
                      ) : null}
                    </div>
                  )}

                  {/* Mobile Actions Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                    <div>
                      {planId && !String(planId).startsWith("standalone") ? (
                        <Link
                          href={`/dashboard/plans/${planId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          <span>View Plan</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {elevatedRole && planId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSeniorRemarksTarget({
                              planId,
                              expenseId: expId,
                              title: `${categoryName} Claim (${formatCurrency(exp.amount)})`,
                              currentStatus: exp.status,
                              assigneeName: salesUserLabel(exp.sales_user, executiveOptions),
                              remarks: exp.manager_remarks || "",
                              history: exp.authority_remarks || [],
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Remark</span>
                        </button>
                      )}

                      {elevatedRole && exp.status === "submitted" && planId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApproveExpense(planId, expId)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectTarget({ planId, expenseId: expId })}
                            className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 transition"
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
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
                  const isBike = exp.category === "Travel" && exp.sub_category === "Private Bike";

                  return (
                    <tr key={expId} className="hover:bg-surface-muted/50 transition">
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span>{formatPlanDate(exp.expense_date)}</span>
                          {planId && !String(planId).startsWith("standalone") ? (
                            <Link
                              href={`/dashboard/plans/${planId}`}
                              className="inline-flex items-center gap-1 text-[11px] font-normal text-primary hover:underline"
                              title="View related Work Plan"
                            >
                              <span>View Plan</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {salesUserLabel(exp.sales_user, executiveOptions)}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>{categoryName}</div>
                        {exp.sub_category ? (
                          <div className="text-[11px] text-muted font-normal">
                            {exp.sub_category}
                            {isBike && exp.start_reading != null && exp.closing_reading != null ? (
                              <span className="block text-primary font-medium text-[10px]">
                                {exp.start_reading} → {exp.closing_reading} KM (
                                {Math.max(0, exp.closing_reading - exp.start_reading)} KM @ ₹3.5/km)
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted max-w-xs font-sans">
                        <div className="truncate">{exp.description || "—"}</div>
                        {(() => {
                          const attList: (WorkPlanExpenseAttachment | string)[] = [];
                          if (Array.isArray(exp.attachments) && exp.attachments.length > 0) {
                            attList.push(...exp.attachments);
                          } else if (exp.receipt_attachment) {
                            attList.push(exp.receipt_attachment);
                          }

                          if (attList.length === 0) return null;

                          return (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {attList.map((att, attIdx) => {
                                const attObj = typeof att === "object" && att !== null ? (att as any) : null;
                                const rawUrl =
                                  attObj
                                    ? attObj.url || (attObj._id ? `/api/work-planner/attachments/${attObj._id}/view` : "") || (attObj.id ? `/api/work-planner/attachments/${attObj.id}/view` : "") || (attObj.storage_path || "")
                                    : typeof att === "string"
                                    ? att
                                    : "";
                                const docName =
                                  attObj
                                    ? attObj.original_name || attObj.file_name || `Receipt #${attIdx + 1}`
                                    : `Receipt #${attIdx + 1}`;
                                const mimeType = attObj ? attObj.mime_type || "" : "";
                                const baseUrl = rawUrl ? resolvePublicAssetUrl(rawUrl, sessionToken) : "#";
                                const fullUrl = withFileAccessToken(baseUrl, sessionToken);
                                return (
                                  <div key={attIdx} className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPreview({
                                          name: docName,
                                          url: fullUrl,
                                          mime: mimeType,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                                      title="Preview document"
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
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Senior Remarks Directive & Thread */}
                        {(() => {
                          const authRemarks = Array.isArray(exp.authority_remarks) ? exp.authority_remarks : [];
                          const hasSeniorRemarks = authRemarks.length > 0 || Boolean(exp.manager_remarks && exp.manager_remarks.trim());
                          const latestRemark = authRemarks.length > 0 ? authRemarks[authRemarks.length - 1] : null;

                          if (!hasSeniorRemarks) return null;

                          return (
                            <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2 space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <div className="flex items-center gap-1">
                                  {latestRemark?.remark_type === "appreciation" ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                                      <Sparkles className="h-2.5 w-2.5" />
                                      <span>⭐ Appreciation</span>
                                    </span>
                                  ) : latestRemark?.remark_type === "objection" ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                                      <AlertTriangle className="h-2.5 w-2.5" />
                                      <span>⚠️ Objection</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                      <ShieldCheck className="h-2.5 w-2.5" />
                                      <span>📋 Directive</span>
                                    </span>
                                  )}

                                  {latestRemark && (
                                    <span
                                      className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                        latestRemark.status === "resolved"
                                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                          : latestRemark.status === "responded"
                                          ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                      }`}
                                    >
                                      {latestRemark.status === "resolved"
                                        ? "✅ Resolved"
                                        : latestRemark.status === "responded"
                                        ? "💬 Responded"
                                        : "⏳ Awaiting Reply"}
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const item = buildExpenseThreadItem(exp, planId);
                                    setSelectedThreadItem(item);
                                    setThreadModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/30 transition cursor-pointer"
                                  title="Open Directive Discussion Thread"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  <span>Thread</span>
                                  {(latestRemark?.followup_remarks?.length || 0) > 0 && (
                                    <span className="rounded-full bg-primary/30 px-1 text-[9px]">
                                      {latestRemark?.followup_remarks?.length}
                                    </span>
                                  )}
                                </button>
                              </div>

                              {latestRemark?.remark ? (
                                <div
                                  className="text-[11px] text-foreground font-medium line-clamp-2"
                                  dangerouslySetInnerHTML={{ __html: latestRemark.remark }}
                                />
                              ) : exp.manager_remarks ? (
                                <div
                                  className="text-[11px] text-foreground font-medium line-clamp-2"
                                  dangerouslySetInnerHTML={{ __html: exp.manager_remarks }}
                                />
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-4 py-3">{renderExpenseStatusBadge(exp.status)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {planId && !String(planId).startsWith("standalone") && (
                            <Link
                              href={`/dashboard/plans/${planId}`}
                              className="inline-flex items-center gap-1 rounded border border-border bg-surface-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-muted/80 hover:border-primary/40 transition"
                              title="Open Work Plan Detail"
                            >
                              <ExternalLink className="h-3 w-3 text-muted" />
                              <span>Plan</span>
                            </Link>
                          )}
                          {elevatedRole && planId && (
                            <button
                              type="button"
                              onClick={() => {
                                setSeniorRemarksTarget({
                                  planId,
                                  expenseId: expId,
                                  title: `${categoryName} Claim (${formatCurrency(exp.amount)})`,
                                  currentStatus: exp.status,
                                  assigneeName: salesUserLabel(exp.sales_user, executiveOptions),
                                  remarks: exp.manager_remarks || "",
                                  history: exp.authority_remarks || [],
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                              title="Add Senior Directive / Objection / Appreciation"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              <span>Remark</span>
                            </button>
                          )}
                          {elevatedRole && exp.status === "submitted" && planId ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveExpense(planId, expId)}
                                className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectTarget({ planId, expenseId: expId })}
                                className="rounded bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          ) : !planId && !elevatedRole ? (
                            <span className="text-muted">—</span>
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

      {seniorRemarksTarget && (
        <SeniorRemarksModal
          open={Boolean(seniorRemarksTarget)}
          itemType="expense"
          title={seniorRemarksTarget.title}
          planId={seniorRemarksTarget.planId}
          itemId={seniorRemarksTarget.expenseId}
          currentStatus={seniorRemarksTarget.currentStatus}
          assigneeName={seniorRemarksTarget.assigneeName}
          initialRemarks={seniorRemarksTarget.remarks}
          authorityRemarksHistory={seniorRemarksTarget.history}
          onClose={() => setSeniorRemarksTarget(null)}
          onSuccess={() => {
            loadExpenses();
          }}
        />
      )}

      {threadModalOpen && (
        <DirectiveThreadModal
          open={threadModalOpen}
          item={selectedThreadItem}
          onClose={() => {
            setThreadModalOpen(false);
            setSelectedThreadItem(null);
          }}
          onSuccess={() => {
            loadExpenses();
          }}
        />
      )}
    </div>
  );
}

export default ExpensesPage;
