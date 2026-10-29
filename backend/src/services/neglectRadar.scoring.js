/**
 * @file neglectRadar.scoring.js
 * @description Pure, deterministic risk scoring engine for CivicSarthi Phase 8: Neglect Radar.
 *
 * Grounded strictly in authoritative project configurations.
 * Evaluates operational risk signals across complaints, parent incidents, and subtasks.
 *
 * GUARANTEES:
 * 1. Pure function: Never mutates input entities or arguments.
 * 2. Deterministic: Given the same inputs and referenceTime, produces identical output.
 * 3. Fair normalization: Scores are normalized against evaluable signal weights; missing
 *    signals reduce data completeness rather than penalizing or artificially inflating score.
 * 4. Operational framing: Scores reflect operational bottlenecks, not accusations of misconduct.
 */

import {
  NEGLECT_ENTITY_TYPES,
  NEGLECT_RISK_LEVELS,
  NEGLECT_SIGNAL_CODES,
  SIGNAL_DEFINITIONS,
  NEGLECT_THRESHOLDS,
  TERMINAL_STATUSES,
  SUGGESTED_ACTIONS
} from '../constants/neglectRadar.constants.js';

/**
 * Validates whether an ISO timestamp or date is valid
 * @param {*} val
 * @returns {boolean}
 */
function isValidDate(val) {
  if (!val) return false;
  const d = new Date(val);
  return !Number.isNaN(d.getTime());
}

/**
 * Evaluates the neglect risk for any supported CivicSarthi entity.
 *
 * @param {Object} entity - The complaint, incident, or subtask object (treated as read-only)
 * @param {string} entityType - One of NEGLECT_ENTITY_TYPES ('COMPLAINT', 'INCIDENT', 'SUBTASK')
 * @param {Object} [options={}] - Evaluation options
 * @param {Date|string} [options.referenceTime] - Optional fixed reference timestamp for deterministic scoring
 * @param {Object} [options.slaConfig] - Optional SLA threshold override
 * @param {Array|Object} [options.dependencies] - Related entities (e.g., subtasks for incident, parent for complaint)
 * @returns {Object} Deterministic, explainable evaluation result
 */
export function evaluateEntityRisk(entity, entityType, options = {}) {
  const refTime = options.referenceTime ? new Date(options.referenceTime) : new Date();
  const slaConfig = options.slaConfig || NEGLECT_THRESHOLDS;
  const dependencies = options.dependencies || null;

  // 1. Validate entity existence and type
  if (!entity || typeof entity !== 'object') {
    return {
      entityType: entityType || null,
      entityId: null,
      title: null,
      status: null,
      departmentId: null,
      priority: null,
      isTerminal: false,
      riskScore: null,
      riskLevel: NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA,
      dataCompleteness: 0,
      reason: 'INVALID_ENTITY_PAYLOAD',
      signals: [],
      triggeredSignals: [],
      missingSignals: Object.keys(SIGNAL_DEFINITIONS),
      suggestedAction: null,
      evaluatedAt: refTime.toISOString()
    };
  }

  const validEntityType = NEGLECT_ENTITY_TYPES[entityType] || NEGLECT_ENTITY_TYPES.COMPLAINT;
  const entityId = entity.id || entity.referenceNumber || null;
  const title = entity.title || entity.description || entity.text || 'Untitled';
  const status = entity.status || null;
  const departmentId = entity.departmentId || entity.leadDepartment || null;
  const priority = entity.priority || 'MEDIUM';

  // 2. Validate essential creation timestamp
  if (!isValidDate(entity.createdAt)) {
    return {
      entityType: validEntityType,
      entityId,
      title,
      status,
      departmentId,
      priority,
      isTerminal: false,
      riskScore: null,
      riskLevel: NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA,
      dataCompleteness: 0,
      reason: 'MISSING_OR_INVALID_CREATION_DATE',
      signals: [],
      triggeredSignals: [],
      missingSignals: Object.keys(SIGNAL_DEFINITIONS),
      suggestedAction: 'Ensure case registration includes a valid creation timestamp.',
      evaluatedAt: refTime.toISOString()
    };
  }

  // 3. Validate presence of a status
  if (!status || typeof status !== 'string') {
    return {
      entityType: validEntityType,
      entityId,
      title,
      status: null,
      departmentId,
      priority,
      isTerminal: false,
      riskScore: null,
      riskLevel: NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA,
      dataCompleteness: 0,
      reason: 'MISSING_OR_INVALID_STATUS',
      signals: [],
      triggeredSignals: [],
      missingSignals: Object.keys(SIGNAL_DEFINITIONS),
      suggestedAction: 'Update case status to an official lifecycle stage.',
      evaluatedAt: refTime.toISOString()
    };
  }

  // 4. Terminal State Guard
  // Completed/Resolved cases do not receive active neglect warnings
  const terminalList = TERMINAL_STATUSES[validEntityType] || ['RESOLVED', 'CLOSED'];
  const isTerminal = terminalList.includes(status.toUpperCase());

  if (isTerminal) {
    return {
      entityType: validEntityType,
      entityId,
      title,
      status,
      departmentId,
      priority,
      isTerminal: true,
      riskScore: 0,
      riskLevel: NEGLECT_RISK_LEVELS.LOW,
      dataCompleteness: 1.0,
      signals: [],
      triggeredSignals: [],
      missingSignals: [],
      evidenceSummary: {
        elapsedDays: 0,
        daysSinceProgress: 0,
        isOverdue: false,
        isStale: false,
        isBlocked: false,
        reassignments: entity.reassignments || 0
      },
      suggestedAction: null,
      evaluatedAt: refTime.toISOString()
    };
  }

  // 5. Calculate Elapsed Durations from Authoritative Timestamps
  const createdTime = new Date(entity.createdAt);
  const elapsedDays = Math.max(0, Math.floor((refTime - createdTime) / (1000 * 60 * 60 * 24)));

  // Progress timestamp: use latest verified update or status change
  let updatedTime = createdTime;
  if (isValidDate(entity.updatedAt)) {
    updatedTime = new Date(entity.updatedAt);
  } else if (isValidDate(entity.lastUpdated)) {
    updatedTime = new Date(entity.lastUpdated);
  }
  const daysSinceProgress = Math.max(0, Math.floor((refTime - updatedTime) / (1000 * 60 * 60 * 24)));

  // 6. Evaluate Individual Risk Signals
  const evaluatedSignals = [];

  // --- Signal A: OVERDUE_SLA ---
  // Authoritative SLA resolution deadline is defined only for Complaints in sla.json
  const slaDef = SIGNAL_DEFINITIONS[NEGLECT_SIGNAL_CODES.OVERDUE_SLA];
  if (validEntityType === NEGLECT_ENTITY_TYPES.COMPLAINT) {
    const targetDays = slaConfig.COMPLAINT_SLA_DAYS;
    const isOverdue = elapsedDays > targetDays;
    const overdueDays = isOverdue ? elapsedDays - targetDays : 0;
    let points = 0;
    if (isOverdue) {
      // Points scale from 15 (initial breach) to 30 (10+ days overdue)
      points = Math.min(slaDef.maxPoints, 15 + Math.round((overdueDays / 10) * 15));
    }

    evaluatedSignals.push({
      code: slaDef.code,
      name: slaDef.name,
      isAvailable: true,
      isTriggered: isOverdue,
      points,
      maxPoints: slaDef.maxPoints,
      message: isOverdue
        ? `Authoritative resolution target exceeded by ${overdueDays} day(s) (elapsed: ${elapsedDays}d, SLA target: ${targetDays}d).`
        : `Within authoritative resolution target (${elapsedDays}d elapsed of ${targetDays}d SLA).`,
      evidence: { elapsedDays, targetDays, overdueDays }
    });
  } else {
    // For Incidents and Subtasks, no authoritative SLA target is defined in sla.json
    evaluatedSignals.push({
      code: slaDef.code,
      name: slaDef.name,
      isAvailable: false,
      isTriggered: false,
      points: 0,
      maxPoints: slaDef.maxPoints,
      message: `No authoritative SLA target configured for ${validEntityType} entity type.`,
      evidence: null
    });
  }

  // --- Signal B: STALE_PROGRESS ---
  // Stalled without meaningful advancement. Grounded in sla.json staleUpdateDays.
  // CRITICAL: Checks time since latest progress, NOT total age (prevents double-counting).
  const staleDef = SIGNAL_DEFINITIONS[NEGLECT_SIGNAL_CODES.STALE_PROGRESS];
  const staleThreshold = slaConfig.STALE_UPDATE_DAYS;
  const isStale = daysSinceProgress > staleThreshold;
  const stallDays = isStale ? daysSinceProgress - staleThreshold : 0;
  let stalePoints = 0;
  if (isStale) {
    // Points scale from 12 (initial stall) to 25 (7+ days beyond threshold)
    stalePoints = Math.min(staleDef.maxPoints, 12 + Math.round((stallDays / 7) * 13));
  }
  evaluatedSignals.push({
    code: staleDef.code,
    name: staleDef.name,
    isAvailable: true,
    isTriggered: isStale,
    points: stalePoints,
    maxPoints: staleDef.maxPoints,
    message: isStale
      ? `No recorded progress or status advancement for ${daysSinceProgress} day(s) (stale threshold: ${staleThreshold}d).`
      : `Recent operational update recorded ${daysSinceProgress} day(s) ago (within ${staleThreshold}d threshold).`,
    evidence: { daysSinceProgress, staleThreshold, stallDays }
  });

  // --- Signal C: BLOCKED_DEPENDENCY ---
  const blockedDef = SIGNAL_DEFINITIONS[NEGLECT_SIGNAL_CODES.BLOCKED_DEPENDENCY];
  let isBlocked = false;
  let blockedPoints = 0;
  let blockedMessage = 'No blocked departmental dependencies identified.';
  let blockedEvidence = null;

  if (validEntityType === NEGLECT_ENTITY_TYPES.SUBTASK) {
    if (status.toUpperCase() === 'BLOCKED') {
      isBlocked = true;
      blockedPoints = blockedDef.maxPoints;
      blockedMessage = 'Subtask is explicitly marked BLOCKED by departmental operational constraints.';
      blockedEvidence = { subtaskStatus: status };
    }
  } else if (validEntityType === NEGLECT_ENTITY_TYPES.INCIDENT) {
    // If subtasks array is passed in dependencies, check for blocked subtasks
    if (Array.isArray(dependencies)) {
      const blockedSubtasks = dependencies.filter(s => s && String(s.status).toUpperCase() === 'BLOCKED');
      if (blockedSubtasks.length > 0) {
        isBlocked = true;
        blockedPoints = blockedDef.maxPoints;
        blockedMessage = `Incident progression is constrained by ${blockedSubtasks.length} blocked departmental subtask(s).`;
        blockedEvidence = { blockedSubtasksCount: blockedSubtasks.length };
      }
    } else if (status.toUpperCase() === 'ACTION_REQUIRED') {
      isBlocked = true;
      blockedPoints = Math.round(blockedDef.maxPoints * 0.5); // 10 pts
      blockedMessage = 'Parent incident requires coordination on pending cross-department subtasks.';
      blockedEvidence = { incidentStatus: status };
    }
  } else if (validEntityType === NEGLECT_ENTITY_TYPES.COMPLAINT) {
    // Check if complaint is bound to a stalled/blocked parent incident
    if (entity.incidentId && dependencies && typeof dependencies === 'object') {
      const parent = dependencies.parentIncident || dependencies;
      if (parent && String(parent.status).toUpperCase() === 'ACTIVE' && parent.isStale) {
        isBlocked = true;
        blockedPoints = Math.round(blockedDef.maxPoints * 0.75); // 15 pts
        blockedMessage = `Linked to parent incident ${entity.incidentId} which is currently experiencing operational stalls.`;
        blockedEvidence = { parentIncidentId: entity.incidentId };
      }
    }
  }

  evaluatedSignals.push({
    code: blockedDef.code,
    name: blockedDef.name,
    isAvailable: true,
    isTriggered: isBlocked,
    points: blockedPoints,
    maxPoints: blockedDef.maxPoints,
    message: blockedMessage,
    evidence: blockedEvidence
  });

  // --- Signal D: REASSIGNMENT_LOOP ---
  // Tracks Ping-Pong between departments. Applies to complaints.
  const reassignmentDef = SIGNAL_DEFINITIONS[NEGLECT_SIGNAL_CODES.REASSIGNMENT_LOOP];
  if (validEntityType === NEGLECT_ENTITY_TYPES.COMPLAINT) {
    const hasReassignmentData = typeof entity.reassignments === 'number' || Array.isArray(entity.statusHistory);
    if (!hasReassignmentData) {
      evaluatedSignals.push({
        code: reassignmentDef.code,
        name: reassignmentDef.name,
        isAvailable: false,
        isTriggered: false,
        points: 0,
        maxPoints: reassignmentDef.maxPoints,
        message: 'Reassignment history data is unrecorded or unavailable in complaint payload.',
        evidence: null
      });
    } else {
      const threshold = slaConfig.REASSIGNMENT_THRESHOLD;
      const count = typeof entity.reassignments === 'number'
        ? entity.reassignments
        : (entity.statusHistory?.filter(h => h.action === 'REASSIGN' || h.status === 'REASSIGNED')?.length || 0);
      const isLoop = count >= threshold;
      const points = isLoop ? reassignmentDef.maxPoints : 0;

      evaluatedSignals.push({
        code: reassignmentDef.code,
        name: reassignmentDef.name,
        isAvailable: true,
        isTriggered: isLoop,
        points,
        maxPoints: reassignmentDef.maxPoints,
        message: isLoop
          ? `Grievance reassigned ${count} time(s) across departments without resolution (threshold: ${threshold}).`
          : `Reassignment count (${count}) is within normal operational limits.`,
        evidence: { reassignments: count, threshold }
      });
    }
  } else {
    evaluatedSignals.push({
      code: reassignmentDef.code,
      name: reassignmentDef.name,
      isAvailable: false,
      isTriggered: false,
      points: 0,
      maxPoints: reassignmentDef.maxPoints,
      message: `Reassignment tracking is not applicable to ${validEntityType} entities.`,
      evidence: null
    });
  }

  // --- Signal E: REOPENED_CASE ---
  // Citizen dissatisfied after resolution. Applies to complaints.
  const reopenedDef = SIGNAL_DEFINITIONS[NEGLECT_SIGNAL_CODES.REOPENED_CASE];
  if (validEntityType === NEGLECT_ENTITY_TYPES.COMPLAINT) {
    const isReopenedStatus = status.toUpperCase() === 'REOPENED';
    const hasReopenedProp = typeof entity.reopenedCount === 'number';
    const isReopened = isReopenedStatus || (hasReopenedProp && entity.reopenedCount > 0);
    const count = hasReopenedProp ? entity.reopenedCount : (isReopenedStatus ? 1 : 0);
    const points = isReopened ? reopenedDef.maxPoints : 0;

    evaluatedSignals.push({
      code: reopenedDef.code,
      name: reopenedDef.name,
      isAvailable: true,
      isTriggered: isReopened,
      points,
      maxPoints: reopenedDef.maxPoints,
      message: isReopened
        ? `Grievance was reopened following prior resolution (reopened count: ${count}).`
        : 'Grievance has not been reopened.',
      evidence: { isReopened, reopenedCount: count }
    });
  } else {
    evaluatedSignals.push({
      code: reopenedDef.code,
      name: reopenedDef.name,
      isAvailable: false,
      isTriggered: false,
      points: 0,
      maxPoints: reopenedDef.maxPoints,
      message: `Reopened tracking is not applicable to ${validEntityType} entities.`,
      evidence: null
    });
  }

  // --- Signal F: UNASSIGNED_OWNERSHIP ---
  // Genuinely observed missing departmental owner or officer vs. unrecorded ownership data.
  const unassignedDef = SIGNAL_DEFINITIONS[NEGLECT_SIGNAL_CODES.UNASSIGNED_OWNERSHIP];
  if (validEntityType === NEGLECT_ENTITY_TYPES.COMPLAINT) {
    const hasDeptField = ('departmentId' in entity) || ('department' in entity);
    if (!hasDeptField) {
      evaluatedSignals.push({
        code: unassignedDef.code,
        name: unassignedDef.name,
        isAvailable: false,
        isTriggered: false,
        points: 0,
        maxPoints: unassignedDef.maxPoints,
        message: 'Department assignment tracking data is unrecorded or unavailable in complaint payload.',
        evidence: null
      });
    } else {
      const hasDept = Boolean(departmentId && String(departmentId).trim() !== '' && departmentId !== 'UNASSIGNED');
      if (!hasDept) {
        if (elapsedDays >= slaConfig.UNASSIGNED_GRACE_DAYS) {
          evaluatedSignals.push({
            code: unassignedDef.code,
            name: unassignedDef.name,
            isAvailable: true,
            isTriggered: true,
            points: unassignedDef.maxPoints,
            message: `Active grievance has no designated responsible department after ${elapsedDays} day(s) (grace window: ${slaConfig.UNASSIGNED_GRACE_DAYS}d).`,
            evidence: { departmentId: null, elapsedDays, graceDays: slaConfig.UNASSIGNED_GRACE_DAYS }
          });
        } else {
          evaluatedSignals.push({
            code: unassignedDef.code,
            name: unassignedDef.name,
            isAvailable: true,
            isTriggered: false,
            points: 0,
            maxPoints: unassignedDef.maxPoints,
            message: `Grievance is within initial ${slaConfig.UNASSIGNED_GRACE_DAYS}-day department triage window (${elapsedDays}d elapsed).`,
            evidence: { departmentId: null, elapsedDays, graceDays: slaConfig.UNASSIGNED_GRACE_DAYS }
          });
        }
      } else {
        evaluatedSignals.push({
          code: unassignedDef.code,
          name: unassignedDef.name,
          isAvailable: true,
          isTriggered: false,
          points: 0,
          maxPoints: unassignedDef.maxPoints,
          message: `Designated responsible department is assigned (${departmentId}).`,
          evidence: { departmentId }
        });
      }
    }
  } else if (validEntityType === NEGLECT_ENTITY_TYPES.SUBTASK) {
    const hasOfficerField = ('officerId' in entity) || ('assignedToOfficerId' in entity) || ('assignedOfficerId' in entity);
    if (!hasOfficerField) {
      evaluatedSignals.push({
        code: unassignedDef.code,
        name: unassignedDef.name,
        isAvailable: false,
        isTriggered: false,
        points: 0,
        maxPoints: unassignedDef.maxPoints,
        message: 'Officer assignment tracking data is unrecorded or unavailable in subtask payload.',
        evidence: null
      });
    } else {
      const assignedOfficer = entity.officerId || entity.assignedToOfficerId || entity.assignedOfficerId || null;
      const hasOfficer = Boolean(assignedOfficer && String(assignedOfficer).trim() !== '' && assignedOfficer !== 'UNASSIGNED');
      if (!hasOfficer) {
        if (elapsedDays >= slaConfig.UNASSIGNED_GRACE_DAYS) {
          evaluatedSignals.push({
            code: unassignedDef.code,
            name: unassignedDef.name,
            isAvailable: true,
            isTriggered: true,
            points: unassignedDef.maxPoints,
            message: `Active subtask has no assigned handling officer after ${elapsedDays} day(s) (grace window: ${slaConfig.UNASSIGNED_GRACE_DAYS}d).`,
            evidence: { assignedOfficerId: null, elapsedDays, graceDays: slaConfig.UNASSIGNED_GRACE_DAYS }
          });
        } else {
          evaluatedSignals.push({
            code: unassignedDef.code,
            name: unassignedDef.name,
            isAvailable: true,
            isTriggered: false,
            points: 0,
            maxPoints: unassignedDef.maxPoints,
            message: `Subtask is within initial ${slaConfig.UNASSIGNED_GRACE_DAYS}-day officer assignment window (${elapsedDays}d elapsed).`,
            evidence: { assignedOfficerId: null, elapsedDays, graceDays: slaConfig.UNASSIGNED_GRACE_DAYS }
          });
        }
      } else {
        evaluatedSignals.push({
          code: unassignedDef.code,
          name: unassignedDef.name,
          isAvailable: true,
          isTriggered: false,
          points: 0,
          maxPoints: unassignedDef.maxPoints,
          message: `Designated handling officer is assigned (${assignedOfficer}).`,
          evidence: { assignedOfficer }
        });
      }
    }
  } else {
    // Not applicable to Incidents
    evaluatedSignals.push({
      code: unassignedDef.code,
      name: unassignedDef.name,
      isAvailable: false,
      isTriggered: false,
      points: 0,
      maxPoints: unassignedDef.maxPoints,
      message: `Ownership assignment tracking is not evaluated at ${validEntityType} level.`,
      evidence: null
    });
  }

  // 7. Score Normalization
  // Sum of maximum weights of all signals that are valid and evaluable for this entity
  const availableSignals = evaluatedSignals.filter(s => s.isAvailable);
  const totalModelWeight = Object.values(SIGNAL_DEFINITIONS).reduce((sum, s) => sum + s.maxPoints, 0); // 100
  const evaluableWeight = availableSignals.reduce((sum, s) => sum + s.maxPoints, 0);

  // Insufficient evidence check: if evaluable weight is below threshold, return INSUFFICIENT_DATA
  if (evaluableWeight < slaConfig.MIN_EVALUABLE_WEIGHT) {
    return {
      entityType: validEntityType,
      entityId,
      title,
      status,
      departmentId,
      priority,
      isTerminal: false,
      riskScore: null,
      riskLevel: NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA,
      dataCompleteness: Math.round((evaluableWeight / totalModelWeight) * 100) / 100,
      reason: 'INSUFFICIENT_EVALUABLE_SIGNALS',
      signals: evaluatedSignals,
      triggeredSignals: [],
      missingSignals: evaluatedSignals.filter(s => !s.isAvailable).map(s => s.code),
      suggestedAction: 'Collect authoritative case timeline and departmental assignment details.',
      evaluatedAt: refTime.toISOString()
    };
  }

  // Calculate normalized score as percentage of evaluable weight triggered
  const rawPointsTriggered = availableSignals.reduce((sum, s) => sum + s.points, 0);
  const normalizedScore = Math.min(100, Math.max(0, Math.round((rawPointsTriggered / evaluableWeight) * 100)));
  const dataCompleteness = Math.round((evaluableWeight / totalModelWeight) * 100) / 100;

  // Determine Risk Level
  let riskLevel = NEGLECT_RISK_LEVELS.LOW;
  const bounds = slaConfig.SCORE_BOUNDARIES;
  if (normalizedScore >= bounds.CRITICAL_MIN) {
    riskLevel = NEGLECT_RISK_LEVELS.CRITICAL;
  } else if (normalizedScore >= bounds.HIGH_MIN) {
    riskLevel = NEGLECT_RISK_LEVELS.HIGH;
  } else if (normalizedScore >= bounds.MEDIUM_MIN) {
    riskLevel = NEGLECT_RISK_LEVELS.MEDIUM;
  }

  // Determine Primary Trigger & Neutral Suggested Action
  const triggeredSignals = evaluatedSignals.filter(s => s.isTriggered);
  let suggestedAction = SUGGESTED_ACTIONS.DEFAULT;
  if (triggeredSignals.length > 0) {
    // Sort triggered signals by points descending to find primary bottleneck
    const primary = [...triggeredSignals].sort((a, b) => b.points - a.points)[0];
    suggestedAction = SUGGESTED_ACTIONS[primary.code] || SUGGESTED_ACTIONS.DEFAULT;
  }

  return {
    entityType: validEntityType,
    entityId,
    title,
    status,
    departmentId,
    priority,
    isTerminal: false,
    riskScore: normalizedScore,
    riskLevel,
    dataCompleteness,
    signals: evaluatedSignals,
    triggeredSignals,
    missingSignals: evaluatedSignals.filter(s => !s.isAvailable).map(s => s.code),
    evidence: entity.evidence || [],
    evidenceSummary: {
      elapsedDays,
      daysSinceProgress,
      isOverdue: Boolean(evaluatedSignals.find(s => s.code === NEGLECT_SIGNAL_CODES.OVERDUE_SLA)?.isTriggered),
      isStale,
      isBlocked,
      reassignments: typeof entity.reassignments === 'number' ? entity.reassignments : 0
    },
    suggestedAction,
    evaluatedAt: refTime.toISOString()
  };
}

/**
 * Convenient wrapper for complaint risk evaluation
 */
export function evaluateComplaintRisk(complaint, options = {}) {
  return evaluateEntityRisk(complaint, NEGLECT_ENTITY_TYPES.COMPLAINT, options);
}

/**
 * Convenient wrapper for incident risk evaluation
 */
export function evaluateIncidentRisk(incident, subtasks = [], options = {}) {
  return evaluateEntityRisk(incident, NEGLECT_ENTITY_TYPES.INCIDENT, {
    ...options,
    dependencies: subtasks
  });
}

/**
 * Convenient wrapper for subtask risk evaluation
 */
export function evaluateSubtaskRisk(subtask, options = {}) {
  return evaluateEntityRisk(subtask, NEGLECT_ENTITY_TYPES.SUBTASK, options);
}
