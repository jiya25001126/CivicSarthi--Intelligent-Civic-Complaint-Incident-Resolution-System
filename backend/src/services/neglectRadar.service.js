/**
 * @file neglectRadar.service.js
 * @description Orchestration service for CivicSarthi Phase 8: Neglect Radar.
 *
 * Connects the pure scoring engine to complaint, incident, and subtask data.
 * Purely read-only diagnostic service: NEVER mutates repositories, files, or audit logs.
 *
 * Guarantees:
 * 1. Strict server-enforced department scoping using req.user data (ignoring client spoofing).
 * 2. Privacy projection allowlists: strips citizen PII, credentials, private internal notes, and storage internals.
 * 3. Consistent reference time across all evaluations in a request.
 * 4. Transparent summary metrics over full filtered result set with clear scope metadata.
 * 5. Resilient error handling without masking failures or fabricating scores.
 */

import complaintRepository from '../repositories/complaint.repository.js';
import incidentRepository from '../repositories/incident.repository.js';
import subtaskRepository from '../repositories/subtask.repository.js';
import {
  evaluateComplaintRisk,
  evaluateIncidentRisk,
  evaluateSubtaskRisk
} from './neglectRadar.scoring.js';
import {
  NEGLECT_ENTITY_TYPES,
  NEGLECT_RISK_LEVELS,
  NEGLECT_SIGNAL_CODES,
  resolveRadarAccessScope
} from '../constants/neglectRadar.constants.js';

/**
 * Projects a raw evaluated neglect entity into an allowlisted safe response object.
 * Strictly excludes citizen PII (phone, email, citizenId), credentials, private notes,
 * and storage internals.
 *
 * @param {Object} evaluatedItem - Result from evaluate*Risk scoring engine
 * @returns {Object} Safe projected operational item
 */
export function projectSafeRadarItem(evaluatedItem) {
  if (!evaluatedItem || typeof evaluatedItem !== 'object') {
    return null;
  }

  return {
    entityType: evaluatedItem.entityType,
    entityId: evaluatedItem.entityId,
    title: evaluatedItem.title,
    status: evaluatedItem.status,
    priority: evaluatedItem.priority || 'MEDIUM',
    departmentId: evaluatedItem.departmentId || null,
    isTerminal: Boolean(evaluatedItem.isTerminal),
    riskScore: evaluatedItem.riskScore,
    riskLevel: evaluatedItem.riskLevel,
    dataCompleteness: evaluatedItem.dataCompleteness,
    evidenceSummary: evaluatedItem.evidenceSummary || null,
    signals: evaluatedItem.signals || [],
    triggeredSignals: evaluatedItem.triggeredSignals || [],
    missingSignals: evaluatedItem.missingSignals || [],
    suggestedAction: evaluatedItem.suggestedAction || null,
    evaluatedAt: evaluatedItem.evaluatedAt
  };
}

/**
 * Validates whether an entity is authorized for viewing by the authenticated scope.
 *
 * @param {Object} entity
 * @param {string} entityType - 'COMPLAINT' | 'INCIDENT' | 'SUBTASK'
 * @param {Object} accessScope - Result from resolveRadarAccessScope
 * @returns {boolean}
 */
export function isEntityAuthorized(entity, entityType, accessScope) {
  if (!accessScope.authorized) {
    return false;
  }

  // Admins with unrestricted scope see all departments
  if (accessScope.isUnrestricted && !accessScope.effectiveDepartmentId) {
    return true;
  }

  const targetDept = accessScope.effectiveDepartmentId;
  if (!targetDept) {
    return false;
  }

  if (entityType === NEGLECT_ENTITY_TYPES.COMPLAINT) {
    const dept = entity.departmentId || entity.department || null;
    return dept === targetDept;
  }

  if (entityType === NEGLECT_ENTITY_TYPES.INCIDENT) {
    const leadDept = entity.leadDepartment || null;
    const participating = Array.isArray(entity.participatingDepartments)
      ? entity.participatingDepartments
      : [];
    return leadDept === targetDept || participating.includes(targetDept);
  }

  if (entityType === NEGLECT_ENTITY_TYPES.SUBTASK) {
    const dept = entity.department || null;
    return dept === targetDept;
  }

  return false;
}

/**
 * Service class for Neglect Radar supervisory triage
 */
export class NeglectRadarService {
  constructor(deps = {}) {
    this.complaintRepository = deps.complaintRepository || complaintRepository;
    this.incidentRepository = deps.incidentRepository || incidentRepository;
    this.subtaskRepository = deps.subtaskRepository || subtaskRepository;
  }

  /**
   * Retrieves evaluated neglect radar items with filtering, summary metrics, and pagination.
   *
   * @param {Object} filters - Query filters
   * @param {string} [filters.entityType='ALL'] - 'ALL' | 'COMPLAINT' | 'INCIDENT' | 'SUBTASK'
   * @param {string} [filters.riskLevel='ALL'] - 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA'
   * @param {string} [filters.departmentId] - Department ID (honored only for admin)
   * @param {string} [filters.search] - Case-insensitive text search
   * @param {string} [filters.signalCode] - Filter by specific triggered signal
   * @param {string} [filters.sort='riskScore_desc'] - Sort field and order
   * @param {number} [filters.page=1] - Page number (1-based)
   * @param {number} [filters.limit=20] - Page size
   * @param {boolean} [filters.includeTerminal=false] - Whether to include closed/resolved records
   * @param {Object} user - Authenticated user from req.user
   * @param {Date|string} [options.referenceTime] - Optional reference time for determinism
   * @returns {Promise<Object>} Safe projected response with items, summary, and pagination
   */
  async getNeglectRadar(filters = {}, user, options = {}) {
    // 1. Enforce Server-Side Department Authorization Scope
    const accessScope = resolveRadarAccessScope(user, filters);
    if (!accessScope.authorized) {
      const err = new Error(accessScope.error || 'Access denied');
      err.status = accessScope.statusCode || 403;
      throw err;
    }

    // Capture single consistent reference timestamp for all evaluations in this request
    const referenceTime = options.referenceTime ? new Date(options.referenceTime) : new Date();
    const evalOptions = { referenceTime };

    const requestedType = (filters.entityType || 'ALL').toUpperCase();
    const requestedRisk = (filters.riskLevel || 'ALL').toUpperCase();
    const requestedSignal = filters.signalCode ? filters.signalCode.toUpperCase() : null;
    const includeTerminal = Boolean(filters.includeTerminal);
    const search = filters.search ? filters.search.trim().toLowerCase() : null;

    // Track status of data sources for partial-failure transparency
    const sources = {
      complaints: { ok: true, count: 0, error: null },
      incidents: { ok: true, count: 0, error: null },
      subtasks: { ok: true, count: 0, error: null }
    };

    let rawComplaints = [];
    let rawIncidents = [];
    let rawSubtasks = [];

    // 2. Fetch Entities Concurrently Through Existing Repositories
    const compRepo = this?.complaintRepository || complaintRepository;
    const incRepo = this?.incidentRepository || incidentRepository;
    const subRepo = this?.subtaskRepository || subtaskRepository;

    // Fetch Complaints if applicable
    if (requestedType === 'ALL' || requestedType === NEGLECT_ENTITY_TYPES.COMPLAINT) {
      try {
        const repoFilters = {};
        if (accessScope.effectiveDepartmentId) {
          repoFilters.departmentId = accessScope.effectiveDepartmentId;
        }
        const res = await compRepo.findAll(repoFilters);
        rawComplaints = Array.isArray(res) ? res : (res?.items || []);
        sources.complaints.count = rawComplaints.length;
      } catch (err) {
        sources.complaints.ok = false;
        sources.complaints.error = err.message || 'Failed to fetch complaints';
        if (requestedType === NEGLECT_ENTITY_TYPES.COMPLAINT) {
          const serviceErr = new Error(`Complaints repository unavailable: ${err.message}`);
          serviceErr.status = 503;
          throw serviceErr;
        }
      }
    }

    // Fetch Incidents if applicable
    if (requestedType === 'ALL' || requestedType === NEGLECT_ENTITY_TYPES.INCIDENT) {
      try {
        const repoFilters = {};
        if (accessScope.effectiveDepartmentId) {
          repoFilters.leadDepartment = accessScope.effectiveDepartmentId;
        }
        const res = await incRepo.findAll(repoFilters);
        rawIncidents = Array.isArray(res) ? res : (res?.items || []);
        sources.incidents.count = rawIncidents.length;
      } catch (err) {
        sources.incidents.ok = false;
        sources.incidents.error = err.message || 'Failed to fetch incidents';
        if (requestedType === NEGLECT_ENTITY_TYPES.INCIDENT) {
          const serviceErr = new Error(`Incidents repository unavailable: ${err.message}`);
          serviceErr.status = 503;
          throw serviceErr;
        }
      }
    }

    // Fetch Subtasks (needed for incident evaluation dependencies and/or subtask radar)
    try {
      const repoFilters = {};
      if (accessScope.effectiveDepartmentId && requestedType === NEGLECT_ENTITY_TYPES.SUBTASK) {
        repoFilters.department = accessScope.effectiveDepartmentId;
      }
      const res = await subRepo.findAll(repoFilters);
      rawSubtasks = Array.isArray(res) ? res : (res?.items || []);
      sources.subtasks.count = rawSubtasks.length;
    } catch (err) {
      sources.subtasks.ok = false;
      sources.subtasks.error = err.message || 'Failed to fetch subtasks';
      if (requestedType === NEGLECT_ENTITY_TYPES.SUBTASK) {
        const serviceErr = new Error(`Subtasks repository unavailable: ${err.message}`);
        serviceErr.status = 503;
        throw serviceErr;
      }
    }

    // 3. Evaluate Risk for Each Authorized Entity
    const evaluatedItems = [];

    // Index subtasks by incidentId for incident dependency evaluation
    const subtasksByIncidentId = new Map();
    for (const sub of rawSubtasks) {
      if (sub && sub.incidentId) {
        if (!subtasksByIncidentId.has(sub.incidentId)) {
          subtasksByIncidentId.set(sub.incidentId, []);
        }
        subtasksByIncidentId.get(sub.incidentId).push(sub);
      }
    }

    // Evaluate Complaints
    if (requestedType === 'ALL' || requestedType === NEGLECT_ENTITY_TYPES.COMPLAINT) {
      for (const comp of rawComplaints) {
        if (!comp || !isEntityAuthorized(comp, NEGLECT_ENTITY_TYPES.COMPLAINT, accessScope)) {
          continue;
        }
        try {
          const evaluated = evaluateComplaintRisk(comp, evalOptions);
          if (!includeTerminal && evaluated.isTerminal) {
            continue;
          }
          evaluatedItems.push(evaluated);
        } catch {
          // Record with evaluation failure is captured as INSUFFICIENT_DATA rather than crashing
          evaluatedItems.push({
            entityType: NEGLECT_ENTITY_TYPES.COMPLAINT,
            entityId: comp.id || comp.referenceNumber || 'UNKNOWN',
            title: comp.title || 'Malformed Record',
            status: comp.status || 'UNKNOWN',
            departmentId: comp.departmentId || null,
            priority: comp.priority || 'MEDIUM',
            isTerminal: false,
            riskScore: null,
            riskLevel: NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA,
            dataCompleteness: 0,
            reason: 'EVALUATION_ERROR',
            signals: [],
            triggeredSignals: [],
            missingSignals: [],
            suggestedAction: 'Inspect complaint record for corrupted fields.',
            evaluatedAt: referenceTime.toISOString()
          });
        }
      }
    }

    // Evaluate Incidents
    if (requestedType === 'ALL' || requestedType === NEGLECT_ENTITY_TYPES.INCIDENT) {
      for (const inc of rawIncidents) {
        if (!inc || !isEntityAuthorized(inc, NEGLECT_ENTITY_TYPES.INCIDENT, accessScope)) {
          continue;
        }
        try {
          const relatedSubtasks = subtasksByIncidentId.get(inc.id) || [];
          const evaluated = evaluateIncidentRisk(inc, relatedSubtasks, evalOptions);
          if (!includeTerminal && evaluated.isTerminal) {
            continue;
          }
          evaluatedItems.push(evaluated);
        } catch {
          evaluatedItems.push({
            entityType: NEGLECT_ENTITY_TYPES.INCIDENT,
            entityId: inc.id || 'UNKNOWN',
            title: inc.title || 'Malformed Incident',
            status: inc.status || 'UNKNOWN',
            departmentId: inc.leadDepartment || null,
            priority: inc.priority || 'MEDIUM',
            isTerminal: false,
            riskScore: null,
            riskLevel: NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA,
            dataCompleteness: 0,
            reason: 'EVALUATION_ERROR',
            signals: [],
            triggeredSignals: [],
            missingSignals: [],
            suggestedAction: 'Inspect incident record for corrupted fields.',
            evaluatedAt: referenceTime.toISOString()
          });
        }
      }
    }

    // Evaluate Subtasks
    if (requestedType === 'ALL' || requestedType === NEGLECT_ENTITY_TYPES.SUBTASK) {
      for (const sub of rawSubtasks) {
        if (!sub || !isEntityAuthorized(sub, NEGLECT_ENTITY_TYPES.SUBTASK, accessScope)) {
          continue;
        }
        try {
          const evaluated = evaluateSubtaskRisk(sub, evalOptions);
          if (!includeTerminal && evaluated.isTerminal) {
            continue;
          }
          evaluatedItems.push(evaluated);
        } catch {
          evaluatedItems.push({
            entityType: NEGLECT_ENTITY_TYPES.SUBTASK,
            entityId: sub.id || 'UNKNOWN',
            title: sub.title || 'Malformed Subtask',
            status: sub.status || 'UNKNOWN',
            departmentId: sub.department || null,
            priority: 'MEDIUM',
            isTerminal: false,
            riskScore: null,
            riskLevel: NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA,
            dataCompleteness: 0,
            reason: 'EVALUATION_ERROR',
            signals: [],
            triggeredSignals: [],
            missingSignals: [],
            suggestedAction: 'Inspect subtask record for corrupted fields.',
            evaluatedAt: referenceTime.toISOString()
          });
        }
      }
    }

    // 4. Apply Filters (Risk Level, Search, Signal Code)
    let filteredItems = evaluatedItems;

    if (requestedRisk !== 'ALL') {
      filteredItems = filteredItems.filter(item => item.riskLevel === requestedRisk);
    }

    if (requestedSignal) {
      filteredItems = filteredItems.filter(item =>
        Array.isArray(item.triggeredSignals) &&
        item.triggeredSignals.some(s => s.code === requestedSignal)
      );
    }

    if (search) {
      filteredItems = filteredItems.filter(item => {
        const idMatch = item.entityId ? item.entityId.toLowerCase().includes(search) : false;
        const titleMatch = item.title ? item.title.toLowerCase().includes(search) : false;
        return idMatch || titleMatch;
      });
    }

    // 5. Compute Full-Result-Set Summary Metrics (BEFORE Pagination)
    const summary = {
      scope: 'FULL_FILTERED_RESULT_SET',
      totalFlagged: filteredItems.length,
      criticalCount: filteredItems.filter(i => i.riskLevel === NEGLECT_RISK_LEVELS.CRITICAL).length,
      highCount: filteredItems.filter(i => i.riskLevel === NEGLECT_RISK_LEVELS.HIGH).length,
      mediumCount: filteredItems.filter(i => i.riskLevel === NEGLECT_RISK_LEVELS.MEDIUM).length,
      lowCount: filteredItems.filter(i => i.riskLevel === NEGLECT_RISK_LEVELS.LOW).length,
      insufficientDataCount: filteredItems.filter(i => i.riskLevel === NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA).length,
      overdueSlaCount: filteredItems.filter(i => i.triggeredSignals?.some(s => s.code === NEGLECT_SIGNAL_CODES.OVERDUE_SLA)).length,
      staleProgressCount: filteredItems.filter(i => i.triggeredSignals?.some(s => s.code === NEGLECT_SIGNAL_CODES.STALE_PROGRESS)).length,
      blockedDependencyCount: filteredItems.filter(i => i.triggeredSignals?.some(s => s.code === NEGLECT_SIGNAL_CODES.BLOCKED_DEPENDENCY)).length,
      reassignmentLoopCount: filteredItems.filter(i => i.triggeredSignals?.some(s => s.code === NEGLECT_SIGNAL_CODES.REASSIGNMENT_LOOP)).length,
      reopenedCount: filteredItems.filter(i => i.triggeredSignals?.some(s => s.code === NEGLECT_SIGNAL_CODES.REOPENED_CASE)).length,
      unassignedOwnershipCount: filteredItems.filter(i => i.triggeredSignals?.some(s => s.code === NEGLECT_SIGNAL_CODES.UNASSIGNED_OWNERSHIP)).length
    };

    // 6. Deterministic Sorting
    const sortField = filters.sort || 'riskScore_desc';
    filteredItems.sort((a, b) => {
      if (sortField === 'riskScore_desc') {
        const scoreA = typeof a.riskScore === 'number' ? a.riskScore : -1;
        const scoreB = typeof b.riskScore === 'number' ? b.riskScore : -1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (a.entityId || '').localeCompare(b.entityId || '');
      }
      if (sortField === 'riskScore_asc') {
        const scoreA = typeof a.riskScore === 'number' ? a.riskScore : 101;
        const scoreB = typeof b.riskScore === 'number' ? b.riskScore : 101;
        if (scoreA !== scoreB) return scoreA - scoreB;
        return (a.entityId || '').localeCompare(b.entityId || '');
      }
      if (sortField === 'createdAt_desc') {
        return (b.evidenceSummary?.elapsedDays || 0) - (a.evidenceSummary?.elapsedDays || 0);
      }
      if (sortField === 'createdAt_asc') {
        return (a.evidenceSummary?.elapsedDays || 0) - (b.evidenceSummary?.elapsedDays || 0);
      }
      if (sortField === 'updatedAt_desc') {
        return (a.evidenceSummary?.daysSinceProgress || 0) - (b.evidenceSummary?.daysSinceProgress || 0);
      }
      return 0;
    });

    // 7. Validated Pagination
    const page = Math.max(1, parseInt(filters.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit || '20', 10)));
    const total = filteredItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pagedItems = filteredItems.slice(startIndex, startIndex + limit);

    // 8. Privacy Projection (Allowlisting)
    const projectedItems = pagedItems.map(item => projectSafeRadarItem(item)).filter(Boolean);

    const isPartial = Object.values(sources).some(s => !s.ok);

    return {
      items: projectedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages
      },
      summary,
      filtersApplied: {
        entityType: requestedType,
        riskLevel: requestedRisk,
        departmentId: accessScope.effectiveDepartmentId || null,
        search: search || null,
        signalCode: requestedSignal,
        sort: sortField,
        includeTerminal
      },
      sources,
      isPartial,
      evaluatedAt: referenceTime.toISOString()
    };
  }

  /**
   * Retrieves single neglect radar item with strict authorization and privacy projection.
   *
   * @param {string} entityType - 'COMPLAINT' | 'INCIDENT' | 'SUBTASK'
   * @param {string} id - Entity ID
   * @param {Object} user - Authenticated user
   * @param {Object} [options={}] - Options (e.g. referenceTime)
   * @returns {Promise<Object>} Projected safe radar item
   */
  async getNeglectRadarItem(entityType, id, user, options = {}) {
    const accessScope = resolveRadarAccessScope(user);
    if (!accessScope.authorized) {
      const err = new Error(accessScope.error || 'Access denied');
      err.status = accessScope.statusCode || 403;
      throw err;
    }

    if (!id || typeof id !== 'string') {
      const err = new Error('Entity ID is required');
      err.status = 400;
      throw err;
    }

    const type = entityType.toUpperCase();
    const referenceTime = options.referenceTime ? new Date(options.referenceTime) : new Date();
    const evalOptions = { referenceTime };

    const compRepo = this?.complaintRepository || complaintRepository;
    const incRepo = this?.incidentRepository || incidentRepository;
    const subRepo = this?.subtaskRepository || subtaskRepository;

    let entity = null;
    let evaluated = null;

    if (type === NEGLECT_ENTITY_TYPES.COMPLAINT) {
      entity = await compRepo.findById(id);
      if (!entity) {
        const notFound = new Error('Grievance record not found');
        notFound.status = 404;
        throw notFound;
      }
      if (!isEntityAuthorized(entity, NEGLECT_ENTITY_TYPES.COMPLAINT, accessScope)) {
        // Fail closed: do not expose existence of out-of-scope record
        const notFound = new Error('Grievance record not found');
        notFound.status = 404;
        throw notFound;
      }
      evaluated = evaluateComplaintRisk(entity, evalOptions);
    } else if (type === NEGLECT_ENTITY_TYPES.INCIDENT) {
      entity = await incRepo.findById(id);
      if (!entity) {
        const notFound = new Error('Incident record not found');
        notFound.status = 404;
        throw notFound;
      }
      if (!isEntityAuthorized(entity, NEGLECT_ENTITY_TYPES.INCIDENT, accessScope)) {
        const notFound = new Error('Incident record not found');
        notFound.status = 404;
        throw notFound;
      }
      let subtasks = [];
      try {
        subtasks = await subRepo.findAll({ incidentId: entity.id });
      } catch {
        subtasks = [];
      }
      evaluated = evaluateIncidentRisk(entity, subtasks, evalOptions);
    } else if (type === NEGLECT_ENTITY_TYPES.SUBTASK) {
      entity = await subRepo.findById(id);
      if (!entity) {
        const notFound = new Error('Subtask record not found');
        notFound.status = 404;
        throw notFound;
      }
      if (!isEntityAuthorized(entity, NEGLECT_ENTITY_TYPES.SUBTASK, accessScope)) {
        const notFound = new Error('Subtask record not found');
        notFound.status = 404;
        throw notFound;
      }
      evaluated = evaluateSubtaskRisk(entity, evalOptions);
    } else {
      const invalidType = new Error(`Unsupported entity type: ${entityType}. Allowed: COMPLAINT, INCIDENT, SUBTASK`);
      invalidType.status = 400;
      throw invalidType;
    }

    return projectSafeRadarItem(evaluated);
  }
}

export const neglectRadarService = new NeglectRadarService();
export default neglectRadarService;
