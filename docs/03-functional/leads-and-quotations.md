# Module: Leads & Quotations

## Purpose
CRM pipeline from lead creation through follow-ups, quotations, and conversion.

## Actors
lead_manager `admin|manager|executive`; limited cross-access from work_planner for lead list.

## Lead statuses (enum)
`new`, `assigned`, `contacted`, `qualified`, `unqualified`, `follow_up`, `quotation`, `negotiation`, `won`, `lost`, `converted`

## Workflow
1. Create lead
2. Assign / change status / qualify
3. Schedule follow-ups
4. Create quotation (admin/manager)
5. Submit/approve/reject quotation
6. Mark won/lost or convert to party/order linkage fields

## Jobs
node-cron follow-up reminder digests (`FOLLOWUP_REMINDER_*`)

## Related APIs
`/api/leads`, `/api/lead-masters`, `/api/quotations`, `/api/terms-and-conditions`, `/api/attachments`

## Related DB
Lead, LeadFollowUp, LeadSource, LeadLostReason, LeadQuotation, FollowUpDigestLog, Terms*

## Related UI
lead-manager-frontend `/dashboard/leads|quotations|follow-ups|reports`

## Source
`lead-manager-backend/`, `lead-manager-frontend/`
