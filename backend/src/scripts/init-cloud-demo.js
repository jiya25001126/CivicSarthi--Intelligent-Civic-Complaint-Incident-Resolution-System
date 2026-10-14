import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/user.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { SEED_DEPARTMENTS } from './seed.js';

export const DEMO_PERSONAS = [
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
    id: 'USR-DEMO-ADMIN-005',
    email: 'admin.demo@civicsarthi.internal',
    name: 'Kavita Mehta (System Administrator)',
    role: 'admin',
    departmentId: null,
    isActive: true
  },
  {
    id: 'USR-DEMO-MUNICIPAL-004',
    email: 'officer.municipal@civicsarthi.internal',
    name: 'Anil Deshmukh (Municipal Nodal Officer)',
    role: 'officer',
    departmentId: 'DEPT_MUNICIPAL',
    isActive: true
  }
];

/**
 * Safe Demo User & Cloud Evaluator Initialization Utility:
 * - Requires a valid MONGODB_URI.
 * - Idempotently provisions the login-page demo personas.
 * - Never overwrites existing accounts, password hashes, roles, or department assignments.
 * - Verifies newly created accounts can be retrieved and authenticated with bcryptjs.
 * - Safe logging: outputs only account email and action (created/skipped) without printing secrets.
 * - Closes the database connection in all cases and exits with nonzero code on failure.
 */
export async function runCloudDemoInit(options = {}) {
  const originalEnvUri = process.env.MONGODB_URI;
  const uri = (options.uri !== undefined ? options.uri : process.env.MONGODB_URI) || '';

  const results = [];
  let createdCount = 0;
  let skippedCount = 0;
  let verifiedCount = 0;

  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    const errorMsg = 'Cannot initialize cloud demo users: MONGODB_URI environment variable is required.';
    console.error(`[Error] ${errorMsg}`);
    return { success: false, error: errorMsg, created: createdCount, skipped: skippedCount, verified: verifiedCount, results };
  }

  if (options.uri !== undefined) {
    process.env.MONGODB_URI = options.uri;
  }

  const connectFn = options.connectDatabase || connectDatabase;
  const disconnectFn = options.disconnectDatabase || disconnectDatabase;
  const userModel = options.userModel || UserModel;
  const departmentModel = options.departmentModel || DepartmentModel;
  const demoPassword = options.demoPassword || process.env.DEMO_USER_PASSWORD || 'DemoUser@2026';
  const personas = options.personas || DEMO_PERSONAS;

  const newlyCreatedEmails = [];

  try {
    const connResult = await connectFn();
    if (!connResult || !connResult.connected) {
      const errorMsg = `Database connection failed: ${connResult?.error || 'Unable to connect to MongoDB'}`;
      console.error(`[Error] ${errorMsg}`);
      return { success: false, error: errorMsg, created: createdCount, skipped: skippedCount, verified: verifiedCount, results };
    }

    // 1. Authoritative departments initialization (fail explicitly on error)
    if (departmentModel && Array.isArray(SEED_DEPARTMENTS)) {
      for (const dept of SEED_DEPARTMENTS) {
        try {
          await departmentModel.updateOne(
            { id: dept.id },
            { $setOnInsert: dept },
            { upsert: true }
          );
        } catch (deptErr) {
          throw new Error(`Failed to initialize required department '${dept.id}': ${deptErr.message}`);
        }
      }
    }

    // 2. Demo accounts provisioning
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(demoPassword, saltRounds);

    for (const persona of personas) {
      const normalizedEmail = (persona.email || '').trim().toLowerCase();
      if (!normalizedEmail) continue;

      // 1. Check if user already exists (Never overwrite existing accounts)
      const existing = await userModel.findOne({ email: normalizedEmail }).lean();
      if (existing) {
        skippedCount++;
        results.push({ email: normalizedEmail, action: 'skipped' });
        console.log(`[Demo Init] Account: ${normalizedEmail} | Action: skipped`);
        continue;
      }

      // 2. Insert new demo user using race-safe create
      const id = persona.id || `USR-DEMO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      try {
        await userModel.create({
          id,
          email: normalizedEmail,
          passwordHash,
          name: persona.name.trim(),
          role: persona.role,
          departmentId: persona.role === 'officer' ? (persona.departmentId || null) : null,
          isActive: persona.isActive !== undefined ? persona.isActive : true
        });
        createdCount++;
        newlyCreatedEmails.push(normalizedEmail);
        results.push({ email: normalizedEmail, action: 'created' });
        console.log(`[Demo Init] Account: ${normalizedEmail} | Action: created`);
      } catch (insertErr) {
        // Handle race condition gracefully if created concurrently by another process
        if (insertErr.code === 11000 || (insertErr.message && insertErr.message.includes('E11000'))) {
          skippedCount++;
          results.push({ email: normalizedEmail, action: 'skipped' });
          console.log(`[Demo Init] Account: ${normalizedEmail} | Action: skipped`);
          continue;
        }
        throw insertErr;
      }
    }

    // 3. Verify newly created users can be retrieved and authenticate with bcrypt
    for (const email of newlyCreatedEmails) {
      const verified = await userModel.findOne({ email }).lean();
      if (!verified) {
        throw new Error(`Verification failed: Account '${email}' was created but could not be retrieved from database`);
      }
      const isMatch = await bcrypt.compare(demoPassword, verified.passwordHash);
      if (!isMatch) {
        throw new Error(`Verification failed: Password validation failed for account '${email}'`);
      }
      verifiedCount++;
    }

    console.log(`[Demo Init] Summary: ${createdCount} created, ${skippedCount} skipped, 0 failed.`);
    return {
      success: true,
      created: createdCount,
      skipped: skippedCount,
      verified: verifiedCount,
      results
    };
  } catch (err) {
    console.error(`[Demo Init Error] Initialization failed: ${err.message}`);
    return {
      success: false,
      error: err.message,
      created: createdCount,
      skipped: skippedCount,
      verified: verifiedCount,
      results
    };
  } finally {
    if (options.uri !== undefined) {
      if (originalEnvUri !== undefined) {
        process.env.MONGODB_URI = originalEnvUri;
      } else {
        delete process.env.MONGODB_URI;
      }
    }
    await disconnectFn();
  }
}

// Execute directly if run via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCloudDemoInit().then(res => {
    if (!res || !res.success) {
      process.exit(1);
    }
    process.exit(0);
  }).catch(err => {
    console.error('[Fatal Error]', err.message || err);
    process.exit(1);
  });
}

export default runCloudDemoInit;
