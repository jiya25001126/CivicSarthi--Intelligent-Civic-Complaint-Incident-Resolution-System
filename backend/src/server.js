import createApp from './app.js';
import config from './config/app.config.js';

const app = createApp();

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[JanSahay Backend] Server running on port ${config.port} (${config.env})`);
  // eslint-disable-next-line no-console
  console.log(`[JanSahay Backend] Healthcheck available at http://localhost:${config.port}/api/health`);
});

export default server;
