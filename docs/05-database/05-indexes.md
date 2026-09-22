# Indexes

Important indexes observed in schemas (non-exhaustive):

| Model | Index notes |
|-------|-------------|
| User | `email` unique; `company_id` |
| Portal | `code` unique |
| Role | `code` unique |
| Order | `order_no` unique; compound indexes including `deletedAt` |
| Party | `party_name`; sparse `gst_no`; featured+active |
| Product | `sku` unique sparse; text/`searchable_text` |
| ProductSubgroup | unique `(name, group)` |
| Batch | unique `(product, batch_no)` |
| PartyProductMapping | unique `(party, product)` |
| PartyProductLastRate | unique `(party, product)` |
| WorkPlan | unique `(sales_user, plan_date)` where `deletedAt` null |
| WorkPlanVisit | unique `(work_plan, sequence)` |
| Lead | `lead_no` unique |
| PushSubscription | `endpoint` unique |
| Message | indexes on order/recipient/channel/status |
| FollowUpDigestLog | unique kind+user+digest_date trio |
| CompanyInfo | `is_default` |

**Caveat:** OrderDispatch index referencing `status` while field is `dispatch_status` may be incorrect — **Requires confirmation**.

## Source
Schema `index: true` / `schema.index(...)` in mongoRegistry and models.
