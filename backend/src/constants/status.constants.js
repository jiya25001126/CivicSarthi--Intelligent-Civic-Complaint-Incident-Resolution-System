/**
 * CivicSarthi Platform Constants & Status Transition Matrix
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
  REOPENED: ['UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
};

/**
 * Citizen-Friendly Status Explanations
 * Explains each official status clearly in plain language for citizens
 */
export const STATUS_DESCRIPTIONS = {
  SUBMITTED: 'Your grievance has been safely received and registered in the system. It is awaiting initial review by the department triage team.',
  UNDER_REVIEW: 'A nodal grievance officer is actively assessing your complaint to establish jurisdiction, validity, and necessary remediation steps.',
  ASSIGNED: 'Your grievance has been officially assigned to the designated field division or handling officer for on-ground investigation.',
  IN_PROGRESS: 'Field officers and technical teams are currently working to remediate and resolve the reported issue.',
  AWAITING_INFORMATION: 'The assigned officer has requested additional details or supporting documents from you before proceeding.',
  RESOLVED: 'Remediation actions have been carried out and reported complete by the department. The case is now awaiting your verification or final closure.',
  CLOSED: 'Grievance resolution has been officially finalized and the case file is closed.',
  REOPENED: 'The case has been reopened for follow-up inspection or re-examination.'
};

/**
 * Returns plain-language citizen-friendly description for any given status
 * @param {string} status
 * @returns {string}
 */
export function getStatusDescription(status) {
  return STATUS_DESCRIPTIONS[status] || 'Status recorded in grievance tracking system.';
}

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
