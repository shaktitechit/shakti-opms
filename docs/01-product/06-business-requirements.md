# Business Requirements

Mapped from implemented behavior. Formal BR IDs from business analysts: **Requires confirmation**.

| BR ID | Statement | Implementation evidence |
|-------|-----------|-------------------------|
| BR-001 | System shall authenticate users and issue time-bounded tokens | JWT + `JWT_EXPIRES_IN` |
| BR-002 | Access shall be portal-scoped | `portals[].portal_code` + middleware |
| BR-003 | Orders shall follow controlled status transitions | `workflow.transitions.js` |
| BR-004 | Certain flags shall block dispatch/transit/delivery transitions | `workflow.rules.js` flag blocks |
| BR-005 | Pricing shall lock after finance/account/dispatch stages | pricing lock statuses in rules |
| BR-006 | Soft-deleted records shall be recoverable by authorized users | softDelete plugin + restore routes |
| BR-007 | Company branding shall be configurable | CompanyInfo module |
| BR-008 | Field teams shall plan daily work and claim expenses | Work Planner models/APIs |
| BR-009 | Sales shall manage leads through quotation to conversion | Lead Manager |
| BR-010 | System shall notify users of relevant events | notification-service + queues |
| BR-011 | System may send email/WhatsApp for order/comms | message-service integrations |
| BR-012 | External sheets may ingest masters/orders via webhook + secret | Google Sheet webhook routes |

## Priority

**Not identified** in repository (no MoSCoW tags in code).

## Related

- [Business Rules](08-business-rules.md)
- [PRD](02-prd.md)
