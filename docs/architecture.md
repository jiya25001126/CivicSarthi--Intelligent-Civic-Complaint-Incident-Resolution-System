# JanSahay Architecture Document

> **"JanSahay: AI-assisted grievance resolution layer for CPGRAMS."**  
> *Tagline: "From Complaint to Resolution"*

---

## 1. Overview & System Mission

**JanSahay** is an AI workflow and decision-support layer designed to operate on top of India's Centralised Public Grievance Redress and Monitoring System (CPGRAMS). Rather than replacing or fragmenting the existing national grievance portal, JanSahay acts as an intelligent assistive co-pilot for citizens and nodal officers.

### Legal Notice & Prototype Disclaimer
> **Disclaimer:** JanSahay is a prototype and is not affiliated with or endorsed by DARPG/CPGRAMS. All data used during testing and demonstrations is synthetic.

---

## 2. High-Level System Architecture

```mermaid
graph TD
    subgraph Client Layer
        LP[Public Landing View<br/>Overview & Role Access]
        CP[Citizen Portal<br/>Submit, Track, My Complaints]
        OP[Officer / Admin Portal<br/>Cockpit, Triage, Department Directory]
    end

    subgraph Intelligence & Gateway Layer
        BE[jansahay-backend<br/>Express ES Modules /api/v1]
        CONFIG[Config & SLA Engine<br/>app.config.js / sla.json]
        MW[Middleware<br/>Helmet / CORS / Zod / Rate-Limit]
        VAL[Governance Transition Engine<br/>status.constants.js]
    end

    subgraph Service & Repository Abstraction
        SRV[Services<br/>Complaint / Department / SLA Metrics]
        REPO[Repository Layer<br/>Complaint & Department Repositories]
        DB[Database Strategy<br/>MongoDB if configured / JSON File Fallback]
    end

    subgraph CPGRAMS Integration Layer
        MOCK[jansahay-mock-cpgrams<br/>Isolated Mock CPGRAMS Gateway]
        REAL[Official CPGRAMS API<br/>Future Drop-in]
    end

    LP --> MW
    CP --> MW
    OP --> MW
    MW --> BE
    BE --> CONFIG
    BE --> VAL
    BE --> SRV
    SRV --> REPO
    REPO --> DB
    SRV -.->|Adapter Pattern| MOCK
    MOCK -.->|Future Swap| REAL
```

---

## 3. Layer Descriptions

### 3.1 Frontend (`/frontend`)
- **Package**: `jansahay-frontend`
- **Tech Stack**: React 18, Vite 6, Tailwind CSS, Axios, Lucide React, Recharts.
- **Role Switcher**: Demonstrates public, citizen, and officer access states clearly labelled as demo role selection (not pretending to be authentication).
- **Route Matrix**:
  - `/` &mdash; Public Landing Page (hero, system pillars, live metrics, GovTech disclaimer).
  - `/citizen` &mdash; Citizen Overview Dashboard (KPIs, recent cases, quick links).
  - `/citizen/submit` &mdash; Complaint Submission Form (live validation, reference number generation).
  - `/citizen/complaints` &mdash; My Complaints Page (multi-filter search, sorting, table).
  - `/citizen/track` & `/citizen/track/:id` &mdash; Grievance Status Tracker (visual audit timeline).
  - `/citizen/complaints/:id` &mdash; Detailed Grievance View (narrative, metadata, SLA health, attachments).
  - `/officer` &mdash; Officer Cockpit (caseload stats, attention queue, bottleneck indicators).
  - `/officer/complaints` &mdash; Officer Complaint Management (multi-criteria triage, department filters).
  - `/officer/complaints/:id` &mdash; Officer Review Desk (status transitions, department reassignment, internal notes).
  - `/officer/departments` &mdash; Department Management Directory (active nodes, SLA targets, caseload distribution).
  - `/incident`, `/neglect-radar`, `/status-translator` &mdash; Flagship feature preview placeholders (Phases 2&ndash;4).

### 3.2 Backend API (`/backend`)
- **Package**: `jansahay-backend`
- **Runtime**: Node.js (v20+ / v24+), Express (ES modules).
- **REST Endpoints**: Standardized under `/api/v1` with backward-compatible aliases under `/api`.
- **Design Pattern**: Controller &rarr; Service &rarr; Repository pattern.
  - Controllers manage HTTP serialization and error reporting.
  - Services execute business rules, SLA health metrics, and workflow logic.
  - Repositories encapsulate all data access behind an asynchronous persistence interface.
- **Security & Reliability**:
  - `helmet`: Secure HTTP response headers.
  - `cors`: Restricted to configured frontend origin.
  - `express-rate-limit`: Protects endpoints against denial-of-service.
  - `zod`: Request schema parameter and query validation.
  - Centralized error handler capturing structured JSON responses.

### 3.3 Database Strategy & Local Fallback
- **MongoDB Connection**: Handled via Mongoose in `src/config/database.js` when `MONGODB_URI` is provided in `.env`.
- **Local Development Fallback**: If MongoDB is unavailable or `MONGODB_URI` is unset, the system gracefully falls back to a persistent JSON file-backed repository (`data/complaints.json`, `data/departments.json`, `data/status_history.json`).
- **No In-Memory Loss**: All grievance creations, status changes, and notes made during demo runs persist cleanly to disk.

### 3.4 Governance & Status Transition Rules
Status progression follows strict administrative rules defined in `src/constants/status.constants.js`:
- `SUBMITTED` &rarr; `UNDER_REVIEW`, `ASSIGNED`, `CLOSED`
- `UNDER_REVIEW` &rarr; `ASSIGNED`, `IN_PROGRESS`, `AWAITING_INFORMATION`, `CLOSED`
- `ASSIGNED` &rarr; `IN_PROGRESS`, `UNDER_REVIEW`, `AWAITING_INFORMATION`
- `IN_PROGRESS` &rarr; `AWAITING_INFORMATION`, `RESOLVED`, `CLOSED`, `ASSIGNED`
- `AWAITING_INFORMATION` &rarr; `UNDER_REVIEW`, `IN_PROGRESS`, `CLOSED`
- `RESOLVED` &rarr; `CLOSED`, `REOPENED`
- `CLOSED` &rarr; `REOPENED`
- `REOPENED` &rarr; `UNDER_REVIEW`, `ASSIGNED`, `IN_PROGRESS`

Any disallowed transition is rejected with `400 Bad Request` and returns the list of permissible target states.

### 3.5 Isolated Mock CPGRAMS Service (`/mock-cpgrams`)
- **Package**: `jansahay-mock-cpgrams`
- **Isolation**: A completely decoupled module simulating official CPGRAMS endpoints:
  - `GET /complaints`: List complaints with official filters.
  - `GET /complaints/:id`: Fetch specific complaint by registration ID.
  - `PATCH /complaints/:id/status`: Update official status string and remarks.
- Provides `MockCpgramsClient` adapter ready to be replaced with the real CPGRAMS portal API in the future.

---

## 4. SLA & Configuration Engine

SLA rules are loaded externally from `src/config/sla.json` and `src/config/app.config.js`:
- `resolutionDeadlineDays` (default 30): Target completion SLA.
- `staleUpdateDays` (default 7): Days without touch before flagged as stale.
- `reassignmentLoopThreshold` (default 2): Department handoff threshold triggering loop alerts.

These thresholds are evaluated dynamically on fetch and are never hardcoded.

---

## 5. Security & Privacy Guarantees
- **No PII**: All seed data is 100% synthetic (fictitious names, anonymized IDs, mock contact addresses).
- **Environment Isolation**: `.env` and sensitive configurations are strictly excluded via `.gitignore`.
- **Input Validation**: All requests are validated against strict Zod schemas before reaching business logic.
- **Pre-commit Audit**: Zero API secrets, keys, or internal credentials committed to version control.
