# Module: Users & Identity

## Purpose
Administer users, departments, roles, portals, and company branding.

## Actors
User Manager admins / super admins; auth-service authenticated callers.

## Preconditions
Authenticated session with User Manager access gate.

## Workflow — assign portal
1. Open User Manager → Portals or User detail
2. Select user
3. Assign `portal_code` + `access_roles`
4. User relaunches App Frontend / portal to pick up JWT claims (**Inferred:** may need re-login)

## Business Rules
- Email unique
- DEFAULT_PORTALS seed currently includes **only** `opms`
- Other portals used by apps must be created/assigned manually or via Portals UI seed extensions — **Requires confirmation** of production seed procedure

## Permissions
User Manager frontend `hasSuperAdminAccess`; API routes behind `requireAuth` (finer permission codes **Unknown** vs portal checks)

## Related APIs
`/api/users`, `/api/roles`, `/api/portals`, `/api/departments`, `/api/company-info`

## Related DB
User, Role, Department, Portal, CompanyInfo

## Related UI
user-manager-frontend `/dashboard/*`

## Source
`auth-service/src/modules/users|portals|departments|companyInfo/`
`user-manager-frontend/`
