# Constraints

## Uniqueness
See [Indexes](05-indexes.md) for unique indexes.

## Enums (selected)

### Order.status
`draft`, `submitted`, `sales_approved`, `finance_review`, `finance_approved`, `finance_rejected`, `account_review`, `account_approved`, `account_rejected`, `dispatch`, `in_transit`, `delivered`, `closed`, `cancelled`, `on_hold`

Note: `closed` in schema but absent from transition graph.

### Lead.status
`new`, `assigned`, `contacted`, `qualified`, `unqualified`, `follow_up`, `quotation`, `negotiation`, `won`, `lost`, `converted`

### WorkPlan.status
`planned`, `draft`, `submitted`, `approved`, `rejected`, `completed`

## Required fields
Vary by model — see Data Dictionary / schema `required: true`.

## Application-level constraints
Workflow transition graph; flag blocking; portal RBAC — not DB-enforced.
