# Scope

## In scope (verified)

### Applications

| Area | Components |
|------|------------|
| Frontends | app-frontend, opms-frontend, user-manager-frontend, lead-manager-frontend, work-planner-frontend |
| Backends | opms-backend, auth-service, product-service, party-service, lead-manager-backend, work-planner-backend, message-service, notification-service |
| Infra in Compose | Redis |
| Edge | Host nginx configs under `nginx/` for spspl and medica hostnames |
| Data store | MongoDB (external URI) |
| Files | External File Management API (`FILE_MANAGEMENT_API_*`) |

### Functional domains

- Authentication, users, departments, roles, portals, company info
- Orders and departmental workflow
- Approvals, finance queues, account steps
- Dispatch, transport shipments, deliveries, returns
- Due sheets, unbilled orders, final order statements
- Flags, reminders, attachments, activity logs
- Fleet: vehicles, drivers, transport agents
- Transport planner
- Party/zone/product catalogs and party-product rates
- Leads, follow-ups, quotations, lead masters, terms
- Work plans, visits, works, expenses, user work-planner settings
- Notifications, web push, email, WhatsApp, auto-emails, communication helpers
- Google Sheets webhook ingestion (selected modules)

## Out of scope / not implemented in repo

| Item | Status |
|------|--------|
| Compose-hosted MongoDB | Not in compose — external |
| Compose-hosted MinIO | Leftover `minio-data/` only; not a service |
| RabbitMQ | Not present — BullMQ/Redis used |
| CI/CD pipelines | Not identified |
| Mobile native apps | Not identified |
| Full payment collection / invoice_generated lifecycle in live transitions | Essentials docs stale; not in `workflow.transitions.js` |
| Automated Mongo backup jobs in repo | Not identified |
| Centralized APM/metrics stack | Not identified |

## Partial / dual-tenant

- `docker-compose.prod.yml` defines a **subset** of services — incomplete standalone full deploy (**Verified**).
- Medica tenant uses alternate ports/nginx (5001–5013 / `*.medicaent.in`) via `.env.docker.medica` (**Verified** configs exist; dual-stack runbook **Requires confirmation**).

## Related

- [Features](05-features.md)
- [Integrations](09-integrations.md)
