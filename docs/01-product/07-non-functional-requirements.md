# Non-Functional Requirements

Only document NFRs evidenced in configuration/code. Do not invent numeric SLAs.

## Security

| NFR | Status | Evidence |
|-----|--------|----------|
| JWT authentication | Implemented | auth-service, shared JWT_SECRET |
| Portal RBAC | Implemented | middleware per portal |
| Password hashing | Implemented | bcryptjs |
| HTTPS at edge | Configured for prod hosts | nginx ssl snippets |
| Secrets via env | Documented | `.env.docker`, DOCKER.md |
| Break-glass master password | Optional env | `MASTER_PASSWORD` — leave empty in prod (DOCKER.md) |
| Rate limiting | **Not identified** as middleware | — |
| Redis AUTH | **Not configured** in compose | security risk |

## Performance

| NFR | Status |
|-----|--------|
| JSON body limit configurable | `JSON_BODY_LIMIT` (example 50mb) |
| Nginx proxy timeouts | API hosts use extended timeouts (e.g. 120s) and large body (50m) on api-opms |
| Explicit p95 latency targets | **Not identified** |

## Availability / Scalability

| NFR | Status |
|-----|--------|
| Container restart policy | `restart: unless-stopped` |
| Horizontal scaling playbooks | **Not identified** |
| Redis health dependency for queues | message/notification/opms-backend |

## Reliability

| NFR | Status |
|-----|--------|
| Health endpoints | `/health` on backends |
| BullMQ retry/attempts | Message model tracks attempts; exact policies **Requires confirmation** from queue configs |
| Soft-delete over hard-delete | Many domain models |

## Maintainability

| NFR | Status |
|-----|--------|
| Modular Express modules | `src/modules/*` |
| OpenAPI for opms-backend | `/api-docs` |
| Shared schema registries duplicated across services | Maintainability risk — documented in audit |

## Auditability

| NFR | Status |
|-----|--------|
| OrderWorkflow / OrderStatusHistory | Append-only workflow audit |
| ActivityLog | Present |
| Who approved (signatures on OrderApproval) | Implemented |

## Accessibility / i18n

**Not identified** as systematic requirements in frontend code.

## Related

- [Security](../06-developer-deployment/19-security.md)
- [Performance](../06-developer-deployment/20-performance.md)
