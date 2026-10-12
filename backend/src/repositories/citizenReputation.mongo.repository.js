import CitizenReputationModel from '../models/citizenReputation.model.js';
import { CITIZEN_REPUTATION_STATUS, REPUTATION_EVENT_TYPES } from '../constants/spam.constants.js';

export class MongoCitizenReputationRepository {
  deriveStanding(score, confirmedAbuseCount) {
    if (confirmedAbuseCount >= 3) {
      return CITIZEN_REPUTATION_STATUS.RESTRICTED_REVIEW_PRIORITY;
    }
    if (confirmedAbuseCount >= 1 || score < 70) {
      return CITIZEN_REPUTATION_STATUS.UNDER_OBSERVATION;
    }
    return CITIZEN_REPUTATION_STATUS.GOOD_STANDING;
  }

  async findByCitizenId(citizenId) {
    if (!citizenId) return null;
    const doc = await CitizenReputationModel.findOne({ citizenId }).lean();
    if (!doc) {
      return {
        id: `REP-${citizenId}`,
        citizenId,
        standing: CITIZEN_REPUTATION_STATUS.GOOD_STANDING,
        score: 100,
        totalSubmissions: 0,
        flaggedCount: 0,
        confirmedAbuseCount: 0,
        clearedLegitimateCount: 0,
        events: []
      };
    }
    return doc;
  }

  async recordEvent(citizenId, eventData) {
    let doc = await CitizenReputationModel.findOne({ citizenId });
    if (!doc) {
      doc = new CitizenReputationModel({
        id: `REP-${citizenId}`,
        citizenId,
        standing: CITIZEN_REPUTATION_STATUS.GOOD_STANDING,
        score: 100,
        totalSubmissions: 0,
        flaggedCount: 0,
        confirmedAbuseCount: 0,
        clearedLegitimateCount: 0,
        events: []
      });
    }

    // Check event idempotency
    if (eventData.complaintId && eventData.eventType) {
      const existing = doc.events.find(
        (e) => e.complaintId === eventData.complaintId && e.eventType === eventData.eventType
      );
      if (existing) {
        return doc.toObject();
      }
    }

    const eventId = `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const delta = typeof eventData.delta === 'number' ? eventData.delta : 0;

    let newScore = Math.min(100, Math.max(0, doc.score + delta));
    let newConfirmed = doc.confirmedAbuseCount || 0;
    let newCleared = doc.clearedLegitimateCount || 0;
    let newFlagged = doc.flaggedCount || 0;
    let newSubmissions = doc.totalSubmissions || 0;

    if (eventData.eventType === REPUTATION_EVENT_TYPES.CONFIRMED_ABUSE) {
      newConfirmed++;
    } else if (eventData.eventType === REPUTATION_EVENT_TYPES.ABUSE_REVERSED) {
      newConfirmed = Math.max(0, newConfirmed - 1);
      newCleared++;
    } else if (eventData.eventType === REPUTATION_EVENT_TYPES.REVIEW_CLEARED_LEGITIMATE) {
      newCleared++;
    } else if (eventData.eventType === REPUTATION_EVENT_TYPES.SUBMISSION_LOGGED) {
      newSubmissions++;
      if (eventData.wasFlagged) {
        newFlagged++;
      }
    }

    const newStanding = this.deriveStanding(newScore, newConfirmed);

    const fullEvent = {
      eventId,
      eventType: eventData.eventType,
      complaintId: eventData.complaintId || null,
      reason: eventData.reason || 'Reputation audit event recorded',
      reviewerId: eventData.reviewerId || null,
      delta,
      timestamp: new Date()
    };

    doc.score = newScore;
    doc.standing = newStanding;
    doc.totalSubmissions = newSubmissions;
    doc.flaggedCount = newFlagged;
    doc.confirmedAbuseCount = newConfirmed;
    doc.clearedLegitimateCount = newCleared;
    doc.events.push(fullEvent);

    const saved = await doc.save();
    return saved.toObject();
  }
}

export const mongoCitizenReputationRepository = new MongoCitizenReputationRepository();
