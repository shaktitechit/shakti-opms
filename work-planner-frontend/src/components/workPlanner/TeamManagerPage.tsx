"use client";

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Network,
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  Search,
  Shield,
  Unlink,
  Layers,
  Filter,
  UserMinus,
  Sparkles,
  Info,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetTeamTreeQuery,
  useUpsertTeamEdgeMutation,
  useRemoveTeamEdgeMutation,
} from "@/store/api/workPlannerApiSlice";
import { isWpAdmin, readSessionFromStorage } from "@/utils/authStorage";

interface TreeUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string | { name?: string };
  wp_role: "admin" | "manager" | "coordinator" | "executive" | string;
  reports_to?: string | null;
  report_ids?: string[];
  is_active?: boolean;
}

interface DraggedUserState {
  _id: string;
  name: string;
  email: string;
  wp_role: string;
  reports_to?: string | null;
}

const ROLE_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; label: string; dot: string }> = {
  admin: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-300",
    border: "border-purple-500/30",
    label: "Admin",
    dot: "bg-purple-500",
  },
  manager: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-300",
    border: "border-emerald-500/30",
    label: "Manager",
    dot: "bg-emerald-500",
  },
  coordinator: {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-300",
    border: "border-indigo-500/30",
    label: "Coordinator",
    dot: "bg-indigo-500",
  },
  executive: {
    bg: "bg-sky-500/10 dark:bg-sky-500/20",
    text: "text-sky-600 dark:text-sky-300",
    border: "border-sky-500/30",
    label: "Executive",
    dot: "bg-sky-500",
  },
};

export function TeamManagerPage() {
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminAccess = isWpAdmin(sessionUser);

  const { data: tree, isLoading, refetch, error } = useGetTeamTreeQuery(undefined, {
    skip: !adminAccess,
  });
  const [upsertEdge, { isLoading: saving }] = useUpsertTeamEdgeMutation();
  const [removeEdge, { isLoading: removing }] = useRemoveTeamEdgeMutation();

  // Manual Assign Modal / Form states
  const [subordinateId, setSubordinateId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  // UI state
  const [activeTab, setActiveTab] = useState<"tree" | "list">("tree");
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [unassignedRoleFilter, setUnassignedRoleFilter] = useState<"all" | "manager" | "coordinator" | "executive">("all");
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [treeSearch, setTreeSearch] = useState("");

  // Drag and Drop state
  const [draggedUser, setDraggedUser] = useState<DraggedUserState | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [dragOverValid, setDragOverValid] = useState<boolean | null>(null);
  const [isOverUnassignZone, setIsOverUnassignZone] = useState(false);

  const allUsers = useMemo<TreeUser[]>(() => (tree?.users || []) as TreeUser[], [tree?.users]);
  const userMap = useMemo(() => {
    const map = new Map<string, TreeUser>();
    allUsers.forEach((u) => map.set(String(u._id), u));
    return map;
  }, [allUsers]);

  const admins = useMemo(() => (tree?.admins || []) as TreeUser[], [tree?.admins]);
  const managers = useMemo(() => (tree?.managers || []) as TreeUser[], [tree?.managers]);
  const coordinators = useMemo(() => (tree?.coordinators || []) as TreeUser[], [tree?.coordinators]);
  const executives = useMemo(() => (tree?.executives || []) as TreeUser[], [tree?.executives]);

  const unassignedManagers = useMemo(() => (tree?.unassignedManagers || []) as TreeUser[], [tree?.unassignedManagers]);
  const unassignedCoordinators = useMemo(() => (tree?.unassignedCoordinators || []) as TreeUser[], [tree?.unassignedCoordinators]);
  const unassignedExecutives = useMemo(() => (tree?.unassignedExecutives || []) as TreeUser[], [tree?.unassignedExecutives]);

  const allUnassigned = useMemo(() => {
    const list = [...unassignedManagers, ...unassignedCoordinators, ...unassignedExecutives];
    return list.filter((u) => {
      if (unassignedRoleFilter !== "all" && u.wp_role !== unassignedRoleFilter) return false;
      if (!unassignedSearch.trim()) return true;
      const q = unassignedSearch.toLowerCase().trim();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.wp_role?.toLowerCase().includes(q)
      );
    });
  }, [unassignedManagers, unassignedCoordinators, unassignedExecutives, unassignedRoleFilter, unassignedSearch]);

  // Options for manual assignment form
  const subordinateOptions = useMemo(() => {
    return [...managers, ...coordinators, ...executives].sort((a: any, b: any) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [managers, coordinators, executives]);

  const managerOptions = useMemo(() => {
    const sub = subordinateOptions.find((u: any) => String(u._id) === subordinateId);
    const role = sub?.wp_role;
    if (role === "executive") return [...coordinators, ...managers];
    if (role === "coordinator") return [...managers, ...admins];
    if (role === "manager") return admins;
    return [...coordinators, ...managers, ...admins];
  }, [subordinateId, subordinateOptions, coordinators, managers, admins]);

  // Validation rules for drag and drop
  const checkCanDrop = useCallback(
    (source: DraggedUserState | null, target: TreeUser | null): { allowed: boolean; reason?: string } => {
      if (!source || !target) return { allowed: false, reason: "Invalid drag data" };
      if (String(source._id) === String(target._id)) {
        return { allowed: false, reason: "A user cannot report to themselves" };
      }
      if (source.reports_to && String(source.reports_to) === String(target._id)) {
        return { allowed: false, reason: `Already reporting to ${target.name}` };
      }

      // Hierarchy rule validation
      if (source.wp_role === "executive") {
        if (target.wp_role !== "coordinator" && target.wp_role !== "manager") {
          return { allowed: false, reason: "Executives can only report to Coordinators or Managers" };
        }
      } else if (source.wp_role === "coordinator") {
        if (target.wp_role !== "manager" && target.wp_role !== "admin") {
          return { allowed: false, reason: "Coordinators can only report to Managers or Admins" };
        }
      } else if (source.wp_role === "manager") {
        if (target.wp_role !== "admin") {
          return { allowed: false, reason: "Managers can only report to Admins" };
        }
      } else if (source.wp_role === "admin") {
        return { allowed: false, reason: "Admins are at the root level and cannot report to anyone" };
      }

      // Cycle detection: target cannot be a descendant of source
      let currentId: string | null = target.reports_to || null;
      let depth = 0;
      while (currentId && depth < 20) {
        if (currentId === source._id) {
          return { allowed: false, reason: "Circular reporting detected: cannot report to your own subordinate" };
        }
        const parent = userMap.get(currentId);
        currentId = parent?.reports_to || null;
        depth++;
      }

      return { allowed: true };
    },
    [userMap]
  );

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, user: DraggedUserState) => {
    setDraggedUser(user);
    e.dataTransfer.setData("application/json", JSON.stringify(user));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedUser(null);
    setDragOverTargetId(null);
    setDragOverValid(null);
    setIsOverUnassignZone(false);
  };

  const handleNodeDragOver = (e: React.DragEvent, target: TreeUser) => {
    e.preventDefault();
    if (!draggedUser) return;
    const { allowed } = checkCanDrop(draggedUser, target);
    setDragOverTargetId(target._id);
    setDragOverValid(allowed);
    e.dataTransfer.dropEffect = allowed ? "move" : "none";
  };

  const handleNodeDragLeave = (e: React.DragEvent, targetId: string) => {
    if (dragOverTargetId === targetId) {
      setDragOverTargetId(null);
      setDragOverValid(null);
    }
  };

  const handleNodeDrop = async (e: React.DragEvent, target: TreeUser) => {
    e.preventDefault();
    if (!draggedUser) return;
    const { allowed, reason } = checkCanDrop(draggedUser, target);
    if (!allowed) {
      toast.error(reason || "Invalid mapping action");
      setDragOverTargetId(null);
      setDragOverValid(null);
      return;
    }

    const toastId = toast.loading(`Assigning ${draggedUser.name} → ${target.name}…`);
    try {
      await upsertEdge({ subordinate: draggedUser._id, manager: target._id }).unwrap();
      toast.success(`Saved: ${draggedUser.name} now reports to ${target.name}`, { id: toastId });
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.error || "Failed to save mapping", { id: toastId });
    } finally {
      setDraggedUser(null);
      setDragOverTargetId(null);
      setDragOverValid(null);
    }
  };

  // Unassign Dropzone handlers
  const handleUnassignDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedUser && draggedUser.reports_to) {
      setIsOverUnassignZone(true);
      e.dataTransfer.dropEffect = "move";
    } else {
      e.dataTransfer.dropEffect = "none";
    }
  };

  const handleUnassignDragLeave = () => {
    setIsOverUnassignZone(false);
  };

  const handleUnassignDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsOverUnassignZone(false);
    if (!draggedUser) return;
    if (!draggedUser.reports_to) {
      toast.info(`${draggedUser.name} is already unassigned`);
      return;
    }

    const toastId = toast.loading(`Removing reporting for ${draggedUser.name}…`);
    try {
      await removeEdge(draggedUser._id).unwrap();
      toast.success(`Removed reporting for ${draggedUser.name}`, { id: toastId });
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.error || "Failed to remove mapping", { id: toastId });
    } finally {
      setDraggedUser(null);
    }
  };

  // Manual Form Submission
  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormOk("");
    if (!subordinateId || !managerId) {
      setFormError("Select both the report and their manager.");
      return;
    }
    const sub = userMap.get(subordinateId);
    const mgr = userMap.get(managerId);
    const toastId = toast.loading(`Assigning ${sub?.name || "User"} → ${mgr?.name || "Manager"}…`);
    try {
      await upsertEdge({ subordinate: subordinateId, manager: managerId }).unwrap();
      toast.success(`Saved: ${sub?.name || "User"} reports to ${mgr?.name || "Manager"}`, { id: toastId });
      setFormOk("Reporting saved. Assigned manager updated in user settings.");
      setSubordinateId("");
      setManagerId("");
      refetch();
    } catch (err: any) {
      const msg = err?.data?.message || err?.error || "Failed to save mapping";
      setFormError(msg);
      toast.error(msg, { id: toastId });
    }
  }

  async function handleUnmap(id: string) {
    setFormError("");
    setFormOk("");
    const sub = userMap.get(id);
    const toastId = toast.loading(`Removing reporting for ${sub?.name || "User"}…`);
    try {
      await removeEdge(id).unwrap();
      toast.success(`Removed reporting for ${sub?.name || "User"}`, { id: toastId });
      setFormOk("Reporting removed. Assigned manager cleared in user settings.");
      refetch();
    } catch (err: any) {
      const msg = err?.data?.message || err?.error || "Failed to remove mapping";
      setFormError(msg);
      toast.error(msg, { id: toastId });
    }
  }

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => setCollapsedNodes({});
  const collapseAll = () => {
    const collapsed: Record<string, boolean> = {};
    allUsers.forEach((u) => {
      if (u.report_ids && u.report_ids.length > 0) {
        collapsed[u._id] = true;
      }
    });
    setCollapsedNodes(collapsed);
  };

  // Get direct children of any node
  const getDirectReports = useCallback(
    (parentId: string) => {
      return allUsers.filter((u) => u.reports_to === parentId);
    },
    [allUsers]
  );

  // Standalone roots (Managers / Coordinators that are not assigned to an Admin but have subordinates)
  const standaloneLeads = useMemo(() => {
    return allUsers.filter((u) => {
      if (u.wp_role === "admin") return false;
      if (u.reports_to) return false;
      const reports = getDirectReports(u._id);
      return reports.length > 0;
    });
  }, [allUsers, getDirectReports]);

  if (!adminAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20 shadow-lg">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Admin Access Required</h2>
        <p className="mt-2 text-sm text-muted max-w-md">
          Team Manager (who reports to whom) is restricted to Work Planner admins.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition shadow-sm"
        >
          Return to Dashboard Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-16">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-foreground">Team Manager & Hierarchy Mapping</h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                Admin
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Interactive drag & drop organization chart: <span className="font-semibold text-foreground">Admin → Manager → Coordinator → Executive</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Toggle */}
          <div className="inline-flex items-center rounded-xl border border-border bg-surface-muted p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("tree")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "tree"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Network className="h-3.5 w-3.5 text-primary" />
              Hierarchy Tree
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === "list"
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              Mappings List
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Guide Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-xs text-indigo-950 dark:text-indigo-200">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
          <span>
            <strong>Drag & Drop Mapping:</strong> Drag any person from the <strong>Unassigned Pool</strong> or within the tree and drop them directly onto their reporting manager/coordinator.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-muted shrink-0">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Executive → Coordinator/Manager
          <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 ml-1" /> Coordinator → Manager/Admin
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500 ml-1" /> Manager → Admin
        </div>
      </div>

      {(formError || (error as any)?.data?.message) && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{formError || (error as any)?.data?.message}</span>
        </div>
      )}
      {formOk && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{formOk}</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px] items-start">
        {/* Left Column: Interactive Tree or Mapping List */}
        <div className="space-y-4">
          {activeTab === "tree" ? (
            <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
              {/* Tree Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-surface-muted/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Network className="h-4 w-4 text-primary" />
                  <span>Reporting Hierarchy Tree</span>
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted">
                    {allUsers.length} total members
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                    <input
                      type="text"
                      value={treeSearch}
                      onChange={(e) => setTreeSearch(e.target.value)}
                      placeholder="Filter tree by name…"
                      className="h-8 rounded-lg border border-border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={expandAll}
                    title="Expand all tree branches"
                    className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-3xs font-semibold text-muted hover:text-foreground transition"
                  >
                    <Maximize2 className="h-3 w-3" /> Expand All
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    title="Collapse all tree branches"
                    className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-3xs font-semibold text-muted hover:text-foreground transition"
                  >
                    <Minimize2 className="h-3 w-3" /> Collapse All
                  </button>
                </div>
              </div>

              {/* Tree Canvas */}
              <div className="p-5 overflow-x-auto min-h-[460px] bg-gradient-to-b from-card to-background/50">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted text-xs gap-3">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                    <span>Loading team hierarchy tree…</span>
                  </div>
                ) : admins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted">
                    <Shield className="h-10 w-10 mb-2 opacity-40" />
                    <p className="font-semibold text-foreground">No Admin Roots Configured</p>
                    <p className="text-xs max-w-sm mt-1">
                      Assign at least one user as Work Planner Admin in User Manager to establish the root hierarchy.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Root Admins Trees */}
                    <div className="space-y-6">
                      {admins
                        .filter((admin) => {
                          if (!treeSearch.trim()) return true;
                          const q = treeSearch.toLowerCase().trim();
                          return (
                            admin.name?.toLowerCase().includes(q) ||
                            admin.email?.toLowerCase().includes(q)
                          );
                        })
                        .map((admin) => (
                          <TreeNode
                            key={admin._id}
                            user={admin}
                            getDirectReports={getDirectReports}
                            collapsedNodes={collapsedNodes}
                            onToggleCollapse={toggleCollapse}
                            draggedUser={draggedUser}
                            dragOverTargetId={dragOverTargetId}
                            dragOverValid={dragOverValid}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleNodeDragOver}
                            onDragLeave={handleNodeDragLeave}
                            onDrop={handleNodeDrop}
                            onUnmap={handleUnmap}
                            treeSearch={treeSearch}
                          />
                        ))}
                    </div>

                    {/* Standalone / Unassigned Leads Section */}
                    {standaloneLeads.length > 0 && (
                      <div className="pt-6 border-t border-dashed border-border/80">
                        <div className="flex items-center gap-2 mb-4">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span className="text-xs font-bold text-foreground">
                            Standalone Leads (Managers / Coordinators without assigned Admin)
                          </span>
                          <span className="rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
                            {standaloneLeads.length}
                          </span>
                        </div>
                        <div className="space-y-6 pl-2">
                          {standaloneLeads.map((lead) => (
                            <TreeNode
                              key={lead._id}
                              user={lead}
                              getDirectReports={getDirectReports}
                              collapsedNodes={collapsedNodes}
                              onToggleCollapse={toggleCollapse}
                              draggedUser={draggedUser}
                              dragOverTargetId={dragOverTargetId}
                              dragOverValid={dragOverValid}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onDragOver={handleNodeDragOver}
                              onDragLeave={handleNodeDragLeave}
                              onDrop={handleNodeDrop}
                              onUnmap={handleUnmap}
                              treeSearch={treeSearch}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Mapping List View */
            <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
              <h2 className="text-sm font-bold text-foreground mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Active Reporting Edges ({(tree?.edges || []).length})
                </span>
              </h2>
              <div className="space-y-2 max-h-[36rem] overflow-y-auto pr-1">
                {(tree?.edges || []).length === 0 && (
                  <p className="text-xs text-muted py-8 text-center">No reporting relationships established yet.</p>
                )}
                {(tree?.edges || []).map((edge: any) => {
                  const sub = userMap.get(String(edge.subordinate?._id || edge.subordinate));
                  const mgr = userMap.get(String(edge.manager?._id || edge.manager));
                  const subId = String(edge.subordinate?._id || edge.subordinate);
                  const subRole = edge.subordinate_role || sub?.wp_role || "executive";
                  const mgrRole = edge.manager_role || mgr?.wp_role || "manager";

                  return (
                    <div
                      key={subId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-muted/30 hover:bg-surface-muted/60 px-3.5 py-2.5 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 text-xs">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <span>{sub?.name || edge.subordinate?.name || subId}</span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${
                                ROLE_BADGE_STYLES[subRole]?.bg || "bg-surface-muted"
                              } ${ROLE_BADGE_STYLES[subRole]?.text || "text-foreground"} ${
                                ROLE_BADGE_STYLES[subRole]?.border || "border-border"
                              }`}
                            >
                              {ROLE_BADGE_STYLES[subRole]?.label || subRole}
                            </span>
                          </div>
                          <span className="text-3xs text-muted truncate">{sub?.email}</span>
                        </div>

                        <ArrowRight className="h-3.5 w-3.5 text-muted shrink-0" />

                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <span>{mgr?.name || edge.manager?.name || String(edge.manager)}</span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${
                                ROLE_BADGE_STYLES[mgrRole]?.bg || "bg-surface-muted"
                              } ${ROLE_BADGE_STYLES[mgrRole]?.text || "text-foreground"} ${
                                ROLE_BADGE_STYLES[mgrRole]?.border || "border-border"
                              }`}
                            >
                              {ROLE_BADGE_STYLES[mgrRole]?.label || mgrRole}
                            </span>
                          </div>
                          <span className="text-3xs text-muted truncate">{mgr?.email}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        title="Remove mapping"
                        disabled={removing}
                        onClick={() => handleUnmap(subId)}
                        className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10 transition disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Manual Assignment Bar */}
          <form
            onSubmit={handleAssign}
            className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <UserPlus className="h-4 w-4 text-primary" />
              Quick Assign via Form (Alternative to Drag & Drop)
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
              <label className="block text-xs font-semibold text-muted">
                Person (Report)
                <select
                  value={subordinateId}
                  onChange={(e) => {
                    setSubordinateId(e.target.value);
                    setManagerId("");
                  }}
                  className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">Select report…</option>
                  {subordinateOptions.map((u: any) => (
                    <option key={String(u._id)} value={String(u._id)}>
                      {u.name} ({u.wp_role}){u.reports_to ? " — already mapped" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="hidden sm:flex justify-center pb-2 text-muted">
                <ArrowRight className="h-4 w-4" />
              </div>
              <label className="block text-xs font-semibold text-muted">
                Reports To (Manager / Coordinator / Admin)
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  disabled={!subordinateId}
                >
                  <option value="">Select manager…</option>
                  {managerOptions.map((u: any) => (
                    <option key={String(u._id)} value={String(u._id)}>
                      {u.name} ({u.wp_role})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={saving || !subordinateId || !managerId}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition shadow-xs"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Unassigned Pool Tray & Detach Dropzone */}
        <div className="space-y-4">
          {/* Dropzone to Unassign / Detach */}
          <div
            onDragOver={handleUnassignDragOver}
            onDragLeave={handleUnassignDragLeave}
            onDrop={handleUnassignDrop}
            className={`rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-200 ${
              isOverUnassignZone
                ? "border-rose-500 bg-rose-500/10 scale-102 shadow-md ring-2 ring-rose-500/30"
                : draggedUser && draggedUser.reports_to
                ? "border-amber-500/50 bg-amber-500/5 animate-pulse"
                : "border-border bg-surface-muted/40"
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-1.5">
              <div className={`p-2 rounded-xl transition ${isOverUnassignZone ? "bg-rose-500/20 text-rose-600" : "bg-surface-muted text-muted"}`}>
                <UserMinus className="h-5 w-5" />
              </div>
              <h4 className="text-xs font-bold text-foreground">Drop here to Unassign</h4>
              <p className="text-3xs text-muted max-w-xs">
                Drag any mapped subordinate here to remove their reporting relationship and return them to the unassigned pool.
              </p>
            </div>
          </div>

          {/* Unassigned Users Pool Card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span>Unassigned Pool</span>
              </div>
              <span className="rounded-full bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 text-3xs font-extrabold">
                {unassignedManagers.length + unassignedCoordinators.length + unassignedExecutives.length} unassigned
              </span>
            </div>

            {/* Filter & Search */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  value={unassignedSearch}
                  onChange={(e) => setUnassignedSearch(e.target.value)}
                  placeholder="Search unassigned…"
                  className="w-full h-8 rounded-lg border border-border bg-surface-muted pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              {/* Role filter pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-3xs font-semibold">
                <button
                  type="button"
                  onClick={() => setUnassignedRoleFilter("all")}
                  className={`rounded-lg px-2 py-1 transition ${
                    unassignedRoleFilter === "all"
                      ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  All ({unassignedManagers.length + unassignedCoordinators.length + unassignedExecutives.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUnassignedRoleFilter("manager")}
                  className={`rounded-lg px-2 py-1 transition ${
                    unassignedRoleFilter === "manager"
                      ? "bg-emerald-500 text-white font-bold shadow-2xs"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  Mgrs ({unassignedManagers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUnassignedRoleFilter("coordinator")}
                  className={`rounded-lg px-2 py-1 transition ${
                    unassignedRoleFilter === "coordinator"
                      ? "bg-indigo-500 text-white font-bold shadow-2xs"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  Coords ({unassignedCoordinators.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUnassignedRoleFilter("executive")}
                  className={`rounded-lg px-2 py-1 transition ${
                    unassignedRoleFilter === "executive"
                      ? "bg-sky-500 text-white font-bold shadow-2xs"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  Execs ({unassignedExecutives.length})
                </button>
              </div>
            </div>

            {/* Draggable Unassigned List */}
            <div className="space-y-2 max-h-[30rem] overflow-y-auto pr-1">
              {allUnassigned.length === 0 ? (
                <div className="py-8 text-center text-muted text-xs">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                  <p className="font-semibold text-foreground">All members assigned!</p>
                  <p className="text-3xs text-muted mt-0.5">No unassigned users matching filter.</p>
                </div>
              ) : (
                allUnassigned.map((user) => {
                  const roleStyle = ROLE_BADGE_STYLES[user.wp_role] || ROLE_BADGE_STYLES.executive;
                  const isBeingDragged = draggedUser?._id === user._id;

                  return (
                    <div
                      key={user._id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        wp_role: user.wp_role,
                        reports_to: null,
                      })}
                      onDragEnd={handleDragEnd}
                      className={`group flex items-center justify-between gap-2.5 rounded-xl border border-border bg-card p-2.5 transition-all cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-xs ${
                        isBeingDragged ? "opacity-40 scale-95 border-primary" : ""
                      }`}
                      title={`Drag ${user.name} onto a manager or coordinator in the tree`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="h-4 w-4 text-muted group-hover:text-primary transition shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground truncate">
                              {user.name}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                            >
                              {roleStyle.label}
                            </span>
                          </div>
                          <p className="text-3xs text-muted truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center text-muted group-hover:text-primary transition">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tree Node Subcomponent for recursive hierarchy rendering
interface TreeNodeProps {
  user: TreeUser;
  getDirectReports: (id: string) => TreeUser[];
  collapsedNodes: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  draggedUser: DraggedUserState | null;
  dragOverTargetId: string | null;
  dragOverValid: boolean | null;
  onDragStart: (e: React.DragEvent, user: DraggedUserState) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, target: TreeUser) => void;
  onDragLeave: (e: React.DragEvent, targetId: string) => void;
  onDrop: (e: React.DragEvent, target: TreeUser) => void;
  onUnmap: (id: string) => void;
  treeSearch: string;
  level?: number;
}

function TreeNode({
  user,
  getDirectReports,
  collapsedNodes,
  onToggleCollapse,
  draggedUser,
  dragOverTargetId,
  dragOverValid,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onUnmap,
  treeSearch,
  level = 0,
}: TreeNodeProps) {
  const directReports = useMemo(() => getDirectReports(user._id), [getDirectReports, user._id]);
  const isCollapsed = Boolean(collapsedNodes[user._id]);
  const hasChildren = directReports.length > 0;

  const isDragTarget = dragOverTargetId === user._id;
  const isBeingDragged = draggedUser?._id === user._id;

  const roleStyle = ROLE_BADGE_STYLES[user.wp_role] || ROLE_BADGE_STYLES.executive;
  const isDroppableRole = user.wp_role === "admin" || user.wp_role === "manager" || user.wp_role === "coordinator";

  return (
    <div className={`relative ${level > 0 ? "ml-6 sm:ml-8 pl-4 border-l-2 border-border/60" : ""}`}>
      {/* Node Card */}
      <div
        draggable={user.wp_role !== "admin"}
        onDragStart={(e) =>
          onDragStart(e, {
            _id: user._id,
            name: user.name,
            email: user.email,
            wp_role: user.wp_role,
            reports_to: user.reports_to || null,
          })
        }
        onDragEnd={onDragEnd}
        onDragOver={(e) => isDroppableRole && onDragOver(e, user)}
        onDragLeave={() => isDroppableRole && onDragLeave(null as any, user._id)}
        onDrop={(e) => isDroppableRole && onDrop(e, user)}
        className={`group relative inline-flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all duration-200 min-w-[280px] max-w-full ${
          isBeingDragged
            ? "opacity-35 scale-95 border-dashed border-primary"
            : isDragTarget && dragOverValid
            ? "border-emerald-500 bg-emerald-500/10 ring-4 ring-emerald-500/20 scale-102 shadow-lg"
            : isDragTarget && !dragOverValid
            ? "border-rose-500 bg-rose-500/10 ring-4 ring-rose-500/20 scale-102 shadow-lg"
            : "border-border bg-card hover:border-border/90 hover:shadow-xs"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Collapse toggle / Grip */}
          <div className="flex items-center gap-1 shrink-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleCollapse(user._id)}
                className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-surface-muted text-muted hover:text-foreground transition cursor-pointer"
                title={isCollapsed ? "Expand subordinates" : "Collapse subordinates"}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            ) : (
              <div className="w-6 flex justify-center text-muted/40">
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
              </div>
            )}

            {user.wp_role !== "admin" && (
              <GripVertical className="h-4 w-4 text-muted/50 group-hover:text-primary transition cursor-grab active:cursor-grabbing shrink-0" />
            )}
          </div>

          {/* User Info */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-foreground">{user.name}</span>
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${roleStyle.dot}`} />
                {roleStyle.label}
              </span>
              {hasChildren && (
                <span className="rounded-full bg-surface-muted border border-border/80 px-2 py-0.5 text-[9px] font-extrabold text-muted">
                  {directReports.length} {directReports.length === 1 ? "report" : "reports"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-3xs text-muted mt-0.5">
              <span>{user.email}</span>
              {user.department && (
                <>
                  <span>•</span>
                  <span>
                    {typeof user.department === "object" ? (user.department as any)?.name : user.department}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons & Drop Indicator */}
        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
          {isDragTarget && (
            <span
              className={`rounded px-2 py-0.5 text-[9px] font-bold animate-pulse ${
                dragOverValid
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500 text-white"
              }`}
            >
              {dragOverValid ? "Drop to Assign" : "Invalid Drop"}
            </span>
          )}

          {user.wp_role !== "admin" && user.reports_to && (
            <button
              type="button"
              onClick={() => onUnmap(user._id)}
              title="Unassign manager"
              className="rounded-lg p-1.5 text-muted hover:text-rose-500 hover:bg-rose-500/10 transition opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Child Subordinates Branch */}
      {hasChildren && !isCollapsed && (
        <div className="mt-3 space-y-3">
          {directReports.map((child) => (
            <TreeNode
              key={child._id}
              user={child}
              getDirectReports={getDirectReports}
              collapsedNodes={collapsedNodes}
              onToggleCollapse={onToggleCollapse}
              draggedUser={draggedUser}
              dragOverTargetId={dragOverTargetId}
              dragOverValid={dragOverValid}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onUnmap={onUnmap}
              treeSearch={treeSearch}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
