# Module: Notifications & Messages

## Purpose
In-app notifications (incl. SSE), web push, email, WhatsApp, and communication helpers.

## Actors
Authenticated users; internal services calling notification internal endpoints.

## Notification workflow
1. Domain service calls internal create / order-transition
2. Persist Notification; enqueue push optionally
3. Client lists or SSE streams; mark read

## Message workflow
1. API send / communication trigger
2. Enqueue BullMQ job
3. Worker delivers via Graph/SMTP/WhatsApp
4. Update Message status

## Permissions
User routes require auth; **internal** notification POSTs are unauthenticated in code — rely on network trust.

## Related APIs
notification-service `/api/notifications`, `/api/push/*`, `/api/subscribe`  
message-service `/api/messages`, `/api/emails`, `/api/auto-emails`, `/api/communication`

## Related DB
Notification, PushSubscription, Message

## Related UI
NotificationBell across frontends; communication tabs in OPMS order UI

## Source
`notification-service/`, `message-service/`
