/**
 * @file uxCopyAudit.test.js
 * @description Regression test suite ensuring no internal development phase labels,
 * milestone numbers, or developer-oriented notes leak into user-visible API responses
 * or frontend UI components.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { feedbackService } from '../src/services/feedback.service.js';
import { spamScreeningService } from '../src/services/spamScreening.service.js';
import { analyticsService } from '../src/services/analytics.service.js';
import { SPAM_REASON_DESCRIPTIONS, SPAM_REASON_CODES } from '../src/constants/spam.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_SRC = path.resolve(__dirname, '../../frontend/src');

describe('UX Copy & Production Readiness Audit', () => {
  describe('1. Backend API Error Responses & Descriptions', () => {
    it('returns a clean, professional error when resolution quality is pending verification', async () => {
      const mockComplaint = {
        id: 'CMP-TEST-UX-01',
        status: 'RESOLVED',
        citizenId: 'CITIZEN-01',
        resolutionDetails: null
      };

      const customFeedbackService = Object.create(feedbackService);
      customFeedbackService.complaintRepo = {
        findById: async () => mockComplaint
      };

      await assert.rejects(
        async () => {
          await customFeedbackService.submitFeedback(
            'CMP-TEST-UX-01',
            { rating: 5, comments: 'Good job' },
            { id: 'CITIZEN-01', role: 'citizen' }
          );
        },
        (err) => {
          assert.equal(
            err.message,
            'Feedback is temporarily unavailable while this resolution is being verified. Please try again later.'
          );
          assert.doesNotMatch(err.message, /phase/i, 'Must not reference internal phases');
          assert.doesNotMatch(err.message, /milestone/i, 'Must not reference milestones to citizens');
          return true;
        }
      );
    });

    it('returns a clear, polite error when duplicate feedback is attempted', async () => {
      const resolvedComplaint = {
        id: 'CMP-TEST-UX-02',
        status: 'RESOLVED',
        citizenId: 'CITIZEN-02',
        resolutionMilestone: '1',
        resolutionDetails: { valid: true }
      };

      const customFeedbackService = Object.create(feedbackService);
      customFeedbackService.complaintRepo = {
        findById: async () => resolvedComplaint
      };
      customFeedbackService.feedbackRepo = {
        findByComplaintAndMilestone: async () => ({
          id: 'FB-TEST-01',
          rating: 4
        })
      };

      await assert.rejects(
        async () => {
          await customFeedbackService.submitFeedback(
            'CMP-TEST-UX-02',
            { rating: 5 },
            { id: 'CITIZEN-02', role: 'citizen' }
          );
        },
        (err) => {
          assert.equal(
            err.message,
            'Feedback has already been submitted for this resolution (Rating: 4/5).'
          );
          assert.doesNotMatch(err.message, /milestone/i, 'Must not reference milestones to citizens');
          return true;
        }
      );
    });

    it('screens duplicates without exposing internal Phase 6 labels in reason descriptions', () => {
      const description = SPAM_REASON_DESCRIPTIONS[SPAM_REASON_CODES.PHASE6_DUPLICATE_MATCH];
      assert.ok(description, 'Description must exist');
      assert.doesNotMatch(description, /phase/i, 'Must not mention Phase in spam reason description');
      assert.match(description, /Automated duplicate detection/i);
    });

    it('screens complaints and produces duplicate match explanation free of internal phase tags', () => {
      const result = spamScreeningService.evaluateComplaint(
        {
          title: 'Deep pothole on MG Road near junction',
          description: 'Large dangerous pothole causing vehicular hazards.',
          location: { coordinates: [73.8567, 18.5204] },
          category: 'roads',
          citizenId: 'CITIZEN-UX-01'
        },
        {
          duplicateMatches: [
            {
              id: 'CMP-EXISTING-99',
              referenceNumber: 'CS-2026-99999',
              title: 'Deep pothole on MG Road near junction',
              description: 'Large dangerous pothole causing vehicular hazards.',
              confidence: 0.95,
              citizenId: 'CITIZEN-UX-01'
            }
          ]
        }
      );

      assert.ok(Array.isArray(result.reasons), 'Result reasons must be an array');
      const duplicateExplanation = result.reasons.find((r) => r.includes('Automated duplicate detection'));
      assert.ok(duplicateExplanation, 'Must generate automated duplicate detection explanation');
      assert.doesNotMatch(duplicateExplanation, /phase\s*\d/i);
    });

    it('generates CSV report without internal Phase N tags in metric rows', async () => {
      const mockOverview = {
        metrics: {
          totalComplaints: 10,
          resolvedComplaints: 8,
          closedComplaints: 0,
          resolvedAndClosed: 8,
          pendingComplaints: 2,
          activeComplaints: 2,
          overdueComplaints: 0,
          highAndCriticalCount: 1,
          resolutionRate: 80,
          slaComplianceRate: 90
        },
        anomalies: {
          reassignmentLoops: { count: 0 },
          staleCases: { count: 0 }
        }
      };

      const mockWorkflow = {
        statusDistribution: { SUBMITTED: 2, RESOLVED: 8 },
        anomalies: {
          reassignmentLoops: { count: 0 },
          staleCases: { count: 0 }
        },
        clarifications: { totalRequests: 5, openRequests: 1, respondedRequests: 4, closedRequests: 0 },
        reminders: { totalRemindersLogged: 3, eligibleComplaintsCount: 2 },
        satisfactionFeedback: { totalResponses: 4, averageRating: 4.5 },
        appeals: { totalAppeals: 1, acceptedAppeals: 0, rejectedAppeals: 1 },
        reopenings: { totalRequests: 0, approvedRequests: 0, rejectedRequests: 0 },
        spamReviewDesk: { totalScreeningFlags: 2, humanReviewOutcomes: { clearedLegitimate: 1, confirmedAbuse: 1 } },
        interAgencyWorkload: { parentIncidentsCount: 0, totalSubtasks: 0, subtaskCompletionRate: null }
      };

      const customAnalyticsService = Object.create(analyticsService);
      customAnalyticsService.getOverview = async () => mockOverview;
      customAnalyticsService.getDepartmentPerformance = async () => ({ departments: [] });
      customAnalyticsService.getCategoryAndGeography = async () => ({ categories: [], geography: [] });
      customAnalyticsService.getWorkflowAndQuality = async () => mockWorkflow;
      customAnalyticsService.auditRepo = { log: async () => ({}) };

      const report = await customAnalyticsService.exportReport(
        { reportType: 'all' },
        { id: 'ADMIN-01', role: 'admin' }
      );
      const csv = report.csvData;
      // Section 5 should have clean metric names
      assert.doesNotMatch(csv, /Clarifications Activity \(Phase/i);
      assert.doesNotMatch(csv, /Citizen Reminders \(Phase/i);
      assert.doesNotMatch(csv, /Citizen Feedback & Ratings \(Phase/i);
      assert.doesNotMatch(csv, /Dispute Appeals \(Phase/i);
      assert.doesNotMatch(csv, /Reopening Petitions \(Phase/i);
      assert.doesNotMatch(csv, /Spam Screening Desk \(Phase/i);
    });
  });

  describe('2. Frontend User Interface Copy Audit', () => {
    it('verifies that no JSX files in frontend/src render visible Phase N references', async () => {
      async function getJsxFiles(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...await getJsxFiles(fullPath));
          } else if (entry.name.endsWith('.jsx')) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const files = await getJsxFiles(FRONTEND_SRC);
      assert.ok(files.length > 0, 'Must find frontend JSX files');

      const violations = [];

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const trimmed = line.trim();
          // Skip pure code comments or JSX comment lines
          if (
            trimmed.startsWith('//') ||
            trimmed.startsWith('/*') ||
            trimmed.startsWith('*') ||
            (trimmed.startsWith('{/*') && trimmed.endsWith('*/}'))
          ) {
            return;
          }

          // Check for user-facing phase numbers like "Phase 1", "Phase 10", etc.
          const phaseMatch = line.match(/\bphase\s+\d+\b/i);
          if (phaseMatch) {
            // Check if it's within a JSX comment block on the same line
            const isInsideComment = /\/\*.*phase\s+\d+.*?\*\//i.test(line) || /\/\/.*phase\s+\d+/i.test(line);
            if (!isInsideComment) {
              violations.push({
                file: path.relative(FRONTEND_SRC, file),
                line: index + 1,
                match: phaseMatch[0],
                content: trimmed
              });
            }
          }

          // Check for user-facing "Milestone #"
          const milestoneMatch = line.match(/\bmilestone\s*#/i);
          if (milestoneMatch) {
            const isInsideComment = /\/\*.*milestone\s*#.*?\*\//i.test(line) || /\/\/.*milestone\s*#/i.test(line);
            if (!isInsideComment) {
              violations.push({
                file: path.relative(FRONTEND_SRC, file),
                line: index + 1,
                match: milestoneMatch[0],
                content: trimmed
              });
            }
          }
        });
      }

      assert.deepEqual(
        violations,
        [],
        `Found user-visible phase or milestone violations in frontend JSX files:\n${JSON.stringify(violations, null, 2)}`
      );
    });
  });
});
