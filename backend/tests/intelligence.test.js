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
import { authService } from '../src/services/auth.service.js';
import aiIntelligenceService from '../src/services/aiIntelligence.service.js';
import config from '../src/config/app.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApp();
const TEST_COMPLAINTS_PATH = path.resolve(path.dirname(config.dataPath.complaints), 'complaints.intelligence-test.json');
const TEST_USERS_PATH = path.resolve(path.dirname(config.dataPath.users), 'users.intelligence-test.json');
const TEST_AUDIT_PATH = path.resolve(path.dirname(config.dataPath.auditLogs), 'audit_logs.intelligence-test.json');

describe('CivicSarthi Phase 6: AI Complaint Intelligence Test Suite', () => {
  let citizenToken = null;
  let otherCitizenToken = null;
  let pwdOfficerToken = null;
  let jalOfficerToken = null;
  let adminToken = null;

  let citizenUserId = null;
  let createdComplaintId = null;
  let secondComplaintId = null;

  before(async () => {
    // 1. Isolate database fixtures to protect manual testing data
    const originalComplaints = await fs.readFile(config.dataPath.complaints, 'utf-8');
    await fs.writeFile(TEST_COMPLAINTS_PATH, originalComplaints, 'utf-8');
    complaintRepository.setFilePath(TEST_COMPLAINTS_PATH);

    const initialUsers = {
      metadata: { version: '1.0.0', description: 'Test users' },
      users: []
    };
    await fs.writeFile(TEST_USERS_PATH, JSON.stringify(initialUsers, null, 2), 'utf-8');
    userRepository.setFilePath(TEST_USERS_PATH);

    const initialAudit = {
      metadata: { version: '1.0.0', description: 'Test audit logs' },
      logs: []
    };
    await fs.writeFile(TEST_AUDIT_PATH, JSON.stringify(initialAudit, null, 2), 'utf-8');
    auditLogRepository.setFilePath(TEST_AUDIT_PATH);

    // 2. Provision test actors
    const citizenUser = await authService.register({
      email: 'citizen.ai@civicsarthi.internal',
      name: 'Ramesh Sharma',
      password: 'Password123!'
    });
    citizenToken = citizenUser.token;
    citizenUserId = citizenUser.user.id;

    const otherCitizen = await authService.register({
      email: 'citizen2.ai@civicsarthi.internal',
      name: 'Pooja Verma',
      password: 'Password123!'
    });
    otherCitizenToken = otherCitizen.token;

    const adminUser = await authService.provisionUser({
      email: 'admin.ai@civicsarthi.internal',
      name: 'AI Test Admin',
      password: 'AdminPassword123!',
      role: 'admin'
    }, { id: 'SYSTEM', email: 'system@internal', role: 'admin' });
    adminToken = authService.generateToken(adminUser);

    const pwdOfficer = await authService.provisionUser({
      email: 'officer.pwd@civicsarthi.internal',
      name: 'Officer Rajesh PWD',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_ROADS'
    }, adminUser);
    pwdOfficerToken = authService.generateToken(pwdOfficer);

    const jalOfficer = await authService.provisionUser({
      email: 'officer.jal@civicsarthi.internal',
      name: 'Officer Meera Jal Board',
      password: 'OfficerPassword123!',
      role: 'officer',
      departmentId: 'DEPT_WATER'
    }, adminUser);
    jalOfficerToken = authService.generateToken(jalOfficer);
  });

  after(async () => {
    try {
      complaintRepository.resetFilePath();
      userRepository.resetFilePath();
      auditLogRepository.resetFilePath();
      await fs.unlink(TEST_COMPLAINTS_PATH);
      await fs.unlink(TEST_USERS_PATH);
      await fs.unlink(TEST_AUDIT_PATH);
    } catch {}
  });

  // =========================================================================
  // SECTION 1: UNIT TESTS — CLASSIFICATION
  // =========================================================================
  describe('Feature A: Complaint Classification Service', () => {
    it('should classify road and pothole descriptions as roads with high confidence', () => {
      const result = aiIntelligenceService.classifyComplaint({
        title: 'Deep crater on main road',
        description: 'Large pothole on highway causing vehicle tyre damage and heavy traffic jam near junction.'
      });

      assert.equal(result.category, 'roads');
      assert.equal(result.departmentId, 'DEPT_ROADS');
      assert.ok(result.confidence >= 0.7);
      assert.ok(result.explanation.includes('roads') || result.explanation.includes('pothole'));
    });

    it('should classify water pipeline leaks as water category and Jal Board department', () => {
      const result = aiIntelligenceService.classifyComplaint({
        title: 'Drinking water pipe burst',
        description: 'Main water supply pipeline is broken and leaking clean drinking water onto street for two days.'
      });

      assert.equal(result.category, 'water');
      assert.equal(result.departmentId, 'DEPT_WATER');
      assert.ok(result.confidence >= 0.7);
      assert.ok(result.explanation.toLowerCase().includes('water'));
    });

    it('should classify electrical sparking as electricity category and Discom department', () => {
      const result = aiIntelligenceService.classifyComplaint({
        title: 'Transformer sparking near school',
        description: 'Electric transformer has broken wires and voltage fluctuation causing blackout in area.'
      });

      assert.equal(result.category, 'electricity');
      assert.equal(result.departmentId, 'DEPT_POWER');
      assert.ok(result.confidence >= 0.7);
    });

    it('should classify garbage dump and sewage as municipal category', () => {
      const result = aiIntelligenceService.classifyComplaint({
        title: 'Overflowing dustbin and garbage dump',
        description: 'Sanitation workers have not picked up waste for a week, causing foul smell and stray animals.'
      });

      assert.equal(result.category, 'municipal');
      assert.equal(result.departmentId, 'DEPT_MUNICIPAL');
    });

    it('should safely fall back to OTHER or UNKNOWN when description has no recognizable signals', () => {
      const result = aiIntelligenceService.classifyComplaint({
        title: 'General query',
        description: 'Hello, I have an inquiry about something happening in our neighborhood.'
      });

      assert.equal(result.category, 'OTHER');
      assert.equal(result.departmentId, 'GENERAL_ADMIN');
      assert.ok(result.confidence <= 0.5);
      assert.ok(result.explanation.includes('Insufficient clear category signals'));
    });

    it('should handle empty, null, or undefined inputs gracefully without throwing', () => {
      const res1 = aiIntelligenceService.classifyComplaint({});
      const res2 = aiIntelligenceService.classifyComplaint({ title: '', description: '' });
      const res3 = aiIntelligenceService.classifyComplaint(null);

      assert.equal(res1.category, 'OTHER');
      assert.equal(res2.category, 'OTHER');
      assert.equal(res3.category, 'OTHER');
    });
  });

  // =========================================================================
  // SECTION 2: UNIT TESTS — EXPLAINABLE PRIORITY RECOMMENDATIONS
  // =========================================================================
  describe('Feature B: Explainable Priority Recommendation Service', () => {
    it('should elevate life-threatening electrical or structural hazards to CRITICAL priority', () => {
      const result = aiIntelligenceService.recommendPriority({
        title: 'Live high voltage wire dangling on road',
        description: 'Live wire snapped and fell into water puddle, children walking nearby, immediate danger of electrocution!',
        category: 'electricity'
      });

      assert.equal(result.priority, 'CRITICAL');
      assert.equal(result.publicSafetyHazard, true);
      assert.ok(result.confidence === 'HIGH');
      assert.ok(result.reasons.some(r => r.includes('Public safety hazard')));
    });

    it('should elevate open manholes and flood risks to CRITICAL priority', () => {
      const result = aiIntelligenceService.recommendPriority({
        title: 'Open manhole on dark street',
        description: 'Uncovered sewer manhole cover missing on unlit street, two motorbikes fell into it today.',
        category: 'water'
      });

      assert.equal(result.priority, 'CRITICAL');
      assert.equal(result.publicSafetyHazard, true);
    });

    it('should recommend HIGH priority for urgent health or widespread municipal failures', () => {
      const result = aiIntelligenceService.recommendPriority({
        title: 'Hospital ambulance gate blocked',
        description: 'Urgent situation: critical access to emergency hospital is blocked by broken pavement.',
        category: 'roads'
      });

      assert.equal(result.priority, 'HIGH');
      assert.ok(result.reasons.some(r => r.includes('Urgency keywords')));
    });

    it('should recommend baseline MEDIUM priority for routine civic complaints without hazards', () => {
      const result = aiIntelligenceService.recommendPriority({
        title: 'Street light bulb replacement',
        description: 'The streetlight on 4th cross road is flickering during night time.',
        category: 'electricity'
      });

      assert.equal(result.priority, 'MEDIUM');
      assert.equal(result.publicSafetyHazard, false);
      assert.ok(result.reasons.length > 0);
    });

    it('should factor in old complaint age (>14 days) into priority escalation', () => {
      const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const result = aiIntelligenceService.recommendPriority({
        title: 'Pothole on service lane',
        description: 'Small pothole on lane.',
        category: 'roads',
        createdAt: oldDate
      });

      assert.ok(result.priority === 'HIGH' || result.priority === 'MEDIUM');
      assert.ok(result.reasons.some(r => r.includes('Complaint age exceeds')));
    });

    it('should factor in high duplicate report density into priority elevation', () => {
      const existingDuplicates = [
        { id: 'COMP-1', matchScore: 0.85 },
        { id: 'COMP-2', matchScore: 0.88 },
        { id: 'COMP-3', matchScore: 0.90 }
      ];
      const result = aiIntelligenceService.recommendPriority({
        title: 'Water pipe leaking',
        description: 'Water pipe is leaking on street.',
        category: 'water'
      }, existingDuplicates);

      assert.equal(result.priority, 'HIGH');
      assert.ok(result.reasons.some(r => r.includes('Repeated civic reports detected')));
    });
  });

  // =========================================================================
  // SECTION 3: UNIT TESTS — DUPLICATE DETECTION
  // =========================================================================
  describe('Feature C: Duplicate Complaint Detection Service', () => {
    const candidatePool = [
      {
        id: 'EXISTING-001',
        title: 'Broken water pipeline leaking clean water',
        description: 'Main water supply pipe burst near community center sector 4 Pune. Drinking water flooding street.',
        category: 'water',
        district: 'Pune',
        locality: 'Sector 4',
        status: 'SUBMITTED',
        createdAt: new Date().toISOString()
      },
      {
        id: 'EXISTING-002',
        title: 'Pothole on MG Road near station',
        description: 'Deep road crater causing massive traffic snarl on MG Road Pune.',
        category: 'roads',
        district: 'Pune',
        locality: 'MG Road',
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString()
      },
      {
        id: 'EXISTING-003',
        title: 'Broken water pipeline leaking clean water',
        description: 'Water pipe burst flooding street in Thane Mumbai.',
        category: 'water',
        district: 'Thane',
        locality: 'Ghodbunder',
        status: 'SUBMITTED',
        createdAt: new Date().toISOString()
      }
    ];

    it('should detect a high duplicate match for same category, location, and similar narrative', () => {
      const target = {
        id: 'NEW-001',
        title: 'Water pipeline pipe burst flooding street',
        description: 'Major drinking water supply pipe burst near sector 4 community hall Pune. Water is wasting rapidly.',
        category: 'water',
        district: 'Pune',
        locality: 'Sector 4'
      };

      const duplicates = aiIntelligenceService.detectDuplicates(target, candidatePool, { threshold: 0.5 });
      assert.ok(duplicates.length >= 1);
      const topMatch = duplicates[0];
      assert.equal(topMatch.id, 'EXISTING-001');
      assert.ok(topMatch.matchScore >= 0.6);
      assert.ok(topMatch.signals.some(s => s.includes('Category match')));
      assert.ok(topMatch.signals.some(s => s.includes('District match')));
    });

    it('should distinguish similar descriptions in completely different districts', () => {
      const target = {
        id: 'NEW-002',
        title: 'Broken water pipeline leaking clean water',
        description: 'Main water supply pipe burst in Bangalore Karnataka.',
        category: 'water',
        district: 'Bangalore Urban',
        locality: 'Indiranagar'
      };

      const duplicates = aiIntelligenceService.detectDuplicates(target, candidatePool, { threshold: 0.6 });
      // Should not falsely flag Pune complaint as a duplicate since district is completely different
      const matchedPune = duplicates.find(d => d.id === 'EXISTING-001');
      assert.equal(matchedPune, undefined);
    });

    it('should not detect duplicate when descriptions and categories are completely unrelated', () => {
      const target = {
        id: 'NEW-003',
        title: 'Pension installment not credited',
        description: 'Old age pension installment has been delayed for 3 months.',
        category: 'pension',
        district: 'Pune'
      };

      const duplicates = aiIntelligenceService.detectDuplicates(target, candidatePool);
      assert.equal(duplicates.length, 0);
    });

    it('should never match complaint against itself', () => {
      const duplicates = aiIntelligenceService.detectDuplicates(candidatePool[0], candidatePool);
      assert.ok(!duplicates.some(d => d.id === candidatePool[0].id));
    });

    it('should handle missing location or empty candidate set safely', () => {
      const resEmpty = aiIntelligenceService.detectDuplicates({ title: 'Test' }, []);
      const resNull = aiIntelligenceService.detectDuplicates(null, candidatePool);
      assert.deepEqual(resEmpty, []);
      assert.deepEqual(resNull, []);
    });

    it('should strictly sanitize citizen PII when preparing duplicate summaries for citizens', () => {
      const rawDuplicates = [
        {
          id: 'COMP-PRIVATE-1',
          referenceNumber: 'REF-1234',
          title: 'Road repair needed',
          citizenId: 'CITIZEN-999',
          citizenName: 'Deepak Patel',
          citizenPhone: '+91 9876543210',
          citizenEmail: 'deepak@personal.com',
          officerNotes: [{ note: 'Confidential investigation detail' }],
          matchScore: 0.85,
          signals: ['District match']
        }
      ];

      const sanitized = aiIntelligenceService.sanitizeDuplicatesForCitizen(rawDuplicates);
      assert.equal(sanitized.length, 1);
      assert.equal(sanitized[0].id, 'COMP-PRIVATE-1');
      assert.equal(sanitized[0].referenceNumber, 'REF-1234');
      assert.equal(sanitized[0].title, 'Road repair needed');
      assert.equal(sanitized[0].matchScore, 0.85);

      // PII MUST be undefined
      assert.equal(sanitized[0].citizenId, undefined);
      assert.equal(sanitized[0].citizenName, undefined);
      assert.equal(sanitized[0].citizenPhone, undefined);
      assert.equal(sanitized[0].citizenEmail, undefined);
      assert.equal(sanitized[0].officerNotes, undefined);
    });
  });

  // =========================================================================
  // SECTION 4: API & INTEGRATION TESTS
  // =========================================================================
  describe('Phase 6 API Endpoints & Workflow Integration', () => {
    it('POST /api/v1/complaints/analyze should provide assistive preview without storing complaint', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/analyze')
        .send({
          title: 'Deep road potholes near bypass',
          description: 'Large potholes on bypass road causing traffic jam and damage to vehicles.',
          category: 'roads',
          district: 'Pune'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.classification);
      assert.equal(res.body.data.classification.category, 'roads');
      assert.equal(res.body.data.classification.departmentId, 'DEPT_ROADS');
      assert.ok(res.body.data.priorityRecommendation);
      assert.ok(Array.isArray(res.body.data.potentialDuplicates));
    });

    it('POST /api/v1/complaints/analyze should handle empty body safely', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/analyze')
        .send({});

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.classification.category, 'OTHER');
    });

    it('POST /api/v1/complaints should automatically evaluate and store intelligence metadata', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Live power line snapped on main street',
          description: 'High voltage live wire has fallen onto road outside school. Immediate electrocution risk!',
          category: 'electricity',
          state: 'Maharashtra',
          district: 'Pune',
          locality: 'Bypass Road'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      const complaint = res.body.data;
      createdComplaintId = complaint.id;

      // Complaint initial operational priority remains preserved
      assert.ok(complaint.priority);

      // Intelligence metadata is attached
      assert.ok(complaint.intelligence);
      assert.equal(complaint.intelligence.classification.category, 'electricity');
      assert.equal(complaint.intelligence.priorityRecommendation.priority, 'CRITICAL');
      assert.equal(complaint.intelligence.priorityRecommendation.publicSafetyHazard, true);
    });

    it('POST /api/v1/complaints should create a second similar complaint and detect duplicate', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${otherCitizenToken}`)
        .send({
          title: 'Snapped live electrical wire dangerous on main street',
          description: 'High voltage live wire fallen on road outside school bypass. Very dangerous for public electrocution!',
          category: 'electricity',
          state: 'Maharashtra',
          district: 'Pune',
          locality: 'Bypass Road'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      secondComplaintId = res.body.data.id;
      const complaint = res.body.data;

      // Duplicates detected
      assert.ok(complaint.intelligence.duplicates);
      const foundMatch = complaint.intelligence.duplicates.find(d => d.id === createdComplaintId);
      assert.ok(foundMatch);
      assert.ok(foundMatch.matchScore >= 0.5);
    });

    it('GET /api/v1/complaints/:id/intelligence should return intelligence for complaint owner', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${createdComplaintId}/intelligence`)
        .set('Authorization', `Bearer ${citizenToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.classification);
      assert.ok(res.body.data.priorityRecommendation);
    });

    it('GET /api/v1/complaints/:id/intelligence should reject non-owner citizen with 403', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${createdComplaintId}/intelligence`)
        .set('Authorization', `Bearer ${otherCitizenToken}`);

      assert.equal(res.status, 403);
    });

    it('GET /api/v1/complaints/:id/duplicates should return PII-sanitized list for citizen owner', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${secondComplaintId}/duplicates`)
        .set('Authorization', `Bearer ${otherCitizenToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const dups = res.body.data;
      assert.ok(Array.isArray(dups));
      if (dups.length > 0) {
        assert.equal(dups[0].citizenEmail, undefined);
        assert.equal(dups[0].citizenPhone, undefined);
        assert.equal(dups[0].officerNotes, undefined);
      }
    });

    it('GET /api/v1/complaints/:id/duplicates should reject unauthenticated request', async () => {
      const res = await request(app)
        .get(`/api/v1/complaints/${secondComplaintId}/duplicates`);

      assert.equal(res.status, 401);
    });

    it('PATCH /api/v1/complaints/:id/priority should allow authorized officer to override priority', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${createdComplaintId}/priority`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          priority: 'CRITICAL',
          remarks: 'Reviewed and confirmed live wire poses immediate risk to public.'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.priority, 'CRITICAL');

      // Verify audit log has recorded the action
      const logs = await auditLogRepository.queryLogs({ action: 'UPDATE_PRIORITY' });
      assert.ok(logs.some(l => l.complaintId === createdComplaintId));
    });

    it('PATCH /api/v1/complaints/:id/priority should reject citizen request with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${createdComplaintId}/priority`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          priority: 'LOW'
        });

      assert.equal(res.status, 403);
    });

    it('PATCH /api/v1/complaints/:id/duplicate should allow authorized officer to link duplicate without deleting either', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${secondComplaintId}/duplicate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          duplicateOf: createdComplaintId,
          remarks: 'Correlated second report of same live wire incident on bypass road.'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.duplicateOf, createdComplaintId);

      // Verify the target complaint still exists intact
      const targetRes = await request(app)
        .get(`/api/v1/complaints/${createdComplaintId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(targetRes.status, 200);
      assert.equal(targetRes.body.data.id, createdComplaintId);

      // Verify audit log has recorded LINK_DUPLICATE
      const logs = await auditLogRepository.queryLogs({ action: 'LINK_DUPLICATE' });
      assert.ok(logs.some(l => l.complaintId === secondComplaintId));
    });

    it('PATCH /api/v1/complaints/:id/duplicate should reject linking complaint to itself or non-existent ticket', async () => {
      const selfRes = await request(app)
        .patch(`/api/v1/complaints/${secondComplaintId}/duplicate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          duplicateOf: secondComplaintId
        });
      assert.equal(selfRes.status, 400);

      const invalidRes = await request(app)
        .patch(`/api/v1/complaints/${secondComplaintId}/duplicate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          duplicateOf: 'NON-EXISTENT-ID-999'
        });
      assert.equal(invalidRes.status, 404);
    });

    it('PATCH /api/v1/complaints/:id/duplicate should reject citizen request with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/complaints/${secondComplaintId}/duplicate`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          duplicateOf: createdComplaintId
        });

      assert.equal(res.status, 403);
    });
  });
});
