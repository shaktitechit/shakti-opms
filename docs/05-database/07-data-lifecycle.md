# Data Lifecycle

## Soft-delete
- Field: `deletedAt` (Date or null)
- Plugin filters all queries to active docs unless `.withDeleted()`
- Restore clears `deletedAt`

## Append-only
- `OrderWorkflow`, `OrderStatusHistory`, `ActivityLog` — no soft-delete in typical config

## Message lifecycle
`pending → queued → sending → sent|failed` with attempts metadata

## Notification lifecycle
Created unread → marked read (`is_read`, `read_at`)

## Due sheets
`active` → `superseded` / `archived`; `is_current` flag

## Backup
**Not identified** automated Mongo backup in repo. Ops must use Atlas/host tooling.
