import createApp from './app.js';
import config from './config/app.config.js';
import { connectDatabase } from './config/database.js';

const app = createApp();

// Connect to MongoDB if configured, otherwise falls back to JSON file repository
await connectDatabase();

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[JanSahay Backend] Server running on port ${config.port} (${config.env})`);
  // eslint-disable-next-line no-console
  console.log(`[JanSahay Backend] Healthcheck available at http://localhost:${config.port}/api/v1/health`);
});

export default server;
