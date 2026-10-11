import config from '../config/app.config.js';
import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';
import { jsonComplaintRepository, JsonComplaintRepository } from './complaint.json.repository.js';
import { mongoComplaintRepository, MongoComplaintRepository } from './complaint.mongo.repository.js';

/**
 * Unified Complaint Repository Facade.
 * Routes database operations to the active persistence adapter (MongoDB or JSON file-backed)
 * according to explicit system configuration while strictly preventing silent fallbacks when
 * MongoDB is expected.
 */
export class ComplaintRepository {
  constructor(customFilePath = null) {
    this._customJsonRepo = customFilePath ? new JsonComplaintRepository(customFilePath) : null;
  }

  setFilePath(customPath) {
    if (this._customJsonRepo) {
      this._customJsonRepo.setFilePath(customPath);
    } else {
      jsonComplaintRepository.setFilePath(customPath);
    }
  }

  resetFilePath() {
    if (this._customJsonRepo) {
      this._customJsonRepo.resetFilePath();
    } else {
      jsonComplaintRepository.resetFilePath();
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
      return mongoComplaintRepository;
    }

    if (configuredMode === 'auto') {
      return isConnected() ? mongoComplaintRepository : jsonComplaintRepository;
    }

    return jsonComplaintRepository;
  }

  generateReferenceNumber(complaints = [], targetYear = new Date().getFullYear()) {
    // Both adapters share consistent format logic
    return jsonComplaintRepository.generateReferenceNumber(complaints, targetYear);
  }

  async findAll(filters = {}) {
    return this._getActiveAdapter().findAll(filters);
  }

  async findById(idOrRef) {
    return this._getActiveAdapter().findById(idOrRef);
  }

  async create(complaintData, overrideYear = null) {
    return this._getActiveAdapter().create(complaintData, overrideYear);
  }

  async updateStatus(idOrRef, { status, remarks, actorType }) {
    return this._getActiveAdapter().updateStatus(idOrRef, { status, remarks, actorType });
  }

  async updatePriority(idOrRef, { priority, remarks, actorType }) {
    return this._getActiveAdapter().updatePriority(idOrRef, { priority, remarks, actorType });
  }

  async linkDuplicate(idOrRef, { duplicateOf, remarks, actorType }) {
    return this._getActiveAdapter().linkDuplicate(idOrRef, { duplicateOf, remarks, actorType });
  }

  async updateIntelligence(idOrRef, intelligence) {
    return this._getActiveAdapter().updateIntelligence(idOrRef, intelligence);
  }

  async updateDepartment(idOrRef, { departmentId, remarks, actorType }) {
    return this._getActiveAdapter().updateDepartment(idOrRef, { departmentId, remarks, actorType });
  }

  async addOfficerNote(idOrRef, { note, officerId }) {
    return this._getActiveAdapter().addOfficerNote(idOrRef, { note, officerId });
  }

  async getStatusHistory(idOrRef) {
    return this._getActiveAdapter().getStatusHistory(idOrRef);
  }
}

export const complaintRepository = new ComplaintRepository();
export default complaintRepository;
