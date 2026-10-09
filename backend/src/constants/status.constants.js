/**
 * JanSahay Platform Constants & Status Transition Matrix
 */

export const COMPLAINT_STATUS = {
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  AWAITING_INFORMATION: 'AWAITING_INFORMATION',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED'
};

export const COMPLAINT_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

export const COMPLAINT_CATEGORIES = [
  'roads',
  'electricity',
  'water',
  'healthcare',
  'pension',
  'scholarship',
  'ration',
  'municipal',
  'revenue',
  'police',
  'flood relief'
];

/**
 * Valid Status Transitions Matrix
 * Enforces administrative governance rules for grievance redressal
 */
export const STATUS_TRANSITIONS = {
  SUBMITTED: ['UNDER_REVIEW', 'ASSIGNED', 'CLOSED'],
  UNDER_REVIEW: ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_INFORMATION', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'UNDER_REVIEW', 'AWAITING_INFORMATION'],
  IN_PROGRESS: ['AWAITING_INFORMATION', 'RESOLVED', 'CLOSED', 'ASSIGNED'],
  AWAITING_INFORMATION: ['UNDER_REVIEW', 'IN_PROGRESS', 'CLOSED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS']
};

/**
 * Validates if status transition is allowed
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {{ valid: boolean, allowed: string[] }}
 */
export function validateStatusTransition(currentStatus, targetStatus) {
  // If status is identical, it's valid as a no-op / update note
  if (currentStatus === targetStatus) {
    return { valid: true, allowed: STATUS_TRANSITIONS[currentStatus] || [] };
  }

  // Normalize legacy status if needed
  const normalizedCurrent = Object.values(COMPLAINT_STATUS).includes(currentStatus)
    ? currentStatus
    : 'SUBMITTED';

  const allowed = STATUS_TRANSITIONS[normalizedCurrent] || [];
  const valid = allowed.includes(targetStatus);

  return { valid, allowed };
}
