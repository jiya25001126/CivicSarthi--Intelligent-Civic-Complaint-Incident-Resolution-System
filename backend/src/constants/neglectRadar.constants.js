/**
 * @file neglectRadar.constants.js
 * @description Centralized constants, risk signal definitions, thresholds, and scoring configuration
 * for CivicSarthi Phase 8: Neglect Radar & Supervisory Operational Monitoring.
 *
 * All thresholds are grounded in authoritative project configurations (sla.json / app.config.js).
 * Risk scores are explainable operational indicators, not accusations of misconduct.
 */

import config from '../config/app.config.js';

export const NEGLECT_ENTITY_TYPES = Object.freeze({
  COMPLAINT: 'COMPLAINT',
  INCIDENT: 'INCIDENT',
  SUBTASK: 'SUBTASK'
});

export const NEGLECT_RISK_LEVELS = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA'
});

export const NEGLECT_SIGNAL_CODES = Object.freeze({
  OVERDUE_SLA: 'OVERDUE_SLA',
  STALE_PROGRESS: 'STALE_PROGRESS',
  BLOCKED_DEPENDENCY: 'BLOCKED_DEPENDENCY',
  REASSIGNMENT_LOOP: 'REASSIGNMENT_LOOP',
  REOPENED_CASE: 'REOPENED_CASE',
  UNASSIGNED_OWNERSHIP: 'UNASSIGNED_OWNERSHIP'
});

/**
 * Terminal statuses by entity type.
 * Items in terminal states are excluded from active neglect alerts.
 */
export const TERMINAL_STATUSES = Object.freeze({
  COMPLAINT: Object.freeze(['RESOLVED', 'CLOSED']),
  INCIDENT: Object.freeze(['RESOLVED', 'CLOSED']),
  SUBTASK: Object.freeze(['COMPLETED', 'CANCELLED'])
});

/**
 * Signal definitions with point weights and applicability.
 * Maximum point weights total 100 for a fully evaluable entity.
 */
export const SIGNAL_DEFINITIONS = Object.freeze({
  [NEGLECT_SIGNAL_CODES.OVERDUE_SLA]: Object.freeze({
    code: NEGLECT_SIGNAL_CODES.OVERDUE_SLA,
    name: 'Overdue Service Target',
    maxPoints: 30,
    applicableEntities: [NEGLECT_ENTITY_TYPES.COMPLAINT], // Only complaints have authoritative resolutionDeadlineDays in sla.json
    description: 'Elapsed duration since registration exceeds the authoritative resolution SLA deadline.'
  }),
  [NEGLECT_SIGNAL_CODES.STALE_PROGRESS]: Object.freeze({
    code: NEGLECT_SIGNAL_CODES.STALE_PROGRESS,
    name: 'Stalled Operational Progress',
    maxPoints: 25,
    applicableEntities: [NEGLECT_ENTITY_TYPES.COMPLAINT, NEGLECT_ENTITY_TYPES.INCIDENT, NEGLECT_ENTITY_TYPES.SUBTASK],
    description: 'Active item has remained without verified status advancement or progress beyond the stale threshold.'
  }),
  [NEGLECT_SIGNAL_CODES.BLOCKED_DEPENDENCY]: Object.freeze({
    code: NEGLECT_SIGNAL_CODES.BLOCKED_DEPENDENCY,
    name: 'Blocked Dependency or Incomplete Work',
    maxPoints: 20,
    applicableEntities: [NEGLECT_ENTITY_TYPES.COMPLAINT, NEGLECT_ENTITY_TYPES.INCIDENT, NEGLECT_ENTITY_TYPES.SUBTASK],
    description: 'Subtask is blocked by departmental constraints, or incident resolution is held by unresolved subtasks.'
  }),
  [NEGLECT_SIGNAL_CODES.REASSIGNMENT_LOOP]: Object.freeze({
    code: NEGLECT_SIGNAL_CODES.REASSIGNMENT_LOOP,
    name: 'Reassignment Ping-Pong',
    maxPoints: 15,
    applicableEntities: [NEGLECT_ENTITY_TYPES.COMPLAINT], // Reassignments tracked authoritatively on complaint schema
    description: 'Item has cycled across departments multiple times without reaching decisive resolution.'
  }),
  [NEGLECT_SIGNAL_CODES.REOPENED_CASE]: Object.freeze({
    code: NEGLECT_SIGNAL_CODES.REOPENED_CASE,
    name: 'Reopened Grievance / Failed Resolution',
    maxPoints: 10,
    applicableEntities: [NEGLECT_ENTITY_TYPES.COMPLAINT],
    description: 'Grievance was previously closed or resolved but reopened by citizen, requiring supervisory attention.'
  }),
  [NEGLECT_SIGNAL_CODES.UNASSIGNED_OWNERSHIP]: Object.freeze({
    code: NEGLECT_SIGNAL_CODES.UNASSIGNED_OWNERSHIP,
    name: 'Missing or Unassigned Operational Ownership',
    maxPoints: 10,
    applicableEntities: [NEGLECT_ENTITY_TYPES.COMPLAINT, NEGLECT_ENTITY_TYPES.SUBTASK],
    description: 'Active item lacks a designated departmental owner or assigned handling officer beyond initial triage window.'
  })
});

/**
 * Authoritative Thresholds grounded in project configuration
 */
export const NEGLECT_THRESHOLDS = Object.freeze({
  // Authoritative Complaint Resolution SLA (from sla.json / app.config.js)
  COMPLAINT_SLA_DAYS: config.sla?.resolutionDeadlineDays ?? 30,

  // Authoritative Stale Update Days (from sla.json / app.config.js)
  STALE_UPDATE_DAYS: config.sla?.staleUpdateDays ?? 7,

  // Authoritative Reassignment Ping-Pong Threshold (from sla.json / app.config.js)
  REASSIGNMENT_THRESHOLD: config.sla?.reassignmentLoopThreshold ?? 2,

  // Minimum days in active status before unassigned ownership triggers
  UNASSIGNED_GRACE_DAYS: 3,

  // Score boundaries (0 - 100)
  SCORE_BOUNDARIES: Object.freeze({
    CRITICAL_MIN: 75,
    HIGH_MIN: 50,
    MEDIUM_MIN: 25,
    LOW_MIN: 0
  }),

  // Minimum evaluable weight required to calculate an authoritative score
  // If evaluable signals have total maxPoints < MIN_EVALUABLE_WEIGHT, return INSUFFICIENT_DATA.
  MIN_EVALUABLE_WEIGHT: 35
});

/**
 * Suggested next actions based on primary detected signal
 */
export const SUGGESTED_ACTIONS = Object.freeze({
  [NEGLECT_SIGNAL_CODES.OVERDUE_SLA]: 'Schedule immediate nodal officer review to accelerate delayed case resolution.',
  [NEGLECT_SIGNAL_CODES.STALE_PROGRESS]: 'Request an on-ground operational status update from the responsible department.',
  [NEGLECT_SIGNAL_CODES.BLOCKED_DEPENDENCY]: 'Review inter-agency dependencies to unblock stalled departmental workflows.',
  [NEGLECT_SIGNAL_CODES.REASSIGNMENT_LOOP]: 'Convene joint supervisory triage to fix permanent departmental jurisdiction.',
  [NEGLECT_SIGNAL_CODES.REOPENED_CASE]: 'Conduct quality review of previous resolution and assign dedicated grievance lead.',
  [NEGLECT_SIGNAL_CODES.UNASSIGNED_OWNERSHIP]: 'Assign designated departmental officer to commence operational remediation.',
  DEFAULT: 'Continue monitoring active grievance progression.'
});

/**
 * Resolves and enforces authorized department access scope for Neglect Radar.
 * Citizens are strictly denied (HTTP 403 / Access Denied).
 * Officers are scoped strictly to their authenticated department (server-enforced,
 * ignoring client-supplied department ID spoofing).
 * Admins have unrestricted cross-department access and may filter by any department.
 *
 * @param {Object} user - Authenticated user object from req.user
 * @param {Object} [filters={}] - Optional request filters from query
 * @returns {{ authorized: boolean, statusCode?: number, error?: string, effectiveDepartmentId?: string|null, isUnrestricted?: boolean }}
 */
export function resolveRadarAccessScope(user, filters = {}) {
  if (!user || typeof user !== 'object') {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Authentication required'
    };
  }

  if (user.role === 'citizen') {
    return {
      authorized: false,
      statusCode: 403,
      error: 'Access denied: citizen role is not authorized for supervisory monitoring'
    };
  }

  if (user.role === 'officer') {
    const userDept = user.departmentId || user.department || null;
    if (!userDept) {
      return {
        authorized: false,
        statusCode: 403,
        error: 'Access denied: officer is not assigned to a valid department'
      };
    }
    // Officer is strictly locked to authenticated department, regardless of client-supplied filter
    return {
      authorized: true,
      role: 'officer',
      effectiveDepartmentId: userDept,
      isUnrestricted: false
    };
  }

  if (user.role === 'admin') {
    // Admin has full cross-department authority and can optionally filter by department
    const requestedDept = (filters && (filters.departmentId || filters.department)) || null;
    return {
      authorized: true,
      role: 'admin',
      effectiveDepartmentId: requestedDept,
      isUnrestricted: true
    };
  }

  return {
    authorized: false,
    statusCode: 403,
    error: `Access denied: unrecognized role '${user.role}'`
  };
}
