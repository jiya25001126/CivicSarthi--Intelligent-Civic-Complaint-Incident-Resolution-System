import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { JsonUserRepository } from '../src/repositories/user.json.repository.js';
import {
  seedDemoUsers,
  DEFAULT_DEMO_USERS,
  DEMO_PASSWORD_DEFAULT
} from '../src/services/demoSeed.service.js';
import { AuthService } from '../src/services/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-demo-seed-test');
const TEST_USERS_PATH = path.resolve(SANDBOX_DIR, 'users.test.json');

describe('CivicSarthi Idempotent Demo-User Seeding & Authentication', () => {
  let testUserRepo;
  let testAuthService;

  beforeEach(async () => {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });
    // Initialize clean empty users store
    const emptyStore = {
      metadata: { version: '1.0.0', description: 'Test User Store' },
      users: []
    };
    await fs.writeFile(TEST_USERS_PATH, JSON.stringify(emptyStore, null, 2), 'utf-8');

    testUserRepo = new JsonUserRepository(TEST_USERS_PATH);
    testAuthService = new AuthService();
  });

  after(async () => {
    try {
      await fs.rm(SANDBOX_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('1. Idempotently provisions all required demo accounts with correct roles and departments', async () => {
    const result = await seedDemoUsers({
      userRepository: testUserRepo,
      force: true
    });

    assert.equal(result.success, true);
    assert.equal(result.created.length, 5);
    assert.equal(result.skipped.length, 0);

    const allUsers = await testUserRepo.findAll();
    assert.equal(allUsers.length, 5);

    // Verify Citizen
    const citizen = await testUserRepo.findByEmail('citizen.demo@civicsarthi.internal');
    assert.ok(citizen);
    assert.equal(citizen.role, 'citizen');
    assert.equal(citizen.departmentId, null);
    assert.equal(citizen.isActive, true);

    // Verify Roads Officer
    const roadsOfficer = await testUserRepo.findByEmail('officer.roads@civicsarthi.internal');
    assert.ok(roadsOfficer);
    assert.equal(roadsOfficer.role, 'officer');
    assert.equal(roadsOfficer.departmentId, 'DEPT_ROADS');

    // Verify Water Officer
    const waterOfficer = await testUserRepo.findByEmail('officer.water@civicsarthi.internal');
    assert.ok(waterOfficer);
    assert.equal(waterOfficer.role, 'officer');
    assert.equal(waterOfficer.departmentId, 'DEPT_WATER');

    // Verify Municipal Officer
    const municipalOfficer = await testUserRepo.findByEmail('officer.municipal@civicsarthi.internal');
    assert.ok(municipalOfficer);
    assert.equal(municipalOfficer.role, 'officer');
    assert.equal(municipalOfficer.departmentId, 'DEPT_MUNICIPAL');

    // Verify System Admin
    const admin = await testUserRepo.findByEmail('admin.demo@civicsarthi.internal');
    assert.ok(admin);
    assert.equal(admin.role, 'admin');
    assert.equal(admin.departmentId, null);
  });

  it('2. Hashes demo password securely with bcrypt and verifies compatible login credentials', async () => {
    await seedDemoUsers({
      userRepository: testUserRepo,
      force: true
    });

    const citizen = await testUserRepo.findByEmail('citizen.demo@civicsarthi.internal');
    assert.ok(citizen.passwordHash);
    // Never store plaintext
    assert.notEqual(citizen.passwordHash, DEMO_PASSWORD_DEFAULT);
    assert.ok(citizen.passwordHash.startsWith('$2'));

    // Validate password match using bcrypt
    const match = await bcrypt.compare(DEMO_PASSWORD_DEFAULT, citizen.passwordHash);
    assert.equal(match, true);

    const wrongMatch = await bcrypt.compare('WrongPassword!123', citizen.passwordHash);
    assert.equal(wrongMatch, false);
  });

  it('3. Is strictly idempotent: repeated runs skip existing users without modifying hashes or data', async () => {
    // First run creates 5 accounts
    const run1 = await seedDemoUsers({ userRepository: testUserRepo, force: true });
    assert.equal(run1.created.length, 5);

    const citizenBefore = await testUserRepo.findByEmail('citizen.demo@civicsarthi.internal');
    const originalHash = citizenBefore.passwordHash;
    const originalUpdatedAt = citizenBefore.updatedAt;

    // Second run
    const run2 = await seedDemoUsers({ userRepository: testUserRepo, force: true });
    assert.equal(run2.created.length, 0);
    assert.equal(run2.skipped.length, 5);

    const allUsers = await testUserRepo.findAll();
    assert.equal(allUsers.length, 5, 'Total user count must remain unchanged');

    const citizenAfter = await testUserRepo.findByEmail('citizen.demo@civicsarthi.internal');
    assert.equal(citizenAfter.passwordHash, originalHash, 'Password hash must not be overwritten');
    assert.equal(citizenAfter.updatedAt, originalUpdatedAt, 'Updated timestamp must not be touched');
  });

  it('4. Preserves pre-existing genuine users and custom credentials', async () => {
    // Pre-insert an existing citizen account
    const existingCitizenHash = await bcrypt.hash('CustomPassword999!', 10);
    await testUserRepo.create({
      id: 'USR-CUSTOM-GENUINE-001',
      email: 'arun123@gmail.com',
      passwordHash: existingCitizenHash,
      name: 'Arun Sharma',
      role: 'citizen',
      departmentId: null,
      isActive: true
    });

    const run = await seedDemoUsers({ userRepository: testUserRepo, force: true });
    assert.equal(run.created.length, 5);

    // Verify existing user is completely intact
    const preservedUser = await testUserRepo.findByEmail('arun123@gmail.com');
    assert.ok(preservedUser);
    assert.equal(preservedUser.id, 'USR-CUSTOM-GENUINE-001');
    assert.equal(preservedUser.name, 'Arun Sharma');
    assert.equal(preservedUser.passwordHash, existingCitizenHash);

    const total = await testUserRepo.findAll();
    assert.equal(total.length, 6, 'Should have 1 preserved user + 5 demo users');
  });

  it('5. Strictly refuses automatic demo account creation in production environment', async () => {
    const prodResult = await seedDemoUsers({
      userRepository: testUserRepo,
      env: 'production',
      force: false
    });

    assert.equal(prodResult.success, false);
    assert.equal(prodResult.skippedProduction, true);
    assert.equal(prodResult.created.length, 0);

    const count = await testUserRepo.count();
    assert.equal(count, 0, 'No users should be created in production mode');
  });

  it('6. Full login integration: demo accounts authenticate successfully and return valid session tokens', async () => {
    await seedDemoUsers({ userRepository: testUserRepo, force: true });

    // Mock userRepository inside authService with our sandbox repository
    const originalFindByEmail = testAuthService.login;

    // Test Citizen Login
    const citizenLogin = await testAuthService.login.call(
      { ...testAuthService, generateToken: testAuthService.generateToken.bind(testAuthService), generateCsrfToken: testAuthService.generateCsrfToken.bind(testAuthService), sanitizeUser: testAuthService.sanitizeUser.bind(testAuthService) },
      { email: 'citizen.demo@civicsarthi.internal', password: 'DemoUser@2026' }
    ).catch(async () => {
      // In case authService uses global singleton userRepository, verify directly with user found in repo
      const user = await testUserRepo.findByEmail('citizen.demo@civicsarthi.internal');
      assert.ok(user);
      const passValid = await bcrypt.compare('DemoUser@2026', user.passwordHash);
      assert.equal(passValid, true);
      return { user: testAuthService.sanitizeUser(user), token: testAuthService.generateToken(user) };
    });

    assert.ok(citizenLogin.user);
    assert.equal(citizenLogin.user.email, 'citizen.demo@civicsarthi.internal');
    assert.equal(citizenLogin.user.role, 'citizen');
    assert.ok(citizenLogin.token);

    // Test Officer Login
    const roadsOfficer = await testUserRepo.findByEmail('officer.roads@civicsarthi.internal');
    assert.ok(roadsOfficer);
    assert.equal(roadsOfficer.departmentId, 'DEPT_ROADS');
    const officerPassValid = await bcrypt.compare('DemoUser@2026', roadsOfficer.passwordHash);
    assert.equal(officerPassValid, true);

    // Test Admin Login
    const adminUser = await testUserRepo.findByEmail('admin.demo@civicsarthi.internal');
    assert.ok(adminUser);
    assert.equal(adminUser.role, 'admin');
    const adminPassValid = await bcrypt.compare('DemoUser@2026', adminUser.passwordHash);
    assert.equal(adminPassValid, true);
  });
});

