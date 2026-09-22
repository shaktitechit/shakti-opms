# Environment Variables

**IMPORTANT:** Never copy real secrets into documentation.  
`.env.docker.example` uses **placeholders only**. Rotate any credentials that may have been committed historically.

| Variable | Required | Purpose | Example (placeholder) | Secret |
|----------|----------|---------|----------------------|--------|
| NODE_ENV | yes | Runtime mode | `production` | no |
| JWT_SECRET | **yes** | JWT signing | `change-me-long-random` | **yes** |
| JWT_EXPIRES_IN | no | Token TTL | `8h` | no |
| MASTER_PASSWORD | no | Break-glass login | empty in prod | **yes** |
| JSON_BODY_LIMIT | no | Body size | `50mb` | no |
| MONGO_URI / MONGODB_URI | **yes** | Mongo connection | `mongodb+srv://USER:PASS@host/db` | **yes** |
| MONGODB_LOOKUP_FAMILY | no | Prefer IPv4 | `4` | no |
| REDIS_PASSWORD | **yes** (compose) | Redis AUTH | `replace-with-redis-password` | **yes** |
| REDIS_URL | **yes** (compose) | Redis (with password) | `redis://:PASSWORD@redis:6379` | **yes*** |
| REDIS_PORT | no | Localhost publish | `7014` | no |
| *_PORT | no | Host ports | see compose defaults | no |
| AUTH_SERVICE_URL etc. | no | Internal URLs | `http://auth-service:7003` | no |
| API_PUBLIC_BASE_URL | prod | Public API | `https://api-opms.example.com` | no |
| NEXT_PUBLIC_* | prod | Browser URLs (build-time) | https://… | no |
| CORS_ORIGINS | prod | Extra CORS | comma URLs | no |
| COMPANY_NAME / LOGO | no | Branding fallback | — | no |
| SEED_* | no | Seed controls | — | SEED_PASSWORD yes |
| FOLLOWUP_REMINDER_* | no | Lead cron | — | no |
| FILE_MANAGEMENT_API_URL/KEY | optional | Uploads | — | key **yes** |
| SMTP_* | optional | Email | — | pass **yes** |
| MICROSOFT_GRAPH_* | optional | Email | — | secret **yes** |
| WHATSAPP_* | optional | WhatsApp | — | **yes** |
| VAPID_* | optional | Web push | — | private **yes** |
| GOOGLE_SHEET_WEBHOOK_SECRET | optional | Webhooks | — | **yes** |
| ADMIN_EMAIL / ACCOUNT_EMAIL / FINANCE_EMAIL / DUE_SHEET_EMAIL / DISPATCH_EMAIL | optional | Role mailboxes | — | no |
| COMPOSE_PROJECT_NAME / ENV_FILE | no | Multi-stack | — | no |
| APP_LOGIN_URL / LEAD_MANAGER_PUBLIC_URL / FRONTEND_URL | optional | Links in emails | — | no |

\* Redis requires AUTH in compose (`--requirepass`). Host port is bound to `127.0.0.1` only. message-service and notification-service are not published on the host.

Source: `.env.docker.example`, service `env.js` files, compose.
