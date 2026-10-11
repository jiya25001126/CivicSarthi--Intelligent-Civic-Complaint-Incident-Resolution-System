/**
 * CivicSarthi Incident & Subtask Constants & Governance Transition Matrices
 * Enforces status integrity for composite parent incidents and cross-department subtasks.
 */

export const INCIDENT_STATUS = {
  ACTIVE: 'ACTIVE',
  CONTAINED: 'CONTAINED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

export const INCIDENT_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

export const SUBTASK_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

/**
 * Incident Status Transition Matrix
 * Defines valid lifecycle progressions for clustered parent incidents.
 */
export const INCIDENT_STATUS_TRANSITIONS = {
  ACTIVE: ['CONTAINED', 'RESOLVED', 'CLOSED'],
  CONTAINED: ['ACTIVE', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CONTAINED', 'CLOSED'],
  CLOSED: [] // Terminal state
};

/**
 * Subtask Status Transition Matrix
 * Defines valid lifecycle progressions for department-specific subtasks.
 */
export const SUBTASK_STATUS_TRANSITIONS = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'PENDING', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [] // Terminal state
};

export const INCIDENT_STATUS_DESCRIPTIONS = {
  ACTIVE: 'The parent incident is actively affecting the area. Multiple departments are mobilizing resources.',
  CONTAINED: 'Immediate hazards have been stabilized or cordoned off. Active restoration continues.',
  RESOLVED: 'All participating department tasks are complete. Municipal services are fully restored.',
  CLOSED: 'The incident has completed post-incident administrative review and is officially closed.'
};

export const SUBTASK_STATUS_DESCRIPTIONS = {
  PENDING: 'Subtask has been delegated to the department and is queued for officer assignment/action.',
  IN_PROGRESS: 'Field teams and departmental officers are actively executing on-ground remediation.',
  COMPLETED: 'Departmental actions have been carried out and officially marked complete.',
  CANCELLED: 'Subtask was cancelled as redundant, superseded, or no longer required.'
};

/**
 * Returns citizen-friendly description for incident status
 * @param {string} status
 * @returns {string}
 */
export function getIncidentStatusDescription(status) {
  return INCIDENT_STATUS_DESCRIPTIONS[status] || 'Incident status recorded in multi-agency tracking system.';
}

/**
 * Returns plain-language description for subtask status
 * @param {string} status
 * @returns {string}
 */
export function getSubtaskStatusDescription(status) {
  return SUBTASK_STATUS_DESCRIPTIONS[status] || 'Departmental subtask status updated.';
}

/**
 * Validates whether an incident status transition is permitted
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {{ valid: boolean, allowed: string[] }}
 */
export function validateIncidentStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) {
    return { valid: true, allowed: INCIDENT_STATUS_TRANSITIONS[currentStatus] || [] };
  }

  const normalizedCurrent = Object.values(INCIDENT_STATUS).includes(currentStatus)
    ? currentStatus
    : INCIDENT_STATUS.ACTIVE;

  const allowed = INCIDENT_STATUS_TRANSITIONS[normalizedCurrent] || [];
  const valid = allowed.includes(targetStatus);

  return { valid, allowed };
}

/**
 * Validates whether a subtask status transition is permitted
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {{ valid: boolean, allowed: string[] }}
 */
export function validateSubtaskStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) {
    return { valid: true, allowed: SUBTASK_STATUS_TRANSITIONS[currentStatus] || [] };
  }

  const normalizedCurrent = Object.values(SUBTASK_STATUS).includes(currentStatus)
    ? currentStatus
    : SUBTASK_STATUS.PENDING;

  const allowed = SUBTASK_STATUS_TRANSITIONS[normalizedCurrent] || [];
  const valid = allowed.includes(targetStatus);

  return { valid, allowed };
}

/**
 * Checks if an incident is in a terminal status
 * @param {string} status
 * @returns {boolean}
 */
export function isTerminalIncidentStatus(status) {
  return status === INCIDENT_STATUS.CLOSED;
}

/**
 * Checks if a subtask is in a terminal status
 * @param {string} status
 * @returns {boolean}
 */
export function isTerminalSubtaskStatus(status) {
  return status === SUBTASK_STATUS.COMPLETED || status === SUBTASK_STATUS.CANCELLED;
}
