import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../src/config/app.config.js';
import {
  INCIDENT_STATUS,
  INCIDENT_PRIORITY,
  SUBTASK_STATUS,
  validateIncidentStatusTransition,
  validateSubtaskStatusTransition,
  isTerminalIncidentStatus,
  isTerminalSubtaskStatus,
  getIncidentStatusDescription,
  getSubtaskStatusDescription
} from '../src/constants/incident.constants.js';
import { IncidentModel } from '../src/models/incident.model.js';
import { SubtaskModel } from '../src/models/subtask.model.js';
import { ComplaintModel } from '../src/models/complaint.model.js';
import { JsonIncidentRepository } from '../src/repositories/incident.json.repository.js';
import { JsonSubtaskRepository } from '../src/repositories/subtask.json.repository.js';
import { incidentRepository, IncidentRepository } from '../src/repositories/incident.repository.js';
import { subtaskRepository, SubtaskRepository } from '../src/repositories/subtask.repository.js';
import { complaintRepository } from '../src/repositories/complaint.repository.js';
import { mongoIncidentRepository } from '../src/repositories/incident.mongo.repository.js';
import { mongoSubtaskRepository } from '../src/repositories/subtask.mongo.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dedicated isolated Phase 7 test fixture paths
const TEST_INCIDENTS_PATH = path.resolve(path.dirname(config.dataPath.incidents), 'incidents.phase7-test.json');
const TEST_SUBTASKS_PATH = path.resolve(path.dirname(config.dataPath.subtasks), 'subtasks.phase7-test.json');
const TEST_COMPLAINTS_PATH = path.resolve(path.dirname(config.dataPath.complaints), 'complaints.phase7-test.json');

// Exact allowlist of fixture paths owned exclusively by this test suite
const ALLOWED_FIXTURE_PATHS = new Set([
  path.resolve(TEST_INCIDENTS_PATH),
  path.resolve(TEST_SUBTASKS_PATH),
  path.resolve(TEST_COMPLAINTS_PATH)
]);

// Track fixtures created exclusively by this specific test execution
const createdFixtures = new Set();

// Path-safety guard: strictly verifies that target path is in the exact allowlist of fixtures owned by this test
const isSafeTestPath = (targetPath) => {
  if (!targetPath || typeof targetPath !== 'string') return false;
  const resolvedTarget = path.resolve(targetPath);

  // Reject any production data path explicitly
  const protectedFiles = [
    config.dataPath.incidents,
    config.dataPath.subtasks,
    config.dataPath.complaints,
    config.dataPath.departments,
    config.dataPath.officers,
    config.dataPath.statusHistory,
    config.dataPath.users,
    config.dataPath.auditLogs
  ].map(p => path.resolve(p));

  if (protectedFiles.includes(resolvedTarget)) {
    return false;
  }

  // Exact allowlist match only: rejects arbitrary .phase7-test.json and any other path
  return ALLOWED_FIXTURE_PATHS.has(resolvedTarget);
};

// Safe fixture removal: verifies exact allowlist, checks existence and test ownership, and retries for Windows NTFS lock release
const removeFixtureSafely = async (filePath) => {
  if (!isSafeTestPath(filePath)) {
    throw new Error(`Path-safety guard rejected removal of path: ${filePath}`);
  }

  const resolvedPath = path.resolve(filePath);
  // Ownership guard: only delete fixtures that were created by this execution
  if (!createdFixtures.has(resolvedPath)) {
    return;
  }

  try {
    await fs.access(resolvedPath);
  } catch {
    // Fixture does not exist; nothing to clean up
    createdFixtures.delete(resolvedPath);
    return;
  }

  let attempts = 0;
  while (attempts < 5) {
    try {
      await fs.rm(resolvedPath, { force: true, maxRetries: 3, retryDelay: 50 });
      createdFixtures.delete(resolvedPath);
      return;
    } catch (err) {
      attempts++;
      if (attempts >= 5) {
        throw new Error(`Failed to safely clean up test fixture '${resolvedPath}' after 5 attempts: ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
};

// Race-safe exclusive fixture creation: uses atomic 'wx' flag to prevent overwriting existing files
const createFixtureExclusively = async (filePath, content) => {
  if (!isSafeTestPath(filePath)) {
    throw new Error(`Path-safety guard rejected creation of path: ${filePath}`);
  }
  const resolved = path.resolve(filePath);
  try {
    await fs.writeFile(resolved, content, { encoding: 'utf-8', flag: 'wx' });
    createdFixtures.add(resolved);
  } catch (err) {
    if (err.code === 'EEXIST') {
      throw new Error(
        `Atomic creation aborted: test fixture '${filePath}' already exists on disk. Setup aborted to prevent overwriting or deleting pre-existing files.`
      );
    }
    throw err;
  }
};

describe('CivicSarthi Phase 7: Incident & Subtask Backend Foundation Tests', () => {
  let originalIncidentsContent = null;
  let originalSubtasksContent = null;
  let originalComplaintsContent = null;

  before(async () => {
    try {
      // 1. Read existing protected runtime files to verify immutability at teardown
      originalIncidentsContent = await fs.readFile(config.dataPath.incidents, 'utf-8');
      originalSubtasksContent = await fs.readFile(config.dataPath.subtasks, 'utf-8');
      originalComplaintsContent = await fs.readFile(config.dataPath.complaints, 'utf-8');

      // 2. Pre-flight check: ensure none of the test fixtures already exist before setup
      const fixturePaths = [TEST_INCIDENTS_PATH, TEST_SUBTASKS_PATH, TEST_COMPLAINTS_PATH];
      for (const fixturePath of fixturePaths) {
        try {
          await fs.access(fixturePath);
          // If fs.access succeeds, file already exists! Abort immediately to prevent overwrite
          throw new Error(
            `Pre-flight check failed: test fixture '${fixturePath}' already exists on disk. Setup aborted to prevent overwriting or deleting pre-existing files.`
          );
        } catch (err) {
          if (err.code !== 'ENOENT') {
            throw err;
          }
          // ENOENT means file does not exist, which is expected and safe
        }
      }

      // 3. Atomically initialize isolated test fixtures with exclusive creation flag ('wx') and record ownership
      await createFixtureExclusively(
        TEST_INCIDENTS_PATH,
        JSON.stringify({ metadata: { testFixture: true }, incidents: [] }, null, 2)
      );

      await createFixtureExclusively(
        TEST_SUBTASKS_PATH,
        JSON.stringify({ metadata: { testFixture: true }, subtasks: [] }, null, 2)
      );

      await createFixtureExclusively(
        TEST_COMPLAINTS_PATH,
        JSON.stringify({
          metadata: { testFixture: true },
          complaints: [
            {
              id: 'CPG-PHASE7-001',
              referenceNumber: 'CS-2026-9001',
              title: 'Submerged transformer near sector market',
              description: 'Water logging reaching electrical transformer creating severe hazard.',
              category: 'electricity',
              departmentId: 'DEPT_POWER',
              status: 'ASSIGNED',
              priority: 'HIGH',
              statusHistory: []
            },
            {
              id: 'CPG-PHASE7-002',
              referenceNumber: 'CS-2026-9002',
              title: 'Water main burst on market arterial road',
              description: 'Major drinking water pipe ruptured, flooding residential lane.',
              category: 'water',
              departmentId: 'DEPT_WATER',
              status: 'IN_PROGRESS',
              priority: 'HIGH',
              statusHistory: []
            }
          ]
        }, null, 2)
      );

      // 4. Point singleton repository facades to isolated fixtures
      incidentRepository.setFilePath(TEST_INCIDENTS_PATH);
      subtaskRepository.setFilePath(TEST_SUBTASKS_PATH);
      complaintRepository.setFilePath(TEST_COMPLAINTS_PATH);
    } catch (setupError) {
      // If setup partially fails, clean up only fixtures created so far by this execution
      for (const created of [...createdFixtures]) {
        try { await fs.rm(created, { force: true, maxRetries: 3, retryDelay: 50 }); } catch {}
        createdFixtures.delete(created);
      }
      throw setupError;
    }
  });

  after(async () => {
    try {
      // 1. Reset singleton repository facades before fixture removal so active handles are released
      incidentRepository.resetFilePath();
      subtaskRepository.resetFilePath();
      complaintRepository.resetFilePath();

      // 2. Clean up dedicated test fixtures with existence check, path safety guard, and Windows retry support
      await removeFixtureSafely(TEST_INCIDENTS_PATH);
      await removeFixtureSafely(TEST_SUBTASKS_PATH);
      await removeFixtureSafely(TEST_COMPLAINTS_PATH);

      // 3. Verify that protected runtime data files remained 100% identical and uncorrupted
      const currentIncidentsContent = await fs.readFile(config.dataPath.incidents, 'utf-8');
      const currentSubtasksContent = await fs.readFile(config.dataPath.subtasks, 'utf-8');
      const currentComplaintsContent = await fs.readFile(config.dataPath.complaints, 'utf-8');

      assert.equal(currentIncidentsContent, originalIncidentsContent, 'Protected incidents.json must remain untouched');
      assert.equal(currentSubtasksContent, originalSubtasksContent, 'Protected subtasks.json must remain untouched');
      assert.equal(currentComplaintsContent, originalComplaintsContent, 'Protected complaints.json must remain untouched');
    } finally {
      // 4. Guaranteed restoration of repository file paths to default configuration
      incidentRepository.resetFilePath();
      subtaskRepository.resetFilePath();
      complaintRepository.resetFilePath();
    }
  });

  // ==========================================
  // SECTION 1: Status Constants & Transition Matrices
  // ==========================================
  describe('Constants & Transition Matrices', () => {
    it('validates incident status transitions correctly', () => {
      // Valid transitions from ACTIVE
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.ACTIVE, INCIDENT_STATUS.CONTAINED).valid, true);
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.ACTIVE, INCIDENT_STATUS.RESOLVED).valid, true);
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.ACTIVE, INCIDENT_STATUS.CLOSED).valid, true);
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.ACTIVE, INCIDENT_STATUS.ACTIVE).valid, true);

      // Valid transitions from CONTAINED
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.CONTAINED, INCIDENT_STATUS.ACTIVE).valid, true);
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.CONTAINED, INCIDENT_STATUS.RESOLVED).valid, true);
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.CONTAINED, INCIDENT_STATUS.CLOSED).valid, true);

      // Valid transitions from RESOLVED
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.CONTAINED).valid, true);
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.CLOSED).valid, true);

      // Terminal state CLOSED cannot transition
      const fromClosed = validateIncidentStatusTransition(INCIDENT_STATUS.CLOSED, INCIDENT_STATUS.ACTIVE);
      assert.equal(fromClosed.valid, false);
      assert.deepEqual(fromClosed.allowed, []);

      // Invalid direct transition from RESOLVED to ACTIVE
      assert.equal(validateIncidentStatusTransition(INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.ACTIVE).valid, false);
    });

    it('validates subtask status transitions correctly', () => {
      // Valid transitions from PENDING
      assert.equal(validateSubtaskStatusTransition(SUBTASK_STATUS.PENDING, SUBTASK_STATUS.IN_PROGRESS).valid, true);
      assert.equal(validateSubtaskStatusTransition(SUBTASK_STATUS.PENDING, SUBTASK_STATUS.CANCELLED).valid, true);
      assert.equal(validateSubtaskStatusTransition(SUBTASK_STATUS.PENDING, SUBTASK_STATUS.COMPLETED).valid, false);

      // Valid transitions from IN_PROGRESS
      assert.equal(validateSubtaskStatusTransition(SUBTASK_STATUS.IN_PROGRESS, SUBTASK_STATUS.COMPLETED).valid, true);
      assert.equal(validateSubtaskStatusTransition(SUBTASK_STATUS.IN_PROGRESS, SUBTASK_STATUS.PENDING).valid, true);
      assert.equal(validateSubtaskStatusTransition(SUBTASK_STATUS.IN_PROGRESS, SUBTASK_STATUS.CANCELLED).valid, true);

      // Terminal states COMPLETED and CANCELLED
      assert.equal(validateSubtaskStatusTransition(SUBTASK_STATUS.COMPLETED, SUBTASK_STATUS.IN_PROGRESS).valid, false);
      assert.equal(validateSubtaskStatusTransition(SUBTASK_STATUS.CANCELLED, SUBTASK_STATUS.PENDING).valid, false);
      assert.equal(isTerminalSubtaskStatus(SUBTASK_STATUS.COMPLETED), true);
      assert.equal(isTerminalSubtaskStatus(SUBTASK_STATUS.CANCELLED), true);
      assert.equal(isTerminalSubtaskStatus(SUBTASK_STATUS.IN_PROGRESS), false);
    });

    it('identifies terminal incident statuses and returns descriptions', () => {
      assert.equal(isTerminalIncidentStatus(INCIDENT_STATUS.CLOSED), true);
      assert.equal(isTerminalIncidentStatus(INCIDENT_STATUS.RESOLVED), false);
      assert.equal(isTerminalIncidentStatus(INCIDENT_STATUS.ACTIVE), false);

      assert.ok(getIncidentStatusDescription(INCIDENT_STATUS.ACTIVE).length > 10);
      assert.ok(getSubtaskStatusDescription(SUBTASK_STATUS.IN_PROGRESS).length > 10);
    });
  });

  // ==========================================
  // SECTION 2: JSON Incident Repository Operations
  // ==========================================
  describe('JSON Incident Repository Operations', () => {
    let createdIncident = null;

    it('creates a parent incident with defaults and automatic ID generation', async () => {
      createdIncident = await incidentRepository.create({
        title: 'Sector 4 Flash Inundation Crisis',
        description: 'Severe stormwater flooding affecting 3 residential blocks and substation.',
        category: 'flood relief',
        leadDepartment: 'DEPT_DISASTER',
        participatingDepartments: ['DEPT_POWER', 'DEPT_WATER'],
        priority: INCIDENT_PRIORITY.CRITICAL
      });

      assert.ok(createdIncident);
      assert.match(createdIncident.id, /^INC-\d{4}-\d{4}$/);
      assert.equal(createdIncident.status, INCIDENT_STATUS.ACTIVE);
      assert.equal(createdIncident.priority, INCIDENT_PRIORITY.CRITICAL);
      assert.equal(createdIncident.leadDepartment, 'DEPT_DISASTER');
      assert.deepEqual(createdIncident.participatingDepartments, ['DEPT_DISASTER', 'DEPT_POWER', 'DEPT_WATER']);
      assert.deepEqual(createdIncident.linkedComplaints, []);
    });

    it('retrieves incident by ID and performs filtered searches', async () => {
      const found = await incidentRepository.findById(createdIncident.id);
      assert.ok(found);
      assert.equal(found.title, 'Sector 4 Flash Inundation Crisis');

      // Case-insensitive lookup
      const foundLower = await incidentRepository.findById(createdIncident.id.toLowerCase());
      assert.ok(foundLower);
      assert.equal(foundLower.id, createdIncident.id);

      // Search by participatingDepartment
      const powerIncidents = await incidentRepository.findAll({ participatingDepartment: 'DEPT_POWER' });
      assert.equal(powerIncidents.length, 1);
      assert.equal(powerIncidents[0].id, createdIncident.id);

      // Search by text query
      const searchRes = await incidentRepository.findAll({ search: 'Inundation' });
      assert.equal(searchRes.length, 1);

      // Search by non-matching query
      const emptyRes = await incidentRepository.findAll({ search: 'NonExistentXYZ' });
      assert.equal(emptyRes.length, 0);
    });

    it('updates incident status adhering to governance transition matrix', async () => {
      // Transition ACTIVE -> CONTAINED is valid
      const contained = await incidentRepository.update(createdIncident.id, {
        status: INCIDENT_STATUS.CONTAINED
      });
      assert.equal(contained.status, INCIDENT_STATUS.CONTAINED);

      // Transition CONTAINED -> RESOLVED is valid and sets resolvedAt
      const resolved = await incidentRepository.update(createdIncident.id, {
        status: INCIDENT_STATUS.RESOLVED,
        resolutionSummary: 'Pumping operations completed and power restored.'
      });
      assert.equal(resolved.status, INCIDENT_STATUS.RESOLVED);
      assert.ok(resolved.resolvedAt);

      // Invalid transition: RESOLVED directly to ACTIVE must throw error
      await assert.rejects(
        async () => {
          await incidentRepository.update(createdIncident.id, {
            status: INCIDENT_STATUS.ACTIVE
          });
        },
        /Invalid incident status transition/
      );

      // Transition RESOLVED -> CLOSED is valid and sets closedAt
      const closed = await incidentRepository.update(createdIncident.id, {
        status: INCIDENT_STATUS.CLOSED
      });
      assert.equal(closed.status, INCIDENT_STATUS.CLOSED);
      assert.ok(closed.closedAt);

      // Terminal state CLOSED cannot transition further
      await assert.rejects(
        async () => {
          await incidentRepository.update(createdIncident.id, {
            status: INCIDENT_STATUS.ACTIVE
          });
        },
        /Invalid incident status transition/
      );
    });

    it('links and unlinks complaints to an incident safely', async () => {
      const inc = await incidentRepository.create({
        title: 'Road & Pipeline Cave-in',
        category: 'roads',
        leadDepartment: 'DEPT_ROADS'
      });

      // Link complaint
      const linked = await incidentRepository.linkComplaint(inc.id, 'CPG-PHASE7-001');
      assert.deepEqual(linked.linkedComplaints, ['CPG-PHASE7-001']);

      // Linking same complaint again is idempotent
      const linkedAgain = await incidentRepository.linkComplaint(inc.id, 'CPG-PHASE7-001');
      assert.deepEqual(linkedAgain.linkedComplaints, ['CPG-PHASE7-001']);

      // Unlink complaint
      const unlinked = await incidentRepository.unlinkComplaint(inc.id, 'CPG-PHASE7-001');
      assert.deepEqual(unlinked.linkedComplaints, []);
    });

    it('concurrent writes serialize safely through AsyncMutex without data loss', async () => {
      const inc = await incidentRepository.create({
        title: 'High-Concurrency Stress Incident',
        category: 'municipal',
        leadDepartment: 'DEPT_MUNICIPAL'
      });

      // Execute 10 concurrent link operations
      await Promise.all(
        Array.from({ length: 10 }).map((_, idx) =>
          incidentRepository.linkComplaint(inc.id, `CPG-CONCUR-${idx}`)
        )
      );

      const refreshed = await incidentRepository.findById(inc.id);
      assert.equal(refreshed.linkedComplaints.length, 10);
    });
  });

  // ==========================================
  // SECTION 3: JSON Subtask Repository Operations
  // ==========================================
  describe('JSON Subtask Repository Operations', () => {
    let createdSubtask = null;

    it('creates a subtask and synchronizes officer aliases', async () => {
      createdSubtask = await subtaskRepository.create({
        incidentId: 'INC-2026-0001',
        complaintId: 'CPG-PHASE7-001',
        title: 'Isolate submerged feeder lines & inspect transformer',
        department: 'DEPT_POWER',
        assignedOfficerId: 'OFF_POWER_001',
        dueDate: '2026-10-15T18:00:00.000Z'
      });

      assert.ok(createdSubtask);
      assert.match(createdSubtask.id, /^SUB-\d{4}-\d{3}$/);
      assert.equal(createdSubtask.status, SUBTASK_STATUS.PENDING);
      assert.equal(createdSubtask.assignedOfficerId, 'OFF_POWER_001');
      assert.equal(createdSubtask.officerId, 'OFF_POWER_001'); // Backward compatible alias
    });

    it('filters subtasks by incident, department, status, and assigned officer', async () => {
      const byInc = await subtaskRepository.findAll({ incidentId: 'INC-2026-0001' });
      assert.equal(byInc.length, 1);
      assert.equal(byInc[0].id, createdSubtask.id);

      const byDept = await subtaskRepository.findAll({ department: 'DEPT_POWER' });
      assert.equal(byDept.length, 1);

      const byOfficer = await subtaskRepository.findAll({ officerId: 'OFF_POWER_001' });
      assert.equal(byOfficer.length, 1);

      const empty = await subtaskRepository.findAll({ department: 'DEPT_HEALTH' });
      assert.equal(empty.length, 0);
    });

    it('updates subtask status with lifecycle validation and completion timestamp', async () => {
      // PENDING -> IN_PROGRESS
      const inProgress = await subtaskRepository.update(createdSubtask.id, {
        status: SUBTASK_STATUS.IN_PROGRESS
      });
      assert.equal(inProgress.status, SUBTASK_STATUS.IN_PROGRESS);

      // IN_PROGRESS -> COMPLETED sets completedAt
      const completed = await subtaskRepository.update(createdSubtask.id, {
        status: SUBTASK_STATUS.COMPLETED,
        remarks: 'Substation feeder de-energized and safety perimeter established.'
      });
      assert.equal(completed.status, SUBTASK_STATUS.COMPLETED);
      assert.ok(completed.completedAt);

      // Reopening completed subtask directly to PENDING must be rejected
      await assert.rejects(
        async () => {
          await subtaskRepository.update(createdSubtask.id, {
            status: SUBTASK_STATUS.PENDING
          });
        },
        /Invalid subtask status transition/
      );
    });

    it('deletes subtask by ID', async () => {
      const extra = await subtaskRepository.create({
        incidentId: 'INC-2026-0001',
        title: 'Temporary water distribution queue setup',
        department: 'DEPT_WATER'
      });

      assert.ok(await subtaskRepository.findById(extra.id));
      const deleted = await subtaskRepository.delete(extra.id);
      assert.equal(deleted, true);
      assert.equal(await subtaskRepository.findById(extra.id), null);
    });
  });

  // ==========================================
  // SECTION 4: Complaint Linkage & Search Support
  // ==========================================
  describe('Complaint Linkage & Incident Querying', () => {
    it('links complaint to parent incident and records audit history entry', async () => {
      // 1. Link with custom remarks
      const linked = await complaintRepository.linkIncident('CPG-PHASE7-001', {
        incidentId: 'INC-2026-0001',
        actorType: 'OFFICER',
        remarks: 'Aggregated under composite Sector 4 Inundation incident'
      });

      assert.ok(linked);
      assert.equal(linked.incidentId, 'INC-2026-0001');

      const history = linked.statusHistory;
      assert.ok(history.length > 0);
      assert.equal(history[history.length - 1].remarks, 'Aggregated under composite Sector 4 Inundation incident');

      // 2. Link second complaint with default remarks
      const linkedDefault = await complaintRepository.linkIncident('CPG-PHASE7-002', {
        incidentId: 'INC-2026-0001',
        actorType: 'OFFICER'
      });
      assert.ok(linkedDefault);
      const defaultHistory = linkedDefault.statusHistory;
      assert.match(defaultHistory[defaultHistory.length - 1].remarks, /Linked to parent incident INC-2026-0001/);
    });

    it('filters complaints by linked incidentId in findAll', async () => {
      const complaintsForInc = await complaintRepository.findAll({ incidentId: 'INC-2026-0001' });
      assert.equal(complaintsForInc.length, 2);

      const nonLinked = await complaintRepository.findAll({ incidentId: 'INC-NON-EXISTENT' });
      assert.equal(nonLinked.length, 0);
    });

    it('unlinks complaint from parent incident and clears field cleanly', async () => {
      // Unlink with custom remarks
      const unlinked = await complaintRepository.unlinkIncident('CPG-PHASE7-001', {
        actorType: 'OFFICER',
        remarks: 'Removed from incident cluster after jurisdictional triage'
      });

      assert.ok(unlinked);
      assert.equal(unlinked.incidentId, null);

      const history = unlinked.statusHistory;
      assert.equal(history[history.length - 1].remarks, 'Removed from incident cluster after jurisdictional triage');

      // Unlink with default remarks
      const unlinkedDefault = await complaintRepository.unlinkIncident('CPG-PHASE7-002', {
        actorType: 'OFFICER'
      });
      assert.ok(unlinkedDefault);
      const defaultHistory = unlinkedDefault.statusHistory;
      assert.match(defaultHistory[defaultHistory.length - 1].remarks, /Unlinked from parent incident INC-2026-0001/);
    });

    it('repeating linkIncident with the same incident is idempotent and does not add duplicate history', async () => {
      // Link complaint CPG-PHASE7-001 to INC-2026-0001
      const initial = await complaintRepository.linkIncident('CPG-PHASE7-001', {
        incidentId: 'INC-2026-0001',
        actorType: 'OFFICER'
      });
      const historyLengthBefore = initial.statusHistory.length;

      // Repeat identical link call
      const repeated = await complaintRepository.linkIncident('CPG-PHASE7-001', {
        incidentId: 'INC-2026-0001',
        actorType: 'OFFICER'
      });

      assert.equal(repeated.incidentId, 'INC-2026-0001');
      assert.equal(repeated.statusHistory.length, historyLengthBefore, 'History length must not increase on idempotent re-link');
    });

    it('repeating unlinkIncident when already unlinked is idempotent and does not add duplicate history', async () => {
      // First unlink
      const firstUnlink = await complaintRepository.unlinkIncident('CPG-PHASE7-001', {
        actorType: 'OFFICER'
      });
      assert.equal(firstUnlink.incidentId, null);
      const historyLengthBefore = firstUnlink.statusHistory.length;

      // Second unlink on already-unlinked complaint
      const secondUnlink = await complaintRepository.unlinkIncident('CPG-PHASE7-001', {
        actorType: 'OFFICER'
      });
      assert.equal(secondUnlink.incidentId, null);
      assert.equal(secondUnlink.statusHistory.length, historyLengthBefore, 'History length must not increase on idempotent unlink');
    });

    it('linkIncident rejects linking when complaint is already linked to a different incident and preserves original link', async () => {
      // Establish initial link to INC-2026-0001
      await complaintRepository.linkIncident('CPG-PHASE7-001', {
        incidentId: 'INC-2026-0001',
        actorType: 'OFFICER'
      });

      // Attempting to re-link to INC-2026-9999 without unlinking first must be rejected with 409 Conflict
      await assert.rejects(
        async () => {
          await complaintRepository.linkIncident('CPG-PHASE7-001', {
            incidentId: 'INC-2026-9999',
            actorType: 'OFFICER'
          });
        },
        (err) => {
          return (
            err.status === 409 &&
            err.message.includes('already linked to incident')
          );
        }
      );

      // Verify original link was preserved untouched
      const verified = await complaintRepository.findById('CPG-PHASE7-001');
      assert.equal(verified.incidentId, 'INC-2026-0001', 'Original incident link must be preserved on conflict');
    });
  });

  // ==========================================
  // SECTION 5: Persistence Anti-Silent Fallback Safety
  // ==========================================
  describe('Persistence Backend Selection & Anti-Silent Fallback Safety', () => {
    it('IncidentRepository refuses silent fallback when MongoDB is configured but offline', () => {
      const previousEnv = process.env.PERSISTENCE_MODE;
      try {
        process.env.PERSISTENCE_MODE = 'mongodb';
        const repo = new IncidentRepository();
        assert.throws(
          () => { repo._getActiveAdapter(); },
          (err) => {
            return (
              err.status === 503 &&
              err.message.includes('Silent fallback to JSON is prohibited')
            );
          }
        );
      } finally {
        if (previousEnv !== undefined) {
          process.env.PERSISTENCE_MODE = previousEnv;
        } else {
          delete process.env.PERSISTENCE_MODE;
        }
      }
    });

    it('SubtaskRepository refuses silent fallback when MongoDB is configured but offline', () => {
      const previousEnv = process.env.PERSISTENCE_MODE;
      try {
        process.env.PERSISTENCE_MODE = 'mongodb';
        const repo = new SubtaskRepository();
        assert.throws(
          () => { repo._getActiveAdapter(); },
          (err) => {
            return (
              err.status === 503 &&
              err.message.includes('Silent fallback to JSON is prohibited')
            );
          }
        );
      } finally {
        if (previousEnv !== undefined) {
          process.env.PERSISTENCE_MODE = previousEnv;
        } else {
          delete process.env.PERSISTENCE_MODE;
        }
      }
    });
  });

  // ==========================================
  // SECTION 6: Mongoose Schema Validation
  // ==========================================
  describe('Mongoose Domain Model Schema Validation', () => {
    it('IncidentModel schema accepts valid document and enforces required fields', () => {
      const validDoc = new IncidentModel({
        id: 'INC-2026-TEST',
        title: 'Water main rupture and transformer spark',
        description: 'Detailed description of multi-department civic incident.',
        category: 'water',
        leadDepartment: 'DEPT_WATER',
        participatingDepartments: ['DEPT_WATER', 'DEPT_POWER'],
        priority: INCIDENT_PRIORITY.HIGH
      });
      const err = validDoc.validateSync();
      assert.equal(err, undefined);

      const invalidDoc = new IncidentModel({});
      const validationErr = invalidDoc.validateSync();
      assert.ok(validationErr);
      assert.ok(validationErr.errors.id);
      assert.ok(validationErr.errors.title);
      assert.ok(validationErr.errors.leadDepartment);
    });

    it('SubtaskModel schema accepts valid document and syncs officerId aliases', () => {
      const validDoc = new SubtaskModel({
        id: 'SUB-2026-TEST',
        incidentId: 'INC-2026-TEST',
        title: 'Deploy valve isolation crew',
        department: 'DEPT_WATER',
        assignedOfficerId: 'OFF_002'
      });
      const err = validDoc.validateSync();
      assert.equal(err, undefined);
      assert.equal(validDoc.officerId, 'OFF_002'); // Synchronized by pre-validate hook

      const invalidDoc = new SubtaskModel({});
      const validationErr = invalidDoc.validateSync();
      assert.ok(validationErr);
      assert.ok(validationErr.errors.id);
      assert.ok(validationErr.errors.incidentId);
      assert.ok(validationErr.errors.department);
    });

    it('ComplaintModel schema accepts incidentId field', () => {
      const doc = new ComplaintModel({
        id: 'CPG-TEST-INCIDENT',
        referenceNumber: 'CS-2026-8888',
        title: 'Test complaint with incident link',
        description: 'Complaint with incident link for schema verification.',
        category: 'electricity',
        departmentId: 'DEPT_POWER',
        incidentId: 'INC-2026-TEST'
      });
      const err = doc.validateSync();
      assert.equal(err, undefined);
      assert.equal(doc.incidentId, 'INC-2026-TEST');
    });

    it('MongoIncidentRepository generateIncidentId generates INC-YYYY-XXXX format sequence ID', async () => {
      // 1. Initial ID generation on empty database/set
      const firstId = await mongoIncidentRepository.generateIncidentId(2026, []);
      assert.equal(firstId, 'INC-2026-0001');

      // 2. Monotonic sequence increment
      const nextId = await mongoIncidentRepository.generateIncidentId(2026, [
        { id: 'INC-2026-0001' },
        { id: 'INC-2026-0002' }
      ]);
      assert.equal(nextId, 'INC-2026-0003');

      // 3. Collision recovery: advances past existing occupied candidate
      const recoveredId = await mongoIncidentRepository.generateIncidentId(2026, [
        { id: 'INC-2026-0001' },
        { id: 'INC-2026-0005' }
      ]);
      assert.equal(recoveredId, 'INC-2026-0006');
    });

    it('MongoSubtaskRepository generateSubtaskId generates SUB-YYYY-XXX format sequence ID', async () => {
      // 1. Initial ID generation on empty database/set
      const firstId = await mongoSubtaskRepository.generateSubtaskId(2026, []);
      assert.equal(firstId, 'SUB-2026-001');

      // 2. Monotonic sequence increment
      const nextId = await mongoSubtaskRepository.generateSubtaskId(2026, [
        { id: 'SUB-2026-001' },
        { id: 'SUB-2026-002' }
      ]);
      assert.equal(nextId, 'SUB-2026-003');

      // 3. Collision recovery: advances past existing occupied candidate
      const recoveredId = await mongoSubtaskRepository.generateSubtaskId(2026, [
        { id: 'SUB-2026-001' },
        { id: 'SUB-2026-007' }
      ]);
      assert.equal(recoveredId, 'SUB-2026-008');
    });
  });
});
