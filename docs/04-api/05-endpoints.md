# API Endpoints Inventory

**Rule:** Only endpoints verified from `*.routes.js` / `app.js` mounts. Request/response bodies: see Swagger (`/api-docs`) for opms-backend where defined; otherwise **Requires confirmation** from controller source.

Authentication column: Public / Bearer / Bearer+Portal / Secret / Internal.

---

## auth-service (`:7003`)

| Method | Endpoint | Auth | Purpose | Source |
|--------|----------|------|---------|--------|
| POST | `/api/auth/login` | Public | Login | `auth.routes.js` |
| GET | `/api/auth/me` | Bearer | Current user | |
| POST | `/api/auth/change-password` | Bearer | Change password | |
| GET/POST | `/api/users` | Bearer | List/create users | `user.routes.js` |
| GET/PATCH/DELETE | `/api/users/:id` | Bearer | User CRUD | |
| GET/POST | `/api/users/roles` | Bearer | Roles | |
| POST | `/api/users/roles/seed` | Bearer | Seed roles | |
| PUT/DELETE | `/api/users/roles/:id` | Bearer | Update/delete role | |
| GET | `/api/company-info` | Public | Company info | `companyInfo.routes.js` |
| GET | `/api/company-info/data` | Bearer | Data | |
| PUT/PATCH | `/api/company-info` | Bearer | Update | |
| * | `/api/portals` | Bearer | Portal CRUD + seed | `portal.routes.js` |
| * | `/api/departments` | Bearer | Department CRUD + seed | `department.routes.js` |
| GET | `/health` | Public | Health | |

---

## opms-backend domain (`:7001`) — local routers

### Orders `/api/orders` — Bearer + OPMS portal (except webhook)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/google-sheet-webhook` | Public + webhook secret |
| GET | `/` | List |
| GET | `/stats` | Workflow stats |
| GET | `/workflow-context` | Context |
| POST | `/` | Create |
| GET | `/deleted` | Trash |
| GET | `/:id` | Get |
| GET | `/:id/history` | History |
| GET | `/:id/fulfillment` | Fulfillment |
| GET | `/:id/approvals` | Approvals |
| GET | `/:id/assignees` | Assignees |
| PATCH | `/:id` | Update |
| PATCH | `/:id/super-sheet` | Super sheet patch |
| DELETE | `/:id` | Soft-delete |
| POST | `/:id/restore` | Restore |
| POST | `/:id/submit` | Submit |
| POST | `/:id/transition` | Transition status |
| POST | `/:id/close-after-full-delivery` | Close helper |

Source: `opms-backend/src/modules/orders/order.routes.js`

### Order approvals `/api/order-approvals`

| Method | Path |
|--------|------|
| GET | `/`, `/deleted`, `/:id` |
| POST | `/`, `/:id/approve`, `/:id/reject`, `/:id/send-to-finance`, `/:id/send-to-account`, `/:id/finance-amend`, `/:id/amend`, `/:id/resolve-dispatch`, `/:id/restore` |
| PATCH | `/:id`, `/:id/super-sheet` |
| DELETE | `/:id` |

### Finance `/api/finance`
`GET /queue`, `GET /summary`

### Approvals `/api/approvals`
`GET /`

### Dispatch `/api/dispatch`
List/get/create(with `bill_document`)/patch/soft-delete/restore/deleted

### Transport `/api/transport`
Soft-delete CRUD pattern

### Order deliveries `/api/order-deliveries`
List/get/patch/soft-delete/restore + `POST /log-shipment`

### Order returns `/api/order-returns`
List/get/create/patch/soft-delete/restore

### Due sheets `/api/order-due-sheets`
CRUD + document upload + current-by-order + restore

### Unbilled `/api/unbilled-orders`
CRUD soft-delete + `GET /order/:orderId`

### Final statements `/api/final-order-statements`
`GET /`, `GET /order/:orderId`

### Flags `/api/flags`
`GET /`, `GET /:id`, `POST /`, `PATCH /:id`

### Dashboard `/api/dashboard`
`GET /admin|/sales|/finance|/dispatch|/account|/super`

### Activity `/api/activity`
`GET /`

### Attachments `/api/attachments`
List/get/create(multipart)/delete/restore/deleted

### Files `/api`
`GET /files/:fileId/view`, `GET /files/:fileId/download`

### Fleet
`/api/vehicles`, `/api/drivers`, `/api/transport-agents` — soft-delete CRUD

### Reminders `/api/reminders`
Webhook + CRUD + `POST /:id/follow-ups`

### Transport planner `/api/transport-plans`
list/stats/eligible-orders/CRUD/submit/complete/cancel/add-remove orders/LR/packed/dispatched/delivered actions

### Terms `/api/terms-and-conditions`
**No requireAuth on router** — GET/POST/PUT/DELETE including text subresources

### Proxied (same paths as owning services)
auth, products, parties, notifications, messages/emails/…

---

## product-service (`:7005`)

Mounts: `/api/products`, `/api/product-groups`, `/api/product-subgroups`, `/api/product-brands`, `/api/product-manufacturers`, `/api/product-kit-items`  
Pattern: auth + list/get/create/patch/soft-delete/bulk; products webhook; kit by-kit routes; meta-options on products.

---

## party-service (`:7006`)

| Mount | Highlights |
|-------|------------|
| `/api/parties` | webhook; CRUD; bulk; restore |
| `/api/zones` | CRUD; parties; sales-persons |
| `/api/party-products` | CRUD; rates approve |
| `/api/party-order-products-rate` | check/map helpers |

---

## notification-service (`:7012`)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/notifications/internal/order-transition` | Internal (no requireAuth) |
| POST | `/api/notifications/internal/create` | Internal |
| GET | `/api/notifications` | Bearer |
| GET | `/api/notifications/stream` | Bearer SSE |
| PATCH | `/api/notifications/:id/read` | Bearer |
| GET | `/api/push/vapid-public-key` | Public |
| POST/DELETE | `/api/subscribe` | Bearer |
| POST | `/api/push/notify` | Bearer |

---

## message-service (`:7011`)

| Mount | Endpoints |
|-------|-----------|
| `/api/messages` | GET/POST webhook (public); GET/POST send; GET :id (auth) |
| `/api/emails` | POST/, GET/, GET/:id |
| `/api/auto-emails` | POST /trigger |
| `/api/communication` | GET /types; POST /send; /order-received; /queue/:type |

---

## lead-manager-backend (`:7009`)

| Mount | Notes |
|-------|-------|
| `/api/leads` | Full CRM actions; list may allow work_planner |
| `/api/lead-masters` | sources & lost reasons |
| `/api/quotations` | admin/manager gates |
| `/api/terms-and-conditions` | lead_manager access |
| `/api/attachments` | **No requireAuth on router** |
| Proxies | notifications, emails, messages, … |

---

## work-planner-backend (`:7007`)

Base: `/api/work-planner`

| Area | Notes |
|------|-------|
| `GET /attachments/:attachmentId/view` | Before auth (public view redirect) |
| plans/visits/works/expenses | CRUD + lifecycle actions |
| user-settings | Per-user settings |
| uploads/stats | Supporting |

Auth: Bearer + `requireWorkPlannerAccess`

---

## Example: login

### Request
```http
POST /api/auth/login HTTP/1.1
Host: localhost:7003
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "********"
}
```

### Response (shape **Inferred** — confirm against controller)
```json
{
  "token": "<jwt>",
  "user": {
    "email": "admin@example.com",
    "portals": [{ "portal_code": "opms", "access_roles": ["admin"] }]
  }
}
```

## Example: transition order

```http
POST /api/orders/{id}/transition HTTP/1.1
Host: localhost:7001
Authorization: Bearer <token>
Content-Type: application/json

{
  "to_status": "finance_review",
  "remarks": "optional"
}
```

Exact body field names: confirm in `order.controller` / service — do not assume.

## Related
- [OpenAPI YAML](openapi.yaml)
- Live Swagger: `/api-docs` on opms-backend
