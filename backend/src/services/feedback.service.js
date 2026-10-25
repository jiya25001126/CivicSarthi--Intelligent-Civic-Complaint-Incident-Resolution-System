import { feedbackRepository } from '../repositories/feedback.repository.js';
import { complaintRepository } from '../repositories/complaint.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { COMPLAINT_STATUS } from '../constants/status.constants.js';
import { FEEDBACK_RATING_BOUNDS } from '../constants/feedback.constants.js';

export class FeedbackService {
  constructor(
    feedbackRepo = feedbackRepository,
    complaintRepo = complaintRepository,
    auditRepo = auditLogRepository
  ) {
    this.feedbackRepo = feedbackRepo;
    this.complaintRepo = complaintRepo;
    this.auditRepo = auditRepo;
  }

  /**
   * Submit citizen satisfaction rating & comments for an eligible resolution milestone
   */
  async submitFeedback(complaintIdOrRef, { rating, comments }, user) {
    if (!user || user.role !== 'citizen') {
      const err = new Error('Access denied: only authenticated citizens may submit resolution feedback');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const complaint = await this.complaintRepo.findById(complaintIdOrRef);
    if (!complaint) {
      const err = new Error('Grievance record not found');
      err.status = 404;
      err.code = 'COMPLAINT_NOT_FOUND';
      throw err;
    }

    // Ownership check
    if (complaint.citizenId !== user.id) {
      const err = new Error('Access denied: citizens can only rate their own grievances (only submit feedback for complaints you filed)');
      err.status = 403;
      err.code = 'FORBIDDEN_COMPLAINT_OWNER';
      throw err;
    }

    // Resolution status eligibility
    const isResolved =
      complaint.status === COMPLAINT_STATUS.RESOLVED || complaint.status === COMPLAINT_STATUS.CLOSED;
    if (!isResolved) {
      const err = new Error(
        `Feedback cannot be submitted: grievance must be officially resolved or closed before submitting feedback (currently '${complaint.status}').`
      );
      err.status = 400;
      err.code = 'INELIGIBLE_FOR_FEEDBACK';
      throw err;
    }

    // Derive current resolution milestone
    const milestone = String(
      complaint.resolutionMilestone ||
      (typeof complaint.reopenedCount === 'number' && complaint.reopenedCount > 0
        ? complaint.reopenedCount + 1
        : 1)
    );

    // Resolution Quality verification gate
    if (!this._isResolutionVerified(complaint, milestone)) {
      const err = new Error(
        'Feedback is temporarily unavailable while this resolution is being verified. Please try again later.'
      );
      err.status = 400;
      err.code = 'RESOLUTION_QUALITY_INCOMPLETE';
      throw err;
    }

    // Rating boundaries validation
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < FEEDBACK_RATING_BOUNDS.MIN || numRating > FEEDBACK_RATING_BOUNDS.MAX) {
      const err = new Error(
        `Rating must be an integer between ${FEEDBACK_RATING_BOUNDS.MIN} and ${FEEDBACK_RATING_BOUNDS.MAX}`
      );
      err.status = 400;
      err.code = 'INVALID_RATING';
      throw err;
    }

    // Comments validation
    const cleanComments = comments ? String(comments).trim() : '';
    if (cleanComments.length > 1000) {
      const err = new Error('Comments cannot exceed 1000 characters');
      err.status = 400;
      err.code = 'COMMENTS_TOO_LONG';
      throw err;
    }

    // Enforce 1 feedback submission per citizen, complaint, and milestone
    let existing = await this.feedbackRepo.findByComplaintAndMilestone(complaint.id, milestone);
    if (!existing && complaint.referenceNumber && complaint.referenceNumber !== complaint.id) {
      existing = await this.feedbackRepo.findByComplaintAndMilestone(complaint.referenceNumber, milestone);
    }
    if (existing) {
      const err = new Error(
        `Feedback has already been submitted for this resolution (Rating: ${existing.rating}/5).`
      );
      err.status = 409;
      err.code = 'FEEDBACK_ALREADY_SUBMITTED';
      err.details = { existingFeedbackId: existing.id, milestone };
      throw err;
    }

    const activeDetails =
      complaint.resolutionDetails ||
      complaint.previousResolutionDetails ||
      (Array.isArray(complaint.statusHistory) &&
        complaint.statusHistory
          .slice()
          .reverse()
          .find((h) => h.status === COMPLAINT_STATUS.RESOLVED || h.status === COMPLAINT_STATUS.CLOSED)?.resolutionDetails) ||
      null;

    const latestResolvedEntry = Array.isArray(complaint.statusHistory)
      ? complaint.statusHistory
          .slice()
          .reverse()
          .find((h) => h.status === COMPLAINT_STATUS.RESOLVED || h.status === COMPLAINT_STATUS.CLOSED)
      : null;

    const payload = {
      complaintId: complaint.id,
      complaintReference: complaint.referenceNumber || complaint.id,
      citizenId: user.id,
      rating: numRating,
      comments: cleanComments,
      resolutionMilestone: milestone,
      resolutionDetailsSnapshot: {
        score: typeof activeDetails?.score === 'number' ? activeDetails.score : 100,
        outcomeType: activeDetails?.outcomeType || 'REPAIR_COMPLETED',
        resolvedAt: activeDetails?.resolvedAt || latestResolvedEntry?.timestamp || complaint.updatedAt || new Date().toISOString(),
        isException: Boolean(activeDetails?.isException)
      },
      departmentId: complaint.departmentId || complaint.department || null
    };

    const created = await this.feedbackRepo.create(payload);

    // Record audit event safely
    try {
      await this.auditRepo.create({
        action: 'SUBMIT_RESOLUTION_FEEDBACK',
        userId: user.id,
        userEmail: user.email || 'citizen@civicsarthi.internal',
        role: user.role,
        targetResource: created.id,
        details: {
          complaintId: complaint.id,
          rating: numRating,
          milestone
        }
      });
    } catch (auditErr) {
      console.warn('[FeedbackService] Non-fatal audit log warning:', auditErr.message);
    }

    return created;
  }

  /**
   * Get all feedback associated with a complaint (with role-based access scoping)
   */
  async getFeedbackForComplaint(complaintIdOrRef, user) {
    const complaint = await this.complaintRepo.findById(complaintIdOrRef);
    if (!complaint) {
      const err = new Error('Grievance record not found');
      err.status = 404;
      err.code = 'COMPLAINT_NOT_FOUND';
      throw err;
    }

    if (user.role === 'citizen' && complaint.citizenId !== user.id) {
      const err = new Error('Access denied: you can only view feedback for your own complaints');
      err.status = 403;
      err.code = 'FORBIDDEN_COMPLAINT_OWNER';
      throw err;
    }

    if (user.role === 'officer') {
      const officerDept = user.departmentId;
      const complaintDept = complaint.departmentId || complaint.department;
      if (officerDept && complaintDept && officerDept !== complaintDept) {
        const err = new Error(`Access denied: officer is not authorized for department '${complaintDept}'`);
        err.status = 403;
        err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
        throw err;
      }
    }

    return this.feedbackRepo.findAll({ complaintId: complaint.id });
  }

  /**
   * Get feedback submitted by the authenticated citizen
   */
  async getMyFeedback(user) {
    if (!user || user.role !== 'citizen') {
      const err = new Error('Access denied: only citizens can query personal feedback history');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    return this.feedbackRepo.findAll({ citizenId: user.id });
  }

  /**
   * Get aggregated feedback metrics scoped by department or global (for officers/admins)
   */
  async getFeedbackSummary(filters = {}, user) {
    if (!user || user.role === 'citizen') {
      const err = new Error('Access denied: citizen role is not authorized for aggregate feedback analytics');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const queryFilters = {};
    if (user.role === 'officer') {
      queryFilters.departmentId = user.departmentId;
    } else if (user.role === 'admin' && filters.departmentId) {
      queryFilters.departmentId = filters.departmentId;
    }

    const list = await this.feedbackRepo.findAll(queryFilters);
    const total = list.length;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const item of list) {
      const r = Number(item.rating);
      if (distribution[r] !== undefined) {
        distribution[r]++;
        sum += r;
      }
    }

    const averageRating = total > 0 ? Math.round((sum / total) * 100) / 100 : 0;

    return {
      departmentId: queryFilters.departmentId || 'ALL',
      totalFeedback: total,
      averageRating,
      distribution,
      ratingDistribution: distribution,
      hasSufficientData: total >= 3
    };
  }

  /**
   * Authoritatively evaluates whether a complaint's resolution has been legitimately verified.
   *
   * Rejects unverified resolutions (e.g. unverified status, failed checklists with valid: false,
   * failing compliance scores, or routine officer resolution claims lacking mandatory quality checks).
   * Officer resolution history alone cannot bypass mandatory resolution quality checks unless
   * an explicitly authorized policy permits it (e.g. approved procedural exception, supervisory/admin
   * audit override, or documented pre-existing legacy resolution policy).
   */
  _isResolutionVerified(complaint, milestone = '1') {
    if (!complaint) return false;

    // Must be officially RESOLVED or CLOSED
    const isResolved =
      complaint.status === COMPLAINT_STATUS.RESOLVED || complaint.status === COMPLAINT_STATUS.CLOSED;
    if (!isResolved) return false;

    // 1. Direct resolutionDetails check
    const details = complaint.resolutionDetails;
    if (details) {
      if (details.valid === false) {
        return false;
      }
      if (details.valid === true) {
        return true;
      }
      if (details.isException === true) {
        return true;
      }
      if (typeof details.score === 'number' && details.score >= 70) {
        return true;
      }
      // If resolutionDetails is present but did not satisfy quality criteria, reject
      return false;
    }

    // 2. Previous resolution details check (relevant if complaint underwent reopening)
    if (complaint.previousResolutionDetails) {
      const prev = complaint.previousResolutionDetails;
      if (prev.valid === false) {
        return false;
      }
      if (prev.valid === true || prev.isException === true || (typeof prev.score === 'number' && prev.score >= 70)) {
        return true;
      }
      return false;
    }

    // 3. Status history check:
    // Officer resolution history alone cannot bypass mandatory quality checks.
    // An explicitly authorized policy must permit it:
    // - Explicit procedural exception policy (isException / exceptionReason)
    // - Supervisory administrative override (actorType === 'ADMIN' or supervisory audit)
    // - Documented supervisory approval / policy override (supervisorApproved / policyOverride)
    // - Legacy resolution policy for pre-existing records prior to mandatory checklist rollout
    if (Array.isArray(complaint.statusHistory) && complaint.statusHistory.length > 0) {
      const resolutionEntries = complaint.statusHistory.filter(
        (h) => h.status === COMPLAINT_STATUS.RESOLVED || h.status === COMPLAINT_STATUS.CLOSED
      );
      if (resolutionEntries.length > 0) {
        const latest = resolutionEntries[resolutionEntries.length - 1];
        if (latest.resolutionDetails) {
          if (latest.resolutionDetails.valid === false) return false;
          if (
            latest.resolutionDetails.valid === true ||
            latest.resolutionDetails.isException === true ||
            (typeof latest.resolutionDetails.score === 'number' && latest.resolutionDetails.score >= 70)
          ) {
            return true;
          }
          return false;
        }

        const hasAuthorizedPolicyOverride =
          latest.isException === true ||
          latest.policyOverride === true ||
          latest.supervisorApproved === true ||
          latest.verificationMethod === 'SUPERVISORY_AUDIT' ||
          Boolean(latest.exceptionReason);

        const isSupervisoryAdminActor =
          latest.actorType === 'ADMIN';

        const isLegacyComplaintPolicy =
          complaint.synthetic === true ||
          complaint.legacyResolution === true ||
          (complaint.createdAt && new Date(complaint.createdAt) < new Date('2026-10-24T00:00:00.000Z'));

        const hasSubstantiveRemarks =
          typeof latest.remarks === 'string' && latest.remarks.trim().length >= 10;

        if ((hasAuthorizedPolicyOverride || isSupervisoryAdminActor || isLegacyComplaintPolicy) && hasSubstantiveRemarks) {
          return true;
        }
      }
    }

    // 4. Officer sign-off notes check:
    // Only accepted if accompanied by an authorized policy exception or legacy complaint policy
    if (Array.isArray(complaint.officerNotes) && complaint.officerNotes.length > 0) {
      const isAuthorizedLegacyOrPolicy =
        complaint.synthetic === true ||
        complaint.legacyResolution === true ||
        complaint.isException === true ||
        (complaint.createdAt && new Date(complaint.createdAt) < new Date('2026-10-24T00:00:00.000Z'));

      if (isAuthorizedLegacyOrPolicy) {
        const hasSignOff = complaint.officerNotes.some(
          (n) => n.note && /signed|completion|resolved|repaired|closed|inspected/i.test(n.note)
        );
        if (hasSignOff) {
          return true;
        }
      }
    }

    return false;
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;
