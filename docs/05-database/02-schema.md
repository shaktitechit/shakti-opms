# Schema Overview

Schemas are defined in Mongoose (JavaScript), not separate migration SQL.

## Canonical order domain
`opms-backend/src/data/mongoRegistry.js` — large multi-model file registering Order and related masters.

## Identity
`auth-service/src/models/User.js`, `Role.js`, `Department.js`, `Portal.js`, `CompanyInfo.js`

## Warning
`opms-backend/docs/OPMS_SCHEMA.md` and `docs/essentials/*` are **partially stale**. Prefer mongoRegistry + workflow modules.

## Embedded vs referenced
- Order embeds `order_items[]`
- OrderApproval embeds `approval_items[]`
- Cross-entity links use ObjectId refs (Party, Product, User, …)

## Related
- [Collections](03-collections-or-tables.md)
- [Data Dictionary](08-data-dictionary.md)
