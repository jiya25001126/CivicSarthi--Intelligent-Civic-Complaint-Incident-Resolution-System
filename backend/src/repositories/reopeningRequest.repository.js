import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';
import {
  jsonReopeningRequestRepository,
  JsonReopeningRequestRepository
} from './reopeningRequest.json.repository.js';
import { mongoReopeningRequestRepository } from './reopeningRequest.mongo.repository.js';

export class ReopeningRequestRepository {
  constructor(customFilePath = null) {
    this._customJsonRepo = customFilePath
      ? new JsonReopeningRequestRepository(customFilePath)
      : null;
  }

  setFilePath(customPath) {
    if (this._customJsonRepo) {
      this._customJsonRepo.setFilePath(customPath);
    } else {
      jsonReopeningRequestRepository.setFilePath(customPath);
    }
  }

  get filePath() {
    return (this._customJsonRepo || jsonReopeningRequestRepository).filePath;
  }

  resetFilePath() {
    if (this._customJsonRepo) {
      this._customJsonRepo.resetFilePath();
    } else {
      jsonReopeningRequestRepository.resetFilePath();
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
      return mongoReopeningRequestRepository;
    }

    if (configuredMode === 'auto') {
      return isConnected() ? mongoReopeningRequestRepository : jsonReopeningRequestRepository;
    }

    return jsonReopeningRequestRepository;
  }

  async create(data) {
    return this._getActiveAdapter().create(data);
  }

  async findById(idOrRef) {
    return this._getActiveAdapter().findById(idOrRef);
  }

  async findPendingByComplaintId(complaintId) {
    return this._getActiveAdapter().findPendingByComplaintId(complaintId);
  }

  async findAll(filters) {
    return this._getActiveAdapter().findAll(filters);
  }

  async update(id, updates) {
    return this._getActiveAdapter().update(id, updates);
  }

  async recordDecision(id, payload) {
    return this._getActiveAdapter().recordDecision(id, payload);
  }
}

export const reopeningRequestRepository = new ReopeningRequestRepository();
export default reopeningRequestRepository;
