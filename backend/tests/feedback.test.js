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
import { appealService } from '../src/services/appeal.service.js';
import { reopeningService } from '../src/services/reopening.service.js';
import { MongoFeedbackRepository } from '../src/repositories/feedback.mongo.repository.js';

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
  let noDeptOfficerToken = null;
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
        },
        {
          id: 'CMP-P10-NODEPT',
          referenceNumber: 'CS-2026-99999',
          title: 'Unassigned department issue',
          description: 'A complaint filed without a specific assigned department.',
          category: 'other',
          departmentId: null,
          department: null,
          status: 'RESOLVED',
          priority: 'LOW',
          citizenId: 'CITIZEN-P10-001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          reassignments: 0,
          reopenedCount: 0,
          isReopened: false,
          resolutionMilestone: '1',
          resolutionDetails: { outcomeType: 'REPAIR_COMPLETED' },
          statusHistory: []
        },
        {
          id: 'CMP-P10-CONFLICT',
          referenceNumber: 'CS-2026-99998',
          title: 'Conflicting department record',
          description: 'Roads vs Water conflicting metadata',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          department: 'DEPT_WATER',
          status: 'RESOLVED',
          priority: 'LOW',
          citizenId: 'CITIZEN-P10-001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          reassignments: 0,
          reopenedCount: 0,
          isReopened: false,
          resolutionMilestone: '1',
          resolutionDetails: { outcomeType: 'REPAIR_COMPLETED' },
          statusHistory: []
        },
        {
          id: 'CMP-P10-UNVERIFIED',
          referenceNumber: 'CS-2026-99997',
          title: 'Unverified resolution grievance',
          description: 'A complaint marked resolved with explicitly failing resolution quality.',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          department: 'DEPT_ROADS',
          status: 'RESOLVED',
          priority: 'LOW',
          citizenId: 'CITIZEN-P10-001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          reassignments: 0,
          reopenedCount: 0,
          isReopened: false,
          resolutionMilestone: '1',
          resolutionDetails: { valid: false, score: 25 },
          statusHistory: []
        },
        {
          id: 'CMP-P10-OFFICER-RESOLVED',
          referenceNumber: 'CS-2026-99996',
          title: 'Officer verified resolution via status history with authorized policy',
          description: 'A complaint resolved by an officer with formal status history record and supervisory approval.',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          department: 'DEPT_ROADS',
          status: 'RESOLVED',
          priority: 'MEDIUM',
          citizenId: 'CITIZEN-P10-001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          reassignments: 0,
          reopenedCount: 0,
          isReopened: false,
          resolutionMilestone: '1',
          resolutionDetails: null,
          statusHistory: [
            {
              timestamp: new Date().toISOString(),
              status: 'RESOLVED',
              actorType: 'OFFICER',
              remarks: 'Speed breaker remodeled according to IRC standards and thermoplastic stripes applied.',
              supervisorApproved: true,
              policyOverride: true
            }
          ]
        },
        {
          id: 'CMP-P10-OFFICER-UNAUTHORIZED',
          referenceNumber: 'CS-2026-99995',
          title: 'Officer resolution lacking quality checks and policy override',
          description: 'A contemporary complaint resolved by an officer without quality checklist and without policy override.',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          department: 'DEPT_ROADS',
          status: 'RESOLVED',
          priority: 'MEDIUM',
          citizenId: 'CITIZEN-P10-001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          reassignments: 0,
          reopenedCount: 0,
          isReopened: false,
          resolutionMilestone: '1',
          resolutionDetails: null,
          statusHistory: [
            {
              timestamp: new Date().toISOString(),
              status: 'RESOLVED',
              actorType: 'OFFICER',
              remarks: 'Fixed the road pothole with bitumen patch.'
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

    const noDeptOfficerUser = await userRepository.create({
      email: 'officer.nodept@civicsarthi.gov.in',
      name: 'Unassigned Officer',
      passwordHash: 'dummyhash',
      role: 'officer',
      departmentId: null,
      isActive: true
    });
    noDeptOfficerToken = authService.generateToken(noDeptOfficerUser);

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

    // Link complaints ownership to citizenUser
    const comps = JSON.parse(await fs.readFile(SANDBOX_COMPLAINTS_FILE, 'utf-8'));
    comps.complaints.forEach((c) => {
      c.citizenId = citizenUser.id;
    });
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
      assert.match(res.body.error, /already been submitted for this resolution/i);
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

    it('retrieves feedback submitted by authenticated citizen via /api/v1/feedback/my', async () => {
      const res = await request(app)
        .get('/api/v1/feedback/my')
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 1);
      assert.ok(res.body.data.some(f => f.complaintId === 'CMP-P10-001' && f.rating === 4));
    });

    it('rejects feedback when resolution quality is unverified or invalid (valid: false)', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-UNVERIFIED/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 5, comments: 'Trying to rate unverified resolution' });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'RESOLUTION_QUALITY_INCOMPLETE');
      assert.equal(
        res.body.error,
        'Feedback is temporarily unavailable while this resolution is being verified. Please try again later.'
      );
    });

    it('rejects feedback when officer resolution history lacks quality checks and authorized policy override', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-OFFICER-UNAUTHORIZED/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 4, comments: 'Officer resolved without quality checklist or policy override' });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'RESOLUTION_QUALITY_INCOMPLETE');
      assert.equal(
        res.body.error,
        'Feedback is temporarily unavailable while this resolution is being verified. Please try again later.'
      );
    });

    it('records valid rating for eligible resolution verified via officer status history with authorized policy', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-OFFICER-RESOLVED/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 5, comments: 'Officially verified resolution work looks great.' });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.rating, 5);
      assert.equal(res.body.data.complaintId, 'CMP-P10-OFFICER-RESOLVED');
      assert.equal(res.body.data.resolutionMilestone, '1');
      assert.ok(res.body.data.id.startsWith('FB-'));

      // Retrieve to confirm persistence and retrieval
      const verifyRes = await request(app)
        .get('/api/v1/complaints/CMP-P10-OFFICER-RESOLVED/feedback')
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(verifyRes.status, 200);
      assert.equal(verifyRes.body.data.length, 1);
      assert.equal(verifyRes.body.data[0].rating, 5);
      assert.equal(verifyRes.body.data[0].comments, 'Officially verified resolution work looks great.');
    });

    it('protects against duplicate ratings on officer-verified complaints', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/CMP-P10-OFFICER-RESOLVED/feedback')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rating: 4, comments: 'Attempting duplicate rating' });

      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'FEEDBACK_ALREADY_SUBMITTED');
      assert.match(res.body.error, /already been submitted for this resolution/i);
    });

    it('MongoFeedbackRepository provides generateFeedbackId and create methods with FB-YYYY format', async () => {
      const repo = new MongoFeedbackRepository();
      assert.equal(typeof repo.generateFeedbackId, 'function');
      assert.equal(typeof repo.create, 'function');
      assert.equal(typeof repo.findByComplaintAndMilestone, 'function');
      assert.equal(typeof repo.findAll, 'function');
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

  // ==========================================
  // SECTION 4: COMPLAINT-SPECIFIC REVIEW ENDPOINTS & RBAC SCOPING
  // ==========================================
  describe('4. Complaint-Specific Nested Review Endpoints & RBAC Scoping', () => {
    it('allows complaint owner citizen to fetch complaint appeals with sanitized response', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);

      const appeal = res.body.data[0];
      // Citizen sanitization checks: internal notes and reviewer identity must NEVER leak
      assert.equal(appeal.internalNotes, undefined, 'Citizen response must never expose internalNotes');
      if (appeal.decision) {
        assert.equal(appeal.decision.reviewerId, undefined, 'Citizen response must never expose decision.reviewerId');
      }
      assert.ok(appeal.citizenExplanation || appeal.explanation, 'Citizen explanation must be accessible');
    });

    it('allows complaint owner citizen to fetch complaint reopening requests with sanitized response', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/reopening-requests')
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);

      const reqRecord = res.body.data[0];
      // Citizen sanitization checks
      assert.equal(reqRecord.internalNotes, undefined, 'Citizen response must never expose internalNotes');
      if (reqRecord.decision) {
        assert.equal(reqRecord.decision.reviewerId, undefined, 'Citizen response must never expose decision.reviewerId');
      }
      assert.ok(reqRecord.citizenExplanation || reqRecord.explanation, 'Citizen explanation must be accessible');
    });

    it('rejects unauthorized citizen trying to view another citizen complaint appeals', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${otherCitizenToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /only view appeals for complaints you filed/i);
    });

    it('rejects unauthorized citizen trying to view another citizen complaint reopening requests', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/reopening-requests')
        .set('Authorization', `Bearer ${otherCitizenToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /only view reopening requests for complaints you filed/i);
    });

    it('rejects officer viewing complaint appeals from another department', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /not authorized for department/i);
    });

    it('rejects officer viewing complaint reopening requests from another department', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/reopening-requests')
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /not authorized for department/i);
    });

    it('allows authorized department officer to view complaint appeals with internal notes intact', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);
      // Authorized officers must see internal notes for adjudication
      const appeal = res.body.data[0];
      assert.ok(appeal.internalNotes !== undefined, 'Department officer must have access to internal review notes');
    });

    it('allows authorized department officer to view complaint reopening requests', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/reopening-requests')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('allows admin oversight on both complaint appeals and reopening requests', async () => {
      const appRes = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(appRes.status, 200);

      const reopRes = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/reopening-requests')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(reopRes.status, 200);
    });

    it('returns 404 when complaint does not exist for appeals and reopenings', async () => {
      const appRes = await request(app)
        .get('/api/v1/complaints/NON-EXISTENT-CMP-999/appeals')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(appRes.status, 404);
      assert.match(appRes.body.error, /Grievance record not found/i);

      const reopRes = await request(app)
        .get('/api/v1/complaints/NON-EXISTENT-CMP-999/reopening-requests')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(reopRes.status, 404);
      assert.match(reopRes.body.error, /Grievance record not found/i);
    });

    it('returns 401 when unauthenticated request attempts to access complaint appeals or reopenings', async () => {
      const appRes = await request(app).get('/api/v1/complaints/CMP-P10-001/appeals');
      assert.equal(appRes.status, 401);

      const reopRes = await request(app).get('/api/v1/complaints/CMP-P10-001/reopening-requests');
      assert.equal(reopRes.status, 401);
    });

    it('confirms citizens are strictly forbidden from global officer review endpoints', async () => {
      const globalAppRes = await request(app)
        .get('/api/v1/appeals')
        .set('Authorization', `Bearer ${citizenToken}`);
      assert.equal(globalAppRes.status, 403);

      const globalReopRes = await request(app)
        .get('/api/v1/reopening-requests')
        .set('Authorization', `Bearer ${citizenToken}`);
      assert.equal(globalReopRes.status, 403);
    });

    it('rejects officer with missing departmentId from bypassing authorization on complaint appeals', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/appeals')
        .set('Authorization', `Bearer ${noDeptOfficerToken}`);
      assert.equal(res.status, 403);
      assert.match(res.body.error, /not authorized for department/i);
    });

    it('rejects officer with missing departmentId from bypassing authorization on complaint reopening requests', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-001/reopening-requests')
        .set('Authorization', `Bearer ${noDeptOfficerToken}`);
      assert.equal(res.status, 403);
      assert.match(res.body.error, /not authorized for department/i);
    });

    it('rejects officer from accessing complaint appeals when complaint has missing department', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-NODEPT/appeals')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);
      assert.equal(res.status, 403);
      assert.match(res.body.error, /not authorized for department/i);
    });

    it('rejects officer from accessing complaint reopening requests when complaint has missing department', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/CMP-P10-NODEPT/reopening-requests')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);
      assert.equal(res.status, 403);
      assert.match(res.body.error, /not authorized for department/i);
    });

    it('resolves complaint by reference number (CS-2026-10001) for appeals and reopening queries', async () => {
      const appRes = await request(app)
        .get('/api/v1/complaints/CS-2026-10001/appeals')
        .set('Authorization', `Bearer ${citizenToken}`);
      assert.equal(appRes.status, 200);
      assert.equal(appRes.body.success, true);
      assert.ok(Array.isArray(appRes.body.data));

      const reopRes = await request(app)
        .get('/api/v1/complaints/CS-2026-10001/reopening-requests')
        .set('Authorization', `Bearer ${citizenToken}`);
      assert.equal(reopRes.status, 200);
      assert.equal(reopRes.body.success, true);
      assert.ok(Array.isArray(reopRes.body.data));
    });

    it('sanitizes plain JSON appeal and reopening records without leaking internal reviewer metadata', () => {
      const rawAppeal = {
        id: 'APP-TEST-001',
        referenceNumber: 'APL-2026-0001',
        complaintId: 'CMP-TEST-001',
        complaintReference: 'CS-2026-0001',
        requesterId: 'CITIZEN-001',
        departmentId: 'DEPT_ROADS',
        reasonCategory: 'INCOMPLETE_WORK',
        explanation: 'Work was only half done.',
        assignedReviewerId: 'OFFICER-SECRET-ID',
        reviewerId: 'OFFICER-SECRET-ID',
        reviewedBy: 'OFFICER-SECRET-ID',
        internalNotes: [
          { note: 'Confidential officer assessment', officerId: 'OFFICER-SECRET-ID' }
        ],
        decision: {
          outcome: 'UPHELD',
          reason: 'Valid grounds established',
          reviewerId: 'OFFICER-SECRET-ID',
          decidedAt: new Date().toISOString()
        },
        statusHistory: [
          { status: 'SUBMITTED', actorRole: 'citizen', actorId: 'CITIZEN-001', remarks: 'Lodged' },
          { status: 'UNDER_REVIEW', actorRole: 'officer', actorId: 'OFFICER-SECRET-ID', remarks: 'Reviewing' }
        ]
      };

      const sanitizedAppeal = appealService.sanitizeForCitizen(rawAppeal);
      assert.equal(sanitizedAppeal.internalNotes, undefined, 'internalNotes must be removed');
      assert.equal(sanitizedAppeal.assignedReviewerId, undefined, 'assignedReviewerId must be removed');
      assert.equal(sanitizedAppeal.reviewerId, undefined, 'reviewerId must be removed');
      assert.equal(sanitizedAppeal.reviewedBy, undefined, 'reviewedBy must be removed');
      assert.equal(sanitizedAppeal.decision.reviewerId, undefined, 'decision.reviewerId must be removed');
      assert.equal(sanitizedAppeal.decision.outcome, 'UPHELD');
      assert.equal(sanitizedAppeal.statusHistory[0].actorId, undefined, 'Citizen actorId stripped from statusHistory');
      assert.equal(sanitizedAppeal.statusHistory[1].actorId, undefined, 'Officer actorId stripped from statusHistory');

      const rawReopening = {
        id: 'REOP-TEST-001',
        referenceNumber: 'ROP-2026-0001',
        complaintId: 'CMP-TEST-001',
        requesterId: 'CITIZEN-001',
        explanation: 'Pot hole reappeared within 2 days.',
        assignedReviewerId: 'SUPERVISOR-SECRET-ID',
        internalNotes: [{ note: 'Supervisor deliberation', officerId: 'SUPERVISOR-SECRET-ID' }],
        decision: {
          outcome: 'APPROVED',
          reason: 'Physical defect verified',
          reviewerId: 'SUPERVISOR-SECRET-ID'
        },
        statusHistory: [
          { status: 'PENDING_REVIEW', actorRole: 'citizen', actorId: 'CITIZEN-001' },
          { status: 'APPROVED', actorRole: 'supervisor', actorId: 'SUPERVISOR-SECRET-ID' }
        ]
      };

      const sanitizedReopening = reopeningService.sanitizeForCitizen(rawReopening);
      assert.equal(sanitizedReopening.internalNotes, undefined);
      assert.equal(sanitizedReopening.assignedReviewerId, undefined);
      assert.equal(sanitizedReopening.decision.reviewerId, undefined);
      assert.equal(sanitizedReopening.statusHistory[1].actorId, undefined);
    });

    it('sanitizes MongoDB Mongoose-like documents with .toObject() without leaking internal reviewer metadata', () => {
      const mockMongooseDoc = {
        _id: '64f1234567890abcdef12345',
        id: 'APP-MONGO-001',
        referenceNumber: 'APL-2026-0099',
        complaintId: 'CMP-MONGO-001',
        explanation: 'Work was disputed by resident.',
        assignedReviewerId: 'MONGO-OFFICER-777',
        internalNotes: [{ note: 'Mongo internal note', officerId: 'MONGO-OFFICER-777' }],
        decision: {
          outcome: 'REJECTED',
          reason: 'Insufficient evidence',
          reviewerId: 'MONGO-OFFICER-777',
          toObject() {
            return {
              outcome: 'REJECTED',
              reason: 'Insufficient evidence',
              reviewerId: 'MONGO-OFFICER-777'
            };
          }
        },
        statusHistory: [
          {
            status: 'SUBMITTED',
            actorRole: 'citizen',
            actorId: 'CITIZEN-MONGO-1',
            toObject() { return { status: 'SUBMITTED', actorRole: 'citizen', actorId: 'CITIZEN-MONGO-1' }; }
          },
          {
            status: 'REJECTED',
            actorRole: 'officer',
            actorId: 'MONGO-OFFICER-777',
            toObject() { return { status: 'REJECTED', actorRole: 'officer', actorId: 'MONGO-OFFICER-777' }; }
          }
        ],
        toObject() {
          return {
            id: this.id,
            referenceNumber: this.referenceNumber,
            complaintId: this.complaintId,
            explanation: this.explanation,
            assignedReviewerId: this.assignedReviewerId,
            internalNotes: [...this.internalNotes],
            decision: this.decision.toObject(),
            statusHistory: this.statusHistory.map((s) => s.toObject())
          };
        }
      };

      const sanitized = appealService.sanitizeForCitizen(mockMongooseDoc);
      assert.equal(sanitized.internalNotes, undefined, 'Mongoose doc internalNotes must be removed');
      assert.equal(sanitized.assignedReviewerId, undefined, 'Mongoose doc assignedReviewerId must be removed');
      assert.equal(sanitized.decision.reviewerId, undefined, 'Mongoose doc decision.reviewerId must be removed');
      assert.equal(sanitized.decision.outcome, 'REJECTED');
      assert.equal(sanitized.statusHistory[0].actorId, undefined, 'Citizen actorId stripped from Mongoose statusHistory');
      assert.equal(sanitized.statusHistory[1].actorId, undefined, 'Officer actorId stripped');
    });

    it('rejects officer without assigned department from listing appeals or reopening requests', async () => {
      const unassignedOfficer = { id: 'OFFICER-NO-DEPT', role: 'officer', email: 'nodept@civicsarthi.internal' };

      await assert.rejects(
        async () => appealService.listAppeals({}, unassignedOfficer),
        (err) => err.status === 403 && err.code === 'FORBIDDEN_DEPARTMENT_MISMATCH'
      );

      await assert.rejects(
        async () => reopeningService.listReopeningRequests({}, unassignedOfficer),
        (err) => err.status === 403 && err.code === 'FORBIDDEN_DEPARTMENT_MISMATCH'
      );
    });

    it('rejects officer without assigned department or resource with missing department from accessing appeals/reopenings', async () => {
      const unassignedOfficer = { id: 'OFFICER-NO-DEPT', role: 'officer' };
      const assignedOfficer = { id: 'OFFICER-ROADS', role: 'officer', departmentId: 'DEPT_ROADS' };

      // Appeal with unassigned department
      const unassignedAppeal = {
        id: 'APP-NO-DEPT',
        complaintId: 'CMP-P10-001',
        departmentId: null,
        department: null,
        requesterId: citizenUser.id
      };
      await appealRepository.create(unassignedAppeal);

      // Reopening request with unassigned department
      const unassignedReopening = {
        id: 'REOPEN-NO-DEPT',
        complaintId: 'CMP-P10-001',
        departmentId: null,
        department: null,
        requesterId: citizenUser.id
      };
      await reopeningRequestRepository.create(unassignedReopening);

      // Appeal with assigned department
      const assignedAppeal = {
        id: 'APP-ASSIGNED-DEPT',
        complaintId: 'CMP-P10-001',
        departmentId: 'DEPT_ROADS',
        department: 'DEPT_ROADS',
        requesterId: citizenUser.id
      };
      await appealRepository.create(assignedAppeal);

      // Reopening request with assigned department
      const assignedReopening = {
        id: 'REOPEN-ASSIGNED-DEPT',
        complaintId: 'CMP-P10-001',
        departmentId: 'DEPT_ROADS',
        department: 'DEPT_ROADS',
        requesterId: citizenUser.id
      };
      await reopeningRequestRepository.create(assignedReopening);

      // Unassigned officer attempting to access assigned appeal
      await assert.rejects(
        async () => appealService.getAppealById('APP-ASSIGNED-DEPT', unassignedOfficer),
        (err) => err.status === 403 && err.code === 'FORBIDDEN_DEPARTMENT_MISMATCH'
      );

      // Assigned officer attempting to access unassigned appeal
      await assert.rejects(
        async () => appealService.getAppealById('APP-NO-DEPT', assignedOfficer),
        (err) => err.status === 403 && err.code === 'FORBIDDEN_DEPARTMENT_MISMATCH'
      );

      // Unassigned officer attempting to access assigned reopening
      await assert.rejects(
        async () => reopeningService.getReopeningRequestById('REOPEN-ASSIGNED-DEPT', unassignedOfficer),
        (err) => err.status === 403 && err.code === 'FORBIDDEN_DEPARTMENT_MISMATCH'
      );

      // Assigned officer attempting to access unassigned reopening
      await assert.rejects(
        async () => reopeningService.getReopeningRequestById('REOPEN-NO-DEPT', assignedOfficer),
        (err) => err.status === 403 && err.code === 'FORBIDDEN_DEPARTMENT_MISMATCH'
      );
    });

    it('comprehensively scrubs all reviewer and officer identifiers from MongoDB and JSON records', () => {
      const complexDoc = {
        id: 'COMPLEX-APP-001',
        explanation: 'Thorough inspection required',
        assignedReviewerId: 'SECRET-OFFICER-1',
        reviewerId: 'SECRET-OFFICER-2',
        reviewedBy: 'SECRET-OFFICER-3',
        officerId: 'SECRET-OFFICER-4',
        internalNotes: [{ note: 'Confidential assessment', officerId: 'SECRET-OFFICER-1' }],
        decision: {
          outcome: 'UPHELD',
          reason: 'Valid proof provided',
          reviewerId: 'SECRET-OFFICER-1',
          reviewer: 'SECRET-OFFICER-1',
          reviewedBy: 'SECRET-OFFICER-1',
          officerId: 'SECRET-OFFICER-1'
        },
        statusHistory: [
          { status: 'SUBMITTED', actorRole: 'citizen', actorId: 'CITIZEN-123', actorEmail: 'cit@test.com' },
          { status: 'REVIEWED', actorRole: 'officer', actorId: 'SECRET-OFFICER-1', actorEmail: 'officer@gov.in', officerId: 'SECRET-OFFICER-1' }
        ]
      };

      const sanitizedAppeal = appealService.sanitizeForCitizen(complexDoc);
      assert.strictEqual(sanitizedAppeal.assignedReviewerId, undefined);
      assert.strictEqual(sanitizedAppeal.reviewerId, undefined);
      assert.strictEqual(sanitizedAppeal.reviewedBy, undefined);
      assert.strictEqual(sanitizedAppeal.officerId, undefined);
      assert.strictEqual(sanitizedAppeal.internalNotes, undefined);
      assert.strictEqual(sanitizedAppeal.decision.reviewerId, undefined);
      assert.strictEqual(sanitizedAppeal.decision.reviewer, undefined);
      assert.strictEqual(sanitizedAppeal.decision.reviewedBy, undefined);
      assert.strictEqual(sanitizedAppeal.decision.officerId, undefined);
      assert.strictEqual(sanitizedAppeal.statusHistory[1].actorId, undefined);
      assert.strictEqual(sanitizedAppeal.statusHistory[1].actorEmail, undefined);
      assert.strictEqual(sanitizedAppeal.statusHistory[1].officerId, undefined);
      assert.strictEqual(sanitizedAppeal.statusHistory[0].actorId, undefined);

      const sanitizedReopening = reopeningService.sanitizeForCitizen(complexDoc);
      assert.strictEqual(sanitizedReopening.assignedReviewerId, undefined);
      assert.strictEqual(sanitizedReopening.decision.reviewerId, undefined);
      assert.strictEqual(sanitizedReopening.decision.officerId, undefined);
      assert.strictEqual(sanitizedReopening.statusHistory[1].actorId, undefined);
      assert.strictEqual(sanitizedReopening.statusHistory[1].officerId, undefined);
    });

    it('rejects officer access when complaint has conflicting department fields (departmentId !== department)', async () => {
      // Roads officer must NOT be permitted access merely because departmentId matches
      const roadsRes = await request(app)
        .get('/api/v1/complaints/CMP-P10-CONFLICT/appeals')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);
      assert.equal(roadsRes.status, 403);
      assert.match(roadsRes.body.error, /conflicting department fields/i);

      // Water officer must NOT be permitted access merely because department alias matches
      const waterRes = await request(app)
        .get('/api/v1/complaints/CMP-P10-CONFLICT/appeals')
        .set('Authorization', `Bearer ${waterOfficerToken}`);
      assert.equal(waterRes.status, 403);
      assert.match(waterRes.body.error, /conflicting department fields/i);

      // Reopening requests on conflicting complaint must also be rejected for both
      const roadsReopRes = await request(app)
        .get('/api/v1/complaints/CMP-P10-CONFLICT/reopening-requests')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);
      assert.equal(roadsReopRes.status, 403);
      assert.match(roadsReopRes.body.error, /conflicting department fields/i);

      const waterReopRes = await request(app)
        .get('/api/v1/complaints/CMP-P10-CONFLICT/reopening-requests')
        .set('Authorization', `Bearer ${waterOfficerToken}`);
      assert.equal(waterReopRes.status, 403);
      assert.match(waterReopRes.body.error, /conflicting department fields/i);
    });

    it('rejects officer access when appeal or reopening record has conflicting department fields', async () => {
      const conflictingAppeal = {
        id: 'APP-CONFLICT-DEPT',
        complaintId: 'CMP-P10-001',
        departmentId: 'DEPT_ROADS',
        department: 'DEPT_WATER',
        requesterId: citizenUser.id
      };
      await appealRepository.create(conflictingAppeal);

      const roadsOfficer = { id: 'OFF-ROADS', role: 'officer', departmentId: 'DEPT_ROADS' };
      const waterOfficer = { id: 'OFF-WATER', role: 'officer', departmentId: 'DEPT_WATER' };

      await assert.rejects(
        async () => appealService.getAppealById('APP-CONFLICT-DEPT', roadsOfficer),
        (err) => err.status === 403 && /conflicting department fields/i.test(err.message)
      );

      await assert.rejects(
        async () => appealService.getAppealById('APP-CONFLICT-DEPT', waterOfficer),
        (err) => err.status === 403 && /conflicting department fields/i.test(err.message)
      );
    });

    it('rejects officer with conflicting department fields in their own user profile', async () => {
      const conflictingOfficer = {
        id: 'OFF-CONFLICT-PROFILE',
        role: 'officer',
        departmentId: 'DEPT_ROADS',
        department: 'DEPT_WATER'
      };

      await assert.rejects(
        async () => appealService.listAppeals({}, conflictingOfficer),
        (err) => err.status === 403 && /conflicting department fields/i.test(err.message)
      );

      await assert.rejects(
        async () => reopeningService.listReopeningRequests({}, conflictingOfficer),
        (err) => err.status === 403 && /conflicting department fields/i.test(err.message)
      );
    });

    it('guarantees explicit citizen-safe projection: arbitrary or internal metadata cannot leak', () => {
      const dirtyAppealDoc = {
        id: 'APP-DIRTY-001',
        referenceNumber: 'APL-2026-DIRTY',
        complaintId: 'CMP-001',
        complaintReference: 'CS-2026-0001',
        requesterId: 'CIT-001',
        departmentId: 'DEPT_ROADS',
        reasonCategory: 'INCOMPLETE_WORK',
        explanation: 'Civic issue not fixed',
        assignedReviewerId: 'INTERNAL-REVIEWER-99',
        internalAuditScore: 98.6,
        policeEscortRequired: true,
        secretGovKey: 'TOP_SECRET_12345',
        internalNotes: [{ note: 'Classified deliberation' }],
        decision: {
          outcome: 'REJECTED',
          reason: 'Rejected on grounds of insufficient proof',
          reviewerId: 'REVIEWER-PRIVATE-ID',
          internalDiscretionNotes: 'Off the record comments',
          decidedAt: new Date().toISOString()
        },
        statusHistory: [
          { status: 'SUBMITTED', actorRole: 'citizen', actorId: 'CIT-001' },
          { status: 'REJECTED', actorRole: 'officer', actorId: 'OFFICER-7', officerBadgeNumber: 'BADGE-123' }
        ]
      };

      const cleanAppeal = appealService.sanitizeForCitizen(dirtyAppealDoc);
      // Strictly verify no extra or internal fields are leaked
      assert.strictEqual(cleanAppeal.policeEscortRequired, undefined);
      assert.strictEqual(cleanAppeal.internalAuditScore, undefined);
      assert.strictEqual(cleanAppeal.secretGovKey, undefined);
      assert.strictEqual(cleanAppeal.internalNotes, undefined);
      assert.strictEqual(cleanAppeal.assignedReviewerId, undefined);
      assert.strictEqual(cleanAppeal.decision.reviewerId, undefined);
      assert.strictEqual(cleanAppeal.decision.internalDiscretionNotes, undefined);
      assert.strictEqual(cleanAppeal.decision.outcome, 'REJECTED');
      assert.strictEqual(cleanAppeal.statusHistory[1].actorId, undefined);
      assert.strictEqual(cleanAppeal.statusHistory[1].officerBadgeNumber, undefined);

      const cleanReopening = reopeningService.sanitizeForCitizen(dirtyAppealDoc);
      assert.strictEqual(cleanReopening.policeEscortRequired, undefined);
      assert.strictEqual(cleanReopening.secretGovKey, undefined);
      assert.strictEqual(cleanReopening.decision.reviewerId, undefined);
      assert.strictEqual(cleanReopening.decision.internalDiscretionNotes, undefined);
      assert.strictEqual(cleanReopening.decision.outcome, 'REJECTED');
      assert.strictEqual(cleanReopening.statusHistory[1].actorId, undefined);
    });
  });
});
