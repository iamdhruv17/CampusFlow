# Member 2 — Completed Contribution: Student Academic Request Management

This version is cumulative: it retains Member 1's authentication and user-management files and adds the student request module.

## Implemented
- Student-only academic request creation with server-side validation.
- Categories: attendance correction, medical leave, event participation and general academic request.
- Student dashboard summary counts and recent requests.
- Paginated request listing with status filtering.
- Request detail page.
- Ownership enforcement: requester identity comes only from `req.user._id`; list/detail/resubmit queries are scoped to the signed-in student.
- Resubmission only when status is `returned`.
- Existing Member 1 `protect` middleware and CSRF protection are reused.
- Automated tests for request input validation.

## Explicitly not implemented (reserved for later members)
- Faculty approval/rejection/return actions and approval routing: Member 3.
- Admin user management and notification delivery: Member 4.
- Document upload: deferred until the team configures and tests a secure file-storage provider.

## API
- `GET /api/requests/summary`
- `GET /api/requests?page=1&limit=10&status=submitted`
- `POST /api/requests`
- `GET /api/requests/:id`
- `PATCH /api/requests/:id/resubmit`

All endpoints require authentication and student role. Request creation payload:
```json
{
  "category": "attendance_correction",
  "title": "Correct my attendance",
  "description": "Please review my attendance for the database systems lecture on Monday."
}
```

No requester/user ID is accepted from the browser. The backend attaches the authenticated user's ID.
