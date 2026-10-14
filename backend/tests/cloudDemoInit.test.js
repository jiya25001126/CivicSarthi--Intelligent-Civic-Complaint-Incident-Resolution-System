import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { runCloudDemoInit, DEMO_PERSONAS } from '../src/scripts/init-cloud-demo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_SANDBOX_DIR = path.resolve(__dirname, 'sandbox-cloud-demo-test');
const TEST_USERS_PATH = path.join(TEST_SANDBOX_DIR, 'users.test.json');

const app = createApp();

/**
 * In-memory Mock UserModel that replicates Mongoose UserModel operations
 * without connecting to or altering production MongoDB.
 */
class MockUserModel {
  constructor(initialUsers = []) {
    this.users = new Map();
    for (const u of initialUsers) {
      this.users.set(u.email.toLowerCase(), { ...u });
    }
  }

  findOne(query) {
    const email = query.email?.toLowerCase();
    const found = email ? this.users.get(email) : null;
    return {
      lean: async () => (found ? { ...found } : null)
    };
  }

  async create(userData) {
    const email = userData.email.toLowerCase();
    if (this.users.has(email)) {
      const err = new Error(`E11000 duplicate key error collection: users index: email_1 dup key: { email: "${email}" }`);
      err.code = 11000;
      throw err;
    }
    const record = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(email, record);
    return {
      toObject: () => ({ ...record })
    };
  }

  async countDocuments() {
    return this.users.size;
  }
}

/**
 * Mock DepartmentModel to test department initialization and failure handling.
 */
class MockDepartmentModel {
  constructor(shouldThrow = false) {
    this.departments = new Map();
    this.shouldThrow = shouldThrow;
  }

  async updateOne(filter, update, options) {
    if (this.shouldThrow) {
      throw new Error('Disk quota exceeded on departments collection');
    }
    const id = filter.id;
    if (!this.departments.has(id)) {
      this.departments.set(id, { ...filter, ...update.$setOnInsert });
    }
    return { matchedCount: 1, modifiedCount: 0, upsertedCount: 1 };
  }
}

describe('CivicSarthi — Safe Cloud Demo Authentication & User Initialization Suite', () => {
  before(async () => {
    await fs.mkdir(TEST_SANDBOX_DIR, { recursive: true });
    userRepository.setFilePath(TEST_USERS_PATH);
  });

  after(async () => {
    userRepository.resetFilePath();
    try {
      await fs.rm(TEST_SANDBOX_DIR, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================
  // SECTION 1: Configuration & Failure Safety
  // ==========================================

  describe('1. Configuration & Safety Guardrails', () => {
    it('1.1 fails safely when MONGODB_URI is missing or empty', async () => {
      const res = await runCloudDemoInit({ uri: '' });
      assert.equal(res.success, false);
      assert.match(res.error, /MONGODB_URI.*required/i);
      assert.equal(res.created, 0);
      assert.equal(res.skipped, 0);
    });

    it('1.2 fails safely and calls disconnectFn when database connection cannot be established', async () => {
      let disconnectCalled = false;
      const mockConnect = async () => ({
        connected: false,
        error: 'Connection timeout to mock-atlas.example.internal'
      });
      const mockDisconnect = async () => {
        disconnectCalled = true;
      };

      const res = await runCloudDemoInit({
        uri: 'mongodb://mock-atlas.example.internal:27017/civicsarthi',
        connectDatabase: mockConnect,
        disconnectDatabase: mockDisconnect
      });

      assert.equal(res.success, false);
      assert.match(res.error, /Database connection failed/i);
      assert.equal(res.created, 0);
      assert.equal(disconnectCalled, true, 'disconnectFn must be called on failed connection');
    });

    it('1.3 fails safely and calls disconnectFn when connectFn throws an unhandled error', async () => {
      let disconnectCalled = false;
      const mockConnect = async () => {
        throw new Error('Socket closed abruptly during TLS handshake');
      };
      const mockDisconnect = async () => {
        disconnectCalled = true;
      };

      const res = await runCloudDemoInit({
        uri: 'mongodb://mock-atlas.example.internal:27017/civicsarthi',
        connectDatabase: mockConnect,
        disconnectDatabase: mockDisconnect
      });

      assert.equal(res.success, false);
      assert.match(res.error, /Socket closed abruptly/i);
      assert.equal(disconnectCalled, true, 'disconnectFn must be called when connection throws');
    });

    it('1.4 department upsert failure halts initialization, does not swallow error, and calls disconnectFn', async () => {
      let disconnectCalled = false;
      const mockModel = new MockUserModel();
      const failingDeptModel = new MockDepartmentModel(true); // Throws error
      const mockConnect = async () => ({ connected: true });
      const mockDisconnect = async () => {
        disconnectCalled = true;
      };

      const res = await runCloudDemoInit({
        uri: 'mongodb://mock-cluster/civicsarthi',
        connectDatabase: mockConnect,
        disconnectDatabase: mockDisconnect,
        userModel: mockModel,
        departmentModel: failingDeptModel
      });

      assert.equal(res.success, false);
      assert.match(res.error, /Failed to initialize required department/i);
      assert.match(res.error, /Disk quota exceeded/i);
      assert.equal(disconnectCalled, true, 'disconnectFn must be called when department upsert throws');
      // Proves accounts were not created if departments failed
      assert.equal(res.created, 0);
    });

    it('1.5 options.uri dynamically sets process.env.MONGODB_URI and restores previous value', async () => {
      const original = process.env.MONGODB_URI;
      process.env.MONGODB_URI = 'mongodb://original-cluster/testdb';

      let envSeenDuringConnect = null;
      const mockConnect = async () => {
        envSeenDuringConnect = process.env.MONGODB_URI;
        return { connected: true };
      };
      const mockDisconnect = async () => {};
      const mockModel = new MockUserModel();
      const mockDeptModel = new MockDepartmentModel(false);

      await runCloudDemoInit({
        uri: 'mongodb://custom-option-cluster/customdb',
        connectDatabase: mockConnect,
        disconnectDatabase: mockDisconnect,
        userModel: mockModel,
        departmentModel: mockDeptModel
      });

      assert.equal(envSeenDuringConnect, 'mongodb://custom-option-cluster/customdb');
      assert.equal(process.env.MONGODB_URI, 'mongodb://original-cluster/testdb');

      // Cleanup
      if (original !== undefined) {
        process.env.MONGODB_URI = original;
      } else {
        delete process.env.MONGODB_URI;
      }
    });
  });

  // ==========================================
  // SECTION 2: Idempotent Demo User Creation & Overwrite Protection
  // ==========================================

  describe('2. Idempotent Demo User Provisioning & Non-Destructive Invariants', () => {
    it('2.1 creates all missing demo personas with valid bcrypt hashes and verifies them', async () => {
      const mockModel = new MockUserModel();
      const mockDeptModel = new MockDepartmentModel(false);
      const mockConnect = async () => ({ connected: true });
      const mockDisconnect = async () => {};

      const res = await runCloudDemoInit({
        uri: 'mongodb://mock-cluster/civicsarthi',
        connectDatabase: mockConnect,
        disconnectDatabase: mockDisconnect,
        userModel: mockModel,
        departmentModel: mockDeptModel,
        demoPassword: 'DemoUser@2026'
      });

      assert.equal(res.success, true);
      assert.equal(res.created, DEMO_PERSONAS.length);
      assert.equal(res.skipped, 0);
      assert.equal(res.verified, DEMO_PERSONAS.length);

      // Verify each persona was properly stored and hashed
      for (const persona of DEMO_PERSONAS) {
        const doc = await mockModel.findOne({ email: persona.email }).lean();
        assert.ok(doc, `Persona ${persona.email} must exist in storage`);
        assert.equal(doc.role, persona.role);
        assert.equal(doc.departmentId, persona.role === 'officer' ? persona.departmentId : null);
        assert.match(doc.passwordHash, /^\$2[aby]\$\d+\$/, 'Must store a valid bcrypt hash');
        const matches = await bcrypt.compare('DemoUser@2026', doc.passwordHash);
        assert.equal(matches, true, 'Stored hash must authenticate against configured demo password');
      }
    });

    it('2.2 never overwrites an existing account password hash, profile, role, or department', async () => {
      const existingOriginalHash = await bcrypt.hash('CustomAdminSecret!999', 10);
      const preExistingAdmin = {
        id: 'USR-PREEXISTING-ADMIN-001',
        email: 'admin.demo@civicsarthi.internal',
        passwordHash: existingOriginalHash,
        name: 'Pre-existing Admin With Custom Password',
        role: 'admin',
        departmentId: null,
        isActive: true
      };

      const mockModel = new MockUserModel([preExistingAdmin]);
      const mockDeptModel = new MockDepartmentModel(false);
      const mockConnect = async () => ({ connected: true });
      const mockDisconnect = async () => {};

      const res = await runCloudDemoInit({
        uri: 'mongodb://mock-cluster/civicsarthi',
        connectDatabase: mockConnect,
        disconnectDatabase: mockDisconnect,
        userModel: mockModel,
        departmentModel: mockDeptModel,
        demoPassword: 'DemoUser@2026'
      });

      assert.equal(res.success, true);
      // admin.demo should have been skipped, others created
      const adminResult = res.results.find(r => r.email === 'admin.demo@civicsarthi.internal');
      assert.ok(adminResult);
      assert.equal(adminResult.action, 'skipped');

      // Crucial invariant: pre-existing document MUST NOT be altered
      const storedAdmin = await mockModel.findOne({ email: 'admin.demo@civicsarthi.internal' }).lean();
      assert.equal(storedAdmin.id, 'USR-PREEXISTING-ADMIN-001');
      assert.equal(storedAdmin.name, 'Pre-existing Admin With Custom Password');
      assert.equal(storedAdmin.passwordHash, existingOriginalHash);
      assert.equal(await bcrypt.compare('CustomAdminSecret!999', storedAdmin.passwordHash), true);
      assert.equal(await bcrypt.compare('DemoUser@2026', storedAdmin.passwordHash), false);
    });

    it('2.3 running initialization twice does not duplicate accounts or alter state', async () => {
      const mockModel = new MockUserModel();
      const mockDeptModel = new MockDepartmentModel(false);
      const mockConnect = async () => ({ connected: true });
      const mockDisconnect = async () => {};

      // Run 1: Create
      const firstRun = await runCloudDemoInit({
        uri: 'mongodb://mock-cluster/civicsarthi',
        connectDatabase: mockConnect,
        disconnectDatabase: mockDisconnect,
        userModel: mockModel,
        departmentModel: mockDeptModel,
        demoPassword: 'DemoUser@2026'
      });
      assert.equal(firstRun.created, DEMO_PERSONAS.length);

      const countAfterFirst = await mockModel.countDocuments();

      // Run 2: Re-run should skip 100% of accounts
      const secondRun = await runCloudDemoInit({
        uri: 'mongodb://mock-cluster/civicsarthi',
        connectDatabase: mockConnect,
        disconnectDatabase: mockDisconnect,
        userModel: mockModel,
        departmentModel: mockDeptModel,
        demoPassword: 'DemoUser@2026'
      });

      assert.equal(secondRun.success, true);
      assert.equal(secondRun.created, 0);
      assert.equal(secondRun.skipped, DEMO_PERSONAS.length);
      assert.equal(secondRun.verified, 0);

      const countAfterSecond = await mockModel.countDocuments();
      assert.equal(countAfterSecond, countAfterFirst, 'Total accounts in storage must remain identical');
    });

    it('2.4 email normalization handles leading/trailing whitespace and mixed casing', async () => {
      const mockModel = new MockUserModel();
      const mockDeptModel = new MockDepartmentModel(false);
      const mockConnect = async () => ({ connected: true });
      const mockDisconnect = async () => {};

      const testPersonas = [
        {
          id: 'USR-NORM-TEST-001',
          email: '   CITIZEN.DEMO@CivicSarthi.Internal   ',
          name: 'Padded Citizen',
          role: 'citizen',
          departmentId: null
        }
      ];

      const res = await runCloudDemoInit({
        uri: 'mongodb://mock-cluster/civicsarthi',
        connectDatabase: mockConnect,
        disconnectDatabase: mockDisconnect,
        userModel: mockModel,
        departmentModel: mockDeptModel,
        personas: testPersonas
      });

      assert.equal(res.success, true);
      assert.equal(res.created, 1);
      assert.equal(res.results[0].email, 'citizen.demo@civicsarthi.internal');

      const found = await mockModel.findOne({ email: 'citizen.demo@civicsarthi.internal' }).lean();
      assert.ok(found);
      assert.equal(found.email, 'citizen.demo@civicsarthi.internal');
    });
  });

  // ==========================================
  // SECTION 3: End-to-End Authentication Verification
  // ==========================================

  describe('3. End-to-End Authentication for Provisioned Demo Personas', () => {
    before(async () => {
      // Seed sandbox test repository with provisioned demo accounts
      const hash = await bcrypt.hash('DemoUser@2026', 10);
      for (const p of DEMO_PERSONAS) {
        await userRepository.create({
          id: p.id,
          email: p.email,
          passwordHash: hash,
          name: p.name,
          role: p.role,
          departmentId: p.departmentId || null,
          isActive: true
        });
      }
    });

    it('3.1 Citizen demo persona logs in successfully with configured credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'citizen.demo@civicsarthi.internal',
          password: 'DemoUser@2026'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, 'citizen.demo@civicsarthi.internal');
      assert.equal(res.body.data.user.role, 'citizen');
      assert.ok(res.body.data.token, 'Must return JWT token');

      // Verify session cookie was set
      const cookies = res.headers['set-cookie'] || [];
      const sessionCookie = cookies.find(c => c.startsWith('civicsarthi_session='));
      assert.ok(sessionCookie);
    });

    it('3.2 Roads Officer demo persona logs in successfully with department assignment', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'officer.roads@civicsarthi.internal',
          password: 'DemoUser@2026'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, 'officer.roads@civicsarthi.internal');
      assert.equal(res.body.data.user.role, 'officer');
      assert.equal(res.body.data.user.departmentId, 'DEPT_ROADS');
    });

    it('3.3 Water Officer demo persona logs in successfully with department assignment', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'officer.water@civicsarthi.internal',
          password: 'DemoUser@2026'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, 'officer.water@civicsarthi.internal');
      assert.equal(res.body.data.user.role, 'officer');
      assert.equal(res.body.data.user.departmentId, 'DEPT_WATER');
    });

    it('3.4 System Administrator demo persona logs in successfully with full privileges', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin.demo@civicsarthi.internal',
          password: 'DemoUser@2026'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, 'admin.demo@civicsarthi.internal');
      assert.equal(res.body.data.user.role, 'admin');
    });

    it('3.5 Incorrect password remains strictly rejected with HTTP 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'officer.roads@civicsarthi.internal',
          password: 'WrongPassword@999'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Invalid email or password');
    });

    it('3.6 Unregistered persona remains rejected with HTTP 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent.person@civicsarthi.internal',
          password: 'DemoUser@2026'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Invalid email or password');
    });
  });
});
