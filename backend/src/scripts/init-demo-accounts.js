import { fileURLToPath } from 'url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { initializeDemoAccounts } from '../services/demoInit.service.js';

export async function runInitDemoCli() {
  console.log('====================================================');
  console.log('CivicSarthi Production Demo Initialization Script');
  console.log('====================================================');

  await connectDatabase();

  const forceSync = process.argv.includes('--force') || process.argv.includes('--sync-passwords');
  const result = await initializeDemoAccounts({ force: true, forcePasswordSync: forceSync });

  console.log('Result:', result);
  console.log('Demo accounts initialization complete.');

  await disconnectDatabase();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runInitDemoCli().catch(err => {
    console.error('[Fatal Error]', err);
    process.exit(1);
  });
}

export default runInitDemoCli;
