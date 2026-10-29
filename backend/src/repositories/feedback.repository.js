import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';
import { jsonFeedbackRepository, JsonFeedbackRepository } from './feedback.json.repository.js';
import { mongoFeedbackRepository } from './feedback.mongo.repository.js';

export class FeedbackRepository {
  constructor(customFilePath = null) {
    this._customJsonRepo = customFilePath ? new JsonFeedbackRepository(customFilePath) : null;
  }

  setFilePath(customPath) {
    if (this._customJsonRepo) {
      this._customJsonRepo.setFilePath(customPath);
    } else {
      jsonFeedbackRepository.setFilePath(customPath);
    }
  }

  get filePath() {
    return (this._customJsonRepo || jsonFeedbackRepository).filePath;
  }

  resetFilePath() {
    if (this._customJsonRepo) {
      this._customJsonRepo.resetFilePath();
    } else {
      jsonFeedbackRepository.resetFilePath();
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
      return mongoFeedbackRepository;
    }

    if (configuredMode === 'auto') {
      return isConnected() ? mongoFeedbackRepository : jsonFeedbackRepository;
    }

    return jsonFeedbackRepository;
  }

  async create(data) {
    return this._getActiveAdapter().create(data);
  }

  async findById(id) {
    return this._getActiveAdapter().findById(id);
  }

  async findByComplaintAndMilestone(complaintId, milestone) {
    return this._getActiveAdapter().findByComplaintAndMilestone(complaintId, milestone);
  }

  async findAll(filters) {
    return this._getActiveAdapter().findAll(filters);
  }

  async update(id, updates) {
    return this._getActiveAdapter().update(id, updates);
  }
}

export const feedbackRepository = new FeedbackRepository();
export default feedbackRepository;
