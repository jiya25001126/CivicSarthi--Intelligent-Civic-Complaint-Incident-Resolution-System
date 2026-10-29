import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { HistoricalResolutionService } from '../src/services/historicalResolution.service.js';
import aiIntelligenceService from '../src/services/aiIntelligence.service.js';

class InMemoryComplaintRepo {
  constructor() {
    this.complaints = [];
  }
  async findById(id) {
    return this.complaints.find((c) => c.id === id || c.referenceNumber === id) || null;
  }
  async findAll() {
    return [...this.complaints];
  }
}

describe('Feature C: Historical Resolution Suggestions Subsystem', () => {
  let complaintRepo;
  let service;

  const mockOfficerRoads = { id: 'off_roads_1', role: 'officer', departmentId: 'DEPT_ROADS' };
  const mockOfficerWater = { id: 'off_water_1', role: 'officer', departmentId: 'DEPT_WATER' };
  const mockAdmin = { id: 'admin_sys', role: 'admin' };
  const mockCitizen = { id: 'cit_123', role: 'citizen' };

  beforeEach(() => {
    complaintRepo = new InMemoryComplaintRepo();
    service = new HistoricalResolutionService(complaintRepo, aiIntelligenceService);

    // Populate historical database
    complaintRepo.complaints = [
      {
        id: 'cmp_active_pothole',
        referenceNumber: 'GRV-2026-ACTIVE',
        title: 'Massive dangerous pothole on MG Road near flyover',
        description: 'Deep crater on asphalt causing traffic hazard and bike accidents. Requires urgent resurfacing.',
        category: 'roads',
        departmentId: 'DEPT_ROADS',
        status: 'IN_PROGRESS',
        district: 'Bengaluru Urban',
        locality: 'MG Road'
      },
      {
        id: 'cmp_resolved_pothole_1',
        referenceNumber: 'GRV-2025-HIST-01',
        title: 'Broken road asphalt and deep pothole on MG Road',
        description: 'Road surface completely broken near flyover pillar 12. Citizen contact 9876543210 or email test@gmail.com.',
        category: 'roads',
        departmentId: 'DEPT_ROADS',
        status: 'RESOLVED',
        district: 'Bengaluru Urban',
        locality: 'MG Road',
        createdAt: '2025-06-01T10:00:00Z',
        resolvedAt: '2025-06-03T16:00:00Z',
        remarks: 'Cold mix bitumen asphalt patch applied and roller compacted. Road cleared for traffic.',
        resolutionDetails: {
          score: 95,
          valid: true,
          outcomeType: 'FULL_RESOLUTION',
          verificationMethod: 'ON_SITE_ENGINEER_INSPECTION',
          actionCompleted: true,
          closureRemarks: 'Cold mix bitumen asphalt patch applied and roller compacted. Contact officer at 9811122233.',
          resolvedAt: '2025-06-03T16:00:00Z'
        },
        officerNotes: ['Private internal note: contractor bill approved #4521'],
        internalNotes: 'Supervisor internal verification code 992'
      },
      {
        id: 'cmp_resolved_water_pipe',
        referenceNumber: 'GRV-2025-HIST-02',
        title: 'Drinking water pipeline burst and contamination',
        description: 'Dirty water supply and pipeline leak in street 4.',
        category: 'water',
        departmentId: 'DEPT_WATER',
        status: 'RESOLVED',
        district: 'Bengaluru Urban',
        locality: 'Indiranagar',
        createdAt: '2025-07-10T08:00:00Z',
        resolvedAt: '2025-07-11T12:00:00Z',
        resolutionDetails: {
          score: 90,
          outcomeType: 'FULL_RESOLUTION',
          verificationMethod: 'LAB_SAMPLE_TEST',
          actionCompleted: true,
          closureRemarks: 'Main valve replaced and water tested safe.'
        }
      },
      {
        id: 'cmp_open_unresolved',
        referenceNumber: 'GRV-2026-UNRESOLVED',
        title: 'Another pothole complaint',
        category: 'roads',
        departmentId: 'DEPT_ROADS',
        status: 'SUBMITTED' // Open complaints must NEVER be suggested as resolutions
      }
    ];
  });

  describe('1. Lexical & Category Similarity Ranking', () => {
    test('ranks matching historical resolved case at the top with match reasons', async () => {
      const result = await service.getSuggestions('cmp_active_pothole', mockOfficerRoads);

      assert.strictEqual(result.isEmpty, false);
      assert.ok(result.suggestions.length > 0);
      const top = result.suggestions[0];
      assert.strictEqual(top.referenceNumber, 'GRV-2025-HIST-01');
      assert.ok(top.similarityScore > 0.4);
      assert.ok(top.matchReasons.some((r) => r.includes('Category match')));
      assert.ok(top.matchReasons.some((r) => r.includes('Same Locality') || r.includes('Same District')));
    });

    test('excludes open or unresolved complaints from suggestion candidates', async () => {
      const result = await service.getSuggestions('cmp_active_pothole', mockOfficerRoads);
      const refs = result.suggestions.map((s) => s.referenceNumber);
      assert.ok(!refs.includes('GRV-2026-UNRESOLVED'));
    });
  });

  describe('2. Role-Based Scoping & Department Boundaries', () => {
    test('strictly denies citizen access with 403 FORBIDDEN_ROLE', async () => {
      await assert.rejects(
        () => service.getSuggestions('cmp_active_pothole', mockCitizen),
        /Access denied: historical resolution suggestions are restricted/
      );
    });

    test('officer only sees historical resolutions belonging to authorized department', async () => {
      // Roads officer sees roads suggestion, not water suggestion
      const result = await service.getSuggestions('cmp_active_pothole', mockOfficerRoads);
      const depts = result.suggestions.map((s) => s.departmentId);
      assert.ok(depts.every((d) => d === 'DEPT_ROADS'));
    });

    test('denies officer from querying complaint outside their assigned department', async () => {
      await assert.rejects(
        () => service.getSuggestions('cmp_active_pothole', mockOfficerWater),
        /Access denied: complaint belongs to department 'DEPT_ROADS'/
      );
    });

    test('system admin has cross-department visibility', async () => {
      const result = await service.getSuggestions('cmp_active_pothole', mockAdmin);
      assert.ok(result.suggestions.length > 0);
    });
  });

  describe('3. PII Redaction & Privacy Protections', () => {
    test('redacts phone numbers and email addresses from historical resolution summaries', async () => {
      const result = await service.getSuggestions('cmp_active_pothole', mockOfficerRoads);
      const top = result.suggestions[0];

      // Verify PII is redacted
      assert.ok(!top.sanitizedResolutionSummary.includes('9811122233'));
      assert.ok(top.sanitizedResolutionSummary.includes('[REDACTED_PHONE]'));
    });

    test('excludes private notes, internal supervisor notes, and confidential records', async () => {
      const result = await service.getSuggestions('cmp_active_pothole', mockOfficerRoads);
      const top = result.suggestions[0];

      assert.strictEqual(top.officerNotes, undefined);
      assert.strictEqual(top.internalNotes, undefined);
    });
  });

  describe('4. Resolution Duration & Advisory Guarantee', () => {
    test('calculates accurate resolution duration in days', async () => {
      const result = await service.getSuggestions('cmp_active_pothole', mockOfficerRoads);
      const top = result.suggestions[0];

      assert.strictEqual(top.resolutionDurationDays, 2);
      assert.strictEqual(top.resolutionDuration, '2 days');
    });

    test('preserves historical complaint records completely without modifying them', async () => {
      const originalBefore = JSON.stringify(complaintRepo.complaints);
      await service.getSuggestions('cmp_active_pothole', mockOfficerRoads);
      const originalAfter = JSON.stringify(complaintRepo.complaints);

      assert.strictEqual(originalBefore, originalAfter);
    });
  });

  describe('5. Honest Empty State', () => {
    test('returns honest empty state when no historical resolved cases match category or issue', async () => {
      complaintRepo.complaints.push({
        id: 'cmp_unique_pension',
        referenceNumber: 'GRV-PENSION-01',
        title: 'Post-retirement superannuation pension delayed by university accounts',
        description: 'University registrar office has not credited arrears for 6 months.',
        category: 'pension',
        departmentId: 'DEPT_PENSION',
        status: 'IN_PROGRESS'
      });

      const officerPension = { id: 'off_pension', role: 'officer', departmentId: 'DEPT_PENSION' };
      const result = await service.getSuggestions('cmp_unique_pension', officerPension);

      assert.strictEqual(result.isEmpty, true);
      assert.strictEqual(result.suggestions.length, 0);
      assert.ok(result.message.includes('No historical resolved complaints are available'));
    });
  });
});

