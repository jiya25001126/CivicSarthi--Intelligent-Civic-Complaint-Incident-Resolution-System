import mongoose from 'mongoose';
import config from './app.config.js';

let isMongoConnected = false;
let lastConnectionError = null;

export function getConfiguredPersistenceMode() {
  if (process.env.PERSISTENCE_MODE) {
    return process.env.PERSISTENCE_MODE.toLowerCase();
  }
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim() !== '') {
    return 'mongodb';
  }
  return config.persistence?.mode || 'json';
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  const configuredMode = getConfiguredPersistenceMode();

  if (!uri || uri.trim() === '') {
    if (configuredMode === 'mongodb') {
      const errMsg = 'PERSISTENCE_MODE is set to mongodb, but MONGODB_URI is not provided.';
      console.error(`[CivicSarthi DB Error] ${errMsg}`);
      isMongoConnected = false;
      lastConnectionError = errMsg;
      return { connected: false, type: 'MONGODB', error: errMsg };
    }
    console.log('[CivicSarthi DB] No MONGODB_URI configured. Running in local development mode with JSON file-backed repository.');
    isMongoConnected = false;
    lastConnectionError = null;
    return { connected: false, type: 'FILE_REPOSITORY' };
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000
    });
    isMongoConnected = true;
    lastConnectionError = null;
    console.log('[CivicSarthi DB] Successfully connected to MongoDB.');
    return { connected: true, type: 'MONGODB' };
  } catch (err) {
    console.warn(`[CivicSarthi DB Warning] Failed to connect to MongoDB: ${err.message}.`);
    isMongoConnected = false;
    lastConnectionError = err.message;
    return { connected: false, type: 'MONGODB', error: err.message };
  }
}

export async function disconnectDatabase() {
  if (isMongoConnected || mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
    } catch {}
  }
  isMongoConnected = false;
}

export function isConnected() {
  return isMongoConnected;
}

export function getLastConnectionError() {
  return lastConnectionError;
}

export function getConnectionStatus() {
  const configuredMode = getConfiguredPersistenceMode();
  return {
    isConnected: isMongoConnected,
    configuredMode,
    error: lastConnectionError
  };
}
