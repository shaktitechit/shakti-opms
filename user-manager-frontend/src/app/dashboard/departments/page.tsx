"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
  ArrowLeft,
  Briefcase,
} from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import type { DepartmentItem, RoleItem } from "@/types/userManager";
import { ShieldCheck } from "lucide-react";

export default function DepartmentsPage() {
  const [session, setSession] = useState<any>(null);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State for Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalForm, setModalForm] = useState({
    name: "",
    code: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;

  const fetchDepartments = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [deptsRes, rolesRes] = await Promise.all([
        fetch(`${API_BASE}/api/departments?include_inactive=true`, { headers: getAuthHeaders(token) }),
        fetch(`${API_BASE}/api/users/roles`, { headers: getAuthHeaders(token) }),
      ]);
      if (!deptsRes.ok) {
        throw new Error("Could not fetch departments list.");
      }
      const data = await deptsRes.json();
      setDepartments(extractList(data));

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(extractList(rolesData));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load departments.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchDepartments();
    }
  }, [token, fetchDepartments]);

  const handleSeedDepartments = async () => {
    if (!token) return;
    setIsSeeding(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/departments/seed`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setSuccessMsg("Standard departments seeded successfully.");
        await fetchDepartments();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Seeding departments failed.");
      }
    } catch (e: any) {
      setError(e?.message || "Could not seed departments.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingDept(null);
    setModalForm({
      name: "",
      code: "",
      description: "",
      is_active: true,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (dept: DepartmentItem) => {
    setEditingDept(dept);
    setModalForm({
      name: dept.name,
      code: dept.code,
      description: dept.description || "",
      is_active: dept.is_active !== false,
    });
    setShowModal(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: modalForm.name.trim(),
        code: modalForm.code.trim().toLowerCase(),
        description: modalForm.description.trim(),
        is_active: modalForm.is_active,
      };

      const url = editingDept
        ? `${API_BASE}/api/departments/${editingDept._id || editingDept.id}`
        : `${API_BASE}/api/departments`;

      const method = editingDept ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || "Failed to save department.");
      }

      setSuccessMsg(`Department '${modalForm.name}' saved successfully.`);
      setShowModal(false);
      await fetchDepartments();
    } catch (err: any) {
      setError(err?.message || "Failed to save department.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDepartment = async (dept: DepartmentItem) => {
    const did = dept._id || dept.id;
    if (!token || !did) return;
    if (!confirm(`Are you sure you want to delete department '${dept.name}'?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/departments/${did}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });

      if (!res.ok) {
        throw new Error("Failed to delete department.");
      }

      setSuccessMsg(`Department '${dept.name}' deleted.`);
      await fetchDepartments();
    } catch (err: any) {
      setError(err?.message || "Failed to delete department.");
    }
  };

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
            <Building2 className="h-6 w-6 text-primary" />
            Department Management Console
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Configure system departments and organization units
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeedDepartments}
            disabled={isSeeding}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-xs disabled:opacity-60"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-500" />}
            Seed Default Departments
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create Department
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

      {/* Main Departments Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold">Loading system departments…</p>
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <Briefcase className="h-10 w-10 text-muted" />
          <h3 className="text-base font-bold text-foreground">No Departments Registered</h3>
          <p className="text-xs text-muted max-w-md">
            Click &quot;Seed Default Departments&quot; to auto-generate standard departments (Sales, Finance, Dispatch, etc.) or create a custom one.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSeedDepartments}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition"
            >
              <Sparkles className="h-4 w-4" /> Seed Standard Departments
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => {
            const isActive = dept.is_active !== false;

            return (
              <div
                key={dept.code}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-primary/40 transition duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{dept.name}</h3>
                        <p className="text-3xs font-mono text-muted">code: {dept.code}</p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-3xs font-semibold ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                      }`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <p className="text-xs text-muted mt-3 line-clamp-2">
                    {dept.description || "No description provided for this department."}
                  </p>

                  {/* Assigned Default Role Badge */}
                  <div className="mt-3 pt-2.5 border-t border-border/60">
                    <div className="flex items-center justify-between text-3xs">
                      <span className="font-semibold text-muted uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-primary" /> Default Role
                      </span>
                      {(() => {
                        const defaultRole = roles.find(
                          (r) => r.department === dept.code && r.is_default_role === true
                        );
                        return defaultRole ? (
                          <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                            {defaultRole.name}
                          </span>
                        ) : (
                          <span className="text-muted italic">None assigned</span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    onClick={() => handleOpenEditModal(dept)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                  >
                    <Edit className="h-3.5 w-3.5" /> Edit
                  </button>

                  <button
                    onClick={() => handleDeleteDepartment(dept)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Create / Edit Department */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h3 className="text-base font-bold text-foreground">
                {editingDept ? "Edit Department Configuration" : "Create New Department"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Department Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalForm.name}
                  onChange={(e) => setModalForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sales"
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Department Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalForm.code}
                  onChange={(e) => setModalForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. sales"
                  required
                  disabled={!!editingDept}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-mono text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Description</label>
                <textarea
                  value={modalForm.description}
                  onChange={(e) => setModalForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief summary of department responsibilities"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition resize-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Status</label>
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                  <span className="text-xs font-medium text-foreground">
                    {modalForm.is_active ? "Active Department" : "Inactive / Disabled"}
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
                    "Save Department"
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
