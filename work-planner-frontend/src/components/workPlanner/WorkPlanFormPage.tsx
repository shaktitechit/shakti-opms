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
  Mail,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  useLazyGetPlanQuery,
  useLazyGetPlansQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useSubmitPlanMutation,
  useAddVisitMutation,
  useUpdateVisitMutation,
  useRemoveVisitMutation,
  useAddWorkMutation,
  useUpdateWorkMutation,
  useRemoveWorkMutation,
  useGetUserSettingsQuery,
} from "@/store/api/workPlannerApiSlice";
import { isManager, readSessionFromStorage } from "@/utils/authStorage";
import { getUserWorkPlannerSettings } from "@/utils/userWorkPlannerSettings";
import type { WorkPlanRecord, WorkPlanVisitRecord, WorkPlanWorkRecord } from "@/types/workPlanner";
import {
  WORK_PLAN_TYPE_TABS,
  isVisitsPlan,
  isWorkTaskPlan,
  isLeavePlan,
  isPlanDate3DaysExpired,
  formatTime,
  renderVisitStatusBadge,
  renderWorkStatusBadge,
} from "./workPlanUtils";
import { VisitFormModal } from "./VisitFormModal";
import { WorkFormModal } from "./WorkFormModal";
import { WorkPlanCreateMailModal, type CreateEmailPayload } from "./WorkPlanCreateMailModal";
import { SelectPreviousPendingItemsModal } from "./SelectPreviousPendingItemsModal";

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

function hasWorkPlannerManagerAccess(u: ExecutiveUser): boolean {
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

  return roles.some((r) => String(r).toLowerCase().trim() === "manager");
}

export function WorkPlanFormPage({ planId, copyId }: WorkPlanFormPageProps) {
  const router = useRouter();
  const [existingPlanId, setExistingPlanId] = useState<string | null>(planId || null);
  const [detectedPlan, setDetectedPlan] = useState<WorkPlanRecord | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const isPlanCompleted = planStatus === "completed" || detectedPlan?.status === "completed";

  const activePlanId = existingPlanId || planId;
  const isEditing = Boolean(activePlanId);
  const isCopying = Boolean(copyId) && !isEditing;
  const sessionUser = readSessionFromStorage()?.user;
  const managerRole = isManager(sessionUser);
  const prevFetchedKey = useRef<string>("");

  const minPlanDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const [loading, setLoading] = useState(Boolean(planId));
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

  // Modal state for selecting previous pending/in-progress items
  const [previousModalMode, setPreviousModalMode] = useState<"visits" | "tasks" | null>(null);

  // Creation Email Panel Modal state
  const [createMailModalOpen, setCreateMailModalOpen] = useState(false);
  const [pendingPlanData, setPendingPlanData] = useState<{
    payload: Partial<WorkPlanRecord>;
    visits: Array<Record<string, any>>;
    works: Array<Record<string, any>>;
    displayPlan: WorkPlanRecord;
  } | null>(null);

  // Discussion with manager state
  const [isDiscussedWithManager, setIsDiscussedWithManager] = useState(false);
  const [discussedManagerId, setDiscussedManagerId] = useState<string>("");
  const [discussedManagerName, setDiscussedManagerName] = useState<string>("");
  const [isCustomManager, setIsCustomManager] = useState(false);
  const [customManagerName, setCustomManagerName] = useState("");
  const [discussionMethod, setDiscussionMethod] = useState<"on_call" | "on_direct_meeting" | "on_email" | "other">("on_call");
  const [managerSearch, setManagerSearch] = useState("");
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
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
  const [lazyGetPlans] = useLazyGetPlansQuery();
  const [createPlanMut] = useCreatePlanMutation();
  const [updatePlanMut] = useUpdatePlanMutation();
  const [submitPlanMut] = useSubmitPlanMutation();
  const [addVisitMut] = useAddVisitMutation();
  const [updateVisitMut] = useUpdateVisitMutation();
  const [removeVisitMut] = useRemoveVisitMutation();
  const [addWorkMut] = useAddWorkMutation();
  const [updateWorkMut] = useUpdateWorkMutation();
  const [removeWorkMut] = useRemoveWorkMutation();

  // Fetch Target User Work Planner Settings (Manager assignments & custom task templates)
  const targetUserId = salesUserId || sessionUser?._id || "";
  const { data: dbUserSettings } = useGetUserSettingsQuery(targetUserId, { skip: !targetUserId });

  const effectiveSettings = useMemo(() => {
    if (dbUserSettings) return dbUserSettings;
    if (targetUserId) return getUserWorkPlannerSettings(targetUserId);
    return null;
  }, [dbUserSettings, targetUserId]);

  const allUsers = useMemo(() => (usersData as ExecutiveUser[]) || [], [usersData]);

  // Resolve assigned manager for current plan type (or fallback to global default manager)
  const assignedPlanTypeManager = useMemo(() => {
    if (!effectiveSettings) return null;
    const pts = effectiveSettings.planTypeSettings?.[planType];
    const mgrId = pts?.assignedManagerId;
    const mgrName = pts?.assignedManagerName;
    const mgrEmail = pts?.assignedManagerEmail;

    if (mgrId || mgrName) {
      const matched = allUsers.find(
        (u) => String(u._id || u.id || "") === String(mgrId)
      );
      if (matched) {
        return {
          _id: String(matched._id || matched.id || ""),
          name: matched.name,
          email: matched.email,
          department: matched.department,
          isSpecificPlanType: true,
        };
      }
      if (mgrName) {
        return {
          _id: mgrId || "",
          name: mgrName,
          email: mgrEmail || "",
          department: "",
          isSpecificPlanType: true,
        };
      }
    }

    // Fallback to global default manager
    const globalId = effectiveSettings.assignedManagerId;
    const globalName = effectiveSettings.assignedManagerName;
    const globalEmail = effectiveSettings.assignedManagerEmail;

    if (globalId || globalName) {
      const matched = allUsers.find(
        (u) => String(u._id || u.id || "") === String(globalId)
      );
      if (matched) {
        return {
          _id: String(matched._id || matched.id || ""),
          name: matched.name,
          email: matched.email,
          department: matched.department,
          isSpecificPlanType: false,
        };
      }
      if (globalName) {
        return {
          _id: globalId || "",
          name: globalName,
          email: globalEmail || "",
          department: "",
          isSpecificPlanType: false,
        };
      }
    }

    return null;
  }, [effectiveSettings, planType, allUsers]);

  const currentDisplayedManager = useMemo(() => {
    if (isCustomManager && customManagerName) {
      return {
        name: customManagerName,
        email: "Custom Manager",
        badgeText: "Custom Manager",
        isSpecificPlanType: false,
      };
    }

    if (discussedManagerId) {
      const matched = allUsers.find(
        (u) => String(u._id || u.id || "") === String(discussedManagerId)
      );
      if (matched) {
        const isPlanTypeMgr =
          assignedPlanTypeManager?.isSpecificPlanType &&
          String(assignedPlanTypeManager._id) === String(matched._id || matched.id);
        const isDefaultMgr =
          !assignedPlanTypeManager?.isSpecificPlanType &&
          assignedPlanTypeManager?._id &&
          String(assignedPlanTypeManager._id) === String(matched._id || matched.id);

        return {
          name: matched.name,
          email: matched.email,
          badgeText: isPlanTypeMgr
            ? `${planType} Manager`
            : isDefaultMgr
            ? "Default Manager"
            : "Assigned Manager",
          isSpecificPlanType: isPlanTypeMgr,
        };
      }
    }

    if (discussedManagerName) {
      const isPlanTypeMgr =
        assignedPlanTypeManager?.isSpecificPlanType &&
        assignedPlanTypeManager.name === discussedManagerName;
      const isDefaultMgr =
        !assignedPlanTypeManager?.isSpecificPlanType &&
        assignedPlanTypeManager?.name === discussedManagerName;

      return {
        name: discussedManagerName,
        email: "Reporting Manager",
        badgeText: isPlanTypeMgr
          ? `${planType} Manager`
          : isDefaultMgr
          ? "Default Manager"
          : "Discussed Manager",
        isSpecificPlanType: isPlanTypeMgr,
      };
    }

    if (assignedPlanTypeManager) {
      return {
        name: assignedPlanTypeManager.name,
        email: assignedPlanTypeManager.email || "Reporting Manager configured in User Settings",
        badgeText: assignedPlanTypeManager.isSpecificPlanType
          ? `${planType} Manager`
          : "Default Manager",
        isSpecificPlanType: assignedPlanTypeManager.isSpecificPlanType,
      };
    }

    return null;
  }, [
    discussedManagerId,
    discussedManagerName,
    isCustomManager,
    customManagerName,
    assignedPlanTypeManager,
    allUsers,
    planType,
  ]);

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
          setPlanStatus(plan.status || null);
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
          setPlanStatus(null);
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

          const isSourceExpired = isPlanDate3DaysExpired(plan.plan_date);

          // When copying: if plan is within 3 days and item is uncompleted, reassign it; if plan > 3 days old or item is completed, create new
          if (Array.isArray(plan.visits)) {
            setVisits(
              plan.visits.map((v: any) => {
                if (!isSourceExpired && v.status !== "completed") {
                  return { ...v };
                }
                const { _id, id, status, check_in_time, check_out_time, outcome, ...rest } = v;
                return { ...rest };
              })
            );
          }
          if (Array.isArray(plan.works)) {
            setWorks(
              plan.works.map((w: any) => {
                if (!isSourceExpired && w.status !== "completed") {
                  return { ...w };
                }
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

  // Effect: Auto-fetch existing work plan for selected date and target executive if already created
  useEffect(() => {
    if (planId || copyId || !planDate || !targetUserId) return;

    const currentKey = `${planDate}_${targetUserId}`;
    if (prevFetchedKey.current === currentKey) return;

    let isMounted = true;
    async function checkPlanForSelectedDate() {
      try {
        setCheckingExisting(true);
        const res = await lazyGetPlans({
          date: planDate,
          sales_user: targetUserId,
          limit: 1,
        }).unwrap();

        if (!isMounted) return;

        const foundPlans = res?.data || [];
        if (foundPlans.length > 0) {
          const found = foundPlans[0];
          const foundId = String(found._id || found.id || "").trim();
          if (!foundId) return;
          prevFetchedKey.current = currentKey;

          // Fetch full plan with visits & works
          const fullPlan = await fetchPlan(foundId).unwrap();
          if (!isMounted) return;

          setExistingPlanId(foundId);
          setDetectedPlan(fullPlan);
          setPlanStatus(fullPlan.status || found.status || null);

          if (fullPlan.plan_date) {
            setPlanDate(new Date(fullPlan.plan_date).toISOString().split("T")[0]);
          }
          setPlanType(fullPlan.plan_type || "Visits");
          setLocation(fullPlan.location || "");
          setRemarks(fullPlan.remarks || "");

          if (fullPlan.sales_user) {
            const sUser =
              typeof fullPlan.sales_user === "object"
                ? fullPlan.sales_user._id || fullPlan.sales_user.id
                : fullPlan.sales_user;
            if (sUser) setSalesUserId(String(sUser));
          }

          // Discussion state
          const isDiscussed = Boolean(fullPlan.is_discussed_with_manager);
          setIsDiscussedWithManager(isDiscussed);
          if (isDiscussed) {
            const mId =
              typeof fullPlan.discussed_manager_id === "object"
                ? fullPlan.discussed_manager_id?._id
                : fullPlan.discussed_manager_id;
            const mName =
              fullPlan.discussed_manager_name ||
              (typeof fullPlan.discussed_manager_id === "object"
                ? fullPlan.discussed_manager_id?.name
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
            if (fullPlan.discussion_method) {
              setDiscussionMethod(fullPlan.discussion_method as any);
            }
          } else {
            setDiscussedManagerId("");
            setDiscussedManagerName("");
            setIsCustomManager(false);
            setCustomManagerName("");
            setDiscussionMethod("on_call");
          }

          if (Array.isArray(fullPlan.visits)) {
            setVisits(fullPlan.visits);
          } else {
            setVisits([]);
          }
          if (Array.isArray(fullPlan.works)) {
            setWorks(fullPlan.works);
          } else {
            setWorks([]);
          }

          if (fullPlan.status === "completed") {
            toast.error(`Work plan for ${planDate} is Completed. No editing or updating allowed.`, {
              id: `completed-plan-${foundId}`,
            });
          } else {
            toast.info(`Existing work plan found for ${planDate}. Loaded plan for Update & Mail.`, {
              id: `existing-plan-${foundId}`,
            });
          }
        } else {
          // No existing plan for this date -> reset if we previously auto-detected one
          prevFetchedKey.current = currentKey;
          if (existingPlanId && !planId) {
            setExistingPlanId(null);
            setDetectedPlan(null);
            setPlanStatus(null);
            setLocation("");
            setRemarks("");
            setVisits([]);
            setWorks([]);
            toast.info(`No existing work plan found for ${planDate}. Switched to Create Work Plan mode.`);
          }
        }
      } catch (err) {
        console.error("Error checking existing plan by date:", err);
      } finally {
        if (isMounted) setCheckingExisting(false);
      }
    }

    checkPlanForSelectedDate();
  }, [planDate, targetUserId, planId, copyId, lazyGetPlans, fetchPlan, existingPlanId]);

  // Effect 1: Auto-populate custom work tasks when creating a new plan for Work From Home or Work From Office
  useEffect(() => {
    if (isEditing || isCopying) return;
    if (isWorkTaskPlan(planType)) {
      const templates = effectiveSettings?.customWorkTemplates || [];
      if (templates.length > 0) {
        const loadedWorks = templates.map((t: any, idx: number) => ({
          sequence: idx + 1,
          title: t.title,
          description: t.description || "",
          planned_start_time: t.planned_start_time || "",
          planned_end_time: t.planned_end_time || "",
          work_type: t.work_type || "default",
          is_template_task: true,
          status: "created",
        }));
        setWorks(loadedWorks);
      } else {
        setWorks([]);
      }
    }
  }, [planType, effectiveSettings, isEditing, isCopying]);

  // Effect 2: Default "Discussed with Manager" to the plan type manager (or global default manager)
  useEffect(() => {
    if (isEditing) return;
    if (assignedPlanTypeManager) {
      setIsDiscussedWithManager(true);
      setIsCustomManager(false);
      setCustomManagerName("");
      setDiscussedManagerId(assignedPlanTypeManager._id || "");
      setDiscussedManagerName(assignedPlanTypeManager.name || "");
      setShowManagerPicker(false);
    }
  }, [planType, assignedPlanTypeManager, isEditing]);

  // Filter eligible managers for discussion dropdown: strictly only users assigned to work_planner portal with manager access
  const eligibleManagers = useMemo(() => {
    const managers = allUsers.filter(hasWorkPlannerManagerAccess);
    if (!managerSearch.trim()) return managers;
    const q = managerSearch.toLowerCase().trim();
    return managers.filter(
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

  function isManagerCreatedItem(item?: Record<string, any>): boolean {
    if (!item) return false;
    const role = String(item.created_by_role || "").toLowerCase().trim();
    return ["manager", "admin", "super_admin", "super admin"].includes(role);
  }

  // Visit modal handlers
  async function handleVisitSubmit(body: Record<string, any>) {
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be edited.");
      return;
    }
    if (isEditing && activePlanId) {
      try {
        if (editingVisitIndex !== null && visits[editingVisitIndex]?._id) {
          const vId = visits[editingVisitIndex]._id || visits[editingVisitIndex].id;
          await updateVisitMut({ planId: activePlanId, visitId: vId, body }).unwrap();
          toast.success("Visit updated");
        } else {
          await addVisitMut({ planId: activePlanId, body }).unwrap();
          toast.success("Visit added");
        }
        const updatedPlan = await fetchPlan(activePlanId).unwrap();
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
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be edited.");
      return;
    }
    const v = visits[index];
    if (!v) return;
    if (!managerRole && isManagerCreatedItem(v)) {
      toast.error("Visits created by a Manager cannot be removed by Executives.");
      return;
    }
    if (isEditing && activePlanId && (v?._id || v?.id)) {
      if (!confirm("Are you sure you want to remove this visit?")) return;
      try {
        await removeVisitMut({ planId: activePlanId, visitId: v._id || v.id }).unwrap();
        toast.success("Visit removed");
        const updatedPlan = await fetchPlan(activePlanId).unwrap();
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
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be edited.");
      return;
    }
    if (isEditing && activePlanId) {
      try {
        if (editingWorkIndex !== null && works[editingWorkIndex]?._id) {
          const wId = works[editingWorkIndex]._id || works[editingWorkIndex].id;
          await updateWorkMut({ planId: activePlanId, workId: wId, body }).unwrap();
          toast.success("Task updated");
        } else {
          await addWorkMut({ planId: activePlanId, body }).unwrap();
          toast.success("Task added");
        }
        const updatedPlan = await fetchPlan(activePlanId).unwrap();
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
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be edited.");
      return;
    }
    const w = works[index];
    if (!w) return;
    const isDefaultTask = w.work_type === "default" || w.is_default_task;
    if (isDefaultTask) {
      toast.error("Default work tasks cannot be removed.");
      return;
    }
    if (!managerRole && isManagerCreatedItem(w)) {
      toast.error("Tasks created by a Manager cannot be removed by Executives.");
      return;
    }
    if (isEditing && activePlanId && (w?._id || w?.id)) {
      if (!confirm("Are you sure you want to remove this task?")) return;
      try {
        await removeWorkMut({ planId: activePlanId, workId: w._id || w.id }).unwrap();
        toast.success("Task removed");
        const updatedPlan = await fetchPlan(activePlanId).unwrap();
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
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be created or updated.");
      return;
    }
    if (!planDate) {
      toast.error("Plan date is required");
      return;
    }

    if (minPlanDate && planDate < minPlanDate) {
      toast.error(
        `Work plans cannot be created or edited for dates earlier than 2 days before today (${minPlanDate}).`
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

      const selectedExec = managerRole && salesUserId
        ? executives.find((e) => e._id === salesUserId || e.id === salesUserId)
        : sessionUser;

      const draftRecord: WorkPlanRecord = {
        _id: activePlanId || undefined,
        plan_date: planDate,
        plan_type: planType as WorkPlanRecord["plan_type"],
        location: location.trim(),
        remarks: remarks.trim(),
        is_discussed_with_manager: isDiscussedWithManager,
        discussed_manager_id:
          isDiscussedWithManager && !isCustomManager && selectedManager
            ? ({ _id: selectedManager._id, name: selectedManager.name, email: selectedManager.email } as any)
            : discussedManagerId || undefined,
        discussed_manager_name: isDiscussedWithManager
          ? isCustomManager
            ? customManagerName.trim()
            : selectedManager?.name || discussedManagerName.trim() || undefined
          : undefined,
        discussion_method: isDiscussedWithManager ? discussionMethod : undefined,
        sales_user: selectedExec as any,
        status: "planned",
        visits: visits.map((v, idx) => ({
          sequence: idx + 1,
          party_name: v.party_name || (typeof v.party === "object" ? v.party?.party_name : undefined) || "Client Visit",
          contact_person: v.contact_person,
          contact_number: v.contact_number,
          address: v.address,
          planned_start_time: v.planned_start_time,
          status: v.status || "created",
          created_by_role: v.created_by_role,
        })),
        works: works.map((w, idx) => ({
          sequence: idx + 1,
          title: w.title,
          description: w.description,
          planned_start_time: w.planned_start_time,
          status: w.status || "created",
          created_by_role: w.created_by_role,
        })),
      };

      setPendingPlanData({
        payload,
        visits,
        works,
        displayPlan: draftRecord,
      });
      setCreateMailModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to prepare work plan";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAndSendEmail(emailPayload: CreateEmailPayload) {
    if (!pendingPlanData) return;
    if (isPlanCompleted) {
      toast.error("This work plan is completed and cannot be updated.");
      return;
    }
    setSubmitting(true);
    try {
      let targetPlanId = activePlanId;

      if (isEditing && targetPlanId) {
        // Update existing plan
        await updatePlanMut({ id: targetPlanId, body: pendingPlanData.payload }).unwrap();

        // Post unposted or reassigned visits
        if (isVisitsPlan(pendingPlanData.payload.plan_type || "") && pendingPlanData.visits.length > 0) {
          const visitsToPost = pendingPlanData.visits.filter(
            (v) => !v._id && !v.id || (v.work_plan && String(v.work_plan) !== String(targetPlanId))
          );
          for (const v of visitsToPost) {
            const partyObj = typeof v.party === "object" ? v.party : null;
            const resolvedPartyType = v.party_type || (v.party ? "existing" : "new_party");
            const partyId = partyObj ? partyObj._id || partyObj.id : (typeof v.party === "string" ? v.party : undefined);
            const visitBody: any = {
              ...(v._id || v.id ? { _id: v._id || v.id } : {}),
              party_type: resolvedPartyType,
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
            if (resolvedPartyType === "existing" && partyId) {
              visitBody.party = partyId;
            }
            await addVisitMut({ planId: targetPlanId, body: visitBody }).unwrap();
          }
        }

        // Post unposted or reassigned tasks
        if (isWorkTaskPlan(pendingPlanData.payload.plan_type || "") && pendingPlanData.works.length > 0) {
          const worksToPost = pendingPlanData.works.filter(
            (w) => !w._id && !w.id || (w.work_plan && String(w.work_plan) !== String(targetPlanId))
          );
          for (const w of worksToPost) {
            const workBody = {
              ...(w._id || w.id ? { _id: w._id || w.id } : {}),
              title: w.title,
              description: w.description || undefined,
              planned_start_time: w.planned_start_time || undefined,
              planned_end_time: w.planned_end_time || undefined,
            };
            await addWorkMut({ planId: targetPlanId, body: workBody }).unwrap();
          }
        }
      } else {
        // Create new plan
        const created = await createPlanMut(pendingPlanData.payload).unwrap();
        targetPlanId = created._id || created.id;
        if (!targetPlanId) throw new Error("Failed to obtain work plan ID");

        // Post visits
        if (isVisitsPlan(pendingPlanData.payload.plan_type || "") && pendingPlanData.visits.length > 0) {
          for (const v of pendingPlanData.visits) {
            const partyObj = typeof v.party === "object" ? v.party : null;
            const resolvedPartyType = v.party_type || (v.party ? "existing" : "new_party");
            const partyId = partyObj ? partyObj._id || partyObj.id : (typeof v.party === "string" ? v.party : undefined);
            const visitBody: any = {
              ...(v._id || v.id ? { _id: v._id || v.id } : {}),
              party_type: resolvedPartyType,
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
            if (resolvedPartyType === "existing" && partyId) {
              visitBody.party = partyId;
            }
            await addVisitMut({ planId: targetPlanId, body: visitBody }).unwrap();
          }
        }

        // Post works
        if (isWorkTaskPlan(pendingPlanData.payload.plan_type || "") && pendingPlanData.works.length > 0) {
          for (const w of pendingPlanData.works) {
            const workBody = {
              ...(w._id || w.id ? { _id: w._id || w.id } : {}),
              title: w.title,
              description: w.description || undefined,
              planned_start_time: w.planned_start_time || undefined,
              planned_end_time: w.planned_end_time || undefined,
            };
            await addWorkMut({ planId: targetPlanId, body: workBody }).unwrap();
          }
        }
      }

      // Submit plan on backend and send mail
      try {
        await submitPlanMut({
          id: targetPlanId!,
          body: {
            to_email: emailPayload.toEmail,
            cc_emails: emailPayload.ccEmails,
            subject: emailPayload.subject,
            body_html: emailPayload.bodyHtml,
            attachment_ids: emailPayload.attachmentIds,
          },
        }).unwrap();
      } catch (submitErr: any) {
        console.error("Error submitting plan email:", submitErr);
        const errMsg = submitErr?.data?.message || submitErr?.message || "Failed to submit plan email";
        toast.error(errMsg);
        throw submitErr;
      }

      toast.success(isEditing ? "Work plan updated and email dispatched successfully!" : "Work plan created and email dispatched successfully!");
      setCreateMailModalOpen(false);
      router.push("/dashboard/plans");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save work plan and send email";
      toast.error(msg);
      throw err;
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
              {isPlanCompleted ? "Work Plan (Completed)" : isEditing ? "Edit Work Plan" : isCopying ? "Copy Work Plan" : "Create Work Plan"}
            </h1>
            <p className="text-xs text-muted">
              {isPlanCompleted
                ? `Work plan for ${planDate} is completed and locked. Creation and updating are disabled.`
                : detectedPlan
                ? `Loaded existing work plan for ${planDate} (${detectedPlan.status}). Submitting will update and mail this plan.`
                : isEditing
                ? "Update plan dates, executive, location, remarks, visits or tasks"
                : isCopying
                ? "Creating a new work plan from a copied template — adjust date, visits, and tasks as needed"
                : "Schedule a new work plan with initial visits or tasks"}
            </p>
          </div>
        </div>
      </div>

      {/* Existing Plan Notice Banner / Completed Lock Banner */}
      {isPlanCompleted ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
              <AlertTriangle className="h-4 w-4" />
              <span>Work Plan Completed — Read Only</span>
            </div>
            <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase">
              Completed
            </span>
          </div>
          <p className="text-muted">
            The work plan for <strong>{planDate}</strong> is marked as <strong>Completed</strong>. Creation of new work plans or updating completed work plans for this date is not allowed.
          </p>
        </div>
      ) : detectedPlan ? (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
              <Mail className="h-4 w-4" />
              <span>Existing Work Plan Found for Selected Date ({planDate})</span>
            </div>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
              Status: {detectedPlan.status}
            </span>
          </div>
          <p className="text-muted">
            A work plan already exists for this date. The plan details have been fetched and loaded below. Submitting will <strong>Update &amp; Mail</strong> this work plan.
          </p>
        </div>
      ) : null}

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
                disabled={isPlanCompleted}
                onClick={() => setExecDropdownOpen((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-xs font-medium text-foreground outline-none focus:border-primary transition hover:bg-surface-muted/80 disabled:opacity-60 disabled:cursor-not-allowed"
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
              {execDropdownOpen && !isPlanCompleted && (
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
            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-foreground">
              <span>
                Plan Date <span className="text-rose-500">*</span>
              </span>
              {checkingExisting && (
                <span className="text-[11px] font-normal text-primary animate-pulse flex items-center gap-1">
                  <Clock className="h-3 w-3 animate-spin" /> Checking existing plan…
                </span>
              )}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="date"
                required
                disabled={isPlanCompleted}
                value={planDate}
                min={minPlanDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            {minPlanDate && (
              <p className="mt-1 text-[11px] text-muted font-medium">
                ℹ️ Work plans can be scheduled from {minPlanDate} onwards (up to 2 days prior to today).
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
              disabled={isPlanCompleted}
              onChange={(e) => {
                const val = e.target.value;
                setPlanType(val);
                if (val === "Work From Home" && !location) setLocation("Remote / Work From Home");
                else if (val === "Work From Office" && !location) setLocation("Head Office / Branch Office");
                else if (val === "Leave") setLocation("");
              }}
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
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
                disabled={isPlanCompleted}
                placeholder={
                  planType === "Work From Home"
                    ? "e.g. Work From Home / Remote Location"
                    : planType === "Work From Office"
                      ? "e.g. Main Office / Branch Office"
                      : "e.g. Mumbai Metro Area, Sector 18 Noida"
                }
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
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
              disabled={isPlanCompleted}
              placeholder={
                leaveType
                  ? "Reason for leave (casual, medical, vacation, etc.)..."
                  : tasksType
                    ? "Key internal tasks, documentation, or team objectives planned..."
                    : "Key visit objectives, client targets, or meeting details..."
              }
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Manager Discussion Section */}
        <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">
                  Is this Plan discussed with the Manager?
                </span>
              </div>
              <div className="flex items-center gap-5 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={isPlanCompleted}
                    checked={isDiscussedWithManager}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setIsDiscussedWithManager(true);
                        if (assignedPlanTypeManager) {
                          setIsCustomManager(false);
                          setCustomManagerName("");
                          setDiscussedManagerId(assignedPlanTypeManager._id || "");
                          setDiscussedManagerName(assignedPlanTypeManager.name || "");
                          setShowManagerPicker(false);
                        }
                      }
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs font-medium text-foreground">Yes</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={isPlanCompleted}
                    checked={!isDiscussedWithManager}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setIsDiscussedWithManager(false);
                        setDiscussedManagerId("");
                        setDiscussedManagerName("");
                        setIsCustomManager(false);
                        setCustomManagerName("");
                      }
                    }}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs font-medium text-foreground">No</span>
                </label>
              </div>
            </div>
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
                {/* Manager Selection Display */}
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-foreground">
                      Discussed Manager <span className="text-rose-500">*</span>
                    </label>
                    {assignedPlanTypeManager && !showManagerPicker && !isPlanCompleted && (
                      <button
                        type="button"
                        onClick={() => setShowManagerPicker(true)}
                        className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                      >
                        Change Manager
                      </button>
                    )}
                    {showManagerPicker && !isPlanCompleted && (
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
                        className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                      >
                        {isCustomManager ? "← Select from List" : "+ Custom Manager"}
                      </button>
                    )}
                  </div>

                  {!showManagerPicker && currentDisplayedManager ? (
                    <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 truncate">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm shrink-0">
                          {currentDisplayedManager.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {currentDisplayedManager.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                currentDisplayedManager.isSpecificPlanType
                                  ? "bg-primary/15 text-primary border border-primary/20"
                                  : "bg-blue-500/15 text-blue-500 border border-blue-500/20"
                              }`}
                            >
                              {currentDisplayedManager.badgeText}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted truncate">
                            {currentDisplayedManager.email}
                          </p>
                        </div>
                      </div>

                      {!isPlanCompleted && (
                        <button
                          type="button"
                          onClick={() => setShowManagerPicker(true)}
                          className="text-[11px] font-bold text-primary hover:underline shrink-0 cursor-pointer"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  ) : isCustomManager ? (
                    <input
                      type="text"
                      disabled={isPlanCompleted}
                      placeholder="Enter manager's name..."
                      value={customManagerName}
                      onChange={(e) => setCustomManagerName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                      required
                    />
                  ) : (
                    <div className="relative" ref={managerDropdownRef}>
                      <button
                        type="button"
                        disabled={isPlanCompleted}
                        onClick={() => setManagerDropdownOpen(!managerDropdownOpen)}
                        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-left text-xs font-medium text-foreground focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
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

                      {managerDropdownOpen && !isPlanCompleted && (
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
                    disabled={isPlanCompleted}
                    onChange={(e) => setDiscussionMethod(e.target.value as any)}
                    className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
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
              {!isPlanCompleted && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviousModalMode("visits")}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Previous Pending Visits
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVisitIndex(null);
                      setVisitModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Visit
                  </button>
                </div>
              )}
            </div>

            {visits.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">
                No visits added yet. {isPlanCompleted ? "" : "Click \"Add Visit\" to add party visits for this plan date."}
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Building2 className="h-3.5 w-3.5 text-muted shrink-0" />
                          <span className="text-xs font-bold text-foreground truncate">
                            {partyName}
                          </span>
                          {renderVisitStatusBadge(v.status)}
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

                      {!isPlanCompleted && (
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
                          {managerRole || !isManagerCreatedItem(v) ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveVisit(idx)}
                              className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove visit"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="rounded p-1 text-muted/30 cursor-not-allowed opacity-50"
                              title="Created by Manager — Executive cannot remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
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
              {!isPlanCompleted && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviousModalMode("tasks")}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Previous Pending Tasks
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWorkIndex(null);
                      setWorkModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Task
                  </button>
                </div>
              )}
            </div>

            {works.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">
                No work tasks added yet. {isPlanCompleted ? "" : "Click \"Add Task\" to add tasks for this plan date."}
              </p>
            ) : (
              <div className="space-y-2">
                {works.map((w, idx) => {
                  const isDefaultTask = w.work_type === "default" || w.is_default_task;
                  const isManagerItem = !managerRole && isManagerCreatedItem(w);
                  const canRemove = !isDefaultTask && !isManagerItem;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Briefcase className="h-4 w-4 text-muted shrink-0" />
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {w.title}
                            </span>
                            {renderWorkStatusBadge(w.status)}
                            {w.work_type && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  w.work_type === "optional"
                                    ? "bg-amber-500/15 text-amber-500 border border-amber-500/20"
                                    : "bg-primary/15 text-primary border border-primary/20"
                                }`}
                              >
                                {w.work_type === "optional" ? "Optional" : "Default"}
                              </span>
                            )}
                          </div>
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

                      {!isPlanCompleted && (
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
                          {canRemove ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveWork(idx)}
                              className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove task"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="rounded p-1 text-muted/30 cursor-not-allowed opacity-50"
                              title={
                                isDefaultTask
                                  ? "Default task — cannot be removed"
                                  : "Created by Manager — Executive cannot remove"
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
            disabled={submitting || checkingExisting || isPlanCompleted}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold text-white shadow-xs transition ${
              isPlanCompleted
                ? "bg-gray-400 dark:bg-gray-700 cursor-not-allowed opacity-60"
                : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
            }`}
          >
            {isPlanCompleted ? (
              <>
                <Lock className="h-4 w-4" />
                Completed (Locked)
              </>
            ) : isEditing ? (
              <>
                <Mail className="h-4 w-4" />
                {submitting ? "Updating…" : "Update & Mail"}
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                {submitting ? "Processing…" : "Create & Mail"}
              </>
            )}
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

      {createMailModalOpen && pendingPlanData && (
        <WorkPlanCreateMailModal
          planId={activePlanId || undefined}
          plan={pendingPlanData.displayPlan}
          sessionUser={sessionUser}
          isOpen={createMailModalOpen}
          isEditing={isEditing}
          onClose={() => {
            setCreateMailModalOpen(false);
          }}
          onCreateAndSend={handleCreateAndSendEmail}
          loading={submitting}
        />
      )}

      {previousModalMode && (
        <SelectPreviousPendingItemsModal
          open={Boolean(previousModalMode)}
          mode={previousModalMode}
          salesUserId={salesUserId || sessionUser?._id}
          excludeIds={
            previousModalMode === "visits"
              ? visits.map((v) => String(v._id || v.id || "")).filter(Boolean)
              : works.map((w) => String(w._id || w.id || "")).filter(Boolean)
          }
          onClose={() => setPreviousModalMode(null)}
          onAddItems={(selectedItems) => {
            if (previousModalMode === "visits") {
              setVisits((prev) => [...prev, ...selectedItems]);
            } else {
              setWorks((prev) => [...prev, ...selectedItems]);
            }
          }}
        />
      )}
    </div>
  );
}

export default WorkPlanFormPage;
