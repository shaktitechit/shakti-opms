# Troubleshooting

## Compose won't start / env overrides
**Symptoms:** Mongo auth failures despite env_file  
**Cause:** Empty `${MONGO_URI}` in `environment:` overrides file  
**Solution:** Follow DOCKER.md — don't redeclare secrets in environment  
**Verify:** `docker compose exec auth-service printenv MONGO_URI` (ensure set; don't log in shared chats)

## JWT errors across services
**Symptoms:** 401 after login when calling another service  
**Cause:** Mismatched `JWT_SECRET`  
**Solution:** Single shared secret in `.env.docker`  
**Verify:** Relogin; call `/api/auth/me`

## 403 on OPMS routes
**Symptoms:** Authenticated but forbidden  
**Cause:** Missing `portals[]` entry `portal_code: opms`  
**Solution:** Assign portal in User Manager; re-login  
**Verify:** `/api/auth/me` shows portals

## Frontend calls wrong API / CORS
**Symptoms:** Network errors to localhost from prod build  
**Cause:** `NEXT_PUBLIC_*` baked at build  
**Solution:** Fix env and **rebuild** frontend images  
**Verify:** View page source / network hostnames

## Redis / queue jobs stuck
**Symptoms:** Notifications/emails not sending  
**Cause:** Redis down or workers not started  
**Solution:** Check redis health; restart message/notification/opms-backend  
**Verify:** `docker compose ps`; service logs

## Mongo Atlas IPv6 issues
**Symptoms:** Connection timeouts from containers  
**Cause:** DNS family  
**Solution:** `MONGODB_LOOKUP_FAMILY=4`  
**Verify:** Backend connects and `/health` OK

## File upload failures
**Symptoms:** Attachment create errors  
**Cause:** Missing `FILE_MANAGEMENT_API_*`  
**Solution:** Configure URL/key or disable upload features  
**Verify:** Upload small file in UI

## nginx 502
**Symptoms:** Public hostname 502  
**Cause:** Container not listening / wrong upstream port  
**Solution:** Align nginx upstream with compose ports; `nginx -t` + reload  
**Verify:** curl upstream on 127.0.0.1:port
