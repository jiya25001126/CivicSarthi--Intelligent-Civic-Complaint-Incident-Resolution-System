# CivicSarthi — Intelligent Civic Complaint & Incident Resolution System

> **CivicSarthi: Intelligent decision-support and civic incident resolution layer for grievance redressal systems.**  
> *Tagline: "From Complaint to Resolution."*

---

> [!NOTE]
> **System Notice:** CivicSarthi is an independent decision-support platform designed to augment public grievance resolution workflows. It is not affiliated with or endorsed by DARPG/CPGRAMS. Demonstration datasets are synthetic and do not submit directly to official government portals without verified authorization.

---

## About CivicSarthi

**CivicSarthi** is an intelligent decision-support and workflow coordination layer built to enhance grievance redressal systems such as the Centralised Public Grievance Redress and Monitoring System (CPGRAMS). Rather than replacing existing government portals, CivicSarthi provides an intelligent co-pilot layer designed to:
- Accelerate grievance triage, intelligent categorization, and department dispatch.
- Group interconnected grievances into composite parent incident clusters.
- Proactively flag departmental ping-pong loops and stalled complaints via a Neglect Radar.
- Translate cryptic administrative statuses into plain, reassuring vernacular summaries for citizens.
- Break complex, multi-agency civic crises (e.g. urban flooding) into actionable cross-department subtasks.
- Provide explainable resolution quality checks before closing civic complaints.

---

## Canonical Repository

**Target Repository:**  
[https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git](https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git)

---

## System Packages

| Package | Path | Description |
| :--- | :--- | :--- |
| `civicsarthi-backend` | `/backend` | Node.js Express API (ES modules, Repository pattern, SLA engine, REST API `/api/v1`) |
| `civicsarthi-frontend` | `/frontend` | React + Vite + Tailwind CSS portal with Public, Citizen, and Officer views |
| `civicsarthi-mock-cpgrams` | `/mock-cpgrams` | Isolated mock CPGRAMS router & client adapter |

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

CivicSarthi includes a deterministic seed script that generates 11 departments, 18 realistic complaints across civic categories, and 45 timeline audit history events:

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
  - Submit Grievance (`/citizen/submit`): Working form with live validation and unique reference generation (`CS-2026-XXXX`).
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
| `GET` | `/api/v1/departments` | List of active demonstration departments |
| `GET` | `/api/v1/complaints` | Filterable complaints list (`search`, `category`, `departmentId`, `status`, `priority`, `sort`) |
| `GET` | `/api/v1/complaints/stats` | Aggregated real-time metrics computed from live repository |
| `GET` | `/api/v1/complaints/:id` | Lookup complaint by ID or Reference Number |
| `POST` | `/api/v1/complaints` | Submit grievance (generates `CS-2026-XXXX`, sets `SUBMITTED`, `MEDIUM`) |
| `PATCH`| `/api/v1/complaints/:id/status` | Update status (enforces administrative transition governance rules) |
| `PATCH`| `/api/v1/complaints/:id/department` | Reassign department (validates department exists, logs history) |
| `POST` | `/api/v1/complaints/:id/notes` | Add confidential internal officer review note |
| `GET` | `/api/v1/complaints/:id/history` | Retrieve full timeline audit history for complaint |

---

## Revised Implementation Roadmap

- [x] **Phase 0: Repository migration, branding and revised documentation** &mdash; Canonical repo migration to CivicSarthi, full rebranding, removal of prototype labels, 16-phase roadmap, and remote synchronization.
- [ ] **Phase 1: Audit and stabilize the existing application** &mdash; Core platform audit, baseline stability verification, endpoint consistency, and clean test coverage.
- [ ] **Phase 2: Data model and persistence improvements** &mdash; Enhanced schema definitions, index optimization, and dual-mode JSON/MongoDB repository hardening.
- [ ] **Phase 3: Authentication, sessions and role-based access control** &mdash; Citizen registration/login, restricted officer accounts, backend RBAC enforcement, route guards, and isolated portals.
- [ ] **Phase 4: Citizen grievance submission and tracking** &mdash; Citizen grievance lifecycle, file attachments, authenticated tracking, and ownership isolation.
- [ ] **Phase 5: Officer operations and department workflow** &mdash; Officer role scoping, departmental queues, SLA timers, and supervisor reassignment actions.
- [ ] **Phase 6: AI complaint intelligence, classification, explainable priority recommendations and duplicate detection** &mdash; Triage recommendations, explainable priority, and deterministic fallbacks.
- [ ] **Phase 7: Parent incidents and department subtasks** &mdash; Composite crisis clustering (e.g. floods) with parallel cross-department subtask orchestration.
- [ ] **Phase 8: Neglect Radar and supervisory alerts** &mdash; Loop detection (&ge; 2 reassignments), stall warnings (> 7 days), and proactive supervisor escalation.
- [ ] **Phase 9: Resolution Quality Checker** &mdash; Resolution checklist validation, evidence requirements, and human-in-the-loop exception handling.
- [ ] **Phase 10: Citizen resolution feedback, appeals and grievance ratings** &mdash; 1&ndash;5 experience ratings, formal appeal workflows, and audit history preservation.
- [ ] **Phase 11: Spam/fake complaint detection with human review** &mdash; Deterministic anomaly detection, repetition flags, and human review desk.
- [ ] **Phase 12: Citizen-initiated clarification requests, reminders and Status Translator** &mdash; Status clarification requests, rate-limited nudges, and plain-language status explanations.
- [ ] **Phase 13: Aggregate analytics and reporting** &mdash; Department performance reports, geographic heatmaps, and executive dashboards.
- [ ] **Phase 14: Security, accessibility, testing and deployment readiness** &mdash; Pentesting, WCAG 2.1 AA accessibility, comprehensive E2E tests, and deployment containers.
- [ ] **Phase 15: Optional extensions such as voice, computer vision, notifications and authorized external integrations** &mdash; Multimodal inputs, SMS/WhatsApp notification webhooks, and production gateway adapters.

---

## License & Notice

CivicSarthi is an independent civic innovation platform.  
*CivicSarthi is not affiliated with or endorsed by DARPG/CPGRAMS.*
