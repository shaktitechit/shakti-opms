# Documentation Audit

## Repository Analyzed

Monorepo at `/Users/macbook/Desktop/opms 2` including:

- Frontends: `app-frontend`, `opms-frontend`, `user-manager-frontend`, `lead-manager-frontend`, `work-planner-frontend`
- Backends: `opms-backend`, `auth-service`, `product-service`, `party-service`, `lead-manager-backend`, `work-planner-backend`, `message-service`, `notification-service`
- Infra: `docker-compose*.yml`, `DOCKER.md`, `nginx/`, `.env.docker.example`
- Existing notes: `implementation_plan.md`, `task.md`, `opms-backend/docs/**`
- Swagger: `opms-backend/src/docs/swagger.js`, `swaggerExtended.js`

## Documentation Generated

Full suite under `docs/` categories 01–07 plus this audit and `docs/README.md`.

## Coverage

| Area | Status | Notes |
|------|--------|-------|
| Product | Complete | Based on implemented portals/features; formal product vision Requires confirmation |
| Architecture | Complete | Diagrams + ADRs evidenced by code |
| Functional | Complete | Major modules documented; some edge transition matrices partial |
| API | Complete/Partial | Full inventory in markdown; OpenAPI YAML is inventory subset; richest schemas remain in live `/api-docs` |
| Database | Complete/Partial | Catalog + dictionary of key fields; full 100% field dump intentionally summarized with source pointers |
| Developer/Deployment | Complete | From DOCKER.md/compose/nginx; DR/backup/CI gaps called out |
| User | Complete | Based on actual routes/nav; no screenshots in repo |

## Unknowns

1. Official marketed product name / legal branding for all tenants
2. Production whether full compose vs `docker-compose.prod.yml` subset is used
3. Exact dual-tenant (spspl + medica) co-hosting procedure
4. Formal RTO/RPO and backup schedules
5. Fine-grained permission codes vs portal roles (Permission model vs live gates)
6. `user_manager` portal access_roles exact list
7. Full Lead/WorkPlan transition enforcement beyond enums
8. TransportShipment `Transporter` missing model
9. Automated test strategy and coverage metrics
10. Git branching/PR policy
11. Whether public attachment/terms routes are intentional

## Requires Business Confirmation

- Formal PRD vision, MoSCoW priorities, SLAs
- Production portal seeding for `work_planner`, `lead_manager`, `user_manager`
- Support escalation contacts for end users
- Payment/collection lifecycle expectations (essentials docs vs live transitions)
- Whether `closed` order status is still a business requirement

## Implementation vs Documentation Gaps

| Topic | Code / config says | Other docs say |
|-------|--------------------|----------------|
| Order lifecycle | `workflow.transitions.js` account-inclusive graph | `opms-backend/docs/essentials/*` older payment/invoice/collection flow — **STALE** |
| Order status set | Schema includes `closed`; transitions lack `closed` | Mixed constants (`order.constants` vs `domain.js`) |
| Portal seed | `DEFAULT_PORTALS` only `opms` | Apps expect work_planner/lead_manager/user_manager |
| Swagger server port | swagger.js mentions default 5000 | Compose publishes 7001 |
| `docker-compose.prod.yml` | Partial services | Name implies full production |
| `.env.docker.example` | Contains real-looking secrets | Should be placeholders only |
| OPMS_SCHEMA.md | Mentions fields not in Product schema | mongoRegistry is authority |
| implementation_plan | Mentions legacy approval route aliases | Current routes center on `/api/order-approvals` — verify leftover aliases if any |

## Potential Risks

- Missing CI/CD
- Missing automated backup/DR docs in repo
- Missing centralized monitoring
- Secrets committed in example env file
- Unauthenticated/internal-weak routes (notifications internal, terms, some attachments)
- Redis exposed without auth
- Schema duplication across services (drift)
- OpenAPI docs suite does not fully duplicate every query/body schema (rely on Swagger UI + controllers)
- Stale essentials docs could mislead operators if not marked

## Second-pass consistency checks performed

- Port table aligned to DOCKER.md / compose defaults (7001–7014)
- Portal role names aligned across product/architecture/user docs
- Workflow transitions sourced from `workflow.transitions.js` not essentials
- Secrets omitted from docs; hygiene warning recorded
