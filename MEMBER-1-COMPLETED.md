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


