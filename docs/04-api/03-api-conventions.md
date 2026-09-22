# API Conventions

## Verified patterns

| Pattern | Description |
|---------|-------------|
| Resource nouns | `/api/orders`, `/api/parties`, … |
| Soft-delete | `DELETE /:id` sets `deletedAt`; `GET /deleted`; `POST /:id/restore` |
| Patch updates | Prefer `PATCH /:id` for partial updates |
| Nested actions | `POST /:id/submit`, `/approve`, `/transition` |
| Multipart | Attachments/dispatch bill/due sheet documents via multer field names |
| Proxies | Same path on BFF as owning service |

## IDs
MongoDB ObjectId strings in path params.

## Pagination / filters
Many list endpoints accept query filters — **exact query schema varies by controller**. Prefer Swagger UI / controller source for each list. Not fully standardized across services.

## Idempotency
**Not identified** as a global idempotency-key convention.

## Versioning
No `/v1` prefix — **Not identified**.
