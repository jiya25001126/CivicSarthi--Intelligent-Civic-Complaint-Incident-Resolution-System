import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { userRepository } from '../src/repositories/user.repository.js';
import { authService } from '../src/services/auth.service.js';
import { initializeDemoAccounts, DEMO_ACCOUNTS_FIXTURES } from '../src/services/demoInit.service.js';
import { runInitDemoCli } from '../src/scripts/init-demo-accounts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DIR = path.resolve(__dirname, 'sandbox-demo-init-test');
const TEST_USERS_PATH = path.resolve(TEST_DIR, 'users.demo.json');
const TEST_PASSWORD = 'SecureDemoPassword@2026';

describe('CivicSarthi — Demo Accounts Initialization Service', () => {
  before(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    userRepository.setFilePath(TEST_USERS_PATH);
  });

  beforeEach(async () => {
    // Seed a pre-existing citizen to test that existing records are preserved
    await fs.writeFile(
      TEST_USERS_PATH,
      JSON.stringify({
        metadata: { version: '1.0.0' },
        users: [
          {
            id: 'USR-EXISTING-CITIZEN-01',
            email: 'existing.citizen@example.com',
            name: 'Pooja Existing',
            passwordHash: '$2b$10$wK58d6qYF1cK5qU8pM8lQ.8eR3jYqT.6b1Q0x2.0W9V7M6Z4L3X2m',
            role: 'citizen',
            departmentId: null,
            isActive: true
          }
        ]
      }, null, 2),
      'utf-8'
    );
  });

  after(async () => {
    userRepository.resetFilePath();
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('1. disabled initialization: returns initialized: false and creates 0 accounts when not opted in', async () => {
    // Ensure env variable is unset
    const originalEnv = process.env.INITIALIZE_DEMO_ACCOUNTS;
    delete process.env.INITIALIZE_DEMO_ACCOUNTS;

    try {
      const result = await initializeDemoAccounts();
      assert.equal(result.initialized, false);
      assert.match(result.reason, /not enabled/i);

      // Verify no demo accounts were created
      const allUsers = await userRepository.findAll();
      assert.equal(allUsers.length, 1);
      assert.equal(allUsers[0].email, 'existing.citizen@example.com');
    } finally {
      if (originalEnv !== undefined) process.env.INITIALIZE_DEMO_ACCOUNTS = originalEnv;
    }
  });

  it('2. missing password: skips initialization and returns initialized: false when no password is provided', async () => {
    const originalPwd = process.env.DEMO_USER_PASSWORD;
    const originalFallback = process.env.DEMO_PASSWORD;
    delete process.env.DEMO_USER_PASSWORD;
    delete process.env.DEMO_PASSWORD;

    try {
      const result = await initializeDemoAccounts({ force: true });
      assert.equal(result.initialized, false);
      assert.match(result.reason, /DEMO_USER_PASSWORD or DEMO_PASSWORD/i);

      // Verify no demo accounts were created
      const allUsers = await userRepository.findAll();
      assert.equal(allUsers.length, 1);
    } finally {
      if (originalPwd !== undefined) process.env.DEMO_USER_PASSWORD = originalPwd;
      if (originalFallback !== undefined) process.env.DEMO_PASSWORD = originalFallback;
    }
  });

  it('3. initializes all 5 demo accounts with correct roles and departments while preserving existing records', async () => {
    const result = await initializeDemoAccounts({
      force: true,
      demoPassword: TEST_PASSWORD
    });

    assert.equal(result.initialized, true);
    assert.equal(result.usersCreated, DEMO_ACCOUNTS_FIXTURES.length);

    // Verify existing user is untouched
    const existingUser = await userRepository.findByEmail('existing.citizen@example.com');
    assert.ok(existingUser);
    assert.equal(existingUser.id, 'USR-EXISTING-CITIZEN-01');
    assert.equal(existingUser.name, 'Pooja Existing');

    // Verify all demo accounts exist with correct roles and departments
    for (const demo of DEMO_ACCOUNTS_FIXTURES) {
      const user = await userRepository.findByEmail(demo.email);
      assert.ok(user, `Demo account ${demo.email} must exist in repository`);
      assert.equal(user.role, demo.role);
      assert.equal(user.departmentId, demo.departmentId);
      assert.equal(user.isActive, true);
    }
  });

  it('4. is idempotent: running initialization again preserves all accounts without duplicating', async () => {
    // First run creates accounts
    await initializeDemoAccounts({ force: true, demoPassword: TEST_PASSWORD });

    // Second run preserves accounts
    const secondResult = await initializeDemoAccounts({ force: true, demoPassword: TEST_PASSWORD });

    assert.equal(secondResult.initialized, true);
    assert.equal(secondResult.usersCreated, 0);
    assert.equal(secondResult.usersPreserved, DEMO_ACCOUNTS_FIXTURES.length);

    const allUsers = await userRepository.findAll();
    assert.equal(allUsers.length, DEMO_ACCOUNTS_FIXTURES.length + 1); // 5 demo + 1 existing
  });

  it('5. authenticates successfully with each demo account persona using configured password', async () => {
    await initializeDemoAccounts({ force: true, demoPassword: TEST_PASSWORD });

    // 5.1 Citizen
    const citizenLogin = await authService.login({
      email: 'citizen.demo@civicsarthi.internal',
      password: TEST_PASSWORD
    });
    assert.ok(citizenLogin.token);
    assert.equal(citizenLogin.user.role, 'citizen');
    assert.equal(citizenLogin.user.departmentId, null);

    // 5.2 Roads Officer
    const roadsLogin = await authService.login({
      email: 'officer.roads@civicsarthi.internal',
      password: TEST_PASSWORD
    });
    assert.ok(roadsLogin.token);
    assert.equal(roadsLogin.user.role, 'officer');
    assert.equal(roadsLogin.user.departmentId, 'DEPT_ROADS');

    // 5.3 Water Officer
    const waterLogin = await authService.login({
      email: 'officer.water@civicsarthi.internal',
      password: TEST_PASSWORD
    });
    assert.ok(waterLogin.token);
    assert.equal(waterLogin.user.role, 'officer');
    assert.equal(waterLogin.user.departmentId, 'DEPT_WATER');

    // 5.4 Municipal Officer
    const municipalLogin = await authService.login({
      email: 'officer.municipal@civicsarthi.internal',
      password: TEST_PASSWORD
    });
    assert.ok(municipalLogin.token);
    assert.equal(municipalLogin.user.role, 'officer');
    assert.equal(municipalLogin.user.departmentId, 'DEPT_MUNICIPAL');

    // 5.5 System Admin
    const adminLogin = await authService.login({
      email: 'admin.demo@civicsarthi.internal',
      password: TEST_PASSWORD
    });
    assert.ok(adminLogin.token);
    assert.equal(adminLogin.user.role, 'admin');
    assert.equal(adminLogin.user.departmentId, null);
  });

  it('6. password preservation: does not alter passwords unless forcePasswordSync is true', async () => {
    // Initial run with TEST_PASSWORD
    await initializeDemoAccounts({ force: true, demoPassword: TEST_PASSWORD });

    // Rerun with a new password WITHOUT forcePasswordSync
    await initializeDemoAccounts({ force: true, demoPassword: 'DifferentPassword@999', forcePasswordSync: false });

    // Original password still succeeds
    const loginOk = await authService.login({
      email: 'citizen.demo@civicsarthi.internal',
      password: TEST_PASSWORD
    });
    assert.ok(loginOk.token);

    // New password fails
    await assert.rejects(
      () => authService.login({
        email: 'citizen.demo@civicsarthi.internal',
        password: 'DifferentPassword@999'
      }),
      (err) => err.status === 401 && /Invalid email or password/.test(err.message)
    );

    // Rerun WITH forcePasswordSync: true
    await initializeDemoAccounts({ force: true, demoPassword: 'DifferentPassword@999', forcePasswordSync: true });

    // Now new password succeeds
    const updatedLoginOk = await authService.login({
      email: 'citizen.demo@civicsarthi.internal',
      password: 'DifferentPassword@999'
    });
    assert.ok(updatedLoginOk.token);
  });

  it('7. CLI runner: fails with non-zero exit code and returns initialized: false when password is missing', async () => {
    const originalPwd = process.env.DEMO_USER_PASSWORD;
    const originalFallback = process.env.DEMO_PASSWORD;
    const originalExitCode = process.exitCode;
    delete process.env.DEMO_USER_PASSWORD;
    delete process.env.DEMO_PASSWORD;
    process.exitCode = 0;

    try {
      const result = await runInitDemoCli();
      assert.equal(result.initialized, false);
      assert.match(result.reason, /DEMO_USER_PASSWORD or DEMO_PASSWORD/i);
      assert.equal(process.exitCode, 1);
    } finally {
      if (originalPwd !== undefined) process.env.DEMO_USER_PASSWORD = originalPwd;
      if (originalFallback !== undefined) process.env.DEMO_PASSWORD = originalFallback;
      process.exitCode = originalExitCode;
    }
  });

  it('8. CLI runner: initializes accounts successfully and sets exitCode 0 when password is provided', async () => {
    const originalPwd = process.env.DEMO_USER_PASSWORD;
    const originalExitCode = process.exitCode;
    process.env.DEMO_USER_PASSWORD = TEST_PASSWORD;
    process.exitCode = undefined;

    try {
      const result = await runInitDemoCli();
      assert.equal(result.initialized, true);
      assert.equal(result.usersCreated, DEMO_ACCOUNTS_FIXTURES.length);
      assert.equal(process.exitCode, 0);

      const allUsers = await userRepository.findAll();
      assert.equal(allUsers.length, DEMO_ACCOUNTS_FIXTURES.length + 1);
    } finally {
      if (originalPwd !== undefined) {
        process.env.DEMO_USER_PASSWORD = originalPwd;
      } else {
        delete process.env.DEMO_USER_PASSWORD;
      }
      process.exitCode = originalExitCode;
    }
  });
});
