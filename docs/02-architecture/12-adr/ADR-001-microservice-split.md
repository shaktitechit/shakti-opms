# ADR-001 — Microservice split by domain

**Status:** Accepted (evidenced by repo structure)  
**Date:** Not identified in repository  
**Context:** Large order/CRM/field/ops domain with multiple UIs.  
**Decision:** Separate Node services: auth, opms, product, party, lead-manager, work-planner, message, notification.  
**Alternatives:** Modular monolith; serverless functions — **Not evidenced**.  
**Consequences:** Independent deploy/scale; duplicated mongoose registries; operational complexity.  
**Evidence:** Top-level service directories + compose services.
