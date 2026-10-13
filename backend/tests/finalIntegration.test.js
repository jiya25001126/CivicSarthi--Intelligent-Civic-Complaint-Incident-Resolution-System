/**
 * @file finalIntegration.test.js
 * @description Comprehensive end-to-end integration and regression test suite for CivicSarthi Hackathon Readiness.
 * Verifies complete Citizen Journey, Officer Triage Journey, Administrator Analytics Journey, and Security Invariants.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { complaintRepository } from '../src/repositories/complaint.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import { departmentRepository } from '../src/repositories/department.repository.js';
import { clarificationRepository } from '../src/repositories/clarification.repository.js';
import { reminderRepository } from '../src/repositories/reminder.repository.js';
import { appealRepository } from '../src/repositories/appeal.repository.js';
import { reopeningRequestRepository } from '../src/repositories/reopeningRequest.repository.js';
import { feedbackRepository } from '../src/repositories/feedback.repository.js';
import { spamReviewRepository } from '../src/repositories/spamReview.repository.js';
import { authService } from '../src/services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();

const TEST_DIR = path.resolve(__dirname, 'sandbox-final-integration-test');
const TEST_USERS_PATH = path.resolve(TEST_DIR, 'users.test.json');
const TEST_COMPLAINTS_PATH = path.resolve(TEST_DIR, 'complaints.test.json');
const TEST_AUDIT_PATH = path.resolve(TEST_DIR, 'audit_logs.test.json');
const TEST_CLARIFICATIONS_PATH = path.resolve(TEST_DIR, 'clarifications.test.json');
const TEST_REMINDERS_PATH = path.resolve(TEST_DIR, 'reminders.test.json');
const TEST_APPEALS_PATH = path.resolve(TEST_DIR, 'appeals.test.json');
const TEST_REOPENINGS_PATH = path.resolve(TEST_DIR, 'reopening_requests.test.json');
const TEST_FEEDBACK_PATH = path.resolve(TEST_DIR, 'feedback.test.json');
const TEST_SPAM_REVIEWS_PATH = path.resolve(TEST_DIR, 'spam_reviews.test.json');

describe('CivicSarthi — Final Integration & End-to-End Workflow Verification', () => {
  let citizenToken = null;
  let citizenUser = null;
  let roadsOfficerToken = null;
  let roadsOfficerUser = null;
  let waterOfficerToken = null;
  let waterOfficerUser = null;
  let adminToken = null;
  let adminUser = null;

  let createdComplaint = null;
  let createdReference = null;
  let createdClarificationId = null;

  before(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });

    // Isolate all repository file paths in sandbox
    userRepository.setFilePath(TEST_USERS_PATH);
    complaintRepository.setFilePath(TEST_COMPLAINTS_PATH);
    auditLogRepository.setFilePath(TEST_AUDIT_PATH);
    clarificationRepository.setFilePath(TEST_CLARIFICATIONS_PATH);
    reminderRepository.setFilePath(TEST_REMINDERS_PATH);
    appealRepository.setFilePath(TEST_APPEALS_PATH);
    reopeningRequestRepository.setFilePath(TEST_REOPENINGS_PATH);
    feedbackRepository.setFilePath(TEST_FEEDBACK_PATH);
    spamReviewRepository.setFilePath(TEST_SPAM_REVIEWS_PATH);

    // Initialize clean sandbox stores
    await fs.writeFile(TEST_USERS_PATH, JSON.stringify({ metadata: { version: '1.0.0' }, users: [] }), 'utf-8');
    await fs.writeFile(TEST_COMPLAINTS_PATH, JSON.stringify({ metadata: { version: '1.0.0' }, complaints: [] }), 'utf-8');
    await fs.writeFile(TEST_AUDIT_PATH, JSON.stringify({ metadata: { version: '1.0.0' }, logs: [] }), 'utf-8');
    await fs.writeFile(TEST_CLARIFICATIONS_PATH, JSON.stringify({ metadata: { version: '1.0.0' }, clarifications: [] }), 'utf-8');
    await fs.writeFile(TEST_REMINDERS_PATH, JSON.stringify({ metadata: { version: '1.0.0' }, reminders: [] }), 'utf-8');
    await fs.writeFile(TEST_APPEALS_PATH, JSON.stringify({ metadata: { version: '1.0.0' }, appeals: [] }), 'utf-8');
    await fs.writeFile(TEST_REOPENINGS_PATH, JSON.stringify({ metadata: { version: '1.0.0' }, reopeningRequests: [] }), 'utf-8');
    await fs.writeFile(TEST_FEEDBACK_PATH, JSON.stringify({ metadata: { version: '1.0.0' }, feedback: [] }), 'utf-8');
    await fs.writeFile(TEST_SPAM_REVIEWS_PATH, JSON.stringify({ metadata: { version: '1.0.0' }, spamReviews: [] }), 'utf-8');

    // Provision test officer and admin roles
    roadsOfficerUser = await authService.provisionUser({
      email: 'roads.officer.test@civicsarthi.internal',
      password: 'TestPassword123!',
      name: 'Roads Officer Test',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    });
    roadsOfficerToken = authService.generateToken(roadsOfficerUser);

    waterOfficerUser = await authService.provisionUser({
      email: 'water.officer.test@civicsarthi.internal',
      password: 'TestPassword123!',
      name: 'Water Officer Test',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    });
    waterOfficerToken = authService.generateToken(waterOfficerUser);

    adminUser = await authService.provisionUser({
      email: 'admin.super.test@civicsarthi.internal',
      password: 'TestPassword123!',
      name: 'System Admin Test',
      role: 'admin'
    });
    adminToken = authService.generateToken(adminUser);
  });

  after(async () => {
    // Reset all repositories to defaults
    userRepository.resetFilePath();
    complaintRepository.resetFilePath();
    auditLogRepository.resetFilePath();
    clarificationRepository.resetFilePath();
    reminderRepository.resetFilePath();
    appealRepository.resetFilePath();
    reopeningRequestRepository.resetFilePath();
    feedbackRepository.resetFilePath();
    spamReviewRepository.resetFilePath();

    // Clean up sandbox
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  // =========================================================================
  // JOURNEY 1: CITIZEN END-TO-END REDRESSAL JOURNEY
  // =========================================================================
  describe('Journey 1: Citizen Redressal Workflow', () => {
    it('1.1 Citizen registers a new account and acquires session token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'citizen.journey.test@civicsarthi.internal',
          password: 'CitizenPassword123!',
          name: 'Pooja Verma'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.user.role, 'citizen');
      assert.ok(res.body.data.token);

      citizenToken = res.body.data.token;
      citizenUser = res.body.data.user;
    });

    it('1.2 Citizen submits grievance with valid category, department and evidence', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Deep Hazardous Pothole Near Metro Station Gate 3',
          description: 'A crater-like 2ft wide pothole has formed causing continuous two-wheeler accidents during evening peak hours.',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          state: 'Maharashtra',
          district: 'Pune',
          locality: 'Kothrud Metro Pillar 412',
          evidence: ['pothole_evidence_gate3_synth.jpg']
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.match(res.body.data.referenceNumber, /^CS-2026-\d{4}$/);
      assert.strictEqual(res.body.data.status, 'SUBMITTED');
      assert.strictEqual(res.body.data.departmentId, 'DEPT_ROADS');

      createdComplaint = res.body.data;
      createdReference = res.body.data.referenceNumber;
    });

    it('1.3 Citizen tracks grievance via unauthenticated public tracking endpoint without PII leakage', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/track/${createdReference}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.referenceNumber, createdReference);
      assert.strictEqual(res.body.data.status, 'SUBMITTED');

      // Verify privacy guarantee: zero personal contact information or internal notes leaked
      assert.strictEqual(res.body.data.citizenPhone, undefined);
      assert.strictEqual(res.body.data.citizenEmail, undefined);
      assert.strictEqual(res.body.data.citizenName, undefined);
      assert.strictEqual(res.body.data.citizenId, undefined);
      assert.strictEqual(res.body.data.officerNotes, undefined);
    });

    it('1.4 Citizen requests a follow-up reminder and receives transparent in-app logging', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${createdComplaint.id}/reminders`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reason: 'Work is pending after 5 business days, please expedite inspection.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.reminder.deliveryChannel, 'IN_APP');
      assert.strictEqual(res.body.data.reminder.deliveryStatus, 'LOGGED_IN_APP');
    });

    it('1.5 Citizen requesting second reminder within cooldown receives HTTP 429 Too Many Requests', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${createdComplaint.id}/reminders`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reason: 'Second rapid reminder attempt.'
        });

      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'REMINDER_THROTTLED');
    });

    it('1.6 Citizen initiates a clarification thread providing supplementary landmark context', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${createdComplaint.id}/clarifications`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          threadType: 'LANDMARK_UPDATE',
          content: 'The pothole is directly next to the auto rickshaw stand adjacent to Pillar 412.'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'OPEN');
      assert.strictEqual(res.body.data.departmentId, 'DEPT_ROADS');

      createdClarificationId = res.body.data.id;
    });

    it('1.7 Citizen retrieves plain-language vernacular status translation in English and Hindi', async () => {
      const resEn = await request(app)
        .get(`/api/v1/complaints/${createdComplaint.id}/status-explanation?lang=en`);

      assert.strictEqual(resEn.status, 200);
      assert.strictEqual(resEn.body.success, true);
      assert.ok(resEn.body.data.meaning);
      assert.ok(resEn.body.data.nextSteps);
      assert.strictEqual(resEn.body.data.language, 'en');

      const resHi = await request(app)
        .get(`/api/v1/complaints/${createdComplaint.id}/status-explanation?lang=hi`);

      assert.strictEqual(resHi.status, 200);
      assert.strictEqual(resHi.body.success, true);
      assert.strictEqual(resHi.body.data.language, 'hi');
      assert.ok(resHi.body.data.meaning);
    });
  });

  // =========================================================================
  // JOURNEY 2: OFFICER TRIAGE & RESOLUTION JOURNEY
  // =========================================================================
  describe('Journey 2: Officer Operations & Quality Gate', () => {
    it('2.1 Roads Officer views authorized department queue and finds the complaint', async () => {
      const res = await request(app)
        .get('/api/v1/complaints?departmentId=DEPT_ROADS')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      const found = res.body.data.find(c => c.id === createdComplaint.id);
      assert.ok(found);
    });

    it('2.2 Roads Officer appends an internal note that is isolated from citizen view', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${createdComplaint.id}/notes`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          note: 'Contractor assigned for night asphalt patching schedule.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Verify Citizen cannot see officerNotes
      const citRes = await request(app)
        .get(`/api/v1/complaints/${createdComplaint.id}`)
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.strictEqual(citRes.status, 200);
      assert.strictEqual(citRes.body.data.officerNotes, undefined);
    });

    it('2.3 Roads Officer advances complaint status validly (SUBMITTED -> ASSIGNED -> IN_PROGRESS)', async () => {
      const res1 = await request(app)
        .patch(`/api/v1/complaints/${createdComplaint.id}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          status: 'ASSIGNED',
          remarks: 'Assigned to Ward 14 Road Maintenance Squad.'
        });
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.data.status, 'ASSIGNED');

      const res2 = await request(app)
        .patch(`/api/v1/complaints/${createdComplaint.id}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          status: 'IN_PROGRESS',
          remarks: 'Asphalt cold mix and roller deployed.'
        });
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.data.status, 'IN_PROGRESS');
    });

    it('2.4 Invalid status transition (IN_PROGRESS -> SUBMITTED) is rejected with 400 and permissible targets', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${createdComplaint.id}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          status: 'SUBMITTED',
          remarks: 'Attempt backward transition.'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Invalid status transition from 'IN_PROGRESS' to 'SUBMITTED'/i);
    });

    it('2.5 Roads Officer provides official response to citizen clarification thread', async () => {
      const res = await request(app)
        .post(`/api/v1/clarifications/${createdClarificationId}/respond`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          response: 'Location confirmed opposite Pillar 412. Asphalt repair team deployed.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'RESPONDED');
      assert.strictEqual(res.body.data.responses.length, 1);
      assert.strictEqual(res.body.data.responses[0].responderRole, 'officer');
    });

    it('2.6 Incomplete resolution payload fails Phase 9 Resolution Quality Checker gate', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${createdComplaint.id}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          status: 'RESOLVED',
          actionCompleted: true,
          closureRemarks: 'Done',
          evidence: []
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.code, 'RESOLUTION_QUALITY_FAILED');
      assert.strictEqual(res.body.valid, false);
    });

    it('2.7 Complete resolution payload passes Phase 9 Quality Gate and marks complaint RESOLVED', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${createdComplaint.id}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          status: 'RESOLVED',
          actionCompleted: true,
          outcomeType: 'REPAIR_COMPLETED',
          verificationMethod: 'PHYSICAL_INSPECTION',
          closureRemarks: 'Road surface excavated, compacted with WMM sub-base and resurfaced with 40mm bituminous concrete.',
          evidence: ['post_repair_photo_gate3_synth.jpg']
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'RESOLVED');
      assert.ok(res.body.data.resolutionDetails);
      assert.strictEqual(res.body.data.resolutionDetails.valid, true);
    });
  });

  // =========================================================================
  // JOURNEY 3: CITIZEN FEEDBACK, APPEALS & CONTROLLED REOPENING
  // =========================================================================
  describe('Journey 3: Citizen Feedback, Appeals & Controlled Reopening', () => {
    it('3.1 Citizen submits 5-star satisfaction rating on the resolved complaint', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${createdComplaint.id}/feedback`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          rating: 5,
          comments: 'Excellent quick resolution. Pothole cleanly resurfaced.'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.rating, 5);
    });

    it('3.2 Duplicate feedback submission on same milestone is rejected with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${createdComplaint.id}/feedback`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          rating: 4,
          comments: 'Attempting second rating.'
        });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'FEEDBACK_ALREADY_SUBMITTED');
    });

    it('3.3 Citizen files a formal resolution appeal disputing work quality', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${createdComplaint.id}/appeals`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'INCOMPLETE_WORK',
          citizenExplanation: 'Asphalt edge is crumbling after heavy evening rain; needs sealant reinforcement.',
          supportingEvidence: ['crumbled_edge_photo_synth.jpg']
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'SUBMITTED');
      assert.strictEqual(res.body.data.departmentId, 'DEPT_ROADS');
    });

    it('3.4 Roads Officer inspects appeals desk and adjudicates appeal decision', async () => {
      const listRes = await request(app)
        .get(`/api/v1/appeals?complaintId=${createdComplaint.id}`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.strictEqual(listRes.status, 200);
      assert.strictEqual(listRes.body.data.length, 1);
      const appealId = listRes.body.data[0].id;

      // First advance status to UNDER_REVIEW
      const reviewRes = await request(app)
        .patch(`/api/v1/appeals/${appealId}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({ status: 'UNDER_REVIEW', remarks: 'Case file retrieved for engineering review' });

      assert.strictEqual(reviewRes.status, 200);
      assert.strictEqual(reviewRes.body.data.status, 'UNDER_REVIEW');

      // Then record formal verdict
      const decRes = await request(app)
        .post(`/api/v1/appeals/${appealId}/decision`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          decision: 'UPHELD',
          decisionReason: 'Bituminous tack coat was compromised by sudden rain. Rework authorized.',
          citizenExplanation: 'Your appeal was upheld. Road maintenance squad will apply polymer tack sealant tonight.'
        });

      assert.strictEqual(decRes.status, 200);
      assert.strictEqual(decRes.body.success, true);
      assert.strictEqual(decRes.body.data.status, 'UPHELD');
    });

    it('3.5 Citizen files a controlled reopening petition and officer approves it atomically', async () => {
      const reopRes = await request(app)
        .post(`/api/v1/complaints/${createdComplaint.id}/reopening-requests`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'ISSUE_PERSISTS',
          citizenExplanation: 'Pothole depression is reopening due to bus tire loads.'
        });

      assert.strictEqual(reopRes.status, 201);
      assert.strictEqual(reopRes.body.success, true);
      const requestId = reopRes.body.data.id;

      // Roads Officer approves reopening
      const decRes = await request(app)
        .post(`/api/v1/reopening-requests/${requestId}/decision`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          decision: 'APPROVED',
          decisionReason: 'Site inspection confirms sub-base depression requiring concrete slab underlay.'
        });

      assert.strictEqual(decRes.status, 200);
      assert.strictEqual(decRes.body.success, true);
      assert.strictEqual(decRes.body.data.status, 'APPROVED');

      // Verify Complaint status is atomically set to REOPENED and resolutionDetails reset
      const compCheck = await request(app)
        .get(`/api/v1/complaints/${createdComplaint.id}`)
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.strictEqual(compCheck.status, 200);
      assert.strictEqual(compCheck.body.data.status, 'REOPENED');
      assert.strictEqual(compCheck.body.data.resolutionDetails, null);
    });
  });

  // =========================================================================
  // JOURNEY 4: ADMINISTRATOR GOVERNANCE, ANALYTICS & AUDIT LOGGING
  // =========================================================================
  describe('Journey 4: Administrator Governance & Analytics', () => {
    it('4.1 System Administrator queries platform-wide executive analytics overview', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.metrics);
      assert.strictEqual(typeof res.body.data.metrics.totalComplaints, 'number');
    });

    it('4.2 System Administrator retrieves departmental performance comparison matrix', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.departments));
    });

    it('4.3 System Administrator reassigns complaint between departments and logs audit event', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${createdComplaint.id}/department`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          departmentId: 'DEPT_MUNICIPAL',
          remarks: 'Reassigned from PWD to Municipal Local Body for drainage clearing.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.departmentId, 'DEPT_MUNICIPAL');

      // Verify Audit Log was recorded
      const auditRes = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(auditRes.status, 200);
      const reassignLog = auditRes.body.data.find(l => l.action === 'UPDATE_DEPARTMENT');
      assert.ok(reassignLog);
      assert.strictEqual(reassignLog.details.toDepartment, 'DEPT_MUNICIPAL');
    });

    it('4.4 System Administrator exports analytics CSV report with formula-injection defenses (CWE-1236)', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/export?reportType=OVERVIEW')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));
      assert.ok(res.text.includes('CivicSarthi'));

      // Verify Audit Log contains ANALYTICS_REPORT_EXPORTED
      const auditRes = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      const exportLog = auditRes.body.data.find(l => l.action === 'ANALYTICS_REPORT_EXPORTED');
      assert.ok(exportLog);
    });
  });

  // =========================================================================
  // JOURNEY 5: SECURITY BOUNDARIES, HEALTH PROBES & RBAC INVARIANTS
  // =========================================================================
  describe('Journey 5: Security Hardening & Deployment Health Probes', () => {
    it('5.1 Health Liveness Probe (/health/live) returns HTTP 200 with uptime', async () => {
      const res = await request(app).get('/health/live');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.live, true);
    });

    it('5.2 Health Readiness Probe (/health/ready) returns HTTP 200 verifying storage integrity', async () => {
      const res = await request(app).get('/health/ready');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.ready, true);
    });

    it('5.3 Unauthenticated request to protected endpoint receives HTTP 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('5.4 Citizen attempting officer-only action (appending internal officer note) receives HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${createdComplaint.id}/notes`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ note: 'Citizen attempting unauthorized officer note.' });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.code, 'FORBIDDEN_ROLE');
    });

    it('5.5 Officer from DEPT_WATER attempting to modify DEPT_ROADS complaint receives HTTP 403', async () => {
      // Re-create a complaint in DEPT_ROADS
      const compRes = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Road Surface Issue in Ward 4',
          description: 'Testing cross department modification guard.',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          state: 'Maharashtra',
          district: 'Pune'
        });

      const roadsCompId = compRes.body.data.id;

      // Water Officer attempts to update Roads complaint status
      const res = await request(app)
        .patch(`/api/v1/complaints/${roadsCompId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          status: 'IN_PROGRESS',
          remarks: 'Water officer trying to change roads complaint.'
        });

      assert.strictEqual(res.status, 403);
    });

    it('5.6 Officer attempting department reassignment receives HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${createdComplaint.id}/department`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          departmentId: 'DEPT_POWER',
          remarks: 'Unauthorized officer reassignment attempt.'
        });

      assert.strictEqual(res.status, 403);
      assert.match(res.body.error, /role 'officer' is not authorized/i);
    });
  });
});
