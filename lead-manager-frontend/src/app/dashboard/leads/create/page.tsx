"use client";

import { LeadFormPage } from "@/components/leads/LeadFormPage";

export default function CreateLeadPage() {
  return <LeadFormPage mode="create" portalHome="/dashboard" />;
}
