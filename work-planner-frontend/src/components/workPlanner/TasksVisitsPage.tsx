"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
} from "./workPlanUtils";
import { DownloadTasksVisitsReportModal } from "./DownloadTasksVisitsReportModal";
import { MarkPendingVisitModal } from "./MarkPendingVisitModal";
import { InProgressVisitModal } from "./InProgressVisitModal";
import { CompleteVisitModal, type CompleteVisitPayload } from "./CompleteVisitModal";
import { MarkPendingWorkModal } from "./MarkPendingWorkModal";
import { InProgressWorkModal } from "./InProgressWorkModal";
import { CompleteWorkModal } from "./CompleteWorkModal";

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
  const user = readSessionFromStorage()?.user;
  const managerRole = isManager(user);

  // Filter States
  const [categoryFilter, setCategoryFilter] = useState<"all" | "visits" | "tasks">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // Report Modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Action targets
  const [pendingVisitTarget, setPendingVisitTarget] = useState<WorkPlanVisitRecord | null>(null);
  const [inProgressVisitTarget, setInProgressVisitTarget] = useState<WorkPlanVisitRecord | null>(null);
  const [completeVisitTarget, setCompleteVisitTarget] = useState<WorkPlanVisitRecord | null>(null);

  const [pendingWorkTarget, setPendingWorkTarget] = useState<WorkPlanWorkRecord | null>(null);
  const [inProgressWorkTarget, setInProgressWorkTarget] = useState<WorkPlanWorkRecord | null>(null);
  const [completeWorkTarget, setCompleteWorkTarget] = useState<WorkPlanWorkRecord | null>(null);

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

  // Visit Action Confirmation Handlers
  const handlePendingVisitConfirm = async (remarks: string) => {
    if (!pendingVisitTarget) return;
    setActionSaving(true);
    try {
      const planId = String(pendingVisitTarget.work_plan || "");
      const visitId = String(pendingVisitTarget._id || pendingVisitTarget.id || "");
      await updateVisitMut({ planId, visitId, body: { status: "pending", pending_remarks: remarks } }).unwrap();
      toast.success("Visit marked as pending");
      setPendingVisitTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to mark visit pending");
    } finally {
      setActionSaving(false);
    }
  };

  const handleInProgressVisitConfirm = async (remarks: string) => {
    if (!inProgressVisitTarget) return;
    setActionSaving(true);
    try {
      const planId = String(inProgressVisitTarget.work_plan || "");
      const visitId = String(inProgressVisitTarget._id || inProgressVisitTarget.id || "");
      await updateVisitMut({ planId, visitId, body: { status: "in_progress", in_progress_remarks: remarks } }).unwrap();
      toast.success("Visit marked in-progress");
      setInProgressVisitTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to mark visit in-progress");
    } finally {
      setActionSaving(false);
    }
  };

  const handleCompleteVisitConfirm = async (payload: CompleteVisitPayload) => {
    if (!completeVisitTarget) return;
    setActionSaving(true);
    try {
      const planId = String(completeVisitTarget.work_plan || "");
      const visitId = String(completeVisitTarget._id || completeVisitTarget.id || "");
      await completeVisitMut({ planId, visitId, body: payload }).unwrap();
      toast.success("Visit marked as completed");
      setCompleteVisitTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to complete visit");
    } finally {
      setActionSaving(false);
    }
  };

  // Work Task Action Confirmation Handlers
  const handlePendingWorkConfirm = async (remarks: string) => {
    if (!pendingWorkTarget) return;
    setActionSaving(true);
    try {
      const planId = String(pendingWorkTarget.work_plan || "");
      const workId = String(pendingWorkTarget._id || pendingWorkTarget.id || "");
      await updateWorkMut({ planId, workId, body: { status: "pending", pending_remarks: remarks } }).unwrap();
      toast.success("Task marked as pending");
      setPendingWorkTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to mark task pending");
    } finally {
      setActionSaving(false);
    }
  };

  const handleInProgressWorkConfirm = async (remarks: string) => {
    if (!inProgressWorkTarget) return;
    setActionSaving(true);
    try {
      const planId = String(inProgressWorkTarget.work_plan || "");
      const workId = String(inProgressWorkTarget._id || inProgressWorkTarget.id || "");
      await updateWorkMut({ planId, workId, body: { status: "in_progress", in_progress_remarks: remarks } }).unwrap();
      toast.success("Task marked in-progress");
      setInProgressWorkTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to mark task in-progress");
    } finally {
      setActionSaving(false);
    }
  };

  const handleCompleteWorkConfirm = async (remarks: string) => {
    if (!completeWorkTarget) return;
    setActionSaving(true);
    try {
      const planId = String(completeWorkTarget.work_plan || "");
      const workId = String(completeWorkTarget._id || completeWorkTarget.id || "");
      await updateWorkMut({ planId, workId, body: { status: "completed", completion_remarks: remarks } }).unwrap();
      toast.success("Task marked as completed");
      setCompleteWorkTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to complete task");
    } finally {
      setActionSaving(false);
    }
  };

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

                      {/* Direct Row Actions (Disabled when completed) */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === "completed" ? (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Completed
                            </span>
                          ) : isVisit ? (
                            <>
                              {item.status !== "pending" && (
                                <button
                                  type="button"
                                  onClick={() => setPendingVisitTarget(item.raw as WorkPlanVisitRecord)}
                                  className="rounded bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-500/20 transition cursor-pointer"
                                >
                                  Pending
                                </button>
                              )}

                              {item.status !== "in_progress" && (
                                <button
                                  type="button"
                                  onClick={() => setInProgressVisitTarget(item.raw as WorkPlanVisitRecord)}
                                  className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
                                >
                                  In Progress
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setCompleteVisitTarget(item.raw as WorkPlanVisitRecord)}
                                className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                              >
                                Complete
                              </button>
                            </>
                          ) : (
                            /* Work Task Status Actions */
                            <>
                              {item.status !== "pending" && (
                                <button
                                  type="button"
                                  onClick={() => setPendingWorkTarget(item.raw as WorkPlanWorkRecord)}
                                  className="rounded bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-500/20 transition cursor-pointer"
                                >
                                  Pending
                                </button>
                              )}

                              {item.status !== "in_progress" && (
                                <button
                                  type="button"
                                  onClick={() => setInProgressWorkTarget(item.raw as WorkPlanWorkRecord)}
                                  className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
                                >
                                  In Progress
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setCompleteWorkTarget(item.raw as WorkPlanWorkRecord)}
                                className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                              >
                                Complete
                              </button>
                            </>
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

      {/* Action Modals for Visit Status Updates */}
      {pendingVisitTarget && (
        <MarkPendingVisitModal
          open={Boolean(pendingVisitTarget)}
          isSaving={actionSaving}
          partyName={pendingVisitTarget.party_name}
          initialRemarks={pendingVisitTarget.pending_remarks}
          onClose={() => setPendingVisitTarget(null)}
          onConfirm={handlePendingVisitConfirm}
        />
      )}

      {inProgressVisitTarget && (
        <InProgressVisitModal
          open={Boolean(inProgressVisitTarget)}
          isSaving={actionSaving}
          partyName={inProgressVisitTarget.party_name}
          initialRemarks={inProgressVisitTarget.in_progress_remarks}
          onClose={() => setInProgressVisitTarget(null)}
          onConfirm={handleInProgressVisitConfirm}
        />
      )}

      {completeVisitTarget && (
        <CompleteVisitModal
          open={Boolean(completeVisitTarget)}
          isSaving={actionSaving}
          onClose={() => setCompleteVisitTarget(null)}
          onConfirm={handleCompleteVisitConfirm}
        />
      )}

      {/* Action Modals for Work Task Status Updates */}
      {pendingWorkTarget && (
        <MarkPendingWorkModal
          open={Boolean(pendingWorkTarget)}
          isSaving={actionSaving}
          taskTitle={pendingWorkTarget.title}
          initialRemarks={pendingWorkTarget.pending_remarks}
          onClose={() => setPendingWorkTarget(null)}
          onConfirm={handlePendingWorkConfirm}
        />
      )}

      {inProgressWorkTarget && (
        <InProgressWorkModal
          open={Boolean(inProgressWorkTarget)}
          isSaving={actionSaving}
          taskTitle={inProgressWorkTarget.title}
          initialRemarks={inProgressWorkTarget.in_progress_remarks}
          onClose={() => setInProgressWorkTarget(null)}
          onConfirm={handleInProgressWorkConfirm}
        />
      )}

      {completeWorkTarget && (
        <CompleteWorkModal
          open={Boolean(completeWorkTarget)}
          isSaving={actionSaving}
          taskTitle={completeWorkTarget.title}
          onClose={() => setCompleteWorkTarget(null)}
          onConfirm={handleCompleteWorkConfirm}
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
