"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Network,
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import {
  useGetTeamTreeQuery,
  useUpsertTeamEdgeMutation,
  useRemoveTeamEdgeMutation,
} from "@/store/api/workPlannerApiSlice";
import { isWpAdmin, readSessionFromStorage } from "@/utils/authStorage";

export function TeamManagerPage() {
  const sessionUser = useMemo(() => readSessionFromStorage()?.user, []);
  const adminAccess = isWpAdmin(sessionUser);

  const { data: tree, isLoading, refetch, error } = useGetTeamTreeQuery(undefined, {
    skip: !adminAccess,
  });
  const [upsertEdge, { isLoading: saving }] = useUpsertTeamEdgeMutation();
  const [removeEdge, { isLoading: removing }] = useRemoveTeamEdgeMutation();

  const [subordinateId, setSubordinateId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  const managers = tree?.managers || [];
  const executives = tree?.executives || [];
  const admins = tree?.admins || [];
  const unassignedManagers = tree?.unassignedManagers || [];
  const unassignedExecutives = tree?.unassignedExecutives || [];

  const subordinateOptions = useMemo(() => {
    return [...managers, ...executives].sort((a: any, b: any) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [managers, executives]);

  const managerOptions = useMemo(() => {
    const sub = subordinateOptions.find((u: any) => String(u._id) === subordinateId);
    const role = sub?.wp_role;
    if (role === "executive") return managers;
    if (role === "manager") return admins;
    return [...managers, ...admins];
  }, [subordinateId, subordinateOptions, managers, admins]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormOk("");
    if (!subordinateId || !managerId) {
      setFormError("Select both the report and their manager.");
      return;
    }
    try {
      await upsertEdge({ subordinate: subordinateId, manager: managerId }).unwrap();
      setFormOk("Reporting saved. Assigned manager updated for all plan types in user settings.");
      setSubordinateId("");
      setManagerId("");
      refetch();
    } catch (err: any) {
      setFormError(err?.data?.message || err?.error || "Failed to save mapping");
    }
  }

  async function handleUnmap(id: string) {
    setFormError("");
    setFormOk("");
    try {
      await removeEdge(id).unwrap();
      setFormOk("Reporting removed. Assigned manager cleared in user settings.");
      refetch();
    } catch (err: any) {
      setFormError(err?.data?.message || err?.error || "Failed to remove mapping");
    }
  }

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
    <div className="space-y-6 font-sans">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
              Team Manager
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                Admin
              </span>
            </h1>
            <p className="text-xs text-muted mt-0.5">
              Map executives → managers and managers → admins. This also sets Assigned Manager
              (global + all plan types) in user settings. Reverse mapping is blocked.
            </p>
          </div>
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

      {(formError || (error as any)?.data?.message) && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-300">
          {formError || (error as any)?.data?.message}
        </div>
      )}
      {formOk && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300">
          {formOk}
        </div>
      )}

      <form
        onSubmit={handleAssign}
        className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3"
      >
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <UserPlus className="h-4 w-4 text-primary" />
          Assign reporting relationship
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
          <label className="block text-xs font-semibold text-muted">
            Reports (executive or manager)
            <select
              value={subordinateId}
              onChange={(e) => {
                setSubordinateId(e.target.value);
                setManagerId("");
              }}
              className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select person…</option>
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
            Reports to (manager or admin)
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
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
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save mapping"}
          </button>
        </div>
        <p className="text-[11px] text-muted">
          Allowed pairs only: executive → manager, manager → admin.
        </p>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Current mappings
          </h2>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {(tree?.edges || []).length === 0 && (
              <p className="text-xs text-muted py-6 text-center">No reporting edges yet.</p>
            )}
            {(tree?.edges || []).map((edge: any) => {
              const sub = (tree?.users || []).find(
                (u: any) => String(u._id) === String(edge.subordinate?._id || edge.subordinate)
              );
              const mgr = (tree?.users || []).find(
                (u: any) => String(u._id) === String(edge.manager?._id || edge.manager)
              );
              const subId = String(edge.subordinate?._id || edge.subordinate);
              return (
                <div
                  key={subId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-muted/40 px-3 py-2.5"
                >
                  <div className="min-w-0 text-xs">
                    <div className="font-semibold text-foreground truncate">
                      {sub?.name || edge.subordinate?.name || subId}
                      <span className="ml-1 text-[10px] uppercase text-muted">
                        ({edge.subordinate_role || sub?.wp_role})
                      </span>
                    </div>
                    <div className="text-muted truncate">
                      → {mgr?.name || edge.manager?.name || String(edge.manager)}
                      <span className="ml-1 text-[10px] uppercase">
                        ({edge.manager_role || mgr?.wp_role})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Remove mapping"
                    disabled={removing}
                    onClick={() => handleUnmap(subId)}
                    className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
            <h2 className="text-sm font-bold text-foreground mb-2">Unassigned managers</h2>
            {unassignedManagers.length === 0 ? (
              <p className="text-xs text-muted">All managers report to an admin.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {unassignedManagers.map((u: any) => (
                  <li key={String(u._id)} className="text-foreground">
                    {u.name} <span className="text-muted">({u.email})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
            <h2 className="text-sm font-bold text-foreground mb-2">Unassigned executives</h2>
            {unassignedExecutives.length === 0 ? (
              <p className="text-xs text-muted">All executives report to a manager.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {unassignedExecutives.map((u: any) => (
                  <li key={String(u._id)} className="text-foreground">
                    {u.name} <span className="text-muted">({u.email})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
