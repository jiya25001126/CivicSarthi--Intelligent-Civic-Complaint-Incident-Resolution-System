import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';
import { jsonIncidentRepository, JsonIncidentRepository } from './incident.json.repository.js';
import { mongoIncidentRepository } from './incident.mongo.repository.js';

/**
 * Unified Incident Repository Facade.
 * Routes operations to the active persistence adapter according to system configuration.
 * Strictly prevents silent fallbacks when MongoDB is expected.
 */
export class IncidentRepository {
  constructor(customFilePath = null) {
    this._customJsonRepo = customFilePath ? new JsonIncidentRepository(customFilePath) : null;
  }

  setFilePath(customPath) {
    if (this._customJsonRepo) {
      this._customJsonRepo.setFilePath(customPath);
    } else {
      jsonIncidentRepository.setFilePath(customPath);
    }
  }

  get filePath() {
    return (this._customJsonRepo || jsonIncidentRepository).filePath;
  }

  resetFilePath() {
    if (this._customJsonRepo) {
      this._customJsonRepo.resetFilePath();
    } else {
      jsonIncidentRepository.resetFilePath();
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
      return mongoIncidentRepository;
    }

    if (configuredMode === 'auto') {
      return isConnected() ? mongoIncidentRepository : jsonIncidentRepository;
    }

    return jsonIncidentRepository;
  }

  generateIncidentId(incidents, targetYear) {
    return jsonIncidentRepository.generateIncidentId(incidents, targetYear);
  }

  async findAll(filters) {
    return this._getActiveAdapter().findAll(filters);
  }

  async findById(id) {
    return this._getActiveAdapter().findById(id);
  }

  async create(incidentData) {
    return this._getActiveAdapter().create(incidentData);
  }

  async update(id, updateData) {
    return this._getActiveAdapter().update(id, updateData);
  }

  async linkComplaint(incidentId, complaintId) {
    return this._getActiveAdapter().linkComplaint(incidentId, complaintId);
  }

  async unlinkComplaint(incidentId, complaintId) {
    return this._getActiveAdapter().unlinkComplaint(incidentId, complaintId);
  }

  async count(filters) {
    return this._getActiveAdapter().count(filters);
  }
}

export const incidentRepository = new IncidentRepository();
export default incidentRepository;
