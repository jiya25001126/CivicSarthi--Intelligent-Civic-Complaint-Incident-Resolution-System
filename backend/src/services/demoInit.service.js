import bcrypt from 'bcryptjs';
import config from '../config/app.config.js';
import { isConnected } from '../config/database.js';
import { userRepository } from '../repositories/user.repository.js';
import { DepartmentModel } from '../models/department.model.js';
import { SEED_DEPARTMENTS } from '../scripts/seed.js';

export const DEMO_ACCOUNTS_FIXTURES = [
  {
    id: 'USR-DEMO-CITIZEN-001',
    email: 'citizen.demo@civicsarthi.internal',
    name: 'Aarav Sharma (Citizen)',
    role: 'citizen',
    departmentId: null,
    isActive: true
  },
  {
    id: 'USR-DEMO-ROADS-002',
    email: 'officer.roads@civicsarthi.internal',
    name: 'Rajesh Patel (Roads Nodal Officer)',
    role: 'officer',
    departmentId: 'DEPT_ROADS',
    isActive: true
  },
  {
    id: 'USR-DEMO-WATER-003',
    email: 'officer.water@civicsarthi.internal',
    name: 'Sunita Verma (Water Nodal Officer)',
    role: 'officer',
    departmentId: 'DEPT_WATER',
    isActive: true
  },
  {
    id: 'USR-DEMO-MUNICIPAL-004',
    email: 'officer.municipal@civicsarthi.internal',
    name: 'Anil Deshmukh (Municipal Nodal Officer)',
    role: 'officer',
    departmentId: 'DEPT_MUNICIPAL',
    isActive: true
  },
  {
    id: 'USR-DEMO-ADMIN-005',
    email: 'admin.demo@civicsarthi.internal',
    name: 'Kavita Mehta (System Administrator)',
    role: 'admin',
    departmentId: null,
    isActive: true
  }
];

/**
 * Idempotent, safe initialization of standard departments and demo accounts.
 * - Opt-in: requires INITIALIZE_DEMO_ACCOUNTS=true or options.force=true.
 * - Password requirement: requires DEMO_USER_PASSWORD or DEMO_PASSWORD env variable (no hardcoded fallback).
 * - Preserves all existing citizen and officer records without dropping or resetting collections.
 * - Uses existing bcrypt hashing mechanism (same salt rounds as normal registration).
 * - Does NOT expose credentials, hashes, or tokens in logs.
 */
export async function initializeDemoAccounts(options = {}) {
  const isOptedIn =
    options.force === true ||
    process.env.INITIALIZE_DEMO_ACCOUNTS === 'true' ||
    process.env.INITIALIZE_DEMO_ACCOUNTS === '1';

  if (!isOptedIn) {
    return {
      initialized: false,
      reason: 'INITIALIZE_DEMO_ACCOUNTS is not enabled (set INITIALIZE_DEMO_ACCOUNTS=true to opt in)'
    };
  }

  const demoPassword = options.demoPassword || process.env.DEMO_USER_PASSWORD || process.env.DEMO_PASSWORD;
  if (!demoPassword) {
    console.log('[CivicSarthi Demo Init] Initialization skipped: no demo password configured in environment.');
    return {
      initialized: false,
      reason: 'DEMO_USER_PASSWORD or DEMO_PASSWORD environment variable is required'
    };
  }

  const saltRounds = config.auth?.bcryptSaltRounds || 10;
  const passwordHash = await bcrypt.hash(demoPassword, saltRounds);

  // 1. Ensure Standard Departments Exist in Database (Non-destructive)
  let deptsCreated = 0;
  if (isConnected()) {
    try {
      for (const dept of SEED_DEPARTMENTS) {
        const existing = await DepartmentModel.findOne({
          $or: [{ id: dept.id }, { code: dept.code }]
        }).lean();

        if (!existing) {
          await DepartmentModel.create(dept);
          deptsCreated++;
        }
      }
    } catch (deptErr) {
      console.warn('[CivicSarthi Demo Init Warning] Department verification skipped:', deptErr.message);
    }
  }

  // 2. Ensure Demo Accounts Exist in User Storage (Non-destructive)
  const results = {
    initialized: true,
    departmentsEnsured: deptsCreated,
    usersCreated: 0,
    usersPreserved: 0,
    usersUpdated: 0
  };

  const shouldSyncPassword =
    options.forcePasswordSync === true || process.env.FORCE_DEMO_PASSWORD_SYNC === 'true';

  for (const acct of DEMO_ACCOUNTS_FIXTURES) {
    try {
      const existing = await userRepository.findByEmail(acct.email);

      if (!existing) {
        await userRepository.create({
          id: acct.id,
          email: acct.email,
          passwordHash,
          name: acct.name,
          role: acct.role,
          departmentId: acct.departmentId,
          isActive: true
        });
        results.usersCreated++;
      } else {
        if (shouldSyncPassword) {
          await userRepository.update(existing.id, {
            passwordHash,
            role: acct.role,
            departmentId: acct.departmentId,
            name: acct.name,
            isActive: true
          });
          results.usersUpdated++;
        } else {
          results.usersPreserved++;
        }
      }
    } catch (userErr) {
      console.error(`[CivicSarthi Demo Init Error] Failed to process ${acct.email}:`, userErr.message);
    }
  }

  console.log(
    `[CivicSarthi Demo Init] Demo accounts verified (created: ${results.usersCreated}, preserved: ${results.usersPreserved}, updated: ${results.usersUpdated}). Standard departments verified.`
  );

  return results;
}

export default initializeDemoAccounts;
