/**
 * @file securityHardening.test.js
 * @description Automated security audit, RBAC boundary verification, and deployment readiness tests for CivicSarthi Phase 14.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';
import config from '../src/config/app.config.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { complaintRepository } from '../src/repositories/complaint.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import { departmentRepository } from '../src/repositories/department.repository.js';
import { authService } from '../src/services/auth.service.js';
import { escapeCsvCell } from '../src/constants/analytics.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();

const TEST_DIR = path.resolve(__dirname, 'sandbox-security-test');
const TEST_USERS_PATH = path.resolve(TEST_DIR, 'users.test.json');
const TEST_COMPLAINTS_PATH = path.resolve(TEST_DIR, 'complaints.test.json');
const TEST_AUDIT_PATH = path.resolve(TEST_DIR, 'audit_logs.test.json');

describe('CivicSarthi Phase 14 — Security Hardening, RBAC & Deployment Readiness', () => {
  let citizenToken1 = null;
  let citizenToken2 = null;
  let waterOfficerToken = null;
  let roadsOfficerToken = null;
  let adminToken = null;

  let citizenUser1 = null;
  let citizenUser2 = null;
  let waterOfficerUser = null;
  let roadsOfficerUser = null;
  let adminUser = null;

  let roadsComplaint = null;
  let waterComplaint = null;

  before(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });

    // Redirect repositories to isolated sandbox
    userRepository.setFilePath(TEST_USERS_PATH);
    complaintRepository.setFilePath(TEST_COMPLAINTS_PATH);
    auditLogRepository.setFilePath(TEST_AUDIT_PATH);

    await fs.writeFile(
      TEST_USERS_PATH,
      JSON.stringify({ metadata: { version: '1.0.0' }, users: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      TEST_COMPLAINTS_PATH,
      JSON.stringify({ metadata: { version: '1.0.0' }, complaints: [] }, null, 2),
      'utf-8'
    );
    await fs.writeFile(
      TEST_AUDIT_PATH,
      JSON.stringify({ metadata: { version: '1.0.0' }, logs: [] }, null, 2),
      'utf-8'
    );

    // Register Citizen 1
    const reg1 = await authService.register({
      email: 'citizen.alpha@example.com',
      password: 'Password123!',
      name: 'Alpha Citizen'
    });
    citizenToken1 = reg1.token;
    citizenUser1 = reg1.user;

    // Register Citizen 2
    const reg2 = await authService.register({
      email: 'citizen.beta@example.com',
      password: 'Password123!',
      name: 'Beta Citizen'
    });
    citizenToken2 = reg2.token;
    citizenUser2 = reg2.user;

    // Provision Water Officer
    const waterOff = await authService.provisionUser({
      email: 'officer.water@dept.gov',
      password: 'Password123!',
      name: 'Water Nodal Officer',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    });
    waterOfficerUser = waterOff;
    waterOfficerToken = authService.generateToken(waterOff);

    // Provision Roads Officer
    const roadsOff = await authService.provisionUser({
      email: 'officer.roads@dept.gov',
      password: 'Password123!',
      name: 'Roads Nodal Officer',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    });
    roadsOfficerUser = roadsOff;
    roadsOfficerToken = authService.generateToken(roadsOff);

    // Provision Admin
    const admin = await authService.provisionUser({
      email: 'admin.super@civicsarthi.gov',
      password: 'Password123!',
      name: 'System Administrator',
      role: 'admin'
    });
    adminUser = admin;
    adminToken = authService.generateToken(admin);

    // Create a Roads complaint owned by Citizen 1 with an internal officer note
    const c1 = await complaintRepository.create({
      title: 'Pothole on Main Road',
      description: 'Severe road pothole causing traffic obstruction on Main Street.',
      category: 'roads',
      state: 'Maharashtra',
      district: 'Pune',
      locality: 'Main Street',
      departmentId: 'DEPT_ROADS',
      citizenId: citizenUser1.id,
      citizenName: citizenUser1.name,
      citizenEmail: citizenUser1.email,
      citizenPhone: '9876543210',
      status: 'UNDER_REVIEW',
      priority: 'MEDIUM',
      officerNotes: [
        {
          note: 'CONFIDENTIAL: Internal road survey pending budget release.',
          officerId: roadsOfficerUser.id,
          createdAt: new Date().toISOString()
        }
      ]
    });
    roadsComplaint = c1;

    // Create a Water complaint owned by Citizen 2
    const c2 = await complaintRepository.create({
      title: 'Leaking water pipeline Sector 3',
      description: 'Major drinking water main has burst and is flooding the colony.',
      category: 'water',
      state: 'Maharashtra',
      district: 'Pune',
      locality: 'Sector 3',
      departmentId: 'DEPT_WATER',
      citizenId: citizenUser2.id,
      citizenName: citizenUser2.name,
      citizenEmail: citizenUser2.email,
      citizenPhone: '9123456789',
      status: 'ASSIGNED',
      priority: 'HIGH'
    });
    waterComplaint = c2;
  });

  after(async () => {
    // Restore repository paths
    userRepository.setFilePath(config.dataPath.users);
    complaintRepository.setFilePath(config.dataPath.complaints);
    auditLogRepository.setFilePath(config.dataPath.auditLogs);
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Security Headers, Fingerprinting & Health Probes', () => {
    it('1.1 should set Content-Security-Policy and X-Frame-Options DENY headers', async () => {
      const res = await request(app).get('/api/v1/health');
      assert.equal(res.status, 200);
      assert.ok(res.headers['content-security-policy'], 'Must set Content-Security-Policy');
      assert.ok(res.headers['content-security-policy'].includes("default-src 'self'"));
      assert.equal(res.headers['x-frame-options'], 'DENY', 'X-Frame-Options must be DENY');
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
    });

    it('1.2 should suppress X-Powered-By Express server fingerprinting', async () => {
      const res = await request(app).get('/api/v1/health');
      assert.equal(res.headers['x-powered-by'], undefined, 'Must not expose X-Powered-By');
    });

    it('1.3 should set Permissions-Policy restricting dangerous browser features', async () => {
      const res = await request(app).get('/api/v1/health');
      assert.ok(res.headers['permissions-policy'], 'Must include Permissions-Policy');
      assert.ok(res.headers['permissions-policy'].includes('camera=()'));
      assert.ok(res.headers['permissions-policy'].includes('microphone=()'));
    });

    it('1.4 should provide accessible liveness probe at /health/live and /api/v1/health/live', async () => {
      const resRoot = await request(app).get('/health/live');
      assert.equal(resRoot.status, 200);
      assert.equal(resRoot.body.status, 'ok');
      assert.equal(resRoot.body.live, true);

      const resV1 = await request(app).get('/api/v1/health/live');
      assert.equal(resV1.status, 200);
      assert.equal(resV1.body.status, 'ok');
      assert.equal(resV1.body.live, true);
    });

    it('1.5 should provide readiness probe verifying persistence storage at /health/ready', async () => {
      const res = await request(app).get('/health/ready');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.ready, true);
      assert.ok(res.body.database);
    });
  });

  describe('2. CORS Policy Hardening', () => {
    it('2.1 should permit pre-configured frontend origin', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    });

    it('2.2 should reject unallowed origin without returning Access-Control-Allow-Origin', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://malicious-civic-phishing.org');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });
  });

  describe('3. Role-Based Access Control Boundaries', () => {
    it('3.1 rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await request(app).get('/api/v1/complaints/my');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('3.2 denies citizen access to administrative user management with 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${citizenToken1}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN_ROLE');
    });

    it('3.3 denies citizen access to administrative audit logs with 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${citizenToken1}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN_ROLE');
    });

    it('3.4 denies citizen access to spam review queue with 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .get('/api/v1/spam-reviews')
        .set('Authorization', `Bearer ${citizenToken1}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN_ROLE');
    });

    it('3.5 denies citizen access to executive analytics dashboard with 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${citizenToken1}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN_ROLE');
    });

    it('3.6 denies officer access to administrative department reassignment with 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${roadsComplaint.id}/department`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({ departmentId: 'DEPT_WATER' });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'FORBIDDEN_ROLE');
    });

    it('3.7 allows admin access to platform-wide audit logs and user lists', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });
  });

  describe('4. Cross-Tenant and Cross-Department Data Scoping', () => {
    it('4.1 prevents Citizen 2 from reading Citizen 1 complaint with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${roadsComplaint.id}`)
        .set('Authorization', `Bearer ${citizenToken2}`);

      assert.equal(res.status, 403);
      assert.ok(res.body.error.includes('Access denied'));
    });

    it('4.2 prevents Water Officer from viewing Roads Department complaint with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${roadsComplaint.id}`)
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.equal(res.status, 403);
      assert.ok(res.body.error.includes('not authorized'));
    });

    it('4.3 prevents Water Officer from updating status of Roads Department complaint with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${roadsComplaint.id}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({ status: 'IN_PROGRESS', remarks: 'Attempted unauthorized state change' });

      assert.equal(res.status, 403);
    });

    it('4.4 prevents Water Officer from modifying priority of Roads Department complaint with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${roadsComplaint.id}/priority`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({ priority: 'CRITICAL', remarks: 'Unauthorized priority escalation' });

      assert.equal(res.status, 403);
    });

    it('4.5 allows Roads Officer to view their own department complaint', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${roadsComplaint.id}`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, roadsComplaint.id);
    });
  });

  describe('5. Sensitive Data Exposure Protection', () => {
    it('5.1 never leaks internal officer notes to citizen owner in complaint detail endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${roadsComplaint.id}`)
        .set('Authorization', `Bearer ${citizenToken1}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.officerNotes, undefined, 'Must strip officerNotes from citizen projection');
      assert.equal(res.body.data.internalNotes, undefined, 'Must strip internalNotes from citizen projection');
    });

    it('5.2 never leaks citizen contact details or internal notes in public tracking endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/track/${roadsComplaint.referenceNumber || roadsComplaint.id}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.citizenPhone, undefined, 'Must not expose citizenPhone publicly');
      assert.equal(res.body.data.citizenEmail, undefined, 'Must not expose citizenEmail publicly');
      assert.equal(res.body.data.citizenName, undefined, 'Must not expose citizenName publicly');
      assert.equal(res.body.data.citizenId, undefined, 'Must not expose citizenId publicly');
      assert.equal(res.body.data.officerNotes, undefined, 'Must not expose officerNotes publicly');
    });
  });

  describe('6. Input Validation, Traversal & Formula Injection Defenses', () => {
    it('6.1 rejects directory traversal attempts in complaint evidence array with 400', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken1}`)
        .send({
          title: 'Damaged pavement on 4th Street',
          description: 'Pavement is damaged and blocks wheelchairs.',
          category: 'roads',
          state: 'Maharashtra',
          district: 'Pune',
          evidence: ['../../etc/passwd', 'valid_photo.jpg']
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(res.body.details || res.body.error);
    });

    it('6.2 escapes spreadsheet formula injection triggers in CSV export cells (CWE-1236)', () => {
      assert.equal(escapeCsvCell('=1+1'), "'=1+1", 'Must prefix equals formula trigger');
      assert.equal(escapeCsvCell('+2-1'), "'+2-1", 'Must prefix plus formula trigger');
      assert.equal(escapeCsvCell('-SUM(A1:A5)'), "'-SUM(A1:A5)", 'Must prefix minus formula trigger');
      assert.equal(escapeCsvCell('@SUM(B1)'), "'@SUM(B1)", 'Must prefix at trigger');
      assert.equal(escapeCsvCell('Normal text'), 'Normal text', 'Normal strings must remain intact');
    });

    it('6.3 logs an immutable audit event when an authorized officer exports an analytics report', async () => {
      const logsBefore = await auditLogRepository.findAll({ action: 'ANALYTICS_REPORT_EXPORTED' });
      const initialCount = logsBefore.length;

      const res = await request(app)
        .get('/api/v1/analytics/export')
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .query({ reportType: 'overview' });

      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));

      const logsAfter = await auditLogRepository.findAll({ action: 'ANALYTICS_REPORT_EXPORTED' });
      assert.equal(logsAfter.length, initialCount + 1, 'Must record audit log for report export');
      assert.equal(logsAfter[0].userId, waterOfficerUser.id);
    });
  });
});
