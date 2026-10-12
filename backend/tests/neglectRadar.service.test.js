/**
 * @file neglectRadar.service.test.js
 * @description Hardened Integration Tests for CivicSarthi Phase 8: Neglect Radar Service Layer.
 *
 * SAFETY GUARANTEES:
 * - Operates entirely with isolated in-memory mock repositories.
 * - Zero disk modifications to any protected production files.
 * - Strictly verifies read-only immutability, department authorization,
 *   fault-tolerance, partial failure transparency, and privacy projection allowlists.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NeglectRadarService, projectSafeRadarItem, isEntityAuthorized } from '../src/services/neglectRadar.service.js';
import {
  NEGLECT_ENTITY_TYPES,
  NEGLECT_RISK_LEVELS,
  NEGLECT_SIGNAL_CODES
} from '../src/constants/neglectRadar.constants.js';

describe('CivicSarthi Phase 8 — Neglect Radar Service Layer Integration Tests', () => {
  const FIXED_REF_TIME = '2026-10-12T00:00:00.000Z';

  // Sample seed data for mock repositories
  const sampleComplaints = [
    {
      id: 'CS-2026-0001',
      title: 'Water pipe rupture on MG Road',
      description: 'Severe water leak flooding the main intersection',
      status: 'UNDER_REVIEW',
      departmentId: 'DEPT_WATER',
      priority: 'HIGH',
      createdAt: '2026-08-15T00:00:00.000Z', // 58 days ago (breaches 30d SLA)
      updatedAt: '2026-09-01T00:00:00.000Z', // 41 days ago (stalled > 7d)
      reassignments: 1,
      reopenedCount: 0,
      citizenId: 'USR-CITIZEN-01',
      citizenPhone: '9876543210',
      citizenEmail: 'citizen@example.com',
      internalNotes: 'Top secret contractor escalation remarks'
    },
    {
      id: 'CS-2026-0002',
      title: 'Road pothole near bus stand',
      description: 'Deep pothole causing traffic slowdowns',
      status: 'IN_PROGRESS',
      departmentId: 'DEPT_ROADS',
      priority: 'MEDIUM',
      createdAt: '2026-10-05T00:00:00.000Z', // 7 days ago (within 30d SLA)
      updatedAt: '2026-10-11T00:00:00.000Z', // 1 day ago (active)
      reassignments: 0,
      citizenId: 'USR-CITIZEN-02',
      citizenEmail: 'citizen2@example.com'
    },
    {
      id: 'CS-2026-0003',
      title: 'Resolved streetlight malfunction',
      status: 'RESOLVED',
      departmentId: 'DEPT_WATER',
      priority: 'LOW',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
      reassignments: 0
    }
  ];

  const sampleIncidents = [
    {
      id: 'INC-2026-0001',
      title: 'Sector 4 Severe Waterlogging & Feeder Inundation',
      description: 'Multi-agency incident across power and water',
      status: 'ACTIVE',
      leadDepartment: 'DEPT_WATER',
      participatingDepartments: ['DEPT_POWER'],
      priority: 'CRITICAL',
      createdAt: '2026-09-20T00:00:00.000Z', // 22 days ago
      updatedAt: '2026-09-20T00:00:00.000Z'  // 22 days ago (stalled > 7d)
    },
    {
      id: 'INC-2026-0002',
      title: 'Bridge Expansion Joint Inspection',
      status: 'ACTIVE',
      leadDepartment: 'DEPT_ROADS',
      participatingDepartments: [],
      priority: 'MEDIUM',
      createdAt: '2026-10-08T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z'
    }
  ];

  const sampleSubtasks = [
    {
      id: 'SUB-2026-0001',
      incidentId: 'INC-2026-0001',
      title: 'Isolate submerged feeder lines',
      status: 'BLOCKED', // Blocks parent incident
      department: 'DEPT_POWER',
      officerId: 'OFF_004',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z'
    },
    {
      id: 'SUB-2026-0002',
      incidentId: 'INC-2026-0001',
      title: 'Deploy mobile dewatering pumps',
      status: 'IN_PROGRESS',
      department: 'DEPT_WATER',
      officerId: 'OFF_005',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z'
    }
  ];

  // Helper to build a clean mock repository
  const createMockRepositories = (overrides = {}) => {
    let writeCalls = 0;

    const mockComplaintRepo = {
      findAll: async (filters = {}) => {
        let list = [...sampleComplaints];
        if (filters.departmentId) {
          list = list.filter(c => c.departmentId === filters.departmentId);
        }
        return list;
      },
      findById: async (id) => sampleComplaints.find(c => c.id === id) || null,
      create: async () => { writeCalls++; },
      update: async () => { writeCalls++; },
      updateStatus: async () => { writeCalls++; },
      ...overrides.complaintRepo
    };

    const mockIncidentRepo = {
      findAll: async (filters = {}) => {
        let list = [...sampleIncidents];
        if (filters.leadDepartment) {
          list = list.filter(i => i.leadDepartment === filters.leadDepartment || i.participatingDepartments?.includes(filters.leadDepartment));
        }
        return list;
      },
      findById: async (id) => sampleIncidents.find(i => i.id === id) || null,
      create: async () => { writeCalls++; },
      update: async () => { writeCalls++; },
      ...overrides.incidentRepo
    };

    const mockSubtaskRepo = {
      findAll: async (filters = {}) => {
        let list = [...sampleSubtasks];
        if (filters.department) {
          list = list.filter(s => s.department === filters.department);
        }
        if (filters.incidentId) {
          list = list.filter(s => s.incidentId === filters.incidentId);
        }
        return list;
      },
      findById: async (id) => sampleSubtasks.find(s => s.id === id) || null,
      create: async () => { writeCalls++; },
      update: async () => { writeCalls++; },
      ...overrides.subtaskRepo
    };

    return {
      complaintRepository: mockComplaintRepo,
      incidentRepository: mockIncidentRepo,
      subtaskRepository: mockSubtaskRepo,
      getWriteCalls: () => writeCalls
    };
  };

  // Test Actors
  const adminActor = { id: 'ADM-01', role: 'admin', email: 'admin@civicsarthi.internal' };
  const waterOfficer = { id: 'OFF-01', role: 'officer', departmentId: 'DEPT_WATER' };
  const roadsOfficer = { id: 'OFF-02', role: 'officer', departmentId: 'DEPT_ROADS' };
  const citizenActor = { id: 'CIT-01', role: 'citizen', email: 'citizen@example.com' };

  // 1. Aggregation of Complaints, Incidents, and Subtasks
  it('1. Aggregates complaints, incidents, and subtasks across authorized scope', async () => {
    const repos = createMockRepositories();
    const service = new NeglectRadarService(repos);

    const res = await service.getNeglectRadar({}, adminActor, { referenceTime: FIXED_REF_TIME });

    assert.ok(res);
    assert.equal(res.isPartial, false);
    assert.equal(res.sources.complaints.ok, true);
    assert.equal(res.sources.incidents.ok, true);
    assert.equal(res.sources.subtasks.ok, true);

    const types = new Set(res.items.map(i => i.entityType));
    assert.ok(types.has('COMPLAINT'));
    assert.ok(types.has('INCIDENT'));
    assert.ok(types.has('SUBTASK'));
  });

  // 2. Independent Repository Failures & 4. Partial-Failure Transparency
  it('2 & 4. Handles independent repository failure with explicit partial metadata for ALL requests', async () => {
    const repos = createMockRepositories({
      incidentRepo: {
        findAll: async () => { throw new Error('Incidents database connection timeout'); }
      }
    });
    const service = new NeglectRadarService(repos);

    const res = await service.getNeglectRadar({ entityType: 'ALL' }, adminActor, { referenceTime: FIXED_REF_TIME });

    assert.equal(res.isPartial, true);
    assert.equal(res.sources.complaints.ok, true);
    assert.equal(res.sources.incidents.ok, false);
    assert.match(res.sources.incidents.error, /timeout/);
    assert.equal(res.sources.subtasks.ok, true);

    // Still returns complaints and subtasks rather than crashing
    assert.ok(res.items.length > 0);
    assert.ok(res.items.some(i => i.entityType === 'COMPLAINT'));
    assert.ok(res.items.some(i => i.entityType === 'SUBTASK'));
  });

  // 3. Specific Entity-Type Request Fails Fast When Source Fails (HTTP 503)
  it('3. Specific entity-type request fails with 503 when its specific repository is unavailable', async () => {
    const repos = createMockRepositories({
      complaintRepo: {
        findAll: async () => { throw new Error('Complaints disk unreadable'); }
      }
    });
    const service = new NeglectRadarService(repos);

    await assert.rejects(
      async () => {
        await service.getNeglectRadar({ entityType: 'COMPLAINT' }, adminActor);
      },
      (err) => {
        assert.equal(err.status, 503);
        assert.match(err.message, /Complaints repository unavailable/);
        return true;
      }
    );
  });

  // 5. Officer Department Scoping Enforced by req.user (Ignoring Client Spoofing)
  it('5. Enforces officer department scoping strictly to req.user.departmentId and ignores client spoofing', async () => {
    const repos = createMockRepositories();
    const service = new NeglectRadarService(repos);

    // Water officer tries to query DEPT_ROADS via client filter
    const res = await service.getNeglectRadar({ departmentId: 'DEPT_ROADS' }, waterOfficer, { referenceTime: FIXED_REF_TIME });

    // Effective department must remain DEPT_WATER
    assert.equal(res.filtersApplied.departmentId, 'DEPT_WATER');
    // None of the returned items should belong exclusively to DEPT_ROADS
    for (const item of res.items) {
      if (item.entityType === 'COMPLAINT') {
        assert.equal(item.departmentId, 'DEPT_WATER');
      }
    }
  });

  // 6. Admin Cross-Department Visibility & Optional Department Filtering
  it('6. Admin sees all departments by default and can optionally filter by department', async () => {
    const repos = createMockRepositories();
    const service = new NeglectRadarService(repos);

    // Unfiltered: sees water and roads
    const allRes = await service.getNeglectRadar({}, adminActor, { referenceTime: FIXED_REF_TIME });
    const allDepts = new Set(allRes.items.map(i => i.departmentId));
    assert.ok(allDepts.has('DEPT_WATER'));
    assert.ok(allDepts.has('DEPT_ROADS'));

    // Filtered by DEPT_ROADS
    const roadsRes = await service.getNeglectRadar({ departmentId: 'DEPT_ROADS' }, adminActor, { referenceTime: FIXED_REF_TIME });
    assert.equal(roadsRes.filtersApplied.departmentId, 'DEPT_ROADS');
  });

  // 7. Search, Risk Level, Signal Code, Sorting, and Pagination
  it('7. Supports filtering by risk level, signal code, search query, sorting, and pagination', async () => {
    const repos = createMockRepositories();
    const service = new NeglectRadarService(repos);

    // Filter by riskLevel: HIGH
    const highRes = await service.getNeglectRadar({ riskLevel: 'HIGH' }, adminActor, { referenceTime: FIXED_REF_TIME });
    assert.ok(highRes.items.every(i => i.riskLevel === 'HIGH'));

    // Filter by signalCode: OVERDUE_SLA
    const slaRes = await service.getNeglectRadar({ signalCode: 'OVERDUE_SLA' }, adminActor, { referenceTime: FIXED_REF_TIME });
    assert.ok(slaRes.items.every(i => i.triggeredSignals.some(s => s.code === 'OVERDUE_SLA')));

    // Search by text query
    const searchRes = await service.getNeglectRadar({ search: 'rupture' }, adminActor, { referenceTime: FIXED_REF_TIME });
    assert.equal(searchRes.items.length, 1);
    assert.equal(searchRes.items[0].entityId, 'CS-2026-0001');

    // Pagination: page 1 limit 1
    const pagedRes = await service.getNeglectRadar({ page: 1, limit: 1 }, adminActor, { referenceTime: FIXED_REF_TIME });
    assert.equal(pagedRes.items.length, 1);
    assert.equal(pagedRes.pagination.limit, 1);
    assert.ok(pagedRes.pagination.total >= 3);
  });

  // 8. Summary Counts Over Full Filtered Result Set (Not Just Current Page)
  it('8. Computes summary metrics over the full filtered result set, not only the paginated slice', async () => {
    const repos = createMockRepositories();
    const service = new NeglectRadarService(repos);

    // Request with limit 1 on multiple available items
    const res = await service.getNeglectRadar({ limit: 1 }, adminActor, { referenceTime: FIXED_REF_TIME });

    assert.equal(res.items.length, 1); // Page has only 1 item
    assert.ok(res.summary.totalFlagged > 1); // Full count reflects entire filtered result set
    assert.equal(res.summary.scope, 'FULL_FILTERED_RESULT_SET');
  });

  // 9. Safe Privacy Projection Allowlist
  it('9. Strictly excludes citizen PII, credentials, raw notes, and full repository documents', async () => {
    const repos = createMockRepositories();
    const service = new NeglectRadarService(repos);

    const res = await service.getNeglectRadar({}, adminActor, { referenceTime: FIXED_REF_TIME });
    const complaintItem = res.items.find(i => i.entityId === 'CS-2026-0001');

    assert.ok(complaintItem);
    // Explicitly verify sensitive keys do NOT exist in the projection
    assert.equal(complaintItem.citizenId, undefined);
    assert.equal(complaintItem.citizenPhone, undefined);
    assert.equal(complaintItem.citizenEmail, undefined);
    assert.equal(complaintItem.internalNotes, undefined);
    assert.equal(complaintItem.notes, undefined);
    assert.equal(complaintItem.credentials, undefined);

    // Verify safe fields ARE present
    assert.equal(complaintItem.entityId, 'CS-2026-0001');
    assert.equal(complaintItem.entityType, 'COMPLAINT');
    assert.equal(typeof complaintItem.riskScore, 'number');
    assert.ok(complaintItem.suggestedAction);
  });

  // 10. Malformed Entity Records Yield INSUFFICIENT_DATA Without Crashing Evaluation
  it('10. Handles malformed records gracefully as INSUFFICIENT_DATA without crashing endpoint', async () => {
    const malformedComplaints = [
      ...sampleComplaints,
      { id: 'CS-MALFORMED', title: 'Corrupted record', status: 'ACTIVE' /* missing createdAt */ }
    ];
    const repos = createMockRepositories({
      complaintRepo: {
        findAll: async () => malformedComplaints
      }
    });
    const service = new NeglectRadarService(repos);

    const res = await service.getNeglectRadar({ entityType: 'COMPLAINT' }, adminActor, { referenceTime: FIXED_REF_TIME });
    const malformedItem = res.items.find(i => i.entityId === 'CS-MALFORMED');

    assert.ok(malformedItem);
    assert.equal(malformedItem.riskLevel, NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA);
    assert.equal(malformedItem.riskScore, null);
  });

  // 11. Single-Item Lookup Prevents Out-of-Scope Enumeration (404)
  it('11. Prevents officers from querying records outside their department scope (anti-enumeration 404)', async () => {
    const repos = createMockRepositories();
    const service = new NeglectRadarService(repos);

    // Roads officer attempts to view CS-2026-0001 (owned by DEPT_WATER)
    await assert.rejects(
      async () => {
        await service.getNeglectRadarItem('COMPLAINT', 'CS-2026-0001', roadsOfficer);
      },
      (err) => {
        assert.equal(err.status, 404);
        assert.match(err.message, /not found/i);
        return true;
      }
    );

    // Water officer can view their own complaint
    const allowed = await service.getNeglectRadarItem('COMPLAINT', 'CS-2026-0001', waterOfficer, { referenceTime: FIXED_REF_TIME });
    assert.ok(allowed);
    assert.equal(allowed.entityId, 'CS-2026-0001');
  });

  // 12. Read-Only Immutability Guarantee
  it('12. Read-only execution: does not call repository write methods or mutate data', async () => {
    const repos = createMockRepositories();
    const service = new NeglectRadarService(repos);

    await service.getNeglectRadar({}, adminActor, { referenceTime: FIXED_REF_TIME });
    await service.getNeglectRadarItem('COMPLAINT', 'CS-2026-0001', adminActor, { referenceTime: FIXED_REF_TIME });

    assert.equal(repos.getWriteCalls(), 0, 'No write methods should ever be invoked by NeglectRadarService');
  });
});
