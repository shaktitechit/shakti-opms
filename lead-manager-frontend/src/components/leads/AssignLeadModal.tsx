/**
 * @fileoverview Modal to assign or reassign a lead to a team member.
 * @module components/portal/shared/leads/AssignLeadModal
 */
"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, X } from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import { ModalOverlay } from "@/components/portal/shared/ModalOverlay";
import {
  useAssignLeadMutation,
  useListUsersQuery,
  type LeadRecord,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import {
  canAssignLead,
  isUserInLeadManagerPortal,
  getLeadManagerPortalRole,
} from "./leadUtils";

type Props = {
  lead: LeadRecord;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function AssignLeadModal({ lead, open, onClose, onSuccess }: Props) {
  const authUser = useAppSelector((state) => state.auth.user);
  const authUserId = String(authUser?._id || authUser?.id || "");

  const initialAssigned = typeof lead.assigned_to === "object"
    ? lead.assigned_to?._id || ""
    : lead.assigned_to || "";

  const [assignedTo, setAssignedTo] = useState<string>(initialAssigned);
  const [notes, setNotes] = useState("");

  const { data: usersData, isLoading: loadingUsers } = useListUsersQuery();
  const [assignLead, { isLoading }] = useAssignLeadMutation();

  useEffect(() => {
    const curr = typeof lead.assigned_to === "object"
      ? lead.assigned_to?._id || ""
      : lead.assigned_to || "";
    setAssignedTo(curr);
  }, [lead]);

  const rawUsers = Array.isArray(usersData)
    ? (usersData as Array<{ _id: string; name: string; email?: string; department?: string; role?: string; portals?: Array<{ portal_code: string; access_roles?: string[] }> }>)
    : (usersData as { data?: Array<{ _id: string; name: string; email?: string; department?: string; role?: string; portals?: Array<{ portal_code: string; access_roles?: string[] }> }> })?.data || [];

  const allUsers = React.useMemo(() => {
    const filtered = rawUsers.filter(isUserInLeadManagerPortal);
    return filtered.length > 0 ? filtered : rawUsers;
  }, [rawUsers]);

  if (!open || !canAssignLead(authUser)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignedTo) {
      toast.error("Please select a user to assign the lead");
      return;
    }

    try {
      await assignLead({
        id: lead._id,
        assigned_to: assignedTo,
        notes: notes.trim() || undefined,
      }).unwrap();
      toast.success("Lead assignment updated successfully");
      onClose();
      onSuccess?.();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  return (
    <LargeModalPortal>
      <ModalOverlay onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-white/10 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Assign Lead
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lead #{lead.lead_no} • {lead.name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assigned User <span className="text-rose-500">*</span>
              </label>
              {loadingUsers ? (
                <div className="mt-1.5 h-9 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ) : (
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select User...</option>
                  {allUsers.map((u) => {
                    const roleBadge = getLeadManagerPortalRole(u);
                    return (
                      <option key={u._id} value={u._id}>
                        {u.name} {u._id === authUserId ? "(You) " : ""}{roleBadge ? `(${roleBadge})` : ""}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assignment Note <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for reassignment or notes..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save Assignment"}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>
    </LargeModalPortal>
  );
}
