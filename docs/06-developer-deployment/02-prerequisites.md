# Prerequisites

| Tool | Purpose | Evidence |
|------|---------|----------|
| Docker Desktop / Engine + Compose v2 | Run full stack | DOCKER.md |
| Node.js 20 | Image base `node:20-alpine`; local non-docker optional | Dockerfiles |
| Git | Source control | `.git` |
| MongoDB Atlas or local Mongo | Database | `MONGO_URI` |
| Optional: host nginx + certbot | TLS prod | `nginx/` |

## Not required for basic Docker run
Kubernetes, RabbitMQ, local MinIO (file API external).
