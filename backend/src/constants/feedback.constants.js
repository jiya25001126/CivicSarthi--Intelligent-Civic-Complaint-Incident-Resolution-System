/**
 * @file feedback.constants.js
 * @description Centralized constants, status enums, transition matrices,
 * and reason codes for CivicSarthi Phase 10: Citizen Feedback, Appeals & Controlled Reopening.
 */

export const FEEDBACK_RATING_BOUNDS = Object.freeze({
  MIN: 1,
  MAX: 5
});

export const APPEAL_STATUS = Object.freeze({
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  NEED_MORE_INFORMATION: 'NEED_MORE_INFORMATION',
  UPHELD: 'UPHELD',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN'
});

export const APPEAL_STATUS_TRANSITIONS = Object.freeze({
  SUBMITTED: ['UNDER_REVIEW', 'UPHELD', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['NEED_MORE_INFORMATION', 'UPHELD', 'REJECTED', 'WITHDRAWN'],
  NEED_MORE_INFORMATION: ['UNDER_REVIEW', 'UPHELD', 'REJECTED', 'WITHDRAWN'],
  UPHELD: [], // Terminal
  REJECTED: [], // Terminal
  WITHDRAWN: [] // Terminal
});

export const APPEAL_REASONS = Object.freeze({
  OUTCOME_DISPUTED: 'OUTCOME_DISPUTED',
  INCOMPLETE_WORK: 'INCOMPLETE_WORK',
  FALSE_RESOLUTION_CLAIM: 'FALSE_RESOLUTION_CLAIM',
  POOR_QUALITY: 'POOR_QUALITY',
  RECURRING_DEFECT: 'RECURRING_DEFECT',
  EVIDENCE_DISPUTED: 'EVIDENCE_DISPUTED',
  PROCEDURAL_VIOLATION: 'PROCEDURAL_VIOLATION',
  UNSATISFACTORY_EXPLANATION: 'UNSATISFACTORY_EXPLANATION',
  OTHER: 'OTHER'
});

export const APPEAL_REASON_LABELS = Object.freeze({
  OUTCOME_DISPUTED: 'Claimed resolution outcome does not match ground reality',
  INCOMPLETE_WORK: 'Remediation or repair was left partially finished',
  FALSE_RESOLUTION_CLAIM: 'Resolution was marked without any actual work performed',
  POOR_QUALITY: 'Repair quality failed shortly after completion',
  RECURRING_DEFECT: 'Defect recurred shortly after declared resolution',
  EVIDENCE_DISPUTED: 'Resolution verification evidence is disputed or unconvincing',
  PROCEDURAL_VIOLATION: 'Procedural requirements or verification standards were bypassed',
  UNSATISFACTORY_EXPLANATION: 'Officer explanation does not adequately address complaint',
  OTHER: 'Other grievance regarding resolution process'
});

export const REOPENING_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
});

export const REOPENING_STATUS_TRANSITIONS = Object.freeze({
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: [], // Terminal
  REJECTED: [], // Terminal
  CANCELLED: [] // Terminal
});

export const REOPENING_REASONS = Object.freeze({
  UNRESOLVED_ISSUE: 'UNRESOLVED_ISSUE',
  ISSUE_PERSISTS: 'ISSUE_PERSISTS',
  DEFECT_RECURRENCE: 'DEFECT_RECURRENCE',
  RECURRING_FAILURE: 'RECURRING_FAILURE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  EVIDENCE_UNVERIFIABLE: 'EVIDENCE_UNVERIFIABLE',
  PARTIAL_REPAIR: 'PARTIAL_REPAIR',
  INCOMPLETE_REMEDIATION: 'INCOMPLETE_REMEDIATION',
  SAFETY_HAZARD_REMAINS: 'SAFETY_HAZARD_REMAINS',
  OTHER: 'OTHER'
});

export const REOPENING_REASON_LABELS = Object.freeze({
  UNRESOLVED_ISSUE: 'Underlying civic problem remains active and unresolved',
  ISSUE_PERSISTS: 'Civic issue still persists on the ground after reported resolution',
  DEFECT_RECURRENCE: 'Civic defect has recurred immediately after reported closure',
  RECURRING_FAILURE: 'Recurring defect or failure after repair',
  INSUFFICIENT_EVIDENCE: 'Supporting evidence provided does not substantiate resolution',
  EVIDENCE_UNVERIFIABLE: 'Resolution evidence is false or unverifiable',
  PARTIAL_REPAIR: 'Only part of the defect was addressed; key hazards remain',
  INCOMPLETE_REMEDIATION: 'Incomplete remediation work performed',
  SAFETY_HAZARD_REMAINS: 'Public safety hazard remains active on site',
  OTHER: 'Other operational justification for reopening case'
});

/**
 * Validates lifecycle transition for formal appeal
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {{ valid: boolean, allowed: string[] }}
 */
export function validateAppealStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) {
    return { valid: true, allowed: APPEAL_STATUS_TRANSITIONS[currentStatus] || [] };
  }

  const allowed = APPEAL_STATUS_TRANSITIONS[currentStatus] || [];
  const valid = allowed.includes(targetStatus);
  return { valid, allowed };
}

/**
 * Validates lifecycle transition for controlled reopening request
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {{ valid: boolean, allowed: string[] }}
 */
export function validateReopeningStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) {
    return { valid: true, allowed: REOPENING_STATUS_TRANSITIONS[currentStatus] || [] };
  }

  const allowed = REOPENING_STATUS_TRANSITIONS[currentStatus] || [];
  const valid = allowed.includes(targetStatus);
  return { valid, allowed };
}

/**
 * Checks if an appeal status is terminal
 * @param {string} status
 * @returns {boolean}
 */
export function isTerminalAppealStatus(status) {
  return [APPEAL_STATUS.UPHELD, APPEAL_STATUS.REJECTED, APPEAL_STATUS.WITHDRAWN].includes(status);
}

/**
 * Checks if a reopening request status is terminal
 * @param {string} status
 * @returns {boolean}
 */
export function isTerminalReopeningStatus(status) {
  return [REOPENING_STATUS.APPROVED, REOPENING_STATUS.REJECTED, REOPENING_STATUS.CANCELLED].includes(status);
}
