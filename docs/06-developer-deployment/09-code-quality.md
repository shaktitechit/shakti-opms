# Code Quality

| Mechanism | Where |
|-----------|-------|
| ESLint via `next lint` | Frontends package scripts |
| Swagger for API surface | opms-backend `/api-docs` |
| Soft-delete plugin consistency | Shared plugin copies |

No monorepo-wide prettier/eslint root config identified as mandatory CI gate (no CI).
