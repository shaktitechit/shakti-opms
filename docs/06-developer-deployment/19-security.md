# Security

## Implemented
- JWT auth + bcrypt passwords + password strength policy (min 10, letter+number)
- Portal RBAC (`access_roles`); User Manager admin gate on `/api/users*`
- HTTPS via nginx TLS configs; auth login/handoff edge rate limits + optional fail2ban 15-min IP ban
- Webhook secrets for Google Sheets
- Soft-delete vs hard-delete for many records
- Login rate limiting (auth-service: **40 failed / 15 min per IP** + **20 / 15 min per IP+email** → 429)
- nginx `limit_req` on login/handoff + optional **fail2ban 15-minute IP ban**
- SSO one-time handoff codes
- Service JWT on notification `/api/notifications/internal/*`
- Auth on terms / attachments / work-planner attachment view
- Redis AUTH + localhost-only host publish; message/notification not host-published
- ActivityLog IP/UA via request audit context (OPMS / LM / WP)
- Production containers run as non-root `USER node`
- Gitleaks CI workflow (`.github/workflows/security-scans.yml`)
- `.env.docker.example` placeholders only

## Remaining / deferred
| Risk | Notes |
|------|-------|
| Historical secrets in git | Rotate if old example was ever pushed |
| `MASTER_PASSWORD` | Must stay empty in prod (ops) |
| Legacy SSO `?token=` | Still accepted; prefer `?handoff=` |
| MFA | Deferred — IdP vs TOTP decision |
| Formal pen-test | Scope in [threat model](../08-security/02-threat-model.md) |
| WAF / centralized alerting | Ops — watch auth-login access logs |

## Improvement plan
[Security Overview §11–§12](../08-security/01-security-overview.md) · [Threat model](../08-security/02-threat-model.md) · [Data protection](../08-security/03-data-protection-and-ops.md) · [Authorization](../08-security/04-authorization-model.md)

## Related
- [Security overview](../08-security/01-security-overview.md)
- [Auth architecture](../02-architecture/07-authentication-authorization.md)
