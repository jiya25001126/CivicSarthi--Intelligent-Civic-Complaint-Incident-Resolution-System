# CivicSarthi Phase 12 Implementation Report
## Citizen-Initiated Clarification, Reminders & Status Translator

> **Product:** CivicSarthi — Intelligent Civic Complaint & Incident Resolution System<br>
> **Tagline:** “From Complaint to Resolution.”<br>
> **Repository:** `https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git`<br>
> **Implementation Date:** October 13, 2026<br>
> **Dedicated Phase Branch:** `phase-12-clarification-reminders-status-translator`<br>
> **Verification Status:** **VERIFIED (Phase 12 Suite: 24/24 Passed; Full Regression: 388/388 Passed across 76 Suites; Frontend Production Build: Clean)**

---

## 1. Executive Summary & Delivered Scope

Phase 12 delivers the citizen empowerment triad for CivicSarthi:
1. **Feature A — Citizen-Initiated Clarification Threads (`ClarificationService`):**
   - Enables authenticated citizens to ask clarifying questions or submit supplementary context / landmark information for complaints they filed.
   - Preserves official complaint lifecycle status without silent transitions or accidental auto-resolution.
   - Enforces an auditable thread lifecycle (`OPEN` &rarr; `RESPONDED` &rarr; `CLOSED`).
   - Restricts officer viewing and responding strictly to complaints within their assigned department (`DEPT_ROADS`, `DEPT_WATER`, etc.).
   - Distinguishes citizen-visible official responses from private internal officer notes, with zero confidential leakage.
   - Implements anti-spam throttling (limiting active open clarification queries per complaint).
2. **Feature B — Citizen Follow-Up Reminders (`ReminderService`):**
   - Allows citizens to trigger follow-up reminders for their own active grievances.
   - Verifies complaint eligibility: complaints in `RESOLVED` or `CLOSED` state are rejected.
   - Implements server-side cooldown enforcement (configurable via `REMINDER_COOLDOWN_HOURS`, default 24h) and duplicate request prevention, returning HTTP 429 with remaining cooldown minutes.
   - Strictly records in-app delivery transparently (`deliveryChannel: 'IN_APP'`, `deliveryStatus: 'LOGGED_IN_APP'`), avoiding false claims that external SMS/Email was dispatched when unconfigured.
   - Maintains auditable reminder records without mutating official complaint status.
3. **Feature C — Citizen-Friendly Vernacular Status Translator (`StatusTranslatorService`):**
   - Converts bureaucratic status codes (`UNDER_REVIEW`, `IN_PROGRESS`, `AWAITING_INFORMATION`, etc.) into plain-language explanations in English (`en`) and Hindi (`hi`).
   - Breaks down each status into 4 distinct dimensions:
     1. **Meaning:** Plain explanation of what the status indicates.
     2. **What Happened:** Concrete progress milestones based on verified complaint data (e.g. registration date, division handoffs).
     3. **Next Steps:** Actionable, reassuring guidance on what the citizen can reasonably do next.
     4. **SLA & Timeline:** Expected departmental turnaround and SLA targets.
   - Built on a deterministic bilingual template engine with offline-first availability.
   - Optional AI enhancement hook safely catches external provider failures and gracefully degrades to deterministic templates.
   - Guarantees zero leakage of internal notes, officer identities, fraud/spam screening scores, or citizen reputation signals.
   - Status translation is strictly read-only and never modifies the underlying grievance status.

---

## 2. Architecture & File Layout

```
backend/
├── src/
│   ├── constants/
│   │   └── clarification.constants.js        [NEW] Lifecycles, thresholds, reminder bounds, bilingual translation maps
│   ├── models/
│   │   ├── clarification.model.js            [NEW] Mongoose schema for clarification threads & responses
│   │   ├── reminder.model.js                 [NEW] Mongoose schema for citizen follow-up reminders
│   │   └── index.js                          [MODIFIED] Exported ClarificationModel and ReminderModel
│   ├── repositories/
│   │   ├── clarification.repository.js       [NEW] Factory with anti-silent fallback facade
│   │   ├── clarification.json.repository.js  [NEW] Mutex-protected JSON storage (CLR-YYYY-XXXX)
│   │   ├── clarification.mongo.repository.js [NEW] MongoDB Mongoose persistence adapter
│   │   ├── reminder.repository.js            [NEW] Factory with anti-silent fallback facade
│   │   ├── reminder.json.repository.js       [NEW] Mutex-protected JSON storage (REM-YYYY-XXXX)
│   │   ├── reminder.mongo.repository.js      [NEW] MongoDB Mongoose persistence adapter
│   │   ├── complaint.json.repository.js      [MODIFIED] Preserved explicit complaint status upon creation
│   │   └── index.js                          [MODIFIED] Exported Clarification & Reminder repositories
│   ├── services/
│   │   ├── clarification.service.js          [NEW] Clarification validation, thread lifecycles, and RBAC
│   │   ├── reminder.service.js               [NEW] Reminder eligibility, cooldown throttling, and in-app logs
│   │   └── statusTranslator.service.js       [NEW] Bilingual status translation engine & safe fallback
│   ├── controllers/
│   │   ├── clarification.controller.js       [NEW] HTTP endpoints for clarification threads
│   │   ├── reminder.controller.js            [NEW] HTTP endpoints for follow-up reminders & cooldowns
│   │   └── statusTranslator.controller.js    [NEW] HTTP endpoints for bilingual status explanations
│   ├── routes/
│   │   ├── clarification.routes.js           [NEW] Routes with Zod validation & auth guards
│   │   ├── reminder.routes.js                [NEW] Routes with Zod validation & auth guards
│   │   ├── complaint.routes.js               [MODIFIED] Nested /:id/clarifications, /:id/reminders, /:id/status-explanation
│   │   └── index.js                          [MODIFIED] Mounted /clarifications and /reminders
│   ├── middleware/
│   │   └── error.middleware.js               [MODIFIED] Included err.code in client error responses
│   └── config/
│       └── app.config.js                     [MODIFIED] Configured clarifications, reminders paths & cooldowns
├── data/
│   ├── clarifications.json                   [NEW] Baseline JSON fixture
│   └── reminders.json                        [NEW] Baseline JSON fixture
└── tests/
    └── clarification.test.js                 [NEW] Comprehensive 24-test Phase 12 verification suite

frontend/
├── src/
│   ├── api/
│   │   └── client.js                         [MODIFIED] Added 10 Phase 12 API methods
│   └── pages/
│       ├── StatusTranslatorPage.jsx          [MODIFIED] Interactive dedicated Vernacular Status Translator
│       ├── TrackComplaintPage.jsx            [MODIFIED] Integrated bilingual status translation card
│       └── ComplaintDetailPage.jsx          [MODIFIED] Added Clarification threads, Reminder card & Translator widget
```

---

## 3. API Endpoints & Authorization Rules

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/complaints/:id/clarifications` | `citizen` (owner) | Submit clarification question or additional information |
| `GET` | `/api/v1/complaints/:id/clarifications` | `citizen` (owner), `officer` (dept), `admin` | List clarifications for a specific grievance |
| `GET` | `/api/v1/clarifications` | `citizen` (own), `officer` (dept), `admin` (all) | List clarification requests scoped by caller role |
| `GET` | `/api/v1/clarifications/:id` | `citizen` (owner), `officer` (dept), `admin` | View single clarification thread details |
| `POST` | `/api/v1/clarifications/:id/respond` | `officer` (assigned dept), `admin` | Submit citizen-visible department response |
| `POST` | `/api/v1/clarifications/:id/close` | `citizen` (owner), `officer` (dept), `admin` | Close answered clarification thread |
| `POST` | `/api/v1/complaints/:id/reminders` | `citizen` (owner) | Request follow-up reminder (subject to 24h cooldown) |
| `GET` | `/api/v1/complaints/:id/reminders` | `citizen` (owner), `officer` (dept), `admin` | View reminder history for grievance |
| `GET` | `/api/v1/complaints/:id/reminders/eligibility` | `citizen` (owner), `officer` (dept), `admin` | Check reminder eligibility and cooldown status |
| `GET` | `/api/v1/reminders` | `citizen` (own), `officer` (dept), `admin` (all) | List reminders scoped by role |
| `GET` | `/api/v1/complaints/:id/status-explanation` | Public / All | Get bilingual plain-language status explanation |
| `GET` | `/api/v1/complaints/track/:reference/status-explanation` | Public / All | Public tracking alias for status explanation |

---

## 4. Lifecycles, Cooldowns & Localization Rules

### Clarification Thread Lifecycle
```
[Citizen Submits Query/Info]
            │
            ▼
        ┌───────┐
        │ OPEN  │ <── Throttled if >= 5 active open threads per complaint
        └───────┘
            │
            │ (Assigned Department Officer Responds)
            ▼
      ┌───────────┐
      │ RESPONDED │ <── Citizen-visible response with responder name & role
      └───────────┘
            │
            │ (Citizen or Officer Closes Thread)
            ▼
        ┌────────┐
        │ CLOSED │
        └────────┘
```
- A clarification submission **never** mutates the official grievance status.

### Reminder Cooldown Governance
- Active grievance required: Complaints in `RESOLVED` or `CLOSED` return `400 INELIGIBLE_FOR_REMINDER`.
- Configurable cooldown window: Configured via `config.reminders.cooldownHours` (default 24h).
- Submissions within the cooldown window return `429 REMINDER_THROTTLED` with exact `cooldownExpiresAt` timestamp and `timeRemainingMinutes`.
- Delivery channel is strictly documented as `IN_APP` with `LOGGED_IN_APP` status.

### Status Translator Matrix (English & Hindi)
Every official status maps deterministically to curated bilingual guidance:
- `SUBMITTED` &rarr; EN: *Received & Registered* | HI: *प्राप्त और पंजीकृत*
- `UNDER_REVIEW` &rarr; EN: *Under Active Department Review* | HI: *विभागीय समीक्षाधीन*
- `ASSIGNED` &rarr; EN: *Assigned to Field Division* | HI: *क्षेत्रीय प्रभाग को सौंपा गया*
- `IN_PROGRESS` &rarr; EN: *Work In Progress* | HI: *समाधान कार्य प्रगति पर*
- `AWAITING_INFORMATION` &rarr; EN: *Citizen Clarification Needed* | HI: *नागरिक से अतिरिक्त जानकारी अपेक्षित*
- `RESOLVED` &rarr; EN: *Remediation Completed & Reported Resolved* | HI: *समाधान पूर्ण और सत्यापित*
- `CLOSED` &rarr; EN: *Officially Closed* | HI: *औपचारिक रूप से बंद*
- `REOPENED` &rarr; EN: *Reopened for Follow-Up Inspection* | HI: *पुन: खोला गया (पुनर्निरीक्षण)*

---

## 5. Security & Privacy Protections

1. **Complaint Ownership Enforcement:**
   Citizens are blocked from submitting clarifications or reminders on complaints they do not own (`403 FORBIDDEN_COMPLAINT_OWNER`).
2. **Departmental Authorization Isolation:**
   Officers can only inspect and respond to clarifications within their assigned `departmentId` (`403 FORBIDDEN_DEPARTMENT_MISMATCH`).
3. **Internal Note Protection:**
   Internal officer notes, confidential investigation logs, fraud screening risk scores, and reputation ratings are completely excluded from citizen status translation payloads and public tracking responses.
4. **Input Length Bounds:**
   - Clarification content: 5 &ndash; 2,000 characters.
   - Officer response: 5 &ndash; 2,000 characters.
5. **Anti-Spam Throttling:**
   Max 5 active open clarification threads per grievance prevents denial-of-service spam on officer queues.

---

## 6. Automated Verification Results

### Backend Automated Test Suites
```bash
node --test tests/clarification.test.js
```
```
✔ CivicSarthi Phase 12 — Clarifications, Reminders & Status Translator
  ✔ Feature A: Citizen-Initiated Clarifications (12/12 Passed)
  ✔ Feature B: Citizen Follow-Up Reminders (6/6 Passed)
  ✔ Feature C: Citizen-Friendly Status Translator (6/6 Passed)
ℹ tests 24
ℹ suites 4
ℹ pass 24
ℹ fail 0
```

### Full Backend Regression Test Run
```bash
npm.cmd test
```
```
✔ CivicSarthi Full Backend Regression Test Suite
ℹ tests 388
ℹ suites 76
ℹ pass 388
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 6444.6452
```

### Frontend Production Build
```bash
npm.cmd --prefix frontend run build
```
```
✓ 1659 modules transformed.
dist/index.html                   0.73 kB │ gzip:   0.41 kB
dist/assets/index-Byqp_2tR.css   44.65 kB │ gzip:   7.72 kB
dist/assets/index-BtAWLk1_.js   619.33 kB │ gzip: 147.35 kB
✓ built in 3.09s
```

---

## 7. Known Limitations & Next Steps

1. **External Notifications:** Currently, notifications and reminders are transparently preserved in-app (`IN_APP`). When SMS/WhatsApp gateways or push notifications are integrated in Phase 15, the delivery adapter can be extended without breaking the existing in-app contract.
2. **Audio Vernacular Readout:** Text-to-speech vernacular pronunciation of translated statuses will be incorporated during Phase 15 (Voice, Vision & Accessibility).
