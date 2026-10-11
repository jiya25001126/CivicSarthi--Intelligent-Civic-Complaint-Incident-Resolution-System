/**
 * @file incident.api.test.js
 * @description Comprehensive API integration test suite for Phase 7 Step 2B:
 * Parent Incident Clustering, Multi-Department Subtasks, and Complaint Coordination Endpoints.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';
import complaintRepository from '../src/repositories/complaint.repository.js';
import incidentRepository from '../src/repositories/incident.repository.js';
import subtaskRepository from '../src/repositories/subtask.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import { authService } from '../src/services/auth.service.js';
import config from '../src/config/app.config.js';
import {
  INCIDENT_STATUS,
  SUBTASK_STATUS,
  INCIDENT_PRIORITY
} from '../src/constants/incident.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();

// Isolated test fixtures
const TEST_COMPLAINTS_PATH = path.resolve(path.dirname(config.dataPath.complaints), 'complaints.incident-api-test.json');
const TEST_INCIDENTS_PATH = path.resolve(path.dirname(config.dataPath.incidents), 'incidents.incident-api-test.json');
const TEST_SUBTASKS_PATH = path.resolve(path.dirname(config.dataPath.subtasks), 'subtasks.incident-api-test.json');
const TEST_USERS_PATH = path.resolve(path.dirname(config.dataPath.users), 'users.incident-api-test.json');
const TEST_AUDIT_PATH = path.resolve(path.dirname(config.dataPath.auditLogs), 'audit_logs.incident-api-test.json');

describe('CivicSarthi Phase 7 Step 2B: Incident & Subtask API Integration Test Suite', () => {
  let citizenToken = null;
  let waterOfficerToken = null;
  let roadsOfficerToken = null;
  let adminToken = null;

  let seededComplaint1 = null;
  let seededComplaint2 = null;
  let testIncidentId = null;
  let testSubtaskId = null;

  before(async () => {
    // 1. Isolate test fixtures to guarantee zero writes to protected runtime data
    const initialUsers = { metadata: { version: '1.0.0' }, users: [] };
    await fs.writeFile(TEST_USERS_PATH, JSON.stringify(initialUsers, null, 2), 'utf-8');
    userRepository.setFilePath(TEST_USERS_PATH);

    const initialAudit = { metadata: { version: '1.0.0' }, logs: [] };
    await fs.writeFile(TEST_AUDIT_PATH, JSON.stringify(initialAudit, null, 2), 'utf-8');
    auditLogRepository.setFilePath(TEST_AUDIT_PATH);

    const initialIncidents = { metadata: { version: '1.0.0' }, incidents: [] };
    await fs.writeFile(TEST_INCIDENTS_PATH, JSON.stringify(initialIncidents, null, 2), 'utf-8');
    incidentRepository.setFilePath(TEST_INCIDENTS_PATH);

    const initialSubtasks = { metadata: { version: '1.0.0' }, subtasks: [] };
    await fs.writeFile(TEST_SUBTASKS_PATH, JSON.stringify(initialSubtasks, null, 2), 'utf-8');
    subtaskRepository.setFilePath(TEST_SUBTASKS_PATH);

    const initialComplaints = {
      metadata: { version: '1.0.0' },
      complaints: [
        {
          id: 'CMP-2026-0001',
          referenceNumber: 'CS-2026-0001',
          title: 'Main pipeline ruptured causing widespread waterlogging',
          description: 'Drinking water pipeline burst near sector 4 crossing.',
          category: 'water',
          departmentId: 'DEPT_WATER',
          department: 'DEPT_WATER',
          status: 'UNDER_REVIEW',
          priority: 'HIGH',
          incidentId: null,
          createdAt: new Date().toISOString()
        },
        {
          id: 'CMP-2026-0002',
          referenceNumber: 'CS-2026-0002',
          title: 'Caved-in asphalt following pipeline burst',
          description: 'Road surface collapsed following water pipe damage.',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          department: 'DEPT_ROADS',
          status: 'UNDER_REVIEW',
          priority: 'MEDIUM',
          incidentId: null,
          createdAt: new Date().toISOString()
        }
      ]
    };
    await fs.writeFile(TEST_COMPLAINTS_PATH, JSON.stringify(initialComplaints, null, 2), 'utf-8');
    complaintRepository.setFilePath(TEST_COMPLAINTS_PATH);

    // 2. Provision test users with verified credentials
    const citizenUser = await authService.register({
      email: 'citizen.api@civicsarthi.internal',
      name: 'Sunita Patil',
      password: 'Password123!'
    });
    citizenToken = citizenUser.token;

    const adminUser = await authService.provisionUser(
      {
        email: 'admin.incident@civicsarthi.internal',
        name: 'Chief Admin',
        password: 'AdminPassword123!',
        role: 'admin'
      },
      { id: 'SYSTEM', email: 'system@internal', role: 'admin' }
    );
    adminToken = authService.generateToken(adminUser);

    const waterOfficer = await authService.provisionUser(
      {
        email: 'officer.water@civicsarthi.internal',
        name: 'Officer Deshmukh Water',
        password: 'OfficerPassword123!',
        role: 'officer',
        departmentId: 'DEPT_WATER'
      },
      { id: 'SYSTEM', email: 'system@internal', role: 'admin' }
    );
    waterOfficerToken = authService.generateToken(waterOfficer);

    const roadsOfficer = await authService.provisionUser(
      {
        email: 'officer.roads@civicsarthi.internal',
        name: 'Officer Shinde Roads',
        password: 'OfficerPassword123!',
        role: 'officer',
        departmentId: 'DEPT_ROADS'
      },
      { id: 'SYSTEM', email: 'system@internal', role: 'admin' }
    );
    roadsOfficerToken = authService.generateToken(roadsOfficer);

    seededComplaint1 = 'CMP-2026-0001';
    seededComplaint2 = 'CMP-2026-0002';
  });

  after(async () => {
    // Teardown and restore canonical repository paths
    complaintRepository.resetFilePath();
    incidentRepository.resetFilePath();
    subtaskRepository.resetFilePath();
    userRepository.resetFilePath();
    auditLogRepository.resetFilePath();

    // Safely remove sandbox test fixtures
    await fs.unlink(TEST_COMPLAINTS_PATH).catch(() => {});
    await fs.unlink(TEST_INCIDENTS_PATH).catch(() => {});
    await fs.unlink(TEST_SUBTASKS_PATH).catch(() => {});
    await fs.unlink(TEST_USERS_PATH).catch(() => {});
    await fs.unlink(TEST_AUDIT_PATH).catch(() => {});
  });

  // =========================================================================
  // 1. Authentication & Role-Based Access Control (RBAC) API Tests
  // =========================================================================
  describe('1. Authentication & Role Authorization Enforcement', () => {
    it('POST /api/v1/incidents rejects unauthenticated callers with 401', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .send({
          title: 'Unauthenticated Incident Attempt',
          category: 'water',
          leadDepartment: 'DEPT_WATER'
        });

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/v1/incidents rejects citizen callers with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Citizen Incident Attempt',
          category: 'water',
          leadDepartment: 'DEPT_WATER'
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('PATCH /api/v1/incidents/:id/status rejects citizen callers with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/v1/incidents/INC-FAKE/status')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ status: INCIDENT_STATUS.INVESTIGATING });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/v1/incidents/:id/complaints rejects citizen callers with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/INC-FAKE/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ complaintId: seededComplaint1 });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/v1/incidents/transfer-complaint rejects citizen callers with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/transfer-complaint')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          toIncidentId: 'INC-TARGET',
          complaintId: seededComplaint1,
          justification: 'Attempted unauthorized citizen transfer'
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/v1/incidents/:incidentId/subtasks rejects citizen callers with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/INC-FAKE/subtasks')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Citizen subtask attempt',
          department: 'DEPT_WATER'
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });
  });

  // =========================================================================
  // 2. Department-Scoped Authorization & Validation
  // =========================================================================
  describe('2. Department-Scoped Authorization & Validation', () => {
    it('POST /api/v1/incidents rejects officer creating incident for another department with 403', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${roadsOfficerToken}`) // Roads officer
        .send({
          title: 'Water department crisis creation attempt',
          category: 'water',
          leadDepartment: 'DEPT_WATER' // Unauthorized lead department
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /not authorized/i);
    });

    it('POST /api/v1/incidents rejects non-existent lead department with 400', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Incident with bogus department',
          category: 'water',
          leadDepartment: 'DEPT_NONEXISTENT_999'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /does not exist in registry/i);
    });

    it('POST /api/v1/incidents successfully creates incident when authorized', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${waterOfficerToken}`) // Authorized for DEPT_WATER
        .send({
          title: 'Sector 4 Major Pipeline Breach Cluster',
          description: 'Multiple street inundations and low pressure reports.',
          category: 'water',
          leadDepartment: 'DEPT_WATER',
          priority: INCIDENT_PRIORITY.HIGH
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.strictEqual(res.body.data.leadDepartment, 'DEPT_WATER');
      assert.strictEqual(res.body.data.status, INCIDENT_STATUS.ACTIVE);
      testIncidentId = res.body.data.id;
    });
  });

  // =========================================================================
  // 3. Incident Listing & Sanitized Citizen Responses
  // =========================================================================
  describe('3. Incident Listing & Citizen Data Sanitization', () => {
    it('GET /api/v1/incidents returns full operational data for officers/admins', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      const found = res.body.data.find(inc => inc.id === testIncidentId);
      assert.ok(found);
      assert.ok(Array.isArray(found.linkedComplaints));
    });

    it('GET /api/v1/incidents returns sanitized data for citizens without sensitive internals', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      const found = res.body.data.find(inc => inc.id === testIncidentId);
      assert.ok(found);

      // Public tracking fields present
      assert.ok(found.id);
      assert.ok(found.title);
      assert.ok(found.status);
      assert.strictEqual(typeof found.linkedComplaintsCount, 'number');

      // Sensitive internal fields stripped
      assert.strictEqual(found.linkedComplaints, undefined);
      assert.strictEqual(found.createdBy, undefined);
    });

    it('GET /api/v1/incidents/:id returns 404 for non-existent incident', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/INC-DOES-NOT-EXIST')
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.success, false);
    });

    it('GET /api/v1/incidents/:id returns sanitized summary for citizens', async () => {
      const res = await request(app)
        .get(`/api/v1/incidents/${testIncidentId}`)
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.id, testIncidentId);
      assert.strictEqual(res.body.data.subtasks, undefined); // Subtask array stripped for citizens
      assert.strictEqual(typeof res.body.data.linkedComplaintsCount, 'number');
    });

    it('GET /api/v1/incidents/:id returns full enriched view with subtasks for officers', async () => {
      const res = await request(app)
        .get(`/api/v1/incidents/${testIncidentId}`)
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.subtasks));
      assert.ok(res.body.data.subtasksSummary);
    });
  });

  // =========================================================================
  // 4. Subtask Lifecycle & Multi-Department Coordination
  // =========================================================================
  describe('4. Subtask APIs & Multi-Department Coordination', () => {
    it('POST /api/v1/incidents/:incidentId/subtasks rejects non-existent department with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/incidents/${testIncidentId}/subtasks`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          title: 'Deploy trench crew',
          department: 'DEPT_INVALID_FAKE'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/v1/incidents/:incidentId/subtasks successfully creates subtask', async () => {
      const res = await request(app)
        .post(`/api/v1/incidents/${testIncidentId}/subtasks`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          title: 'Isolate Sector 4 mainline valve',
          department: 'DEPT_WATER',
          status: SUBTASK_STATUS.PENDING,
          remarks: 'Urgent isolation needed to stop road erosion'
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.id);
      assert.strictEqual(res.body.data.incidentId, testIncidentId);
      assert.strictEqual(res.body.data.status, SUBTASK_STATUS.PENDING);
      testSubtaskId = res.body.data.id;
    });

    it('GET /api/v1/incidents/:incidentId/subtasks lists subtasks for incident', async () => {
      const res = await request(app)
        .get(`/api/v1/incidents/${testIncidentId}/subtasks`)
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.count >= 1);
      assert.ok(res.body.data.some(s => s.id === testSubtaskId));
    });

    it('GET /api/v1/subtasks/:id retrieves subtask directly', async () => {
      const res = await request(app)
        .get(`/api/v1/subtasks/${testSubtaskId}`)
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.id, testSubtaskId);
    });

    it('PATCH /api/v1/subtasks/:id/status rejects unauthorized department officer with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/subtasks/${testSubtaskId}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`) // Roads officer cannot touch Water subtask on Water incident
        .send({ status: SUBTASK_STATUS.IN_PROGRESS });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('PATCH /api/v1/subtasks/:id/status updates status with valid transition', async () => {
      const res = await request(app)
        .patch(`/api/v1/subtasks/${testSubtaskId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          status: SUBTASK_STATUS.IN_PROGRESS,
          remarks: 'Crew dispatched on site'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, SUBTASK_STATUS.IN_PROGRESS);
    });

    it('PATCH /api/v1/subtasks/:id updates editable fields', async () => {
      const res = await request(app)
        .patch(`/api/v1/subtasks/${testSubtaskId}`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          remarks: 'Updated site notes with valve depth'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.remarks, 'Updated site notes with valve depth');
    });

    it('PATCH /api/v1/subtasks/:id ignores submitted department and preserves original department', async () => {
      const res = await request(app)
        .patch(`/api/v1/subtasks/${testSubtaskId}`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          department: 'DEPT_ROADS',
          remarks: 'Attempting unauthorized department shift'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.department, 'DEPT_WATER');
      assert.notStrictEqual(res.body.data.department, 'DEPT_ROADS');
      assert.strictEqual(res.body.data.remarks, 'Attempting unauthorized department shift');

      const directRes = await request(app)
        .get(`/api/v1/subtasks/${testSubtaskId}`)
        .set('Authorization', `Bearer ${waterOfficerToken}`);
      assert.strictEqual(directRes.body.data.department, 'DEPT_WATER');
    });

    it('PATCH /api/v1/subtasks/:id ignores submitted invalid department without corrupting subtask', async () => {
      const res = await request(app)
        .patch(`/api/v1/subtasks/${testSubtaskId}`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          department: 'DEPT_INVALID_BOGUS'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.department, 'DEPT_WATER');
    });
  });

  // =========================================================================
  // 5. Incident Resolution & Admin Subtask Overrides
  // =========================================================================
  describe('5. Incident Status Transitions & Resolution Override Security', () => {
    it('PATCH /api/v1/incidents/:id/status rejects RESOLVED while subtask is IN_PROGRESS with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Attempting premature resolution'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /subtask.*incomplete/i);
      assert.ok(res.body.details?.incompleteSubtasks);
      assert.ok(res.body.details.incompleteSubtasks.length > 0);
    });

    it('PATCH /api/v1/incidents/:id/status rejects non-lead department officer attempting resolution with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`) // Roads officer cannot resolve Water incident
        .send({
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Unauthorized resolution attempt'
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /not authorized.*update incident status/i);
    });

    it('PATCH /api/v1/incidents/:id/status rejects citizen attempting resolution with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Citizen unauthorized resolution'
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('PATCH /api/v1/incidents/:id/status rejects non-admin officer attempting override with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`) // Officer cannot override
        .send({
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Officer resolution summary',
          overrideIncompleteSubtasks: true,
          overrideJustification: 'Emergency operational sign-off by officer'
        });

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /administrators are authorized/i);
    });

    it('PATCH /api/v1/incidents/:id/status rejects administrator override with justification under 10 chars with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Valid resolution summary exceeding 5 chars',
          overrideIncompleteSubtasks: true,
          overrideJustification: 'Too short' // Under 10 chars
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /justification of at least 10 characters/i);
    });

    it('PATCH /api/v1/incidents/:id/status rejects RESOLVED when resolutionSummary is under 5 characters with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Tiny', // Under 5 chars
          overrideIncompleteSubtasks: true,
          overrideJustification: 'Valid override justification exceeding 10 characters'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /resolutionSummary.*minimum 5 characters/i);
    });

    it('PATCH /api/v1/incidents/:id/status allows administrator to authorize incomplete subtask override', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${adminToken}`) // Admin authorized
        .send({
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Major sector breach controlled; remaining cleanup transferred to routine maintenance.',
          overrideIncompleteSubtasks: true,
          overrideJustification: 'Crisis defused; municipal team handling residual non-blocking valve inspection.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, INCIDENT_STATUS.RESOLVED);
      assert.ok(res.body.data.subtaskOverride);
      assert.strictEqual(res.body.data.subtaskOverride.overridden, true);
    });

    it('PATCH /api/v1/incidents/:id/status rejects invalid transition from RESOLVED to ACTIVE with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({ status: INCIDENT_STATUS.ACTIVE }); // RESOLVED cannot jump to ACTIVE

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /invalid incident status transition/i);
    });

    it('PATCH /api/v1/incidents/:id/status allows valid progression from RESOLVED to CLOSED', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({ status: INCIDENT_STATUS.CLOSED });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, INCIDENT_STATUS.CLOSED);
    });

    it('PATCH /api/v1/incidents/:id/status rejects transitioning out of terminal CLOSED state with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${testIncidentId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({ status: INCIDENT_STATUS.ACTIVE }); // CLOSED is terminal

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /terminal state/i);
    });
  });

  // =========================================================================
  // 6. Complaint Linkage, Idempotency & Safe Transfers
  // =========================================================================
  describe('6. Complaint Linking, Unlinking & Transfer APIs', () => {
    let secondIncidentId = null;
    let targetTransferIncidentId = null;

    before(async () => {
      // Create active incidents led by DEPT_WATER for transfer tests
      const res1 = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          title: 'Sector 4 Secondary Drainage Overflow',
          category: 'water',
          leadDepartment: 'DEPT_WATER'
        });
      secondIncidentId = res1.body.data.id;

      const res2 = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          title: 'Sector 4 Tertiary Runoff Reservoir',
          category: 'water',
          leadDepartment: 'DEPT_WATER'
        });
      targetTransferIncidentId = res2.body.data.id;
    });

    it('POST /api/v1/incidents/:id/complaints successfully links complaint', async () => {
      const res = await request(app)
        .post(`/api/v1/incidents/${secondIncidentId}/complaints`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          complaintId: seededComplaint1,
          remarks: 'Linked to secondary overflow incident'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.alreadyLinked, false);
    });

    it('POST /api/v1/incidents/:id/complaints is idempotent on repeat calls', async () => {
      const res = await request(app)
        .post(`/api/v1/incidents/${secondIncidentId}/complaints`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          complaintId: seededComplaint1
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.alreadyLinked, true);
    });

    it('POST /api/v1/incidents/:id/complaints rejects linking complaint to another incident with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/v1/incidents/${targetTransferIncidentId}/complaints`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          complaintId: seededComplaint1 // Already linked to secondIncidentId
        });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /already linked/i);
    });

    it('POST /api/v1/incidents/transfer-complaint rejects transfer with short justification (<10 chars) with 400', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/transfer-complaint')
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          fromIncidentId: secondIncidentId,
          toIncidentId: targetTransferIncidentId,
          complaintId: seededComplaint1,
          justification: 'Short'
        });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(
        res.body.error === 'Validation Error' || /10 characters/i.test(res.body.error)
      );
      assert.ok(
        res.body.details?.some(d => /10 characters/i.test(d.message)) ||
        /10 characters/i.test(res.body.error)
      );
    });

    it('POST /api/v1/incidents/transfer-complaint successfully transfers complaint between incidents', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/transfer-complaint')
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          fromIncidentId: secondIncidentId,
          toIncidentId: targetTransferIncidentId,
          complaintId: seededComplaint1,
          justification: 'Relinking to primary parent incident after hydraulic assessment'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.fromIncidentId, secondIncidentId);
      assert.strictEqual(res.body.data.toIncidentId, targetTransferIncidentId);
    });

    it('DELETE /api/v1/incidents/:id/complaints/:complaintId unlinks complaint cleanly', async () => {
      const res = await request(app)
        .delete(`/api/v1/incidents/${targetTransferIncidentId}/complaints/${seededComplaint1}`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .query({ remarks: 'Issue standalone verification complete' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.alreadyUnlinked, false);
    });
  });

  // =========================================================================
  // 7. Structured Critical Consistency Failure Handling at API Boundary
  // =========================================================================
  describe('7. Structured Critical Consistency Error at API Boundary', () => {
    it('surfaces structured HTTP 500 consistency failure without exposing citizen PII when compensation fails', async () => {
      // Temporarily simulate storage corruption during secondary write and compensation
      const originalLink = complaintRepository.linkIncident;
      const originalUnlink = incidentRepository.unlinkComplaint;

      try {
        complaintRepository.linkIncident = async () => {
          throw new Error('Secondary storage disk write failure');
        };
        incidentRepository.unlinkComplaint = async () => {
          throw new Error('Primary rollback write failure');
        };

        const res = await request(app)
          .post(`/api/v1/incidents/${testIncidentId}/complaints`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            complaintId: seededComplaint2
          });

        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.details);
        assert.strictEqual(res.body.details.requiresReconciliation, true);
        assert.strictEqual(res.body.details.operation, 'LINK_COMPLAINT');

        // Zero citizen PII in error response
        assert.strictEqual(res.body.details.citizenName, undefined);
        assert.strictEqual(res.body.details.citizenEmail, undefined);
        assert.strictEqual(res.body.details.citizenPhone, undefined);
      } finally {
        complaintRepository.linkIncident = originalLink;
        incidentRepository.unlinkComplaint = originalUnlink;
      }
    });
  });

  // =========================================================================
  // 8. Phase 7 Step 2C: Complaint Propagation & Public Tracking APIs
  // =========================================================================
  describe('8. Phase 7 Step 2C: Resolution Propagation & Public Tracking API Integration', () => {
    let propagationIncidentId;
    let propagationComplaintId;
    let propagationRefNumber;

    before(async () => {
      // Create a test incident and linked complaint in IN_PROGRESS
      const incRes = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          title: 'District pipeline pressure surge on JM Road',
          category: 'water',
          leadDepartment: 'DEPT_WATER',
          description: 'High pressure alert causing burst risks'
        });

      propagationIncidentId = incRes.body.data.id;

      // Update complaint status to IN_PROGRESS so it is legally transitionable
      const cmpData = JSON.parse(await fs.readFile(TEST_COMPLAINTS_PATH, 'utf-8'));
      const cmp = cmpData.complaints.find(c => c.id === 'CMP-2026-0001');
      if (cmp) {
        cmp.status = 'IN_PROGRESS';
        propagationComplaintId = cmp.id;
        propagationRefNumber = cmp.referenceNumber;
        await fs.writeFile(TEST_COMPLAINTS_PATH, JSON.stringify(cmpData, null, 2), 'utf-8');
      }

      // Link complaint to incident
      await request(app)
        .post(`/api/v1/incidents/${propagationIncidentId}/complaints`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({ complaintId: propagationComplaintId });
    });

    it('PATCH /api/v1/incidents/:id/status defaults propagateToComplaints to false and leaves complaint unchanged', async () => {
      // Create separate incident for opt-out test
      const optOutIncRes = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          title: 'Opt-out propagation test incident',
          category: 'water',
          leadDepartment: 'DEPT_WATER'
        });
      const optOutIncId = optOutIncRes.body.data.id;

      // Link complaint CMP-2026-0002 (set to IN_PROGRESS)
      const cmpData = JSON.parse(await fs.readFile(TEST_COMPLAINTS_PATH, 'utf-8'));
      const cmp2 = cmpData.complaints.find(c => c.id === 'CMP-2026-0002');
      cmp2.status = 'IN_PROGRESS';
      await fs.writeFile(TEST_COMPLAINTS_PATH, JSON.stringify(cmpData, null, 2), 'utf-8');

      await request(app)
        .post(`/api/v1/incidents/${optOutIncId}/complaints`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({ complaintId: 'CMP-2026-0002' });

      // Resolve WITHOUT propagateToComplaints
      const resolveRes = await request(app)
        .patch(`/api/v1/incidents/${optOutIncId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          status: 'RESOLVED',
          resolutionSummary: 'Valves replaced and pressure normalized.'
        });

      assert.strictEqual(resolveRes.status, 200);
      assert.strictEqual(resolveRes.body.data.status, 'RESOLVED');
      assert.strictEqual(resolveRes.body.data.propagationReport, undefined);

      // Verify complaint CMP-2026-0002 is still IN_PROGRESS
      const afterCmpData = JSON.parse(await fs.readFile(TEST_COMPLAINTS_PATH, 'utf-8'));
      const afterCmp2 = afterCmpData.complaints.find(c => c.id === 'CMP-2026-0002');
      assert.strictEqual(afterCmp2.status, 'IN_PROGRESS');
    });

    it('PATCH /api/v1/incidents/:id/status propagates resolution when propagateToComplaints is true', async () => {
      const res = await request(app)
        .patch(`/api/v1/incidents/${propagationIncidentId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          status: 'RESOLVED',
          resolutionSummary: 'Pipeline valves secured and calibrated.',
          propagateToComplaints: true,
          complaintResolutionRemarks: 'Resolved via JM Road pipeline multi-agency work.'
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.message.includes('propagated to RESOLVED successfully'));

      const report = res.body.data.propagationReport;
      assert.ok(report);
      assert.strictEqual(report.attempted, 1);
      assert.strictEqual(report.resolvedCount, 1);
      assert.strictEqual(report.failedCount, 0);
      assert.strictEqual(report.resolvedComplaints[0].complaintId, propagationComplaintId);
      assert.strictEqual(report.resolvedComplaints[0].newStatus, 'RESOLVED');

      // Verify complaint is now RESOLVED in repo
      const cmpData = JSON.parse(await fs.readFile(TEST_COMPLAINTS_PATH, 'utf-8'));
      const cmp = cmpData.complaints.find(c => c.id === propagationComplaintId);
      assert.strictEqual(cmp.status, 'RESOLVED');
    });

    it('GET /api/v1/complaints/track/:reference includes sanitized parentIncident without exposing internal details', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/track/${propagationRefNumber}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      const data = res.body.data;

      assert.strictEqual(data.incidentId, propagationIncidentId);
      assert.strictEqual(data.status, 'RESOLVED');

      // Sanitized parent incident fields
      assert.ok(data.parentIncident);
      assert.strictEqual(data.parentIncident.id, propagationIncidentId);
      assert.strictEqual(data.parentIncident.title, 'District pipeline pressure surge on JM Road');
      assert.strictEqual(data.parentIncident.status, 'RESOLVED');
      assert.strictEqual(data.parentIncident.leadDepartment, 'DEPT_WATER');
      assert.strictEqual(data.parentIncident.resolutionSummary, 'Pipeline valves secured and calibrated.');

      // Private internal details strictly omitted
      assert.strictEqual(data.parentIncident.subtasks, undefined);
      assert.strictEqual(data.parentIncident.subtaskOverride, undefined);
      assert.strictEqual(data.officerNotes, undefined);
      assert.strictEqual(data.citizenId, undefined);
      assert.strictEqual(data.assignedOfficerId, undefined);
    });
  });
});
