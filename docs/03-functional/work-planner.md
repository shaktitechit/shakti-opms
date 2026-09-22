# Module: Work Planner

## Purpose
Daily field plans (visits/works), approvals, expenses, and per-user settings.

## Actors
work_planner admin/manager/executive (+ global admin bypass)

## WorkPlan statuses
`planned`, `draft`, `submitted`, `approved`, `rejected`, `completed`

Editable (constants): `planned`, `draft`, `rejected`

## Workflow
1. Create plan for date (unique per sales_user+date when active)
2. Add visits/works
3. Submit → manager/admin approve/reject
4. Execute visits (check-in/out/complete)
5. Submit expenses → approve/reject
6. Complete plan / day-end flows in UI

## Related APIs
`/api/work-planner/*` (plans, visits, works, expenses, user-settings, uploads, stats)

## Related DB
WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense, UserWorkPlannerSettings

## Related UI
work-planner-frontend dashboard routes

## Source
`work-planner-backend/`, `work-planner-frontend/`
