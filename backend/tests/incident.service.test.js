/**
 * @file incident.service.test.js
 * @description Hardened Service Layer Tests for Phase 7 Step 2A.1 (Security & Consistency Hardening).
 *
 * SAFETY & INTEGRITY GUARANTEES:
 * - Operates entirely on dedicated temporary fixture files in a sandbox directory.
 * - Cleans up fixtures and verifies byte-level immutability of the five protected files:
 *   data/incidents.json, data/subtasks.json, data/complaints.json, data/users.json, data/audit_logs.json.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../src/config/app.config.js';
import {
  INCIDENT_STATUS,
  SUBTASK_STATUS,
  INCIDENT_PRIORITY
} from '../src/constants/incident.constants.js';
import { IncidentService } from '../src/services/incident.service.js';
import { JsonIncidentRepository } from '../src/repositories/incident.json.repository.js';
import { JsonSubtaskRepository } from '../src/repositories/subtask.json.repository.js';
import { JsonComplaintRepository } from '../src/repositories/complaint.json.repository.js';
import { JsonAuditLogRepository } from '../src/repositories/auditLog.repository.js';
import { JsonDepartmentRepository } from '../src/repositories/department.json.repository.js';
import { mongoIncidentRepository } from '../src/repositories/incident.mongo.repository.js';
import { mongoSubtaskRepository } from '../src/repositories/subtask.mongo.repository.js';
import { ComplaintModel } from '../src/models/complaint.model.js';
import { StatusHistoryModel } from '../src/models/statusHistory.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dedicated isolated Phase 7 service test fixture paths
const FIXTURE_DIR = path.resolve(__dirname, 'sandbox-service-test');
const TEST_INCIDENTS_PATH = path.join(FIXTURE_DIR, 'incidents.phase7-service-test.json');
const TEST_SUBTASKS_PATH = path.join(FIXTURE_DIR, 'subtasks.phase7-service-test.json');
const TEST_COMPLAINTS_PATH = path.join(FIXTURE_DIR, 'complaints.phase7-service-test.json');
const TEST_AUDIT_LOGS_PATH = path.join(FIXTURE_DIR, 'audit_logs.phase7-service-test.json');
const TEST_DEPARTMENTS_PATH = path.join(FIXTURE_DIR, 'departments.phase7-service-test.json');

describe('CivicSarthi Phase 7 Step 2A.1: Incident & Subtask Security & Consistency Hardening', () => {
  let initialProtectedFiles = {};
  let testIncidentRepo;
  let testSubtaskRepo;
  let testComplaintRepo;
  let testAuditRepo;
  let testDepartmentRepo;
  let service;

  // Test Actors
  const adminActor = {
    id: 'ADMIN-001',
    role: 'admin',
    email: 'admin@civicsarthi.internal',
    departmentId: null
  };

  const waterOfficer = {
    id: 'OFFICER-WATER',
    role: 'officer',
    email: 'water.officer@pune.gov.in',
    departmentId: 'DEPT_WATER'
  };

  const roadsOfficer = {
    id: 'OFFICER-ROADS',
    role: 'officer',
    email: 'roads.officer@pune.gov.in',
    departmentId: 'DEPT_ROADS'
  };

  const powerOfficer = {
    id: 'OFFICER-POWER',
    role: 'officer',
    email: 'power.officer@pune.gov.in',
    departmentId: 'DEPT_POWER'
  };

  const citizenActor = {
    id: 'CITIZEN-001',
    role: 'citizen',
    email: 'citizen@example.com'
  };

  const protectedFiles = [
    { name: 'incidents', path: config.dataPath.incidents },
    { name: 'subtasks', path: config.dataPath.subtasks },
    { name: 'complaints', path: config.dataPath.complaints },
    { name: 'users', path: config.dataPath.users },
    { name: 'auditLogs', path: config.dataPath.auditLogs }
  ];

  before(async () => {
    // 1. Snapshot all 5 protected runtime files for immutability verification
    for (const f of protectedFiles) {
      try {
        initialProtectedFiles[f.name] = await fs.readFile(f.path, 'utf-8');
      } catch (err) {
        initialProtectedFiles[f.name] = null;
      }
    }

    // 2. Create sandbox fixture directory
    await fs.mkdir(FIXTURE_DIR, { recursive: true });

    // 3. Initialize test fixtures
    testIncidentRepo = new JsonIncidentRepository(TEST_INCIDENTS_PATH);
    testSubtaskRepo = new JsonSubtaskRepository(TEST_SUBTASKS_PATH);
    testComplaintRepo = new JsonComplaintRepository(TEST_COMPLAINTS_PATH);
    testAuditRepo = new JsonAuditLogRepository(TEST_AUDIT_LOGS_PATH);
    testDepartmentRepo = new JsonDepartmentRepository(TEST_DEPARTMENTS_PATH);

    // 4. Instantiate service with injected test repositories
    service = new IncidentService(
      testIncidentRepo,
      testSubtaskRepo,
      testComplaintRepo,
      testAuditRepo,
      testDepartmentRepo
    );
  });

  beforeEach(async () => {
    // Reset test fixture contents before each test
    await fs.writeFile(
      TEST_INCIDENTS_PATH,
      JSON.stringify({ metadata: { test: true }, incidents: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      TEST_SUBTASKS_PATH,
      JSON.stringify({ metadata: { test: true }, subtasks: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      TEST_COMPLAINTS_PATH,
      JSON.stringify({
        metadata: { test: true },
        complaints: [
          {
            id: 'CMP-2026-0001',
            referenceNumber: 'CMP-2026-0001',
            title: 'Water main fracture on MG Road',
            description: 'Severe water pipe leakage flooding roadway on MG Road',
            category: 'water',
            departmentId: 'DEPT_WATER',
            status: 'IN_PROGRESS',
            incidentId: null,
            statusHistory: []
          },
          {
            id: 'CMP-2026-0002',
            referenceNumber: 'CMP-2026-0002',
            title: 'Flooding in basement shops on MG Road',
            description: 'Commercial shop basement submerged by overflow',
            category: 'drainage',
            departmentId: 'DEPT_ROADS',
            status: 'IN_PROGRESS',
            incidentId: null,
            statusHistory: []
          },
          {
            id: 'CMP-2026-0003',
            referenceNumber: 'CMP-2026-0003',
            title: 'Exposed live power wire near flood area',
            description: 'Hazardous exposed electrical cable near flooded sidewalk',
            category: 'electricity',
            departmentId: 'DEPT_POWER',
            status: 'IN_PROGRESS',
            incidentId: null,
            statusHistory: []
          }
        ]
      }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      TEST_AUDIT_LOGS_PATH,
      JSON.stringify({ metadata: { test: true }, logs: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      TEST_DEPARTMENTS_PATH,
      JSON.stringify({
        metadata: { test: true },
        departments: [
          { id: 'DEPT_WATER', code: 'JAL_BOARD', name: 'Water Supply Department' },
          { id: 'DEPT_ROADS', code: 'PWD', name: 'Roads Department' },
          { id: 'DEPT_POWER', code: 'DISCOM', name: 'Electricity Department' },
          { id: 'DEPT_MUNICIPAL', code: 'MC', name: 'Municipal Corporation' },
          { id: 'DEPT_DISASTER', code: 'DDMA', name: 'Disaster Management' }
        ]
      }, null, 2),
      'utf-8'
    );
  });

  after(async () => {
    // Clean up temporary fixtures
    try {
      await fs.rm(FIXTURE_DIR, { recursive: true, force: true });
    } catch {}

    // Verify byte-level immutability of all 5 protected runtime files
    for (const f of protectedFiles) {
      if (initialProtectedFiles[f.name] !== null) {
        const currentContent = await fs.readFile(f.path, 'utf-8');
        assert.strictEqual(
          currentContent,
          initialProtectedFiles[f.name],
          `CRITICAL SAFETY VIOLATION: Protected file ${f.path} was modified during tests!`
        );
      }
    }
  });

  // =========================================================================
  // 1. Role Authorization & Privilege Enforcement (Requirement 1)
  // =========================================================================

  describe('1. Role Authorization: Citizen & Unauthenticated Mutation Blocking', () => {
    it('rejects unauthenticated (missing actor) mutation attempts with 401', async () => {
      await assert.rejects(
        () => service.createIncident({
          title: 'Major Water Burst',
          category: 'water',
          leadDepartment: 'DEPT_WATER'
        }, null),
        err => err.status === 401 && err.code === 'UNAUTHORIZED'
      );
    });

    it('rejects citizen actors attempting createIncident with 403 Forbidden', async () => {
      await assert.rejects(
        () => service.createIncident({
          title: 'Citizen Escalated Incident',
          category: 'water',
          leadDepartment: 'DEPT_WATER'
        }, citizenActor),
        err => err.status === 403 && err.code === 'FORBIDDEN'
      );
    });

    it('rejects citizen actors attempting updateIncidentStatus with 403 Forbidden', async () => {
      const incident = await service.createIncident({
        title: 'Road Collapse',
        category: 'roads',
        leadDepartment: 'DEPT_ROADS'
      }, roadsOfficer);

      await assert.rejects(
        () => service.updateIncidentStatus(incident.id, { status: INCIDENT_STATUS.CLOSED }, citizenActor),
        err => err.status === 403 && err.code === 'FORBIDDEN'
      );
    });

    it('rejects citizen actors attempting createSubtask with 403 Forbidden', async () => {
      const incident = await service.createIncident({
        title: 'Water Leak Incident',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      await assert.rejects(
        () => service.createSubtask({
          incidentId: incident.id,
          title: 'Citizen subtask',
          department: 'DEPT_WATER'
        }, citizenActor),
        err => err.status === 403 && err.code === 'FORBIDDEN'
      );
    });

    it('rejects citizen actors attempting complaint linking/unlinking/transfers with 403 Forbidden', async () => {
      const incident = await service.createIncident({
        title: 'Water Leak Incident',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      await assert.rejects(
        () => service.linkComplaintToIncident(incident.id, 'CMP-2026-0001', citizenActor),
        err => err.status === 403 && err.code === 'FORBIDDEN'
      );

      await assert.rejects(
        () => service.unlinkComplaintFromIncident(incident.id, 'CMP-2026-0001', citizenActor),
        err => err.status === 403 && err.code === 'FORBIDDEN'
      );

      await assert.rejects(
        () => service.transferComplaintBetweenIncidents(incident.id, 'INC-2026-9999', 'CMP-2026-0001', citizenActor, 'Justification...'),
        err => err.status === 403 && err.code === 'FORBIDDEN'
      );
    });
  });

  // =========================================================================
  // 2. Department-Scoped Authorization (Requirement 2)
  // =========================================================================

  describe('2. Department-Scoped Authorization Rules', () => {
    it('prevents an officer from creating an incident led by another department', async () => {
      // Roads officer cannot create incident with leadDepartment: DEPT_WATER
      await assert.rejects(
        () => service.createIncident({
          title: 'Cross-Department Water Incident',
          category: 'water',
          leadDepartment: 'DEPT_WATER'
        }, roadsOfficer),
        err => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          assert.ok(err.message.includes("officer from department 'DEPT_ROADS' is not authorized"));
          return true;
        }
      );

      // Water officer CAN create incident with leadDepartment: DEPT_WATER
      const created = await service.createIncident({
        title: 'Legitimate Water Incident',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);
      assert.ok(created);
    });

    it('prevents an officer from modifying incident status led by another department', async () => {
      const incident = await service.createIncident({
        title: 'Water Main Rupture',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      // Roads officer cannot update status of Water incident
      await assert.rejects(
        () => service.updateIncidentStatus(incident.id, { status: INCIDENT_STATUS.CLOSED }, roadsOfficer),
        err => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          assert.ok(err.message.includes("officer from department 'DEPT_ROADS' is not authorized"));
          return true;
        }
      );

      // Water officer (lead dept) CAN update status
      const updated = await service.updateIncidentStatus(incident.id, { status: INCIDENT_STATUS.CLOSED }, waterOfficer);
      assert.strictEqual(updated.status, INCIDENT_STATUS.CLOSED);
    });

    it('permits subtask updates by assigned department, parent lead department, or admin; rejects unrelated officers', async () => {
      const incident = await service.createIncident({
        title: 'Multi-Department Spill',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      // Water officer (lead dept) creates subtask assigned to DEPT_ROADS
      const subtask = await service.createSubtask({
        incidentId: incident.id,
        title: 'Road Barricades',
        department: 'DEPT_ROADS'
      }, waterOfficer);

      // Power officer (unrelated to both Water and Roads) CANNOT update subtask
      await assert.rejects(
        () => service.updateSubtaskStatus(subtask.id, { status: SUBTASK_STATUS.IN_PROGRESS }, powerOfficer),
        err => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          assert.ok(err.message.includes("officer from department 'DEPT_POWER' is not authorized"));
          return true;
        }
      );

      // Roads officer (assigned dept) CAN update subtask
      const inProgress = await service.updateSubtaskStatus(subtask.id, { status: SUBTASK_STATUS.IN_PROGRESS }, roadsOfficer);
      assert.strictEqual(inProgress.status, SUBTASK_STATUS.IN_PROGRESS);

      // Water officer (parent lead dept) CAN update subtask
      const completed = await service.updateSubtaskStatus(subtask.id, { status: SUBTASK_STATUS.COMPLETED }, waterOfficer);
      assert.strictEqual(completed.status, SUBTASK_STATUS.COMPLETED);
    });

    it('allows administrator to perform actions across any department', async () => {
      const incident = await service.createIncident({
        title: 'Universal Admin Incident',
        category: 'power',
        leadDepartment: 'DEPT_POWER'
      }, adminActor);

      assert.strictEqual(incident.leadDepartment, 'DEPT_POWER');

      const subtask = await service.createSubtask({
        incidentId: incident.id,
        title: 'Admin Created Subtask',
        department: 'DEPT_WATER'
      }, adminActor);

      const updated = await service.updateSubtaskStatus(subtask.id, { status: SUBTASK_STATUS.IN_PROGRESS }, adminActor);
      assert.strictEqual(updated.status, SUBTASK_STATUS.IN_PROGRESS);
    });
  });

  // =========================================================================
  // 3. Department Registry Validation (Requirement 5)
  // =========================================================================

  describe('3. Department Registry Validation against Authoritative Data', () => {
    it('rejects createIncident with a non-existent leadDepartment', async () => {
      await assert.rejects(
        () => service.createIncident({
          title: 'Fake Department Incident',
          category: 'unknown',
          leadDepartment: 'DEPT_NONEXISTENT_XYZ'
        }, adminActor),
        err => {
          assert.strictEqual(err.status, 400);
          assert.strictEqual(err.code, 'INVALID_DEPARTMENT');
          assert.ok(err.message.includes('does not exist in registry'));
          return true;
        }
      );
    });

    it('rejects createSubtask with a non-existent department', async () => {
      const incident = await service.createIncident({
        title: 'Valid Lead Department Incident',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      await assert.rejects(
        () => service.createSubtask({
          incidentId: incident.id,
          title: 'Fake Department Subtask',
          department: 'DEPT_MAGIC_UNICORN'
        }, adminActor),
        err => {
          assert.strictEqual(err.status, 400);
          assert.strictEqual(err.code, 'INVALID_DEPARTMENT');
          assert.ok(err.message.includes('does not exist in registry'));
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 4. Admin-Only Incomplete Subtask Resolution Override (Requirement 4)
  // =========================================================================

  describe('4. Incomplete-Subtask Resolution Override Security', () => {
    let incident;

    beforeEach(async () => {
      incident = await service.createIncident({
        title: 'Hazmat Containment',
        category: 'disaster',
        leadDepartment: 'DEPT_DISASTER'
      }, adminActor);

      await service.createSubtask({
        incidentId: incident.id,
        title: 'Perimeter Sandbagging',
        department: 'DEPT_DISASTER',
        status: SUBTASK_STATUS.PENDING
      }, adminActor);
    });

    it('rejects non-admin officers attempting resolution override with 403 Forbidden', async () => {
      const disasterOfficer = {
        id: 'OFFICER-DISASTER',
        role: 'officer',
        departmentId: 'DEPT_DISASTER',
        email: 'disaster@pune.gov.in'
      };

      await assert.rejects(
        () => service.updateIncidentStatus(incident.id, {
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Site deemed safe by lead officer',
          overrideIncompleteSubtasks: true,
          overrideJustification: 'Field inspection confirmed sandbags not critical'
        }, disasterOfficer),
        err => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          assert.ok(err.message.includes('only administrators are authorized'));
          return true;
        }
      );
    });

    it('allows administrator to authorize resolution override and records details in audit event', async () => {
      const resolved = await service.updateIncidentStatus(incident.id, {
        status: INCIDENT_STATUS.RESOLVED,
        resolutionSummary: 'Chemical spill fully neutralized and contained',
        overrideIncompleteSubtasks: true,
        overrideJustification: 'Emergency protocol: perimeter sandbags deemed non-blocking follow-up by commissioner'
      }, adminActor);

      assert.strictEqual(resolved.status, INCIDENT_STATUS.RESOLVED);
      assert.strictEqual(resolved.subtaskOverride.overridden, true);
      assert.strictEqual(resolved.subtaskOverride.authorizedRole, 'admin');

      // Verify audit event captured the override metadata
      const logs = await testAuditRepo.findAll();
      const statusLog = logs.find(l => l.action === 'INCIDENT_STATUS_UPDATED' && l.targetResource === incident.id);
      assert.ok(statusLog);
      assert.strictEqual(statusLog.details.override.overridden, true);
      assert.strictEqual(statusLog.details.override.incompleteCount, 1);
      assert.ok(statusLog.details.override.justification.includes('commissioner'));
    });
  });

  // =========================================================================
  // 5. Secure Complaint Transfers (Requirement 3)
  // =========================================================================

  describe('5. Secure Complaint Transfers and Authority Verification', () => {
    let waterInc;
    let roadsInc;
    let waterInc2;

    beforeEach(async () => {
      waterInc = await service.createIncident({
        title: 'Water Incident 1',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      waterInc2 = await service.createIncident({
        title: 'Water Incident 2',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      roadsInc = await service.createIncident({
        title: 'Roads Incident 1',
        category: 'roads',
        leadDepartment: 'DEPT_ROADS'
      }, roadsOfficer);

      await service.linkComplaintToIncident(waterInc.id, 'CMP-2026-0001', waterOfficer);
    });

    it('prevents single-department officer from transferring across different department leads', async () => {
      // Water officer tries to transfer complaint from waterInc (DEPT_WATER) to roadsInc (DEPT_ROADS)
      await assert.rejects(
        () => service.transferComplaintBetweenIncidents(
          waterInc.id,
          roadsInc.id,
          'CMP-2026-0001',
          waterOfficer,
          'Misclassified pipeline cave-in should belong to roads department'
        ),
        err => {
          assert.strictEqual(err.status, 403);
          assert.strictEqual(err.code, 'FORBIDDEN');
          assert.ok(err.message.includes('Cross-department transfers require administrator authorization'));
          return true;
        }
      );
    });

    it('allows officer to transfer complaints between two incidents led by their own department', async () => {
      const transfer = await service.transferComplaintBetweenIncidents(
        waterInc.id,
        waterInc2.id,
        'CMP-2026-0001',
        waterOfficer,
        'Complaint belongs to second water pipeline sector incident'
      );

      assert.strictEqual(transfer.success, true);
      const complaint = await testComplaintRepo.findById('CMP-2026-0001');
      assert.strictEqual(complaint.incidentId, waterInc2.id);
    });

    it('allows administrator to transfer complaints across different department leads', async () => {
      const transfer = await service.transferComplaintBetweenIncidents(
        waterInc.id,
        roadsInc.id,
        'CMP-2026-0001',
        adminActor,
        'Administrative transfer: cross-department root cause reassignment approved'
      );

      assert.strictEqual(transfer.success, true);
      const complaint = await testComplaintRepo.findById('CMP-2026-0001');
      assert.strictEqual(complaint.incidentId, roadsInc.id);

      const oldInc = await testIncidentRepo.findById(waterInc.id);
      assert.strictEqual(oldInc.linkedComplaints.includes('CMP-2026-0001'), false);

      const newInc = await testIncidentRepo.findById(roadsInc.id);
      assert.strictEqual(newInc.linkedComplaints.includes('CMP-2026-0001'), true);
    });
  });

  // =========================================================================
  // 6. Dual-Write Compensation Failure & Critical Error (Requirement 6)
  // =========================================================================

  describe('6. Dual-Write Compensation Failure Handling', () => {
    it('surfaces a structured critical consistency error and logs audit alert when compensation fails', async () => {
      const incident = await service.createIncident({
        title: 'Compensation Test Incident',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      // Mock complaint repo that fails on link, and incident repo that fails on compensation rollback
      const failingComplaintRepo = {
        findById: async (id) => testComplaintRepo.findById(id),
        linkIncident: async () => {
          throw new Error('Secondary storage write timeout');
        }
      };

      const failingIncidentRepo = {
        findById: async (id) => testIncidentRepo.findById(id),
        linkComplaint: async (incId, cId) => testIncidentRepo.linkComplaint(incId, cId),
        unlinkComplaint: async () => {
          throw new Error('Primary storage disk write lock failure during rollback');
        }
      };

      const failingService = new IncidentService(
        failingIncidentRepo,
        testSubtaskRepo,
        failingComplaintRepo,
        testAuditRepo,
        testDepartmentRepo
      );

      await assert.rejects(
        () => failingService.linkComplaintToIncident(incident.id, 'CMP-2026-0001', waterOfficer),
        err => {
          assert.strictEqual(err.status, 500);
          assert.strictEqual(err.code, 'CRITICAL_CONSISTENCY_FAILURE');
          assert.ok(err.details);
          assert.strictEqual(err.details.requiresReconciliation, true);
          assert.strictEqual(err.details.operation, 'LINK_COMPLAINT');
          assert.strictEqual(err.details.incidentId, incident.id);
          assert.strictEqual(err.details.complaintId, 'CMP-2026-0001');
          // Verify NO citizen PII is present in details
          assert.strictEqual(err.details.citizenName, undefined);
          assert.strictEqual(err.details.description, undefined);
          return true;
        }
      );

      // Verify CRITICAL_COMPENSATION_FAILURE was recorded in audit log
      const logs = await testAuditRepo.findAll();
      const critLog = logs.find(l => l.action === 'CRITICAL_COMPENSATION_FAILURE');
      assert.ok(critLog);
      assert.strictEqual(critLog.details.operation, 'LINK_COMPLAINT');
    });
  });

  // =========================================================================
  // 7. Explicit Audit Write Failure Handling (Requirement 7)
  // =========================================================================

  describe('7. Audit Write Failure Handling', () => {
    it('allows business mutations to complete safely while returning explicit audit failure status', async () => {
      // Mock audit repo that fails on create
      const failingAuditRepo = {
        create: async () => {
          throw new Error('Audit storage database offline');
        }
      };

      const resilientService = new IncidentService(
        testIncidentRepo,
        testSubtaskRepo,
        testComplaintRepo,
        failingAuditRepo,
        testDepartmentRepo
      );

      // Incident creation should NOT crash when audit logging fails
      const incident = await resilientService.createIncident({
        title: 'Emergency Flood Gate Failure',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      assert.ok(incident);
      assert.strictEqual(incident.title, 'Emergency Flood Gate Failure');

      // Test _logAudit directly reports failure without crashing
      const outcome = await resilientService._logAudit('TEST_ACTION', incident.id, {}, waterOfficer);
      assert.strictEqual(outcome.recorded, false);
      assert.ok(outcome.error.includes('Audit storage database offline'));
    });
  });

  // =========================================================================
  // 9. Phase 7 Step 2C: Safe Complaint Resolution Propagation & Tracking
  // =========================================================================

  describe('9. Phase 7 Step 2C: Safe Complaint Resolution Propagation & Tracking Integration', () => {
    const setComplaintStatusInFixture = async (complaintId, status) => {
      const data = JSON.parse(await fs.readFile(TEST_COMPLAINTS_PATH, 'utf-8'));
      const c = (data.complaints || []).find(item => item.id === complaintId);
      if (c) {
        c.status = status;
        await fs.writeFile(TEST_COMPLAINTS_PATH, JSON.stringify(data, null, 2), 'utf-8');
      }
    };

    it('defaults propagateToComplaints to false; resolving incident does not touch linked complaints without opt-in', async () => {
      // Create and link complaint
      const incident = await service.createIncident({
        title: 'Water pipe failure on Sinhagad Road',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0001', waterOfficer);

      // Verify complaint is linked and currently IN_PROGRESS
      const beforeComplaint = await testComplaintRepo.findById('CMP-2026-0001');
      assert.strictEqual(beforeComplaint.status, 'IN_PROGRESS');

      // Resolve incident WITHOUT propagateToComplaints (default false)
      const resolvedIncident = await service.updateIncidentStatus(
        incident.id,
        {
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Pipe fully replaced and tested.'
        },
        waterOfficer
      );

      assert.strictEqual(resolvedIncident.status, INCIDENT_STATUS.RESOLVED);
      assert.strictEqual(resolvedIncident.propagationReport, undefined);

      // Verify linked complaint status remains IN_PROGRESS
      const afterComplaint = await testComplaintRepo.findById('CMP-2026-0001');
      assert.strictEqual(afterComplaint.status, 'IN_PROGRESS');
    });

    it('safely propagates resolution to linked complaints in IN_PROGRESS status when opt-in is true', async () => {
      const incident = await service.createIncident({
        title: 'Water pressure drop across Kothrud',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0001', waterOfficer);

      // Resolve incident WITH propagateToComplaints: true
      const resolved = await service.updateIncidentStatus(
        incident.id,
        {
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Main feeder valve replaced successfully.',
          propagateToComplaints: true,
          complaintResolutionRemarks: 'Resolved as part of city valve overhaul.',
          resolutionData: {
            actionCompleted: true,
            outcomeType: 'SERVICE_RESTORED',
            verificationMethod: 'PHYSICAL_INSPECTION',
            closureRemarks: 'Main feeder valve replaced and pressure verified on site.',
            evidence: ['VALVE_OVERHAUL_REPORT_01.PDF']
          }
        },
        waterOfficer
      );

      assert.strictEqual(resolved.status, INCIDENT_STATUS.RESOLVED);
      assert.ok(resolved.propagationReport);
      assert.strictEqual(resolved.propagationReport.attempted, 1);
      assert.strictEqual(resolved.propagationReport.resolvedCount, 1);
      assert.strictEqual(resolved.propagationReport.skippedCount, 0);
      assert.strictEqual(resolved.propagationReport.failedCount, 0);
      assert.strictEqual(resolved.propagationReport.requiresReconciliation, false);
      assert.strictEqual(resolved.propagationReport.resolvedComplaints[0].complaintId, 'CMP-2026-0001');
      assert.strictEqual(resolved.propagationReport.resolvedComplaints[0].newStatus, 'RESOLVED');

      // Verify complaint is now RESOLVED in repo with status history
      const updatedComplaint = await testComplaintRepo.findById('CMP-2026-0001');
      assert.strictEqual(updatedComplaint.status, 'RESOLVED');
      const latestHistory = updatedComplaint.statusHistory[updatedComplaint.statusHistory.length - 1];
      assert.ok(latestHistory.remarks.includes('Resolved as part of city valve overhaul.'));
      assert.ok(latestHistory.remarks.includes('Main feeder valve replaced and pressure verified on site.'));
      assert.strictEqual(updatedComplaint.resolutionDetails.valid, true);
      assert.strictEqual(updatedComplaint.resolutionDetails.outcomeType, 'SERVICE_RESTORED');
      assert.strictEqual(updatedComplaint.resolutionDetails.verificationMethod, 'PHYSICAL_INSPECTION');
      assert.strictEqual(updatedComplaint.resolutionDetails.closureRemarks, 'Main feeder valve replaced and pressure verified on site.');

      // Verify audit trail logged with parent incident details
      const auditLogs = await testAuditRepo.findAll({ action: 'COMPLAINT_STATUS_UPDATED' });
      assert.ok(auditLogs.length > 0);
      const audit = auditLogs.find(l => l.targetResource === 'CMP-2026-0001');
      assert.ok(audit);
      assert.strictEqual(audit.details.parentIncidentId, incident.id);
      assert.strictEqual(audit.details.propagatedFromIncident, true);
      assert.strictEqual(audit.details.newStatus, 'RESOLVED');
      assert.strictEqual(audit.userId, waterOfficer.id);
    });

    it('skips complaints whose current status cannot legally transition to RESOLVED and returns diagnostic details', async () => {
      // Prepare complaint in SUBMITTED status (cannot transition directly to RESOLVED)
      await setComplaintStatusInFixture('CMP-2026-0002', 'SUBMITTED');

      const incident = await service.createIncident({
        title: 'Road subsidence on FC Road',
        category: 'roads',
        leadDepartment: 'DEPT_ROADS'
      }, roadsOfficer);

      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0002', roadsOfficer);

      const resolved = await service.updateIncidentStatus(
        incident.id,
        {
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Road re-asphalted and inspected.',
          propagateToComplaints: true
        },
        roadsOfficer
      );

      assert.ok(resolved.propagationReport);
      assert.strictEqual(resolved.propagationReport.attempted, 1);
      assert.strictEqual(resolved.propagationReport.resolvedCount, 0);
      assert.strictEqual(resolved.propagationReport.skippedCount, 1);
      assert.strictEqual(resolved.propagationReport.failedCount, 0);
      assert.strictEqual(resolved.propagationReport.requiresReconciliation, false);

      const skipped = resolved.propagationReport.skippedComplaints[0];
      assert.strictEqual(skipped.complaintId, 'CMP-2026-0002');
      assert.strictEqual(skipped.currentStatus, 'SUBMITTED');
      assert.ok(skipped.reason.includes("Invalid status transition from 'SUBMITTED' to 'RESOLVED'"));

      // Verify complaint in repository was NOT illegally updated
      const complaintInDb = await testComplaintRepo.findById('CMP-2026-0002');
      assert.strictEqual(complaintInDb.status, 'SUBMITTED');
    });

    it('skips complaints that are already in RESOLVED status', async () => {
      // Set complaint directly to RESOLVED
      await setComplaintStatusInFixture('CMP-2026-0001', 'RESOLVED');

      const incident = await service.createIncident({
        title: 'Already remediated drainage leak',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0001', waterOfficer);

      const resolved = await service.updateIncidentStatus(
        incident.id,
        {
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Completed and verified.',
          propagateToComplaints: true
        },
        waterOfficer
      );

      assert.ok(resolved.propagationReport);
      assert.strictEqual(resolved.propagationReport.resolvedCount, 0);
      assert.strictEqual(resolved.propagationReport.skippedCount, 1);
      assert.strictEqual(resolved.propagationReport.skippedComplaints[0].currentStatus, 'RESOLVED');
      assert.strictEqual(resolved.propagationReport.skippedComplaints[0].reason, 'Complaint is already in RESOLVED status');
    });

    it('handles mixed batches with some resolved, some skipped, reporting partialSuccess', async () => {
      // Set CMP-1 to IN_PROGRESS (valid), CMP-2 to SUBMITTED (invalid), CMP-3 to RESOLVED (already resolved)
      await setComplaintStatusInFixture('CMP-2026-0001', 'IN_PROGRESS');
      await setComplaintStatusInFixture('CMP-2026-0002', 'SUBMITTED');
      await setComplaintStatusInFixture('CMP-2026-0003', 'RESOLVED');

      const incident = await service.createIncident({
        title: 'Multi-point civic overhaul at Deccan Gymkhana',
        category: 'roads',
        leadDepartment: 'DEPT_ROADS'
      }, roadsOfficer);

      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0001', roadsOfficer);
      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0002', roadsOfficer);
      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0003', roadsOfficer);

      const result = await service.updateIncidentStatus(
        incident.id,
        {
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Comprehensive area remediation complete.',
          propagateToComplaints: true
        },
        roadsOfficer
      );

      const report = result.propagationReport;
      assert.ok(report);
      assert.strictEqual(report.attempted, 3);
      assert.strictEqual(report.resolvedCount, 1);
      assert.strictEqual(report.skippedCount, 2);
      assert.strictEqual(report.failedCount, 0);
      assert.strictEqual(report.partialSuccess, true);
      assert.strictEqual(report.requiresReconciliation, false);
      assert.strictEqual(report.resolvedComplaints[0].complaintId, 'CMP-2026-0001');

      const skippedIds = report.skippedComplaints.map(s => s.complaintId);
      assert.ok(skippedIds.includes('CMP-2026-0002'));
      assert.ok(skippedIds.includes('CMP-2026-0003'));
      assert.ok(report.consistencyNote.includes('Some linked complaints were skipped'));
    });

    it('reports update failures and signals requiresReconciliation without crashing', async () => {
      const incident = await service.createIncident({
        title: 'Electrical panel fault near bridge',
        category: 'power',
        leadDepartment: 'DEPT_POWER'
      }, powerOfficer);

      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0003', powerOfficer);

      // Temporarily mock complaintService.updateComplaintStatus to simulate storage write failure
      const originalUpdate = service.complaintService.updateComplaintStatus;
      service.complaintService.updateComplaintStatus = async () => {
        throw new Error('Complaint storage disk write locked');
      };

      try {
        const result = await service.updateIncidentStatus(
          incident.id,
          {
            status: INCIDENT_STATUS.RESOLVED,
            resolutionSummary: 'Emergency transformer replaced.',
            propagateToComplaints: true
          },
          powerOfficer
        );

        const report = result.propagationReport;
        assert.ok(report);
        assert.strictEqual(report.attempted, 1);
        assert.strictEqual(report.resolvedCount, 0);
        assert.strictEqual(report.failedCount, 1);
        assert.strictEqual(report.requiresReconciliation, true);
        assert.strictEqual(report.failedComplaints[0].complaintId, 'CMP-2026-0003');
        assert.strictEqual(report.failedComplaints[0].error, 'Complaint storage disk write locked');
        assert.ok(report.consistencyNote.includes('reconciliation is required'));
      } finally {
        service.complaintService.updateComplaintStatus = originalUpdate;
      }
    });

    it('enriches citizen tracking output with sanitized parent incident without exposing internal officer details', async () => {
      const incident = await service.createIncident({
        title: 'Pothole remediation cluster on Baner Road',
        category: 'roads',
        leadDepartment: 'DEPT_ROADS',
        description: 'Internal engineer survey: 4 major craters identified'
      }, roadsOfficer);

      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0002', roadsOfficer);

      // Create a subtask under the incident and complete it
      const subtask = await service.createSubtask({
        incidentId: incident.id,
        title: 'Procure bitumen mix',
        department: 'DEPT_ROADS',
        assignedOfficerId: 'OFFICER-ROADS'
      }, roadsOfficer);

      await service.updateSubtaskStatus(
        subtask.id,
        { status: SUBTASK_STATUS.IN_PROGRESS },
        roadsOfficer
      );
      await service.updateSubtaskStatus(
        subtask.id,
        { status: SUBTASK_STATUS.COMPLETED },
        roadsOfficer
      );

      // Resolve incident and propagate
      await service.updateIncidentStatus(
        incident.id,
        {
          status: INCIDENT_STATUS.RESOLVED,
          resolutionSummary: 'Baner road surface restored and asphalt sealed.',
          propagateToComplaints: true
        },
        roadsOfficer
      );

      // Fetch tracking view via complaintService
      const tracking = await service.complaintService.getComplaintForTracking('CMP-2026-0002');
      assert.ok(tracking);
      assert.strictEqual(tracking.incidentId, incident.id);
      assert.strictEqual(tracking.status, 'RESOLVED');

      // Parent incident information is included and sanitized
      assert.ok(tracking.parentIncident);
      assert.strictEqual(tracking.parentIncident.id, incident.id);
      assert.strictEqual(tracking.parentIncident.title, 'Pothole remediation cluster on Baner Road');
      assert.strictEqual(tracking.parentIncident.status, 'RESOLVED');
      assert.strictEqual(tracking.parentIncident.leadDepartment, 'DEPT_ROADS');
      assert.strictEqual(tracking.parentIncident.resolutionSummary, 'Baner road surface restored and asphalt sealed.');

      // Private internal details are strictly absent
      assert.strictEqual(tracking.parentIncident.subtasks, undefined);
      assert.strictEqual(tracking.parentIncident.subtaskOverride, undefined);
      assert.strictEqual(tracking.officerNotes, undefined);
      assert.strictEqual(tracking.citizenId, undefined);
      assert.strictEqual(tracking.citizenPhone, undefined);

      // Citizen view also includes sanitized parent incident
      const citizenView = await service.complaintService.getComplaintById('CMP-2026-0002', false);
      assert.ok(citizenView.parentIncident);
      assert.strictEqual(citizenView.parentIncident.id, incident.id);
      assert.strictEqual(citizenView.officerNotes, undefined);
    });
  });

  // =========================================================================
  // 10. Canonical ActorType Normalization for Complaint Linking & Unlinking
  // =========================================================================

  describe('10. Canonical ActorType Normalization for Complaint Linking & Unlinking', () => {
    it('normalizes roles to schema canonical enum values (CITIZEN, OFFICER, SYSTEM)', () => {
      // Privileged human users map to OFFICER
      assert.strictEqual(service._resolveComplaintActorType({ role: 'admin' }), 'OFFICER');
      assert.strictEqual(service._resolveComplaintActorType({ role: 'officer' }), 'OFFICER');
      assert.strictEqual(service._resolveComplaintActorType({ role: 'ADMIN' }), 'OFFICER');
      assert.strictEqual(service._resolveComplaintActorType({ role: 'OFFICER' }), 'OFFICER');
      assert.strictEqual(service._resolveComplaintActorType('admin'), 'OFFICER');
      assert.strictEqual(service._resolveComplaintActorType('officer'), 'OFFICER');

      // Citizen maps to CITIZEN
      assert.strictEqual(service._resolveComplaintActorType({ role: 'citizen' }), 'CITIZEN');
      assert.strictEqual(service._resolveComplaintActorType('citizen'), 'CITIZEN');
      assert.strictEqual(service._resolveComplaintActorType('CITIZEN'), 'CITIZEN');

      // System maps to SYSTEM
      assert.strictEqual(service._resolveComplaintActorType({ role: 'system' }), 'SYSTEM');
      assert.strictEqual(service._resolveComplaintActorType('system'), 'SYSTEM');
      assert.strictEqual(service._resolveComplaintActorType('SYSTEM'), 'SYSTEM');

      // Empty or missing actor defaults to OFFICER
      assert.strictEqual(service._resolveComplaintActorType(null), 'OFFICER');
      assert.strictEqual(service._resolveComplaintActorType(undefined), 'OFFICER');
      assert.strictEqual(service._resolveComplaintActorType({}), 'OFFICER');
    });

    it('links complaint as admin and saves valid statusHistory.actorType without Mongoose enum errors', async () => {
      const incident = await service.createIncident({
        title: 'Citywide Grid Surge Anomaly',
        category: 'electricity',
        leadDepartment: 'DEPT_POWER'
      }, adminActor);

      const linkResult = await service.linkComplaintToIncident(
        incident.id,
        'CMP-2026-0003',
        adminActor,
        'Supervisory administrative cluster linkage'
      );

      assert.ok(linkResult.incident);
      assert.ok(linkResult.complaint);
      assert.strictEqual(linkResult.complaint.incidentId, incident.id);

      // Verify incident relationship consistency
      const freshIncident = await testIncidentRepo.findById(incident.id);
      assert.ok(freshIncident.linkedComplaints.includes('CMP-2026-0003'));

      // Verify complaint relationship consistency
      const freshComplaint = await testComplaintRepo.findById('CMP-2026-0003');
      assert.strictEqual(freshComplaint.incidentId, incident.id);

      // Verify statusHistory entry
      const latestHistory = freshComplaint.statusHistory[freshComplaint.statusHistory.length - 1];
      assert.ok(latestHistory);
      assert.strictEqual(latestHistory.actorType, 'OFFICER');
      assert.notStrictEqual(latestHistory.actorType, 'admin');

      // Assert Mongoose schema validation passes on the complaint document
      const mongooseDoc = new ComplaintModel(freshComplaint);
      const validationError = mongooseDoc.validateSync();
      assert.strictEqual(validationError, undefined);

      // Assert StatusHistory standalone model validation passes
      const statusHistoryDoc = new StatusHistoryModel({
        id: 'HIST-TEST-ADMIN-LINK',
        complaintId: freshComplaint.id,
        referenceNumber: freshComplaint.referenceNumber,
        status: latestHistory.status,
        actorType: latestHistory.actorType,
        remarks: latestHistory.remarks
      });
      assert.strictEqual(statusHistoryDoc.validateSync(), undefined);

      // Verify that unnormalized raw 'admin' fails Mongoose validation with the exact production error
      const invalidHistoryDoc = new StatusHistoryModel({
        id: 'HIST-TEST-RAW-ADMIN',
        complaintId: freshComplaint.id,
        referenceNumber: freshComplaint.referenceNumber,
        status: latestHistory.status,
        actorType: 'admin',
        remarks: latestHistory.remarks
      });
      const schemaErr = invalidHistoryDoc.validateSync();
      assert.ok(schemaErr);
      assert.match(schemaErr.errors.actorType.message, /`admin` is not a valid enum value for path `actorType`/);
    });

    it('unlinks complaint as admin and saves valid statusHistory.actorType without Mongoose enum errors', async () => {
      const incident = await service.createIncident({
        title: 'Citywide Grid Surge Anomaly',
        category: 'electricity',
        leadDepartment: 'DEPT_POWER'
      }, adminActor);

      // Link first
      await service.linkComplaintToIncident(
        incident.id,
        'CMP-2026-0003',
        adminActor
      );

      // Unlink as admin
      const unlinkResult = await service.unlinkComplaintFromIncident(
        incident.id,
        'CMP-2026-0003',
        adminActor,
        'Decoupled after localized diagnostic isolation'
      );

      assert.ok(unlinkResult.incident);
      assert.ok(unlinkResult.complaint);
      assert.strictEqual(unlinkResult.complaint.incidentId, null);

      // Verify incident relationship consistency
      const freshIncident = await testIncidentRepo.findById(incident.id);
      assert.ok(!freshIncident.linkedComplaints.includes('CMP-2026-0003'));

      // Verify complaint relationship consistency
      const freshComplaint = await testComplaintRepo.findById('CMP-2026-0003');
      assert.strictEqual(freshComplaint.incidentId, null);

      // Verify statusHistory entry
      const latestHistory = freshComplaint.statusHistory[freshComplaint.statusHistory.length - 1];
      assert.ok(latestHistory);
      assert.strictEqual(latestHistory.actorType, 'OFFICER');
      assert.notStrictEqual(latestHistory.actorType, 'admin');

      // Assert Mongoose schema validation passes on the complaint document
      const mongooseDoc = new ComplaintModel(freshComplaint);
      const validationError = mongooseDoc.validateSync();
      assert.strictEqual(validationError, undefined);

      // Assert StatusHistory standalone model validation passes
      const statusHistoryDoc = new StatusHistoryModel({
        id: 'HIST-TEST-ADMIN-UNLINK',
        complaintId: freshComplaint.id,
        referenceNumber: freshComplaint.referenceNumber,
        status: latestHistory.status,
        actorType: latestHistory.actorType,
        remarks: latestHistory.remarks
      });
      assert.strictEqual(statusHistoryDoc.validateSync(), undefined);
    });

    it('links and unlinks complaint as an officer and preserves relationship consistency with valid actorType', async () => {
      const incident = await service.createIncident({
        title: 'Water Main Rupture Sector 4',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      // Link as water officer
      const linkResult = await service.linkComplaintToIncident(
        incident.id,
        'CMP-2026-0001',
        waterOfficer,
        'Linked by departmental lead officer'
      );

      assert.strictEqual(linkResult.complaint.incidentId, incident.id);
      const linkedComplaint = await testComplaintRepo.findById('CMP-2026-0001');
      const linkHistory = linkedComplaint.statusHistory[linkedComplaint.statusHistory.length - 1];
      assert.strictEqual(linkHistory.actorType, 'OFFICER');

      // Unlink as water officer
      const unlinkResult = await service.unlinkComplaintFromIncident(
        incident.id,
        'CMP-2026-0001',
        waterOfficer,
        'Unlinked after incident scope refinement'
      );

      assert.strictEqual(unlinkResult.complaint.incidentId, null);
      const unlinkedComplaint = await testComplaintRepo.findById('CMP-2026-0001');
      const unlinkHistory = unlinkedComplaint.statusHistory[unlinkedComplaint.statusHistory.length - 1];
      assert.strictEqual(unlinkHistory.actorType, 'OFFICER');

      // Validate both states conform to Mongoose model
      const mongooseDoc = new ComplaintModel(unlinkedComplaint);
      assert.strictEqual(mongooseDoc.validateSync(), undefined);
    });

    it('re-linking already linked complaint is idempotent and does not create duplicate history entries', async () => {
      const incident = await service.createIncident({
        title: 'Water Main Rupture Sector 4',
        category: 'water',
        leadDepartment: 'DEPT_WATER'
      }, waterOfficer);

      await service.linkComplaintToIncident(incident.id, 'CMP-2026-0001', adminActor);
      const beforeComplaint = await testComplaintRepo.findById('CMP-2026-0001');
      const historyCountBefore = beforeComplaint.statusHistory.length;

      // Repeat linking
      const repeated = await service.linkComplaintToIncident(incident.id, 'CMP-2026-0001', adminActor);
      assert.strictEqual(repeated.alreadyLinked, true);

      const afterComplaint = await testComplaintRepo.findById('CMP-2026-0001');
      assert.strictEqual(afterComplaint.statusHistory.length, historyCountBefore);
    });
  });
});
