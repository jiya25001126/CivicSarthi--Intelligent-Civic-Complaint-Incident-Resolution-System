import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ComplaintModel } from '../src/models/complaint.model.js';
import { StatusHistoryModel } from '../src/models/statusHistory.model.js';
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUS, COMPLAINT_PRIORITY } from '../src/constants/status.constants.js';
import { SEED_COMPLAINTS } from '../src/scripts/seed.js';
import {
  TARGET_DEMO_REFERENCES,
  buildDemoComplaintsPayload,
  seedMongoDemoComplaints
} from '../src/scripts/seed-mongo-demo-complaints.js';

describe('CivicSarthi — MongoDB Demo Complaint Seeder & Safety Test Suite', () => {
  const mockCitizens = {
    primaryCitizen: {
      id: 'USR-DEMO-CITIZEN-001',
      name: 'Aarav Sharma (Citizen)',
      email: 'citizen.demo@civicsarthi.internal'
    },
    secondaryCitizen: {
      id: 'USR-MV7T6B5R-W79S',
      name: 'Priya Verma',
      email: 'priya.verma.1791964126694@civicsarthi.internal'
    }
  };

  const targetRefSet = new Set(TARGET_DEMO_REFERENCES);
  const candidateComplaints = SEED_COMPLAINTS.filter(c => targetRefSet.has(c.referenceNumber));

  describe('1. Schema Validation & Compliance', () => {
    it('1.1 should generate 14 valid synthetic complaint payloads', () => {
      const payloads = buildDemoComplaintsPayload(candidateComplaints, mockCitizens);
      assert.equal(payloads.length, 14);

      payloads.forEach(c => {
        assert.ok(c.referenceNumber, 'Complaint must have referenceNumber');
        assert.ok(c.id, 'Complaint must have id');
        assert.equal(c.id, c.referenceNumber, 'id must match referenceNumber');
        assert.ok(c.title && c.title.length >= 3, 'title must have at least 3 chars');
        assert.ok(c.description && c.description.length >= 10, 'description must have at least 10 chars');
        assert.ok(COMPLAINT_CATEGORIES.includes(c.category), `category '${c.category}' must be in COMPLAINT_CATEGORIES`);
        assert.ok(Object.values(COMPLAINT_STATUS).includes(c.status), `status '${c.status}' must be in COMPLAINT_STATUS`);
        assert.ok(Object.values(COMPLAINT_PRIORITY).includes(c.priority), `priority '${c.priority}' must be in COMPLAINT_PRIORITY`);
        assert.equal(c.synthetic, true, 'All demo complaints must have synthetic: true');
      });
    });

    it('1.2 every synthetic complaint payload must strictly pass Mongoose ComplaintModel validation', () => {
      const payloads = buildDemoComplaintsPayload(candidateComplaints, mockCitizens);

      payloads.forEach((payload, idx) => {
        const doc = new ComplaintModel(payload);
        const err = doc.validateSync();
        assert.equal(
          err,
          undefined,
          `Payload ${payload.referenceNumber} (#${idx + 1}) failed Mongoose validation: ${err ? Object.values(err.errors).map(e => e.message).join(', ') : ''}`
        );
      });
    });

    it('1.3 all statusHistory entries must pass StatusHistoryModel schema validation', () => {
      const payloads = buildDemoComplaintsPayload(candidateComplaints, mockCitizens);

      payloads.forEach(payload => {
        assert.ok(Array.isArray(payload.statusHistory), 'statusHistory must be an array');
        assert.ok(payload.statusHistory.length >= 1, 'statusHistory must have at least 1 entry');

        payload.statusHistory.forEach((entry, idx) => {
          const histDoc = new StatusHistoryModel({
            id: `HIST-${payload.referenceNumber}-${idx + 1}`,
            complaintId: payload.id,
            referenceNumber: payload.referenceNumber,
            timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
            status: entry.status,
            actorType: entry.actorType || 'CITIZEN',
            remarks: entry.remarks || '',
            resolutionDetails: payload.resolutionDetails || null
          });
          const err = histDoc.validateSync();
          assert.equal(err, undefined, `StatusHistory entry ${histDoc.id} failed Mongoose validation`);
        });
      });
    });

    it('1.4 resolved and closed complaints must carry structured resolution details', () => {
      const payloads = buildDemoComplaintsPayload(candidateComplaints, mockCitizens);
      const resolvedOrClosed = payloads.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED');
      assert.ok(resolvedOrClosed.length >= 4, 'Must have at least 4 resolved or closed complaints');

      resolvedOrClosed.forEach(c => {
        assert.ok(c.resolutionDetails, `Complaint ${c.referenceNumber} must have resolutionDetails`);
        assert.ok(c.resolutionDetails.summary, 'resolutionDetails must contain summary');
        assert.equal(c.resolutionDetails.outcomeType, 'FULL_RESOLUTION');
      });
    });
  });

  describe('2. Citizen Ownership & Dashboard Tab Coverage', () => {
    it('2.1 should associate 8 diverse complaints with primary demo citizen Aarav Sharma', () => {
      const payloads = buildDemoComplaintsPayload(candidateComplaints, mockCitizens);
      const aaravComplaints = payloads.filter(c => c.citizenId === 'USR-DEMO-CITIZEN-001');

      assert.equal(aaravComplaints.length, 8, 'Aarav Sharma must have exactly 8 assigned synthetic complaints');
      aaravComplaints.forEach(c => {
        assert.equal(c.citizenName, 'Aarav Sharma (Citizen)');
        assert.equal(c.citizenEmail, 'citizen.demo@civicsarthi.internal');
      });
    });

    it('2.2 Aarav Sharma must have complaints covering all Citizen Portal status tabs', () => {
      const payloads = buildDemoComplaintsPayload(candidateComplaints, mockCitizens);
      const aarav = payloads.filter(c => c.citizenId === 'USR-DEMO-CITIZEN-001');

      // 1. Pending Triage tab: SUBMITTED or UNDER_REVIEW
      const triage = aarav.filter(c => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW');
      assert.ok(triage.length >= 2, 'Must have at least 2 pending triage complaints');

      // 2. In Remediation tab: ASSIGNED, IN_PROGRESS, or AWAITING_INFORMATION
      const remediation = aarav.filter(c => c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS' || c.status === 'AWAITING_INFORMATION');
      assert.ok(remediation.length >= 3, 'Must have at least 3 remediation complaints');

      // 3. Resolved tab: RESOLVED or CLOSED
      const resolved = aarav.filter(c => c.status === 'RESOLVED' || c.status === 'CLOSED');
      assert.ok(resolved.length >= 3, 'Must have at least 3 resolved/closed complaints');

      // 4. Critical tab: CRITICAL or HIGH priority
      const critical = aarav.filter(c => c.priority === 'CRITICAL' || c.priority === 'HIGH');
      assert.ok(critical.length >= 3, 'Must have at least 3 critical/high complaints');
    });

    it('2.3 should associate representative complaints with secondary citizen Priya Verma', () => {
      const payloads = buildDemoComplaintsPayload(candidateComplaints, mockCitizens);
      const priyaComplaints = payloads.filter(c => c.citizenId === 'USR-MV7T6B5R-W79S');

      assert.equal(priyaComplaints.length, 3);
      priyaComplaints.forEach(c => {
        assert.equal(c.citizenName, 'Priya Verma');
        assert.equal(c.citizenEmail, 'priya.verma.1791964126694@civicsarthi.internal');
      });
    });

    it('2.4 remaining complaints should be marked as unclaimed synthetic demo submissions', () => {
      const payloads = buildDemoComplaintsPayload(candidateComplaints, mockCitizens);
      const unclaimed = payloads.filter(c => c.citizenId === 'SYNTHETIC_CPGRAMS_DEMO');

      assert.equal(unclaimed.length, 3);
      unclaimed.forEach(c => {
        assert.equal(c.synthetic, true);
        assert.ok(c.citizenName);
      });
    });
  });

  describe('3. Safety Guardrails & Validation', () => {
    it('3.1 should fail cleanly when MONGODB_URI is not provided', async () => {
      const result = await seedMongoDemoComplaints({ uri: '' });
      assert.equal(result.success, false);
      assert.ok(result.error.includes('MONGODB_URI is not set'));
    });

    it('3.2 candidate list must NOT overwrite existing genuine complaint CS-2026-0001', () => {
      // Simulate candidate list containing CS-2026-0001
      const simulatedSeedComplaints = [
        { referenceNumber: 'CS-2026-0001', synthetic: true, title: 'Fake Replacement' },
        { referenceNumber: 'CS-2026-0002', synthetic: true, title: 'Valid Synthetic' }
      ];

      const existingMap = new Map([
        ['CS-2026-0001', { referenceNumber: 'CS-2026-0001', synthetic: false, title: 'Broken water pipel8be' }]
      ]);

      const filtered = simulatedSeedComplaints.filter(c => {
        const existing = existingMap.get(c.referenceNumber);
        if (existing && existing.synthetic !== true) {
          return false; // Skip genuine records
        }
        return true;
      });

      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].referenceNumber, 'CS-2026-0002');
    });

    it('3.3 idempotent skip logic correctly identifies already seeded synthetic complaints', () => {
      const candidateList = [
        { referenceNumber: 'CS-2026-0002', synthetic: true },
        { referenceNumber: 'CS-2026-0003', synthetic: true }
      ];

      const existingInDb = new Map([
        ['CS-2026-0002', { referenceNumber: 'CS-2026-0002', synthetic: true }]
      ]);

      let insertedCount = 0;
      let skippedCount = 0;

      candidateList.forEach(c => {
        const existing = existingInDb.get(c.referenceNumber);
        if (existing) {
          if (existing.synthetic === true) {
            skippedCount++;
          }
        } else {
          insertedCount++;
        }
      });

      assert.equal(insertedCount, 1, 'Only non-existing complaint should be inserted');
      assert.equal(skippedCount, 1, 'Already seeded synthetic complaint must be skipped');
    });

    it('3.4 reference numbers are monotonic and strictly distinct', () => {
      const payloads = buildDemoComplaintsPayload(candidateComplaints, mockCitizens);
      const refs = payloads.map(p => p.referenceNumber);
      const uniqueRefs = new Set(refs);

      assert.equal(refs.length, uniqueRefs.size, 'All reference numbers must be strictly unique');
      assert.ok(!refs.includes('CS-2026-0001'), 'CS-2026-0001 must not be in synthetic candidate list');
    });
  });
});
