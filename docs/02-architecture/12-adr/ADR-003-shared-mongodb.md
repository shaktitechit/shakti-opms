# ADR-003 — Shared MongoDB

**Status:** Accepted (inferred from shared URI + mirrored registries)  
**Date:** Not identified  
**Context:** Cross-service references (User, Party, Order, Lead).  
**Decision:** Services connect to same Mongo deployment; schemas registered per service.  
**Alternatives:** DB-per-service with sync APIs — not implemented.  
**Consequences:** Simple joins by ObjectId; schema drift risk across copied registries.  
**Evidence:** Shared `MONGO_URI` in compose env; parallel `mongoRegistry.js` files.
