# CampusFlow — Member 1 Complete Starter

This version contains the completed **Member 1: Authentication & User Management** contribution. It is the baseline for Member 2 to clone and extend.

## Implemented by Member 1
- Student registration (public registration cannot choose a privileged role).
- Login and logout using signed JWT in an HttpOnly cookie.
- Password hashing with bcryptjs (12 salt rounds).
- Session restoration (`GET /api/auth/me`).
- Protected routes and role authorization middleware.
- CSRF protection for cookie-authenticated state-changing requests.
- Rate-limited registration/login endpoints.
- Profile viewing and updating, including password change with current-password verification.
- Responsive React login, registration, dashboard and profile screens.

Create `server/.env` from `server/.env.example`, then set a strong random `JWT_SECRET` (at least 32 characters) and your MongoDB URI. Never commit `.env`.

Run backend and frontend in separate terminals:

Open http://localhost:5173. Backend health check: http://localhost:5000/api/health.

## API endpoints
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | API health | No |
| GET | `/api/auth/csrf` | Issue CSRF token | No |
| POST | `/api/auth/register` | Create student account | No |
| POST | `/api/auth/login` | Sign in | No |
| POST | `/api/auth/logout` | Sign out | Yes + CSRF |
| GET | `/api/auth/me` | Restore current session | Yes |
| GET | `/api/users/profile` | Read own profile | Yes |
| PUT | `/api/users/profile` | Update own name/password | Yes + CSRF |

### Registration payload
```json
{
  "name": "Aarav Sharma",
  "email": "aarav@example.com",
  "password": "StrongPass123",
  "branch": "CSE",
  "year": 3,
  "section": "A",
  "rollNumber": "23CSE001"
}
```
The server always assigns the `student` role during public registration. Do not add a `role` field to the registration form.

## Member 2 handover
Member 2 should clone/pull this repository and implement the student academic request module. Preserve the existing auth endpoints and `req.user` contract. Student request routes should use `protect` and check `req.user.role === 'student'` (or the role authorization middleware). Do not duplicate authentication logic.

