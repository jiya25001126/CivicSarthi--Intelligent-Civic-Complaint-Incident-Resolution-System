import createApp from './app.js';
import config from './config/app.config.js';
import { connectDatabase } from './config/database.js';
import { initializeDemoAccounts } from './services/demoInit.service.js';

const app = createApp();

// Connect to MongoDB if configured, otherwise falls back to JSON file repository
await connectDatabase();

// Safely invoke demo accounts check (strictly opt-in via INITIALIZE_DEMO_ACCOUNTS=true and DEMO_USER_PASSWORD)
try {
  await initializeDemoAccounts();
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('[CivicSarthi Startup Warning] Demo initialization could not be completed:', err.message);
}

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[CivicSarthi Backend] Server running on port ${config.port} (${config.env})`);
  // eslint-disable-next-line no-console
  console.log(`[CivicSarthi Backend] Healthcheck available at http://localhost:${config.port}/api/v1/health`);
});

export default server;
