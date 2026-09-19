"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Phone, Search, UserCheck, X } from "lucide-react";
import type { WorkPlanVisitPartyType, WorkPlanVisitRecord } from "@/types/workPlanner";
import type { PartyRecord } from "@/types/party";
import type { LeadRecord } from "@/types/lead";
import { useGetPartiesQuery } from "@/store/api/partyApiSlice";
import { useGetLeadsQuery } from "@/store/api/leadsApiSlice";
import { formatPlanDate, formatAuditUser, formatDateTime } from "./workPlanUtils";

export type VisitFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: WorkPlanVisitRecord | null;
  planDate?: string | null;
  /** Assigned executive on the parent work plan — used to scope Existing Leads search. */
  salesUserId?: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void | Promise<void>;
};

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
  return d.toISOString().slice(0, 10);
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
  const local = new Date(`${ymd}T${time}`);
  if (isNaN(local.getTime())) return undefined;
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
  const assignedExecutiveId = salesUserId?.trim() || "";

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

  const planDateYmd = ymdFromPlanDate(planDate);
  const planDateLabel = planDateYmd
    ? formatPlanDate(`${planDateYmd}T00:00:00`)
    : "—";

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

  useEffect(() => {
    if (open) {
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
  }, [open, initial]);

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
    const errs: Record<string, string> = {};
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

    // Backend only accepts `party` for party_type=existing; omit for leads / new entries.
    onSubmit({
      party_type: partyType,
      ...(isExistingParty && selectedPartyId ? { party: selectedPartyId } : {}),
      party_name: partyName.trim(),
      contact_person: contactPerson.trim(),
      contact_number: contactNumber.trim(),
      contact_email: sanitizedEmail,
      address: address.trim() || undefined,
      purpose: purpose.trim() || undefined,
      notes: notes.trim() || undefined,
      planned_start_time: combinePlanDateAndTime(planDate, plannedStartTime),
      planned_end_time: combinePlanDateAndTime(planDate, plannedEndTime),
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
              {mode === "create" ? "Add Visit" : "Edit Visit"}
            </h2>
            <p className="text-xs text-muted">
              For plan date: <span className="font-medium">{planDateLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-5 py-4">
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
                  Showing all accessible leads. Select an executive on the work plan to filter by specific assignee.
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
                      setSelectedPartyId("");
                      setSelectedLeadId("");
                      setPartyName("");
                      setPartySearch("");
                      setLeadSearch("");
                      if (isExistingLead) setLeadDropdownOpen(true);
                      else setPartyDropdownOpen(true);
                    }}
                    className="absolute right-2.5 top-2.5 text-muted hover:text-foreground"
                    title="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted pointer-events-none" />
                )}
              </div>
              {errors.partyName ? (
                <p className="mt-1 text-xs text-rose-500">{errors.partyName}</p>
              ) : null}

              {dropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-xl p-1.5 space-y-1">
                  {isSearchLoading ? (
                    <div className="p-3 text-center text-xs text-muted">
                      {isExistingLead ? "Searching leads…" : "Searching parties…"}
                    </div>
                  ) : isExistingLead ? (
                    leadsData.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted">
                        No matching leads for this executive. You can type details manually below.
                      </div>
                    ) : (
                      leadsData.map((lead) => {
                        const leadId = lead._id || lead.id || "";
                        const isSelected = leadId === selectedLeadId;
                        const leadAddr = formatLeadAddress(lead);
                        const primary = primaryLeadContact(lead);
                        return (
                          <button
                            key={leadId}
                            type="button"
                            onClick={() => handleSelectLead(lead)}
                            className={`w-full flex items-start justify-between rounded-lg p-2.5 text-left text-xs transition ${
                              isSelected
                                ? "bg-primary-muted text-primary font-semibold"
                                : "hover:bg-surface-muted text-foreground"
                            }`}
                          >
                            <div className="space-y-0.5 truncate">
                              <div className="flex items-center gap-2 font-bold text-sm">
                                <Building2 className="h-4 w-4 shrink-0 text-muted" />
                                <span className="truncate">{leadDisplayName(lead)}</span>
                                {lead.lead_no ? (
                                  <span className="rounded bg-surface-muted px-1.5 py-0.2 text-[10px] font-normal text-muted">
                                    {lead.lead_no}
                                  </span>
                                ) : null}
                                {lead.status ? (
                                  <span className="rounded bg-surface-muted px-1.5 py-0.2 text-[10px] font-normal text-muted capitalize">
                                    {String(lead.status).replace(/_/g, " ")}
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
                                {(primary?.name || lead.name) && (
                                  <span className="flex items-center gap-1">
                                    <UserCheck className="h-3 w-3 text-muted" />
                                    {primary?.name || lead.name}
                                  </span>
                                )}
                                {(primary?.phone || lead.phone) && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-muted" />
                                    {primary?.phone || lead.phone}
                                  </span>
                                )}
                              </div>
                              {leadAddr ? (
                                <p className="text-[11px] text-muted truncate">{leadAddr}</p>
                              ) : null}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary shrink-0 ml-2 mt-0.5" />
                            )}
                          </button>
                        );
                      })
                    )
                  ) : partiesData.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted">
                      No matching parties found. You can type party details manually below.
                    </div>
                  ) : (
                    partiesData.map((party) => {
                      const pId = party._id || party.id || "";
                      const isSelected = pId === selectedPartyId;
                      const partyAddr = formatPartyAddress(party);
                      return (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => handleSelectParty(party)}
                          className={`w-full flex items-start justify-between rounded-lg p-2.5 text-left text-xs transition ${
                            isSelected
                              ? "bg-primary-muted text-primary font-semibold"
                              : "hover:bg-surface-muted text-foreground"
                          }`}
                        >
                          <div className="space-y-0.5 truncate">
                            <div className="flex items-center gap-2 font-bold text-sm">
                              <Building2 className="h-4 w-4 shrink-0 text-muted" />
                              <span className="truncate">{party.party_name}</span>
                              {party.party_type && (
                                <span className="rounded bg-surface-muted px-1.5 py-0.2 text-[10px] font-normal text-muted">
                                  {party.party_type}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
                              {(party.contact_person || party.contacts?.[0]?.contact_person) && (
                                <span className="flex items-center gap-1">
                                  <UserCheck className="h-3 w-3 text-muted" />
                                  {party.contact_person || party.contacts?.[0]?.contact_person}
                                </span>
                              )}
                              {(party.mobile || party.contacts?.[0]?.contact_number) && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-muted" />
                                  {party.mobile || party.contacts?.[0]?.contact_number}
                                </span>
                              )}
                            </div>
                            {partyAddr ? (
                              <p className="text-[11px] text-muted truncate">{partyAddr}</p>
                            ) : null}
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary shrink-0 ml-2 mt-0.5" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className={labelClass}>
                Party / Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                disabled={isSaving}
                placeholder="Hospital / Clinic / Party Name"
                className={inputClass}
              />
              {errors.partyName ? (
                <p className="mt-1 text-xs text-rose-500">{errors.partyName}</p>
              ) : null}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>
                Contact Person <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                disabled={isSaving}
                placeholder="Dr. John Doe / Manager"
                className={inputClass}
              />
              {errors.contactPerson ? (
                <p className="mt-1 text-xs text-rose-500">{errors.contactPerson}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>
                Contact Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                disabled={isSaving}
                placeholder="+91 98765 43210"
                className={inputClass}
              />
              {errors.contactNumber ? (
                <p className="mt-1 text-xs text-rose-500">{errors.contactNumber}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClass}>Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                disabled={isSaving}
                placeholder="contact@hospital.com"
                className={inputClass}
              />
              {errors.contactEmail ? (
                <p className="mt-1 text-xs text-rose-500">{errors.contactEmail}</p>
              ) : null}
            </div>
          </div>

          <div>
            <label className={labelClass}>Address / Location</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isSaving}
              placeholder="Street address, city, area"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <label className={labelClass}>Visit Purpose</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={isSaving}
              placeholder="e.g. Product demo, Payment collection, Routine check"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Pre-visit Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSaving}
              rows={2}
              placeholder="Additional background notes or reminders..."
              className={inputClass}
            />
          </div>

          {initial && (initial.created_by || initial.updated_by || initial.createdAt || initial.updatedAt) && (
            <div className="rounded-lg border border-border bg-surface-muted/60 p-3 space-y-1.5 text-xs text-muted">
              <div className="font-semibold text-foreground">Audit Information</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {(initial.created_by || initial.created_by_role) && (
                  <div>
                    <span className="font-medium text-foreground">Created By:</span>{" "}
                    {formatAuditUser(initial.created_by, initial.created_by_role)}
                    {initial.createdAt && ` on ${formatDateTime(initial.createdAt)}`}
                  </div>
                )}
                {(initial.updated_by || initial.updated_by_role) && (
                  <div>
                    <span className="font-medium text-foreground">Updated By:</span>{" "}
                    {formatAuditUser(initial.updated_by, initial.updated_by_role)}
                    {initial.updatedAt && ` on ${formatDateTime(initial.updatedAt)}`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 bg-surface-muted/50">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition"
          >
            {isSaving ? "Saving…" : mode === "create" ? "Add Visit" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VisitFormModal;
