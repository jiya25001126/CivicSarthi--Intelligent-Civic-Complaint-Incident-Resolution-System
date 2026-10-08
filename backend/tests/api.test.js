import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import createApp from '../src/app.js';

const app = createApp();

describe('JanSahay Baseline Backend API Tests', () => {
  it('GET /api/health should return 200 with status ok and version', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(typeof res.body.version, 'string');
    assert.equal(typeof res.body.time, 'string');
    assert.equal(res.body.service, 'JanSahay');
  });

  it('GET /api/complaints should return 200 with synthetic complaint list', async () => {
    const res = await request(app).get('/api/complaints');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.count >= 25);
    // Check first item has required schema fields
    const first = res.body.data[0];
    assert.ok(first.id);
    assert.ok(first.text);
    assert.ok(first.category);
    assert.ok(first.department);
    assert.ok(first.officialStatus);
    assert.equal(first.synthetic, true);
  });

  it('GET /api/complaints/:id with invalid id should return 404', async () => {
    const res = await request(app).get('/api/complaints/CPG-DOES-NOT-EXIST-999');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not found/i);
  });
});
