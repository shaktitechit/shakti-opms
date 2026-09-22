# Database Overview

## Technology
**MongoDB** via **Mongoose**. No SQL schemas/migrations framework identified.

## Connection
Environment variables: `MONGO_URI` and/or `MONGODB_URI` (and sometimes `DATABASE_URL` fallbacks in code).  
Optional `MONGODB_LOOKUP_FAMILY=4` for IPv4 preference (Atlas).

## Deployment model
MongoDB is **external** to Docker Compose (typically Atlas). Containers may reach host Mongo via `host.docker.internal`.

## Logical ownership

| Domain | Primary service writing schemas |
|--------|----------------------------------|
| Identity | auth-service models |
| Orders / logistics / fleet | opms-backend `mongoRegistry.js` |
| Products | product-service (mirrors registry) |
| Parties / rates | party-service (mirrors registry) |
| Leads / quotations | lead-manager-backend |
| Work plans | work-planner-backend |
| Notifications / push | notification-service |
| Messages | message-service |

**Inferred:** Services share one database/cluster; registries are duplicated. Treat **auth + opms-backend + lead + work-planner + notification + message** as documentation primaries.

## Soft-delete
Shared plugin: `deletedAt` default filter. See [Data Lifecycle](07-data-lifecycle.md).

## Source
- `opms-backend/src/data/mongoRegistry.js`
- `auth-service/src/models/*`
- service-specific registries
