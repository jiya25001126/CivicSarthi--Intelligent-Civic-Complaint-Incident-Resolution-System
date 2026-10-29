import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SpamScreeningService } from '../src/services/spamScreening.service.js';
import { SpamReviewService } from '../src/services/spamReview.service.js';
import {
  SPAM_RISK_LEVEL,
  SPAM_REVIEW_OUTCOMES,
  SPAM_REASON_CODES
} from '../src/constants/spam.constants.js';

// Mock Repositories for Feature B
class InMemorySpamReviewRepo {
  constructor() {
    this.reviews = [];
  }
  async create(data) {
    const record = {
      ...data,
      id: data.id || `REV-TEST-${this.reviews.length + 1}`,
      reviewStatus: 'PENDING',
      createdAt: new Date().toISOString()
    };
    this.reviews.push(record);
    return record;
  }
  async findById(id) {
    return this.reviews.find((r) => r.id === id) || null;
  }
  async findByComplaintId(cid) {
    return this.reviews.find((r) => r.complaintId === cid) || null;
  }
  async findAll(filters = {}) {
    let items = [...this.reviews];
    if (filters.departmentId) items = items.filter((r) => r.departmentId === filters.departmentId);
    if (filters.reviewStatus) items = items.filter((r) => r.reviewStatus === filters.reviewStatus);
    return items;
  }
  async recordDecision(id, decisionData) {
    const idx = this.reviews.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.reviews[idx] = {
      ...this.reviews[idx],
      reviewStatus: 'REVIEWED',
      decision: decisionData,
      decidedAt: new Date().toISOString()
    };
    return this.reviews[idx];
  }
}

class InMemoryComplaintRepo {
  constructor() {
    this.complaints = new Map();
  }
  async findById(id) {
    return this.complaints.get(id) || null;
  }
  async update(id, updates) {
    const existing = this.complaints.get(id) || { id };
    const updated = { ...existing, ...updates };
    this.complaints.set(id, updated);
    return updated;
  }
}

class InMemoryReputationService {
  constructor() {
    this.events = [];
  }
  async applyReviewOutcome(citizenId, outcome, decisionReason, reviewer) {
    this.events.push({ citizenId, outcome, decisionReason, reviewer });
    return { success: true };
  }
  async getReputation(citizenId) {
    return { standing: 'GOOD_STANDING', score: 85, totalSubmissions: 4, confirmedAbuseCount: 0 };
  }
}

class InMemoryAuditRepo {
  constructor() {
    this.logs = [];
  }
  async create(data) {
    this.logs.push({ ...data, id: `AUD-${this.logs.length + 1}` });
    return this.logs[this.logs.length - 1];
  }
}

describe('Feature B: Explainable False / Suspicious Complaint Analysis', () => {
  let screeningService;
  let spamReviewRepo;
  let complaintRepo;
  let reputationService;
  let auditRepo;
  let reviewService;

  beforeEach(() => {
    screeningService = new SpamScreeningService();
    spamReviewRepo = new InMemorySpamReviewRepo();
    complaintRepo = new InMemoryComplaintRepo();
    reputationService = new InMemoryReputationService();
    auditRepo = new InMemoryAuditRepo();
    reviewService = new SpamReviewService(spamReviewRepo, complaintRepo, reputationService, auditRepo);
  });

  describe('1. Malformed Content & Symbol Flood Detection', () => {
    test('detects symbol flood and excessive punctuation in complaint body', () => {
      const text = 'Road issue ??????????????????????? !!!!!!!!!!!!!!!!!!!! ####### $$$$$$$$$$$$$';
      const analysis = screeningService.detectMalformedContent(text);
      assert.strictEqual(analysis.isSymbolFlood, true);
      assert.ok(analysis.symbolRatio > 0.4);

      const result = screeningService.evaluateComplaint({
        title: 'Road issue',
        description: text
      });

      assert.ok(result.score > 0);
      assert.ok(
        result.riskIndicators.some(
          (r) => r.code === SPAM_REASON_CODES.MALFORMED_CONTENT || r.code === SPAM_REASON_CODES.EXCESSIVE_PUNCTUATION_SYMBOLS
        )
      );
    });

    test('tolerates normal punctuation and technical descriptions without flagging', () => {
      const text = 'Pothole on Main St. near landmark #42 (approx. 2 meters wide). Please inspect!';
      const analysis = screeningService.detectMalformedContent(text);
      assert.strictEqual(analysis.isMalformed, false);
      assert.strictEqual(analysis.isSymbolFlood, false);
    });
  });

  describe('2. Promotional / Phishing Spam Detection', () => {
    test('flags commercial loan, betting, and prize scams in grievances', () => {
      const scamText = 'Click here http://bit.ly/claim-cash to win cash prize and instant personal loan!';
      const isSpam = screeningService.isPromotionalOrPhishingSpam(scamText);
      assert.strictEqual(isSpam, true);

      const result = screeningService.evaluateComplaint({
        title: 'Notice',
        description: scamText
      });

      assert.ok(result.riskIndicators.some((r) => r.code === SPAM_REASON_CODES.AUTOMATED_SPAM_PATTERNS));
    });
  });

  describe('3. Fairness & Civic Protection Safeguards', () => {
    test('protects harsh civic criticism of administration and NEVER flags it', () => {
      const criticism = 'The municipal department is completely useless, corrupt and lazy! No action taken for weeks on sewer!';
      const isProtected = screeningService.isProtectedCivicExpression(criticism);
      assert.strictEqual(isProtected, true);

      const result = screeningService.evaluateComplaint({
        title: 'Corrupt officers',
        description: criticism
      });

      // Does not flag as low information density or spam
      assert.strictEqual(result.flagged, false);
      assert.ok(!result.reasonCodes.includes(SPAM_REASON_CODES.LOW_INFORMATION_DENSITY));
    });

    test('supports regional language (Devanagari / Hindi) without penalizing score', () => {
      const hindiComplaint = 'सड़क पर बड़ा गड्ढा है और पानी भरा हुआ है। कृपया जल्दी मरम्मत कराएं।';
      const result = screeningService.evaluateComplaint({
        title: 'सड़क की समस्या',
        description: hindiComplaint
      });

      assert.strictEqual(result.flagged, false);
      assert.strictEqual(result.score, 0);
    });
  });

  describe('4. Explainable Risk Indicators Breakdown', () => {
    test('produces structured riskIndicators with code, weight, evidence, and recommendations', () => {
      const mash = 'asdfasdfasdfasdf qwerty qwerty qwerty';
      const result = screeningService.evaluateComplaint({
        title: 'asdfasdfasdf',
        description: mash
      });

      assert.ok(Array.isArray(result.riskIndicators));
      assert.ok(result.riskIndicators.length > 0);
      const indicator = result.riskIndicators[0];
      assert.ok(indicator.code);
      assert.ok(indicator.weight > 0);
      assert.ok(indicator.description);
      assert.ok(indicator.evidence);
      assert.ok(indicator.recommendation);
    });
  });

  describe('5. Human Review Workflow & Data Preservation', () => {
    test('officer dismisses flag as LEGITIMATE: clears flag, preserves original grievance unchanged', async () => {
      const complaintId = 'cmp_suspicious_1';
      complaintRepo.complaints.set(complaintId, {
        id: complaintId,
        referenceNumber: 'GRV-2026-SUSP-1',
        title: 'Water pipe',
        description: 'Pipeline broken outside building',
        departmentId: 'DEPT_WATER',
        status: 'SUBMITTED',
        isFlaggedSpam: true
      });

      const review = await spamReviewRepo.create({
        complaintId,
        complaintReference: 'GRV-2026-SUSP-1',
        departmentId: 'DEPT_WATER',
        citizenId: 'cit_101',
        riskLevel: 'HIGH',
        score: 65,
        reasons: ['Elevated submission velocity']
      });

      const officer = { id: 'off_water', role: 'officer', departmentId: 'DEPT_WATER' };
      const decisionResult = await reviewService.recordReviewDecision(
        review.id,
        {
          outcome: 'LEGITIMATE',
          reason: 'Verified on-site by field staff: genuine pipeline burst requiring immediate municipal action.'
        },
        officer
      );

      assert.strictEqual(decisionResult.reviewStatus, 'REVIEWED');
      assert.strictEqual(decisionResult.decision.outcome, 'LEGITIMATE');

      // Verify complaint record is preserved and unflagged
      const updatedComplaint = await complaintRepo.findById(complaintId);
      assert.strictEqual(updatedComplaint.isFlaggedSpam, false);
      assert.strictEqual(updatedComplaint.status, 'SUBMITTED'); // Status remains intact
      assert.strictEqual(updatedComplaint.title, 'Water pipe'); // Content never overwritten
    });

    test('officer requests clarification: preserves complaint in pending information status', async () => {
      const complaintId = 'cmp_unclear';
      complaintRepo.complaints.set(complaintId, {
        id: complaintId,
        departmentId: 'DEPT_ROADS',
        status: 'SUBMITTED',
        isFlaggedSpam: true
      });

      const review = await spamReviewRepo.create({
        complaintId,
        departmentId: 'DEPT_ROADS',
        citizenId: 'cit_102',
        riskLevel: 'MEDIUM',
        score: 45
      });

      const officer = { id: 'off_roads', role: 'officer', departmentId: 'DEPT_ROADS' };
      const decisionResult = await reviewService.recordReviewDecision(
        review.id,
        {
          outcome: 'NEEDS_MORE_INFORMATION',
          reason: 'Exact house number and landmark missing. Please provide nearby shop name.'
        },
        officer
      );

      assert.strictEqual(decisionResult.reviewStatus, 'REVIEWED');
      assert.strictEqual(decisionResult.decision.outcome, 'NEEDS_MORE_INFORMATION');

      // Original complaint still exists
      const comp = await complaintRepo.findById(complaintId);
      assert.ok(comp);
      assert.strictEqual(comp.id, complaintId);
    });

    test('officer confirms abuse: records finding, updates reputation, but preserves original complaint record', async () => {
      const complaintId = 'cmp_spam_bot';
      complaintRepo.complaints.set(complaintId, {
        id: complaintId,
        title: 'Win Cash',
        departmentId: 'DEPT_POWER',
        status: 'SUBMITTED',
        isFlaggedSpam: true
      });

      const review = await spamReviewRepo.create({
        complaintId,
        departmentId: 'DEPT_POWER',
        citizenId: 'cit_bot',
        riskLevel: 'CRITICAL',
        score: 90
      });

      const officer = { id: 'off_power', role: 'officer', departmentId: 'DEPT_POWER' };
      const decisionResult = await reviewService.recordReviewDecision(
        review.id,
        {
          outcome: 'CONFIRMED_ABUSE',
          reason: 'Commercial spam advertisement repeated across multiple departments intentionally.'
        },
        officer
      );

      assert.strictEqual(decisionResult.decision.outcome, 'CONFIRMED_ABUSE');

      // Complaint is NOT deleted
      const comp = await complaintRepo.findById(complaintId);
      assert.ok(comp);
      assert.strictEqual(comp.isFlaggedSpam, true);
    });

    test('enforces department scope: denies officer from deciding cases outside assigned department', async () => {
      const review = await spamReviewRepo.create({
        complaintId: 'cmp_diff_dept',
        departmentId: 'DEPT_HEALTH',
        citizenId: 'cit_200'
      });

      const roadsOfficer = { id: 'off_roads', role: 'officer', departmentId: 'DEPT_ROADS' };

      await assert.rejects(
        () =>
          reviewService.recordReviewDecision(
            review.id,
            { outcome: 'LEGITIMATE', reason: 'Attempting to decide health case from roads' },
            roadsOfficer
          ),
        /outside your authorized department scope/
      );
    });

    test('getReviewDetail projects complaint screeningResult for transparent explainability', async () => {
      const complaintId = 'cmp_screening_test';
      const mockScreeningResult = {
        score: 65,
        riskLevel: 'HIGH',
        riskIndicators: [
          { code: 'PROMOTIONAL_PHISHING_SPAM', signal: 'PROMOTIONAL_PHISHING_SPAM', weight: 45, score: 45 }
        ]
      };
      complaintRepo.complaints.set(complaintId, {
        id: complaintId,
        referenceNumber: 'CS-2026-TEST',
        title: 'Suspicious Offer',
        description: 'Check out this loan offer',
        departmentId: 'DEPT_ROADS',
        status: 'SUBMITTED',
        screeningResult: mockScreeningResult
      });

      const review = await spamReviewRepo.create({
        complaintId,
        departmentId: 'DEPT_ROADS',
        citizenId: 'cit_101',
        riskLevel: 'HIGH',
        score: 65
      });

      const roadsOfficer = { id: 'off_roads', role: 'officer', departmentId: 'DEPT_ROADS' };
      const detail = await reviewService.getReviewDetail(review.id, roadsOfficer);

      assert.ok(detail.complaint);
      assert.ok(detail.complaint.screeningResult);
      assert.strictEqual(detail.complaint.screeningResult.score, 65);
      assert.strictEqual(detail.complaint.screeningResult.riskIndicators.length, 1);
    });
  });
});

