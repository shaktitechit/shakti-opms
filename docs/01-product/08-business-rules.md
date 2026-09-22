# Business Rules

## Order status transitions (verified)

Source: `opms-backend/src/modules/workflow/workflow.transitions.js`

```text
draft → submitted, cancelled
submitted → sales_approved, finance_review, finance_rejected, on_hold, cancelled
sales_approved → finance_review, finance_rejected, on_hold, cancelled
finance_review → finance_approved, finance_rejected, on_hold, dispatch, cancelled
finance_rejected → submitted, cancelled
finance_approved → account_review, dispatch, on_hold, finance_rejected, cancelled
account_review → account_approved, account_rejected, finance_rejected, on_hold, cancelled
account_rejected → account_review, finance_approved, cancelled
account_approved → dispatch, account_review, on_hold, finance_rejected, account_rejected, cancelled
dispatch → in_transit, on_hold, finance_rejected, cancelled
in_transit → delivered, on_hold, cancelled
delivered → in_transit, cancelled
on_hold → (resume to multiple prior active statuses), cancelled
cancelled → (none)
```

**Note:** Schema includes `closed` but transition graph has **no** `closed` edges. `POST .../close-after-full-delivery` exists — behavior should be verified against service code when documenting close semantics.

## Department permission to set status

Source: `workflow.rules.js` (`DEPT_CAN_SET_STATUS` and special cases).  
Sales is limited; admin/super_admin broader; finance/account/dispatch scoped.

## Flag blocking

Flag types `payment_issue`, `stock_issue`, `dispatch_issue` **block** transitions into `dispatch` / `in_transit` / `delivered`.

## Pricing lock

Pricing locked after statuses including `finance_approved`, `account_approved`, `dispatch`, `in_transit`, `delivered` (per rules).

## Priority derivation

Order `priority` derived from expected delivery date windows (>10 low, 5–10 normal, 3–4 high, ≤2 urgent) — as documented in schema analysis of Order model.

## Soft-delete

Default queries exclude `deletedAt != null`. Restore endpoints reverse soft-delete.

## Portal access

Missing portal assignment ⇒ 403 on portal-gated APIs even if `department` is set (swagger description + middleware).

## Lead / Work Planner state machines

Enums exist on models; full transition matrices beyond enums: **partially documented** in functional docs — deep service validation **Requires confirmation** for edge cases.

## Stale documentation warning

`opms-backend/docs/essentials/*` describes older payment/invoice/collection flows — **do not** treat as live business rules.
