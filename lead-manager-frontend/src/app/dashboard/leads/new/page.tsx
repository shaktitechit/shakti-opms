"use client";

import { LeadFormPage } from "@/components/leads/LeadFormPage";

export default function NewLeadPage() {
  return <LeadFormPage mode="create" portalHome="/dashboard" />;
}
