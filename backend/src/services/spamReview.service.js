/**
 * @file spamReview.service.js
 * @description Human-in-the-Loop review queue service for
 * CivicSarthi Phase 11: Spam/Fake Complaint Detection with Human Review.
 */

import { spamReviewRepository } from '../repositories/spamReview.repository.js';
import { complaintRepository } from '../repositories/complaint.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { citizenReputationService } from './citizenReputation.service.js';
import { SPAM_REVIEW_OUTCOMES, SPAM_REVIEW_STATUS } from '../constants/spam.constants.js';

export class SpamReviewService {
  constructor(
    spamReviewRepo = spamReviewRepository,
    complaintRepo = complaintRepository,
    reputationService = citizenReputationService,
    auditRepo = auditLogRepository
  ) {
    this.spamReviewRepo = spamReviewRepo;
    this.complaintRepo = complaintRepo;
    this.reputationService = reputationService;
    this.auditRepo = auditRepo;
  }

  /**
   * Lists flagged complaints awaiting or completed human review with department scoping
   */
  async listFlaggedComplaints(filters = {}, user) {
    if (!user || user.role === 'citizen') {
      const err = new Error('Access denied: citizens are not authorized to access internal review desks');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const queryFilters = { ...filters };

    // Enforce strict department boundary on officers
    if (user.role === 'officer') {
      queryFilters.departmentId = user.departmentId;
    }

    return this.spamReviewRepo.findAll(queryFilters);
  }

  /**
   * Retrieves full review detail for an authorized officer or admin
   */
  async getReviewDetail(idOrRef, user) {
    if (!user || user.role === 'citizen') {
      const err = new Error('Access denied: internal screening details are restricted to authorized reviewers');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    let review = await this.spamReviewRepo.findById(idOrRef);
    if (!review) {
      review = await this.spamReviewRepo.findByComplaintId(idOrRef);
    }

    if (!review) {
      const err = new Error('Review record not found');
      err.status = 404;
      err.code = 'REVIEW_NOT_FOUND';
      throw err;
    }

    // Department authority check
    if (user.role === 'officer' && user.departmentId && review.departmentId !== user.departmentId) {
      const err = new Error(
        `Access denied: review record belongs to department '${review.departmentId}' which is outside your authorized department scope`
      );
      err.status = 403;
      err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
      throw err;
    }

    // Attach complaint and reputation context
    const complaint = await this.complaintRepo.findById(review.complaintId);
    let reputation = null;
    try {
      reputation = await this.reputationService.getReputation(review.citizenId, user);
    } catch {}

    return {
      ...review,
      complaint: complaint ? {
        id: complaint.id,
        referenceNumber: complaint.referenceNumber,
        title: complaint.title,
        description: complaint.description || complaint.text,
        category: complaint.category,
        locality: complaint.locality,
        status: complaint.status,
        createdAt: complaint.createdAt,
        screeningResult: complaint.screeningResult || null
      } : null,
      citizenReputation: reputation ? {
        standing: reputation.standing,
        score: reputation.score,
        totalSubmissions: reputation.totalSubmissions,
        confirmedAbuseCount: reputation.confirmedAbuseCount
      } : null
    };
  }

  /**
   * Records an explicit human adjudication decision on a flagged complaint
   */
  async recordReviewDecision(idOrRef, { outcome, decision, reason, decisionReason }, user) {
    if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
      const err = new Error('Access denied: only authorized officers or administrators can decide review cases');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    let review = await this.spamReviewRepo.findById(idOrRef);
    if (!review) {
      review = await this.spamReviewRepo.findByComplaintId(idOrRef);
    }

    if (!review) {
      const err = new Error('Review record not found');
      err.status = 404;
      err.code = 'REVIEW_NOT_FOUND';
      throw err;
    }

    // Department boundary check
    if (user.role === 'officer' && user.departmentId && review.departmentId !== user.departmentId) {
      const err = new Error(
        `Access denied: review record belongs to department '${review.departmentId}' which is outside your authorized department scope`
      );
      err.status = 403;
      err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
      throw err;
    }

    // Outcome normalization & validation
    const finalOutcome = outcome || decision;
    if (!Object.values(SPAM_REVIEW_OUTCOMES).includes(finalOutcome)) {
      const err = new Error(
        `Invalid review outcome. Allowed outcomes: ${Object.values(SPAM_REVIEW_OUTCOMES).join(', ')}`
      );
      err.status = 400;
      err.code = 'INVALID_OUTCOME';
      throw err;
    }

    // Mandatory reason validation
    const cleanReason = String(reason || decisionReason || '').trim();
    if (cleanReason.length < 10) {
      const err = new Error('A detailed review decision explanation of at least 10 characters is mandatory');
      err.status = 400;
      err.code = 'DECISION_REASON_TOO_SHORT';
      throw err;
    }

    // Prevent duplicate decision on already-completed reviews unless admin correction
    if (review.reviewStatus === SPAM_REVIEW_STATUS.REVIEWED && review.decision?.outcome === finalOutcome) {
      const err = new Error(`Review case is already adjudicated with outcome '${finalOutcome}'`);
      err.status = 400;
      err.code = 'CASE_ALREADY_ADJUDICATED';
      throw err;
    }

    // 1. Record decision on review queue record
    const updatedReview = await this.spamReviewRepo.recordDecision(review.id, {
      outcome: finalOutcome,
      reason: cleanReason,
      reviewerId: user.id,
      reviewerRole: user.role
    });

    // 2. Synchronize complaint state
    try {
      const complaint = await this.complaintRepo.findById(review.complaintId);
      if (complaint && typeof this.complaintRepo.update === 'function') {
        const isFlagged = finalOutcome === SPAM_REVIEW_OUTCOMES.CONFIRMED_ABUSE;
        const currentScreening = complaint.screeningResult || {};
        await this.complaintRepo.update(complaint.id, {
          isFlaggedSpam: isFlagged,
          screeningResult: {
            ...currentScreening,
            reviewStatus: finalOutcome,
            reviewedAt: new Date().toISOString(),
            reviewerId: user.id,
            reviewReason: cleanReason
          }
        });
      }
    } catch (cmpErr) {
      console.warn('[SpamReviewService] Non-fatal complaint update warning:', cmpErr.message);
    }

    // 3. Update citizen reputation
    try {
      await this.reputationService.applyReviewOutcome(
        review.citizenId,
        review.complaintId,
        finalOutcome,
        user,
        cleanReason
      );
    } catch (repErr) {
      console.warn('[SpamReviewService] Non-fatal reputation update warning:', repErr.message);
    }

    // 4. Audit logging
    try {
      await this.auditRepo.create({
        action: 'HUMAN_SPAM_REVIEW_DECISION',
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        targetResource: review.id,
        details: {
          complaintId: review.complaintId,
          outcome: finalOutcome,
          reason: cleanReason,
          previousRiskLevel: review.riskLevel
        }
      });
    } catch (auditErr) {
      console.warn('[SpamReviewService] Non-fatal audit log warning:', auditErr.message);
    }

    return updatedReview;
  }

  /**
   * Manually flags a complaint for Spam/Abuse human review by an authorized officer or admin.
   * Creates or updates the spam review queue record without duplicate active flags.
   */
  async flagComplaintManually(complaintIdOrRef, { reason, reasonCode, notes }, user) {
    if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
      const err = new Error('Access denied: only authorized officers or administrators can flag complaints for review');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const cleanReason = String(notes || reason || '').trim();
    if (cleanReason.length < 10) {
      const err = new Error('A detailed explanation of at least 10 characters is required for flagging a complaint');
      err.status = 400;
      err.code = 'FLAG_REASON_TOO_SHORT';
      throw err;
    }

    const complaint = await this.complaintRepo.findById(complaintIdOrRef);
    if (!complaint) {
      const err = new Error('Complaint record not found');
      err.status = 404;
      err.code = 'COMPLAINT_NOT_FOUND';
      throw err;
    }

    // Officer department scoping:
    if (user.role === 'officer' && user.departmentId) {
      const cmpDept = complaint.departmentId || complaint.department;
      if (cmpDept && cmpDept !== user.departmentId) {
        const err = new Error(
          `Access denied: complaint belongs to department '${cmpDept}' which is outside your authorized department scope`
        );
        err.status = 403;
        err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
        throw err;
      }
    }

    // Check for existing active spam review for this complaint
    let existingReview = await this.spamReviewRepo.findByComplaintId(complaint.id);
    if (!existingReview && complaint.referenceNumber && complaint.referenceNumber !== complaint.id) {
      existingReview = await this.spamReviewRepo.findByComplaintId(complaint.referenceNumber);
    }

    const now = new Date();
    const reasonText = reasonCode ? `[${reasonCode}] ${cleanReason}` : cleanReason;

    if (existingReview && (existingReview.reviewStatus === SPAM_REVIEW_STATUS.PENDING || existingReview.reviewStatus === 'PENDING_REVIEW')) {
      const err = new Error('Complaint is already queued under an active spam review. Cannot submit duplicate active review.');
      err.status = 409;
      err.code = 'ACTIVE_REVIEW_EXISTS';
      err.existingReviewId = existingReview.id;
      throw err;
    }

    // Create a new spam review record
    const reviewId = `REV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const newRecord = {
      id: reviewId,
      complaintId: complaint.id,
      complaintReference: complaint.referenceNumber || complaint.id,
      citizenId: complaint.citizenId || 'UNKNOWN',
      departmentId: complaint.departmentId || complaint.department || user.departmentId || 'GENERAL',
      riskLevel: 'HIGH',
      score: 75,
      reasons: [reasonText],
      explanations: [cleanReason],
      reviewStatus: SPAM_REVIEW_STATUS.PENDING,
      decision: null,
      duplicateReferences: [],
      ruleVersion: '1.0.0',
      evaluatedAt: now,
      reviewHistory: [
        {
          action: 'MANUAL_OFFICER_FLAG',
          reason: cleanReason,
          actorId: user.id,
          actorRole: user.role,
          timestamp: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    const savedReview = await this.spamReviewRepo.create(newRecord);

    // Update complaint record to mark isFlaggedSpam: true and link spamReviewId
    try {
      if (typeof this.complaintRepo.update === 'function') {
        await this.complaintRepo.update(complaint.id, {
          isFlaggedSpam: true,
          spamReviewId: reviewId
        });
      }
    } catch (cmpErr) {
      console.warn('[SpamReviewService] Non-fatal complaint update warning:', cmpErr.message);
    }

    // Audit logging
    try {
      await this.auditRepo.create({
        action: 'MANUAL_SPAM_FLAG_INITIATED',
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        targetResource: reviewId,
        complaintId: complaint.id,
        details: {
          complaintId: complaint.id,
          complaintReference: complaint.referenceNumber || complaint.id,
          reasonCode: reasonCode || 'MANUAL_FLAG',
          reason: cleanReason
        }
      });
    } catch (auditErr) {
      console.warn('[SpamReviewService] Non-fatal audit log warning:', auditErr.message);
    }

    return {
      success: true,
      message: 'Complaint successfully flagged for spam & abuse investigation',
      review: savedReview,
      id: savedReview.id,
      complaintId: savedReview.complaintId,
      reviewStatus: savedReview.reviewStatus,
      reasons: savedReview.reasons
    };
  }
}

export const spamReviewService = new SpamReviewService();
export default spamReviewService;

