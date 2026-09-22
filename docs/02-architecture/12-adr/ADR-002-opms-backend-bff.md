# ADR-002 — opms-backend as BFF/proxy

**Status:** Accepted (evidenced)  
**Date:** Not identified  
**Context:** OPMS UI needs one API origin for many resources.  
**Decision:** Proxy auth/product/party/message/notification under opms-backend `/api/*`.  
**Alternatives:** Frontend calls each service directly only — partially used by other MFEs.  
**Consequences:** Single CORS/API origin for OPMS; coupling/latency through proxy.  
**Evidence:** `opms-backend/src/app.js`
