# Module: Attachments & Files

## Purpose
Upload files to external file API; store metadata; view/download via redirects.

## Actors
Authenticated OPMS / lead / work-planner users (note weaker auth on some routers — see security)

## Workflow
1. Multipart upload to attachments endpoint
2. File Management API stores binary
3. Attachment document saved with entity_type/entity_id
4. View/download via `/api/files/:fileId/view|download`

## Soft-delete
Supported with restore on OPMS attachments (permission middleware).

## Related APIs
`/api/attachments`, `/api/files/:fileId/view|download`  
work-planner public-ish attachment view path

## Related DB
Attachment

## Dependencies
`FILE_MANAGEMENT_API_URL`, `FILE_MANAGEMENT_API_KEY`

## Source
`opms-backend/src/modules/attachments|files/`, lead/work-planner attachment modules
