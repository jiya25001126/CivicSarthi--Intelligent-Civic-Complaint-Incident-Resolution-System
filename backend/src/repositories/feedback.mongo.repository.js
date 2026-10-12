import FeedbackModel from '../models/feedback.model.js';

export class MongoFeedbackRepository {
  async create(data) {
    const doc = new FeedbackModel(data);
    const saved = await doc.save();
    return saved.toObject();
  }

  async findById(id) {
    const doc = await FeedbackModel.findOne({ id }).lean();
    return doc;
  }

  async findByComplaintAndMilestone(complaintId, milestone) {
    const doc = await FeedbackModel.findOne({
      $or: [{ complaintId }, { complaintReference: complaintId }],
      resolutionMilestone: String(milestone || '1')
    }).lean();
    return doc;
  }

  async findAll(filters = {}) {
    const query = {};
    if (filters.complaintId) {
      query.$or = [{ complaintId: filters.complaintId }, { complaintReference: filters.complaintId }];
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
