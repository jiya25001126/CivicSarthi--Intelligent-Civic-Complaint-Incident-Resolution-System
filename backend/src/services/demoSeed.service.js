import bcrypt from 'bcryptjs';
import config from '../config/app.config.js';
import { userRepository } from '../repositories/user.repository.js';

/**
 * Standard demonstration password pre-filled in CivicSarthi Login page.
 */
export const DEMO_PASSWORD_DEFAULT = 'DemoUser@2026';

/**
 * Authoritative demo personas matching the Quick Demo Credentials on LoginPage.jsx
 * and backend departmental authorization scopes.
 */
export const DEFAULT_DEMO_USERS = [
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
 * Idempotently provisions missing demo accounts for local development.
 * 
 * Safety & Architecture guarantees:
 * 1. Strictly development-only: Refuses to execute in production unless options.force is set.
 * 2. Idempotent: Checks findByEmail before creating; never overwrites existing accounts,
 *    password hashes, roles, or department assignments.
 * 3. Secure password hashing: Hashes with bcryptjs using configured salt rounds;
 *    never persists plaintext passwords.
 * 4. Repository agnostic: Operates through standard UserRepository adapter (JSON or MongoDB).
 * 5. Data integrity: Does not modify complaints, appeals, reminders, or user databases.
 */
export async function seedDemoUsers(options = {}) {
  const env = options.env || config.env || process.env.NODE_ENV || 'development';

  if (env === 'production' && !options.force) {
    return {
      success: false,
      skippedProduction: true,
      created: [],
      skipped: [],
      message: 'Demo user auto-seeding is disabled in production environment.'
    };
  }

  const userRepo = options.userRepository || userRepository;
  const demoUsers = options.demoUsers || DEFAULT_DEMO_USERS;
  const password = options.password || DEMO_PASSWORD_DEFAULT;
  const saltRounds = options.saltRounds || config.auth?.bcryptSaltRounds || 10;

  const results = {
    success: true,
    created: [],
    skipped: []
  };

  let cachedPasswordHash = null;

  for (const persona of demoUsers) {
    try {
      const normalizedEmail = persona.email.trim().toLowerCase();
      const existing = await userRepo.findByEmail(normalizedEmail);

      if (existing) {
        results.skipped.push({
          email: normalizedEmail,
          reason: 'already_exists'
        });
        continue;
      }

      if (!cachedPasswordHash) {
        cachedPasswordHash = await bcrypt.hash(password, saltRounds);
      }

      const created = await userRepo.create({
        id: persona.id,
        email: normalizedEmail,
        passwordHash: cachedPasswordHash,
        name: persona.name,
        role: persona.role,
        departmentId: persona.departmentId,
        isActive: persona.isActive !== false
      });

      results.created.push({
        id: created.id,
        email: created.email,
        role: created.role,
        departmentId: created.departmentId
      });
    } catch (err) {
      results.skipped.push({
        email: persona.email,
        error: err.message
      });
    }
  }

  return results;
}

export default seedDemoUsers;

