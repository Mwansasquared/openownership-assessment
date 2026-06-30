# Business Registration Portal

This project is a full-stack application for submitting, tracking applications and reviewing(i.e. approving and rejecting). A business registration use case has been used to demonstrate the submission and approval task through a structured multi-stage approval pipeline.

---

## Table of Contents

- [Overview](#overview)
- [Live Demo](#live-demo)
- [Tech Stack](#tech-stack)
- [Tools Used](#tools-used)
- [Architecture](#architecture)
- [Application Status Flow](#application-status-flow)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Local Development](#local-development)
- [Seed Users](#seed-users)
- [Running Tests](#running-tests)
- [Deployment](#deployment)
- [Design Decisions](#design-decisions)
- [Trade-offs & Future Improvements](#trade-offs--future-improvements)

---

## Overview

The project shows a workflow were Business owners (**applicants**) create and manage registration applications that move through a defined approval lifecycle (submission). Registry officers (**reviewers**) drive the review and approval process. Every status change — including edits and creation — is recorded in an append-only audit trail so the full history of every application is permanently available.

**Roles**

| Role | Capabilities |
|---|---|
| `submitter` | Create, edit, and delete DRAFT applications; submit for review; resubmit after rejection |
| `reviewer` | Begin review, approve registration, or reject applications |
| `admin` | All of the above |

---

## Live Demo

| Service | URL |
|---|---|
| Frontend | [https://frontend-production-b018.up.railway.app/login](https://frontend-production-b018.up.railway.app/login) |
| Backend API | [https://backend-production-22d3.up.railway.app](https://backend-production-22d3.up.railway.app) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.23, [Chi v5](https://github.com/go-chi/chi), [pgx v5](https://github.com/jackc/pgx), [godotenv](https://github.com/joho/godotenv) |
| Database | PostgreSQL 14+ |
| Auth | JWT (HS256) stored in `httpOnly` cookies |
| Frontend | React 19, Vite 6, TypeScript 5.8, React Router v7 |
| Theming | CSS custom properties, `localStorage` + `prefers-color-scheme` |
| Hosting | [Railway](https://railway.app) (frontend, backend, and database) |

---

## Tools Used

| Tool | How it was used |
|---|---|
| VS Code | Primary editor for writing, editing, and debugging code across the full stack |
| PgAdmin | GUI for inspecting database state, verifying schema, and running ad-hoc queries during development |
| Claude (Anthropic) | AI pair-programmer — see detail below |

### AI assistance (Claude)

Claude was used throughout the project as a pair-programmer rather than a code generator. Specific uses:

- **Scaffolding** — generated the initial Go project layout (router wiring, middleware chain, handler skeletons) and React component shells so that structural decisions could be made up-front rather than evolved from scratch.
- **Test generation** — produced the table-driven test cases in `state_managament_test.go`. The test matrix (valid transitions, illegal transitions, role/action combinations) was described in natural language and Claude translated it into idiomatic Go test code, which was then reviewed and adjusted.
- **Debugging** — used to diagnose a `SameSite` cookie rejection in cross-origin production and a `pgx` connection-pool misconfiguration that caused idle-timeout errors.
- **Documentation** — generated first drafts of the API reference table and the ASCII architecture diagram, which were then edited for accuracy.

Every piece of generated code was read, understood, and either accepted, modified, or rejected before being committed. Claude was not used to write business logic or workflow rules — those were written by hand to ensure correctness.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser (React + Vite)                                  │
│  /login  /register  /submissions  /submissions/:id       │
│                                                          │
│  Dark / Light theme toggle · Password visibility toggle  │
└───────────────────────┬──────────────────────────────────┘
                        │ HTTPS (credentials: include)
                        ▼
┌──────────────────────────────────────────────────────────┐
│  Go HTTP Server (Chi)                                    │
│                                                          │
│  middleware: CORS → JWT auth → role check                │
│                                                          │
│  /api/auth/*          AuthHandler                        │
│  /api/submissions/*   SubmissionHandler                  │
│         │                    │                           │
│     UserRepo           SubmissionRepo                    │
└───────────────────────┬──────────────────────────────────┘
                        │ pgx connection pool
                        ▼
┌──────────────────────────────────────────────────────────┐
│  PostgreSQL                                              │
│  users · submissions · submission_events                 │
└──────────────────────────────────────────────────────────┘
```

Authentication uses `httpOnly` cookies to prevent XSS-based token theft. CORS is configured to allow credentials only from the trusted frontend origin.

---

## Application Status Flow

```
                  ┌─────────┐
                  │  DRAFT  │◄──────────────────────┐
                  └────┬────┘                       │
                       │ submit                     │
                       │ (submitter / admin)        │
                       ▼                            │
                 ┌───────────┐                      │
                 │ SUBMITTED │                      │
                 └─────┬─────┘                      │
                       │ start_review               │
                       │ (reviewer / admin)         │
                       ▼                            │
               ┌─────────────────┐                  │
               │  UNDER_REVIEW   │                  │
               └────┬───────┬────┘                  │
      approve       │       │  reject               │
  (reviewer/admin)  │       │  (reviewer/admin)     │
                    ▼       ▼                       │
              ┌──────────┐  ┌──────────┐            │
              │ APPROVED │  │ REJECTED │            │
              └──────────┘  └────┬─────┘            │
                                 │ resubmit          │
                                 │ (submitter/admin) │
                                 └───────────────────┘
                                   (re-enters as SUBMITTED)
```

The transition map lives entirely in [`backend/internal/workflow/state_management.go`](backend/internal/workflow/state_management.go). Adding a new transition requires a single map entry — no handler changes needed.

---

## Project Structure

```
.
├── backend/
│   ├── server/
│   │   └── main.go                   # Entry point: router, DB pool, middleware
│   ├── internal/
│   │   ├── auth/
│   │   │   ├── jwt.go                # HS256 sign / verify, 24-hour TTL
│   │   │   └── middleware.go         # Authenticate (cookie → claims) + RequireRole
│   │   ├── handler/
│   │   │   ├── auth_handler.go       # Register, Login, Logout, Me
│   │   │   ├── submission_handler.go # CRUD + action dispatcher
│   │   │   └── helpers.go            # writeJSON / writeError
│   │   ├── model/
│   │   │   ├── user.go               # User, Role constants
│   │   │   └── submission.go         # Submission, SubmissionEvent, State/Action enums
│   │   ├── repository/
│   │   │   ├── user_repo.go          # FindByEmail, FindByID, Create
│   │   │   └── submission_repo.go    # CRUD + atomic Transition + event logging (tx)
│   │   └── workflow/
│   │       ├── state_managament.go      # Transition(), AllowedActions(), RoleCanAct()
│   │       └── state_managament_test.go # 32 table-driven tests
│   ├── migrations/
│   │   ├── 001_create_users.up.sql
│   │   ├── 002_create_submissions.up.sql
│   │   ├── 003_create_submission_events.up.sql
│   │   └── 004_seed_users.up.sql     # One user per role (password: password123)
│   ├── .env                          # Local config (git-ignored)
│   ├── .env.example
│   ├── Dockerfile
│   └── go.mod
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   ├── client.ts             # fetch wrapper (credentials: include)
    │   │   ├── auth.ts               # register, login, logout, me
    │   │   └── submissions.ts        # list, get, create, update, delete, performAction, listEvents
    │   ├── components/
    │   │   ├── AuthCard.tsx          # 2-column login/register card with portal info panel
    │   │   ├── ActionButtons.tsx     # Role-aware action buttons + reviewer comment textarea
    │   │   ├── PasswordInput.tsx     # Input with show/hide toggle
    │   │   └── StatusBadge.tsx       # Coloured status pill
    │   ├── hooks/
    │   │   ├── useAuth.ts            # AuthContext + useAuth hook
    │   │   └── useTheme.ts           # Dark/light toggle with localStorage persistence
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── RegisterPage.tsx
    │   │   ├── SubmissionsPage.tsx   # Application list + create form
    │   │   └── SubmissionDetailPage.tsx # Edit, workflow actions, application history
    │   ├── types/
    │   │   └── index.ts              # Shared TypeScript types mirroring Go models
    │   ├── App.tsx                   # Router, AuthContext provider, nav, theme toggle
    │   ├── main.tsx
    │   └── vite-env.d.ts
    ├── vite.config.ts                # Dev proxy → localhost:8080
    └── package.json
```

---

## Database Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK, `gen_random_uuid()` |
| `email` | `TEXT` | Unique |
| `password_hash` | `TEXT` | bcrypt cost 10, never returned in API responses |
| `role` | `TEXT` | `submitter` \| `reviewer` \| `admin` |
| `created_at` | `TIMESTAMPTZ` | |

### `submissions`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.id` (applicant) |
| `title` | `TEXT` | Business name |
| `content` | `TEXT` | Business description |
| `state` | `TEXT` | `DRAFT` \| `SUBMITTED` \| `UNDER_REVIEW` \| `APPROVED` \| `REJECTED` |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated by DB trigger |

### `submission_events` (append-only audit trail)

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `submission_id` | `UUID` | FK → `submissions.id` |
| `actor_id` | `UUID` | FK → `users.id` — who triggered the action |
| `action` | `TEXT` | `create` \| `update` \| `submit` \| `start_review` \| `approve` \| `reject` \| `resubmit` |
| `from_state` | `TEXT` | State before the transition (`''` for `create` events) |
| `to_state` | `TEXT` | State after the transition |
| `comment` | `TEXT` | Optional reviewer note |
| `created_at` | `TIMESTAMPTZ` | |

The `actor_id` is JOINed with `users` at query time so the API response includes `actor_email` and `actor_role` — the audit trail shows exactly who did what, not just an opaque ID.

> Rows in `submission_events` are never updated or deleted. The table is the authoritative, append-only record of every action taken on an application.

---

## API Reference

All routes are prefixed with `/api`. Authenticated routes require the `token` cookie set by login.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Create account; sets cookie |
| `POST` | `/auth/login` | Public | Authenticate; sets cookie |
| `POST` | `/auth/logout` | Required | Clears cookie |
| `GET` | `/auth/me` | Required | Current user profile |

**Register / Login body**
```json
{ "email": "user@example.com", "password": "secret", "role": "submitter" }
```

### Submissions (Applications)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/submissions` | Required | List; applicants see own, reviewers/admin see all |
| `POST` | `/submissions` | Submitter / Admin | Create a new DRAFT; logs `create` event |
| `GET` | `/submissions/:id` | Required | Get single application (includes `owner_email`) |
| `PUT` | `/submissions/:id` | Owner | Update title/content (DRAFT only); logs `update` event |
| `DELETE` | `/submissions/:id` | Owner | Delete (DRAFT only) |
| `GET` | `/submissions/:id/events` | Required | Full application history (actor identity included) |
| `POST` | `/submissions/:id/actions/:action` | Role-dependent | Trigger a state transition |

**Supported workflow actions**

| Action | Allowed from state | Roles |
|---|---|---|
| `submit` | `DRAFT` | submitter, admin |
| `start_review` | `SUBMITTED` | reviewer, admin |
| `approve` | `UNDER_REVIEW` | reviewer, admin |
| `reject` | `UNDER_REVIEW` | reviewer, admin |
| `resubmit` | `REJECTED` | submitter, admin |

**Action body** (comment is optional; shown to applicant in history)
```json
{ "comment": "Registration number conflict — please provide an alternative." }
```

**Error format**
```json
{ "error": "action \"approve\" not allowed in state \"DRAFT\"" }
```

---

## Local Development

### Option A — Docker Compose (recommended)

Brings up PostgreSQL and the backend together; only the frontend runs outside Docker.

```bash
docker compose up --build
```

The backend starts on `http://localhost:8080`. Migrations and seed users run automatically on startup.

Then start the frontend separately:

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on `http://localhost:5173`. The Vite dev server proxies all `/api` requests to `http://localhost:8080`.

### Option B — Run locally without Docker

#### Prerequisites

- Go 1.23+
- Node.js 20+
- PostgreSQL 14+

#### 1. Start PostgreSQL

```bash
createdb openownership

# Or with Docker (database only)
docker run -d --name pg \
  -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=openownership \
  -p 5432:5432 postgres:16-alpine
```

#### 2. Configure and start the backend

The backend auto-loads `backend/.env` on startup via `godotenv` — no need to set env vars in the shell command.

```bash
cp backend/.env.example backend/.env
# Edit .env: set DATABASE_URL and JWT_SECRET

cd backend
go run main.go
```

Migrations and seed users run automatically on startup. Server starts on `http://localhost:8080`.

#### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on `http://localhost:5173`. The Vite dev server proxies all `/api` requests to `http://localhost:8080`.

---

## Seed Users

Migration `004_seed_users.sql` inserts one user per role. All passwords are `password123`.

| Email | Password | Role |
|---|---|---|
| `applicant@example.com` | `password123` | `submitter` |
| `reviewer@example.com` | `password123` | `reviewer` |
| `admin@example.com` | `password123` | `admin` |

The seed is idempotent — `ON CONFLICT (email) DO NOTHING` means re-running it is safe.

---

## Running Tests

```bash
cd backend
go test ./...
```

The status management test suite (`internal/workflow/status_management_test.go`) covers:

- All valid transitions in the happy path (11 cases)
- Every illegal transition
- All role/action permission combinations (15 cases)

```
--- PASS: TestTransition (0.00s)      # 11 sub-tests
--- PASS: TestAllowedActions (0.00s)  # 6 sub-tests
--- PASS: TestRoleCanAct (0.00s)      # 15 sub-tests
PASS    github.com/openownership/assessment/internal/workflow
```

---

## Deployment

### Backend → Railway

1. Create a new Railway project and add a **PostgreSQL** plugin.
2. Add a new service pointing to the `backend/` directory; Railway detects the `Dockerfile`.
3. Set these environment variables in the Railway service:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Provided automatically by the Railway PostgreSQL plugin |
| `JWT_SECRET` | A long random string (`openssl rand -hex 32`) |
| `FRONTEND_ORIGIN` | A url on which the frontend is running to allow cross-origin(the railway frontend url) |

4. Run migrations against the Railway database:

Once the Go backend server is successfully deployed the migrations to create the database tables as well as seed users with roles are run.

> The `DATABASE_URL` env var set in Railway is picked up automatically at runtime; `godotenv` only reads from `.env` when the file is present (it is not present in the Docker image).

### Frontend → Railway

1. Create a new Railway service pointing to the `frontend/` directory.
2. Set the start command to `npm run build && npx serve dist` (or use a static file server of your choice).
3. Add the environment variable:

| Variable | Value |
|---|---|
| `VITE_API_URL` | the Railway backend URL, e.g. `https://backend-production-22d3.up.railway.app` |

The live frontend is deployed at [https://frontend-production-b018.up.railway.app](https://frontend-production-b018.up.railway.app).

> **Cookie note**: In production the frontend and backend are on different origins, so the auth cookie must have `SameSite=SameSiteNoneMode; Secure` set in `auth_handler.go`. Railway provides HTTPS automatically.

**See more documentation on deploying to** [Railway](https://docs.railway.com/deployments/monorepo)
---

## Design Decisions

### Optimistic concurrency on state transitions

`SubmissionRepo.Transition` issues a single atomic transaction:

```sql
UPDATE submissions SET state = $2
WHERE id = $1 AND state = $3   -- only matches if state hasn't changed
RETURNING ...
```

If another request already advanced the state, zero rows are returned and the handler responds with `409 Conflict`, preventing silent double-transitions.

### State management as the single source of truth

`workflow.RoleCanAct` and `workflow.Transition` are called in the handler *before* any DB write:

- Invalid transitions are rejected in Go, not by a database constraint error.
- Adding a new state or action requires a single map entry in `state_machine.go`.
- Business rules are unit-tested without a database.

### Full actor identity in the audit trail

Every event in `submission_events` carries an `actor_id` FK. The repository JOINs `users` at query time so each event in the API response includes `actor_email` and `actor_role`. This means the audit trail shows *who* did what — not just an opaque UUID — and requires no denormalisation in the events table itself.

Non-transition events (`create`, `update`) are also logged, giving a complete picture: when the application was first drafted, each edit, and every stage in the review pipeline.

### Append-only audit trail

`submission_events` has no `UPDATE` or `DELETE` paths in the repository layer. Every action writes a new row with `(actor_id, action, from_state, to_state, comment, timestamp)`. This provides a complete, tamper-evident history of every application.

### Auto-loading `.env` in development

The backend uses `godotenv.Load()` at startup to read `backend/.env`. In production (Railway), environment variables are injected directly and the `.env` file is absent, so `godotenv` is a silent no-op. This eliminates the need to prefix every `go run` command with env var assignments.

### `httpOnly` cookies over `Authorization` headers

Storing the JWT in an `httpOnly` cookie means JavaScript cannot read or exfiltrate the token, eliminating the most common XSS attack vector against SPAs. The trade-off is careful CORS configuration (`AllowCredentials: true`, explicit origin allowlist).

### Dark / light theme

The frontend uses CSS custom properties on the `<html>` element (`data-theme="light"`) for instant, flicker-free theme switching. The chosen theme is persisted to `localStorage` and initialised from `prefers-color-scheme` on first visit, so users always get a comfortable default.

---

## Trade-offs & Future Improvements

### Trade-offs made

**`pgx` directly vs an ORM**
Using `pgx` with raw SQL keeps the query layer explicit and fast, but requires writing more boilerplate (scan columns by hand, manage transactions manually). An ORM like GORM would reduce boilerplate at the cost of opaque queries and harder-to-predict behaviour under concurrent load. For a project where the query count is small and correctness matters, raw SQL was the right call.

**In-process state machine vs database constraints**
Workflow rules live entirely in Go (`workflow/state_managament.go`) rather than being enforced by database `CHECK` constraints or triggers. This makes the rules easy to unit-test without a database and trivial to extend, but means the database alone cannot reject an invalid transition if something bypasses the application layer. A `CHECK (state IN (...))` constraint on `submissions` was added as a safety net, but the authoritative enforcement is in Go.

**JWT in `httpOnly` cookies vs `Authorization` headers**
Cookies prevent XSS token theft but introduce a cross-origin complexity: `SameSite=None; Secure` is required in production, and the CORS config must explicitly allow credentials. A `localStorage`-based token would be simpler to implement but vulnerable to XSS. The security trade-off favours cookies.

**No pagination**
The submissions list endpoint returns all records for the authenticated user in a single response. This is fine for a demo but would not scale — a reviewer on a busy registry could see thousands of submissions.

**Minimal router (Chi) vs a full framework**
Chi was chosen for its lightweight composable middleware and idiomatic Go style. A heavier framework (Gin, Fiber) would provide more built-ins (validation, binding) but would also constrain the architecture more. For this scope, Chi kept things transparent.

---

### What I would add or change with more time

| Area | Improvement |
|---|---|
| **Pagination & filtering** | Cursor-based pagination on `GET /submissions`, plus filter by state and date range |
| **Refresh tokens** | Current JWTs expire after 24 hours with no renewal path — add a short-lived access token + long-lived refresh token stored as a separate `httpOnly` cookie |
| **Email notifications** | Notify applicants when their application moves to `UNDER_REVIEW`, `APPROVED`, or `REJECTED` |
| **Rate limiting** | Per-IP and per-user rate limits on auth endpoints to prevent brute-force attacks |
| **Integration tests** | The workflow logic is unit-tested, but there are no tests that exercise the full HTTP → handler → repository → database path against a real test database |
| **OpenAPI spec** | Auto-generate API documentation from code (e.g. with `swaggo/swag`) so the API contract is always up to date |
| **File attachments** | Allow applicants to attach supporting documents (e.g. ID, proof of address) to a submission |
| **Real-time updates** | Use Server-Sent Events or WebSockets so a reviewer's list view updates automatically when a new submission arrives, without polling |
| **Audit log export** | Let admins download the full event history for a submission as CSV or PDF for compliance purposes |
