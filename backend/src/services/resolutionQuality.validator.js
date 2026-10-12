/**
 * @file resolutionQuality.validator.js
 * @description Pure, deterministic, side-effect-free validator for CivicSarthi Phase 9:
 * Resolution Quality Checker.
 *
 * Enforces verifiable resolution standards before a complaint or subtask
 * transitions to RESOLVED or CLOSED.
 *
 * GUARANTEES:
 * 1. Pure function: Never mutates complaint, resolution payload, or arguments.
 * 2. Deterministic: Produces identical, reproducible verdicts for identical inputs.
 * 3. Side-effect free: Never writes to databases, calls external APIs, or generates dynamic timestamps.
 * 4. Transparent separation: Procedural checklist compliance score is strictly separate from the boolean validity verdict.
 * 5. Safe evidence: Verifies safe metadata references; strictly rejects local filesystem paths or fabricated file URIs.
 */

import {
  RESOLUTION_OUTCOME_TYPES,
  VERIFICATION_METHODS,
  EVIDENCE_TYPES,
  RESOLUTION_REQUIREMENT_CODES,
  RESOLUTION_EXCEPTION_REASONS,
  RESOLUTION_THRESHOLDS,
  CHECKLIST_WEIGHTS,
  CATEGORY_RESOLUTION_POLICIES
} from '../constants/resolutionQuality.constants.js';

/**
 * Checks whether an evidence reference string or object is safe.
 * Rejects path traversals, drive roots, absolute system paths, and file URIs.
 *
 * @param {*} item - The evidence item to check
 * @returns {boolean} True if safe, false if malformed or containing path syntax
 */
export function isSafeEvidenceReference(item) {
  if (!item) return false;

  let refStr = '';
  if (typeof item === 'string') {
    refStr = item.trim();
  } else if (typeof item === 'object') {
    refStr = String(item.referenceId || item.ref || item.id || item.description || '').trim();
  }

  if (!refStr || refStr.length === 0) return false;

  // Reject local file schemes (file://)
  if (/^file:\/\//i.test(refStr)) return false;

  // Reject Windows drive letters (C:\, D:/, etc.)
  if (/^[A-Za-z]:[\\\/]/.test(refStr)) return false;

  // Reject UNC network shares (\\server\share, //server/share)
  if (/^[\/\\]{2}/.test(refStr)) return false;

  // Reject path traversals (../, ..\) and URL-encoded traversals (%2e%2e)
  if (/\.\.[\/\\]/.test(refStr) || /%2e%2e/i.test(refStr)) return false;

  // Reject Unix root paths pointing to system directories (/etc, /var, /usr, /bin, /tmp, /home, /root)
  if (/^[\/\\](etc|var|usr|bin|tmp|home|root|windows|system32|users)[\/\\]/i.test(refStr)) return false;

  return true;
}

/**
 * Retrieves the category-specific resolution policy for a given category.
 * Falls back to a safe default policy if category is unmapped.
 *
 * @param {string} category
 * @returns {Object} Category resolution policy
 */
export function getCategoryResolutionPolicy(category) {
  const normalized = String(category || '').toLowerCase().trim();
  return (
    CATEGORY_RESOLUTION_POLICIES[normalized] || {
      category: normalized || 'other',
      requiresEvidence: false,
      acceptedEvidenceTypes: Object.values(EVIDENCE_TYPES),
      recommendedVerification: [VERIFICATION_METHODS.PHYSICAL_INSPECTION, VERIFICATION_METHODS.CITIZEN_CONFIRMATION],
      guidance: 'Standard procedural resolution verification applies.'
    }
  );
}

/**
 * Determines whether supporting evidence is mandatory for a given category and outcome type.
 *
 * @param {string} category
 * @param {string} outcomeType
 * @returns {boolean}
 */
export function isEvidenceRequiredForResolution(category, outcomeType) {
  const policy = getCategoryResolutionPolicy(category);

  // Non-repair outcomes like NO_DEFECT_FOUND or REFERRED_EXTERNAL do not require physical proof
  if (
    outcomeType === RESOLUTION_OUTCOME_TYPES.NO_DEFECT_FOUND ||
    outcomeType === RESOLUTION_OUTCOME_TYPES.REFERRED_EXTERNAL
  ) {
    return false;
  }

  // Physical repair or restoration for evidence-mandated categories requires evidence
  return Boolean(policy.requiresEvidence);
}

/**
 * Validates a resolution payload against the CivicSarthi Resolution Quality standard.
 *
 * @param {Object} complaint - The target grievance record (read-only)
 * @param {Object} resolutionData - The resolution payload submitted for closure (read-only)
 * @param {Object} [options={}] - Optional configuration overrides (read-only)
 * @returns {Object} Stable, deterministic evaluation verdict
 */
export function validateResolutionQuality(complaint, resolutionData, options = {}) {
  // 1. Guard against null or non-object payloads
  if (!complaint || typeof complaint !== 'object') {
    return {
      valid: false,
      score: 0,
      scoreExplanation: 'Invalid complaint payload provided.',
      checklist: [],
      missingRequirements: [
        {
          id: 'REQ_PAYLOAD_VALIDITY',
          message: 'Complaint record is required and must be a valid object.'
        }
      ],
      isException: false,
      exceptionReason: null,
      justification: null,
      warnings: [],
      category: null,
      categoryGuidance: null
    };
  }

  if (!resolutionData || typeof resolutionData !== 'object') {
    const complaintCategory = complaint.category ? String(complaint.category).toLowerCase().trim() : null;
    return {
      valid: false,
      score: 0,
      scoreExplanation: 'Invalid resolution payload provided.',
      checklist: [],
      missingRequirements: [
        {
          id: 'REQ_PAYLOAD_VALIDITY',
          message: 'Resolution payload is required and must be a valid object.'
        }
      ],
      isException: false,
      exceptionReason: null,
      justification: null,
      warnings: [],
      category: complaintCategory,
      categoryGuidance: complaintCategory ? getCategoryResolutionPolicy(complaintCategory).guidance : null
    };
  }

  const category = complaint.category ? String(complaint.category).toLowerCase().trim() : 'other';
  const policy = getCategoryResolutionPolicy(category);

  // 2. Exception Flow
  // When an officer/supervisor explicitly requests a procedural exception override
  if (resolutionData.isException === true) {
    const checklist = [];
    const missingRequirements = [];

    // Exception Flag
    checklist.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_FLAG,
      label: 'Supervisory Exception Flag',
      status: 'PASSED',
      points: 20,
      maxPoints: 20,
      details: 'Supervisory exception requested explicitly.'
    });

    // Reason code verification
    const reasonCode = resolutionData.exceptionReason;
    const recognizedReason = reasonCode && RESOLUTION_EXCEPTION_REASONS[reasonCode];

    if (recognizedReason) {
      checklist.push({
        id: RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_REASON,
        label: 'Recognized Exception Reason Code',
        status: 'PASSED',
        points: 40,
        maxPoints: 40,
        details: `${recognizedReason.label}: ${recognizedReason.description}`
      });
    } else {
      checklist.push({
        id: RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_REASON,
        label: 'Recognized Exception Reason Code',
        status: 'FAILED',
        points: 0,
        maxPoints: 40,
        details: reasonCode
          ? `Unrecognized exception reason code '${reasonCode}'.`
          : 'Missing mandatory exception reason code.'
      });
      missingRequirements.push({
        id: RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_REASON,
        message:
          'A recognized exception reason code is required (e.g., CITIZEN_UNRESPONSIVE, DUPLICATE_REFERRED, OUT_OF_JURISDICTION_REFERRED, CIVIL_DISPUTE_SUB_JUDICE, FALSE_REPORT_VERIFIED, POLICY_MATTER_NO_INDIVIDUAL_RELIEF, FORCE_MAJEURE_UNFEASIBLE).'
      });
    }

    // Justification verification
    const rawJustification = typeof resolutionData.justification === 'string' ? resolutionData.justification.trim() : '';
    const minJustLen = options.minExceptionJustificationLength ?? RESOLUTION_THRESHOLDS.MIN_EXCEPTION_JUSTIFICATION_LENGTH;

    if (rawJustification.length >= minJustLen) {
      checklist.push({
        id: RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_JUSTIFICATION,
        label: 'Documented Exception Justification',
        status: 'PASSED',
        points: 40,
        maxPoints: 40,
        details: `Justification length (${rawJustification.length} chars) meets required threshold (${minJustLen} chars).`
      });
    } else {
      checklist.push({
        id: RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_JUSTIFICATION,
        label: 'Documented Exception Justification',
        status: 'FAILED',
        points: 0,
        maxPoints: 40,
        details: `Justification length (${rawJustification.length} chars) is below mandatory threshold (${minJustLen} chars).`
      });
      missingRequirements.push({
        id: RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_JUSTIFICATION,
        message: `Exception justification must be at least ${minJustLen} characters explaining why standard remediation is exempt.`
      });
    }

    const isValidException = missingRequirements.length === 0;
    const exceptionScore = isValidException ? 100 : 0;

    return {
      valid: isValidException,
      score: exceptionScore,
      scoreExplanation: isValidException
        ? 'Supervisory procedural exception granted with verified documentation.'
        : 'Supervisory procedural exception rejected due to missing or invalid documentation.',
      checklist,
      missingRequirements,
      isException: true,
      exceptionReason: reasonCode || null,
      justification: rawJustification || null,
      warnings: [],
      category,
      categoryGuidance: policy.guidance
    };
  }

  // 3. Standard Resolution Flow
  const checklist = [];
  const missingRequirements = [];
  const warnings = [];

  // Check 1: Resolution Action or Documented Outcome
  const outcomeType = resolutionData.outcomeType;
  const isActionCompleted = resolutionData.actionCompleted === true;
  const isRecognizedOutcome = outcomeType && Object.values(RESOLUTION_OUTCOME_TYPES).includes(outcomeType);

  if (isActionCompleted || isRecognizedOutcome) {
    const resolvedOutcomeLabel = outcomeType || RESOLUTION_OUTCOME_TYPES.REPAIR_COMPLETED;
    checklist.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_ACTION_OR_OUTCOME,
      label: 'Resolution Action or Outcome Documented',
      status: 'PASSED',
      points: CHECKLIST_WEIGHTS.REQ_ACTION_OR_OUTCOME,
      maxPoints: CHECKLIST_WEIGHTS.REQ_ACTION_OR_OUTCOME,
      details: `Resolution action confirmed. Outcome: ${resolvedOutcomeLabel}.`
    });
  } else {
    checklist.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_ACTION_OR_OUTCOME,
      label: 'Resolution Action or Outcome Documented',
      status: 'FAILED',
      points: 0,
      maxPoints: CHECKLIST_WEIGHTS.REQ_ACTION_OR_OUTCOME,
      details: outcomeType
        ? `Unrecognized outcomeType '${outcomeType}'.`
        : 'Neither actionCompleted (true) nor a recognized outcomeType was provided.'
    });
    missingRequirements.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_ACTION_OR_OUTCOME,
      message:
        'Resolution must confirm actionCompleted (true) or specify a recognized outcomeType (e.g., REPAIR_COMPLETED, SERVICE_RESTORED, BENEFIT_DISBURSED, ADMINISTRATIVE_ORDER_ISSUED, INSPECTION_CONFIRMED_CLEARED, NO_DEFECT_FOUND, REFERRED_EXTERNAL).'
    });
  }

  // Check 2: Outcome Verification Method
  const method = resolutionData.verificationMethod;
  const isRecognizedMethod = method && Object.values(VERIFICATION_METHODS).includes(method);

  if (isRecognizedMethod) {
    checklist.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_VERIFICATION_METHOD,
      label: 'Verification Method Documented',
      status: 'PASSED',
      points: CHECKLIST_WEIGHTS.REQ_VERIFICATION_METHOD,
      maxPoints: CHECKLIST_WEIGHTS.REQ_VERIFICATION_METHOD,
      details: `Outcome verified via ${method}.`
    });

    if (policy.recommendedVerification && !policy.recommendedVerification.includes(method)) {
      warnings.push(
        `Verification method '${method}' was accepted, but recommended methods for category '${category}' are: ${policy.recommendedVerification.join(', ')}.`
      );
    }
  } else {
    checklist.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_VERIFICATION_METHOD,
      label: 'Verification Method Documented',
      status: 'FAILED',
      points: 0,
      maxPoints: CHECKLIST_WEIGHTS.REQ_VERIFICATION_METHOD,
      details: method ? `Unrecognized verificationMethod '${method}'.` : 'No verificationMethod provided.'
    });
    missingRequirements.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_VERIFICATION_METHOD,
      message:
        'A documented verificationMethod is required (e.g., PHYSICAL_INSPECTION, CITIZEN_CONFIRMATION, SUPERVISORY_AUDIT, TELEPHONIC_VERIFICATION, SYSTEM_TELEMETRY, DOCUMENT_VERIFICATION).'
    });
  }

  // Check 3: Meaningful Closure Remarks
  const rawRemarks =
    typeof resolutionData.closureRemarks === 'string'
      ? resolutionData.closureRemarks.trim()
      : typeof resolutionData.remarks === 'string'
        ? resolutionData.remarks.trim()
        : '';

  const minRemarksLen = options.minClosureRemarksLength ?? RESOLUTION_THRESHOLDS.MIN_CLOSURE_REMARKS_LENGTH;

  if (rawRemarks.length >= minRemarksLen) {
    checklist.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS,
      label: 'Meaningful Closure Remarks Provided',
      status: 'PASSED',
      points: CHECKLIST_WEIGHTS.REQ_CLOSURE_REMARKS,
      maxPoints: CHECKLIST_WEIGHTS.REQ_CLOSURE_REMARKS,
      details: `Remarks length (${rawRemarks.length} chars) meets minimum requirement (${minRemarksLen} chars).`
    });
  } else {
    checklist.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS,
      label: 'Meaningful Closure Remarks Provided',
      status: 'FAILED',
      points: 0,
      maxPoints: CHECKLIST_WEIGHTS.REQ_CLOSURE_REMARKS,
      details: rawRemarks.length === 0
        ? 'Closure remarks are completely missing.'
        : `Closure remarks are too brief (${rawRemarks.length} / ${minRemarksLen} chars).`
    });
    missingRequirements.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS,
      message: `Closure remarks must be at least ${minRemarksLen} characters explaining specific remediation steps executed.`
    });
  }

  // Check 4: Supporting Evidence
  const evidenceRequired = isEvidenceRequiredForResolution(category, outcomeType);
  const rawEvidence = Array.isArray(resolutionData.evidence) ? resolutionData.evidence : [];

  // Filter and check for unsafe references
  let hasUnsafeReference = false;
  const safeEvidenceList = [];

  for (const ev of rawEvidence) {
    if (!isSafeEvidenceReference(ev)) {
      hasUnsafeReference = true;
    } else {
      safeEvidenceList.push(ev);
    }
  }

  if (hasUnsafeReference) {
    checklist.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE,
      label: 'Safe Supporting Evidence Referenced',
      status: 'FAILED',
      points: 0,
      maxPoints: CHECKLIST_WEIGHTS.REQ_SUPPORTING_EVIDENCE,
      details: 'One or more evidence references contained local filesystem paths or unsafe path traversal syntax.'
    });
    missingRequirements.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE,
      message:
        'Evidence references must be safe tracking identifiers or document keys, not local filesystem paths or file URIs.'
    });
  } else if (evidenceRequired) {
    const minEvidenceItems =
      options.minEvidenceItems ?? RESOLUTION_THRESHOLDS.MIN_EVIDENCE_ITEMS_FOR_PHYSICAL_REPAIR;

    if (safeEvidenceList.length >= minEvidenceItems) {
      checklist.push({
        id: RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE,
        label: 'Supporting Evidence Referenced',
        status: 'PASSED',
        points: CHECKLIST_WEIGHTS.REQ_SUPPORTING_EVIDENCE,
        maxPoints: CHECKLIST_WEIGHTS.REQ_SUPPORTING_EVIDENCE,
        details: `${safeEvidenceList.length} safe evidence reference(s) documented.`
      });
    } else {
      checklist.push({
        id: RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE,
        label: 'Supporting Evidence Referenced',
        status: 'FAILED',
        points: 0,
        maxPoints: CHECKLIST_WEIGHTS.REQ_SUPPORTING_EVIDENCE,
        details: `Supporting evidence is required for category '${category}' with outcome '${outcomeType || 'REPAIR_COMPLETED'}', but none was provided.`
      });
      missingRequirements.push({
        id: RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE,
        message: `At least ${minEvidenceItems} supporting evidence reference (e.g. photo reference, work order ID, or transaction receipt) is mandatory for category '${category}'.`
      });
    }
  } else {
    // Evidence is optional for this category / non-repair outcome
    checklist.push({
      id: RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE,
      label: 'Supporting Evidence Referenced',
      status: 'PASSED',
      points: CHECKLIST_WEIGHTS.REQ_SUPPORTING_EVIDENCE,
      maxPoints: CHECKLIST_WEIGHTS.REQ_SUPPORTING_EVIDENCE,
      details: safeEvidenceList.length > 0
        ? `${safeEvidenceList.length} optional evidence reference(s) attached.`
        : `Evidence is optional for category '${category}' with outcome '${outcomeType || 'NON_REPAIR'}'.`
    });
  }

  // 4. Score Calculation
  const totalPoints = checklist.reduce((sum, item) => sum + (item.points || 0), 0);
  const maxPossiblePoints = checklist.reduce((sum, item) => sum + (item.maxPoints || 0), 0);
  const complianceScore = maxPossiblePoints > 0 ? Math.round((totalPoints / maxPossiblePoints) * 100) : 0;
  const isValid = missingRequirements.length === 0;

  return {
    valid: isValid,
    score: complianceScore,
    scoreExplanation:
      'Procedural compliance score measures administrative checklist documentation completeness (0-100). It does not represent an automated real-world engineering or physical quality audit.',
    checklist,
    missingRequirements,
    isException: false,
    exceptionReason: null,
    justification: null,
    warnings,
    category,
    categoryGuidance: policy.guidance
  };
}
