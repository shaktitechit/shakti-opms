# Deployment

## Path A — Single host Docker + nginx (documented)

1. Provision host with Docker + nginx + certbot
2. Configure `.env.docker` with production URLs and secrets
3. `docker compose --env-file .env.docker up -d --build`
4. Install nginx site (`nginx/sites-available/opms`) and obtain certs (commands in nginx file headers)
5. DNS for all hostnames
6. Verify `/health` on APIs and FE loads

## Path B — Medica tenant
Use `.env.docker.medica` + medica nginx; ports 5001–5013. Dual-stack on one host **Requires confirmation**.

## Image registry / K8s
**Not identified**.

## Rollback
Rebuild/redeploy previous git SHA; no automated rollback tool in repo.
