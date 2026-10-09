import config from '../config/app.config.js';
import { isConnected, getConfiguredPersistenceMode } from '../config/database.js';
import { jsonDepartmentRepository } from './department.json.repository.js';
import { mongoDepartmentRepository } from './department.mongo.repository.js';

export class DepartmentRepository {
  _getActiveAdapter() {
    const configuredMode = getConfiguredPersistenceMode();

    if (configuredMode === 'mongodb') {
      if (!isConnected()) {
        const err = new Error(
          'Persistence Error: MongoDB is configured as storage backend, but connection is not active. Silent fallback to JSON is prohibited.'
        );
        err.status = 503;
        throw err;
      }
      return mongoDepartmentRepository;
    }

    if (configuredMode === 'auto') {
      return isConnected() ? mongoDepartmentRepository : jsonDepartmentRepository;
    }

    return jsonDepartmentRepository;
  }

  async findAll() {
    return this._getActiveAdapter().findAll();
  }

  async findById(id) {
    return this._getActiveAdapter().findById(id);
  }

  async exists(id) {
    return this._getActiveAdapter().exists(id);
  }
}

export const departmentRepository = new DepartmentRepository();
export default departmentRepository;
