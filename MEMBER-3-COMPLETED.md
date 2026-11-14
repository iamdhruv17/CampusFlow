# Member 3 — Faculty & Multi-Level Approval Workflow

## Implemented
- Faculty approval queue for teacher/mentor, coordinator, HOD and Dean roles.
- Request review detail page with requester information and request description.
- Approve/forward, return for correction and reject decisions.
- Sequential stages: mentor → coordinator → HOD → Dean → approved.
- Required remarks for returned and rejected requests.
- Embedded approval history recording actor, role, stage, decision, remarks and timestamp.
- Protected approval API endpoints and role/stage authorization.
- Student request model extended with workflow state without removing Member 1 or Member 2 fields.

## API
- `GET /api/approvals/assigned`
- `GET /api/approvals/:id`
- `POST /api/approvals/:id/decision` with `{ "decision": "approved|returned|rejected", "remarks": "..." }`
- `GET /api/approvals/:id/history`

## Notes
- Teacher accounts act at the mentor stage; other approver roles act at their named stage.
- A request is finally approved only after all four stages approve it.
- Returned/rejected requests stop the current workflow. A returned request can be resubmitted by the student; the workflow restarts at mentor stage.
- Run the full regression checklist before handover.
