import fs from 'fs';
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

/**
 * Liveness Probe: Verifies the application process is running and responding to HTTP requests.
 */
export const getLiveness = (req, res) => {
  res.status(200).json({
    status: 'ok',
    live: true,
    service: config.appName,
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
};

/**
 * Readiness Probe: Verifies backing persistence layer is ready to serve traffic.
 */
export const getReadiness = (req, res) => {
  const configuredMode = getConfiguredPersistenceMode();
  const isMongo = isConnected();

  if (configuredMode === 'mongodb') {
    if (!isMongo) {
      return res.status(503).json({
        status: 'unhealthy',
        ready: false,
        service: config.appName,
        database: 'MongoDB (Disconnected)',
        persistenceMode: configuredMode,
        time: new Date().toISOString()
      });
    }
  } else {
    try {
      const complaintsPath = config.dataPath.complaints;
      if (!fs.existsSync(complaintsPath)) {
        return res.status(503).json({
          status: 'unhealthy',
          ready: false,
          service: config.appName,
          database: 'FileRepository (Missing Storage)',
          persistenceMode: configuredMode,
          time: new Date().toISOString()
        });
      }
    } catch {
      return res.status(503).json({
        status: 'unhealthy',
        ready: false,
        service: config.appName,
        error: 'Storage accessibility verification failed',
        persistenceMode: configuredMode,
        time: new Date().toISOString()
      });
    }
  }

  res.status(200).json({
    status: 'ok',
    ready: true,
    service: config.appName,
    database: configuredMode === 'mongodb' ? 'MongoDB' : 'FileRepository (JSON)',
    persistenceMode: configuredMode,
    time: new Date().toISOString()
  });
};

