import { appealRepository } from '../repositories/appeal.repository.js';
import { complaintRepository } from '../repositories/complaint.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { COMPLAINT_STATUS } from '../constants/status.constants.js';
import {
  APPEAL_STATUS,
  APPEAL_REASONS,
  validateAppealStatusTransition
} from '../constants/feedback.constants.js';

export class AppealService {
  constructor(
    appealRepo = appealRepository,
    complaintRepo = complaintRepository,
    auditRepo = auditLogRepository
  ) {
    this.appealRepo = appealRepo;
    this.complaintRepo = complaintRepo;
    this.auditRepo = auditRepo;
  }

  /**
   * Resolves a trusted, consistent department identifier from an entity or user profile.
   * Rejects missing or conflicting department fields ('departmentId' vs 'department').
   */
  _resolveAuthorizedDepartment(entity, entityName = 'resource') {
    if (!entity) {
      const err = new Error(`Access denied: ${entityName} is missing or undefined`);
      err.status = 403;
      err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
      throw err;
    }

    const deptId = entity.departmentId ? String(entity.departmentId).trim() : null;
    const dept = entity.department ? String(entity.department).trim() : null;

    if (!deptId && !dept) {
      const err = new Error(`Access denied: officer is not authorized for department (${entityName} has no assigned department)`);
      err.status = 403;
      err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
      throw err;
    }

    if (deptId && dept && deptId !== dept) {
      const err = new Error(`Access denied: ${entityName} has conflicting department fields ('${deptId}' vs '${dept}')`);
      err.status = 403;
      err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
      throw err;
    }

    return deptId || dept;
  }

  /**
   * Enforces strict officer department authorization scope against an entity.
   */
  _assertOfficerDepartmentScope(user, entity, entityName = 'resource') {
    if (user.role !== 'officer') return;

    const officerDept = this._resolveAuthorizedDepartment(user, 'officer profile');
    const resourceDept = this._resolveAuthorizedDepartment(entity, entityName);

    if (officerDept !== resourceDept) {
      const err = new Error(`Access denied: officer is not authorized for department '${resourceDept}' (outside your authorized department scope)`);
      err.status = 403;
      err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
      throw err;
    }
  }

  /**
   * Submit formal resolution appeal against a disputed resolution
   */
  async createAppeal(complaintIdOrRef, data = {}, user) {
    const { reasonCategory } = data;
    if (!user || user.role !== 'citizen') {
      const err = new Error('Access denied: only authenticated citizens may lodge formal appeals');
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
      const err = new Error('Access denied: you can only lodge appeals for complaints you filed');
      err.status = 403;
      err.code = 'FORBIDDEN_COMPLAINT_OWNER';
      throw err;
    }

    // Must be in a resolved/closed state to appeal the resolution
    const isResolved =
      complaint.status === COMPLAINT_STATUS.RESOLVED || complaint.status === COMPLAINT_STATUS.CLOSED;
    if (!isResolved) {
      const err = new Error(
        `Cannot lodge an appeal: complaint must be officially resolved or closed before lodging an appeal (currently '${complaint.status}').`
      );
      err.status = 400;
      err.code = 'INELIGIBLE_FOR_APPEAL';
      throw err;
    }

    // Prevent duplicate active appeals
    const existing = await this.appealRepo.findAll({ complaintId: complaint.id });
    const hasActiveAppeal = existing.some((a) =>
      [APPEAL_STATUS.SUBMITTED, APPEAL_STATUS.UNDER_REVIEW, APPEAL_STATUS.NEED_MORE_INFORMATION].includes(a.status)
    );
    if (hasActiveAppeal) {
      const activeItem = existing.find((a) =>
        [APPEAL_STATUS.SUBMITTED, APPEAL_STATUS.UNDER_REVIEW, APPEAL_STATUS.NEED_MORE_INFORMATION].includes(a.status)
      );
      const err = new Error(
        `An active appeal (${activeItem.referenceNumber}) is already under review for this grievance.`
      );
      err.status = 409;
      err.code = 'ACTIVE_APPEAL_EXISTS';
      err.details = { activeAppealReference: activeItem.referenceNumber, status: activeItem.status };
      throw err;
    }

    // Validate reason category
    if (!Object.values(APPEAL_REASONS).includes(reasonCategory)) {
      const err = new Error(
        `Invalid appeal reason category. Allowed: ${Object.values(APPEAL_REASONS).join(', ')}`
      );
      err.status = 400;
      err.code = 'INVALID_REASON_CATEGORY';
      throw err;
    }

    // Validate explanation
    const rawExplanation = data.citizenExplanation || data.explanation || '';
    const cleanExplanation = String(rawExplanation).trim();
    if (cleanExplanation.length < 10) {
      const err = new Error('Appeal explanation must be at least 10 characters detailing the dispute grounds');
      err.status = 400;
      err.code = 'EXPLANATION_TOO_SHORT';
      throw err;
    }
    if (cleanExplanation.length > 3000) {
      const err = new Error('Appeal explanation cannot exceed 3000 characters');
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

    const created = await this.appealRepo.create(payload);

    try {
      await this.auditRepo.create({
        action: 'SUBMIT_FORMAL_APPEAL',
        userId: user.id,
        userEmail: user.email || 'citizen@civicsarthi.internal',
        role: user.role,
        targetResource: created.id,
        details: {
          appealReference: created.referenceNumber,
          complaintId: complaint.id,
          reasonCategory
        }
      });
    } catch (auditErr) {
      console.warn('[AppealService] Non-fatal audit log warning:', auditErr.message);
    }

    return this.sanitizeForCitizen(created);
  }

  /**
   * Retrieve appeal by ID or reference with role scoping
   */
  async getAppealById(idOrRef, user) {
    const appeal = await this.appealRepo.findById(idOrRef);
    if (!appeal) {
      const err = new Error('Formal appeal record not found');
      err.status = 404;
      err.code = 'APPEAL_NOT_FOUND';
      throw err;
    }

    if (user.role === 'citizen') {
      if (appeal.requesterId !== user.id) {
        const err = new Error('Access denied: you can only view your own appeal records');
        err.status = 403;
        err.code = 'FORBIDDEN_APPEAL_OWNER';
        throw err;
      }
      return this.sanitizeForCitizen(appeal);
    }

    if (user.role === 'officer') {
      this._assertOfficerDepartmentScope(user, appeal, 'appeal');
      return appeal;
    }

    return appeal;
  }

  /**
   * List appeals submitted by the authenticated citizen
   */
  async getMyAppeals(user) {
    if (!user || user.role !== 'citizen') {
      const err = new Error('Access denied: only citizens can query personal appeal history');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const list = await this.appealRepo.findAll({ requesterId: user.id });
    return list.map((a) => this.sanitizeForCitizen(a));
  }

  /**
   * List all appeals for a specific complaint with role-based access scoping
   */
  async getAppealsForComplaint(complaintIdOrRef, user) {
    if (!user) {
      const err = new Error('Authentication required');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const complaint = await this.complaintRepo.findById(complaintIdOrRef);
    if (!complaint) {
      const err = new Error('Grievance record not found');
      err.status = 404;
      err.code = 'COMPLAINT_NOT_FOUND';
      throw err;
    }

    if (user.role === 'citizen') {
      if (complaint.citizenId !== user.id) {
        const err = new Error('Access denied: you can only view appeals for complaints you filed');
        err.status = 403;
        err.code = 'FORBIDDEN_COMPLAINT_OWNER';
        throw err;
      }
      let list = await this.appealRepo.findAll({ complaintId: complaint.id });
      if (list.length === 0 && complaint.referenceNumber && complaint.referenceNumber !== complaint.id) {
        list = await this.appealRepo.findAll({ complaintId: complaint.referenceNumber });
      }
      return list.map((a) => this.sanitizeForCitizen(a));
    }

    if (user.role === 'officer') {
      this._assertOfficerDepartmentScope(user, complaint, 'complaint');
      let list = await this.appealRepo.findAll({ complaintId: complaint.id });
      if (list.length === 0 && complaint.referenceNumber && complaint.referenceNumber !== complaint.id) {
        list = await this.appealRepo.findAll({ complaintId: complaint.referenceNumber });
      }
      return list;
    }

    if (user.role === 'admin') {
      let list = await this.appealRepo.findAll({ complaintId: complaint.id });
      if (list.length === 0 && complaint.referenceNumber && complaint.referenceNumber !== complaint.id) {
        list = await this.appealRepo.findAll({ complaintId: complaint.referenceNumber });
      }
      return list;
    }

    const err = new Error(`Access denied: role '${user.role}' is not authorized`);
    err.status = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }

  /**
   * List appeals for authorized officer review desk or admin oversight
   */
  async listAppeals(filters = {}, user) {
    if (!user || user.role === 'citizen') {
      const err = new Error('Access denied: citizen role is not authorized for the appeal review desk');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const queryFilters = { ...filters };
    if (user.role === 'officer') {
      const officerDept = this._resolveAuthorizedDepartment(user, 'officer profile');
      queryFilters.departmentId = officerDept;
    }

    return this.appealRepo.findAll(queryFilters);
  }

  /**
   * Update appeal status with lifecycle governance
   */
  async updateAppealStatus(idOrRef, { status, remarks }, user) {
    if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
      const err = new Error('Access denied: only authorized officers or administrators can update appeal status');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const appeal = await this.appealRepo.findById(idOrRef);
    if (!appeal) {
      const err = new Error('Appeal record not found');
      err.status = 404;
      err.code = 'APPEAL_NOT_FOUND';
      throw err;
    }

    if (user.role === 'officer') {
      this._assertOfficerDepartmentScope(user, appeal, 'appeal');
    }

    const updated = await this.appealRepo.updateStatus(appeal.id, {
      status,
      remarks,
      actorId: user.id,
      actorRole: user.role
    });

    try {
      await this.auditRepo.create({
        action: 'UPDATE_APPEAL_STATUS',
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        targetResource: appeal.id,
        details: { fromStatus: appeal.status, toStatus: status, remarks }
      });
    } catch {}

    return updated;
  }

  /**
   * Add internal officer review note (invisible to citizen)
   */
  async addAppealNote(idOrRef, { note }, user) {
    if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
      const err = new Error('Access denied: only authorized officers or admins can add review notes');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const appeal = await this.appealRepo.findById(idOrRef);
    if (!appeal) {
      const err = new Error('Appeal record not found');
      err.status = 404;
      err.code = 'APPEAL_NOT_FOUND';
      throw err;
    }

    if (user.role === 'officer') {
      this._assertOfficerDepartmentScope(user, appeal, 'appeal');
    }

    const cleanNote = String(note || '').trim();
    if (!cleanNote) {
      const err = new Error('Review note cannot be empty');
      err.status = 400;
      err.code = 'EMPTY_NOTE';
      throw err;
    }

    return this.appealRepo.addInternalNote(appeal.id, { note: cleanNote, officerId: user.id });
  }

  /**
   * Record definitive appeal decision (UPHELD or REJECTED)
   */
  async recordAppealDecision(idOrRef, { outcome, decision, reason, decisionReason, citizenExplanation }, user) {
    if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
      const err = new Error('Access denied: only authorized officers or admins can record appeal decisions');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const appeal = await this.appealRepo.findById(idOrRef);
    if (!appeal) {
      const err = new Error('Appeal record not found');
      err.status = 404;
      err.code = 'APPEAL_NOT_FOUND';
      throw err;
    }

    if (user.role === 'officer') {
      this._assertOfficerDepartmentScope(user, appeal, 'appeal');
    }

    const finalOutcome = outcome || decision;
    if (!['UPHELD', 'REJECTED'].includes(finalOutcome)) {
      const err = new Error("Invalid decision outcome. Allowed: 'UPHELD', 'REJECTED'");
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

    const updated = await this.appealRepo.recordDecision(appeal.id, {
      outcome: finalOutcome,
      reason: cleanReason,
      citizenExplanation: citizenExplanation || cleanReason,
      reviewerId: user.id,
      actorRole: user.role
    });

    try {
      await this.auditRepo.create({
        action: 'RECORD_APPEAL_DECISION',
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        targetResource: appeal.id,
        details: { outcome, reason: cleanReason, appealReference: appeal.referenceNumber }
      });
    } catch {}

    return updated;
  }

  /**
   * Public tracking projection using strict safe-field allowlist
   */
  async getAppealTracking(referenceNumber) {
    const appeal = await this.appealRepo.findById(referenceNumber);
    if (!appeal) {
      const err = new Error('Appeal reference not found');
      err.status = 404;
      err.code = 'APPEAL_NOT_FOUND';
      throw err;
    }

    return {
      referenceNumber: appeal.referenceNumber,
      complaintReference: appeal.complaintReference,
      reasonCategory: appeal.reasonCategory,
      status: appeal.status,
      createdAt: appeal.createdAt,
      updatedAt: appeal.updatedAt,
      decision: appeal.decision
        ? {
            outcome: appeal.decision.outcome,
            reason: appeal.decision.reason,
            decidedAt: appeal.decision.decidedAt
          }
        : null
    };
  }

  /**
   * Sanitizes appeal for citizen viewing with an explicit citizen-safe projection.
   * Strips internal reviewer metadata, confidential officer notes, and private employee identifiers.
   */
  sanitizeForCitizen(appeal) {
    if (!appeal) return null;
    const plain = typeof appeal.toObject === 'function' ? appeal.toObject() : (appeal._doc ? { ...appeal._doc } : { ...appeal });

    let safeDecision = null;
    if (plain.decision) {
      if (typeof plain.decision === 'object') {
        const d = typeof plain.decision.toObject === 'function' ? plain.decision.toObject() : plain.decision;
        safeDecision = {
          outcome: d.outcome || null,
          reason: d.reason || d.citizenExplanation || null,
          decidedAt: d.decidedAt || null
        };
      } else {
        safeDecision = plain.decision;
      }
    }

    const safeStatusHistory = Array.isArray(plain.statusHistory)
      ? plain.statusHistory.map((entry) => {
          const item = typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry };
          return {
            status: item.status,
            timestamp: item.timestamp,
            remarks: item.remarks || '',
            actorRole: item.actorRole || 'system'
          };
        })
      : [];

    const explanation = plain.citizenExplanation || plain.explanation || '';

    return {
      id: plain.id,
      referenceNumber: plain.referenceNumber || plain.id,
      complaintId: plain.complaintId,
      complaintReference: plain.complaintReference || plain.complaintId,
      requesterId: plain.requesterId,
      departmentId: plain.departmentId || plain.department || null,
      reasonCategory: plain.reasonCategory,
      explanation,
      citizenExplanation: explanation,
      evidence: Array.isArray(plain.evidence) ? plain.evidence : (plain.supportingEvidence || []),
      resolutionMilestone: String(plain.resolutionMilestone || '1'),
      status: plain.status,
      statusHistory: safeStatusHistory,
      decision: safeDecision,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt
    };
  }
}

export const appealService = new AppealService();
export default appealService;
