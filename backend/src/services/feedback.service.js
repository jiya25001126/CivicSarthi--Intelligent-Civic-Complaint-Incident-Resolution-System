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

    // Phase 9 Resolution Quality Checker gate
    if (!complaint.resolutionDetails || complaint.resolutionDetails.valid !== true) {
      const err = new Error(
        'Feedback cannot be accepted: resolution milestone lacks verified Phase 9 resolution quality checklist.'
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

    // Derive current resolution milestone
    const milestone = String(
      complaint.resolutionMilestone ||
      (typeof complaint.reopenedCount === 'number' && complaint.reopenedCount > 0
        ? complaint.reopenedCount + 1
        : 1)
    );

    // Enforce 1 feedback submission per citizen, complaint, and milestone
    const existing = await this.feedbackRepo.findByComplaintAndMilestone(complaint.id, milestone);
    if (existing) {
      const err = new Error(
        `Feedback has already been submitted for this resolution milestone (Rating: ${existing.rating}/5 for milestone ${milestone}).`
      );
      err.status = 409;
      err.code = 'FEEDBACK_ALREADY_SUBMITTED';
      err.details = { existingFeedbackId: existing.id, milestone };
      throw err;
    }

    const payload = {
      complaintId: complaint.id,
      complaintReference: complaint.referenceNumber || complaint.id,
      citizenId: user.id,
      rating: numRating,
      comments: cleanComments,
      resolutionMilestone: milestone,
      resolutionDetailsSnapshot: {
        score: complaint.resolutionDetails?.score || null,
        outcomeType: complaint.resolutionDetails?.outcomeType || null,
        resolvedAt: complaint.resolutionDetails?.resolvedAt || null,
        isException: Boolean(complaint.resolutionDetails?.isException)
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
}

export const feedbackService = new FeedbackService();
export default feedbackService;
