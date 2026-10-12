import { ReminderModel } from '../models/reminder.model.js';

export class MongoReminderRepository {
  async create(data) {
    const record = await ReminderModel.create(data);
    return record.toObject();
  }

  async findById(id) {
    if (!id) return null;
    const record = await ReminderModel.findOne({
      id: { $regex: new RegExp(`^${id}$`, 'i') }
    }).lean();
    return record;
  }

  async findLatestByComplaintId(complaintId) {
    if (!complaintId) return null;
    const record = await ReminderModel.findOne({
      $or: [
        { complaintId: { $regex: new RegExp(`^${complaintId}$`, 'i') } },
        { complaintReference: { $regex: new RegExp(`^${complaintId}$`, 'i') } }
      ]
    })
      .sort({ requestedAt: -1 })
      .lean();
    return record;
  }

  async findAll(filters = {}) {
    const query = {};

    if (filters.complaintId) {
      query.$or = [
        { complaintId: { $regex: new RegExp(`^${filters.complaintId}$`, 'i') } },
        { complaintReference: { $regex: new RegExp(`^${filters.complaintId}$`, 'i') } }
      ];
    }

    if (filters.citizenId) {
      query.citizenId = filters.citizenId;
    }

    if (filters.departmentId) {
      query.departmentId = { $regex: new RegExp(`^${filters.departmentId}$`, 'i') };
    }

    if (filters.status) {
      query.status = filters.status;
    }

    return ReminderModel.find(query).sort({ requestedAt: -1 }).lean();
  }
}

export const mongoReminderRepository = new MongoReminderRepository();
