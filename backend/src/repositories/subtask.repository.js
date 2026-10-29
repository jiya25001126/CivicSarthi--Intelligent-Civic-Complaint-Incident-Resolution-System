import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';
import { jsonSubtaskRepository, JsonSubtaskRepository } from './subtask.json.repository.js';
import { mongoSubtaskRepository } from './subtask.mongo.repository.js';

/**
 * Unified Subtask Repository Facade.
 * Routes operations to the active persistence adapter according to system configuration.
 * Strictly prevents silent fallbacks when MongoDB is expected.
 */
export class SubtaskRepository {
  constructor(customFilePath = null) {
    this._customJsonRepo = customFilePath ? new JsonSubtaskRepository(customFilePath) : null;
  }

  setFilePath(customPath) {
    if (this._customJsonRepo) {
      this._customJsonRepo.setFilePath(customPath);
    } else {
      jsonSubtaskRepository.setFilePath(customPath);
    }
  }

  get filePath() {
    return (this._customJsonRepo || jsonSubtaskRepository).filePath;
  }

  resetFilePath() {
    if (this._customJsonRepo) {
      this._customJsonRepo.resetFilePath();
    } else {
      jsonSubtaskRepository.resetFilePath();
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
      return mongoSubtaskRepository;
    }

    if (configuredMode === 'auto') {
      return isConnected() ? mongoSubtaskRepository : jsonSubtaskRepository;
    }

    return jsonSubtaskRepository;
  }

  generateSubtaskId(subtasks, targetYear) {
    return jsonSubtaskRepository.generateSubtaskId(subtasks, targetYear);
  }

  async findAll(filters) {
    return this._getActiveAdapter().findAll(filters);
  }

  async findById(id) {
    return this._getActiveAdapter().findById(id);
  }

  async create(subtaskData) {
    return this._getActiveAdapter().create(subtaskData);
  }

  async update(id, updateData) {
    return this._getActiveAdapter().update(id, updateData);
  }

  async delete(id) {
    return this._getActiveAdapter().delete(id);
  }

  async count(filters) {
    return this._getActiveAdapter().count(filters);
  }
}

export const subtaskRepository = new SubtaskRepository();
export default subtaskRepository;
