import config from '../config/app.config.js';
import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';

export const getHealth = (req, res) => {
  const isMongo = isConnected();
  const configuredMode = getConfiguredPersistenceMode();

  let dbStatus;
  let overallStatus = 'ok';

  if (configuredMode === 'mongodb') {
    if (isMongo) {
      dbStatus = 'MongoDB';
    } else {
      dbStatus = 'MongoDB (Disconnected)';
      overallStatus = 'degraded';
    }
  } else {
    dbStatus = isMongo ? 'MongoDB' : 'FileRepository (JSON Fallback)';
  }

  res.json({
    status: overallStatus,
    version: config.version,
    time: new Date().toISOString(),
    service: config.appName,
    description: config.description,
    database: dbStatus,
    persistenceMode: configuredMode,
    environment: config.env
  });
};
