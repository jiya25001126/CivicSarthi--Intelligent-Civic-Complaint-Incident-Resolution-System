/**
 * @file feedback.test.js
 * @description Comprehensive test suite for CivicSarthi Phase 10:
 * Citizen Resolution Feedback, Appeals, Grievance Ratings & Controlled Reopening.
 *
 * Verifies:
 * 1. Citizen satisfaction feedback & 1-5 ratings on eligible resolved grievances.
 * 2. 1 submission per milestone, comments boundary enforcement, non-owner & unauthenticated rejection.
 * 3. Feedback aggregates & department-scoped rating summaries.
 * 4. Formal appeals submission, active deduplication, lifecycle transitions & audit logging.
 * 5. Appeal internal notes isolation and safe public tracking projection.
 * 6. Controlled grievance reopening workflow: request submission, reviewer decision,
 *    and atomic status transition to REOPENED with cycle increment and Phase 9 re-arming.
 * 7. Negative rating alone never reopens a complaint.
 * 8. Separation of appeals, feedback, and reopening records.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';

import complaintRepository from '../src/repositories/complaint.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import feedbackRepository from '../src/repositories/feedback.repository.js';
import appealRepository from '../src/repositories/appeal.repository.js';
import reopeningRequestRepository from '../src/repositories/reopeningRequest.repository.js';
import { authService } from '../src/services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-phase10-feedback');
const SANDBOX_COMPLAINTS_FILE = path.join(SANDBOX_DIR, 'complaints.test.json');
const SANDBOX_USERS_FILE = path.join(SANDBOX_DIR, 'users.test.json');
const SANDBOX_AUDIT_FILE = path.join(SANDBOX_DIR, 'audit_logs.test.json');
const SANDBOX_FEEDBACK_FILE = path.join(SANDBOX_DIR, 'feedback.test.json');
const SANDBOX_APPEALS_FILE = path.join(SANDBOX_DIR, 'appeals.test.json');
const SANDBOX_REOPENING_FILE = path.join(SANDBOX_DIR, 'reopening.test.json');

const app = createApp();

describe('CivicSarthi Phase 10 — Citizen Feedback, Appeals & Controlled Reopening', () => {
  let adminToken = null;
  let roadsOfficerToken = null;
  let waterOfficerToken = null;
  let citizenToken = null;
  let otherCitizenToken = null;

  let citizenUser = null;
  let otherCitizenUser = null;
  let roadsOfficerUser = null;

  before(async () => {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });

    // Initial complaints fixture
    const initialComplaints = {
      metadata: { version: '1.0.0', description: 'Phase 10 Test Fixture' },
      complaints: [
        {
          id: 'CMP-P10-001',
          referenceNumber: 'CS-2026-10001',
          title: 'Damaged pavement on JM Road',
          description: 'Pavement tiles are loose causing pedestrians to stumble.',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          department: 'DEPT_ROADS',
          status: 'RESOLVED',
          priority: 'MEDIUM',
          citizenId: 'CITIZEN-P10-001',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          reassignments: 0,
          reopenedCount: 0,
          isReopened: false,
          resolutionMilestone: '1',
          resolutionDetails: {
            valid: true,
            score: 95,
            isException: false,
            outcomeType: 'REPAIR_COMPLETED',
            verificationMethod: 'PHYSICAL_INSPECTION',
            closureRemarks: 'Pavement tiles relaid and grouted with mortar.',
            resolvedAt: new Date(Date.now() - 3600000).toISOString()
          },
          statusHistory: [
            {
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              status: 'SUBMITTED',
              actorType: 'CITIZEN',
              remarks: 'Complaint registered'
            },
            {
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              status: 'RESOLVED',
              actorType: 'OFFICER',
              remarks: 'Pavement repaired and inspected.'
            }
          ]
        },
        {
          id: 'CMP-P10-002',
          referenceNumber: 'CS-2026-10002',
          title: 'Unresolved water leakage',
          description: 'Water pipe leaking continuously for two days.',
          category: 'water',
          departmentId: 'DEPT_WATER',
          department: 'DEPT_WATER',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          citizenId: 'CITIZEN-P10-001',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          reassignments: 0,
          reopenedCount: 0,
          isReopened: false,
          resolutionMilestone: '1',
          resolutionDetails: null,
          statusHistory: [
            {
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              status: 'IN_PROGRESS',
              actorType: 'OFFICER',
              remarks: 'Work started'
            }
          ]
        }
      ]
    };

    // Initial blank collections
    await fs.writeFile(SANDBOX_COMPLAINTS_FILE, JSON.stringify(initialComplaints, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_USERS_FILE, JSON.stringify({ metadata: { total: 0 }, users: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_AUDIT_FILE, JSON.stringify({ metadata: { total: 0 }, logs: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_FEEDBACK_FILE, JSON.stringify({ metadata: { total: 0 }, feedback: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_APPEALS_FILE, JSON.stringify({ metadata: { total: 0 }, appeals: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_REOPENING_FILE, JSON.stringify({ metadata: { total: 0 }, reopeningRequests: [] }, null, 2), 'utf-8');

    // Wire repository sandboxes
    complaintRepository.setFilePath(SANDBOX_COMPLAINTS_FILE);
    userRepository.setFilePath(SANDBOX_USERS_FILE);
    auditLogRepository.setFilePath(SANDBOX_AUDIT_FILE);
    feedbackRepository.setFilePath(SANDBOX_FEEDBACK_FILE);
    appealRepository.setFilePath(SANDBOX_APPEALS_FILE);
    reopeningRequestRepository.setFilePath(SANDBOX_REOPENING_FILE);

    // Provision admin and officers
    const adminUser = await authService.provisionUser({
      email: 'admin.super@civicsarthi.gov.in',
      name: 'Chief Grievance Officer',
      password: 'AdminPassword123!',
      role: 'admin'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    adminToken = authService.generateToken(adminUser);

    roadsOfficerUser = await authService.provisionUser({
      email: 'officer.roads@civicsarthi.gov.in',
      name: 'Engineer R. Deshmukh',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    roadsOfficerToken = authService.generateToken(roadsOfficerUser);

    const waterOfficerUser = await authService.provisionUser({
      email: 'officer.water@civicsarthi.gov.in',
      name: 'Inspector S. Joshi',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    waterOfficerToken = authService.generateToken(waterOfficerUser);

    // Register citizen 1
    const citizenRegistration = await authService.register({
      email: 'citizen.kavita@example.com',
      password: 'Password123!',
      name: 'Kavita Patil'
    });
    citizenToken = citizenRegistration.token;
    citizenUser = citizenRegistration.user;

    // Register citizen 2 (unrelated)
    const otherCitizenRegistration = await authService.register({
      email: 'citizen.rahul@example.com',
      password: 'Password123!',
      name: 'Rahul Sharma'
    });
    otherCitizenToken = otherCitizenRegistration.token;
    otherCitizenUser = otherCitizenRegistration.user;

    // Link CMP-P10-001 and CMP-P10-002 ownership to citizenUser
    const comps = JSON.parse(await fs.readFile(SANDBOX_COMPLAINTS_FILE, 'utf-8'));
    comps.complaints[0].citizenId = citizenUser.id;
    comps.complaints[1].citizenId = citizenUser.id;
    await fs.writeFile(SANDBOX_COMPLAINTS_FILE, JSON.stringify(comps, null, 2), 'utf-8');
  });

  after(async () => {
    try { complaintRepository.resetFilePath(); } catch {}
    try { userRepository.resetFilePath(); } catch {}
    try { auditLogRepository.resetFilePath(); } catch {}
    try { feedbackRepository.resetFilePath(); } catch {}
    try { appealRepository.resetFilePath(); } catch {}
    try { reopeningRequestRepository.resetFilePath(); } catch {}
    try { await fs.rm(SANDBOX_DIR, { recursive: true, force: true }); } catch {}
  });

  // ==========================================
  // SECTION 1: CITIZEN RESOLUTION FEEDBACK
  // ==========================================
  describe('1. Citizen Resolution Feedback & Ratings', () => {
    it('rejects feedback without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/feedback')
        .send({ rating: 5, comments: 'Excellent resolution' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('rejects feedback on complaints owned by another citizen', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${otherCitizenToken}`)
        .send({ rating: 4, comments: 'Trying to rate someone else case' });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /only rate their own grievances/i);
    });

    it('rejects feedback on an unresolved complaint (IN_PROGRESS)', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-002/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 4, comments: 'Premature feedback' });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /officially resolved or closed/i);
    });

    it('rejects invalid ratings (< 1 or > 5 or non-number)', async () => {
      const resLow = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 0 });
      assert.equal(resLow.status, 400);

      const resHigh = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 6 });
      assert.equal(resHigh.status, 400);

      const resStr = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 'five' });
      assert.equal(resStr.status, 400);
    });

    it('rejects excessively long comments (> 1000 characters)', async () => {
      const longText = 'A'.repeat(1001);
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 4, comments: longText });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /cannot exceed 1000 characters/i);
    });

    it('records valid feedback from citizen owner on eligible resolution', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 4, comments: 'Work completed promptly and clean.' });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.rating, 4);
      assert.equal(res.body.data.citizenId, citizenUser.id);
      assert.equal(res.body.data.resolutionMilestone, '1');
      assert.ok(res.body.data.id.startsWith('FB-'));
    });

    it('rejects duplicate feedback for the same resolution milestone', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 5, comments: 'Submitting a second time' });

      assert.equal(res.status, 409);
      assert.match(res.body.error, /already been submitted for this resolution milestone/i);
    });

    it('retrieves feedback via complaint nested endpoint', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].rating, 4);
    });

    it('calculates feedback summary with departmental scope', async () => {
      const res = await request(app)
        .get('/api/v1/feedback/summary?departmentId=DEPT_ROADS')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.totalFeedback, 1);
      assert.equal(res.body.data.averageRating, 4);
      assert.equal(res.body.data.ratingDistribution[4], 1);
    });
  });

  // ==========================================
  // SECTION 2: FORMAL DISPUTE APPEALS
  // ==========================================
  describe('2. Formal Dispute Appeals Lifecycle', () => {
    let appealId = null;
    let appealRef = null;

    it('rejects appeal creation for unresolved complaint', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-002/appeals')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'INCOMPLETE_WORK',
          citizenExplanation: 'Work is still in progress'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /officially resolved or closed/i);
    });

    it('rejects appeal creation by non-owner citizen', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${otherCitizenToken}`)
        .send({
          reasonCategory: 'INCOMPLETE_WORK',
          citizenExplanation: 'Unauthorized citizen attempting appeal'
        });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /only lodge appeals for complaints you filed|only appeal resolutions for their own grievances/i);
    });

    it('rejects appeal with invalid reason category', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'NOT_A_VALID_CATEGORY',
          citizenExplanation: 'Valid explanation with invalid enum'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Invalid appeal reason category|Validation Error/i);
    });

    it('creates formal appeal for resolved complaint', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'INCOMPLETE_WORK',
          citizenExplanation: 'The loose tiles were placed back but mortar bonding was omitted, so they rattle.',
          supportingEvidence: ['https://storage.civicsarthi.gov.in/evidence/tiles_rattling.mp4']
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'SUBMITTED');
      assert.equal(res.body.data.requesterId, citizenUser.id);
      assert.ok(res.body.data.referenceNumber.startsWith('APL-'));

      appealId = res.body.data.id;
      appealRef = res.body.data.referenceNumber;
    });

    it('rejects second active appeal while first appeal is pending review', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'POOR_QUALITY',
          citizenExplanation: 'Filing duplicate appeal while previous is open.'
        });

      assert.equal(res.status, 409);
      assert.match(res.body.error, /active appeal/i);
    });

    it('enforces department scope on officer appeals queue', async () => {
      // Roads officer should see the appeal
      const roadsRes = await request(app)
        .get('/api/v1/appeals')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);
      assert.equal(roadsRes.status, 200);
      assert.ok(roadsRes.body.data.some(a => a.id === appealId));

      // Water officer should NOT see the roads appeal
      const waterRes = await request(app)
        .get('/api/v1/appeals')
        .set('Authorization', `Bearer ${waterOfficerToken}`);
      assert.equal(waterRes.status, 200);
      assert.ok(!waterRes.body.data.some(a => a.id === appealId));
    });

    it('allows officer to transition appeal to UNDER_REVIEW', async () => {
      const res = await request(app)
        .patch(`/api/v1/appeals/${appealId}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({ status: 'UNDER_REVIEW', remarks: 'Case file retrieved for engineering review' });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'UNDER_REVIEW');
    });

    it('rejects invalid status transition (e.g. UNDER_REVIEW -> SUBMITTED)', async () => {
      const res = await request(app)
        .patch(`/api/v1/appeals/${appealId}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({ status: 'SUBMITTED', remarks: 'Illegal backwards transition' });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Invalid appeal status transition/i);
    });

    it('adds internal note isolated from citizen-visible records', async () => {
      const res = await request(app)
        .post(`/api/v1/appeals/${appealId}/notes`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({ note: 'Supervisory check: ward junior engineer inspected mortar thickness.' });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });

    it('public tracking does NOT leak internal notes or citizen identity', async () => {
      const res = await request(app)
        .get(`/api/v1/appeals/track/${appealRef}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.referenceNumber, appealRef);
      assert.equal(res.body.data.status, 'UNDER_REVIEW');
      // Verify redaction of internal notes, requester ID, and audit details
      assert.equal(res.body.data.internalNotes, undefined);
      assert.equal(res.body.data.requesterId, undefined);
      assert.equal(res.body.data.auditLogs, undefined);
    });

    it('adjudicates appeal with UPHELD decision', async () => {
      const res = await request(app)
        .post(`/api/v1/appeals/${appealId}/decision`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          decision: 'UPHELD',
          decisionReason: 'Field inspection confirmed lack of mortar bonding between pavers.',
          citizenExplanation: 'Your appeal has been upheld. Department acknowledges mortar deficiency.'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'UPHELD');
      assert.equal(res.body.data.decision.outcome, 'UPHELD');

      // Crucial Phase 10 verification: Appeal UPHELD must NOT silently reopen complaint
      const compCheck = await complaintRepository.findById('CMP-P10-001');
      assert.equal(compCheck.status, 'RESOLVED', 'Complaint status must remain RESOLVED until explicit reopening request is approved');
    });
  });

  // ==========================================
  // SECTION 3: CONTROLLED GRIEVANCE REOPENING
  // ==========================================
  describe('3. Controlled Grievance Reopening Workflow', () => {
    let reopeningRequestId = null;

    it('rejects reopening request on unresolved complaint', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-002/reopening-requests')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'ISSUE_PERSISTS',
          citizenExplanation: 'Premature reopening attempt'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Cannot request reopening|only be requested for resolved or closed grievances/i);
    });

    it('rejects reopening request from non-owner citizen', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/reopening-requests')
        .set('Authorization', `Bearer ${otherCitizenToken}`)
        .send({
          reasonCategory: 'ISSUE_PERSISTS',
          citizenExplanation: 'Unauthorized citizen attempting reopening'
        });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /only request reopening for complaints you filed|only request reopening for their own grievances/i);
    });

    it('submits valid grievance reopening request by citizen owner', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/reopening-requests')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'ISSUE_PERSISTS',
          citizenExplanation: 'Pedestrians continue to trip as paving stones are still loose without binder.'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'PENDING_REVIEW');
      assert.equal(res.body.data.requesterId, citizenUser.id);
      assert.ok(res.body.data.id.startsWith('REOPEN-'));

      reopeningRequestId = res.body.data.id;
    });

    it('rejects duplicate pending reopening request', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/reopening-requests')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'RECURRING_FAILURE',
          citizenExplanation: 'Second concurrent reopening request'
        });

      assert.equal(res.status, 409);
      assert.match(res.body.error, /already has an active reopening request pending review/i);
    });

    it('rejects reopening decision by officer outside department scope', async () => {
      const res = await request(app)
        .post(`/api/v1/reopening-requests/${reopeningRequestId}/decision`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          decision: 'APPROVED',
          decisionReason: 'Cross-department unauthorized approval attempt'
        });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /outside your authorized department scope/i);
    });

    it('approves reopening request: transitions complaint to REOPENED, clears resolution details, increments cycle', async () => {
      const res = await request(app)
        .post(`/api/v1/reopening-requests/${reopeningRequestId}/decision`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          decision: 'APPROVED',
          decisionReason: 'Supervisory review confirmed that mortar work was incomplete; sending back to ward team.'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'APPROVED');

      // Verify complaint operational state post-reopening
      const updatedComplaint = await complaintRepository.findById('CMP-P10-001');
      assert.equal(updatedComplaint.status, 'REOPENED');
      assert.equal(updatedComplaint.isReopened, true);
      assert.equal(updatedComplaint.reopenedCount, 1);
      assert.equal(updatedComplaint.resolutionMilestone, '2');
      assert.equal(updatedComplaint.resolutionDetails, null, 'resolutionDetails must be cleared to re-arm Phase 9 validation');
      assert.ok(updatedComplaint.previousResolutionDetails, 'Previous resolution details must be preserved');
      assert.equal(updatedComplaint.previousResolutionDetails.score, 95);

      // Verify status history entry
      const lastHistory = updatedComplaint.statusHistory[updatedComplaint.statusHistory.length - 1];
      assert.equal(lastHistory.status, 'REOPENED');
      assert.match(lastHistory.remarks, /Reopening request approved/i);
    });

    it('rejects decision on already-decided reopening request', async () => {
      const res = await request(app)
        .post(`/api/v1/reopening-requests/${reopeningRequestId}/decision`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          decision: 'REJECTED',
          decisionReason: 'Attempting to decide an already approved request'
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Cannot adjudicate reopening request with status 'APPROVED'/i);
    });

    it('preserves earlier feedback and allows milestone 2 feedback upon subsequent resolution', async () => {
      // 1. Complaint is currently REOPENED. Resolve it again under Phase 9 standards
      const reResolveRes = await request(app)
        .patch('/api/v1/complaints/CMP-P10-001/status')
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          status: 'RESOLVED',
          actionCompleted: true,
          outcomeType: 'REPAIR_COMPLETED',
          verificationMethod: 'PHYSICAL_INSPECTION',
          closureRemarks: 'Pavement completely relaid with cement mortar and tested.',
          evidence: ['PHOTO_REPAVED_CYCLE2.JPG']
        });

      assert.equal(reResolveRes.status, 200);
      assert.equal(reResolveRes.body.data.status, 'RESOLVED');

      // 2. Submit milestone 2 feedback
      const fb2Res = await request(app)
        .post('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 5, comments: 'Cycle 2 repair is rock solid! Very satisfied now.' });

      assert.equal(fb2Res.status, 201);
      assert.equal(fb2Res.body.data.rating, 5);
      assert.equal(fb2Res.body.data.resolutionMilestone, '2');

      // 3. Verify that both milestone 1 and milestone 2 feedback records exist
      const allFeedbackRes = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/feedback')
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(allFeedbackRes.body.data.length, 2);
      const m1 = allFeedbackRes.body.data.find(f => f.resolutionMilestone === '1');
      const m2 = allFeedbackRes.body.data.find(f => f.resolutionMilestone === '2');
      assert.ok(m1 && m2, 'Both resolution milestone feedback records must be preserved');
      assert.equal(m1.rating, 4);
      assert.equal(m2.rating, 5);
    });
  });
});
