# CampusFlow — Member 2 Complete Handover

This is the cumulative project after Member 2. It retains Member 1's authentication and profile module and adds Student Academic Request Management.

## Features available
### Member 1 — Authentication & User Management
- Student registration; public registration cannot assign privileged roles.
- Login/logout using signed JWT in HttpOnly cookie.
- bcrypt password hashing, session restoration, protected routes, role authorization and CSRF protection.
- Profile viewing/updating and password change.

### Member 2 — Student Academic Request Management
- Student request creation and server-side validation.
- Attendance correction, medical leave, event participation and general academic request categories.
- Student request list, status filter, details, dashboard summary and returned-request resubmission.
- Server-side ownership checks on every student request query.

## Technology
React + Vite, React Router, Axios, Node.js, Express, MongoDB/Mongoose, JWT, bcryptjs.

## Setup
Prerequisites: Node.js 20+ recommended and MongoDB local or Atlas.

```bash
npm run install:all
```

Copy `server/.env.example` to `server/.env`, set `MONGODB_URI`, a strong `JWT_SECRET` (32+ characters), and `FRONTEND_URL=http://localhost:5173`. Do not commit `.env`.

Run in separate terminals:
```bash
npm run server
```
```bash
npm run client
```

Open `http://localhost:5173`; API health check: `http://localhost:5000/api/health`.

## API
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Health check | No |
| POST | `/api/auth/register` | Student registration | No |
| POST | `/api/auth/login` | Login | No |
| POST | `/api/auth/logout` | Logout | Yes + CSRF |
| GET | `/api/auth/me` | Restore session | Yes |
| GET/PUT | `/api/users/profile` | Own profile | Yes (PUT + CSRF) |
| GET | `/api/requests/summary` | Student request counts | Student + CSRF not required |
| GET | `/api/requests` | Own request list/filter | Student |
| POST | `/api/requests` | Submit request | Student + CSRF |
| GET | `/api/requests/:id` | Own request detail | Student |
| PATCH | `/api/requests/:id/resubmit` | Resubmit returned request | Student + CSRF |

### Student request payload
```json
{
  "category": "attendance_correction",
  "title": "Correct my attendance",
  "description": "Please review my attendance for the database systems lecture on Monday."
}
```
Supported categories: `attendance_correction`, `medical_leave`, `event_participation`, `general_academic`.

## Tests and build
```bash
npm test --prefix server
npm run build --prefix client
```

Tests require installed dependencies. The test suite includes Member 1 profile tests and Member 2 request-validation tests. API integration tests against a running MongoDB are a further verification step.

## Next handover
Member 3 implements faculty and multi-level approval workflow. Preserve current statuses: `submitted`, `under_review`, `returned`, `approved`, `rejected`. Member 2's resubmission endpoint relies on `returned`.

## Member 3 — Faculty Approval Workflow
Faculty/mentor, coordinator, HOD and Dean users can review assigned requests from the Approvals workspace. Decisions are recorded with remarks and timestamps. Approval advances sequentially through mentor → coordinator → HOD → Dean. Returned and rejected requests stop the current workflow.
