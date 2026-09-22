# ADR-004 — JWT with portal access_roles

**Status:** Accepted  
**Date:** Not identified  
**Context:** Multi-app access control beyond department alone.  
**Decision:** Authorize via `user.portals[].portal_code` + `access_roles`.  
**Alternatives:** Permission-code RBAC only (Permission model exists in opms registry but live gates are portal-centric).  
**Consequences:** Flexible multi-portal users; seed gap for non-opms portals.  
**Evidence:** Portal middlewares across services.
