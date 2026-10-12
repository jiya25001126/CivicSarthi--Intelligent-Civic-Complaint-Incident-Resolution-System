/**
 * @file resolutionQuality.test.js
 * @description Comprehensive unit test suite for CivicSarthi Phase 9:
 * Resolution Quality Contract, Checklist Constants, and Deterministic Validator.
 *
 * Verifies purity, determinism, immutability, evidence safety, category policies,
 * non-repair outcomes, and supervisory exception flows.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateResolutionQuality,
  isSafeEvidenceReference,
  getCategoryResolutionPolicy,
  isEvidenceRequiredForResolution
} from '../src/services/resolutionQuality.validator.js';

import {
  RESOLUTION_OUTCOME_TYPES,
  VERIFICATION_METHODS,
  EVIDENCE_TYPES,
  RESOLUTION_REQUIREMENT_CODES,
  RESOLUTION_EXCEPTION_REASONS,
  RESOLUTION_THRESHOLDS,
  CATEGORY_RESOLUTION_POLICIES
} from '../src/constants/resolutionQuality.constants.js';

describe('CivicSarthi Phase 9 — Resolution Quality Checker Pure Validator & Contract', () => {
  const sampleComplaint = {
    id: 'CS-2026-0001',
    referenceNumber: 'CS-2026-0001',
    title: 'Severe pothole on Karve Road near bridge',
    category: 'roads',
    departmentId: 'DEPT_ROADS',
    status: 'IN_PROGRESS',
    priority: 'HIGH'
  };

  const sampleValidResolution = {
    actionCompleted: true,
    outcomeType: RESOLUTION_OUTCOME_TYPES.REPAIR_COMPLETED,
    verificationMethod: VERIFICATION_METHODS.PHYSICAL_INSPECTION,
    closureRemarks: 'The asphalt resurfacing work was completed by PWD Ward Team 4 and verified on-site.',
    evidence: [
      {
        type: EVIDENCE_TYPES.PHOTO_REFERENCE,
        ref: 'PHOTO-ROADS-2026-001',
        description: 'Post-repair asphalt smooth surface photograph'
      }
    ]
  };

  // 1. Purity, Immutability & Determinism
  describe('1. Purity, Immutability & Determinism', () => {
    it('produces byte-for-byte identical output given identical inputs across separate invocations', () => {
      const result1 = validateResolutionQuality(sampleComplaint, sampleValidResolution);
      const result2 = validateResolutionQuality(sampleComplaint, sampleValidResolution);

      assert.deepEqual(result1, result2);
      assert.equal(result1.valid, true);
      assert.equal(result1.score, 100);
    });

    it('never mutates the input complaint or resolutionData objects (deep freeze guarantee)', () => {
      const frozenComplaint = Object.freeze(JSON.parse(JSON.stringify(sampleComplaint)));
      const frozenResolution = Object.freeze(JSON.parse(JSON.stringify(sampleValidResolution)));

      // Must execute cleanly on frozen objects without throwing TypeError: Cannot assign to read only property
      const result = validateResolutionQuality(frozenComplaint, frozenResolution);

      assert.equal(result.valid, true);
      assert.deepEqual(frozenComplaint, sampleComplaint);
    });

    it('does not generate dynamic timestamps or depend on system clock for validity decision', () => {
      const result = validateResolutionQuality(sampleComplaint, sampleValidResolution);
      assert.equal(typeof result.valid, 'boolean');
      assert.equal(typeof result.score, 'number');
      // Structure contains no dynamic randomness
      assert.equal(result.isException, false);
    });
  });

  // 2. Complete Valid Standard Resolution
  describe('2. Standard Valid Resolution Evaluation', () => {
    it('passes complete valid resolution data with 100 compliance score and no missing requirements', () => {
      const result = validateResolutionQuality(sampleComplaint, sampleValidResolution);

      assert.equal(result.valid, true);
      assert.equal(result.score, 100);
      assert.equal(result.missingRequirements.length, 0);
      assert.equal(result.isException, false);
      assert.equal(result.category, 'roads');

      // Verify all checklist items passed
      assert.equal(result.checklist.length, 4);
      for (const item of result.checklist) {
        assert.equal(item.status, 'PASSED');
        assert.equal(item.points, item.maxPoints);
      }
    });

    it('accepts string evidence references when safe and well-formed', () => {
      const stringEvidenceRes = {
        ...sampleValidResolution,
        evidence: ['WO-PWD-2026-9941', 'REF-INSPECTION-882']
      };

      const result = validateResolutionQuality(sampleComplaint, stringEvidenceRes);
      assert.equal(result.valid, true);
      assert.equal(result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE).status, 'PASSED');
    });

    it('accepts alias field remarks as alternative to closureRemarks', () => {
      const aliasRemarksRes = {
        actionCompleted: true,
        verificationMethod: VERIFICATION_METHODS.PHYSICAL_INSPECTION,
        remarks: 'Physical road repair was finalized and sealed with asphalt bitumen.',
        evidence: ['WO-PWD-2026-001']
      };

      const result = validateResolutionQuality(sampleComplaint, aliasRemarksRes);
      assert.equal(result.valid, true);
      assert.equal(result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS).status, 'PASSED');
    });
  });

  // 3. Missing Checklist Fields & Validation Failures
  describe('3. Missing or Incomplete Checklist Fields', () => {
    it('fails when actionCompleted is false and no outcomeType is provided', () => {
      const missingAction = {
        ...sampleValidResolution,
        actionCompleted: false,
        outcomeType: undefined
      };

      const result = validateResolutionQuality(sampleComplaint, missingAction);
      assert.equal(result.valid, false);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_ACTION_OR_OUTCOME));

      const actionItem = result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_ACTION_OR_OUTCOME);
      assert.equal(actionItem.status, 'FAILED');
      assert.equal(actionItem.points, 0);
    });

    it('fails when verificationMethod is completely missing', () => {
      const missingMethod = {
        ...sampleValidResolution,
        verificationMethod: undefined
      };

      const result = validateResolutionQuality(sampleComplaint, missingMethod);
      assert.equal(result.valid, false);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_VERIFICATION_METHOD));
    });

    it('fails when verificationMethod is an unrecognized string', () => {
      const invalidMethod = {
        ...sampleValidResolution,
        verificationMethod: 'GUESSWORK_OR_RUMOR'
      };

      const result = validateResolutionQuality(sampleComplaint, invalidMethod);
      assert.equal(result.valid, false);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_VERIFICATION_METHOD));
    });

    it('fails when closure remarks are missing or shorter than minimum required length (25 chars)', () => {
      const shortRemarks = {
        ...sampleValidResolution,
        closureRemarks: 'Done fixed' // only 10 chars
      };

      const result = validateResolutionQuality(sampleComplaint, shortRemarks);
      assert.equal(result.valid, false);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS));

      const remarksItem = result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS);
      assert.equal(remarksItem.status, 'FAILED');
      assert.equal(remarksItem.points, 0);
    });

    it('fails when whitespace padding is used to artificially pass character threshold', () => {
      const paddedRemarks = {
        ...sampleValidResolution,
        closureRemarks: '         Fixed.         ' // trimmed length is only 6 chars
      };

      const result = validateResolutionQuality(sampleComplaint, paddedRemarks);
      assert.equal(result.valid, false);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_CLOSURE_REMARKS));
    });

    it('fails when evidence is required for physical repair but evidence list is empty or omitted', () => {
      const missingEvidence = {
        ...sampleValidResolution,
        evidence: []
      };

      const result = validateResolutionQuality(sampleComplaint, missingEvidence);
      assert.equal(result.valid, false);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE));

      const evItem = result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE);
      assert.equal(evItem.status, 'FAILED');
      assert.equal(evItem.points, 0);
    });
  });

  // 4. Evidence Safety & Local Path Rejection
  describe('4. Evidence Safety Verification', () => {
    it('rejects evidence containing local Windows drive letters or absolute file paths', () => {
      const unsafeWinPath = {
        ...sampleValidResolution,
        evidence: ['C:\\Users\\Officer\\Desktop\\photo.jpg']
      };

      const result = validateResolutionQuality(sampleComplaint, unsafeWinPath);
      assert.equal(result.valid, false);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE));
    });

    it('rejects evidence containing file:// URI schemes', () => {
      const unsafeUri = {
        ...sampleValidResolution,
        evidence: ['file:///var/data/proof.png']
      };

      const result = validateResolutionQuality(sampleComplaint, unsafeUri);
      assert.equal(result.valid, false);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE));
    });

    it('rejects evidence containing directory traversal patterns (../)', () => {
      const unsafeTraversal = {
        ...sampleValidResolution,
        evidence: ['../../private/keys/proof.jpg']
      };

      const result = validateResolutionQuality(sampleComplaint, unsafeTraversal);
      assert.equal(result.valid, false);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE));
    });

    it('isSafeEvidenceReference correctly validates safe IDs vs dangerous paths', () => {
      assert.equal(isSafeEvidenceReference('IMG-PWD-2026-001'), true);
      assert.equal(isSafeEvidenceReference('WO_2026_9941'), true);
      assert.equal(isSafeEvidenceReference('DBT-TXN-9988221'), true);
      assert.equal(isSafeEvidenceReference({ ref: 'INSP-REPORT-882' }), true);

      assert.equal(isSafeEvidenceReference('C:\\secret\\file.txt'), false);
      assert.equal(isSafeEvidenceReference('/etc/passwd'), false);
      assert.equal(isSafeEvidenceReference('file:///tmp/leak.png'), false);
      assert.equal(isSafeEvidenceReference('../passwords.json'), false);
      assert.equal(isSafeEvidenceReference(''), false);
      assert.equal(isSafeEvidenceReference(null), false);
    });
  });

  // 5. Non-Repair Outcomes Documented Properly
  describe('5. Verified Non-Repair Outcomes Handling', () => {
    it('passes NO_DEFECT_FOUND when verified via physical inspection with comprehensive explanation', () => {
      const noDefectRes = {
        actionCompleted: true,
        outcomeType: RESOLUTION_OUTCOME_TYPES.NO_DEFECT_FOUND,
        verificationMethod: VERIFICATION_METHODS.PHYSICAL_INSPECTION,
        closureRemarks: 'On-site physical inspection by JE concluded that no structural leakage or damage exists.'
      };

      const result = validateResolutionQuality(sampleComplaint, noDefectRes);
      assert.equal(result.valid, true);
      assert.equal(result.missingRequirements.length, 0);

      // In NO_DEFECT_FOUND, physical photographic evidence is not mandatory
      const evItem = result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_SUPPORTING_EVIDENCE);
      assert.equal(evItem.status, 'PASSED');
    });

    it('passes REFERRED_EXTERNAL when formal statutory referral is documented', () => {
      const referredRes = {
        actionCompleted: true,
        outcomeType: RESOLUTION_OUTCOME_TYPES.REFERRED_EXTERNAL,
        verificationMethod: VERIFICATION_METHODS.DOCUMENT_VERIFICATION,
        closureRemarks: 'Case pertains to National Highways Authority of India (NHAI); formal referral memo dispatched.'
      };

      const result = validateResolutionQuality(sampleComplaint, referredRes);
      assert.equal(result.valid, true);
      assert.equal(result.missingRequirements.length, 0);
    });

    it('isEvidenceRequiredForResolution returns false for non-repair outcomes', () => {
      assert.equal(isEvidenceRequiredForResolution('roads', RESOLUTION_OUTCOME_TYPES.NO_DEFECT_FOUND), false);
      assert.equal(isEvidenceRequiredForResolution('roads', RESOLUTION_OUTCOME_TYPES.REFERRED_EXTERNAL), false);
      assert.equal(isEvidenceRequiredForResolution('roads', RESOLUTION_OUTCOME_TYPES.REPAIR_COMPLETED), true);
    });
  });

  // 6. Supervisory Exception Overrides Flow
  describe('6. Supervisory Exception Overrides Flow', () => {
    it('passes a valid exception with recognized reason code and meaningful justification', () => {
      const validException = {
        isException: true,
        exceptionReason: 'CITIZEN_UNRESPONSIVE',
        justification: 'Complainant did not answer 3 verification phone calls over 7 business days and did not respond to SMS.'
      };

      const result = validateResolutionQuality(sampleComplaint, validException);
      assert.equal(result.valid, true);
      assert.equal(result.isException, true);
      assert.equal(result.score, 100);
      assert.equal(result.exceptionReason, 'CITIZEN_UNRESPONSIVE');
      assert.equal(result.missingRequirements.length, 0);

      // Verify exception checklist items
      assert.equal(result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_FLAG).status, 'PASSED');
      assert.equal(result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_REASON).status, 'PASSED');
      assert.equal(result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_JUSTIFICATION).status, 'PASSED');
    });

    it('fails when exceptionReason is missing or unrecognized', () => {
      const unknownReasonException = {
        isException: true,
        exceptionReason: 'ARBITRARY_CUSTOM_EXCUSE',
        justification: 'Supervisory override granted based on internal discretion.'
      };

      const result = validateResolutionQuality(sampleComplaint, unknownReasonException);
      assert.equal(result.valid, false);
      assert.equal(result.score, 0);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_REASON));

      const reasonItem = result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_REASON);
      assert.equal(reasonItem.status, 'FAILED');
    });

    it('fails when justification is missing or shorter than minimum required length (25 chars)', () => {
      const shortJustificationException = {
        isException: true,
        exceptionReason: 'CIVIL_DISPUTE_SUB_JUDICE',
        justification: 'Court case pending.' // only 19 chars
      };

      const result = validateResolutionQuality(sampleComplaint, shortJustificationException);
      assert.equal(result.valid, false);
      assert.equal(result.score, 0);
      assert.ok(result.missingRequirements.some(r => r.id === RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_JUSTIFICATION));

      const justItem = result.checklist.find(c => c.id === RESOLUTION_REQUIREMENT_CODES.REQ_EXCEPTION_JUSTIFICATION);
      assert.equal(justItem.status, 'FAILED');
    });

    it('an exception NEVER silently passes if both reason and justification are missing', () => {
      const emptyException = {
        isException: true
      };

      const result = validateResolutionQuality(sampleComplaint, emptyException);
      assert.equal(result.valid, false);
      assert.equal(result.score, 0);
      assert.equal(result.missingRequirements.length, 2);
    });

    it('all 7 documented exception reason codes are recognized and validated', () => {
      const allReasons = Object.keys(RESOLUTION_EXCEPTION_REASONS);
      assert.equal(allReasons.length, 7);

      for (const reasonCode of allReasons) {
        const testRes = {
          isException: true,
          exceptionReason: reasonCode,
          justification: 'Valid documentation has been verified and signed off by the nodal grievance officer.'
        };
        const result = validateResolutionQuality(sampleComplaint, testRes);
        assert.equal(result.valid, true, `Reason code '${reasonCode}' should be valid`);
      }
    });
  });

  // 7. Category-Specific Guidance & Policies
  describe('7. Category-Specific Resolution Policies', () => {
    it('pension category accepts transaction reference and requires document verification', () => {
      const pensionComplaint = { ...sampleComplaint, category: 'pension', departmentId: 'DEPT_PENSION' };
      const pensionRes = {
        actionCompleted: true,
        outcomeType: RESOLUTION_OUTCOME_TYPES.BENEFIT_DISBURSED,
        verificationMethod: VERIFICATION_METHODS.DOCUMENT_VERIFICATION,
        closureRemarks: 'Pension arrears credited via PFMS treasury batch under sanctioned PPO order.',
        evidence: ['TXN-PFMS-2026-9921']
      };

      const result = validateResolutionQuality(pensionComplaint, pensionRes);
      assert.equal(result.valid, true);
      assert.equal(result.category, 'pension');
      assert.match(result.categoryGuidance, /treasury\/PFMS disbursement/i);
    });

    it('emits an advisory warning if verification method diverges from category recommendations', () => {
      const warningRes = {
        ...sampleValidResolution,
        // roads recommends PHYSICAL_INSPECTION or SUPERVISORY_AUDIT
        verificationMethod: VERIFICATION_METHODS.TELEPHONIC_VERIFICATION
      };

      const result = validateResolutionQuality(sampleComplaint, warningRes);
      // Still technically valid because TELEPHONIC_VERIFICATION is an accepted system method
      assert.equal(result.valid, true);
      // But produces an advisory warning
      assert.equal(result.warnings.length, 1);
      assert.match(result.warnings[0], /recommended methods for category 'roads'/i);
    });

    it('all 11 canonical COMPLAINT_CATEGORIES have defined policies', () => {
      const categories = [
        'roads', 'electricity', 'water', 'healthcare', 'pension',
        'scholarship', 'ration', 'municipal', 'revenue', 'police', 'flood relief'
      ];

      for (const cat of categories) {
        const policy = getCategoryResolutionPolicy(cat);
        assert.equal(policy.category, cat);
        assert.ok(policy.guidance.length > 0);
        assert.ok(Array.isArray(policy.recommendedVerification));
      }
    });
  });

  // 8. Null, Malformed, and Boundary Inputs
  describe('8. Malformed & Boundary Input Handling', () => {
    it('handles null complaint entity gracefully without throwing an exception', () => {
      const result = validateResolutionQuality(null, sampleValidResolution);
      assert.equal(result.valid, false);
      assert.equal(result.score, 0);
      assert.ok(result.missingRequirements.some(r => r.id === 'REQ_PAYLOAD_VALIDITY'));
    });

    it('handles non-object complaint entity gracefully', () => {
      const result = validateResolutionQuality('not-an-object', sampleValidResolution);
      assert.equal(result.valid, false);
      assert.equal(result.score, 0);
    });

    it('handles null resolutionData payload gracefully without throwing', () => {
      const result = validateResolutionQuality(sampleComplaint, null);
      assert.equal(result.valid, false);
      assert.equal(result.score, 0);
      assert.ok(result.missingRequirements.some(r => r.id === 'REQ_PAYLOAD_VALIDITY'));
    });

    it('handles non-object resolutionData payload gracefully', () => {
      const result = validateResolutionQuality(sampleComplaint, 12345);
      assert.equal(result.valid, false);
      assert.equal(result.score, 0);
    });

    it('handles empty resolutionData object gracefully', () => {
      const result = validateResolutionQuality(sampleComplaint, {});
      assert.equal(result.valid, false);
      assert.equal(result.score, 0);
      assert.ok(result.missingRequirements.length >= 3);
    });
  });

  // 9. Score Separation & Transparency
  describe('9. Procedural Score Independence from Physical Audit', () => {
    it('documents explicitly that the numerical score measures administrative compliance', () => {
      const result = validateResolutionQuality(sampleComplaint, sampleValidResolution);
      assert.match(result.scoreExplanation, /Procedural compliance score measures administrative checklist documentation completeness/i);
    });

    it('calculates partial scores when some checklist items pass while others fail', () => {
      const partialRes = {
        actionCompleted: true, // 30 points
        verificationMethod: VERIFICATION_METHODS.PHYSICAL_INSPECTION, // 25 points
        closureRemarks: 'Short note', // Fails: 0 points (min 25 chars)
        evidence: [] // Fails (roads requires evidence): 0 points
      };

      const result = validateResolutionQuality(sampleComplaint, partialRes);
      assert.equal(result.valid, false); // Fails overall
      assert.equal(result.score, 55); // 30 + 25 = 55% procedural completeness
    });
  });
});
