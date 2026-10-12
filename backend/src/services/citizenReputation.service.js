/**
 * @file citizenReputation.service.js
 * @description Privacy-conscious, auditable reputation tracking service
 * for CivicSarthi Phase 11: Spam/Fake Complaint Detection with Human Review.
 */

import { citizenReputationRepository } from '../repositories/citizenReputation.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { REPUTATION_EVENT_TYPES, CITIZEN_REPUTATION_STATUS } from '../constants/spam.constants.js';

export class CitizenReputationService {
  constructor(
    reputationRepo = citizenReputationRepository,
    auditRepo = auditLogRepository
  ) {
    this.reputationRepo = reputationRepo;
    this.auditRepo = auditRepo;
  }

  /**
   * Retrieves citizen reputation record with role-based privacy projection
   * Citizens see only high-level standing; officers/admins see audit events.
   *
   * @param {string} citizenId
   * @param {object} requester - Authenticated user context
   * @returns {Promise<object>}
   */
  async getReputation(citizenId, requester) {
    if (!requester) {
      const err = new Error('Authentication required');
      err.status = 401;
      throw err;
    }

    // Role verification: citizen can only view their own standing
    if (requester.role === 'citizen' && requester.id !== citizenId) {
      const err = new Error('Access denied: citizens can only inspect their own account reputation');
      err.status = 403;
      err.code = 'FORBIDDEN_USER_MISMATCH';
      throw err;
    }

    const record = await this.reputationRepo.findByCitizenId(citizenId);
    const normalized = this._normalizeReputation(record);

    // Privacy-conscious projection for citizen complainants
    if (requester.role === 'citizen') {
      return {
        citizenId: normalized.citizenId,
        standing: normalized.standing,
        status: normalized.status,
        reputationScore: normalized.reputationScore,
        score: normalized.score,
        totalSubmissions: normalized.metrics.totalSubmissions
      };
    }

    // Full projection for authorized administrative review desks
    return normalized;
  }

  /**
   * Normalizes record to support multiple property conventions
   */
  _normalizeReputation(record) {
    if (!record) return null;
    const score = record.score !== undefined ? record.score : 100;
    const standing = record.standing || record.status || CITIZEN_REPUTATION_STATUS.GOOD_STANDING;
    const confirmedAbuseCount = record.confirmedAbuseCount || (record.metrics && record.metrics.confirmedAbuseCount) || 0;
    const flaggedCount = record.flaggedCount || (record.metrics && record.metrics.unconfirmedFlagCount) || 0;
    const totalSubmissions = record.totalSubmissions || (record.metrics && record.metrics.totalSubmissions) || 0;

    return {
      ...record,
      score,
      reputationScore: score,
      standing,
      status: standing,
      metrics: {
        totalSubmissions,
        unconfirmedFlagCount: flaggedCount,
        confirmedAbuseCount
      }
    };
  }

  /**
   * Directly gets or creates a normalized reputation object
   */
  async getOrCreateReputation(citizenId) {
    const record = await this.reputationRepo.findByCitizenId(citizenId);
    return this._normalizeReputation(record);
  }

  /**
   * Public or role-projected standing lookup
   */
  async getPublicStanding(citizenId, role = 'public') {
    if (role === 'public') {
      return {
        citizenId,
        status: 'VERIFIED_CITIZEN_ACCOUNT'
      };
    }
    const record = await this.reputationRepo.findByCitizenId(citizenId);
    const normalized = this._normalizeReputation(record);
    if (role === 'citizen') {
      return {
        citizenId: normalized.citizenId,
        status: normalized.status,
        reputationScore: normalized.reputationScore
      };
    }
    return normalized;
  }

  /**
   * Records a raw reputation event with idempotency support
   */
  async recordEvent({ citizenId, eventType, sourceEventId, details = {}, actor = {} }) {
    if (!citizenId || !eventType) return { applied: false, reputation: null };

    // Check existing record for idempotency
    const current = await this.reputationRepo.findByCitizenId(citizenId);
    if (sourceEventId && current?.events?.some((e) => e.sourceEventId === sourceEventId)) {
      return {
        applied: false,
        reputation: this._normalizeReputation(current)
      };
    }

    let delta = 0;
    let wasFlagged = false;

    if (eventType === 'HUMAN_CONFIRMED_ABUSE' || eventType === REPUTATION_EVENT_TYPES.CONFIRMED_ABUSE) {
      eventType = REPUTATION_EVENT_TYPES.CONFIRMED_ABUSE;
      delta = -25;
    } else if (eventType === 'HUMAN_REVERSED_DECISION' || eventType === REPUTATION_EVENT_TYPES.ABUSE_REVERSED) {
      eventType = REPUTATION_EVENT_TYPES.ABUSE_REVERSED;
      delta = 25;
    } else if (eventType === 'FLAGGED_FOR_REVIEW') {
      eventType = REPUTATION_EVENT_TYPES.SUBMISSION_LOGGED;
      wasFlagged = true;
      delta = 0;
    } else if (eventType === 'SUBMISSION_LOGGED') {
      eventType = REPUTATION_EVENT_TYPES.SUBMISSION_LOGGED;
      delta = 0;
    }

    const updated = await this.reputationRepo.recordEvent(citizenId, {
      eventType,
      sourceEventId,
      complaintId: details.complaintId || null,
      reason: details.reason || details.justification || 'Reputation audit event',
      reviewerId: actor.id || 'SYSTEM',
      delta,
      wasFlagged
    });

    const normalized = this._normalizeReputation(updated);

    if (updated && updated._idempotent) {
      return {
        applied: false,
        reputation: normalized
      };
    }

    try {
      await this.auditRepo.create({
        action: 'CITIZEN_REPUTATION_UPDATED',
        userId: actor.id || 'SYSTEM',
        userEmail: actor.email || 'system@civicsarthi.internal',
        role: actor.role || 'system',
        targetResource: citizenId,
        details: {
          sourceEventId,
          eventType,
          delta,
          newStanding: normalized.standing
        }
      });
    } catch (auditErr) {
      console.warn('[CitizenReputationService] Audit log warning:', auditErr.message);
    }

    return {
      applied: true,
      reputation: normalized
    };
  }

  /**
   * Records a complaint submission event
   */
  async logSubmission(citizenId, complaintId, wasFlagged = false) {
    if (!citizenId) return null;
    return this.reputationRepo.recordEvent(citizenId, {
      eventType: REPUTATION_EVENT_TYPES.SUBMISSION_LOGGED,
      complaintId,
      wasFlagged,
      reason: wasFlagged ? 'Complaint submitted with automated review flag' : 'Standard complaint submitted',
      delta: 0
    });
  }

  /**
   * Updates reputation based on human review determination
   */
  async applyReviewOutcome(citizenId, complaintId, outcome, reviewer, reason) {
    if (!citizenId || !outcome) return null;

    let eventType;
    let delta = 0;

    switch (outcome) {
      case 'CONFIRMED_ABUSE':
        eventType = REPUTATION_EVENT_TYPES.CONFIRMED_ABUSE;
        delta = -25;
        break;
      case 'LEGITIMATE':
        eventType = REPUTATION_EVENT_TYPES.REVIEW_CLEARED_LEGITIMATE;
        delta = 10;
        break;
      case 'ABUSE_REVERSED':
        eventType = REPUTATION_EVENT_TYPES.ABUSE_REVERSED;
        delta = 25;
        break;
      default:
        return null;
    }

    const updated = await this.reputationRepo.recordEvent(citizenId, {
      eventType,
      complaintId,
      reason,
      reviewerId: reviewer?.id || 'OFFICER',
      delta
    });

    const normalized = this._normalizeReputation(updated);

    try {
      await this.auditRepo.create({
        action: 'CITIZEN_REPUTATION_UPDATED',
        userId: reviewer?.id || 'SYSTEM',
        userEmail: reviewer?.email || 'officer@civicsarthi.internal',
        role: reviewer?.role || 'officer',
        targetResource: citizenId,
        details: {
          complaintId,
          eventType,
          outcome,
          delta,
          newStanding: normalized.standing
        }
      });
    } catch (auditErr) {
      console.warn('[CitizenReputationService] Non-fatal audit log warning:', auditErr.message);
    }

    return normalized;
  }
}

export const citizenReputationService = new CitizenReputationService();
export default citizenReputationService;
