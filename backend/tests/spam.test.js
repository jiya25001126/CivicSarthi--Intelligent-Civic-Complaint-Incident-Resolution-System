/**
 * @file spam.test.js
 * @description Comprehensive automated test suite for CivicSarthi Phase 11:
 * Spam/Fake Complaint Detection with Human Review Desk.
 *
 * Verifies:
 * 1. Deterministic screening heuristics & signals: burst submissions, identical text,
 *    gibberish/mash, rapid category cycling, duplicate candidates.
 * 2. Fairness guarantees: political/official criticism, Hindi Devanagari text,
 *    and collective public reporting are explicitly protected.
 * 3. Citizen reputation tracking: unconfirmed flags never penalize citizens,
 *    events are strictly idempotent, decisions can be reversed, public leaks prevented.
 * 4. Human review desk workflow: department scoping, RBAC, outcome transitions,
 *    mandatory justifications, and audit logging.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';

import complaintRepository from '../src/repositories/complaint.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import spamReviewRepository from '../src/repositories/spamReview.repository.js';
import citizenReputationRepository from '../src/repositories/citizenReputation.repository.js';
import { spamScreeningService } from '../src/services/spamScreening.service.js';
import { citizenReputationService } from '../src/services/citizenReputation.service.js';
import { spamReviewService } from '../src/services/spamReview.service.js';
import { authService } from '../src/services/auth.service.js';
import {
  SPAM_RISK_LEVELS,
  SPAM_REASON_CODES,
  SPAM_REVIEW_OUTCOMES,
  SPAM_REVIEW_STATUS,
  SPAM_REVIEW_STATUSES
} from '../src/constants/spam.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-phase11-spam');
const SANDBOX_COMPLAINTS_FILE = path.join(SANDBOX_DIR, 'complaints.test.json');
const SANDBOX_USERS_FILE = path.join(SANDBOX_DIR, 'users.test.json');
const SANDBOX_AUDIT_FILE = path.join(SANDBOX_DIR, 'audit_logs.test.json');
const SANDBOX_SPAM_REVIEWS_FILE = path.join(SANDBOX_DIR, 'spam_reviews.test.json');
const SANDBOX_REPUTATIONS_FILE = path.join(SANDBOX_DIR, 'reputations.test.json');

const app = createApp();

describe('CivicSarthi Phase 11 — Spam/Fake Complaint Detection & Human Review', () => {
  let adminToken = null;
  let sanitationOfficerToken = null;
  let roadsOfficerToken = null;
  let citizenToken = null;
  let citizen2Token = null;

  let adminUser = null;
  let sanitationOfficerUser = null;
  let roadsOfficerUser = null;
  let citizenUser = null;
  let citizen2User = null;

  before(async () => {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });

    // Initialize sandbox JSON fixtures
    await fs.writeFile(SANDBOX_COMPLAINTS_FILE, JSON.stringify({ metadata: { version: '1.0.0' }, complaints: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_USERS_FILE, JSON.stringify({ metadata: { total: 0 }, users: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_AUDIT_FILE, JSON.stringify({ metadata: { total: 0 }, logs: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_SPAM_REVIEWS_FILE, JSON.stringify({ metadata: { version: '1.0.0' }, spamReviews: [] }, null, 2), 'utf-8');
    await fs.writeFile(SANDBOX_REPUTATIONS_FILE, JSON.stringify({ metadata: { version: '1.0.0' }, reputations: [] }, null, 2), 'utf-8');

    // Redirect repository paths to sandbox
    complaintRepository.setFilePath(SANDBOX_COMPLAINTS_FILE);
    userRepository.setFilePath(SANDBOX_USERS_FILE);
    auditLogRepository.setFilePath(SANDBOX_AUDIT_FILE);
    spamReviewRepository.setFilePath(SANDBOX_SPAM_REVIEWS_FILE);
    citizenReputationRepository.setFilePath(SANDBOX_REPUTATIONS_FILE);

    // Seed test accounts
    adminUser = await authService.provisionUser({
      name: 'System Admin',
      email: 'admin.phase11@civicsarthi.gov.in',
      password: 'AdminPassword123!',
      role: 'admin',
      departmentId: null
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });

    sanitationOfficerUser = await authService.provisionUser({
      name: 'Water Officer Sharma',
      email: 'water.officer@civicsarthi.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });

    roadsOfficerUser = await authService.provisionUser({
      name: 'Roads Officer Patel',
      email: 'roads.officer@civicsarthi.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    }, { id: 'BOOTSTRAP', email: 'system@internal', role: 'admin' });

    const citizenReg = await authService.register({
      name: 'Ramesh Citizen',
      email: 'ramesh.citizen@example.com',
      password: 'CitizenPassword123!',
      phone: '9876543210'
    });
    citizenUser = citizenReg.user;

    const citizen2Reg = await authService.register({
      name: 'Priya Citizen',
      email: 'priya.citizen@example.com',
      password: 'CitizenPassword123!',
      phone: '9876543211'
    });
    citizen2User = citizen2Reg.user;

    // Generate valid tokens
    adminToken = authService.generateToken(adminUser);
    sanitationOfficerToken = authService.generateToken(sanitationOfficerUser);
    roadsOfficerToken = authService.generateToken(roadsOfficerUser);
    citizenToken = authService.generateToken(citizenUser);
    citizen2Token = authService.generateToken(citizen2User);
  });

  after(async () => {
    try {
      complaintRepository.resetFilePath();
      userRepository.resetFilePath();
      auditLogRepository.resetFilePath();
      spamReviewRepository.resetFilePath();
      citizenReputationRepository.resetFilePath();
      await fs.rm(SANDBOX_DIR, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  // =========================================================================
  // SECTION 1: Explainable Deterministic Screening Heuristics & Fairness
  // =========================================================================

  describe('Feature 1: Explainable Screening Heuristics & Fairness Guarantees', () => {
    it('evaluates a clean, legitimate complaint with score 0 and LOW risk', () => {
      const evaluation = spamScreeningService.evaluateComplaint({
        citizenId: 'cit-1',
        title: 'Deep pothole outside Sector 4 community market',
        description: 'A large dangerous pothole has developed after recent monsoon rains causing motorcycle accidents.',
        departmentId: 'ROADS',
        category: 'POTHOLE',
        citizenHistory: []
      });

      assert.equal(evaluation.score, 0);
      assert.equal(evaluation.riskLevel, SPAM_RISK_LEVELS.LOW);
      assert.equal(evaluation.isFlagged, false);
      assert.equal(evaluation.reasons.length, 0);
      assert.ok(evaluation.ruleVersion);
    });

    it('flags burst frequency submissions from the same citizen account within time window', () => {
      const now = Date.now();
      const burstHistory = [
        { id: 'c-1', citizenId: 'cit-burst', createdAt: new Date(now - 10000).toISOString(), departmentId: 'ROADS', title: 'Pothole 1' },
        { id: 'c-2', citizenId: 'cit-burst', createdAt: new Date(now - 20000).toISOString(), departmentId: 'ROADS', title: 'Pothole 2' },
        { id: 'c-3', citizenId: 'cit-burst', createdAt: new Date(now - 30000).toISOString(), departmentId: 'ROADS', title: 'Pothole 3' },
        { id: 'c-4', citizenId: 'cit-burst', createdAt: new Date(now - 40000).toISOString(), departmentId: 'ROADS', title: 'Pothole 4' },
        { id: 'c-5', citizenId: 'cit-burst', createdAt: new Date(now - 50000).toISOString(), departmentId: 'ROADS', title: 'Pothole 5' }
      ];

      const evaluation = spamScreeningService.evaluateComplaint({
        citizenId: 'cit-burst',
        title: 'Pothole 6 rapid submit',
        description: 'Another rapid submission to flood the system queue.',
        departmentId: 'ROADS',
        category: 'POTHOLE',
        citizenHistory: burstHistory
      });

      assert.ok(evaluation.score >= 35);
      assert.ok(evaluation.reasonCodes.includes(SPAM_REASON_CODES.BURST_SUBMISSION_DETECTED));
      assert.ok(evaluation.signals.burstFrequency.triggered);
    });

    it('flags repeated identical complaint text from the same citizen', () => {
      const identicalText = 'Garbage has not been cleared for 3 weeks near the gate.';
      const citizenHistory = [
        {
          id: 'c-10',
          citizenId: 'cit-repeat',
          createdAt: new Date().toISOString(),
          title: 'Garbage issue',
          description: identicalText
        }
      ];

      const evaluation = spamScreeningService.evaluateComplaint({
        citizenId: 'cit-repeat',
        title: 'Garbage issue',
        description: identicalText,
        departmentId: 'SANITATION',
        category: 'GARBAGE',
        citizenHistory
      });

      assert.ok(evaluation.reasonCodes.includes(SPAM_REASON_CODES.IDENTICAL_COMPLAINT_TEXT));
      assert.ok(evaluation.signals.repeatedIdenticalText.triggered);
    });

    it('flags gibberish, keyboard mash, and low information density content', () => {
      const evaluation = spamScreeningService.evaluateComplaint({
        citizenId: 'cit-gibberish',
        title: 'asdfghjkl qwertyuiop zxcvbnm',
        description: 'asdfghjkl zxcvbnm qwertyuiop asdfghjkl zxcvbnm 1234567890',
        departmentId: 'WATER',
        category: 'PIPELINE',
        citizenHistory: []
      });

      assert.ok(evaluation.reasonCodes.includes(SPAM_REASON_CODES.GIBBERISH_NONSENSE_DETECTED));
      assert.ok(evaluation.signals.gibberishOrMash.triggered);
    });

    it('flags rapid category cycling across 4 different departments in a short burst', () => {
      const now = Date.now();
      const cyclingHistory = [
        { id: 'c-c1', citizenId: 'cit-cycler', departmentId: 'WATER', createdAt: new Date(now - 10000).toISOString() },
        { id: 'c-c2', citizenId: 'cit-cycler', departmentId: 'ELECTRICITY', createdAt: new Date(now - 20000).toISOString() },
        { id: 'c-c3', citizenId: 'cit-cycler', departmentId: 'HEALTH', createdAt: new Date(now - 30000).toISOString() }
      ];

      const evaluation = spamScreeningService.evaluateComplaint({
        citizenId: 'cit-cycler',
        title: 'Broken streetlamp pole',
        description: 'Streetlight pole is bent and blinking continuously.',
        departmentId: 'ROADS',
        category: 'STREETLIGHT',
        citizenHistory: cyclingHistory
      });

      assert.ok(evaluation.reasonCodes.includes(SPAM_REASON_CODES.RAPID_CATEGORY_CYCLING));
      assert.ok(evaluation.signals.rapidCategoryCycling.triggered);
    });

    it('incorporates Phase 6 duplicate candidate signals into score', () => {
      const evaluation = spamScreeningService.evaluateComplaint({
        citizenId: 'cit-dup',
        title: 'Overflowing open sewer near school',
        description: 'Sewage water is spilling into the school playground.',
        departmentId: 'SANITATION',
        category: 'DRAINAGE',
        citizenHistory: [],
        duplicateCandidates: [
          { complaintId: 'cmp-existing-1', complaintReference: 'SAN-2026-0001', similarityScore: 0.92 }
        ]
      });

      assert.ok(evaluation.reasonCodes.includes(SPAM_REASON_CODES.DUPLICATE_CONTENT_DETECTED));
      assert.ok(evaluation.signals.duplicateCandidates.triggered);
    });

    it('FAIRNESS: Never flags complaints merely criticizing officials or government administration', () => {
      const criticalText =
        'The municipal sanitation department is completely negligent, corrupt, and lazy! Officers are doing nothing despite 5 reminders!';

      const evaluation = spamScreeningService.evaluateComplaint({
        citizenId: 'cit-critic',
        title: 'Severe negligence and no action from sanitation ward officers',
        description: criticalText,
        departmentId: 'SANITATION',
        category: 'GARBAGE',
        citizenHistory: []
      });

      assert.equal(evaluation.signals.gibberishOrMash.triggered, false);
      assert.equal(evaluation.score, 0);
      assert.equal(evaluation.riskLevel, SPAM_RISK_LEVELS.LOW);
      assert.equal(evaluation.isFlagged, false);
    });

    it('FAIRNESS: Never flags valid Hindi Devanagari regional language complaints as gibberish', () => {
      const hindiText =
        'हमारे मोहल्ले में पिछले दो हफ्ते से सड़क पर बड़ा गड्ढा है और गंदा पानी भरा हुआ है। कृपया जल्दी मरम्मत कराएं।';

      const evaluation = spamScreeningService.evaluateComplaint({
        citizenId: 'cit-hindi',
        title: 'सड़क पर बड़ा गड्ढा और जलभराव',
        description: hindiText,
        departmentId: 'ROADS',
        category: 'POTHOLE',
        citizenHistory: []
      });

      assert.equal(evaluation.signals.gibberishOrMash.triggered, false);
      assert.equal(evaluation.score, 0);
      assert.equal(evaluation.riskLevel, SPAM_RISK_LEVELS.LOW);
      assert.equal(evaluation.isFlagged, false);
    });

    it('FAIRNESS: Never penalizes collective civic reporting from different citizen accounts', () => {
      // Citizen A already submitted a complaint for a main water pipeline burst
      // Citizen B submits the same issue with their own account
      const evaluation = spamScreeningService.evaluateComplaint({
        citizenId: 'citizen-B',
        title: 'Main pipeline burst at Ring Road junction',
        description: 'Clean drinking water is flooding the main road since morning.',
        departmentId: 'WATER',
        category: 'LEAKAGE',
        citizenHistory: [] // Citizen B has no previous rapid submissions
      });

      assert.equal(evaluation.signals.burstFrequency.triggered, false);
      assert.equal(evaluation.signals.repeatedIdenticalText.triggered, false);
      assert.equal(evaluation.isFlagged, false);
    });

    it('is strictly deterministic and reproducible for identical inputs', () => {
      const input = {
        citizenId: 'cit-det',
        title: 'Test Pothole Submission',
        description: 'Deterministic consistency test for Phase 11 screening engine.',
        departmentId: 'ROADS',
        category: 'POTHOLE',
        citizenHistory: []
      };

      const res1 = spamScreeningService.evaluateComplaint(input);
      const res2 = spamScreeningService.evaluateComplaint(input);

      assert.deepEqual(res1.score, res2.score);
      assert.deepEqual(res1.riskLevel, res2.riskLevel);
      assert.deepEqual(res1.reasonCodes, res2.reasonCodes);
      assert.deepEqual(res1.signals, res2.signals);
    });
  });

  // =========================================================================
  // SECTION 2: Citizen Reputation Tracking & Audit Safety
  // =========================================================================

  describe('Feature 2: Citizen Reputation Tracking & Ledger Audit', () => {
    it('initializes a default reputation record in GOOD_STANDING with trust score 100', async () => {
      const record = await citizenReputationService.getOrCreateReputation(citizenUser.id);
      assert.equal(record.citizenId, citizenUser.id);
      assert.equal(record.reputationScore, 100);
      assert.equal(record.status, 'GOOD_STANDING');
      assert.equal(record.metrics.totalSubmissions, 0);
    });

    it('unconfirmed automated flags do NOT deduct reputation points', async () => {
      const preRecord = await citizenReputationService.getOrCreateReputation(citizenUser.id);
      const preScore = preRecord.reputationScore;

      // Log an unconfirmed flag event
      await citizenReputationService.recordEvent({
        citizenId: citizenUser.id,
        eventType: 'FLAGGED_FOR_REVIEW',
        sourceEventId: 'flag-event-1',
        details: { complaintId: 'cmp-test-1', score: 75 },
        actor: { role: 'system', id: 'screening-engine' }
      });

      const postRecord = await citizenReputationService.getOrCreateReputation(citizenUser.id);
      assert.equal(postRecord.reputationScore, preScore);
      assert.equal(postRecord.metrics.unconfirmedFlagCount, 1);
      assert.equal(postRecord.metrics.confirmedAbuseCount, 0);
    });

    it('prevents duplicate event application using sourceEventId idempotency', async () => {
      const res1 = await citizenReputationService.recordEvent({
        citizenId: citizenUser.id,
        eventType: 'HUMAN_CONFIRMED_ABUSE',
        sourceEventId: 'idempotent-abuse-99',
        details: { complaintId: 'cmp-abuse-1', reason: 'Deliberate spam flood' },
        actor: { role: 'officer', id: sanitationOfficerUser.id }
      });

      const res2 = await citizenReputationService.recordEvent({
        citizenId: citizenUser.id,
        eventType: 'HUMAN_CONFIRMED_ABUSE',
        sourceEventId: 'idempotent-abuse-99',
        details: { complaintId: 'cmp-abuse-1', reason: 'Deliberate spam flood duplicate' },
        actor: { role: 'officer', id: sanitationOfficerUser.id }
      });

      // Second invocation must be detected as duplicate and not re-deduct points
      assert.equal(res2.applied, false);
      assert.equal(res2.reputation.metrics.confirmedAbuseCount, 1);
    });

    it('records decision reversals and restores reputation points', async () => {
      const repBefore = await citizenReputationService.getOrCreateReputation(citizenUser.id);
      const scoreBeforeReversal = repBefore.reputationScore;

      // Record reversal (overturned on supervisor appeal)
      const reversalRes = await citizenReputationService.recordEvent({
        citizenId: citizenUser.id,
        eventType: 'HUMAN_REVERSED_DECISION',
        sourceEventId: 'reversal-evt-1',
        details: { complaintId: 'cmp-abuse-1', justification: 'Citizen demonstrated actual breakdown' },
        actor: { role: 'admin', id: adminUser.id }
      });

      assert.equal(reversalRes.applied, true);
      assert.ok(reversalRes.reputation.reputationScore > scoreBeforeReversal);
    });

    it('provides role-projected standing: citizen sees private summary, public tracking sees nothing', async () => {
      const citizenView = await citizenReputationService.getPublicStanding(citizenUser.id, 'citizen');
      assert.ok(citizenView.reputationScore !== undefined);
      assert.ok(citizenView.auditTrail === undefined); // Private internal ledger suppressed for citizen

      const publicView = await citizenReputationService.getPublicStanding(citizenUser.id, 'public');
      assert.equal(publicView.reputationScore, undefined);
      assert.equal(publicView.auditTrail, undefined);
    });
  });

  // =========================================================================
  // SECTION 3: Flagged Complaint Review Desk & RBAC Scoping
  // =========================================================================

  describe('Feature 3: Flagged Review Desk Workflow & Department Scope', () => {
    let sanitationComplaint = null;
    let roadsComplaint = null;
    let spamReviewSanitation = null;
    let spamReviewRoads = null;

    before(async () => {
      // Create a flagged water complaint
      sanitationComplaint = await complaintRepository.create({
        citizenId: citizenUser.id,
        title: 'qwertyuiop asdfghjkl zxcvbnm',
        description: 'qwertyuiop asdfghjkl zxcvbnm 1234567890',
        departmentId: 'DEPT_WATER',
        category: 'water',
        state: 'Delhi',
        district: 'New Delhi',
        screeningResult: {
          score: 85,
          riskLevel: SPAM_RISK_LEVELS.HIGH,
          isFlagged: true,
          reasons: ['Malformed or keyboard-mash gibberish detected'],
          reasonCodes: [SPAM_REASON_CODES.GIBBERISH_NONSENSE_DETECTED]
        },
        isFlaggedSpam: true
      });

      spamReviewSanitation = await spamReviewRepository.create({
        complaintId: sanitationComplaint.id,
        complaintReference: sanitationComplaint.referenceId,
        citizenId: citizenUser.id,
        departmentId: 'DEPT_WATER',
        score: 85,
        riskLevel: SPAM_RISK_LEVELS.HIGH,
        status: SPAM_REVIEW_STATUSES.PENDING_REVIEW,
        reasons: ['Malformed or keyboard-mash gibberish detected'],
        reasonCodes: [SPAM_REASON_CODES.GIBBERISH_NONSENSE_DETECTED]
      });

      // Create a flagged roads complaint
      roadsComplaint = await complaintRepository.create({
        citizenId: citizenUser.id,
        title: 'pothole rapid submit burst',
        description: 'pothole rapid submit burst test',
        departmentId: 'DEPT_ROADS',
        category: 'roads',
        state: 'Delhi',
        district: 'New Delhi',
        screeningResult: {
          score: 75,
          riskLevel: SPAM_RISK_LEVELS.HIGH,
          isFlagged: true,
          reasons: ['Burst submission frequency detected'],
          reasonCodes: [SPAM_REASON_CODES.BURST_SUBMISSION_DETECTED]
        },
        isFlaggedSpam: true
      });

      spamReviewRoads = await spamReviewRepository.create({
        complaintId: roadsComplaint.id,
        complaintReference: roadsComplaint.referenceId,
        citizenId: citizenUser.id,
        departmentId: 'DEPT_ROADS',
        score: 75,
        riskLevel: SPAM_RISK_LEVELS.HIGH,
        status: SPAM_REVIEW_STATUSES.PENDING_REVIEW,
        reasons: ['Burst submission frequency detected'],
        reasonCodes: [SPAM_REASON_CODES.BURST_SUBMISSION_DETECTED]
      });
    });

    it('DENIES unauthenticated access to spam reviews with 401', async () => {
      const res = await request(app).get('/api/v1/spam-reviews');
      assert.equal(res.status, 401);
    });

    it('DENIES citizen role from accessing internal review queue with 403', async () => {
      const res = await request(app)
        .get('/api/v1/spam-reviews')
        .set('Authorization', `Bearer ${citizenToken}`);
      assert.equal(res.status, 403);
    });

    it('ENFORCES department scope: water officer sees water review, not roads', async () => {
      const res = await request(app)
        .get('/api/v1/spam-reviews')
        .set('Authorization', `Bearer ${sanitationOfficerToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      // All returned reviews must be DEPT_WATER
      for (const item of res.body.data) {
        assert.equal(item.departmentId, 'DEPT_WATER');
      }
    });

    it('ALLOWS system admin to view reviews across all departments', async () => {
      const res = await request(app)
        .get('/api/v1/spam-reviews')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      const deptIds = res.body.data.map((r) => r.departmentId);
      assert.ok(deptIds.includes('DEPT_WATER'));
      assert.ok(deptIds.includes('DEPT_ROADS'));
    });

    it('DENIES officer from reviewing complaints outside their assigned department', async () => {
      // Roads officer attempts to record decision on water review
      const res = await request(app)
        .post(`/api/v1/spam-reviews/${spamReviewSanitation.id}/decision`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          decision: SPAM_REVIEW_OUTCOMES.CONFIRMED_ABUSE,
          decisionReason: 'Unauthorized cross department attempt to close review'
        });

      assert.equal(res.status, 403);
    });

    it('REJECTS review decision with short or missing justification (<10 chars) with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/spam-reviews/${spamReviewSanitation.id}/decision`)
        .set('Authorization', `Bearer ${sanitationOfficerToken}`)
        .send({
          decision: SPAM_REVIEW_OUTCOMES.CONFIRMED_ABUSE,
          decisionReason: 'Too short'
        });

      assert.equal(res.status, 400);
    });

    it('REJECTS invalid decision outcome enum with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/spam-reviews/${spamReviewSanitation.id}/decision`)
        .set('Authorization', `Bearer ${sanitationOfficerToken}`)
        .send({
          decision: 'INVALID_OUTCOME',
          decisionReason: 'Valid length justification for testing invalid enum value.'
        });

      assert.equal(res.status, 400);
    });

    it('SUCCESS: Officer marks flagged complaint as LEGITIMATE, clearing flag without disrupting grievance lifecycle', async () => {
      const res = await request(app)
        .post(`/api/v1/spam-reviews/${spamReviewSanitation.id}/decision`)
        .set('Authorization', `Bearer ${sanitationOfficerToken}`)
        .send({
          decision: SPAM_REVIEW_OUTCOMES.LEGITIMATE,
          decisionReason: 'Verified on-site by water inspector: burst pipeline exists.',
          notes: 'Heuristic flag was triggered by keyboard typo in description.'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.reviewStatus, SPAM_REVIEW_STATUS.REVIEWED);
      assert.equal(res.body.data.decision?.outcome, SPAM_REVIEW_OUTCOMES.LEGITIMATE);

      // Verify complaint itself had spam flag cleared
      const updatedComplaint = await complaintRepository.findById(sanitationComplaint.id);
      assert.equal(updatedComplaint.isFlaggedSpam, false);
      assert.equal(updatedComplaint.screeningResult?.reviewStatus, SPAM_REVIEW_OUTCOMES.LEGITIMATE);
    });

    it('SUCCESS: Officer marks flagged complaint as CONFIRMED_ABUSE, updating review and citizen reputation ledger', async () => {
      const res = await request(app)
        .post(`/api/v1/spam-reviews/${spamReviewRoads.id}/decision`)
        .set('Authorization', `Bearer ${roadsOfficerToken}`)
        .send({
          decision: SPAM_REVIEW_OUTCOMES.CONFIRMED_ABUSE,
          decisionReason: 'Confirmed automated bot script submitting synthetic random telemetry.',
          notes: 'Account flagged for administrative monitor.'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.reviewStatus, SPAM_REVIEW_STATUS.REVIEWED);
      assert.equal(res.body.data.decision?.outcome, SPAM_REVIEW_OUTCOMES.CONFIRMED_ABUSE);

      // Verify citizen reputation ledger updated
      const rep = await citizenReputationRepository.findByCitizenId(citizenUser.id);
      assert.ok(rep.confirmedAbuseCount >= 1);
    });
  });

  // =========================================================================
  // SECTION 4: Submission Pipeline Integration & Graceful Fallback
  // =========================================================================

  describe('Feature 4: Citizen Submission Pipeline Integration', () => {
    it('automatically screens new citizen submission and assigns screening metadata', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizen2Token}`)
        .send({
          title: 'Damaged water meter causing major street flood',
          description: 'The commercial water meter at Gandhi Road has burst and water is flooding businesses.',
          departmentId: 'DEPT_WATER',
          category: 'water',
          state: 'Delhi',
          district: 'New Delhi',
          location: {
            address: 'Gandhi Road Junction',
            coordinates: [77.209, 28.6139]
          }
        });

      assert.equal(res.status, 201);
      assert.ok(res.body.data.referenceNumber || res.body.data.referenceId);
      assert.ok(res.body.data.screeningResult !== undefined);
      assert.equal(res.body.data.screeningResult.riskLevel, SPAM_RISK_LEVELS.LOW);
      assert.equal(res.body.data.isFlaggedSpam, false);
    });

    it('automatically queues a high-risk submission into spam review queue', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizen2Token}`)
        .send({
          title: 'Damaged water meter causing major street flood',
          description: 'The commercial water meter at Gandhi Road has burst and water is flooding businesses.',
          departmentId: 'DEPT_WATER',
          category: 'water',
          state: 'Delhi',
          district: 'New Delhi',
          location: {
            address: 'Gandhi Road Junction',
            coordinates: [77.209, 28.6139]
          }
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.isFlaggedSpam, true);
      assert.ok(res.body.data.spamReviewId);

      // Verify it appears in spam reviews
      const review = await spamReviewRepository.findById(res.body.data.spamReviewId);
      assert.ok(review);
      assert.equal(review.reviewStatus || review.status, SPAM_REVIEW_STATUS.PENDING);
      assert.equal(review.departmentId, 'DEPT_WATER');
    });

    it('citizen tracking endpoint never leaks internal screening evidence or reviewer notes', async () => {
      const res = await request(app)
        .get('/api/v1/citizen/reputation')
        .set('Authorization', `Bearer ${citizen2Token}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.reputationScore !== undefined);
      // Ensure no raw internal audit logs or reviewer personal details are exposed
      assert.equal(res.body.data.auditTrail, undefined);
    });
  });
});
