# Infrastructure Architecture

## Compose topology

Sources: `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `DOCKER.md`

- Single default bridge network
- Named volume: `redis_data`
- `extra_hosts: host.docker.internal:host-gateway` for host Mongo
- Images: `node:20-alpine`

## External dependencies

- MongoDB (Atlas or host)
- File Management API
- Optional SaaS: Graph, WhatsApp, SMTP

## Nginx

Host-installed reverse proxy; configs in `nginx/sites-available/opms` and `medica`.

## Dual tenant

| Tenant | FE/API ports | DNS |
|--------|--------------|-----|
| OPMS/spspl | 7001–7014 | `*.spspl.com` |
| Medica | 5001–5013 (nginx upstreams) | `*.medicaent.in` |

## What is not in infra-as-code here

- CI/CD
- Kubernetes/Helm
- Managed monitoring
- Mongo/Redis backup automation
