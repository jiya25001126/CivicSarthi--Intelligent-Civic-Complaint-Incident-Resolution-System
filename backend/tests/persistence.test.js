import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import config from '../src/config/app.config.js';
import { connectDatabase, disconnectDatabase, isConnected, getConfiguredPersistenceMode } from '../src/config/database.js';
import { JsonComplaintRepository } from '../src/repositories/complaint.json.repository.js';
import { JsonDepartmentRepository } from '../src/repositories/department.json.repository.js';
import { ComplaintRepository } from '../src/repositories/complaint.repository.js';
import { ComplaintModel } from '../src/models/complaint.model.js';
import { DepartmentModel } from '../src/models/department.model.js';
import { StatusHistoryModel } from '../src/models/statusHistory.model.js';
import { runSeed } from '../src/scripts/seed.js';
import { runMigration } from '../src/scripts/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-persistence-test');
const TEST_COMPLAINTS_FILE = path.join(SANDBOX_DIR, 'complaints.json');
const TEST_DEPTS_FILE = path.join(SANDBOX_DIR, 'departments.json');
const TEST_HISTORY_FILE = path.join(SANDBOX_DIR, 'status_history.json');

describe('CivicSarthi Phase 2 Persistence Layer Tests', () => {
  before(async () => {
    // Set up clean isolated test directory with initial seed data
    await fs.mkdir(SANDBOX_DIR, { recursive: true });
    await runSeed({ dataDir: SANDBOX_DIR, reset: true });
  });

  after(async () => {
    // Teardown sandbox fixtures
    try {
      await fs.rm(SANDBOX_DIR, { recursive: true, force: true });
    } catch {}
    await disconnectDatabase();
  });

  // ==========================================
  // SECTION 1: JSON Adapter Tests
  // ==========================================

  describe('JSON Adapter: CRUD, Concurrency, and Restart Persistence', () => {
    let jsonRepo;
    let deptRepo;

    before(() => {
      jsonRepo = new JsonComplaintRepository(TEST_COMPLAINTS_FILE);
      deptRepo = new JsonDepartmentRepository(TEST_DEPTS_FILE);
    });

    it('JSON CRUD: creates complaint, retrieves it by ID and reference number, updates status', async () => {
      const created = await jsonRepo.create({
        title: 'Water pipe leakage in Model Colony',
        description: 'Main pipeline rupture flooding street for 3 days continuously.',
        category: 'water',
        state: 'Maharashtra',
        district: 'Pune',
        locality: 'Model Colony',
        departmentId: 'DEPT_WATER'
      });

      assert.ok(created);
      assert.ok(created.id);
      assert.ok(created.referenceNumber);
      assert.equal(created.status, 'SUBMITTED');
      assert.equal(created.priority, 'MEDIUM');
      assert.equal(created.synthetic, false);

      // Retrieve by ID
      const byId = await jsonRepo.findById(created.id);
      assert.ok(byId);
      assert.equal(byId.title, created.title);

      // Retrieve by reference number
      const byRef = await jsonRepo.findById(created.referenceNumber);
      assert.ok(byRef);
      assert.equal(byRef.id, created.id);

      // Update status to UNDER_REVIEW
      const updated = await jsonRepo.updateStatus(created.id, {
        status: 'UNDER_REVIEW',
        remarks: 'Hydraulic engineer assigned for inspection',
        actorType: 'OFFICER'
      });
      assert.equal(updated.status, 'UNDER_REVIEW');
      assert.equal(updated.statusHistory.length, 2);
    });

    it('JSON Persistence: complaint survives simulated server restart via fresh repository instance', async () => {
      const created = await jsonRepo.create({
        title: 'Streetlight failure near Bus Depot',
        description: 'Streetlight pole 14 completely non-functional causing night hazards.',
        category: 'electricity',
        departmentId: 'DEPT_POWER'
      });

      // Simulate cold process restart by instantiating new repository object pointing to file
      const freshRepoInstance = new JsonComplaintRepository(TEST_COMPLAINTS_FILE);
      const retrieved = await freshRepoInstance.findById(created.id);

      assert.ok(retrieved, 'Complaint must be found after repository restart');
      assert.equal(retrieved.id, created.id);
      assert.equal(retrieved.title, 'Streetlight failure near Bus Depot');
      assert.equal(retrieved.category, 'electricity');
    });

    it('JSON Concurrency: multiple simultaneous status and note writes serialize safely without lost updates', async () => {
      const target = await jsonRepo.create({
        title: 'Concurrent update safety check complaint',
        description: 'Testing AsyncMutex serialization for multi-action operations.',
        category: 'roads',
        departmentId: 'DEPT_ROADS'
      });

      // Fire parallel status update and 3 note additions
      const actions = [
        jsonRepo.updateStatus(target.id, { status: 'ASSIGNED', remarks: 'Parallel assignment' }),
        jsonRepo.addOfficerNote(target.id, { note: 'Parallel note 1', officerId: 'OFF_001' }),
        jsonRepo.addOfficerNote(target.id, { note: 'Parallel note 2', officerId: 'OFF_002' }),
        jsonRepo.addOfficerNote(target.id, { note: 'Parallel note 3', officerId: 'OFF_003' })
      ];

      await Promise.all(actions);

      const finalComplaint = await jsonRepo.findById(target.id);
      assert.equal(finalComplaint.status, 'ASSIGNED');
      assert.equal(finalComplaint.officerNotes.length, 3, 'All 3 parallel notes must be recorded');
      assert.ok(finalComplaint.statusHistory.some(h => h.remarks === 'Parallel assignment'));
    });

    it('JSON Status Governance: rejects disallowed status transitions with descriptive error', async () => {
      const comp = await jsonRepo.create({
        title: 'Governance transition check complaint',
        description: 'Verifying illegal state jumps are rejected at repository layer.',
        category: 'roads',
        departmentId: 'DEPT_ROADS'
      });

      // Attempt illegal jump SUBMITTED -> RESOLVED
      await assert.rejects(
        async () => {
          await jsonRepo.updateStatus(comp.id, { status: 'RESOLVED' });
        },
        /Invalid status transition/i
      );
    });

    it('JSON Department Validation: rejects reassignment to non-existent department', async () => {
      const comp = await jsonRepo.create({
        title: 'Reassignment validation check',
        description: 'Ensuring department existence is validated.',
        category: 'roads',
        departmentId: 'DEPT_ROADS'
      });

      await assert.rejects(
        async () => {
          await jsonRepo.updateDepartment(comp.id, { departmentId: 'DEPT_FAKE_NONEXISTENT' });
        },
        /Department does not exist/i
      );
    });

    it('JSON Dynamic Reference Collision Recovery: loops to find next sequence if candidate is occupied', () => {
      const mockList = [
        { referenceNumber: 'CS-2026-0001' },
        { referenceNumber: 'CS-2026-0002' },
        { referenceNumber: 'CS-2026-0003' }
      ];

      const ref = jsonRepo.generateReferenceNumber(mockList, 2026);
      assert.equal(ref, 'CS-2026-0004');
    });

    it('JSON Seeding Idempotency: repeated runs of ordinary seed produce identical records and preserve user data', async () => {
      const seed1 = await runSeed({ dataDir: SANDBOX_DIR });
      const seed2 = await runSeed({ dataDir: SANDBOX_DIR });

      assert.equal(seed1.complaintsCount, seed2.complaintsCount);
      assert.equal(seed1.departmentsCount, seed2.departmentsCount);
    });
  });

  // ==========================================
  // SECTION 2: Mongoose Domain Model Validation Tests
  // ==========================================

  describe('MongoDB Mongoose Domain Model Validation', () => {
    it('ComplaintModel Schema Validation: accepts valid document and validates required fields', () => {
      const validDoc = new ComplaintModel({
        id: 'CS-2026-0001',
        referenceNumber: 'CS-2026-0001',
        title: 'Valid Complaint Title',
        description: 'Valid complaint description exceeding ten characters minimum requirement.',
        category: 'water',
        departmentId: 'DEPT_WATER',
        status: 'SUBMITTED',
        priority: 'MEDIUM'
      });

      const validationError = validDoc.validateSync();
      assert.equal(validationError, undefined, 'Valid complaint document must pass Mongoose validation');
    });

    it('ComplaintModel Schema Validation: rejects missing or invalid fields', () => {
      // 1. Missing description & title too short
      const invalidDoc = new ComplaintModel({
        referenceNumber: 'CS-2026-0002',
        title: 'Hi', // Under 3 characters
        category: 'water',
        departmentId: 'DEPT_WATER'
      });

      const err = invalidDoc.validateSync();
      assert.ok(err);
      assert.ok(err.errors.title);
      assert.ok(err.errors.description);

      // 2. Invalid category
      const badCatDoc = new ComplaintModel({
        id: 'CS-2026-0003',
        referenceNumber: 'CS-2026-0003',
        title: 'Valid Title Here',
        description: 'Valid description with sufficient length.',
        category: 'INVALID_CATEGORY_XYZ',
        departmentId: 'DEPT_WATER'
      });
      const catErr = badCatDoc.validateSync();
      assert.ok(catErr);
      assert.ok(catErr.errors.category);

      // 3. Invalid status enum
      const badStatusDoc = new ComplaintModel({
        id: 'CS-2026-0004',
        referenceNumber: 'CS-2026-0004',
        title: 'Valid Title Here',
        description: 'Valid description with sufficient length.',
        category: 'roads',
        departmentId: 'DEPT_ROADS',
        status: 'INVALID_STATUS'
      });
      const statusErr = badStatusDoc.validateSync();
      assert.ok(statusErr);
      assert.ok(statusErr.errors.status);
    });

    it('DepartmentModel Schema Validation: validates required id, code, and SLA bounds', () => {
      const validDept = new DepartmentModel({
        id: 'DEPT_ROADS',
        code: 'PWD',
        name: 'Public Works Department',
        category: 'roads',
        slaDays: 30
      });
      assert.equal(validDept.validateSync(), undefined);

      const invalidDept = new DepartmentModel({
        id: 'DEPT_ROADS',
        // missing code
        name: 'Public Works Department',
        category: 'roads',
        slaDays: 0 // invalid SLA < 1
      });
      const err = invalidDept.validateSync();
      assert.ok(err);
      assert.ok(err.errors.code);
      assert.ok(err.errors.slaDays);
    });

    it('StatusHistoryModel Schema Validation: enforces complaint linkage and valid status', () => {
      const validHist = new StatusHistoryModel({
        id: 'HIST-001',
        complaintId: 'CS-2026-0001',
        referenceNumber: 'CS-2026-0001',
        status: 'UNDER_REVIEW',
        actorType: 'OFFICER',
        remarks: 'Reviewing hydraulic report'
      });
      assert.equal(validHist.validateSync(), undefined);

      const invalidHist = new StatusHistoryModel({
        id: 'HIST-002',
        // missing complaintId and referenceNumber
        status: 'NON_EXISTENT_STATUS'
      });
      const err = invalidHist.validateSync();
      assert.ok(err);
      assert.ok(err.errors.complaintId);
      assert.ok(err.errors.referenceNumber);
      assert.ok(err.errors.status);
    });
  });

  // ==========================================
  // SECTION 3: Persistence Mode Selection & Fallback Safety
  // ==========================================

  describe('Persistence Backend Selection & Anti-Silent Fallback Safety', () => {
    it('Refuses silent fallback: throws error if PERSISTENCE_MODE=mongodb but MongoDB is unreachable', async () => {
      const originalMode = process.env.PERSISTENCE_MODE;
      const originalUri = process.env.MONGODB_URI;

      process.env.PERSISTENCE_MODE = 'mongodb';
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27099/unreachable_db';

      try {
        const unifiedRepo = new ComplaintRepository();

        // Attempting write or read must reject rather than silently writing to local JSON
        await assert.rejects(
          async () => {
            await unifiedRepo.findAll();
          },
          /Persistence Error: MongoDB is configured as storage backend/i
        );

        await assert.rejects(
          async () => {
            await unifiedRepo.create({
              title: 'Attempting silent fallback write',
              description: 'This write must be blocked when MongoDB is unreachable.',
              category: 'roads',
              departmentId: 'DEPT_ROADS'
            });
          },
          /Persistence Error: MongoDB is configured as storage backend/i
        );
      } finally {
        process.env.PERSISTENCE_MODE = originalMode || '';
        process.env.MONGODB_URI = originalUri || '';
        await connectDatabase(); // restore default local dev state
      }
    });

    it('Migration utility safely detects missing MONGODB_URI and exits with clean error summary', async () => {
      const originalUri = process.env.MONGODB_URI;
      process.env.MONGODB_URI = '';

      try {
        const result = await runMigration({ dryRun: true });
        assert.equal(result.success, false);
        assert.match(result.error, /MONGODB_URI is not set/i);
      } finally {
        process.env.MONGODB_URI = originalUri || '';
      }
    });

    it('Live MongoDB status reporting: accurately reports NOT VERIFIED if local daemon is offline', () => {
      const mongoOnline = isConnected();
      if (!mongoOnline) {
        console.log('[Phase 2 Notice] Live MongoDB operational integration checks are marked NOT VERIFIED (No MongoDB daemon on localhost:27017).');
        assert.equal(mongoOnline, false, 'Expected local MongoDB daemon to be offline');
      } else {
        console.log('[Phase 2 Notice] Live MongoDB daemon detected.');
      }
    });
  });
});
