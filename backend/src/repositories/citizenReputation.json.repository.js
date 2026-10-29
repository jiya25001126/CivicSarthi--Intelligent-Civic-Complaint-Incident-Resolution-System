import fs from 'fs/promises';
import config, { assertSafeWritePath } from '../config/app.config.js';
import { CITIZEN_REPUTATION_STATUS, REPUTATION_EVENT_TYPES } from '../constants/spam.constants.js';

class AsyncMutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  run(task) {
    const result = this._queue.then(() => task());
    this._queue = result.catch(() => {});
    return result;
  }
}

export class JsonCitizenReputationRepository {
  constructor(customFilePath = null) {
    this._customFilePath = customFilePath;
    this._mutex = new AsyncMutex();
  }

  get filePath() {
    return this._customFilePath || config.dataPath.citizenReputations;
  }

  set filePath(path) {
    this._customFilePath = path;
  }

  setFilePath(customPath) {
    this._customFilePath = customPath;
  }

  resetFilePath() {
    this._customFilePath = null;
  }

  async _readFile() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        const initial = {
          metadata: { version: '1.0.0', description: 'CivicSarthi Citizen Account Reputation Directory' },
          reputations: []
        };
        await this._writeFile(initial);
        return initial;
      }
      throw err;
    }
  }

  async _writeFile(data) {
    assertSafeWritePath(this.filePath);
    const content = JSON.stringify(data, null, 2);
    const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    await fs.writeFile(tempPath, content, 'utf-8');

    let attempts = 0;
    while (attempts < 5) {
      try {
        await fs.rename(tempPath, this.filePath);
        return;
      } catch {
        attempts++;
        if (attempts >= 5) {
          try { await fs.unlink(tempPath); } catch {}
          await fs.writeFile(this.filePath, content, 'utf-8');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }

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
    const fileData = await this._readFile();
    const list = fileData.reputations || [];
    const found = list.find((r) => r.citizenId === citizenId);
    if (!found) {
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
    return { ...found };
  }

  async recordEvent(citizenId, eventData) {
    return this._mutex.run(async () => {
      const fileData = await this._readFile();
      const list = fileData.reputations || [];
      let idx = list.findIndex((r) => r.citizenId === citizenId);

      let record;
      if (idx === -1) {
        record = {
          id: `REP-${citizenId}`,
          citizenId,
          standing: CITIZEN_REPUTATION_STATUS.GOOD_STANDING,
          score: 100,
          totalSubmissions: 0,
          flaggedCount: 0,
          confirmedAbuseCount: 0,
          clearedLegitimateCount: 0,
          events: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        list.push(record);
        idx = list.length - 1;
      } else {
        record = { ...list[idx] };
      }

      // Check event idempotency
      if (eventData.sourceEventId) {
        const existingEvent = record.events.find((e) => e.sourceEventId === eventData.sourceEventId);
        if (existingEvent) {
          return { ...record, _idempotent: true };
        }
      }
      if (eventData.complaintId && eventData.eventType) {
        const existingEvent = record.events.find(
          (e) => e.complaintId === eventData.complaintId && e.eventType === eventData.eventType
        );
        if (existingEvent) {
          // Idempotent: return existing record without duplicate delta
          return { ...record, _idempotent: true };
        }
      }

      const now = new Date().toISOString();
      const eventId = `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const delta = typeof eventData.delta === 'number' ? eventData.delta : 0;

      // Adjust score (bounded between 0 and 100)
      let newScore = Math.min(100, Math.max(0, record.score + delta));
      let newConfirmed = record.confirmedAbuseCount || 0;
      let newCleared = record.clearedLegitimateCount || 0;
      let newFlagged = record.flaggedCount || 0;
      let newSubmissions = record.totalSubmissions || 0;

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
        sourceEventId: eventData.sourceEventId || null,
        eventType: eventData.eventType,
        complaintId: eventData.complaintId || null,
        reason: eventData.reason || 'Reputation audit event recorded',
        reviewerId: eventData.reviewerId || null,
        delta,
        timestamp: now
      };

      const updatedRecord = {
        ...record,
        score: newScore,
        standing: newStanding,
        totalSubmissions: newSubmissions,
        flaggedCount: newFlagged,
        confirmedAbuseCount: newConfirmed,
        clearedLegitimateCount: newCleared,
        events: [...record.events, fullEvent],
        updatedAt: now
      };

      list[idx] = updatedRecord;
      fileData.reputations = list;
      await this._writeFile(fileData);
      return { ...updatedRecord };
    });
  }
}

export const jsonCitizenReputationRepository = new JsonCitizenReputationRepository();
