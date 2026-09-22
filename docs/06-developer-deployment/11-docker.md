# Docker

## Compose services (base)
redis + 8 APIs + 5 frontends. See [Infrastructure Architecture](../02-architecture/09-infrastructure-architecture.md).

```mermaid
flowchart LR
  subgraph compose
    redis
    auth
    product
    party
    message
    notification
    workbe[work-planner-backend]
    opmsbe[opms-backend]
    leadbe[lead-manager-backend]
    fes[5 frontends]
  end
  message --> redis
  notification --> redis
  opmsbe --> redis
  opmsbe --> auth
  opmsbe --> product
  opmsbe --> party
```

## Images
Build contexts per service folder; `node:20-alpine`.

## Volumes
`redis_data` only.

## Healthchecks
Backends + redis; frontends none in base compose.

## Dev overlay
`Dockerfile.dev`, bind-mount `src`, watch modes, FE healthchecks disabled.

## Related
Root [DOCKER.md](../../DOCKER.md)
