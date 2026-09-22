# Running the Application

## Full stack
```bash
docker compose --env-file .env.docker up --build
# or detached
docker compose --env-file .env.docker up -d --build
```

## Dev hot reload
```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Partial prod file (incomplete)
```bash
docker compose --env-file .env.docker -f docker-compose.prod.yml up --build -d
```
Warning: missing many services vs full product.

## Useful
```bash
docker compose --env-file .env.docker logs -f opms-backend
docker compose --env-file .env.docker down
docker compose --env-file .env.docker down -v   # wipes Redis volume
docker compose --env-file .env.docker exec opms-backend npm run seed:users
```

## Package scripts (examples)
- Backends: `npm start`, `npm run dev`
- Frontends: `npm run dev`, `npm run build`, `npm start`, `npm run lint`
- opms-backend also has migrate/seed scripts in `package.json`
