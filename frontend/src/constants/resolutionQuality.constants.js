/**
 * @file resolutionQuality.constants.js
 * @description Frontend mirror of backend Phase 9 Resolution Quality Checker constants.
 * Enforces exact contracts, enum codes, thresholds, and category policies.
 */

export const RESOLUTION_OUTCOME_TYPES = Object.freeze({
  REPAIR_COMPLETED: 'REPAIR_COMPLETED',
  SERVICE_RESTORED: 'SERVICE_RESTORED',
  BENEFIT_DISBURSED: 'BENEFIT_DISBURSED',
  ADMINISTRATIVE_ORDER_ISSUED: 'ADMINISTRATIVE_ORDER_ISSUED',
  INSPECTION_CONFIRMED_CLEARED: 'INSPECTION_CONFIRMED_CLEARED',
  NO_DEFECT_FOUND: 'NO_DEFECT_FOUND',
  REFERRED_EXTERNAL: 'REFERRED_EXTERNAL'
});

export const RESOLUTION_OUTCOME_OPTIONS = [
  { value: 'REPAIR_COMPLETED', label: 'Repair Completed', description: 'Physical remediation or engineering repair successfully finished.' },
  { value: 'SERVICE_RESTORED', label: 'Service Restored', description: 'Disrupted civic utility or service brought back online.' },
  { value: 'BENEFIT_DISBURSED', label: 'Benefit Disbursed', description: 'Direct benefit, subsidy, or welfare remittance credited.' },
  { value: 'ADMINISTRATIVE_ORDER_ISSUED', label: 'Administrative Order Issued', description: 'Statutory directive, clearance sanction, or enforcement order issued.' },
  { value: 'INSPECTION_CONFIRMED_CLEARED', label: 'Inspection Confirmed Cleared', description: 'On-site officer inspection confirmed area is cleared.' },
  { value: 'NO_DEFECT_FOUND', label: 'No Defect Found', description: 'Field investigation established no defect or hazard exists (evidence waived).' },
  { value: 'REFERRED_EXTERNAL', label: 'Referred External', description: 'Matter formally transferred to external competent authority (evidence waived).' }
];

export const VERIFICATION_METHODS = Object.freeze({
  PHYSICAL_INSPECTION: 'PHYSICAL_INSPECTION',
  CITIZEN_CONFIRMATION: 'CITIZEN_CONFIRMATION',
  SUPERVISORY_AUDIT: 'SUPERVISORY_AUDIT',
  TELEPHONIC_VERIFICATION: 'TELEPHONIC_VERIFICATION',
  SYSTEM_TELEMETRY: 'SYSTEM_TELEMETRY',
  DOCUMENT_VERIFICATION: 'DOCUMENT_VERIFICATION'
});

export const VERIFICATION_METHOD_OPTIONS = [
  { value: 'PHYSICAL_INSPECTION', label: 'Physical Inspection', description: 'On-site visit by assigned officer or field engineer.' },
  { value: 'CITIZEN_CONFIRMATION', label: 'Citizen Confirmation', description: 'Complainant directly verified satisfaction and closure.' },
  { value: 'SUPERVISORY_AUDIT', label: 'Supervisory Audit', description: 'Administrative desk audit conducted by supervisory officer.' },
  { value: 'TELEPHONIC_VERIFICATION', label: 'Telephonic Verification', description: 'Phone call confirmation conducted with complainant.' },
  { value: 'SYSTEM_TELEMETRY', label: 'System Telemetry', description: 'Automated sensor, SCADA, or grid monitoring confirmation.' },
  { value: 'DOCUMENT_VERIFICATION', label: 'Document Verification', description: 'Formal receipt, signed work order, or clearance certificate.' }
];

export const RESOLUTION_EXCEPTION_REASONS = Object.freeze({
  CITIZEN_UNRESPONSIVE: {
    code: 'CITIZEN_UNRESPONSIVE',
    label: 'Citizen Unresponsive',
    description: 'Complainant did not respond to multiple verification contacts or failed to provide necessary access/clarification.'
  },
  DUPLICATE_REFERRED: {
    code: 'DUPLICATE_REFERRED',
    label: 'Duplicate / Master Case Addressed',
    description: 'Grievance was identified and remediated under an existing master complaint or incident cluster.'
  },
  OUT_OF_JURISDICTION_REFERRED: {
    code: 'OUT_OF_JURISDICTION_REFERRED',
    label: 'Transferred Out of Jurisdiction',
    description: 'Matter falls outside department purview; formally referred to competent statutory body.'
  },
  CIVIL_DISPUTE_SUB_JUDICE: {
    code: 'CIVIL_DISPUTE_SUB_JUDICE',
    label: 'Sub-Judice / Private Civil Dispute',
    description: 'Matter is under judicial consideration or involves private rights where administrative repair cannot proceed.'
  },
  FALSE_REPORT_VERIFIED: {
    code: 'FALSE_REPORT_VERIFIED',
    label: 'Verified False / Inaccurate Report',
    description: 'On-site investigation established that the reported defect or hazard does not exist.'
  },
  POLICY_MATTER_NO_INDIVIDUAL_RELIEF: {
    code: 'POLICY_MATTER_NO_INDIVIDUAL_RELIEF',
    label: 'Policy or Legislative Matter',
    description: 'Grievance demands statutory amendment or budgetary policy revision rather than local civic repair.'
  },
  FORCE_MAJEURE_UNFEASIBLE: {
    code: 'FORCE_MAJEURE_UNFEASIBLE',
    label: 'Force Majeure / Structurally Infeasible',
    description: 'Severe weather, natural catastrophe, or terrain constraints prevent execution without major capital works project.'
  }
});

export const EVIDENCE_TYPES = Object.freeze({
  PHOTO_REFERENCE: 'PHOTO_REFERENCE',
  WORK_ORDER_ID: 'WORK_ORDER_ID',
  INSPECTION_REPORT_REF: 'INSPECTION_REPORT_REF',
  TRANSACTION_REF: 'TRANSACTION_REF',
  CITIZEN_ACKNOWLEDGEMENT: 'CITIZEN_ACKNOWLEDGEMENT',
  FIELD_MEASUREMENT_REF: 'FIELD_MEASUREMENT_REF',
  OFFICIAL_LETTER_REF: 'OFFICIAL_LETTER_REF'
});

export const EVIDENCE_TYPE_OPTIONS = [
  { value: 'PHOTO_REFERENCE', label: 'Photo Reference ID (e.g. PHOTO-2026-001)' },
  { value: 'WORK_ORDER_ID', label: 'Work Order ID (e.g. WO-98214)' },
  { value: 'INSPECTION_REPORT_REF', label: 'Inspection Report Ref (e.g. INSP-REP-440)' },
  { value: 'TRANSACTION_REF', label: 'Disbursement Transaction Ref (e.g. TXN-DBT-8891)' },
  { value: 'CITIZEN_ACKNOWLEDGEMENT', label: 'Citizen Acknowledgement Receipt' },
  { value: 'FIELD_MEASUREMENT_REF', label: 'Field Measurement / Sensor Log Ref' },
  { value: 'OFFICIAL_LETTER_REF', label: 'Official Sanction / Letter Reference' }
];

export const RESOLUTION_REQUIREMENT_CODES = Object.freeze({
  REQ_ACTION_OR_OUTCOME: 'REQ_ACTION_OR_OUTCOME',
  REQ_VERIFICATION_METHOD: 'REQ_VERIFICATION_METHOD',
  REQ_CLOSURE_REMARKS: 'REQ_CLOSURE_REMARKS',
  REQ_SUPPORTING_EVIDENCE: 'REQ_SUPPORTING_EVIDENCE',
  REQ_EXCEPTION_FLAG: 'REQ_EXCEPTION_FLAG',
  REQ_EXCEPTION_REASON: 'REQ_EXCEPTION_REASON',
  REQ_EXCEPTION_JUSTIFICATION: 'REQ_EXCEPTION_JUSTIFICATION'
});

export const CHECKLIST_WEIGHTS = Object.freeze({
  [RESOLUTION_REQUIREMENT_CODES.REQ_ACTION_OR_OUTCOME]: 30,
  [RESOLUTION_REQUIREMENT_CODES.REQ_VERIFICATION_METHOD]: 25,
  [RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS]: 25,
  [RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE]: 20
});

export const RESOLUTION_THRESHOLDS = Object.freeze({
  MIN_CLOSURE_REMARKS_LENGTH: 25,
  MIN_EXCEPTION_JUSTIFICATION_LENGTH: 25,
  MIN_EVIDENCE_ITEMS_FOR_PHYSICAL_REPAIR: 1,
  PASSING_SCORE: 100
});

export const CATEGORY_RESOLUTION_POLICIES = Object.freeze({
  roads: {
    requiresEvidence: true,
    guidance: 'Requires physical inspection and photographic proof of repaired road/pavement surface or signed work order reference.'
  },
  electricity: {
    requiresEvidence: true,
    guidance: 'Requires line/grid telemetry confirmation, lineman work order reference, or transformer restoration log.'
  },
  water: {
    requiresEvidence: true,
    guidance: 'Requires pipeline pressure verification, leak repair confirmation, or clean water test reference.'
  },
  healthcare: {
    requiresEvidence: false,
    guidance: 'Requires medical officer liaison report, facility inspection clearance, or medicine replenishment log.'
  },
  pension: {
    requiresEvidence: true,
    guidance: 'Requires treasury/PFMS disbursement transaction reference or pension sanction order ID.'
  },
  scholarship: {
    requiresEvidence: true,
    guidance: 'Requires DBT remittance reference number, institute verification clearance, or sanction order ID.'
  },
  ration: {
    requiresEvidence: false,
    guidance: 'Requires fair price shop inspection report or biometric quota allocation confirmation.'
  },
  municipal: {
    requiresEvidence: true,
    guidance: 'Requires post-cleaning site photograph or sanitary inspector clearance report.'
  },
  revenue: {
    requiresEvidence: true,
    guidance: 'Requires patwari/tehsildar demarcation report or land record mutation order reference.'
  },
  police: {
    requiresEvidence: false,
    guidance: 'Requires civic enquiry report, verification memo, or traffic patrol log reference.'
  },
  'flood relief': {
    requiresEvidence: true,
    guidance: 'Requires dewatering completion log, relief distribution voucher, or flood drain clearance verification.'
  }
});

/**
 * Checks whether an evidence reference string or object is safe.
 * Rejects path traversals, drive roots, absolute system paths, and file URIs.
 */
export function isSafeEvidenceReference(item) {
  if (!item) return false;
  let refStr = '';
  if (typeof item === 'string') {
    refStr = item.trim();
  } else if (typeof item === 'object') {
    refStr = String(item.referenceId || item.ref || item.id || item.description || '').trim();
  }
  if (!refStr) return false;

  if (/^file:\/\//i.test(refStr)) return false;
  if (/^[A-Za-z]:[\\\/]/.test(refStr)) return false;
  if (/^[\/\\]{2}/.test(refStr)) return false;
  if (/\.\.[\/\\]/.test(refStr) || /%2e%2e/i.test(refStr)) return false;
  if (/^[\/\\](etc|var|usr|bin|tmp|home|root|windows|system32|users)[\/\\]/i.test(refStr)) return false;

  return true;
}

/**
 * Formats an outcome type code to a user-friendly label.
 */
export function formatOutcomeType(code) {
  if (!code) return 'Outcome Documented';
  const found = RESOLUTION_OUTCOME_OPTIONS.find((o) => o.value === code);
  if (found) return found.label;
  return String(code).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats a verification method code to a user-friendly label.
 */
export function formatVerificationMethod(code) {
  if (!code) return 'Verified';
  const found = VERIFICATION_METHOD_OPTIONS.find((m) => m.value === code);
  if (found) return found.label;
  return String(code).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats an exception reason code to a user-friendly label.
 */
export function formatExceptionReason(code) {
  if (!code) return 'Administrative Exception';
  const found = RESOLUTION_EXCEPTION_REASONS[code];
  if (found) return found.label;
  return String(code).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
