# Backend Architecture

## Common pattern

Each API service:

1. `src/server.js` — connect Mongo, optional queues/workers, listen
2. `src/app.js` — Express app, CORS, JSON limit, mount routers, `/health`
3. `src/modules/*` — routes → controllers → services
4. `src/data/mongoRegistry.js` or `src/models/*` — Mongoose schemas
5. `src/middlewares/*` — auth / portal gates

## opms-backend as BFF

Mounts local domain routers under `/api/*` and **HTTP-proxies**:

- `/api/auth`, `/api/users`, `/api/company-info`, `/api/portals`, `/api/departments` → auth-service
- `/api/products`, product-* → product-service
- `/api/parties`, zones, party-* → party-service
- `/api/notifications`, push → notification-service
- `/api/messages`, emails, auto-emails, communication → message-service

Source: `opms-backend/src/app.js`

## Queues / workers (opms-backend)

BullMQ queues under `src/queues/` (orders, orderApproval, dispatches, workflow, reports) with workers in `src/workers/`.

message-service: `messages`, `autoEmails`  
notification-service: `notifications`

## Auth middleware pattern

1. Global optional JWT populate
2. Route `requireAuth`
3. Portal gate (`requireOpmsAccess` / lead / work planner)

## OpenAPI

Only opms-backend exposes Swagger UI at `/api-docs`.
