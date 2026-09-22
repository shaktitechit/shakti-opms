# ADR-006 — Micro-frontends with SSO hub

**Status:** Accepted  
**Date:** Not identified  
**Context:** Distinct UX domains (ops, CRM, plans, admin).  
**Decision:** Separate Next apps; app-frontend launches with `?token=`.  
**Alternatives:** Single SPA with route modules — not chosen.  
**Consequences:** Independent releases; duplicated shell/auth utilities; cookie/localStorage key proliferation.  
**Evidence:** Five frontend packages + SSO bootstrap components.
