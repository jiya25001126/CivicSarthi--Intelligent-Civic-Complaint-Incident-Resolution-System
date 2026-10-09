# CivicSarthi — Phase 1 Report: Core Platform Implementation

**Project:** CivicSarthi (*CivicSarthi: Intelligent decision-support and civic incident resolution layer for grievance redressal systems.*)  
**Tagline:** *"From Complaint to Resolution."*  
**Notice:** *CivicSarthi is an independent civic resolution platform and is not affiliated with or endorsed by DARPG/CPGRAMS.*  
**Status:** Completed & Fully Verified  

---

## 1. Features Implemented

1. **Dual Portal User Interface**:
   - **Public Landing Page**: Clean GovTech hero section, platform mission overview, feature pillars, live aggregated metrics, and clear prototype notice.
   - **Citizen Portal**:
     - *Citizen Dashboard*: Live KPI cards (Total registered, in progress, resolved, critical), quick links, and recent cases table.
     - *Submit Complaint Page*: Working grievance registration form with real-time field validation, category selection, Indian state/district selection, locality, preferred language, provisional department assignment, and optional evidence name.
     - *Confirmation View*: Instant display of generated reference number (`CS-2026-XXXX`), initial status `SUBMITTED`, default priority `MEDIUM`, and direct navigation to track progress.
     - *My Complaints Page*: Full table with keyword search, category filtering, status filtering, and sorting.
     - *Track Complaint Page*: Dedicated tracking search bar and visual audit timeline mapping every event in `statusHistory` with timestamps, actor roles, and official remarks.
     - *Complaint Detail View*: Complete complaint narrative, jurisdiction metadata, SLA compliance diagnostic, evidence citations, and timeline.
   - **Officer / Admin Portal**:
     - *Officer Cockpit*: Live KPI cards (Total active queue, critical priority, reassignment loops, stale cases), and urgent attention queue.
     - *Complaint Management Desk*: Multi-criteria triage table with search, department filters, status filters, priority filters, and sorting.
     - *Officer Review & Decision Desk*: Form controls to execute valid status transitions, reassign departments (with reassignment count incrementation), and log confidential internal officer review notes.
     - *Department Management Directory*: Catalog of 11 demo departments displaying IDs, codes, names, descriptions, active status badges, target SLAs, contact emails, and active complaint caseloads.
   - **Role Switcher / Demo Access Mode**: Clearly labelled role switcher between Public, Citizen, and Officer modes with explicit documentation that this is demo access, not production authentication.

2. **Backend API & Domain Logic**:
   - Standardized REST API under `/api/v1` with backward-compatible aliases under `/api`.
   - Guaranteed unique reference number generator: `CS-2026-XXXX`.
   - Strict status transition governance matrix enforcing allowed lifecycle paths and returning `400 Bad Request` with allowed options when an invalid jump is attempted.
   - Department validation preventing invalid department IDs during complaint submission or reassignment.
   - Confidential internal officer review notes saved separately from citizen-facing history.
   - Live KPI aggregation endpoint (`GET /api/v1/complaints/stats`) calculating real totals dynamically.

3. **Data & Persistence Strategy**:
   - Mongoose database configuration with graceful fallback to persistent JSON files when `MONGODB_URI` is not supplied.
   - Deterministic demo seed script (`npm run seed`) creating 18 rich synthetic complaints, 11 departments, and 45 timeline history events.

---

## 2. Important Files Created or Modified

### Modified Files:
- `backend/package.json`: Added `mongoose`, added `seed` script.
- `backend/src/server.js`: Integrated database connection on startup.
- `backend/src/controllers/complaint.controller.js`: Implemented Phase 1 endpoints (stats, notes, department reassignment).
- `backend/src/controllers/health.controller.js`: Added database status and environment reporting.
- `backend/src/repositories/complaint.repository.js`: Added reference number generation, search, filters, pagination, transition checks, department reassignment, and officer notes.
- `backend/src/repositories/department.repository.js`: Added `exists()` validation check.
- `backend/src/routes/complaint.routes.js`: Added Zod schemas for Phase 1 endpoints.
- `backend/src/routes/index.js`: Mounted `/api/v1` routes and preserved backward-compatible `/api` aliases.
- `backend/src/services/complaint.service.js`: Added summary KPI aggregation and Phase 1 service delegates.
- `backend/tests/api.test.js`: Expanded test suite to 12 automated unit and integration tests.
- `data/complaints.json`: Seeded with 18 structured demo complaints with full Phase 1 schema.
- `data/departments.json`: Seeded with 11 demo administrative departments.
- `data/status_history.json`: Seeded with 45 timeline history audit records.
- `frontend/package.json`: Added `axios`.
- `frontend/src/App.jsx`: Added routes for Landing, Submit, My Complaints, Track, Officer Management, and Departments.
- `frontend/src/api/client.js`: Converted to Axios with interceptors and full Phase 1 endpoint methods.
- `frontend/src/components/Layout.jsx`: Added demo access mode switcher and portal-specific navigation.
- `frontend/src/pages/CitizenDashboard.jsx`: Updated with live KPIs, recent table, and quick actions.
- `frontend/src/pages/OfficerDashboard.jsx`: Updated with live KPIs, attention queue, and triage links.
- `package.json` (root): Added `seed` script.

### Created Files:
- `backend/src/config/database.js`: MongoDB connection module with JSON fallback.
- `backend/src/constants/status.constants.js`: Status enums, priority enums, categories, and transition matrix.
- `backend/src/scripts/seed.js`: Deterministic demo database seeder script.
- `frontend/src/components/StatusBadge.jsx`: Reusable chip badges for statuses and priorities.
- `frontend/src/pages/LandingPage.jsx`: Public GovTech landing page.
- `frontend/src/pages/SubmitComplaintPage.jsx`: Validated citizen grievance lodging form.
- `frontend/src/pages/MyComplaintsPage.jsx`: Filterable citizen grievance archive.
- `frontend/src/pages/TrackComplaintPage.jsx`: Visual status progression timeline.
- `frontend/src/pages/ComplaintDetailPage.jsx`: Dual-mode complaint review desk.
- `frontend/src/pages/OfficerComplaintManagement.jsx`: Multi-criteria officer triage desk.
- `frontend/src/pages/DepartmentManagementPage.jsx`: Department directory and caseload monitor.
- `docs/phase1-report.md`: This report.

---

## 3. Database Configuration and Demo Seeding Instructions

### Database Fallback Strategy:
- **Default (No MongoDB needed)**: If `MONGODB_URI` in `.env` is omitted or empty, JanSahay runs automatically with persistent local JSON files (`data/complaints.json`, `data/departments.json`, `data/status_history.json`).
- **MongoDB (Optional)**: If you provide `MONGODB_URI=mongodb://localhost:27017/jansahay` in `.env`, the server connects via Mongoose.

### Seeding Command:
To seed or reset the demonstration dataset at any time:
```bash
# From repository root:
npm.cmd run seed

# Or inside backend:
cd backend
npm.cmd run seed
```
This writes 11 active departments, 18 diverse complaints across all categories and statuses, and 45 history events.

---

## 4. Exact Commands to Start Frontend and Backend

### 1. Install Dependencies:
```bash
# From repository root:
npm.cmd run install:all
```

### 2. Start Backend API:
```bash
cd backend
npm.cmd run dev
# Server running at http://localhost:5000
# Healthcheck: http://localhost:5000/api/v1/health
```

### 3. Start Frontend Portal:
```bash
cd frontend
npm.cmd run dev
# Web application accessible at http://localhost:5173
```

### 4. Run Automated Tests:
```bash
cd backend
npm.cmd test
```

---

## 5. Local URLs

| Interface | URL | Purpose |
| :--- | :--- | :--- |
| **Public Landing Page** | `http://localhost:5173/` | Platform mission, overview, role selector |
| **Citizen Dashboard** | `http://localhost:5173/citizen` | Citizen overview, KPIs, recent filings |
| **Submit Grievance** | `http://localhost:5173/citizen/submit` | Working complaint lodging form |
| **My Complaints** | `http://localhost:5173/citizen/complaints` | Citizen complaint list & search |
| **Track Complaint** | `http://localhost:5173/citizen/track` | Reference number tracker & audit timeline |
| **Officer Cockpit** | `http://localhost:5173/officer` | Officer caseload overview & metrics |
| **Officer Triage Desk** | `http://localhost:5173/officer/complaints` | Multi-criteria complaint management |
| **Department Directory** | `http://localhost:5173/officer/departments` | Active departments & caseload stats |
| **Backend Healthcheck** | `http://localhost:5000/api/v1/health` | Service & database status endpoint |
| **Backend API Root** | `http://localhost:5000/api/v1/complaints` | Grievance REST endpoint |

---

## 6. API Endpoints Implemented

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | System health, version, service name, database fallback status |
| `GET` | `/api/v1/departments` | List of all 11 active demonstration departments |
| `GET` | `/api/v1/complaints` | List complaints (filters: `search`, `category`, `departmentId`, `status`, `priority`, `sort`, `page`, `limit`) |
| `GET` | `/api/v1/complaints/stats` | Aggregated real-time metrics (total, submitted, inProgress, resolved, critical, loops, stale) |
| `GET` | `/api/v1/complaints/:id` | Lookup complaint by ID or Reference Number |
| `POST` | `/api/v1/complaints` | Submit complaint (validates required fields, generates `CS-2026-XXXX`, sets `SUBMITTED`, `MEDIUM`) |
| `PATCH`| `/api/v1/complaints/:id/status` | Update status (validates transition against governance matrix, logs history) |
| `PATCH`| `/api/v1/complaints/:id/department` | Reassign department (validates department exists, increments handoffs, logs history) |
| `POST` | `/api/v1/complaints/:id/notes` | Add confidential internal officer review note |
| `GET` | `/api/v1/complaints/:id/history` | Retrieve full timeline audit history for complaint |
| `GET` | `/api/health`, `/api/complaints`, etc. | Backward-compatible aliases for Phase 0 compatibility |

---

## 7. Tests & Builds Actually Run and Results

### 1. Automated Backend Unit & Integration Tests:
Ran command: `npm.cmd test` in `backend`  
Result: **12 tests passed, 0 failed** (Duration: 1.9s)
```text
▶ JanSahay Phase 1 Backend API Tests
  ✔ GET /api/v1/health & GET /api/health should return 200 with status ok and service metadata
  ✔ GET /api/v1/departments should return demo departments list
  ✔ GET /api/v1/complaints should return complaints list enriched with SLA metrics
  ✔ GET /api/v1/complaints/stats should calculate real KPI metrics
  ✔ GET /api/v1/complaints/:id with non-existent id should return 404
  ✔ POST /api/v1/complaints should return 400 validation error if required fields are missing
  ✔ POST /api/v1/complaints should create complaint with reference number, status SUBMITTED, priority MEDIUM
  ✔ PATCH /api/v1/complaints/:id/status should fail (400) on invalid status transition
  ✔ PATCH /api/v1/complaints/:id/status should succeed (200) on valid status transition
  ✔ PATCH /api/v1/complaints/:id/department should reject invalid department and accept valid department
  ✔ POST /api/v1/complaints/:id/notes should append internal officer note
  ✔ GET /api/v1/complaints/:id/history should return status audit timeline
✔ JanSahay Phase 1 Backend API Tests (12 pass, 0 fail)
```

### 2. Frontend Production Build:
Ran command: `npm.cmd run build` in `frontend` (Vite 6)  
Result: **Build successful, 0 errors** (Duration: 4.62s)
```text
vite v6.4.4 building for production...
✓ 1651 modules transformed.
dist/index.html                   0.65 kB │ gzip:  0.41 kB
dist/assets/index-Bbgt9E-j.css   26.82 kB │ gzip:  5.31 kB
dist/assets/index-Bcb06hWS.js   326.67 kB │ gzip: 94.03 kB
✓ built in 4.62s
```

---

## 8. Known Issues or Incomplete Items
- None for Phase 1 scope.
- Playwright automated browser recording remains limited on this Windows host due to the upstream Azure Edge CDN 404 issue downloading `playwright-1.57.0-win32_x64.zip`. All frontend assets build cleanly and verified via curl and Vite bundler compilation.

---

## 9. Manual Steps Required
None. All seed files and dependencies are pre-configured. To launch:
1. Run `npm.cmd run seed` if you wish to reset demo data at any time.
2. Run `npm.cmd run dev` in `backend` and `frontend`.

---

## 10. Confirmation of Scope Boundaries
- [x] **LLM-based complaint analysis**: NOT implemented in Phase 1 (reserved for later phases).
- [x] **AI priority prediction**: NOT implemented (provisional `MEDIUM` placeholder used as required).
- [x] **Duplicate complaint detection**: NOT implemented.
- [x] **Parent Incident Clustering + Department Subtasks**: Feature placeholder preview preserved, NOT implemented.
- [x] **Neglect Radar**: Feature placeholder preview preserved, NOT implemented.
- [x] **Status Translator AI**: Feature placeholder preview preserved, NOT implemented.
- [x] **Production CPGRAMS integration**: NOT implemented (isolated mock boundary maintained).
- [x] **Fake security / authentication**: Explicitly avoided; demo role selection is clearly labelled as demonstration access.
