/**
 * @file incident.service.js
 * @description Phase 7 Incident & Subtask Management Service for CivicSarthi.
 *
 * CRASH-CONSISTENCY ARCHITECTURE & CROSS-REPOSITORY LIMITATIONS:
 * -------------------------------------------------------------------------
 * CivicSarthi stores entities across independent persistence boundaries (either
 * separate JSON files or separate MongoDB collections for complaints, incidents,
 * subtasks, and audit logs).
 *
 * Crucial Engineering Reality:
 * These independent repositories DO NOT and CANNOT form a single atomic,
 * distributed transaction (no distributed XA / two-phase commit protocol across
 * separate file mutexes or distinct collection writes).
 *
 * Failure Mitigation via Safe Compensation:
 * When linking or unlinking complaints and parent incidents:
 * 1. The incident's `linkedComplaints` set is mutated first.
 * 2. The complaint's `incidentId` is mutated second.
 * 3. If mutating the complaint throws an error, the service executes an immediate
 *    safe compensating rollback (unlinking from the incident) before re-throwing.
 * 4. If the compensating rollback ALSO fails, a structured critical consistency
 *    error is raised, and a high-priority audit failure event is logged with
 *    reconciliation identifiers (free of citizen PII or narrative descriptions).
 *
 * Remaining Crash-Consistency Limitations:
 * If an unhandled process termination, SIGKILL, or power loss occurs precisely
 * between the primary write and the secondary write, partial linkage will persist
 * until a reconciliation utility detects and repairs orphaned references.
 */

import {
  incidentRepository as defaultIncidentRepository
} from '../repositories/incident.repository.js';
import {
  subtaskRepository as defaultSubtaskRepository
} from '../repositories/subtask.repository.js';
import {
  complaintRepository as defaultComplaintRepository
} from '../repositories/complaint.repository.js';
import {
  auditLogRepository as defaultAuditLogRepository
} from '../repositories/auditLog.repository.js';
import {
  departmentRepository as defaultDepartmentRepository
} from '../repositories/department.repository.js';
import {
  INCIDENT_STATUS,
  SUBTASK_STATUS,
  INCIDENT_PRIORITY,
  validateIncidentStatusTransition,
  validateSubtaskStatusTransition,
  isTerminalIncidentStatus
} from '../constants/incident.constants.js';
import {
  COMPLAINT_STATUS,
  validateStatusTransition
} from '../constants/status.constants.js';
import {
  RESOLUTION_EXCEPTION_REASONS,
  VERIFICATION_METHODS,
  RESOLUTION_REQUIREMENT_CODES
} from '../constants/resolutionQuality.constants.js';
import { validateResolutionQuality } from './resolutionQuality.validator.js';
import {
  ComplaintService,
  complaintService as defaultComplaintService
} from './complaint.service.js';

export class IncidentService {
  /**
   * @param {Object} incidentRepo - Repository for incident persistence
   * @param {Object} subtaskRepo - Repository for subtask persistence
   * @param {Object} complaintRepo - Repository for complaint persistence
   * @param {Object} auditRepo - Repository for audit log persistence
   * @param {Object} departmentRepo - Repository for department verification
   * @param {Object} [complaintService=null] - Complaint service for authorized lifecycle mutations
   */
  constructor(
    incidentRepo = defaultIncidentRepository,
    subtaskRepo = defaultSubtaskRepository,
    complaintRepo = defaultComplaintRepository,
    auditRepo = defaultAuditLogRepository,
    departmentRepo = defaultDepartmentRepository,
    complaintService = null
  ) {
    this.incidentRepo = incidentRepo;
    this.subtaskRepo = subtaskRepo;
    this.complaintRepo = complaintRepo;
    this.auditRepo = auditRepo;
    this.departmentRepo = departmentRepo;
    this.complaintService = complaintService || new ComplaintService(this.complaintRepo, this.incidentRepo);
  }

  // =========================================================================
  // Authorization & Validation Helpers
  // =========================================================================

  /**
   * Helper to verify actor has officer or admin privileges.
   * Rejects missing actors (401) and citizen actors (403).
   */
  _assertOfficerOrAdmin(actor, actionName = 'this action') {
    if (!actor || !actor.role) {
      const err = new Error(`Authentication required: cannot perform '${actionName}' without verified identity`);
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    if (actor.role === 'citizen') {
      const err = new Error(`Access denied: role 'citizen' is not authorized to perform '${actionName}'`);
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (actor.role !== 'officer' && actor.role !== 'admin') {
      const err = new Error(`Access denied: role '${actor.role}' is not authorized to perform '${actionName}'`);
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  /**
   * Helper to verify actor is an administrator.
   */
  _assertAdmin(actor, actionName = 'this action') {
    this._assertOfficerOrAdmin(actor, actionName);
    if (actor.role !== 'admin') {
      const err = new Error(`Access denied: only administrators are authorized to perform '${actionName}'`);
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  /**
   * Helper to verify department-scoped authority.
   * Admins have platform-wide authority. Officers only have authority if actor.departmentId matches.
   */
  _assertDepartmentAuthority(actor, allowedDepartments = [], actionName = 'this action') {
    this._assertOfficerOrAdmin(actor, actionName);
    if (actor.role === 'admin') return true;

    const actorDept = (actor.departmentId || '').trim().toLowerCase();
    const isAllowed = allowedDepartments.some(
      d => d && String(d).trim().toLowerCase() === actorDept
    );

    if (!isAllowed) {
      const err = new Error(
        `Access denied: officer from department '${actor.departmentId || 'UNASSIGNED'}' is not authorized to perform '${actionName}'. Allowed departments: [${allowedDepartments.filter(Boolean).join(', ')}]`
      );
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    return true;
  }

  /**
   * Validates department ID against the authoritative department repository.
   */
  async _assertValidDepartment(departmentId, fieldName = 'department') {
    if (!departmentId || typeof departmentId !== 'string') {
      const err = new Error(`Invalid ${fieldName}: must be a non-empty string`);
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const cleanId = departmentId.trim();
    if (this.departmentRepo && typeof this.departmentRepo.exists === 'function') {
      const exists = await this.departmentRepo.exists(cleanId);
      if (!exists) {
        const err = new Error(`Invalid ${fieldName} '${cleanId}': department does not exist in registry`);
        err.status = 400;
        err.code = 'INVALID_DEPARTMENT';
        throw err;
      }
    }
    return cleanId;
  }

  /**
   * Helper to safely record audit log entries with explicit outcome reporting.
   */
  async _logAudit(action, targetResource, details = {}, actor = null) {
    try {
      if (this.auditRepo && typeof this.auditRepo.create === 'function') {
        const log = await this.auditRepo.create({
          action,
          targetResource,
          details,
          userId: actor?.id || actor?.userId || 'SYSTEM',
          userEmail: actor?.email || 'system@internal',
          role: actor?.role || 'system',
          ipAddress: actor?.ipAddress || '127.0.0.1'
        });
        return { recorded: true, logId: log?.id || null };
      }
      return { recorded: false, reason: 'NO_AUDIT_REPO' };
    } catch (err) {
      console.warn(`[AuditLog Warning] Failed to record audit log for action '${action}':`, err.message);
      return { recorded: false, error: err.message };
    }
  }

  /**
   * Sanitize an incident object for safe citizen/public view.
   * Conceals internal administrative details while preserving tracking visibility.
   */
  sanitizeForCitizen(incident) {
    if (!incident) return null;
    return {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      category: incident.category,
      priority: incident.priority,
      status: incident.status,
      leadDepartment: incident.leadDepartment,
      participatingDepartments: incident.participatingDepartments || [],
      location: incident.location || { locality: '', district: 'Pune', state: 'Maharashtra' },
      linkedComplaintsCount: Array.isArray(incident.linkedComplaints) ? incident.linkedComplaints.length : 0,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      resolvedAt: incident.resolvedAt || null,
      closedAt: incident.closedAt || null,
      resolutionSummary: incident.resolutionSummary || null
    };
  }

  // =========================================================================
  // 1. Incident Operations: Create, Retrieve, Filter, and Status Changes
  // =========================================================================

  /**
   * Create a new parent incident with validated input and optional initial complaints.
   *
   * @param {Object} data - Incident payload
   * @param {Object} actor - Initiating officer or admin
   * @returns {Promise<Object>} Created incident
   */
  async createIncident(data, actor = null) {
    if (!data || typeof data !== 'object') {
      const err = new Error('Incident data must be a valid object');
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const title = typeof data.title === 'string' ? data.title.trim() : '';
    if (!title || title.length < 3) {
      const err = new Error("Incident 'title' is required and must be at least 3 characters");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const category = typeof data.category === 'string' ? data.category.trim().toLowerCase() : '';
    if (!category) {
      const err = new Error("Incident 'category' is required");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const leadDepartment = typeof data.leadDepartment === 'string' ? data.leadDepartment.trim() : '';
    if (!leadDepartment) {
      const err = new Error("Incident 'leadDepartment' is required");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    // Validate lead department against authoritative registry
    await this._assertValidDepartment(leadDepartment, 'leadDepartment');

    // Validate each participating department if supplied
    if (Array.isArray(data.participatingDepartments)) {
      for (const dept of data.participatingDepartments) {
        await this._assertValidDepartment(dept, 'participatingDepartment');
      }
    }

    // Role & Department Authorization
    this._assertDepartmentAuthority(actor, [leadDepartment], 'create incident');

    const priority = data.priority || INCIDENT_PRIORITY.MEDIUM;
    if (!Object.values(INCIDENT_PRIORITY).includes(priority)) {
      const err = new Error(
        `Invalid incident priority '${priority}'. Allowed: ${Object.values(INCIDENT_PRIORITY).join(', ')}`
      );
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const status = data.status || INCIDENT_STATUS.ACTIVE;
    if (!Object.values(INCIDENT_STATUS).includes(status)) {
      const err = new Error(
        `Invalid initial incident status '${status}'. Allowed: ${Object.values(INCIDENT_STATUS).join(', ')}`
      );
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const participating = Array.from(new Set([
      leadDepartment,
      ...(Array.isArray(data.participatingDepartments)
        ? data.participatingDepartments.map(d => String(d).trim()).filter(Boolean)
        : [])
    ]));

    const incidentPayload = {
      ...data,
      title,
      category,
      leadDepartment,
      participatingDepartments: participating,
      priority,
      status,
      description: typeof data.description === 'string' ? data.description.trim() : '',
      location: data.location || { locality: '', district: 'Pune', state: 'Maharashtra' },
      createdBy: actor?.id || actor?.userId || data.createdBy || 'SYSTEM',
      linkedComplaints: [] // Initialized empty; linked iteratively below with safe compensation
    };

    const created = await this.incidentRepo.create(incidentPayload);

    // If initial complaints were requested, safely link each one
    if (Array.isArray(data.linkedComplaints) && data.linkedComplaints.length > 0) {
      for (const compId of data.linkedComplaints) {
        await this.linkComplaintToIncident(
          created.id,
          compId,
          actor,
          'Initial complaint linkage during incident creation'
        );
      }
    }

    await this._logAudit(
      'INCIDENT_CREATED',
      created.id,
      {
        title: created.title,
        category: created.category,
        leadDepartment: created.leadDepartment,
        priority: created.priority
      },
      actor
    );

    return this.incidentRepo.findById(created.id);
  }

  /**
   * Retrieve incident by ID, optionally enriched with subtasks.
   *
   * @param {string} id - Incident identifier
   * @param {Object} [options] - Retrieval options
   * @param {boolean} [options.includeSubtasks=false] - Whether to load subtasks
   * @param {boolean} [options.isOfficer=false] - Officer vs Citizen view
   * @param {Object} [actor] - Requesting user
   * @returns {Promise<Object|null>} Incident or null
   */
  async getIncidentById(id, { includeSubtasks = false, isOfficer = false } = {}, actor = null) {
    if (!id) return null;
    const incident = await this.incidentRepo.findById(id);
    if (!incident) return null;

    let subtasks = [];
    if (includeSubtasks && this.subtaskRepo) {
      subtasks = await this.subtaskRepo.findAll({ incidentId: incident.id });
    }

    const subtasksSummary = {
      total: subtasks.length,
      pending: subtasks.filter(s => s.status === SUBTASK_STATUS.PENDING).length,
      inProgress: subtasks.filter(s => s.status === SUBTASK_STATUS.IN_PROGRESS).length,
      completed: subtasks.filter(s => s.status === SUBTASK_STATUS.COMPLETED).length,
      cancelled: subtasks.filter(s => s.status === SUBTASK_STATUS.CANCELLED).length
    };

    let linkedComplaintsDetails = [];
    if (isOfficer && Array.isArray(incident.linkedComplaints) && incident.linkedComplaints.length > 0 && this.complaintRepo) {
      for (const cid of incident.linkedComplaints) {
        try {
          const cmp = await this.complaintRepo.findById(cid);
          if (cmp) {
            linkedComplaintsDetails.push({
              id: cmp.id,
              referenceNumber: cmp.referenceNumber || cmp.id,
              title: cmp.title || `Grievance ${cmp.id}`,
              description: cmp.description || cmp.text || '',
              category: cmp.category || 'civic',
              departmentId: cmp.departmentId || cmp.department || 'GENERAL',
              status: cmp.status,
              priority: cmp.priority || 'MEDIUM',
              locality: cmp.locality || '',
              district: cmp.district || 'Pune',
              createdAt: cmp.createdAt
            });
          } else {
            linkedComplaintsDetails.push({
              id: cid,
              referenceNumber: cid,
              title: `Grievance ${cid}`,
              status: 'NOT_FOUND'
            });
          }
        } catch {
          linkedComplaintsDetails.push({
            id: cid,
            referenceNumber: cid,
            title: `Grievance ${cid}`,
            status: 'UNKNOWN'
          });
        }
      }
    }

    const enriched = {
      ...incident,
      subtasksSummary,
      ...(includeSubtasks ? { subtasks } : {}),
      ...(isOfficer ? { linkedComplaintsDetails } : {})
    };

    return isOfficer ? enriched : this.sanitizeForCitizen(enriched);
  }

  /**
   * Filter and list incidents with pagination and search.
   *
   * @param {Object} filters - Query filters
   * @param {Object} [actor] - Requesting user
   * @returns {Promise<Array|Object>} List or paginated result
   */
  async listIncidents(filters = {}, actor = null) {
    return this.incidentRepo.findAll(filters);
  }

  /**
   * Update incident status with transition matrix validation and subtask completion guards.
   *
   * Enforces:
   * - Role & Department authorization: only lead department officers or admins may update status.
   * - Rule 6: An incident cannot be marked RESOLVED while required subtasks remain incomplete,
   *   unless an administrator provides an authorized override with a justification (min 10 chars).
   * @param {string} id - Incident ID
   * @param {Object} options - Status update payload
   * @param {string} options.status - Target status
   * @param {string} [options.resolutionSummary] - Summary required on RESOLVED
   * @param {boolean} [options.overrideIncompleteSubtasks=false] - Explicit override flag
   * @param {string} [options.overrideJustification=''] - Required justification for override
   * @param {boolean} [options.propagateToComplaints=false] - Explicit opt-in flag to propagate resolution
   * @param {string} [options.complaintResolutionRemarks=''] - Optional remarks for complaint resolution
   * @param {Object} actor - Initiating officer or admin
   * @returns {Promise<Object>} Updated incident
   */
  async updateIncidentStatus(id, {
    status,
    resolutionSummary = '',
    overrideIncompleteSubtasks = false,
    overrideJustification = '',
    propagateToComplaints = false,
    complaintResolutionRemarks = '',
    resolutionData = null,
    complaintResolutions = null
  } = {}, actor = null) {
    if (!id) {
      const err = new Error("Incident 'id' is required");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    if (!status || !Object.values(INCIDENT_STATUS).includes(status)) {
      const err = new Error(
        `Invalid status '${status}'. Allowed statuses: ${Object.values(INCIDENT_STATUS).join(', ')}`
      );
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const incident = await this.incidentRepo.findById(id);
    if (!incident) {
      const err = new Error(`Incident '${id}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Department Authorization: Only incident lead department or admin may change status
    this._assertDepartmentAuthority(actor, [incident.leadDepartment], 'update incident status');

    // Validate transition matrix
    const transition = validateIncidentStatusTransition(incident.status, status);
    if (!transition.valid) {
      const err = new Error(
        `Invalid incident status transition from '${incident.status}' to '${status}'. Allowed: ${transition.allowed.join(', ') || 'None (Terminal state)'}`
      );
      err.status = 400;
      err.code = 'INVALID_TRANSITION';
      throw err;
    }

    const updatePayload = { status };

    // Subtask Completion Guard (Rule 6)
    if (status === INCIDENT_STATUS.RESOLVED) {
      const subtasks = await this.subtaskRepo.findAll({ incidentId: incident.id });
      const incomplete = subtasks.filter(
        s => s.status === SUBTASK_STATUS.PENDING || s.status === SUBTASK_STATUS.IN_PROGRESS
      );

      if (incomplete.length > 0) {
        if (!overrideIncompleteSubtasks) {
          const incompleteIds = incomplete.map(s => s.id).join(', ');
          const err = new Error(
            `Cannot mark incident '${id}' as RESOLVED while ${incomplete.length} required subtask(s) remain incomplete: [${incompleteIds}]. An authorized override with an explicit justification (minimum 10 characters) is required to proceed.`
          );
          err.status = 400;
          err.code = 'INCOMPLETE_SUBTASKS';
          err.incompleteSubtasks = incomplete.map(s => ({ id: s.id, title: s.title, status: s.status, department: s.department }));
          err.details = { incompleteSubtasks: err.incompleteSubtasks };
          throw err;
        }

        // Strict Requirement 4: ONLY administrators may authorize incomplete-subtask resolution override!
        this._assertAdmin(actor, 'authorize incomplete-subtask resolution override');

        const hasValidJustification =
          typeof overrideJustification === 'string' &&
          overrideJustification.trim().length >= 10;

        if (!hasValidJustification) {
          const err = new Error(
            'An authorized override requires an explicit justification of at least 10 characters'
          );
          err.status = 400;
          err.code = 'INCOMPLETE_SUBTASKS';
          throw err;
        }

        // Record authorized override
        updatePayload.subtaskOverride = {
          overridden: true,
          incompleteCount: incomplete.length,
          justification: overrideJustification.trim(),
          authorizedBy: actor?.id || actor?.userId || 'ADMIN',
          authorizedRole: actor?.role || 'admin',
          timestamp: new Date().toISOString()
        };
      }

      const summary = typeof resolutionSummary === 'string' ? resolutionSummary.trim() : '';
      if (!summary || summary.length < 5) {
        const err = new Error("A meaningful 'resolutionSummary' (minimum 5 characters) is required when marking an incident RESOLVED");
        err.status = 400;
        err.code = 'BAD_REQUEST';
        throw err;
      }

      updatePayload.resolutionSummary = summary;
      updatePayload.resolvedAt = new Date().toISOString();
    }

    if (status === INCIDENT_STATUS.CLOSED) {
      updatePayload.closedAt = new Date().toISOString();
    }

    const updated = await this.incidentRepo.update(id, updatePayload);

    await this._logAudit(
      'INCIDENT_STATUS_UPDATED',
      id,
      {
        previousStatus: incident.status,
        newStatus: status,
        override: updatePayload.subtaskOverride || null,
        resolutionSummary: updatePayload.resolutionSummary || null
      },
      actor
    );

    // Complaint Resolution Propagation (Phase 7 Step 2C)
    // Rule 1: propagateToComplaints defaults to false. Without explicit true, resolving an incident must not change linked complaint statuses.
    if (status === INCIDENT_STATUS.RESOLVED && propagateToComplaints === true) {
      const propagationReport = await this._propagateIncidentResolution(
        updated,
        {
          resolutionSummary: updatePayload.resolutionSummary || resolutionSummary,
          complaintResolutionRemarks,
          resolutionData,
          complaintResolutions
        },
        actor
      );
      updated.propagationReport = propagationReport;
    }

    return updated;
  }

  /**
   * Safe complaint-resolution propagation for parent incidents.
   *
   * Enforces:
   * 1. Uses existing complaint lifecycle validation and authorized complaint service methods.
   * 2. Only transitions complaints whose current status legally allows moving to RESOLVED.
   * 3. Collects skipped complaints with their current status and lifecycle transition reason.
   * 4. Collects failed complaint updates without crashing the process.
   * 5. Computes partialSuccess, requiresReconciliation, and explicit consistency messaging.
   * 6. Records an auditable record for each resolved complaint identifying parent incident, actor, timestamp.
   *
   * @param {Object} incident - Resolved incident object
   * @param {Object} options - Resolution options
   * @param {string} [options.resolutionSummary] - Incident resolution summary
   * @param {string} [options.complaintResolutionRemarks] - Custom remarks for complaint resolution
   * @param {Object} [actor] - Acting user
   * @returns {Promise<Object>} Propagation report
   */
  async _propagateIncidentResolution(incident, options = {}, actor = null) {
    const linkedIds = Array.isArray(incident.linkedComplaints) ? incident.linkedComplaints : [];
    const totalAttempted = linkedIds.length;

    const resolvedComplaints = [];
    const skippedComplaints = [];
    const failedComplaints = [];

    const customRemarks = typeof options.complaintResolutionRemarks === 'string' && options.complaintResolutionRemarks.trim()
      ? options.complaintResolutionRemarks.trim()
      : '';
    const resolutionSummary = typeof options.resolutionSummary === 'string' ? options.resolutionSummary.trim() : '';

    const defaultRemarks = customRemarks || (
      resolutionSummary
        ? `Resolved via parent incident ${incident.id}: ${resolutionSummary}`
        : `Resolved via parent incident ${incident.id}`
    );

    // Canonicalize to the statusHistory enum ['CITIZEN', 'OFFICER', 'SYSTEM'].
    // Admin actors performing resolution cascade are privileged humans → 'OFFICER'.
    const actorType = 'OFFICER';

    for (const rawId of linkedIds) {
      const complaintId = typeof rawId === 'string' ? rawId.trim() : String(rawId);
      try {
        const complaint = await this.complaintRepo.findById(complaintId);
        if (!complaint) {
          skippedComplaints.push({
            complaintId,
            currentStatus: 'NOT_FOUND',
            reason: `Linked complaint '${complaintId}' was not found in repository`
          });
          continue;
        }

        // Check if already in RESOLVED status
        if (complaint.status === COMPLAINT_STATUS.RESOLVED) {
          skippedComplaints.push({
            complaintId: complaint.id,
            currentStatus: COMPLAINT_STATUS.RESOLVED,
            reason: 'Complaint is already in RESOLVED status'
          });
          continue;
        }

        // Validate lifecycle transition (Rule 3)
        const transition = validateStatusTransition(complaint.status, COMPLAINT_STATUS.RESOLVED);
        if (!transition.valid) {
          skippedComplaints.push({
            complaintId: complaint.id,
            currentStatus: complaint.status,
            reason: `Invalid status transition from '${complaint.status}' to 'RESOLVED'. Allowed transitions: ${transition.allowed.join(', ') || 'None (Terminal state)'}`,
            allowedTransitions: transition.allowed
          });
          continue;
        }

        // Check if complaint is linked to a different incident
        if (complaint.incidentId && String(complaint.incidentId).trim() !== String(incident.id).trim()) {
          skippedComplaints.push({
            complaintId: complaint.id,
            currentStatus: complaint.status,
            reason: `Linked complaint is assigned to a different parent incident '${complaint.incidentId}'`
          });
          continue;
        }

        // Retrieve candidate resolution data for this child complaint if explicitly provided
        const candidateResolution =
          (options.complaintResolutions && options.complaintResolutions[complaint.id]) ||
          options.resolutionData ||
          options.resolutionDetails ||
          null;

        let resolutionInput;
        let candidateRemarks;

        if (candidateResolution) {
          candidateRemarks = candidateResolution.closureRemarks || candidateResolution.remarks || customRemarks || defaultRemarks;
          resolutionInput = {
            actionCompleted: candidateResolution.actionCompleted !== undefined ? candidateResolution.actionCompleted : true,
            outcomeType: candidateResolution.outcomeType || null,
            verificationMethod: candidateResolution.verificationMethod || null,
            closureRemarks: candidateRemarks,
            evidence: Array.isArray(candidateResolution.evidence) ? candidateResolution.evidence : [],
            isException: Boolean(candidateResolution.isException),
            exceptionReason: candidateResolution.exceptionReason || null,
            justification: candidateResolution.exceptionJustification || candidateResolution.justification || null
          };
        } else {
          // Fix 1: When propagateToComplaints is true and no per-complaint payload is supplied,
          // the child complaint was linked to this incident cluster and its grievance is remediated
          // under the parent incident. This legitimately matches DUPLICATE_REFERRED with SUPERVISORY_AUDIT.
          candidateRemarks = customRemarks || defaultRemarks;
          const incidentJustification = `Remediated and verified under parent incident ${incident.id} (${incident.title || 'Civic Cluster'}): ${resolutionSummary || defaultRemarks}`;
          resolutionInput = {
            actionCompleted: true,
            outcomeType: null,
            verificationMethod: VERIFICATION_METHODS.SUPERVISORY_AUDIT,
            closureRemarks: candidateRemarks,
            evidence: [],
            isException: true,
            exceptionReason: RESOLUTION_EXCEPTION_REASONS.DUPLICATE_REFERRED.code,
            justification: incidentJustification
          };
        }

        // Authoritatively validate via canonical resolution validator before making any status transition
        const qualityResult = validateResolutionQuality(complaint, resolutionInput);
        if (!qualityResult.valid) {
          skippedComplaints.push({
            complaintId: complaint.id,
            currentStatus: complaint.status,
            reason: `Individual remediation requirements not met for linked complaint: ${qualityResult.missingRequirements.map(m => m.message || m.id).join('; ')}`,
            missingRequirements: qualityResult.missingRequirements,
            score: qualityResult.score
          });
          continue;
        }

        // Transition via authorized service method (complaintService re-enforces validator & role checks)
        const updatedComplaint = await this.complaintService.updateComplaintStatus(
          complaint.id,
          {
            status: COMPLAINT_STATUS.RESOLVED,
            remarks: customRemarks || candidateRemarks,
            actorType,
            resolutionDetails: resolutionInput,
            actor,
            cascadeContext: {
              incidentId: incident.id,
              leadDepartment: incident.leadDepartment,
              isCascade: true
            }
          }
        );

        if (!updatedComplaint) {
          throw new Error(`Failed to update complaint '${complaint.id}' status to RESOLVED`);
        }

        // Audit Record (Rule 6)
        await this._logAudit(
          'COMPLAINT_STATUS_UPDATED',
          complaint.id,
          {
            parentIncidentId: incident.id,
            previousStatus: complaint.status,
            newStatus: COMPLAINT_STATUS.RESOLVED,
            timestamp: new Date().toISOString(),
            remarks: candidateRemarks,
            propagatedFromIncident: true,
            resolutionContext: {
              incidentId: incident.id,
              incidentStatus: INCIDENT_STATUS.RESOLVED,
              resolutionSummary: incident.resolutionSummary || resolutionSummary
            }
          },
          actor
        );

        resolvedComplaints.push({
          complaintId: complaint.id,
          previousStatus: complaint.status,
          newStatus: COMPLAINT_STATUS.RESOLVED
        });
      } catch (err) {
        failedComplaints.push({
          complaintId,
          error: err.message
        });
      }
    }

    const resolvedCount = resolvedComplaints.length;
    const skippedCount = skippedComplaints.length;
    const failedCount = failedComplaints.length;
    const hasFailures = failedCount > 0;
    const hasSkips = skippedCount > 0;
    const hasResolved = resolvedCount > 0;

    const partialSuccess = (hasFailures && hasResolved) || (hasSkips && hasResolved);
    const requiresReconciliation = hasFailures;

    let consistencyNote;
    if (hasFailures) {
      consistencyNote = 'Propagation encountered update failures. System is in a partially updated state and reconciliation is required to synchronize incident and complaint statuses.';
    } else if (hasSkips && hasResolved) {
      consistencyNote = 'Some linked complaints were skipped because their current lifecycle states do not permit transition or individual remediation was not established. Resolved complaints were updated successfully.';
    } else if (hasSkips && !hasResolved) {
      consistencyNote = 'No linked complaints were resolved because all linked complaints were skipped (individual remediation not established or non-transitionable lifecycle states).';
    } else if (totalAttempted === 0) {
      consistencyNote = 'No linked complaints were associated with this incident to propagate resolution to.';
    } else {
      consistencyNote = 'All linked complaints were successfully transitioned to RESOLVED.';
    }

    return {
      attempted: totalAttempted,
      resolvedCount,
      skippedCount,
      failedCount,
      resolvedComplaints,
      skippedComplaints,
      failedComplaints,
      partialSuccess,
      requiresReconciliation,
      consistencyNote
    };
  }

  // =========================================================================
  // 2. Subtask Operations: Create, Retrieve, Update, and Status Transitions
  // =========================================================================

  /**
   * Create a new subtask attached to a parent incident.
   *
   * @param {Object} subtaskData - Subtask attributes
   * @param {Object} actor - Initiating officer or admin
   * @returns {Promise<Object>} Created subtask
   */
  async createSubtask(subtaskData, actor = null) {
    if (!subtaskData || typeof subtaskData !== 'object') {
      const err = new Error('Subtask data must be a valid object');
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const incidentId = typeof subtaskData.incidentId === 'string' ? subtaskData.incidentId.trim() : '';
    if (!incidentId) {
      const err = new Error("Subtask 'incidentId' is required");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    // Existence check for parent incident
    const parentIncident = await this.incidentRepo.findById(incidentId);
    if (!parentIncident) {
      const err = new Error(`Parent incident '${incidentId}' does not exist`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Do not permit adding subtasks to closed incidents
    if (isTerminalIncidentStatus(parentIncident.status)) {
      const err = new Error(
        `Cannot create subtask for incident '${incidentId}' in terminal status '${parentIncident.status}'`
      );
      err.status = 400;
      err.code = 'TERMINAL_INCIDENT';
      throw err;
    }

    const title = typeof subtaskData.title === 'string' ? subtaskData.title.trim() : '';
    if (!title || title.length < 3) {
      const err = new Error("Subtask 'title' is required and must be at least 3 characters");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const department = typeof subtaskData.department === 'string' ? subtaskData.department.trim() : '';
    if (!department) {
      const err = new Error("Subtask 'department' is required");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    // Validate department against authoritative registry
    await this._assertValidDepartment(department, 'subtask department');

    // Authority: parent incident lead department, assigned subtask department, or admin
    this._assertDepartmentAuthority(
      actor,
      [parentIncident.leadDepartment, department],
      'create subtask on this incident'
    );

    // If optional complaintId is specified, check that the complaint exists
    if (subtaskData.complaintId) {
      const complaint = await this.complaintRepo.findById(subtaskData.complaintId);
      if (!complaint) {
        const err = new Error(`Associated complaint '${subtaskData.complaintId}' does not exist`);
        err.status = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
    }

    const status = subtaskData.status || SUBTASK_STATUS.PENDING;
    if (!Object.values(SUBTASK_STATUS).includes(status)) {
      const err = new Error(
        `Invalid initial subtask status '${status}'. Allowed: ${Object.values(SUBTASK_STATUS).join(', ')}`
      );
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const officer = subtaskData.assignedOfficerId || subtaskData.officerId || null;

    const payload = {
      ...subtaskData,
      incidentId,
      title,
      department,
      status,
      assignedOfficerId: officer,
      officerId: officer,
      remarks: typeof subtaskData.remarks === 'string' ? subtaskData.remarks.trim() : ''
    };

    const createdSubtask = await this.subtaskRepo.create(payload);

    // Auto-sync participating departments on the parent incident
    if (
      Array.isArray(parentIncident.participatingDepartments) &&
      !parentIncident.participatingDepartments.includes(department)
    ) {
      const updatedParticipating = Array.from(new Set([
        ...parentIncident.participatingDepartments,
        department
      ]));
      await this.incidentRepo.update(parentIncident.id, {
        participatingDepartments: updatedParticipating
      });
    }

    await this._logAudit(
      'SUBTASK_CREATED',
      createdSubtask.id,
      {
        incidentId,
        department,
        title,
        status: createdSubtask.status
      },
      actor
    );

    return createdSubtask;
  }

  /**
   * Retrieve subtask by ID.
   */
  async getSubtaskById(id, actor = null) {
    if (!id) return null;
    return this.subtaskRepo.findById(id);
  }

  /**
   * Filter and list subtasks.
   */
  async listSubtasks(filters = {}, actor = null) {
    return this.subtaskRepo.findAll(filters);
  }

  /**
   * Update subtask status with transition matrix validation.
   *
   * @param {string} id - Subtask ID
   * @param {Object} options - Transition payload
   * @param {string} options.status - Target status
   * @param {string} [options.remarks] - Update remarks
   * @param {Object} actor - Initiating officer or admin
   * @returns {Promise<Object>} Updated subtask
   */
  async updateSubtaskStatus(id, { status, remarks = '' } = {}, actor = null) {
    if (!id) {
      const err = new Error("Subtask 'id' is required");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    if (!status || !Object.values(SUBTASK_STATUS).includes(status)) {
      const err = new Error(
        `Invalid subtask status '${status}'. Allowed: ${Object.values(SUBTASK_STATUS).join(', ')}`
      );
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const subtask = await this.subtaskRepo.findById(id);
    if (!subtask) {
      const err = new Error(`Subtask '${id}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const parentIncident = await this.incidentRepo.findById(subtask.incidentId);

    // Authority: assigned subtask department, parent incident lead department, or admin
    this._assertDepartmentAuthority(
      actor,
      [subtask.department, parentIncident?.leadDepartment],
      'update subtask status'
    );

    const transition = validateSubtaskStatusTransition(subtask.status, status);
    if (!transition.valid) {
      const err = new Error(
        `Invalid subtask status transition from '${subtask.status}' to '${status}'. Allowed: ${transition.allowed.join(', ') || 'None (Terminal state)'}`
      );
      err.status = 400;
      err.code = 'INVALID_TRANSITION';
      throw err;
    }

    const updatePayload = {
      status,
      remarks: typeof remarks === 'string' ? remarks.trim() : subtask.remarks
    };

    if (status === SUBTASK_STATUS.COMPLETED && !subtask.completedAt) {
      updatePayload.completedAt = new Date().toISOString();
    }

    const updated = await this.subtaskRepo.update(id, updatePayload);

    await this._logAudit(
      'SUBTASK_STATUS_UPDATED',
      id,
      {
        incidentId: subtask.incidentId,
        previousStatus: subtask.status,
        newStatus: status,
        remarks: updatePayload.remarks
      },
      actor
    );

    return updated;
  }

  /**
   * General update of subtask properties (officer, due date, remarks).
   */
  async updateSubtask(id, updateData = {}, actor = null) {
    if (!id) {
      const err = new Error("Subtask 'id' is required");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const subtask = await this.subtaskRepo.findById(id);
    if (!subtask) {
      const err = new Error(`Subtask '${id}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const parentIncident = await this.incidentRepo.findById(subtask.incidentId);

    // Authority check
    this._assertDepartmentAuthority(
      actor,
      [subtask.department, parentIncident?.leadDepartment],
      'update subtask'
    );

    if (updateData.status && updateData.status !== subtask.status) {
      return this.updateSubtaskStatus(id, updateData, actor);
    }

    // Defense in depth: ensure immutable fields (department, id, incidentId, createdAt) cannot be mutated
    const {
      department: _ignoredDept,
      id: _ignoredId,
      incidentId: _ignoredIncId,
      createdAt: _ignoredCreatedAt,
      ...sanitizedUpdateData
    } = updateData;

    const updated = await this.subtaskRepo.update(id, sanitizedUpdateData);

    await this._logAudit(
      'SUBTASK_UPDATED',
      id,
      {
        incidentId: subtask.incidentId,
        fieldsUpdated: Object.keys(sanitizedUpdateData)
      },
      actor
    );

    return updated;
  }

  // =========================================================================
  // 3. Complaint-to-Incident Linking & Unlinking (with Conflict & Failure Compensation)
  // =========================================================================

  /**
   * Safely link a complaint to an incident.
   *
   * Enforces:
   * 1. Role & Department authorization: incident lead department, complaint department, or admin.
   * 2. Existence checks on both parent incident and complaint.
   * 3. Rule 5: Rejects linking if the complaint is already assigned to a DIFFERENT
   *    incident (throwing 409 Conflict) unless an explicit transfer is requested.
   * 4. Idempotency: Re-linking to the same incident succeeds without duplication.
   * 5. Rule 4: Cross-repository compensation rollback if the secondary write fails.
   *    If compensation rollback ALSO fails, surfaces a structured critical consistency error.
   *
   * @param {string} incidentId - Parent incident ID
   * @param {string} complaintId - Complaint ID or reference
   * @param {Object} actor - Initiating officer or admin
   * @param {string} [remarks] - Linkage audit remarks
   * @returns {Promise<{incident: Object, complaint: Object, alreadyLinked: boolean}>}
   */
  async linkComplaintToIncident(incidentId, complaintId, actor = null, remarks = '') {
    if (!incidentId || !complaintId) {
      const err = new Error("Both 'incidentId' and 'complaintId' are required for linking");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    // 1. Existence checks
    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) {
      const err = new Error(`Parent incident '${incidentId}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const complaint = await this.complaintRepo.findById(complaintId);
    if (!complaint) {
      const err = new Error(`Complaint '${complaintId}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 2. Department & Role Authorization: incident lead department, complaint department, or admin
    this._assertDepartmentAuthority(
      actor,
      [incident.leadDepartment, complaint.departmentId || complaint.department],
      'link complaint to incident'
    );

    // 3. Conflict handling (Rule 5)
    if (
      complaint.incidentId &&
      String(complaint.incidentId).trim().toLowerCase() !== String(incident.id).trim().toLowerCase()
    ) {
      const err = new Error(
        `Complaint '${complaint.id || complaintId}' is already linked to parent incident '${complaint.incidentId}'. Cross-incident reassignment requires an explicit transfer operation.`
      );
      err.status = 409;
      err.code = 'CONFLICT';
      err.existingIncidentId = complaint.incidentId;
      throw err;
    }

    // 4. Idempotency check: already linked to this exact incident
    const canonicalComplaintId = complaint.id || complaintId;
    const isAlreadyInIncident =
      Array.isArray(incident.linkedComplaints) &&
      incident.linkedComplaints.some(c => String(c).toLowerCase() === String(canonicalComplaintId).toLowerCase());
    const isAlreadyInComplaint =
      complaint.incidentId &&
      String(complaint.incidentId).toLowerCase() === String(incident.id).toLowerCase();

    if (isAlreadyInIncident && isAlreadyInComplaint) {
      return {
        incident,
        complaint,
        alreadyLinked: true
      };
    }

    // 5. Cross-repository dual-write with safe compensation rollback (Rule 4)
    // Step 5A: Mutate incident's linkedComplaints list first
    const updatedIncident = await this.incidentRepo.linkComplaint(incident.id, canonicalComplaintId);

    // Step 5B: Mutate complaint's incidentId
    let updatedComplaint;
    const linkRemarks = remarks
      ? `${remarks} (Incident: ${incident.id})`
      : `Linked to parent incident ${incident.id}`;

    try {
      // Canonicalize actorType to the statusHistory enum ['CITIZEN', 'OFFICER', 'SYSTEM'].
      // Admin and officer roles are both privileged human actors → 'OFFICER'.
      // Raw role strings such as 'admin' or 'officer' must never be persisted directly.
      const linkActorType = (actor?.role === 'citizen') ? 'CITIZEN'
        : (actor?.role === 'SYSTEM' || !actor) ? 'SYSTEM'
        : 'OFFICER';
      updatedComplaint = await this.complaintRepo.linkIncident(canonicalComplaintId, {
        incidentId: incident.id,
        actorType: linkActorType,
        remarks: linkRemarks
      });
    } catch (complaintError) {
      // Safe Compensation Rollback:
      // Since secondary write failed, compensate by undoing the primary mutation on the incident!
      try {
        await this.incidentRepo.unlinkComplaint(incident.id, canonicalComplaintId);
      } catch (compensationError) {
        console.error(
          `[CRITICAL COMPENSATION FAILURE] Rollback unlinking complaint ${canonicalComplaintId} from incident ${incident.id} failed:`,
          compensationError
        );
        const criticalError = new Error(
          `[CRITICAL_CONSISTENCY_ERROR] Dual-write compensation failed while linking complaint '${canonicalComplaintId}' to incident '${incident.id}'. ` +
          `Primary incident update succeeded, secondary complaint update failed (${complaintError.message}), ` +
          `and compensating rollback also failed (${compensationError.message}). Manual reconciliation required.`
        );
        criticalError.status = 500;
        criticalError.code = 'CRITICAL_CONSISTENCY_FAILURE';
        criticalError.details = {
          operation: 'LINK_COMPLAINT',
          incidentId: incident.id,
          complaintId: canonicalComplaintId,
          secondaryError: complaintError.message,
          compensationError: compensationError.message,
          requiresReconciliation: true,
          timestamp: new Date().toISOString()
        };
        await this._logAudit(
          'CRITICAL_COMPENSATION_FAILURE',
          incident.id,
          criticalError.details,
          actor
        );
        throw criticalError;
      }
      throw complaintError;
    }

    // Step 5C: Synchronize incident's participating departments if complaint brings a new department
    const complaintDept = complaint.departmentId || complaint.department;
    if (
      complaintDept &&
      Array.isArray(updatedIncident.participatingDepartments) &&
      !updatedIncident.participatingDepartments.includes(complaintDept)
    ) {
      const newDepts = Array.from(new Set([...updatedIncident.participatingDepartments, complaintDept]));
      await this.incidentRepo.update(incident.id, { participatingDepartments: newDepts });
    }

    await this._logAudit(
      'COMPLAINT_LINKED_TO_INCIDENT',
      incident.id,
      {
        incidentId: incident.id,
        complaintId: canonicalComplaintId,
        remarks: remarks || `Linked complaint ${canonicalComplaintId} to incident ${incident.id}`
      },
      actor
    );

    return {
      incident: await this.incidentRepo.findById(incident.id),
      complaint: updatedComplaint,
      alreadyLinked: false
    };
  }

  /**
   * Safely unlink a complaint from an incident.
   *
   * @param {string} incidentId - Parent incident ID
   * @param {string} complaintId - Complaint ID or reference
   * @param {Object} actor - Initiating officer or admin
   * @param {string} [remarks] - Unlinkage audit remarks
   * @returns {Promise<{incident: Object, complaint: Object, alreadyUnlinked: boolean}>}
   */
  async unlinkComplaintFromIncident(incidentId, complaintId, actor = null, remarks = '') {
    if (!incidentId || !complaintId) {
      const err = new Error("Both 'incidentId' and 'complaintId' are required for unlinking");
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) {
      const err = new Error(`Parent incident '${incidentId}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const complaint = await this.complaintRepo.findById(complaintId);
    if (!complaint) {
      const err = new Error(`Complaint '${complaintId}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Department & Role Authorization: incident lead department, complaint department, or admin
    this._assertDepartmentAuthority(
      actor,
      [incident.leadDepartment, complaint.departmentId || complaint.department],
      'unlink complaint from incident'
    );

    const canonicalComplaintId = complaint.id || complaintId;
    const isLinkedToIncident =
      Array.isArray(incident.linkedComplaints) &&
      incident.linkedComplaints.some(c => String(c).toLowerCase() === String(canonicalComplaintId).toLowerCase());
    const isLinkedOnComplaint =
      complaint.incidentId &&
      String(complaint.incidentId).toLowerCase() === String(incident.id).toLowerCase();

    // Idempotent: already unlinked from this incident
    if (!isLinkedToIncident && !isLinkedOnComplaint) {
      return {
        incident,
        complaint,
        alreadyUnlinked: true
      };
    }

    // Cross-repository dual-write with safe compensation
    // Step A: Remove complaint from incident list first
    const updatedIncident = await this.incidentRepo.unlinkComplaint(incident.id, canonicalComplaintId);

    // Step B: Clear incidentId from complaint
    let updatedComplaint;
    const unlinkRemarks = remarks
      ? `${remarks} (Incident: ${incident.id})`
      : `Unlinked from parent incident ${incident.id}`;

    try {
      // Canonicalize actorType to the statusHistory enum ['CITIZEN', 'OFFICER', 'SYSTEM'].
      const unlinkActorType = (actor?.role === 'citizen') ? 'CITIZEN'
        : (actor?.role === 'SYSTEM' || !actor) ? 'SYSTEM'
        : 'OFFICER';
      updatedComplaint = await this.complaintRepo.unlinkIncident(canonicalComplaintId, {
        actorType: unlinkActorType,
        remarks: unlinkRemarks
      });
    } catch (complaintError) {
      // Safe Compensation Rollback:
      // Re-link complaint back into incident
      try {
        await this.incidentRepo.linkComplaint(incident.id, canonicalComplaintId);
      } catch (compensationError) {
        console.error(
          `[CRITICAL COMPENSATION FAILURE] Rollback re-linking complaint ${canonicalComplaintId} to incident ${incident.id} failed:`,
          compensationError
        );
        const criticalError = new Error(
          `[CRITICAL_CONSISTENCY_ERROR] Dual-write compensation failed while unlinking complaint '${canonicalComplaintId}' from incident '${incident.id}'. ` +
          `Primary incident unlink succeeded, secondary complaint unlink failed (${complaintError.message}), ` +
          `and compensating rollback also failed (${compensationError.message}). Manual reconciliation required.`
        );
        criticalError.status = 500;
        criticalError.code = 'CRITICAL_CONSISTENCY_FAILURE';
        criticalError.details = {
          operation: 'UNLINK_COMPLAINT',
          incidentId: incident.id,
          complaintId: canonicalComplaintId,
          secondaryError: complaintError.message,
          compensationError: compensationError.message,
          requiresReconciliation: true,
          timestamp: new Date().toISOString()
        };
        await this._logAudit(
          'CRITICAL_COMPENSATION_FAILURE',
          incident.id,
          criticalError.details,
          actor
        );
        throw criticalError;
      }
      throw complaintError;
    }

    await this._logAudit(
      'COMPLAINT_UNLINKED_FROM_INCIDENT',
      incident.id,
      {
        incidentId: incident.id,
        complaintId: canonicalComplaintId,
        remarks: remarks || `Unlinked complaint ${canonicalComplaintId} from incident ${incident.id}`
      },
      actor
    );

    return {
      incident: updatedIncident,
      complaint: updatedComplaint,
      alreadyUnlinked: false
    };
  }

  /**
   * Explicit, audited transfer of a complaint between two distinct incidents.
   *
   * Addresses Requirements 2 & 3:
   * - Enforces role and cross-incident authority:
   *   Admin has global transfer authority.
   *   Officers may only transfer if their department leads BOTH source and target incidents.
   *   Cross-department transfers strictly require an administrator.
   * - Requires minimum 10-character justification.
   * - Preserves all references with safe rollback.
   *
   * @param {string} fromIncidentId - Current parent incident ID
   * @param {string} toIncidentId - Target parent incident ID
   * @param {string} complaintId - Complaint ID or reference
   * @param {Object} actor - Authorizing officer or admin
   * @param {string} justification - Required transfer justification (min 10 chars)
   * @returns {Promise<Object>} Transfer result
   */
  async transferComplaintBetweenIncidents(
    fromIncidentId,
    toIncidentId,
    complaintId,
    actor,
    justification
  ) {
    if (!fromIncidentId || !toIncidentId || !complaintId) {
      const err = new Error('fromIncidentId, toIncidentId, and complaintId are required for transfer');
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    if (String(fromIncidentId).toLowerCase() === String(toIncidentId).toLowerCase()) {
      const err = new Error('Source and target incidents must be different');
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    const justText = typeof justification === 'string' ? justification.trim() : '';
    if (!justText || justText.length < 10) {
      const err = new Error('An explicit transfer justification of at least 10 characters is required');
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    // Must be officer or admin
    this._assertOfficerOrAdmin(actor, 'transfer complaint between incidents');

    const fromIncident = await this.incidentRepo.findById(fromIncidentId);
    if (!fromIncident) {
      const err = new Error(`Source incident '${fromIncidentId}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const toIncident = await this.incidentRepo.findById(toIncidentId);
    if (!toIncident) {
      const err = new Error(`Target incident '${toIncidentId}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const complaint = await this.complaintRepo.findById(complaintId);
    if (!complaint) {
      const err = new Error(`Complaint '${complaintId}' not found`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (!complaint.incidentId || complaint.incidentId.toLowerCase() !== fromIncidentId.toLowerCase()) {
      const err = new Error(
        `Complaint '${complaintId}' is not currently linked to source incident '${fromIncidentId}'`
      );
      err.status = 400;
      err.code = 'BAD_REQUEST';
      throw err;
    }

    // Verify authority over both incidents:
    // Admin has global authority. Officers must lead BOTH incidents; otherwise, require admin!
    if (actor.role === 'officer') {
      const officerDept = (actor.departmentId || '').trim().toLowerCase();
      const fromDept = (fromIncident.leadDepartment || '').trim().toLowerCase();
      const toDept = (toIncident.leadDepartment || '').trim().toLowerCase();

      if (officerDept !== fromDept || officerDept !== toDept) {
        const err = new Error(
          `Access denied: officer from department '${actor.departmentId || 'UNASSIGNED'}' is not authorized to transfer complaints between distinct lead departments ('${fromIncident.leadDepartment}' -> '${toIncident.leadDepartment}'). Cross-department transfers require administrator authorization.`
        );
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    }

    // Step 1: Unlink from source incident
    await this.unlinkComplaintFromIncident(
      fromIncidentId,
      complaintId,
      actor,
      `Transferring to incident ${toIncidentId}: ${justText}`
    );

    // Step 2: Link to target incident
    try {
      const linkResult = await this.linkComplaintToIncident(
        toIncidentId,
        complaintId,
        actor,
        `Transferred from incident ${fromIncidentId}: ${justText}`
      );

      await this._logAudit(
        'COMPLAINT_TRANSFERRED_BETWEEN_INCIDENTS',
        complaint.id,
        {
          complaintId: complaint.id,
          fromIncidentId,
          toIncidentId,
          justification: justText
        },
        actor
      );

      return {
        success: true,
        complaintId: complaint.id,
        fromIncidentId,
        toIncidentId,
        justification: justText,
        ...linkResult
      };
    } catch (linkError) {
      // If linking to target fails, compensate by re-linking back to source incident!
      try {
        await this.linkComplaintToIncident(
          fromIncidentId,
          complaintId,
          actor,
          `Rollback transfer after failure: ${linkError.message}`
        );
      } catch (rollbackError) {
        console.error(
          `[CRITICAL COMPENSATION FAILURE] Rollback re-linking complaint ${complaintId} back to ${fromIncidentId} failed:`,
          rollbackError
        );
        const criticalError = new Error(
          `[CRITICAL_CONSISTENCY_ERROR] Dual-write compensation failed during complaint transfer of '${complaint.id}' from incident '${fromIncidentId}' to '${toIncidentId}'. ` +
          `Unlink from source succeeded, link to target failed (${linkError.message}), ` +
          `and rollback re-link to source also failed (${rollbackError.message}). Manual reconciliation required.`
        );
        criticalError.status = 500;
        criticalError.code = 'CRITICAL_CONSISTENCY_FAILURE';
        criticalError.details = {
          operation: 'TRANSFER_COMPLAINT',
          complaintId: complaint.id,
          fromIncidentId,
          toIncidentId,
          secondaryError: linkError.message,
          compensationError: rollbackError.message,
          requiresReconciliation: true,
          timestamp: new Date().toISOString()
        };
        await this._logAudit(
          'CRITICAL_COMPENSATION_FAILURE',
          complaint.id,
          criticalError.details,
          actor
        );
        throw criticalError;
      }
      throw linkError;
    }
  }
}

export const incidentService = new IncidentService();
export default incidentService;
