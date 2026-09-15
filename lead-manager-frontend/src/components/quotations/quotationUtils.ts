/**
 * @fileoverview Utility functions for Quotations module.
 * @module components/portal/shared/quotations/quotationUtils
 */

export function formatCurrencyINR(amount: number): string {
  if (amount == null || isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

import { isManager, readSessionFromStorage } from "@/utils/authStorage";

export function canManageQuotations(
  user?: any
): boolean {
  return isManager(user);
}

export function canCreateQuotation(
  leadStatusOrUser?: string | { department?: string; role?: string } | null,
  leadStatus?: string
): boolean {
  if (typeof leadStatusOrUser === "string") {
    return leadStatusOrUser !== "lost";
  }
  if (!leadStatusOrUser) return false;
  if (!canManageQuotations(leadStatusOrUser)) return false;
  if (leadStatus && leadStatus === "lost") return false;
  return true;
}

export type QuotationUserRef = {
  _id?: string;
  email?: string;
  department?: string;
  name?: string;
};

export type QuotationLike = {
  _id?: string;
  status?: string;
  approval_status?: string;
  signatory_user?: string | QuotationUserRef | null;
  signatory_email?: string;
  signatory_name?: string;
};

export function isStrictSignatory(
  user?: QuotationUserRef | null,
  quotation?: QuotationLike | null
): boolean {
  if (!user) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!user || !quotation) return false;

  const userId = user._id || (user as any).id;
  const sigUserId =
    typeof quotation.signatory_user === "object" && quotation.signatory_user !== null
      ? quotation.signatory_user._id || (quotation.signatory_user as any).id
      : (quotation.signatory_user as string);

  if (sigUserId && userId && String(sigUserId) === String(userId)) {
    return true;
  }

  if (
    quotation.signatory_email &&
    user.email &&
    quotation.signatory_email.toLowerCase().trim() === user.email.toLowerCase().trim()
  ) {
    return true;
  }

  return false;
}

export function isAssignedSignatory(
  user?: QuotationUserRef | null,
  quotation?: QuotationLike | null
): boolean {
  if (!user) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!user || !quotation) return false;

  if (isManager(user as any)) {
    return true;
  }

  return isStrictSignatory(user, quotation);
}

export function isQuotationApproved(quotation?: QuotationLike | null): boolean {
  if (!quotation) return false;
  return (
    quotation.approval_status === "approved" ||
    quotation.status === "approved" ||
    quotation.status === "sent" ||
    quotation.status === "accepted"
  );
}

export function canViewQuotationPdf(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!quotation) return false;
  return isQuotationApproved(quotation);
}

export function canEmailQuotation(quotation?: QuotationLike | null): boolean {
  if (!quotation) return false;
  if (
    quotation.status === "accepted" ||
    quotation.status === "rejected" ||
    quotation.status === "expired" ||
    quotation.status === "draft" ||
    quotation.status === "pending_approval"
  ) {
    return false;
  }
  return isQuotationApproved(quotation);
}

export function canEditQuotation(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!user || !quotation) return false;
  return canManageQuotations(user) || isQuotationCreator(user, quotation);
}

export function isQuotationCreator(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!user || !quotation) return false;
  if (!quotation.created_by) return true;

  const userId = user._id || (user as any).id;
  const creatorId =
    typeof quotation.created_by === "object" && quotation.created_by !== null
      ? quotation.created_by._id
      : (quotation.created_by as string);

  if (creatorId && userId && String(creatorId) === String(userId)) {
    return true;
  }

  const creatorEmail =
    typeof quotation.created_by === "object" && quotation.created_by !== null
      ? quotation.created_by.email
      : undefined;

  if (creatorEmail && user.email && creatorEmail.toLowerCase().trim() === user.email.toLowerCase().trim()) {
    return true;
  }

  return false;
}

export function isQuotationVisible(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!quotation) return false;
  if (!user) return true;

  if (isManager(user as any)) {
    return true;
  }

  if (quotation.status === "draft") {
    return isQuotationCreator(user, quotation);
  }

  return true;
}

export function canSubmitForApproval(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!user) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!quotation) return false;
  if (quotation.status !== "draft") return false;
  return isQuotationCreator(user, quotation);
}

export function isDraftVisible(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  return isQuotationVisible(user, quotation);
}

export function isQuotationRosterVisible(
  user?: QuotationUserRef | null,
  quotation?: (QuotationLike & { created_by?: string | QuotationUserRef | null }) | null
): boolean {
  if (!quotation) return false;
  if (!user) {
    const s = readSessionFromStorage();
    user = s?.user || null;
  }
  if (!user) return true;

  return isQuotationCreator(user, quotation) || isStrictSignatory(user, quotation);
}
