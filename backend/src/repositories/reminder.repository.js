import config from '../config/app.config.js';
import { jsonReminderRepository } from './reminder.json.repository.js';
import { mongoReminderRepository } from './reminder.mongo.repository.js';
import mongoose from 'mongoose';

export class ReminderRepositoryFactory {
  static getRepository() {
    const isMongoMode = config.persistence.mode === 'mongodb';

    if (isMongoMode) {
      if (mongoose.connection.readyState !== 1) {
        throw new Error(
          '[Persistence Error] Anti-silent-fallback triggered: PERSISTENCE_MODE=mongodb but MongoDB connection is not active.'
        );
      }
      return mongoReminderRepository;
    }

    return jsonReminderRepository;
  }
}

const proxyHandler = {
  get(target, prop) {
    const repo = ReminderRepositoryFactory.getRepository();
    const value = repo[prop];
    if (typeof value === 'function') {
      return value.bind(repo);
    }
    return value;
  }
};

export const reminderRepository = new Proxy(jsonReminderRepository, proxyHandler);
export default reminderRepository;
