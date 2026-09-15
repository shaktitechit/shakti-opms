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
  Layers,
  ShieldCheck,
  Building2,
  Table,
  CheckCircle,
  Clock,
  MapPin,
  UserCheck,
  Phone,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  CornerDownRight,
} from "lucide-react";
import { useLazyGetPlansQuery } from "@/store/api/workPlannerApiSlice";
import type { WorkPlanRecord, WorkPlanVisitRecord, WorkPlanWorkRecord } from "@/types/workPlanner";
import {
  formatPlanDate,
  salesUserLabel,
  renderPlanStatusBadge,
  WORK_PLAN_STATUS_TABS,
  WORK_PLAN_TYPE_TABS,
  formatTime,
  renderVisitStatusBadge,
} from "./workPlanUtils";
import { calculateDateRange, type DateFilterPreset, toYmdString } from "./DashboardDateFilter";
import { usePdfCompanyLetterhead } from "./pdfCompanyLetterhead";
import { downloadPdfReport } from "./exportPdfReport";
import { readSessionFromStorage } from "@/utils/authStorage";

export type DownloadWorkPlansModalProps = {
  open: boolean;
  plans?: WorkPlanRecord[];
  onClose: () => void;
};

type ReportDatePreset = "all" | DateFilterPreset;
type ActivityTypeFilter = "all" | "visits" | "tasks";

export function DownloadWorkPlansModal({
  open,
  plans: initialPlans = [],
  onClose,
}: DownloadWorkPlansModalProps) {
  const letterhead = usePdfCompanyLetterhead();
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<WorkPlanRecord[]>([]);

  // Filter Panel Toggle & States
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [datePreset, setDatePreset] = useState<ReportDatePreset>("all");
  const todayYmd = toYmdString(new Date());
  const [customFrom, setCustomFrom] = useState(todayYmd);
  const [customTo, setCustomTo] = useState(todayYmd);
  const [planTypeFilter, setPlanTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [partyTitleFilter, setPartyTitleFilter] = useState("");
  const [contactDetailsFilter, setContactDetailsFilter] = useState("");
  const [locationCityFilter, setLocationCityFilter] = useState("");
  const [executiveFilter, setExecutiveFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "flat">("tree");

  // Expand / Collapse state for Parent Work Plans (Map of planId -> boolean)
  const [collapsedPlanIds, setCollapsedPlanIds] = useState<Record<string, boolean>>({});
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [fetchPlans] = useLazyGetPlansQuery();

  // Fetch report data including detailed visits & works with multi-page loop
  const loadReportData = async () => {
    if (!open) return;
    setLoading(true);
    try {
      let page = 1;
      let totalPages = 1;
      let accumulatedPlans: WorkPlanRecord[] = [];

      do {
        const params: Record<string, string | number | boolean | undefined> = {
          page,
          limit: 200,
          include_visits: "true",
          include_works: "true",
        };

        if (datePreset !== "all") {
          const range = calculateDateRange(datePreset as DateFilterPreset, customFrom, customTo);
          params.from = range.from;
          params.to = range.to;
        }
        if (statusFilter !== "all") params.status = statusFilter;
        if (planTypeFilter !== "all") params.plan_type = planTypeFilter;

        const res = await fetchPlans(params).unwrap();
        const data = res.data || [];
        accumulatedPlans = accumulatedPlans.concat(data);
        totalPages = res.pages || 1;
        page++;
      } while (page <= totalPages && page <= 20);

      setPlans(accumulatedPlans);
    } catch (err) {
      console.error("Failed to fetch work plans report data:", err);
      if (initialPlans && initialPlans.length > 0) {
        setPlans(initialPlans);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadReportData();
    }
  }, [open, datePreset, customFrom, customTo, statusFilter, planTypeFilter]);

  // Reset Filters Handler
  const resetFilters = () => {
    setDatePreset("all");
    setCustomFrom(todayYmd);
    setCustomTo(todayYmd);
    setPlanTypeFilter("all");
    setStatusFilter("all");
    setPartyTitleFilter("");
    setContactDetailsFilter("");
    setLocationCityFilter("");
    setExecutiveFilter("");
    setSearchQuery("");
  };

  // Toggle Collapse Single Plan
  const togglePlanCollapse = (planId: string) => {
    setCollapsedPlanIds((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  // Toggle Collapse All
  const toggleCollapseAll = () => {
    const nextState = !allCollapsed;
    setAllCollapsed(nextState);
    const newCollapsedMap: Record<string, boolean> = {};
    plans.forEach((p) => {
      const id = p._id || p.id || "";
      if (id) newCollapsedMap[id] = nextState;
    });
    setCollapsedPlanIds(newCollapsedMap);
  };

  // Processed Parent Plans with their Child Visits and Tasks
  const filteredPlanTree = useMemo(() => {
    return plans
      .map((plan) => {
        const planId = plan._id || plan.id || "";
        const planDate = plan.plan_date || "";
        const salesUser = plan.sales_user;
        const planType = plan.plan_type || "Visits";
        const planStatus = plan.status || "planned";
        const planLocation = plan.location || "";
        const planRemarks = plan.remarks || "";

        const partyTitleQuery = partyTitleFilter.trim().toLowerCase();
        const contactQuery = contactDetailsFilter.trim().toLowerCase();

        // Check Location / City Filter
        if (
          locationCityFilter.trim() &&
          !planLocation.toLowerCase().includes(locationCityFilter.trim().toLowerCase())
        ) {
          return null;
        }

        // Check Executive Filter
        if (
          executiveFilter.trim() &&
          !salesUserLabel(salesUser).toLowerCase().includes(executiveFilter.trim().toLowerCase())
        ) {
          return null;
        }

        // Process Child Visits
        const rawVisits: WorkPlanVisitRecord[] = plan.visits || [];
        const childVisits = rawVisits
          .map((v, vIdx) => {
            const partyObj = typeof v.party === "object" && v.party !== null ? (v.party as Record<string, unknown>) : null;
            const partyName = v.party_name || (partyObj?.party_name as string) || "Visit";
            const contactPerson = v.contact_person || (partyObj?.contact_person as string) || "";
            const contactMobile = v.contact_number || (partyObj?.mobile as string) || "";
            const contactInfo = [contactPerson, contactMobile].filter(Boolean).join(" · ") || "—";
            const billingAddr = partyObj?.billing_address as { city?: string } | undefined;
            const address = v.address || billingAddr?.city || planLocation;

            const startTime = v.planned_start_time ? formatTime(v.planned_start_time) : "";
            const endTime = v.planned_end_time ? formatTime(v.planned_end_time) : "";
            const plannedTime = startTime || endTime ? `${startTime} - ${endTime}` : "Not set";

            const checkInTime = v.actual_check_in ? formatTime(v.actual_check_in) : "";
            const checkOutTime = v.actual_check_out ? formatTime(v.actual_check_out) : "";
            const actualTime = checkInTime || checkOutTime ? `In: ${checkInTime} / Out: ${checkOutTime}` : "—";

            // Checklist indicators
            const checklist = [];
            if (v.meeting_with_doctor) checklist.push("Doctor: Yes");
            if (v.meeting_with_purchase) checklist.push("Purchase: Yes");
            if (v.meeting_with_finance) checklist.push("Finance: Yes");
            if (v.meeting_with_engineer) checklist.push("Engineer: Yes");
            if (v.new_product_introduced) checklist.push("New Product: Yes");
            if (v.order_received) checklist.push("Order Received: Yes");
            const checklistNotes = checklist.length > 0 ? checklist.join(" | ") : "—";

            return {
              id: v._id || v.id || `v-${planId}-${vIdx}`,
              sequence: v.sequence ?? vIdx + 1,
              partyName,
              contactInfo,
              address: address || "—",
              plannedTime,
              actualTime,
              status: v.status || "pending",
              outcome: v.outcome || "—",
              checklistNotes,
              purpose: v.purpose || "Field Visit",
            };
          })
          .filter((v) => {
            if (partyTitleQuery && !v.partyName.toLowerCase().includes(partyTitleQuery)) {
              return false;
            }
            if (
              contactQuery &&
              !v.contactInfo.toLowerCase().includes(contactQuery) &&
              !v.address.toLowerCase().includes(contactQuery)
            ) {
              return false;
            }
            return true;
          });

        // Process Child Work Tasks
        const rawWorks: WorkPlanWorkRecord[] = plan.works || [];
        const childTasks = rawWorks
          .map((w, wIdx) => {
            const startTime = w.planned_start_time ? formatTime(w.planned_start_time) : "";
            const endTime = w.planned_end_time ? formatTime(w.planned_end_time) : "";
            const plannedTime = startTime || endTime ? `${startTime} - ${endTime}` : "Not set";

            return {
              id: w._id || w.id || `w-${planId}-${wIdx}`,
              sequence: w.sequence ?? wIdx + 1,
              title: w.title || `Task #${wIdx + 1}`,
              description: w.description || "Work Task",
              plannedTime,
              status: w.status || "pending",
              remarks: w.completion_remarks || w.outcome || "—",
            };
          })
          .filter((w) => {
            if (partyTitleQuery && !w.title.toLowerCase().includes(partyTitleQuery)) {
              return false;
            }
            if (
              contactQuery &&
              !w.description.toLowerCase().includes(contactQuery) &&
              !w.remarks.toLowerCase().includes(contactQuery)
            ) {
              return false;
            }
            return true;
          });

        // If partyTitleQuery or contactQuery is active and plan has no matching child visits/tasks, check parent
        if ((partyTitleQuery || contactQuery) && childVisits.length === 0 && childTasks.length === 0) {
          return null;
        }

        // Global Search Filter matching Parent or Child fields
        const q = searchQuery.trim().toLowerCase();
        let matchesSearch = true;
        if (q) {
          const userStr = salesUserLabel(salesUser).toLowerCase();
          const locStr = planLocation.toLowerCase();
          const remStr = planRemarks.toLowerCase();
          const dtStr = formatPlanDate(planDate).toLowerCase();
          const typeStr = planType.toLowerCase();

          const parentMatch =
            userStr.includes(q) ||
            locStr.includes(q) ||
            remStr.includes(q) ||
            dtStr.includes(q) ||
            typeStr.includes(q);

          const visitMatch = childVisits.some(
            (v) =>
              v.partyName.toLowerCase().includes(q) ||
              v.contactInfo.toLowerCase().includes(q) ||
              v.address.toLowerCase().includes(q) ||
              v.outcome.toLowerCase().includes(q) ||
              v.checklistNotes.toLowerCase().includes(q)
          );

          const taskMatch = childTasks.some(
            (w) =>
              w.title.toLowerCase().includes(q) ||
              w.description.toLowerCase().includes(q) ||
              w.remarks.toLowerCase().includes(q)
          );

          matchesSearch = parentMatch || visitMatch || taskMatch;
        }

        if (!matchesSearch) return null;

        return {
          planId,
          planDate,
          salesUser,
          planType,
          planStatus,
          planLocation,
          planRemarks,
          childVisits,
          childTasks,
          totalVisits: plan.visit_count ?? (plan.visits?.length || 0),
          totalTasks: plan.work_count ?? (plan.works?.length || 0),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [
    plans,
    locationCityFilter,
    executiveFilter,
    partyTitleFilter,
    contactDetailsFilter,
    searchQuery,
  ]);

  // Overall Metrics Summary
  const summaryMetrics = useMemo(() => {
    const totalPlans = filteredPlanTree.length;
    const totalVisits = filteredPlanTree.reduce(
      (sum, p) => sum + p.childVisits.length,
      0
    );
    const totalTasks = filteredPlanTree.reduce(
      (sum, p) => sum + p.childTasks.length,
      0
    );
    const completedPlans = filteredPlanTree.filter((p) => p.planStatus === "completed").length;
    return { totalPlans, totalVisits, totalTasks, completedPlans };
  }, [filteredPlanTree]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (datePreset !== "all") count++;
    if (planTypeFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    if (partyTitleFilter.trim()) count++;
    if (contactDetailsFilter.trim()) count++;
    if (locationCityFilter.trim()) count++;
    if (executiveFilter.trim()) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    datePreset,
    planTypeFilter,
    statusFilter,
    partyTitleFilter,
    contactDetailsFilter,
    locationCityFilter,
    executiveFilter,
    searchQuery,
  ]);

  if (!open) return null;

  // Export Hierarchical Parent-Child CSV
  function exportCsv() {
    setDownloading(true);
    try {
      const headers = [
        "Row Index",
        "Record Level",
        "Plan Date",
        "Sales Executive",
        "Plan Type / Activity",
        "Party Name / Task Title",
        "Contact / Description",
        "Location / City",
        "Planned Time",
        "Actual Check-In/Out",
        "Status",
        "Outcome / Completion Remarks",
        "Doctor/Purchase Meeting Checklist",
      ];

      const rows: Array<Array<string | number>> = [];

      filteredPlanTree.forEach((p, pIdx) => {
        const parentRowIndex = pIdx + 1;
        const execName = salesUserLabel(p.salesUser);

        // 1. Parent Work Plan Row
        rows.push([
          parentRowIndex,
          "PARENT WORK PLAN",
          formatPlanDate(p.planDate),
          `"${execName.replace(/"/g, '""')}"`,
          p.planType,
          `"${p.planType} Plan (${p.totalVisits} Visits, ${p.totalTasks} Tasks)"`,
          `"${(p.planRemarks || "").replace(/"/g, '""')}"`,
          `"${(p.planLocation || "").replace(/"/g, '""')}"`,
          "Full Day",
          "—",
          p.planStatus,
          `"${(p.planRemarks || "").replace(/"/g, '""')}"`,
          "N/A",
        ]);

        // 2. Child Visits Rows
        p.childVisits.forEach((v, vIdx) => {
          rows.push([
            `${parentRowIndex}.${vIdx + 1}`,
            "CHILD VISIT",
            formatPlanDate(p.planDate),
            `"${execName.replace(/"/g, '""')}"`,
            "Field Visit",
            `"${v.partyName.replace(/"/g, '""')}"`,
            `"${v.contactInfo.replace(/"/g, '""')}"`,
            `"${v.address.replace(/"/g, '""')}"`,
            `"${v.plannedTime.replace(/"/g, '""')}"`,
            `"${v.actualTime.replace(/"/g, '""')}"`,
            v.status,
            `"${v.outcome.replace(/"/g, '""')}"`,
            `"${v.checklistNotes.replace(/"/g, '""')}"`,
          ]);
        });

        // 3. Child Work Tasks Rows
        p.childTasks.forEach((w, wIdx) => {
          rows.push([
            `${parentRowIndex}.${p.childVisits.length + wIdx + 1}`,
            "CHILD TASK",
            formatPlanDate(p.planDate),
            `"${execName.replace(/"/g, '""')}"`,
            "Work Task",
            `"${w.title.replace(/"/g, '""')}"`,
            `"${w.description.replace(/"/g, '""')}"`,
            `"${(p.planLocation || "Office / Remote").replace(/"/g, '""')}"`,
            `"${w.plannedTime.replace(/"/g, '""')}"`,
            w.status === "completed" ? "Completed" : "—",
            w.status,
            `"${w.remarks.replace(/"/g, '""')}"`,
            "N/A",
          ]);
        });
      });

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `work_plans_hierarchy_report_${new Date().toISOString().slice(0, 10)}.csv`
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

  async function exportPdf() {
    setDownloadingPdf(true);
    try {
      const rows: Array<Record<string, string | number | null | undefined>> = [];
      let parentRowIndex = 0;

      filteredPlanTree.forEach((p) => {
        parentRowIndex += 1;
        const execName = salesUserLabel(p.salesUser);

        // 1. Parent Plan Row
        rows.push({
          _rowType: "PARENT PLAN",
          hierarchyId: `${parentRowIndex}`,
          rowType: "PARENT PLAN",
          date: formatPlanDate(p.planDate),
          executive: execName,
          activity: p.planType === "Visits" ? `Visits Plan (${p.childVisits.length} Visits)` : `Tasks Plan (${p.childTasks.length} Tasks)`,
          details: p.planRemarks || "—",
          plannedTime: "Full Day",
          status: p.planStatus.toUpperCase(),
          remarks: p.planRemarks || "—",
        });

        // 2. Child Visits Rows
        p.childVisits.forEach((v, vIdx) => {
          rows.push({
            _rowType: "CHILD VISIT",
            hierarchyId: `${parentRowIndex}.${vIdx + 1}`,
            rowType: "CHILD VISIT",
            date: formatPlanDate(p.planDate),
            executive: execName,
            activity: `Field Visit: ${v.partyName}`,
            details: `${v.contactInfo ? v.contactInfo + " | " : ""}${v.address}`,
            plannedTime: v.plannedTime || "—",
            status: v.status.toUpperCase(),
            remarks: `${v.outcome ? "Outcome: " + v.outcome : ""}${v.checklistNotes ? " Notes: " + v.checklistNotes : ""}` || "—",
          });
        });

        // 3. Child Work Tasks Rows
        p.childTasks.forEach((w, wIdx) => {
          rows.push({
            _rowType: "CHILD TASK",
            hierarchyId: `${parentRowIndex}.${p.childVisits.length + wIdx + 1}`,
            rowType: "CHILD TASK",
            date: formatPlanDate(p.planDate),
            executive: execName,
            activity: `Work Task: ${w.title}`,
            details: w.description || "—",
            plannedTime: w.plannedTime || "—",
            status: w.status.toUpperCase(),
            remarks: w.remarks || "—",
          });
        });
      });

      const user = readSessionFromStorage()?.user;
      const downloadedBy = user?.name ? `${user.name} (${user.email || user.department || "Executive"})` : user?.email || "System User";
      const timestamp = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

      const activeFilterPanel: Array<{ label: string; value: string }> = [
        { label: "Date Filter", value: datePreset === "custom" ? `${customFrom} to ${customTo}` : datePreset.toUpperCase() },
        { label: "Plan Type", value: planTypeFilter === "all" ? "All Types" : planTypeFilter },
        { label: "Plan Status", value: statusFilter === "all" ? "All Statuses" : statusFilter.toUpperCase() },
        { label: "Party / Task Title", value: partyTitleFilter.trim() || "All" },
        { label: "Contact / Address", value: contactDetailsFilter.trim() || "All" },
        { label: "Location / City", value: locationCityFilter.trim() || "All Locations" },
        { label: "Executive", value: executiveFilter.trim() || "All Representatives" },
        { label: "Search Query", value: searchQuery.trim() || "None" },
      ];

      await downloadPdfReport({
        letterhead,
        filename: `work_plans_report_${new Date().toISOString().slice(0, 10)}.pdf`,
        title: "Work Plans Master Report",
        subtitle: `Parent Work Plans & Child Visits/Tasks Master Sheet`,
        downloadedBy,
        timestamp,
        filterPanel: activeFilterPanel,
        metadata: [
          { label: "Total Parent Plans", value: String(summaryMetrics.totalPlans) },
          { label: "Child Visits", value: String(summaryMetrics.totalVisits) },
          { label: "Child Tasks", value: String(summaryMetrics.totalTasks) },
        ],
        columns: [
          { key: "hierarchyId", label: "#", width: 0.6, align: "left" },
          { key: "rowType", label: "Type", width: 1.1, align: "left" },
          { key: "date", label: "Date", width: 1.0, align: "left" },
          { key: "executive", label: "Sales Executive", width: 1.5, align: "left" },
          { key: "activity", label: "Activity / Title / Party", width: 2.2, align: "left" },
          { key: "details", label: "Details / Address", width: 2.0, align: "left" },
          { key: "plannedTime", label: "Planned", width: 0.9, align: "center" },
          { key: "status", label: "Status", width: 1.0, align: "center" },
          { key: "remarks", label: "Remarks / Outcome", width: 1.7, align: "left" },
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Work Plans Master Report (Parent Plan & Child Visits/Tasks View)
                </h2>
                <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Google Sheet Tree Mode
                </span>
              </div>
              <p className="text-xs text-muted">
                Displaying {summaryMetrics.totalPlans} Parent Work Plans with {summaryMetrics.totalVisits} Child Visits and {summaryMetrics.totalTasks} Child Tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === "tree"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Tree View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("flat")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === "flat"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Table className="h-3.5 w-3.5" />
                Flat List View
              </button>
            </div>

            {viewMode === "tree" && (
              <button
                type="button"
                onClick={toggleCollapseAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
              >
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                {allCollapsed ? "Expand All" : "Collapse All"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFilterPanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                showFilterPanel
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-surface-muted"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter Panel
              {activeFiltersCount > 0 && (
                <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-bold text-primary-foreground">
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
              disabled={downloading || filteredPlanTree.length === 0}
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition shadow-xs"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              disabled={downloadingPdf || filteredPlanTree.length === 0}
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
                <Filter className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Work Plan & Child Activity Filter Panel
                </h4>
                {activeFiltersCount > 0 && (
                  <span className="text-[11px] text-muted">({activeFiltersCount} active filters)</span>
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

            {/* Filter Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* 1. Plan Date Range */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Plan Date</label>
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as ReportDatePreset)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="current_month">Current Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* 2. Plan Type */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Plan Type</label>
                <select
                  value={planTypeFilter}
                  onChange={(e) => setPlanTypeFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Plan Types</option>
                  <option value="Visits">Visits</option>
                  <option value="Leave">Leave</option>
                  <option value="Work From Home">Work From Home</option>
                  <option value="Work From Office">Work From Office</option>
                </select>
              </div>

              {/* 3. Location / City */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Location / City</label>
                <input
                  type="text"
                  placeholder="e.g. Indore, Bhopal..."
                  value={locationCityFilter}
                  onChange={(e) => setLocationCityFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* 4. Party & Task Title Search */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Party Name & Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Fortis, AIIMS, Product Demo..."
                  value={partyTitleFilter}
                  onChange={(e) => setPartyTitleFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* 5. Contact Details & Address Search */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Contact Details & Address</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Verma, 98260..., Ring Road..."
                  value={contactDetailsFilter}
                  onChange={(e) => setContactDetailsFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* 6. Overall Plan Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted">Overall Plan Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Plan Statuses</option>
                  <option value="planned">Planned</option>
                  <option value="submitted">Submitted (Pending Approval)</option>
                  <option value="approved">Approved</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Custom Dates & Search Row */}
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
                  placeholder="Search executive, party name, contact, task, outcome, remarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Parent Work Plan + Child Visits / Tasks Google Sheet Table */}
        <div className="flex-1 overflow-auto bg-card">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-xs text-muted gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              Loading work plans & child items…
            </div>
          ) : filteredPlanTree.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-muted p-6 text-center">
              <Table className="h-10 w-10 text-muted/50 mb-2" />
              <p className="text-sm font-semibold text-foreground">No matching work plans found</p>
              <p className="text-xs text-muted mt-1">Try resetting or broadening your filters.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-border bg-surface-muted/90 text-[11px] font-bold text-muted uppercase tracking-wider select-none sticky top-0 z-10 shadow-xs">
                  <th className="w-14 border-r border-border px-3 py-2 text-center bg-surface-muted">
                    #
                  </th>
                  <th className="border-r border-border px-3 py-2 w-36">
                    <span className="text-[9px] text-muted/70 block">A</span>
                    Plan Date
                  </th>
                  <th className="border-r border-border px-3 py-2 w-44">
                    <span className="text-[9px] text-muted/70 block">B</span>
                    Sales Executive
                  </th>
                  <th className="border-r border-border px-3 py-2 w-32">
                    <span className="text-[9px] text-muted/70 block">C</span>
                    Plan / Activity
                  </th>
                  <th className="border-r border-border px-3 py-2 w-52">
                    <span className="text-[9px] text-muted/70 block">D</span>
                    Party / Task Title
                  </th>
                  <th className="border-r border-border px-3 py-2 w-48">
                    <span className="text-[9px] text-muted/70 block">E</span>
                    Contact / Details
                  </th>
                  <th className="border-r border-border px-3 py-2 w-44">
                    <span className="text-[9px] text-muted/70 block">F</span>
                    Location / City
                  </th>
                  <th className="border-r border-border px-3 py-2 w-36">
                    <span className="text-[9px] text-muted/70 block">G</span>
                    Time / Check-in
                  </th>
                  <th className="border-r border-border px-3 py-2 w-36">
                    <span className="text-[9px] text-muted/70 block">H</span>
                    Status
                  </th>
                  <th className="border-r border-border px-3 py-2 min-w-[200px]">
                    <span className="text-[9px] text-muted/70 block">I</span>
                    Outcome / Remarks
                  </th>
                  <th className="px-3 py-2 min-w-[180px]">
                    <span className="text-[9px] text-muted/70 block">J</span>
                    Meeting Checklist
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {viewMode === "tree" ? (
                  filteredPlanTree.map((p, pIdx) => {
                    const parentId = p.planId || `p-${pIdx}`;
                    const isCollapsed = Boolean(collapsedPlanIds[parentId]);
                    const parentRowIndex = pIdx + 1;
                    const totalChildren = p.childVisits.length + p.childTasks.length;

                    return (
                      <tbody key={parentId} className="contents">
                        {/* PARENT WORK PLAN ROW */}
                        <tr className="border-t-2 border-b border-border bg-surface-muted/90 font-semibold text-foreground hover:bg-surface-muted transition select-none">
                          {/* 0. Index & Toggle */}
                          <td className="border-r border-border px-3 py-2.5 text-center font-mono font-bold bg-surface-muted/60">
                            <button
                              type="button"
                              onClick={() => togglePlanCollapse(parentId)}
                              className="flex items-center justify-center gap-1 w-full text-foreground hover:text-primary"
                              title={isCollapsed ? "Expand child visits & tasks" : "Collapse child visits & tasks"}
                            >
                              {totalChildren > 0 ? (
                                isCollapsed ? (
                                  <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                                )
                              ) : null}
                              <span>{parentRowIndex}</span>
                            </button>
                          </td>

                          {/* 1. Plan Date */}
                          <td className="border-r border-border px-3 py-2.5 font-bold text-foreground whitespace-nowrap">
                            {formatPlanDate(p.planDate)}
                          </td>

                          {/* 2. Sales Executive */}
                          <td className="border-r border-border px-3 py-2.5 font-bold text-foreground whitespace-nowrap">
                            {salesUserLabel(p.salesUser)}
                          </td>

                          {/* 3. Plan Type */}
                          <td className="border-r border-border px-3 py-2.5 whitespace-nowrap">
                            <span className="rounded bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-bold">
                              {p.planType} Plan
                            </span>
                          </td>

                          {/* 4. Summary Title */}
                          <td className="border-r border-border px-3 py-2.5 font-bold text-foreground truncate max-w-[200px]">
                            {p.planType === "Leave"
                              ? "Leave Day"
                              : `${p.totalVisits} Visits · ${p.totalTasks} Tasks`}
                          </td>

                          {/* 5. Contact Details / Plan Remarks */}
                          <td className="border-r border-border px-3 py-2.5 text-muted text-xs truncate max-w-[180px]">
                            {p.planRemarks || "—"}
                          </td>

                          {/* 6. Location */}
                          <td className="border-r border-border px-3 py-2.5 font-medium text-foreground truncate max-w-[180px]">
                            {p.planLocation || "—"}
                          </td>

                          {/* 7. Time */}
                          <td className="border-r border-border px-3 py-2.5 text-muted font-mono text-[11px]">
                            Full Day
                          </td>

                          {/* 8. Overall Status */}
                          <td className="border-r border-border px-3 py-2.5 whitespace-nowrap">
                            {renderPlanStatusBadge(p.planStatus)}
                          </td>

                          {/* 9. Remarks & Outcomes */}
                          <td className="border-r border-border px-3 py-2.5 text-foreground truncate max-w-[220px]">
                            {p.planRemarks || "—"}
                          </td>

                          {/* 10. Checklist */}
                          <td className="px-3 py-2.5 text-muted text-[11px]">
                            {totalChildren > 0
                              ? `${p.childVisits.length} visits, ${p.childTasks.length} tasks`
                              : "No items"}
                          </td>
                        </tr>

                        {/* CHILD VISITS & TASKS ROWS (rendered when not collapsed) */}
                        {!isCollapsed && (
                          <>
                            {/* Child Visits */}
                            {p.childVisits.map((v, vIdx) => (
                              <tr
                                key={v.id}
                                className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50"
                              >
                                {/* 0. Child Index */}
                                <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px] bg-surface-muted/30 pl-4">
                                  {parentRowIndex}.{vIdx + 1}
                                </td>

                                {/* 1. Plan Date */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[11px] whitespace-nowrap">
                                  {formatPlanDate(p.planDate)}
                                </td>

                                {/* 2. Executive */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate text-[11px]">
                                  {salesUserLabel(p.salesUser)}
                                </td>

                                {/* 3. Activity Type (Indented) */}
                                <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap pl-4">
                                  <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 text-[10px] font-bold">
                                    <CornerDownRight className="h-3 w-3 shrink-0" />
                                    Visit #{v.sequence}
                                  </span>
                                </td>

                                {/* 4. Party Name */}
                                <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground truncate max-w-[200px]">
                                  {v.partyName}
                                </td>

                                {/* 5. Contact Info */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate max-w-[200px]">
                                  {v.contactInfo}
                                </td>

                                {/* 6. Location */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate max-w-[180px]">
                                  {v.address}
                                </td>

                                {/* 7. Planned & Actual Time */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">
                                  <div>{v.plannedTime}</div>
                                  {v.actualTime !== "—" && (
                                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold">{v.actualTime}</div>
                                  )}
                                </td>

                                {/* 8. Visit Status */}
                                <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                                  {renderVisitStatusBadge(v.status)}
                                </td>

                                {/* 9. Visit Outcome */}
                                <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground truncate max-w-[250px]">
                                  {v.outcome}
                                </td>

                                {/* 10. Doctor/Purchase Checklist Notes */}
                                <td className="px-3 py-2 text-muted truncate max-w-[200px] text-[10px]">
                                  {v.checklistNotes}
                                </td>
                              </tr>
                            ))}

                            {/* Child Work Tasks */}
                            {p.childTasks.map((w, wIdx) => (
                              <tr
                                key={w.id}
                                className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50"
                              >
                                {/* 0. Child Index */}
                                <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px] bg-surface-muted/30 pl-4">
                                  {parentRowIndex}.{p.childVisits.length + wIdx + 1}
                                </td>

                                {/* 1. Plan Date */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[11px] whitespace-nowrap">
                                  {formatPlanDate(p.planDate)}
                                </td>

                                {/* 2. Executive */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate text-[11px]">
                                  {salesUserLabel(p.salesUser)}
                                </td>

                                {/* 3. Activity Type (Indented) */}
                                <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap pl-4">
                                  <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-bold">
                                    <CornerDownRight className="h-3 w-3 shrink-0" />
                                    Task #{w.sequence}
                                  </span>
                                </td>

                                {/* 4. Task Title */}
                                <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground truncate max-w-[200px]">
                                  {w.title}
                                </td>

                                {/* 5. Task Description */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate max-w-[200px]">
                                  {w.description}
                                </td>

                                {/* 6. Location */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted truncate max-w-[180px]">
                                  {p.planLocation || "Office / Remote"}
                                </td>

                                {/* 7. Time */}
                                <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">
                                  {w.plannedTime}
                                </td>

                                {/* 8. Task Status */}
                                <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                      w.status === "completed"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {w.status}
                                  </span>
                                </td>

                                {/* 9. Task Completion Remarks / Outcome */}
                                <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground truncate max-w-[250px]">
                                  {w.remarks}
                                </td>

                                {/* 10. Checklist */}
                                <td className="px-3 py-2 text-muted text-[10px]">
                                  N/A
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    );
                  })
                ) : (
                  /* FLAT ACTIVITY LIST VIEW */
                  filteredPlanTree.flatMap((p, pIdx) => {
                    const parentRowIndex = pIdx + 1;
                    const items = [];

                    // If plan has no visits and no tasks (e.g. Leave or empty day)
                    if (p.childVisits.length === 0 && p.childTasks.length === 0) {
                      items.push(
                        <tr key={`flat-p-${p.planId}`} className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50">
                          <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px]">{parentRowIndex}</td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground whitespace-nowrap">{formatPlanDate(p.planDate)}</td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground whitespace-nowrap">{salesUserLabel(p.salesUser)}</td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">{p.planType} Plan</span>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground">{p.planType === "Leave" ? "Leave Day" : "No child activities"}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted">{p.planRemarks || "—"}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted">{p.planLocation || "—"}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">Full Day</td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">{renderPlanStatusBadge(p.planStatus)}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-medium">{p.planRemarks || "—"}</td>
                          <td className="px-3 py-2 text-muted text-[10px]">N/A</td>
                        </tr>
                      );
                    }

                    // Flat Visits
                    p.childVisits.forEach((v, vIdx) => {
                      items.push(
                        <tr key={`flat-v-${v.id}`} className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50">
                          <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px]">{parentRowIndex}.{vIdx + 1}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-semibold whitespace-nowrap">{formatPlanDate(p.planDate)}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-semibold whitespace-nowrap">{salesUserLabel(p.salesUser)}</td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            <span className="rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 text-[10px] font-bold">Field Visit #{v.sequence}</span>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground max-w-[200px] truncate">{v.partyName}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted max-w-[200px] truncate">{v.contactInfo}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted max-w-[180px] truncate">{v.address}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">
                            <div>{v.plannedTime}</div>
                            {v.actualTime !== "—" && <div className="text-emerald-600 dark:text-emerald-400 font-semibold">{v.actualTime}</div>}
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">{renderVisitStatusBadge(v.status)}</td>
                          <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground max-w-[250px] truncate">{v.outcome}</td>
                          <td className="px-3 py-2 text-muted max-w-[200px] truncate text-[10px]">{v.checklistNotes}</td>
                        </tr>
                      );
                    });

                    // Flat Tasks
                    p.childTasks.forEach((w, wIdx) => {
                      items.push(
                        <tr key={`flat-w-${w.id}`} className="bg-card hover:bg-surface-muted/60 transition border-b border-border/50">
                          <td className="border-r border-border/60 px-3 py-2 text-center text-muted font-mono text-[11px]">{parentRowIndex}.{p.childVisits.length + wIdx + 1}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-semibold whitespace-nowrap">{formatPlanDate(p.planDate)}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-foreground font-semibold whitespace-nowrap">{salesUserLabel(p.salesUser)}</td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            <span className="rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-bold">Work Task #{w.sequence}</span>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-bold text-foreground max-w-[200px] truncate">{w.title}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted max-w-[200px] truncate">{w.description}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted max-w-[180px] truncate">{p.planLocation || "Office / Remote"}</td>
                          <td className="border-r border-border/60 px-3 py-2 text-muted font-mono text-[10px]">{w.plannedTime}</td>
                          <td className="border-r border-border/60 px-3 py-2 whitespace-nowrap">
                            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${w.status === "completed" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="border-r border-border/60 px-3 py-2 font-medium text-foreground max-w-[250px] truncate">{w.remarks}</td>
                          <td className="px-3 py-2 text-muted text-[10px]">N/A</td>
                        </tr>
                      );
                    });

                    return items;
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Spreadsheet Status Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-muted/50 px-5 py-3 text-xs">
          <div className="flex items-center gap-4 text-muted">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Sheet Tree Active
            </span>
            <span>Total Parent Plans: <strong className="text-foreground">{summaryMetrics.totalPlans}</strong></span>
            <span>Child Visits: <strong className="text-cyan-600 dark:text-cyan-400">{summaryMetrics.totalVisits}</strong></span>
            <span>Child Tasks: <strong className="text-purple-600 dark:text-purple-400">{summaryMetrics.totalTasks}</strong></span>
            <span>Completed Plans: <strong className="text-emerald-600 dark:text-emerald-400">{summaryMetrics.completedPlans}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-card border border-border px-2.5 py-1 text-[11px] font-bold text-muted">
              Sheet1: Work Plans & Child Activities Tree
            </span>
            <button
              type="button"
              disabled={downloading || filteredPlanTree.length === 0}
              onClick={exportCsv}
              className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DownloadWorkPlansModal;
