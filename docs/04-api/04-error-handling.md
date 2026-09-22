# API Error Handling

## Typical HTTP statuses (observed pattern)

| Status | Meaning |
|--------|---------|
| 200/201 | Success |
| 400 | Validation / bad request |
| 401 | Missing/invalid JWT |
| 403 | Authenticated but portal/role forbidden |
| 404 | Not found |
| 409 | Conflict (e.g. unique constraints) — where implemented |
| 500 | Server error |

Exact error JSON shape varies by service/middleware — **not a single shared error schema across all services**. Inspect controllers for `{ message }` / `{ error }` patterns.

## Workflow transition errors
Invalid next status or blocked by flags returns error from workflow layer (message indicates rule failure).

## Source
Express middlewares and module controllers under each service `src/`.
