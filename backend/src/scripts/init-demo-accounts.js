import { fileURLToPath } from 'url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { initializeDemoAccounts } from '../services/demoInit.service.js';

export async function runInitDemoCli() {
  console.log('====================================================');
  console.log('CivicSarthi Production Demo Initialization Script');
  console.log('====================================================');

  const demoPassword = process.env.DEMO_USER_PASSWORD || process.env.DEMO_PASSWORD;
  if (!demoPassword) {
    console.error('[Error] DEMO_USER_PASSWORD or DEMO_PASSWORD environment variable must be set.');
    process.exitCode = 1;
    return {
      initialized: false,
      reason: 'DEMO_USER_PASSWORD or DEMO_PASSWORD environment variable must be set'
    };
  }

  const forceSync = process.argv.includes('--force') || process.argv.includes('--sync-passwords');

  try {
    await connectDatabase();

    const result = await initializeDemoAccounts({
      force: true,
      forcePasswordSync: forceSync,
      demoPassword
    });

    if (!result || !result.initialized) {
      console.error(`[Error] Demo initialization could not be completed: ${result?.reason || 'Initialization skipped'}`);
      process.exitCode = 1;
      return result;
    }

    console.log('[CivicSarthi Demo Init] Result:', {
      initialized: result.initialized,
      departmentsEnsured: result.departmentsEnsured,
      usersCreated: result.usersCreated,
      usersPreserved: result.usersPreserved,
      usersUpdated: result.usersUpdated
    });
    console.log('Demo accounts initialization complete.');
    process.exitCode = 0;
    return result;
  } finally {
    try {
      await disconnectDatabase();
    } catch {
      // Ignore disconnect errors during CLI exit
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runInitDemoCli().catch(err => {
    console.error('[Fatal Error]', err.message);
    process.exit(1);
  });
}

export default runInitDemoCli;
