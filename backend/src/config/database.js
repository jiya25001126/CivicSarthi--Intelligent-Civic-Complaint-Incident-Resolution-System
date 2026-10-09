import mongoose from 'mongoose';
import config from './app.config.js';

let isMongoConnected = false;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === '') {
    console.log('[JanSahay DB] No MONGODB_URI configured. Running in development mode with JSON file-backed repository.');
    return { connected: false, type: 'FILE_REPOSITORY' };
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000
    });
    isMongoConnected = true;
    console.log('[JanSahay DB] Successfully connected to MongoDB.');
    return { connected: true, type: 'MONGODB' };
  } catch (err) {
    console.warn(`[JanSahay DB Warning] Failed to connect to MongoDB: ${err.message}. Falling back to JSON file repository.`);
    isMongoConnected = false;
    return { connected: false, type: 'FILE_REPOSITORY', error: err.message };
  }
}

export function isConnected() {
  return isMongoConnected;
}
