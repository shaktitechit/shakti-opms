# Integration Architecture

```mermaid
flowchart TB
  subgraph Internal
    Services[API services]
    Redis[(Redis/BullMQ)]
    Mongo[(MongoDB)]
  end
  subgraph External
    SMTP[SMTP]
    Graph[Microsoft Graph]
    WA[WhatsApp Cloud]
    Push[Web Push VAPID]
    Sheets[Google Sheets]
    FAPI[File Management API]
  end
  Services --> Mongo
  Services --> Redis
  Services --> SMTP
  Services --> Graph
  Services --> WA
  Services --> Push
  Services --> Sheets
  Services --> FAPI
```

## Email

Preferred: Microsoft Graph sendMail when configured; SMTP fallback via nodemailer.

## WhatsApp

Cloud API templates + webhook endpoints on message-service.

## Files

All binary storage delegated to external File Management API (historically MinIO-backed). Local `minio-data/` is leftover, not compose-managed.

## Sheets

Inbound webhooks protected by `GOOGLE_SHEET_WEBHOOK_SECRET`.
