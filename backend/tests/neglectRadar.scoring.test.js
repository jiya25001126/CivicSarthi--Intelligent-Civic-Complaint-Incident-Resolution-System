import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEntityRisk,
  evaluateComplaintRisk,
  evaluateIncidentRisk,
  evaluateSubtaskRisk
} from '../src/services/neglectRadar.scoring.js';
import {
  NEGLECT_ENTITY_TYPES,
  NEGLECT_RISK_LEVELS,
  NEGLECT_SIGNAL_CODES,
  NEGLECT_THRESHOLDS,
  SIGNAL_DEFINITIONS,
  resolveRadarAccessScope
} from '../src/constants/neglectRadar.constants.js';

describe('CivicSarthi Phase 8 — Neglect Radar Pure Scoring Engine & Contract', () => {
  const FIXED_REF_TIME = '2026-10-12T00:00:00.000Z';

  // 1. Purity and Determinism
  describe('1. Purity, Immutability & Determinism', () => {
    it('produces byte-for-byte identical output given identical inputs and reference time', () => {
      const complaint = {
        id: 'CS-2026-TEST01',
        title: 'Water pipe leak in Sector 9',
        status: 'UNDER_REVIEW',
        departmentId: 'DEPT_WATER',
        priority: 'HIGH',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-20T00:00:00.000Z',
        reassignments: 1,
        reopenedCount: 0
      };

      const result1 = evaluateComplaintRisk(complaint, { referenceTime: FIXED_REF_TIME });
      const result2 = evaluateComplaintRisk(complaint, { referenceTime: FIXED_REF_TIME });

      assert.deepEqual(result1, result2);
      assert.equal(typeof result1.riskScore, 'number');
      assert.equal(result1.evaluatedAt, FIXED_REF_TIME);
    });

    it('never mutates input entity, dependencies, or options objects', () => {
      const originalComplaint = {
        id: 'CS-2026-IMMUTABLE',
        title: 'Streetlight outage',
        status: 'ASSIGNED',
        departmentId: 'DEPT_POWER',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
        reassignments: 0,
        reopenedCount: 0
      };

      const frozenComplaint = Object.freeze({ ...originalComplaint });
      const options = Object.freeze({ referenceTime: FIXED_REF_TIME });

      // Calling evaluation on frozen object must not throw mutation error
      const result = evaluateComplaintRisk(frozenComplaint, options);
      assert.ok(result);
      assert.equal(frozenComplaint.title, 'Streetlight outage');
      assert.equal(frozenComplaint.status, 'ASSIGNED');
    });
  });

  // 2. Terminal State Exclusion
  describe('2. Terminal State Exclusion', () => {
    it('excludes resolved and closed complaints from active neglect warnings', () => {
      const resolvedComplaint = {
        id: 'CS-2026-RES01',
        title: 'Resolved pothole repair',
        status: 'RESOLVED',
        departmentId: 'DEPT_ROADS',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
        reassignments: 3
      };

      const result = evaluateComplaintRisk(resolvedComplaint, { referenceTime: FIXED_REF_TIME });

      assert.equal(result.isTerminal, true);
      assert.equal(result.riskScore, 0);
      assert.equal(result.riskLevel, NEGLECT_RISK_LEVELS.LOW);
      assert.equal(result.triggeredSignals.length, 0);
      assert.equal(result.suggestedAction, null);
    });

    it('excludes completed and cancelled subtasks from active neglect warnings', () => {
      const completedSubtask = {
        id: 'SUB-2026-COMP01',
        title: 'Power line replacement',
        status: 'COMPLETED',
        department: 'DEPT_POWER',
        officerId: 'OFF_001',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z'
      };

      const result = evaluateSubtaskRisk(completedSubtask, { referenceTime: FIXED_REF_TIME });

      assert.equal(result.isTerminal, true);
      assert.equal(result.riskScore, 0);
      assert.equal(result.riskLevel, NEGLECT_RISK_LEVELS.LOW);
      assert.equal(result.triggeredSignals.length, 0);
    });
  });

  // 3. Authoritative SLA Targets
  describe('3. Authoritative SLA Targets & Availability', () => {
    it('evaluates complaint resolution target against authoritative 30-day SLA from sla.json', () => {
      // 10 days elapsed -> within SLA (30d)
      const onTimeComplaint = {
        id: 'CS-2026-ONTIME',
        title: 'Park maintenance',
        status: 'IN_PROGRESS',
        departmentId: 'DEPT_GARDENS',
        createdAt: '2026-10-02T00:00:00.000Z', // 10 days prior to FIXED_REF_TIME
        updatedAt: '2026-10-10T00:00:00.000Z',
        reassignments: 0,
        reopenedCount: 0
      };

      const onTimeResult = evaluateComplaintRisk(onTimeComplaint, { referenceTime: FIXED_REF_TIME });
      const slaSignalOnTime = onTimeResult.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.OVERDUE_SLA);
      assert.ok(slaSignalOnTime);
      assert.equal(slaSignalOnTime.isAvailable, true);
      assert.equal(slaSignalOnTime.isTriggered, false);
      assert.equal(slaSignalOnTime.points, 0);

      // 40 days elapsed -> exceeds 30-day SLA
      const overdueComplaint = {
        id: 'CS-2026-OVERDUE',
        title: 'Major pipeline rupture',
        status: 'IN_PROGRESS',
        departmentId: 'DEPT_WATER',
        createdAt: '2026-09-02T00:00:00.000Z', // 40 days prior
        updatedAt: '2026-10-10T00:00:00.000Z',
        reassignments: 0,
        reopenedCount: 0
      };

      const overdueResult = evaluateComplaintRisk(overdueComplaint, { referenceTime: FIXED_REF_TIME });
      const slaSignalOverdue = overdueResult.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.OVERDUE_SLA);
      assert.ok(slaSignalOverdue);
      assert.equal(slaSignalOverdue.isAvailable, true);
      assert.equal(slaSignalOverdue.isTriggered, true);
      assert.ok(slaSignalOverdue.points >= 15);
    });

    it('returns isAvailable: false for OVERDUE_SLA on Incidents and Subtasks (no authoritative project target)', () => {
      const incident = {
        id: 'INC-2026-001',
        title: 'Sector 5 Flooding',
        status: 'ACTIVE',
        leadDepartment: 'DEPT_DRAINAGE',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z'
      };

      const incidentResult = evaluateIncidentRisk(incident, [], { referenceTime: FIXED_REF_TIME });
      const slaSignalInc = incidentResult.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.OVERDUE_SLA);
      assert.ok(slaSignalInc);
      assert.equal(slaSignalInc.isAvailable, false);
      assert.equal(slaSignalInc.points, 0);

      const subtask = {
        id: 'SUB-2026-001',
        title: 'Clear storm drain culvert',
        status: 'IN_PROGRESS',
        department: 'DEPT_DRAINAGE',
        officerId: 'OFF_002',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z'
      };

      const subtaskResult = evaluateSubtaskRisk(subtask, { referenceTime: FIXED_REF_TIME });
      const slaSignalSub = subtaskResult.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.OVERDUE_SLA);
      assert.ok(slaSignalSub);
      assert.equal(slaSignalSub.isAvailable, false);
      assert.equal(slaSignalSub.points, 0);
    });
  });

  // 4. Stale Progress vs Total Age (No Double-Counting)
  describe('4. Stale Progress vs. Total Age (Double-Counting Prevention)', () => {
    it('triggers OVERDUE_SLA but NOT STALE_PROGRESS when old complaint has recent verified activity', () => {
      // Created 50 days ago, but updated 2 days ago
      const complaintWithRecentProgress = {
        id: 'CS-2026-ACTIVE-OLD',
        title: 'Complex sewage reconstruction',
        status: 'IN_PROGRESS',
        departmentId: 'DEPT_WATER',
        createdAt: '2026-08-23T00:00:00.000Z', // 50 days elapsed
        updatedAt: '2026-10-10T00:00:00.000Z', // 2 days elapsed since update
        reassignments: 0,
        reopenedCount: 0
      };

      const result = evaluateComplaintRisk(complaintWithRecentProgress, { referenceTime: FIXED_REF_TIME });
      const slaSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.OVERDUE_SLA);
      const staleSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.STALE_PROGRESS);

      assert.equal(slaSignal.isTriggered, true, 'OVERDUE_SLA should trigger because 50d > 30d SLA');
      assert.equal(staleSignal.isTriggered, false, 'STALE_PROGRESS must NOT trigger because 2d <= 7d stale threshold');
      assert.equal(staleSignal.points, 0);
    });

    it('triggers STALE_PROGRESS but NOT OVERDUE_SLA when young complaint is stalled without progress', () => {
      // Created 10 days ago, never updated (daysSinceProgress = 10 > 7d threshold, but 10 <= 30d SLA)
      const stalledYoungComplaint = {
        id: 'CS-2026-STALLED-YOUNG',
        title: 'Clogged ditch',
        status: 'ASSIGNED',
        departmentId: 'DEPT_DRAINAGE',
        createdAt: '2026-10-02T00:00:00.000Z', // 10 days elapsed
        updatedAt: '2026-10-02T00:00:00.000Z', // 10 days elapsed
        reassignments: 0,
        reopenedCount: 0
      };

      const result = evaluateComplaintRisk(stalledYoungComplaint, { referenceTime: FIXED_REF_TIME });
      const slaSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.OVERDUE_SLA);
      const staleSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.STALE_PROGRESS);

      assert.equal(slaSignal.isTriggered, false, 'OVERDUE_SLA must NOT trigger because 10d <= 30d');
      assert.equal(staleSignal.isTriggered, true, 'STALE_PROGRESS should trigger because 10d > 7d');
      assert.ok(staleSignal.points >= 12);
    });
  });

  // 5. Blocked Dependencies
  describe('5. Blocked Dependencies (Operational Bottlenecks)', () => {
    it('detects BLOCKED status on subtasks with neutral operational messaging', () => {
      const blockedSubtask = {
        id: 'SUB-2026-BLK01',
        title: 'Road cutting clearance from traffic police',
        status: 'BLOCKED',
        department: 'DEPT_ROADS',
        officerId: 'OFF_003',
        createdAt: '2026-10-08T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z'
      };

      const result = evaluateSubtaskRisk(blockedSubtask, { referenceTime: FIXED_REF_TIME });
      const blockedSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.BLOCKED_DEPENDENCY);

      assert.ok(blockedSignal);
      assert.equal(blockedSignal.isTriggered, true);
      assert.equal(blockedSignal.points, SIGNAL_DEFINITIONS.BLOCKED_DEPENDENCY.maxPoints);
      assert.match(blockedSignal.message, /BLOCKED by departmental operational constraints/);
    });

    it('identifies incidents constrained by blocked departmental subtasks', () => {
      const incident = {
        id: 'INC-2026-COORD',
        title: 'Multi-agency intersection repair',
        status: 'ACTIVE',
        leadDepartment: 'DEPT_ROADS',
        createdAt: '2026-10-05T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z'
      };

      const subtasks = [
        { id: 'S1', status: 'IN_PROGRESS' },
        { id: 'S2', status: 'BLOCKED' }
      ];

      const result = evaluateIncidentRisk(incident, subtasks, { referenceTime: FIXED_REF_TIME });
      const blockedSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.BLOCKED_DEPENDENCY);

      assert.ok(blockedSignal);
      assert.equal(blockedSignal.isTriggered, true);
      assert.match(blockedSignal.message, /constrained by 1 blocked departmental subtask/);
    });
  });

  // 6. Reassignment Ping-Pong & Reopened Grievance
  describe('6. Reassignment Ping-Pong & Reopened Grievance', () => {
    it('triggers REASSIGNMENT_LOOP only when count reaches authoritative threshold (>= 2)', () => {
      const singleReassign = {
        id: 'CS-2026-REASSIGN-1',
        title: 'Street tree pruning',
        status: 'IN_PROGRESS',
        departmentId: 'DEPT_GARDENS',
        createdAt: '2026-10-05T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z',
        reassignments: 1
      };

      const res1 = evaluateComplaintRisk(singleReassign, { referenceTime: FIXED_REF_TIME });
      const signal1 = res1.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.REASSIGNMENT_LOOP);
      assert.equal(signal1.isTriggered, false);
      assert.equal(signal1.points, 0);

      const loopReassign = {
        ...singleReassign,
        id: 'CS-2026-REASSIGN-2',
        reassignments: 2
      };

      const res2 = evaluateComplaintRisk(loopReassign, { referenceTime: FIXED_REF_TIME });
      const signal2 = res2.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.REASSIGNMENT_LOOP);
      assert.equal(signal2.isTriggered, true);
      assert.equal(signal2.points, SIGNAL_DEFINITIONS.REASSIGNMENT_LOOP.maxPoints);
    });

    it('triggers REOPENED_CASE for complaints reopened after resolution', () => {
      const reopenedComplaint = {
        id: 'CS-2026-REOPEN',
        title: 'Garbage pile reappeared after clearing',
        status: 'REOPENED',
        departmentId: 'DEPT_SANITATION',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-10T00:00:00.000Z',
        reassignments: 0,
        reopenedCount: 1
      };

      const result = evaluateComplaintRisk(reopenedComplaint, { referenceTime: FIXED_REF_TIME });
      const reopenedSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.REOPENED_CASE);

      assert.ok(reopenedSignal);
      assert.equal(reopenedSignal.isTriggered, true);
      assert.equal(reopenedSignal.points, SIGNAL_DEFINITIONS.REOPENED_CASE.maxPoints);
    });
  });

  // 7. Genuinely Missing Ownership vs Unrecorded Ownership Data
  describe('7. Observed Missing Ownership vs. Unrecorded Data', () => {
    it('triggers UNASSIGNED_OWNERSHIP when departmentId is verified null after 3-day triage grace window', () => {
      const unassignedAfterGrace = {
        id: 'CS-2026-UNASSIGNED-OLD',
        title: 'Graffiti on bridge pillar',
        status: 'PENDING',
        departmentId: null,
        department: 'UNASSIGNED',
        createdAt: '2026-10-06T00:00:00.000Z', // 6 days elapsed (> 3d grace)
        updatedAt: '2026-10-06T00:00:00.000Z',
        reassignments: 0,
        reopenedCount: 0
      };

      const result = evaluateComplaintRisk(unassignedAfterGrace, { referenceTime: FIXED_REF_TIME });
      const unassignedSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.UNASSIGNED_OWNERSHIP);

      assert.ok(unassignedSignal);
      assert.equal(unassignedSignal.isAvailable, true);
      assert.equal(unassignedSignal.isTriggered, true);
      assert.equal(unassignedSignal.points, SIGNAL_DEFINITIONS.UNASSIGNED_OWNERSHIP.maxPoints);
    });

    it('does NOT trigger UNASSIGNED_OWNERSHIP during initial 3-day triage grace window', () => {
      const unassignedWithinGrace = {
        id: 'CS-2026-UNASSIGNED-NEW',
        title: 'Fallen branch',
        status: 'PENDING',
        departmentId: null,
        department: null,
        createdAt: '2026-10-11T00:00:00.000Z', // 1 day elapsed (< 3d grace)
        updatedAt: '2026-10-11T00:00:00.000Z',
        reassignments: 0,
        reopenedCount: 0
      };

      const result = evaluateComplaintRisk(unassignedWithinGrace, { referenceTime: FIXED_REF_TIME });
      const unassignedSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.UNASSIGNED_OWNERSHIP);

      assert.ok(unassignedSignal);
      assert.equal(unassignedSignal.isAvailable, true);
      assert.equal(unassignedSignal.isTriggered, false);
      assert.equal(unassignedSignal.points, 0);
      assert.match(unassignedSignal.message, /within initial 3-day department triage window/);
    });

    it('marks UNASSIGNED_OWNERSHIP as isAvailable: false when ownership tracking field is completely omitted', () => {
      const payloadWithoutDeptFields = {
        id: 'CS-2026-NO-FIELD',
        title: 'Citizen inquiry',
        status: 'PENDING',
        // Note: neither departmentId nor department is present in this object
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
        reassignments: 0,
        reopenedCount: 0
      };

      const result = evaluateComplaintRisk(payloadWithoutDeptFields, { referenceTime: FIXED_REF_TIME });
      const unassignedSignal = result.signals.find(s => s.code === NEGLECT_SIGNAL_CODES.UNASSIGNED_OWNERSHIP);

      assert.ok(unassignedSignal);
      assert.equal(unassignedSignal.isAvailable, false);
      assert.equal(unassignedSignal.points, 0);
      assert.match(unassignedSignal.message, /unrecorded or unavailable/);
    });
  });

  // 8. Fair Score Normalization
  describe('8. Score Normalization & Missing-Signal Denominator', () => {
    it('normalizes against evaluable weights so entities with fewer applicable signals are not unfairly scored', () => {
      // Subtask with only STALE_PROGRESS (25) and BLOCKED_DEPENDENCY (20) evaluable:
      // Total evaluable weight = 45. If STALE_PROGRESS triggers (25 pts),
      // normalized score = round((25 / 45) * 100) = 56.
      const subtask = {
        id: 'SUB-2026-NORM',
        title: 'Procure replacement parts',
        status: 'IN_PROGRESS',
        department: 'DEPT_WATER',
        officerId: 'OFF_001',
        createdAt: '2026-09-20T00:00:00.000Z', // 22 days elapsed
        updatedAt: '2026-09-20T00:00:00.000Z'  // 22 days elapsed (> 7d stale)
      };

      const result = evaluateSubtaskRisk(subtask, { referenceTime: FIXED_REF_TIME });

      // Available signals for this subtask: STALE_PROGRESS (25), BLOCKED_DEPENDENCY (20), UNASSIGNED_OWNERSHIP (10)
      // Total evaluable weight = 55. STALE_PROGRESS is triggered (25 pts max).
      assert.ok(result.riskScore > 0);
      assert.ok(result.dataCompleteness > 0 && result.dataCompleteness <= 1.0);
      assert.equal(result.riskLevel, NEGLECT_RISK_LEVELS.MEDIUM);
    });

    it('does not penalize records with complete history: clean complete record gets low score', () => {
      const cleanComplaint = {
        id: 'CS-2026-CLEAN',
        title: 'Smooth complaint lifecycle',
        status: 'IN_PROGRESS',
        departmentId: 'DEPT_ROADS',
        createdAt: '2026-10-08T00:00:00.000Z', // 4 days ago
        updatedAt: '2026-10-11T00:00:00.000Z', // 1 day ago
        reassignments: 0,
        reopenedCount: 0
      };

      const result = evaluateComplaintRisk(cleanComplaint, { referenceTime: FIXED_REF_TIME });

      assert.equal(result.dataCompleteness, 1.0);
      assert.equal(result.riskScore, 0);
      assert.equal(result.riskLevel, NEGLECT_RISK_LEVELS.LOW);
    });
  });

  // 9. Insufficient Data Handling
  describe('9. Insufficient Data Guardrails', () => {
    it('returns INSUFFICIENT_DATA for null, non-object, or empty payloads', () => {
      const resNull = evaluateEntityRisk(null, 'COMPLAINT');
      assert.equal(resNull.riskLevel, NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA);
      assert.equal(resNull.riskScore, null);

      const resString = evaluateEntityRisk('not-an-object', 'COMPLAINT');
      assert.equal(resString.riskLevel, NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA);
      assert.equal(resString.riskScore, null);
    });

    it('returns INSUFFICIENT_DATA when creation timestamp is missing or invalid', () => {
      const noDate = {
        id: 'CS-NODATE',
        title: 'Missing date complaint',
        status: 'PENDING',
        departmentId: 'DEPT_WATER'
      };

      const res = evaluateComplaintRisk(noDate, { referenceTime: FIXED_REF_TIME });
      assert.equal(res.riskLevel, NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA);
      assert.equal(res.riskScore, null);
      assert.equal(res.reason, 'MISSING_OR_INVALID_CREATION_DATE');
    });

    it('returns INSUFFICIENT_DATA when status is missing', () => {
      const noStatus = {
        id: 'CS-NOSTATUS',
        title: 'Missing status complaint',
        createdAt: '2026-10-01T00:00:00.000Z',
        departmentId: 'DEPT_WATER'
      };

      const res = evaluateComplaintRisk(noStatus, { referenceTime: FIXED_REF_TIME });
      assert.equal(res.riskLevel, NEGLECT_RISK_LEVELS.INSUFFICIENT_DATA);
      assert.equal(res.riskScore, null);
      assert.equal(res.reason, 'MISSING_OR_INVALID_STATUS');
    });
  });

  // 10. Department Authorization Scoping & Citizen Denial Contract
  describe('10. Department Scoping & Role Authorization Contracts', () => {
    it('strictly denies citizen users from accessing neglect radar supervisory monitoring', () => {
      const citizenUser = {
        id: 'USR-CITIZEN-01',
        role: 'citizen',
        email: 'citizen@example.com'
      };

      const scope = resolveRadarAccessScope(citizenUser);
      assert.equal(scope.authorized, false);
      assert.equal(scope.statusCode, 403);
      assert.match(scope.error, /citizen role is not authorized/);
    });

    it('denies unauthenticated requests', () => {
      const scope = resolveRadarAccessScope(null);
      assert.equal(scope.authorized, false);
      assert.equal(scope.statusCode, 401);
    });

    it('enforces officer scoping strictly to authenticated department, ignoring client-supplied department ID spoofing', () => {
      const officerUser = {
        id: 'OFF_001',
        role: 'officer',
        departmentId: 'DEPT_WATER'
      };

      // Officer attempts to query DEPT_ROADS
      const spoofAttempt = resolveRadarAccessScope(officerUser, { departmentId: 'DEPT_ROADS' });
      assert.equal(spoofAttempt.authorized, true);
      assert.equal(spoofAttempt.effectiveDepartmentId, 'DEPT_WATER');
      assert.equal(spoofAttempt.isUnrestricted, false);
    });

    it('denies officer if departmentId is missing from their profile', () => {
      const rogueOfficer = {
        id: 'OFF_ROGUE',
        role: 'officer',
        departmentId: null
      };

      const scope = resolveRadarAccessScope(rogueOfficer);
      assert.equal(scope.authorized, false);
      assert.equal(scope.statusCode, 403);
      assert.match(scope.error, /officer is not assigned to a valid department/);
    });

    it('grants administrator cross-department oversight and honors optional department filtering', () => {
      const adminUser = {
        id: 'USR-ADMIN-01',
        role: 'admin'
      };

      // Admin requesting all departments
      const crossDeptScope = resolveRadarAccessScope(adminUser);
      assert.equal(crossDeptScope.authorized, true);
      assert.equal(crossDeptScope.effectiveDepartmentId, null);
      assert.equal(crossDeptScope.isUnrestricted, true);

      // Admin filtering by specific department
      const filteredScope = resolveRadarAccessScope(adminUser, { departmentId: 'DEPT_POWER' });
      assert.equal(filteredScope.authorized, true);
      assert.equal(filteredScope.effectiveDepartmentId, 'DEPT_POWER');
      assert.equal(filteredScope.isUnrestricted, true);
    });
  });
});
