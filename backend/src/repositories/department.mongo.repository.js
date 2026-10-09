import { DepartmentModel } from '../models/department.model.js';

/**
 * MongoDB Department Repository.
 */
export class MongoDepartmentRepository {
  async findAll() {
    const rawList = await DepartmentModel.find({ isActive: true }).lean();
    return rawList.map(this._formatDepartment);
  }

  async findById(id) {
    if (!id) return null;
    const target = String(id).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const doc = await DepartmentModel.findOne({
      $or: [{ id: targetRegex }, { code: targetRegex }]
    }).lean();

    return doc ? this._formatDepartment(doc) : null;
  }

  async exists(id) {
    if (!id) return false;
    const target = String(id).trim();
    const targetRegex = new RegExp(`^${target}$`, 'i');

    const count = await DepartmentModel.countDocuments({
      $or: [{ id: targetRegex }, { code: targetRegex }]
    });

    return count > 0;
  }

  _formatDepartment(raw) {
    if (!raw) return null;
    const formatted = { ...raw };
    delete formatted._id;
    delete formatted.__v;
    return formatted;
  }
}

export const mongoDepartmentRepository = new MongoDepartmentRepository();
export default mongoDepartmentRepository;
