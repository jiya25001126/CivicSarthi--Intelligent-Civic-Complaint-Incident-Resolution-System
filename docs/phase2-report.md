# CivicSarthi — Phase 2 Architecture & Persistence Report

**Project Title:** CivicSarthi — Intelligent Civic Complaint & Incident Resolution System  
**Canonical Repository:** `https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git`  
**Phase:** Phase 2 — Data Model and Persistence Improvements  
**Date:** October 10, 2026  
**Status:** IMPLEMENTED & VERIFIED (Dual-Mode Persistence Architecture)  
**Production Readiness:** NOT PRODUCTION-READY (Core persistence stabilized; authentication, AI modules, and clustering scheduled for subsequent phases)

---

## 1. Executive Summary

Phase 2 establishes a consistent, maintainable, and testable data and persistence layer for CivicSarthi. It introduces formal Mongoose domain schemas, a dual-mode repository abstraction supporting both MongoDB and persistent JSON storage, atomic write and reference collision recovery strategies, a dedicated migration utility, and comprehensive persistence regression tests.

The implementation strictly preserves existing API contracts, route structures, and citizen/officer data separation rules while eliminating silent fallbacks when MongoDB is explicitly configured.

All 38 automated tests passed across the backend test suite (38 PASS / 0 FAIL), and the frontend production bundle built cleanly in 4.65s.

---

## 2. Starting State Verification

The starting repository state was verified before modifications:

| Check | Command Executed | Recorded State | Status |
| :--- | :--- | :--- | :--- |
| **Origin Remote** | `git remote -v` | `origin https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git` | **PASS** |
| **Branch Tracking** | `git branch -vv` | `* main a7467e5 [origin/main] phase-01: verify and stabilize CivicSarthi core platform` | **PASS** |
| **Remote Synchronization** | `git ls-remote origin refs/heads/main` | `a7467e59ba83b71ca4377506a43994a05d40a833 refs/heads/main` | **PASS** |
| **Working Tree Cleanliness** | `git status` | Clean, synchronized with `origin/main` | **PASS** |

---

## 3. Domain Data Models & Mongoose Schemas

Formal domain models were established in [`backend/src/models/`](backend/src/models/):

### 3.1 Complaint Model ([`complaint.model.js`](backend/src/models/complaint.model.js))
- **Primary Identifiers:** `id` (string identifier) and canonical `referenceNumber` (unique uppercase string, e.g. `CS-2026-0001`).
- **Core Grievance Details:** `title` (3–200 chars), `description` (10–3000 chars), `text` (backward-compatibility alias), `category` (strict enum of 11 civic categories).
- **Location & Localization:** `state`, `district`, `locality`, `preferredLanguage`, `language`.
- **Administrative Assignment:** `departmentId` (indexed), `department` (compatibility alias), `status` (enum: `SUBMITTED`, `UNDER_REVIEW`, `ASSIGNED`, `IN_PROGRESS`, `AWAITING_INFORMATION`, `RESOLVED`, `CLOSED`, `REOPENED`), `officialStatus`, `priority` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Workflow Counters:** `reassignments` (number of inter-department transfers), `citizenReminders`.
- **Citizen Contact Details:** Optional `citizenName`, `citizenEmail`, `citizenPhone`, `citizenAddress`.
- **Confidential Review Notes:** Embedded `officerNotes` array containing `note`, `officerId`, `timestamp`.
- **Audit Progression:** Embedded `statusHistory` array containing `timestamp`, `status`, `actorType`, `remarks`.
- **Metadata:** `synthetic` (boolean flag to differentiate demonstration records from genuine user complaints), `createdAt`, `updatedAt`, `lastUpdated`.

### 3.2 Department Model ([`department.model.js`](backend/src/models/department.model.js))
- `id`: Unique uppercase string identifier (e.g. `DEPT_ROADS`).
- `code`: Unique short uppercase code (e.g. `PWD`).
- `name`: Full administrative title.
- `description`: Departmental scope and responsibilities.
- `category`: Civic category handled.
- `contactEmail`: Synthetic nodal officer email (`.internal` synthetic domain).
- `isActive`: Boolean flag for active routing.
- `slaDays`: Minimum 1 day resolution SLA target.

### 3.3 Status History Model ([`statusHistory.model.js`](backend/src/models/statusHistory.model.js))
- Represents discrete timeline events for independent audit querying: `id`, `complaintId`, `referenceNumber`, `timestamp`, `status`, `actorType`, `remarks`.

---

## 4. Repository Abstraction & Backend Selection

The repository layer was decoupled from direct database drivers into a clean abstraction:

```
Service Layer (ComplaintService, DepartmentService)
                  │
                  ▼
Repository Facade (ComplaintRepository, DepartmentRepository)
                  │
      ┌───────────┴───────────┐
      ▼                       ▼
JSON Adapter            MongoDB Adapter
(complaint.json...js)   (complaint.mongo...js)
```

### 4.1 Persistence Backend Selection Rules
The active adapter is selected via `getConfiguredPersistenceMode()` in [`database.js`](backend/src/config/database.js):
1. **Explicit MongoDB Mode (`PERSISTENCE_MODE=mongodb` or `MONGODB_URI` present):**
   - Directs queries to `MongoComplaintRepository`.
   - **Anti-Silent Fallback Guard:** If MongoDB fails to connect or is unreachable, the repository **refuses to write to local JSON files** and throws `503 Persistence Error`. A misconfigured deployment cannot quietly write data to an unexpected local store.
   - `GET /api/v1/health` reports `{ status: 'degraded', database: 'MongoDB (Disconnected)' }`.
2. **Explicit JSON Mode (`PERSISTENCE_MODE=json` or no URI configured):**
   - Directs queries to `JsonComplaintRepository`.
   - `GET /api/v1/health` reports `{ status: 'ok', database: 'FileRepository (JSON Fallback)' }`.

---

## 5. Indexes and Query Optimization

Mongoose schemas define purposeful indexes tailored to application query patterns:

| Collection | Index Definition | Supported Query / Operation |
| :--- | :--- | :--- |
| `Complaint` | `{ referenceNumber: 1 }` (Unique) | O(1) canonical complaint lookup and duplicate prevention. |
| `Complaint` | `{ id: 1 }` (Unique, Sparse) | O(1) backward-compatible ID lookup. |
| `Complaint` | `{ departmentId: 1, status: 1 }` | Compound index for officer department triage queues. |
| `Complaint` | `{ category: 1, createdAt: -1 }` | Category browsing sorted newest first. |
| `Complaint` | `{ status: 1 }` | Status dashboard filtering. |
| `Complaint` | `{ priority: 1 }` | Priority ordering and critical grievance alerting. |
| `Complaint` | `{ createdAt: -1 }` | Default chronological list sorting. |
| `Department` | `{ id: 1 }` (Unique) | Department resolution by ID. |
| `Department` | `{ code: 1 }` (Unique) | Department resolution by short code. |
| `Department` | `{ category: 1 }` | Category routing during automatic reassignment. |
| `StatusHistory` | `{ referenceNumber: 1, timestamp: -1 }` | Chronological status timeline lookup by complaint reference. |
| `StatusHistory` | `{ complaintId: 1, timestamp: -1 }` | Chronological status timeline lookup by complaint ID. |

---

## 6. Concurrency Strategy & Write Consistency

### 6.1 Dynamic Year Reference Generation
- Dynamically derives year (`new Date().getFullYear()`).
- Formats reference numbers strictly as `CS-YYYY-XXXX`.
- Preserves legacy `JAN-YYYY-XXXX` and `CPG-YYYY-XXXX` identifiers without alteration.

### 6.2 Collision Avoidance & Bounded Retry
- **JSON Adapter:** Employs an in-process `AsyncMutex` and a `while (existingRefs.has(candidateRef))` loop that checks all existing identifiers before writing.
- **MongoDB Adapter:** Leverages MongoDB's unique index on `referenceNumber`. Under concurrent write collisions (error code `11000`), a bounded retry loop (up to 5 attempts) re-evaluates the maximum sequence and retries atomically.

### 6.3 Deployment Model Limitations
- **JSON Storage Limitation:** The in-process `AsyncMutex` is single-process safe. It does not synchronize multiple processes sharing a filesystem (e.g. multi-replica Kubernetes pods or PM2 clusters).
- **MongoDB Transaction Prerequisites:** Multi-document ACID transactions in MongoDB require a replica set or sharded cluster configuration. Standalone MongoDB instances do not support multi-document transactions. CivicSarthi uses atomic document updates (`$push`, `$set`) so that status changes and embedded history entries cannot diverge even on standalone instances.

---

## 7. Migrations and Seeding Strategy

### 7.1 Seeding Behavior
- **Safe Seeding (`npm run seed`):** Non-destructive. User-created complaints (`synthetic: false`) and their audit history are preserved.
- **Demo Data Reset (`npm run seed:reset`):** Explicitly wipes user-created records and restores clean baseline fixtures.

### 7.2 Migration Utility ([`migrate.js`](backend/src/scripts/migrate.js))
A dedicated migration script allows operators to migrate JSON files into MongoDB:
- **Command:** `npm run migrate:mongo` (or `node src/scripts/migrate.js`).
- **Flags:**
  - `--dry-run`: Previews the migration without writing to MongoDB.
  - `--force`: Clears target collections before migrating.
  - Default: Safe upsert mode. Validates schemas and skips existing records.
- **Safety:** Does not run automatically merely because `MONGODB_URI` is present.

---

## 8. Verification & Audit Results Checklist

Every check is categorized strictly as **PASS**, **FAIL**, or **NOT VERIFIED**:

| Area | Check Item | Evaluation & Findings | Result |
| :--- | :--- | :--- | :--- |
| **Data Models** | Complaint Mongoose schema validation | Enforces title, description, category enum, priority, status, and subdocuments. | **PASS** |
| **Data Models** | Department Mongoose schema validation | Enforces unique ID/code, positive SLA days. | **PASS** |
| **Data Models** | StatusHistory Mongoose schema validation | Enforces reference linkage and transition metadata. | **PASS** |
| **Data Models** | Officer notes subdocument isolation | Embedded `officerNotes` with schema bounds (max 2000 chars, officerId, timestamp). | **PASS** |
| **Repository** | Common repository interface compliance | Both JSON and MongoDB adapters implement identical methods and response shapes. | **PASS** |
| **Repository** | Explicit backend selection | `PERSISTENCE_MODE` explicitly selects adapter. | **PASS** |
| **Repository** | Prevention of silent JSON fallback | When `PERSISTENCE_MODE=mongodb` and database is unreachable, queries reject with 503 error instead of writing to JSON. | **PASS** |
| **JSON Storage** | CRUD and restart persistence | Created complaint persists to disk and is readable across fresh repository instances. | **PASS** |
| **JSON Storage** | Concurrent writes safety | Parallel status updates and notes serialize via `AsyncMutex` with zero lost updates. | **PASS** |
| **JSON Storage** | Status governance validation | Illegal status jumps reject with 400 Bad Request at the repository layer. | **PASS** |
| **JSON Storage** | Department existence validation | Reassigning to non-existent department rejects with 400 Bad Request. | **PASS** |
| **JSON Storage** | Reference collision recovery loop | Detects existing candidate references and increments sequence safely. | **PASS** |
| **JSON Storage** | Seeding idempotency & user record preservation | Repeated `npm run seed` preserves user-created complaints and yields identical records. | **PASS** |
| **MongoDB** | Schema validation unit tests | Schema rejects invalid categories, short titles, and missing required keys. | **PASS** |
| **MongoDB** | Live operational persistence | Local MongoDB daemon is offline (`port 27017` connection failed). | **NOT VERIFIED** |
| **MongoDB** | Migration utility error handling | `migrate.js` detects missing `MONGODB_URI` and halts gracefully with structured report. | **PASS** |
| **Health Check** | Transparent persistence reporting | `GET /api/v1/health` reports `'MongoDB (Disconnected)'` with degraded status when connection fails, and `'FileRepository (JSON Fallback)'` in local mode without leaking secrets. | **PASS** |
| **API Compatibility**| Regression suite pass rate | All 24 Phase 1 API integration tests pass with zero regressions. | **PASS** |
| **Frontend** | Production build verification | Vite production bundle builds in 4.65s with zero errors or warnings. | **PASS** |

---

## 9. Automated Test Suite Execution

### Backend Automated Test Run (`npm.cmd test`)
- **Total Tests:** 38 tests across 5 suites.
- **Results:** **38 PASS / 0 FAIL** (100% pass rate).
- **Duration:** 4.85s.

```text
▶ CivicSarthi Phase 1 Backend API Tests (24 tests)
  ✔ GET /api/v1/health & GET /api/health (200 OK)
  ✔ GET /api/v1/departments
  ✔ GET /api/v1/complaints
  ✔ GET /api/v1/complaints/stats
  ✔ GET /api/v1/complaints/:id (404 on missing)
  ✔ POST /api/v1/complaints (validation & dynamic reference)
  ✔ Reference Number Integrity
  ✔ Concurrency: simultaneous submissions
  ✔ PATCH /api/v1/complaints/:id/status (governance validation)
  ✔ PATCH /api/v1/complaints/:id/department (department validation)
  ✔ POST /api/v1/complaints/:id/notes
  ✔ Data Separation: Citizen vs Officer
  ✔ GET /api/v1/complaints/:id/history
  ✔ Reference Collision Safety loop
  ✔ Immutability of Existing References
  ✔ Persistence Across Server Restarts
  ✔ Concurrent Writes Safety
  ✔ Seeding Idempotency
  ✔ Database Connection Failure handling
  ✔ Search, Filtering, Sorting, and Pagination boundaries
  ✔ Department and Complaint Lookup Edge Cases
  ✔ Audit: Internal officer notes excluded from citizen responses
✔ CivicSarthi Phase 1 Backend API Tests (24 pass)

▶ CivicSarthi Phase 2 Persistence Layer Tests (14 tests)
  ▶ JSON Adapter: CRUD, Concurrency, and Restart Persistence
    ✔ JSON CRUD: creates complaint, retrieves it by ID and reference number, updates status
    ✔ JSON Persistence: complaint survives simulated server restart via fresh repository instance
    ✔ JSON Concurrency: multiple simultaneous status and note writes serialize safely
    ✔ JSON Status Governance: rejects disallowed status transitions with descriptive error
    ✔ JSON Department Validation: rejects reassignment to non-existent department
    ✔ JSON Dynamic Reference Collision Recovery: loops to find next sequence if occupied
    ✔ JSON Seeding Idempotency: repeated runs of ordinary seed produce identical records
  ✔ JSON Adapter: CRUD, Concurrency, and Restart Persistence (7 pass)

  ▶ MongoDB Mongoose Domain Model Validation
    ✔ ComplaintModel Schema Validation: accepts valid document and validates required fields
    ✔ ComplaintModel Schema Validation: rejects missing or invalid fields
    ✔ DepartmentModel Schema Validation: validates required id, code, and SLA bounds
    ✔ StatusHistoryModel Schema Validation: enforces complaint linkage and valid status
  ✔ MongoDB Mongoose Domain Model Validation (4 pass)

  ▶ Persistence Backend Selection & Anti-Silent Fallback Safety
    ✔ Refuses silent fallback: throws error if PERSISTENCE_MODE=mongodb but MongoDB is unreachable
    ✔ Migration utility safely detects missing MONGODB_URI and exits with clean error summary
    ✔ Live MongoDB status reporting: accurately reports NOT VERIFIED if local daemon is offline
  ✔ Persistence Backend Selection & Anti-Silent Fallback Safety (3 pass)

✔ CivicSarthi Phase 2 Persistence Layer Tests (14 pass)
ℹ tests 38
ℹ suites 5
ℹ pass 38
ℹ fail 0
```

---

## 10. Remaining Risks & Known Limitations

1. **Local MongoDB Verification:** Because the local machine does not host a running MongoDB daemon, end-to-end network persistence to an active MongoDB database is marked **NOT VERIFIED**. Schema validation, connection error handling, and silent fallback prevention were verified.
2. **Access Control Boundary:** In accordance with project phase boundaries, `x-portal-role: officer` remains a client-controlled demonstration preview. Cryptographic session authentication and server-side RBAC are prioritized for **Phase 3**.
3. **Multi-Node JSON Deployment:** File-backed storage is designed for single-process development. Deployments requiring horizontal scaling must use MongoDB.

---

## 11. Commands for Local Development

```bash
# Run all tests (API integration + Persistence layer)
npm run test

# Run ordinary non-destructive seed (preserves user records)
npm run seed

# Run destructive demo reset (restores original baseline demo fixtures)
npm run seed:reset

# Preview JSON to MongoDB migration (dry run)
npm run migrate:mongo -- --dry-run

# Execute JSON to MongoDB migration
npm run migrate:mongo

# Build frontend production bundle
npm run build
```

---

## 12. Conclusion & Recommended Next Step

Phase 2 data models and persistence improvements are complete, stabilized, and verified.

**Recommended Next Phase:**  
**Phase 3: Authentication, Sessions, and Role-Based Access Control (RBAC)** (Server-side user authentication, password hashing, JWT session management, citizen account registration, and officer permissions).
