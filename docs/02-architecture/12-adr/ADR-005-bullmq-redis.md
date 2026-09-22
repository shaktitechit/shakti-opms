# ADR-005 — BullMQ on Redis

**Status:** Accepted  
**Date:** Not identified  
**Context:** Async notifications/messages/order jobs.  
**Decision:** Use Redis + BullMQ; do not run RabbitMQ.  
**Alternatives:** RabbitMQ/Kafka — absent.  
**Consequences:** Simple compose dependency; Redis becomes critical path.  
**Evidence:** redis service; bullmq dependencies; queue folders.
