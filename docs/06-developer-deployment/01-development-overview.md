# Development Overview

OPMS is a polyglot-free **Node.js + Next.js monorepo** orchestrated with Docker Compose.

## Typical developer loop
1. Configure `.env.docker` from example (use placeholders for secrets)
2. Start stack with compose (optionally `docker-compose.dev.yml` for hot reload)
3. Open App Frontend `:7013` or OPMS `:7002`
4. Use Swagger at `:7001/api-docs` for OPMS API exploration

## Packages
13 `package.json` projects (8 backends + 5 frontends). No root workspace package manager identified.

## Related
- [Local Development](03-local-development.md)
- [DOCKER.md](../../DOCKER.md)
