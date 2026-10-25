import { ReminderModel } from '../models/reminder.model.js';

export class MongoReminderRepository {
  async generateReminderId() {
    const year = new Date().getFullYear();
    const count = await ReminderModel.countDocuments();
    const seq = String(count + 1).padStart(4, '0');
    let candidate = `REM-${year}-${seq}`;
    const exists = await ReminderModel.findOne({ id: candidate }).lean();
    if (exists) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      candidate = `REM-${year}-${Date.now().toString().slice(-4)}${rand}`;
    }
    return candidate;
  }

  async create(data) {
    const id = data.id || (await this.generateReminderId());
    const record = await ReminderModel.create({ ...data, id });
    return record.toObject ? record.toObject() : record;
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
      const esc = String(filters.citizenId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.citizenId = { $regex: new RegExp(`^${esc}$`, 'i') };
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
