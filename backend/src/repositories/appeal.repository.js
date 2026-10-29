import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';
import { jsonAppealRepository, JsonAppealRepository } from './appeal.json.repository.js';
import { mongoAppealRepository } from './appeal.mongo.repository.js';

export class AppealRepository {
  constructor(customFilePath = null) {
    this._customJsonRepo = customFilePath ? new JsonAppealRepository(customFilePath) : null;
  }

  setFilePath(customPath) {
    if (this._customJsonRepo) {
      this._customJsonRepo.setFilePath(customPath);
    } else {
      jsonAppealRepository.setFilePath(customPath);
    }
  }

  get filePath() {
    return (this._customJsonRepo || jsonAppealRepository).filePath;
  }

  resetFilePath() {
    if (this._customJsonRepo) {
      this._customJsonRepo.resetFilePath();
    } else {
      jsonAppealRepository.resetFilePath();
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
      return mongoAppealRepository;
    }

    if (configuredMode === 'auto') {
      return isConnected() ? mongoAppealRepository : jsonAppealRepository;
    }

    return jsonAppealRepository;
  }

  async create(data) {
    return this._getActiveAdapter().create(data);
  }

  async findById(idOrRef) {
    return this._getActiveAdapter().findById(idOrRef);
  }

  async findAll(filters) {
    return this._getActiveAdapter().findAll(filters);
  }

  async update(id, updates) {
    return this._getActiveAdapter().update(id, updates);
  }

  async updateStatus(id, payload) {
    return this._getActiveAdapter().updateStatus(id, payload);
  }

  async addInternalNote(id, payload) {
    return this._getActiveAdapter().addInternalNote(id, payload);
  }

  async recordDecision(id, payload) {
    return this._getActiveAdapter().recordDecision(id, payload);
  }
}

export const appealRepository = new AppealRepository();
export default appealRepository;
