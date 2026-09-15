"use client";

import { useSearchParams } from "next/navigation";
import { QuotationFormPage } from "@/components/quotations/QuotationFormPage";

export default function CreateQuotationRoutePage() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId") || undefined;
  return <QuotationFormPage mode="create" leadId={leadId} portalHome="/dashboard" />;
}
