import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { complaintRepository } from '../src/repositories/complaint.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import { JsonComplaintRepository } from '../src/repositories/complaint.json.repository.js';
import { authService } from '../src/services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();

const TEST_DIR = path.resolve(__dirname, 'sandbox-citizen-test');
const TEST_USERS_PATH = path.resolve(TEST_DIR, 'users.test.json');
const TEST_COMPLAINTS_PATH = path.resolve(TEST_DIR, 'complaints.test.json');
const TEST_AUDIT_PATH = path.resolve(TEST_DIR, 'audit_logs.test.json');

describe('CivicSarthi Phase 4 Citizen Grievance Submission and Tracking Tests', () => {
  let citizenAToken = null;
  let citizenBToken = null;
  let officerToken = null;

  let citizenAId = null;
  let citizenBId = null;
  let officerId = null;

  let createdComplaintA = null;

  before(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });

    // Isolate repositories to test sandbox
    userRepository.setFilePath(TEST_USERS_PATH);
    complaintRepository.setFilePath(TEST_COMPLAINTS_PATH);
    auditLogRepository.setFilePath(TEST_AUDIT_PATH);

    // Initialize clean complaints file
    await fs.writeFile(
      TEST_COMPLAINTS_PATH,
      JSON.stringify({ metadata: { version: '1.0.0' }, complaints: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      TEST_USERS_PATH,
      JSON.stringify({ metadata: { version: '1.0.0' }, users: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      TEST_AUDIT_PATH,
      JSON.stringify({ metadata: { version: '1.0.0' }, logs: [] }, null, 2),
      'utf-8'
    );

    // Create test accounts
    const citizenA = await authService.register({
      name: 'Ramesh Sharma',
      email: 'ramesh.sharma@example.test',
      password: 'ValidPassword123!'
    });
    citizenAId = citizenA.user.id;
    citizenAToken = citizenA.token;

    const citizenB = await authService.register({
      name: 'Priya Patil',
      email: 'priya.patil@example.test',
      password: 'ValidPassword123!'
    });
    citizenBId = citizenB.user.id;
    citizenBToken = citizenB.token;

    const officer = await authService.provisionUser({
      name: 'Officer Deshmukh',
      email: 'officer.deshmukh@civicsarthi.internal',
      role: 'officer',
      departmentId: 'DEPT_ROADS',
      password: 'OfficerSecurePass123!'
    }, { id: 'SYSTEM_TEST_INIT', email: 'test@init', role: 'admin' });
    officerId = officer.id;
    officerToken = (await authService.login({
      email: 'officer.deshmukh@civicsarthi.internal',
      password: 'OfficerSecurePass123!'
    })).token;
  });

  after(async () => {
    // Reset file paths to default config
    userRepository.resetFilePath();
    complaintRepository.resetFilePath();
    auditLogRepository.resetFilePath();

    // Clean up sandbox files
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('1. Authenticated citizen submits a valid grievance successfully (201)', async () => {
    const res = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'Deep pothole cluster causing vehicle damage',
        description: 'Large series of potholes on MG Road near Shivaji Chowk causing traffic blockages and accidents.',
        category: 'roads',
        state: 'Maharashtra',
        district: 'Pune',
        locality: 'Shivaji Chowk, MG Road',
        preferredLanguage: 'en',
        evidence: ['pothole_photo_01.jpg']
      });

    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true);
    assert.ok(res.body.referenceNumber, 'Should contain referenceNumber');
    assert.match(res.body.referenceNumber, /^CS-\d{4}-\d{4}$/, 'Reference number should match CS-YYYY-XXXX format');

    createdComplaintA = res.body.data;
    assert.equal(createdComplaintA.title, 'Deep pothole cluster causing vehicle damage');
    assert.equal(createdComplaintA.status, 'SUBMITTED');
    assert.ok(createdComplaintA.statusDescription, 'Should include citizen-friendly status explanation');
    assert.equal(createdComplaintA.citizenId, citizenAId);
    assert.equal(Array.isArray(createdComplaintA.statusHistory), true);
    assert.equal(createdComplaintA.statusHistory.length, 1);
    assert.equal(createdComplaintA.statusHistory[0].status, 'SUBMITTED');
    assert.equal(createdComplaintA.statusHistory[0].actorType, 'CITIZEN');
  });

  it('2. Missing or invalid required fields are rejected with 400', async () => {
    // Short title
    const resShortTitle = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'No',
        description: 'This is a sufficiently long description for testing purposes.',
        category: 'roads',
        state: 'Maharashtra',
        district: 'Pune'
      });
    assert.equal(resShortTitle.status, 400);

    // Missing state and district
    const resMissingLocation = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'Valid title for testing',
        description: 'This is a sufficiently long description for testing purposes.',
        category: 'roads'
      });
    assert.equal(resMissingLocation.status, 400);
  });

  it('3. Empty, whitespace-only, and excessively long descriptions are rejected (400)', async () => {
    // Whitespace only description
    const resWhitespace = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'Valid title for testing',
        description: '          ',
        category: 'roads',
        state: 'Maharashtra',
        district: 'Pune'
      });
    assert.equal(resWhitespace.status, 400);

    // Excessively long description (> 3000 chars)
    const longDesc = 'a'.repeat(3005);
    const resLong = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'Valid title for testing',
        description: longDesc,
        category: 'roads',
        state: 'Maharashtra',
        district: 'Pune'
      });
    assert.equal(resLong.status, 400);
  });

  it('4. Unsafe evidence filenames containing directory traversal are rejected (400)', async () => {
    const resTraversal = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'Valid title for testing',
        description: 'Valid narrative about public infrastructure condition.',
        category: 'roads',
        state: 'Maharashtra',
        district: 'Pune',
        evidence: ['../../etc/passwd']
      });
    assert.equal(resTraversal.status, 400);
    const detailMsg = JSON.stringify(resTraversal.body.details || resTraversal.body);
    assert.match(detailMsg, /Evidence/i);
  });

  it('5. Server-generated complaint IDs and tracking references are unique', async () => {
    const res2 = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'Streetlight pole fallen across footpath',
        description: 'Electric supply pole broken after storm near bus stand.',
        category: 'electricity',
        state: 'Maharashtra',
        district: 'Pune'
      });

    assert.equal(res2.status, 201);
    assert.notEqual(res2.body.referenceNumber, createdComplaintA.referenceNumber);
  });

  it('6. Client-supplied citizenId or elevated status in payload cannot spoof identity', async () => {
    const res = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'Spoof attempt payload',
        description: 'Citizen trying to pass foreign citizenId and resolved status.',
        category: 'water',
        state: 'Maharashtra',
        district: 'Pune',
        citizenId: citizenBId, // Malicious attempt to file under Citizen B
        status: 'RESOLVED',     // Malicious attempt to self-resolve
        officerNotes: [{ note: 'Fake officer note' }]
      });

    assert.equal(res.status, 201);
    // Identity must strictly belong to authenticated user (citizenAId)
    assert.equal(res.body.data.citizenId, citizenAId);
    assert.equal(res.body.data.status, 'SUBMITTED');
    assert.equal(res.body.data.officerNotes, undefined);
  });

  it('7. Unauthenticated access to complaint submission returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/complaints')
      .send({
        title: 'Unauthenticated submission',
        description: 'Should fail with 401 error',
        category: 'roads',
        state: 'Maharashtra',
        district: 'Pune'
      });

    assert.equal(res.status, 401);
  });

  it('8. Officers cannot submit complaints using citizen endpoint (403)', async () => {
    const res = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        title: 'Officer trying to lodge complaint',
        description: 'Officers must not file complaints via citizen submission endpoint.',
        category: 'roads',
        state: 'Maharashtra',
        district: 'Pune'
      });

    assert.equal(res.status, 403);
    assert.match(res.body.error, /officer/i);
  });

  it('9. Static route GET /api/v1/complaints/my is not broken by dynamic /:id route ordering', async () => {
    const res = await request(app)
      .get('/api/v1/complaints/my')
      .set('Authorization', `Bearer ${citizenAToken}`);

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2, 'Citizen A should have at least 2 filed complaints');
  });

  it('10. Citizen B listing complaints via /my sees only their own complaints (isolation)', async () => {
    const res = await request(app)
      .get('/api/v1/complaints/my')
      .set('Authorization', `Bearer ${citizenBToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0, 'Citizen B has filed 0 complaints');
  });

  it('11. Citizen cannot retrieve another citizen private complaint (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/complaints/${createdComplaintA.id}`)
      .set('Authorization', `Bearer ${citizenBToken}`);

    assert.equal(res.status, 403);
    assert.match(res.body.error, /permission|denied/i);
  });

  it('12. Citizen cannot retrieve another citizen status history (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/complaints/${createdComplaintA.id}/history`)
      .set('Authorization', `Bearer ${citizenBToken}`);

    assert.equal(res.status, 403);
  });

  it('13. Citizen retrieving own complaint receives citizen-friendly description and no officer notes', async () => {
    const res = await request(app)
      .get(`/api/v1/complaints/${createdComplaintA.id}`)
      .set('Authorization', `Bearer ${citizenAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, createdComplaintA.id);
    assert.ok(res.body.data.statusDescription, 'Should include citizen status explanation');
    assert.equal(res.body.data.officerNotes, undefined, 'Officer notes must not be exposed to citizen');
  });

  it('14. Public tracking via /track/:reference works without auth and strips private PII', async () => {
    const res = await request(app)
      .get(`/api/v1/complaints/track/${createdComplaintA.referenceNumber}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;

    // Allowed public tracking fields
    assert.equal(data.referenceNumber, createdComplaintA.referenceNumber);
    assert.equal(data.title, createdComplaintA.title);
    assert.equal(data.status, 'SUBMITTED');
    assert.ok(data.statusDescription);
    assert.equal(Array.isArray(data.statusHistory), true);
    assert.ok(data.statusHistory[0].statusDescription);

    // Private fields must be strictly omitted
    assert.equal(data.citizenId, undefined, 'citizenId must NOT be exposed in public tracking');
    assert.equal(data.citizenName, undefined, 'citizenName must NOT be exposed in public tracking');
    assert.equal(data.citizenEmail, undefined, 'citizenEmail must NOT be exposed in public tracking');
    assert.equal(data.citizenPhone, undefined, 'citizenPhone must NOT be exposed in public tracking');
    assert.equal(data.officerNotes, undefined, 'officerNotes must NOT be exposed in public tracking');
    assert.equal(data.assignedOfficerId, undefined, 'assignedOfficerId must NOT be exposed in public tracking');
  });

  it('15. Public tracking via /:id/track remains backward compatible', async () => {
    const res = await request(app)
      .get(`/api/v1/complaints/${createdComplaintA.referenceNumber}/track`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.referenceNumber, createdComplaintA.referenceNumber);
    assert.equal(res.body.data.citizenId, undefined);
  });

  it('16. Public tracking returns 404 for non-existent reference without leaking internal errors', async () => {
    const res = await request(app)
      .get('/api/v1/complaints/track/CS-2026-9999');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not found/i);
    assert.equal(res.body.stack, undefined);
  });

  it('17. Idempotency key prevents duplicate records on repeat submissions', async () => {
    const idempotencyKey = `TEST-IDEM-${Date.now()}`;

    // First attempt
    const res1 = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        title: 'Street drainage overflow on 5th Avenue',
        description: 'Monsoon drainage is overflowing onto residential sidewalks.',
        category: 'water',
        state: 'Maharashtra',
        district: 'Pune'
      });

    assert.equal(res1.status, 201);
    const ref1 = res1.body.referenceNumber;

    // Second attempt with identical idempotency key
    const res2 = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        title: 'Street drainage overflow on 5th Avenue',
        description: 'Monsoon drainage is overflowing onto residential sidewalks.',
        category: 'water',
        state: 'Maharashtra',
        district: 'Pune'
      });

    assert.equal(res2.status, 201);
    assert.equal(res2.body.referenceNumber, ref1, 'Should return the identical created grievance reference');

    // Verify only one record was inserted into repository
    const listRes = await request(app)
      .get('/api/v1/complaints/my')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .query({ search: '5th Avenue' });

    assert.equal(listRes.body.data.length, 1, 'Only one record should exist in persistence');
  });

  it('18. JSON persistence survives fresh repository instantiation without data loss', async () => {
    const freshRepo = new JsonComplaintRepository(TEST_COMPLAINTS_PATH);
    const persisted = await freshRepo.findById(createdComplaintA.referenceNumber);

    assert.ok(persisted, 'Complaint should be found in fresh repository instance');
    assert.equal(persisted.referenceNumber, createdComplaintA.referenceNumber);
    assert.equal(persisted.citizenId, citizenAId);
    assert.equal(persisted.statusHistory.length, 1);
  });
});
