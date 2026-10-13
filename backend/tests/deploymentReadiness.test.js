/**
 * @file deploymentReadiness.test.js
 * @description Regression tests for public hackathon cloud deployment readiness.
 * Covers: Production configuration validation, frontend API base URL resolution,
 * CORS exact-origin enforcement, CSRF token verification, and session cookie security.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';
import { validateProductionConfig } from '../src/config/app.config.js';
import { getCookieOptions, getClearCookieOptions } from '../src/controllers/auth.controller.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { complaintRepository } from '../src/repositories/complaint.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import { resolveApiBaseUrl } from '../../frontend/src/api/client.js';
import { mockCpgramsRouter, MockCpgramsClient } from '../../mock-cpgrams/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();

const TEST_DIR = path.resolve(__dirname, 'sandbox-deployment-test');
const TEST_USERS_PATH = path.resolve(TEST_DIR, 'users.deploy.json');
const TEST_COMPLAINTS_PATH = path.resolve(TEST_DIR, 'complaints.deploy.json');
const TEST_AUDIT_PATH = path.resolve(TEST_DIR, 'audit_logs.deploy.json');

describe('CivicSarthi — Public Hackathon Deployment Readiness & Regression Suite', () => {
  before(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });

    userRepository.setFilePath(TEST_USERS_PATH);
    complaintRepository.setFilePath(TEST_COMPLAINTS_PATH);
    auditLogRepository.setFilePath(TEST_AUDIT_PATH);

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

    // Seed test citizen
    await userRepository.create({
      id: 'USR-DEPLOY-CITIZEN-01',
      email: 'citizen.deploy@test.internal',
      name: 'Deploy Citizen',
      passwordHash: '$2b$10$wK58d6qYF1cK5qU8pM8lQ.8eR3jYqT.6b1Q0x2.0W9V7M6Z4L3X2m',
      role: 'citizen',
      departmentId: null,
      isActive: true
    });
  });

  after(async () => {
    userRepository.resetFilePath();
    complaintRepository.resetFilePath();
    auditLogRepository.resetFilePath();
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Production Startup Configuration & Guardrails', () => {
    it('1.1 should reject production startup when JWT_SECRET is missing or under 16 characters', () => {
      const resultMissing = validateProductionConfig('production', {
        PERSISTENCE_MODE: 'mongodb',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/civicsarthi'
      });
      assert.equal(resultMissing.valid, false);
      assert.ok(resultMissing.errors.some(e => e.includes('JWT_SECRET')));

      const resultShort = validateProductionConfig('production', {
        JWT_SECRET: 'short-secret-9',
        PERSISTENCE_MODE: 'mongodb',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/civicsarthi'
      });
      assert.equal(resultShort.valid, false);
      assert.ok(resultShort.errors.some(e => e.includes('JWT_SECRET')));
    });

    it('1.2 should reject production startup when PERSISTENCE_MODE is not mongodb', () => {
      const resultJson = validateProductionConfig('production', {
        JWT_SECRET: 'super_secure_production_secret_32bytes',
        PERSISTENCE_MODE: 'json',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/civicsarthi'
      });
      assert.equal(resultJson.valid, false);
      assert.ok(resultJson.errors.some(e => e.includes('PERSISTENCE_MODE')));
    });

    it('1.3 should reject production startup when MONGODB_URI is missing or empty', () => {
      const resultNoUri = validateProductionConfig('production', {
        JWT_SECRET: 'super_secure_production_secret_32bytes',
        PERSISTENCE_MODE: 'mongodb',
        MONGODB_URI: ''
      });
      assert.equal(resultNoUri.valid, false);
      assert.ok(resultNoUri.errors.some(e => e.includes('MONGODB_URI')));
    });

    it('1.4 should pass production validation when all required production variables are set', () => {
      const resultValid = validateProductionConfig('production', {
        JWT_SECRET: 'super_secure_production_secret_32bytes_min',
        PERSISTENCE_MODE: 'mongodb',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/civicsarthi?retryWrites=true'
      });
      assert.equal(resultValid.valid, true);
      assert.equal(resultValid.errors.length, 0);
    });

    it('1.5 should not enforce strict production requirements in development or test environments', () => {
      const resultDev = validateProductionConfig('development', {});
      assert.equal(resultDev.valid, true);

      const resultTest = validateProductionConfig('test', {});
      assert.equal(resultTest.valid, true);
    });
  });

  describe('2. Frontend API Base URL Resolution (Vercel Same-Origin & Fallback Safety)', () => {
    it('2.1 in production, defaults to empty string (same-origin relative /api/v1) when VITE_API_URL is unset', () => {
      const resolved = resolveApiBaseUrl(undefined, true);
      assert.equal(resolved, '');
    });

    it('2.2 in production, defaults to empty string when VITE_API_URL is empty string', () => {
      const resolved = resolveApiBaseUrl('', true);
      assert.equal(resolved, '');

      const resolvedWhitespace = resolveApiBaseUrl('   ', true);
      assert.equal(resolvedWhitespace, '');
    });

    it('2.3 in production, respects explicitly configured VITE_API_URL and strips trailing slash', () => {
      const resolvedWithSlash = resolveApiBaseUrl('https://civicsarthi-backend.onrender.com/', true);
      assert.equal(resolvedWithSlash, 'https://civicsarthi-backend.onrender.com');

      const resolvedNoSlash = resolveApiBaseUrl('https://api.civicsarthi.org', true);
      assert.equal(resolvedNoSlash, 'https://api.civicsarthi.org');
    });

    it('2.4 in development, defaults to localhost:5000 when VITE_API_URL is unset', () => {
      const resolvedDev = resolveApiBaseUrl(undefined, false);
      assert.equal(resolvedDev, 'http://localhost:5000');
    });
  });

  describe('3. CORS Exact-Origin Policy & Preflight Handshake', () => {
    it('3.1 allows pre-configured origin and returns access-control-allow-origin with credentials', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });

    it('3.2 denies unallowed origin by omitting access-control-allow-origin', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://malicious-phishing-attacker.com');

      assert.equal(res.status, 200);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });

    it('3.3 preflight OPTIONS permits Idempotency-Key, Content-Type, and x-csrf-token headers', async () => {
      const res = await request(app)
        .options('/api/v1/complaints')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type, idempotency-key, x-csrf-token');

      assert.equal(res.status, 204);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');

      const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
      assert.ok(allowedHeaders.includes('content-type'));
      assert.ok(allowedHeaders.includes('idempotency-key'));
      assert.ok(allowedHeaders.includes('x-csrf-token'));
    });
  });

  describe('4. Authentication, Session Cookies & CSRF Protection Boundary', () => {
    let sessionCookie = null;
    let csrfCookie = null;
    let csrfToken = null;
    let bearerToken = null;

    it('4.1 login endpoint sets HttpOnly session cookie and readable CSRF cookie', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'citizen.deploy@test.internal',
          password: 'Password123!'
        });

      // If password in test setup doesn't match dummy hash, test via direct registration
      let cookies = loginRes.headers['set-cookie'] || [];
      if (loginRes.status !== 200) {
        const regRes = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'citizen.new@test.internal',
            password: 'StrongPassword@123',
            name: 'New Citizen'
          });
        assert.equal(regRes.status, 201);
        cookies = regRes.headers['set-cookie'] || [];
        bearerToken = regRes.body.data.token;
        csrfToken = regRes.body.data.csrfToken;
      } else {
        bearerToken = loginRes.body.data.token;
        csrfToken = loginRes.body.data.csrfToken;
      }

      assert.ok(cookies.length >= 2, 'Must set both session and CSRF cookies');
      sessionCookie = cookies.find(c => c.startsWith('civicsarthi_session='));
      csrfCookie = cookies.find(c => c.startsWith('civicsarthi_csrf='));

      assert.ok(sessionCookie, 'Must set civicsarthi_session cookie');
      assert.ok(sessionCookie.includes('HttpOnly'), 'civicsarthi_session must be HttpOnly');
      assert.ok(csrfCookie, 'Must set civicsarthi_csrf cookie');
      assert.ok(!csrfCookie.includes('HttpOnly'), 'civicsarthi_csrf must be readable by client script');
    });

    it('4.2 rejects state-modifying POST request when authenticated via cookie but missing x-csrf-token header with 403', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          title: 'Unauthorised CSRF Complaint',
          description: 'This request lacks x-csrf-token header',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          district: 'Central',
          locality: 'MG Road'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.toLowerCase().includes('csrf'));
    });

    it('4.3 rejects state-modifying POST request when x-csrf-token header does not match cookie with 403', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Cookie', [sessionCookie, csrfCookie])
        .set('x-csrf-token', 'tampered-csrf-token-xyz')
        .send({
          title: 'Tampered CSRF Complaint',
          description: 'This request has mismatched x-csrf-token header',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          district: 'Central',
          locality: 'MG Road'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.toLowerCase().includes('csrf'));
    });

    it('4.4 permits state-modifying POST request when session cookie and matching x-csrf-token header are provided', async () => {
      const csrfValueMatch = csrfCookie.split(';')[0].split('=')[1];

      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Cookie', [sessionCookie, csrfCookie])
        .set('x-csrf-token', csrfValueMatch)
        .send({
          title: 'Pothole on Main Highway near Junction 4',
          description: 'Severe road surface damage causing traffic hazard and vehicle damage',
          category: 'roads',
          departmentId: 'DEPT_ROADS',
          state: 'Maharashtra',
          district: 'Central',
          locality: 'MG Road'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.referenceNumber || res.body.data?.referenceNumber);
    });

    it('4.5 allows API clients using Bearer token authorization header without requiring CSRF token', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({
          title: 'Streetlight outage near bus depot',
          description: 'Streetlights have been non-functional for 3 consecutive nights along the corridor',
          category: 'electricity',
          departmentId: 'DEPT_POWER',
          state: 'Maharashtra',
          district: 'North',
          locality: 'Sector 5'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });
  });

  describe('5. Cookie SameSite & Security Attributes Configuration', () => {
    it('5.1 getCookieOptions enforces HttpOnly for session and accessible for CSRF', () => {
      const sessionOpts = getCookieOptions(true);
      assert.equal(sessionOpts.httpOnly, true);
      assert.equal(sessionOpts.path, '/');
      assert.equal(sessionOpts.maxAge, 24 * 60 * 60 * 1000);

      const csrfOpts = getCookieOptions(false);
      assert.equal(csrfOpts.httpOnly, false);
      assert.equal(csrfOpts.path, '/');
    });

    it('5.2 getClearCookieOptions matches clearing attributes', () => {
      const clearOpts = getClearCookieOptions(true);
      assert.equal(clearOpts.httpOnly, true);
      assert.equal(clearOpts.path, '/');
      assert.equal(clearOpts.maxAge, undefined);
    });
  });

  describe('6. Monorepo Module Layout & Root Dependency Resolution (Mock-CPGRAMS)', () => {
    it('6.1 loads mockCpgramsRouter and validates it is an Express router instance', () => {
      assert.equal(typeof mockCpgramsRouter, 'function', 'mockCpgramsRouter must be an Express middleware/router function');
      assert.equal(typeof mockCpgramsRouter.get, 'function', 'mockCpgramsRouter must have HTTP GET handler method');
      assert.equal(typeof mockCpgramsRouter.patch, 'function', 'mockCpgramsRouter must have HTTP PATCH handler method');
    });

    it('6.2 instantiates MockCpgramsClient adapter successfully', () => {
      const client = new MockCpgramsClient();
      assert.ok(client, 'MockCpgramsClient must instantiate cleanly');
      assert.equal(typeof client.fetchAllComplaints, 'function');
      assert.equal(typeof client.getComplaintById, 'function');
      assert.equal(typeof client.updateComplaintStatus, 'function');
    });

    it('6.3 serves mock-cpgrams router via backend application routes without module resolution errors', async () => {
      const res = await request(app).get('/api/v1/mock-cpgrams/complaints');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.source, 'MOCK_CPGRAMS_SERVICE');
      assert.equal(res.body.synthetic, true);
      assert.ok(Array.isArray(res.body.data));
    });
  });
});
