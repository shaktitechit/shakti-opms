"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
  ArrowLeft,
  Building2,
  Star,
  Check,
} from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import type { RoleItem, DepartmentItem } from "@/types/userManager";

export default function RolesPage() {
  const [session, setSession] = useState<any>(null);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter state
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");

  // Modal State for Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalForm, setModalForm] = useState({
    name: "",
    code: "",
    department: "sales",
    is_default_role: false,
    is_system_role: false,
    is_active: true,
  });

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;

  const fetchRolesAndDepartments = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [rolesRes, deptsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/roles?include_inactive=true`, { headers: getAuthHeaders(token) }),
        fetch(`${API_BASE}/api/departments`, { headers: getAuthHeaders(token) }),
      ]);

      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(extractList(data));
      }
      if (deptsRes.ok) {
        const data = await deptsRes.json();
        setDepartments(extractList(data));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load roles and departments.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchRolesAndDepartments();
    }
  }, [token, fetchRolesAndDepartments]);

  const handleSeedRoles = async () => {
    if (!token) return;
    setIsSeeding(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/users/roles/seed`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setSuccessMsg("Standard roles seeded successfully.");
        await fetchRolesAndDepartments();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Seeding roles failed.");
      }
    } catch (e: any) {
      setError(e?.message || "Could not seed roles.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRole(null);
    const defaultDept = departments.length > 0 ? departments[0].code : "sales";
    setModalForm({
      name: "",
      code: "",
      department: defaultDept,
      is_default_role: false,
      is_system_role: false,
      is_active: true,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (role: RoleItem) => {
    setEditingRole(role);
    setModalForm({
      name: role.name,
      code: role.code,
      department: role.department,
      is_default_role: role.is_default_role === true,
      is_system_role: role.is_system_role === true,
      is_active: role.is_active !== false,
    });
    setShowModal(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: modalForm.name.trim(),
        code: modalForm.code.trim().toLowerCase(),
        department: modalForm.department.trim().toLowerCase(),
        is_default_role: modalForm.is_default_role,
        is_system_role: modalForm.is_system_role,
        is_active: modalForm.is_active,
      };

      const url = editingRole
        ? `${API_BASE}/api/users/roles/${editingRole._id || editingRole.id}`
        : `${API_BASE}/api/users/roles`;

      const method = editingRole ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || "Failed to save role.");
      }

      setSuccessMsg(`Role '${modalForm.name}' saved successfully.`);
      setShowModal(false);
      await fetchRolesAndDepartments();
    } catch (err: any) {
      setError(err?.message || "Failed to save role.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefaultRole = async (role: RoleItem) => {
    const rid = role._id || role.id;
    if (!token || !rid) return;

    try {
      const res = await fetch(`${API_BASE}/api/users/roles/${rid}`, {
        method: "PUT",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ is_default_role: true }),
      });

      if (!res.ok) {
        throw new Error("Failed to set default role.");
      }

      setSuccessMsg(`Role '${role.name}' set as default for department '${role.department}'.`);
      await fetchRolesAndDepartments();
    } catch (err: any) {
      setError(err?.message || "Failed to set default role.");
    }
  };

  const handleDeleteRole = async (role: RoleItem) => {
    const rid = role._id || role.id;
    if (!token || !rid) return;
    if (!confirm(`Are you sure you want to delete role '${role.name}'?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/users/roles/${rid}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });

      if (!res.ok) {
        throw new Error("Failed to delete role.");
      }

      setSuccessMsg(`Role '${role.name}' deleted.`);
      await fetchRolesAndDepartments();
    } catch (err: any) {
      setError(err?.message || "Failed to delete role.");
    }
  };

  const filteredRoles = useMemo(() => {
    if (selectedDeptFilter === "all") return roles;
    return roles.filter((r) => r.department === selectedDeptFilter);
  }, [roles, selectedDeptFilter]);

  const rolesByDept = useMemo(() => {
    const map: Record<string, RoleItem[]> = {};
    for (const r of filteredRoles) {
      const d = r.department || "other";
      if (!map[d]) map[d] = [];
      map[d].push(r);
    }
    return map;
  }, [filteredRoles]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
          </div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight mt-1 flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Roles Management Console
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Configure system roles, department permissions, and default roles
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeedRoles}
            disabled={isSeeding}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-xs disabled:opacity-60"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-500" />}
            Seed Standard Roles
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create Role
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Department Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedDeptFilter("all")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition shrink-0 ${
            selectedDeptFilter === "all"
              ? "bg-primary text-white shadow-xs"
              : "border border-border bg-card text-muted hover:text-foreground"
          }`}
        >
          All Departments ({roles.length})
        </button>
        {departments.map((dept) => (
          <button
            key={dept.code}
            onClick={() => setSelectedDeptFilter(dept.code)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition shrink-0 ${
              selectedDeptFilter === dept.code
                ? "bg-primary text-white shadow-xs"
                : "border border-border bg-card text-muted hover:text-foreground"
            }`}
          >
            {dept.name}
          </button>
        ))}
      </div>

      {/* Main Roles Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold">Loading system roles…</p>
        </div>
      ) : Object.keys(rolesByDept).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <ShieldCheck className="h-10 w-10 text-muted" />
          <h3 className="text-base font-bold text-foreground">No Roles Found</h3>
          <p className="text-xs text-muted max-w-md">
            Click &quot;Seed Standard Roles&quot; to populate default roles for all departments or create a new custom role.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSeedRoles}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition"
            >
              <Sparkles className="h-4 w-4" /> Seed Standard Roles
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(rolesByDept).map(([deptCode, deptRoles]) => {
            const deptObj = departments.find((d) => d.code === deptCode);
            const deptTitle = deptObj ? deptObj.name : deptCode.toUpperCase();

            return (
              <div key={deptCode} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-extrabold text-foreground tracking-tight">{deptTitle}</h2>
                  <span className="text-3xs text-muted font-mono">({deptCode})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deptRoles.map((role) => {
                    const isActive = role.is_active !== false;
                    const isDefault = role.is_default_role === true;

                    return (
                      <div
                        key={role.code}
                        className={`rounded-2xl border p-4 shadow-sm flex flex-col justify-between space-y-3 transition duration-200 ${
                          isDefault
                            ? "border-amber-500/40 bg-amber-500/5 shadow-xs"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-sm font-bold text-foreground">{role.name}</h3>
                                {isDefault && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-3xs px-2 py-0.5 font-bold">
                                    <Star className="h-3 w-3 fill-current" /> Default Role
                                  </span>
                                )}
                              </div>
                              <p className="text-3xs font-mono text-muted">code: {role.code}</p>
                            </div>

                            <span
                              className={`rounded-full px-2 py-0.5 text-3xs font-semibold ${
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                              }`}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/80">
                          <div>
                            {!isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultRole(role)}
                                className="inline-flex items-center gap-1 text-3xs font-bold text-muted hover:text-amber-500 transition"
                                title="Set as default role for this department"
                              >
                                <Star className="h-3.5 w-3.5" /> Make Default
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEditModal(role)}
                              className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-1 text-3xs font-semibold text-foreground hover:bg-surface-muted transition"
                            >
                              <Edit className="h-3 w-3" /> Edit
                            </button>

                            <button
                              onClick={() => handleDeleteRole(role)}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-3xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Create / Edit Role */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h3 className="text-base font-bold text-foreground">
                {editingRole ? "Edit Role Configuration" : "Create New System Role"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Role Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalForm.name}
                  onChange={(e) => setModalForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sales Manager"
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Role Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalForm.code}
                  onChange={(e) => setModalForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. sales_manager"
                  required
                  disabled={!!editingRole}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-mono text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Department Assignment <span className="text-rose-500">*</span>
                </label>
                <select
                  value={modalForm.department}
                  onChange={(e) => setModalForm((f) => ({ ...f, department: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                >
                  {departments.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Default Role Setting</label>
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Set as Department Default</p>
                    <p className="text-3xs text-muted">
                      Automatically pre-assigned when creating users in this department
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalForm((f) => ({ ...f, is_default_role: !f.is_default_role }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      modalForm.is_default_role ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        modalForm.is_default_role ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Status</label>
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                  <span className="text-xs font-medium text-foreground">
                    {modalForm.is_active ? "Active Role" : "Inactive / Disabled"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      modalForm.is_active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        modalForm.is_active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition active:scale-95 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Role"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
