# Phase 3 — Data protection & ops controls

## MongoDB (Atlas / external)

| Control | Guidance |
|---------|----------|
| Network | Restrict to host / VPC IP allowlist; prefer private endpoint |
| Auth | Strong DB user passwords; no shared admin from apps |
| Encryption at rest | Atlas default encryption ON; customer KMS optional |
| Backups | Atlas continuous backup / snapshots; test restore quarterly |
| App-level field encryption | **Not required** for v1 unless Product mandates PII-at-rest beyond Atlas; passwords already bcrypt |

## Redis

| Control | Status |
|---------|--------|
| AUTH (`REDIS_PASSWORD`) | Required in Compose |
| Host publish | `127.0.0.1` only |
| Persistence | Volume `redis_data`; treat as ephemeral queues + cache |

## Application PII

Sensitive company bank / tax fields are returned only to **authenticated** callers of `GET /api/company-info`. Public GET is branding-only.

## MFA (decision)

| Option | Recommendation |
|--------|----------------|
| TOTP for `super_admin` / User Manager admins | **Backlog** — implement after IdP decision |
| SSO IdP (Google/Microsoft Entra) | Preferred long-term for admin portals |
| Current | Password + JWT 8h; no MFA in codebase |

Product should choose IdP vs in-app TOTP before build.

## Container hardening

Production images run as **`USER node`** (non-root). Read-only root filesystem is not enabled yet (Next.js / Node need writable tmp).
