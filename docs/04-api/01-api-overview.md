# API Overview

## Style
REST over HTTP/JSON. Multipart for file uploads. SSE for notification streams.

## Public entrypoints (defaults)

| Service | Base URL (local) | Notes |
|---------|------------------|-------|
| opms-backend | http://localhost:7001 | BFF + order domain; Swagger `/api-docs` |
| auth-service | http://localhost:7003 | Identity |
| product-service | http://localhost:7005 | Catalog |
| party-service | http://localhost:7006 | Parties/zones/rates |
| work-planner-backend | http://localhost:7007 | `/api/work-planner` |
| lead-manager-backend | http://localhost:7009 | Leads/quotations |
| message-service | http://localhost:7011 | Messaging |
| notification-service | http://localhost:7012 | Notifications/push |

Production hostnames: see nginx `*.spspl.com` / `*.medicaent.in`.

## OpenAPI

- **Live:** opms-backend `GET /api-docs` generated from `opms-backend/src/docs/swagger.js` + `swaggerExtended.js` (OpenAPI 3.1)
- **Docs copy:** [openapi.yaml](openapi.yaml) — inventory of verified routes across services (may be less detailed than Swagger UI for opms-backend schemas)

## Health
All backends: `GET /health`

## Related
- [Authentication](02-authentication.md)
- [Endpoints](05-endpoints.md)
