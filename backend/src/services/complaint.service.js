import complaintRepository from '../repositories/complaint.repository.js';
import { incidentRepository as defaultIncidentRepository } from '../repositories/incident.repository.js';
import config from '../config/app.config.js';
import { getStatusDescription } from '../constants/status.constants.js';
import aiIntelligenceService, { CATEGORY_DEPARTMENT_MAP } from './aiIntelligence.service.js';

export class ComplaintService {
  constructor(
    complaintRepo = complaintRepository,
    incidentRepo = defaultIncidentRepository
  ) {
    this.complaintRepo = complaintRepo;
    this.incidentRepo = incidentRepo;
  }

  /**
   * Helper to retrieve citizen-friendly description for a status
   */
  getStatusDescription(status) {
    return getStatusDescription(status);
  }

  /**
   * Enriches complaint with sanitized parent incident information if linked.
   * Strictly omits private incident notes, internal subtasks, and officer assignments.
   */
  async _attachParentIncident(complaint) {
    if (!complaint || !complaint.incidentId) return complaint;
    try {
      if (this.incidentRepo && typeof this.incidentRepo.findById === 'function') {
        const inc = await this.incidentRepo.findById(complaint.incidentId);
        if (inc) {
          complaint.parentIncident = {
            id: inc.id,
            title: inc.title,
            status: inc.status,
            category: inc.category,
            leadDepartment: inc.leadDepartment,
            resolvedAt: inc.resolvedAt || null,
            resolutionSummary: inc.resolutionSummary || null
          };
        }
      }
    } catch {
      // Non-blocking fallback
    }
    return complaint;
  }

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
   * Strips confidential internal officer review notes and enriches with citizen-friendly status explanation.
   * Includes sanitized parent incident if linked.
   */
  sanitizeForCitizen(complaint) {
    if (!complaint) return null;
    const copy = { ...complaint };
    delete copy.officerNotes;
    copy.incidentId = complaint.incidentId || null;
    copy.parentIncident = complaint.parentIncident ? {
      id: complaint.parentIncident.id,
      title: complaint.parentIncident.title,
      status: complaint.parentIncident.status,
      category: complaint.parentIncident.category,
      leadDepartment: complaint.parentIncident.leadDepartment,
      resolvedAt: complaint.parentIncident.resolvedAt || null,
      resolutionSummary: complaint.parentIncident.resolutionSummary || null
    } : null;
    copy.statusDescription = this.getStatusDescription(copy.status);
    if (Array.isArray(copy.statusHistory)) {
      copy.statusHistory = copy.statusHistory.map(h => ({
        ...h,
        statusDescription: this.getStatusDescription(h.status)
      }));
    }
    return copy;
  }

  /**
   * Sanitize complaint for public tracking:
   * Strictly projects only public-safe fields.
   * Never exposes citizenId, citizen contact details, internal notes, or officer IDs.
   * Includes sanitized parent incident if linked.
   */
  sanitizeForTracking(complaint) {
    if (!complaint) return null;
    return {
      id: complaint.id,
      referenceNumber: complaint.referenceNumber || complaint.id,
      incidentId: complaint.incidentId || null,
      parentIncident: complaint.parentIncident ? {
        id: complaint.parentIncident.id,
        title: complaint.parentIncident.title,
        status: complaint.parentIncident.status,
        category: complaint.parentIncident.category,
        leadDepartment: complaint.parentIncident.leadDepartment,
        resolvedAt: complaint.parentIncident.resolvedAt || null,
        resolutionSummary: complaint.parentIncident.resolutionSummary || null
      } : null,
      title: complaint.title || complaint.text,
      description: complaint.description || complaint.text,
      category: complaint.category,
      state: complaint.state,
      district: complaint.district,
      locality: complaint.locality || '',
      departmentId: complaint.departmentId || complaint.department,
      department: complaint.departmentId || complaint.department,
      status: complaint.status,
      officialStatus: complaint.officialStatus || complaint.status,
      statusDescription: this.getStatusDescription(complaint.status),
      priority: complaint.priority,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt || complaint.lastUpdated || complaint.createdAt,
      lastUpdated: complaint.updatedAt || complaint.lastUpdated || complaint.createdAt,
      reassignments: complaint.reassignments || 0,
      evidence: complaint.evidence || [],
      statusHistory: (complaint.statusHistory || []).map(h => ({
        timestamp: h.timestamp,
        status: h.status,
        statusDescription: this.getStatusDescription(h.status),
        actorType: h.actorType || 'OFFICER',
        remarks: h.remarks || `Status updated to ${h.status}`
      }))
    };
  }

  async getAllComplaints(filters = {}, isOfficer = false) {
    const result = await this.complaintRepo.findAll(filters);

    if (result && Array.isArray(result.items)) {
      const items = await Promise.all(result.items.map(async c => {
        await this._attachParentIncident(c);
        const enriched = this.enrichWithSlaMetrics(c);
        return isOfficer ? enriched : this.sanitizeForCitizen(enriched);
      }));
      return {
        items,
        pagination: result.pagination
      };
    }

    if (Array.isArray(result)) {
      return Promise.all(result.map(async c => {
        await this._attachParentIncident(c);
        const enriched = this.enrichWithSlaMetrics(c);
        return isOfficer ? enriched : this.sanitizeForCitizen(enriched);
      }));
    }

    return [];
  }

  async getComplaintById(idOrRef, isOfficer = false) {
    const complaint = await this.complaintRepo.findById(idOrRef);
    if (!complaint) return null;
    await this._attachParentIncident(complaint);
    const enriched = this.enrichWithSlaMetrics(complaint);
    return isOfficer ? enriched : this.sanitizeForCitizen(enriched);
  }

  async getComplaintForTracking(idOrRef) {
    const complaint = await this.complaintRepo.findById(idOrRef);
    if (!complaint) return null;
    await this._attachParentIncident(complaint);
    const enriched = this.enrichWithSlaMetrics(complaint);
    return this.sanitizeForTracking(enriched);
  }

  async createComplaint(data, overrideYear = null) {
    // If departmentId is missing, automatically resolve default mapping from category
    let resolvedDept = data.departmentId;
    if (!resolvedDept && data.category) {
      resolvedDept = CATEGORY_DEPARTMENT_MAP[data.category.toLowerCase()] || 'DEPT_ROADS';
    }

    // Run AI intelligence evaluation (graceful try-catch so failure NEVER blocks grievance registration)
    let intelligence = data.intelligence || null;
    try {
      if (!intelligence) {
        const existingResult = await this.complaintRepo.findAll();
        const existingList = Array.isArray(existingResult) ? existingResult : (existingResult?.items || []);
        const analysis = aiIntelligenceService.evaluateIntelligence(
          { ...data, departmentId: resolvedDept },
          existingList
        );
        intelligence = {
          ...analysis.summary,
          classification: analysis.classification,
          priorityRecommendation: analysis.priorityRecommendation,
          duplicates: analysis.duplicates
        };
      }
    } catch (err) {
      console.warn('AI intelligence evaluation skipped during creation:', err.message);
    }

    const complaintPayload = {
      ...data,
      departmentId: resolvedDept || data.departmentId || 'DEPT_ROADS',
      intelligence
    };

    const created = await this.complaintRepo.create(complaintPayload, overrideYear);
    return this.enrichWithSlaMetrics(created);
  }

  async updateComplaintPriority(idOrRef, { priority, remarks, actorType }) {
    const updated = await this.complaintRepo.updatePriority(idOrRef, { priority, remarks, actorType });
    if (!updated) return null;
    return this.enrichWithSlaMetrics(updated);
  }

  async linkDuplicateComplaint(idOrRef, { duplicateOf, remarks, actorType }) {
    const updated = await this.complaintRepo.linkDuplicate(idOrRef, { duplicateOf, remarks, actorType });
    if (!updated) return null;
    return this.enrichWithSlaMetrics(updated);
  }

  async getComplaintIntelligence(idOrRef) {
    const complaint = await this.complaintRepo.findById(idOrRef);
    if (!complaint) return null;

    const existingResult = await this.complaintRepo.findAll();
    const existingList = Array.isArray(existingResult) ? existingResult : (existingResult?.items || []);
    const enriched = this.enrichWithSlaMetrics(complaint);
    return aiIntelligenceService.evaluateIntelligence(enriched, existingList);
  }

  async getComplaintDuplicates(idOrRef, options = {}) {
    const complaint = await this.complaintRepo.findById(idOrRef);
    if (!complaint) return null;

    const existingResult = await this.complaintRepo.findAll();
    const existingList = Array.isArray(existingResult) ? existingResult : (existingResult?.items || []);
    return aiIntelligenceService.detectDuplicates(complaint, existingList, options);
  }

  async updateComplaintStatus(idOrRef, { status, remarks, actorType }) {
    const updated = await this.complaintRepo.updateStatus(idOrRef, { status, remarks, actorType });
    if (!updated) return null;
    return this.enrichWithSlaMetrics(updated);
  }

  async updateComplaintDepartment(idOrRef, { departmentId, remarks, actorType }) {
    const updated = await this.complaintRepo.updateDepartment(idOrRef, { departmentId, remarks, actorType });
    if (!updated) return null;
    return this.enrichWithSlaMetrics(updated);
  }

  async addOfficerNote(idOrRef, { note, officerId }) {
    const updated = await this.complaintRepo.addOfficerNote(idOrRef, { note, officerId });
    if (!updated) return null;
    return this.enrichWithSlaMetrics(updated);
  }

  async getStatusHistory(idOrRef) {
    const history = await this.complaintRepo.getStatusHistory(idOrRef);
    if (!history) return null;
    return history.map(h => ({
      ...h,
      statusDescription: this.getStatusDescription(h.status)
    }));
  }

  /**
   * Computed summary metrics from live data
   */
  async getSummaryStats() {
    const all = await this.complaintRepo.findAll();
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
