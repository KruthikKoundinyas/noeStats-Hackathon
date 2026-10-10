# NeoStats collaborative project management

NeoStats is a hackathon implementation of a multi-user project workspace. It combines a Next.js frontend with an Express, MongoDB, and Socket.IO backend. Authentication uses an HTTP-only JWT cookie, permissions are enforced by the API, task updates use optimistic version checks, and connected project screens refresh when relevant real-time events arrive.

## What to check

Use this list as the fastest acceptance pass:

- Login works for Admin, Project Manager, Team Member, and Viewer accounts.
- Admin can manage users, create/archive projects, approve access, and promote a member to Project Manager.
- A project always has at least one Project Manager; the API rejects removing or demoting the last one.
- Project Managers can edit project notes, manage members, create/update/delete tasks, and inspect activity.
- Team Members can update the status of tasks assigned to them and add comments through the API.
- Viewers receive read-only project, task, and activity access.
- Unauthorized direct API requests return `403`; frontend visibility is not the security boundary.
- A stale task version returns `409` and includes the latest task.
- Notifications persist in MongoDB, support read/unread state, and arrive through Socket.IO.
- With the same project open in two browser sessions, project/member/task/comment changes trigger a reload in the other session without a page refresh.
- Loading views use skeleton placeholders until asynchronous data arrives.

The original acceptance baseline is `NeoStats_Hackathon_Challenge (1).pdf` in the repository root.

## Run locally

Prerequisites: Node.js 22+, npm, and a running MongoDB instance.

1. Copy `.env.example` to `.env`.
2. Set a long random `JWT_SECRET`. Production startup intentionally fails when it is absent.
3. Install backend packages with `npm install`.
4. Seed demo data with `npm run seed`.
5. Start the API with `npm run dev`.
6. In another terminal, run `cd frontend`, `npm install`, then `npm run dev`.
7. Open `http://localhost:3000`.

The API normally uses `http://localhost:5000`, falling back to `4000` if necessary. The health endpoint is `GET /health`. If the backend uses the fallback port, the frontend retries it automatically for HTTP calls.

### Environment variables

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/neostats
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_ORIGIN=http://localhost:3000
SEED_PASSWORD=Password123!
```

## Seeded accounts

All accounts use `SEED_PASSWORD`, which defaults to `Password123!`.

| Role | Email |
|---|---|
| Admin | `admin@neostats.local` |
| Project Manager | `manager@neostats.local` |
| Team Member | `member@neostats.local` |
| Viewer | `viewer@neostats.local` |

## Guided demo: Admin to real-time collaboration

### 1. Login and inspect the dashboard

Login with `admin@neostats.local` / `Password123!`. The dashboard summarizes accessible projects and recent tasks. Use the top navigation for Dashboard, Projects, Users, and Profile. Notifications appear in the right-hand panel on desktop.

### 2. Manage users

Open **Users**. Confirm that all seeded roles are present. Admins can deactivate non-admin accounts; deactivation also revokes that user's active in-memory sessions.

### 3. Create a project

Open **Projects**, enter a name and description, and select **Create**. The creating admin is automatically recorded as the initial Project Manager, so the project never begins unmanaged.

Open the project. Its tabs are:

- **Overview**: edit and save the project's Markdown notes/documentation and review task counts.
- **Tasks**: create tasks and change their status.
- **Team**: review access requests, change roles, promote a member to Project Manager, or remove members.
- **Activity**: inspect the latest persisted audit entries.

### 4. Request and approve access

Open an incognito/private window and login as `member@neostats.local`. Open **Projects**, find the new project under discovery, and request Team Member access.

Return to the admin window and open the project's **Team** tab. Approve the pending request. The member receives a persisted real-time notification. An admin may then promote that member to Project Manager from the role selector.

### 5. Verify real-time behavior

Keep the same project open in both windows. As an admin or manager, create a task or change a member role. The other connected project screen receives the project-room event and reloads current MongoDB state automatically. Personal notification events update the notification panel immediately.

MongoDB remains the source of truth: Socket.IO events announce that something changed, but do not permanently store application state. If a socket disconnects or an event is missed, reconnecting and loading the HTTP endpoints reconstructs the correct screen from MongoDB.

### 6. Verify concurrent updates

Task updates send the current `version`. The API matches both task ID and version, then increments the version atomically. A second update based on an older version receives `409 Conflict` with `details.latest`, preventing silent overwrites.

## Postman API collection

Import `postman/NeoStats.postman_collection.json` into Postman and run it from top to bottom after `npm run seed`.

The collection is an executable backend walkthrough and regression check. It logs in through the normal endpoints, relies on Postman's cookie jar for the HTTP-only `neostats_token`, stores generated resource IDs and task versions as collection variables, exercises role restrictions and stale-version conflicts, and cleans up its generated task/comment/project state. If the API falls back to port `4000`, change the collection's `baseUrl` variable.

## Project map

```text
config/       environment settings and the permission matrix
controllers/  authenticated HTTP use cases
db/           MongoDB connection
middleware/   authentication and centralized errors
models/       Mongoose schemas and indexes
postman/      importable API walkthrough/tests
realtime/     authenticated Socket.IO rooms
routes/       URL and middleware declarations
services/     sessions, permissions, locking, activity, notifications
utils/        validation and response helpers
frontend/     Next.js application
app.js        Express composition
server.js     database, HTTP, and Socket.IO startup
seed.js       repeatable demo data
source.js     package-script entry point
```

## Important implementation notes

- Project authorization always reads current membership from MongoDB. Permissions returned to the browser are informational only.
- JWTs are sent only in an HTTP-only cookie. Returning them in JSON was intentionally removed to reduce accidental browser-storage exposure.
- Session revocation and keyed mutation locks are in process memory. The lock serializes same-project membership mutations in one Node process and protects the last-manager check from local races. It is not a replacement for a MongoDB transaction and does not coordinate multiple API instances.
- Multi-document side effects such as entity + activity + notification writes are not fully atomic yet. MongoDB replica-set transactions or an outbox pattern are the production-grade next step.
- Logging intentionally remains the current console-based implementation.

## Future scope and fix checklist

### Highest priority

- [ ] Add automated permission tests for every role and endpoint.
- [ ] Add integration tests for task `409` conflicts and the last-manager invariant.
- [ ] Move sessions and mutation locks to Redis before running more than one API instance.
- [ ] Use MongoDB transactions for membership approval and other multi-document writes.
- [ ] Add an outbox/worker so notifications and Socket.IO publication survive process failures.
- [ ] Make archived projects read-only in every mutation controller.
- [ ] Decide how to reassign or unassign tasks when a member is removed.

### Product completeness

- [ ] Add task detail and comment controls to the frontend; the API already supports comments.
- [ ] Add project archival controls to the admin UI.
- [ ] Add mention parsing and mention notifications.
- [ ] Add pagination to projects, tasks, comments, activity, access requests, and notifications.
- [ ] Add a global system-activity view for Admin.
- [ ] Add richer Markdown rendering and document revision history.
- [ ] Improve mobile notification navigation.

### Security and operations

- [ ] Add rate limiting and login abuse protection.
- [ ] Add CSRF protection appropriate to the final deployment domains.
- [ ] Add stronger password policy, password reset, and email verification.
- [ ] Add request schemas with Zod or another validator and consistent field-level errors.
- [ ] Restrict flexible notification/activity payloads with explicit schemas.
- [ ] Add production metrics, request IDs, tracing, and structured logs when operational requirements justify replacing current logging.
- [ ] Add CI for backend checks, frontend lint, tests, and production builds.

## Validation commands

```bash
npm run check
npm --prefix frontend run lint
npm --prefix frontend run build -- --webpack
```

Webpack is included as a validation fallback because the current Next.js/Turbopack build can encounter a Windows sandbox worker-process crash unrelated to application TypeScript.
