import complaintRepository from '../repositories/complaint.repository.js';
import config from '../config/app.config.js';

export class ComplaintService {
  /**
   * Calculate SLA health metrics using configurable SLA settings.
   */
  enrichWithSlaMetrics(complaint) {
    const now = new Date();
    const createdDate = new Date(complaint.createdAt);
    const lastUpdatedDate = new Date(complaint.lastUpdated);

    const ageDays = Math.max(0, Math.floor((now - createdDate) / (1000 * 60 * 60 * 24)));
    const daysSinceUpdate = Math.max(0, Math.floor((now - lastUpdatedDate) / (1000 * 60 * 60 * 24)));

    const isSlaBreached = ageDays > config.sla.resolutionDeadlineDays;
    const isStale = daysSinceUpdate > config.sla.staleUpdateDays;
    const isReassignmentLoop = (complaint.reassignments || 0) >= config.sla.reassignmentLoopThreshold;

    return {
      ...complaint,
      slaMetrics: {
        ageDays,
        daysSinceUpdate,
        isSlaBreached,
        isStale,
        isReassignmentLoop,
        slaDeadlineDays: config.sla.resolutionDeadlineDays
      }
    };
  }

  async getAllComplaints(filters = {}) {
    const list = await complaintRepository.findAll(filters);
    return list.map(c => this.enrichWithSlaMetrics(c));
  }

  async getComplaintById(id) {
    const complaint = await complaintRepository.findById(id);
    if (!complaint) return null;
    return this.enrichWithSlaMetrics(complaint);
  }

  async createComplaint(data) {
    const created = await complaintRepository.create(data);
    return this.enrichWithSlaMetrics(created);
  }

  async updateComplaint(id, data) {
    const updated = await complaintRepository.update(id, data);
    if (!updated) return null;
    return this.enrichWithSlaMetrics(updated);
  }
}

export const complaintService = new ComplaintService();
export default complaintService;
