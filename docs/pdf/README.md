# OPMS Documentation — PDF copies

Generated from Markdown in `docs/` with Mermaid diagrams rendered.

## Files

| PDF | Contents |
|-----|----------|
| [OPMS-Documentation-Complete.pdf](./OPMS-Documentation-Complete.pdf) | Full suite (all categories) |
| [01-product.pdf](./01-product.pdf) | Product documentation |
| [02-architecture.pdf](./02-architecture.pdf) | Architecture + ADRs |
| [03-functional.pdf](./03-functional.pdf) | Functional modules |
| [04-api.pdf](./04-api.pdf) | API documentation |
| [05-database.pdf](./05-database.pdf) | Database documentation |
| [06-developer-deployment.pdf](./06-developer-deployment.pdf) | Developer & deployment |
| [07-user.pdf](./07-user.pdf) | User documentation |
| [08-security.pdf](./08-security.pdf) | Security (auth, RBAC, rate limits / 15-min IP block, secrets, Phases 0–3, threat model) |

HTML intermediates (same content, useful for debugging diagrams) are also in this folder.

## Regenerate

```bash
# Full suite
cd docs/_pdf-build && node generate-pdf.mjs

# Security PDF only
cd docs/_pdf-build && node generate-security-pdf.mjs
```

Requires Google Chrome and network access to load Mermaid from jsDelivr CDN (or cache).
