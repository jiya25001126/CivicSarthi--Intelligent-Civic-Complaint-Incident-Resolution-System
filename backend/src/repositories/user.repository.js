import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';
import { jsonUserRepository, JsonUserRepository } from './user.json.repository.js';
import { mongoUserRepository, MongoUserRepository } from './user.mongo.repository.js';

export class UserRepository {
  constructor(customFilePath = null) {
    this._customJsonRepo = customFilePath ? new JsonUserRepository(customFilePath) : null;
  }

  setFilePath(customPath) {
    if (this._customJsonRepo) {
      this._customJsonRepo.setFilePath(customPath);
    } else {
      jsonUserRepository.setFilePath(customPath);
    }
  }

  resetFilePath() {
    if (this._customJsonRepo) {
      this._customJsonRepo.resetFilePath();
    } else {
      jsonUserRepository.resetFilePath();
    }
  }

  _getActiveAdapter() {
    if (this._customJsonRepo) {
      return this._customJsonRepo;
    }

    const configuredMode = getConfiguredPersistenceMode();

    if (configuredMode === 'mongodb') {
      if (!isConnected()) {
        const err = new Error(
          'Persistence Error: MongoDB is configured as storage backend, but connection is not active. Silent fallback to JSON is prohibited.'
        );
        err.status = 503;
        throw err;
      }
      return mongoUserRepository;
    }

    if (configuredMode === 'auto') {
      return isConnected() ? mongoUserRepository : jsonUserRepository;
    }

    return jsonUserRepository;
  }

  async findById(id) {
    return this._getActiveAdapter().findById(id);
  }

  async findByEmail(email) {
    return this._getActiveAdapter().findByEmail(email);
  }

  async findAll(filters = {}) {
    return this._getActiveAdapter().findAll(filters);
  }

  async create(userData) {
    return this._getActiveAdapter().create(userData);
  }

  async update(id, updates) {
    return this._getActiveAdapter().update(id, updates);
  }

  async count() {
    return this._getActiveAdapter().count();
  }
}

export const userRepository = new UserRepository();
export default userRepository;
