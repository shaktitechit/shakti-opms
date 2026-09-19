"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Download,
  FileSpreadsheet,
  Filter,
  Search,
  RefreshCw,
  Calendar,
  IndianRupee,
  ShieldCheck,
  Wallet,
  Table,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { useLazyGetExpensesQuery } from "@/store/api/workPlannerApiSlice";
import {
  WORK_PLAN_EXPENSE_CATEGORIES,
  WORK_PLAN_EXPENSE_PAYMENT_MODES,
  WORK_PLAN_TRAVEL_SUB_CATEGORIES,
  type WorkPlanExpenseRecord,
} from "@/types/workPlanner";
import {
  formatPlanDate,
  salesUserLabel,
  WORK_PLAN_EXPENSE_STATUS_TABS,
  renderExpenseStatusBadge,
} from "./workPlanUtils";
import { calculateDateRange, type DateFilterPreset, toYmdString } from "./DashboardDateFilter";
import { usePdfCompanyLetterhead } from "./pdfCompanyLetterhead";
import { downloadPdfReport } from "./exportPdfReport";
import { downloadExcelReport } from "./exportExcelReport";
import { readSessionFromStorage } from "@/utils/authStorage";

export type DownloadExpensesModalProps = {
  open: boolean;
  expenses?: WorkPlanExpenseRecord[];
  onClose: () => void;
};

type ReportDatePreset = "all" | DateFilterPreset;

function formatMoney(n?: number) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function DownloadExpensesModal({
  open,
  expenses: initialExpenses = [],
  onClose,
}: DownloadExpensesModalProps) {
  const letterhead = usePdfCompanyLetterhead();
  const [downloading, setDownloading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<WorkPlanExpenseRecord[]>([]);

  // Filter Panel Toggle & States
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [datePreset, setDatePreset] = useState<ReportDatePreset>("all");
  const todayYmd = toYmdString(new Date());
  const [customFrom, setCustomFrom] = useState(todayYmd);
  const [customTo, setCustomTo] = useState(todayYmd);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState("all");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [vendorLocationFilter, setVendorLocationFilter] = useState("");
  const [executiveFilter, setExecutiveFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [fetchExpenses] = useLazyGetExpensesQuery();

  // Fetch report data when modal opens or filter parameters change
  const loadReportData = async () => {
    if (!open) return;
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { limit: 1000 };

      if (datePreset !== "all") {
        const range = calculateDateRange(datePreset as DateFilterPreset, customFrom, customTo);
        params.from = range.from;
        params.to = range.to;
      }
      if (statusFilter !== "all") params.status = statusFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;

      const res = await fetchExpenses(params).unwrap();
      setItems(res.data || []);
    } catch (err) {
      console.error("Failed to fetch expenses report data:", err);
      if (initialExpenses && initialExpenses.length > 0) {
        setItems(initialExpenses);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadReportData();
    }
  }, [open, datePreset, customFrom, customTo, statusFilter, categoryFilter]);

  // Reset All Filters
  const resetFilters = () => {
    setDatePreset("all");
    setCustomFrom(todayYmd);
    setCustomTo(todayYmd);
    setStatusFilter("all");
    setCategoryFilter("all");
    setSubCategoryFilter("all");
    setPaymentModeFilter("all");
    setVendorLocationFilter("");
    setExecutiveFilter("");
    setSearchQuery("");
  };

  // Client-side Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((e) => {
      // Sub-category filter
      if (subCategoryFilter !== "all" && e.sub_category !== subCategoryFilter) return false;

      // Payment Mode filter
      if (paymentModeFilter !== "all" && e.payment_mode !== paymentModeFilter) return false;

      // Vendor / Location filter
      if (
        vendorLocationFilter.trim() &&
        !(e.vendor_name || "").toLowerCase().includes(vendorLocationFilter.trim().toLowerCase())
      ) {
        return false;
      }

      // Sales Executive filter
      const user =
        typeof e.work_plan === "object"
          ? salesUserLabel(e.work_plan.sales_user)
          : typeof e.sales_user === "object"
          ? salesUserLabel(e.sales_user)
          : "";
      if (
        executiveFilter.trim() &&
        !user.toLowerCase().includes(executiveFilter.trim().toLowerCase())
      ) {
        return false;
      }

      // Keyword Search
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const cat = (e.category || "").toLowerCase();
        const sub = (e.sub_category || "").toLowerCase();
        const vendor = (e.vendor_name || "").toLowerCase();
        const bill = (e.bill_number || "").toLowerCase();
        const desc = (e.description || "").toLowerCase();
        const st = (e.status || "").toLowerCase();
        const dt = formatPlanDate(e.expense_date).toLowerCase();
        const amt = String(e.amount || "");
        const match =
          user.toLowerCase().includes(q) ||
          cat.includes(q) ||
          sub.includes(q) ||
          vendor.includes(q) ||
          bill.includes(q) ||
          desc.includes(q) ||
          st.includes(q) ||
          dt.includes(q) ||
          amt.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [
    items,
    subCategoryFilter,
    paymentModeFilter,
    vendorLocationFilter,
    executiveFilter,
    searchQuery,
  ]);

  // Active filters count badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (datePreset !== "all") count++;
    if (statusFilter !== "all") count++;
    if (categoryFilter !== "all") count++;
    if (subCategoryFilter !== "all") count++;
    if (paymentModeFilter !== "all") count++;
    if (vendorLocationFilter.trim()) count++;
    if (executiveFilter.trim()) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    datePreset,
    statusFilter,
    categoryFilter,
    subCategoryFilter,
    paymentModeFilter,
    vendorLocationFilter,
    executiveFilter,
    searchQuery,
  ]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalClaims = filteredItems.length;
    const totalAmount = filteredItems.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const approvedAmount = filteredItems
      .filter((e) => e.status === "approved")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const pendingCount = filteredItems.filter((e) => e.status === "submitted").length;
    return { totalClaims, totalAmount, approvedAmount, pendingCount };
  }, [filteredItems]);

  if (!open) return null;

  function exportCsv() {
    setDownloading(true);
    try {
      const headers = [
        "Row #",
        "Expense Date",
        "Sales Executive",
        "Category",
        "Sub Category",
        "Amount (₹)",
        "Payment Mode",
        "Vendor",
        "Bill No",
        "Bill Date",
        "Start Odometer (KM)",
        "Closing Odometer (KM)",
        "Total Odometer Distance (KM)",
        "Status",
        "Description / Purpose",
      ];
      const rows = filteredItems.map((e, idx) => {
        const user =
          typeof e.work_plan === "object"
            ? salesUserLabel(e.work_plan.sales_user)
            : typeof e.sales_user === "object"
            ? salesUserLabel(e.sales_user)
            : "—";

        const startKm = e.start_reading != null ? e.start_reading : "—";
        const closeKm = e.closing_reading != null ? e.closing_reading : "—";
        const totalKm =
          e.start_reading != null && e.closing_reading != null
            ? Math.max(0, e.closing_reading - e.start_reading)
            : "—";

        return [
          idx + 1,
          formatPlanDate(e.expense_date),
          `"${user.replace(/"/g, '""')}"`,
          e.category,
          e.sub_category || "—",
          e.amount,
          e.payment_mode,
          `"${(e.vendor_name || "").replace(/"/g, '""')}"`,
          `"${(e.bill_number || "").replace(/"/g, '""')}"`,
          e.bill_date ? formatPlanDate(e.bill_date) : "—",
          startKm,
          closeKm,
          totalKm,
          e.status,
          `"${(e.description || "").replace(/"/g, '""')}"`,
        ];
      });

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `work_planner_expenses_master_report_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export CSV failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  async function exportExcel() {
    setDownloadingExcel(true);
    try {
      const columns = [
        { key: "rowNum", label: "#" },
        { key: "expense_date", label: "Date" },
        { key: "sales_user", label: "Executive / Representative" },
        { key: "category", label: "Category" },
        { key: "sub_category", label: "Sub Category" },
        { key: "amount", label: "Amount (₹)" },
        { key: "payment_mode", label: "Payment Mode" },
        { key: "vendor_name", label: "Vendor Name" },
        { key: "bill_number", label: "Bill / Invoice #" },
        { key: "bill_date", label: "Bill Date" },
        { key: "visit_party", label: "Linked Visit / Party" },
        { key: "odometer", label: "Odometer Readings" },
        { key: "status", label: "Status" },
        { key: "description", label: "Description / Purpose" },
      ];

      const rows = filteredItems.map((r, i) => {
        const odo =
          r.start_reading != null || r.closing_reading != null
            ? `${r.start_reading ?? "—"} -> ${r.closing_reading ?? "—"}`
            : "—";
        const visitParty = r.work_plan_visit
          ? typeof r.work_plan_visit === "object"
            ? r.work_plan_visit.party_name || (r.work_plan_visit.party as any)?.party_name || "Visit"
            : "Visit"
          : "—";

        const userName =
          typeof r.work_plan === "object"
            ? salesUserLabel(r.work_plan.sales_user)
            : typeof r.sales_user === "object"
            ? salesUserLabel(r.sales_user)
            : "—";

        return {
          rowNum: i + 1,
          expense_date: formatPlanDate(r.expense_date),
          sales_user: userName,
          category: r.category || "Other",
          sub_category: r.sub_category || "—",
          amount: Number(r.amount) || 0,
          payment_mode: r.payment_mode || "Cash",
          vendor_name: r.vendor_name || "—",
          bill_number: r.bill_number || "—",
          bill_date: formatPlanDate(r.bill_date),
          visit_party: visitParty,
          odometer: odo,
          status: (r.status || "draft").toUpperCase(),
          description: r.description || "—",
        };
      });

      downloadExcelReport({
        filename: `expense_claims_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: "Expense Claims",
        title: "Expense Claims Master Sheet",
        columns,
        rows,
      });
    } catch (err) {
      console.error("Export Excel failed:", err);
    } finally {
      setDownloadingExcel(false);
    }
  }

  async function exportPdf() {
    setDownloadingPdf(true);
    try {
      const rows = filteredItems.map((e, idx) => {
        const user =
          typeof e.work_plan === "object"
            ? salesUserLabel(e.work_plan.sales_user)
            : typeof e.sales_user === "object"
            ? salesUserLabel(e.sales_user)
            : "—";

        const totalKm =
          e.start_reading != null && e.closing_reading != null
            ? `${Math.max(0, e.closing_reading - e.start_reading)} KM`
            : "—";

        return {
          rowNum: idx + 1,
          date: formatPlanDate(e.expense_date),
          executive: user,
          category: (e.category || "").toUpperCase(),
          subCategory: e.sub_category || "—",
          amount: `₹${formatMoney(e.amount)}`,
          paymentMode: (e.payment_mode || "cash").toUpperCase(),
          vendor: e.vendor_name || "—",
          distance: totalKm,
          status: (e.status || "").toUpperCase(),
          description: e.description || "—",
        };
      });

      const user = readSessionFromStorage()?.user;
      const downloadedBy = user?.name ? `${user.name} (${user.email || user.department || "Executive"})` : user?.email || "System User";
      const timestamp = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

      const activeFilterPanel: Array<{ label: string; value: string }> = [
        { label: "Date Filter", value: datePreset === "custom" ? `${customFrom} to ${customTo}` : datePreset.toUpperCase() },
        { label: "Expense Status", value: statusFilter === "all" ? "All Statuses" : statusFilter.toUpperCase() },
        { label: "Category", value: categoryFilter === "all" ? "All Categories" : categoryFilter.toUpperCase() },
        { label: "Sub Category", value: subCategoryFilter === "all" ? "All Sub Categories" : subCategoryFilter },
        { label: "Payment Mode", value: paymentModeFilter === "all" ? "All Payment Modes" : paymentModeFilter.toUpperCase() },
        { label: "Vendor / Location", value: vendorLocationFilter.trim() || "All Vendors" },
        { label: "Executive", value: executiveFilter.trim() || "All Representatives" },
        { label: "Search Query", value: searchQuery.trim() || "None" },
      ];

      await downloadPdfReport({
        letterhead,
        filename: `expenses_report_${new Date().toISOString().slice(0, 10)}.pdf`,
        title: "Work Planner Expenses Master Report",
        subtitle: `Expenses & Claims Summary Sheet`,
        downloadedBy,
        timestamp,
        filterPanel: activeFilterPanel,
        metadata: [
          { label: "Total Claims", value: String(summaryMetrics.totalClaims) },
          { label: "Total Amount", value: `₹${formatMoney(summaryMetrics.totalAmount)}` },
          { label: "Approved Amount", value: `₹${formatMoney(summaryMetrics.approvedAmount)}` },
          { label: "Pending Claims", value: String(summaryMetrics.pendingCount) },
        ],
        columns: [
          { key: "rowNum", label: "#", width: 0.5, align: "left" },
          { key: "date", label: "Date", width: 1.1, align: "left" },
          { key: "executive", label: "Executive", width: 1.6, align: "left" },
          { key: "category", label: "Category", width: 1.2, align: "left" },
          { key: "subCategory", label: "Sub Category", width: 1.2, align: "left" },
          { key: "amount", label: "Amount", width: 1.2, align: "right" },
          { key: "paymentMode", label: "Pay Mode", width: 1.0, align: "center" },
          { key: "vendor", label: "Vendor", width: 1.4, align: "left" },
          { key: "distance", label: "Distance", width: 1.0, align: "right" },
          { key: "status", label: "Status", width: 1.1, align: "center" },
          { key: "description", label: "Description / Purpose", width: 2.0, align: "left" },
        ],
        rows,
      });
    } catch (err) {
      console.error("Export PDF failed:", err);
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full h-full max-w-[98vw] max-h-[96vh] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Google Sheet Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Expense Claims Master Report
                </h2>
                <span className="rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Google Sheet Mode
                </span>
              </div>
              <p className="text-xs text-muted">
                Displaying {filteredItems.length} expense claims entries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilterPanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                showFilterPanel
                  ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                  : "border-border bg-card text-foreground hover:bg-surface-muted"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter Panel
              {activeFiltersCount > 0 && (
                <span className="ml-0.5 rounded-full bg-teal-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={loadReportData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition disabled:opacity-50"
              title="Refresh sheet data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              disabled={downloading || filteredItems.length === 0}
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/30 bg-teal-500/10 px-3.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 disabled:opacity-50 transition shadow-xs"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              disabled={downloadingExcel || filteredItems.length === 0}
              onClick={exportExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/40 bg-teal-600 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 transition shadow-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {downloadingExcel ? "Generating Excel…" : "Export Excel (.xlsx)"}
            </button>
            <button
              type="button"
              disabled={downloadingPdf || filteredItems.length === 0}
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition shadow-xs"
            >
              <Download className="h-4 w-4" />
              {downloadingPdf ? "Generating PDF…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition"
              title="Close report modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Dedicated Expandable Filter Panel */}
        {showFilterPanel && (
          <div className="border-b border-border bg-card p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Expense Filter Panel
                </h4>
                {activeFiltersCount > 0 && (
                  <span className="text-[11px] text-muted">({activeFiltersCount} filters applied)</span>
                )}
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline font-semibold"
              >
                <RotateCcw className="h-3 w-3" /> Reset All Filters
              </button>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* 1. Date Range Preset */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Expense Date Range</label>
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as ReportDatePreset)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="current_month">Current Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* 2. Category Filter */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                >
                  <option value="all">All Categories</option>
                  {WORK_PLAN_EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Sub-Category / Travel Mode */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Sub-Category</label>
                <select
                  value={subCategoryFilter}
                  onChange={(e) => setSubCategoryFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                >
                  <option value="all">All Sub-Categories</option>
                  {WORK_PLAN_TRAVEL_SUB_CATEGORIES.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Payment Mode */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Payment Mode</label>
                <select
                  value={paymentModeFilter}
                  onChange={(e) => setPaymentModeFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                >
                  <option value="all">All Payment Modes</option>
                  {WORK_PLAN_EXPENSE_PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Vendor / Location */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Vendor / Hotel Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hotel Taj, Fuel Station..."
                  value={vendorLocationFilter}
                  onChange={(e) => setVendorLocationFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                />
              </div>

              {/* 6. Expense Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                >
                  {WORK_PLAN_EXPENSE_STATUS_TABS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Dates & Executive Search Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {datePreset === "custom" && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs">
                  <span className="text-muted text-[11px] font-semibold">From Date:</span>
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="bg-transparent text-foreground outline-none text-xs"
                  />
                  <span className="text-muted text-[11px] font-semibold ml-2">To Date:</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="bg-transparent text-foreground outline-none text-xs"
                  />
                </div>
              )}

              <div className="relative min-w-[280px] flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search executive, vendor, bill number, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-teal-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Google Sheet Spreadsheet View */}
        <div className="flex-1 overflow-auto bg-card">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-xs text-muted gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-teal-500" />
              Loading expense claims spreadsheet…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-muted p-6 text-center">
              <Table className="h-10 w-10 text-muted/50 mb-2" />
              <p className="text-sm font-semibold text-foreground">No matching expenses found</p>
              <p className="text-xs text-muted mt-1">Try resetting or broadening your filter options.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-border bg-surface-muted/80 text-[11px] font-bold text-muted uppercase tracking-wider select-none sticky top-0 z-10 shadow-xs">
                  <th className="w-12 border-r border-border px-3 py-2 text-center bg-surface-muted">
                    #
                  </th>
                  <th className="border-r border-border px-3 py-2 w-32">
                    <span className="text-[9px] text-muted/70 block">A</span>
                    Expense Date
                  </th>
                  <th className="border-r border-border px-3 py-2 w-44">
                    <span className="text-[9px] text-muted/70 block">B</span>
                    Sales Executive
                  </th>
                  <th className="border-r border-border px-3 py-2 w-32">
                    <span className="text-[9px] text-muted/70 block">C</span>
                    Category
                  </th>
                  <th className="border-r border-border px-3 py-2 w-36">
                    <span className="text-[9px] text-muted/70 block">D</span>
                    Sub Category
                  </th>
                  <th className="border-r border-border px-3 py-2 w-32 text-right">
                    <span className="text-[9px] text-muted/70 block">E</span>
                    Amount (₹)
                  </th>
                  <th className="border-r border-border px-3 py-2 w-32">
                    <span className="text-[9px] text-muted/70 block">F</span>
                    Payment Mode
                  </th>
                  <th className="border-r border-border px-3 py-2 w-40">
                    <span className="text-[9px] text-muted/70 block">G</span>
                    Vendor Name
                  </th>
                  <th className="border-r border-border px-3 py-2 w-32">
                    <span className="text-[9px] text-muted/70 block">H</span>
                    Bill No
                  </th>
                  <th className="border-r border-border px-3 py-2 w-32 font-mono">
                    <span className="text-[9px] text-muted/70 block">I</span>
                    Odometer (KM)
                  </th>
                  <th className="border-r border-border px-3 py-2 w-36">
                    <span className="text-[9px] text-muted/70 block">J</span>
                    Status
                  </th>
                  <th className="px-3 py-2 min-w-[200px]">
                    <span className="text-[9px] text-muted/70 block">K</span>
                    Description / Purpose
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((e, idx) => {
                  const exec =
                    typeof e.work_plan === "object"
                      ? salesUserLabel(e.work_plan.sales_user)
                      : typeof e.sales_user === "object"
                      ? salesUserLabel(e.sales_user)
                      : "—";

                  const startKm = e.start_reading != null ? e.start_reading : null;
                  const closeKm = e.closing_reading != null ? e.closing_reading : null;
                  const odoText =
                    startKm != null && closeKm != null
                      ? `${startKm.toLocaleString()} → ${closeKm.toLocaleString()} (${(closeKm - startKm).toLocaleString()} KM)`
                      : "—";

                  return (
                    <tr
                      key={e._id || e.id || idx}
                      className="hover:bg-surface-muted/60 transition group"
                    >
                      <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono font-medium bg-surface-muted/30 group-hover:bg-surface-muted">
                        {idx + 1}
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground whitespace-nowrap">
                        {formatPlanDate(e.expense_date)}
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 font-semibold text-foreground whitespace-nowrap">
                        {exec}
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                        <span className="rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 text-[11px] font-bold">
                          {e.category}
                        </span>
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 text-muted whitespace-nowrap">
                        {e.sub_category || "—"}
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 text-right font-bold text-foreground tabular-nums">
                        ₹{formatMoney(e.amount)}
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 text-muted whitespace-nowrap">
                        {e.payment_mode}
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 text-foreground truncate max-w-[160px]">
                        {e.vendor_name || "—"}
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 font-mono text-muted whitespace-nowrap">
                        {e.bill_number || "—"}
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[11px] whitespace-nowrap">
                        {odoText}
                      </td>
                      <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                        {renderExpenseStatusBadge(e.status)}
                      </td>
                      <td className="px-3 py-2 text-muted truncate max-w-[250px]">
                        {e.description || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Spreadsheet Status Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/50 px-5 py-3 text-xs">
          <div className="flex items-center gap-4 text-muted">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Sheet Ready
            </span>
            <span>Total Claims: <strong className="text-foreground">{summaryMetrics.totalClaims}</strong></span>
            <span>Total Amount: <strong className="text-foreground">₹{formatMoney(summaryMetrics.totalAmount)}</strong></span>
            <span>Approved Amount: <strong className="text-emerald-600 dark:text-emerald-400">₹{formatMoney(summaryMetrics.approvedAmount)}</strong></span>
            <span>Pending Approvals: <strong className="text-amber-600 dark:text-amber-400">{summaryMetrics.pendingCount}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-card border border-border px-2.5 py-1 text-[11px] font-bold text-muted">
              Sheet1: Expense Claims
            </span>
            <button
              type="button"
              disabled={downloading || filteredItems.length === 0}
              onClick={exportCsv}
              className="inline-flex items-center gap-1 rounded bg-surface-muted border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-card disabled:opacity-50 transition"
            >
              <Download className="h-3.5 w-3.5 text-muted" />
              Export CSV
            </button>
            <button
              type="button"
              disabled={downloadingExcel || filteredItems.length === 0}
              onClick={exportExcel}
              className="inline-flex items-center gap-1 rounded bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DownloadExpensesModal;
