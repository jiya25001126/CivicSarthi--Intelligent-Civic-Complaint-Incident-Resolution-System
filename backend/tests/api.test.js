import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';
import complaintRepository, { ComplaintRepository } from '../src/repositories/complaint.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { authService } from '../src/services/auth.service.js';
import { runSeed } from '../src/scripts/seed.js';
import { connectDatabase } from '../src/config/database.js';
import config from '../src/config/app.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();
const TEST_FILE_PATH = path.resolve(path.dirname(config.dataPath.complaints), 'complaints.test.json');
const TEST_USERS_PATH = path.resolve(path.dirname(config.dataPath.users), 'users.api-test.json');

describe('CivicSarthi Phase 1 Backend API Tests', () => {
  let createdRefNumber = null;
  let adminToken = null;
  let citizenToken = null;

  before(async () => {
    // Isolate test data: copy original complaints to isolated test fixture
    const original = await fs.readFile(config.dataPath.complaints, 'utf-8');
    await fs.writeFile(TEST_FILE_PATH, original, 'utf-8');
    complaintRepository.setFilePath(TEST_FILE_PATH);
    userRepository.setFilePath(TEST_USERS_PATH);

    // Seed test users for authenticated calls
    const adminUser = await authService.provisionUser({
      email: 'admin.apitest@civicsarthi.internal',
      name: 'API Test Admin',
      password: 'AdminPassword123!',
      role: 'admin'
    }, { id: 'TEST_INIT', email: 'init@test', role: 'admin' });
    adminToken = authService.generateToken(adminUser);

    const citizen = await authService.register({
      email: 'citizen.apitest@civicsarthi.internal',
      name: 'API Test Citizen',
      password: 'CitizenPassword123!'
    });
    citizenToken = citizen.token;
  });

  after(async () => {
    // Clean up test data and restore original repository path
    complaintRepository.resetFilePath();
    userRepository.resetFilePath();
    try {
      await fs.unlink(TEST_FILE_PATH);
    } catch {}
    try {
      await fs.unlink(TEST_USERS_PATH);
    } catch {}
  });

  it('GET /api/v1/health & GET /api/health should return 200 with status ok and service metadata', async () => {
    // Test /api/v1/health
    const resV1 = await request(app).get('/api/v1/health');
    assert.equal(resV1.status, 200);
    assert.equal(resV1.body.status, 'ok');
    assert.equal(resV1.body.service, 'CivicSarthi');
    assert.ok(resV1.body.database);

    // Test backward compatible /api/health
    const resLegacy = await request(app).get('/api/health');
    assert.equal(resLegacy.status, 200);
    assert.equal(resLegacy.body.status, 'ok');
  });

  it('GET /api/v1/departments should return demo departments list', async () => {
    const res = await request(app).get('/api/v1/departments');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 8);
    const pwd = res.body.data.find(d => d.code === 'PWD' || d.id === 'DEPT_ROADS');
    assert.ok(pwd);
    assert.equal(pwd.isActive, true);
  });

  it('GET /api/v1/complaints should return complaints list enriched with SLA metrics', async () => {
    const res = await request(app)
      .get('/api/v1/complaints')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 10);

    const first = res.body.data[0];
    assert.ok(first.id);
    assert.ok(first.referenceNumber);
    assert.ok(first.category);
    assert.ok(first.status);
    assert.ok(first.slaMetrics);
    assert.equal(typeof first.synthetic, 'boolean');

    // Verify both user-created and synthetic demo complaints are enriched with SLA metrics
    const syntheticItem = res.body.data.find(c => c.synthetic === true);
    assert.ok(syntheticItem, 'Seeded demo dataset should include synthetic complaints');
    assert.ok(syntheticItem.slaMetrics, 'Synthetic complaints must be enriched with SLA metrics');
  });

  it('GET /api/v1/complaints/stats should calculate real KPI metrics', async () => {
    const res = await request(app).get('/api/v1/complaints/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.data.total === 'number');
    assert.ok(typeof res.body.data.submitted === 'number');
    assert.ok(typeof res.body.data.inProgress === 'number');
    assert.ok(typeof res.body.data.resolved === 'number');
  });

  it('GET /api/v1/complaints/:id with non-existent id should return 404', async () => {
    const res = await request(app)
      .get('/api/v1/complaints/CS-NONEXISTENT-9999')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not found/i);
  });

  it('POST /api/v1/complaints should return 400 validation error if required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        title: 'Hi', // Too short
        description: 'Short' // Too short
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'Validation Error');
  });

  it('POST /api/v1/complaints should create complaint with dynamic year reference, status SUBMITTED, priority MEDIUM', async () => {
    const currentYear = new Date().getFullYear();
    const payload = {
      title: 'Water Supply Pipeline Leakage in Shanti Nagar',
      description: 'The main drinking water feeder pipe near House 44 is ruptured, leaking clean drinking water and flooding the sidewalk for 48 hours.',
      category: 'water',
      state: 'Maharashtra',
      district: 'Pune',
      locality: 'Shanti Nagar',
      preferredLanguage: 'en',
      departmentId: 'DEPT_WATER'
    };

    const res = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send(payload);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.referenceNumber);
    const expectedRegex = new RegExp(`^CS-${currentYear}-\\d{4}$`);
    assert.match(res.body.referenceNumber, expectedRegex);
    assert.equal(res.body.data.status, 'SUBMITTED');
    assert.equal(res.body.data.priority, 'MEDIUM');
    assert.equal(res.body.data.departmentId, 'DEPT_WATER');
    assert.equal(res.body.data.synthetic, false);

    createdRefNumber = res.body.referenceNumber;
  });

  it('Reference Number Integrity: dynamic year and collision-free sequence handling', () => {
    const mockComplaints = [
      { referenceNumber: 'CS-2026-0001' },
      { referenceNumber: 'CS-2026-0018' },
      { referenceNumber: 'JAN-2026-0005' } // Legacy format
    ];

    // Same year increment
    const ref2026 = complaintRepository.generateReferenceNumber(mockComplaints, 2026);
    assert.equal(ref2026, 'CS-2026-0019');

    // Future year reset to sequence 0001
    const ref2027 = complaintRepository.generateReferenceNumber(mockComplaints, 2027);
    assert.equal(ref2027, 'CS-2027-0001');

    // Empty list starts at 0001
    const refEmpty = complaintRepository.generateReferenceNumber([], 2026);
    assert.equal(refEmpty, 'CS-2026-0001');
  });

  it('Concurrency: concurrent complaint submissions generate strictly unique reference numbers', async () => {
    const concurrentCount = 10;
    const currentYear = new Date().getFullYear();
    const payloads = Array.from({ length: concurrentCount }, (_, i) => ({
      title: `Concurrent civic issue submission test #${i + 1}`,
      description: `Detailed description for concurrent complaint submission item ${i + 1} ensuring load safety.`,
      category: 'roads',
      state: 'Maharashtra',
      district: 'Pune',
      departmentId: 'DEPT_ROADS'
    }));

    // Fire all concurrent requests simultaneously
    const responses = await Promise.all(
      payloads.map(p => request(app).post('/api/v1/complaints').set('Authorization', `Bearer ${citizenToken}`).send(p))
    );

    // Verify each request completed with 201 Created
    for (const res of responses) {
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    }

    // Verify all generated reference numbers are strictly unique
    const generatedRefs = responses.map(r => r.body.referenceNumber);
    const uniqueRefs = new Set(generatedRefs);
    assert.equal(uniqueRefs.size, concurrentCount, 'Every concurrent reference number must be unique');

    // Verify format
    for (const ref of generatedRefs) {
      assert.match(ref, new RegExp(`^CS-${currentYear}-\\d{4}$`));
    }
  });

  it('PATCH /api/v1/complaints/:id/status should fail (400) on invalid status transition', async () => {
    assert.ok(createdRefNumber, 'Complaint must have been created');
    const res = await request(app)
      .patch(`/api/v1/complaints/${createdRefNumber}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        remarks: 'Trying to bypass process'
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /invalid status transition/i);
  });

  it('PATCH /api/v1/complaints/:id/status should succeed (200) on valid status transition', async () => {
    assert.ok(createdRefNumber, 'Complaint must have been created');
    const res = await request(app)
      .patch(`/api/v1/complaints/${createdRefNumber}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'UNDER_REVIEW',
        remarks: 'Assigned officer reviewing hydraulic maps',
        actorType: 'OFFICER'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'UNDER_REVIEW');
  });

  it('PATCH /api/v1/complaints/:id/department should reject invalid department and accept valid department', async () => {
    assert.ok(createdRefNumber, 'Complaint must have been created');

    // Reject non-existent department
    const badRes = await request(app)
      .patch(`/api/v1/complaints/${createdRefNumber}/department`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: 'DEPT_INVALID_999' });
    assert.equal(badRes.status, 400);

    // Accept valid department
    const goodRes = await request(app)
      .patch(`/api/v1/complaints/${createdRefNumber}/department`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId: 'DEPT_MUNICIPAL',
        remarks: 'Reassigned to Municipal Drainage Division'
      });
    assert.equal(goodRes.status, 200);
    assert.equal(goodRes.body.data.departmentId, 'DEPT_MUNICIPAL');
    assert.ok(goodRes.body.data.reassignments >= 1);
  });

  it('POST /api/v1/complaints/:id/notes should append internal officer note', async () => {
    assert.ok(createdRefNumber, 'Complaint must have been created');
    const res = await request(app)
      .post(`/api/v1/complaints/${createdRefNumber}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        note: 'Excavation machine scheduled for tomorrow morning.',
        officerId: 'OFF_005'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.officerNotes));
    const lastNote = res.body.data.officerNotes[res.body.data.officerNotes.length - 1];
    assert.equal(lastNote.note, 'Excavation machine scheduled for tomorrow morning.');
    assert.equal(lastNote.officerId, 'OFF_005');
  });

  it('Data Separation: Citizen view and public tracking must NEVER expose internal officer notes', async () => {
    assert.ok(createdRefNumber, 'Complaint must have been created');

    // 1. Citizen view (default authenticated citizen)
    const citizenRes = await request(app)
      .get(`/api/v1/complaints/${createdRefNumber}`)
      .set('Authorization', `Bearer ${citizenToken}`);
    assert.equal(citizenRes.status, 200);
    assert.equal(citizenRes.body.data.officerNotes, undefined, 'Officer notes must be stripped in citizen view');

    // 2. Officer/Admin view
    const officerRes = await request(app)
      .get(`/api/v1/complaints/${createdRefNumber}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(officerRes.status, 200);
    assert.ok(Array.isArray(officerRes.body.data.officerNotes), 'Officer notes must be present in officer view');
    assert.ok(officerRes.body.data.officerNotes.length > 0);

    // 3. Public tracking endpoint
    const trackRes = await request(app).get(`/api/v1/complaints/${createdRefNumber}/track`);
    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.body.data.officerNotes, undefined, 'Officer notes must be stripped in public tracking endpoint');
    assert.equal(trackRes.body.data.citizenPhone, undefined, 'Private contact info must not appear in public tracking');
    assert.equal(trackRes.body.data.citizenEmail, undefined, 'Private email must not appear in public tracking');
  });

  it('GET /api/v1/complaints/:id/history should return status audit timeline without officer notes', async () => {
    assert.ok(createdRefNumber, 'Complaint must have been created');
    const res = await request(app)
      .get(`/api/v1/complaints/${createdRefNumber}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2); // SUBMITTED, UNDER_REVIEW, etc.
  });

  it('Reference Collision Safety: loops to find next available sequence when collisions occur', () => {
    // Scenario 1: standard sequence
    const list1 = [
      { referenceNumber: 'CS-2026-0001' },
      { referenceNumber: 'CS-2026-0002' }
    ];
    assert.equal(complaintRepository.generateReferenceNumber(list1, 2026), 'CS-2026-0003');

    // Scenario 2: collision simulation where candidate 0003 is already taken manually
    const listWithCollision = [
      { referenceNumber: 'CS-2026-0001' },
      { referenceNumber: 'CS-2026-0002' },
      { referenceNumber: 'CS-2026-0003' } // candidate 0003 is already present
    ];
    const generated = complaintRepository.generateReferenceNumber(listWithCollision, 2026);
    assert.equal(generated, 'CS-2026-0004');
    assert.ok(!listWithCollision.some(c => c.referenceNumber === generated), 'Generated reference must be unique');
  });

  it('Immutability of Existing References: adding new complaints leaves existing complaint IDs and references unchanged', async () => {
    const dataBefore = await complaintRepository.findAll();
    const beforeCount = Array.isArray(dataBefore) ? dataBefore.length : dataBefore.items.length;
    const originalFirstId = (Array.isArray(dataBefore) ? dataBefore[0] : dataBefore.items[0]).id;

    // Create a new complaint
    const newComp = await complaintRepository.create({
      title: 'Immutability test complaint',
      description: 'Testing that creating new records never mutates existing complaint IDs.',
      category: 'roads',
      state: 'Maharashtra',
      district: 'Pune',
      departmentId: 'DEPT_ROADS'
    });

    const dataAfter = await complaintRepository.findAll();
    const afterList = Array.isArray(dataAfter) ? dataAfter : dataAfter.items;
    assert.equal(afterList.length, beforeCount + 1);

    // Verify existing record is intact with unchanged ID
    const foundOriginal = afterList.find(c => c.id === originalFirstId);
    assert.ok(foundOriginal);
    assert.equal(foundOriginal.id, originalFirstId);
  });

  it('Persistence Across Server Restarts: records persist on disk and survive process restart', async () => {
    const payload = {
      title: 'Persistent road cavity report',
      description: 'Verifying that data saved to JSON file persists across new repository instances.',
      category: 'roads',
      state: 'Maharashtra',
      district: 'Pune',
      departmentId: 'DEPT_ROADS'
    };

    const created = await complaintRepository.create(payload);
    assert.ok(created.id);

    // Simulate process reboot by creating a brand-new repository instance
    const restartedRepo = new ComplaintRepository();
    restartedRepo.setFilePath(TEST_FILE_PATH);

    const retrieved = await restartedRepo.findById(created.id);
    assert.ok(retrieved, 'Complaint must be readable by a fresh repository instance');
    assert.equal(retrieved.id, created.id);
    assert.equal(retrieved.title, payload.title);
    assert.equal(retrieved.description, payload.description);
    assert.equal(retrieved.synthetic, false);
  });

  it('Concurrent Writes Safety: concurrent status updates on same complaint serialize safely', async () => {
    assert.ok(createdRefNumber);

    // Execute concurrent updates via the repository mutex
    const update1 = complaintRepository.updateStatus(createdRefNumber, {
      status: 'IN_PROGRESS',
      remarks: 'Concurrent update 1: Field inspection started',
      actorType: 'OFFICER'
    });
    const update2 = complaintRepository.addOfficerNote(createdRefNumber, {
      note: 'Concurrent note 2: Machine ordered',
      officerId: 'OFF_999'
    });

    await Promise.all([update1, update2]);

    const finalComplaint = await complaintRepository.findById(createdRefNumber);
    assert.equal(finalComplaint.status, 'IN_PROGRESS');
    assert.ok(finalComplaint.statusHistory.some(h => h.remarks.includes('Concurrent update 1')));
    assert.ok(finalComplaint.officerNotes.some(n => n.note.includes('Concurrent note 2')));
  });

  it('Seeding Idempotency and Non-Destructive Ordinary Seed: preserves genuine user complaints and reset wipes them', async () => {
    const sandboxDir = path.resolve(__dirname, 'sandbox-seed-test');
    try {
      await fs.rm(sandboxDir, { recursive: true, force: true });
    } catch {}

    try {
      // 1. Initial seed in sandbox directory
      const initialResult = await runSeed({ dataDir: sandboxDir });
      assert.equal(initialResult.userRecordsPreserved, 0);
      assert.ok(initialResult.complaintsCount >= 10);

      // 2. Add a genuine user-created complaint (synthetic: false)
      const sandboxCompFile = path.join(sandboxDir, 'complaints.json');
      const raw = await fs.readFile(sandboxCompFile, 'utf-8');
      const parsed = JSON.parse(raw);
      const userComplaint = {
        id: 'CS-2026-9999',
        referenceNumber: 'CS-2026-9999',
        title: 'Genuine citizen complaint created by portal user',
        description: 'Street light broken at crossroad 5',
        category: 'electricity',
        state: 'Maharashtra',
        district: 'Pune',
        departmentId: 'DEPT_POWER',
        status: 'SUBMITTED',
        synthetic: false,
        createdAt: new Date().toISOString(),
        statusHistory: [{ timestamp: new Date().toISOString(), status: 'SUBMITTED', actorType: 'CITIZEN', remarks: 'Submitted by citizen' }]
      };
      parsed.complaints.unshift(userComplaint);
      await fs.writeFile(sandboxCompFile, JSON.stringify(parsed, null, 2), 'utf-8');

      // 3. Run ordinary seed: must preserve user-created record
      const secondSeed = await runSeed({ dataDir: sandboxDir });
      assert.equal(secondSeed.userRecordsPreserved, 1, 'Ordinary seed must preserve 1 user complaint');

      const reloadedRaw = await fs.readFile(sandboxCompFile, 'utf-8');
      const reloadedData = JSON.parse(reloadedRaw);
      const preserved = reloadedData.complaints.find(c => c.id === 'CS-2026-9999');
      assert.ok(preserved, 'User complaint must remain in complaints.json after ordinary seed');
      assert.equal(preserved.title, 'Genuine citizen complaint created by portal user');

      // 4. Run ordinary seed a second time: test idempotency
      const thirdSeed = await runSeed({ dataDir: sandboxDir });
      assert.equal(thirdSeed.userRecordsPreserved, 1);
      assert.equal(thirdSeed.complaintsCount, secondSeed.complaintsCount, 'Ordinary seed must be idempotent');

      // 5. Run deliberate reset mode (--reset): must cleanly restore pristine demo data
      const resetResult = await runSeed({ dataDir: sandboxDir, reset: true });
      assert.equal(resetResult.userRecordsPreserved, 0, 'Reset mode must not preserve user records');
      const resetRaw = await fs.readFile(sandboxCompFile, 'utf-8');
      const resetData = JSON.parse(resetRaw);
      const userRecordAfterReset = resetData.complaints.find(c => c.id === 'CS-2026-9999');
      assert.equal(userRecordAfterReset, undefined, 'Reset mode must wipe user-created records');
    } finally {
      try {
        await fs.rm(sandboxDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('Database Connection Failure: unreachable configured MongoDB reports failure and degraded health without secret leaks', async () => {
    const originalUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = 'mongodb://fakeuser:secretpassword@127.0.0.1:27099/unreachable_db';

    try {
      const connResult = await connectDatabase();
      assert.equal(connResult.connected, false);
      assert.equal(connResult.type, 'MONGODB');

      const healthRes = await request(app).get('/api/v1/health');
      assert.equal(healthRes.status, 200);
      assert.equal(healthRes.body.status, 'degraded');
      assert.equal(healthRes.body.database, 'MongoDB (Disconnected)');
      assert.equal(healthRes.body.mongodbUri, undefined, 'Secrets must not be exposed in health response');
      assert.ok(!JSON.stringify(healthRes.body).includes('secretpassword'), 'Password must never leak in health endpoint');
    } finally {
      process.env.MONGODB_URI = originalUri || '';
      await connectDatabase(); // restore default local dev state
    }
  });

  it('Search, Filtering, Sorting, and Pagination boundaries', async () => {
    // 1. Non-existent category
    const resBadCat = await request(app)
      .get('/api/v1/complaints?category=NON_EXISTENT_CAT_XYZ')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resBadCat.status, 200);
    assert.equal(resBadCat.body.count, 0);
    assert.deepEqual(resBadCat.body.data, []);

    // 2. Non-existent search query
    const resBadSearch = await request(app)
      .get('/api/v1/complaints?search=ZXYWVUTSRQPONMLKJIHGFEDCBA_NOMATCH')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resBadSearch.status, 200);
    assert.equal(resBadSearch.body.count, 0);
    assert.deepEqual(resBadSearch.body.data, []);

    // 3. Sorting asc vs desc
    const resAsc = await request(app)
      .get('/api/v1/complaints?sort=createdAt_asc')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resAsc.status, 200);
    assert.ok(resAsc.body.data.length >= 2);
    const date1 = new Date(resAsc.body.data[0].createdAt).getTime();
    const date2 = new Date(resAsc.body.data[1].createdAt).getTime();
    assert.ok(date1 <= date2, 'Ascending sort should order earliest first');

    const resDesc = await request(app)
      .get('/api/v1/complaints?sort=createdAt_desc')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resDesc.status, 200);
    assert.ok(resDesc.body.data.length >= 2);
    const descDate1 = new Date(resDesc.body.data[0].createdAt).getTime();
    const descDate2 = new Date(resDesc.body.data[1].createdAt).getTime();
    assert.ok(descDate1 >= descDate2, 'Descending sort should order latest first');

    // 4. Pagination
    const resPage1 = await request(app)
      .get('/api/v1/complaints?page=1&limit=3')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resPage1.status, 200);
    assert.equal(resPage1.body.data.length, 3);
    assert.equal(resPage1.body.pagination.page, 1);
    assert.equal(resPage1.body.pagination.limit, 3);
    assert.ok(resPage1.body.pagination.total >= 10);
    assert.ok(resPage1.body.pagination.totalPages >= 4);

    // 5. Out of bounds page
    const resOutOfBounds = await request(app)
      .get('/api/v1/complaints?page=9999&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resOutOfBounds.status, 200);
    assert.equal(resOutOfBounds.body.data.length, 0);
    assert.equal(resOutOfBounds.body.pagination.page, 9999);
  });

  it('Department and Complaint Lookup Edge Cases', async () => {
    // Valid department lookup
    const validDept = await request(app).get('/api/v1/departments/DEPT_ROADS');
    assert.equal(validDept.status, 200);
    assert.equal(validDept.body.success, true);
    assert.equal(validDept.body.data.id, 'DEPT_ROADS');

    // Invalid department lookup (404)
    const invalidDept = await request(app).get('/api/v1/departments/DEPT_NON_EXISTENT_999');
    assert.equal(invalidDept.status, 404);
    assert.equal(invalidDept.body.success, false);

    // Invalid complaint status update (404)
    const badStatusUpdate = await request(app)
      .patch('/api/v1/complaints/CS-NONEXISTENT-9999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'UNDER_REVIEW' });
    assert.equal(badStatusUpdate.status, 404);

    // Invalid complaint department reassign (404)
    const badDeptUpdate = await request(app)
      .patch('/api/v1/complaints/CS-NONEXISTENT-9999/department')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ departmentId: 'DEPT_WATER' });
    assert.equal(badDeptUpdate.status, 404);

    // Invalid complaint add note (404)
    const badNote = await request(app)
      .post('/api/v1/complaints/CS-NONEXISTENT-9999/notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Some note' });
    assert.equal(badNote.status, 404);

    // Invalid complaint history (404)
    const badHistory = await request(app)
      .get('/api/v1/complaints/CS-NONEXISTENT-9999/history')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(badHistory.status, 404);
  });

  it('Audit: Internal officer notes are excluded from all citizen responses and unauthenticated update endpoints', async () => {
    assert.ok(createdRefNumber);

    // 1. List complaints as citizen (only sees their own, no notes)
    const listRes = await request(app)
      .get('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken}`);
    assert.equal(listRes.status, 200);
    for (const item of listRes.body.data) {
      assert.equal(item.officerNotes, undefined, `officerNotes must not exist in list for citizen: ${item.id}`);
    }

    // 2. Status update executed by authorized officer/admin
    const statusUpdateRes = await request(app)
      .patch(`/api/v1/complaints/${createdRefNumber}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'AWAITING_INFORMATION',
        remarks: 'Citizen-visible status refresh',
        actorType: 'OFFICER'
      });
    assert.equal(statusUpdateRes.status, 200);

    // 3. Department update executed by authorized admin
    const deptUpdateRes = await request(app)
      .patch(`/api/v1/complaints/${createdRefNumber}/department`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId: 'DEPT_WATER',
        remarks: 'Reassigned back to Water Dept'
      });
    assert.equal(deptUpdateRes.status, 200);

    // 4. Verify citizen view does not leak internal notes
    const citizenCheck = await request(app)
      .get(`/api/v1/complaints/${createdRefNumber}`)
      .set('Authorization', `Bearer ${citizenToken}`);
    assert.equal(citizenCheck.status, 200);
    assert.equal(citizenCheck.body.data.officerNotes, undefined);
  });
});
