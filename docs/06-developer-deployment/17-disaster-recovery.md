# Disaster Recovery

## Status
No formal DR runbook in repository.

## Inferred recovery outline (not official)
1. Restore Mongo from Atlas PITR/snapshot
2. Redeploy compose stack from known-good git tag
3. Restore env secrets from secure vault
4. Re-point DNS/nginx if host replaced
5. Verify login + create-order smoke test

**Requires confirmation** from ops for RTO/RPO targets.
