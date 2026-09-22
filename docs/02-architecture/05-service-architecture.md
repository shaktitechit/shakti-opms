# Service Architecture

## Service communication matrix

| From | To | Mechanism |
|------|----|-----------|
| Frontends | Owning backends | HTTPS/HTTP REST + Bearer JWT |
| opms-backend | auth/product/party/message/notification | HTTP proxy / axios |
| work-planner-backend | party, lead-manager, message, notification | HTTP proxy |
| lead-manager-backend | message, notification | HTTP proxy |
| auth-service | notification-service | proxy `/api/notifications` |
| Queue producers | Redis | BullMQ |
| All APIs | MongoDB | Mongoose |
| Upload flows | File Management API | HTTP + API key |

## Startup dependencies (compose)

```mermaid
flowchart TD
  R[redis healthy] --> M[message-service]
  R --> N[notification-service]
  R --> O[opms-backend]
  A[auth-service healthy] --> O
  P[product-service] --> O
  Y[party-service] --> O
  M --> O
  N --> O
  A --> W[work-planner-backend]
  A --> L[lead-manager-backend]
  O --> L
  N --> L
  M --> L
```

## Health

Each backend exposes `GET /health`. Frontends: **no** compose healthchecks in base file.
