import FeedbackModel from '../models/feedback.model.js';

export class MongoFeedbackRepository {
  async generateFeedbackId(targetYear = null) {
    const year = targetYear || new Date().getFullYear();
    const count = (await FeedbackModel.countDocuments()) || 0;
    const seq = String(count + 1).padStart(4, '0');
    let candidate = `FB-${year}-${seq}`;
    const exists = await FeedbackModel.findOne({ id: candidate }).lean();
    if (exists) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      candidate = `FB-${year}-${Date.now().toString().slice(-4)}${rand}`;
    }
    return candidate;
  }

  async create(data) {
    const id = data.id || (await this.generateFeedbackId());
    const doc = new FeedbackModel({
      ...data,
      id
    });
    const saved = await doc.save();
    return saved.toObject();
  }

  async findById(id) {
    const doc = await FeedbackModel.findOne({ id }).lean();
    return doc;
  }

  async findByComplaintAndMilestone(complaintId, milestone) {
    const doc = await FeedbackModel.findOne({
      $or: [
        { complaintId },
        { complaintReference: complaintId },
        { referenceNumber: complaintId }
      ],
      resolutionMilestone: String(milestone || '1')
    }).lean();
    return doc;
  }

  async findAll(filters = {}) {
    const query = {};
    if (filters.complaintId) {
      query.$or = [
        { complaintId: filters.complaintId },
        { complaintReference: filters.complaintId },
        { referenceNumber: filters.complaintId }
      ];
    }
    if (filters.citizenId) {
      query.citizenId = filters.citizenId;
    }
    if (filters.departmentId) {
      query.departmentId = filters.departmentId;
    }
    if (filters.rating) {
      query.rating = Number(filters.rating);
    }

    const docs = await FeedbackModel.find(query).sort({ createdAt: -1 }).lean();
    return docs;
  }

  async update(id, updates) {
    const doc = await FeedbackModel.findOneAndUpdate(
      { id },
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();
    return doc;
  }
}

export const mongoFeedbackRepository = new MongoFeedbackRepository();
