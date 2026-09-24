"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Phone,
  Search,
  User,
  UserCheck,
  X,
} from "lucide-react";
import type { WorkPlanVisitPartyType, WorkPlanVisitRecord } from "@/types/workPlanner";
import type { PartyRecord } from "@/types/party";
import type { LeadRecord } from "@/types/lead";
import { useGetPartiesQuery } from "@/store/api/partyApiSlice";
import { useGetLeadsQuery } from "@/store/api/leadsApiSlice";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import { useGetMyTeamQuery, useGetPlansQuery } from "@/store/api/workPlannerApiSlice";
import {
  isWpAdmin,
  isWpManager,
  isWpElevated,
  readSessionFromStorage,
} from "@/utils/authStorage";
import { formatPlanDate, formatAuditUser, formatDateTime } from "./workPlanUtils";

export type VisitFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: WorkPlanVisitRecord | null;
  planDate?: string | null;
  /** Assigned executive on the parent work plan — used to scope Existing Leads search & assignment. */
  salesUserId?: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void | Promise<void>;
};

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
  if (!u) return false;
  const uId = String(u._id || u.id || "");
  if (sessionUserId && uId === String(sessionUserId)) return true;

  const uAny = u as any;
  if (
    uAny.department === "super_admin" ||
    (Array.isArray(uAny.role_codes) && uAny.role_codes.includes("super_admin")) ||
    (Array.isArray(uAny.roles) && uAny.roles.includes("super_admin"))
  ) {
    return true;
  }

  const portals = Array.isArray(u.portals)
    ? u.portals
    : Array.isArray(uAny.portal_access)
    ? uAny.portal_access
    : [];

  if (portals.length === 0) {
    return true;
  }

  const wpPortal = portals.find((p: any) => {
    if (!p) return false;
    const code = p.portal_code || p.portal?.code || p.code || p.portal;
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
    return (
      normalized === "executive" ||
      normalized === "manager" ||
      normalized === "admin" ||
      normalized === "sales" ||
      normalized === "super_admin"
    );
  });
}

const PARTY_TYPE_OPTIONS: Array<{ value: WorkPlanVisitPartyType; label: string }> = [
  { value: "existing", label: "Existing Party" },
  { value: "existing_lead", label: "Existing Leads" },
  { value: "new_party", label: "New Party" },
  { value: "new_lead", label: "New Leads" },
];

const inputClass =
  "w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const labelClass = "mb-1.5 block text-xs font-medium text-muted";

function ymdFromPlanDate(planDate?: string | null): string {
  if (!planDate) return "";
  const trimmed = String(planDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeFromIso(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combinePlanDateAndTime(
  planDate: string | undefined | null,
  time: string,
): string | undefined {
  if (!time) return undefined;
  const ymd = ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10);
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const local = new Date(`${ymd}T${normalizedTime}`);
  if (isNaN(local.getTime())) {
    const d = new Date(time);
    if (!isNaN(d.getTime())) return d.toISOString();
    return time;
  }
  return local.toISOString();
}

function partyNameOf(visit?: WorkPlanVisitRecord | null): string {
  if (!visit) return "";
  if (visit.party_name) return visit.party_name;
  if (typeof visit.party === "object" && visit.party?.party_name) return visit.party.party_name;
  return "";
}

function formatPartyAddress(party: PartyRecord): string {
  if (party.billing_address) {
    const parts = [
      party.billing_address.street,
      party.billing_address.city,
      party.billing_address.state,
      party.billing_address.pincode,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  if (party.shipping_address) {
    const parts = [
      party.shipping_address.street,
      party.shipping_address.city,
      party.shipping_address.state,
      party.shipping_address.pincode,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(", ");
  }
  const parts = [party.district, party.state].filter(Boolean);
  return parts.join(", ");
}

function formatLeadAddress(lead: LeadRecord): string {
  const addr = lead.billing_address;
  if (!addr) return "";
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.city,
    addr.state,
    addr.pincode,
  ].filter(Boolean);
  return parts.join(", ");
}

function leadDisplayName(lead: LeadRecord): string {
  return lead.company_name?.trim() || lead.name?.trim() || lead.lead_no || "Lead";
}

function primaryLeadContact(lead: LeadRecord) {
  const contacts = lead.contacts || [];
  return contacts.find((c) => c.is_primary) || contacts[0];
}

export function VisitFormModal({
  open,
  mode,
  initial,
  planDate,
  salesUserId,
  isSaving,
  onClose,
  onSubmit,
}: VisitFormModalProps) {
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const sessionUserId = sessionUser?._id || (sessionUser as { id?: string })?.id || "";
  const adminRole = isWpAdmin(sessionUser);
  const managerRole = isWpManager(sessionUser);
  const elevatedRole = isWpElevated(sessionUser);

  // Queries for allowed executives
  const { data: usersData } = useGetUsersQuery(undefined, { skip: !open || !adminRole });
  const { data: myTeamData } = useGetMyTeamQuery(undefined, { skip: !open || adminRole || !managerRole });

  const allUsers = useMemo<ExecutiveUser[]>(() => {
    if (adminRole) return (usersData as ExecutiveUser[]) || [];
    const list: ExecutiveUser[] = [];
    const seen = new Set<string>();

    const addUser = (u: any) => {
      if (!u) return;
      const id = String(u._id || u.id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(u as ExecutiveUser);
      }
    };

    if (sessionUser) addUser(sessionUser);
    if (Array.isArray(myTeamData?.members)) {
      myTeamData.members.forEach(addUser);
    }
    if (Array.isArray(myTeamData?.edges)) {
      myTeamData.edges.forEach((e: any) => {
        if (e.manager) addUser(e.manager);
        if (e.user) addUser(e.user);
      });
    }
    return list;
  }, [adminRole, usersData, sessionUser, myTeamData]);

  // Allowed Executives for assignment:
  // - Admin: all portal members with work_planner access
  // - Manager: himself + executives reporting to him
  // - Executive: himself only
  const allowedExecutives = useMemo<ExecutiveUser[]>(() => {
    if (!elevatedRole) {
      if (!sessionUser) return [];
      return [
        {
          _id: sessionUserId,
          id: sessionUserId,
          name: `${sessionUser.name} (Self)`,
          email: sessionUser.email,
          department: sessionUser.department,
        },
      ];
    }

    if (adminRole) {
      const list = allUsers.filter((u) => hasWorkPlannerAccess(u, sessionUserId));
      if (salesUserId && !list.some((u) => String(u._id || u.id || "") === String(salesUserId))) {
        const found = allUsers.find((u) => String(u._id || u.id || "") === String(salesUserId));
        if (found) list.push(found);
      }
      return list;
    }

    const myTeamMembers = (myTeamData?.members || []) as Array<{ _id?: string; id?: string }>;
    const teamIdSet = new Set<string>(
      myTeamMembers.map((m) => String(m._id || m.id || ""))
    );
    if (sessionUserId) {
      teamIdSet.add(String(sessionUserId));
    }
    if (salesUserId) {
      teamIdSet.add(String(salesUserId));
    }
    return allUsers.filter((u) => teamIdSet.has(String(u._id || u.id || "")));
  }, [allUsers, sessionUser, sessionUserId, adminRole, elevatedRole, myTeamData, salesUserId]);

  // Modal internal editable states
  const [internalPlanDate, setInternalPlanDate] = useState<string>(
    () => ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10)
  );
  const [internalSalesUserId, setInternalSalesUserId] = useState<string>(
    () => salesUserId || sessionUserId || ""
  );

  const effectiveSalesUserId = internalSalesUserId || sessionUserId || "";
  const { data: plansData, isFetching: isCheckingPlan } = useGetPlansQuery(
    {
      sales_user: effectiveSalesUserId,
      date: internalPlanDate,
      limit: 1,
    },
    { skip: !open || !internalPlanDate || !effectiveSalesUserId }
  );

  const existingPlan = useMemo(() => {
    const list = plansData?.data || [];
    return list.find((p) => !(p as any).deletedAt && !String(p._id || p.id).startsWith("standalone"));
  }, [plansData]);
  const planCompleted = existingPlan?.status === "completed";

  const [partyType, setPartyType] = useState<WorkPlanVisitPartyType>("existing");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [partyName, setPartyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [address, setAddress] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [plannedStartTime, setPlannedStartTime] = useState("");
  const [plannedEndTime, setPlannedEndTime] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [partySearch, setPartySearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isExistingParty = partyType === "existing";
  const isExistingLead = partyType === "existing_lead";
  const isExistingType = isExistingParty || isExistingLead;
  const assignedExecutiveId = internalSalesUserId?.trim() || "";

  const { data: partiesData = [], isLoading: isPartiesLoading } = useGetPartiesQuery(
    { search: partySearch.trim() },
    { skip: !open || !isExistingParty }
  );

  const { data: leadsData = [], isLoading: isLeadsLoading } = useGetLeadsQuery(
    {
      search: leadSearch.trim() || undefined,
      assigned_to: assignedExecutiveId || undefined,
      limit: 30,
      paginate: "true",
    },
    { skip: !open || !isExistingLead }
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPartyDropdownOpen(false);
        setLeadDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Only re-initialize when modal transitions from closed to open or when initial record changes
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && (!prevOpenRef.current || initial)) {
      setInternalPlanDate(ymdFromPlanDate(planDate) || new Date().toISOString().slice(0, 10));
      const targetSalesUser =
        (typeof initial?.sales_user === "object"
          ? (initial.sales_user as any)?._id || (initial.sales_user as any)?.id
          : typeof initial?.sales_user === "string"
          ? initial.sales_user
          : "") ||
        salesUserId ||
        sessionUserId ||
        "";
      setInternalSalesUserId(targetSalesUser);
      if (initial) {
        setPartyType(initial.party_type || "existing");
        const pId =
          typeof initial.party === "object" && initial.party
            ? initial.party._id || (initial.party as { id?: string }).id
            : typeof initial.party === "string"
              ? initial.party
              : "";
        setSelectedPartyId(pId || "");
        setSelectedLeadId("");
        setPartyName(partyNameOf(initial));
        setContactPerson(initial.contact_person || "");
        setContactNumber(initial.contact_number || "");
        setContactEmail(initial.contact_email || "");
        setAddress(initial.address || "");
        setPurpose(initial.purpose || "");
        setNotes(initial.notes || "");
        setPlannedStartTime(timeFromIso(initial.planned_start_time));
        setPlannedEndTime(timeFromIso(initial.planned_end_time));
      } else {
        setPartyType("existing");
        setSelectedPartyId("");
        setSelectedLeadId("");
        setPartyName("");
        setContactPerson("");
        setContactNumber("");
        setContactEmail("");
        setAddress("");
        setPurpose("");
        setNotes("");
        setPlannedStartTime("");
        setPlannedEndTime("");
      }
      setPartySearch("");
      setLeadSearch("");
      setPartyDropdownOpen(false);
      setLeadDropdownOpen(false);
      setErrors({});
    }
    prevOpenRef.current = open;
  }, [open, initial, planDate, salesUserId, sessionUserId]);

  if (!open) return null;

  function handleSelectParty(party: PartyRecord) {
    const pId = party._id || party.id || "";
    setSelectedPartyId(pId);
    setSelectedLeadId("");
    setPartyName(party.party_name || "");

    const mainContact = party.contacts?.[0];
    setContactPerson(party.contact_person || mainContact?.contact_person || "");
    setContactNumber(party.mobile || mainContact?.contact_number || "");
    setContactEmail(party.email || mainContact?.contact_email || "");
    setAddress(formatPartyAddress(party));

    setPartyDropdownOpen(false);
    setPartySearch("");
    setErrors((prev) => ({ ...prev, partyName: "", contactPerson: "", contactNumber: "" }));
  }

  function handleSelectLead(lead: LeadRecord) {
    const leadId = lead._id || lead.id || "";
    setSelectedLeadId(leadId);
    setSelectedPartyId("");
    setPartyName(leadDisplayName(lead));

    const primary = primaryLeadContact(lead);
    setContactPerson(primary?.name || lead.name || "");
    setContactNumber(primary?.phone || lead.phone || lead.alternate_phone || "");
    setContactEmail(primary?.email || lead.email || "");
    setAddress(formatLeadAddress(lead));

    setLeadDropdownOpen(false);
    setLeadSearch("");
    setErrors((prev) => ({ ...prev, partyName: "", contactPerson: "", contactNumber: "" }));
  }

  function handlePartyTypeChange(nextType: WorkPlanVisitPartyType) {
    setPartyType(nextType);
    if (nextType === "new_party" || nextType === "new_lead") {
      setSelectedPartyId("");
      setSelectedLeadId("");
    }
    if (nextType === "existing") {
      setSelectedLeadId("");
    }
    if (nextType === "existing_lead") {
      setSelectedPartyId("");
    }
    setPartyDropdownOpen(false);
    setLeadDropdownOpen(false);
  }

  function handleSave() {
    if (planCompleted) return;
    const errs: Record<string, string> = {};
    if (!internalPlanDate) {
      errs.planDate = "Plan date is required";
    }
    if (!partyName.trim()) {
      errs.partyName = isExistingLead
        ? "Lead / company name is required"
        : "Party/Company name is required";
    }
    if (!contactPerson.trim()) {
      errs.contactPerson = "Contact person name is required";
    }
    if (!contactNumber.trim()) {
      errs.contactNumber = "Contact number is required";
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      errs.contactEmail = "Enter a valid email address";
    }
    if (isExistingParty && !selectedPartyId) {
      errs.partyName = "Select an existing party from the list";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const sanitizedEmail =
      contactEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())
        ? contactEmail.trim()
        : `${(contactPerson.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "contact")}@client.com`;

    // Backend accepts `party` for party_type=existing; omit for leads / new entries.
    onSubmit({
      planDate: internalPlanDate,
      salesUserId: internalSalesUserId || sessionUserId,
      party_type: partyType,
      ...(isExistingParty && selectedPartyId ? { party: selectedPartyId } : {}),
      party_name: partyName.trim(),
      contact_person: contactPerson.trim(),
      contact_number: contactNumber.trim(),
      contact_email: sanitizedEmail,
      address: address.trim() || undefined,
      purpose: purpose.trim() || undefined,
      notes: notes.trim() || undefined,
      planned_start_time: combinePlanDateAndTime(internalPlanDate, plannedStartTime),
      planned_end_time: combinePlanDateAndTime(internalPlanDate, plannedEndTime),
    });
  }

  const searchLabel = isExistingLead
    ? "Search Existing Lead"
    : "Search Existing Party / Lead";
  const searchPlaceholder = isExistingLead
    ? "Search by company, contact, phone, lead no..."
    : "Search by party name, mobile, email...";
  const dropdownOpen = isExistingLead ? leadDropdownOpen : partyDropdownOpen;
  const searchValue = isExistingLead
    ? leadDropdownOpen
      ? leadSearch
      : partyName
    : partyDropdownOpen
      ? partySearch
      : partyName;
  const isSearchLoading = isExistingLead ? isLeadsLoading : isPartiesLoading;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={() => !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {mode === "create" ? "Add Field Visit" : "Edit Field Visit"}
            </h2>
            <p className="text-xs text-muted">
              {adminRole
                ? "Portal Admin — Assign and schedule visit for any portal member"
                : managerRole
                ? "Portal Manager — Assign and schedule visit for yourself or your reporting team"
                : "Schedule your field visit details"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-5 py-4">
          {/* Date & Executive Assignment Bar within Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-muted/60 rounded-xl border border-border">
            <div>
              <label className={labelClass}>
                <Calendar className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Plan Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={internalPlanDate}
                onChange={(e) => setInternalPlanDate(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
              {errors.planDate && (
                <p className="mt-1 text-xs text-rose-500">{errors.planDate}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                <User className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Assign Executive / Team Member <span className="text-rose-500">*</span>
              </label>
              {elevatedRole ? (
                <select
                  value={internalSalesUserId}
                  onChange={(e) => setInternalSalesUserId(e.target.value)}
                  disabled={isSaving}
                  className={inputClass}
                >
                  {allowedExecutives.map((exec) => (
                    <option key={exec._id || exec.id} value={exec._id || exec.id}>
                      {exec.name} {exec._id === sessionUserId ? "(Self)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">
                  {sessionUser?.name || "Self"} (Executive)
                </div>
              )}
            </div>
          </div>

          {/* Work Plan Detection Banner */}
          {internalPlanDate && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                planCompleted
                  ? "border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300"
                  : existingPlan
                  ? "border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300"
                  : "border-border bg-surface-muted/40 text-muted"
              }`}
            >
              {isCheckingPlan ? (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Checking for work plan…</span>
                </div>
              ) : planCompleted ? (
                <>
                  <Info className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <div>
                    <span className="font-semibold text-rose-900 dark:text-rose-200">
                      Work plan completed:
                    </span>{" "}
                    The work plan for {formatPlanDate(internalPlanDate)} is completed. New visits cannot be added to this day.
                  </div>
                </>
              ) : existingPlan ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                      Work Plan Found ({existingPlan.status || "planned"}):
                    </span>{" "}
                    This visit will be automatically added to the work plan for{" "}
                    {formatPlanDate(internalPlanDate)}.
                  </div>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4 shrink-0 text-muted" />
                  <div>
                    <span className="font-medium text-foreground">No work plan for this date:</span>{" "}
                    This visit will be created as a standalone visit.
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>
              Party Category / Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PARTY_TYPE_OPTIONS.map((opt) => {
                const isSelected = partyType === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs font-semibold transition ${
                      isSelected
                        ? "border-primary bg-primary-muted text-primary shadow-xs"
                        : "border-border bg-surface-muted/50 text-muted hover:border-border hover:text-foreground"
                    } ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="partyType"
                      value={opt.value}
                      checked={isSelected}
                      disabled={isSaving}
                      onChange={() => handlePartyTypeChange(opt.value)}
                      className="sr-only"
                    />
                    <div
                      className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? "border-primary" : "border-border"
                      }`}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {isExistingType ? (
            <div className="relative space-y-1.5" ref={dropdownRef}>
              <label className={labelClass}>
                {searchLabel} <span className="text-rose-500">*</span>
              </label>

              {isExistingLead && !assignedExecutiveId ? (
                <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
                  Showing all accessible leads. Select an executive above to filter by specific assignee.
                </p>
              ) : null}

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onFocus={() => {
                    if (isExistingLead) setLeadDropdownOpen(true);
                    else setPartyDropdownOpen(true);
                  }}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPartyName(value);
                    if (isExistingLead) {
                      setLeadSearch(value);
                      if (!leadDropdownOpen) setLeadDropdownOpen(true);
                    } else {
                      setPartySearch(value);
                      if (!partyDropdownOpen) setPartyDropdownOpen(true);
                    }
                  }}
                  disabled={isSaving}
                  className={`${inputClass} pl-9 pr-8`}
                />
                {partyName ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPartyName("");
                      setSelectedPartyId("");
                      setSelectedLeadId("");
                      setPartySearch("");
                      setLeadSearch("");
                    }}
                    className="absolute right-2.5 top-2.5 text-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {errors.partyName && (
                <p className="text-xs text-rose-500">{errors.partyName}</p>
              )}

              {dropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                  {isSearchLoading ? (
                    <div className="p-3 text-center text-xs text-muted">Searching…</div>
                  ) : isExistingLead ? (
                    leadsData.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted">
                        No leads found. You can switch to &quot;New Leads&quot; to add manually.
                      </div>
                    ) : (
                      leadsData.map((lead: LeadRecord) => {
                        const lId = lead._id || lead.id || "";
                        const primary = primaryLeadContact(lead);
                        const isSelected = selectedLeadId === lId;
                        return (
                          <div
                            key={lId}
                            onClick={() => handleSelectLead(lead)}
                            className={`flex cursor-pointer items-start justify-between border-b border-border/50 p-2.5 text-xs hover:bg-surface-muted transition ${
                              isSelected ? "bg-primary/10" : ""
                            }`}
                          >
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="font-semibold text-foreground truncate">
                                {leadDisplayName(lead)}
                              </div>
                              {primary?.name ? (
                                <div className="text-muted text-[11px] truncate">
                                  {primary.name}
                                  {primary.phone ? ` • ${primary.phone}` : ""}
                                </div>
                              ) : null}
                              {formatLeadAddress(lead) ? (
                                <div className="text-muted/80 text-[11px] truncate">
                                  {formatLeadAddress(lead)}
                                </div>
                              ) : null}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary shrink-0 ml-2 mt-0.5" />
                            )}
                          </div>
                        );
                      })
                    )
                  ) : partiesData.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted">
                      No parties found. You can switch to &quot;New Party&quot; to add manually.
                    </div>
                  ) : (
                    partiesData.map((party: PartyRecord) => {
                      const pId = party._id || party.id || "";
                      const isSelected = selectedPartyId === pId;
                      return (
                        <div
                          key={pId}
                          onClick={() => handleSelectParty(party)}
                          className={`flex cursor-pointer items-start justify-between border-b border-border/50 p-2.5 text-xs hover:bg-surface-muted transition ${
                            isSelected ? "bg-primary/10" : ""
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="font-semibold text-foreground truncate">
                              {party.party_name}
                            </div>
                            {party.contact_person ? (
                              <div className="text-muted text-[11px] truncate">
                                {party.contact_person}
                                {party.mobile ? ` • ${party.mobile}` : ""}
                              </div>
                            ) : null}
                            {formatPartyAddress(party) ? (
                              <div className="text-muted/80 text-[11px] truncate">
                                {formatPartyAddress(party)}
                              </div>
                            ) : null}
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary shrink-0 ml-2 mt-0.5" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className={labelClass}>
                {partyType === "new_lead" ? "Lead / Company Name" : "Party / Company Name"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="e.g. Apex Health Systems"
                disabled={isSaving}
                className={inputClass}
              />
              {errors.partyName && (
                <p className="mt-1 text-xs text-rose-500">{errors.partyName}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Contact Person Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Dr. Rajesh Gupta / Mr. Sharma"
                disabled={isSaving}
                className={inputClass}
              />
              {errors.contactPerson && (
                <p className="mt-1 text-xs text-rose-500">{errors.contactPerson}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>
                Contact Phone / Mobile <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="9876543210"
                disabled={isSaving}
                className={inputClass}
              />
              {errors.contactNumber && (
                <p className="mt-1 text-xs text-rose-500">{errors.contactNumber}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Contact Email (Optional)</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@client.com"
                disabled={isSaving}
                className={inputClass}
              />
              {errors.contactEmail && (
                <p className="mt-1 text-xs text-rose-500">{errors.contactEmail}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Address / Location</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="City, State, or full address"
                disabled={isSaving}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Planned Start Time</label>
              <input
                type="time"
                value={plannedStartTime}
                onChange={(e) => setPlannedStartTime(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Planned End Time</label>
              <input
                type="time"
                value={plannedEndTime}
                onChange={(e) => setPlannedEndTime(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Purpose / Objective</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Product Demo, Order collection, Follow-up meeting..."
              disabled={isSaving}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any preparatory notes, reference quotes, or key discussion points"
              disabled={isSaving}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 bg-surface-muted/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isCheckingPlan || planCompleted}
            className="rounded-lg bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover shadow-xs transition cursor-pointer"
          >
            {isSaving ? "Saving…" : mode === "create" ? "Add Visit" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VisitFormModal;
