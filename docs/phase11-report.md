# CivicSarthi Phase 11 Implementation Report
## Spam/Fake Complaint Detection with Human Review Desk

> **Product:** CivicSarthi — Intelligent Civic Complaint & Incident Resolution System<br>
> **Tagline:** “From Complaint to Resolution.”<br>
> **Repository:** `https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git`<br>
> **Implementation Date:** October 13, 2026<br>
> **Dedicated Phase Branch:** `phase-11-spam-fake-complaint-detection`<br>
> **Verification Status:** **VERIFIED (Phase 11 Suite: 27/27 Passed; Full Regression: 364/364 Passed; Frontend Production Build: Clean)**

---

## 1. Executive Summary & Delivered Scope

Phase 11 implements an explainable, deterministic spam and suspicious grievance screening system paired with a human-in-the-loop review cockpit. In public civic grievance platforms, automated bots, rapid submission flooding, keyboard mash, and accidental multi-submissions can overwhelm municipal departments. However, algorithmic black boxes often unfairly silence citizens expressing passionate criticism or filing complaints in regional languages.

CivicSarthi Phase 11 balances platform protection with civil fairness by enforcing:
1. **Explainable Deterministic Screening Service (`SpamScreeningService`):**
   - 6 configurable heuristic signals evaluating authenticated account submission velocity, text entropy, duplicate candidates, and department cycling.
   - 0–100 normalized score mapped to transparent risk levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
   - High/Critical risk complaints (&ge; 60 pts) are flagged and routed to the human review desk.
   - **Strict Fairness Safeguards:** Civic criticism of government officials, multilingual Devanagari Hindi, and collective reporting of shared public defects produce **0 spam points** and are never penalized.
2. **Privacy-Conscious Citizen Reputation Tracking (`CitizenReputationService`):**
   - Auditable, tamper-resistant account standing ledger (`GOOD_STANDING`, `UNDER_OBSERVATION`, `RESTRICTED_REVIEW_PRIORITY`).
   - Unconfirmed automated screening flags **never** reduce citizen standing or score.
   - Only human-confirmed abuse determinations deduct points (-25 pts).
   - Strict idempotency via `sourceEventId` prevents double-penalizing.
   - Overturned determinations restore points (+25 pts) with an audit record.
   - Private citizen projections protect reputation details from leaking via public tracking.
3. **Department-Scoped Human Review Desk (`SpamReviewService` & `SpamReviewPage.jsx`):**
   - Officers review flagged submissions strictly within their assigned department boundary.
   - System administrators can review across all departments.
   - Citizens are blocked from internal queues (403 Forbidden).
   - Mandatory human justification of &ge; 10 characters required for all determinations.
   - Determinations:
     - `LEGITIMATE`: Clears the automated flag without disrupting the grievance lifecycle.
     - `NEEDS_MORE_INFORMATION`: Preserves the complaint on hold pending citizen clarification.
     - `CONFIRMED_ABUSE`: Explicit human abuse finding that logs audit evidence and updates reputation ledger without deleting complaint data.
     - `ESCALATED`: Forwards complex abuse patterns to departmental supervisory authorities.
4. **Submission Pipeline Integration:**
   - Seamlessly integrated into `ComplaintService.createComplaint`.
   - Screening failure fallback guarantees complaints are preserved and never lost.
   - Public tracking projections strictly hide internal risk evidence and reviewer notes.

---

## 2. Architecture & Modules Reused

The implementation builds on the existing CivicSarthi architecture without external paid APIs:

```
backend/
├── src/
│   ├── constants/
│   │   └── spam.constants.js                 [NEW] Risk levels, thresholds, reason codes, reputation statuses
│   ├── models/
│   │   ├── spamReview.model.js               [NEW] Mongoose schema for human review desk
│   │   ├── citizenReputation.model.js        [NEW] Mongoose schema for reputation ledger
│   │   ├── complaint.model.js                [MODIFIED] Added screeningResult, isFlaggedSpam, spamReviewId
│   │   └── index.js                          [MODIFIED] Exported Phase 11 models
│   ├── repositories/
│   │   ├── spamReview.repository.js          [NEW] Factory with anti-silent fallback
│   │   ├── spamReview.json.repository.js     [NEW] Mutex-protected JSON storage (REV-YYYY-XXXX)
│   │   ├── spamReview.mongo.repository.js    [NEW] MongoDB Mongoose persistence adapter
│   │   ├── citizenReputation.repository.js   [NEW] Factory with anti-silent fallback
│   │   ├── citizenReputation.json.repository.js [NEW] Mutex-protected JSON storage (REP-citizenId)
│   │   ├── citizenReputation.mongo.repository.js[NEW] MongoDB Mongoose persistence adapter
│   │   ├── complaint.repository.js           [MODIFIED] Added update() facade method
│   │   ├── complaint.json.repository.js      [MODIFIED] Persisted screening fields and spamReviewId
│   │   ├── complaint.mongo.repository.js     [MODIFIED] Persisted screening fields and spamReviewId
│   │   └── index.js                          [MODIFIED] Exported Phase 11 repositories
│   ├── services/
│   │   ├── spamScreening.service.js          [NEW] Deterministic heuristic screening engine
│   │   ├── citizenReputation.service.js      [NEW] Auditable citizen reputation service
│   │   ├── spamReview.service.js             [NEW] Department-scoped review queue & adjudication
│   │   └── complaint.service.js              [MODIFIED] Submission pipeline screening integration
│   ├── controllers/
│   │   └── spamReview.controller.js          [NEW] HTTP controllers for review desk & reputation
│   ├── routes/
│   │   ├── spamReview.routes.js              [NEW] Routes with Zod validation & auth guards
│   │   └── index.js                          [MODIFIED] Mounted /spam-reviews and /citizen routes
│   └── config/
│       └── app.config.js                     [MODIFIED] Configured spamReviews & citizenReputations JSON paths
├── data/
│   ├── spam_reviews.json                     [NEW] Baseline JSON fixture
│   └── citizen_reputations.json              [NEW] Baseline JSON fixture
└── tests/
    └── spam.test.js                          [NEW] Comprehensive 27-test Phase 11 verification suite

frontend/
├── src/
│   ├── api/
│   │   └── client.js                         [MODIFIED] Added 5 Phase 11 API client methods
│   ├── pages/
│   │   └── SpamReviewPage.jsx                [NEW] Review cockpit with metrics, signal inspector, decision modal
│   ├── components/
│   │   └── Layout.jsx                        [MODIFIED] Added Spam Review Desk officer navigation item
│   └── App.jsx                               [MODIFIED] Registered /officer/spam-review protected route
```

---

## 3. Heuristic Screening Signals, Weights & Thresholds

Screening logic is pure, deterministic, and isolated in `SpamScreeningService`.

| Signal Key | Reason Code | Default Weight | Condition & Logic |
| :--- | :--- | :---: | :--- |
| **Burst Frequency** | `BURST_FREQUENCY` | Moderate: 20<br>High: 35 | &ge; 3 submissions in 15 mins (+20 pts); &ge; 5 submissions in 15 mins (+35 pts) from the same authenticated citizen account. |
| **Identical Text** | `DUPLICATE_TEXT_EXACT` | 45 | Exact normalized title and description matches an earlier complaint from the same account. |
| **Similar Text** | `DUPLICATE_TEXT_SIMILAR` | 25 | Jaccard word token similarity &ge; 0.82 against earlier complaints from the same citizen. |
| **Keyboard Mash / Gibberish** | `REPETITIVE_CHARACTERS` | 35 | Character repetition (&ge; 5 repeats), short sequence looping, keyboard row mash (`qwerty`, `asdfgh`, `zxcvbn`), or ultra-low entropy. |
| **Low Info Density** | `LOW_INFORMATION_DENSITY` | 20 | Non-protected text with length < 15 chars and < 4 tokens failing to describe actionable civic issues. |
| **Phase 6 AI Duplicate Match** | `PHASE6_DUPLICATE_MATCH` | 30 | Phase 6 duplicate similarity &ge; 0.85 from the **same** citizen account. |
| **Rapid Category Cycling** | `RAPID_CATEGORY_CYCLING` | 25 | Same citizen targeting &ge; 3 distinct government departments within a 15-minute window. |

### Score Thresholds & Risk Mapping

$$\text{Score} = \min\left(100, \sum \text{Triggered Signal Weights}\right)$$

| Score Range | Risk Level | Automatic Action |
| :---: | :---: | :--- |
| **0 – 29** | `LOW` | Safe. Processed normally through standard grievance pipeline. |
| **30 – 59** | `MEDIUM` | Monitored. Retained in standard operational queue. |
| **60 – 79** | `HIGH` | **Flagged (`isFlaggedSpam: true`).** Queued into department review desk (`status: PENDING`). |
| **80 – 100** | `CRITICAL` | **Flagged (`isFlaggedSpam: true`).** Queued with high priority indicator. |

---

## 4. Civil Fairness & Language Guarantees

Civic grievance portals serve as platforms for democratic accountability. Algorithmic bias against frustrated citizens or regional languages is strictly prevented:

1. **Official & Administrative Criticism:**
   - Expressions containing harsh criticism (`corrupt`, `negligent`, `slow`, `no action`, `useless`, `pathetic`, `inaction`) are explicitly categorized as protected civic speech via `isProtectedCivicExpression()`.
   - **Guarantee:** 0 risk points are assigned to official criticism.
2. **Multilingual & Regional Script Invariance:**
   - Text normalization explicitly protects Hindi Devanagari Unicode points (`[\u0900-\u097F]`).
   - Hinglish phrases (e.g., *“sadak par bada gaddha hai paani bhara hai”*) are analyzed using language-tolerant tokenization.
   - **Guarantee:** Non-English text is never misclassified as keyboard mash.
3. **Collective Public Reporting Protection:**
   - Multiple citizens filing complaints about the same public infrastructure defect (e.g., a burst main water pipeline or fallen electrical pole) is standard civic behavior.
   - **Guarantee:** Duplicate candidate correlation triggers spam points **only** when submitted by the *same* citizen account. Cross-account duplicates are treated as collective public validation.
4. **Screening Signal Independence:**
   - Prior flags on an account do not taint new submissions. Each grievance is evaluated purely on its own merits and temporal submission patterns.

---

## 5. Citizen Reputation Ledger & Audit Design

To maintain long-term platform health without punitive overreach, CivicSarthi implements an auditable reputation ledger:

- **Initial State:** Every citizen account begins with `reputationScore = 100` and `standing = GOOD_STANDING`.
- **Standing Tiers:**
  - `GOOD_STANDING`: Score &ge; 70 and 0 confirmed abuse findings.
  - `UNDER_OBSERVATION`: Score < 70 or 1–2 confirmed abuse findings.
  - `RESTRICTED_REVIEW_PRIORITY`: 3+ confirmed abuse findings.
- **Rule of Non-Penalization on Unconfirmed Flags:**
  - When an automated screening flag triggers, a `SUBMISSION_LOGGED (wasFlagged: true)` event is recorded.
  - **Score Delta: 0.** The citizen is **never** penalized unless a human officer reviews and confirms abuse.
- **Human-Confirmed Abuse:**
  - An explicit `CONFIRMED_ABUSE` decision by an officer deducts 25 points (`delta = -25`) and increments `confirmedAbuseCount`.
- **Reversal & Appeal Correction:**
  - If a supervisor or administrative appeal overturns a prior abuse finding, an `ABUSE_REVERSED` event is logged (`delta = +25`), restoring points and decrementing `confirmedAbuseCount`.
- **Strict Idempotency:**
  - All reputation updates track a unique `sourceEventId`. Repeated calls with the same ID return `applied: false` without re-applying deltas.

---

## 6. Flagged Complaint Review Desk & RBAC Enforcement

The human review desk enforces strict role-based and department-isolated scoping:

| Role | Permitted Actions | Scoping Boundary |
| :--- | :--- | :--- |
| **Citizen** | View own reputation standing summary. | Denied from internal review queue (`403 Forbidden`). Cannot view other citizens' scores. |
| **Officer** | Inspect flagged reviews, examine evidence, record decisions (`LEGITIMATE`, `NEEDS_MORE_INFORMATION`, `CONFIRMED_ABUSE`, `ESCALATED`). | **Strictly restricted** to grievances assigned to their own department (`departmentId`). Cross-department decisions rejected with `403`. |
| **System Admin** | Global queue access, cross-department reviews, reversal of abuse determinations. | Unrestricted across all departments. |

### Adjudication Workflow & Mandatory Justifications

When an officer records a determination:
1. Decision outcome must be one of `LEGITIMATE`, `NEEDS_MORE_INFORMATION`, `CONFIRMED_ABUSE`, `ESCALATED`.
2. A human justification of at least 10 characters (`decisionReason`) is mandatory.
3. If `LEGITIMATE`:
   - Complaint's `isFlaggedSpam` is set to `false`.
   - `screeningResult.reviewStatus` is set to `LEGITIMATE`.
   - Operational grievance remains active in its current operational state (`SUBMITTED`/`IN_PROGRESS`) for normal departmental resolution.
4. If `CONFIRMED_ABUSE`:
   - Complaint's `isFlaggedSpam` remains `true`.
   - Citizen reputation ledger is updated (`-25 pts`).
   - Audit trail appends reviewer ID, timestamp, and justification.
   - **Crucial Rule:** The complaint is preserved in the audit history for evidentiary review and is **never** silently deleted.

---

## 7. API Endpoints & Contract Specifications

Mounted under `/api/v1` and legacy `/api`:

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/spam-reviews` | `officer`, `admin` | Lists flagged review cases filtered by department scope, risk level, and review status. |
| `GET` | `/api/v1/spam-reviews/:id` | `officer`, `admin` | Retrieves comprehensive review detail, heuristic signals breakdown, and privacy-safe duplicate references. |
| `POST` | `/api/v1/spam-reviews/:id/decision` | `officer`, `admin` | Records human determination with mandatory reason (&ge;10 chars). Updates complaint & reputation. |
| `GET` | `/api/v1/citizen/reputation` | `citizen`, `officer`, `admin` | Returns authenticated citizen's high-level reputation standing (private internal notes suppressed). |
| `GET` | `/api/v1/spam-reviews/citizens/:id/reputation` | `officer`, `admin` | Returns authorized administrative audit ledger of a citizen's reputation events. |

---

## 8. Verification Results

### Automated Test Suite (`backend/tests/spam.test.js`)
- **Total Tests:** 27
- **Passed:** 27 (100%)
- **Failed:** 0
- **Suites:** 5
- **Duration:** 1.56s

```
▶ CivicSarthi Phase 11 — Spam/Fake Complaint Detection & Human Review
  ▶ Feature 1: Explainable Screening Heuristics & Fairness Guarantees
    ✔ evaluates a clean, legitimate complaint with score 0 and LOW risk
    ✔ flags burst frequency submissions from the same citizen account within time window
    ✔ flags repeated identical complaint text from the same citizen
    ✔ flags gibberish, keyboard mash, and low information density content
    ✔ flags rapid category cycling across 4 different departments in a short burst
    ✔ incorporates Phase 6 duplicate candidate signals into score
    ✔ FAIRNESS: Never flags complaints merely criticizing officials or government administration
    ✔ FAIRNESS: Never flags valid Hindi Devanagari regional language complaints as gibberish
    ✔ FAIRNESS: Never penalizes collective civic reporting from different citizen accounts
    ✔ is strictly deterministic and reproducible for identical inputs
  ✔ Feature 1: Explainable Screening Heuristics & Fairness Guarantees
  ▶ Feature 2: Citizen Reputation Tracking & Ledger Audit
    ✔ initializes a default reputation record in GOOD_STANDING with trust score 100
    ✔ unconfirmed automated flags do NOT deduct reputation points
    ✔ prevents duplicate event application using sourceEventId idempotency
    ✔ records decision reversals and restores reputation points
    ✔ provides role-projected standing: citizen sees private summary, public tracking sees nothing
  ✔ Feature 2: Citizen Reputation Tracking & Ledger Audit
  ▶ Feature 3: Flagged Review Desk Workflow & Department Scope
    ✔ DENIES unauthenticated access to spam reviews with 401
    ✔ DENIES citizen role from accessing internal review queue with 403
    ✔ ENFORCES department scope: water officer sees water review, not roads
    ✔ ALLOWS system admin to view reviews across all departments
    ✔ DENIES officer from reviewing complaints outside their assigned department
    ✔ REJECTS review decision with short or missing justification (<10 chars) with 400
    ✔ REJECTS invalid decision outcome enum with 400
    ✔ SUCCESS: Officer marks flagged complaint as LEGITIMATE, clearing flag without disrupting grievance lifecycle
    ✔ SUCCESS: Officer marks flagged complaint as CONFIRMED_ABUSE, updating review and citizen reputation ledger
  ✔ Feature 3: Flagged Review Desk Workflow & Department Scope
  ▶ Feature 4: Citizen Submission Pipeline Integration
    ✔ automatically screens new citizen submission and assigns screening metadata
    ✔ automatically queues a high-risk submission into spam review queue
    ✔ citizen tracking endpoint never leaks internal screening evidence or reviewer notes
  ✔ Feature 4: Citizen Submission Pipeline Integration
✔ CivicSarthi Phase 11 — Spam/Fake Complaint Detection & Human Review
```

### Full Repository Regression Verification (`npm.cmd test`)
- **Total Test Files:** 15 (`api.test.js`, `auth.test.js`, `citizen.test.js`, `feedback.test.js`, `incident.api.test.js`, `incident.foundation.test.js`, `incident.service.test.js`, `intelligence.test.js`, `neglectRadar.api.test.js`, `neglectRadar.scoring.test.js`, `neglectRadar.service.test.js`, `persistence.test.js`, `resolutionQuality.integration.test.js`, `resolutionQuality.test.js`, `spam.test.js`)
- **Total Test Cases:** **364**
- **Passed:** **364** (100%)
- **Failed:** **0**
- **Suites:** 72
- **Duration:** 5.99s
- **Outcome:** **PASS** (Zero regressions across Phase 0 through Phase 11).

### Frontend Production Build (`npm.cmd --prefix frontend run build`)
- **Tool:** Vite v6.4.4
- **Modules Transformed:** 1,659
- **Build Output:**
  - `dist/index.html` (0.73 kB)
  - `dist/assets/index-Bc9EseeI.css` (43.90 kB)
  - `dist/assets/index-BmjaKNp7.js` (593.78 kB)
- **Outcome:** **PASS** (Clean production bundle built in 3.13s).

---

## 9. Acceptance Criteria & Compliance Matrix

| Criterion | Target | Actual Result | Status |
| :--- | :--- | :--- | :---: |
| **Deterministic Heuristic Screening** | 6 explainable signals, 0–100 score, reproducible | `SpamScreeningService` evaluates velocity, text entropy, duplicates, and category cycling | **PASS** |
| **Civil Fairness Guarantees** | Official criticism and regional languages produce 0 spam points | Devanagari Hindi and administrative criticism explicitly protected; 0 points assigned | **PASS** |
| **Collective Reporting Protection** | Cross-citizen identical complaints not penalized as spam | Same-complaint duplicate checks trigger only when submitted by the same citizen account | **PASS** |
| **Citizen Reputation Ledger** | Auditable, unconfirmed flags never deduct points, idempotency | `CitizenReputationService` with event idempotency, reversal support, and privacy projections | **PASS** |
| **Department-Scoped Review Desk** | Officers scoped to authorized department; admins global | Enforced in `SpamReviewService` and protected HTTP routes; 403 on department mismatch | **PASS** |
| **Mandatory Human Justification** | Minimum 10 characters required for all determinations | Validated by Zod middleware and service logic; rejected with 400 if shorter | **PASS** |
| **Complaint Preservation** | Legitimate clears flag; abuse preserves grievance records | Legitimate clears `isFlaggedSpam`; abuse updates audit record without deleting complaint | **PASS** |
| **Dual Persistence Support** | Mutex-protected JSON & Mongoose schemas | `SpamReviewRepository` and `CitizenReputationRepository` with anti-silent fallback | **PASS** |
| **MongoDB Live Integration** | MongoDB live daemon verification | Local development runs without live mongod service | **NOT VERIFIED** |
| **Frontend Cockpit Integration** | React cockpit with metrics, inspector, decision modal | Implemented in `SpamReviewPage.jsx` and connected to `/officer/spam-review` | **PASS** |
| **Automated Test Coverage** | &ge; 25 automated tests covering all Phase 11 features | 27 tests in `spam.test.js`; 364 total repository regression tests pass | **PASS** |

---

## 10. Known Defects, Limitations & Deferred Scope

1. **Deferred to Phase 12:** Citizen clarification dialogs (interactive two-way Q&A when a review outcome is `NEEDS_MORE_INFORMATION`) and automated reminder workflows are intentionally scheduled for Phase 12 as per the roadmap.
2. **Persistence:** Dual persistence architecture is implemented with complete Mongoose schemas and mutex-protected JSON storage. MongoDB live integration is marked `NOT VERIFIED` due to lack of a running local mongod daemon, but schema validation and anti-silent fallback mechanisms are tested and verified.

---

## 11. Git Branch, Commit & Verification Hashes

- **Dedicated Branch:** `phase-11-spam-fake-complaint-detection`
- **Base Commit:** `d579aed` (Phase 10 verified HEAD)
- **Canonical Remote:** `https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git`
- **Recommended Next Phase:** **Phase 12 — Citizen Clarifications & Status Translator**
