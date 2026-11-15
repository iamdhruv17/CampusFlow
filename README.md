# CampusFlow – College Academic Request & Approval Management System

CampusFlow is a web-based application designed to digitize and simplify academic request management in colleges and universities. It replaces traditional paper-based processes with a centralized platform where students can submit academic requests, upload supporting documents, track their progress, and receive updates.

Faculty members and administrators can review and manage requests through role-based dashboards, making the approval process more organized, transparent, and efficient.

## Problem Statement

In many educational institutions, students still depend on physical forms, paperwork, and in-person visits to faculty members for academic activities such as attendance corrections, event participation credits, and medical leave approvals.

These processes can be time-consuming, difficult to track, and lack transparency.

CampusFlow addresses these challenges by providing a centralized digital platform for submitting, reviewing, and managing academic requests.

## Key Features

- **Online Request Submission:** Students can submit academic requests without physical paperwork.
- **Multiple Request Categories:** Supports Attendance Correction, Event Attendance / Participation Credit, Medical Leave, and Other Academic Grievances.
- **Document Uploads:** Students can attach supporting documents such as medical certificates and event proofs.
- **Multi-Level Approval Workflow:** Requests are automatically routed to the appropriate faculty members and authorities.
- **Request Tracking:** Students can monitor request status and view approval history and remarks.
- **Return and Resubmission:** Students can correct and resubmit requests returned by reviewers.
- **Role-Based Dashboards:** Separate dashboards provide relevant functionality for students, faculty, and administrators.
- **Notifications:** Users receive in-app updates about request assignments and workflow progress.
- **Administration:** Admins can manage user accounts, roles, and faculty responsibilities.

## User Roles

CampusFlow supports seven user roles:

| Role | Responsibilities |
|---|---|
| Student | Submit requests, upload documents, track status, and resubmit returned requests. |
| Teacher | Review and process assigned academic requests. |
| Class Coordinator | Handle assigned class responsibilities and the first stage of medical leave approval. |
| Mentor | Review and process medical leave requests at the mentor stage. |
| HOD | Handle departmental requests and the HOD stage of medical leave approval. |
| Dean | Provide final approval for medical leave requests. |
| Admin | Manage users, faculty assignments, and monitor system-wide activity. |

## Approval Workflows

CampusFlow supports different approval workflows depending on the request category.

- **Attendance Correction:** Routed to the appropriate subject faculty or eligible departmental authority.
- **Event Attendance / Participation Credit:** Routed to the appropriate faculty member or class authority for verification.
- **Medical Leave:** Follows a sequential approval process:

  **Student → Class Coordinator → Mentor → HOD → Dean**

- **Other Academic Grievances:** Routed to the appropriate departmental authority.

Requests can be approved, rejected, or returned for correction by authorized reviewers. Approval actions and remarks are recorded in the request history.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React.js, Vite, Tailwind CSS |
| Routing | React Router DOM |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, HttpOnly Cookies, bcryptjs |
| File Storage | Cloudinary |
| HTTP Client | Axios |
| Icons | Lucide React |

## Future Scope

- AI-assisted document verification.
- Email and push notifications.
- Advanced analytics and reporting.
- Additional academic workflow integrations.

## License

This project is licensed under the ISC License.

**CampusFlow – Making Academic Request Management Simple, Transparent, and Paperless.**