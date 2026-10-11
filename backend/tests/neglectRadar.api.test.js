/**
 * @file neglectRadar.api.test.js
 * @description Comprehensive Endpoint and Integration Test Suite for CivicSarthi Phase 8 Neglect Radar API.
 *
 * SAFETY & INTEGRITY GUARANTEES:
 * - Operates without modifying protected runtime data files.
 * - Uses in-memory token verification and repository stubbing.
 * - Tests authentication, role enforcement, server-side department scoping,
 *   Zod input validation, privacy projections, and endpoint aliases.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import createApp from '../src/app.js';
import authService from '../src/services/auth.service.js';
import complaintRepository from '../src/repositories/complaint.repository.js';
import incidentRepository from '../src/repositories/incident.repository.js';
import subtaskRepository from '../src/repositories/subtask.repository.js';

const app = createApp();

describe('CivicSarthi Phase 8 — Neglect Radar Endpoint & Integration Tests', () => {
  // Test Tokens
  const CITIZEN_TOKEN = 'mock-test-token-citizen-01';
  const WATER_OFFICER_TOKEN = 'mock-test-token-officer-water';
  const ROADS_OFFICER_TOKEN = 'mock-test-token-officer-roads';
  const NO_DEPT_OFFICER_TOKEN = 'mock-test-token-officer-no-dept';
  const ADMIN_TOKEN = 'mock-test-token-admin-01';

  let originalVerifySessionToken;

  before(() => {
    // Save original auth verification
    originalVerifySessionToken = authService.verifySessionToken.bind(authService);

    // Mock verifySessionToken in-memory to safely isolate test actors without writing files
    authService.verifySessionToken = async (token) => {
      if (token === CITIZEN_TOKEN) {
        return {
          id: 'USR-CITIZEN-01',
          name: 'Sunita Citizen',
          email: 'sunita@example.com',
          role: 'citizen',
          departmentId: null,
          isActive: true
        };
      }
      if (token === WATER_OFFICER_TOKEN) {
        return {
          id: 'OFF-WATER-01',
          name: 'Officer Water Deshmukh',
          email: 'water.officer@civicsarthi.internal',
          role: 'officer',
          departmentId: 'DEPT_WATER',
          isActive: true
        };
      }
      if (token === ROADS_OFFICER_TOKEN) {
        return {
          id: 'OFF-ROADS-01',
          name: 'Officer Roads Shinde',
          email: 'roads.officer@civicsarthi.internal',
          role: 'officer',
          departmentId: 'DEPT_ROADS',
          isActive: true
        };
      }
      if (token === NO_DEPT_OFFICER_TOKEN) {
        return {
          id: 'OFF-NODEP-01',
          name: 'Officer Without Department',
          email: 'unassigned.officer@civicsarthi.internal',
          role: 'officer',
          departmentId: null,
          isActive: true
        };
      }
      if (token === ADMIN_TOKEN) {
        return {
          id: 'ADM-CHIEF-01',
          name: 'Chief Administrator',
          email: 'chief.admin@civicsarthi.internal',
          role: 'admin',
          departmentId: null,
          isActive: true
        };
      }
      return null;
    };
  });

  after(() => {
    // Restore original auth verification
    if (originalVerifySessionToken) {
      authService.verifySessionToken = originalVerifySessionToken;
    }
  });

  // 1. Anonymous Access -> HTTP 401
  it('1. GET /api/v1/neglect-radar rejects unauthenticated callers with 401', async () => {
    const res = await request(app).get('/api/v1/neglect-radar');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /authentication required/i);
  });

  // 2. Citizen Access -> HTTP 403
  it('2. GET /api/v1/neglect-radar rejects authenticated citizen callers with 403', async () => {
    const res = await request(app)
      .get('/api/v1/neglect-radar')
      .set('Authorization', `Bearer ${CITIZEN_TOKEN}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not authorized/i);
  });

  // 3. Officer Access Scoped to Authenticated Department
  it('3. GET /api/v1/neglect-radar grants officer access scoped strictly to authenticated department', async () => {
    const res = await request(app)
      .get('/api/v1/neglect-radar')
      .set('Authorization', `Bearer ${WATER_OFFICER_TOKEN}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.items));
    assert.equal(res.body.data.filtersApplied.departmentId, 'DEPT_WATER');

    // All complaints returned must belong to DEPT_WATER
    for (const item of res.body.data.items) {
      if (item.entityType === 'COMPLAINT') {
        assert.equal(item.departmentId, 'DEPT_WATER');
      }
    }
  });

  // 4. Officer Cannot Widen Scope Using Forged departmentId Parameter
  it('4. GET /api/v1/neglect-radar ignores client departmentId spoofing attempt by officer', async () => {
    const res = await request(app)
      .get('/api/v1/neglect-radar?departmentId=DEPT_ROADS')
      .set('Authorization', `Bearer ${WATER_OFFICER_TOKEN}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    // Server forces effective department to DEPT_WATER, discarding client-supplied DEPT_ROADS
    assert.equal(res.body.data.filtersApplied.departmentId, 'DEPT_WATER');
    for (const item of res.body.data.items) {
      if (item.entityType === 'COMPLAINT') {
        assert.equal(item.departmentId, 'DEPT_WATER');
      }
    }
  });

  // Officer Without Department Assignment Fails Closed -> HTTP 403
  it('4b. Rejects officer with missing department assignment with 403 (fails closed)', async () => {
    const res = await request(app)
      .get('/api/v1/neglect-radar')
      .set('Authorization', `Bearer ${NO_DEPT_OFFICER_TOKEN}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.error, /not assigned to a valid department/i);
  });

  // 5. Admin Cross-Department Visibility & Optional Filtering
  it('5. GET /api/v1/neglect-radar grants admin cross-department oversight and honors department filter', async () => {
    // Unrestricted admin view
    const allRes = await request(app)
      .get('/api/v1/neglect-radar')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    assert.equal(allRes.status, 200);
    assert.equal(allRes.body.success, true);
    assert.equal(allRes.body.data.filtersApplied.departmentId, null);

    // Admin filtering by DEPT_WATER
    const waterRes = await request(app)
      .get('/api/v1/neglect-radar?departmentId=DEPT_WATER')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    assert.equal(waterRes.status, 200);
    assert.equal(waterRes.body.data.filtersApplied.departmentId, 'DEPT_WATER');
  });

  // 6. Invalid Query Parameters -> Validation Error with Established Envelope
  describe('6. Input Validation Guardrails', () => {
    it('rejects invalid entityType with 400 validation error', async () => {
      const res = await request(app)
        .get('/api/v1/neglect-radar?entityType=INVALID_ENTITY')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Validation Error');
      assert.ok(Array.isArray(res.body.details));
      assert.ok(res.body.details.some(d => d.path.includes('entityType')));
    });

    it('rejects invalid riskLevel with 400 validation error', async () => {
      const res = await request(app)
        .get('/api/v1/neglect-radar?riskLevel=EXTREME_DANGER')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Validation Error');
      assert.ok(res.body.details.some(d => d.path.includes('riskLevel')));
    });

    it('rejects invalid sort with 400 validation error', async () => {
      const res = await request(app)
        .get('/api/v1/neglect-radar?sort=random_sort')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.details.some(d => d.path.includes('sort')));
    });

    it('rejects non-numeric pagination with 400 validation error', async () => {
      const res = await request(app)
        .get('/api/v1/neglect-radar?page=abc&limit=xyz')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.details.some(d => d.path.includes('page') || d.path.includes('limit')));
    });
  });

  // 7. Valid List Request Returns Standard Envelope Structure
  it('7. Valid list request returns complete response envelope with pagination and summary', async () => {
    const res = await request(app)
      .get('/api/v1/neglect-radar?page=1&limit=5')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Neglect radar evaluation completed successfully');

    const data = res.body.data;
    assert.ok(data.pagination);
    assert.equal(data.pagination.page, 1);
    assert.equal(data.pagination.limit, 5);
    assert.ok(data.summary);
    assert.equal(data.summary.scope, 'FULL_FILTERED_RESULT_SET');
    assert.ok(typeof data.summary.totalFlagged === 'number');
    assert.ok(data.sources);
    assert.equal(typeof data.isPartial, 'boolean');
    assert.ok(data.evaluatedAt);
  });

  // 8. Single-Item Detail Lookup (Valid and Invalid)
  describe('8. Single-Item Detail Lookup', () => {
    it('returns evaluated detail item for valid complaint ID', async () => {
      // Find a complaint in data
      const listRes = await request(app)
        .get('/api/v1/neglect-radar?entityType=COMPLAINT&limit=1')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      assert.equal(listRes.status, 200);
      const testItem = listRes.body.data.items[0];
      if (testItem) {
        const detailRes = await request(app)
          .get(`/api/v1/neglect-radar/COMPLAINT/${testItem.entityId}`)
          .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

        assert.equal(detailRes.status, 200);
        assert.equal(detailRes.body.success, true);
        assert.equal(detailRes.body.data.entityId, testItem.entityId);
        assert.equal(detailRes.body.data.entityType, 'COMPLAINT');
      }
    });

    it('rejects invalid entityType in params with 400 validation error', async () => {
      const res = await request(app)
        .get('/api/v1/neglect-radar/INVALID_TYPE/123')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Validation Error');
    });

    it('returns 404 for non-existent item ID', async () => {
      const res = await request(app)
        .get('/api/v1/neglect-radar/COMPLAINT/NON_EXISTENT_CASE_999999')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /not found/i);
    });
  });

  // 9. Out-of-Scope Detail Lookup Returns 404 (Anti-Enumeration)
  it('9. Prevents officer from viewing record owned by another department (anti-enumeration 404)', async () => {
    // Look up a complaint that belongs to DEPT_ROADS
    const roadsComplaints = await complaintRepository.findAll({ departmentId: 'DEPT_ROADS' });
    const roadsTarget = Array.isArray(roadsComplaints) ? roadsComplaints[0] : roadsComplaints?.items?.[0];

    if (roadsTarget) {
      // Water officer tries to inspect roads complaint
      const res = await request(app)
        .get(`/api/v1/neglect-radar/COMPLAINT/${roadsTarget.id}`)
        .set('Authorization', `Bearer ${WATER_OFFICER_TOKEN}`);

      // Must return 404 to avoid confirming the existence of out-of-scope case
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /not found/i);
    }
  });

  // 10. Partial-Source Failures Reflected Accurately
  it('10. Accurately reflects partial source failures in sources metadata', async () => {
    const originalIncFindAll = incidentRepository.findAll;
    try {
      incidentRepository.findAll = async () => {
        throw new Error('Simulated incident storage offline');
      };

      const res = await request(app)
        .get('/api/v1/neglect-radar?entityType=ALL')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.isPartial, true);
      assert.equal(res.body.data.sources.incidents.ok, false);
      assert.match(res.body.data.sources.incidents.error, /storage offline/i);
      assert.equal(res.body.data.sources.complaints.ok, true);
    } finally {
      incidentRepository.findAll = originalIncFindAll;
    }
  });

  // 11. No Sensitive Citizen PII in Response Payloads
  it('11. Response projection strictly excludes citizen contact data, passwords, and private notes', async () => {
    const res = await request(app)
      .get('/api/v1/neglect-radar?entityType=COMPLAINT&limit=10')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    assert.equal(res.status, 200);
    const items = res.body.data.items;
    assert.ok(items.length > 0);

    for (const item of items) {
      assert.equal(item.citizenId, undefined, 'citizenId must not be exposed');
      assert.equal(item.citizenPhone, undefined, 'citizenPhone must not be exposed');
      assert.equal(item.citizenEmail, undefined, 'citizenEmail must not be exposed');
      assert.equal(item.internalNotes, undefined, 'internalNotes must not be exposed');
      assert.equal(item.notes, undefined, 'notes must not be exposed');
      assert.equal(item.password, undefined, 'password must not be exposed');
      assert.equal(item.passwordHash, undefined, 'passwordHash must not be exposed');
      assert.equal(item.credentials, undefined, 'credentials must not be exposed');
    }
  });

  // 12. Both /api/v1/neglect-radar and /api/neglect-radar Work Identically
  it('12. Legacy route alias /api/neglect-radar works identically to versioned route /api/v1/neglect-radar', async () => {
    const legacyRes = await request(app)
      .get('/api/neglect-radar?limit=5')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    assert.equal(legacyRes.status, 200);
    assert.equal(legacyRes.body.success, true);
    assert.equal(legacyRes.body.message, 'Neglect radar evaluation completed successfully');
    assert.ok(Array.isArray(legacyRes.body.data.items));

    // Verify citizen is also rejected on legacy route
    const legacyCitizen = await request(app)
      .get('/api/neglect-radar')
      .set('Authorization', `Bearer ${CITIZEN_TOKEN}`);

    assert.equal(legacyCitizen.status, 403);
  });
});
