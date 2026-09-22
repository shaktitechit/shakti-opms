# ADR-008 — Unified OrderApproval

**Status:** Accepted  
**Date:** Referenced in `implementation_plan.md`  
**Context:** Separate admin/finance approval models were hard to maintain.  
**Decision:** Single `OrderApproval` (+ `OrderAmmendmentUser`) with signature flags.  
**Alternatives:** Keep separate collections — rejected per plan.  
**Consequences:** Cleaner schema; API surface consolidated under `/api/order-approvals`.  
**Evidence:** `implementation_plan.md`; `orderApproval` module; mongoRegistry.
