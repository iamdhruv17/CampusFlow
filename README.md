# CampusFlow

CampusFlow is a college project for managing academic requests online. Students can raise a request, attach supporting documents and check its status without having to follow up through paper forms. Faculty members and administrators get separate views to review requests and handle approvals.

## What it covers

- Attendance correction requests
- Event participation and attendance credit
- Medical leave applications
- Other academic grievances
- Supporting document uploads
- Request status, reviewer remarks and approval history
- Returning requests for corrections and resubmission
- Notifications and role-based dashboards

Students submit requests and track their progress. Teachers and other staff review requests assigned to them, while admins manage users and faculty assignments.

Medical leave uses a multi-step approval route:

`Student → Class Coordinator → Mentor → HOD → Dean`

## Tech stack

| Part | Tools |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Authentication | JWT, HttpOnly cookies |
| File uploads | Cloudinary |
| Other libraries | Axios, React Router, Lucide React |

## Running locally

You'll need Node.js, npm and a MongoDB database. Cloudinary credentials are needed if you want to test file uploads.

1. Clone the repository and open the project folder.
2. Install the frontend and backend dependencies:

   ```bash
   npm run install:all
   ```

3. Copy `server/.env.example` to `server/.env` and fill in the MongoDB connection string, JWT secret and any Cloudinary credentials. Copy `client/.env.example` to `client/.env` if you need to configure the API URL.
4. Start the backend:

   ```bash
   npm run server
   ```

5. In another terminal, start the frontend:

   ```bash
   npm run client
   ```

The frontend normally runs at `http://localhost:5173`, and the API at `http://localhost:5000/api`.

For local demo data, you can run `npm run seed`. **This clears existing application data in the configured database**, so don't run it against a database you need to keep.

## Project structure

```text
client/    React frontend, pages and API services
server/    Express API, database models and application logic
```

## Checks

The backend has separate test scripts for the request lifecycle, user profiles and security. For example:

```bash
npm run test:requests --prefix server
npm run test:profile --prefix server
npm run test:security --prefix server
npm run build:client
```

## License

ISC (as declared in the project package files).
