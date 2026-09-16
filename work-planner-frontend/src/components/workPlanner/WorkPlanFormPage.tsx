"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Calendar,
  MapPin,
  FileText,
  User as UserIcon,
  Search,
  ChevronDown,
  Check,
  X,
  Plus,
  Trash2,
  Building2,
  CheckSquare,
  Briefcase,
  Clock,
  Edit3,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  useLazyGetPlanQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useAddVisitMutation,
  useUpdateVisitMutation,
  useRemoveVisitMutation,
  useAddWorkMutation,
  useUpdateWorkMutation,
  useRemoveWorkMutation,
} from "@/store/api/workPlannerApiSlice";
import { isManager, readSessionFromStorage } from "@/utils/authStorage";
import type { WorkPlanRecord, WorkPlanVisitRecord, WorkPlanWorkRecord } from "@/types/workPlanner";
import {
  WORK_PLAN_TYPE_TABS,
  isVisitsPlan,
  isWorkTaskPlan,
  isLeavePlan,
  formatTime,
} from "./workPlanUtils";
import { VisitFormModal } from "./VisitFormModal";
import { WorkFormModal } from "./WorkFormModal";

interface WorkPlanFormPageProps {
  planId?: string;
  copyId?: string;
}

interface ExecutiveUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  department?: string;
  portals?: Array<{
    portal_code?: string;
    portal?: { code?: string };
    code?: string;
    access_roles?: string[];
  }>;
}

function hasWorkPlannerAccess(u: ExecutiveUser, sessionUserId?: string): boolean {
  if (u._id === sessionUserId || u.id === sessionUserId) return true;
  if (u.department === "super_admin") return true;

  if (!Array.isArray(u.portals) || u.portals.length === 0) {
    return false;
  }

  const wpPortal = u.portals.find((p) => {
    const code = p.portal_code || p.portal?.code || p.code;
    return code === "work_planner";
  });

  if (!wpPortal) return false;

  const roles: string[] = Array.isArray(wpPortal.access_roles)
    ? wpPortal.access_roles
    : (wpPortal as any).access_role
      ? [(wpPortal as any).access_role]
      : [];

  if (roles.length === 0) return true;

  return roles.some((r) => {
    const normalized = String(r).toLowerCase().trim();
    return normalized === "executive" || normalized === "manager";
  });
}

export function WorkPlanFormPage({ planId, copyId }: WorkPlanFormPageProps) {
  const router = useRouter();
  const isEditing = Boolean(planId);
  const isCopying = Boolean(copyId) && !isEditing;
  const sessionUser = readSessionFromStorage()?.user;
  const managerRole = isManager(sessionUser);

  const minPlanDate = useMemo(() => {
    if (managerRole) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [managerRole]);

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);

  const [planDate, setPlanDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [planType, setPlanType] = useState<string>("Visits");
  const [location, setLocation] = useState("");
  const [remarks, setRemarks] = useState("");
  const [salesUserId, setSalesUserId] = useState<string>(() => sessionUser?._id || "");
  const [executives, setExecutives] = useState<ExecutiveUser[]>([]);

  // Local state arrays for embedded visits and tasks
  const [visits, setVisits] = useState<Array<Record<string, any>>>([]);
  const [works, setWorks] = useState<Array<Record<string, any>>>([]);

  // Modal states for embedded visits and tasks
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [editingVisitIndex, setEditingVisitIndex] = useState<number | null>(null);

  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [editingWorkIndex, setEditingWorkIndex] = useState<number | null>(null);

  // Discussion with manager state
  const [isDiscussedWithManager, setIsDiscussedWithManager] = useState(false);
  const [discussedManagerId, setDiscussedManagerId] = useState<string>("");
  const [discussedManagerName, setDiscussedManagerName] = useState<string>("");
  const [isCustomManager, setIsCustomManager] = useState(false);
  const [customManagerName, setCustomManagerName] = useState("");
  const [discussionMethod, setDiscussionMethod] = useState<"on_call" | "on_direct_meeting" | "on_email" | "other">("on_call");
  const [managerSearch, setManagerSearch] = useState("");
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const managerDropdownRef = useRef<HTMLDivElement>(null);

  // Search & Combobox states for executive selection
  const [execSearch, setExecSearch] = useState("");
  const [execDropdownOpen, setExecDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExecDropdownOpen(false);
      }
      if (managerDropdownRef.current && !managerDropdownRef.current.contains(event.target as Node)) {
        setManagerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch all users for executive selection (managers) and manager discussion selection (all users)
  const { data: usersData } = useGetUsersQuery();
  const [fetchPlan] = useLazyGetPlanQuery();
  const [createPlanMut] = useCreatePlanMutation();
  const [updatePlanMut] = useUpdatePlanMutation();
  const [addVisitMut] = useAddVisitMutation();
  const [updateVisitMut] = useUpdateVisitMutation();
  const [removeVisitMut] = useRemoveVisitMutation();
  const [addWorkMut] = useAddWorkMutation();
  const [updateWorkMut] = useUpdateWorkMutation();
  const [removeWorkMut] = useRemoveWorkMutation();

  const allUsers = useMemo(() => (usersData as ExecutiveUser[]) || [], [usersData]);

  // Load roster of executives for manager selection
  useEffect(() => {
    if (usersData) {
      setExecutives(usersData as ExecutiveUser[]);
    }
  }, [usersData]);

  useEffect(() => {
    if (!planId) return;
    async function loadPlan() {
      try {
        setLoading(true);
        const plan = await fetchPlan(planId!).unwrap();
        if (plan) {
          if (plan.plan_date) {
            setPlanDate(new Date(plan.plan_date).toISOString().split("T")[0]);
          }
          setPlanType(plan.plan_type || "Visits");
          setLocation(plan.location || "");
          setRemarks(plan.remarks || "");
          if (plan.sales_user) {
            const sUser =
              typeof plan.sales_user === "object"
                ? plan.sales_user._id || plan.sales_user.id
                : plan.sales_user;
            if (sUser) setSalesUserId(String(sUser));
          }

          // Load discussion details
          const isDiscussed = Boolean(plan.is_discussed_with_manager);
          setIsDiscussedWithManager(isDiscussed);
          if (isDiscussed) {
            const mId =
              typeof plan.discussed_manager_id === "object"
                ? plan.discussed_manager_id?._id
                : plan.discussed_manager_id;
            const mName =
              plan.discussed_manager_name ||
              (typeof plan.discussed_manager_id === "object"
                ? plan.discussed_manager_id?.name
                : "") ||
              "";
            if (mId) {
              setDiscussedManagerId(String(mId));
              setDiscussedManagerName(mName);
              setIsCustomManager(false);
              setCustomManagerName("");
            } else if (mName) {
              setDiscussedManagerId("");
              setDiscussedManagerName(mName);
              setIsCustomManager(true);
              setCustomManagerName(mName);
            }
            if (plan.discussion_method) {
              setDiscussionMethod(plan.discussion_method as any);
            }
          } else {
            setDiscussedManagerId("");
            setDiscussedManagerName("");
            setIsCustomManager(false);
            setCustomManagerName("");
            setDiscussionMethod("on_call");
          }

          if (Array.isArray(plan.visits)) {
            setVisits(plan.visits);
          }
          if (Array.isArray(plan.works)) {
            setWorks(plan.works);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load plan details";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    loadPlan();
  }, [planId, fetchPlan]);

  // Load source plan data for copy mode
  useEffect(() => {
    if (!copyId || isEditing) return;
    async function loadSourcePlan() {
      try {
        setLoading(true);
        const plan = await fetchPlan(copyId!).unwrap();
        if (plan) {
          setPlanType(plan.plan_type || "Visits");
          setLocation(plan.location || "");
          setRemarks(plan.remarks || "");
          if (plan.sales_user) {
            const sUser =
              typeof plan.sales_user === "object"
                ? plan.sales_user._id || plan.sales_user.id
                : plan.sales_user;
            if (sUser) setSalesUserId(String(sUser));
          }

          // Discussion state on copy
          const isDiscussed = Boolean(plan.is_discussed_with_manager);
          setIsDiscussedWithManager(isDiscussed);
          if (isDiscussed) {
            const mId =
              typeof plan.discussed_manager_id === "object"
                ? plan.discussed_manager_id?._id
                : plan.discussed_manager_id;
            const mName =
              plan.discussed_manager_name ||
              (typeof plan.discussed_manager_id === "object"
                ? plan.discussed_manager_id?.name
                : "") ||
              "";
            if (mId) {
              setDiscussedManagerId(String(mId));
              setDiscussedManagerName(mName);
              setIsCustomManager(false);
              setCustomManagerName("");
            } else if (mName) {
              setDiscussedManagerId("");
              setDiscussedManagerName(mName);
              setIsCustomManager(true);
              setCustomManagerName(mName);
            }
            if (plan.discussion_method) {
              setDiscussionMethod(plan.discussion_method as any);
            }
          }

          // Copy visits but strip IDs and status so they are created fresh
          if (Array.isArray(plan.visits)) {
            setVisits(
              plan.visits.map((v: any) => {
                const { _id, id, status, check_in_time, check_out_time, outcome, ...rest } = v;
                return { ...rest };
              })
            );
          }
          // Copy works but strip IDs and status so they are created fresh
          if (Array.isArray(plan.works)) {
            setWorks(
              plan.works.map((w: any) => {
                const { _id, id, status, outcome, completion_remarks, ...rest } = w;
                return { ...rest };
              })
            );
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load plan for copying";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    loadSourcePlan();
  }, [copyId, isEditing, fetchPlan]);

  // Filter eligible managers for discussion dropdown
  const eligibleManagers = useMemo(() => {
    const managers = allUsers.filter((u) => {
      if (u.department === "super_admin") return true;
      if ((u as any).role === "admin" || (u as any).role === "super_admin") return true;
      if (Array.isArray(u.portals)) {
        const p = u.portals.find((item) => {
          const code = item.portal_code || item.portal?.code || item.code;
          return code === "work_planner";
        });
        if (p) {
          const roles: string[] = Array.isArray(p.access_roles)
            ? p.access_roles
            : (p as any).access_role
              ? [(p as any).access_role]
              : [];
          return roles.some((r) => {
            const norm = String(r).toLowerCase().trim();
            return norm === "manager" || norm === "admin";
          });
        }
      }
      return false;
    });

    const pool = managers.length > 0 ? managers : allUsers;
    if (!managerSearch.trim()) return pool;
    const q = managerSearch.toLowerCase().trim();
    return pool.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
    );
  }, [allUsers, managerSearch]);

  const selectedManager = useMemo(() => {
    if (!discussedManagerId) return null;
    return allUsers.find((u) => u._id === discussedManagerId || u.id === discussedManagerId) || null;
  }, [discussedManagerId, allUsers]);

  // Filter executives assigned to Work Planner portal + match search query
  const eligibleExecutives = useMemo(() => {
    const list = executives.filter((u) => hasWorkPlannerAccess(u, sessionUser?._id));
    if (!execSearch.trim()) return list;
    const q = execSearch.toLowerCase().trim();
    return list.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
    );
  }, [executives, sessionUser, execSearch]);

  const selectedExecutive = useMemo(() => {
    if (!salesUserId || salesUserId === sessionUser?._id) {
      return {
        _id: sessionUser?._id || "",
        name: `${sessionUser?.name || "Current User"} (Self)`,
        email: sessionUser?.email || "",
        department: sessionUser?.department || "sales",
      };
    }
    return (
      executives.find((u) => u._id === salesUserId || u.id === salesUserId) || {
        _id: salesUserId,
        name: "Selected Executive",
        email: "",
      }
    );
  }, [salesUserId, executives, sessionUser]);

  // Visit modal handlers
  async function handleVisitSubmit(body: Record<string, any>) {
    if (isEditing && planId) {
      try {
        if (editingVisitIndex !== null && visits[editingVisitIndex]?._id) {
          const vId = visits[editingVisitIndex]._id || visits[editingVisitIndex].id;
          await updateVisitMut({ planId, visitId: vId, body }).unwrap();
          toast.success("Visit updated");
        } else {
          await addVisitMut({ planId, body }).unwrap();
          toast.success("Visit added");
        }
        const updatedPlan = await fetchPlan(planId).unwrap();
        setVisits(updatedPlan.visits || []);
      } catch (err: any) {
        toast.error(err?.data?.message || err?.message || "Failed to save visit");
      }
    } else {
      if (editingVisitIndex !== null) {
        setVisits((prev) => {
          const next = [...prev];
          next[editingVisitIndex] = { ...next[editingVisitIndex], ...body };
          return next;
        });
      } else {
        setVisits((prev) => [...prev, body]);
      }
    }
    setVisitModalOpen(false);
    setEditingVisitIndex(null);
  }

  async function handleRemoveVisit(index: number) {
    const v = visits[index];
    if (isEditing && planId && (v?._id || v?.id)) {
      if (!confirm("Are you sure you want to remove this visit?")) return;
      try {
        await removeVisitMut({ planId, visitId: v._id || v.id }).unwrap();
        toast.success("Visit removed");
        const updatedPlan = await fetchPlan(planId).unwrap();
        setVisits(updatedPlan.visits || []);
      } catch (err: any) {
        toast.error(err?.data?.message || err?.message || "Failed to remove visit");
      }
    } else {
      setVisits((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // Work task modal handlers
  async function handleWorkSubmit(body: Record<string, any>) {
    if (isEditing && planId) {
      try {
        if (editingWorkIndex !== null && works[editingWorkIndex]?._id) {
          const wId = works[editingWorkIndex]._id || works[editingWorkIndex].id;
          await updateWorkMut({ planId, workId: wId, body }).unwrap();
          toast.success("Task updated");
        } else {
          await addWorkMut({ planId, body }).unwrap();
          toast.success("Task added");
        }
        const updatedPlan = await fetchPlan(planId).unwrap();
        setWorks(updatedPlan.works || []);
      } catch (err: any) {
        toast.error(err?.data?.message || err?.message || "Failed to save task");
      }
    } else {
      if (editingWorkIndex !== null) {
        setWorks((prev) => {
          const next = [...prev];
          next[editingWorkIndex] = { ...next[editingWorkIndex], ...body };
          return next;
        });
      } else {
        setWorks((prev) => [...prev, body]);
      }
    }
    setWorkModalOpen(false);
    setEditingWorkIndex(null);
  }

  async function handleRemoveWork(index: number) {
    const w = works[index];
    if (isEditing && planId && (w?._id || w?.id)) {
      if (!confirm("Are you sure you want to remove this task?")) return;
      try {
        await removeWorkMut({ planId, workId: w._id || w.id }).unwrap();
        toast.success("Task removed");
        const updatedPlan = await fetchPlan(planId).unwrap();
        setWorks(updatedPlan.works || []);
      } catch (err: any) {
        toast.error(err?.data?.message || err?.message || "Failed to remove task");
      }
    } else {
      setWorks((prev) => prev.filter((_, i) => i !== index));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!planDate) {
      toast.error("Plan date is required");
      return;
    }

    if (!managerRole && minPlanDate && planDate < minPlanDate) {
      toast.error(
        `Executives cannot create or edit work plans for dates earlier than 2 days before today (${minPlanDate}).`
      );
      return;
    }

    if (isDiscussedWithManager) {
      if (isCustomManager) {
        if (!customManagerName.trim()) {
          toast.error("Please enter the custom manager name");
          return;
        }
      } else {
        if (!discussedManagerId && !discussedManagerName.trim()) {
          toast.error("Please select a manager or enter custom manager name");
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload: Partial<WorkPlanRecord> = {
        plan_date: planDate,
        plan_type: planType as WorkPlanRecord["plan_type"],
        location: location.trim(),
        remarks: remarks.trim(),
        is_discussed_with_manager: isDiscussedWithManager,
        discussed_manager_id:
          isDiscussedWithManager && !isCustomManager && discussedManagerId
            ? discussedManagerId
            : undefined,
        discussed_manager_name: isDiscussedWithManager
          ? isCustomManager
            ? customManagerName.trim()
            : selectedManager?.name || discussedManagerName.trim() || undefined
          : undefined,
        discussion_method: isDiscussedWithManager ? discussionMethod : undefined,
        ...(managerRole && salesUserId ? { sales_user: salesUserId } : {}),
      };

      let targetPlanId = planId;
      if (isEditing && planId) {
        await updatePlanMut({ id: planId, body: payload }).unwrap();
      } else {
        const created = await createPlanMut(payload).unwrap();
        targetPlanId = created._id || created.id;
      }

      if (!targetPlanId) {
        throw new Error("Failed to obtain work plan ID");
      }

      // Post initial/unposted visits if plan type is Visits
      if (isVisitsPlan(planType) && visits.length > 0) {
        const unpostedVisits = visits.filter((v) => !v._id && !v.id);
        for (const v of unpostedVisits) {
          const partyObj = typeof v.party === "object" ? v.party : null;
          const visitBody = {
            party_type: v.party_type || (v.party ? "existing" : "new_party"),
            party: partyObj ? partyObj._id || partyObj.id : (typeof v.party === "string" ? v.party : undefined),
            party_name: v.party_name || partyObj?.party_name || "Client Visit",
            contact_person: v.contact_person || "Contact Person",
            contact_number: v.contact_number || "+91 98765 43210",
            contact_email:
              v.contact_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v.contact_email).trim())
                ? String(v.contact_email).trim()
                : `${(v.contact_person || "contact").toLowerCase().replace(/[^a-z0-9]/g, "") || "contact"}@client.com`,
            address: v.address || undefined,
            purpose: v.purpose || undefined,
            notes: v.notes || undefined,
            planned_start_time: v.planned_start_time || undefined,
            planned_end_time: v.planned_end_time || undefined,
          };
          await addVisitMut({ planId: targetPlanId, body: visitBody }).unwrap();
        }
      }

      // Post initial/unposted tasks if plan type is WFH or WFO
      if (isWorkTaskPlan(planType) && works.length > 0) {
        const unpostedWorks = works.filter((w) => !w._id && !w.id);
        for (const w of unpostedWorks) {
          const workBody = {
            title: w.title,
            description: w.description || undefined,
            planned_start_time: w.planned_start_time || undefined,
            planned_end_time: w.planned_end_time || undefined,
          };
          await addWorkMut({ planId: targetPlanId, body: workBody }).unwrap();
        }
      }

      toast.success(isEditing ? "Work plan updated successfully" : "Work plan created successfully");
      router.push(`/dashboard/plans/${targetPlanId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save work plan";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted font-sans">
        Loading work plan details…
      </div>
    );
  }

  const visitsType = isVisitsPlan(planType);
  const tasksType = isWorkTaskPlan(planType);
  const leaveType = isLeavePlan(planType);

  return (
    <div className="mx-auto max-w-3xl space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/plans"
            className="rounded-lg border border-border p-2 text-muted hover:bg-surface-muted hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {isEditing ? "Edit Work Plan" : isCopying ? "Copy Work Plan" : "Create Work Plan"}
            </h1>
            <p className="text-xs text-muted">
              {isEditing
                ? "Update plan dates, executive, location, remarks, visits or tasks"
                : isCopying
                ? "Creating a new work plan from a copied template — adjust date, visits, and tasks as needed"
                : "Schedule a new work plan with initial visits or tasks"}
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Executive Selection with Search (Manager only) */}
          {managerRole && (
            <div className="sm:col-span-2 relative" ref={dropdownRef}>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-foreground">
                <span>
                  Assigned Executive / User <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] font-normal text-muted">
                  Showing users assigned to Work Planner Portal (Executive / Manager)
                </span>
              </label>

              {/* Trigger Button / Display field */}
              <button
                type="button"
                onClick={() => setExecDropdownOpen((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-xs font-medium text-foreground outline-none focus:border-primary transition hover:bg-surface-muted/80"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-left truncate">
                    <span className="font-semibold text-foreground">
                      {selectedExecutive.name}
                    </span>
                    {selectedExecutive.email && (
                      <span className="text-muted ml-1.5 text-[11px]">
                        ({selectedExecutive.email})
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${execDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Card */}
              {execDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg p-2 space-y-2">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search executive by name, email, department..."
                      value={execSearch}
                      onChange={(e) => setExecSearch(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-muted pl-8 pr-8 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary"
                    />
                    {execSearch && (
                      <button
                        type="button"
                        onClick={() => setExecSearch("")}
                        className="absolute right-2.5 top-2 text-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* List of eligible executives */}
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {eligibleExecutives.length === 0 ? (
                      <p className="p-3 text-center text-xs text-muted">
                        No executives found matching &ldquo;{execSearch}&rdquo; with Work Planner portal access.
                      </p>
                    ) : (
                      eligibleExecutives.map((u) => {
                        const uId = u._id || u.id || "";
                        const isSelf = uId === sessionUser?._id;
                        const isSelected = uId === salesUserId || (isSelf && salesUserId === sessionUser?._id);
                        return (
                          <button
                            key={uId}
                            type="button"
                            onClick={() => {
                              setSalesUserId(uId);
                              setExecDropdownOpen(false);
                              setExecSearch("");
                            }}
                            className={`w-full flex items-center justify-between rounded-lg p-2 text-xs text-left transition ${isSelected
                                ? "bg-primary/10 text-primary font-semibold"
                                : "hover:bg-surface-muted text-foreground"
                              }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <div
                                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-surface-muted text-muted"
                                  }`}
                              >
                                {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                              </div>
                              <div className="truncate">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-foreground">
                                    {u.name}
                                  </span>
                                  {isSelf && (
                                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                      Self
                                    </span>
                                  )}
                                  {u.department && (
                                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                                      {u.department}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted truncate">{u.email}</p>
                              </div>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-2" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Plan Date */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Plan Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="date"
                required
                value={planDate}
                min={minPlanDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
              />
            </div>
            {!managerRole && minPlanDate && (
              <p className="mt-1 text-[11px] text-muted font-medium">
                ℹ️ Executives can schedule work plans from {minPlanDate} onwards (up to 2 days prior to today).
              </p>
            )}
          </div>

          {/* Plan Type */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Plan Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={planType}
              onChange={(e) => {
                const val = e.target.value;
                setPlanType(val);
                if (val === "Work From Home" && !location) setLocation("Remote / Work From Home");
                else if (val === "Work From Office" && !location) setLocation("Head Office / Branch Office");
                else if (val === "Leave") setLocation("");
              }}
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              {WORK_PLAN_TYPE_TABS.filter((t) => t.id !== "all").map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Location (optional on Leave) */}
        {!leaveType && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Target Location / City
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder={
                  planType === "Work From Home"
                    ? "e.g. Work From Home / Remote Location"
                    : planType === "Work From Office"
                      ? "e.g. Main Office / Branch Office"
                      : "e.g. Mumbai Metro Area, Sector 18 Noida"
                }
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {/* Remarks / Objectives */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">
            {leaveType ? "Leave Reason & Remarks" : "Remarks & Objectives"}
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted" />
            <textarea
              rows={3}
              placeholder={
                leaveType
                  ? "Reason for leave (casual, medical, vacation, etc.)..."
                  : tasksType
                    ? "Key internal tasks, documentation, or team objectives planned..."
                    : "Key visit objectives, client targets, or meeting details..."
              }
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Manager Discussion Section */}
        <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDiscussedWithManager}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsDiscussedWithManager(checked);
                  if (!checked) {
                    setDiscussedManagerId("");
                    setDiscussedManagerName("");
                    setIsCustomManager(false);
                    setCustomManagerName("");
                  }
                }}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Is this Plan discussed with the Manager?
                </span>
              </div>
            </label>
            {isDiscussedWithManager && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                Discussion Logged
              </span>
            )}
          </div>

          {isDiscussedWithManager && (
            <div className="pt-2 border-t border-border/60 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Manager Selection: Search & Select or Custom */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Discussed Manager <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomManager(!isCustomManager);
                        if (!isCustomManager) {
                          setDiscussedManagerId("");
                        } else {
                          setCustomManagerName("");
                        }
                      }}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      {isCustomManager ? "← Select from List" : "+ Custom Manager"}
                    </button>
                  </div>

                  {isCustomManager ? (
                    <input
                      type="text"
                      placeholder="Enter manager's name..."
                      value={customManagerName}
                      onChange={(e) => setCustomManagerName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                      required
                    />
                  ) : (
                    <div className="relative" ref={managerDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setManagerDropdownOpen(!managerDropdownOpen)}
                        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-left text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                      >
                        <div className="truncate">
                          {selectedManager ? (
                            <span className="font-semibold text-foreground">
                              {selectedManager.name}{" "}
                              <span className="text-[11px] font-normal text-muted">
                                ({selectedManager.department || selectedManager.email})
                              </span>
                            </span>
                          ) : discussedManagerName ? (
                            <span className="font-semibold text-foreground">{discussedManagerName}</span>
                          ) : (
                            <span className="text-muted">Search &amp; select manager...</span>
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted shrink-0 ml-2" />
                      </button>

                      {managerDropdownOpen && (
                        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-xl">
                          <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                            <input
                              type="text"
                              placeholder="Search manager by name or email..."
                              value={managerSearch}
                              onChange={(e) => setManagerSearch(e.target.value)}
                              className="w-full rounded-lg border border-border bg-surface-muted pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {eligibleManagers.length === 0 ? (
                              <div className="p-3 text-center text-xs text-muted">
                                No managers found
                              </div>
                            ) : (
                              eligibleManagers.map((u) => {
                                const isSelected =
                                  (u._id || u.id) === discussedManagerId;
                                return (
                                  <button
                                    key={u._id || u.id}
                                    type="button"
                                    onClick={() => {
                                      setDiscussedManagerId(u._id || u.id || "");
                                      setDiscussedManagerName(u.name || "");
                                      setManagerDropdownOpen(false);
                                    }}
                                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                                      isSelected
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-foreground hover:bg-surface-muted"
                                    }`}
                                  >
                                    <div className="truncate">
                                      <div className="font-semibold">{u.name}</div>
                                      <div className="text-[11px] text-muted truncate">{u.email}</div>
                                    </div>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                          <div className="border-t border-border mt-2 pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomManager(true);
                                setDiscussedManagerId("");
                                setManagerDropdownOpen(false);
                              }}
                              className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-primary hover:bg-primary/10 transition"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Enter Custom Manager Name...</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Discussion Method */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Method of Discussion <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={discussionMethod}
                    onChange={(e) => setDiscussionMethod(e.target.value as any)}
                    className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                  >
                    <option value="on_call">On Call</option>
                    <option value="on_direct_meeting">On Direct Meeting</option>
                    <option value="on_email">On Email</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Embedded Section: Field Visits (if Plan Type is Visits) */}
        {visitsType && (
          <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground">
                  Planned Visits ({visits.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingVisitIndex(null);
                  setVisitModalOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Visit
              </button>
            </div>

            {visits.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">
                No visits added yet. Click &ldquo;Add Visit&rdquo; to add party visits for this plan date.
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {visits.map((v, idx) => {
                  const partyName =
                    v.party_name ||
                    (typeof v.party === "object" && v.party?.party_name) ||
                    "Party Visit";
                  return (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted shrink-0" />
                          <span className="text-xs font-bold text-foreground truncate">
                            {partyName}
                          </span>
                        </div>
                        {v.purpose && (
                          <p className="text-[11px] text-muted line-clamp-1">
                            Purpose: {v.purpose}
                          </p>
                        )}
                        {(v.contact_person || v.phone) && (
                          <p className="text-[11px] text-foreground font-medium">
                            {v.contact_person} {v.phone ? `(${v.phone})` : ""}
                          </p>
                        )}
                        {v.planned_start_time && (
                          <p className="text-[10px] text-muted flex items-center gap-1 font-medium">
                            <Clock className="h-3 w-3" />
                            {formatTime(v.planned_start_time)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVisitIndex(idx);
                            setVisitModalOpen(true);
                          }}
                          className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                          title="Edit visit"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveVisit(idx)}
                          className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                          title="Remove visit"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Embedded Section: Work Tasks (if Plan Type is WFH or WFO) */}
        {tasksType && (
          <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground">
                  Planned Tasks ({works.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingWorkIndex(null);
                  setWorkModalOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Task
              </button>
            </div>

            {works.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">
                No work tasks added yet. Click &ldquo;Add Task&rdquo; to add tasks for this plan date.
              </p>
            ) : (
              <div className="space-y-2">
                {works.map((w, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Briefcase className="h-4 w-4 text-muted shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-bold text-foreground block truncate">
                          {w.title}
                        </span>
                        {w.description && (
                          <p className="text-[11px] text-muted truncate">{w.description}</p>
                        )}
                        {w.planned_start_time && (
                          <p className="text-[10px] text-muted flex items-center gap-1 font-medium mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formatTime(w.planned_start_time)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorkIndex(idx);
                          setWorkModalOpen(true);
                        }}
                        className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                        title="Edit task"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveWork(idx)}
                        className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                        title="Remove task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Embedded Section: Leave Banner */}
        {leaveType && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1 text-xs">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
              <Calendar className="h-4 w-4" />
              <span>Leave Application</span>
            </div>
            <p className="text-muted">
              This plan will be submitted as leave for the selected date. No field visits or office tasks will be scheduled.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/dashboard/plans"
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition shadow-xs"
          >
            <Save className="h-4 w-4" />
            {submitting ? "Saving…" : isEditing ? "Update Plan" : "Create Plan"}
          </button>
        </div>
      </form>

      {/* Embedded Modals for adding/editing visits and tasks */}
      {visitModalOpen && (
        <VisitFormModal
          open={visitModalOpen}
          mode={editingVisitIndex !== null ? "edit" : "create"}
          initial={editingVisitIndex !== null ? (visits[editingVisitIndex] as WorkPlanVisitRecord) : null}
          planDate={planDate}
          salesUserId={salesUserId || sessionUser?._id}
          isSaving={false}
          onClose={() => {
            setVisitModalOpen(false);
            setEditingVisitIndex(null);
          }}
          onSubmit={handleVisitSubmit}
        />
      )}

      {workModalOpen && (
        <WorkFormModal
          open={workModalOpen}
          mode={editingWorkIndex !== null ? "edit" : "create"}
          initial={editingWorkIndex !== null ? (works[editingWorkIndex] as WorkPlanWorkRecord) : null}
          planDate={planDate}
          isSaving={false}
          onClose={() => {
            setWorkModalOpen(false);
            setEditingWorkIndex(null);
          }}
          onSubmit={handleWorkSubmit}
        />
      )}
    </div>
  );
}

export default WorkPlanFormPage;
