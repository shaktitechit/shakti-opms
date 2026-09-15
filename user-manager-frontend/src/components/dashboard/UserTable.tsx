import Link from "next/link";
import { AlertTriangle, Loader2, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { DeptBadge } from "@/components/DeptBadge";

export function UserTable({
  users,
  isLoading,
  error,
  currentUserId,
  onEditClick,
  onDeleteClick,
}: {
  users: any[];
  isLoading: boolean;
  error: string | null;
  currentUserId: string;
  onEditClick?: (user: any) => void;
  onDeleteClick: (user: any) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
      {error && (
        <div className="flex items-center gap-3 p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-b border-border">
          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-16 text-muted gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Fetching accounts from auth-service…</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted bg-surface-muted font-semibold uppercase tracking-wider">
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5 hidden sm:table-cell">Phone</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-sm text-muted">
                    No system users match the selected criteria.
                  </td>
                </tr>
              ) : (
                users.map((u: any) => {
                  const uid = String(u._id || u.id || "");
                  const isActive = u.is_active !== false;
                  const isSelf = uid === currentUserId;

                  return (
                    <tr key={uid} className="hover:bg-surface-muted transition">
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/user-directory/${uid}`} className="flex items-center gap-3 group">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-sm font-extrabold text-primary group-hover:scale-105 transition">
                            {(u.name || "U").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate font-semibold text-foreground group-hover:text-primary transition">{u.name || "—"}</p>
                              {isSelf && (
                                <span className="rounded bg-primary/15 text-primary text-3xs px-1.5 py-0.5 font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted">{u.email || "—"}</p>
                          </div>
                        </Link>
                      </td>

                      <td className="px-5 py-3.5">
                        <DeptBadge dept={u.department || "unknown"} />
                      </td>

                      <td className="px-5 py-3.5 hidden sm:table-cell text-xs text-muted">
                        {u.phone || "—"}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                            <XCircle className="h-3 w-3" /> Inactive
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/user-directory/${uid}`}
                            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-muted transition"
                          >
                            View
                          </Link>
                          <Link
                            href={`/dashboard/user-directory/${uid}/edit`}
                            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted transition"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => onDeleteClick(u)}
                            disabled={isSelf}
                            title={isSelf ? "Cannot delete your own account" : "Delete user"}
                            className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition inline-flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
