import { reopeningRequestRepository } from '../repositories/reopeningRequest.repository.js';
import { complaintRepository } from '../repositories/complaint.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { COMPLAINT_STATUS } from '../constants/status.constants.js';
import {
  REOPENING_STATUS,
  REOPENING_REASONS,
  validateReopeningStatusTransition
} from '../constants/feedback.constants.js';

export class ReopeningService {
  constructor(
    reopeningRepo = reopeningRequestRepository,
    complaintRepo = complaintRepository,
    auditRepo = auditLogRepository
  ) {
    this.reopeningRepo = reopeningRepo;
    this.complaintRepo = complaintRepo;
    this.auditRepo = auditRepo;
  }

  /**
   * Submit controlled reopening request for an unresolved/recurrent grievance
   */
  async createReopeningRequest(complaintIdOrRef, data = {}, user) {
    const { reasonCategory } = data;
    if (!user || user.role !== 'citizen') {
      const err = new Error('Access denied: only authenticated citizens may submit reopening requests');
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

    if (complaint.citizenId !== user.id) {
      const err = new Error('Access denied: you can only request reopening for complaints you filed');
      err.status = 403;
      err.code = 'FORBIDDEN_COMPLAINT_OWNER';
      throw err;
    }

    // Must be in a resolved/closed state to request reopening
    const isResolved =
      complaint.status === COMPLAINT_STATUS.RESOLVED || complaint.status === COMPLAINT_STATUS.CLOSED;
    if (!isResolved) {
      const err = new Error(
        `Cannot request reopening: complaint is currently in '${complaint.status}' status and has not reached resolution.`
      );
      err.status = 400;
      err.code = 'INELIGIBLE_FOR_REOPENING';
      throw err;
    }

    // Check if an active/pending reopening request already exists
    const pending = await this.reopeningRepo.findPendingByComplaintId(complaint.id);
    if (pending) {
      const err = new Error(
        `This grievance already has an active reopening request pending review (${pending.referenceNumber}).`
      );
      err.status = 409;
      err.code = 'ACTIVE_REOPENING_REQUEST_EXISTS';
      err.details = { activeRequestReference: pending.referenceNumber, status: pending.status };
      throw err;
    }

    // Validate reason category
    if (!Object.values(REOPENING_REASONS).includes(reasonCategory)) {
      const err = new Error(
        `Invalid reopening reason category. Allowed: ${Object.values(REOPENING_REASONS).join(', ')}`
      );
      err.status = 400;
      err.code = 'INVALID_REASON_CATEGORY';
      throw err;
    }

    // Validate explanation
    const rawExplanation = data.explanation || data.citizenExplanation || '';
    const cleanExplanation = String(rawExplanation).trim();
    if (cleanExplanation.length < 10) {
      const err = new Error('Reopening explanation must be at least 10 characters detailing why the case requires re-examination');
      err.status = 400;
      err.code = 'EXPLANATION_TOO_SHORT';
      throw err;
    }
    if (cleanExplanation.length > 3000) {
      const err = new Error('Reopening explanation cannot exceed 3000 characters');
      err.status = 400;
      err.code = 'EXPLANATION_TOO_LONG';
      throw err;
    }

    // Safe evidence sanitization
    const rawEvidence = data.supportingEvidence || data.evidence || [];
    const safeEvidence = Array.isArray(rawEvidence)
      ? rawEvidence
          .map((e) => String(e).trim())
          .filter((e) => e.length > 0 && !e.includes('..') && !e.includes(':'))
      : [];

    const milestone = String(
      complaint.resolutionMilestone ||
      (typeof complaint.reopenedCount === 'number' && complaint.reopenedCount > 0
        ? complaint.reopenedCount + 1
        : 1)
    );

    const payload = {
      complaintId: complaint.id,
      complaintReference: complaint.referenceNumber || complaint.id,
      requesterId: user.id,
      departmentId: complaint.departmentId || complaint.department || 'DEPT_MUNICIPAL',
      reasonCategory,
      explanation: cleanExplanation,
      evidence: safeEvidence,
      resolutionMilestone: milestone
    };

    const created = await this.reopeningRepo.create(payload);

    try {
      await this.auditRepo.create({
        action: 'SUBMIT_REOPENING_REQUEST',
        userId: user.id,
        userEmail: user.email || 'citizen@civicsarthi.internal',
        role: user.role,
        targetResource: created.id,
        details: {
          requestReference: created.referenceNumber,
          complaintId: complaint.id,
          reasonCategory
        }
      });
    } catch (auditErr) {
      console.warn('[ReopeningService] Non-fatal audit log warning:', auditErr.message);
    }

    return created;
  }

  /**
   * Retrieve reopening request by ID or reference
   */
  async getReopeningRequestById(idOrRef, user) {
    const request = await this.reopeningRepo.findById(idOrRef);
    if (!request) {
      const err = new Error('Reopening request record not found');
      err.status = 404;
      err.code = 'REOPENING_REQUEST_NOT_FOUND';
      throw err;
    }

    if (user.role === 'citizen') {
      if (request.requesterId !== user.id) {
        const err = new Error('Access denied: you can only view your own reopening requests');
        err.status = 403;
        err.code = 'FORBIDDEN_REQUEST_OWNER';
        throw err;
      }
    }

    if (user.role === 'officer') {
      if (user.departmentId && request.departmentId !== user.departmentId) {
        const err = new Error(`Access denied: request belongs to department '${request.departmentId}'`);
        err.status = 403;
        err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
        throw err;
      }
    }

    return request;
  }

  /**
   * List reopening requests submitted by the authenticated citizen
   */
  async getMyReopeningRequests(user) {
    if (!user || user.role !== 'citizen') {
      const err = new Error('Access denied: only citizens can query personal reopening requests');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    return this.reopeningRepo.findAll({ requesterId: user.id });
  }

  /**
   * List reopening requests for authorized officer review desk or admin oversight
   */
  async listReopeningRequests(filters = {}, user) {
    if (!user || user.role === 'citizen') {
      const err = new Error('Access denied: citizen role is not authorized for the reopening review desk');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const queryFilters = { ...filters };
    if (user.role === 'officer') {
      queryFilters.departmentId = user.departmentId;
    }

    return this.reopeningRepo.findAll(queryFilters);
  }

  /**
   * Record decision on reopening request (APPROVED or REJECTED)
   * When APPROVED, executes the atomic controlled reopening of the complaint!
   */
  async recordReopeningDecision(idOrRef, { outcome, decision, reason, decisionReason }, user) {
    if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
      const err = new Error('Access denied: only authorized officers or admins can decide reopening requests');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const request = await this.reopeningRepo.findById(idOrRef);
    if (!request) {
      const err = new Error('Reopening request record not found');
      err.status = 404;
      err.code = 'REOPENING_REQUEST_NOT_FOUND';
      throw err;
    }

    if (user.role === 'officer' && user.departmentId && request.departmentId !== user.departmentId) {
      const err = new Error(
        `Access denied: request belongs to department '${request.departmentId}' which is outside your authorized department scope`
      );
      err.status = 403;
      err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
      throw err;
    }

    if (request.status !== REOPENING_STATUS.PENDING_REVIEW) {
      const err = new Error(`Cannot adjudicate reopening request with status '${request.status}'`);
      err.status = 400;
      err.code = 'REQUEST_ALREADY_DECIDED';
      throw err;
    }

    const finalOutcome = outcome || decision;
    if (!['APPROVED', 'REJECTED'].includes(finalOutcome)) {
      const err = new Error("Invalid decision outcome. Allowed: 'APPROVED', 'REJECTED'");
      err.status = 400;
      err.code = 'INVALID_OUTCOME';
      throw err;
    }

    const cleanReason = String(reason || decisionReason || '').trim();
    if (cleanReason.length < 10) {
      const err = new Error('A detailed decision reason of at least 10 characters is mandatory');
      err.status = 400;
      err.code = 'DECISION_REASON_TOO_SHORT';
      throw err;
    }

    // If APPROVED, execute controlled complaint reopening
    if (finalOutcome === 'APPROVED') {
      const complaint = await this.complaintRepo.findById(request.complaintId);
      if (!complaint) {
        const err = new Error(`Associated complaint '${request.complaintId}' was not found`);
        err.status = 404;
        err.code = 'COMPLAINT_NOT_FOUND';
        throw err;
      }

      // Must be currently RESOLVED or CLOSED to legally transition to REOPENED
      if (complaint.status !== COMPLAINT_STATUS.RESOLVED && complaint.status !== COMPLAINT_STATUS.CLOSED) {
        const err = new Error(
          `Cannot reopen complaint: current status is '${complaint.status}'. Complaint must be RESOLVED or CLOSED.`
        );
        err.status = 400;
        err.code = 'INVALID_COMPLAINT_STATE_FOR_REOPENING';
        throw err;
      }

      // Execute status transition to REOPENED
      const reopeningRemarks = `Reopening request approved (${request.referenceNumber}): ${cleanReason}`;
      
      const updatedComplaint = await this.complaintRepo.updateStatus(complaint.id, {
        status: COMPLAINT_STATUS.REOPENED,
        remarks: reopeningRemarks,
        actorType: 'OFFICER'
      });

      if (!updatedComplaint) {
        const err = new Error('Failed to update complaint status to REOPENED');
        err.status = 500;
        err.code = 'REOPENING_EXECUTION_FAILED';
        throw err;
      }

      // Increment reopenedCount and reset active resolutionDetails so Phase 9 quality checks are enforced again
      try {
        if (typeof this.complaintRepo.update === 'function') {
          await this.complaintRepo.update(complaint.id, {
            reopenedCount: (complaint.reopenedCount || 0) + 1,
            isReopened: true,
            resolutionMilestone: String(Number(complaint.resolutionMilestone || 1) + 1),
            previousResolutionDetails: complaint.resolutionDetails || null,
            resolutionDetails: null
          });
        }
      } catch (countErr) {
        console.warn('[ReopeningService] Non-fatal reopenedCount update warning:', countErr.message);
      }

      try {
        await this.auditRepo.create({
          action: 'CONTROLLED_GRIEVANCE_REOPENED',
          userId: user.id,
          userEmail: user.email,
          role: user.role,
          targetResource: complaint.id,
          details: {
            requestReference: request.referenceNumber,
            reason: cleanReason,
            previousStatus: complaint.status,
            reopenedCount: (complaint.reopenedCount || 0) + 1
          }
        });
      } catch {}
    }

    // Record decision on request record
    const updatedRequest = await this.reopeningRepo.recordDecision(request.id, {
      outcome: finalOutcome,
      reason: cleanReason,
      reviewerId: user.id,
      actorRole: user.role
    });

    try {
      await this.auditRepo.create({
        action: 'RECORD_REOPENING_DECISION',
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        targetResource: request.id,
        details: { outcome: finalOutcome, reason: cleanReason, requestReference: request.referenceNumber }
      });
    } catch {}

    return updatedRequest;
  }
}

export const reopeningService = new ReopeningService();
export default reopeningService;
