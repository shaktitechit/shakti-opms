# Integrations

| Integration | Purpose | Config / evidence | Status |
|-------------|---------|-------------------|--------|
| MongoDB Atlas / external Mongo | Primary datastore | `MONGO_URI` / `MONGODB_URI` | Required |
| Redis | BullMQ queues + cache backbone | `REDIS_URL`, compose `redis` | Required for queue services |
| File Management API | Uploads / MinIO-backed files | `FILE_MANAGEMENT_API_URL`, `FILE_MANAGEMENT_API_KEY` | Optional |
| SMTP | Email fallback | `SMTP_*` | Optional |
| Microsoft Graph | Preferred outbound email | `MICROSOFT_GRAPH_*` | Optional |
| WhatsApp Cloud API | Templates + webhooks | `WHATSAPP_*` | Optional |
| Web Push (VAPID) | Browser push | `VAPID_*` | Optional |
| Google Sheets webhooks | Ingest orders/parties/products/reminders | `GOOGLE_SHEET_WEBHOOK_SECRET` | Optional |
| Host nginx + Let's Encrypt | TLS termination | `nginx/` | Prod edge |
| Inter-service HTTP | BFF proxies | `*_SERVICE_URL` | Required in compose |

## Not identified

- Payment gateways (Razorpay/Stripe/etc.)
- SMS providers beyond WhatsApp
- External ERP connectors (SAP/etc.)
- RabbitMQ / Kafka

## Related

- [Integration Architecture](../02-architecture/08-integration-architecture.md)
