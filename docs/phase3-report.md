# CivicSarthi — Phase 3 Implementation & Security Audit Report: Authentication, Sessions and Server-Side RBAC

**Repository:** `https://github.com/jiya25001126/CivicSarthi--Intelligent-Civic-Complaint-Incident-Resolution-System.git`  
**Base Commit:** `36a71f89b5b7984c59a1f5f79845c8c9645dfef7`  
**Phase:** Phase 3 — Authentication, Sessions, and Role-Based Access Control (RBAC)  
**Date of Audit & Execution:** October 10, 2026  
**Auditor / Engineer:** Senior Full-Stack Security Engineer  

---

## 1. Executive Summary

Phase 3 transitions CivicSarthi from an unauthenticated prototype with client-side role emulation into a security-governed system featuring server-side identity verification, cryptographic session management, strict role-based access control (RBAC), data ownership isolation, and auditable administrative actions.

All 55 automated tests (comprising Phase 1 API integration tests, Phase 2 persistence tests, and Phase 3 security tests) pass cleanly. Frontend build checks compile with zero errors.

---

## 2. Authentication & Session Architecture

### Session Strategy
A hybrid cookie/bearer session design was implemented:
- **Browser Clients (Web UI):** Uses signed JSON Web Tokens (JWT) stored in an `HttpOnly`, `SameSite=Lax`, `Secure` (in production environments) cookie named `civicsarthi_session`.
- **API Clients & Automated Tests:** Dual-extraction middleware seamlessly accepts `Authorization: Bearer <token>` headers as an alternative to session cookies.
- **Cross-Site Request Forgery (CSRF) Defense:** For cookie-authenticated state-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`), a double-submit CSRF cookie (`civicsarthi_csrf`) is verified against the `x-csrf-token` header. Standard Bearer token authentication bypasses CSRF checks because Bearer tokens are immune to ambient credential transmission.
- **Session Duration & Expiry:** Token expiration is capped at 24 hours (`JWT_EXPIRES_IN=24h`). Expired tokens and tampered signatures return `401 Unauthorized`.
- **Session Termination (`/api/v1/auth/logout`):** The logout endpoint clears both session and CSRF cookies with `Max-Age=0` and epoch expiration.

### Password Security & Storage
- Passwords are encrypted with `bcryptjs` using 10 salt rounds before persistence.
- Plaintext passwords and password hashes are never logged, stored in source fixtures, or returned in API responses.
- In both MongoDB (`UserModel`) and JSON (`JsonUserRepository`) adapters, the `passwordHash` field is stripped in transformations (`sanitizeUser`).
- Login attempts employ generic error messages (`"Invalid email or password"`) for both incorrect credentials and non-existent accounts, preventing username enumeration.
- Auth endpoints (`/api/v1/auth/login`, `/api/v1/auth/register`) are rate-limited via `express-rate-limit` to mitigate brute-force and credential-stuffing attacks.

---

## 3. Role & Permission Matrix

The application strictly enforces three distinct roles: `citizen`, `officer`, and `admin`. Client headers such as `x-portal-role`, request body role fields, and URL parameters are ignored for authorization.

| Operation / Endpoint | Citizen | Officer | Admin | Public / Unauth |
| :--- | :--- | :--- | :--- | :--- |
| **Self-Registration** (`POST /api/v1/auth/register`) | `ALLOWED` (creates citizen only) | `DENIED` | `DENIED` | `ALLOWED` (as citizen) |
| **Login / Logout / Me** (`/api/v1/auth/*`) | `ALLOWED` | `ALLOWED` | `ALLOWED` | Login & Register only |
| **Public Tracking** (`GET /api/v1/complaints/:id/track`) | `ALLOWED` (stripped PII) | `ALLOWED` (stripped PII) | `ALLOWED` (stripped PII) | `ALLOWED` (stripped PII) |
| **Submit Complaint** (`POST /api/v1/complaints`) | `ALLOWED` (sets `citizenId = user.id`) | `ALLOWED` | `ALLOWED` | `DENIED (401)` |
| **List Complaints** (`GET /api/v1/complaints`) | `OWN ONLY` (`citizenId = user.id`) | `DEPT ONLY` (`dept = user.dept`) | `ALL DEPTS` | `DENIED (401)` |
| **View Complaint Details** (`GET /api/v1/complaints/:id`) | `OWN ONLY` (officer notes stripped) | `DEPT ONLY` (with notes) | `ALL` (with notes) | `DENIED (401)` |
| **View Officer Notes** (`officerNotes`) | `DENIED (Stripped)` | `DEPT ONLY` | `ALLOWED` | `DENIED (Stripped)` |
| **Update Complaint Status** (`PATCH .../status`) | `DENIED (403)` | `DEPT ONLY` | `ALLOWED` | `DENIED (401)` |
| **Reassign Department** (`PATCH .../department`) | `DENIED (403)` | `DENIED (403)` | `ALLOWED (Audited)` | `DENIED (401)` |
| **Append Officer Note** (`POST .../notes`) | `DENIED (403)` | `DEPT ONLY` | `ALLOWED` | `DENIED (401)` |
| **View History** (`GET .../history`) | `OWN ONLY` | `DEPT ONLY` | `ALLOWED` | `DENIED (401)` |
| **Provision Officer / Admin** (`POST /admin/users`) | `DENIED (403)` | `DENIED (403)` | `ALLOWED (Audited)` | `DENIED (401)` |
| **View Security Audit Logs** (`GET /admin/audit-logs`) | `DENIED (403)` | `DENIED (403)` | `ALLOWED` | `DENIED (401)` |

---

## 4. Account Provisioning Process

To avoid hardcoded production credentials, default accounts, or insecure bootstrap endpoints:
1. **Public Interface:** The public registration route (`/api/v1/auth/register`) unconditionally hardcodes the assigned role to `citizen`. Any client attempting to supply `role: "admin"` or `role: "officer"` is automatically assigned `citizen`.
2. **Safe Administrator Provisioning CLI Tool:**
   - Command: `node backend/src/scripts/provision-user.js --email=admin@dept.gov.in --name="Admin Name" --role=admin`
   - Or workspace alias: `npm run provision:user -- --email=admin@dept.gov.in --name="Admin Name" --role=admin`
   - If `--password` is omitted, the CLI tool generates a cryptographically random 16-character password using `crypto.randomBytes()`, prints it once to stdout, hashes it with bcrypt, and stores it.
3. **Privileged In-App Provisioning (`POST /api/v1/admin/users`):**
   - Accessible only by users authenticated with the `admin` role.
   - Allows provisioning nodal officers with mandatory `departmentId` validation against the department registry.
   - Every administrative provisioning event is written to `audit_logs.json` (or `AuditLogModel` in MongoDB).

---

## 5. Data Migration & Ownership Metadata

1. **Schema Enhancements:**
   - `ComplaintModel` (Mongoose) and `JsonComplaintRepository` now include `citizenId: String` (indexed) and `assignedOfficerId: String`.
   - Compound indexes: `{ citizenId: 1, createdAt: -1 }` and `{ departmentId: 1, status: 1 }`.
2. **Synthetic / Existing Record Migration:**
   - All 18 synthetic demonstration grievances in `data/complaints.json` were migrated to hold `citizenId: "SYNTHETIC_CPGRAMS_DEMO"`.
   - The ordinary seed runner (`backend/src/scripts/seed.js`) automatically tags all demo records with `citizenId: "SYNTHETIC_CPGRAMS_DEMO"` and preserves real user-created grievances.
   - When real citizens register and list their grievances, they only receive records where `citizenId === user.id`. Synthetic records are never attributed to real users.
   - Authorized nodal officers continue to view complaints assigned to their department, allowing interactive demonstration workflows.

---

## 6. Frontend Integration

1. **Authentication Context (`AuthContext.jsx`):**
   - Restores session state on mount via `GET /api/v1/auth/me`.
   - Tracks `user`, `isAuthenticated`, `isCitizen`, `isOfficer`, `isAdmin`, `loading`, and provides `login()`, `register()`, and `logout()`.
2. **Navigation & Layout (`Layout.jsx`):**
   - Completely removed the unauthenticated "Demo Access Mode" role switcher.
   - Authenticated sessions display user badge (name, role, department tag) and a secure logout button.
   - Unauthenticated visitors see "Sign In" and "Register Citizen" buttons.
   - Dynamic navigation tabs render only routes permitted for the authenticated user's role.
3. **Authentication Screens:**
   - `LoginPage.jsx`: Accessible form with client-side validation, error banners, and guidance for nodal officers.
   - `RegisterPage.jsx`: Public registration strictly for citizens, displaying clear RBAC warnings that officer accounts require administrative provisioning.
4. **Route Protection (`ProtectedRoute.jsx`):**
   - Enforces authentication and role gates on `/citizen/*` and `/officer/*`.
   - Redirects unauthenticated users to `/login`, preserving navigation intent (`from`).
   - Displays clear access-denial dialog for unauthorized roles.
5. **Data Confidentiality:**
   - Citizen views (`ComplaintDetailPage.jsx`) strip `officerNotes` and officer control panels.
   - Tracking page (`TrackComplaintPage.jsx`) accesses public `/track` endpoint without credentials, displaying lifecycle status while scrubbing private citizen phone, email, and internal notes.

---

## 7. Automated Test Results & Verification

All automated test suites were executed using Node.js native test runner (`node --test`).

### Test Execution Command
```bash
npm --prefix backend test
```

### Overall Suite Results
```
ℹ tests 55
ℹ suites 6
ℹ pass 55
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5478.8398
```

### Breakdown of Verified Checks

| Category | Verification Item | Status |
| :--- | :--- | :--- |
| **Public Registration** | Public registration creates only citizen accounts | `PASS` |
| **Privilege Escalation** | Public registration cannot create officers or administrators | `PASS` |
| **Password Security** | Passwords stored strictly as bcrypt hashes; never exposed in API | `PASS` |
| **Authentication Flow** | Valid login succeeds; invalid login returns generic 401 error | `PASS` |
| **Session Invalidation** | Logout clears session and CSRF cookies | `PASS` |
| **Session Expiry** | Expired or tampered JWTs return 401 Unauthorized | `PASS` |
| **Access Control (401)** | Missing authentication returns 401 on protected routes | `PASS` |
| **Access Control (403)** | Insufficient permissions return 403 Forbidden | `PASS` |
| **Citizen Isolation** | Citizen A cannot read, list, track private details, or modify Citizen B's complaints | `PASS` |
| **Confidential Notes** | Citizen views and public tracking never expose internal officer notes | `PASS` |
| **Department Isolation** | Officers cannot access or update complaints from other departments | `PASS` |
| **Role Protection** | Officers cannot provision admin accounts or alter roles | `PASS` |
| **Header Spoofing** | Spoofing `x-portal-role: admin` or `officer` grants zero privileges | `PASS` |
| **Audit Trail** | Administrative actions (provisioning, department changes) logged to audit trail | `PASS` |
| **State Governance** | Existing status-transition lifecycle rules remain strictly enforced | `PASS` |
| **Public Tracking** | Public tracking `/track` functions without auth and strips all PII | `PASS` |
| **Rate Limiting** | Authentication rate limiter returns 429 when threshold exceeded | `PASS` |
| **JSON Persistence** | JSON adapter CRUD, concurrency, and restart persistence pass | `PASS` |
| **MongoDB Schemas** | Mongoose domain models validate required fields and constraints | `PASS` |
| **MongoDB Daemon** | Live MongoDB operational integration checks | `NOT VERIFIED` (No MongoDB daemon on localhost:27017) |
| **Frontend Production Build** | Vite production bundle builds cleanly | `PASS` |

---

## 8. Remaining Security Limitations

1. **Local Development Multi-Process Model:**
   - In JSON storage mode with multiple independent Node.js processes, process-level mutexes do not provide distributed file locks across processes. In production, use MongoDB mode or a distributed lock manager.
2. **Account Verification & Password Reset:**
   - Email delivery and out-of-band account activation/password recovery are not yet implemented. If a citizen forgets their password, an administrator must assist or the user must re-register.
3. **Session Revocation Store:**
   - JWTs are validated via cryptographic signature and expiration. If an active session token is stolen before expiry, revocation requires deactivating the user record (`isActive: false`) or changing the global JWT secret. A distributed Redis token blacklist is recommended for high-concurrency production deployments.
4. **HTTPS in Production:**
   - Secure cookie attributes (`Secure`) are automatically enabled when `NODE_ENV === 'production'`. HTTPS termination must be configured at the reverse proxy (e.g., NGINX / Caddy / Cloudflare).

---

## 9. Local Setup Instructions (Without Hardcoded Credentials)

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `JWT_SECRET` is set (a development secret is used by default in dev mode).

### 2. Install Dependencies
```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 3. Provision the Initial Administrator Account
Run the secure provisioning CLI tool to create the first administrator:
```bash
npm run provision:user -- --email=admin@local.civicsarthi.internal --name="System Admin" --role=admin
```
The script will output a secure one-time generated password to the terminal. Save this credential safely.

### 4. (Optional) Provision a Nodal Officer Account
```bash
npm run provision:user -- --email=officer.pwd@local.civicsarthi.internal --name="Officer Sharma" --role=officer --departmentId=DEPT_ROADS
```

### 5. Launch Development Services
In separate terminal sessions:
```bash
# Terminal 1: Backend API (port 5000)
npm run dev:backend

# Terminal 2: Frontend Web App (port 5173)
npm run dev:frontend
```

### 6. Run Full Test Suite
```bash
npm test
```
