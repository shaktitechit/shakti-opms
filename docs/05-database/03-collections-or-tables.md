# Collections Catalog

MongoDB collection names generally follow Mongoose pluralization unless `collection:` is set (e.g. `product_kit_items`, `party_product_last_rates`).

## Identity (auth-service)

| Model | Purpose |
|-------|---------|
| User | Accounts, portals, roles |
| Role | Role catalog |
| Department | Department catalog |
| Portal | Portal catalog + default access_roles |
| CompanyInfo | Branding & legal/tax profile |

## Catalog / counterparty

| Model | Purpose |
|-------|---------|
| Party | Customer/supplier |
| Zone | Territory grouping |
| Warehouse | Warehouse master |
| Customer | Legacy/alternate customer (**present in registry**) |
| Product | Product / kit |
| ProductKitItem | Kit composition |
| ProductGroup / Subgroup / Brand / Manufacturer | Taxonomy |
| Batch | Inventory batch |
| PartyProductMapping / Rate / LastRate | Pricing |

## Order spine

| Model | Purpose |
|-------|---------|
| Order | Core order |
| OrderWorkflow | Append-only workflow actions |
| OrderStatusHistory | Status changes |
| OrderApproval | Unified approvals |
| OrderAmmendmentUser | Amendment actors |
| OrderFlag | Flags |
| OrderDispatch | Dispatch |
| TransportShipment | Shipment |
| OrderDelivery | Delivery |
| OrderReturn | Returns |
| OrderDueSheet | Due sheets |
| UnbilledOrder | Unbilled tracking |
| Reminder | Reminders |
| Attachment | File metadata |
| ActivityLog | Activity |
| TransportPlan / TransportPlanOrder | Transport planner |
| TransportAgent / Vehicle / Driver | Fleet |
| TermsAndConditions / TermsText | T&C |

## CRM

| Model | Purpose |
|-------|---------|
| Lead | Lead |
| LeadFollowUp | Follow-ups |
| LeadSource / LeadLostReason | Masters |
| LeadQuotation | Quotations |
| FollowUpDigestLog | Digest dedupe |

## Work planner

| Model | Purpose |
|-------|---------|
| WorkPlan | Daily plan |
| WorkPlanVisit / WorkPlanWork / WorkPlanExpense | Children |
| UserWorkPlannerSettings | Per-user settings |

## Comms

| Model | Purpose |
|-------|---------|
| Notification | In-app notification |
| PushSubscription | Web push |
| Message | Outbound message log |
