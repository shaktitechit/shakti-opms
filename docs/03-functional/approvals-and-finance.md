# Module: Approvals & Finance / Account

## Purpose
Unified order approvals with admin/finance/account signatures; finance queues; due sheets; unbilled tracking; final statements.

## Actors
admin, finance, account, super_admin (and sales where allowed)

## Workflow (approval document)
1. Create/list OrderApproval for order
2. Admin approve / send-to-finance
3. Finance approve / amend / reject
4. Send-to-account
5. Account approve / amend / reject
6. Resolve-dispatch related actions as exposed by routes

## Related APIs
- `/api/order-approvals/*` (approve, reject, send-to-finance, send-to-account, finance-amend, amend, resolve-dispatch, soft-delete)
- `/api/approvals` GET
- `/api/finance/queue`, `/api/finance/summary`
- `/api/order-due-sheets/*`
- `/api/unbilled-orders/*`
- `/api/final-order-statements/*`

## Related DB
OrderApproval, OrderAmmendmentUser, OrderDueSheet, UnbilledOrder

## Related UI
Order detail approval/finance/account tabs in opms-frontend

## Source
`opms-backend/src/modules/orderApproval|finance|orderDueSheet|unbilledOrder|finalOrderStatement|approvals/`
`implementation_plan.md`
