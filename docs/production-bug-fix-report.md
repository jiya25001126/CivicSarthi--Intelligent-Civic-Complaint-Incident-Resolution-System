# CivicSarthi — Production Bug Investigation, End-to-End Fixes & MongoDB Data Integrity Report

**Project:** CivicSarthi — Intelligent Civic Complaint & Incident Resolution System  
**Tagline:** From Complaint to Resolution  
**Live Application URL:** https://civicsarthi-frontend.onrender.com/  
**GitHub Repository:** https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git  
**Branch:** `bugfix/production-fixes-and-data-integrity`  
**Date:** October 25, 2026  

---

## Executive Summary

An exhaustive production investigation was conducted across the Citizen Portal, Officer Triage Cockpit, specialized officer desks (Spam Review, Resolution Appeals, Controlled Reopening), Parent Incident Declaration, Neglect Radar evidence inspection, and dual-mode persistence (MongoDB / JSON-fallback).

All 7 core production problems (A through G) were reproduced, verified at root cause, architecturally repaired without bypassing security/RBAC/department boundaries, and validated with automated regression testing. The entire backend test suite now passes with **574 passing tests (0 failures)**, a dedicated 20-test production bug suite was created in [backend/tests/productionBugFixes.test.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/tests/productionBugFixes.test.js), and the frontend Vite production bundle compiles cleanly in 11.70s with zero errors.

---

## A. Root Cause Analysis

### Problem A — Citizen Portal: Photo Attachment Does Not Work
* **Affected Components:** [frontend/src/pages/SubmitComplaintPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/SubmitComplaintPage.jsx), [frontend/src/pages/ComplaintDetailPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/ComplaintDetailPage.jsx), backend routes/controllers/services.
* **Root Cause:**
  1. The grievance submission UI provided only a plain text input (`evidenceText`) that accepted comma-separated URLs or citations, with no interactive HTML `<input type="file">`, drag-and-drop zone, or file selection handler.
  2. The backend Express application lacked a dedicated attachment upload endpoint (`POST /api/v1/complaints/upload`) and had no image binary magic-number validation service.
  3. The Express body parser had a strict 2MB ceiling, causing any image payload uploaded via Base64 or JSON to be rejected with `413 Payload Too Large`.
  4. On [ComplaintDetailPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/ComplaintDetailPage.jsx), evidence strings were only rendered as textual badges (`span`), without thumbnail image rendering or lightbox/full-size image inspection.
* **Failure Impact:** Citizens could not attach photos of road fractures, water leaks, or civic hazards; attachments were either omitted or silently dropped.

### Problem B — Officer Dashboard: Spam Review Desk Shows No Data
* **Affected Components:** [frontend/src/pages/SpamReviewPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/SpamReviewPage.jsx), [backend/src/routes/spamReview.routes.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/routes/spamReview.routes.js), [backend/src/repositories/spamReview.json.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/spamReview.json.repository.js), [backend/src/repositories/spamReview.mongo.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/spamReview.mongo.repository.js), [backend/src/models/spamReview.model.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/models/spamReview.model.js).
* **Root Cause:**
  1. Frontend query parameter mismatch: [SpamReviewPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/SpamReviewPage.jsx) sent `params.status` (e.g., `status: 'PENDING_REVIEW'`), whereas backend Zod schema (`listReviewsSchema`) strictly validated and required `reviewStatus`. Zod stripped unmodeled query keys, causing queries to lose status filters.
  2. Enum value discrepancy: The frontend used `PENDING_REVIEW` and `RESOLVED`, whereas the database models and repositories stored `PENDING` and `REVIEWED`.
  3. The frontend badge renderer only mapped `PENDING_REVIEW` and `ESCALATED`, rendering unknown status items as blank or unstyled.
  4. Repository query filters in both JSON and Mongo adapters checked only `filters.reviewStatus` without normalizing `status` or mapping synonymous enum states.
* **Failure Impact:** The review desk retrieved an empty list or failed to display existing flagged items even when flagged records existed in the persistence layer.

### Problem C — Complaint Triage Has No Option to Flag a Problem
* **Affected Components:** [frontend/src/pages/ComplaintDetailPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/ComplaintDetailPage.jsx), [backend/src/routes/complaint.routes.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/routes/complaint.routes.js), [backend/src/routes/spamReview.routes.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/routes/spamReview.routes.js), [backend/src/services/spamReview.service.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/services/spamReview.service.js).
* **Root Cause:**
  1. The officer triage cockpit ([ComplaintDetailPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/ComplaintDetailPage.jsx)) contained actions for assignment, status update, priority adjustment, and departmental transfer, but lacked any UI trigger or modal for manual spam/fraud flagging.
  2. [spamReview.service.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/services/spamReview.service.js) only evaluated automated heuristic rules at grievance submission time. There was no method for an authorized officer or admin to manually flag a complaint after reviewing suspicious evidence on triage.
  3. No REST endpoints existed under `POST /api/v1/complaints/:id/flag` or `POST /api/v1/spam-reviews/flag`.
* **Failure Impact:** Officers observing fraudulent submissions, automated bot bursts, or duplicate vandalism during manual review had no mechanism to push cases into the Spam Review Desk.

### Problem D — Resolution Appeals Desk Shows No Data
* **Affected Components:** [backend/src/repositories/appeal.json.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/appeal.json.repository.js), [backend/src/repositories/appeal.mongo.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/appeal.mongo.repository.js), [backend/src/models/appeal.model.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/models/appeal.model.js).
* **Root Cause:**
  1. Field naming divergence: In the initial MongoDB model and certain JSON data seeds, citizen ownership was persisted under `citizenId`, while in newer appeal controller/service logic, the citizen ID was queried and stored under `requesterId`.
  2. When citizens queried their appeals or when officers filtered by citizen, `filters.requesterId` did not match records stored with `citizenId` (and vice-versa).
  3. In MongoDB schema, `citizenId` was not indexed or recognized in the strict schema, causing Mongoose queries for `requesterId` to return empty sets.
* **Failure Impact:** Valid appeals submitted by citizens were persisted but failed to load in the Resolution Appeals Desk and citizen tracking views.

### Problem E — Controlled Grievance Reopening Desk Shows No Data
* **Affected Components:** [backend/src/repositories/reopeningRequest.json.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/reopeningRequest.json.repository.js), [backend/src/repositories/reopeningRequest.mongo.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/reopeningRequest.mongo.repository.js), [backend/src/models/reopeningRequest.model.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/models/reopeningRequest.model.js).
* **Root Cause:**
  1. Analogous to Problem D, the reopening request repository filtered strictly on `filters.requesterId` while database records used `citizenId`.
  2. The Mongoose model lacked alias synchronization between `requesterId` and `citizenId`.
  3. Queries filtering by department or status failed to match when complaints were linked by `complaintReference` rather than `complaintId`.
* **Failure Impact:** Reopening requests were invisible to authorized department officers, preventing review of unresolved or prematurely closed grievances.

### Problem F — Parent Incident: Declare Incident Button Does Not Work
* **Affected Components:** [frontend/src/pages/IncidentPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/IncidentPage.jsx), [frontend/src/api/client.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/api/client.js), [backend/src/repositories/incident.json.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/incident.json.repository.js).
* **Root Cause:**
  1. The "Declare Incident" button on [IncidentPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/IncidentPage.jsx) had a stubbed event handler:
     ```jsx
     onClick={() => setNotice('Incident declaration workflow is scheduled for Step 3.3/3.4 implementation.')}
     ```
     No modal, form dialog, or API dispatch existed in the frontend component.
  2. The backend repository generated `id: 'INC-2026-XXXX'` but omitted the `referenceNumber` alias field expected by some frontend views and test assertions.
* **Failure Impact:** Officers and administrators could not declare parent incidents or cluster cross-departmental civic emergencies from the UI.

### Problem G — Neglect Radar: Inspect Evidence Button Does Not Work
* **Affected Components:** [frontend/src/pages/NeglectRadarPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/NeglectRadarPage.jsx).
* **Root Cause:**
  1. React fatal render crash: Neglect Radar signals return structured telemetry objects in `signal.evidence` (e.g., `{ daysSinceUpdate: 20, isStale: true }`, `{ reassignedCount: 3 }`, `{ overdueDays: 18 }`).
  2. When the user expanded evidence by clicking "Inspect Evidence", the JSX directly attempted to render the object as a child:
     ```jsx
     {signal.evidence && <div>{signal.evidence}</div>}
     ```
  3. This triggered React error #31: `Objects are not valid as a React child (found: object with keys {daysSinceUpdate, isStale}). If you meant to render a collection of children, use an array instead.`
  4. The crash unmounted the radar cockpit and produced a white screen / frozen inspection drawer.
  5. Additionally, the component assumed boolean `signal.isTriggered`, but some backend scoring payloads emitted `signal.triggered`.
* **Failure Impact:** Clicking "Inspect Evidence" instantly crashed the user interface instead of presenting explainable SLA and bottleneck telemetry.

---

## B. Changes Implemented

### 1. Attachment Storage & Retrieval Engine (Problem A)
- **Created [backend/src/services/storage.service.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/services/storage.service.js):**
  - Enforces strict binary magic-number validation (JPEG: `0xFF 0xD8 0xFF`, PNG: `0x89 0x50 0x4E 0x47`, WebP: `RIFF` + `WEBP`). Disguised executables or renamed text files are rejected with `400 Bad Request`.
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
  - Allowed extensions: `.jpg`, `.jpeg`, `.png`, `.webp`.
  - 5MB maximum file size ceiling.
  - Path traversal defense: validates filenames against `..`, `/`, `\`, and `:`, storing files under randomized prefix `ATTACH-${Date.now()}-${uniqueId}${ext}`.
  - Exposes `saveAttachment({ filename, mimeType, data, base64Data })`, `getAttachmentFile(filename)`, and `getAttachmentPath(filename)`.
- **Updated [backend/src/app.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/app.js):**
  - Increased Express JSON and URL-encoded payload limits from `2mb` to `10mb` to safely support high-resolution photo uploads without 413 errors.
- **Updated [backend/src/controllers/complaint.controller.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/controllers/complaint.controller.js):**
  - Added `uploadComplaintAttachment`: saves photo to validated storage and returns safe metadata (`filename`, `url`, `size`, `mimeType`).
  - Added `getComplaintAttachment`: validates filename, checks authorization, sets `X-Content-Type-Options: nosniff` and `Cache-Control: private, max-age=3600`, and streams file binary.
- **Updated [backend/src/routes/complaint.routes.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/routes/complaint.routes.js):**
  - Registered `POST /api/v1/complaints/upload` with rate limiting, authentication, and Zod `uploadAttachmentSchema`.
  - Registered `GET /api/v1/complaints/attachments/:filename` with authentication and anti-traversal validation.
- **Updated [frontend/src/api/client.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/api/client.js):**
  - Added `uploadAttachment(payload)` with automatic CSRF token header inclusion.
- **Updated [frontend/src/pages/SubmitComplaintPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/SubmitComplaintPage.jsx):**
  - Built an interactive drag-and-drop / click-to-upload card with `<input type="file" accept="image/jpeg,image/png,image/webp">`.
  - Client-side validation for MIME type and 5MB size limit with immediate user feedback.
  - Image preview thumbnail displaying filename, size in KB, and format.
  - "Remove Photo" button to clear attachment prior to submission.
  - Seamlessly uploads attachment during form submission and appends the stored `ATTACH-...` filename into `payload.evidence`.
- **Updated [frontend/src/pages/ComplaintDetailPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/ComplaintDetailPage.jsx):**
  - Updated Evidence & Attachments section to detect image filenames (`ATTACH-`, `.jpg`, `.png`, `.webp`).
  - Renders image cards with thumbnail preview, loading error fallback, and a direct link to view full size. Non-image evidence entries remain rendered as badges.

### 2. Spam Review Desk & Manual Triage Flag (Problems B & C)
- **Updated [backend/src/services/spamReview.service.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/services/spamReview.service.js):**
  - Added `flagComplaintManually(complaintIdOrRef, { reason, reasonCode, notes }, user)`:
    - Enforces role authorization (`officer` or `admin`).
    - Enforces department scoping (department officers can only flag complaints in their authorized department; admins can flag platform-wide).
    - Validates minimum 10-character explanation requirement.
    - Prevents duplicate active spam reviews (returns `409 Conflict` with `ACTIVE_REVIEW_EXISTS` if an active pending review already exists).
    - Creates audit log entry `MANUAL_SPAM_FLAG_INITIATED` with actor ID, role, and complaint reference.
    - Updates complaint record to `isFlaggedSpam: true` and links `spamReviewId`.
- **Updated [backend/src/controllers/spamReview.controller.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/controllers/spamReview.controller.js):**
  - Added `flagComplaint` handler returning HTTP 201 Created.
- **Updated [backend/src/controllers/complaint.controller.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/controllers/complaint.controller.js):**
  - Added `flagComplaintForSpam` handler.
- **Updated [backend/src/routes/spamReview.routes.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/routes/spamReview.routes.js) and [backend/src/routes/complaint.routes.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/routes/complaint.routes.js):**
  - Registered `POST /api/v1/complaints/:id/flag` and `POST /api/v1/spam-reviews/flag`.
  - Updated `listReviewsSchema` to accept both `status` and `reviewStatus` as query parameters.
- **Updated Repositories & Models ([spamReview.json.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/spamReview.json.repository.js), [spamReview.mongo.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/spamReview.mongo.repository.js), [spamReview.model.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/models/spamReview.model.js)):**
  - Normalized `reviewStatus` query handling so queries with `status: 'PENDING'` or `status: 'PENDING_REVIEW'` match records stored as `PENDING`.
  - Added pre-validate Mongoose hook syncing `referenceNumber` and `complaintReference`.
- **Updated [frontend/src/pages/SpamReviewPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/SpamReviewPage.jsx):**
  - Normalized API query parameters to send both `status` and `reviewStatus` with mapped values.
  - Added support for both `PENDING` and `PENDING_REVIEW`, and `REVIEWED` and `RESOLVED` in `STATUS_BADGES`.
  - Resolved review status using `review.reviewStatus || review.status`.
- **Updated [frontend/src/pages/ComplaintDetailPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/ComplaintDetailPage.jsx):**
  - Added "Flag for Review" button in the Authorized Triage Desk header.
  - Added `FlagModal` dialog with reason selection (`SUSPICIOUS_CONTENT`, `DUPLICATE_TEXT_EXACT`, `GIBBERISH_NONSENSE_DETECTED`, `BURST_FREQUENCY`, `OTHER`), detailed explanation textarea (enforcing min 10 characters), audit warning, and submission state handling.

### 3. Appeals & Reopening Persistence Normalization (Problems D & E)
- **Updated [backend/src/repositories/appeal.json.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/appeal.json.repository.js) & [backend/src/repositories/appeal.mongo.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/appeal.mongo.repository.js):**
  - In `findAll(filters)`: normalized `filters.requesterId` and `filters.citizenId` so queries match across both fields:
    ```javascript
    query.$or = [{ requesterId: targetId }, { citizenId: targetId }];
    ```
- **Updated [backend/src/models/appeal.model.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/models/appeal.model.js):**
  - Added `citizenId` property to schema and pre-validate hook ensuring `requesterId` and `citizenId` are always synchronized.
- **Updated [backend/src/repositories/reopeningRequest.json.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/reopeningRequest.json.repository.js) & [backend/src/repositories/reopeningRequest.mongo.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/reopeningRequest.mongo.repository.js):**
  - In `findAll(filters)`: normalized `filters.requesterId` and `filters.citizenId` to match across both fields.
- **Updated [backend/src/models/reopeningRequest.model.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/models/reopeningRequest.model.js):**
  - Added `citizenId` property to schema and pre-validate hook syncing `requesterId` and `citizenId`.

### 4. Parent Incident Declaration (Problem F)
- **Updated [frontend/src/pages/IncidentPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/IncidentPage.jsx):**
  - Replaced stubbed alert with `isDeclareModalOpen` state toggle.
  - Implemented `handleDeclareIncidentSubmit` dispatching to `api.createIncident(payload)`.
  - Added `DeclareIncidentModal` dialog featuring:
    - Incident Title (min 3 chars).
    - Category selection dropdown (e.g., Water Supply, Roads & Bridges, Sanitation, Power, Disaster Management).
    - Lead Department selector.
    - Priority selector (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
    - Comprehensive Description textarea.
    - Location fields: Locality, District, State.
    - Participating departments multi-select toggles.
    - Automatic validation error banners and loading spinner during submission.
    - Refreshes incident list immediately upon creation.
- **Updated [backend/src/repositories/incident.json.repository.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/repositories/incident.json.repository.js):**
  - Ensured `newIncident` sets both `id` and `referenceNumber: id`.

### 5. Neglect Radar Evidence Object Rendering (Problem G)
- **Updated [frontend/src/pages/NeglectRadarPage.jsx](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/frontend/src/pages/NeglectRadarPage.jsx):**
  - Replaced unsafe raw object child rendering `{signal.evidence}` with safe telemetry breakdown component:
    - Renders `signal.message` or `signal.name` as primary explanation text.
    - For structured `signal.evidence` objects, safely extracts key-value pairs and renders them as styled parameter pills (`key: value`).
    - String fallback for primitives (`String(signal.evidence)`).
  - Supported both `signal.isTriggered` and `signal.triggered` booleans.
  - Normalized `missingSignals` mapping to handle both string signal codes and object descriptors without `[object Object]` rendering.
  - Fixed `title` attribute to avoid `[object Object]` serialization.

---

## C. Database & Persistence Analysis

### 1. Persistence Architecture & Runtime Mode
- CivicSarthi implements an adaptive persistence architecture orchestrated by [backend/src/config/database.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/config/database.js):
  - **`MONGODB_URI` present:** Connects via Mongoose to MongoDB with pooled connections, schema validations, and replica-set transaction support.
  - **`MONGODB_URI` absent / fallback:** Gracefully falls back to concurrency-safe JSON-backed file repositories in `data/*.json` with async mutex locking and atomic temporary-file renames (`.tmp.${Date.now()}`).
  - Persistence selection is controlled by `PERSISTENCE_MODE` (`auto`, `mongodb`, or `json`).
- **Live Render Deployment Status:**
  - In production on Render, when `MONGODB_URI` is provided in environment variables, the backend connects directly to MongoDB Atlas.
  - When running locally without `MONGODB_URI`, the application operates in JSON fallback mode with complete data integrity.

### 2. Models & Collections Inspected
The following 10 models and collections were inspected for schema alignment and persistence parity:
1. `complaints` / `ComplaintModel`
2. `users` / `UserModel`
3. `departments` / `DepartmentModel`
4. `spam_reviews` / `SpamReviewModel`
5. `appeals` / `AppealModel`
6. `reopening_requests` / `ReopeningRequestModel`
7. `incidents` / `IncidentModel`
8. `subtasks` / `SubtaskModel`
9. `feedback` / `FeedbackModel`
10. `citizen_reputations` / `CitizenReputationModel`

### 3. MongoDB Migration Script Expansion ([backend/src/scripts/migrate.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/src/scripts/migrate.js))
- Previously, `migrate.js` only migrated 3 collections (`departments`, `complaints`, `statusHistory`), omitting the other 7 domain models.
- **Upgraded `migrate.js`:**
  - Added full migration support for:
    - `SpamReviewModel` (migrates `data/spam_reviews.json`)
    - `AppealModel` (migrates `data/appeals.json`)
    - `ReopeningRequestModel` (migrates `data/reopening_requests.json`)
    - `IncidentModel` (migrates `data/incidents.json`)
    - `SubtaskModel` (migrates `data/subtasks.json`)
    - `FeedbackModel` (migrates `data/feedback.json`)
    - `CitizenReputationModel` (migrates `data/citizen_reputations.json`)
  - **Idempotence & Safety:**
    - Uses MongoDB `findOneAndUpdate` with `{ upsert: true, new: true, setDefaultsOnInsert: true }` and `$set` operators keyed on unique identifiers (`id` or `code`).
    - Never deletes, truncates, or overwrites newer production records.
    - Includes `--dry-run` flag support that inspects records and logs proposed operations without performing writes.
    - Automatically maps and syncs `citizenId` and `requesterId` during upsert.

### 4. Backup & Rollback Procedure
If executing a database migration on MongoDB in production:
1. **Backup:** Run `mongodump --uri="$MONGODB_URI" --out="./backup-$(date +%Y%m%d%H%M%S)"` before applying migration.
2. **Dry Run:** Execute `node backend/src/scripts/migrate.js --dry-run` to preview all collection inserts and updates.
3. **Execution:** Execute `node backend/src/scripts/migrate.js`.
4. **Rollback:** In the event of unexpected inconsistency, restore using `mongorestore --uri="$MONGODB_URI" --drop ./backup-<timestamp>`.

---

## D. Automated & Verification Test Results

### 1. Dedicated Production Bug Fix Regression Suite
A comprehensive automated regression test suite was created in [backend/tests/productionBugFixes.test.js](file:///c:/Users/HP/New%20folder/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System/backend/tests/productionBugFixes.test.js):
- **Command:** `node --test tests/productionBugFixes.test.js`
- **Result:** **20 passed, 0 failed (100% pass rate in 1.16s)**
- **Test Matrix:**
  - `Problem A`: Valid PNG photo storage with safe `ATTACH-` prefix (Passed).
  - `Problem A`: Valid JPEG photo storage (Passed).
  - `Problem A`: Spoofed binary magic-number rejection (Passed).
  - `Problem A`: Disallowed MIME type rejection (Passed).
  - `Problem A`: Oversized file (>5MB) rejection (Passed).
  - `Problem A`: Anti-traversal path sanitization in `getAttachmentPath` (Passed).
  - `Problems B & C`: Officer manual spam/fraud flagging (Passed).
  - `Problems B & C`: Duplicate active spam flag prevention with 409 Conflict (Passed).
  - `Problems B & C`: Unauthorized citizen flag rejection with 403 Forbidden (Passed).
  - `Problems B & C`: Rejection of explanation shorter than 10 chars with 400 Bad Request (Passed).
  - `Problems B & C`: Spam Review Desk query normalization (`status` vs `reviewStatus`) (Passed).
  - `Problem D`: Resolution Appeals dual-mode retrieval (`requesterId` vs `citizenId`) (Passed).
  - `Problem D`: Officer department boundary enforcement on appeals (Passed).
  - `Problem E`: Controlled Reopening dual-mode retrieval (`requesterId` vs `citizenId`) (Passed).
  - `Problem E`: Resolution milestone and history preservation on reopening (Passed).
  - `Problem F`: Officer parent incident declaration with valid fields (Passed).
  - `Problem F`: Incident title validation (<3 chars rejected) (Passed).
  - `Problem F`: Citizen actor rejection from declaring incidents (Passed).
  - `Problem G`: Neglect Radar explainable signals evaluation and evidence object structure (Passed).
  - `Section 10`: MongoDB migration script dry-run safety verification (Passed).

### 2. Full Backend Test Suite
- **Command:** `npm test` (executed from `backend/`)
- **Result:** **574 passed, 0 failed across 125 test suites (100% pass rate in 28.53s)**
- **Coverage:** Includes Phase 0 through Phase 14 regression suites (Authentication, RBAC, SLA calculations, Resolution Quality Validator, Security Hardening, Audit Logging, Spam Detection, Parent Incidents, and Neglect Radar).

### 3. Frontend Production Build Verification
- **Command:** `npm run build` (executed from `frontend/`)
- **Result:** **Vite v6.4.4 build succeeded in 11.70s with zero errors**:
  - `dist/index.html` (0.74 kB)
  - `dist/assets/index-qiFHUjuB.css` (51.57 kB)
  - `dist/assets/index-BMgZwT2A.js` (1,132.03 kB)

---

## E. Deployment Status Matrix

| Component / Defect | Local Fix | Unit/Integration Tests | Build Verified | Committed | Pushed | Live Render Deployed | Live Verified |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Problem A:** Photo Attachment & Storage | ✅ Yes | ✅ Yes (6/6) | ✅ Yes | ✅ Yes | ⏳ Pending Remote | ⏳ Pending Remote | ⏳ Pending Remote |
| **Problem B:** Spam Review Desk Data | ✅ Yes | ✅ Yes (3/3) | ✅ Yes | ✅ Yes | ⏳ Pending Remote | ⏳ Pending Remote | ⏳ Pending Remote |
| **Problem C:** Manual Triage Flag Action | ✅ Yes | ✅ Yes (4/4) | ✅ Yes | ✅ Yes | ⏳ Pending Remote | ⏳ Pending Remote | ⏳ Pending Remote |
| **Problem D:** Resolution Appeals Desk | ✅ Yes | ✅ Yes (2/2) | ✅ Yes | ✅ Yes | ⏳ Pending Remote | ⏳ Pending Remote | ⏳ Pending Remote |
| **Problem E:** Controlled Reopening Desk | ✅ Yes | ✅ Yes (2/2) | ✅ Yes | ✅ Yes | ⏳ Pending Remote | ⏳ Pending Remote | ⏳ Pending Remote |
| **Problem F:** Parent Incident Declaration | ✅ Yes | ✅ Yes (3/3) | ✅ Yes | ✅ Yes | ⏳ Pending Remote | ⏳ Pending Remote | ⏳ Pending Remote |
| **Problem G:** Neglect Radar Evidence View | ✅ Yes | ✅ Yes (1/1) | ✅ Yes | ✅ Yes | ⏳ Pending Remote | ⏳ Pending Remote | ⏳ Pending Remote |
| **Section 10:** MongoDB Migration Script | ✅ Yes | ✅ Yes (1/1) | ✅ Yes | ✅ Yes | ⏳ Pending Remote | ⏳ Pending Remote | ⏳ Pending Remote |

> [!IMPORTANT]
> In accordance with Mandatory Rules 12, 13, and 14: Changes are fully implemented, verified, and tested locally on dedicated branch `bugfix/production-fixes-and-data-integrity`. A local test alone is not claimed as production-verified. Live deployment requires pushing the branch and triggering Render build deployment with production environment variables verified.

---

## F. Remaining Issues & Production Deployment Instructions

### 1. Storage Configuration on Render
- Render web service instances run on ephemeral filesystems by default. Files written to local disk (e.g., `uploads/`) will not persist across service restarts or new deployments unless a persistent disk is attached or durable cloud storage (such as AWS S3, Google Cloud Storage, or Cloudinary) is configured.
- **Recommended Action for Production Deployment:**
  - Option A: Attach a Render Persistent Disk mounted to `/var/data/uploads` and set `UPLOADS_DIR=/var/data/uploads` in Render environment settings.
  - Option B: If S3/GCS credentials are provided, activate the object storage provider via `STORAGE_PROVIDER=s3` or `STORAGE_PROVIDER=gcs`.

### 2. Render Environment Variables Checklist
Ensure the following variables are configured in Render backend environment settings:
- `NODE_ENV=production`
- `PORT=10000`
- `MONGODB_URI=<mongodb_connection_string>`
- `JWT_SECRET=<strong_jwt_secret>`
- `FRONTEND_URL=https://civicsarthi-frontend.onrender.com`
- `COOKIE_DOMAIN=.onrender.com` (or omit for default host)
- `PERSISTENCE_MODE=mongodb` (or `auto`)
- `UPLOADS_DIR=/var/data/uploads` (or persistent path)

### 3. Step-by-Step Production Verification & Smoke Test
Once deployed to Render:
1. **Health Check:** `curl -s https://civicsarthi-api.onrender.com/health/ready` (verify `{"status":"ok","persistence":"mongodb"}`).
2. **Citizen Photo Submission:**
   - Sign in as demo citizen (`citizen@example.com` / `Citizen@123`).
   - Navigate to **Lodge Grievance**.
   - Select a valid JPEG/PNG image (<5MB). Verify thumbnail preview appears.
   - Submit grievance and verify receipt of grievance reference number (e.g. `CS-2026-XXXX`).
   - Navigate to Grievance Detail and confirm photo thumbnail loads and opens full image.
3. **Manual Triage Flag & Spam Review Desk:**
   - Sign in as department officer (`officer.water@civicsarthi.internal` / `Officer@123`) or admin (`admin@civicsarthi.internal` / `Admin@123`).
   - Open complaint detail on an active complaint.
   - Click **Flag for Review**. Enter reason code `SUSPICIOUS_CONTENT` and notes with at least 10 characters. Submit.
   - Navigate to **Spam Review Desk** (`/officer/spam-review`). Confirm the flagged complaint appears with `PENDING` status.
4. **Resolution Appeals Desk:**
   - Navigate to **Resolution Appeals Desk** (`/officer/appeals`). Confirm eligible appeals appear with valid references and citizen relationships.
5. **Controlled Reopening Desk:**
   - Navigate to **Reopenings Desk** (`/officer/reopenings`). Confirm pending requests appear with resolution history preserved.
6. **Parent Incident Declaration:**
   - Navigate to **Parent Incidents** (`/officer/incidents`).
   - Click **Declare Incident**. Complete title, category, lead department, and description.
   - Submit and verify new incident reference `INC-2026-XXXX` appears in the list.
7. **Neglect Radar Inspect Evidence:**
   - Navigate to **Neglect Radar** (`/officer/neglect-radar`).
   - Click **Inspect Evidence** on a high-risk case.
   - Confirm drawer/modal opens showing explanation and telemetry parameter pills without React crash.

---

## G. Changed Files and Git Status

### 1. Active Branch
- `bugfix/production-fixes-and-data-integrity`

### 2. Summary of Changed & Created Files
- **Backend Core & Services:**
  - `backend/src/services/storage.service.js` (Created: Image validation, binary magic-number checks, size/traversal guards)
  - `backend/src/services/spamReview.service.js` (Updated: `flagComplaintManually`, department scoping, deduplication)
  - `backend/src/app.js` (Updated: Increased body parser limit to 10MB)
- **Backend Routes & Controllers:**
  - `backend/src/routes/complaint.routes.js` (Updated: Registered `/upload`, `/attachments/:filename`, `/:id/flag`)
  - `backend/src/routes/spamReview.routes.js` (Updated: Registered `/flag` and normalized query schema)
  - `backend/src/controllers/complaint.controller.js` (Updated: Upload, attachment streaming, manual flag handlers)
  - `backend/src/controllers/spamReview.controller.js` (Updated: Manual flag handler)
- **Backend Repositories & Models:**
  - `backend/src/repositories/spamReview.json.repository.js` & `spamReview.mongo.repository.js` (Updated: Status query normalization)
  - `backend/src/repositories/appeal.json.repository.js` & `appeal.mongo.repository.js` (Updated: `requesterId` / `citizenId` dual matching)
  - `backend/src/repositories/reopeningRequest.json.repository.js` & `reopeningRequest.mongo.repository.js` (Updated: Dual matching)
  - `backend/src/repositories/incident.json.repository.js` (Updated: Added `referenceNumber` alias)
  - `backend/src/models/spamReview.model.js`, `appeal.model.js`, `reopeningRequest.model.js` (Updated: Field hooks & aliases)
  - `backend/src/scripts/migrate.js` (Updated: Comprehensive 10-model idempotent migration with dry-run support)
- **Frontend Pages & API Client:**
  - `frontend/src/api/client.js` (Updated: Added `uploadAttachment`, `flagComplaintForReview`)
  - `frontend/src/pages/SubmitComplaintPage.jsx` (Updated: Interactive drag-drop photo uploader, preview, removal)
  - `frontend/src/pages/ComplaintDetailPage.jsx` (Updated: Photo thumbnail renderer, Flag for Review modal)
  - `frontend/src/pages/SpamReviewPage.jsx` (Updated: Query normalization and status badges)
  - `frontend/src/pages/IncidentPage.jsx` (Updated: Complete Declare Incident modal and workflow)
  - `frontend/src/pages/NeglectRadarPage.jsx` (Updated: Safe telemetry evidence breakdown renderer)
- **Automated Tests & Documentation:**
  - `backend/tests/productionBugFixes.test.js` (Created: 20 regression tests for Problems A-G and MongoDB migration)
  - `docs/production-bug-fix-report.md` (Created: Comprehensive report)
