# Project Structure

```text
/
├── app-frontend/              # SSO hub Next.js
├── opms-frontend/             # OPMS UI
├── user-manager-frontend/
├── lead-manager-frontend/
├── work-planner-frontend/
├── auth-service/
├── opms-backend/              # BFF + order domain
├── product-service/
├── party-service/
├── lead-manager-backend/
├── work-planner-backend/
├── message-service/
├── notification-service/
├── nginx/                     # Host TLS reverse proxy configs
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml    # Partial stack
├── DOCKER.md
├── .env.docker.example
├── docs/                      # This documentation suite
├── backups/                   # gitignored leftovers
└── minio-data/                # leftover, not compose service
```

## Typical backend layout
`src/server.js`, `src/app.js`, `src/modules/`, `src/models` or `src/data/mongoRegistry.js`, `src/middlewares/`, `src/config/`
