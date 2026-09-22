# Phase 3 — Threat model notes (lightweight)

**Status:** Working draft from security hardening Phases 0–2. Not a formal pen-test.  
**Last updated:** 2026-09-22

## Assets

| Asset | Sensitivity |
|-------|-------------|
| JWT / `JWT_SECRET` | Critical |
| MongoDB (orders, parties, users, leads, plans) | High |
| File Management API key + binaries | High |
| Redis queues | Medium |
| Company bank fields (authenticated company-info) | High |
| Webhook secrets (Google Sheet, WhatsApp) | High |

## Trust boundaries

1. Internet → nginx TLS  
2. Browser → APIs (JWT + portal RBAC)  
3. Compose network (service JWT for notifications/emails)  
4. External Mongo / File API  

## Top threats (STRIDE-lite)

| Threat | Mitigation (current) | Residual |
|--------|----------------------|----------|
| Credential stuffing on login | App rate limit + nginx `limit_req` on `/api/auth/login` | Add WAF / lockout alerts |
| Stolen JWT in URL | SSO `?handoff=` one-time codes; legacy `?token=` deprecated | Remove legacy token accept; shorten TTL further / refresh |
| Unauthenticated internal APIs | Service JWT + unpublished ports | mTLS later |
| Secret leakage in git | Sanitized `.env.docker.example` + gitleaks CI | Rotate historical secrets |
| Privilege escalation on user APIs | `requireUserManagerAdmin` on `/api/users*` | Align portal seeding |
| Redis exposure | AUTH + localhost bind | Strong unique password in prod |
| XSS → session theft | Existing FE hygiene (out of scope here) | CSP headers at nginx |

## Recommended pen-test scope (when scheduled)

1. Auth: login, handoff exchange, master password absent  
2. Portal RBAC bypass across OPMS / LM / WP / user-manager  
3. IDOR on attachments / work-plan files  
4. Webhook forgery  
5. CORS / origin misconfiguration  

## Owners

| Area | Owner |
|------|-------|
| Secret rotation | Ops |
| nginx / TLS / WAF | Ops |
| Authz middleware | Backend |
| Pen-test scheduling | Product + Security |
