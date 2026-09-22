# Local Development

## Steps (verified from DOCKER.md)

1. Clone repository
2. `cp .env.docker.example .env.docker`
3. Edit `.env.docker`: set `JWT_SECRET`, `MONGO_URI`/`MONGODB_URI` (**do not commit secrets**)
4. `ln -sfn .env.docker .env`
5. Start:
   - Prod-style: `docker compose --env-file .env.docker up --build`
   - Dev hot reload: `docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.dev.yml up --build`
6. Verify: `http://localhost:7001/health` and App Frontend `http://localhost:7013`
7. Optional seed: `docker compose --env-file .env.docker exec opms-backend npm run seed:users`

## Per-service local run (without compose)
Possible via each package `npm run dev` / `start` **if** env vars and Mongo/Redis are provided — exact standalone runbooks **partially documented**; prefer Compose.

## URLs
See DOCKER.md table (7001–7014).
