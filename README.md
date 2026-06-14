# HueDora Connect — API Server

Node.js + Express + MongoDB backend for the Healthcare Camp Operations platform.

## Tech stack

- **Runtime:** Node.js (ES modules)
- **Framework:** Express 4
- **Database:** MongoDB via Mongoose
- **Auth:** JWT access + refresh tokens, bcrypt passwords
- **Ingestion:** WhatsApp Cloud API, email (IMAP poll + webhooks), Excel import
- **Other:** Helmet, CORS, rate limiting, Multer (PDF uploads), XLSX parsing

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Optional: Meta WhatsApp app, IMAP/SMTP mailbox — see [WHATSAPP_SETUP.md](../WHATSAPP_SETUP.md) and [EMAIL_SETUP.md](../EMAIL_SETUP.md)

## Quick start

```bash
cd server
cp .env.example .env
# Edit .env — at minimum set MONGODB_URI and JWT secrets
npm install
npm run seed    # optional: demo users, clients, programs, sample camps
npm run dev     # http://localhost:5000
```

Health check: `GET /api/health`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with file watch (`node --watch`) |
| `npm start` | Start API (production) |
| `npm run seed` | Reset and seed demo data (destructive) |

## Environment variables

Copy `.env.example` to `.env`. Key settings:

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | Token lifetimes |
| `CLIENT_URL` | Frontend origin for CORS (e.g. `http://localhost:5173`) |
| `DEFAULT_USER_PASSWORD` | Password for auto-provisioned default users |
| `PROGRAM_DOCUMENTS_DIR` | Local folder for Client Master PDFs |
| `PUBLIC_URL` | Public base URL for webhooks (ngrok in dev) |

WhatsApp and email variables are documented in `.env.example` and the setup guides in the repo root.

## Project structure

```
server/src/
├── index.js                 # App bootstrap, middleware, route mounting
├── config/
│   ├── constants.js         # Roles, camp statuses, permissions, transitions
│   ├── campNames.js         # Valid camp name options
│   └── db.js
├── controllers/             # Route handlers
├── middleware/              # auth, upload, trim, error handling
├── models/                  # Mongoose schemas
├── routes/                  # Express routers
├── services/                # Ingestion, audit, pollers, integrity checks
└── utils/                   # Parsers, validation, helpers
```

## Roles & permissions

| Role | Summary |
|------|---------|
| `super_admin` | Full access (`*`) |
| `admin` | Camps, clients, client master, import, users |
| `operations_executive` | Create/update/execute camps; client master programs (no approve/cancel/users) |
| `reviewer` | View + edit pending camps + approve pending camps only |
| `read_only` | View dashboard, camps, clients, client master |

Permission checks use `ROLE_PERMISSIONS` in `src/config/constants.js` and the `authorize()` middleware.

## Camp lifecycle

Statuses: `pending_review` → `approved` → `executed` (or `rejected` / `cancelled`).

| From | Allowed transitions |
|------|---------------------|
| `pending_review` | `approved`, `rejected` |
| `approved` | `executed`, `cancelled` |
| `rejected` | `pending_review` (re-submit) |

**Cancel** requires `cancelledBy` (`brand` | `khw`) and a remark. Approval validates client master program configuration via `campApprovalValidation.js`.

Sources: `whatsapp`, `email`, `excel`, `dashboard`, `api`.

## API routes

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/signup` | Request account (pending admin approval) |
| POST | `/login` | Login |
| POST | `/forgot-password` | Send reset OTP email |
| POST | `/reset-password` | Reset password with OTP |
| POST | `/refresh` | Refresh access token |
| GET | `/me` | Current user |
| POST | `/logout` | Logout |

### Camps — `/api/camps` (authenticated)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/` | `camps:read` | List with search, filters, pagination |
| GET | `/:id` | `camps:read` | Get one camp |
| POST | `/` | `camps:create` / `camps:update` | Create camp |
| PUT | `/:id` | `camps:update` / `camps:approve` / `camps:edit-pending` | Update camp |
| POST | `/:id/submit-review` | `camps:update` | Re-submit rejected camp |
| POST | `/:id/approve` | `camps:approve` / `camps:review` | Approve |
| POST | `/:id/reject` | `camps:approve` | Reject |
| POST | `/:id/cancel` | `camps:cancel` / `camps:approve` | Cancel with remark |
| POST | `/:id/execute` | `camps:execute` | Mark executed |
| DELETE | `/:id` | `camps:update` / `camps:approve` | Soft delete (archive) |
| POST | `/bulk-action` | varies | Bulk approve/reject/execute/delete |

### Dashboard — `/api/dashboard`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Widget counts, charts, hierarchy |
| GET | `/clients` | Client list for dashboard filters |

### Clients — `/api/clients`

CRUD for brand/client records (admin-managed companies).

### Client Master — `/api/client-masters`

Program configuration per client: division, camp name, pricing, SPOC, PDF document upload.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/by-client/:clientId/divisions` | Used by camp edit form |
| GET/POST | `/:id/document` | View / upload program PDF |

### Users — `/api/users` (admin only)

List, create, update, approve/reject signups, activate/deactivate.

### Import — `/api/import`

Excel parse, preview, confirm, template CRUD, sample download.

### Ingestion

| Prefix | Description |
|--------|-------------|
| `/api/ingest/whatsapp` | Meta webhook + format docs |
| `/api/ingest/email` | Email webhook, IMAP poll, format docs |

See root [README.md](../README.md) for WhatsApp/email message formats and file-level guides.

## Demo users (after `npm run seed`)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@huedoraconnect.com | admin123 |
| Admin | admin@huedoraconnect.com | admin123 |
| Operations Executive | ops@huedoraconnect.com | admin123 |
| Reviewer | reviewer@huedoraconnect.com | admin123 |
| Read Only | viewer@huedoraconnect.com | admin123 |

Service accounts: `whatsapp-bot@huedoraconnect.com`, `email-bot@huedoraconnect.com`

## Startup safeguards

On boot the server runs:

- Camp index ensure
- Data integrity checks (invalid camp names, legacy status migration)
- Program documents directory ensure
- Service user + default user provisioning
- Email IMAP poller (when enabled)

Global `unhandledRejection` / `uncaughtException` handlers are registered in `utils/processSafety.js`.

## Related docs

- [../README.md](../README.md) — monorepo overview
- [../WHATSAPP_SETUP.md](../WHATSAPP_SETUP.md)
- [../EMAIL_SETUP.md](../EMAIL_SETUP.md)
