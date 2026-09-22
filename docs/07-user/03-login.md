# Login

## App Frontend
1. Go to `/`
2. Enter email and password
3. Submit
4. On success you reach `/dashboard/...`

## Portal-specific login pages
OPMS, Lead Manager, Work Planner, and User Manager also expose `/` or `/login` if opened directly. Prefer the App hub when possible for SSO.

## SSO
When launched from App, a token is passed in the URL once and stored in the browser session storage/cookies used by that app.

## Logout
Use the user menu / logout control in the top bar (exact label may vary by app).

## Problems
See [Troubleshooting](08-troubleshooting.md).
