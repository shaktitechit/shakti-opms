"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, CheckCircle, XCircle, Paperclip, Eye } from "lucide-react";
import { resolvePublicAssetUrl, withFileAccessToken } from "@/lib/env";
import { toast } from "sonner";
import {
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useRemoveExpenseMutation,
  useSubmitExpenseMutation,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useSubmitAllExpensesMutation,
  useApproveAllExpensesMutation,
  useRejectAllExpensesMutation,
} from "@/store/api/workPlannerApiSlice";
import { isManager as isManagerUtil, readSessionFromStorage } from "@/utils/authStorage";
import type { WorkPlanExpenseRecord, WorkPlanRecord } from "@/types/workPlanner";
import { ExpenseFormModal, type ExpenseFormPayload } from "./ExpenseFormModal";
import { RejectExpenseModal } from "./RejectExpenseModal";
import { FilePreviewModal, useFilePreview } from "./FilePreviewModal";
import { canAddExpenseForPlanDate, expenseAddWindowHint, formatPlanDate } from "./workPlanUtils";

export type ExpenseListSectionProps = {
  plan: WorkPlanRecord;
  isManager?: boolean;
  onRefresh?: () => void | Promise<void>;
};

function formatMoney(n?: number) {
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function statusBadge(status?: string) {
  const s = status || "draft";
  const styles: Record<string, string> = {
    draft: "bg-surface-muted text-muted",
    submitted: "bg-primary/10 text-primary",
    approved: "bg-emerald-500/10 text-emerald-500",
    rejected: "bg-rose-500/10 text-rose-500",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[s] || styles.draft}`}
    >
      {s === "submitted" ? "Pending Approval" : s}
    </span>
  );
}

export function ExpenseListSection({
  plan,
  isManager: isManagerProp,
  onRefresh,
}: ExpenseListSectionProps) {
  const sessionUser = readSessionFromStorage()?.user;
  const sessionToken = readSessionFromStorage()?.token;
  const isManager = isManagerProp ?? isManagerUtil(sessionUser);
  const { previewDoc, previewBlobUrl, previewLoading, openPreview, closePreview, downloadFile } =
    useFilePreview(sessionToken);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<WorkPlanExpenseRecord | null>(null);
  const [rejectingExpense, setRejectingExpense] = useState<WorkPlanExpenseRecord | null>(null);
  const [rejectAllOpen, setRejectAllOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [addExpenseMut] = useAddExpenseMutation();
  const [updateExpenseMut] = useUpdateExpenseMutation();
  const [removeExpenseMut] = useRemoveExpenseMutation();
  const [submitExpenseMut] = useSubmitExpenseMutation();
  const [approveExpenseMut] = useApproveExpenseMutation();
  const [rejectExpenseMut] = useRejectExpenseMutation();
  const [submitAllExpensesMut] = useSubmitAllExpensesMutation();
  const [approveAllExpensesMut] = useApproveAllExpensesMutation();
  const [rejectAllExpensesMut] = useRejectAllExpensesMutation();

  const expenses = plan.expenses || [];
  const planId = plan._id || plan.id || "";
  const visits = plan.visits || [];

  const isPlanCompleted = plan.status === "completed";
  const windowOpen = isManager || canAddExpenseForPlanDate(plan.plan_date);
  const windowHint = expenseAddWindowHint(plan.plan_date);

  const draftCount = expenses.filter((e) => e.status === "draft" || e.status === "rejected").length;
  const submittedCount = expenses.filter((e) => e.status === "submitted").length;

  async function handleAddOrUpdate(payload: ExpenseFormPayload) {
    setLoading(true);
    try {
      if (editingExpense) {
        await updateExpenseMut({
          planId,
          expenseId: editingExpense._id || editingExpense.id || "",
          body: payload,
        }).unwrap();
        toast.success("Expense updated successfully");
      } else {
        await addExpenseMut({ planId, body: payload }).unwrap();
        toast.success("Expense claim added successfully");
      }
      setFormOpen(false);
      setEditingExpense(null);
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(exp: WorkPlanExpenseRecord) {
    const id = exp._id || exp.id;
    if (!id) return;
    if (!confirm("Are you sure you want to delete this expense claim?")) return;

    setLoading(true);
    try {
      await removeExpenseMut({ planId, expenseId: id }).unwrap();
      toast.success("Expense claim deleted");
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitSingle(exp: WorkPlanExpenseRecord) {
    const id = exp._id || exp.id;
    if (!id) return;

    setLoading(true);
    try {
      await submitExpenseMut({ planId, expenseId: id }).unwrap();
      toast.success("Expense submitted for manager approval");
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAll() {
    setLoading(true);
    try {
      await submitAllExpensesMut({ planId }).unwrap();
      toast.success("All draft expenses submitted for approval");
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit all expenses";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveSingle(exp: WorkPlanExpenseRecord) {
    const id = exp._id || exp.id;
    if (!id) return;

    setLoading(true);
    try {
      await approveExpenseMut({ planId, expenseId: id }).unwrap();
      toast.success("Expense approved");
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectSingle(reason: string) {
    if (!rejectingExpense) return;
    const id = rejectingExpense._id || rejectingExpense.id;
    if (!id) return;

    setLoading(true);
    try {
      await rejectExpenseMut({ planId, expenseId: id, rejection_reason: reason }).unwrap();
      toast.success("Expense rejected");
      setRejectingExpense(null);
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject expense";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAll() {
    setLoading(true);
    try {
      await approveAllExpensesMut({ planId }).unwrap();
      toast.success("All submitted expenses approved");
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve expenses";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectAll(reason: string) {
    setLoading(true);
    try {
      await rejectAllExpensesMut({ planId, rejection_reason: reason }).unwrap();
      toast.success("All submitted expenses rejected");
      setRejectAllOpen(false);
      await onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject expenses";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Expense Claims ({expenses.length})
          </h3>
          <p className="text-xs text-muted">
            Total Claimed: ₹{formatMoney(plan.expense_total)} · Approved: ₹{formatMoney(plan.expense_approved_total)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted font-medium">
            ℹ️ {windowHint}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {draftCount > 0 && (windowOpen || isManager) ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmitAll}
              className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
            >
              Submit All Claims ({draftCount})
            </button>
          ) : null}

          {isManager && submittedCount > 0 ? (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleApproveAll}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve All ({submittedCount})
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setRejectAllOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject All ({submittedCount})
              </button>
            </>
          ) : null}

          <button
            type="button"
            disabled={!windowOpen}
            title={!windowOpen ? windowHint : "Add expense claim"}
            onClick={() => {
              if (!windowOpen) return;
              setEditingExpense(null);
              setFormOpen(true);
            }}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              windowOpen
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "bg-surface-muted border border-border text-muted cursor-not-allowed"
            }`}
          >
            <Plus className="h-4 w-4" />
            Add Expense Claim
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-muted">
            No expenses logged for this work plan.
          </p>
          {windowOpen && (
            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setFormOpen(true);
              }}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              + Add first expense claim
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-muted font-medium text-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Sub-Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment Mode</th>
                <th className="px-4 py-3">Vendor / Bill</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {expenses.map((exp) => {
                const id = exp._id || exp.id || "";
                const isDraft = exp.status === "draft" || exp.status === "rejected";
                const isSubmitted = exp.status === "submitted";

                return (
                  <tr key={id} className="hover:bg-surface-muted/50 transition">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {formatPlanDate(exp.expense_date)}
                    </td>
                    <td className="px-4 py-3 font-semibold">{exp.category}</td>
                    <td className="px-4 py-3 text-muted">
                      {exp.sub_category || "—"}
                      {exp.category === "Travel" && exp.sub_category === "Private Bike" ? (
                        <div className="text-[10px] text-muted">
                          {exp.start_reading ?? "—"} → {exp.closing_reading ?? "—"} KM
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums text-foreground">
                      ₹{formatMoney(exp.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted">{exp.payment_mode}</td>
                    <td className="px-4 py-3">
                      <div>{exp.vendor_name || "—"}</div>
                      {exp.bill_number ? (
                        <div className="text-[10px] text-muted">Bill: {exp.bill_number}</div>
                      ) : null}
                      {exp.receipt_attachment ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          {(() => {
                            const att = exp.receipt_attachment;
                            const url = typeof att === "object" ? att.url : undefined;
                            const docName =
                              typeof att === "object"
                                ? att.original_name || att.file_name || "Receipt"
                                : "Receipt";
                            const mimeType = typeof att === "object" ? att.mime_type || "" : "";
                            const baseUrl = url ? resolvePublicAssetUrl(url) : "#";
                            const fullUrl = withFileAccessToken(baseUrl, sessionToken);
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openPreview({
                                      name: docName,
                                      url: fullUrl,
                                      mime: mimeType,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
                                  title="Preview document"
                                >
                                  <Eye className="h-3 w-3" />
                                  {docName}
                                </button>
                                <a
                                  href={fullUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted hover:text-foreground transition p-0.5"
                                  title="Open in new tab"
                                >
                                  <Paperclip className="h-3 w-3" />
                                </a>
                              </>
                            );
                          })()}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(exp.status)}
                      {exp.rejection_reason ? (
                        <div className="mt-0.5 text-[10px] text-rose-500">
                          Reason: {exp.rejection_reason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {isManager && isSubmitted ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveSingle(exp)}
                              className="rounded px-2 py-1 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 transition"
                              title="Approve expense"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingExpense(exp)}
                              className="rounded px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition"
                              title="Reject expense"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}

                        {isDraft && (windowOpen || isManager) ? (
                          <button
                            type="button"
                            onClick={() => handleSubmitSingle(exp)}
                            className="rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition"
                            title="Submit expense for approval"
                          >
                            Submit
                          </button>
                        ) : null}

                        {(isDraft && windowOpen) || isManager ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingExpense(exp);
                                setFormOpen(true);
                              }}
                              className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground transition"
                              title="Edit expense"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(exp)}
                              className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition"
                              title="Delete expense"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <ExpenseFormModal
          open={formOpen}
          isSaving={loading}
          visits={visits}
          initial={editingExpense}
          defaultDate={plan.plan_date}
          onClose={() => {
            setFormOpen(false);
            setEditingExpense(null);
          }}
          onConfirm={handleAddOrUpdate}
        />
      ) : null}

      {rejectingExpense ? (
        <RejectExpenseModal
          open={Boolean(rejectingExpense)}
          isRejecting={loading}
          onClose={() => setRejectingExpense(null)}
          onConfirm={handleRejectSingle}
        />
      ) : null}

      {rejectAllOpen ? (
        <RejectExpenseModal
          open={rejectAllOpen}
          isRejecting={loading}
          title="Reject all submitted expenses"
          subtitle="All pending expense claims for this work plan will be rejected."
          onClose={() => setRejectAllOpen(false)}
          onConfirm={handleRejectAll}
        />
      ) : null}

      <FilePreviewModal
        doc={previewDoc}
        blobUrl={previewBlobUrl}
        loading={previewLoading}
        onClose={closePreview}
        onDownload={downloadFile}
      />
    </div>
  );
}

export default ExpenseListSection;
