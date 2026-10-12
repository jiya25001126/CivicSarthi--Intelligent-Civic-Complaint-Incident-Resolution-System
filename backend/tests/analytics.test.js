/**
 * @file analytics.test.js
 * @description Comprehensive automated test suite for CivicSarthi Phase 13:
 * Aggregate Analytics & Reporting.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import createApp from '../src/app.js';

import complaintRepository from '../src/repositories/complaint.repository.js';
import { departmentRepository } from '../src/repositories/department.repository.js';
import { userRepository } from '../src/repositories/user.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import { feedbackRepository } from '../src/repositories/feedback.repository.js';
import { appealRepository } from '../src/repositories/appeal.repository.js';
import { reopeningRequestRepository } from '../src/repositories/reopeningRequest.repository.js';
import { spamReviewRepository } from '../src/repositories/spamReview.repository.js';
import { clarificationRepository } from '../src/repositories/clarification.repository.js';
import { reminderRepository } from '../src/repositories/reminder.repository.js';

import { analyticsService } from '../src/services/analytics.service.js';
import { authService } from '../src/services/auth.service.js';
import { COMPLAINT_STATUS, COMPLAINT_PRIORITY } from '../src/constants/status.constants.js';
import { escapeCsvCell } from '../src/constants/analytics.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-phase13-analytics');
const SANDBOX_COMPLAINTS_FILE = path.join(SANDBOX_DIR, 'complaints.test.json');
const SANDBOX_USERS_FILE = path.join(SANDBOX_DIR, 'users.test.json');
const SANDBOX_AUDIT_FILE = path.join(SANDBOX_DIR, 'audit_logs.test.json');
const SANDBOX_FEEDBACK_FILE = path.join(SANDBOX_DIR, 'feedback.test.json');
const SANDBOX_APPEALS_FILE = path.join(SANDBOX_DIR, 'appeals.test.json');
const SANDBOX_REOPENINGS_FILE = path.join(SANDBOX_DIR, 'reopenings.test.json');
const SANDBOX_SPAM_FILE = path.join(SANDBOX_DIR, 'spam_reviews.test.json');
const SANDBOX_CLARIFICATIONS_FILE = path.join(SANDBOX_DIR, 'clarifications.test.json');
const SANDBOX_REMINDERS_FILE = path.join(SANDBOX_DIR, 'reminders.test.json');

const app = createApp();

describe('CivicSarthi Phase 13 — Aggregate Analytics & Reporting', () => {
  let adminToken = null;
  let roadsOfficerToken = null;
  let waterOfficerToken = null;
  let citizenToken = null;

  let adminUser = null;
  let roadsOfficer = null;
  let waterOfficer = null;
  let citizenUser = null;

  before(async () => {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });

    await fs.writeFile(SANDBOX_COMPLAINTS_FILE, JSON.stringify({ complaints: [] }, null, 2));
    await fs.writeFile(SANDBOX_USERS_FILE, JSON.stringify({ users: [] }, null, 2));
    await fs.writeFile(SANDBOX_AUDIT_FILE, JSON.stringify({ auditLogs: [] }, null, 2));
    await fs.writeFile(SANDBOX_FEEDBACK_FILE, JSON.stringify({ feedback: [] }, null, 2));
    await fs.writeFile(SANDBOX_APPEALS_FILE, JSON.stringify({ appeals: [] }, null, 2));
    await fs.writeFile(SANDBOX_REOPENINGS_FILE, JSON.stringify({ reopeningRequests: [] }, null, 2));
    await fs.writeFile(SANDBOX_SPAM_FILE, JSON.stringify({ reviews: [] }, null, 2));
    await fs.writeFile(SANDBOX_CLARIFICATIONS_FILE, JSON.stringify({ clarifications: [] }, null, 2));
    await fs.writeFile(SANDBOX_REMINDERS_FILE, JSON.stringify({ reminders: [] }, null, 2));

    complaintRepository.setFilePath(SANDBOX_COMPLAINTS_FILE);
    userRepository.setFilePath(SANDBOX_USERS_FILE);
    auditLogRepository.setFilePath(SANDBOX_AUDIT_FILE);
    feedbackRepository.setFilePath(SANDBOX_FEEDBACK_FILE);
    appealRepository.setFilePath(SANDBOX_APPEALS_FILE);
    reopeningRequestRepository.setFilePath(SANDBOX_REOPENINGS_FILE);
    spamReviewRepository.setFilePath(SANDBOX_SPAM_FILE);
    clarificationRepository.setFilePath(SANDBOX_CLARIFICATIONS_FILE);
    reminderRepository.setFilePath(SANDBOX_REMINDERS_FILE);

    // Create test users
    adminUser = await userRepository.create({
      name: 'System Admin',
      email: 'admin.analytics@civicsarthi.test',
      password: 'Password123!',
      role: 'admin'
    });

    roadsOfficer = await userRepository.create({
      name: 'Officer Rajesh PWD',
      email: 'officer.roads@civicsarthi.test',
      password: 'Password123!',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    });

    waterOfficer = await userRepository.create({
      name: 'Officer Meera Jal',
      email: 'officer.water@civicsarthi.test',
      password: 'Password123!',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    });

    citizenUser = await userRepository.create({
      name: 'Citizen Vikram',
      email: 'citizen.vikram@civicsarthi.test',
      password: 'Password123!',
      role: 'citizen'
    });

    adminToken = authService.generateToken(adminUser);
    roadsOfficerToken = authService.generateToken(roadsOfficer);
    waterOfficerToken = authService.generateToken(waterOfficer);
    citizenToken = authService.generateToken(citizenUser);

    // Seed test complaints
    // 1. Roads complaint - Active / Submitted (recently filed, not overdue)
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    await complaintRepository.create({
      title: 'Pothole on Main Road Sector 4',
      description: 'Dangerous pothole near the bus stand causing vehicle damage.',
      category: 'roads',
      departmentId: 'DEPT_ROADS',
      department: 'DEPT_ROADS',
      priority: COMPLAINT_PRIORITY.HIGH,
      status: COMPLAINT_STATUS.SUBMITTED,
      state: 'Maharashtra',
      district: 'Pune',
      citizenId: citizenUser.id,
      createdAt: recentDate
    });

    // 2. Roads complaint - Resolved within SLA
    await complaintRepository.create({
      title: 'Damaged Guardrail on Flyover',
      description: 'Guardrail damaged in vehicular collision needing repair.',
      category: 'roads',
      departmentId: 'DEPT_ROADS',
      department: 'DEPT_ROADS',
      priority: COMPLAINT_PRIORITY.MEDIUM,
      status: COMPLAINT_STATUS.RESOLVED,
      state: 'Maharashtra',
      district: 'Pune',
      citizenId: citizenUser.id,
      createdAt: new Date('2026-03-05T09:00:00.000Z').toISOString(),
      resolvedAt: new Date('2026-03-15T15:00:00.000Z').toISOString(),
      statusHistory: [
        {
          timestamp: '2026-03-05T09:00:00.000Z',
          status: COMPLAINT_STATUS.SUBMITTED
        },
        {
          timestamp: '2026-03-15T15:00:00.000Z',
          status: COMPLAINT_STATUS.RESOLVED,
          remarks: 'Guardrail replaced and secured'
        }
      ]
    });

    // 3. Roads complaint - Overdue / Active
    // Created 60 days ago (SLA is 30 days)
    const oldCreated = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await complaintRepository.create({
      title: 'Stagnant Water and Broken Culvert',
      description: 'Culvert collapsed 2 months ago without any contractor visit.',
      category: 'roads',
      departmentId: 'DEPT_ROADS',
      department: 'DEPT_ROADS',
      priority: COMPLAINT_PRIORITY.CRITICAL,
      status: COMPLAINT_STATUS.IN_PROGRESS,
      state: 'Maharashtra',
      district: 'Nagpur',
      citizenId: citizenUser.id,
      reassignments: 3, // Reassignment loop
      createdAt: oldCreated,
      updatedAt: oldCreated // Stale case
    });

    // 4. Water complaint - Closed
    await complaintRepository.create({
      title: 'Contaminated Water Pipeline Leak',
      description: 'Muddy water coming through municipal supply line in ward 8.',
      category: 'water',
      departmentId: 'DEPT_WATER',
      department: 'DEPT_WATER',
      priority: COMPLAINT_PRIORITY.CRITICAL,
      status: COMPLAINT_STATUS.CLOSED,
      state: 'Maharashtra',
      district: 'Mumbai',
      citizenId: citizenUser.id,
      createdAt: new Date('2026-03-10T08:00:00.000Z').toISOString(),
      resolvedAt: new Date('2026-03-18T12:00:00.000Z').toISOString(),
      statusHistory: [
        {
          timestamp: '2026-03-10T08:00:00.000Z',
          status: COMPLAINT_STATUS.SUBMITTED
        },
        {
          timestamp: '2026-03-18T12:00:00.000Z',
          status: COMPLAINT_STATUS.CLOSED
        }
      ]
    });

    // Seed test clarification & reminder
    await clarificationRepository.create({
      complaintId: 'CS-2026-0001',
      citizenId: citizenUser.id,
      departmentId: 'DEPT_ROADS',
      type: 'QUESTION',
      content: 'Can you confirm when the field inspection is planned?',
      status: 'OPEN'
    });

    await reminderRepository.create({
      complaintId: 'CS-2026-0001',
      citizenId: citizenUser.id,
      departmentId: 'DEPT_ROADS',
      status: 'LOGGED_IN_APP'
    });

    // Seed test feedback (Phase 10)
    await feedbackRepository.create({
      complaintId: 'CS-2026-0002',
      citizenId: citizenUser.id,
      departmentId: 'DEPT_ROADS',
      rating: 5,
      comments: 'Quick resolution'
    });

    // Seed test spam review (Phase 11)
    await spamReviewRepository.create({
      complaintId: 'CS-2026-0003',
      citizenId: citizenUser.id,
      departmentId: 'DEPT_ROADS',
      riskLevel: 'HIGH',
      status: 'RESOLVED',
      decision: 'LEGITIMATE',
      decisionReason: 'Verified legitimate civic issue after field visit'
    });
  });

  after(async () => {
    complaintRepository.resetFilePath();
    userRepository.resetFilePath();
    auditLogRepository.resetFilePath();
    feedbackRepository.resetFilePath();
    appealRepository.resetFilePath();
    reopeningRequestRepository.resetFilePath();
    spamReviewRepository.resetFilePath();
    clarificationRepository.resetFilePath();
    reminderRepository.resetFilePath();

    try {
      await fs.rm(SANDBOX_DIR, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('1. Role-Based Access Control & Security', () => {
    it('DENIES unauthenticated request to analytics overview with 401', async () => {
      const res = await request(app).get('/api/v1/analytics/overview');
      assert.strictEqual(res.status, 401);
    });

    it('DENIES citizen role from accessing analytics overview with 403 FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${citizenToken}`);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.code, 'FORBIDDEN_ROLE');
    });

    it('DENIES citizen role from downloading CSV report with 403', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/export')
        .set('Authorization', `Bearer ${citizenToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('ALLOWS system admin to access global cross-department overview', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.scope.isCrossDepartment, true);
      assert.strictEqual(res.body.data.metrics.totalComplaints, 4);
    });

    it('STRICTLY SCOPES officer to assigned department, ignoring client-supplied parameter', async () => {
      // Roads officer attempts to query DEPT_WATER
      const res = await request(app)
        .get('/api/v1/analytics/overview?departmentId=DEPT_WATER')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      // Enforced scope must be DEPT_ROADS
      assert.strictEqual(res.body.data.scope.departmentId, 'DEPT_ROADS');
      assert.strictEqual(res.body.data.metrics.totalComplaints, 3);
    });
  });

  describe('2. Metric Calculations, SLA Compliance & Overdue Logic', () => {
    it('calculates correct totals, active, resolved, closed, and pending counts', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      const { metrics } = res.body.data;
      assert.strictEqual(metrics.totalComplaints, 4);
      assert.strictEqual(metrics.resolvedComplaints, 1);
      assert.strictEqual(metrics.closedComplaints, 1);
      assert.strictEqual(metrics.resolvedAndClosed, 2);
      assert.strictEqual(metrics.activeComplaints, 2);
      assert.strictEqual(metrics.pendingComplaints, 1);
      assert.strictEqual(metrics.overdueComplaints, 1);
      assert.strictEqual(metrics.highAndCriticalCount, 3);
    });

    it('calculates resolution rate with clearly defined denominator', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      const { metrics, metricDefinitions } = res.body.data;
      // 2 resolved/closed out of 4 total = 50.0%
      assert.strictEqual(metrics.resolutionRate, 50.0);
      assert.ok(metricDefinitions.resolutionRate.formula);
      assert.ok(metricDefinitions.resolutionRate.denominator);
    });

    it('calculates SLA compliance rate accurately without counting open cases', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      const { metrics } = res.body.data;
      // 2 resolved cases (both resolved within 30 days) = 100.0%
      assert.strictEqual(metrics.slaComplianceRate, 100.0);
      assert.strictEqual(metrics.eligibleResolvedForSla, 2);
    });

    it('handles empty filtered datasets gracefully with zero metrics and null compliance', async () => {
      // Query a category with 0 complaints
      const res = await request(app)
        .get('/api/v1/analytics/overview?category=healthcare')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      const { metrics } = res.body.data;
      assert.strictEqual(metrics.totalComplaints, 0);
      assert.strictEqual(metrics.resolutionRate, 0.0);
      assert.strictEqual(metrics.slaComplianceRate, null);
      assert.strictEqual(metrics.overdueComplaints, 0);
    });
  });

  describe('3. Date Filtering & Validation Bounds', () => {
    it('REJECTS unparseable startDate with 400 INVALID_DATE_FORMAT', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview?startDate=not-a-valid-date')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.code, 'INVALID_DATE_FORMAT');
    });

    it('REJECTS startDate later than endDate with 400 INVALID_DATE_RANGE', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview?startDate=2026-12-01&endDate=2026-01-01')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.code, 'INVALID_DATE_RANGE');
    });

    it('filters complaints accurately within valid startDate and endDate bounds', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/overview?startDate=2026-03-01T00:00:00.000Z&endDate=2026-03-12T00:00:00.000Z')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      // Complaints 2 (March 5) and 4 (March 10) fall in this window
      assert.strictEqual(res.body.data.metrics.totalComplaints, 2);
    });
  });

  describe('4. Time-Series Trends & Historical Reconstruction', () => {
    it('returns time-series trends with reconstructed backlog and resolution counts', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/trends?interval=day&startDate=2026-03-01T00:00:00.000Z&endDate=2026-03-20T00:00:00.000Z')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      const { trends } = res.body.data;
      assert.ok(Array.isArray(trends));
      assert.ok(trends.length > 0);

      // Verify that bins have numeric metric fields
      const firstBin = trends[0];
      assert.ok(firstBin.period);
      assert.ok(typeof firstBin.submitted === 'number');
      assert.ok(typeof firstBin.resolved === 'number');
      assert.ok(typeof firstBin.openBacklog === 'number');
      assert.ok(typeof firstBin.slaBreaches === 'number');
    });

    it('scopes trends accurately for department officer', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/trends')
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.scope.departmentId, 'DEPT_WATER');
    });
  });

  describe('5. Department Performance Comparison', () => {
    it('returns department matrix comparing workload, SLA rates, and durations', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      const { departments } = res.body.data;
      assert.ok(Array.isArray(departments));

      const roadsDept = departments.find((d) => d.departmentId === 'DEPT_ROADS');
      assert.ok(roadsDept);
      assert.strictEqual(roadsDept.totalComplaints, 3);
      assert.strictEqual(roadsDept.activeWorkload, 2);
      assert.strictEqual(roadsDept.resolvedCount, 1);
      assert.strictEqual(roadsDept.overdueCount, 1);
      assert.strictEqual(roadsDept.reassignmentLoopsCount, 1);
      assert.strictEqual(roadsDept.staleCasesCount, 1);
      assert.ok(typeof roadsDept.averageResolutionDurationHours === 'number');
    });

    it('officer query returns only their single assigned department', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/departments')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.strictEqual(res.status, 200);
      const { departments } = res.body.data;
      assert.strictEqual(departments.length, 1);
      assert.strictEqual(departments[0].departmentId, 'DEPT_ROADS');
    });
  });

  describe('6. Category & Geography Aggregates & PII Protection', () => {
    it('returns category breakdown and state/district totals without citizen PII', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/categories')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      const { categories, geography, privacySafeguard } = res.body.data;

      assert.ok(Array.isArray(categories));
      const roadsCat = categories.find((c) => c.category === 'roads');
      assert.ok(roadsCat);
      assert.strictEqual(roadsCat.count, 3);

      assert.ok(Array.isArray(geography));
      const mh = geography.find((g) => g.state === 'Maharashtra');
      assert.ok(mh);
      assert.ok(mh.districts.length > 0);

      // Verify zero PII leakage
      const rawText = JSON.stringify(res.body);
      assert.strictEqual(rawText.includes('citizen.vikram'), false);
      assert.strictEqual(rawText.includes('Citizen Vikram'), false);
      assert.ok(privacySafeguard.guarantee);
    });
  });

  describe('7. Operational Workflow, Quality & Cross-Phase Integrations', () => {
    it('aggregates Phase 10 feedback, Phase 11 spam reviews, and Phase 12 clarifications/reminders', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/workflow')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      const { clarifications, reminders, satisfactionFeedback, spamReviewDesk, anomalies } = res.body.data;

      // Phase 12 Clarifications
      assert.strictEqual(clarifications.totalRequests, 1);
      assert.strictEqual(clarifications.openRequests, 1);

      // Phase 12 Reminders
      assert.strictEqual(reminders.totalRemindersLogged, 1);
      assert.strictEqual(reminders.uniqueComplaintsReminded, 1);

      // Phase 10 Feedback
      assert.strictEqual(satisfactionFeedback.totalResponses, 1);
      assert.strictEqual(satisfactionFeedback.averageRating, 5);

      // Phase 11 Spam Desk: clearly separates screening flags from confirmed abuse
      assert.strictEqual(spamReviewDesk.totalScreeningFlags, 1);
      assert.strictEqual(spamReviewDesk.humanReviewOutcomes.clearedLegitimate, 1);
      assert.strictEqual(spamReviewDesk.humanReviewOutcomes.confirmedAbuse, 0);

      // Workflow anomalies
      assert.strictEqual(anomalies.reassignmentLoops.count, 1);
      assert.strictEqual(anomalies.staleCases.count, 1);
    });
  });

  describe('8. Safe CSV Export & Formula Injection Prevention', () => {
    it('escapeCsvCell correctly neutralizes formula injection triggers (=, +, -, @, tab)', () => {
      assert.strictEqual(escapeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
      assert.strictEqual(escapeCsvCell('+cmd|/c calc'), "'+cmd|/c calc");
      assert.strictEqual(escapeCsvCell('-2+3'), "'-2+3");
      assert.strictEqual(escapeCsvCell('@SUM(B1:B5)'), "'@SUM(B1:B5)");
      assert.strictEqual(escapeCsvCell('Normal Text'), 'Normal Text');
      assert.strictEqual(escapeCsvCell('Text with, comma'), '"Text with, comma"');
    });

    it('generates downloadable CSV report with metadata, formulas glossary, and audit log', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/export?reportType=all')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));
      assert.ok(res.headers['content-disposition'].includes('attachment'));

      const csvText = res.text;
      assert.ok(csvText.includes('CivicSarthi — Intelligent Civic Complaint & Incident Resolution System'));
      assert.ok(csvText.includes('METRIC DEFINITIONS & FORMULAS GLOSSARY:'));
      assert.ok(csvText.includes('SECTION 1: EXECUTIVE KPI SUMMARY'));
      assert.ok(csvText.includes('SECTION 2: DEPARTMENT PERFORMANCE'));
      assert.ok(csvText.includes('SECTION 3: COMPLAINT CATEGORIES'));
      assert.ok(csvText.includes('SECTION 5: WORKFLOW, REMINDERS & QUALITY'));

      // Verify audit log creation for export action
      const logs = await auditLogRepository.findAll();
      const exportLog = logs.find((l) => l.action === 'ANALYTICS_REPORT_EXPORTED');
      assert.ok(exportLog);
      assert.strictEqual(exportLog.role, 'admin');
    });

    it('supports backward compatibility alias /api/analytics/overview', async () => {
      const res = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });
  });
});
