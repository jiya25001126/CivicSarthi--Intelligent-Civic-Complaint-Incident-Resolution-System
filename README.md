# JanSahay

> **JanSahay: AI-assisted grievance resolution layer for CPGRAMS.**  
> *Tagline: "From Complaint to Resolution"*

---

> [!IMPORTANT]
> **Prototype Disclaimer:** JanSahay is a prototype and is not affiliated with or endorsed by DARPG/CPGRAMS. All data contained in this repository is synthetic demonstration data. This application does not submit grievances to official government systems.

---

## About JanSahay

**JanSahay** is an intelligent decision-support and workflow coordination layer built directly on top of the Centralised Public Grievance Redress and Monitoring System (CPGRAMS). Rather than replacing the existing government portal, JanSahay provides an AI assistance layer designed to:
- Accelerate grievance triage and department dispatch.
- Group interconnected grievances into composite parent incident clusters.
- Proactively flag departmental ping-pong loops and stalled complaints via a Neglect Radar.
- Translate cryptic administrative statuses into plain, reassuring vernacular summaries for citizens.
- Break complex, multi-agency civic crises (e.g. urban flooding) into actionable cross-department subtasks.

---

## System Packages

| Package | Path | Description |
| :--- | :--- | :--- |
| `jansahay-backend` | `/backend` | Node.js Express API (ES modules, Repository pattern, SLA engine, REST API `/api/v1`) |
| `jansahay-frontend` | `/frontend` | React + Vite + Tailwind CSS portal with Public, Citizen, and Officer views |
| `jansahay-mock-cpgrams` | `/mock-cpgrams` | Isolated mock CPGRAMS router & client adapter |

---

## Getting Started

### Prerequisites
- Node.js (v20+ or v24+)
- npm (v10+ or v11+)

### 1. Installation

Install all package dependencies:

```bash
# From repository root:
npm run install:all
```

Or on Windows:
```powershell
npm.cmd run install:all
```

### 2. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Default configuration values:
- `PORT=5000`
- `FRONTEND_ORIGIN=http://localhost:5173`
- `VITE_API_URL=http://localhost:5000`
- `MONGODB_URI=` *(Leave empty to use the automatic persistent JSON file repository)*

### 3. Database Seeding & Reset

JanSahay includes a deterministic seed script that generates 11 departments, 18 realistic complaints across all civic categories, and 45 timeline audit history events:

```bash
# From repository root:
npm run seed

# Or on Windows:
npm.cmd run seed
```

### 4. Running Locally

**Start the Backend API:**
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
# Healthcheck: http://localhost:5000/api/v1/health
```

**Start the Frontend Portal:**
```bash
cd frontend
npm run dev
# Web application running at http://localhost:5173
```

### 5. Running Automated Tests
```bash
cd backend
npm test
```

---

## Portal Interfaces

- **Public Landing Page** (`/`): Overview, mission, feature breakdown, live metrics, and role navigation.
- **Citizen Portal**:
  - Dashboard (`/citizen`): Registered grievances, resolution stats, recent submissions.
  - Submit Grievance (`/citizen/submit`): Working form with live validation and unique reference generation (`JAN-2026-XXXX`).
  - My Complaints (`/citizen/complaints`): Searchable, filterable complaint list.
  - Track Status (`/citizen/track`): Direct reference search and visual lifecycle audit trail.
- **Officer / Admin Portal**:
  - Cockpit (`/officer`): Aggregated caseload KPIs, bottleneck indicators, attention queue.
  - Complaint Management (`/officer/complaints`): Multi-criteria triage table with status, category, priority, and department filters.
  - Officer Review Desk (`/officer/complaints/:id`): Execute validated status transitions, reassign departments, and log confidential internal officer notes.
  - Department Directory (`/officer/departments`): Catalog of 11 demo departments with active caseload counts and SLA targets.

---

## API Endpoints (`/api/v1`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health, version, database fallback status |
| `GET` | `/api/v1/departments` | List of 11 active demonstration departments |
| `GET` | `/api/v1/complaints` | Filterable complaints list (`search`, `category`, `departmentId`, `status`, `priority`, `sort`) |
| `GET` | `/api/v1/complaints/stats` | Aggregated real-time metrics computed from live repository |
| `GET` | `/api/v1/complaints/:id` | Lookup complaint by ID or Reference Number |
| `POST` | `/api/v1/complaints` | Submit grievance (generates `JAN-2026-XXXX`, sets `SUBMITTED`, `MEDIUM`) |
| `PATCH`| `/api/v1/complaints/:id/status` | Update status (enforces administrative transition governance rules) |
| `PATCH`| `/api/v1/complaints/:id/department` | Reassign department (validates department exists, logs history) |
| `POST` | `/api/v1/complaints/:id/notes` | Add confidential internal officer review note |
| `GET` | `/api/v1/complaints/:id/history` | Retrieve full timeline audit history for complaint |

---

## Roadmap (Phases 0 &ndash; 10)

- [x] **Phase 0: Baseline Scaffold & Infrastructure** &mdash; Clean architecture setup, isolated mock CPGRAMS gateway, synthetic seed dataset, initial tests.
- [x] **Phase 1: Core JanSahay Platform Implementation** &mdash; Citizen & Officer portals, complaint submission & tracking, status transition governance, department directory, REST API `/api/v1`, 12 automated unit/integration tests.
- [ ] **Phase 2: Parent Incident Clustering** &mdash; Detection and aggregation of multi-issue complaints (e.g. disaster flood crisis) under composite parent incidents.
- [ ] **Phase 3: Neglect Radar & Loop Detection** &mdash; Active monitoring for reassignment loops (&ge; 2 handoffs) and stale cases (> 7 days).
- [ ] **Phase 4: Citizen Plain Language Translator** &mdash; Vernacular and plain-language explanation of official CPGRAMS statuses.
- [ ] **Phase 5: Cross-Department Subtask Orchestration** &mdash; Breaking down composite incidents into parallel departmental action items.
- [ ] **Phase 6: Duplicate & Cluster Detection** &mdash; Identifying overlapping citizen grievances to prevent redundant officer actions.
- [ ] **Phase 7: MongoDB Production Migration** &mdash; Seamless transition from JSON repository fallback to MongoDB database.
- [ ] **Phase 8: Advanced Officer Analytics & Heatmaps** &mdash; Real-time geospatial and departmental grievance load analytics.
- [ ] **Phase 9: End-to-End Decision Support Workflows** &mdash; Integrated officer resolution drafting with policy guideline citations.
- [ ] **Phase 10: Pilot Hardening & Performance Benchmarking** &mdash; Security auditing, stress testing, and deployment preparation.

---

## License & Notice

JanSahay is an open prototype created for civic innovation hackathon demonstration purposes.
*JanSahay is a prototype and is not affiliated with or endorsed by DARPG/CPGRAMS.*
