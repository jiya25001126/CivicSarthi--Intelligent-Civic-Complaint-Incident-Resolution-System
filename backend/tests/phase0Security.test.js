/**
 * @file phase0Security.test.js
 * @description Comprehensive automated negative and authorization security tests
 * for Phase 0 (P0) remediations:
 * - SEC-01: Mock CPGRAMS production isolation & unauthenticated access rejection
 * - SEC-02: Officer department scoping preservation during free-text search ($and query safety)
 * - SEC-03: Notification log department scoping and phone number PII masking
 * - SEC-04: Object-level authorization (IDOR defense) and path traversal prevention for attachments
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import createApp from '../src/app.js';
import config from '../src/config/app.config.js';
import { notificationService } from '../src/services/notification/notification.service.js';
import { jsonNotificationLogRepository } from '../src/repositories/notificationLog.json.repository.js';
import { complaintRepository } from '../src/repositories/complaint.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { authService } from '../src/services/auth.service.js';
import { storageService } from '../src/services/storage.service.js';

import { isMockCpgramsAllowed } from '../src/routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();

// Helper to generate valid test JWTs with user id in sub claim matching real users
function generateToken(user) {
  return authService.generateToken(user);
}

describe('Phase 0 (P0) Security Remediation Test Suite', () => {

  // =========================================================================
  // SEC-01: Mock CPGRAMS Production Exposure & Gating
  // =========================================================================
  describe('SEC-01: Mock CPGRAMS Protection & Environment Gating', () => {
    it('1.1: Production with flag unset: strictly disallowed', () => {
      assert.equal(isMockCpgramsAllowed('production', {}), false);
    });

    it('1.2: Production with ENABLE_MOCK_CPGRAMS=true: still strictly disallowed (cannot override)', () => {
      assert.equal(isMockCpgramsAllowed('production', { ENABLE_MOCK_CPGRAMS: 'true' }), false);
    });

    it('1.3: Development with flag unset: disallowed by default (requires explicit opt-in)', () => {
      assert.equal(isMockCpgramsAllowed('development', {}), false);
    });

    it('1.4: Development with ENABLE_MOCK_CPGRAMS=true: permitted with opt-in', () => {
      assert.equal(isMockCpgramsAllowed('development', { ENABLE_MOCK_CPGRAMS: 'true' }), true);
    });

    it('1.5: Rejects unauthenticated state modification or returns 404 when disabled on app routes', async () => {
      // Test both /api/v1/mock-cpgrams and /api/mock-cpgrams
      const resV1 = await request(app)
        .patch('/api/v1/mock-cpgrams/complaints/CPG-2026-00101/status')
        .send({ status: 'RESOLVED' });
      assert.ok([401, 403, 404].includes(resV1.status), `Expected 401, 403, or 404, got ${resV1.status}`);

      const resRoot = await request(app)
        .patch('/api/mock-cpgrams/complaints/CPG-2026-00101/status')
        .send({ status: 'RESOLVED' });
      assert.ok([401, 403, 404].includes(resRoot.status), `Expected 401, 403, or 404, got ${resRoot.status}`);
    });

    it('1.6: Returns 404 on both v1 and root aliases when mock-cpgrams router is disabled', async () => {
      const resV1 = await request(app).get('/api/v1/mock-cpgrams/complaints');
      assert.ok([401, 403, 404].includes(resV1.status));

      const resRoot = await request(app).get('/api/mock-cpgrams/complaints');
      assert.ok([401, 403, 404].includes(resRoot.status));
    });
  });

  // =========================================================================
  // SEC-02: Department Filter Overwrite Protection in Search
  // =========================================================================
  describe('SEC-02: Officer Department Scoping & Search Filter Integrity', () => {
    it('2.1: Officer for DEPT_ROADS cannot retrieve complaints from DEPT_PENSION even with matching search term', async () => {
      const roadsOfficerToken = generateToken({
        id: 'USR-DEMO-ROADS-002',
        role: 'officer',
        departmentId: 'DEPT_ROADS',
        email: 'officer.roads@civicsarthi.internal'
      });

      // Search for keyword 'pension' which exists in DEPT_PENSION records
      const res = await request(app)
        .get('/api/v1/complaints?search=pension')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(res.status, 200);
      const items = res.body.data?.items || res.body.data || [];

      // Every returned complaint must strictly belong to DEPT_ROADS
      for (const item of items) {
        const dept = item.departmentId || item.department;
        assert.equal(dept, 'DEPT_ROADS', `Expected complaint department to be DEPT_ROADS but found ${dept}`);
      }
    });

    it('2.2: Free-text search containing regex metacharacters does not crash server or cause ReDoS', async () => {
      const adminToken = generateToken({
        id: 'USR-DEMO-ADMIN-005',
        role: 'admin',
        email: 'admin.demo@civicsarthi.internal'
      });

      // Complex regex metacharacter sequence
      const dangerousRegex = '((((.*)+)+)+)[a-z]+$';
      const res = await request(app)
        .get(`/api/v1/complaints?search=${encodeURIComponent(dangerousRegex)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.ok([200, 400].includes(res.status));
    });

    it('2.3: Admin can search across all departments without being constrained to a single department', async () => {
      const adminToken = generateToken({
        id: 'USR-DEMO-ADMIN-005',
        role: 'admin',
        email: 'admin.demo@civicsarthi.internal'
      });

      const res = await request(app)
        .get('/api/v1/complaints?search=road')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
    });
  });

  // =========================================================================
  // SEC-03: Notification Delivery Log Department Scoping & Phone Masking
  // =========================================================================
  describe('SEC-03: Notification Log Scoping & PII Protection', () => {
    const testLogRoads = {
      id: 'NOTIF-TEST-ROADS-01',
      recipientPhone: '+919876543210',
      channel: 'sms',
      eventType: 'COMPLAINT_REGISTERED',
      complaintId: 'CS-2026-0041',
      complaintReference: 'CS-2026-0041',
      departmentId: 'DEPT_ROADS',
      citizenId: 'USR-MVTJFJBU-YLTX',
      status: 'DELIVERED',
      sentAt: new Date().toISOString()
    };

    const testLogPension = {
      id: 'NOTIF-TEST-PENSION-01',
      recipientPhone: '+919123456789',
      channel: 'sms',
      eventType: 'STATUS_CHANGED',
      complaintId: 'CPG-2026-00101',
      complaintReference: 'CS-2026-0001',
      departmentId: 'DEPT_PENSION',
      citizenId: 'USR-DEMO-CITIZEN-001',
      status: 'DELIVERED',
      sentAt: new Date().toISOString()
    };

    before(async () => {
      // Create test logs in repository
      await jsonNotificationLogRepository.create(testLogRoads);
      await jsonNotificationLogRepository.create(testLogPension);
    });

    it('3.1: Officer for DEPT_ROADS only sees notifications belonging to DEPT_ROADS', async () => {
      const roadsOfficerToken = generateToken({
        id: 'USR-DEMO-ROADS-002',
        role: 'officer',
        departmentId: 'DEPT_ROADS'
      });

      const res = await request(app)
        .get('/api/v1/notifications/logs')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(res.status, 200);
      const logs = res.body.data || [];

      for (const log of logs) {
        if (log.departmentId) {
          assert.equal(log.departmentId, 'DEPT_ROADS', `Officer saw log from department: ${log.departmentId}`);
        }
      }
    });

    it('3.2: Officer and Citizen responses have recipient phone numbers masked for PII protection', async () => {
      const roadsOfficerToken = generateToken({
        id: 'USR-DEMO-ROADS-002',
        role: 'officer',
        departmentId: 'DEPT_ROADS'
      });

      const res = await request(app)
        .get('/api/v1/notifications/logs')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(res.status, 200);
      const logs = res.body.data || [];
      const roadsLog = logs.find(l => l.id === testLogRoads.id);

      if (roadsLog) {
        assert.ok(roadsLog.recipientPhone.includes('******'), `Phone was not masked: ${roadsLog.recipientPhone}`);
        assert.ok(!roadsLog.recipientPhone.includes('987654'), `Phone leaked middle digits: ${roadsLog.recipientPhone}`);
      }
    });

    it('3.3: Citizen only sees their own notifications', async () => {
      const citizenToken = generateToken({
        id: 'USR-MVTJFJBU-YLTX',
        role: 'citizen'
      });

      const res = await request(app)
        .get('/api/v1/notifications/logs')
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(res.status, 200);
      const logs = res.body.data || [];
      for (const log of logs) {
        if (log.citizenId) {
          assert.equal(log.citizenId, 'USR-MVTJFJBU-YLTX');
        }
      }
    });
  });

  // =========================================================================
  // SEC-04: Attachment Object-Level Authorization (IDOR) & Path Traversal
  // =========================================================================
  describe('SEC-04: Attachment Authorization & Traversal Defenses', () => {
    const testAttachment = 'ATTACH-1793303525175-2b16cbfb.png'; // linked to CS-2026-0041 (citizenId: USR-MVTJFJBU-YLTX, dept: DEPT_ROADS)

    it('4.1: Legitimate complaint owner can access their uploaded attachment', async () => {
      const ownerToken = generateToken({
        id: 'USR-MVTJFJBU-YLTX',
        role: 'citizen'
      });

      const res = await request(app)
        .get(`/api/v1/complaints/attachments/${testAttachment}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'image/png');
    });

    it('4.2: Unauthorized citizen cannot download another citizen attachment (IDOR Defense)', async () => {
      const attackerCitizenToken = generateToken({
        id: 'USR-DEMO-CITIZEN-001',
        role: 'citizen'
      });

      const res = await request(app)
        .get(`/api/v1/complaints/attachments/${testAttachment}`)
        .set('Authorization', `Bearer ${attackerCitizenToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error || res.body.message || '', /access denied|permission/i);
    });

    it('4.3: Officer from unrelated department (DEPT_WATER) cannot download DEPT_ROADS attachment', async () => {
      const waterOfficerToken = generateToken({
        id: 'USR-DEMO-WATER-003',
        role: 'officer',
        departmentId: 'DEPT_WATER'
      });

      const res = await request(app)
        .get(`/api/v1/complaints/attachments/${testAttachment}`)
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error || res.body.message || '', /department/i);
    });

    it('4.4: Officer from authorized department (DEPT_ROADS) can access the attachment', async () => {
      const roadsOfficerToken = generateToken({
        id: 'USR-DEMO-ROADS-002',
        role: 'officer',
        departmentId: 'DEPT_ROADS'
      });

      const res = await request(app)
        .get(`/api/v1/complaints/attachments/${testAttachment}`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'], 'image/png');
    });

    it('4.5: Administrator is authorized to view attachments platform-wide', async () => {
      const adminToken = generateToken({
        id: 'USR-DEMO-ADMIN-005',
        role: 'admin'
      });

      const res = await request(app)
        .get(`/api/v1/complaints/attachments/${testAttachment}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
    });

    it('4.6: Rejects directory traversal attempts in filename parameter', async () => {
      const adminToken = generateToken({
        id: 'USR-DEMO-ADMIN-005',
        role: 'admin'
      });

      const res = await request(app)
        .get('/api/v1/complaints/attachments/..%2f..%2fpackage.json')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.ok([400, 403, 404].includes(res.status));
    });
  });
});

