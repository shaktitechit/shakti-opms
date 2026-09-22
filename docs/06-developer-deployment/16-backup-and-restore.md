# Backup and Restore

## What needs backup
| Data | Location | Repo automation |
|------|----------|-----------------|
| MongoDB | Atlas/external | **Not identified** |
| Redis | `redis_data` volume | **Not identified** (often ephemeral queues) |
| Files | External File API / MinIO | **Not identified** |
| Config | `.env.docker` (secrets store outside git) | operator-managed |
| nginx certs | host `/etc/letsencrypt` | operator-managed |

## Observed artifacts
`backups/minio-backup-*.tar.gz` leftover; `dump.rdb` gitignored — **not** a documented procedure.

## Commands
**Not identified** official backup/restore scripts. Use MongoDB Atlas backups / `mongodump` per ops standards — **Requires confirmation**.
