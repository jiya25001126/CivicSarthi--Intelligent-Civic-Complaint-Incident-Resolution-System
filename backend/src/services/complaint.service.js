import complaintRepository from '../repositories/complaint.repository.js';
import config from '../config/app.config.js';

export class ComplaintService {
  /**
   * Calculate dynamic SLA health metrics using configurable SLA settings.
   */
  enrichWithSlaMetrics(complaint) {
    if (!complaint) return null;
    const now = new Date();
    const createdDate = new Date(complaint.createdAt);
    const lastUpdatedDate = new Date(complaint.updatedAt || complaint.lastUpdated || complaint.createdAt);

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

  /**
   * Sanitize complaint for citizen view:
   * Strips confidential internal officer review notes.
   */
  sanitizeForCitizen(complaint) {
    if (!complaint) return null;
    const copy = { ...complaint };
    delete copy.officerNotes;
    return copy;
  }

  /**
   * Sanitize complaint for public tracking:
   * Strips confidential officer notes AND private citizen contact details.
   */
  sanitizeForTracking(complaint) {
    if (!complaint) return null;
    const copy = { ...complaint };
    delete copy.officerNotes;
    delete copy.citizenName;
    delete copy.citizenEmail;
    delete copy.citizenPhone;
    delete copy.citizenAddress;
    delete copy.email;
    delete copy.phone;
    delete copy.contact;
    return copy;
  }

  async getAllComplaints(filters = {}, isOfficer = false) {
    const result = await complaintRepository.findAll(filters);

    if (result && Array.isArray(result.items)) {
      const items = result.items.map(c => {
        const enriched = this.enrichWithSlaMetrics(c);
        return isOfficer ? enriched : this.sanitizeForCitizen(enriched);
      });
      return {
        items,
        pagination: result.pagination
      };
    }

    if (Array.isArray(result)) {
      return result.map(c => {
        const enriched = this.enrichWithSlaMetrics(c);
        return isOfficer ? enriched : this.sanitizeForCitizen(enriched);
      });
    }

    return [];
  }

  async getComplaintById(idOrRef, isOfficer = false) {
    const complaint = await complaintRepository.findById(idOrRef);
    if (!complaint) return null;
    const enriched = this.enrichWithSlaMetrics(complaint);
    return isOfficer ? enriched : this.sanitizeForCitizen(enriched);
  }

  async getComplaintForTracking(idOrRef) {
    const complaint = await complaintRepository.findById(idOrRef);
    if (!complaint) return null;
    const enriched = this.enrichWithSlaMetrics(complaint);
    return this.sanitizeForTracking(enriched);
  }

  async createComplaint(data, overrideYear = null) {
    const created = await complaintRepository.create(data, overrideYear);
    return this.enrichWithSlaMetrics(created);
  }

  async updateComplaintStatus(idOrRef, { status, remarks, actorType }) {
    const updated = await complaintRepository.updateStatus(idOrRef, { status, remarks, actorType });
    if (!updated) return null;
    return this.enrichWithSlaMetrics(updated);
  }

  async updateComplaintDepartment(idOrRef, { departmentId, remarks, actorType }) {
    const updated = await complaintRepository.updateDepartment(idOrRef, { departmentId, remarks, actorType });
    if (!updated) return null;
    return this.enrichWithSlaMetrics(updated);
  }

  async addOfficerNote(idOrRef, { note, officerId }) {
    const updated = await complaintRepository.addOfficerNote(idOrRef, { note, officerId });
    if (!updated) return null;
    return this.enrichWithSlaMetrics(updated);
  }

  async getStatusHistory(idOrRef) {
    return complaintRepository.getStatusHistory(idOrRef);
  }

  /**
   * Computed summary metrics from live data
   */
  async getSummaryStats() {
    const all = await complaintRepository.findAll();
    const list = Array.isArray(all) ? all : (all.items || []);

    const total = list.length;
    const submitted = list.filter(c => c.status === 'SUBMITTED').length;
    const underReview = list.filter(c => c.status === 'UNDER_REVIEW').length;
    const inProgress = list.filter(c => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length;
    const awaitingInfo = list.filter(c => c.status === 'AWAITING_INFORMATION').length;
    const resolved = list.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
    const critical = list.filter(c => c.priority === 'CRITICAL').length;

    const reassignmentLoops = list.filter(c => (c.reassignments || 0) >= config.sla.reassignmentLoopThreshold).length;

    const now = new Date();
    const staleCases = list.filter(c => {
      const last = new Date(c.updatedAt || c.lastUpdated || c.createdAt);
      const days = Math.floor((now - last) / (1000 * 60 * 60 * 24));
      return days > config.sla.staleUpdateDays;
    }).length;

    return {
      total,
      submitted,
      underReview,
      inProgress,
      awaitingInfo,
      resolved,
      critical,
      reassignmentLoops,
      staleCases
    };
  }
}

export const complaintService = new ComplaintService();
export default complaintService;
