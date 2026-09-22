/**
 * @fileoverview Complete Quotation Detail Page with status tracking, letterhead preview, 
 * signatory approval workflow, financial summary, line items, and email dispatch.
 * @module components/portal/shared/quotations/QuotationDetailPage
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Send,
  Check,
  X,
  Printer,
  Mail,
  Lock,
  FileText,
  Building2,
  User,
  Calendar,
  DollarSign,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  ExternalLink,
  Eye,
  Share2,
  ShieldCheck,
  Tag,
  Phone,
  PauseCircle,
} from "lucide-react";
import {
  useGetLeadQuotationQuery,
  useSubmitLeadQuotationForApprovalMutation,
  useApproveLeadQuotationMutation,
  useRejectLeadQuotationMutation,
  useUpdateLeadQuotationMutation,
  type LeadQuotationRecord,
  type LeadRecord,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { readSessionFromStorage, isManager } from "@/utils/authStorage";
import { toast } from "@/lib/toast";
import QuotationPdfTemplate from "./QuotationPdfTemplate";
import { SendQuotationEmailModal } from "./SendQuotationEmailModal";
import {
  formatCurrencyINR,
  isAssignedSignatory,
  isStrictSignatory,
  isQuotationCreator,
  canViewQuotationPdf,
  canEmailQuotation,
  canEditQuotation,
  canSubmitForApproval,
  isQuotationApproved,
} from "./quotationUtils";

type Props = {
  quotationId: string;
  portalHome?: string;
};

export default function QuotationDetailPage({ quotationId, portalHome = "/dashboard" }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const reduxUser = useAppSelector((state) => state.auth.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;

  // Data Query
  const { data: quotation, isLoading, isError, refetch } = useGetLeadQuotationQuery(quotationId, {
    skip: !quotationId,
  });

  const downloadedBy = useMemo(() => {
    if (!authUser) return quotation?.signatory_name || "User";
    const name = String(authUser.name || "").trim();
    if (name && name !== "Authorized Staff" && name !== "Authorized User") return name;
    const first = String(authUser.first_name || "").trim();
    const last = String(authUser.last_name || "").trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    const uname = String(authUser.username || "").trim();
    if (uname) return uname;
    const email = String(authUser.email || "").trim();
    if (email) return email;
    return quotation?.signatory_name || "User";
  }, [authUser, quotation?.signatory_name]);

  // Mutations
  const [submitForApproval, { isLoading: isSubmitting }] = useSubmitLeadQuotationForApprovalMutation();
  const [approveQuotation, { isLoading: isApproving }] = useApproveLeadQuotationMutation();
  const [rejectQuotation, { isLoading: isRejecting }] = useRejectLeadQuotationMutation();
  const [updateQuotation, { isLoading: isUpdating }] = useUpdateLeadQuotationMutation();

  // Dialog & Modal States
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showOnHoldModal, setShowOnHoldModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading quotation details...
        </p>
      </div>
    );
  }

  if (isError || !quotation) {
    return (
      <div className="mx-auto my-12 max-w-lg rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center shadow-xl dark:border-rose-900/40 dark:bg-rose-950/20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
          Quotation Not Found
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          The requested quotation could not be loaded or may have been deleted.
        </p>
        <Link
          href={`${portalHome}/quotations`}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Quotations
        </Link>
      </div>
    );
  }

  const isSignatory = isAssignedSignatory(authUser, quotation);
  const canViewPdf = canViewQuotationPdf(authUser, quotation);
  const canEmail = canEmailQuotation(quotation);
  const canEdit = canEditQuotation(authUser, quotation);
  const canSubmit = canSubmitForApproval(authUser, quotation as unknown as Parameters<typeof canSubmitForApproval>[1]);
  const isPending = quotation.approval_status === "pending_approval" || quotation.status === "pending_approval";
  const isApproved = isQuotationApproved(quotation);
  const isRejected = quotation.approval_status === "rejected" || quotation.status === "rejected";

  const leadId =
    typeof quotation.lead === "object" && quotation.lead !== null
      ? quotation.lead._id
      : (quotation.lead as string);

  // Status Badge Helper
  const getStatusBadge = () => {
    switch (quotation.status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/40">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </span>
        );
      case "pending_approval":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/40">
            <Clock className="h-3.5 w-3.5" /> Pending Signatory Approval
          </span>
        );
      case "sent":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/40">
            <Send className="h-3.5 w-3.5" /> Sent to Customer
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300/40">
            <CheckCircle className="h-3.5 w-3.5" /> Accepted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/40">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/40">
            <Clock className="h-3.5 w-3.5" /> Expired
          </span>
        );
      case "on_hold":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/40">
            <PauseCircle className="h-3.5 w-3.5" /> On Hold
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <FileText className="h-3.5 w-3.5" /> Draft
          </span>
        );
    }
  };

  // Pure Isolated Iframe Printing
  const handlePrint = () => {
    if (!containerRef.current || !canViewPdf) return;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quotation_${quotation.ref_no || quotation.quotation_no || "Document"}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 10mm;
            }
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #0f172a;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            #quotation-pdf-root {
              width: 100% !important;
              max-width: 794px !important;
              margin: 0 auto !important;
              padding: 0 !important;
              box-shadow: none !important;
              background: #ffffff !important;
            }
          </style>
        </head>
        <body>
          ${containerRef.current.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        setTimeout(() => {
          if (printFrame.parentNode) {
            printFrame.parentNode.removeChild(printFrame);
          }
        }, 1000);
      }
    }, 300);
  };

  // Handlers for approval actions
  const handleConfirmSubmitForApproval = async () => {
    try {
      await submitForApproval({ quotationId: quotation._id }).unwrap();
      toast.success(`Quotation ${quotation.quotation_no} submitted for signatory approval`);
      refetch();
    } catch {
      toast.error("Failed to submit quotation for approval");
    }
  };

  const handleConfirmApprove = async () => {
    try {
      await approveQuotation({ quotationId: quotation._id }).unwrap();
      toast.success(`Quotation ${quotation.quotation_no} approved successfully`);
      setShowApproveModal(false);
      refetch();
    } catch {
      toast.error("Failed to approve quotation");
    }
  };

  const handleConfirmAccept = async () => {
    try {
      await updateQuotation({
        quotationId: quotation._id,
        leadId: leadId || "",
        body: { status: "accepted" },
      }).unwrap();
      toast.success(`Quotation ${quotation.quotation_no} marked as Accepted`);
      setShowAcceptModal(false);
      refetch();
    } catch {
      toast.error("Failed to mark quotation as accepted");
    }
  };

  const handleConfirmOnHold = async (newStatus: "on_hold" | "sent") => {
    try {
      await updateQuotation({
        quotationId: quotation._id,
        leadId: leadId || "",
        body: { status: newStatus },
      }).unwrap();
      toast.success(
        newStatus === "on_hold"
          ? `Quotation ${quotation.quotation_no} put On Hold`
          : `Quotation ${quotation.quotation_no} resumed`
      );
      setShowOnHoldModal(false);
      refetch();
    } catch {
      toast.error("Failed to update quotation status");
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejecting this quotation");
      return;
    }
    try {
      await rejectQuotation({
        quotationId: quotation._id,
        rejection_reason: rejectionReason.trim(),
      }).unwrap();
      toast.success(`Quotation ${quotation.quotation_no} rejected`);
      setShowRejectModal(false);
      setRejectionReason("");
      refetch();
    } catch {
      toast.error("Failed to reject quotation");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`${portalHome}/quotations`}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Back to Quotations"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                {quotation.ref_no || quotation.quotation_no}
              </h1>
              {getStatusBadge()}
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Customer: <span className="font-semibold text-slate-700 dark:text-slate-200">{quotation.customer_name || "N/A"}</span>
              {quotation.subject ? ` • ${quotation.subject}` : ""}
            </p>
          </div>
        </div>

        {/* Action Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Submit for approval button */}
          {canSubmit && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmSubmitForApproval}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary-hover disabled:opacity-50 cursor-pointer transition-all"
            >
              <Send className="h-4 w-4" /> Send for Approval
            </button>
          )}

          {/* Strict Signatory Approve / Reject Buttons */}
          {isPending && isSignatory && (
            <>
              <button
                type="button"
                disabled={isApproving || isRejecting}
                onClick={() => setShowApproveModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-all"
              >
                <Check className="h-4 w-4" /> Approve
              </button>
              <button
                type="button"
                disabled={isApproving || isRejecting}
                onClick={() => {
                  setRejectionReason("");
                  setShowRejectModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 disabled:opacity-50 cursor-pointer transition-all"
              >
                <X className="h-4 w-4" /> Reject
              </button>
            </>
          )}

          {/* Approved / Sent / On Hold Status Action Buttons: Mark Accepted, Put On Hold / Resume, Customer Rejected */}
          {(quotation.status === "approved" || quotation.status === "sent" || quotation.status === "on_hold") && (
            <>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setShowAcceptModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-50 cursor-pointer transition-all"
              >
                <CheckCircle2 className="h-4 w-4" /> Mark Accepted
              </button>

              {quotation.status === "on_hold" ? (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setShowOnHoldModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-700 disabled:opacity-50 cursor-pointer transition-all"
                >
                  <Send className="h-4 w-4" /> Resume Quotation
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => setShowOnHoldModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 disabled:opacity-50 cursor-pointer transition-all"
                >
                  <PauseCircle className="h-4 w-4" /> Put On Hold
                </button>
              )}

              <button
                type="button"
                disabled={isUpdating || isRejecting}
                onClick={() => {
                  setRejectionReason("");
                  setShowRejectModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300 disabled:opacity-50 cursor-pointer transition-all"
              >
                <XCircle className="h-4 w-4" /> Customer Rejected
              </button>
            </>
          )}

          {/* Edit Button */}
          {canEdit && (
            <Link
              href={`${portalHome}/quotations/${quotation._id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          )}

          {/* Email Button */}
          {canEmail && (
            <button
              type="button"
              onClick={() => setEmailModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/60 dark:text-blue-300 cursor-pointer transition-colors"
            >
              <Mail className="h-4 w-4" /> Send Email
            </button>
          )}

          {/* Print / PDF Button */}
          <button
            type="button"
            disabled={!canViewPdf}
            onClick={handlePrint}
            title={canViewPdf ? "Print / Download PDF Letterhead" : "PDF preview is locked for non-signatories prior to approval"}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer ${
              canViewPdf
                ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 opacity-80 cursor-not-allowed"
            }`}
          >
            {canViewPdf ? <Printer className="h-4 w-4" /> : <Lock className="h-4 w-4 text-amber-600" />}
            {canViewPdf ? "Print PDF" : "PDF Restricted"}
          </button>
        </div>
      </div>

      {/* Rejection Notice Banner */}
      {isRejected && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-extrabold">Quotation Rejected</h4>
              <p className="mt-1 text-xs leading-relaxed">
                {quotation.rejection_reason || "No specific reason was provided by the signatory."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Letterhead A4 Sheet on Left, Metadata Cards on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Letterhead PDF Container (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col items-center">
          {!canViewPdf ? (
            <div className="my-8 w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xl dark:border-amber-900/40 dark:bg-slate-900">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                <Lock className="h-7 w-7" />
              </div>
              <h4 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                PDF Preview Restricted
              </h4>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                This quotation is currently <strong>Pending Signatory Approval</strong>.
              </p>
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 p-3 rounded-xl dark:bg-amber-950/40 font-semibold leading-relaxed">
                Only the assigned signatory (<strong>{quotation.signatory_name || "Authorized Signatory"}</strong>) can preview or download the PDF prior to approval. Creators can preview and download the PDF after approval.
              </p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="w-full max-w-[794px] bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 flex justify-center"
            >
              <QuotationPdfTemplate
                quotation={quotation}
                portalLabel="Lead Manager"
                downloadedBy={downloadedBy}
              />
            </div>
          )}
        </div>

        {/* Right Column: Metadata Cards (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Quotation Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Quotation Summary
            </h3>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500">Quotation No:</span>
                <span className="font-bold text-slate-900 dark:text-white">{quotation.quotation_no}</span>
              </div>
              {quotation.ref_no && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-500">Ref No:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{quotation.ref_no}</span>
                </div>
              )}
              {quotation.customer_ref && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                  <span className="text-slate-500">Customer Ref:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{quotation.customer_ref}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500">Quotation Date:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {quotation.quotation_date ? new Date(quotation.quotation_date).toLocaleDateString("en-IN") : "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-white/5">
                <span className="text-slate-500">Valid Until:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString("en-IN") : "N/A"}
                  {quotation.validity_days ? ` (${quotation.validity_days} days)` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Customer / Party Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Customer Details
            </h3>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {quotation.customer_name || "N/A"}
              </div>
              {quotation.kind_attn && (
                <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" /> Kind Attn: {quotation.kind_attn}
                </div>
              )}
              {quotation.phone && (
                <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" /> {quotation.phone}
                </div>
              )}
              {quotation.email && (
                <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> {quotation.email}
                </div>
              )}
              {quotation.gstin && (
                <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-slate-400" /> GSTIN: {quotation.gstin}
                </div>
              )}
              {quotation.address?.address_line_1 && (
                <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {quotation.address.address_line_1}
                  {quotation.address.city ? `, ${quotation.address.city}` : ""}
                  {quotation.address.state ? `, ${quotation.address.state}` : ""}
                  {quotation.address.pincode ? ` - ${quotation.address.pincode}` : ""}
                </div>
              )}
            </div>
          </div>

          {/* Financial Breakdown Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Financial Summary
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal ({quotation.items?.length || 0} items):</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrencyINR(quotation.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total GST:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrencyINR(quotation.total_gst || 0)}</span>
              </div>
              {Boolean(quotation.round_off) && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Round Off:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatCurrencyINR(quotation.round_off || 0)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-white/10 text-sm font-black text-slate-900 dark:text-white">
                <span>Grand Total:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrencyINR(quotation.grand_total || 0)}</span>
              </div>
              {quotation.amount_in_words && (
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 italic">
                  "{quotation.amount_in_words}"
                </div>
              )}
            </div>
          </div>

          {/* Signatory & Creator Info Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900 space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Signatory & Creator
            </h3>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Authorized Signatory</div>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {quotation.signatory_name || "Authorized Signatory"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {quotation.signatory_designation || "Signatory"}
                </div>
                {quotation.signatory_email && (
                  <div className="text-[11px] text-slate-400 truncate">{quotation.signatory_email}</div>
                )}
              </div>

              {quotation.created_by && (
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quotation Creator</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {quotation.created_by.name || quotation.created_by.email || "System"}
                  </div>
                  {quotation.createdAt && (
                    <div className="text-[11px] text-slate-400">
                      Created: {new Date(quotation.createdAt).toLocaleDateString("en-IN")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Approve Quotation
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to approve quotation <strong>{quotation.quotation_no}</strong>? This will unlock the PDF preview and letterhead download for the creator.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={handleConfirmApprove}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Confirmation Modal */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 text-teal-600 dark:text-teal-400">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Mark Quotation as Accepted
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to mark quotation <strong>{quotation.quotation_no}</strong> as <strong>Accepted</strong> by customer?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAcceptModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={handleConfirmAccept}
                className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-teal-700 cursor-pointer disabled:opacity-50"
              >
                Confirm Accepted
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <XCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Reject Quotation
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Please specify the reason for rejecting quotation <strong>{quotation.quotation_no}</strong>:
            </p>
            <textarea
              rows={3}
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRejecting}
                onClick={handleConfirmReject}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On Hold / Resume Confirmation Modal */}
      {showOnHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 space-y-4 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <PauseCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {quotation.status === "on_hold" ? "Resume Quotation?" : "Put Quotation On Hold?"}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {quotation.status === "on_hold"
                ? `Are you sure you want to resume Quotation #${quotation.quotation_no}? Status will return to active.`
                : `Are you sure you want to put Quotation #${quotation.quotation_no} on hold?`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOnHoldModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleConfirmOnHold(quotation.status === "on_hold" ? "sent" : "on_hold")}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-700 cursor-pointer disabled:opacity-50"
              >
                {quotation.status === "on_hold" ? "Resume Quotation" : "Put On Hold"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {emailModalOpen && (
        <SendQuotationEmailModal
          quotation={quotation}
          lead={
            quotation.lead && typeof quotation.lead === "object"
              ? (quotation.lead as LeadRecord)
              : null
          }
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
        />
      )}
    </div>
  );
}
