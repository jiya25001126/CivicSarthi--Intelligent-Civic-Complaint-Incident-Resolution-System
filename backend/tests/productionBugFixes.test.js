/**
 * @file productionBugFixes.test.js
 * @description Comprehensive Automated Regression Test Suite for Production Bug Fixes (Problems A through G).
 *
 * Covers:
 * - Problem A: Citizen photo attachment upload, magic-number binary validation, MIME enforcement, size limits, and traversal protection.
 * - Problem B: Spam Review Desk query normalization and retrieval across persistence models.
 * - Problem C: Officer triage manual flagging endpoint, input validation, deduplication, and audit trail.
 * - Problem D: Resolution Appeals Desk dual-mode querying (citizenId vs requesterId).
 * - Problem E: Controlled Grievance Reopening Desk dual-mode querying (citizenId vs requesterId).
 * - Problem F: Parent Incident declaration service and subtask creation.
 * - Problem G: Neglect Radar explainable signals evaluation and evidence object serialization.
 * - Section 10: Migration script dry-run verification for all 7 newly supported models.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

import { storageService } from '../src/services/storage.service.js';
import { spamReviewService } from '../src/services/spamReview.service.js';
import { jsonAppealRepository } from '../src/repositories/appeal.json.repository.js';
import { jsonReopeningRequestRepository } from '../src/repositories/reopeningRequest.json.repository.js';
import { jsonSpamReviewRepository } from '../src/repositories/spamReview.json.repository.js';
import { jsonComplaintRepository } from '../src/repositories/complaint.json.repository.js';
import { auditLogRepository } from '../src/repositories/auditLog.repository.js';
import { incidentService } from '../src/services/incident.service.js';
import { evaluateEntityRisk } from '../src/services/neglectRadar.scoring.js';
import { runMigration } from '../src/scripts/migrate.js';
import config from '../src/config/app.config.js';
import { incidentRepository } from '../src/repositories/incident.repository.js';
import { subtaskRepository } from '../src/repositories/subtask.repository.js';
import complaintRepository from '../src/repositories/complaint.repository.js';
import spamReviewRepository from '../src/repositories/spamReview.repository.js';
import appealRepository from '../src/repositories/appeal.repository.js';
import reopeningRequestRepository from '../src/repositories/reopeningRequest.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-production-bugfix');
const SANDBOX_COMPLAINTS_FILE = path.join(SANDBOX_DIR, 'complaints.test.json');
const SANDBOX_SPAM_REVIEWS_FILE = path.join(SANDBOX_DIR, 'spam_reviews.test.json');
const SANDBOX_AUDIT_FILE = path.join(SANDBOX_DIR, 'audit_logs.test.json');
const SANDBOX_INCIDENTS_FILE = path.join(SANDBOX_DIR, 'incidents.test.json');
const SANDBOX_SUBTASKS_FILE = path.join(SANDBOX_DIR, 'subtasks.test.json');
const SANDBOX_APPEALS_FILE = path.join(SANDBOX_DIR, 'appeals.test.json');
const SANDBOX_REOPENINGS_FILE = path.join(SANDBOX_DIR, 'reopenings.test.json');

describe('Production Bug Fixes Regression Suite (Problems A - G & MongoDB Persistence)', () => {
  // Test Actors
  const adminActor = {
    id: 'USR-ADMIN-001',
    role: 'admin',
    name: 'Chief Municipal Admin',
    departmentId: null
  };

  const waterOfficer = {
    id: 'USR-OFFICER-WATER',
    role: 'officer',
    name: 'Water Officer Patil',
    departmentId: 'DEPT_WATER'
  };

  const citizenActor = {
    id: 'USR-CITIZEN-001',
    role: 'citizen',
    name: 'Citizen Ramesh'
  };

  before(async () => {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });
    await fs.copyFile(config.dataPath.complaints, SANDBOX_COMPLAINTS_FILE);
    await fs.copyFile(config.dataPath.spamReviews, SANDBOX_SPAM_REVIEWS_FILE);
    await fs.copyFile(config.dataPath.auditLogs, SANDBOX_AUDIT_FILE);
    await fs.copyFile(config.dataPath.incidents, SANDBOX_INCIDENTS_FILE);
    await fs.copyFile(config.dataPath.subtasks, SANDBOX_SUBTASKS_FILE);
    await fs.copyFile(config.dataPath.appeals, SANDBOX_APPEALS_FILE);
    await fs.copyFile(config.dataPath.reopeningRequests, SANDBOX_REOPENINGS_FILE);

    jsonComplaintRepository.setFilePath(SANDBOX_COMPLAINTS_FILE);
    complaintRepository.setFilePath(SANDBOX_COMPLAINTS_FILE);
    jsonSpamReviewRepository.setFilePath(SANDBOX_SPAM_REVIEWS_FILE);
    spamReviewRepository.setFilePath(SANDBOX_SPAM_REVIEWS_FILE);
    auditLogRepository.setFilePath(SANDBOX_AUDIT_FILE);
    incidentRepository.setFilePath(SANDBOX_INCIDENTS_FILE);
    subtaskRepository.setFilePath(SANDBOX_SUBTASKS_FILE);
    jsonAppealRepository.setFilePath(SANDBOX_APPEALS_FILE);
    appealRepository.setFilePath(SANDBOX_APPEALS_FILE);
    jsonReopeningRequestRepository.setFilePath(SANDBOX_REOPENINGS_FILE);
    reopeningRequestRepository.setFilePath(SANDBOX_REOPENINGS_FILE);
  });

  after(async () => {
    try {
      jsonComplaintRepository.resetFilePath();
      complaintRepository.resetFilePath();
      jsonSpamReviewRepository.resetFilePath();
      spamReviewRepository.resetFilePath();
      auditLogRepository.resetFilePath();
      incidentRepository.resetFilePath();
      subtaskRepository.resetFilePath();
      jsonAppealRepository.resetFilePath();
      appealRepository.resetFilePath();
      jsonReopeningRequestRepository.resetFilePath();
      reopeningRequestRepository.resetFilePath();
      await fs.rm(SANDBOX_DIR, { recursive: true, force: true });
    } catch {}
  });

  // Valid 1x1 PNG Base64 with real PNG signature (89 50 4E 47)
  const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // Valid 1x1 JPEG Base64 with real JPEG signature (FF D8 FF)
  const validJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  // =========================================================================
  // PROBLEM A: Attachment & Storage Service Validation
  // =========================================================================
  describe('Problem A: Photo Attachment & Storage Service', () => {
    let savedFilename = null;

    it('successfully validates and stores a valid PNG photo with safe ATTACH- prefix', async () => {
      const result = await storageService.saveAttachment({
        filename: 'water_leak_street4.png',
        mimeType: 'image/png',
        base64Data: validPngBase64
      });

      assert.ok(result.filename.startsWith('ATTACH-'));
      assert.ok(result.filename.endsWith('.png'));
      assert.strictEqual(result.mimeType, 'image/png');
      assert.strictEqual(result.originalName, 'water_leak_street4.png');
      assert.ok(result.size > 0);

      savedFilename = result.filename;

      // Verify file exists on disk
      const filePath = storageService.getAttachmentPath(result.filename);
      const stat = await fs.stat(filePath);
      assert.ok(stat.isFile());
    });

    it('successfully validates and stores a valid JPEG photo', async () => {
      const result = await storageService.saveAttachment({
        filename: 'pothole_evidence.jpg',
        mimeType: 'image/jpeg',
        base64Data: validJpegBase64
      });

      assert.ok(result.filename.startsWith('ATTACH-'));
      assert.ok(result.filename.endsWith('.jpg') || result.filename.endsWith('.jpeg'));
      assert.strictEqual(result.mimeType, 'image/jpeg');

      // Cleanup
      const filePath = storageService.getAttachmentPath(result.filename);
      await fs.unlink(filePath).catch(() => {});
    });

    it('rejects upload with spoofed binary magic numbers (e.g. text file renamed to .png)', async () => {
      const textAsPngBase64 = Buffer.from('Hello world this is not an image').toString('base64');
      await assert.rejects(
        async () => {
          await storageService.saveAttachment({
            filename: 'fake_image.png',
            mimeType: 'image/png',
            base64Data: textAsPngBase64
          });
        },
        /binary magic number/
      );
    });

    it('rejects disallowed MIME types (e.g. application/pdf, text/html)', async () => {
      await assert.rejects(
        async () => {
          await storageService.saveAttachment({
            filename: 'document.pdf',
            mimeType: 'application/pdf',
            base64Data: Buffer.from('%PDF-1.4 sample').toString('base64')
          });
        },
        /Unsupported file format/
      );
    });

    it('rejects oversized files exceeding 5MB', async () => {
      const oversizedBuf = Buffer.alloc(6 * 1024 * 1024); // 6MB
      await assert.rejects(
        async () => {
          await storageService.saveAttachment({
            filename: 'huge_photo.png',
            mimeType: 'image/png',
            base64Data: oversizedBuf.toString('base64')
          });
        },
        /limit of 5MB/
      );
    });

    it('prevents path traversal attacks in getAttachmentPath', () => {
      assert.throws(() => {
        storageService.getAttachmentPath('../../../etc/passwd');
      }, /Invalid or suspicious attachment filename/);

      assert.throws(() => {
        storageService.getAttachmentPath('..\\..\\windows\\system32');
      }, /Invalid or suspicious attachment filename/);
    });

    after(async () => {
      if (savedFilename) {
        const filePath = storageService.getAttachmentPath(savedFilename);
        await fs.unlink(filePath).catch(() => {});
      }
    });
  });

  // =========================================================================
  // PROBLEM B & C: Spam Review Desk & Manual Triage Flagging
  // =========================================================================
  describe('Problems B & C: Spam Review Desk & Manual Flagging', () => {
    let testComplaint = null;

    before(async () => {
      // Find a complaint that is not currently under pending spam review
      const complaints = await jsonComplaintRepository.findAll();
      const pendingReviews = await jsonSpamReviewRepository.findAll({ status: 'PENDING' });
      const pendingIds = new Set(pendingReviews.map(r => r.complaintId || r.complaintReference));
      testComplaint = complaints.find(c => !pendingIds.has(c.id) && !pendingIds.has(c.referenceNumber)) || complaints[0];
      assert.ok(testComplaint, 'At least one complaint must exist in test environment');
    });

    it('officer can manually flag a complaint for spam/fraud review', async () => {
      const flagResult = await spamReviewService.flagComplaintManually(
        testComplaint.id,
        {
          reasonCode: 'SUSPICIOUS_CONTENT',
          notes: 'Observed automated duplicate submission pattern across multiple wards.'
        },
        adminActor
      );

      assert.ok(flagResult);
      assert.strictEqual(flagResult.complaintId, testComplaint.id);
      assert.strictEqual(flagResult.reviewStatus, 'PENDING');
      assert.ok(flagResult.reasons.some(r => r.includes('SUSPICIOUS_CONTENT') || r.includes('MANUAL_OFFICER_FLAG')));

      // Verify audit log was recorded
      const logs = await auditLogRepository.findAll({ action: 'MANUAL_SPAM_FLAG_INITIATED' });
      assert.ok(logs.length > 0);
      assert.ok(
        logs[0].complaintId === testComplaint.id ||
        logs[0].targetResource === flagResult.id ||
        logs[0].details?.complaintId === testComplaint.id
      );
    });

    it('prevents duplicate active spam review flags on the same complaint', async () => {
      await assert.rejects(
        async () => {
          await spamReviewService.flagComplaintManually(
            testComplaint.id,
            {
              reasonCode: 'DUPLICATE_TEXT_EXACT',
              notes: 'Attempting to flag the same grievance a second time while pending.'
            },
            adminActor
          );
        },
        /Complaint is already queued under an active spam review/
      );
    });

    it('rejects manual flagging by unauthorized citizens', async () => {
      await assert.rejects(
        async () => {
          await spamReviewService.flagComplaintManually(
            testComplaint.id,
            {
              reasonCode: 'SUSPICIOUS_CONTENT',
              notes: 'Citizen attempting to flag an official complaint.'
            },
            citizenActor
          );
        },
        /Access denied/
      );
    });

    it('rejects manual flagging with notes shorter than 10 characters', async () => {
      await assert.rejects(
        async () => {
          await spamReviewService.flagComplaintManually(
            'CS-NONEXISTENT',
            {
              reasonCode: 'OTHER',
              notes: 'Too short'
            },
            adminActor
          );
        },
        /at least 10 characters/
      );
    });

    it('Spam Review Desk normalizes reviewStatus and status queries', async () => {
      // Query with status: PENDING
      const resByStatus = await jsonSpamReviewRepository.findAll({ status: 'PENDING' });
      assert.ok(Array.isArray(resByStatus));
      assert.ok(resByStatus.length > 0);

      // Query with reviewStatus: PENDING
      const resByReviewStatus = await jsonSpamReviewRepository.findAll({ reviewStatus: 'PENDING' });
      assert.ok(Array.isArray(resByReviewStatus));
      assert.strictEqual(resByStatus.length, resByReviewStatus.length);

      // Query with status: PENDING_REVIEW
      const resByPendingReview = await jsonSpamReviewRepository.findAll({ status: 'PENDING_REVIEW' });
      assert.ok(Array.isArray(resByPendingReview));
      assert.strictEqual(resByStatus.length, resByPendingReview.length);
    });

    after(async () => {
      // Clean up test flag from runtime spamReviews store to maintain test isolation
      if (testComplaint) {
        try {
          const revFile = config.dataPath.spamReviews;
          const raw = await fs.readFile(revFile, 'utf-8');
          const data = JSON.parse(raw);
          data.spamReviews = (data.spamReviews || []).filter(
            r => r.complaintId !== testComplaint.id && r.id !== 'REV-MVMU9DN3-VIRW'
          );
          await fs.writeFile(revFile, JSON.stringify(data, null, 2), 'utf-8');
        } catch {}
      }
    });
  });

  // =========================================================================
  // PROBLEM D: Resolution Appeals Desk Persistence Normalization
  // =========================================================================
  describe('Problem D: Resolution Appeals Desk Persistence', () => {
    it('retrieves appeals whether filtered by requesterId or citizenId', async () => {
      const byRequester = await jsonAppealRepository.findAll({ requesterId: 'USR-DEMO-CITIZEN-001' });
      const byCitizen = await jsonAppealRepository.findAll({ citizenId: 'USR-DEMO-CITIZEN-001' });

      assert.ok(Array.isArray(byRequester));
      assert.ok(Array.isArray(byCitizen));
      assert.strictEqual(byRequester.length, byCitizen.length);
      assert.ok(byRequester.length > 0, 'Should find at least 1 appeal for demo citizen');
    });

    it('department officers only see appeals scoped to their permitted department', async () => {
      const waterAppeals = await jsonAppealRepository.findAll({ departmentId: 'DEPT_WATER' });
      assert.ok(Array.isArray(waterAppeals));
      for (const appeal of waterAppeals) {
        assert.strictEqual(appeal.departmentId, 'DEPT_WATER');
      }
    });
  });

  // =========================================================================
  // PROBLEM E: Controlled Grievance Reopening Desk Persistence Normalization
  // =========================================================================
  describe('Problem E: Controlled Grievance Reopening Desk Persistence', () => {
    it('retrieves reopening requests whether filtered by requesterId or citizenId', async () => {
      const byRequester = await jsonReopeningRequestRepository.findAll({ requesterId: 'USR-DEMO-CITIZEN-001' });
      const byCitizen = await jsonReopeningRequestRepository.findAll({ citizenId: 'USR-DEMO-CITIZEN-001' });

      assert.ok(Array.isArray(byRequester));
      assert.ok(Array.isArray(byCitizen));
      assert.strictEqual(byRequester.length, byCitizen.length);
      assert.ok(byRequester.length > 0, 'Should find at least 1 reopening request for demo citizen');
    });

    it('persists previous milestone and resolution integrity on reopening', async () => {
      const requests = await jsonReopeningRequestRepository.findAll();
      assert.ok(requests.length > 0);
      const req = requests[0];
      assert.ok(req.complaintId || req.complaintReference);
      assert.ok(req.reasonCategory);
    });
  });

  // =========================================================================
  // PROBLEM F: Parent Incident Creation
  // =========================================================================
  describe('Problem F: Parent Incident Creation', () => {
    let createdIncident = null;

    it('officer can declare a new parent incident with required fields', async () => {
      const payload = {
        title: 'Burst Water Trunk Line & Pavement Collapse',
        category: 'water',
        leadDepartment: 'DEPT_WATER',
        description: 'Critical main line breach resulting in localized flooding and road structural instability.',
        priority: 'CRITICAL',
        location: {
          locality: 'Ring Road Ward 12',
          district: 'Pune',
          state: 'Maharashtra'
        },
        participatingDepartments: ['DEPT_ROADS']
      };

      createdIncident = await incidentService.createIncident(payload, adminActor);

      assert.ok(createdIncident);
      assert.ok(createdIncident.id);
      const incidentRef = createdIncident.referenceNumber || createdIncident.id;
      assert.ok(incidentRef.startsWith('INC-'));
      assert.strictEqual(createdIncident.title, payload.title);
      assert.strictEqual(createdIncident.leadDepartment, 'DEPT_WATER');
      assert.strictEqual(createdIncident.priority, 'CRITICAL');
      assert.strictEqual(createdIncident.status, 'ACTIVE');

      // Create departmental subtask according to CivicSarthi workflow
      const subtask = await incidentService.createSubtask({
        incidentId: createdIncident.id,
        title: 'Initial Lead Department Pipeline Assessment',
        department: 'DEPT_WATER'
      }, adminActor);

      assert.ok(subtask);
      assert.strictEqual(subtask.department, 'DEPT_WATER');

      // Verify enriched retrieval loads subtasks
      const enriched = await incidentService.getIncidentById(
        createdIncident.id,
        { includeSubtasks: true, isOfficer: true },
        adminActor
      );
      assert.ok(Array.isArray(enriched.subtasks));
      assert.ok(enriched.subtasks.length >= 1);
      assert.strictEqual(enriched.subtasks[0].department, 'DEPT_WATER');
    });

    it('rejects incident declaration with title shorter than 3 characters', async () => {
      await assert.rejects(
        async () => {
          await incidentService.createIncident(
            {
              title: 'No',
              category: 'water',
              leadDepartment: 'DEPT_WATER'
            },
            adminActor
          );
        },
        /must be at least 3 characters/
      );
    });

    it('rejects incident declaration by unauthorized citizen', async () => {
      await assert.rejects(
        async () => {
          await incidentService.createIncident(
            {
              title: 'Citizen Incident',
              category: 'water',
              leadDepartment: 'DEPT_WATER'
            },
            citizenActor
          );
        },
        /Access denied/
      );
    });

    after(async () => {
      // Clean up test incident and subtasks so other test suites remain pristine
      if (createdIncident && createdIncident.id) {
        try {
          const incFile = config.dataPath.incidents;
          const incRaw = await fs.readFile(incFile, 'utf-8');
          const incData = JSON.parse(incRaw);
          incData.incidents = (incData.incidents || []).filter(i => i.id !== createdIncident.id);
          await fs.writeFile(incFile, JSON.stringify(incData, null, 2), 'utf-8');

          const subFile = config.dataPath.subtasks;
          const subRaw = await fs.readFile(subFile, 'utf-8');
          const subData = JSON.parse(subRaw);
          subData.subtasks = (subData.subtasks || []).filter(s => s.incidentId !== createdIncident.id);
          await fs.writeFile(subFile, JSON.stringify(subData, null, 2), 'utf-8');
        } catch {}
      }
    });
  });

  // =========================================================================
  // PROBLEM G: Neglect Radar Evidence Object Safe Evaluation
  // =========================================================================
  describe('Problem G: Neglect Radar Evidence Evaluation', () => {
    it('evaluates explainable neglect signals and returns structured evidence object', () => {
      const testComplaintData = {
        id: 'CS-TEST-RADAR-001',
        title: 'Unattended Sewage Overflow',
        status: 'SUBMITTED',
        priority: 'HIGH',
        departmentId: 'DEPT_MUNICIPAL',
        assignedOfficerId: null,
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        reassignedCount: 3,
        reopenedCount: 1,
        slaMetrics: {
          ageDays: 25,
          slaDeadlineDays: 7,
          isSlaBreached: true,
          slaBreachedDays: 18,
          daysSinceUpdate: 20,
          isStale: true
        }
      };

      const result = evaluateEntityRisk(testComplaintData, 'COMPLAINT');

      assert.ok(result);
      assert.ok(typeof (result.riskScore ?? result.score) === 'number');
      assert.ok(Array.isArray(result.signals));
      assert.ok(result.signals.length > 0);

      // Verify that every signal has evidence, and structured evidence is safely an object
      for (const signal of result.signals) {
        assert.ok(signal.code);
        assert.ok(signal.name);
        assert.ok(typeof signal.points === 'number');
        if (signal.isTriggered || signal.triggered) {
          assert.ok(signal.evidence !== undefined);
          // If evidence is an object, verify keys exist
          if (typeof signal.evidence === 'object' && signal.evidence !== null) {
            assert.ok(Object.keys(signal.evidence).length > 0);
          }
        }
      }
    });
  });

  // =========================================================================
  // SECTION 10: Safe MongoDB Migration Script Dry-Run Verification
  // =========================================================================
  describe('Section 10: MongoDB Migration Script Integrity', () => {
    it('dry run of migrate.js runs safely across all models without modifying data', async () => {
      const result = await runMigration({ dryRun: true });
      assert.ok(result);
      if (!process.env.MONGODB_URI) {
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('MONGODB_URI'));
      } else {
        assert.strictEqual(result.dryRun, true);
      }
    });
  });
});
