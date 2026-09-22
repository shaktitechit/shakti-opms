# ADR-007 — External file management API

**Status:** Accepted  
**Date:** Not identified  
**Context:** Attachments for orders/leads/expenses.  
**Decision:** Store binaries via external File Management API; persist metadata in Mongo Attachment.  
**Alternatives:** In-compose MinIO (leftover data dir only).  
**Consequences:** Decoupled storage; runtime dependency on external API key/URL.  
**Evidence:** `FILE_MANAGEMENT_API_*`; files routes.
