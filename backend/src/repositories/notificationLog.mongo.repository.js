import NotificationLog from '../models/notificationLog.model.js';

export class MongoNotificationLogRepository {
  async create(data) {
    const id = data.id || `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const doc = await NotificationLog.create({
      ...data,
      id
    });
    return doc.toObject();
  }

  async findById(id) {
    const doc = await NotificationLog.findOne({ id }).lean();
    return doc;
  }

  async findLatestByIdempotencyKey(key) {
    if (!key) return null;
    const doc = await NotificationLog.findOne({ idempotencyKey: key })
      .sort({ createdAt: -1 })
      .lean();
    return doc;
  }

  async findAll(filters = {}) {
    const query = {};
    if (filters.complaintId) query.complaintId = filters.complaintId;
    if (filters.citizenId) query.citizenId = filters.citizenId;
    if (filters.channel) query.channel = filters.channel;
    if (filters.eventType) query.eventType = filters.eventType;
    if (filters.status) query.status = filters.status;

    const docs = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .lean();
    return docs;
  }

  async update(id, updates) {
    const doc = await NotificationLog.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true }
    ).lean();
    return doc;
  }
}

export const mongoNotificationLogRepository = new MongoNotificationLogRepository();
export default mongoNotificationLogRepository;

