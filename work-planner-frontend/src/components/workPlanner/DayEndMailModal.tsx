"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Mail,
  Send,
  X,
  Paperclip,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Trash2,
  ExternalLink,
  AlertTriangle,
  UserCheck,
  Users,
  CheckCircle2,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { DayEndRichEditor } from "./DayEndRichEditor";
import { useGetUsersQuery } from "@/store/api/authApiSlice";
import {
  useGetDayEndDraftQuery,
  useUploadWorkPlanAttachmentMutation,
  useGetUserSettingsQuery,
} from "@/store/api/workPlannerApiSlice";
import { getUserWorkPlannerSettings } from "@/utils/userWorkPlannerSettings";
import type {
  DayEndPayload,
  WorkPlanDayEndAttachment,
  WorkPlanRecord,
} from "@/types/workPlanner";

interface DayEndMailModalProps {
  planId: string;
  plan: WorkPlanRecord;
  sessionUser?: { name?: string; email?: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onCompleteSuccess: () => void;
  onSendAndComplete: (payload: DayEndPayload) => Promise<void>;
  loading?: boolean;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType?: string, fileName?: string) {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return <FileText className="h-4 w-4 text-rose-500 shrink-0" />;
  }
  if (
    mime.includes("image") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp")
  ) {
    return <ImageIcon className="h-4 w-4 text-sky-500 shrink-0" />;
  }
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv")
  ) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
  return <File className="h-4 w-4 text-slate-400 shrink-0" />;
}

function getWorkPlannerUserRole(u: any): "Admin" | "Manager" | null {
  if (!u || !Array.isArray(u.portals) || u.portals.length === 0) {
    return null;
  }
  const wpPortal = u.portals.find((p: any) => {
    const code = p.portal_code || p.portal?.code || p.code;
    return code === "work_planner";
  });
  if (!wpPortal) return null;
  const roles: string[] = Array.isArray(wpPortal.access_roles)
    ? wpPortal.access_roles
    : (wpPortal as any).access_role
      ? [(wpPortal as any).access_role]
      : [];
  const normalized = roles.map((r) => String(r).toLowerCase().trim());
  if (normalized.includes("admin") || normalized.includes("super_admin")) return "Admin";
  if (normalized.includes("manager")) return "Manager";
  return null;
}

export function DayEndMailModal({
  planId,
  plan,
  sessionUser,
  isOpen,
  onClose,
  onCompleteSuccess,
  onSendAndComplete,
  loading: parentLoading = false,
}: DayEndMailModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch prefilled Day End draft from backend
  const { data: draftData, isLoading: draftLoading } = useGetDayEndDraftQuery(planId, {
    skip: !isOpen,
  });
  const { data: usersData } = useGetUsersQuery();

  const [uploadAttachmentMut] = useUploadWorkPlanAttachmentMutation();

  // Fetch user settings for plan type manager/CC lookup
  const targetUserObj =
    typeof plan?.sales_user === "object" && plan?.sales_user ? plan.sales_user : null;
  const targetExecId = targetUserObj
    ? String(targetUserObj._id || targetUserObj.id || "")
    : String((sessionUser as any)?._id || (sessionUser as any)?.id || "");

  const { data: dbUserSettings } = useGetUserSettingsQuery(targetExecId, {
    skip: !isOpen || !targetExecId,
  });

  const effectiveSettings = useMemo(() => {
    if (dbUserSettings) return dbUserSettings;
    if (targetExecId) return getUserWorkPlannerSettings(targetExecId);
    return null;
  }, [dbUserSettings, targetExecId]);

  // Form State
  const [toEmail, setToEmail] = useState("");
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [newCcInput, setNewCcInput] = useState("");
  const [isAddingCc, setIsAddingCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [attachments, setAttachments] = useState<WorkPlanDayEndAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const allUsers = useMemo(() => (usersData as any[]) || [], [usersData]);

  // Resolve assigned manager for current plan type (or fallback to global default manager)
  const assignedPlanTypeManager = useMemo(() => {
    if (!effectiveSettings) return null;
    const pts = effectiveSettings.planTypeSettings?.[plan?.plan_type || "Visits"];
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
          email: matched.email || mgrEmail || "",
          badgeText: `${plan?.plan_type || "Visits"} Manager`,
          isReportingManager: true,
        };
      }
      if (mgrName) {
        return {
          _id: mgrId || "",
          name: mgrName,
          email: mgrEmail || "",
          badgeText: `${plan?.plan_type || "Visits"} Manager`,
          isReportingManager: true,
        };
      }
    }

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
          email: matched.email || globalEmail || "",
          badgeText: "Reporting Manager",
          isReportingManager: true,
        };
      }
      if (globalName) {
        return {
          _id: globalId || "",
          name: globalName,
          email: globalEmail || "",
          badgeText: "Reporting Manager",
          isReportingManager: true,
        };
      }
    }

    return null;
  }, [effectiveSettings, plan?.plan_type, allUsers]);

  // Build eligible managers list: 1. Assigned Reporting Manager, 2. Discussed Manager, 3. Portal Admins of work_planner portal
  const eligibleManagers = useMemo(() => {
    const map = new Map<string, { _id: string; name: string; email: string; roleBadge: string; isReportingManager: boolean }>();

    // 1. Add assigned reporting manager
    if (assignedPlanTypeManager && assignedPlanTypeManager.email) {
      map.set(assignedPlanTypeManager.email.toLowerCase(), {
        _id: assignedPlanTypeManager._id || assignedPlanTypeManager.email,
        name: assignedPlanTypeManager.name,
        email: assignedPlanTypeManager.email,
        roleBadge: assignedPlanTypeManager.badgeText,
        isReportingManager: true,
      });
    }

    // 2. Add discussed manager if present
    if (plan?.is_discussed_with_manager) {
      const mId = typeof plan.discussed_manager_id === "object" ? plan.discussed_manager_id?._id : plan.discussed_manager_id;
      const mName = plan.discussed_manager_name || (typeof plan.discussed_manager_id === "object" ? plan.discussed_manager_id?.name : "");
      const mEmail = typeof plan.discussed_manager_id === "object" ? plan.discussed_manager_id?.email : "";

      if (mId || mName || mEmail) {
        const matched = allUsers.find((u) => String(u._id || u.id) === String(mId) || (mEmail && u.email?.toLowerCase() === mEmail.toLowerCase()));
        const email = matched?.email || mEmail;
        if (email && !map.has(email.toLowerCase())) {
          map.set(email.toLowerCase(), {
            _id: String(matched?._id || mId || email),
            name: matched?.name || mName || "Discussed Manager",
            email: email,
            roleBadge: "Discussed Manager",
            isReportingManager: true,
          });
        }
      }
    }

    // 3. Add Portal Admins of work_planner portal only
    for (const u of allUsers) {
      const id = String(u._id || u.id || "");
      if (!id || !u.email) continue;
      const role = getWorkPlannerUserRole(u);
      if (role !== "Admin") continue;

      if (!map.has(u.email.toLowerCase())) {
        map.set(u.email.toLowerCase(), {
          _id: id,
          name: u.name,
          email: u.email,
          roleBadge: "Portal Admin",
          isReportingManager: false,
        });
      }
    }

    // Fallback: If no managers identified, include draftData.managers
    if (map.size === 0 && draftData?.managers && draftData.managers.length > 0) {
      draftData.managers.forEach((m) => {
        if (m.email && !map.has(m.email.toLowerCase())) {
          map.set(m.email.toLowerCase(), {
            _id: String(m._id || m.email),
            name: m.name,
            email: m.email,
            roleBadge: "Manager",
            isReportingManager: false,
          });
        }
      });
    }

    return Array.from(map.values());
  }, [allUsers, assignedPlanTypeManager, plan, draftData]);

  const availableManagers = eligibleManagers;

  // Initialize draft values once fetched or settings loaded
  useEffect(() => {
    if (!isOpen) {
      setBodyHtml("");
      setSubject("");
      setToEmail("");
      setCcEmails([]);
      setAttachments([]);
      return;
    }

    const planTypeStr = plan?.plan_type || "Visits";
    const pts = effectiveSettings?.planTypeSettings?.[planTypeStr];
    const ptsManagerEmail = pts?.assignedManagerEmail;
    const globalManagerEmail = effectiveSettings?.assignedManagerEmail;

    // Priority for TO recipient:
    // 1. Plan-type assigned manager email
    // 2. Global assigned manager email
    // 3. Draft TO email / discussed manager email / first manager in roster
    const chosenTo =
      ptsManagerEmail ||
      globalManagerEmail ||
      draftData?.to ||
      (plan?.discussed_manager_id && typeof plan.discussed_manager_id === "object"
        ? plan.discussed_manager_id.email
        : "") ||
      availableManagers[0]?.email ||
      "";

    if (chosenTo && (!toEmail || toEmail !== chosenTo)) {
      setToEmail(chosenTo);
    } else if (!toEmail && draftData?.to) {
      setToEmail(draftData.to);
    }

    // CC Field: Use plan type CC emails (or global CC if plan type CC is empty) + draft CC
    const ptsCc = pts?.ccEmails || [];
    const globalCc = effectiveSettings?.ccEmails || [];
    const configuredCc = ptsCc.length > 0 ? ptsCc : globalCc;

    const activeFrom = (sessionUser?.email || draftData?.from_email || "").toLowerCase().trim();
    const normTo = (chosenTo || toEmail || "").toLowerCase().trim();
    const combinedCcSet = new Set<string>();

    configuredCc.forEach((emailStr: string) => {
      const norm = String(emailStr).trim().toLowerCase();
      if (norm && norm !== normTo && norm !== activeFrom) {
        combinedCcSet.add(norm);
      }
    });

    if (draftData?.cc && Array.isArray(draftData.cc)) {
      draftData.cc.forEach((emailStr: string) => {
        const norm = String(emailStr).trim().toLowerCase();
        if (norm && norm !== normTo && norm !== activeFrom) {
          combinedCcSet.add(norm);
        }
      });
    }

    if (ccEmails.length === 0 && combinedCcSet.size > 0) {
      setCcEmails(Array.from(combinedCcSet));
    }

    if (draftData) {
      setSubject((prev) => prev || draftData.subject || "");
      setBodyHtml((prev) => prev || draftData.body_html || "");
    }
  }, [isOpen, draftData, effectiveSettings, plan, availableManagers]);

  // Fallback initial values if draft hasn't loaded yet
  const fromName = sessionUser?.name || "Executive";
  const fromEmail = sessionUser?.email || draftData?.from_email || "";

  // Handle adding CC tag
  const handleAddCc = (emailToAdd: string) => {
    const trimmed = emailToAdd.trim().toLowerCase();
    if (!trimmed) return;
    if (!ccEmails.some((e) => e.toLowerCase() === trimmed)) {
      setCcEmails([...ccEmails, trimmed]);
    }
    setNewCcInput("");
    setIsAddingCc(false);
  };

  const handleRemoveCc = (indexToRemove: number) => {
    setCcEmails(ccEmails.filter((_, i) => i !== indexToRemove));
  };

  // Handle file uploads
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    for (const file of fileList) {
      const tempId = `uploading-${Date.now()}-${file.name}`;
      setUploadingFiles((prev) => [...prev, file.name]);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("resourceId", planId);

      try {
        const res = await uploadAttachmentMut(formData).unwrap();
        if (res) {
          setAttachments((prev) => [
            ...prev,
            {
              _id: res._id,
              original_name: res.original_name || file.name,
              file_name: res.file_name || file.name,
              mime_type: res.mime_type || file.type,
              size: res.size || file.size,
              url: res.url,
            },
          ]);
          toast.success(`Attached ${file.name}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to upload file";
        toast.error(`Error uploading ${file.name}: ${msg}`);
      } finally {
        setUploadingFiles((prev) => prev.filter((name) => name !== file.name));
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (idToRemove: string) => {
    setAttachments((prev) => prev.filter((a) => a._id !== idToRemove));
  };

  // Handle final submission
  const handleSubmitDayEnd = async () => {
    if (!toEmail.trim()) {
      toast.error("Please enter or select a recipient (To email)");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please provide a subject for the Day End report");
      return;
    }
    if (uploadingFiles.length > 0) {
      toast.error("Please wait for all attachments to finish uploading");
      return;
    }

    setSubmitting(true);
    try {
      const payload: DayEndPayload = {
        from_email: fromEmail,
        to_email: toEmail.trim(),
        cc_emails: ccEmails,
        subject: subject.trim(),
        body_html: bodyHtml,
        attachment_ids: attachments.map((a) => a._id),
      };

      await onSendAndComplete(payload);
      toast.success("Day End submitted and email report dispatched successfully!");
      onCompleteSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to complete Day End";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isBusy = submitting || parentLoading;

  return (
    <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-card text-foreground overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3.5 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">Day End Report Mail</h3>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Official Completion Dispatch
              </span>
            </div>
            <p className="text-xs text-muted">
              Standard email composer panel to review, customize, attach files, and dispatch report to managers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            title="Discard and close"
            className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            Discard & Close
          </button>
          <button
            type="button"
            disabled={isBusy || uploadingFiles.length > 0}
            onClick={handleSubmitDayEnd}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending & Completing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send & Complete Day End
              </>
            )}
          </button>
        </div>
      </div>

      {/* Email Header Fields */}
      <div className="border-b border-border bg-card p-4 space-y-3 shrink-0 text-xs">
          {/* FROM Field */}
          <div className="flex items-center gap-3">
            <span className="w-16 font-semibold text-muted shrink-0 text-right">From:</span>
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted/60 px-3 py-1.5 text-xs text-foreground">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white uppercase">
                {fromName.slice(0, 1)}
              </div>
              <span className="font-medium">{fromName}</span>
              <span className="text-muted text-[11px]">&lt;{fromEmail}&gt;</span>
            </div>
          </div>

          {/* TO Field */}
          <div className="flex items-start sm:items-center gap-3">
            <span className="w-16 font-semibold text-muted shrink-0 text-right pt-1 sm:pt-0">To:</span>
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="Primary Manager Email (e.g. manager@shaktipumps.com)"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {availableManagers.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] flex-wrap pt-1 sm:pt-0">
                  <span className="text-muted text-[11px] font-semibold shrink-0">Quick pick:</span>
                  {availableManagers.map((m) => {
                    const isSelected = toEmail.toLowerCase() === m.email.toLowerCase();
                    const isInCc = ccEmails.some((e) => e.toLowerCase() === m.email.toLowerCase());
                    return (
                      <div key={m._id || m.email} className="inline-flex items-center rounded-lg border border-border bg-surface overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => setToEmail(m.email)}
                          className={`inline-flex items-center gap-1 px-2 py-1 font-medium transition cursor-pointer text-xs ${
                            isSelected
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                              : "hover:bg-surface-muted text-foreground"
                          }`}
                          title={`Set TO: ${m.name} (${m.email})`}
                        >
                          <span>{m.name}</span>
                          <span
                            className={`rounded px-1 py-0.2 text-[9px] font-semibold border ${
                              m.isReportingManager
                                ? "bg-primary/15 text-primary border-primary/20"
                                : "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20"
                            }`}
                          >
                            {m.roleBadge}
                          </span>
                        </button>
                        {!isSelected && !isInCc && (
                          <button
                            type="button"
                            onClick={() => handleAddCc(m.email)}
                            className="px-1.5 py-1 text-[10px] text-muted hover:text-primary hover:bg-primary/10 border-l border-border transition cursor-pointer font-semibold"
                            title={`Add ${m.name} to CC`}
                          >
                            +CC
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* CC Field */}
          <div className="flex items-start gap-3">
            <span className="w-16 font-semibold text-muted shrink-0 text-right pt-1.5">Cc:</span>
            <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[32px]">
              {ccEmails.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-foreground"
                >
                  <Users className="h-3 w-3 text-muted" />
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCc(idx)}
                    className="rounded hover:bg-surface-muted p-0.5 text-muted hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              {isAddingCc ? (
                <div className="flex items-center gap-1">
                  <input
                    type="email"
                    autoFocus
                    value={newCcInput}
                    onChange={(e) => setNewCcInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCc(newCcInput);
                      } else if (e.key === "Escape") {
                        setIsAddingCc(false);
                      }
                    }}
                    placeholder="email@shaktipumps.com"
                    className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-foreground focus:border-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCc(newCcInput)}
                    className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingCc(false)}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:bg-surface-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingCc(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs font-semibold text-muted hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Add CC
                </button>
              )}

              {/* Quick suggestions from remaining managers */}
              {availableManagers
                .filter(
                  (m) =>
                    m.email !== toEmail &&
                    !ccEmails.some((c) => c.toLowerCase() === m.email.toLowerCase())
                )
                .slice(0, 3)
                .map((m) => (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => handleAddCc(m.email)}
                    className="rounded-md border border-border/80 bg-surface/50 px-2 py-0.5 text-[11px] text-muted hover:bg-surface-muted transition cursor-pointer"
                  >
                    + {m.name}
                  </button>
                ))}
            </div>
          </div>

          {/* SUBJECT Field */}
          <div className="flex items-center gap-3">
            <span className="w-16 font-semibold text-muted shrink-0 text-right">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Day End Report Subject"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* ATTACHMENTS Bar */}
          <div className="flex items-start gap-3 pt-1">
            <span className="w-16 font-semibold text-muted shrink-0 text-right pt-1.5">Attach:</span>
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*,.xlsx,.xls,.csv,.doc,.docx"
                onChange={handleFilesSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
              >
                <Paperclip className="h-3.5 w-3.5 text-muted" />
                Attach Files (PDF, Image, Excel, etc.)
              </button>

              {/* Uploading indicator tags */}
              {uploadingFiles.map((fname, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="truncate max-w-[150px]">{fname}</span>
                  <span className="text-[10px] font-medium">Uploading...</span>
                </div>
              ))}

              {/* Attached file chips */}
              {attachments.map((att) => (
                <div
                  key={att._id}
                  className="group inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted/50 px-2.5 py-1 text-xs text-foreground shadow-2xs hover:bg-surface transition"
                >
                  {getFileIcon(att.mime_type, att.original_name)}
                  <span
                    className="truncate max-w-[160px] font-medium"
                    title={att.original_name || att.file_name}
                  >
                    {att.original_name || att.file_name}
                  </span>
                  <span className="text-[10px] text-muted font-normal">
                    ({formatFileSize(att.size)})
                  </span>

                  {att.url && (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Preview attachment"
                      className="text-muted hover:text-foreground transition"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att._id)}
                    title="Remove attachment"
                    className="text-muted hover:text-rose-500 transition cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rich Text Editor Body */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden bg-surface/30">
          <div className="flex items-center justify-between pb-2 text-xs text-muted">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Email Body (Rich WYSIWYG Editor)
            </span>
            <span>Formatted HTML summary of visits, tasks, and notes</span>
          </div>

          {draftLoading ? (
            <div className="flex-1 flex items-center justify-center border border-border rounded-xl bg-card">
              <div className="flex flex-col items-center gap-2 text-muted">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                <span className="text-xs">Preparing standard Day End email template...</span>
              </div>
            </div>
          ) : (
            <DayEndRichEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Edit your day end remarks and summary..."
              className="flex-1 h-full"
              minHeight="280px"
            />
          )}
        </div>

        {/* Footer Warning & Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="text-[11px] leading-tight">
              Completing Day End marks this work plan as completed and locks further edits to visits and tasks.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isBusy || uploadingFiles.length > 0}
              onClick={handleSubmitDayEnd}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending & Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Complete Day End
                </>
              )}
            </button>
          </div>
        </div>
      </div>
  );
}

export default DayEndMailModal;
