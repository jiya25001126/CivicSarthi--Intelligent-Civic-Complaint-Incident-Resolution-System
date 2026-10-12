import config from '../config/app.config.js';
import { jsonCitizenReputationRepository } from './citizenReputation.json.repository.js';
import { mongoCitizenReputationRepository } from './citizenReputation.mongo.repository.js';
import mongoose from 'mongoose';

export class CitizenReputationRepositoryFactory {
  static getRepository() {
    const isMongoMode = config.persistence.mode === 'mongodb';

    if (isMongoMode) {
      if (mongoose.connection.readyState !== 1) {
        throw new Error(
          '[Persistence Error] Anti-silent-fallback triggered: PERSISTENCE_MODE=mongodb but MongoDB connection is not active.'
        );
      }
      return mongoCitizenReputationRepository;
    }

    return jsonCitizenReputationRepository;
  }
}

const proxyHandler = {
  get(target, prop) {
    const repo = CitizenReputationRepositoryFactory.getRepository();
    const value = repo[prop];
    if (typeof value === 'function') {
      return value.bind(repo);
    }
    return value;
  }
};

export const citizenReputationRepository = new Proxy(jsonCitizenReputationRepository, proxyHandler);
export default citizenReputationRepository;
