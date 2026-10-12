/**
 * @file clarification.test.js
 * @description Comprehensive automated test suite for CivicSarthi Phase 12:
 * Citizen-Initiated Clarification, Reminders & Status Translator.
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

import { clarificationService } from '../src/services/clarification.service.js';
import { reminderService } from '../src/services/reminder.service.js';
import { statusTranslatorService } from '../src/services/statusTranslator.service.js';
import { authService } from '../src/services/auth.service.js';
import { COMPLAINT_STATUS } from '../src/constants/status.constants.js';
import {
  CLARIFICATION_STATUS,
  CLARIFICATION_TYPE,
  REMINDER_STATUS,
  REMINDER_DELIVERY_CHANNEL,
  REMINDER_DELIVERY_STATUS
} from '../src/constants/clarification.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-phase12-clarification');
const SANDBOX_COMPLAINTS_FILE = path.join(SANDBOX_DIR, 'complaints.test.json');
const SANDBOX_USERS_FILE = path.join(SANDBOX_DIR, 'users.test.json');
const SANDBOX_AUDIT_FILE = path.join(SANDBOX_DIR, 'audit_logs.test.json');
const SANDBOX_CLARIFICATIONS_FILE = path.join(SANDBOX_DIR, 'clarifications.test.json');
const SANDBOX_REMINDERS_FILE = path.join(SANDBOX_DIR, 'reminders.test.json');

const app = createApp();

describe('CivicSarthi Phase 12 — Clarifications, Reminders & Status Translator', () => {
  let adminToken = null;
  let roadsOfficerToken = null;
  let waterOfficerToken = null;
  let citizen1Token = null;
  let citizen2Token = null;

  let adminUser = null;
  let roadsOfficer = null;
  let waterOfficer = null;
  let citizen1 = null;
  let citizen2 = null;

  let testComplaintRoads = null;
  let testComplaintWater = null;

  before(async () => {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });

    // Initialize sandbox JSON fixtures
    await fs.writeFile(
      SANDBOX_COMPLAINTS_FILE,
      JSON.stringify({ metadata: { version: '1.0.0' }, complaints: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      SANDBOX_USERS_FILE,
      JSON.stringify({ metadata: { total: 0 }, users: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      SANDBOX_AUDIT_FILE,
      JSON.stringify({ metadata: { total: 0 }, logs: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      SANDBOX_CLARIFICATIONS_FILE,
      JSON.stringify({ metadata: { version: '1.0.0' }, clarifications: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      SANDBOX_REMINDERS_FILE,
      JSON.stringify({ metadata: { version: '1.0.0' }, reminders: [] }, null, 2),
      'utf-8'
    );

    // Redirect repository paths to sandbox
    complaintRepository.setFilePath(SANDBOX_COMPLAINTS_FILE);
    userRepository.setFilePath(SANDBOX_USERS_FILE);
    auditLogRepository.setFilePath(SANDBOX_AUDIT_FILE);
    clarificationRepository.setFilePath(SANDBOX_CLARIFICATIONS_FILE);
    reminderRepository.setFilePath(SANDBOX_REMINDERS_FILE);

    // Seed test accounts
    adminUser = await authService.provisionUser({
      name: 'System Admin',
      email: 'admin.phase12@civicsarthi.gov.in',
      password: 'AdminPassword123!',
      role: 'admin',
      departmentId: null
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    adminToken = authService.generateToken(adminUser);

    roadsOfficer = await authService.provisionUser({
      name: 'Officer Rajesh Kumar',
      email: 'officer.roads12@civicsarthi.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    roadsOfficerToken = authService.generateToken(roadsOfficer);

    waterOfficer = await authService.provisionUser({
      name: 'Officer Priya Sharma',
      email: 'officer.water12@civicsarthi.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    waterOfficerToken = authService.generateToken(waterOfficer);

    const c1Reg = await authService.register({
      name: 'Aarav Mehta',
      email: 'aarav.mehta12@civicsarthi.in',
      password: 'CitizenPassword123!'
    });
    citizen1 = c1Reg.user;
    citizen1Token = c1Reg.token || authService.generateToken(citizen1);

    const c2Reg = await authService.register({
      name: 'Diya Patel',
      email: 'diya.patel12@civicsarthi.in',
      password: 'CitizenPassword123!'
    });
    citizen2 = c2Reg.user;
    citizen2Token = c2Reg.token || authService.generateToken(citizen2);

    // Seed test complaints
    testComplaintRoads = await complaintRepository.create({
      title: 'Dangerous Pothole on Ring Road Junction',
      description: 'Massive pothole causing severe traffic jams and potential accidents near flyover.',
      category: 'roads',
      departmentId: 'DEPT_ROADS',
      citizenId: citizen1.id,
      citizenName: citizen1.name,
      citizenEmail: citizen1.email,
      state: 'Delhi',
      district: 'New Delhi',
      locality: 'Ring Road Junction',
      status: COMPLAINT_STATUS.IN_PROGRESS,
      priority: 'HIGH'
    });

    testComplaintWater = await complaintRepository.create({
      title: 'Contaminated Drinking Water Supply in Sector 4',
      description: 'Tap water is visibly discolored with foul smell since yesterday morning.',
      category: 'water',
      departmentId: 'DEPT_WATER',
      citizenId: citizen2.id,
      citizenName: citizen2.name,
      citizenEmail: citizen2.email,
      state: 'Delhi',
      district: 'New Delhi',
      locality: 'Sector 4',
      status: COMPLAINT_STATUS.UNDER_REVIEW,
      priority: 'CRITICAL'
    });
  });

  after(async () => {
    // Reset file paths
    complaintRepository.resetFilePath();
    userRepository.resetFilePath();
    auditLogRepository.resetFilePath();
    clarificationRepository.resetFilePath();
    reminderRepository.resetFilePath();

    // Clean up sandbox
    try {
      await fs.rm(SANDBOX_DIR, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================
  // FEATURE A: CITIZEN-INITIATED CLARIFICATIONS
  // ==========================================
  describe('Feature A: Citizen-Initiated Clarifications', () => {
    let createdClarification = null;

    it('A1: Citizen can create a clarification request for their own complaint', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${testComplaintRoads.id}/clarifications`)
        .set('Authorization', `Bearer ${citizen1Token}`)
        .send({
          requestType: CLARIFICATION_TYPE.CLARIFICATION,
          content: 'Could you please confirm if the repair will happen tonight or tomorrow?'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, CLARIFICATION_STATUS.OPEN);
      assert.strictEqual(res.body.data.citizenId, citizen1.id);
      assert.strictEqual(res.body.data.complaintId, testComplaintRoads.id);
      assert.strictEqual(res.body.data.departmentId, 'DEPT_ROADS');
      assert.strictEqual(res.body.data.requestType, CLARIFICATION_TYPE.CLARIFICATION);
      assert.ok(res.body.data.id.startsWith('CLR-'));

      createdClarification = res.body.data;
    });

    it('A2: Clarification request creation does not illegally change the complaint official status', async () => {
      const comp = await complaintRepository.findById(testComplaintRoads.id);
      assert.strictEqual(comp.status, COMPLAINT_STATUS.IN_PROGRESS, 'Official status must remain strictly unchanged');
    });

    it('A3: Citizen cannot create clarification on a complaint they do not own', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${testComplaintWater.id}/clarifications`)
        .set('Authorization', `Bearer ${citizen1Token}`) // Citizen 1 tries to access Citizen 2's complaint
        .send({
          content: 'Attempting unauthorized clarification on another citizen grievance.'
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('A4: Citizen cannot view another citizen clarification requests', async () => {
      // Citizen 2 tries to get Citizen 1's complaint clarifications
      const res = await request(app)
        .get(`/api/v1/complaints/${testComplaintRoads.id}/clarifications`)
        .set('Authorization', `Bearer ${citizen2Token}`);

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('A5: Owner citizen can view their own clarification requests', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${testComplaintRoads.id}/clarifications`)
        .set('Authorization', `Bearer ${citizen1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.length, 1);
      assert.strictEqual(res.body.data[0].id, createdClarification.id);
    });

    it('A6: Content validation rejects empty, too short (<5 chars), or excessively long (>2000 chars) content', async () => {
      // Too short
      const resShort = await request(app)
        .post(`/api/v1/complaints/${testComplaintRoads.id}/clarifications`)
        .set('Authorization', `Bearer ${citizen1Token}`)
        .send({ content: 'Hi' });

      assert.strictEqual(resShort.status, 400);

      // Excessively long
      const resLong = await request(app)
        .post(`/api/v1/complaints/${testComplaintRoads.id}/clarifications`)
        .set('Authorization', `Bearer ${citizen1Token}`)
        .send({ content: 'x'.repeat(2005) });

      assert.strictEqual(resLong.status, 400);
    });

    it('A7: Unauthorized role (citizen) cannot respond to a clarification request', async () => {
      const res = await request(app)
        .post(`/api/v1/clarifications/${createdClarification.id}/respond`)
        .set('Authorization', `Bearer ${citizen1Token}`)
        .send({ response: 'Citizens cannot act as officers answering tickets.' });

      assert.strictEqual(res.status, 403);
    });

    it('A8: Officer of mismatched department cannot respond to a clarification request', async () => {
      // Water officer tries to respond to a Roads clarification
      const res = await request(app)
        .post(`/api/v1/clarifications/${createdClarification.id}/respond`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({ response: 'Water department officer attempting unauthorized response on Roads issue.' });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('A9: Authorized departmental officer can respond to clarification within their department', async () => {
      const res = await request(app)
        .post(`/api/v1/clarifications/${createdClarification.id}/respond`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          response: 'The field crew is scheduled to mobilize bitumen hot-mix tonight at 11:00 PM.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, CLARIFICATION_STATUS.RESPONDED);
      assert.strictEqual(res.body.data.responses.length, 1);
      assert.strictEqual(res.body.data.responses[0].responderRole, 'officer');
      assert.strictEqual(res.body.data.responses[0].responderName, roadsOfficer.name);
    });

    it('A10: Responding to clarification does not silently mark complaint as resolved', async () => {
      const comp = await complaintRepository.findById(testComplaintRoads.id);
      assert.strictEqual(comp.status, COMPLAINT_STATUS.IN_PROGRESS, 'Official status must stay IN_PROGRESS');
    });

    it('A11: Citizen can view officer response on their own request thread', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${testComplaintRoads.id}/clarifications`)
        .set('Authorization', `Bearer ${citizen1Token}`);

      assert.strictEqual(res.status, 200);
      const thread = res.body.data.find((c) => c.id === createdClarification.id);
      assert.ok(thread);
      assert.strictEqual(thread.status, CLARIFICATION_STATUS.RESPONDED);
      assert.strictEqual(thread.responses.length, 1);
      assert.strictEqual(
        thread.responses[0].response,
        'The field crew is scheduled to mobilize bitumen hot-mix tonight at 11:00 PM.'
      );
    });

    it('A12: Citizen or officer can close an answered clarification thread', async () => {
      const res = await request(app)
        .post(`/api/v1/clarifications/${createdClarification.id}/close`)
        .set('Authorization', `Bearer ${citizen1Token}`)
        .send({ reason: 'Question answered clearly, thank you.' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, CLARIFICATION_STATUS.CLOSED);
      assert.strictEqual(res.body.data.closedReason, 'Question answered clearly, thank you.');
    });
  });

  // ==========================================
  // FEATURE B: CITIZEN FOLLOW-UP REMINDERS
  // ==========================================
  describe('Feature B: Citizen Follow-Up Reminders', () => {
    let firstReminder = null;

    it('B1: Citizen can request a reminder for their own active eligible complaint', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${testComplaintRoads.id}/reminders`)
        .set('Authorization', `Bearer ${citizen1Token}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.accepted, true);
      assert.strictEqual(res.body.data.status, REMINDER_STATUS.ACCEPTED);
      assert.strictEqual(res.body.data.reminder.complaintId, testComplaintRoads.id);
      assert.strictEqual(res.body.data.delivery.channel, REMINDER_DELIVERY_CHANNEL.IN_APP);
      assert.strictEqual(res.body.data.delivery.status, REMINDER_DELIVERY_STATUS.LOGGED_IN_APP);

      firstReminder = res.body.data.reminder;
    });

    it('B2: Unconfigured notification delivery transparently records in-app without false claims', async () => {
      // Delivery must transparently state IN_APP and LOGGED_IN_APP, avoiding fake SMS/Email claims
      assert.strictEqual(firstReminder.deliveryChannel, 'IN_APP');
      assert.strictEqual(firstReminder.deliveryStatus, 'LOGGED_IN_APP');
    });

    it('B3: Requesting a reminder does not modify the complaint official status', async () => {
      const comp = await complaintRepository.findById(testComplaintRoads.id);
      assert.strictEqual(comp.status, COMPLAINT_STATUS.IN_PROGRESS, 'Official status must stay IN_PROGRESS');
    });

    it('B4: Second reminder within cooldown window is throttled server-side with 429', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${testComplaintRoads.id}/reminders`)
        .set('Authorization', `Bearer ${citizen1Token}`);

      assert.strictEqual(res.status, 429);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.code, 'REMINDER_THROTTLED');
      assert.ok(res.body.details?.throttled);
      assert.ok(typeof res.body.details?.timeRemainingMinutes === 'number');
      assert.ok(res.body.details?.cooldownExpiresAt);
    });

    it('B5: Citizen cannot request reminder on another citizen complaint', async () => {
      const res = await request(app)
        .post(`/api/v1/complaints/${testComplaintWater.id}/reminders`)
        .set('Authorization', `Bearer ${citizen1Token}`); // Citizen 1 on Citizen 2's complaint

      assert.strictEqual(res.status, 403);
    });

    it('B6: Ineligible complaints (RESOLVED or CLOSED) reject reminder requests', async () => {
      // Create a closed complaint
      const closedComplaint = await complaintRepository.create({
        title: 'Resolved Streetlight Defect',
        description: 'Bulb was replaced last week and case finalized.',
        category: 'electricity',
        departmentId: 'DEPT_POWER',
        citizenId: citizen1.id,
        state: 'Delhi',
        district: 'New Delhi',
        status: COMPLAINT_STATUS.CLOSED
      });

      const res = await request(app)
        .post(`/api/v1/complaints/${closedComplaint.id}/reminders`)
        .set('Authorization', `Bearer ${citizen1Token}`);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.code, 'INELIGIBLE_FOR_REMINDER');
    });
  });

  // ==========================================
  // FEATURE C: BILINGUAL STATUS TRANSLATOR
  // ==========================================
  describe('Feature C: Citizen-Friendly Status Translator', () => {
    it('C1: Returns plain-language explanation matching official status in English', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${testComplaintRoads.id}/status-explanation?lang=en`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.officialStatus, COMPLAINT_STATUS.IN_PROGRESS);
      assert.strictEqual(res.body.data.language, 'en');
      assert.ok(res.body.data.meaning.includes('Remediation works'));
      assert.ok(res.body.data.whatHappened.includes('corrective operations'));
      assert.ok(res.body.data.nextSteps.includes('reminder'));
      assert.ok(res.body.data.slaGuidance.includes('SLA'));
      assert.strictEqual(res.body.data.generatedBy, 'DETERMINISTIC_ENGINE');
    });

    it('C2: Returns plain-language explanation matching official status in Hindi (hi)', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${testComplaintRoads.id}/status-explanation?lang=hi`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.officialStatus, COMPLAINT_STATUS.IN_PROGRESS);
      assert.strictEqual(res.body.data.language, 'hi');
      assert.ok(res.body.data.meaning.includes('मरम्मत'));
      assert.ok(res.body.data.whatHappened.includes('सुधारात्मक कार्य'));
      assert.ok(res.body.data.nextSteps.includes('रिमाइंडर'));
      assert.strictEqual(res.body.data.statusLabel, 'समाधान कार्य प्रगति पर');
    });

    it('C3: Translates correctly for all official statuses deterministically', async () => {
      const statuses = Object.values(COMPLAINT_STATUS);
      for (const st of statuses) {
        const dummyComplaint = {
          id: `CS-TEST-${st}`,
          referenceNumber: `CS-TEST-${st}`,
          status: st,
          departmentId: 'DEPT_ROADS',
          createdAt: new Date().toISOString()
        };

        const enExplanation = statusTranslatorService.getDeterministicExplanation(dummyComplaint, 'en');
        assert.ok(enExplanation.statusLabel, `Status label missing for ${st} in English`);
        assert.ok(enExplanation.meaning, `Meaning missing for ${st} in English`);
        assert.ok(enExplanation.whatHappened, `What happened missing for ${st} in English`);
        assert.ok(enExplanation.nextSteps, `Next steps missing for ${st} in English`);

        const hiExplanation = statusTranslatorService.getDeterministicExplanation(dummyComplaint, 'hi');
        assert.ok(hiExplanation.statusLabel, `Status label missing for ${st} in Hindi`);
        assert.ok(hiExplanation.meaning, `Meaning missing for ${st} in Hindi`);
      }
    });

    it('C4: Status translation never modifies the underlying complaint status', async () => {
      const beforeComp = await complaintRepository.findById(testComplaintRoads.id);
      const initialStatus = beforeComp.status;

      await request(app).get(`/api/v1/complaints/${testComplaintRoads.id}/status-explanation?lang=en`);
      await request(app).get(`/api/v1/complaints/${testComplaintRoads.id}/status-explanation?lang=hi`);

      const afterComp = await complaintRepository.findById(testComplaintRoads.id);
      assert.strictEqual(afterComp.status, initialStatus, 'Complaint status must remain completely unmodified');
    });

    it('C5: AI provider failure falls back safely to deterministic explanations without crashing', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${testComplaintRoads.id}/status-explanation?useAi=true`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.generatedBy, 'DETERMINISTIC_ENGINE');
      assert.ok(res.body.data.meaning);
    });

    it('C6: Private officer notes and internal fields are never returned to citizens', async () => {
      // Add an internal officer note
      await complaintRepository.addOfficerNote(testComplaintRoads.id, {
        note: 'INTERNAL CONFIDENTIAL NOTE: Undercover inspection scheduled.',
        officerId: 'OFFICER_CONFIDENTIAL'
      });

      const res = await request(app)
        .get(`/api/v1/complaints/${testComplaintRoads.id}/status-explanation?lang=en`);

      assert.strictEqual(res.status, 200);
      const jsonString = JSON.stringify(res.body);
      assert.strictEqual(jsonString.includes('INTERNAL CONFIDENTIAL NOTE'), false, 'Confidential note leaked!');
      assert.strictEqual(jsonString.includes('OFFICER_CONFIDENTIAL'), false, 'Confidential officer id leaked!');
    });
  });
});
