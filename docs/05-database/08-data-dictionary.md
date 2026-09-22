# Data Dictionary (selected)

Descriptions only where purpose is clear from field names/code. Unknowns marked.

| Collection/Model | Field | Type | Required | Default | Description | Relationship |
|------------------|-------|------|----------|---------|-------------|--------------|
| User | email | String | yes | — | Login identity | unique |
| User | password | String | yes | — | Hash (select:false) | — |
| User | portals | Array | no | [] | Portal assignments | → Portal |
| User | portals.portal_code | String | — | — | Portal code denorm | — |
| User | portals.access_roles | [String] | — | — | Roles in portal | — |
| User | department | String | no | — | Department code/name | — |
| User | is_active | Boolean | — | — | Active flag | — |
| Portal | code | String | yes | — | Unique portal code | unique |
| Portal | access_roles | [String] | — | — | Default roles list | — |
| Order | order_no | String | — | — | Business number | unique |
| Order | status | String enum | — | — | Workflow status | — |
| Order | lifecycle_status | String enum | — | — | Lifecycle summary | — |
| Order | workflow_stage | String enum | — | — | Stage bucket | — |
| Order | party | ObjectId | — | — | Counterparty | → Party |
| Order | order_items | Array | — | — | Line items | embedded |
| Order | deletedAt | Date | — | null | Soft-delete | — |
| OrderApproval | order | ObjectId | yes | — | Parent order | → Order |
| OrderApproval | is_admin_approved | Boolean | — | false | Admin signature | — |
| OrderApproval | is_finance_approved | Boolean | — | false | Finance signature | — |
| OrderApproval | is_account_approved | Boolean | — | false | Account signature | — |
| Party | party_type | enum | — | — | customer/supplier/both | — |
| Party | party_name | String | — | — | Display name | — |
| Product | product_type | enum | — | — | individual/kit | — |
| Product | sku | String | — | — | SKU | unique sparse |
| Lead | status | enum | — | — | Pipeline status | — |
| Lead | assigned_* | mixed | — | — | Assignment fields | → User |
| WorkPlan | plan_date | Date | — | — | Plan day | unique w/ user |
| WorkPlan | status | enum | — | — | Plan status | — |
| Notification | is_read | Boolean | — | — | Read state | — |
| Message | channel | enum | — | — | email/whatsapp | — |
| Message | status | enum | — | — | Delivery status | — |
| Attachment | entity_type | enum | — | — | Owner type | polymorphic |
| Attachment | entity_id | ObjectId/String | — | — | Owner id | — |

Full field lists: see `mongoRegistry.js` and service models — too large to duplicate verbatim; regenerate from source for audits.

## Related
- [Collections](03-collections-or-tables.md)
