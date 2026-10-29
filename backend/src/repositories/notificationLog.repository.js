import config from '../config/app.config.js';
import { jsonNotificationLogRepository } from './notificationLog.json.repository.js';
import { mongoNotificationLogRepository } from './notificationLog.mongo.repository.js';
import mongoose from 'mongoose';

export class NotificationLogRepositoryFactory {
  static getRepository() {
    const isMongoMode = config.persistence.mode === 'mongodb';

    if (isMongoMode) {
      if (mongoose.connection.readyState !== 1) {
        throw new Error(
          '[Persistence Error] Anti-silent-fallback triggered: PERSISTENCE_MODE=mongodb but MongoDB connection is not active.'
        );
      }
      return mongoNotificationLogRepository;
    }

    return jsonNotificationLogRepository;
  }
}

const proxyHandler = {
  get(target, prop) {
    const repo = NotificationLogRepositoryFactory.getRepository();
    const value = repo[prop];
    if (typeof value === 'function') {
      return value.bind(repo);
    }
    return value;
  }
};

export const notificationLogRepository = new Proxy(jsonNotificationLogRepository, proxyHandler);
export default notificationLogRepository;

