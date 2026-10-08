# JanSahay — Phase 0 Report: Baseline Bootstrap & Verification

**Project:** JanSahay (AI-assisted grievance resolution layer for CPGRAMS)  
**Phase:** Phase 0 — Baseline Scaffold, Mock CPGRAMS Gateway, Synthetic Seed Data  
**Status:** Completed & Verified  

---

## 1. Files Created (Project Tree)

```text
c:/Users/ASUS/JanSahay repo/JanSahay---Intelligent-Civic-Complaint-Incident-Resolution-System/
├── .agents/
│   └── rules/
│       └── naming-conventions.md
├── .env.example
├── .gitignore
├── README.md
├── package.json (root orchestration)
├── ai/
│   ├── datasets/.gitkeep
│   ├── evaluation/.gitkeep
│   └── prompts/.gitkeep
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   ├── app.config.js
│   │   │   └── sla.json
│   │   ├── controllers/
│   │   │   ├── complaint.controller.js
│   │   │   ├── department.controller.js
│   │   │   └── health.controller.js
│   │   ├── middleware/
│   │   │   ├── error.middleware.js
│   │   │   └── validate.middleware.js
│   │   ├── repositories/
│   │   │   ├── complaint.repository.js
│   │   │   └── department.repository.js
│   │   ├── routes/
│   │   │   ├── complaint.routes.js
│   │   │   ├── department.routes.js
│   │   │   ├── health.routes.js
│   │   │   └── index.js
│   │   └── services/
│   │       ├── complaint.service.js
│   │       └── department.service.js
│   └── tests/
│       └── api.test.js
├── data/
│   ├── complaints.json (25 synthetic cases)
│   ├── departments.json (8 administrative units)
│   ├── incidents.json (parent composite incident)
│   ├── officers.json (8 nodal officers)
│   ├── status_history.json (audit timeline events)
│   └── subtasks.json (cross-department actions)
├── docs/
│   ├── architecture.md
│   └── phase0-report.md
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       ├── main.jsx
│       ├── api/
│       │   └── client.js
│       ├── components/
│       │   └── Layout.jsx
│       └── pages/
│           ├── CitizenDashboard.jsx
│           ├── ComplaintDetail.jsx
│           ├── IncidentPage.jsx
│           ├── NeglectRadarPage.jsx
│           ├── OfficerDashboard.jsx
│           └── StatusTranslatorPage.jsx
├── knowledge/
│   ├── departments/.gitkeep
│   └── government-guidelines/.gitkeep
└── mock-cpgrams/
    ├── index.js (router & MockCpgramsClient)
    └── package.json
```

---

## 2. Features Implemented

1. **Architecture & Repository Pattern Separation**:
   - Clean Controller &rarr; Service &rarr; Repository design in Express (ES modules).
   - Data access strictly abstracted via asynchronous repositories (`complaint.repository.js`, `department.repository.js`) backed by JSON files, ensuring seamless drop-in transition to MongoDB in Phase 7 without changing controllers.

2. **Configurable SLA Engine**:
   - External SLA settings loaded from `src/config/sla.json` and `src/config/app.config.js`.
   - Dynamic metrics calculated on grievance fetch: `ageDays`, `daysSinceUpdate`, `isSlaBreached`, `isStale`, `isReassignmentLoop`. Zero hardcoded deadlines.

3. **Isolated Mock CPGRAMS Module**:
   - Decoupled `jansahay-mock-cpgrams` providing mock CPGRAMS endpoints (`GET /complaints`, `GET /complaints/:id`, `PATCH /complaints/:id/status`).
   - Exported `MockCpgramsClient` adapter ready for official API swap.

4. **Production Security Foundations**:
   - Helmet HTTP protection headers.
   - Strict CORS configuration whitelisting configured frontend origin.
   - IP rate limiting via `express-rate-limit`.
   - Zod schema validation middleware on route parameters and queries.
   - Centralized JSON error and 404 handlers.

5. **Frontend Experience & Design System**:
   - Responsive government-style high-contrast layout with persistent prototype warning banner.
   - Citizen / Officer active role toggle.
   - Live complaints table with search, category filtering, and status badges.
   - Officer Triage Cockpit displaying KPI cards (Total Cases, Critical Cases, Reassignment Loops, Stale Cases).
   - Deep-linkable Complaint Detail page with SLA diagnostics and evidence citations.
   - Routing for Phase 2–4 features (Parent Incident Clustering, Neglect Radar, Status Translator).
   - Mandatory footer disclaimer displayed on all views.

---

## 3. APIs Added

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck returning `{ status: "ok", version, time, service, description }` |
| `GET` | `/api/complaints` | Returns list of complaints with calculated SLA metrics and optional filters |
| `GET` | `/api/complaints/:id` | Returns single grievance with full metadata and SLA diagnostics |
| `GET` | `/api/departments` | Returns list of administrative departments with official contact info |
| `GET` | `/api/mock-cpgrams/complaints` | Mock CPGRAMS gateway complaint listing |
| `GET` | `/api/mock-cpgrams/complaints/:id` | Mock CPGRAMS gateway single complaint lookup |
| `PATCH`| `/api/mock-cpgrams/complaints/:id/status`| Mock CPGRAMS gateway status update |

---

## 4. Data Model Summary

All data is strictly synthetic with `"synthetic": true`. No PII, Aadhaar numbers, real names, or real phone numbers are stored.

### Complaint Schema (`data/complaints.json`)
- `id` (string): e.g. `"CPG-2026-00101"`
- `text` (string): Grievance description
- `language` (string): e.g. `"en"`
- `category` (string): e.g. `"pension"`, `"scholarship"`, `"roads"`, `"electricity"`, `"water"`, `"ration"`, `"healthcare"`, `"flood relief"`
- `department` (string): Reference ID e.g. `"DEPT_PENSION"`
- `priority` (string): `"LOW"` | `"MEDIUM"` | `"HIGH"` | `"CRITICAL"`
- `status` (string): `"PENDING"` | `"IN_PROGRESS"` | `"ESCALATED"` | `"RESOLVED"`
- `officialStatus` (string): CPGRAMS official status (e.g. `"RECEIVED"`, `"UNDER_PROCESS"`, `"TRANSFERRED"`, `"PENDING_CLARIFICATION"`, `"INTERIM_REPLY"`, `"FORWARDED_TO_SUBORDINATE_OFFICE"`, `"RESOLVED"`, `"CLOSED"`)
- `createdAt` (ISO string): Grievance registration date
- `lastUpdated` (ISO string): Last administrative action date
- `reassignments` (integer): Handoff count across departments
- `citizenReminders` (integer): Reminder count lodged by citizen
- `evidence` (array of strings): Reference documents/images
- `synthetic` (boolean): `true`

---

## 5. Tests Run + Results

### Backend Automated Unit & Integration Tests
Command: `npm --prefix backend test` (Node.js test runner + Supertest)
```text
▶ JanSahay Baseline Backend API Tests
  ✔ GET /api/health should return 200 with status ok and version (64.82ms)
  ✔ GET /api/complaints should return 200 with synthetic complaint list (17.33ms)
  ✔ GET /api/complaints/:id with invalid id should return 404 (10.51ms)
✔ JanSahay Baseline Backend API Tests (94.70ms)
ℹ tests 3
ℹ suites 1
ℹ pass 3
ℹ fail 0
```

### Live Endpoint Verifications via cURL
1. `GET /api/health` &rarr; `HTTP 200 OK`
   `{"status":"ok","version":"1.0.0","time":"2026-10-08T19:30:15.953Z","service":"JanSahay","description":"JanSahay: AI-assisted grievance resolution layer for CPGRAMS."}`
2. `GET /api/complaints` &rarr; `HTTP 200 OK` (Returned 25 synthetic cases with SLA calculations)
3. `GET /api/complaints/CPG-2026-00101` &rarr; `HTTP 200 OK`
4. `GET /api/departments` &rarr; `HTTP 200 OK` (Returned 8 departments)
5. `GET /api/mock-cpgrams/complaints/CPG-2026-00101` &rarr; `HTTP 200 OK`

### Frontend Production Build
Command: `npm --prefix frontend run build` (Vite 6)
```text
vite v6.4.4 building for production...
✓ 1589 modules transformed.
dist/index.html                   0.65 kB │ gzip:  0.41 kB
dist/assets/index-3hbQ6j__.css   18.36 kB │ gzip:  4.16 kB
dist/assets/index-ZA-WZbAd.js   207.21 kB │ gzip: 62.66 kB
✓ built in 4.33s
```

---

## 6. Known Issues

1. **Local Playwright CDN Driver Download (Environment Specific)**:
   - When attempting automated browser session recording, Playwright encountered an upstream Microsoft Azure Edge CDN 404 error fetching `playwright-1.57.0-win32_x64.zip`.
   - The Vite development server and production builds serve cleanly on `http://localhost:5173/`, verified via curl and Vite bundler compilation.
2. **ExecutionPolicy for PowerShell Scripts**:
   - Direct execution of `npm` or `npx` in Windows PowerShell can encounter `PSSecurityException` if execution policies restrict `.ps1` wrapper files. Use `npm.cmd` / `npx.cmd` in Windows terminal environments.

---

## 7. How to Run (Exact Commands)

### Install All Dependencies:
```bash
npm run install:all
```
*(Or in Windows: `npm.cmd run install:all`)*

### Start Backend API:
```bash
cd backend
npm run dev
# Server accessible at http://localhost:5000
# Healthcheck: http://localhost:5000/api/health
```

### Start Frontend Application:
```bash
cd frontend
npm run dev
# Web application accessible at http://localhost:5173
```

### Run Automated Tests:
```bash
cd backend
npm test
```

---

## 8. Phase 1 Plan

**Phase 1 — Intelligent Intake & Multi-Issue Classification**:
1. Implement AI prompt templates and classification pipeline (`/ai/prompts`, `/ai/evaluation`).
2. Build grievance intake endpoint `POST /api/complaints` with intelligent category extraction, department routing, and priority rating.
3. Add multi-issue grievance decomposition (e.g., separating simultaneous power, road, and water issues lodged within a single complaint).
4. Provide interactive citizen submission form in `CitizenDashboard` with live classification suggestions and automated department mapping.
