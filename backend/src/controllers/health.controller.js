import config from '../config/app.config.js';
import { isConnected } from '../config/database.js';

export const getHealth = (req, res) => {
  res.json({
    status: 'ok',
    version: config.version,
    time: new Date().toISOString(),
    service: config.appName,
    description: config.description,
    database: isConnected() ? 'MongoDB' : 'FileRepository (JSON Fallback)',
    environment: config.env
  });
};
