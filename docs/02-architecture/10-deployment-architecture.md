# Deployment Architecture

```mermaid
flowchart TB
  DNS[DNS A/AAAA] --> NGX[Host nginx :443]
  NGX --> FE[Frontend containers :7002/7004/7008/7010/7013]
  NGX --> API[API containers :7001/7003/7005-7007/7009/7011-7012]
  API --> REDIS[Redis container]
  API --> ATLAS[MongoDB Atlas]
  API --> FAPI[File API]
```

## Recommended path (from DOCKER.md)

1. Configure `.env.docker`
2. `docker compose --env-file .env.docker up --build -d`
3. Install nginx site + certbot SANs
4. Point DNS to host

## Prod compose file caveat

`docker-compose.prod.yml` is a **partial** stack — prefer full `docker-compose.yml` unless ops intentionally runs a subset (**Verified** by file contents).

## Rollback

**Not identified** as automated. Typical approach: redeploy previous image tags / git revision and `compose up` — **Requires confirmation** of image registry strategy (compose builds locally by default).
