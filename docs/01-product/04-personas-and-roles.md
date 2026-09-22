# Personas and Roles

## Identity model (verified)

Users are stored in **auth-service** with:

- `department` (string; seeded values include `super_admin`, `admin`, `sales`, `finance`, `account`, `dispatch`)
- `roles[]` → Role documents (`sales_executive`, `finance_manager`, etc.)
- `portals[{ portal, portal_code, access_roles[] }]`

Sources: `auth-service/src/models/User.js`, Role/Department/Portal models, seed services.

## Portals

| portal_code | Seeded in DEFAULT_PORTALS? | access_roles (observed) |
|-------------|----------------------------|-------------------------|
| `opms` | Yes | `super_admin`, `admin`, `sales`, `finance`, `account`, `dispatch` |
| `work_planner` | **No** (used in code) | `admin`, `manager`, `executive` (+ super_admin/sales observed in constants) |
| `lead_manager` | **No** (used in code) | `admin`, `manager`, `executive` |
| `user_manager` | **No** (frontend gate) | **Unknown** exact role list — frontend checks admin/super_admin style access |

**Requires confirmation:** Official portal catalog and which portals must be seeded for production onboarding.

## OPMS access roles → UI workspaces

| access_role | Frontend portal path | Typical focus (inferred from nav) |
|-------------|----------------------|-----------------------------------|
| `super_admin` | `/super_admin` | Full masters + User Manager embed |
| `admin` | `/admin` | Broad order/masters/transport |
| `sales` | `/sales` | Orders overview/create (own data emphasis) |
| `finance` | `/finance` | Finance review, masters, transport |
| `account` | `/account` | Account review, masters, transport |
| `dispatch` | `/dispatch` | Dispatch, transport planner/agents |

Source: `opms-frontend` portal nav and middleware.

## Lead Manager roles

| Role | Capabilities (from UI/API gates) |
|------|----------------------------------|
| `admin` | Full leads; quotations; terms; team reports |
| `manager` | Similar to admin for quotations/terms; team oversight |
| `executive` | Leads/follow-ups/personal reports; no quotations nav |

## Work Planner roles

| Role | Capabilities |
|------|--------------|
| `admin` | Team manager settings; approve plans/expenses |
| `manager` | My team settings; approvals |
| `executive` | Own plans, visits, expenses |

## App Frontend access

Requires JWT with **department** and at least one **role**; sidebar built from `role_codes`; portal tiles from `portals[]`.

## Persona mapping

See PRD personas P1–P6 in [02-prd.md](02-prd.md).
