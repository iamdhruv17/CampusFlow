# Member 4 — Integration, Administration & Final Verification

This package is based on the supplied complete CampusFlow reference project. Its target feature set is the original CampusFlow application described in `README.md`.

## Member 4 objective

Integrate the work from Members 1–3 into the final CampusFlow application while preserving the original project's end-to-end functionality. Use this package as the reference implementation/target, not as a reason to discard earlier contributions without review.

## Required final capabilities

- Authentication, registration, login, logout, profile and role-based access.
- Student dashboard and academic request submission.
- Attendance correction, event participation, medical leave and other grievances.
- Supporting document uploads.
- Request tracking, approval history, returned-request correction and resubmission.
- Faculty dashboards and approve/reject/return actions.
- Medical leave workflow: Student → Class Coordinator → Mentor → HOD → Dean.
- Role-based administration, user management and faculty assignments.
- In-app notifications.
- Consistent frontend/backend API integration.

## Safe integration procedure

1. Clone the team's existing repository after Member 3 has pushed.
2. Create a backup branch or ZIP before changing files.
3. Compare this reference project's folders and features with the cumulative repository.
4. Port missing functionality and reconcile API contracts, models, routes, middleware and UI components.
5. Do not blindly replace the entire repository if that would erase Members 1–3's implementations.
6. Keep `.git`, `.env` files and local secrets out of copied source. Never commit real credentials.
7. Run backend tests, frontend production build, and manual end-to-end tests for each role and workflow.
8. Commit only Member 4's genuine integration, admin, notification, bug-fix, test and documentation changes.

## Final acceptance checklist

- [ ] Student can register/login and access only student functionality.
- [ ] Student can submit each supported request category.
- [ ] Student can upload supporting evidence where configured.
- [ ] Student can track requests and see approval remarks/history.
- [ ] Student can correct and resubmit returned requests.
- [ ] Faculty can see only requests assigned/authorized to them.
- [ ] Authorized faculty can approve, reject or return requests with remarks.
- [ ] Medical leave follows the configured multi-level route.
- [ ] Admin can manage users, roles and faculty assignments.
- [ ] Notifications appear for relevant workflow events.
- [ ] Existing Member 1–3 functionality still passes regression tests.
- [ ] `npm test --prefix server` passes, where tests are configured.
- [ ] `npm run build --prefix client` succeeds.
- [ ] README setup instructions match the final implementation.

## Important

The source code in this package is the supplied original reference project. It is not evidence that Member 4 personally implemented every listed feature. Member 4's contribution should be the actual integration and verification changes made in the team's Git repository.
