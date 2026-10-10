# NeoStats frontend

This directory contains the Next.js App Router frontend for NeoStats. It communicates with the separate Express API using credentialed HTTP requests and Socket.IO.

For complete backend setup, seeded accounts, the evaluator walkthrough, Postman instructions, and the future-work checklist, see the [root README](../README.md).

## Start the frontend

Start MongoDB and the backend first. From this directory:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The browser calls `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:5000`. HTTP requests retry `http://localhost:4000` when the default local API cannot be reached.

To configure another API address, create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:5000
```

The configured API must allow the frontend origin and credentials through CORS.

## Login

After running `npm run seed` in the repository root, use:

```text
admin@neostats.local
Password123!
```

The backend places the JWT in an HTTP-only cookie. Frontend code does not read or store the token. Every API request uses `credentials: "include"` so the browser sends the cookie automatically.

## Routes and navigation

```text
src/app/page.tsx                              / → redirects to /login
src/app/login/page.tsx                        /login
src/app/register/page.tsx                     /register
src/app/(workspace)/dashboard/page.tsx        /dashboard
src/app/(workspace)/projects/page.tsx         /projects
src/app/(workspace)/projects/[id]/page.tsx    /projects/:id
src/app/(workspace)/users/page.tsx            /users
src/app/(workspace)/profile/page.tsx          /profile
```

`(workspace)` is a route group. It applies the authenticated workspace layout but is deliberately omitted from the public URL. For example:

```text
src/app/(workspace)/users/page.tsx → /users
```

The shared workspace header and role-aware navigation live in `src/components/app-shell.tsx`.

### `/login` and `/register`

- Login establishes the HTTP-only session cookie and refreshes the current user.
- Registration creates a normal platform user; it cannot self-assign Admin.
- The requested project role is a preference, not authorization.

### `/dashboard`

- Summarizes accessible projects and tasks.
- Shows assigned, in-progress, and completed counts.
- Displays skeleton placeholders while project and task requests are pending.

### `/projects`

- Admins can create projects.
- Existing memberships appear under **My projects**.
- Non-admin users can discover active projects and request Team Member or Viewer access.
- Pending access requests can be cancelled.

### `/projects/:id`

The project screen contains four tabs:

- **Overview**: project notes/documentation and task counts. Admins and Project Managers can edit the stored Markdown source.
- **Tasks**: Project Managers and Admins can create tasks. Permitted users can change task status using the current task version.
- **Team**: managers review access requests and manage members. Admins can promote a member to Project Manager.
- **Activity**: displays the project's latest persisted audit records.

The screen joins the authenticated Socket.IO room `project:<id>`. Relevant project, member, access-request, task, and comment events trigger a fresh HTTP load. Socket.IO announces that data changed; MongoDB-backed HTTP responses remain authoritative.

### `/users`

This is an Admin-only page even though its route file is nested under `(workspace)`.

- The navigation link is rendered only for Admin users.
- The page calls `GET /api/users?limit=100`.
- It shows names, emails, requested roles, platform roles, and active status.
- Admins can deactivate non-admin accounts.
- A non-admin opening `/users` directly sees an access-required message, while the backend independently rejects unauthorized `/api/users` requests.

### `/profile`

Displays the current account, platform role, requested role, project memberships, and effective project permissions.

## Authentication guard

`src/components/auth-provider.tsx` loads `/api/auth/me` when the application starts. Protected screens display skeletons while that request is pending. If no session exists, protected routes redirect to `/login`.

Frontend checks improve navigation and presentation, but they are not the authorization boundary. The Express backend re-checks the current user and project membership for every protected operation.

## Notifications

`src/components/notification-aside.tsx`:

- Loads persisted notifications over HTTP.
- Can filter to unread notifications.
- Marks notifications read through the API.
- Joins the authenticated personal Socket.IO room automatically.
- Prepends `notification.created` events without requiring a refresh.

The panel is visible on large screens. Improving mobile notification navigation remains future work.

## Important frontend files

```text
src/app/                         route-level screens and layouts
src/components/app-shell.tsx     workspace navigation and page shell
src/components/auth-provider.tsx session loading and route protection
src/components/notification-aside.tsx
                                 notification HTTP and Socket.IO behavior
src/components/ui/               shared visual primitives
src/lib/api.ts                   credentialed API wrapper and local fallback
src/types/api.ts                 frontend API response types
```

## Verify changes

```bash
npm run lint
npx tsc --noEmit
npm run build -- --webpack
```

The explicit Webpack flag is currently the reliable production-build check in the Windows sandbox. The default Turbopack build has encountered an internal child-process connection failure while processing global CSS; the same application builds successfully with Webpack.

## Frontend checklist

- [ ] Verify login and logout in a normal browser window.
- [ ] Verify Admin-only `/users` navigation and direct-route handling.
- [ ] Verify project discovery and access requests as a non-admin.
- [ ] Open the same project in two browser sessions and confirm real-time refresh.
- [ ] Force a stale task update and confirm the conflict message reloads current data.
- [ ] Verify skeletons appear without flashing empty-state messages.
- [ ] Check desktop and mobile layouts.
- [ ] Run lint, TypeScript, and the production build before submission.

## Future frontend scope

- Add task-detail and comment interfaces.
- Add project archive controls for Admin.
- Add rendered Markdown with safe sanitization and revision history.
- Add pagination and search controls for large collections.
- Add a mobile notification drawer.
- Introduce a query/cache library to deduplicate requests and update event-driven state more precisely.
- Add component and browser-level tests for role-specific flows and real-time synchronization.
