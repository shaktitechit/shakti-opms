# Product Overview

**Status labels:** Content below is **Verified** from the monorepo unless marked otherwise.

## Product name

**OPMS** — Order / Operations Portal Management System (packages also use branding names such as Medica / Shakti in env examples and package names).

**Requires confirmation:** Official marketed product name and legal entity branding for end customers.

Sources:
- `DOCKER.md`
- `opms-backend/package.json` (`opms-backend`)
- `auth-service/package.json` (`medica-auth-service`)
- `.env.docker.example` (`COMPANY_NAME` / `NEXT_PUBLIC_COMPANY_*`)

## Purpose

OPMS is a multi-portal business operations platform that enables:

1. **Order lifecycle management** — create, approve, finance/account review, dispatch, transport, delivery, returns, due sheets, flags, reminders
2. **Master data** — parties (customers/suppliers), products (including kits), zones, fleet (vehicles, drivers, transport agents)
3. **CRM** — Lead Manager (leads, follow-ups, quotations, terms)
4. **Field operations** — Work Planner (daily plans, visits, works, expenses)
5. **Identity & access** — Auth service + User Manager (users, departments, roles, portals, company info)
6. **Communications** — in-app notifications, web push, email, WhatsApp messaging

## Problem being solved

**Inferred from implementation:** Organizations need a single identity layer and coordinated portals for sales-to-dispatch order operations, lead-to-quote CRM, and field sales planning — instead of disconnected tools.

**Requires confirmation:** Exact business problem statement and ROI goals from product/business team.

## Target users

| Portal / App | Typical users (from code) |
|--------------|---------------------------|
| App Frontend (SSO hub) | Any authenticated user with department + roles |
| OPMS | `super_admin`, `admin`, `sales`, `finance`, `account`, `dispatch` |
| User Manager | Super-admin / admin style access (`hasSuperAdminAccess`) |
| Lead Manager | `admin`, `manager`, `executive` |
| Work Planner | `admin`, `manager`, `executive` (+ global admin bypass) |

Sources:
- `opms-backend/src/middlewares/opmsAuth.middleware.js`
- `lead-manager-backend/src/middlewares/leadManagerAuth.middleware.js`
- `work-planner-backend` work planner auth middleware
- Frontends' `authStorage` / middleware

## Main use cases

1. Log in via App Frontend and launch assigned portals (SSO with `?token=`).
2. Create and progress sales orders through departmental approvals to dispatch/delivery.
3. Maintain party and product masters (and party-product rates).
4. Plan transport and manage fleet/agents.
5. Manage leads, follow-ups, and quotations; convert leads.
6. Plan field work, check in/out visits, submit expenses.
7. Administer users, portal assignments, departments/roles, and company branding.
8. Receive notifications (SSE/in-app/web push) and send transactional messages (email/WhatsApp).

## Major capabilities

- JWT authentication with shared `JWT_SECRET`
- Portal-scoped RBAC (`user.portals[].portal_code` + `access_roles`)
- Soft-delete / restore on many domain entities
- BullMQ background jobs (orders, notifications, messages) on Redis
- External file management API for uploads
- Google Sheets webhook ingest (orders, parties, products, reminders)
- Dual-tenant host layout (spspl / medica nginx configs)

## Product boundaries

### In scope (verified in repo)

- Microservices and micro-frontends listed in `docker-compose.yml`
- Order workflow as implemented in `workflow.transitions.js`
- Lead Manager and Work Planner modules
- Auth, company info, portals, departments
- Messaging and notifications services

### Out of scope / not identified in codebase

- Payment gateway / online payment capture — **Not identified** as implemented (payment_status fields exist; collection/paid lifecycle in essentials docs is **stale**)
- Native mobile apps — **Not identified**
- Embedded analytics BI warehouse — **Not identified** (dashboards are API summaries only)
- In-compose MongoDB or MinIO — **external** to Compose
- Automated CI/CD pipelines — **Not identified** (no `.github/workflows`)

## Related docs

- [PRD](02-prd.md)
- [Scope](03-scope.md)
- [Features](05-features.md)
- [System Architecture](../02-architecture/01-system-architecture.md)
