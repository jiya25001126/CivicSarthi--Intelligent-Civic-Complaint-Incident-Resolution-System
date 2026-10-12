import config from '../config/app.config.js';
import { jsonClarificationRepository } from './clarification.json.repository.js';
import { mongoClarificationRepository } from './clarification.mongo.repository.js';
import mongoose from 'mongoose';

export class ClarificationRepositoryFactory {
  static getRepository() {
    const isMongoMode = config.persistence.mode === 'mongodb';

    if (isMongoMode) {
      if (mongoose.connection.readyState !== 1) {
        throw new Error(
          '[Persistence Error] Anti-silent-fallback triggered: PERSISTENCE_MODE=mongodb but MongoDB connection is not active.'
        );
      }
      return mongoClarificationRepository;
    }

    return jsonClarificationRepository;
  }
}

const proxyHandler = {
  get(target, prop) {
    const repo = ClarificationRepositoryFactory.getRepository();
    const value = repo[prop];
    if (typeof value === 'function') {
      return value.bind(repo);
    }
    return value;
  }
};

export const clarificationRepository = new Proxy(jsonClarificationRepository, proxyHandler);
export default clarificationRepository;
