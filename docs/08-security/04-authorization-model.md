# Authorization model (Phase 3 decision)

## Source of truth: portal `access_roles`

OPMS and satellite portals authorize with:

1. Valid JWT (`requireAuth`)
2. `user.portals[]` contains required `portal_code`
3. `access_roles` on that portal membership (plus coded admin bypasses)

| portal_code | Typical access_roles |
|-------------|----------------------|
| `opms` | `super_admin`, `admin`, `sales`, `finance`, `account`, `dispatch` |
| `work_planner` | `admin`, `manager`, `executive` |
| `lead_manager` | `admin`, `manager`, `executive` |
| `user_manager` | `admin`, `super_admin` (FE + **auth-service `/api/users*` gate**) |

## Permission-code RBAC (opms Permission / Role collections)

**Deferred / legacy.** `requirePermissions` in opms-backend currently aliases `requireAuth` and does **not** enforce permission codes. Do not build new features on Permission codes until Product re-opens that initiative.

## User Manager

- Frontend: `hasSuperAdminAccess()`  
- Backend: `requireUserManagerAdmin` on all `/api/users` and `/api/users/roles*` routes  

Any authenticated user without admin/user_manager admin roles receives **403**.
