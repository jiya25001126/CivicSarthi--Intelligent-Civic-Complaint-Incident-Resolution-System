# CivicSarthi — Phase 4 Implementation & Security Audit Report: Citizen Grievance Submission and Tracking

**Repository:** `https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git`  
**Base Commit:** `5ba65c1`  
**Phase:** Phase 4 — Citizen Grievance Submission and Tracking  
**Branch:** `phase-04-citizen-grievance-submission-tracking`  
**Date of Audit & Execution:** October 10, 2026  
**Auditor / Engineer:** Senior Full-Stack Security Engineer  

---

## 1. Executive Summary & Phase Objectives

The objective of **Phase 4** is to deliver a complete, authenticated citizen grievance workflow for CivicSarthi, encompassing:
1. **Citizen Grievance Submission:** Validated on the server with Zod, enforcing length/character boundaries and safe attachment naming without directory traversal.
2. **Server-Side Identity & Ownership:** Derive `citizenId` strictly from verified session tokens, preventing request-body spoofing.
3. **Unique Reference Generation:** Monotonically incrementing, year-partitioned reference numbers (`CS-YYYY-XXXX`) with collision-safety loops.
4. **Citizen Dashboard & Grievance Listing:** Statistics derived strictly from citizen-owned records, with empty states, pagination, and sorting.
5. **Public Tracking Reference & Privacy Protection:** Dedicated public tracking (`/api/v1/complaints/track/:reference`) returning lifecycle information while strictly projecting only public fields and scrubbing PII, contact info, and internal officer notes.
6. **Citizen-Friendly Status Descriptions:** Translating official administrative statuses (`SUBMITTED`, `UNDER_REVIEW`, `ASSIGNED`, `IN_PROGRESS`, `AWAITING_INFORMATION`, `RESOLVED`, `CLOSED`, `REOPENED`) into plain, transparent explanations.
7. **Idempotency & Duplicate Submission Protection:** Preventing duplicate records caused by rapid clicking or network retries.
8. **Dual Persistence Compatibility:** Supporting both JSON file storage (with mutex serialization and atomic writes) and MongoDB Mongoose models.

---

## 2. Baseline & Codebase Inspection Findings

Before implementation, an inspection of commit `5ba65c1` verified:
- **Git State:** Clean working tree on canonical remote `origin`.
- **Existing Capabilities:**
  - Phase 3 authentication with `HttpOnly` cookie and Bearer tokens, CSRF protection, and server-side RBAC was fully operational (17/17 security tests passed).
  - JSON repository implemented atomic writes, dynamic sequence references, and status transition matrix rules.
  - Initial `CitizenDashboard`, `SubmitComplaintPage`, and `MyComplaintsPage` existed in the frontend but had gaps:
    - Global system stats were displayed on the Citizen Dashboard instead of user-owned counts.
    - Missing static route `/api/v1/complaints/my`, which could be misidentified as dynamic route `/:id`.
    - Public tracking exposed `citizenId`.
    - No plain-language status explanations were attached to records.
    - Evidence filenames lacked strict regex validation against directory traversal attacks.
    - Idempotency tokens were not supported on complaint creation.

---

## 3. Architecture & Key File Changes

### A. Backend Architecture
| File | Changes Made |
| :--- | :--- |
| `backend/src/constants/status.constants.js` | Defined `STATUS_DESCRIPTIONS` dictionary and `getStatusDescription(status)` helper mapping each administrative status to plain-language citizen explanations. Preserved `validateStatusTransition()`. |
| `backend/src/services/complaint.service.js` | Updated `sanitizeForCitizen()` to include `statusDescription`. Implemented strict whitelist projection in `sanitizeForTracking()`, excluding `citizenId`, `citizenName`, `citizenEmail`, `citizenPhone`, `citizenAddress`, `officerNotes`, and `assignedOfficerId`. |
| `backend/src/middleware/auth.middleware.js` | Added `createTrackingRateLimiter()` and `createSubmissionRateLimiter()` to throttle public tracking requests and grievance submissions. |
| `backend/src/routes/complaint.routes.js` | Registered static route `GET /my` before dynamic `GET /:id` to prevent route collision. Added public `GET /track/:reference` route. Hardened `createComplaintSchema` with trimmed strings, description bounds (10-3000 chars), and strict evidence filename regex preventing path traversal. |
| `backend/src/controllers/complaint.controller.js` | Added `listMyComplaints()` ensuring `filters.citizenId = req.user.id`. Implemented in-memory `idempotencyCache` (10-minute TTL) in `createComplaint()`. Enforced role boundary forbidding officer accounts from filing complaints via citizen endpoint. Updated `getComplaintTracking()` to handle both reference and ID params. |
| `backend/tests/citizen.test.js` | Built 18 comprehensive automated integration tests covering all Phase 4 submission, ownership, privacy, route ordering, and persistence requirements. |

### B. Frontend Architecture
| File | Changes Made |
| :--- | :--- |
| `frontend/src/api/client.js` | Added `fetchMyComplaints(params)` targeting `/complaints/my`. Updated `fetchComplaintTracking()` targeting `/complaints/track/:ref` with fallback. Added optional `idempotencyKey` support to `createComplaint()`. |
| `frontend/src/pages/CitizenDashboard.jsx` | Replaced global stats with user-owned metrics (`Total Filed`, `Pending Triage`, `Active Remediation`, `Resolved & Closed`). Added a welcoming empty state for new citizens with zero complaints. Added status descriptions to recent grievance rows. |
| `frontend/src/pages/SubmitComplaintPage.jsx` | Added full HTML accessibility (`id`, `htmlFor`). Added client-side length and traversal checks. Attached generated `idempotencyKey` to each submission. Added submission progress spinner and enhanced confirmation screen showing generated reference, status, and next steps. Preserves input upon recoverable errors. |
| `frontend/src/pages/MyComplaintsPage.jsx` | Connected to `fetchMyComplaints()`. Added status, category, and sorting filters. Added pagination controls with prev/next buttons. Differentiated between "no complaints filed" and "no filter matches". |
| `frontend/src/pages/TrackComplaintPage.jsx` | Streamlined to consume sanitized tracking data directly from public tracking endpoint without unnecessary 401 calls. Added citizen-friendly status explanations and public privacy notice. |
| `frontend/src/pages/ComplaintDetailPage.jsx` | Added prominent citizen-friendly status meaning block. Preserved officer-action isolation. |

---

## 4. API Endpoints & Access Control Matrix

| Method | Endpoint | Auth Required | Authorized Roles | Description & Data Projection |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/complaints/stats` | None | Public | Aggregated overview metrics across system. |
| `GET` | `/api/v1/complaints/track/:reference` | None | Public | Sanitized public tracking by reference (`CS-YYYY-XXXX`). Strips PII and internal notes. |
| `GET` | `/api/v1/complaints/:id/track` | None | Public | Backward-compatible alias for public tracking. |
| `GET` | `/api/v1/complaints/my` | Yes | Citizen, Admin, Officer | Lists complaints owned strictly by `req.user.id`. Includes pagination & sorting. |
| `GET` | `/api/v1/complaints` | Yes | All roles | Role-governed listing: citizens see owned, officers see department, admins see all. |
| `GET` | `/api/v1/complaints/:id` | Yes | Owner, Dept Officer, Admin | Full detail view. Strips officer notes for citizens. Rejects cross-citizen access (403). |
| `POST` | `/api/v1/complaints` | Yes | Citizen, Admin | Submit grievance. Derives `citizenId = req.user.id`. Enforces `SUBMITTED` status. Supports idempotency key. |
| `GET` | `/api/v1/complaints/:id/history` | Yes | Owner, Dept Officer, Admin | Chronological status history. Returns citizen-safe timeline with status descriptions. |
| `PATCH`| `/api/v1/complaints/:id/status` | Yes | Officer, Admin | Validates state transition matrix. Appends history. |
| `PATCH`| `/api/v1/complaints/:id/department`| Yes| Admin only | Administrative reassignment with audit logging. |
| `POST` | `/api/v1/complaints/:id/notes` | Yes | Officer, Admin | Append internal review note. Invisible to citizens. |

---

## 5. Security & Verification Checks

| Check | Requirement | Result | Evidence / Details |
| :--- | :--- | :--- | :--- |
| **SEC-01** | Public registration creates citizen only | `PASS` | `POST /api/v1/auth/register` creates only role `citizen`. Tested in `auth.test.js`. |
| **SEC-02** | Valid grievance submission | `PASS` | Authenticated citizen creates grievance (HTTP 201), receiving unique `CS-YYYY-XXXX` reference. Tested in `citizen.test.js` #1. |
| **SEC-03** | Server-side validation | `PASS` | Rejects short title (<3 chars), missing location, whitespace narrative, long narrative (>3000 chars) with HTTP 400. Tested in `citizen.test.js` #2, #3. |
| **SEC-04** | Directory traversal in evidence blocked | `PASS` | Filenames like `../../etc/passwd` rejected with HTTP 400 validation error. Tested in `citizen.test.js` #4. |
| **SEC-05** | Identity spoofing prevention | `PASS` | Supplying `citizenId`, `status: RESOLVED`, or `officerNotes` in request body is ignored; server enforces `req.user.id` and initial `SUBMITTED`. Tested in `citizen.test.js` #6. |
| **SEC-06** | Unauthenticated submission rejected | `PASS` | Missing token on `POST /api/v1/complaints` returns HTTP 401. Tested in `citizen.test.js` #7. |
| **SEC-07** | Officer submission prevention | `PASS` | Officers cannot submit complaints using citizen endpoint (HTTP 403). Tested in `citizen.test.js` #8. |
| **SEC-08** | Route ordering integrity | `PASS` | `GET /api/v1/complaints/my` returns user list and is not captured by `/:id` (HTTP 200). Tested in `citizen.test.js` #9. |
| **SEC-09** | Cross-citizen isolation | `PASS` | Citizen B cannot list Citizen A's complaints or view Citizen A's complaint detail (HTTP 403). Tested in `citizen.test.js` #10, #11. |
| **SEC-10** | History access authorization | `PASS` | Citizen B cannot retrieve Citizen A's status history (HTTP 403). Tested in `citizen.test.js` #12. |
| **SEC-11** | Internal officer notes confidentiality | `PASS` | Citizen never receives `officerNotes` in grievance detail or list responses. Tested in `citizen.test.js` #13. |
| **SEC-12** | Public tracking PII scrubbing | `PASS` | `GET /api/v1/complaints/track/:ref` returns public lifecycle without leaking `citizenId`, citizen contact info, or officer notes. Tested in `citizen.test.js` #14. |
| **SEC-13** | Safe not-found tracking error | `PASS` | Unknown tracking reference returns clean HTTP 404 without leaking stack trace. Tested in `citizen.test.js` #16. |
| **SEC-14** | Duplicate submission / Idempotency protection | `PASS` | Repeated submission with same `Idempotency-Key` returns identical created reference and inserts no duplicate record. Tested in `citizen.test.js` #17. |
| **SEC-15** | JSON persistence integrity | `PASS` | Created complaint and status history survive fresh repository instantiation. Tested in `citizen.test.js` #18. |
| **SEC-16** | MongoDB adapter compatibility | `PASS` | Mongoose schema validates `citizenId`, `referenceNumber`, and status history models. Adapter tests pass. |
| **SEC-17** | Live MongoDB operational status | `NOT VERIFIED`| Local development uses JSON adapter (`data/complaints.json`). No live MongoDB daemon on localhost:27017. |
| **SEC-18** | Frontend build verification | `PASS` | `npm run build` succeeds cleanly with 0 errors (`vite build` in 4.66s). |

---

## 6. Automated Test Results

### Test Execution Summary
```
node --test tests/**/*.test.js

✔ CivicSarthi Core Platform & Legacy API Tests (24/24 passed)
✔ CivicSarthi Phase 3 Authentication, Sessions & RBAC Tests (17/17 passed)
✔ CivicSarthi Phase 4 Citizen Grievance Submission and Tracking Tests (18/18 passed)
✔ CivicSarthi Phase 2 Persistence Layer Tests (14/14 passed)

Total Test Suites: 7
Total Tests: 73
Passed: 73
Failed: 0
Cancelled: 0
Skipped: 0
Duration: ~5.9s
```

### Frontend Build Summary
```
npm --prefix frontend run build

vite v6.4.4 building for production...
✓ 1655 modules transformed.
dist/index.html                   0.73 kB │ gzip:  0.41 kB
dist/assets/index-CCE1b1Md.css   28.79 kB │ gzip:  5.61 kB
dist/assets/index-CPtAdILC.js   351.17 kB │ gzip: 97.76 kB
✓ built in 4.66s
```

---

## 7. Local Setup & Running Instructions

### Running on Windows PowerShell
```powershell
# 1. Run complete automated test suite (all 73 tests)
npm.cmd test

# 2. Build frontend production bundle
npm.cmd --prefix frontend run build

# 3. Start development servers
# Terminal 1: Backend API (port 5000)
npm.cmd --prefix backend dev

# Terminal 2: Frontend Client (port 5173)
npm.cmd --prefix frontend dev
```

### Citizen User Flow
1. Open `http://localhost:5173/register` to register as a citizen.
2. Log in at `http://localhost:5173/login`.
3. Navigate to **Submit Grievance** (`/citizen/submit`), fill in title, narrative, location, and optional evidence.
4. Review the confirmation screen showing the unique reference number (e.g., `CS-2026-0020`).
5. Open **Track Status** (`/citizen/track`) in an Incognito window without logging in, search by reference number, and verify public lifecycle transparency without PII leakage.
6. Open **My Complaints** (`/citizen/complaints`) to view your personal filings with status explanations.

---

## 8. Remaining Limitations & Next Phase Recommendations

- **Physical File Storage:** In Phase 4, evidence attachments are represented by validated metadata and citation filenames. Actual multi-part binary file storage (e.g., S3 or protected local disk with virus scanning) can be integrated in later phases.
- **Recommended Next Phase:** **Phase 5 — Officer Operations and Department Workflow** (triage cockpits, departmental queues, SLA escalation workflows, and structured status transitions).
