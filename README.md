# JanSahay

> **JanSahay: AI-assisted grievance resolution layer for CPGRAMS.**  
> *Tagline: "From Complaint to Resolution"*

---

> [!IMPORTANT]
> **Prototype Disclaimer:** JanSahay is a prototype and is not affiliated with or endorsed by DARPG/CPGRAMS. All data contained in this repository is synthetic demonstration data.

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
| `jansahay-backend` | `/backend` | Node.js Express API (ES modules, Repository pattern, SLA engine) |
| `jansahay-frontend` | `/frontend` | React + Vite + Tailwind CSS portal with Citizen & Officer views |
| `jansahay-mock-cpgrams` | `/mock-cpgrams` | Isolated mock CPGRAMS router & client adapter |

---

## Getting Started

### Prerequisites
- Node.js (v20+ or v24+)
- npm (v10+)

### 1. Installation

Install all package dependencies:

```bash
# From repository root
npm run install:all
```

Or install individually:
```bash
cd backend && npm install
cd ../frontend && npm install
cd ../mock-cpgrams && npm install
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

### 3. Running Locally

**Start the Backend API:**
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
# Healthcheck: http://localhost:5000/api/health
```

**Start the Frontend:**
```bash
cd frontend
npm run dev
# Web application running at http://localhost:5173
```

### 4. Running Backend Verification Tests
```bash
cd backend
npm test
```

---

## Roadmap (Phases 0 &ndash; 10)

- [x] **Phase 0: Baseline Scaffold & Infrastructure** — Clean architecture setup, isolated mock CPGRAMS gateway, synthetic seed dataset (25 cases), initial CI tests.
- [ ] **Phase 1: Intelligent Intake & Classification** — Automated department routing, category tagging, priority assessment.
- [ ] **Phase 2: Parent Incident Clustering** — Detection and aggregation of multi-issue complaints (e.g. disaster flood crisis) under composite parent incidents.
- [ ] **Phase 3: Neglect Radar & Loop Detection** — Active monitoring for reassignment loops (&ge; 2 handoffs) and stale cases (> 7 days).
- [ ] **Phase 4: Citizen Plain Language Translator** — Vernacular and plain-language explanation of official CPGRAMS statuses.
- [ ] **Phase 5: Cross-Department Subtask Orchestration** — Breaking down composite incidents into parallel departmental action items.
- [ ] **Phase 6: Duplicate & Cluster Detection** — Identifying overlapping citizen grievances to prevent redundant officer actions.
- [ ] **Phase 7: MongoDB Persistence Migration** — Seamless drop-in transition from JSON repository to MongoDB database.
- [ ] **Phase 8: Advanced Officer Analytics & Heatmaps** — Real-time geospatial and departmental grievance load analytics.
- [ ] **Phase 9: End-to-End Decision Support Workflows** — Integrated officer resolution drafting with policy guideline citations.
- [ ] **Phase 10: Pilot Hardening & Performance Benchmarking** — Security auditing, stress testing, and deployment preparation.

---

## License & Notice

JanSahay is an open prototype created for civic innovation hackathon demonstration purposes.
*JanSahay is a prototype and is not affiliated with or endorsed by DARPG/CPGRAMS.*
