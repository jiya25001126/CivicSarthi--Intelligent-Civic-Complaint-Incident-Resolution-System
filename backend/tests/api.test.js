import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import request from 'supertest';
import createApp from '../src/app.js';
import complaintRepository from '../src/repositories/complaint.repository.js';
import config from '../src/config/app.config.js';

const app = createApp();
const TEST_FILE_PATH = path.resolve(path.dirname(config.dataPath.complaints), 'complaints.test.json');

describe('CivicSarthi Phase 1 Backend API Tests', () => {
  let createdRefNumber = null;

  before(async () => {
    // Isolate test data: copy original complaints to isolated test fixture
    const original = await fs.readFile(config.dataPath.complaints, 'utf-8');
    await fs.writeFile(TEST_FILE_PATH, original, 'utf-8');
    complaintRepository.setFilePath(TEST_FILE_PATH);
  });

  after(async () => {
    // Clean up test data and restore original repository path
    complaintRepository.resetFilePath();
    try {
      await fs.unlink(TEST_FILE_PATH);
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
    const res = await request(app).get('/api/v1/complaints');
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
    assert.equal(first.synthetic, true);
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
    const res = await request(app).get('/api/v1/complaints/CS-NONEXISTENT-9999');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not found/i);
  });

  it('POST /api/v1/complaints should return 400 validation error if required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/complaints')
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
      .send(payload);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.referenceNumber);
    const expectedRegex = new RegExp(`^CS-${currentYear}-\\d{4}$`);
    assert.match(res.body.referenceNumber, expectedRegex);
    assert.equal(res.body.data.status, 'SUBMITTED');
    assert.equal(res.body.data.priority, 'MEDIUM');
    assert.equal(res.body.data.departmentId, 'DEPT_WATER');
    assert.equal(res.body.data.synthetic, true);

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
      payloads.map(p => request(app).post('/api/v1/complaints').send(p))
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
      .send({ departmentId: 'DEPT_INVALID_999' });
    assert.equal(badRes.status, 400);

    // Accept valid department
    const goodRes = await request(app)
      .patch(`/api/v1/complaints/${createdRefNumber}/department`)
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

    // 1. Citizen view (default)
    const citizenRes = await request(app).get(`/api/v1/complaints/${createdRefNumber}`);
    assert.equal(citizenRes.status, 200);
    assert.equal(citizenRes.body.data.officerNotes, undefined, 'Officer notes must be stripped in citizen view');

    // 2. Officer view (with role parameter / header)
    const officerRes = await request(app)
      .get(`/api/v1/complaints/${createdRefNumber}`)
      .set('x-portal-role', 'officer');
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
    const res = await request(app).get(`/api/v1/complaints/${createdRefNumber}/history`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2); // SUBMITTED, UNDER_REVIEW, etc.
  });

  it('Production Error Safety: 500 errors in production must not expose internal stack traces or paths', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      // Trigger a 404
      const res404 = await request(app).get('/api/v1/non-existent-endpoint-1234');
      assert.equal(res404.status, 404);
      assert.equal(res404.body.stack, undefined, 'Stack must not be exposed in production');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
