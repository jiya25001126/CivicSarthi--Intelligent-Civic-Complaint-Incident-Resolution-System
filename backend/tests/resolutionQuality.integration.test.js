/**
 * @file resolutionQuality.integration.test.js
 * @description Integration tests for CivicSarthi Phase 9, Step 2:
 * Backend Complaint-Resolution Workflow Integration with Resolution Quality Checker.
 *
 * Verifies:
 * 1. Valid standard resolution transitions complaint to RESOLVED with score and audit log.
 * 2. Standard resolution rejected for missing required checklist fields (400 RESOLUTION_QUALITY_FAILED).
 * 3. Valid exception approved by an authorized administrator with distinct exception metadata and audit log.
 * 4. Exception rejected with 403 FORBIDDEN_EXCEPTION_APPROVAL when attempted by a non-admin user.
 * 5. Exception rejected with 400 RESOLUTION_QUALITY_FAILED when exception reason or justification is missing/invalid.
 * 6. Failed validation leaves complaint status, status history, and audit logs completely unchanged.
 * 7. Non-resolution transitions (e.g. IN_PROGRESS -> AWAITING_INFORMATION) proceed normally without resolution checks.
 * 8. Persistence compatibility for resolutionDetails across JSON repository and Mongo schema.
 * 9. Boundary condition where isException is false but exception fields are present.
 * 10. Stable error response structure and zero sensitive citizen/officer leakage.
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
import { incidentRepository } from '../src/repositories/incident.repository.js';
import { authService } from '../src/services/auth.service.js';
import complaintService from '../src/services/complaint.service.js';
import incidentService from '../src/services/incident.service.js';
import { ComplaintModel } from '../src/models/complaint.model.js';
import { StatusHistoryModel } from '../src/models/statusHistory.model.js';
import { MongoComplaintRepository } from '../src/repositories/complaint.mongo.repository.js';
import {
  RESOLUTION_OUTCOME_TYPES,
  VERIFICATION_METHODS,
  RESOLUTION_EXCEPTION_REASONS,
  RESOLUTION_REQUIREMENT_CODES
} from '../src/constants/resolutionQuality.constants.js';
import { isSafeEvidenceReference } from '../src/services/resolutionQuality.validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-resolution-integration');
const SANDBOX_COMPLAINTS_FILE = path.join(SANDBOX_DIR, 'complaints.test.json');
const SANDBOX_USERS_FILE = path.join(SANDBOX_DIR, 'users.test.json');
const SANDBOX_AUDIT_FILE = path.join(SANDBOX_DIR, 'audit_logs.test.json');
const SANDBOX_INCIDENTS_FILE = path.join(SANDBOX_DIR, 'incidents.test.json');

const app = createApp();

describe('CivicSarthi Phase 9 Step 2 & 3 — Resolution Quality Backend Integration Tests', () => {
  let adminToken = null;
  let roadsOfficerToken = null;
  let waterOfficerToken = null;
  let citizenToken = null;
  let citizenUser = null;

  before(async () => {
    // 1. Create clean sandbox directory
    await fs.mkdir(SANDBOX_DIR, { recursive: true });

    // 2. Prepare isolated initial data
    const initialComplaints = {
      metadata: { version: '1.0.0', description: 'Resolution Integration Test Fixture' },
      complaints: [
        {
          id: 'CMP-2026-TEST-001',
          referenceNumber: 'CS-2026-00001',
          title: 'Deep crater pothole near sector 4 crossing',
          description: 'Large road crater obstructing traffic and endangering two-wheelers on main highway.',
          category: 'roads',
          state: 'Haryana',
          district: 'Gurugram',
          locality: 'Sector 4',
          departmentId: 'DEPT_ROADS',
          department: 'DEPT_ROADS',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          citizenId: 'CITIZEN-TEST-001',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          reassignments: 0,
          evidence: [],
          statusHistory: [
            {
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              status: 'SUBMITTED',
              actorType: 'CITIZEN',
              remarks: 'Complaint registered'
            },
            {
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              status: 'IN_PROGRESS',
              actorType: 'OFFICER',
              remarks: 'Repairs initiated on sector 4 crossing'
            }
          ]
        },
        {
          id: 'CMP-2026-TEST-002',
          referenceNumber: 'CS-2026-00002',
          title: 'Contaminated water supply in block C',
          description: 'Tap water is yellowish and smells foul for the past 48 hours.',
          category: 'water',
          state: 'Haryana',
          district: 'Gurugram',
          locality: 'Block C',
          departmentId: 'DEPT_WATER',
          department: 'DEPT_WATER',
          status: 'IN_PROGRESS',
          priority: 'CRITICAL',
          citizenId: 'CITIZEN-TEST-002',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          reassignments: 0,
          evidence: [],
          statusHistory: [
            {
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              status: 'IN_PROGRESS',
              actorType: 'OFFICER',
              remarks: 'Water pipeline testing underway'
            }
          ]
        },
        {
          id: 'CMP-2026-TEST-003',
          referenceNumber: 'CS-2026-00003',
          title: 'Street light cluster flickering intermittently',
          description: 'Street light line on 10th crossroad keeps blinking.',
          category: 'electricity',
          state: 'Haryana',
          district: 'Gurugram',
          locality: '10th Cross',
          departmentId: 'DEPT_POWER',
          department: 'DEPT_POWER',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
          citizenId: 'CITIZEN-TEST-003',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          reassignments: 0,
          evidence: [],
          statusHistory: [
            {
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              status: 'IN_PROGRESS',
              actorType: 'OFFICER',
              remarks: 'Transformer inspection ongoing'
            }
          ]
        },
        {
          id: 'CMP-2026-TEST-004',
          referenceNumber: 'CS-2026-00004',
          title: 'Direct service enforcement complaint',
          description: 'Used to test direct complaintService status transitions without resolution quality.',
          category: 'water',
          state: 'Haryana',
          district: 'Gurugram',
          locality: 'Block D',
          departmentId: 'DEPT_WATER',
          department: 'DEPT_WATER',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
          citizenId: 'CITIZEN-TEST-004',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          reassignments: 0,
          evidence: [],
          statusHistory: [
            {
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              status: 'IN_PROGRESS',
              actorType: 'OFFICER',
              remarks: 'Inspection active'
            }
          ]
        },
        {
          id: 'CMP-2026-TEST-005',
          referenceNumber: 'CS-2026-00005',
          title: 'Incident cascade child complaint',
          description: 'Linked to a cluster incident to test system-driven resolution propagation.',
          category: 'roads',
          state: 'Haryana',
          district: 'Gurugram',
          locality: 'Sector 4',
          departmentId: 'DEPT_ROADS',
          department: 'DEPT_ROADS',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          citizenId: 'CITIZEN-TEST-005',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          reassignments: 0,
          evidence: [],
          statusHistory: [
            {
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              status: 'IN_PROGRESS',
              actorType: 'OFFICER',
              remarks: 'Linked to sector incident'
            }
          ]
        },
        {
          id: 'CMP-2026-TEST-006',
          referenceNumber: 'CS-2026-00006',
          title: 'Persistence failure test complaint',
          description: 'Used to verify persistence failure consistency behavior.',
          category: 'electricity',
          state: 'Haryana',
          district: 'Gurugram',
          locality: '10th Cross',
          departmentId: 'DEPT_POWER',
          department: 'DEPT_POWER',
          status: 'IN_PROGRESS',
          priority: 'MEDIUM',
          citizenId: 'CITIZEN-TEST-006',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          reassignments: 0,
          evidence: [],
          statusHistory: [
            {
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              status: 'IN_PROGRESS',
              actorType: 'OFFICER',
              remarks: 'Awaiting repair'
            }
          ]
        }
      ]
    };

    const initialUsers = {
      metadata: { version: '1.0.0', description: 'Resolution Integration Test Users' },
      users: []
    };

    const initialAudit = {
      metadata: { version: '1.0.0', description: 'Resolution Integration Test Audit Logs' },
      logs: []
    };

    const initialIncidents = {
      metadata: { version: '1.0.0', description: 'Resolution Integration Test Incidents' },
      incidents: []
    };

    await fs.writeFile(SANDBOX_COMPLAINTS_FILE, JSON.stringify(initialComplaints, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_AUDIT_FILE, JSON.stringify(initialAudit, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_INCIDENTS_FILE, JSON.stringify(initialIncidents, null, 2), 'utf-8');

    // 3. Point repositories to sandbox files
    complaintRepository.setFilePath(SANDBOX_COMPLAINTS_FILE);
    userRepository.setFilePath(SANDBOX_USERS_FILE);
    auditLogRepository.setFilePath(SANDBOX_AUDIT_FILE);
    incidentRepository.setFilePath(SANDBOX_INCIDENTS_FILE);

    // 4. Provision test actors
    const adminUser = await authService.provisionUser({
      email: 'admin.res@civicsarthi.internal',
      name: 'Supervisory Admin',
      password: 'AdminPassword123!',
      role: 'admin'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    adminToken = authService.generateToken(adminUser);

    const roadsOfficer = await authService.provisionUser({
      email: 'officer.roads@civicsarthi.internal',
      name: 'Roads Field Officer',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    roadsOfficerToken = authService.generateToken(roadsOfficer);

    const waterOfficer = await authService.provisionUser({
      email: 'officer.water@civicsarthi.internal',
      name: 'Water Works Officer',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });
    waterOfficerToken = authService.generateToken(waterOfficer);

    const citizenRegistration = await authService.register({
      email: 'citizen.res@civicsarthi.internal',
      name: 'Test Citizen User',
      password: 'CitizenPassword123!'
    });
    citizenUser = citizenRegistration.user;
    citizenToken = citizenRegistration.token;

    // Link complaint CMP-2026-TEST-001 to citizenUser
    const dataWithCitizen = JSON.parse(await fs.readFile(SANDBOX_COMPLAINTS_FILE, 'utf-8'));
    dataWithCitizen.complaints[0].citizenId = citizenUser.id;
    await fs.writeFile(SANDBOX_COMPLAINTS_FILE, JSON.stringify(dataWithCitizen, null, 2), 'utf-8');
  });

  after(async () => {
    // Restore repository paths
    try {
      complaintRepository.resetFilePath();
    } catch {}
    try {
      userRepository.resetFilePath();
    } catch {}
    try {
      auditLogRepository.resetFilePath();
    } catch {}
    try {
      incidentRepository.resetFilePath();
    } catch {}

    // Clean up sandbox directory
    try {
      await fs.rm(SANDBOX_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('1. Valid standard resolution transitions complaint to RESOLVED with score and audit log', async () => {
    const res = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-001/status')
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        actionCompleted: true,
        outcomeType: RESOLUTION_OUTCOME_TYPES.REPAIR_COMPLETED,
        verificationMethod: VERIFICATION_METHODS.PHYSICAL_INSPECTION,
        closureRemarks: 'Pothole excavated, filled with dense bituminous macadam and roller compacted successfully.',
        evidence: ['ROADS_SECTOR4_COMPLETED_AFTER_01.JPG']
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'RESOLVED');

    // Verify persisted resolution details
    const resDetails = res.body.data.resolutionDetails;
    assert.ok(resDetails, 'resolutionDetails must be attached');
    assert.equal(resDetails.valid, true);
    assert.equal(resDetails.isException, false);
    assert.equal(resDetails.score, 100);
    assert.equal(resDetails.outcomeType, 'REPAIR_COMPLETED');
    assert.equal(resDetails.verificationMethod, 'PHYSICAL_INSPECTION');
    assert.deepEqual(resDetails.evidence, ['ROADS_SECTOR4_COMPLETED_AFTER_01.JPG']);

    // Verify status history contains resolution details
    const complaintInRepo = await complaintRepository.findById('CMP-2026-TEST-001');
    assert.equal(complaintInRepo.status, 'RESOLVED');
    const latestHistory = complaintInRepo.statusHistory[complaintInRepo.statusHistory.length - 1];
    assert.equal(latestHistory.status, 'RESOLVED');
    assert.ok(latestHistory.resolutionDetails);
    assert.equal(latestHistory.resolutionDetails.score, 100);

    // Verify audit log recorded with RESOLVE_COMPLAINT action
    const auditLogs = await auditLogRepository.findAll();
    const resolutionLog = auditLogs.find(l => l.action === 'RESOLVE_COMPLAINT' && l.complaintId === 'CMP-2026-TEST-001');
    assert.ok(resolutionLog, 'Audit log for RESOLVE_COMPLAINT must exist');
    assert.equal(resolutionLog.role, 'officer');
    assert.equal(resolutionLog.details.score, 100);
    assert.equal(resolutionLog.details.isException, false);
  });

  it('2. Standard resolution rejected for missing required fields (HTTP 400 RESOLUTION_QUALITY_FAILED)', async () => {
    // Attempt to resolve CMP-2026-TEST-002 without verificationMethod and short remarks
    const res = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-002/status')
      .set('Authorization', `Bearer ${waterOfficerToken}`)
      .send({
        status: 'RESOLVED',
        actionCompleted: true,
        // Missing verificationMethod
        // Missing or short remarks
        closureRemarks: 'Done.',
        evidence: []
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'RESOLUTION_QUALITY_FAILED');
    assert.equal(res.body.valid, false);
    assert.ok(Array.isArray(res.body.missingRequirements));

    const reqIds = res.body.missingRequirements.map(r => r.id);
    assert.ok(reqIds.includes(RESOLUTION_REQUIREMENT_CODES.REQ_VERIFICATION_METHOD));
    assert.ok(reqIds.includes(RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS));
  });

  it('3. Valid exception approved by an authorized administrator with distinct metadata and audit log', async () => {
    const res = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-002/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        isException: true,
        exceptionReason: 'FORCE_MAJEURE_UNFEASIBLE',
        exceptionJustification: 'Site remains inaccessible due to severe seasonal monsoon flash flooding.'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'RESOLVED');

    const resDetails = res.body.data.resolutionDetails;
    assert.ok(resDetails);
    assert.equal(resDetails.valid, true);
    assert.equal(resDetails.isException, true);
    assert.equal(resDetails.exceptionReason, 'FORCE_MAJEURE_UNFEASIBLE');
    assert.equal(resDetails.exceptionJustification, 'Site remains inaccessible due to severe seasonal monsoon flash flooding.');

    // Verify audit log has RESOLVE_COMPLAINT_EXCEPTION
    const auditLogs = await auditLogRepository.findAll();
    const exceptionAudit = auditLogs.find(l => l.action === 'RESOLVE_COMPLAINT_EXCEPTION' && l.complaintId === 'CMP-2026-TEST-002');
    assert.ok(exceptionAudit, 'Audit log for RESOLVE_COMPLAINT_EXCEPTION must be recorded');
    assert.equal(exceptionAudit.role, 'admin');
    assert.equal(exceptionAudit.details.isException, true);
    assert.equal(exceptionAudit.details.exceptionReason, 'FORCE_MAJEURE_UNFEASIBLE');
  });

  it('4. Exception rejected with 403 FORBIDDEN_EXCEPTION_APPROVAL when attempted by unauthorized user', async () => {
    // Water officer tries to submit an exception on their own department's complaint
    const res = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-003/status')
      .set('Authorization', `Bearer ${roadsOfficerToken}`) // roads officer trying on DEPT_POWER or officer role
      .send({
        status: 'RESOLVED',
        isException: true,
        exceptionReason: 'FORCE_MAJEURE_UNFEASIBLE',
        exceptionJustification: 'Road officer attempting exception override without administrative authorization.'
      });

    // Officer role is blocked
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  it('5. Missing or invalid exception reason/justification returns HTTP 400 with missing requirements', async () => {
    // Admin attempts exception with unrecognized reason and short justification
    const res = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-003/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        isException: true,
        exceptionReason: 'INVALID_UNKNOWN_REASON',
        exceptionJustification: 'Too short'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'RESOLUTION_QUALITY_FAILED');
    assert.equal(res.body.valid, false);

    const reqIds = res.body.missingRequirements.map(r => r.id);
    assert.ok(reqIds.includes(RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_REASON));
    assert.ok(reqIds.includes(RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_JUSTIFICATION));
  });

  it('6. Failed validation leaves complaint status, status history, and audit logs completely unchanged', async () => {
    // Inspect state of CMP-2026-TEST-003 before failed attempt
    const beforeComplaint = await complaintRepository.findById('CMP-2026-TEST-003');
    const initialStatus = beforeComplaint.status;
    const initialHistoryLength = beforeComplaint.statusHistory.length;
    const initialAuditLogs = await auditLogRepository.findAll();
    const initialAuditCount = initialAuditLogs.length;

    // Send failing resolution attempt
    const res = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-003/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        // Incomplete fields
        actionCompleted: false
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'RESOLUTION_QUALITY_FAILED');

    // Verify after state is byte-for-byte identical in lifecycle records
    const afterComplaint = await complaintRepository.findById('CMP-2026-TEST-003');
    assert.equal(afterComplaint.status, initialStatus);
    assert.equal(afterComplaint.statusHistory.length, initialHistoryLength);

    const afterAuditLogs = await auditLogRepository.findAll();
    assert.equal(afterAuditLogs.length, initialAuditCount);
  });

  it('7. Existing non-resolution transitions still work without resolution quality gating', async () => {
    // Transition CMP-2026-TEST-003 from IN_PROGRESS to AWAITING_INFORMATION (allowed transition)
    const res = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-003/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'AWAITING_INFORMATION',
        remarks: 'Awaiting schematic verification from transformer maintenance contractor.'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'AWAITING_INFORMATION');

    // Verify complaint in repository transitioned cleanly
    const complaint = await complaintRepository.findById('CMP-2026-TEST-003');
    assert.equal(complaint.status, 'AWAITING_INFORMATION');
  });

  it('8. Persistence compatibility for resolutionDetails in JSON repository and Mongo schema', async () => {
    // Verify JSON repository directly preserves resolutionDetails
    const jsonComplaint = await complaintRepository.findById('CMP-2026-TEST-001');
    assert.ok(jsonComplaint.resolutionDetails);
    assert.equal(jsonComplaint.resolutionDetails.score, 100);
    assert.equal(jsonComplaint.resolutionDetails.valid, true);

    // Verify Mongoose schema validation for resolutionDetails field
    const mongoDoc = new ComplaintModel({
      id: 'CMP-MONGO-TEST-01',
      referenceNumber: 'CS-2026-99999',
      title: 'Mongoose Schema Resolution Details Verification',
      description: 'Testing schema validity for resolutionDetails field structure.',
      category: 'roads',
      state: 'Haryana',
      district: 'Gurugram',
      departmentId: 'DEPT_ROADS',
      status: 'RESOLVED',
      priority: 'MEDIUM',
      citizenId: 'CITIZEN-001',
      resolutionDetails: {
        valid: true,
        score: 100,
        isException: false,
        outcomeType: 'REPAIR_COMPLETED',
        verificationMethod: 'PHYSICAL_INSPECTION',
        closureRemarks: 'Verified via engineering inspection.'
      }
    });

    const validationErr = mongoDoc.validateSync();
    assert.equal(validationErr, undefined, 'ComplaintModel must accept resolutionDetails without validation error');

    // Verify StatusHistoryModel schema
    const historyDoc = new StatusHistoryModel({
      id: 'HIST-TEST-01',
      complaintId: 'CMP-MONGO-TEST-01',
      referenceNumber: 'CS-2026-00001',
      timestamp: new Date(),
      status: 'RESOLVED',
      actorType: 'OFFICER',
      remarks: 'Resolved',
      resolutionDetails: {
        score: 100,
        valid: true
      }
    });

    const histErr = historyDoc.validateSync();
    assert.equal(histErr, undefined, 'StatusHistoryModel must accept resolutionDetails without validation error');
  });

  it('9. Boundary where isException is false but exception fields are supplied', async () => {
    // When isException is false, exception fields (reason, justification) must not bypass standard checks
    // If standard fields are missing, it must fail standard resolution checklist (not 403 forbidden)
    const resMissing = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-001/status')
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        isException: false,
        exceptionReason: 'FORCE_MAJEURE_UNFEASIBLE',
        exceptionJustification: 'Trying to pass exception reason while isException is false without standard fields'
      });

    assert.equal(resMissing.status, 400);
    assert.equal(resMissing.body.code, 'RESOLUTION_QUALITY_FAILED');
    assert.equal(resMissing.body.valid, false);

    // Missing requirements reflect standard checklist, not exception checklist
    const reqIds = resMissing.body.missingRequirements.map(r => r.id);
    assert.ok(reqIds.includes(RESOLUTION_REQUIREMENT_CODES.REQ_ACTION_OR_OUTCOME));
    assert.ok(reqIds.includes(RESOLUTION_REQUIREMENT_CODES.REQ_VERIFICATION_METHOD));
  });

  it('10. Stable error response structure and no sensitive information leakage', async () => {
    const res = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-001/status')
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        evidence: ['C:\\Windows\\System32\\private_audit.log'] // Unsafe local path
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'RESOLUTION_QUALITY_FAILED');
    assert.ok(typeof res.body.score === 'number');
    assert.ok(Array.isArray(res.body.missingRequirements));
    assert.ok(Array.isArray(res.body.checklist));

    // Zero leakage checks
    const responseText = JSON.stringify(res.body);
    assert.ok(!responseText.includes('System32'), 'Must not echo unsafe system path');
    assert.ok(!responseText.includes('citizenEmail'), 'Must not leak citizen email');
    assert.ok(!responseText.includes('citizenPhone'), 'Must not leak citizen phone');
    assert.ok(!responseText.includes('password'), 'Must not leak credentials');
  });

  it('11. Fix 1: Service-level direct updateComplaintStatus enforcement across all paths (RESOLVED & CLOSED)', async () => {
    // Calling complaintService.updateComplaintStatus directly to RESOLVED without resolutionDetails must be rejected
    await assert.rejects(
      async () => {
        await complaintService.updateComplaintStatus('CMP-2026-TEST-004', {
          status: 'RESOLVED',
          remarks: 'Bypassing controller to call service directly without quality verification'
        });
      },
      (err) => {
        assert.equal(err.code, 'RESOLUTION_QUALITY_FAILED');
        assert.equal(err.status, 400);
        return true;
      }
    );

    // Calling complaintService.updateComplaintStatus with invalid resolutionDetails must be rejected
    await assert.rejects(
      async () => {
        await complaintService.updateComplaintStatus('CMP-2026-TEST-004', {
          status: 'RESOLVED',
          remarks: 'Supplying failing resolutionDetails',
          resolutionDetails: { valid: false, score: 25 }
        });
      },
      (err) => {
        assert.equal(err.code, 'RESOLUTION_QUALITY_FAILED');
        assert.equal(err.status, 400);
        return true;
      }
    );

    // Calling complaintService.updateComplaintStatus to CLOSED without resolutionDetails must also be rejected
    await assert.rejects(
      async () => {
        await complaintService.updateComplaintStatus('CMP-2026-TEST-004', {
          status: 'CLOSED',
          remarks: 'Closing complaint without resolution quality details'
        });
      },
      (err) => {
        assert.equal(err.code, 'RESOLUTION_QUALITY_FAILED');
        assert.equal(err.status, 400);
        return true;
      }
    );

    // Non-resolution transitions (e.g. AWAITING_INFORMATION) proceed normally without resolutionDetails
    const nonResUpdate = await complaintService.updateComplaintStatus('CMP-2026-TEST-004', {
      status: 'AWAITING_INFORMATION',
      remarks: 'Waiting for citizen to provide house number'
    });
    assert.equal(nonResUpdate.status, 'AWAITING_INFORMATION');
  });

  it('12. Fix 1: Incident cascade propagation assigns explicit, auditable DUPLICATE_REFERRED exception resolution details', async () => {
    // 1. Create a parent incident linking CMP-2026-TEST-005
    const incident = await incidentService.createIncident({
      title: 'Sector 4 Main Road Reconstruction Cluster',
      description: 'Multiple potholes and surface disintegration across 500m stretch.',
      category: 'roads',
      leadDepartment: 'DEPT_ROADS',
      linkedComplaints: ['CMP-2026-TEST-005']
    }, { id: 'admin-1', role: 'admin' });

    assert.ok(incident.id, 'Incident must be created');

    // 2. Resolve incident with propagateToComplaints: true
    const incidentUpdate = await incidentService.updateIncidentStatus(
      incident.id,
      {
        status: 'RESOLVED',
        resolutionSummary: 'Complete asphalt resurfacing and storm drain clearing finished.',
        propagateToComplaints: true
      },
      { id: 'admin-1', role: 'admin' }
    );

    assert.ok(incidentUpdate.propagationReport, 'Must include propagationReport');
    assert.equal(incidentUpdate.propagationReport.resolvedCount, 1);
    assert.equal(incidentUpdate.propagationReport.failedCount, 0);

    // 3. Verify child complaint in repository transitioned to RESOLVED with explicit system exception
    const childComplaint = await complaintRepository.findById('CMP-2026-TEST-005');
    assert.equal(childComplaint.status, 'RESOLVED');
    assert.ok(childComplaint.resolutionDetails, 'Child complaint must have resolutionDetails');
    assert.equal(childComplaint.resolutionDetails.valid, true);
    assert.equal(childComplaint.resolutionDetails.isException, true);
    assert.equal(childComplaint.resolutionDetails.exceptionReason, 'DUPLICATE_REFERRED');
    assert.equal(childComplaint.resolutionDetails.verificationMethod, 'SUPERVISORY_AUDIT');
    assert.equal(childComplaint.resolutionDetails.score, 100);
    assert.ok(childComplaint.resolutionDetails.exceptionJustification.includes(incident.id));
  });

  it('13. Fix 2: Citizen-safe and public tracking projection strictly enforces allowlist', async () => {
    const internalComplaint = {
      id: 'CMP-TEST-INTERNAL-01',
      referenceNumber: 'CS-2026-00088',
      title: 'Water pollution near school',
      description: 'Industrial runoff entering municipal supply pipe.',
      category: 'water',
      status: 'RESOLVED',
      citizenId: citizenUser.id,
      officerNotes: [
        { note: 'Discussed with plant manager privately', officerId: 'OFF-SECRET-01' }
      ],
      resolutionDetails: {
        score: 95,
        scoreExplanation: 'Nearly complete remediation verified',
        valid: true,
        outcomeType: 'RESOLVED_SATISFACTORILY',
        actionCompleted: true,
        verificationMethod: 'WATER_QUALITY_LAB_TEST',
        closureRemarks: 'Chlorine and particulate levels restored to potable standard.',
        isException: false,
        exceptionReason: null,
        exceptionJustification: 'Internal supervisor clearance note #99',
        resolvedAt: '2026-10-12T01:00:00.000Z',
        resolvedBy: {
          userId: 'OFFICER-INTERNAL-ID',
          role: 'officer',
          departmentId: 'DEPT_WATER'
        },
        evidence: [
          'internal_network_share/lab_report_confidential.pdf',
          'uploads/water_clear_after.jpg'
        ],
        checklist: [
          { id: 'REQ_EVIDENCE', status: 'PASSED', points: 30 }
        ],
        warnings: [
          { code: 'INTERNAL_CHECKLIST_WARNING' }
        ]
      },
      statusHistory: [
        {
          timestamp: '2026-10-12T01:00:00.000Z',
          status: 'RESOLVED',
          actorType: 'OFFICER',
          remarks: 'Resolved satisfactorily',
          resolutionDetails: {
            score: 95,
            isException: false,
            exceptionReason: null,
            outcomeType: 'RESOLVED_SATISFACTORILY',
            verificationMethod: 'WATER_QUALITY_LAB_TEST',
            exceptionJustification: 'Sensitive internal note',
            resolvedBy: { userId: 'OFFICER-INTERNAL-ID' }
          }
        }
      ]
    };

    // 1. Check unit sanitization for citizen
    const sanitizedCitizen = complaintService.sanitizeForCitizen(internalComplaint);
    assert.equal(sanitizedCitizen.officerNotes, undefined, 'Must strip officerNotes');
    assert.equal(sanitizedCitizen.resolutionDetails.resolvedBy, undefined, 'Must strip resolvedBy');
    assert.equal(sanitizedCitizen.resolutionDetails.exceptionJustification, undefined, 'Must strip exceptionJustification');
    assert.equal(sanitizedCitizen.resolutionDetails.evidence, undefined, 'Must strip evidence');
    assert.equal(sanitizedCitizen.resolutionDetails.checklist, undefined, 'Must strip checklist');
    assert.equal(sanitizedCitizen.resolutionDetails.warnings, undefined, 'Must strip warnings');
    assert.equal(sanitizedCitizen.resolutionDetails.score, 95);
    assert.equal(sanitizedCitizen.resolutionDetails.valid, true);
    assert.equal(sanitizedCitizen.resolutionDetails.closureRemarks, 'Chlorine and particulate levels restored to potable standard.');
    assert.equal(sanitizedCitizen.statusHistory[0].resolutionDetails.exceptionJustification, undefined);
    assert.equal(sanitizedCitizen.statusHistory[0].resolutionDetails.resolvedBy, undefined);

    // 2. Check unit sanitization for public tracking
    const sanitizedTracking = complaintService.sanitizeForTracking(internalComplaint);
    assert.equal(sanitizedTracking.resolutionDetails.resolvedBy, undefined, 'Tracking projection must strip resolvedBy');
    assert.equal(sanitizedTracking.resolutionDetails.exceptionJustification, undefined, 'Tracking projection must strip exceptionJustification');
    assert.equal(sanitizedTracking.resolutionDetails.checklist, undefined, 'Tracking projection must strip checklist');
    assert.equal(sanitizedTracking.resolutionDetails.warnings, undefined, 'Tracking projection must strip warnings');
    assert.equal(sanitizedTracking.resolutionDetails.score, 95);

    // 3. Check live HTTP endpoint for authenticated citizen view
    const citizenHttpRes = await request(app)
      .get('/api/v1/complaints/CMP-2026-TEST-001')
      .set('Authorization', `Bearer ${citizenToken}`);

    assert.equal(citizenHttpRes.status, 200);
    assert.equal(citizenHttpRes.body.success, true);
    const citizenResDetails = citizenHttpRes.body.data.resolutionDetails;
    if (citizenResDetails) {
      assert.equal(citizenResDetails.resolvedBy, undefined, 'HTTP citizen view must not expose resolvedBy');
      assert.equal(citizenResDetails.exceptionJustification, undefined, 'HTTP citizen view must not expose exceptionJustification');
      assert.equal(citizenResDetails.evidence, undefined, 'HTTP citizen view must not expose evidence');
      assert.equal(citizenResDetails.checklist, undefined, 'HTTP citizen view must not expose checklist');
      assert.equal(citizenResDetails.warnings, undefined, 'HTTP citizen view must not expose warnings');
    }

    // 4. Check live HTTP endpoint for public tracking view
    const publicTrackRes = await request(app)
      .get('/api/v1/complaints/track/CS-2026-00001');

    assert.equal(publicTrackRes.status, 200);
    assert.equal(publicTrackRes.body.success, true);
    const trackingResDetails = publicTrackRes.body.data.resolutionDetails;
    if (trackingResDetails) {
      assert.equal(trackingResDetails.resolvedBy, undefined, 'Public tracking view must not expose resolvedBy');
      assert.equal(trackingResDetails.exceptionJustification, undefined, 'Public tracking view must not expose exceptionJustification');
      assert.equal(trackingResDetails.checklist, undefined, 'Public tracking view must not expose checklist');
      assert.equal(trackingResDetails.warnings, undefined, 'Public tracking view must not expose warnings');
    }
  });

  it('14. Fix 3: Persistence-failure consistency across complaint, audit, and MongoDB status history', async () => {
    // 1. Simulated primary complaint-write failure
    const originalUpdateStatus = complaintRepository.updateStatus;
    try {
      complaintRepository.updateStatus = async () => {
        throw new Error('Simulated repository disk write failure');
      };

      const failRes = await request(app)
        .patch('/api/v1/complaints/CMP-2026-TEST-006/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'RESOLVED',
          actionCompleted: true,
          outcomeType: RESOLUTION_OUTCOME_TYPES.REPAIR_COMPLETED,
          verificationMethod: VERIFICATION_METHODS.PHYSICAL_INSPECTION,
          closureRemarks: 'Replaced distribution transformer coil.',
          evidence: ['TRANSFORMER_REPAIR_AFTER_01.JPG']
        });

      assert.equal(failRes.status, 500, 'Primary write failure must return 500');

      // Verify no audit log was created for failed complaint resolution
      const auditData = JSON.parse(await fs.readFile(SANDBOX_AUDIT_FILE, 'utf-8'));
      const ghostAudit = (auditData.logs || []).find(
        l => l.complaintId === 'CMP-2026-TEST-006' && (l.action === 'RESOLVE_COMPLAINT' || l.action === 'RESOLVE_COMPLAINT_EXCEPTION')
      );
      assert.equal(ghostAudit, undefined, 'Must not persist resolution audit log when primary write fails');
    } finally {
      complaintRepository.updateStatus = originalUpdateStatus;
    }

    // 2. Simulated audit-write failure does not crash successful complaint resolution
    const originalAuditCreate = auditLogRepository.create;
    let auditWarningLogged = false;
    const origWarn = console.warn;
    console.warn = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('[Audit Log Failure] Failed to record resolution audit event')) {
        auditWarningLogged = true;
      }
      origWarn(...args);
    };

    try {
      auditLogRepository.create = async () => {
        throw new Error('Simulated audit service network timeout');
      };

      const auditFailRes = await request(app)
        .patch('/api/v1/complaints/CMP-2026-TEST-006/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'RESOLVED',
          actionCompleted: true,
          outcomeType: RESOLUTION_OUTCOME_TYPES.REPAIR_COMPLETED,
          verificationMethod: VERIFICATION_METHODS.PHYSICAL_INSPECTION,
          closureRemarks: 'Replaced distribution transformer coil and restored phase balance.',
          evidence: ['TRANSFORMER_REPAIR_AFTER_01.JPG']
        });

      assert.equal(auditFailRes.status, 200, 'Primary resolution must succeed even if audit log write fails');
      assert.equal(auditFailRes.body.data.status, 'RESOLVED');
      assert.ok(auditWarningLogged, 'Must log structured [Audit Log Failure] warning');
    } finally {
      auditLogRepository.create = originalAuditCreate;
      console.warn = origWarn;
    }

    // 3. Simulated Mongo secondary StatusHistoryModel failure
    const origFindOne = ComplaintModel.findOne;
    const origCreate = StatusHistoryModel.create;
    let mongoWarningLogged = false;
    console.warn = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('[Persistence Warning] Standalone StatusHistoryModel creation failed')) {
        mongoWarningLogged = true;
      }
      origWarn(...args);
    };

    try {
      ComplaintModel.findOne = () => ({
        id: 'CMP-MONGO-MOCK-01',
        referenceNumber: 'CS-2026-99999',
        status: 'IN_PROGRESS',
        statusHistory: [],
        save: async () => {},
        toObject: () => ({
          id: 'CMP-MONGO-MOCK-01',
          referenceNumber: 'CS-2026-99999',
          status: 'RESOLVED',
          statusHistory: []
        })
      });

      StatusHistoryModel.create = async () => {
        throw new Error('Simulated Mongo secondary write network timeout');
      };

      const mongoRepo = new MongoComplaintRepository();
      const updatedMongoDoc = await mongoRepo.updateStatus('CMP-MONGO-MOCK-01', {
        status: 'RESOLVED',
        remarks: 'Resolved under simulated mongo secondary failure',
        resolutionDetails: { valid: true, score: 100 }
      });

      assert.ok(updatedMongoDoc, 'Mongo repository updateStatus must succeed despite secondary failure');
      assert.equal(updatedMongoDoc.status, 'RESOLVED');
      assert.ok(mongoWarningLogged, 'Must log structured [Persistence Warning] warning');
    } finally {
      ComplaintModel.findOne = origFindOne;
      StatusHistoryModel.create = origCreate;
      console.warn = origWarn;
    }
  });

  it('15. Fix 4: Hardened evidence references and authenticated server-side RBAC validation', async () => {
    // 1. Evidence path traversal checks
    assert.equal(isSafeEvidenceReference('\\\\evil-share\\folder\\img.jpg'), false, 'Must reject UNC Windows paths');
    assert.equal(isSafeEvidenceReference('//evil-share/folder/img.jpg'), false, 'Must reject forward-slash UNC paths');
    assert.equal(isSafeEvidenceReference('uploads/%2e%2e/etc/passwd'), false, 'Must reject URL-encoded dot-dot traversal');
    assert.equal(isSafeEvidenceReference('uploads/%2E%2E/system.ini'), false, 'Must reject uppercase URL-encoded dot-dot traversal');
    assert.equal(isSafeEvidenceReference('../../etc/shadow'), false, 'Must reject standard relative traversal');
    assert.equal(isSafeEvidenceReference('C:\\Windows\\System32\\file.dll'), false, 'Must reject absolute drive paths');
    assert.equal(isSafeEvidenceReference('uploads/2026/10/repair_after.jpg'), true, 'Must accept safe relative upload path');
    assert.equal(isSafeEvidenceReference('pothole_fixed.png'), true, 'Must accept safe basename filename');

    // 2. Server-side RBAC: officer attempting to spoof admin role in request body
    const spoofRes = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-001/status')
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        isException: true,
        role: 'admin',
        resolvedBy: { role: 'admin' },
        exceptionReason: 'FORCE_MAJEURE_UNFEASIBLE',
        exceptionJustification: 'Officer attempting to spoof admin role via request payload'
      });

    assert.equal(spoofRes.status, 403, 'Must reject spoofed exception approval with HTTP 403');
    assert.equal(spoofRes.body.code, 'FORBIDDEN_EXCEPTION_APPROVAL');
  });

  const setComplaintStatusInFixture = async (complaintId, status) => {
    const data = JSON.parse(await fs.readFile(SANDBOX_COMPLAINTS_FILE, 'utf-8'));
    const c = (data.complaints || []).find(item => item.id === complaintId);
    if (c) {
      c.status = status;
      await fs.writeFile(SANDBOX_COMPLAINTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
  };

  it('16. Regression 1: Successful eligible incident cascade with valid, auditable resolution details', async () => {
    // 1. Create an eligible complaint under DEPT_WATER in IN_PROGRESS state
    const cmp = await complaintRepository.create({
      title: 'Water pressure drop across Block E',
      description: 'Severe water deficit across 15 residential units.',
      category: 'water',
      departmentId: 'DEPT_WATER',
      department: 'DEPT_WATER'
    });
    await setComplaintStatusInFixture(cmp.id, 'IN_PROGRESS');

    // 2. Water officer creates an incident for DEPT_WATER linking the complaint
    const incident = await incidentService.createIncident({
      title: 'Block E Main Pipeline Overhaul',
      description: 'Replacing aging galvanized iron mains with ductile iron pipes.',
      category: 'water',
      leadDepartment: 'DEPT_WATER',
      linkedComplaints: [cmp.id]
    }, { id: 'OFFICER-WATER', role: 'officer', departmentId: 'DEPT_WATER' });

    // 3. Resolve incident with propagateToComplaints: true and custom closure remarks
    const resolvedIncident = await incidentService.updateIncidentStatus(
      incident.id,
      {
        status: 'RESOLVED',
        resolutionSummary: 'Ductile iron mains commissioned and pressure calibrated to 2.5 bar.',
        propagateToComplaints: true,
        complaintResolutionRemarks: 'Resolved under Block E infrastructure rehabilitation project.'
      },
      { id: 'OFFICER-WATER', role: 'officer', departmentId: 'DEPT_WATER' }
    );

    assert.equal(resolvedIncident.status, 'RESOLVED');
    assert.ok(resolvedIncident.propagationReport);
    assert.equal(resolvedIncident.propagationReport.attempted, 1);
    assert.equal(resolvedIncident.propagationReport.resolvedCount, 1);
    assert.equal(resolvedIncident.propagationReport.failedCount, 0);
    assert.equal(resolvedIncident.propagationReport.skippedCount, 0);
    assert.equal(resolvedIncident.propagationReport.requiresReconciliation, false);

    // 4. Verify child complaint transitioned to RESOLVED with valid, auditable resolutionDetails
    const child = await complaintRepository.findById(cmp.id);
    assert.equal(child.status, 'RESOLVED');
    assert.ok(child.resolutionDetails);
    assert.equal(child.resolutionDetails.valid, true);
    assert.equal(child.resolutionDetails.score, 100);
    assert.equal(child.resolutionDetails.isException, true);
    assert.equal(child.resolutionDetails.exceptionReason, RESOLUTION_EXCEPTION_REASONS.DUPLICATE_REFERRED.code);
    assert.equal(child.resolutionDetails.verificationMethod, VERIFICATION_METHODS.SUPERVISORY_AUDIT);
    assert.ok(child.resolutionDetails.exceptionJustification.includes(incident.id));

    // 5. Verify audit log entry
    const auditLogs = await auditLogRepository.findAll();
    const audit = auditLogs.find(l => l.action === 'COMPLAINT_STATUS_UPDATED' && l.targetResource === cmp.id);
    assert.ok(audit);
    assert.equal(audit.details.parentIncidentId, incident.id);
    assert.equal(audit.details.propagatedFromIncident, true);
  });

  it('17. Regression 2: Unrelated or ineligible linked complaints remaining unresolved', async () => {
    // 1. Complaint in SUBMITTED state (cannot legally transition directly to RESOLVED)
    const submittedCmp = await complaintRepository.create({
      title: 'Pothole on 5th Avenue',
      category: 'roads',
      departmentId: 'DEPT_ROADS'
    });

    // 2. Complaint already in RESOLVED state
    const alreadyResolvedCmp = await complaintRepository.create({
      title: 'Street light bulb replacement',
      category: 'electricity',
      departmentId: 'DEPT_POWER'
    });
    await setComplaintStatusInFixture(alreadyResolvedCmp.id, 'RESOLVED');

    // 3. Complaint assigned to a DIFFERENT parent incident
    const differentIncidentCmp = await complaintRepository.create({
      title: 'Water pipe leak on Market Street',
      category: 'water',
      departmentId: 'DEPT_WATER'
    });
    await setComplaintStatusInFixture(differentIncidentCmp.id, 'IN_PROGRESS');
    // Link to an external parent incident in fixture
    const allData = JSON.parse(await fs.readFile(SANDBOX_COMPLAINTS_FILE, 'utf-8'));
    const targetDoc = allData.complaints.find(c => c.id === differentIncidentCmp.id);
    if (targetDoc) targetDoc.incidentId = 'INC-OTHER-EXTERNAL-999';
    await fs.writeFile(SANDBOX_COMPLAINTS_FILE, JSON.stringify(allData, null, 2), 'utf-8');

    // 4. Create parent incident linking submitted complaint
    const incident = await incidentService.createIncident({
      title: 'Combined Infrastructure Sweep',
      category: 'roads',
      leadDepartment: 'DEPT_ROADS',
      linkedComplaints: [submittedCmp.id]
    }, { id: 'admin-1', role: 'admin' });

    // Manually add the other two to incident linkedComplaints in repo to test resilient handling of desynced links
    const incData = JSON.parse(await fs.readFile(SANDBOX_INCIDENTS_FILE, 'utf-8'));
    const targetInc = incData.incidents.find(i => i.id === incident.id);
    if (targetInc) {
      targetInc.linkedComplaints.push(alreadyResolvedCmp.id, differentIncidentCmp.id);
      await fs.writeFile(SANDBOX_INCIDENTS_FILE, JSON.stringify(incData, null, 2), 'utf-8');
    }

    // 5. Resolve incident with propagation enabled
    const resolvedIncident = await incidentService.updateIncidentStatus(
      incident.id,
      {
        status: 'RESOLVED',
        resolutionSummary: 'Completed routine sweeps across surveyed area.',
        propagateToComplaints: true
      },
      { id: 'admin-1', role: 'admin' }
    );

    const report = resolvedIncident.propagationReport;
    assert.ok(report);
    assert.equal(report.attempted, 3);
    assert.equal(report.resolvedCount, 0);
    assert.equal(report.skippedCount, 3);
    assert.equal(report.failedCount, 0);

    // Verify individual skipped reasons
    const skippedSubmitted = report.skippedComplaints.find(s => s.complaintId === submittedCmp.id);
    assert.ok(skippedSubmitted);
    assert.equal(skippedSubmitted.currentStatus, 'SUBMITTED');
    assert.ok(skippedSubmitted.reason.includes('Invalid status transition'));

    const skippedResolved = report.skippedComplaints.find(s => s.complaintId === alreadyResolvedCmp.id);
    assert.ok(skippedResolved);
    assert.equal(skippedResolved.currentStatus, 'RESOLVED');
    assert.equal(skippedResolved.reason, 'Complaint is already in RESOLVED status');

    const skippedOtherInc = report.skippedComplaints.find(s => s.complaintId === differentIncidentCmp.id);
    assert.ok(skippedOtherInc);
    assert.ok(skippedOtherInc.reason.includes("assigned to a different parent incident 'INC-OTHER-EXTERNAL-999'"));

    // Verify all 3 complaints remain untouched in repository
    const afterSub = await complaintRepository.findById(submittedCmp.id);
    assert.equal(afterSub.status, 'SUBMITTED');

    const afterRes = await complaintRepository.findById(alreadyResolvedCmp.id);
    assert.equal(afterRes.status, 'RESOLVED');

    const afterOther = await complaintRepository.findById(differentIncidentCmp.id);
    assert.equal(afterOther.status, 'IN_PROGRESS');
    assert.equal(afterOther.incidentId, 'INC-OTHER-EXTERNAL-999');
  });

  it('18. Regression 3: Unauthorized officers being unable to use cascade authorization outside their own eligible incident', async () => {
    // 1. Roads officer attempts DUPLICATE_REFERRED exception on water complaint (department mismatch)
    const roadsOnWaterRes = await request(app)
      .patch('/api/v1/complaints/CMP-2026-TEST-002/status')
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        isException: true,
        exceptionReason: 'DUPLICATE_REFERRED',
        exceptionJustification: 'Roads officer attempting duplicate referred exception on water complaint'
      });
    assert.equal(roadsOnWaterRes.status, 403);

    // 2. Create a complaint in DEPT_ROADS
    const roadsCmp = await complaintRepository.create({
      title: 'Pothole outside bus terminal',
      category: 'roads',
      departmentId: 'DEPT_ROADS'
    });
    await setComplaintStatusInFixture(roadsCmp.id, 'IN_PROGRESS');

    // Roads officer attempts DUPLICATE_REFERRED on unlinked complaint (no incident linkage)
    const unlinkedRes = await request(app)
      .patch(`/api/v1/complaints/${roadsCmp.id}/status`)
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        isException: true,
        exceptionReason: 'DUPLICATE_REFERRED',
        exceptionJustification: 'Officer claiming duplicate referred without parent incident linkage'
      });
    assert.equal(unlinkedRes.status, 403);
    assert.equal(unlinkedRes.body.code, 'FORBIDDEN_EXCEPTION_APPROVAL');

    // 3. Roads officer attempts non-DUPLICATE_REFERRED exception (e.g. FORCE_MAJEURE_UNFEASIBLE)
    const nonCascadeRes = await request(app)
      .patch(`/api/v1/complaints/${roadsCmp.id}/status`)
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        isException: true,
        exceptionReason: 'FORCE_MAJEURE_UNFEASIBLE',
        exceptionJustification: 'Roads officer attempting force majeure exception override'
      });
    assert.equal(nonCascadeRes.status, 403);
    assert.equal(nonCascadeRes.body.code, 'FORBIDDEN_EXCEPTION_APPROVAL');
  });

  it('19. Regression 4: Admin exception behavior remaining unchanged', async () => {
    // 1. Create complaint in IN_PROGRESS status
    const adminCmp1 = await complaintRepository.create({
      title: 'Encroachment dispute on public walkway',
      category: 'roads',
      departmentId: 'DEPT_ROADS'
    });
    await setComplaintStatusInFixture(adminCmp1.id, 'IN_PROGRESS');

    // Admin approves CIVIL_DISPUTE_SUB_JUDICE exception
    const res1 = await request(app)
      .patch(`/api/v1/complaints/${adminCmp1.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        isException: true,
        exceptionReason: 'CIVIL_DISPUTE_SUB_JUDICE',
        exceptionJustification: 'High Court status quo order prevents municipal demolition until Q4 hearing.'
      });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.status, 'RESOLVED');
    assert.equal(res1.body.data.resolutionDetails.isException, true);
    assert.equal(res1.body.data.resolutionDetails.exceptionReason, 'CIVIL_DISPUTE_SUB_JUDICE');
    assert.equal(res1.body.data.resolutionDetails.score, 100);

    // 2. Admin approves standalone DUPLICATE_REFERRED exception
    const adminCmp2 = await complaintRepository.create({
      title: 'Duplicate drainage blockage report',
      category: 'water',
      departmentId: 'DEPT_WATER'
    });
    await setComplaintStatusInFixture(adminCmp2.id, 'IN_PROGRESS');

    const res2 = await request(app)
      .patch(`/api/v1/complaints/${adminCmp2.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        isException: true,
        exceptionReason: 'DUPLICATE_REFERRED',
        exceptionJustification: 'Merged into primary municipal grievance CS-2026-00002 for joint resolution.'
      });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.status, 'RESOLVED');
    assert.equal(res2.body.data.resolutionDetails.exceptionReason, 'DUPLICATE_REFERRED');

    // Verify audit log has RESOLVE_COMPLAINT_EXCEPTION
    const auditLogs = await auditLogRepository.findAll();
    const adminAudit = auditLogs.find(l => l.action === 'RESOLVE_COMPLAINT_EXCEPTION' && l.complaintId === adminCmp2.id);
    assert.ok(adminAudit);
    assert.equal(adminAudit.role, 'admin');
  });

  it('20. Regression 5: Forged valid: true or score values not bypassing validation', async () => {
    const forgeCmp = await complaintRepository.create({
      title: 'Testing validation tamper resistance',
      category: 'roads',
      departmentId: 'DEPT_ROADS'
    });
    await setComplaintStatusInFixture(forgeCmp.id, 'IN_PROGRESS');

    // 1. Caller attempts forged valid: true and score: 100 at root and inside resolutionDetails
    const res = await request(app)
      .patch(`/api/v1/complaints/${forgeCmp.id}/status`)
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        valid: true,
        score: 100,
        resolutionDetails: {
          valid: true,
          score: 100,
          checklist: [{ id: 'ALL', status: 'PASSED' }]
        }
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'RESOLUTION_QUALITY_FAILED');
    assert.equal(res.body.valid, false, 'Authoritative validator must override forged valid: true');

    // 2. Direct service invocation with forged valid: true is also rejected
    await assert.rejects(
      async () => {
        await complaintService.updateComplaintStatus(forgeCmp.id, {
          status: 'RESOLVED',
          valid: true,
          score: 100,
          resolutionDetails: { valid: true, score: 100 }
        });
      },
      (err) => {
        assert.equal(err.code, 'RESOLUTION_QUALITY_FAILED');
        assert.equal(err.valid, false);
        return true;
      }
    );
  });

  it('21. Regression 6: Both operational remarks and closure remarks being preserved', async () => {
    // 1. Case A: Distinct operational remarks and closure remarks
    const remarksCmpA = await complaintRepository.create({
      title: 'Culvert blockage on bypass road',
      category: 'roads',
      departmentId: 'DEPT_ROADS'
    });
    await setComplaintStatusInFixture(remarksCmpA.id, 'IN_PROGRESS');

    const resA = await request(app)
      .patch(`/api/v1/complaints/${remarksCmpA.id}/status`)
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        remarks: 'Operational field crew cleared debris from culvert.',
        actionCompleted: true,
        outcomeType: RESOLUTION_OUTCOME_TYPES.REPAIR_COMPLETED,
        verificationMethod: VERIFICATION_METHODS.PHYSICAL_INSPECTION,
        closureRemarks: 'Culvert fully cleared, structural flow rate tested, and drain grates re-secured.',
        evidence: ['CULVERT_CLEAR_AFTER_01.JPG']
      });

    assert.equal(resA.status, 200);
    const updatedA = await complaintRepository.findById(remarksCmpA.id);
    const historyEntryA = updatedA.statusHistory[updatedA.statusHistory.length - 1];
    assert.ok(historyEntryA.remarks.includes('Operational field crew cleared debris from culvert.'));
    assert.ok(historyEntryA.remarks.includes('Culvert fully cleared, structural flow rate tested, and drain grates re-secured.'));
    assert.equal(historyEntryA.remarks, 'Operational field crew cleared debris from culvert. — Culvert fully cleared, structural flow rate tested, and drain grates re-secured.');
    assert.equal(updatedA.resolutionDetails.closureRemarks, 'Culvert fully cleared, structural flow rate tested, and drain grates re-secured.');

    // 2. Case B: Identical operational remarks and closure remarks (must NOT duplicate text)
    const remarksCmpB = await complaintRepository.create({
      title: 'Pothole repair at junction 12',
      category: 'roads',
      departmentId: 'DEPT_ROADS'
    });
    await setComplaintStatusInFixture(remarksCmpB.id, 'IN_PROGRESS');

    const identicalText = 'Pothole excavated and asphalt resurfacing completed on site.';
    const resB = await request(app)
      .patch(`/api/v1/complaints/${remarksCmpB.id}/status`)
      .set('Authorization', `Bearer ${roadsOfficerToken}`)
      .send({
        status: 'RESOLVED',
        remarks: identicalText,
        actionCompleted: true,
        outcomeType: RESOLUTION_OUTCOME_TYPES.REPAIR_COMPLETED,
        verificationMethod: VERIFICATION_METHODS.PHYSICAL_INSPECTION,
        closureRemarks: identicalText,
        evidence: ['POTHOLE_J12_AFTER_01.JPG']
      });

    assert.equal(resB.status, 200);
    const updatedB = await complaintRepository.findById(remarksCmpB.id);
    const historyEntryB = updatedB.statusHistory[updatedB.statusHistory.length - 1];
    assert.equal(historyEntryB.remarks, identicalText, 'Identical remarks must not produce duplicated or joined text');
  });

  it('22. Regression 7: One child update failing while the propagation report correctly indicates partial success and reconciliation needs', async () => {
    // 1. Create two eligible complaints in IN_PROGRESS state
    const child1 = await complaintRepository.create({
      title: 'Water valve leak unit 1',
      category: 'water',
      departmentId: 'DEPT_WATER'
    });
    await setComplaintStatusInFixture(child1.id, 'IN_PROGRESS');

    const child2 = await complaintRepository.create({
      title: 'Water valve leak unit 2',
      category: 'water',
      departmentId: 'DEPT_WATER'
    });
    await setComplaintStatusInFixture(child2.id, 'IN_PROGRESS');

    // 2. Create parent incident linking both
    const incident = await incidentService.createIncident({
      title: 'Sector Water Pressure Overhaul',
      category: 'water',
      leadDepartment: 'DEPT_WATER',
      linkedComplaints: [child1.id, child2.id]
    }, { id: 'OFFICER-WATER', role: 'officer', departmentId: 'DEPT_WATER' });

    // 3. Mock incidentService.complaintService.updateComplaintStatus to succeed for child1 and fail for child2
    const originalUpdate = incidentService.complaintService.updateComplaintStatus.bind(incidentService.complaintService);
    incidentService.complaintService.updateComplaintStatus = async (idOrRef, ...args) => {
      if (idOrRef === child2.id) {
        throw new Error('Secondary storage disk write failure on child 2');
      }
      return originalUpdate(idOrRef, ...args);
    };

    try {
      const resolved = await incidentService.updateIncidentStatus(
        incident.id,
        {
          status: 'RESOLVED',
          resolutionSummary: 'Emergency sector pressure regulators installed.',
          propagateToComplaints: true
        },
        { id: 'OFFICER-WATER', role: 'officer', departmentId: 'DEPT_WATER' }
      );

      const report = resolved.propagationReport;
      assert.ok(report);
      assert.equal(report.attempted, 2);
      assert.equal(report.resolvedCount, 1);
      assert.equal(report.failedCount, 1);
      assert.equal(report.skippedCount, 0);
      assert.equal(report.partialSuccess, true, 'partialSuccess must be true when at least one child resolves and at least one fails');
      assert.equal(report.requiresReconciliation, true, 'requiresReconciliation must be true when any child update fails');
      assert.equal(report.resolvedComplaints[0].complaintId, child1.id);
      assert.equal(report.failedComplaints[0].complaintId, child2.id);
      assert.ok(report.consistencyNote.includes('reconciliation is required'));

      // Verify child1 is RESOLVED and child2 remains IN_PROGRESS
      const afterChild1 = await complaintRepository.findById(child1.id);
      assert.equal(afterChild1.status, 'RESOLVED');

      const afterChild2 = await complaintRepository.findById(child2.id);
      assert.equal(afterChild2.status, 'IN_PROGRESS');
    } finally {
      incidentService.complaintService.updateComplaintStatus = originalUpdate;
    }
  });

  it('23. Regression 8: Citizen tracking continuing to expose only sanitized resolution information', async () => {
    // 1. Create a resolved complaint with internal officer notes, sensitive staff IDs, internal evidence and justification
    const internalComplaint = await complaintRepository.create({
      title: 'Severe toxic spill near water catchment',
      description: 'Chemical residue reported by resident.',
      category: 'water',
      departmentId: 'DEPT_WATER'
    });
    await setComplaintStatusInFixture(internalComplaint.id, 'IN_PROGRESS');

    await complaintRepository.updateStatus(internalComplaint.id, {
      status: 'RESOLVED',
      remarks: 'Incident resolved under chemical containment protocol',
      resolutionDetails: {
        score: 95,
        scoreExplanation: 'Containment verified by certified inspector',
        valid: true,
        outcomeType: 'RESOLVED_SATISFACTORILY',
        actionCompleted: true,
        verificationMethod: 'WATER_QUALITY_LAB_TEST',
        closureRemarks: 'Containment booms deployed, neutralizer applied, and water quality certified safe.',
        isException: true,
        exceptionReason: 'DUPLICATE_REFERRED',
        exceptionJustification: 'Sensitive internal supervisor authorization memorandum #98124',
        evidence: ['secret_internal_server/toxic_report_classified.pdf'],
        checklist: [{ id: 'REQ_ACTION_OR_OUTCOME', status: 'PASSED', points: 30 }],
        warnings: [{ code: 'INTERNAL_INVESTIGATION_PENDING' }],
        resolvedBy: {
          userId: 'INTERNAL-SECRET-OFFICER-77',
          role: 'officer',
          departmentId: 'DEPT_WATER'
        }
      }
    });

    await complaintRepository.addOfficerNote(internalComplaint.id, {
      note: 'Confidential inquiry ongoing regarding chemical source facility',
      officerId: 'INTERNAL-SECRET-OFFICER-77'
    });

    // 2. Query through service method getComplaintForTracking
    const serviceTracking = await complaintService.getComplaintForTracking(internalComplaint.id);
    assert.ok(serviceTracking);
    assert.equal(serviceTracking.status, 'RESOLVED');
    assert.equal(serviceTracking.officerNotes, undefined, 'Must strip officerNotes');
    assert.equal(serviceTracking.resolutionDetails.resolvedBy, undefined, 'Must strip resolvedBy');
    assert.equal(serviceTracking.resolutionDetails.exceptionJustification, undefined, 'Must strip exceptionJustification');
    assert.equal(serviceTracking.resolutionDetails.evidence, undefined, 'Must strip evidence');
    assert.equal(serviceTracking.resolutionDetails.checklist, undefined, 'Must strip checklist');
    assert.equal(serviceTracking.resolutionDetails.warnings, undefined, 'Must strip warnings');
    assert.equal(serviceTracking.resolutionDetails.closureRemarks, 'Containment booms deployed, neutralizer applied, and water quality certified safe.');
    assert.equal(serviceTracking.resolutionDetails.score, 95);

    // 3. Query through public tracking HTTP endpoint
    const httpTracking = await request(app)
      .get(`/api/v1/complaints/track/${internalComplaint.referenceNumber}`);

    assert.equal(httpTracking.status, 200);
    assert.equal(httpTracking.body.success, true);
    const trackingData = httpTracking.body.data;
    assert.equal(trackingData.status, 'RESOLVED');
    assert.equal(trackingData.officerNotes, undefined);
    assert.ok(trackingData.resolutionDetails);
    assert.equal(trackingData.resolutionDetails.resolvedBy, undefined);
    assert.equal(trackingData.resolutionDetails.exceptionJustification, undefined);
    assert.equal(trackingData.resolutionDetails.evidence, undefined);
    assert.equal(trackingData.resolutionDetails.checklist, undefined);
    assert.equal(trackingData.resolutionDetails.warnings, undefined);
    assert.equal(trackingData.resolutionDetails.closureRemarks, 'Containment booms deployed, neutralizer applied, and water quality certified safe.');
  });
});
