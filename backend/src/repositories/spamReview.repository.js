import config from '../config/app.config.js';
import { jsonSpamReviewRepository } from './spamReview.json.repository.js';
import { mongoSpamReviewRepository } from './spamReview.mongo.repository.js';
import mongoose from 'mongoose';

export class SpamReviewRepositoryFactory {
  static getRepository() {
    const isMongoMode = config.persistence.mode === 'mongodb';

    if (isMongoMode) {
      if (mongoose.connection.readyState !== 1) {
        throw new Error(
          '[Persistence Error] Anti-silent-fallback triggered: PERSISTENCE_MODE=mongodb but MongoDB connection is not active.'
        );
      }
      return mongoSpamReviewRepository;
    }

    return jsonSpamReviewRepository;
  }
}

const proxyHandler = {
  get(target, prop) {
    const repo = SpamReviewRepositoryFactory.getRepository();
    const value = repo[prop];
    if (typeof value === 'function') {
      return value.bind(repo);
    }
    return value;
  }
};

export const spamReviewRepository = new Proxy(jsonSpamReviewRepository, proxyHandler);
export default spamReviewRepository;
