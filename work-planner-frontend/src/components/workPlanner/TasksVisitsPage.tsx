"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Briefcase,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Plus,
  ExternalLink,
  Clock,
  UserCheck,
  MapPin,
  CheckSquare,
  FileText,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetPlansQuery,
  useUpdateVisitMutation,
  useCompleteVisitMutation,
  useUpdateWorkMutation,
} from "@/store/api/workPlannerApiSlice";
import { isManager, readSessionFromStorage } from "@/utils/authStorage";
import type {
  WorkPlanRecord,
  WorkPlanVisitRecord,
  WorkPlanWorkRecord,
} from "@/types/workPlanner";
import {
  formatPlanDate,
  formatTime,
  salesUserLabel,
  renderVisitStatusBadge,
  renderWorkStatusBadge,
  planIdOf,
  isPlanDate3DaysExpired,
} from "./workPlanUtils";
import { DownloadTasksVisitsReportModal } from "./DownloadTasksVisitsReportModal";
import { ItemStatusRemarksModal } from "./ItemStatusRemarksModal";

export interface DisplayTaskVisitItem {
  id: string;
  planId: string;
  planDate: string;
  planStatus: string;
  itemType: "visit" | "task";
  executiveName: string;
  executiveEmail: string;
  titleOrParty: string;
  contactPerson: string;
  contactNumber: string;
  locationOrAddress: string;
  descriptionOrNotes: string;
  plannedTime: string;
  status: string;
  raw: WorkPlanVisitRecord | WorkPlanWorkRecord;
  parentPlan: WorkPlanRecord;
}

export function TasksVisitsPage() {
  const searchParams = useSearchParams();
  const user = readSessionFromStorage()?.user;
  const managerRole = isManager(user);

  // Filter States
  const initialSearch = searchParams.get("search") || searchParams.get("q") || "";
  const [categoryFilter, setCategoryFilter] = useState<"all" | "visits" | "tasks">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // Report Modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Action targets
  const [statusRemarksTarget, setStatusRemarksTarget] = useState<DisplayTaskVisitItem | null>(null);
  const [actionSaving, setActionSaving] = useState(false);

  // Mutations
  const [updateVisitMut] = useUpdateVisitMutation();
  const [completeVisitMut] = useCompleteVisitMutation();
  const [updateWorkMut] = useUpdateWorkMutation();

  const queryParams = useMemo(() => {
    const q: Record<string, string | number | boolean | undefined> = {
      page: 1,
      limit: 150,
      include_visits: true,
      include_works: true,
    };
    if (dateFrom) q.from = dateFrom;
    if (dateTo) q.to = dateTo;
    return q;
  }, [dateFrom, dateTo]);

  const { data: plansRes, isLoading: loading, refetch: loadData } = useGetPlansQuery(queryParams);

  const plans = plansRes?.data || [];

  // Flatten all visits and works from fetched work plans
  const allItems = useMemo<DisplayTaskVisitItem[]>(() => {
    const list: DisplayTaskVisitItem[] = [];

    for (const p of plans) {
      const pId = planIdOf(p);
      const pDate = p.plan_date || "";
      const pStatus = p.status || "planned";
      const execName = salesUserLabel(p.sales_user);
      const execEmail = typeof p.sales_user === "object" ? p.sales_user?.email || "" : "";

      // Flatten Visits
      if (Array.isArray(p.visits)) {
        for (const v of p.visits) {
          const vId = v._id || v.id || `visit-${list.length}`;
          list.push({
            id: vId,
            planId: pId,
            planDate: pDate,
            planStatus: pStatus,
            itemType: "visit",
            executiveName: execName,
            executiveEmail: execEmail,
            titleOrParty: v.party_name || (typeof v.party === "object" ? (v.party as any)?.party_name : undefined) || "Field Visit",
            contactPerson: v.contact_person || "",
            contactNumber: v.contact_number || v.phone || "",
            locationOrAddress: v.address || p.location || "",
            descriptionOrNotes: v.purpose || v.notes || "",
            plannedTime: formatTime(v.planned_start_time),
            status: v.status || "created",
            raw: v,
            parentPlan: p,
          });
        }
      }

      // Flatten Work Tasks
      if (Array.isArray(p.works)) {
        for (const w of p.works) {
          const wId = w._id || w.id || `work-${list.length}`;
          list.push({
            id: wId,
            planId: pId,
            planDate: pDate,
            planStatus: pStatus,
            itemType: "task",
            executiveName: execName,
            executiveEmail: execEmail,
            titleOrParty: w.title || "Work Task",
            contactPerson: "",
            contactNumber: "",
            locationOrAddress: p.location || "Office / Remote",
            descriptionOrNotes: w.description || "",
            plannedTime: formatTime(w.planned_start_time),
            status: w.status || "created",
            raw: w,
            parentPlan: p,
          });
        }
      }
    }

    return list;
  }, [plans]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (categoryFilter === "visits" && item.itemType !== "visit") return false;
      if (categoryFilter === "tasks" && item.itemType !== "task") return false;

      if (statusFilter !== "all") {
        if (statusFilter === "in_progress" && (item.status === "in_progress" || item.status === "checked_in")) {
          // match
        } else if (String(item.status).toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const text = `${item.titleOrParty} ${item.executiveName} ${item.contactPerson} ${item.locationOrAddress} ${item.descriptionOrNotes} ${item.status}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [allItems, categoryFilter, statusFilter, searchQuery]);

  // Paginated rows
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);



  const STATUS_TABS = [
    { id: "all", label: "All Statuses" },
    { id: "created", label: "Created" },
    { id: "pending", label: "Pending" },
    { id: "in_progress", label: "In Progress" },
    { id: "completed", label: "Completed" },
  ];

  return (
    <div className="space-y-4 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Tasks &amp; Field Visits Management
          </h1>
          <p className="text-xs text-muted">
            {managerRole
              ? "Oversee individual team visits & tasks, execute real-time status actions, and dispatch reports"
              : "Track and update your scheduled field visits, office tasks, and direct progress status"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Tasks &amp; Visits Report
          </button>
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <FileText className="h-4 w-4 text-primary" />
            Work Plans
          </Link>
          <Link
            href="/dashboard/plans/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover shadow-xs transition"
          >
            <Plus className="h-4 w-4" />
            New Work Plan
          </Link>
        </div>
      </div>

      {/* Category Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          type="button"
          onClick={() => {
            setCategoryFilter("all");
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
            categoryFilter === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          <span>All Activity Items ({allItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryFilter("visits");
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
            categoryFilter === "visits"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4 text-sky-500" />
          <span>Field Visits ({allItems.filter((i) => i.itemType === "visit").length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryFilter("tasks");
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
            categoryFilter === "tasks"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Briefcase className="h-4 w-4 text-emerald-500" />
          <span>Work Tasks ({allItems.filter((i) => i.itemType === "task").length})</span>
        </button>
      </div>

      {/* Status Filter Bar */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setStatusFilter(tab.id);
              setCurrentPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
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
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by executive, party name, task title, address..."
            className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          title="Refresh activity data"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main Activity Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-muted font-semibold text-muted">
              <tr>
                <th className="px-4 py-3">Date &amp; Time</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Executive</th>
                <th className="px-4 py-3">Title / Party Name</th>
                <th className="px-4 py-3">Contact / Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    Loading activity items…
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    No field visits or tasks found matching current filters.
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => {
                  const isVisit = item.itemType === "visit";

                  return (
                    <tr key={item.id} className="hover:bg-surface-muted/50 transition">
                      {/* Plan Date & Schedule */}
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        <div>{formatPlanDate(item.planDate)}</div>
                        {item.plannedTime && (
                          <div className="text-[10px] text-muted flex items-center gap-1 font-normal mt-0.5">
                            <Clock className="h-3 w-3" />
                            {item.plannedTime}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isVisit ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                            <Building2 className="h-3 w-3" />
                            Field Visit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Briefcase className="h-3 w-3" />
                            Work Task
                          </span>
                        )}
                      </td>

                      {/* Executive */}
                      <td className="px-4 py-3 font-medium truncate max-w-[140px]">
                        {item.executiveName}
                      </td>

                      {/* Title or Party Name & Description */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="font-bold text-foreground truncate" title={item.titleOrParty}>
                          {item.titleOrParty}
                        </div>
                        {item.descriptionOrNotes && (
                          <div className="text-[11px] text-muted truncate mt-0.5" title={item.descriptionOrNotes}>
                            {item.descriptionOrNotes}
                          </div>
                        )}
                      </td>

                      {/* Contact / Location */}
                      <td className="px-4 py-3 max-w-[180px]">
                        {isVisit ? (
                          <div className="space-y-0.5">
                            {item.contactPerson && (
                              <div className="font-semibold text-foreground flex items-center gap-1 truncate text-[11px]">
                                <UserCheck className="h-3 w-3 text-muted shrink-0" />
                                {item.contactPerson}
                              </div>
                            )}
                            {item.locationOrAddress && (
                              <div className="text-[11px] text-muted flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3 text-muted shrink-0" />
                                {item.locationOrAddress}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 text-muted shrink-0" />
                            {item.locationOrAddress}
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isVisit
                          ? renderVisitStatusBadge(item.status)
                          : renderWorkStatusBadge(item.status)}
                      </td>

                      {/* Direct Row Actions (Disabled when completed or > 3 days expired) */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === "completed" ? (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Completed
                            </span>
                          ) : isPlanDate3DaysExpired(item.planDate) ? (
                            <span
                              className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded"
                              title="Action period expired (> 3 days)"
                            >
                              Expired (&gt;3 days)
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setStatusRemarksTarget(item)}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition cursor-pointer"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>Remarks &amp; Status</span>
                            </button>
                          )}

                          {/* Link to parent Work Plan */}
                          <Link
                            href={`/dashboard/plans/${item.planId}`}
                            className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground transition ml-1"
                            title="View parent Work Plan"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <div className="text-muted">
              Showing page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span> ({totalItems} total items)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-border px-3 py-1 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unified Item Status & Remarks Modal */}
      {statusRemarksTarget && (
        <ItemStatusRemarksModal
          open={Boolean(statusRemarksTarget)}
          itemType={statusRemarksTarget.itemType}
          title={statusRemarksTarget.titleOrParty}
          currentStatus={statusRemarksTarget.status || "created"}
          initialPendingRemarks={(statusRemarksTarget.raw as any).pending_remarks}
          initialInProgressRemarks={(statusRemarksTarget.raw as any).in_progress_remarks}
          initialOutcome={
            statusRemarksTarget.itemType === "visit"
              ? (statusRemarksTarget.raw as WorkPlanVisitRecord).outcome
              : (statusRemarksTarget.raw as WorkPlanWorkRecord).completion_remarks || (statusRemarksTarget.raw as WorkPlanWorkRecord).outcome
          }
          initialVisitAnswers={
            statusRemarksTarget.itemType === "visit"
              ? {
                  meeting_with_doctor: (statusRemarksTarget.raw as WorkPlanVisitRecord).meeting_with_doctor,
                  meeting_with_purchase: (statusRemarksTarget.raw as WorkPlanVisitRecord).meeting_with_purchase,
                  meeting_with_finance: (statusRemarksTarget.raw as WorkPlanVisitRecord).meeting_with_finance,
                  meeting_with_engineer: (statusRemarksTarget.raw as WorkPlanVisitRecord).meeting_with_engineer,
                  new_product_introduced: (statusRemarksTarget.raw as WorkPlanVisitRecord).new_product_introduced,
                  order_received: (statusRemarksTarget.raw as WorkPlanVisitRecord).order_received,
                }
              : undefined
          }
          isSaving={actionSaving}
          onClose={() => setStatusRemarksTarget(null)}
          onConfirm={async ({ status, remarks, visitAnswers }) => {
            setActionSaving(true);
            try {
              const planId = statusRemarksTarget.planId;
              const itemId = statusRemarksTarget.id;
              if (statusRemarksTarget.itemType === "visit") {
                if (status === "completed") {
                  await completeVisitMut({
                    planId,
                    visitId: itemId,
                    body: { outcome: remarks, ...(visitAnswers || {}) },
                  }).unwrap();
                } else if (status === "pending") {
                  await updateVisitMut({ planId, visitId: itemId, body: { status: "pending", pending_remarks: remarks } }).unwrap();
                } else if (status === "in_progress") {
                  await updateVisitMut({ planId, visitId: itemId, body: { status: "in_progress", in_progress_remarks: remarks } }).unwrap();
                }
                toast.success(`Visit status updated to ${status.replace("_", " ")}`);
              } else {
                if (status === "completed") {
                  await updateWorkMut({ planId, workId: itemId, body: { status: "completed", completion_remarks: remarks, outcome: remarks } }).unwrap();
                } else if (status === "pending") {
                  await updateWorkMut({ planId, workId: itemId, body: { status: "pending", pending_remarks: remarks } }).unwrap();
                } else if (status === "in_progress") {
                  await updateWorkMut({ planId, workId: itemId, body: { status: "in_progress", in_progress_remarks: remarks } }).unwrap();
                }
                toast.success(`Task status updated to ${status.replace("_", " ")}`);
              }
              setStatusRemarksTarget(null);
              loadData();
            } catch (err: any) {
              toast.error(err?.data?.message || err?.message || "Failed to update status");
            } finally {
              setActionSaving(false);
            }
          }}
        />
      )}

      {/* Report Download Modal */}
      {reportModalOpen && (
        <DownloadTasksVisitsReportModal
          open={reportModalOpen}
          plans={plans}
          onClose={() => setReportModalOpen(false)}
        />
      )}
    </div>
  );
}

export default TasksVisitsPage;
