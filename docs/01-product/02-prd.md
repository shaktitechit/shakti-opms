# Product Requirements Document (PRD)

**Source of truth:** Implementation in this repository. Numerical SLAs are **not** defined in code unless noted.

## Product Vision

Provide a portalized operations suite where a company can authenticate once, assign users to OPMS / Lead Manager / Work Planner / User Manager portals, and execute order-to-delivery, lead-to-quotation, and field-work processes with shared masters and communications.

**Requires confirmation:** Formal vision statement from product leadership.

## Problem Statement

Sales, finance, account, and dispatch teams need coordinated order processing with auditability; sales leadership needs lead pipelines and quotations; field teams need daily work plans and expense capture — under one identity and company branding model.

## Objectives

| ID | Objective | Evidence |
|----|-----------|----------|
| O-1 | Support multi-role order workflow with transitions and history | `workflow.transitions.js`, OrderWorkflow |
| O-2 | Centralize identity and portal access | auth-service User/Portal |
| O-3 | Provide CRM for leads and quotations | lead-manager-* |
| O-4 | Support field work planning and expenses | work-planner-* |
| O-5 | Notify users and send communications | notification-service, message-service |
| O-6 | Deploy as Docker Compose + nginx | `docker-compose.yml`, `nginx/` |

## Target Users

See [Personas and Roles](04-personas-and-roles.md).

## User Personas

### P1 — Sales Executive (OPMS + optional Lead/Work Planner)

- Creates orders, views own pipeline, may manage leads/plans depending on portal assignment.

### P2 — Finance / Account Reviewer

- Reviews approvals, due sheets, rates, finance/account queues.

### P3 — Dispatch / Logistics

- Creates dispatches, manages transport planner, fleet, deliveries.

### P4 — Portal Administrator (User Manager)

- Manages users, portals, departments/roles, company info.

### P5 — Lead Manager / Manager

- Oversees team leads, quotations, terms, reports.

### P6 — Work Planner Manager

- Assigns team settings, approves plans/expenses.

## User Stories

```text
As a sales user,
I want to create and submit an order,
so that finance/account/dispatch can process it.

As a finance user,
I want to approve or reject order approvals,
so that commercial risk is controlled before dispatch.

As a dispatch user,
I want to create dispatches and transport plans,
so that goods can be shipped and tracked.

As any authenticated user,
I want to log into App Frontend and open my assigned portals with SSO,
so that I do not re-authenticate for each app.

As a super admin,
I want to assign portal access_roles to users,
so that each person only sees authorized workspaces.

As a lead executive,
I want to create leads, schedule follow-ups, and convert won leads,
so that the sales pipeline is managed in one place.

As a work planner executive,
I want to create a daily plan with visits and submit expenses,
so that field activity is recorded and approved.
```

## Functional Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| FR-001 | Users can authenticate with email/password and receive JWT | `auth-service` `POST /api/auth/login` |
| FR-002 | JWT can be exchanged across frontends via `?token=` SSO | app-frontend / portal AuthTokenSsoBootstrap |
| FR-003 | OPMS domain APIs require portal_code `opms` + access_roles | `opmsAuth.middleware.js` |
| FR-004 | Orders support create, submit, transition, soft-delete, restore | `order.routes.js` |
| FR-005 | Order status transitions follow allowed graph | `workflow.transitions.js` |
| FR-006 | Order approvals support approve/reject/send-to-finance/account/amend | `orderApproval.routes.js` |
| FR-007 | Dispatches, deliveries, returns, due sheets, unbilled orders are manageable | respective routes |
| FR-008 | Transport planner supports plan lifecycle and order line actions | `transportPlanner.routes.js` |
| FR-009 | Parties and products CRUD (+ soft-delete) via party/product services | party-service, product-service |
| FR-010 | Lead CRUD, follow-ups, convert, quotations, terms | lead-manager-backend |
| FR-011 | Work plans, visits, works, expenses with approve/reject | work-planner-backend |
| FR-012 | Notifications list/stream/read + web push subscribe | notification-service |
| FR-013 | Email/WhatsApp send and communication triggers | message-service |
| FR-014 | Attachments upload via file management API | attachments modules |
| FR-015 | Dashboards per OPMS role | `dashboard.routes.js` |
| FR-016 | Google Sheet webhooks for orders/parties/products/reminders | webhook routes + secret |
| FR-017 | Company branding via CompanyInfo | auth-service company-info |
| FR-018 | Soft-delete with trash list and restore on many entities | softDelete plugin |

## Non-Functional Requirements

See [Non-Functional Requirements](07-non-functional-requirements.md). No latency/availability SLAs found in repository.

## Acceptance Criteria (implementation-derived)

| Story area | Acceptance criteria (verified behavior) |
|------------|----------------------------------------|
| Login | Valid credentials return JWT; `/api/auth/me` returns user with portals |
| OPMS access | User without `opms` portal receives 403 on domain routes |
| Order transition | Invalid next status rejected per transitions graph |
| Soft-delete | Soft-deleted records excluded from default lists; restore returns them |
| SSO | Opening portal URL with `?token=` establishes session and strips token |
| Health | `GET /health` on backends returns success when process is up |

**Requires confirmation:** Formal UAT scripts and business acceptance sign-off.
