/**
 * @file resolutionQuality.constants.js
 * @description Centralized constants, checklist item definitions, requirement codes,
 * and exception policies for CivicSarthi Phase 9: Resolution Quality Checker.
 *
 * Designed to prevent arbitrary or premature grievance closures by enforcing
 * objective, verifiable resolution standards before a complaint transitions
 * to RESOLVED or CLOSED.
 */

import { COMPLAINT_CATEGORIES } from './status.constants.js';

/**
 * Valid resolution outcome types.
 * Encompasses physical remediation as well as verified non-repair outcomes.
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

/**
 * Standard verification methods used by officers to confirm resolution.
 */
export const VERIFICATION_METHODS = Object.freeze({
  PHYSICAL_INSPECTION: 'PHYSICAL_INSPECTION',
  CITIZEN_CONFIRMATION: 'CITIZEN_CONFIRMATION',
  SUPERVISORY_AUDIT: 'SUPERVISORY_AUDIT',
  TELEPHONIC_VERIFICATION: 'TELEPHONIC_VERIFICATION',
  SYSTEM_TELEMETRY: 'SYSTEM_TELEMETRY',
  DOCUMENT_VERIFICATION: 'DOCUMENT_VERIFICATION'
});

/**
 * Supported safe evidence types.
 * Evidence is referenced via safe metadata/identifiers, never local file paths.
 */
export const EVIDENCE_TYPES = Object.freeze({
  PHOTO_REFERENCE: 'PHOTO_REFERENCE',
  WORK_ORDER_ID: 'WORK_ORDER_ID',
  INSPECTION_REPORT_REF: 'INSPECTION_REPORT_REF',
  TRANSACTION_REF: 'TRANSACTION_REF',
  CITIZEN_ACKNOWLEDGEMENT: 'CITIZEN_ACKNOWLEDGEMENT',
  FIELD_MEASUREMENT_REF: 'FIELD_MEASUREMENT_REF',
  OFFICIAL_LETTER_REF: 'OFFICIAL_LETTER_REF'
});

/**
 * Machine-readable requirement identifiers for checklist evaluation.
 */
export const RESOLUTION_REQUIREMENT_CODES = Object.freeze({
  REQ_ACTION_OR_OUTCOME: 'REQ_ACTION_OR_OUTCOME',
  REQ_VERIFICATION_METHOD: 'REQ_VERIFICATION_METHOD',
  REQ_CLOSURE_REMARKS: 'REQ_CLOSURE_REMARKS',
  REQ_SUPPORTING_EVIDENCE: 'REQ_SUPPORTING_EVIDENCE',
  REQ_EXCEPTION_FLAG: 'REQ_EXCEPTION_FLAG',
  REQ_EXCEPTION_REASON: 'REQ_EXCEPTION_REASON',
  REQ_EXCEPTION_JUSTIFICATION: 'REQ_EXCEPTION_JUSTIFICATION'
});

/**
 * Authoritative exception reason codes for supervisory/human-in-the-loop overrides.
 * An exception must be explicitly claimed with a valid code and justification.
 */
export const RESOLUTION_EXCEPTION_REASONS = Object.freeze({
  CITIZEN_UNRESPONSIVE: Object.freeze({
    code: 'CITIZEN_UNRESPONSIVE',
    label: 'Citizen Unresponsive',
    description: 'Complainant did not respond to multiple verification contacts or failed to provide necessary access/clarification.'
  }),
  DUPLICATE_REFERRED: Object.freeze({
    code: 'DUPLICATE_REFERRED',
    label: 'Duplicate / Master Case Addressed',
    description: 'Grievance was identified and remediated under an existing master complaint or incident cluster.'
  }),
  OUT_OF_JURISDICTION_REFERRED: Object.freeze({
    code: 'OUT_OF_JURISDICTION_REFERRED',
    label: 'Transferred Out of Jurisdiction',
    description: 'Matter falls outside department purview; formally referred to competent statutory body.'
  }),
  CIVIL_DISPUTE_SUB_JUDICE: Object.freeze({
    code: 'CIVIL_DISPUTE_SUB_JUDICE',
    label: 'Sub-Judice / Private Civil Dispute',
    description: 'Matter is under judicial consideration or involves private rights where administrative repair cannot proceed.'
  }),
  FALSE_REPORT_VERIFIED: Object.freeze({
    code: 'FALSE_REPORT_VERIFIED',
    label: 'Verified False / Inaccurate Report',
    description: 'On-site investigation established that the reported defect or hazard does not exist.'
  }),
  POLICY_MATTER_NO_INDIVIDUAL_RELIEF: Object.freeze({
    code: 'POLICY_MATTER_NO_INDIVIDUAL_RELIEF',
    label: 'Policy or Legislative Matter',
    description: 'Grievance demands statutory amendment or budgetary policy revision rather than local civic repair.'
  }),
  FORCE_MAJEURE_UNFEASIBLE: Object.freeze({
    code: 'FORCE_MAJEURE_UNFEASIBLE',
    label: 'Force Majeure / Structurally Infeasible',
    description: 'Severe weather, natural catastrophe, or terrain constraints prevent execution without major capital works project.'
  })
});

/**
 * Numerical thresholds and validation constraints.
 */
export const RESOLUTION_THRESHOLDS = Object.freeze({
  MIN_CLOSURE_REMARKS_LENGTH: 25,
  MIN_EXCEPTION_JUSTIFICATION_LENGTH: 25,
  MIN_EVIDENCE_ITEMS_FOR_PHYSICAL_REPAIR: 1,
  PASSING_SCORE: 100
});

/**
 * Procedural Checklist Weights (Total: 100 points).
 * Strictly measures compliance with required administrative documentation completeness.
 * Does NOT represent real-world physical engineering or sensory inspection quality.
 */
export const CHECKLIST_WEIGHTS = Object.freeze({
  [RESOLUTION_REQUIREMENT_CODES.REQ_ACTION_OR_OUTCOME]: 30,
  [RESOLUTION_REQUIREMENT_CODES.REQ_VERIFICATION_METHOD]: 25,
  [RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS]: 25,
  [RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE]: 20
});

/**
 * Category-specific resolution guidance and evidence policies.
 * All keys strictly match COMPLAINT_CATEGORIES in status.constants.js.
 */
export const CATEGORY_RESOLUTION_POLICIES = Object.freeze({
  roads: Object.freeze({
    category: 'roads',
    requiresEvidence: true,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.PHOTO_REFERENCE,
      EVIDENCE_TYPES.WORK_ORDER_ID,
      EVIDENCE_TYPES.INSPECTION_REPORT_REF
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.PHYSICAL_INSPECTION,
      VERIFICATION_METHODS.SUPERVISORY_AUDIT
    ]),
    guidance: 'Requires physical inspection and photographic proof of repaired road/pavement surface or signed work order reference.'
  }),
  electricity: Object.freeze({
    category: 'electricity',
    requiresEvidence: true,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.WORK_ORDER_ID,
      EVIDENCE_TYPES.FIELD_MEASUREMENT_REF,
      EVIDENCE_TYPES.PHOTO_REFERENCE
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.SYSTEM_TELEMETRY,
      VERIFICATION_METHODS.PHYSICAL_INSPECTION
    ]),
    guidance: 'Requires line/grid telemetry confirmation, lineman work order reference, or transformer restoration log.'
  }),
  water: Object.freeze({
    category: 'water',
    requiresEvidence: true,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.PHOTO_REFERENCE,
      EVIDENCE_TYPES.WORK_ORDER_ID,
      EVIDENCE_TYPES.INSPECTION_REPORT_REF
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.PHYSICAL_INSPECTION,
      VERIFICATION_METHODS.CITIZEN_CONFIRMATION
    ]),
    guidance: 'Requires pipeline pressure verification, leak repair confirmation, or clean water test reference.'
  }),
  healthcare: Object.freeze({
    category: 'healthcare',
    requiresEvidence: false,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.INSPECTION_REPORT_REF,
      EVIDENCE_TYPES.OFFICIAL_LETTER_REF
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.DOCUMENT_VERIFICATION,
      VERIFICATION_METHODS.PHYSICAL_INSPECTION
    ]),
    guidance: 'Requires medical officer liaison report, facility inspection clearance, or medicine replenishment log.'
  }),
  pension: Object.freeze({
    category: 'pension',
    requiresEvidence: true,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.TRANSACTION_REF,
      EVIDENCE_TYPES.OFFICIAL_LETTER_REF
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.DOCUMENT_VERIFICATION,
      VERIFICATION_METHODS.SYSTEM_TELEMETRY
    ]),
    guidance: 'Requires treasury/PFMS disbursement transaction reference or pension sanction order ID.'
  }),
  scholarship: Object.freeze({
    category: 'scholarship',
    requiresEvidence: true,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.TRANSACTION_REF,
      EVIDENCE_TYPES.OFFICIAL_LETTER_REF
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.DOCUMENT_VERIFICATION,
      VERIFICATION_METHODS.SYSTEM_TELEMETRY
    ]),
    guidance: 'Requires DBT remittance reference number, institute verification clearance, or sanction order ID.'
  }),
  ration: Object.freeze({
    category: 'ration',
    requiresEvidence: false,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.INSPECTION_REPORT_REF,
      EVIDENCE_TYPES.CITIZEN_ACKNOWLEDGEMENT
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.PHYSICAL_INSPECTION,
      VERIFICATION_METHODS.CITIZEN_CONFIRMATION
    ]),
    guidance: 'Requires fair price shop inspection report or biometric quota allocation confirmation.'
  }),
  municipal: Object.freeze({
    category: 'municipal',
    requiresEvidence: true,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.PHOTO_REFERENCE,
      EVIDENCE_TYPES.INSPECTION_REPORT_REF
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.PHYSICAL_INSPECTION,
      VERIFICATION_METHODS.CITIZEN_CONFIRMATION
    ]),
    guidance: 'Requires post-cleaning site photograph or sanitary inspector clearance report.'
  }),
  revenue: Object.freeze({
    category: 'revenue',
    requiresEvidence: true,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.OFFICIAL_LETTER_REF,
      EVIDENCE_TYPES.INSPECTION_REPORT_REF
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.DOCUMENT_VERIFICATION,
      VERIFICATION_METHODS.PHYSICAL_INSPECTION
    ]),
    guidance: 'Requires patwari/tehsildar demarcation report or land record mutation order reference.'
  }),
  police: Object.freeze({
    category: 'police',
    requiresEvidence: false,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.INSPECTION_REPORT_REF,
      EVIDENCE_TYPES.OFFICIAL_LETTER_REF
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.PHYSICAL_INSPECTION,
      VERIFICATION_METHODS.CITIZEN_CONFIRMATION
    ]),
    guidance: 'Requires civic enquiry report, verification memo, or traffic patrol log reference.'
  }),
  'flood relief': Object.freeze({
    category: 'flood relief',
    requiresEvidence: true,
    acceptedEvidenceTypes: Object.freeze([
      EVIDENCE_TYPES.PHOTO_REFERENCE,
      EVIDENCE_TYPES.INSPECTION_REPORT_REF,
      EVIDENCE_TYPES.WORK_ORDER_ID
    ]),
    recommendedVerification: Object.freeze([
      VERIFICATION_METHODS.PHYSICAL_INSPECTION,
      VERIFICATION_METHODS.SUPERVISORY_AUDIT
    ]),
    guidance: 'Requires dewatering completion log, relief distribution voucher, or flood drain clearance verification.'
  })
});
