# Features

Feature catalog derived from routes and frontend screens. **Verified** unless noted.

## A. App Frontend (SSO Hub)

| Feature | Description | Source |
|---------|-------------|--------|
| Login | Email/password login with company branding | `app-frontend` `/` |
| Department dashboard | Assigned portals launcher | `/dashboard/[department]` |
| Profile / password | Change password | `/dashboard/profile` |
| Notifications | Bell via auth proxy | NotificationBell |
| SSO launch | Opens peer apps with `?token=` | PortalsSection |

## B. OPMS Frontend / Backend

| Feature | Description |
|---------|-------------|
| Role workspaces | admin/sales/finance/dispatch/account/super_admin |
| Order master | List by workflow/priority; create; detail with lifecycle tabs |
| Order workflow | Submit, transition, history, assignees, fulfillment |
| Approvals | Unified OrderApproval actions |
| Finance queues | `/api/finance/queue`, `/summary` |
| Dispatch | Create/patch soft-delete with bill document upload |
| Deliveries / returns | Log shipment delivery; returns CRUD |
| Due sheets / unbilled / final statements | Billing support artifacts |
| Flags | Raise/manage order flags (blocking types in workflow rules) |
| Reminders | Reminders + follow-ups; Google Sheet webhook |
| Parties / zones | Via party-service proxy |
| Products / groups / brands / manufacturers / kits | Via product-service proxy |
| Fleet | Vehicles, drivers, transport agents |
| Transport planner | Plans, calendar, LR, packed/dispatched/delivered |
| Attachments / files | Upload + view/download redirects |
| Dashboards | Per-role KPI endpoints |
| Activity log | List activity |
| Terms & conditions | OPMS T&C API (note: router lacks requireAuth — see security) |
| Communication | Proxied to message-service |
| Push notifications | Proxied to notification-service |
| PDF/export helpers | Frontend html2canvas/jspdf |

## C. User Manager

| Feature | Description |
|---------|-------------|
| User directory CRUD | List/add/edit/detail |
| Portals registry | Seed defaults; assign per user |
| Departments & roles | Hub management |
| Company information | Branding and legal/tax fields |
| KPI cards | User counts |

## D. Lead Manager

| Feature | Description |
|---------|-------------|
| Lead pipeline | CRUD, assign, status, qualify, mark lost, convert |
| Follow-ups | Calendar + reminders (cron digests) |
| Reports | Admin “Sales Reports” / others “My Reports” |
| Quotations | CRUD, submit/approve/reject, PDF, email |
| Terms & conditions | Master for quotations |
| Bulk / Google Sheet ingest | Lead import paths |
| Attachments | Lead attachments module |

## E. Work Planner

| Feature | Description |
|---------|-------------|
| Work plans | Create/list/calendar; submit/approve/reject/complete |
| Visits / works | Nested lifecycle (check-in/out/complete) |
| Expenses | Submit/approve/reject with receipts |
| Assigned users / settings | Manager templates, CC emails, plan types |
| Day-end / exports | PDF/Excel helpers in UI |

## F. Platform services

| Feature | Description |
|---------|-------------|
| Auth | Login, me, change-password |
| Notifications | Internal create, SSE stream, mark read, web push |
| Messages | WhatsApp webhook, send message/email, auto-email trigger, communication helpers |
