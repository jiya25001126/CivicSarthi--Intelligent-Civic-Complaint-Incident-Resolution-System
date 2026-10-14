import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { userRepository } from '../src/repositories/user.repository.js';
import { authService } from '../src/services/auth.service.js';
import { initializeDemoAccounts, DEMO_ACCOUNTS_FIXTURES } from '../src/services/demoInit.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DIR = path.resolve(__dirname, 'sandbox-demo-init-test');
const TEST_USERS_PATH = path.resolve(TEST_DIR, 'users.demo.json');

describe('CivicSarthi — Demo Accounts & Department Initialization Service', () => {
  before(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    userRepository.setFilePath(TEST_USERS_PATH);

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

  it('1. initializes all 5 demo accounts while strictly preserving pre-existing user records', async () => {
    const result = await initializeDemoAccounts({ force: true });

    assert.equal(result.usersCreated, DEMO_ACCOUNTS_FIXTURES.length);

    // Verify existing user is untouched
    const existingUser = await userRepository.findByEmail('existing.citizen@example.com');
    assert.ok(existingUser);
    assert.equal(existingUser.id, 'USR-EXISTING-CITIZEN-01');
    assert.equal(existingUser.name, 'Pooja Existing');

    // Verify all demo accounts exist
    for (const demo of DEMO_ACCOUNTS_FIXTURES) {
      const user = await userRepository.findByEmail(demo.email);
      assert.ok(user, `Demo account ${demo.email} must exist in repository`);
      assert.equal(user.role, demo.role);
      assert.equal(user.departmentId, demo.departmentId);
      assert.equal(user.isActive, true);
    }
  });

  it('2. is idempotent: running initialization again preserves all accounts without duplicating', async () => {
    const secondResult = await initializeDemoAccounts({ force: true });

    assert.equal(secondResult.usersCreated, 0);
    assert.equal(secondResult.usersPreserved, DEMO_ACCOUNTS_FIXTURES.length);

    const allUsers = await userRepository.findAll();
    assert.equal(allUsers.length, DEMO_ACCOUNTS_FIXTURES.length + 1); // 5 demo + 1 existing
  });

  it('3. authenticates successfully with each demo account persona using demo password', async () => {
    const demoPassword = process.env.DEMO_USER_PASSWORD || process.env.DEMO_PASSWORD || 'DemoUser@2026';

    // 3.1 Citizen
    const citizenLogin = await authService.login({
      email: 'citizen.demo@civicsarthi.internal',
      password: demoPassword
    });
    assert.ok(citizenLogin.token);
    assert.equal(citizenLogin.user.role, 'citizen');
    assert.equal(citizenLogin.user.departmentId, null);

    // 3.2 Roads Officer
    const roadsLogin = await authService.login({
      email: 'officer.roads@civicsarthi.internal',
      password: demoPassword
    });
    assert.ok(roadsLogin.token);
    assert.equal(roadsLogin.user.role, 'officer');
    assert.equal(roadsLogin.user.departmentId, 'DEPT_ROADS');

    // 3.3 Water Officer
    const waterLogin = await authService.login({
      email: 'officer.water@civicsarthi.internal',
      password: demoPassword
    });
    assert.ok(waterLogin.token);
    assert.equal(waterLogin.user.role, 'officer');
    assert.equal(waterLogin.user.departmentId, 'DEPT_WATER');

    // 3.4 Municipal Officer
    const municipalLogin = await authService.login({
      email: 'officer.municipal@civicsarthi.internal',
      password: demoPassword
    });
    assert.ok(municipalLogin.token);
    assert.equal(municipalLogin.user.role, 'officer');
    assert.equal(municipalLogin.user.departmentId, 'DEPT_MUNICIPAL');

    // 3.5 System Admin
    const adminLogin = await authService.login({
      email: 'admin.demo@civicsarthi.internal',
      password: demoPassword
    });
    assert.ok(adminLogin.token);
    assert.equal(adminLogin.user.role, 'admin');
    assert.equal(adminLogin.user.departmentId, null);
  });
});
