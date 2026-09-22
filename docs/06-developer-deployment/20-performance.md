# Performance

## Config levers found
- `JSON_BODY_LIMIT`
- nginx proxy timeouts / body size for API hosts
- Redis/BullMQ async offload for messages/notifications/some order jobs
- Mongo indexes on hot fields

## Targets
No published latency/throughput SLOs in repo.

## Frontend
Next.js production builds; `NEXT_PUBLIC_*` must be correct to avoid extra failures (not perf per se).
