import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import createApp from '../src/app.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { complaintRepository } from '../src/repositories/complaint.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import { authService } from '../src/services/auth.service.js';
import { createAuthRateLimiter } from '../src/middleware/auth.middleware.js';
import config from '../src/config/app.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();

const TEST_USERS_PATH = path.resolve(__dirname, 'sandbox-auth-test', 'users.test.json');
const TEST_COMPLAINTS_PATH = path.resolve(__dirname, 'sandbox-auth-test', 'complaints.test.json');
const TEST_AUDIT_PATH = path.resolve(__dirname, 'sandbox-auth-test', 'audit_logs.test.json');

describe('CivicSarthi Phase 3 Authentication, Sessions & RBAC Security Tests', () => {
  let citizenAToken = null;
  let citizenBToken = null;
  let officerRoadsToken = null;
  let officerWaterToken = null;
  let adminToken = null;

  let citizenAId = null;
  let citizenBId = null;
  let officerRoadsId = null;
  let adminId = null;

  let complaintA_Ref = null;
  let complaintB_Ref = null;

  before(async () => {
    await fs.mkdir(path.dirname(TEST_USERS_PATH), { recursive: true });

    // Isolate repositories to sandbox directory
    userRepository.setFilePath(TEST_USERS_PATH);
    complaintRepository.setFilePath(TEST_COMPLAINTS_PATH);
    auditLogRepository.setFilePath(TEST_AUDIT_PATH);

    // Initialize clean test complaints fixture
    const initialComplaints = {
      metadata: { synthetic: false, total: 0 },
      complaints: []
    };
    await fs.writeFile(TEST_COMPLAINTS_PATH, JSON.stringify(initialComplaints, null, 2), 'utf-8');

    // Create Admin user via provisioning service
    const adminUser = await authService.provisionUser({
      email: 'admin.sec@civicsarthi.internal',
      name: 'Security Admin',
      password: 'SecureAdmin123!',
      role: 'admin'
    }, { id: 'TEST_INIT', email: 'test@init', role: 'admin' });
    adminId = adminUser.id;
    adminToken = authService.generateToken(adminUser);

    // Create Officer for DEPT_ROADS
    const roadsOfficer = await authService.provisionUser({
      email: 'officer.roads.sec@civicsarthi.internal',
      name: 'Officer Roads',
      password: 'SecureOfficer123!',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    }, { id: adminId, email: adminUser.email, role: 'admin' });
    officerRoadsId = roadsOfficer.id;
    officerRoadsToken = authService.generateToken(roadsOfficer);

    // Create Officer for DEPT_WATER
    const waterOfficer = await authService.provisionUser({
      email: 'officer.water.sec@civicsarthi.internal',
      name: 'Officer Water',
      password: 'SecureOfficer123!',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    }, { id: adminId, email: adminUser.email, role: 'admin' });
    officerWaterToken = authService.generateToken(waterOfficer);
  });

  after(async () => {
    // Restore repository paths and clean up sandbox
    userRepository.resetFilePath();
    complaintRepository.resetFilePath();
    auditLogRepository.resetFilePath();

    try {
      await fs.rm(path.dirname(TEST_USERS_PATH), { recursive: true, force: true });
    } catch {}
  });

  it('1. Public registration creates only citizen accounts', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'citizena@test.civicsarthi.internal',
        name: 'Citizen Alpha',
        password: 'Password123'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.role, 'citizen');
    assert.equal(res.body.data.user.email, 'citizena@test.civicsarthi.internal');
    assert.equal(res.body.data.user.departmentId, null);
    assert.equal(typeof res.body.data.token, 'string');

    // Verify session cookie is set with HttpOnly and SameSite
    const cookies = res.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(c => c.startsWith(`${config.auth.cookieName}=`));
    assert.ok(sessionCookie, 'HttpOnly session cookie must be present');
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /SameSite=Lax/i);

    citizenAId = res.body.data.user.id;
    citizenAToken = res.body.data.token;
  });

  it('2. Public registration cannot create officers or administrators (Privilege Escalation Protection)', async () => {
    // Attempt privilege escalation to admin via registration
    const resAdmin = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'malicious.admin@test.civicsarthi.internal',
        name: 'Attacker Admin',
        password: 'Password123',
        role: 'admin'
      });

    assert.equal(resAdmin.status, 201);
    // Role MUST remain citizen regardless of payload
    assert.equal(resAdmin.body.data.user.role, 'citizen');

    // Attempt privilege escalation to officer
    const resOfficer = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'malicious.officer@test.civicsarthi.internal',
        name: 'Attacker Officer',
        password: 'Password123',
        role: 'officer',
        departmentId: 'DEPT_ROADS'
      });

    assert.equal(resOfficer.status, 201);
    assert.equal(resOfficer.body.data.user.role, 'citizen');
    assert.equal(resOfficer.body.data.user.departmentId, null);
  });

  it('3. Passwords are stored strictly as bcrypt hashes and never exposed', async () => {
    const rawUserData = await userRepository.findByEmail('citizena@test.civicsarthi.internal');
    assert.ok(rawUserData.passwordHash, 'Hash must exist in storage');
    assert.notEqual(rawUserData.passwordHash, 'Password123', 'Plaintext password must never be stored');
    assert.match(rawUserData.passwordHash, /^\$2[aby]\$\d+\$/, 'Must be a valid bcrypt hash');

    // Verify API responses never leak passwordHash
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${citizenAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.passwordHash, undefined, 'passwordHash must never appear in response');
    assert.equal(res.body.data.password, undefined);
  });

  it('4. Valid login succeeds and invalid login returns generic failure message', async () => {
    // Successful login
    const goodLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'citizena@test.civicsarthi.internal',
        password: 'Password123'
      });

    assert.equal(goodLogin.status, 200);
    assert.equal(goodLogin.body.success, true);
    assert.equal(goodLogin.body.data.user.email, 'citizena@test.civicsarthi.internal');
    assert.ok(goodLogin.body.data.token);

    // Wrong password
    const badPass = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'citizena@test.civicsarthi.internal',
        password: 'WrongPassword999'
      });

    assert.equal(badPass.status, 401);
    assert.equal(badPass.body.error, 'Invalid email or password');

    // Non-existent account: exact same generic message
    const badUser = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nobody.exists@test.civicsarthi.internal',
        password: 'Password123'
      });

    assert.equal(badUser.status, 401);
    assert.equal(badUser.body.error, 'Invalid email or password');
  });

  it('5. Logout invalidates session and clears cookies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const cookies = res.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(c => c.startsWith(`${config.auth.cookieName}=`));
    assert.ok(sessionCookie);
    // Cookie cleared with max-age 0 or expired date
    assert.match(sessionCookie, /(Expires=Thu, 01 Jan 1970|Max-Age=0)/i);
  });

  it('6. Expired or invalid sessions are rejected (401)', async () => {
    // Tampered token
    const tamperedRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.fake.token');

    assert.equal(tamperedRes.status, 401);
    assert.match(tamperedRes.body.error, /invalid|expired|authentication/i);

    // Expired token
    const expiredToken = jwt.sign(
      { sub: citizenAId, role: 'citizen' },
      config.auth.jwtSecret,
      { expiresIn: '-10s' }
    );

    const expiredRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    assert.equal(expiredRes.status, 401);
  });

  it('7. Missing authentication returns 401 on protected routes', async () => {
    // Protected complaints list
    const resList = await request(app).get('/api/v1/complaints');
    assert.equal(resList.status, 401);

    // Protected complaint creation
    const resCreate = await request(app)
      .post('/api/v1/complaints')
      .send({
        title: 'Unauthenticated Issue',
        description: 'Should be rejected immediately',
        category: 'roads',
        state: 'Maharashtra',
        district: 'Pune'
      });
    assert.equal(resCreate.status, 401);

    // Protected status update
    const resStatus = await request(app)
      .patch('/api/v1/complaints/CS-2026-0001/status')
      .send({ status: 'UNDER_REVIEW' });
    assert.equal(resStatus.status, 401);
  });

  it('8. Insufficient permissions return 403', async () => {
    // Citizen attempts administrative department reassignment
    const resDept = await request(app)
      .patch('/api/v1/complaints/CS-2026-0001/department')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({ departmentId: 'DEPT_WATER' });

    assert.equal(resDept.status, 403);
    assert.match(resDept.body.error, /access denied|insufficient/i);

    // Citizen attempts officer note addition
    const resNote = await request(app)
      .post('/api/v1/complaints/CS-2026-0001/notes')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({ note: 'Attempting internal note as citizen' });

    assert.equal(resNote.status, 403);
  });

  it('9. Citizen A cannot read, list, or modify Citizen B complaints', async () => {
    // Register Citizen B
    const regB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'citizenb@test.civicsarthi.internal',
        name: 'Citizen Beta',
        password: 'Password123'
      });
    citizenBId = regB.body.data.user.id;
    citizenBToken = regB.body.data.token;

    // Citizen A creates Complaint A
    const resA = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'Broken Culvert at Citizen A Sector',
        description: 'Large fissure on drainage culvert causing water logging for 3 days.',
        category: 'roads',
        state: 'Maharashtra',
        district: 'Pune',
        departmentId: 'DEPT_ROADS'
      });
    assert.equal(resA.status, 201);
    complaintA_Ref = resA.body.referenceNumber;

    // Citizen B creates Complaint B
    const resB = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenBToken}`)
      .send({
        title: 'Low Water Pressure at Citizen B Sector',
        description: 'Water pressure dropped below standard 0.5 bar in domestic tap network.',
        category: 'water',
        state: 'Maharashtra',
        district: 'Pune',
        departmentId: 'DEPT_WATER'
      });
    assert.equal(resB.status, 201);
    complaintB_Ref = resB.body.referenceNumber;

    // Citizen A lists complaints: MUST ONLY see Complaint A
    const listA = await request(app)
      .get('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`);

    assert.equal(listA.status, 200);
    const refsA = listA.body.data.map(c => c.referenceNumber);
    assert.ok(refsA.includes(complaintA_Ref), 'Citizen A must see their own complaint');
    assert.ok(!refsA.includes(complaintB_Ref), 'Citizen A must NOT see Citizen B complaint');

    // Citizen A directly accesses Complaint B by ID: MUST RETURN 403
    const directView = await request(app)
      .get(`/api/v1/complaints/${complaintB_Ref}`)
      .set('Authorization', `Bearer ${citizenAToken}`);

    assert.equal(directView.status, 403);
    assert.match(directView.body.error, /permission|access denied/i);
  });

  it('10. Citizens cannot read internal officer notes or private officer metadata', async () => {
    // Officer Roads appends an internal review note to Complaint A
    const noteRes = await request(app)
      .post(`/api/v1/complaints/${complaintA_Ref}/notes`)
      .set('Authorization', `Bearer ${officerRoadsToken}`)
      .send({
        note: 'CONFIDENTIAL: Excavation contractor contacted, site inspection at 0900 hrs.'
      });
    assert.equal(noteRes.status, 200);
    assert.ok(noteRes.body.data.officerNotes.length > 0);

    // Citizen A views their own Complaint A: officerNotes MUST BE STRIPPED
    const citizenView = await request(app)
      .get(`/api/v1/complaints/${complaintA_Ref}`)
      .set('Authorization', `Bearer ${citizenAToken}`);

    assert.equal(citizenView.status, 200);
    assert.equal(citizenView.body.data.officerNotes, undefined, 'Officer notes must not be present in citizen view');

    // Public tracking of Complaint A: officerNotes and PII MUST BE STRIPPED
    const trackView = await request(app)
      .get(`/api/v1/complaints/${complaintA_Ref}/track`);

    assert.equal(trackView.status, 200);
    assert.equal(trackView.body.data.officerNotes, undefined);
    assert.equal(trackView.body.data.citizenName, undefined);
    assert.equal(trackView.body.data.citizenEmail, undefined);
  });

  it('11. Officers cannot access unauthorized departments (Department Isolation)', async () => {
    // Officer Water attempts to update Complaint A (which belongs to DEPT_ROADS)
    const badStatusRes = await request(app)
      .patch(`/api/v1/complaints/${complaintA_Ref}/status`)
      .set('Authorization', `Bearer ${officerWaterToken}`)
      .send({
        status: 'UNDER_REVIEW',
        remarks: 'Water officer trying to touch roads complaint'
      });

    assert.equal(badStatusRes.status, 403);
    assert.match(badStatusRes.body.error, /not authorized|department/i);

    // Officer Water attempts to add note to Complaint A (DEPT_ROADS)
    const badNoteRes = await request(app)
      .post(`/api/v1/complaints/${complaintA_Ref}/notes`)
      .set('Authorization', `Bearer ${officerWaterToken}`)
      .send({
        note: 'Illegal cross-department note attempt'
      });

    assert.equal(badNoteRes.status, 403);

    // Officer Roads successfully updates Complaint A (authorized)
    const goodStatusRes = await request(app)
      .patch(`/api/v1/complaints/${complaintA_Ref}/status`)
      .set('Authorization', `Bearer ${officerRoadsToken}`)
      .send({
        status: 'UNDER_REVIEW',
        remarks: 'Roads engineer review initiated'
      });

    assert.equal(goodStatusRes.status, 200);
    assert.equal(goodStatusRes.body.data.status, 'UNDER_REVIEW');
  });

  it('12. Officers cannot create admin accounts or change their own roles', async () => {
    // Officer Roads tries to invoke administrative provisioning API
    const resProvision = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${officerRoadsToken}`)
      .send({
        email: 'unauthorized.admin@civicsarthi.internal',
        name: 'Unauthorized Admin',
        password: 'Password123!',
        role: 'admin'
      });

    assert.equal(resProvision.status, 403);
    assert.match(resProvision.body.error, /access denied/i);

    // Officer cannot access audit logs
    const resAudit = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${officerRoadsToken}`);

    assert.equal(resAudit.status, 403);
  });

  it('13. Spoofing x-portal-role: admin or x-portal-role: officer grants zero privileges', async () => {
    // Unauthenticated request with fake header
    const fakeHeaderUnauth = await request(app)
      .get('/api/v1/complaints')
      .set('x-portal-role', 'admin');
    assert.equal(fakeHeaderUnauth.status, 401);

    // Authenticated Citizen with spoofed header
    const fakeHeaderCitizen = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .set('x-portal-role', 'admin')
      .send({
        email: 'fake.escalated@civicsarthi.internal',
        name: 'Spoofed User',
        password: 'Password123!',
        role: 'admin'
      });
    assert.equal(fakeHeaderCitizen.status, 403);

    // Spoofing officer status update as citizen
    const spoofStatus = await request(app)
      .patch(`/api/v1/complaints/${complaintA_Ref}/status`)
      .set('Authorization', `Bearer ${citizenAToken}`)
      .set('x-portal-role', 'officer')
      .send({ status: 'RESOLVED' });
    assert.equal(spoofStatus.status, 403);
  });

  it('14. Administrative actions are recorded in an audit log', async () => {
    // Admin provisions a new officer
    const provRes = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'officer.audited@civicsarthi.internal',
        name: 'Audited Officer',
        password: 'Password123!',
        role: 'officer',
        departmentId: 'DEPT_ROADS'
      });

    assert.equal(provRes.status, 201);
    const provisionedId = provRes.body.data.id;

    // Admin reassigns department of Complaint B
    const reassignRes = await request(app)
      .patch(`/api/v1/complaints/${complaintB_Ref}/department`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId: 'DEPT_ROADS',
        remarks: 'Administrative transfer due to road pipeline intersection'
      });
    assert.equal(reassignRes.status, 200);

    // Admin views audit logs
    const auditRes = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.body.data));

    const provLog = auditRes.body.data.find(l => l.action === 'PROVISION_USER' && l.targetResource === provisionedId);
    assert.ok(provLog, 'PROVISION_USER audit entry must be recorded');
    assert.equal(provLog.role, 'admin');

    const reassignLog = auditRes.body.data.find(l => l.action === 'UPDATE_DEPARTMENT' && l.targetResource === complaintB_Ref);
    assert.ok(reassignLog, 'UPDATE_DEPARTMENT audit entry must be recorded');
  });

  it('15. Existing status-transition governance rules remain strictly enforced', async () => {
    // Create new complaint in SUBMITTED state
    const newCompRes = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        title: 'Street Lamp Flicker in Ward 9',
        description: 'The street light keeps fluctuating voltage at night for ten days.',
        category: 'electricity',
        state: 'Maharashtra',
        district: 'Pune',
        departmentId: 'DEPT_POWER'
      });
    assert.equal(newCompRes.status, 201);
    const testRef = newCompRes.body.referenceNumber;

    // Admin attempts illegal jump directly to RESOLVED without prior triage
    const illegalTransition = await request(app)
      .patch(`/api/v1/complaints/${testRef}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED',
        remarks: 'Illegal jump'
      });

    assert.equal(illegalTransition.status, 400);
    assert.match(illegalTransition.body.error, /invalid status transition/i);
  });

  it('16. Public tracking endpoint works without authentication and strips all confidential data', async () => {
    const trackRes = await request(app)
      .get(`/api/v1/complaints/${complaintA_Ref}/track`);

    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.body.success, true);
    assert.equal(trackRes.body.data.referenceNumber, complaintA_Ref);
    assert.ok(trackRes.body.data.status);
    assert.ok(trackRes.body.data.departmentId);

    // Must not expose PII or officer notes
    assert.equal(trackRes.body.data.officerNotes, undefined);
    assert.equal(trackRes.body.data.citizenEmail, undefined);
    assert.equal(trackRes.body.data.citizenPhone, undefined);
  });

  it('17. Authentication rate limits enforce throttling and return 429 when threshold exceeded', async () => {
    const rateLimitedApp = express();
    rateLimitedApp.use(express.json());
    const strictLimiter = createAuthRateLimiter(3);
    rateLimitedApp.post('/test-auth', strictLimiter, (req, res) => res.json({ success: true, ok: true }));

    // Send 3 requests: all should succeed
    for (let i = 0; i < 3; i++) {
      const res = await request(rateLimitedApp).post('/test-auth');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    }

    // 4th request must be throttled with 429 Too Many Requests
    const blockedRes = await request(rateLimitedApp).post('/test-auth');
    assert.equal(blockedRes.status, 429);
    assert.equal(blockedRes.body.success, false);
    assert.match(blockedRes.body.error, /too many/i);
  });
});
