# Member 1 — Completed Contribution Record

## Module
Authentication and User Management

## Implemented functionality
1. Student registration with server-side validation and duplicate-email handling.
2. Password hashing using bcryptjs; plaintext passwords are never returned by API responses.
3. Login with credential verification and inactive-account rejection.
4. JWT session stored in an HttpOnly cookie.
5. Session validation and restoration through protected `/api/auth/me`.
6. Logout and cookie clearing.
7. CSRF token issuance and validation for state-changing requests.
8. Authentication rate limiting, security headers and CORS configuration.
9. Profile read/update with protected academic fields and verified password changes.
10. React authentication context, protected routes, login/register forms, dashboard shell and profile page.

## Demonstration checklist
- Register a new student account.
- Attempt registration with the same email and confirm a conflict response.
- Log out and log in with valid credentials.
- Try an incorrect password and confirm login is rejected.
- Refresh the dashboard and confirm the session is restored.
- Open `/profile`, update the display name, and verify it persists.
- Change password using the correct current password; confirm the new password works.
- Attempt to open `/dashboard` after logout and confirm redirection to login.
- Inspect the registration request and confirm a submitted `role: admin` is ignored; the created user remains `student`.

## Handover boundary
Member 1 owns identity, login/session, role identity, and self-service profile. Student request lifecycle is reserved for Member 2; faculty approval workflow for Member 3; administrative user management and notifications for Member 4.

## Design note for later team stages
- Public registration explicitly assigns `student` on the server, so clients cannot self-register as staff or admin. The schema permits later role updates through a future protected administrative workflow (Member 4); role is not schema-immutable.
- Password changes increment `tokenVersion` and issue a replacement session token. The existing CSRF token is retained so the frontend's cached double-submit token remains synchronized.
