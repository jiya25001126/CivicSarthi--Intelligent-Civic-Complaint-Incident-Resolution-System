import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import createApp from '../src/app.js';

const app = createApp();

describe('JanSahay Phase 1 Backend API Tests', () => {
  let createdRefNumber = null;

  it('GET /api/v1/health & GET /api/health should return 200 with status ok and service metadata', async () => {
    // Test /api/v1/health
    const resV1 = await request(app).get('/api/v1/health');
    assert.equal(resV1.status, 200);
    assert.equal(resV1.body.status, 'ok');
    assert.equal(resV1.body.service, 'JanSahay');
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
    const res = await request(app).get('/api/v1/complaints/JAN-NONEXISTENT-9999');
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

  it('POST /api/v1/complaints should create complaint with reference number, status SUBMITTED, priority MEDIUM', async () => {
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
    assert.match(res.body.referenceNumber, /^JAN-2026-\d{4}$/);
    assert.equal(res.body.data.status, 'SUBMITTED');
    assert.equal(res.body.data.priority, 'MEDIUM');
    assert.equal(res.body.data.departmentId, 'DEPT_WATER');
    assert.equal(res.body.data.synthetic, true);

    createdRefNumber = res.body.referenceNumber;
  });

  it('PATCH /api/v1/complaints/:id/status should fail (400) on invalid status transition', async () => {
    assert.ok(createdRefNumber, 'Complaint must have been created');
    // Direct transition from SUBMITTED to RESOLVED is invalid according to governance rules
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
    // Valid transition: SUBMITTED -> UNDER_REVIEW
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

  it('GET /api/v1/complaints/:id/history should return status audit timeline', async () => {
    assert.ok(createdRefNumber, 'Complaint must have been created');
    const res = await request(app).get(`/api/v1/complaints/${createdRefNumber}/history`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2); // SUBMITTED, UNDER_REVIEW, etc.
  });
});
