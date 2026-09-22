# Data Flow

## 1. Login and portal launch

```mermaid
sequenceDiagram
  participant U as User
  participant App as app-frontend
  participant Auth as auth-service
  participant Mongo as MongoDB
  U->>App: credentials
  App->>Auth: POST /api/auth/login
  Auth->>Mongo: verify user
  Auth-->>App: JWT
  App-->>U: portals UI
  U->>App: launch OPMS
  App-->>U: redirect opms-frontend?token=
```

## 2. Create and submit order

```mermaid
flowchart LR
  UI[opms-frontend] --> API[opms-backend POST /api/orders]
  API --> DB[(orders)]
  UI --> SUB[POST /api/orders/:id/submit]
  SUB --> WF[workflow rules]
  WF --> DB
  SUB --> Q[BullMQ optional]
  SUB --> N[notifications]
```

## 3. Approval path (simplified)

Sales/Admin create/update OrderApproval → send-to-finance → finance approve/amend → send-to-account → account approve → order status advances per transitions → dispatch created → transport/delivery.

## 4. Messaging

Domain event/API → message-service enqueue → worker sends via Graph/SMTP/WhatsApp → Message document status updated.

## 5. File upload

Client → attachments route (multer) → File Management API → Attachment metadata in Mongo → view/download via `/api/files/:fileId/*` redirect.
