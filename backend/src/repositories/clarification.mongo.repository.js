import { ClarificationModel } from '../models/clarification.model.js';
import { CLARIFICATION_STATUS } from '../constants/clarification.constants.js';

export class MongoClarificationRepository {
  async create(data) {
    const record = await ClarificationModel.create(data);
    return record.toObject();
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
      query.citizenId = filters.citizenId;
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
