# Product Glossary

| Term | Meaning in this codebase |
|------|--------------------------|
| OPMS | Core order operations portal and its backend BFF |
| Portal | Application workspace assigned on a user (`portal_code`) |
| access_roles | Role strings within a portal (e.g. `finance` under `opms`) |
| Party | Customer/supplier (or both) master record |
| Order | Central commercial/fulfillment document with workflow status |
| OrderApproval | Unified approval document for admin/finance/account signatures |
| Due sheet | Documented due/commercial sheet attached to an order |
| Unbilled order | Tracking record for unbilled quantities/status |
| Dispatch | Warehouse dispatch against an order |
| Transport plan | Planned multi-order shipment plan for an agent/date |
| Lead | CRM prospect in Lead Manager |
| Quotation | Lead quotation with approval/status enums |
| Work plan | Daily field plan for a sales user |
| Soft-delete | Record marked with `deletedAt` rather than removed |
| SSO hub | app-frontend launching other apps with JWT query token |
| BFF | Backend-for-frontend pattern — opms-backend proxies sibling APIs |
| BullMQ | Redis-backed job queue library |
| CompanyInfo | Company branding and legal/tax profile |

## Related

- [Features](05-features.md)
- [Database Overview](../05-database/01-database-overview.md)
