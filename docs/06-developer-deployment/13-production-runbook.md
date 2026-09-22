# Production Runbook

## Startup
`docker compose --env-file .env.docker up -d`

## Health verification
```bash
curl -fsS http://127.0.0.1:7001/health
curl -fsS http://127.0.0.1:7003/health
# repeat for other API ports
```

## Logs
`docker compose --env-file .env.docker logs -f <service>`

## Restart one service
`docker compose --env-file .env.docker restart opms-backend`

## Seed / admin bootstrap
Seed scripts + User Manager to assign portals. Exact first-admin procedure **Requires confirmation**.

## Incidents
See [Troubleshooting](18-troubleshooting.md).
