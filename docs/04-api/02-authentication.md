# API Authentication

## Method
**Bearer JWT** in `Authorization: Authorization: Bearer <token>` header.

## Obtain token

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "********" }
```

Hit auth-service (`:7003`) or via opms-backend proxy (`:7001/api/auth/login`).

## Session introspection

```http
GET /api/auth/me
Authorization: Bearer <token>
```

## Authorization

| Gate | Applies to |
|------|------------|
| `requireAuth` | Most domain routes |
| `requireOpmsAccess` | OPMS domain on opms-backend |
| `requireLeadManagerAccess` | Lead Manager mutating/list routes |
| `requireWorkPlannerAccess` | Work Planner routes |
| Webhook secrets | Google Sheet / WhatsApp verify |

## Portal requirement (OPMS)

User must include `portals[]` entry `{ portal_code: "opms", access_roles: [...] }`.

## Related
- [Architecture Auth](../02-architecture/07-authentication-authorization.md)
