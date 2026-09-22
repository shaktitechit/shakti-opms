# OPMS Security Documentation

**Status:** Verified from repository implementation unless marked otherwise.  
**Scope:** Authentication, authorization, secrets, transport security, known risks, consolidated challenges (§11), and a phased improvement plan (§12) derived from code/config — not a penetration-test report.

**Sources:**
- `auth-service/`, `opms-backend/src/middlewares/`
- Portal middlewares (lead-manager, work-planner)
- `nginx/` TLS configs
- `docker-compose.yml`, `.env.docker.example`, `DOCKER.md`
- `docs/02-architecture/07-authentication-authorization.md`
- `docs/06-developer-deployment/19-security.md`

---

## 1. Security model overview

```mermaid
flowchart TB
  U[Browser user] --> NGX[Host nginx TLS]
  NGX --> FE[Frontends]
  NGX --> API[API services]
  FE -->|Bearer JWT| API
  API -->|verify JWT_SECRET| JWT[Shared JWT secret]
  API -->|portal_code + access_roles| RBAC[Portal RBAC]
  API --> MONGO[(MongoDB external)]
  API --> REDIS[(Redis + AUTH)]
  API --> FAPI[File Management API + API key]
```

### Trust boundaries

| Boundary | What crosses it | Control |
|----------|-----------------|---------|
| Internet → host | HTTPS | nginx TLS + HSTS snippets |
| Browser → API | REST + JWT | Bearer token; CORS origins |
| Service → service | Internal HTTP on compose network | Shared JWT; internal notification routes require service JWT |
| Service → Mongo | Connection string | `MONGO_URI` secret |
| Service → Redis | Queue/jobs | Redis AUTH (`REDIS_PASSWORD`); host bind `127.0.0.1` only |
| Service → File API | Uploads | `FILE_MANAGEMENT_API_KEY` |

---

## 2. Authentication

### Mechanism

- **JWT** signed with shared `JWT_SECRET` across services
- Passwords hashed with **bcrypt** (`bcryptjs`)
- Token TTL via `JWT_EXPIRES_IN` (default **`8h`**)
- Optional **`MASTER_PASSWORD`**: break-glass login as any user if set — **must be empty in production**
- Password policy: min **10** chars, letter + number, no spaces (create user / change password)
- Portal SSO: one-time **`?handoff=`** codes (legacy `?token=` still accepted)

### Login flow

```mermaid
sequenceDiagram
  participant C as Client
  participant Auth as auth-service
  participant API as Domain API
  C->>Auth: POST /api/auth/login
  Auth-->>C: JWT (+ user claims)
  C->>API: Authorization: Bearer JWT
  API->>API: verify signature / expiry
  API->>API: load/attach req.user
  API->>API: portal / role gate
  API-->>C: 200 resource or 401/403
```

### Obtain token

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "********" }
```

Available on auth-service (`:7003`) or via opms-backend proxy (`:7001/api/auth/login`).

### Session introspection

```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Frontend session handling

| App | Primary storage | Notes |
|-----|-----------------|-------|
| app-frontend | `shakti.app.session` + cookies | SSO hub; launches peers with `?token=` |
| opms-frontend | `medica.auth` + cookies | Consumes SSO token |
| user / lead / work planner | per-app `shakti.*.session` | Shared cookie names used for middleware gates |

**Risk note:** Portal SSO now prefers one-time `?handoff=` codes (`POST /api/auth/handoff` → peer `POST /api/auth/handoff/exchange`). Legacy `?token=` is still accepted during rollout. SSE/file `?token=` for browser navigations remains a separate pattern (Phase 3+ may use cookies only).

Default access-token TTL is **`JWT_EXPIRES_IN=8h`** (was `7d`). Refresh tokens are not implemented yet — users re-login after expiry.

Password policy (create user / change password): **min 10 characters**, at least one letter and one number, no spaces.

## 3. Authorization (RBAC)

### Layers

1. **Authenticated** — valid JWT  
2. **Portal membership** — `user.portals[]` contains required `portal_code`  
3. **access_roles** — role string must match portal gate (admin bypass where coded)  
4. **Handler-level checks** — department/workflow rules for specific actions  
5. **Soft-delete routes** — authenticated (+ OPMS portal) on many trash/restore endpoints  

### Portal codes and roles (observed)

| portal_code | Seeded by default? | access_roles (observed) |
|-------------|--------------------|-------------------------|
| `opms` | Yes (`DEFAULT_PORTALS`) | `super_admin`, `admin`, `sales`, `finance`, `account`, `dispatch` |
| `work_planner` | **No** | `admin`, `manager`, `executive` (+ admin bypasses) |
| `lead_manager` | **No** | `admin`, `manager`, `executive` |
| `user_manager` | **No** | Frontend admin/super-admin style gate — exact role list **Unknown** |

### Middleware gates

| Gate | Applies to |
|------|------------|
| `requireAuth` | Most domain routes |
| `requireOpmsAccess` | OPMS domain APIs |
| `requireLeadManagerAccess` | Lead Manager (most routes) |
| `requireWorkPlannerAccess` | Work Planner routes |
| Webhook secret | Google Sheet ingest |

Missing `opms` portal ⇒ **403** even if `department` is set (documented in Swagger + middleware behavior).

```mermaid
flowchart TD
  A[Request] --> B{JWT valid?}
  B -->|No| U[401 Unauthorized]
  B -->|Yes| C{Portal required?}
  C -->|No| H[Handler]
  C -->|Yes| D{portal_code present?}
  D -->|No| F[403 Forbidden]
  D -->|Yes| E{access_role allowed?}
  E -->|No| F
  E -->|Yes| H
  H --> R[Response]
```

---

## 4. Transport & edge security

### nginx (production pattern)

- TLS 1.2/1.3 via `nginx/snippets/ssl-params.conf`
- HSTS and security headers in ssl snippets
- Let's Encrypt cert paths for `*.spspl.com` / `*.medicaent.in`
- HTTP → HTTPS redirect after cert bootstrap
- SSE-specific proxy settings for notification streams

### CORS

Configured via `CORS_ORIGINS` (comma-separated). In **production**, missing/empty `CORS_ORIGINS` fails closed. Dev allows localhost portal ports plus any listed origins. Incorrect CORS is a browser-enforced issue, not a substitute for authz.

### Docker network

Services communicate on the Compose bridge using internal URLs (`http://auth-service:7003`, etc.). Assume **network trust inside the compose network** for some internal endpoints (see §6).

---

## 5. Secrets & configuration hygiene

| Variable | Secret? | Guidance |
|----------|---------|----------|
| `JWT_SECRET` | **Yes** | Long random; identical across all services |
| `MASTER_PASSWORD` | **Yes** | Leave **empty** in production |
| `MONGO_URI` / `MONGODB_URI` | **Yes** | Atlas/user credentials |
| `FILE_MANAGEMENT_API_KEY` | **Yes** | Uploads |
| `SMTP_*` / Graph / WhatsApp / VAPID private | **Yes** | Integrations |
| `GOOGLE_SHEET_WEBHOOK_SECRET` | **Yes** | Webhook auth |
| `REDIS_PASSWORD` | **Yes** | Redis AUTH (compose `--requirepass`) |
| `SEED_PASSWORD` | **Yes** | Demo only |
| `NEXT_PUBLIC_*` | No (public) | Baked into FE builds — never put secrets here |

### Critical finding (remediated in example file)

`.env.docker.example` previously contained real-looking credentials. **It now uses placeholders only.**  

**Ops still required:**
1. Rotate any secrets that may have been exposed while the old example was in git history  
2. Ensure `.env.docker` remains gitignored and never committed  
3. Set `REDIS_PASSWORD` and `REDIS_URL=redis://:<password>@redis:6379` in `.env.docker` before `compose up`  
4. Keep `MASTER_PASSWORD` empty in production  

Do not re-declare `MONGO_URI` / `JWT_SECRET` under Compose `environment:` with empty interpolation — empty values override `env_file` (see `DOCKER.md`).

---

## 6. Public and weakly protected surfaces

Documented carefully for threat modeling. Status reflects post Phase 0–1 hardening where noted.

| Surface | Auth | Risk / status |
|---------|------|---------------|
| `POST /api/auth/login` | Public + **rate limit** (40 / 15 min per IP; 20 / 15 min per IP+email) + nginx `limit_req` + optional fail2ban 15-min ban | Brute force mitigated at app + edge |
| `GET /api/company-info` | Public (auth-service) | Info disclosure of branding/company fields |
| Google Sheet webhooks | Shared secret | Secret leakage ⇒ data injection |
| WhatsApp webhooks | Provider verify | Must validate hub challenge/signature per Meta rules |
| `POST /api/notifications/internal/*` | **Service JWT** (`requireInternalService`) | Hardened — callers send Bearer service token |
| opms `/api/terms-and-conditions` | **`requireAuth` + `requireOpmsAccess`** | Hardened |
| lead-manager `/api/attachments` | **`requireAuth` + `requireLeadManagerAccess`** | Hardened |
| work-planner attachment view | **`requireAuth` + portal gate**; FE appends `?token=` | Hardened (no longer anonymous) |

```mermaid
flowchart LR
  Internet --> Nginx
  Nginx --> PublishedPorts[Host published API ports]
  PublishedPorts --> Weak[Remaining public surfaces]
  Weak --> Impact[Login / company-info / webhooks]
```

**Hardening:** see **§12** for remaining Phase 2–3 work. Phase 0–1 code/compose changes are in-repo; ops must still rotate secrets and set `REDIS_PASSWORD` in live `.env.docker`.

---

## 7. Data protection controls present

| Control | Status |
|---------|--------|
| Password hashing (bcrypt) | Implemented |
| Soft-delete (recoverable) | Many domain models |
| Append-only workflow history | OrderWorkflow / status history |
| HTTPS at edge | nginx configs |
| File binaries outside app DB | External File Management API |
| Field-level encryption at rest in app | **Not identified** |
| Audit log completeness for all portals | Partial (ActivityLog + workflow) |

---

## 8. Infrastructure security notes

| Item | Finding |
|------|---------|
| Redis | **AUTH via `REDIS_PASSWORD`**; host port bound to `127.0.0.1` only |
| message / notification | **Not published** to host (Compose `expose` / network only) |
| MongoDB | External; protect via Atlas IP allowlists / strong credentials |
| Frontends | No compose healthchecks; not a direct auth issue |
| CI/CD secrets scanning | **Not identified** (no GitHub Actions) |
| Container user hardening | Default Node images — deep review **Not identified** |

---

## 9. Security-related NFRs (from implementation)

| Topic | Status |
|-------|--------|
| Authentication | JWT |
| Authorization | Portal RBAC |
| Confidentiality in transit | TLS at nginx |
| Rate limiting | Login: IP + IP/email `express-rate-limit` (15 min); nginx `limit_req`; optional fail2ban |
| Centralized security monitoring / WAF | **Not identified** |
| Formal threat model / pen-test artifacts | **Not identified** |

---

## 10. Incident checklist (ops-oriented)

1. Rotate `JWT_SECRET` → forces re-login everywhere (coordinate downtime)  
2. Rotate Mongo, File API, Graph, WhatsApp, VAPID, webhook secrets  
3. Clear `MASTER_PASSWORD` in production env  
4. Review nginx access logs for scraping of public/weak routes  
5. Restart services after secret rotation: `docker compose --env-file .env.docker up -d`  
6. Rebuild frontends if any `NEXT_PUBLIC_*` changed  

---

## 11. Security challenges (consolidated)

Challenges below are derived from §§2–9. Severity is relative to a typical internet-facing Compose + nginx deployment.

| ID | Challenge | Severity | Evidence |
|----|-----------|----------|----------|
| C1 | Example/env hygiene — real-looking secrets in `.env.docker.example` | **Critical** | §5 |
| C2 | Unauthenticated internal notification create routes | **High** | §6 |
| C3 | Unauthenticated terms-and-conditions and lead-manager attachments routers | **High** | §6 |
| C4 | Redis without AUTH + host port published (`7014`) | **High** | §8 |
| C5 | No login rate limiting / account lockout | **High** | §6, §9 |
| C6 | `MASTER_PASSWORD` break-glass if set in production | **High** | §2, §5 |
| C7 | JWT SSO handoff via `?token=` query string (Referer/log/history leak) | **Medium** | §2 |
| C8 | Assume network trust for some service→service routes; published API ports widen blast radius | **Medium** | §4, §6 |
| C9 | Public `company-info` / webhook surfaces (info disclosure / injection if secret leaks) | **Medium** | §6 |
| C10 | Work-planner attachment view before auth — intent unclear | **Medium** | §6, §11 |
| C11 | No field-level encryption at rest; audit coverage only partial | **Medium** | §7 |
| C12 | No CI secrets scanning, WAF, or formal threat model / pen-test | **Low–Medium** | §8, §9 |
| C13 | Long JWT TTL (`7d` example); no MFA / password policy in codebase | **Low–Medium** | §2, §11 |
| C14 | Portal RBAC gaps (user_manager roles Unknown; Permission-code model vs portal roles) | **Low** | §3, §11 |

```mermaid
flowchart TB
  subgraph critical [Critical / High]
    C1[C1 Secrets in example]
    C2[C2 Internal notifications]
    C3[C3 Unauthed routers]
    C4[C4 Redis exposure]
    C5[C5 No rate limit]
    C6[C6 MASTER_PASSWORD]
  end
  subgraph medium [Medium]
    C7[C7 SSO query JWT]
    C8[C8 Port / network trust]
    C9[C9 Public / webhooks]
    C10[C10 Attachment view]
    C11[C11 Encryption / audit]
  end
  subgraph later [Later]
    C12[C12 Monitoring / scanning]
    C13[C13 Session / MFA]
    C14[C14 RBAC clarity]
  end
  critical --> P0[Phase 0–1]
  medium --> P2[Phase 2]
  later --> P3[Phase 3+]
```

---

## 12. Security improvement plan

**Goal:** Close Critical/High findings first, shrink the trusted network, then raise authn/authz and ops maturity.  
**Owners (suggested):** Ops = deploy/env; Backend = API middleware/routes; Frontend = SSO/session; Product = intent decisions in §13.

### Phase 0 — Immediate (ops, days)

| Action | Addresses | Owner | Status | Acceptance criteria |
|--------|-----------|-------|--------|---------------------|
| Rotate all credentials that may have appeared in `.env.docker.example` | C1 | Ops | **Ops pending** | New secrets live; old ones revoked; services restarted |
| Sanitize `.env.docker.example` to placeholders only; confirm `.env.docker` is gitignored | C1 | Ops + Backend | **Done** (example sanitized) | Example file has no real values; `git check-ignore -v .env.docker` passes |
| Ensure production `MASTER_PASSWORD` is empty / unset | C6 | Ops | **Ops pending** | Login with master password fails in prod |
| Redis `requirepass` + bind `127.0.0.1`; wire `REDIS_URL` | C4 | Ops + Backend | **Done** in compose (set `REDIS_PASSWORD` in `.env.docker`) | Port not reachable from untrusted networks; AUTH required |
| Unpublish notification/message host ports | C2, C8 | Backend | **Done** in compose | Internal routes not reachable from internet via host ports |

### Phase 1 — Authz gaps on weak surfaces (backend, 1–2 sprints)

| Action | Addresses | Owner | Status | Acceptance criteria |
|--------|-----------|-------|--------|---------------------|
| Protect `POST /api/notifications/internal/*` with service JWT | C2 | Backend | **Done** | Unauthenticated create returns 401/403; callers send Bearer service token |
| Add `requireAuth` + portal gate to opms `/api/terms-and-conditions` | C3 | Backend | **Done** | Anonymous read/write fails |
| Add `requireAuth` / portal gate to lead-manager `/api/attachments` | C3 | Backend | **Done** | Anonymous attachment ops fail |
| Work-planner attachment view behind auth; FE appends `?token=` for new-tab opens | C10 | Backend + Frontend | **Done** | Anonymous view fails; authenticated users can open files |
| Login rate limiting (IP + email) on auth-service | C5 | Backend | **Done** | Sustained brute force yields 429 |
| Login IP block (40 / 15 min) + fail2ban jail for hard 15-min ban | C5 | Backend + Ops | **Done** (deploy fail2ban) | IP blocked for 15 min after abuse |
| Validate WhatsApp webhook signature per Meta; rotate Google Sheet webhook secret | C9 | Backend + Ops | **Partial / ops** | Invalid signature/secret rejected |

### Phase 2 — Session & transport hardening (1–2 sprints)

| Action | Addresses | Owner | Status | Acceptance criteria |
|--------|-----------|-------|--------|---------------------|
| Replace SSO `?token=` with one-time handoff code (`POST /api/auth/handoff` + `/exchange`); peers exchange then strip | C7 | Frontend + Backend | **Done** (legacy `?token=` still accepted) | Token not required in durable URL; handoff single-use ~60s |
| Shorten access-token TTL to `8h` (cookie maxAge aligned); refresh tokens deferred | C13 | Backend + Frontend | **Done** (TTL); refresh **deferred** | Access token hours not days |
| Enforce password min 10 + letter + number on create/change | C13 | Backend | **Done** | Weak passwords rejected |
| CORS allowlist from `CORS_ORIGINS`; fail closed in production if unset | C8 | Backend | **Done** | Unknown origins blocked; prod requires config |
| Public `GET /api/company-info` returns branding fields only; full doc when authenticated | C9 | Backend | **Done** | No bank/tax fields on anonymous GET |

### Phase 3 — Data protection, RBAC clarity, observability

| Action | Addresses | Owner | Status | Acceptance criteria |
|--------|-----------|-------|--------|---------------------|
| Harden ActivityLog with request IP/UA (LM / WP / OPMS via AsyncLocalStorage) | C11 | Backend | **Done** | Mutations capture actor + timestamp + IP/UA when available |
| Portal `access_roles` is authz source of truth; Permission codes deferred; user_manager admin gated on `/api/users*` | C14 | Backend + Docs | **Done** | See [04-authorization-model.md](./04-authorization-model.md) |
| Document Atlas IP allowlists, backup encryption, app-level field encryption stance | C11 | Docs | **Done** | See [03-data-protection-and-ops.md](./03-data-protection-and-ops.md) |
| Gitleaks CI + npm audit job; `.gitleaks.toml` | C12 | Backend + Ops | **Done** | `.github/workflows/security-scans.yml` |
| nginx login/handoff `limit_req` + access logs | C5, C12 | Ops | **Done** (deploy snippets) | `nginx/snippets/logging.conf` + `auth-rate-limit.conf` |
| Lightweight threat model notes; pen-test scope listed | C12 | Docs | **Done** | [02-threat-model.md](./02-threat-model.md) |
| MFA evaluation for admin / super_admin | C13 | Product | **Deferred** (IdP vs TOTP) | Decision recorded in data-protection doc |
| Non-root `USER node` on production Dockerfiles | C12 | Ops | **Done** | All prod images run as `node` |

### Priority order (execution sequence)

1. **Phase 0** — ~~sanitize example / Redis / ports~~; **ops still: rotate secrets + set `REDIS_PASSWORD` + clear `MASTER_PASSWORD`**  
2. **Phase 1** — ~~auth weak routers / rate-limit / attachment view~~; WhatsApp signature hardening remaining  
3. **Phase 2** — ~~SSO handoff / 8h JWT / password policy / CORS / slim company-info~~; refresh tokens deferred  
4. **Phase 3** — ~~audit IP/UA / RBAC docs / scanning / nginx limits / non-root / threat notes~~; MFA + pen-test scheduling remaining  

### Tracking

| Field | Suggestion |
|-------|------------|
| Backlog | MFA IdP decision; pen-test scheduling; WhatsApp signature validation |
| Definition of done | Acceptance criteria in tables above + docs updated when behavior changes |
| Verify | Re-check route files and compose publish list after each phase; refresh this document’s Status line |

```mermaid
gantt
  title OPMS security improvement (indicative)
  dateFormat  YYYY-MM-DD
  section Phase0
  Rotate sanitize secrets     :p0a, 2026-09-22, 3d
  Redis and port lockdown     :p0b, after p0a, 2d
  section Phase1
  Auth weak routes            :p1a, after p0b, 10d
  Login rate limit            :p1b, after p0b, 7d
  Attachment view decision    :p1c, after p0b, 5d
  section Phase2
  SSO handoff redesign        :p2a, after p1a, 14d
  Session and password policy :p2b, after p1a, 10d
  section Phase3
  Audit RBAC scanning MFA     :p3a, after p2a, 30d
```

---

## 13. Requires confirmation (product / security team)

1. Is work-planner public attachment view intentional? *(resolved: secured behind auth; FE uses `?token=` for new-tab)*  
2. Should non-`opms` portals be seeded by default?  
3. Is Permission-code RBAC (opms Permission model) still a goal vs portal roles only? *(C14 — **decided: portal roles; Permission codes deferred**)*  
4. Target password policy / session length / MFA — password + 8h done; **MFA deferred to IdP decision** *(C13)*  
5. Who owns secret rotation and env hygiene for `.env.docker.example`? *(C1 / Phase 0 — example sanitized; rotation still Ops)*  
6. Are notification and attachment services intended to be reachable only via nginx, or also via published host ports? *(resolved: compose no longer publishes message/notification)*

---

## Related documents

- [Threat model notes](./02-threat-model.md)
- [Data protection & ops](./03-data-protection-and-ops.md)
- [Authorization model](./04-authorization-model.md)
- [Authentication & Authorization (Architecture)](../02-architecture/07-authentication-authorization.md)
- [API Authentication](../04-api/02-authentication.md)
- [Functional: Authentication](../03-functional/authentication.md)
- [Environment Variables](../06-developer-deployment/05-environment-variables.md)
- [Security (developer-deployment summary)](../06-developer-deployment/19-security.md)
- [Troubleshooting](../06-developer-deployment/18-troubleshooting.md)
- [Documentation Audit](../DOCUMENTATION-AUDIT.md)
