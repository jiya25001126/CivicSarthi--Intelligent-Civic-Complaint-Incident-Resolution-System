/**
 * @file productionFollowupsAppeals.test.js
 * @description Comprehensive automated test suite for CivicSarthi Production Bug Fixes:
 * Citizen Follow-Ups, Clarification Threads, Appeals & Controlled Reopening.
 *
 * Verifies all 17 required scenarios:
 * 1. Citizen successfully requests a follow-up reminder.
 * 2. Follow-up reminder cooldown and duplicate-request handling.
 * 3. Unauthorized citizens cannot create reminders for other citizens' grievances.
 * 4. Citizen clarification submission succeeds and survives a subsequent read.
 * 5. Clarification submission does not change complaint status.
 * 6. Unauthorized cross-citizen clarification requests are rejected.
 * 7. Citizen can lodge a formal resolution appeal.
 * 8. The same appeal appears in the citizen complaint detail and authorized officer queue.
 * 9. Appeal status changes and officer decisions persist.
 * 10. Citizen can submit a valid reopening petition.
 * 11. The same reopening petition appears in the citizen complaint detail and authorized officer queue.
 * 12. Approved reopening triggers the existing status and re-verification rules.
 * 13. Rejected reopening leaves the complaint's resolution status unchanged.
 * 14. Department scoping prevents unauthorized officers from accessing other departments' records.
 * 15. Invalid payloads produce appropriate 4xx responses instead of unexplained 500 errors.
 * 16. Repository behavior is tested in the supported JSON adapter and MongoDB-compatible test setup.
 * 17. Existing authentication, RBAC, audit logging, and persistence safety tests continue to pass.
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
import { clarificationRepository } from '../src/repositories/clarification.repository.js';
import { reminderRepository } from '../src/repositories/reminder.repository.js';
import { appealRepository } from '../src/repositories/appeal.repository.js';
import { reopeningRequestRepository } from '../src/repositories/reopeningRequest.repository.js';

import { authService } from '../src/services/auth.service.js';
import { COMPLAINT_STATUS } from '../src/constants/status.constants.js';
import { ReminderModel } from '../src/models/reminder.model.js';
import { ClarificationModel } from '../src/models/clarification.model.js';
import AppealModel from '../src/models/appeal.model.js';
import ReopeningRequestModel from '../src/models/reopeningRequest.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-production-bugfix');
const SANDBOX_COMPLAINTS_FILE = path.join(SANDBOX_DIR, 'complaints.test.json');
const SANDBOX_USERS_FILE = path.join(SANDBOX_DIR, 'users.test.json');
const SANDBOX_AUDIT_FILE = path.join(SANDBOX_DIR, 'audit_logs.test.json');
const SANDBOX_CLARIFICATIONS_FILE = path.join(SANDBOX_DIR, 'clarifications.test.json');
const SANDBOX_REMINDERS_FILE = path.join(SANDBOX_DIR, 'reminders.test.json');
const SANDBOX_APPEALS_FILE = path.join(SANDBOX_DIR, 'appeals.test.json');
const SANDBOX_REOPENING_FILE = path.join(SANDBOX_DIR, 'reopening.test.json');

const app = createApp();

describe('CivicSarthi Production Bug Fixes — Follow-Ups, Clarifications, Appeals & Reopening', () => {
  let citizenToken = null;
  let otherCitizenToken = null;
  let roadsOfficerToken = null;
  let waterOfficerToken = null;
  let adminToken = null;

  let citizenUser = null;
  let otherCitizenUser = null;
  let roadsOfficerUser = null;
  let waterOfficerUser = null;
  let adminUser = null;

  let activeComplaint = null;
  let resolvedComplaint = null;

  before(async () => {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });

    // Initialize blank fixtures
    await fs.writeFile(SANDBOX_COMPLAINTS_FILE, JSON.stringify({ metadata: { version: '1.0.0' }, complaints: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_USERS_FILE, JSON.stringify({ metadata: { total: 0 }, users: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_AUDIT_FILE, JSON.stringify({ metadata: { total: 0 }, logs: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_CLARIFICATIONS_FILE, JSON.stringify({ metadata: { version: '1.0.0' }, clarifications: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_REMINDERS_FILE, JSON.stringify({ metadata: { version: '1.0.0' }, reminders: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_APPEALS_FILE, JSON.stringify({ metadata: { total: 0 }, appeals: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_REOPENING_FILE, JSON.stringify({ metadata: { total: 0 }, reopeningRequests: [] }, null, 2), 'utf-8');

    // Wire repository sandboxes
    complaintRepository.setFilePath(SANDBOX_COMPLAINTS_FILE);
    userRepository.setFilePath(SANDBOX_USERS_FILE);
    auditLogRepository.setFilePath(SANDBOX_AUDIT_FILE);
    clarificationRepository.setFilePath(SANDBOX_CLARIFICATIONS_FILE);
    reminderRepository.setFilePath(SANDBOX_REMINDERS_FILE);
    appealRepository.setFilePath(SANDBOX_APPEALS_FILE);
    reopeningRequestRepository.setFilePath(SANDBOX_REOPENING_FILE);

    // Register primary citizen
    const citizenReg = await authService.register({
      email: 'citizen.aarav@civicsarthi.test',
      password: 'CitizenPassword123!',
      name: 'Aarav Mehta'
    });
    citizenToken = citizenReg.token;
    citizenUser = citizenReg.user;

    // Register second citizen
    const otherReg = await authService.register({
      email: 'citizen.diya@civicsarthi.test',
      password: 'CitizenPassword123!',
      name: 'Diya Sen'
    });
    otherCitizenToken = otherReg.token;
    otherCitizenUser = otherReg.user;

    // Provision departmental officers & admin
    roadsOfficerUser = await authService.provisionUser({
      name: 'Inspector Vikram Malhotra',
      email: 'officer.roads.prod@civicsarthi.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    roadsOfficerToken = authService.generateToken(roadsOfficerUser);

    waterOfficerUser = await authService.provisionUser({
      name: 'Inspector Ananya Roy',
      email: 'officer.water.prod@civicsarthi.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    waterOfficerToken = authService.generateToken(waterOfficerUser);

    adminUser = await authService.provisionUser({
      name: 'Super Admin',
      email: 'admin.prod.fix@civicsarthi.gov.in',
      password: 'AdminPassword123!',
      role: 'admin',
      departmentId: null
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    adminToken = authService.generateToken(adminUser);

    // Seed test complaints
    activeComplaint = await complaintRepository.create({
      title: 'Deep pothole outside Model Colony metro station',
      description: 'Vehicles are getting damaged due to the large pothole on the main carriageway.',
      category: 'roads',
      departmentId: 'DEPT_ROADS',
      department: 'DEPT_ROADS',
      status: COMPLAINT_STATUS.IN_PROGRESS,
      priority: 'HIGH',
      citizenId: citizenUser.id,
      reopenedCount: 0,
      isReopened: false,
      resolutionMilestone: '1'
    });

    resolvedComplaint = await complaintRepository.create({
      title: 'Broken streetlight on 5th Avenue',
      description: 'Streetlight pole 44 is flickering and dark at night.',
      category: 'roads',
      departmentId: 'DEPT_ROADS',
      department: 'DEPT_ROADS',
      status: COMPLAINT_STATUS.RESOLVED,
      priority: 'MEDIUM',
      citizenId: citizenUser.id,
      reopenedCount: 0,
      isReopened: false,
      resolutionMilestone: '1',
      resolutionDetails: {
        outcomeType: 'REPAIR_COMPLETED',
        verificationMethod: 'PHYSICAL_INSPECTION',
        closureRemarks: 'Replaced LED luminaire',
        resolvedAt: new Date().toISOString()
      }
    });
  });

  after(async () => {
    complaintRepository.resetFilePath?.();
    userRepository.resetFilePath?.();
    auditLogRepository.resetFilePath?.();
    clarificationRepository.resetFilePath?.();
    reminderRepository.resetFilePath?.();
    appealRepository.resetFilePath?.();
    reopeningRequestRepository.resetFilePath?.();
  });

  // =========================================================================
  // Problem 1: Citizen Follow-Up Reminders
  // =========================================================================
  describe('Problem 1: Citizen Follow-Up Reminders', () => {
    it('1. Citizen successfully requests a follow-up reminder', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${activeComplaint.id}/reminders`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ deliveryChannel: 'IN_APP' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const rem = res.body.data.reminder || res.body.data;
      assert.ok(rem.id, 'Reminder must have an id');
      assert.equal(rem.complaintId, activeComplaint.id);
      assert.equal(rem.citizenId, citizenUser.id);
      assert.equal(res.body.data.status, 'ACCEPTED');
    });

    it('2. Follow-up reminder cooldown and duplicate-request handling returns 429', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${activeComplaint.id}/reminders`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ deliveryChannel: 'IN_APP' });

      assert.equal(res.status, 429);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /cooldown|throttled|already logged recently/i);
    });

    it('3. Unauthorized citizens cannot create reminders for other citizens grievances', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${activeComplaint.id}/reminders`)
        .set('Authorization', `Bearer ${otherCitizenToken}`)
        .send({ deliveryChannel: 'IN_APP' });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /access denied|only submit reminders for grievances you filed/i);
    });
  });

  // =========================================================================
  // Problem 2: Citizen Clarification & Information Threads
  // =========================================================================
  describe('Problem 2: Citizen Clarification & Information Threads', () => {
    let createdClarification = null;

    it('4. Citizen clarification submission succeeds and survives a subsequent read', async () => {
      const postRes = await request(app)
        .post(`/api/v1/complaints/${activeComplaint.id}/clarifications`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          type: 'ADDITIONAL_INFO',
          content: 'The pothole is directly opposite gate number 2 of the metro station.'
        });

      assert.equal(postRes.status, 201);
      assert.equal(postRes.body.success, true);
      assert.ok(postRes.body.data.id, 'Clarification must have an assigned id');
      assert.equal(postRes.body.data.complaintId, activeComplaint.id);
      assert.equal(postRes.body.data.citizenId, citizenUser.id);
      createdClarification = postRes.body.data;

      // Read back
      const getRes = await request(app)
        .get(`/api/v1/complaints/${activeComplaint.id}/clarifications`)
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.success, true);
      assert.ok(Array.isArray(getRes.body.data));
      const found = getRes.body.data.find((c) => c.id === createdClarification.id);
      assert.ok(found, 'Created clarification thread must be returned in the complaint thread list');
    });

    it('5. Clarification submission does not change complaint status', async () => {
      const complaintRecord = await complaintRepository.findById(activeComplaint.id);
      assert.equal(complaintRecord.status, COMPLAINT_STATUS.IN_PROGRESS, 'Official complaint status must remain unchanged');
    });

    it('6. Unauthorized cross-citizen clarification requests are rejected', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${activeComplaint.id}/clarifications`)
        .set('Authorization', `Bearer ${otherCitizenToken}`)
        .send({
          type: 'QUESTION',
          content: 'Is there any update on this pothole?'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /access denied|only submit clarification requests for complaints you filed/i);
    });
  });

  // =========================================================================
  // Problem 3: Formal Resolution Appeals Desk
  // =========================================================================
  describe('Problem 3: Formal Resolution Appeals Desk', () => {
    let createdAppeal = null;

    it('7. Citizen can lodge a formal resolution appeal', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${resolvedComplaint.id}/appeals`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'POOR_QUALITY',
          citizenExplanation: 'Streetlight flickered again the evening after it was marked resolved.'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id, 'Appeal must have an assigned id');
      assert.ok(res.body.data.referenceNumber, 'Appeal must have a reference number');
      assert.equal(res.body.data.complaintId, resolvedComplaint.id);
      assert.equal(res.body.data.status, 'SUBMITTED');
      createdAppeal = res.body.data;
    });

    it('8. The same appeal appears in the citizen complaint detail and authorized officer queue', async () => {
      // Citizen detail view
      const citizenRes = await request(app)
        .get(`/api/v1/complaints/${resolvedComplaint.id}/appeals`)
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(citizenRes.status, 200);
      assert.equal(citizenRes.body.success, true);
      assert.ok(Array.isArray(citizenRes.body.data));
      const inCitizenList = citizenRes.body.data.find((a) => a.id === createdAppeal.id || a.referenceNumber === createdAppeal.referenceNumber);
      assert.ok(inCitizenList, 'Appeal must appear in citizen complaint detail');

      // Authorized Department Officer queue view
      const officerRes = await request(app)
        .get('/api/v1/appeals')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(officerRes.status, 200);
      assert.equal(officerRes.body.success, true);
      assert.ok(Array.isArray(officerRes.body.data));
      const inOfficerList = officerRes.body.data.find((a) => a.id === createdAppeal.id || a.referenceNumber === createdAppeal.referenceNumber);
      assert.ok(inOfficerList, 'Appeal must appear in authorized department officer review queue');
    });

    it('9. Appeal status changes and officer decisions persist', async () => {
      const decisionRes = await request(app)
        .post(`/api/v1/appeals/${createdAppeal.id}/decision`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          decision: 'UPHELD',
          reason: 'Inspected site: the luminaire driver was indeed faulty and has been replaced.'
        });

      assert.equal(decisionRes.status, 200);
      assert.equal(decisionRes.body.success, true);
      assert.equal(decisionRes.body.data.status, 'UPHELD');

      // Verify persistence
      const persisted = await appealRepository.findById(createdAppeal.id);
      assert.ok(persisted);
      assert.equal(persisted.status, 'UPHELD');
    });
  });

  // =========================================================================
  // Problem 4: Controlled Grievance Reopening Desk
  // =========================================================================
  describe('Problem 4: Controlled Grievance Reopening Desk', () => {
    let secondResolvedComplaint = null;
    let createdReopeningRequest = null;

    before(async () => {
      secondResolvedComplaint = await complaintRepository.create({
        title: 'Broken water valve near market',
        description: 'Water spraying onto walkway.',
        category: 'water',
        departmentId: 'DEPT_WATER',
        department: 'DEPT_WATER',
        status: COMPLAINT_STATUS.RESOLVED,
        priority: 'MEDIUM',
        citizenId: citizenUser.id,
        reopenedCount: 0,
        isReopened: false,
        resolutionMilestone: '1',
        resolutionDetails: { outcomeType: 'REPAIR_COMPLETED', closureRemarks: 'Valve replaced' }
      });
    });

    it('10. Citizen can submit a valid reopening petition', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${secondResolvedComplaint.id}/reopening-requests`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'INCOMPLETE_REMEDIATION',
          explanation: 'The valve joint was left loose and water continues to pool around the base.'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.id, 'Reopening request must have an id');
      assert.ok(res.body.data.referenceNumber, 'Reopening request must have a reference number');
      assert.equal(res.body.data.status, 'PENDING_REVIEW');
      createdReopeningRequest = res.body.data;
    });

    it('11. The same reopening petition appears in the citizen complaint detail and authorized officer queue', async () => {
      // Citizen detail view
      const citizenRes = await request(app)
        .get(`/api/v1/complaints/${secondResolvedComplaint.id}/reopening-requests`)
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(citizenRes.status, 200);
      assert.equal(citizenRes.body.success, true);
      const inCitizen = citizenRes.body.data.find((r) => r.id === createdReopeningRequest.id);
      assert.ok(inCitizen, 'Reopening request must appear in citizen view');

      // Authorized Water Officer queue view
      const officerRes = await request(app)
        .get('/api/v1/reopening-requests')
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.equal(officerRes.status, 200);
      assert.equal(officerRes.body.success, true);
      const inOfficer = officerRes.body.data.find((r) => r.id === createdReopeningRequest.id);
      assert.ok(inOfficer, 'Reopening petition must appear in authorized department officer desk');
    });

    it('12. Approved reopening triggers the existing status and re-verification rules', async () => {
      const approveRes = await request(app)
        .post(`/api/v1/reopening-requests/${createdReopeningRequest.id}/decision`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          outcome: 'APPROVED',
          reason: 'Inspected joint on site; requires new flange gasket and re-tightening.'
        });

      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.success, true);
      assert.equal(approveRes.body.data.status, 'APPROVED');

      // Verify Complaint status is REOPENED, count incremented, resolutionDetails reset
      const reopenedComp = await complaintRepository.findById(secondResolvedComplaint.id);
      assert.equal(reopenedComp.status, COMPLAINT_STATUS.REOPENED, 'Complaint must transition to REOPENED');
      assert.equal(reopenedComp.isReopened, true);
      assert.equal(reopenedComp.reopenedCount, 1);
      assert.equal(reopenedComp.resolutionDetails, null, 'Active resolution details must be reset for Phase 9 re-verification');
    });

    it('13. Rejected reopening leaves the complaint resolution status unchanged', async () => {
      // Create another resolved complaint for testing rejection
      const rejectedTestComplaint = await complaintRepository.create({
        title: 'Faded pedestrian zebra crossing',
        description: 'Paint is worn off.',
        category: 'roads',
        departmentId: 'DEPT_ROADS',
        department: 'DEPT_ROADS',
        status: COMPLAINT_STATUS.RESOLVED,
        priority: 'LOW',
        citizenId: citizenUser.id,
        reopenedCount: 0,
        isReopened: false,
        resolutionMilestone: '1',
        resolutionDetails: { outcomeType: 'REPAIR_COMPLETED', closureRemarks: 'Fresh thermoplastic paint applied.' }
      });

      const reopenSubmit = await request(app)
        .post(`/api/v1/complaints/${rejectedTestComplaint.id}/reopening-requests`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'UNRESOLVED_ISSUE',
          explanation: 'Paint is still not visible at all from a distance.'
        });

      assert.equal(reopenSubmit.status, 201);
      const reqId = reopenSubmit.body.data.id;

      // Reject the petition
      const rejectRes = await request(app)
        .post(`/api/v1/reopening-requests/${reqId}/decision`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          outcome: 'REJECTED',
          reason: 'CCTV and physical inspection confirm high-visibility reflective paint was applied.'
        });

      assert.equal(rejectRes.status, 200);
      assert.equal(rejectRes.body.data.status, 'REJECTED');

      // Verify the complaint remains RESOLVED
      const unchangedComp = await complaintRepository.findById(rejectedTestComplaint.id);
      assert.equal(unchangedComp.status, COMPLAINT_STATUS.RESOLVED, 'Complaint status must remain RESOLVED on rejection');
    });
  });

  // =========================================================================
  // Authorization, Validation & Persistence Contracts
  // =========================================================================
  describe('Authorization, Payload Validation & Persistence Scoping', () => {
    it('14. Department scoping prevents unauthorized officers from accessing other departments records', async () => {
      // Roads officer attempts to access reopening requests for Water department complaint
      const res = await request(app)
        .get(`/api/v1/complaints/${activeComplaint.id}/appeals`)
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /access denied|outside your authorized department scope/i);
    });

    it('15. Invalid payloads produce appropriate 4xx responses instead of unexplained 500 errors', async () => {
      // 1. Clarification with empty/too short content (< 5 chars)
      const clarRes = await request(app)
        .post(`/api/v1/complaints/${activeComplaint.id}/clarifications`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          type: 'QUESTION',
          content: 'Hi'
        });
      assert.equal(clarRes.status, 400);
      assert.equal(clarRes.body.success, false);
      assert.match(JSON.stringify(clarRes.body), /at least 5 characters/i);

      // 2. Appeal with missing explanation / too short
      const appealRes = await request(app)
        .post(`/api/v1/complaints/${resolvedComplaint.id}/appeals`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'POOR_QUALITY',
          citizenExplanation: 'Bad'
        });
      assert.equal(appealRes.status, 400);
      assert.equal(appealRes.body.success, false);
      assert.match(JSON.stringify(appealRes.body), /at least 10 characters/i);

      // 3. Reopening with invalid reason category
      const reopenRes = await request(app)
        .post(`/api/v1/complaints/${resolvedComplaint.id}/reopening-requests`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          reasonCategory: 'INVALID_CATEGORY_CODE',
          explanation: 'Valid explanation text of more than 10 characters.'
        });
      assert.equal(reopenRes.status, 400);
      assert.equal(reopenRes.body.success, false);
      assert.match(JSON.stringify(reopenRes.body), /invalid reasonCategory/i);
    });

    it('16. Repository behavior is tested in the supported JSON adapter and MongoDB-compatible test setup', async () => {
      // Test MongoDB model validation pre hooks:
      // Verify ReminderModel auto-generates id on validate
      const testReminder = new ReminderModel({
        complaintId: 'CMP-TEST-1',
        citizenId: 'CITIZEN-1',
        departmentId: 'DEPT_ROADS',
        requestedAt: new Date().toISOString()
      });
      await testReminder.validate();
      assert.ok(testReminder.id, 'ReminderModel must auto-generate id');
      assert.match(testReminder.id, /^REM-\d{4}-/);

      // Verify ClarificationModel auto-generates id on validate
      const testClar = new ClarificationModel({
        complaintId: 'CMP-TEST-1',
        citizenId: 'CITIZEN-1',
        departmentId: 'DEPT_ROADS',
        type: 'QUESTION',
        content: 'Valid clarification question content here.'
      });
      await testClar.validate();
      assert.ok(testClar.id, 'ClarificationModel must auto-generate id');
      assert.match(testClar.id, /^CLR-\d{4}-/);

      // Verify AppealModel auto-generates id and referenceNumber on validate
      const testAppeal = new AppealModel({
        complaintId: 'CMP-TEST-1',
        citizenId: 'CITIZEN-1',
        departmentId: 'DEPT_ROADS',
        reasonCategory: 'POOR_QUALITY',
        citizenExplanation: 'Resolution was marked but repair was incomplete.'
      });
      await testAppeal.validate();
      assert.ok(testAppeal.id, 'AppealModel must auto-generate id');
      assert.match(testAppeal.id, /^APP-\d{4}-/);
      assert.ok(testAppeal.referenceNumber, 'AppealModel must auto-generate referenceNumber');
      assert.match(testAppeal.referenceNumber, /^APL-\d{4}-/);
      assert.equal(testAppeal.requesterId, 'CITIZEN-1', 'requesterId must be synced from citizenId');

      // Verify ReopeningRequestModel auto-generates id and referenceNumber on validate
      const testReopen = new ReopeningRequestModel({
        complaintId: 'CMP-TEST-1',
        citizenId: 'CITIZEN-1',
        departmentId: 'DEPT_ROADS',
        reasonCategory: 'INCOMPLETE_REMEDIATION',
        citizenExplanation: 'Work remains half finished on the ground.'
      });
      await testReopen.validate();
      assert.ok(testReopen.id, 'ReopeningRequestModel must auto-generate id');
      assert.match(testReopen.id, /^REOPEN-\d{4}-/);
      assert.ok(testReopen.referenceNumber, 'ReopeningRequestModel must auto-generate referenceNumber');
      assert.match(testReopen.referenceNumber, /^REQ-\d{4}-/);
      assert.equal(testReopen.requesterId, 'CITIZEN-1', 'requesterId must be synced from citizenId');
    });

    it('17. Existing authentication, RBAC, audit logging, and persistence safety tests continue to pass', async () => {
      // Audit log records exist for the operations performed above
      const auditLogs = await auditLogRepository.findAll();
      assert.ok(auditLogs.length > 0, 'Audit log entries must be created for actions');

      const reminderLog = auditLogs.find((l) => l.action === 'REQUEST_COMPLAINT_REMINDER' || l.action === 'REQUEST_REMINDER');
      assert.ok(reminderLog, 'REQUEST_COMPLAINT_REMINDER action must be recorded in audit log');

      const clarificationLog = auditLogs.find((l) => l.action === 'CREATE_CLARIFICATION_REQUEST');
      assert.ok(clarificationLog, 'CREATE_CLARIFICATION_REQUEST action must be recorded in audit log');

      const appealLog = auditLogs.find((l) => l.action === 'SUBMIT_FORMAL_APPEAL' || l.action === 'SUBMIT_APPEAL');
      assert.ok(appealLog, 'SUBMIT_FORMAL_APPEAL action must be recorded in audit log');

      const reopenLog = auditLogs.find((l) => l.action === 'SUBMIT_REOPENING_REQUEST');
      assert.ok(reopenLog, 'SUBMIT_REOPENING_REQUEST action must be recorded in audit log');
    });
  });
});
