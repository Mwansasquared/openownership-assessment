# Assignment B: Submission & Approval Workflow

A full-stack application implementing a structured document submission and multi-stage review workflow

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Status Management](#status-management)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Local Development](#local-development)
- [Running Tests](#running-tests)
- [Deployment](#deployment)
- [Design Decisions](#design-decisions)

---

## Overview

Users with the **submitter** role create and manage documents that move through a defined approval lifecycle. Users with the **reviewer** role drive the review process. Every state change is recorded in an append-only audit trail so the full history of a submission is always available.

**Roles**

| Role | Capabilities |
|---|---|
| `submitter` | Create, edit, delete DRAFT submissions; submit; resubmit after rejection |
| `reviewer` | Start review, approve, or reject submitted work |
| `admin` | All of the above |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.23, [Chi v5](https://github.com/go-chi/chi), [pgx v5](https://github.com/jackc/pgx) |
| Database | PostgreSQL 16 |
| Auth | JWT (HS256) stored in `httpOnly` cookies |
| Frontend | React 19, Vite 6, TypeScript 5.8, React Router v7 |
| Backend hosting | [Railway](https://railway.app) (Docker) |
| Frontend hosting | [Vercel](https://vercel.com) |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (React + Vite)                         │
│  /login  /register  /submissions  /submissions/:id│
└────────────────┬────────────────────────────────┘
                 │ HTTPS (credentials: include)
                 ▼
┌─────────────────────────────────────────────────┐
│  Go HTTP Server (Chi)                           │
│                                                 │
│  middleware: CORS → JWT auth → role check       │
│                                                 │
│  /api/auth/*          AuthHandler               │
│  /api/submissions/*   SubmissionHandler         │
│         │                    │                  │
│     UserRepo           SubmissionRepo           │
└─────────────────┬───────────────────────────────┘
                  │ pgx connection pool
                  ▼
┌─────────────────────────────────────────────────┐
│  PostgreSQL                                     │
│  users · submissions · submission_events        │
└─────────────────────────────────────────────────┘
```

Authentication uses `httpOnly` cookies to prevent XSS-based token theft. CORS is configured to allow credentials only from the trusted frontend origin.

---

## Status Management

```
                  ┌─────────┐
                  │  DRAFT  │
                  └────┬────┘
                       │ submit  (submitter / admin)
                       ▼
                 ┌───────────┐
                 │ SUBMITTED │
                 └─────┬─────┘
                       │ start_review  (reviewer / admin)
                       ▼
               ┌─────────────────┐
               │  UNDER_REVIEW   │
               └────┬───────┬────┘
      approve       │       │  reject
  (reviewer/admin)  │       │  (reviewer/admin)
                    ▼       ▼
              ┌──────────┐  ┌──────────┐
              │ APPROVED │  │ REJECTED │
              └──────────┘  └────┬─────┘
                                 │ resubmit  (submitter / admin)
                                 ▼
                           ┌───────────┐
                           │ SUBMITTED │ (re-enters the flow)
                           └───────────┘
```

The transition map lives entirely in [`internal/workflow/status_management.go`](backend/internal/workflow/status_management.go). Adding a new transition means adding one entry to the map — no handler changes required.

---

## Project Structure

```
.
├── backend/
│   ├──server/
│   │       └── main.go               # Entry point: wires router, DB pool, services
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
│   │   │   └── submission_repo.go    # CRUD + atomic Transition (tx)
│   │   └── workflow/
│   │       ├── status_management.go      # Transition(), AllowedActions(), RoleCanAct()
│   │       └── status_management_test.go # 32 table-driven tests
│   ├── migrations/
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_submissions.sql
│   │   └── 003_create_submission_events.sql
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
    │   │   ├── StatusBadge.tsx       # Coloured state pill
    │   │   └── ActionButtons.tsx     # Role-aware action buttons + comment textarea
    │   ├── hooks/
    │   │   └── useAuth.ts            # AuthContext + useAuth hook
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── RegisterPage.tsx
    │   │   ├── SubmissionsPage.tsx   # Table view + create button
    │   │   └── SubmissionDetailPage.tsx # Edit, actions, full audit trail
    │   ├── types/
    │   │   └── index.ts              # Shared TS types mirroring Go models
    │   ├── App.tsx                   # Router, AuthContext provider, nav bar
    │   └── main.tsx
    ├── vercel.json                   # SPA fallback rewrite rule
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
| `password_hash` | `TEXT` | bcrypt, never returned in API responses |
| `role` | `TEXT` | `submitter` \| `reviewer` \| `admin` |
| `created_at` | `TIMESTAMPTZ` | |

### `submissions`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `users.id` |
| `title` | `TEXT` | |
| `content` | `TEXT` | |
| `state` | `TEXT` | `DRAFT` \| `SUBMITTED` \| `UNDER_REVIEW` \| `APPROVED` \| `REJECTED` |
| `created_at` | `TIMESTAMPTZ` | |
| `updated_at` | `TIMESTAMPTZ` | Auto-updated by DB trigger |

### `submission_events` (append-only audit trail)

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | PK |
| `submission_id` | `UUID` | FK → `submissions.id` |
| `actor_id` | `UUID` | FK → `users.id` (who triggered the action) |
| `action` | `TEXT` | e.g. `submit`, `approve` |
| `from_state` | `TEXT` | State before the transition |
| `to_state` | `TEXT` | State after the transition |
| `comment` | `TEXT` | Optional reviewer note |
| `created_at` | `TIMESTAMPTZ` | |

> Rows in `submission_events` are never updated or deleted. The table is the authoritative record of what happened and when.

---

## API Reference

All routes are prefixed with `/api`. Authenticated routes require the `token` cookie set by login/register.

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

### Submissions

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/submissions` | Required | List; submitters see own, reviewers/admin see all |
| `POST` | `/submissions` | Submitter / Admin | Create a new DRAFT |
| `GET` | `/submissions/:id` | Required | Get single submission |
| `PUT` | `/submissions/:id` | Owner | Update title/content (DRAFT only) |
| `DELETE` | `/submissions/:id` | Owner | Delete (DRAFT only) |
| `GET` | `/submissions/:id/events` | Required | Full audit trail |
| `POST` | `/submissions/:id/actions/:action` | Role-dependent | Trigger a state transition |

**Supported actions**

| Action | Allowed from state | Roles |
|---|---|---|
| `submit` | `DRAFT` | submitter, admin |
| `start_review` | `SUBMITTED` | reviewer, admin |
| `approve` | `UNDER_REVIEW` | reviewer, admin |
| `reject` | `UNDER_REVIEW` | reviewer, admin |
| `resubmit` | `REJECTED` | submitter, admin |

**Action body** (comment is optional)
```json
{ "comment": "Looks good, minor formatting issues." }
```

**Error format**
```json
{ "error": "action \"approve\" not allowed in state \"DRAFT\"" }
```

---

## Local Development

### Prerequisites

- Go 1.23+
- Node.js 20+
- PostgreSQL 14+ (or Docker)

### 1. Start PostgreSQL

If PostgreSQL is already running locally (e.g. installed via Homebrew), skip the Docker step and just create the database:

```bash
createdb openownership
```

Or start a fresh instance with Docker:

```bash
docker run -d --name pg \
  -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=openownership \
  -p 5432:5432 postgres:16-alpine
```

### 2. Run migrations

The migrations are plain SQL files. Apply them in order with `psql`:

```bash
# Native PostgreSQL (uses your system user automatically)
psql openownership \
  -f backend/migrations/001_create_users.sql \
  -f backend/migrations/002_create_submissions.sql \
  -f backend/migrations/003_create_submission_events.sql

# Docker-based PostgreSQL
psql "postgres://dev:dev@localhost:5432/openownership" \
  -f backend/migrations/001_create_users.sql \
  -f backend/migrations/002_create_submissions.sql \
  -f backend/migrations/003_create_submission_events.sql
```

### 3. Start the backend

```bash
cp backend/.env.example backend/.env
# Edit .env with your DATABASE_URL and JWT_SECRET

cd backend
DATABASE_URL="postgres://dev:dev@localhost:5432/openownership?sslmode=disable" \
JWT_SECRET="dev-secret-change-me" \
go run ./server
```

Server starts on `http://localhost:8080`.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts on `http://localhost:5173`. The Vite dev server proxies all `/api` requests to `http://localhost:8080`, so no CORS configuration is needed during development.

Open `http://localhost:5173` and register two accounts — one as `submitter`, one as `reviewer` — to exercise the full workflow.

---

## Running Tests

```bash
cd backend
go test ./...
```

The state machine test suite covers:

- All 5 valid transitions in the happy path
- Every illegal transition (6 cases)
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
2. Add a **new service** pointing to the `backend/` directory; Railway will detect the `Dockerfile`.
3. Set the following environment variables in the Railway service settings:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Provided automatically by the Railway PostgreSQL plugin |
| `JWT_SECRET` | A long random string (e.g. `openssl rand -hex 32`) |
| `FRONTEND_ORIGIN` | Your Vercel deployment URL, e.g. `https://your-app.vercel.app` |

4. Run the migrations against the Railway DB (copy the `DATABASE_URL` from the plugin):

```bash
psql "$DATABASE_URL" \
  -f backend/migrations/001_create_users.sql \
  -f backend/migrations/002_create_submissions.sql \
  -f backend/migrations/003_create_submission_events.sql
```

### Frontend → Vercel

1. Import the repository into Vercel; set **Root Directory** to `frontend`.
2. Build command: `npm run build` — Output directory: `dist`.
3. Add the environment variable:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | Your Railway backend URL, e.g. `https://your-backend.railway.app` |

4. The [`vercel.json`](frontend/vercel.json) rewrite rule ensures React Router handles all client-side navigation.

> **Cookie note**: Because the frontend and backend are on different origins in production, you must set `SameSite=None; Secure` on the auth cookie (update `auth_handler.go`) and ensure the backend is served over HTTPS — Railway provides this automatically.

---

## Design Decisions

### Optimistic concurrency on state transitions

`SubmissionRepo.Transition` issues a single SQL transaction:

```sql
UPDATE submissions SET state = $2
WHERE id = $1 AND state = $3   -- only proceeds if state hasn't changed
RETURNING ...
```

If another request already advanced the state, the `WHERE` clause matches zero rows and the handler returns `409 Conflict`, preventing silent double-transitions.

### State machine as the single source of truth

`workflow.RoleCanAct` and `workflow.Transition` are called in the handler *before* any DB write. This means:

- Invalid transitions are rejected in Go, not by a DB constraint error.
- Adding a new state or action requires a single map entry in `status_management.go`.
- Business rules are easy to unit-test without a database.

### Append-only audit trail

`submission_events` has no `UPDATE` or `DELETE` paths in the repository layer. Every state change writes a new row with the full `(from_state, to_state, actor_id, comment, timestamp)`. This gives a complete, tamper-evident history.

### httpOnly cookies over Authorization headers

Storing the JWT in an `httpOnly` cookie means JavaScript cannot read or exfiltrate the token, eliminating the most common XSS attack vector against SPAs. The trade-off is that CORS must be configured carefully (`AllowCredentials: true`, explicit origin allowlist).
