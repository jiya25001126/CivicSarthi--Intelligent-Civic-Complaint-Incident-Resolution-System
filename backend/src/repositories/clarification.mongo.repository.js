import { ClarificationModel } from '../models/clarification.model.js';
import { CLARIFICATION_STATUS } from '../constants/clarification.constants.js';

export class MongoClarificationRepository {
  async generateClarificationId() {
    const year = new Date().getFullYear();
    const count = await ClarificationModel.countDocuments();
    const seq = String(count + 1).padStart(4, '0');
    let candidate = `CLR-${year}-${seq}`;
    const exists = await ClarificationModel.findOne({ id: candidate }).lean();
    if (exists) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      candidate = `CLR-${year}-${Date.now().toString().slice(-4)}${rand}`;
    }
    return candidate;
  }

  async create(data) {
    const id = data.id || (await this.generateClarificationId());
    const record = await ClarificationModel.create({ ...data, id });
    return record.toObject ? record.toObject() : record;
  }

  async findById(id) {
    if (!id) return null;
    const record = await ClarificationModel.findOne({
      id: { $regex: new RegExp(`^${id}$`, 'i') }
    }).lean();
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

    if (filters.requestType) {
      query.requestType = filters.requestType;
    }

    return ClarificationModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async update(id, updates) {
    const updated = await ClarificationModel.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true }
    ).lean();
    return updated;
  }

  async addResponse(id, { response, responderId, responderName, responderRole }) {
    const responseEntry = {
      response: String(response).trim(),
      responderId: responderId || 'OFFICER',
      responderName: responderName || 'Department Officer',
      responderRole: responderRole || 'officer',
      respondedAt: new Date()
    };

    const updated = await ClarificationModel.findOneAndUpdate(
      { id },
      {
        $set: { status: CLARIFICATION_STATUS.RESPONDED },
        $push: { responses: responseEntry }
      },
      { new: true }
    ).lean();
    return updated;
  }

  async closeRequest(id, { closedBy, closedRole, reason }) {
    const updated = await ClarificationModel.findOneAndUpdate(
      { id },
      {
        $set: {
          status: CLARIFICATION_STATUS.CLOSED,
          closedAt: new Date(),
          closedBy: closedBy || 'CITIZEN',
          closedReason: reason || 'Closed by user'
        }
      },
      { new: true }
    ).lean();
    return updated;
  }
}

export const mongoClarificationRepository = new MongoClarificationRepository();
