# Configuration

## Patterns
- dotenv / compose `env_file`
- Service `src/config/env.js` reading `process.env`
- Frontend `NEXT_PUBLIC_*` baked at **image build**

## Do not
Re-declare `MONGO_URI` / `JWT_SECRET` under compose `environment:` with empty interpolation — overrides env_file (DOCKER.md).

## Nginx
Copy snippets + site files to `/etc/nginx/`; use HTTP bootstrap before certbot; then HTTPS site.
