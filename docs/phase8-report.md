# CivicSarthi Phase 8 Implementation Report: Neglect Radar & Supervisory Operational Monitoring

> **Document Type:** Reconstructed Implementation & Verification Report  
> **Reconstruction Date:** October 12, 2026  
> **Product:** CivicSarthi — Intelligent Civic Complaint & Incident Resolution System  
> **Tagline:** From Complaint to Resolution.  
> **Original Implementation Commit:** `9c0b7fcd56543fcfa72ad71a99e36c29507591c7` (`feat(neglect-radar): add explainable civic neglect monitoring`)  
> **Merge Commit:** `03e1dbf9a401590d041267e649a4a594e6a382f7` (`Merge pull request #6 from jiya25001126/phase-08-neglect-radar`)  
> **Current Status:** **VERIFIED** (100% Automated Backend & Foundation Test Pass; Frontend Production Build Clean)

---

## 1. Phase Title & Objective

- **Phase Title:** Phase 8 — Neglect Radar and Supervisory Alerts
- **Primary Objective:** Provide supervisory decision-support and proactive operational monitoring to prevent civic complaints, multi-agency incidents, and departmental subtasks from falling into administrative neglect. By computing explainable, evidence-backed risk scores across multiple operational signals, the Neglect Radar alerts municipal leadership to bottlenecks, stalled handoffs, and SLA breaches before grievances escalate into public dissatisfaction.

---

## 2. Scope & Implementation Summary

Phase 8 implements an explainable, non-accusatory operational risk monitoring system:

1. **Multi-Entity Evaluation:** Unified monitoring spanning Complaints, Incidents, and Subtasks.
2. **Deterministic, Pure Scoring Engine:** Zero side effects, byte-for-byte reproducibility, and immutable input evaluation.
3. **Configuration-Grounded Thresholds:** Directly uses authoritative project configuration (`src/config/sla.json` and `src/config/app.config.js`):
   - Resolution deadline: 30 days (`resolutionDeadlineDays`).
   - Stalled progress threshold: 7 days (`staleUpdateDays`).
   - Reassignment loop threshold: 2 handoffs (`reassignmentLoopThreshold`).
4. **Weighted Operational Signals (100-Point Model):**
   - `OVERDUE_SLA` (30 points): Target completion SLA exceeded.
   - `STALE_PROGRESS` (25 points): No progress or touch within stale threshold.
   - `BLOCKED_DEPENDENCY` (20 points): Department subtask or incident dependency blocked.
   - `REASSIGNMENT_LOOP` (15 points): Repeated inter-departmental transfers (ping-pong).
   - `REOPENED_CASE` (10 points): Citizen reopened an unresolved case.
   - `UNASSIGNED_OWNERSHIP` (10 points): Active grievance lacks designated handling officer beyond 3-day triage grace window.
5. **Score Normalization & Insufficient Data Handling:** Missing signals or entities with fewer applicable signals normalize against evaluable weight denominators; payloads with insufficient evaluable weight (<35) return `INSUFFICIENT_DATA`.
6. **Strict RBAC & Department Scoping:**
   - Citizens are strictly denied access with **HTTP 403 Forbidden**.
   - Officers are strictly scoped to their authenticated department (server-enforced, rejecting client filter spoofing).
   - Administrators have cross-department oversight with optional department filtering.
7. **Neutral Operational Terminology:** Uses constructive operational language ("Stalled Operational Progress", "Inter-agency Dependency Bottleneck") rather than punitive or accusatory labels.

---

## 3. Features Verified in Current Code

| Feature ID | Feature Name | Code Path / Implementation | Verification Status |
| :--- | :--- | :--- | :---: |
| **P8-FEAT-01** | Pure Scoring Engine & Contract | `backend/src/services/neglectRadar.scoring.js`<br>`evaluateEntityNeglectRisk()` | **VERIFIED** |
| **P8-FEAT-02** | Authoritative Threshold Binding | `backend/src/constants/neglectRadar.constants.js`<br>Reads `config.sla` from `app.config.js` | **VERIFIED** |
| **P8-FEAT-03** | Terminal State Exclusion | Filters out `RESOLVED`, `CLOSED`, `COMPLETED`, `CANCELLED` from active risk scoring | **VERIFIED** |
| **P8-FEAT-04** | Double-Counting Protection | Decouples total complaint age from stalled progress since last activity | **VERIFIED** |
| **P8-FEAT-05** | Multi-Entity Aggregation Service | `backend/src/services/neglectRadar.service.js`<br>Aggregates Complaints, Incidents, Subtasks | **VERIFIED** |
| **P8-FEAT-06** | Graceful Repository Failure Resilience | Partial source failure returns diagnostic `sources` metadata without 500 error | **VERIFIED** |
| **P8-FEAT-07** | Anti-Enumeration Department Scoping | Unauthorized single-item lookups return 404 to prevent cross-department case sniffing | **VERIFIED** |
| **P8-FEAT-08** | Supervisory Cockpit Frontend | `frontend/src/pages/NeglectRadarPage.jsx`<br>Interactive metrics cards, risk filters, sorting, detail drawer | **VERIFIED** |

---

## 4. Backend Endpoints, Services, Repositories & Data Models

### A. REST Endpoints (`/api/v1/neglect-radar` & `/api/neglect-radar`)

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/neglect-radar` | Officer, Admin | List evaluated neglect radar items with filters (`entityType`, `riskLevel`, `departmentId`, `signalCode`, `search`, `sort`, pagination). Citizens receive **HTTP 403 Forbidden**. |
| `GET` | `/api/v1/neglect-radar/:entityType/:id` | Officer, Admin | Retrieve a single evaluated entity with full signal breakdown and recommended remediation actions. |
| `GET` | `/api/neglect-radar` | Officer, Admin | Legacy backward-compatible route alias. |

### B. Core Services & Algorithms
- **`backend/src/services/neglectRadar.scoring.js`** (600 lines):
  - Pure mathematical scoring function: `evaluateEntityNeglectRisk(entity, dependencies, options)`.
  - Normalizes score: `finalScore = Math.round((totalEarnedPoints / totalEvaluablePoints) * 100)`.
  - Risk Level Mapping:
    - `CRITICAL`: Score &ge; 75
    - `HIGH`: Score &ge; 50
    - `MEDIUM`: Score &ge; 25
    - `LOW`: Score &ge; 0
    - `INSUFFICIENT_DATA`: Evaluable weight < 35 or invalid schema
  - Emits explainable signal arrays with `code`, `name`, `pointsEarned`, `maxPoints`, `isTriggered`, `isAvailable`, `description`, and `evidence`.
- **`backend/src/services/neglectRadar.service.js`** (546 lines):
  - Concurrently queries `complaintRepository`, `incidentRepository`, and `subtaskRepository`.
  - Enforces `resolveRadarAccessScope()`: locks officers to `req.user.departmentId`.
  - Computes global summary counters (`totalMonitored`, `criticalRiskCount`, `highRiskCount`, `averageScore`, `topRiskSignals`) over the entire filtered dataset.
  - Strictly projects responses to omit citizen phone numbers, passwords, and private officer review notes.

---

## 5. Frontend Pages & Components

| File | Component / Responsibility | Key Features |
| :--- | :--- | :--- |
| `frontend/src/pages/NeglectRadarPage.jsx` (1,272 lines) | Supervisory Radar Desk | Full executive dashboard: KPI scorecards (Critical Attention, High Risk, Monitored Nodes, Average Risk Index), multi-faceted signal filter chips, risk level pill badges, sort dropdowns, search bar, and side-sheet detail drawer displaying explainable signal checklists and suggested action playbooks. |
| `frontend/src/api/client.js` | API Integration Client | Added `getNeglectRadar` and `getNeglectRadarItem` API methods with query string serialization. |

---

## 6. Persistence & Non-Destructive Operation

- **Read-Only Architectural Guarantee:**
  - The Neglect Radar is strictly an observational, decision-support engine.
  - It does **not** call repository `create()`, `update()`, or `delete()` methods.
  - Zero state mutations or disk modifications occur during radar queries.
- **Repository Isolation:**
  - Evaluates live JSON repository or MongoDB store safely without locking or caching side-effects.

---

## 7. Security, Authorization & Privacy Guardrails

1. **Strict Citizen Exclusion:**
   - Citizens navigating or calling `/api/v1/neglect-radar` receive **HTTP 403 Forbidden**.
   - Citizen tokens cannot view supervisory operational scores or officer bottlenecks.
2. **Server-Enforced Department Scoping:**
   - Authenticated officers can only see neglect indicators for their own department.
   - Client requests with `?departmentId=OTHER_DEPT` are ignored in favor of `req.user.departmentId`.
3. **Anti-Enumeration 404:**
   - Single item lookup (`GET /api/v1/neglect-radar/COMPLAINT/:id`) for a ticket owned by another department returns **HTTP 404 Not Found** (rather than 403) to prevent enumerating grievances in other departments.
4. **Data Sanitization:**
   - PII fields (`citizenPhone`, `citizenEmail`, `reporterName`, `officerNotes`) are scrubbed before serialization.

---

## 8. Test Execution Results

All 3 Phase 8 backend test suites executed via native Node.js test runner (`node --test`) and passed 100%:

```
Command: node --test tests/neglectRadar.scoring.test.js tests/neglectRadar.service.test.js tests/neglectRadar.api.test.js
Result: 54 passed, 0 failed, 0 cancelled across 15 suites (Duration: 1.45s)
```

### Breakdown of Test Suites:
1. **`backend/tests/neglectRadar.scoring.test.js`** (23 tests):
   - Pure scoring engine determinism and immutability.
   - Terminal state exclusion (resolved, closed, completed, cancelled).
   - Authoritative SLA targets from `sla.json` (30 days) and non-applicable signal handling.
   - Stale progress vs. total age distinction (double-counting prevention).
   - Blocked dependency evaluation on subtasks and incidents.
   - Reassignment loop thresholding (&ge; 2) and reopened case detection.
   - Unassigned ownership 3-day triage grace window validation.
   - Missing-signal denominator normalization and score boundaries.
   - Insufficient data guardrails for corrupt or empty inputs.
   - Department scoping and role authorization contract rules.
2. **`backend/tests/neglectRadar.service.test.js`** (12 tests):
   - Multi-entity aggregation across complaints, incidents, and subtasks.
   - Independent repository degradation handling with structured `sources` metadata.
   - Specific entity failure 503 handling.
   - Officer department scoping and client spoofing prevention.
   - Filtering, sorting, and pagination across full datasets.
   - Complete summary metric computation.
   - Strict PII stripping.
   - Read-only execution verification (zero repository mutation calls).
3. **`backend/tests/neglectRadar.api.test.js`** (19 tests):
   - Gating: citizen 403 rejection and unauthenticated 401 rejection.
   - Officer missing-department fail-closed 403 behavior.
   - Administrator cross-department filtering and listing.
   - Input validation guardrails for `entityType`, `riskLevel`, `sort`, and `page`.
   - Single item detail retrieval and anti-enumeration 404 behavior.
   - Backward-compatible `/api/neglect-radar` route alias validation.

---

## 9. Build Results & Blockers

- **Frontend Production Build:** `npm.cmd --prefix frontend run build`
  - Vite v6.4.4 compiled 1,656 modules cleanly in 5.38s.
  - Zero syntax errors, zero missing imports.
  - Output artifacts generated in `dist/`.
- **Blockers:** Zero compilation or test blockers.

---

## 10. Git Branch & Commit Hashes

- **Implementation Commit:** `9c0b7fcd56543fcfa72ad71a99e36c29507591c7`
  - Author: `kavyagupta1029-eng <kavyagupta1029@gmail.com>`
  - Date: Mon Oct 12 01:19:52 2026 +0530
  - Diffstat: 11 files changed, 4,084 insertions(+), 22 deletions(-)
- **Feature Branch:** `origin/phase-08-neglect-radar`
- **Merge PR Commit:** `03e1dbf9a401590d041267e649a4a594e6a382f7` (`Merge pull request #6 from jiya25001126/phase-08-neglect-radar`) into `main`.

---

## 11. Known Limitations & Deferred Work

1. **Automated Escalation Notifications:** Neglect alerts currently display inside the supervisory web dashboard. Automated dispatch via SMS or email is deferred to Phase 15.
2. **Predictive Time-Series Forecasting:** Scoring evaluates deterministic present operational signals; machine-learning time-series breach prediction is slated for future enhancement.
3. **Live MongoDB Daemon:** Schema validation verified; live network daemon tests marked `NOT VERIFIED` due to local offline test environment.

---

## 12. Remaining Tasks & Acceptance Criteria

- [x] Pure deterministic neglect scoring engine implemented.
- [x] Multi-entity evaluation (complaints, incidents, subtasks) operational.
- [x] Configuration thresholds wired directly to `sla.json` and `app.config.js`.
- [x] Role-based access control and anti-enumeration department scoping enforced.
- [x] 100% automated test pass (54/54 tests passing).
- [x] Frontend `NeglectRadarPage.jsx` dashboard fully integrated.
- [x] Reconstructed Phase 8 report restored to `docs/phase8-report.md`.

---

## 13. Reconstruction vs. Original Implementation Distinction

- **Original Implementation (Commit `9c0b7fc`):** Implemented all 11 source files, constants, scoring engine, service layer, controllers, routes, tests, and frontend dashboard components. Merged into `main` via PR #6.
- **Recovery Actions (October 12, 2026):** Identified that the original author omitted committing `docs/phase8-report.md`. Reconstructed this authoritative report from verified source code, automated test suite execution (54 tests), and Git commit history. Synchronized local workspace to `main`. Zero application code rewritten.
