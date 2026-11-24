# LeadLedger CRM — Client Lead Management System

A full-stack **Client Lead Management System (Mini CRM)** built with React, TypeScript, Tailwind CSS, Node.js, Express, and SQLite. Designed for agencies, freelancers, and startups to capture incoming website inquiries, track lead progression across sales pipeline stages, manage client contacts, log follow-up notes and tasks, and monitor conversion analytics inside an authenticated workspace.

---

## Screenshots

### Dashboard Overview & Analytics
![Dashboard Overview](docs/screenshots/dashboard.png)

### Lead Management Table & Filters
![Lead Management](docs/screenshots/leads.png)

### Lead Detail Drawer (Status, Conversion, Tasks & Notes)
![Lead Detail Drawer](docs/screenshots/lead-drawer.png)

### Sales Pipeline (Kanban Board)
![Sales Pipeline](docs/screenshots/pipeline.png)

### Contacts Directory & Follow-up Notes
![Contacts and Notes](docs/screenshots/contacts-notes.png)

### Follow-up Tasks
![Follow-up Tasks](docs/screenshots/follow-up-tasks.png)

### Public Website Contact Form (`/inquiry`)
![Public Contact Form](docs/screenshots/public-inquiry.png)

### Authentication & Protected Workspace (`/login`)
![Sign In](docs/screenshots/login.png)

---

## Key Features

### Authentication & Protected Routes
- **User Registration & Sign-In**: Account creation (`/register`) and login (`/login`) with salted `crypto.scrypt` password hashing and timing-safe verification.
- **Session & Route Protection**: HMAC-SHA256 signed session tokens held in React memory (`Authorization: Bearer`) paired with `HttpOnly` session cookies and same-origin checks for mutations.
- **Protected Workspace**: Unauthenticated access to `/dashboard`, `/leads`, `/pipeline`, `/contacts`, or `/tasks` automatically redirects to `/login`.
- **Demo Workspace**: One-click **Launch Demo Workspace** creates an isolated sample workspace seeded with leads, contacts, notes, and follow-up tasks.

### Public Website Contact Form (`/inquiry`)
- Client-facing inquiry form (`POST /api/public/leads`) that captures prospective client name, email, phone, company, estimated budget, and project scope directly into the CRM database as a `New` lead with an attached initial note.

### Lead Management & Sales Pipeline (`/leads`, `/pipeline`)
- **Full Lead CRUD**: Create, inspect, edit, and delete leads with deal value, source, priority, status, and created/updated timestamps.
- **Search, Filtering & Sorting**: Real-time search across name, email, company, phone, and source; status filter tabs (`New`, `Contacted`, `Qualified`, `Proposal`, `Converted`, `Lost`); source filter; and multi-field sorting.
- **Table & Card Views + CSV Export**: Toggle between compact data table and card grid layouts, and export filtered leads to RFC 4180 CSV with formula-injection protection.
- **Kanban Pipeline Board**: Drag-and-drop deal cards between pipeline stages (with accessible stage dropdowns on every card) and live per-stage count and revenue totals.
- **Lead-to-Client Conversion**: One-click **Convert to Client** in the lead detail drawer marks the lead `Converted` and creates a linked record in Contacts.

### Contacts, Follow-up Notes & Tasks (`/contacts`, `/tasks`)
- **Client Contact Directory**: Searchable directory storing name, email, phone, company, role title, and location.
- **Categorized Notes**: Log notes (`General`, `Call`, `Meeting`, `Proposal`, `Follow-up`) linked to specific leads or contacts, filterable by category and search query.
- **Follow-up Task Tracker**: Schedule tasks with due dates, priority levels (`High`, `Medium`, `Low`), completion toggles, automatic `Overdue` detection, and status/priority filters.

### Dashboard Analytics (`/dashboard`)
- **KPI Summary Strip**: Total leads (active vs. converted), conversion rate, active pipeline value vs. converted revenue, and open/overdue follow-up task counts.
- **Visual Breakdowns**: Pipeline stage distribution and lead acquisition source performance bars with deal counts and values.
- **Action Queues**: Recent incoming leads and upcoming/overdue follow-up checklist.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, React Router (`react-router-dom`), Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js (v22+), Express (`server.ts`), Vite middleware in development
- **Database**: SQLite via Node.js built-in `node:sqlite` (`DatabaseSync`) stored in `data/crm.db`
- **Testing**: Node built-in test runner (`node:test`) with `tsx`

---

## Project Structure

```text
├── server.ts                  # Express server, API routes, and Vite/static serving
├── server/
│   ├── auth.ts                # Scrypt password hashing, HMAC tokens, cookies, auth middleware
│   └── db.ts                  # SQLite schema initialization and workspace sample seeding
├── src/
│   ├── App.tsx                # Application routes and protected workspace layout
│   ├── main.tsx               # React entry point
│   ├── index.css              # Tailwind CSS v4 setup and typography tokens
│   ├── types/
│   │   └── crm.ts             # Shared TypeScript interfaces and status/source constants
│   ├── utils/
│   │   ├── crmLogic.ts        # Pure filtering, sorting, analytics, CSV, and validation logic
│   │   └── crmLogic.test.ts   # Unit tests for core CRM logic
│   ├── context/
│   │   ├── AuthContext.tsx    # In-memory Bearer token and session hydration
│   │   └── CrmContext.tsx     # Leads, contacts, notes, and tasks state & API actions
│   ├── components/
│   │   ├── AppShell.tsx       # Sidebar navigation, breadcrumb header, mobile drawer
│   │   ├── ProtectedRoute.tsx # Route guard redirecting unauthenticated users
│   │   ├── LeadDrawer.tsx     # Slide-over lead details, conversion, notes, and tasks
│   │   ├── LeadModal.tsx      # Create/edit lead dialog with validation
│   │   ├── ContactModal.tsx   # Create/edit contact dialog
│   │   └── StatusLabel.tsx    # Semantic status and priority labels
│   └── pages/
│       ├── LoginPage.tsx      # Sign-in page + Demo Workspace launcher
│       ├── RegisterPage.tsx   # Workspace registration page
│       ├── PublicInquiryPage.tsx # Public website contact form
│       ├── DashboardPage.tsx  # KPI overview, stage/source analytics, action queues
│       ├── LeadsPage.tsx      # Lead table/cards, search, filters, CSV export
│       ├── PipelinePage.tsx   # 6-stage Kanban pipeline board
│       ├── ContactsPage.tsx   # Contacts directory and follow-up notes board
│       └── TasksPage.tsx      # Follow-up task manager
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites
- **Node.js v22+** (required for built-in `node:sqlite` support)
- **npm** (or `bun`)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration (Optional)
The application runs out of the box in development. For production deployments, configure a persistent `SESSION_SECRET` environment variable (at least 16 characters) so session tokens remain valid across server restarts:

```env
PORT=3000
SESSION_SECRET=replace-with-a-long-random-secret
```

### 3. Run in Development
Starts the Express API server with Vite HMR/middleware on `http://localhost:3000`:
```bash
npm run dev
```

### 4. Build & Run in Production
```bash
npm run build
NODE_ENV=production npm start
```

---

## Running Tests & Checks

### Unit Tests
Runs deterministic tests for lead filtering, sorting, analytics math, overdue detection, input validation, and CSV escaping:
```bash
npx --yes tsx --test src/utils/crmLogic.test.ts
```

### Type Check
```bash
npm run lint
```

---

## API Overview

### Public & Auth Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/auth/session` | Restore current session from `HttpOnly` cookie or Bearer token |
| `POST` | `/api/auth/register` | Register a new workspace user (hashes password with `scrypt`) |
| `POST` | `/api/auth/login` | Authenticate user and issue session token/cookie |
| `POST` | `/api/auth/demo` | Start or open the isolated demo workspace |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/public/workspace` | Fetch public workspace display name for the contact form |
| `POST` | `/api/public/leads` | Submit a website inquiry as a `new` lead + initial note |

### Protected CRM Endpoints (Require Authenticated Session)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET`, `POST` | `/api/leads` | List all workspace leads or create a new lead |
| `PATCH`, `DELETE` | `/api/leads/:id` | Update lead details/status or delete a lead |
| `POST` | `/api/leads/:id/convert` | Mark lead `converted` and create/link a contact record |
| `GET`, `POST` | `/api/contacts` | List or create client contacts |
| `PATCH`, `DELETE` | `/api/contacts/:id` | Update or delete a contact |
| `GET`, `POST` | `/api/notes` | List or create follow-up notes |
| `DELETE` | `/api/notes/:id` | Delete a note |
| `GET`, `POST` | `/api/tasks` | List or create follow-up tasks |
| `PATCH`, `DELETE` | `/api/tasks/:id` | Update/toggle completion or delete a task |
