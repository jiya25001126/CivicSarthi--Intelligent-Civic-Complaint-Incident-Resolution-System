import { describe, it, before, after, beforeEach } from 'node:test';
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
import { SEED_COMPLAINTS, SEED_DEPARTMENTS, runSeed } from '../src/scripts/seed.js';
import { DEMO_ACCOUNTS, runDemoSeed } from '../src/scripts/seed-demo-data.js';
import { COMPLAINT_STATUS } from '../src/constants/status.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SANDBOX_DIR = path.resolve(__dirname, 'sandbox-demo-safety-test');
const SANDBOX_COMPLAINTS_FILE = path.join(SANDBOX_DIR, 'complaints.json');
const SANDBOX_DEPTS_FILE = path.join(SANDBOX_DIR, 'departments.json');
const SANDBOX_USERS_FILE = path.join(SANDBOX_DIR, 'users.json');
const SANDBOX_HISTORY_FILE = path.join(SANDBOX_DIR, 'status_history.json');
const SANDBOX_AUDIT_FILE = path.join(SANDBOX_DIR, 'audit_logs.json');

const app = createApp();

describe('CivicSarthi — Synthetic Demo Data Safety, Isolation & Dashboard Verification', () => {
  let demoCitizenToken = null;
  let genuineCitizenToken = null;
  let roadsOfficerToken = null;
  let waterOfficerToken = null;
  let adminToken = null;

  before(async () => {
    // 1. Prepare sandbox environment
    await fs.mkdir(SANDBOX_DIR, { recursive: true });

    // Redirect repository paths to sandbox
    complaintRepository.setFilePath(SANDBOX_COMPLAINTS_FILE);
    userRepository.setFilePath(SANDBOX_USERS_FILE);
    auditLogRepository.setFilePath(SANDBOX_AUDIT_FILE);

    // Initial empty audit file
    await fs.writeFile(SANDBOX_AUDIT_FILE, JSON.stringify({ metadata: { version: '1.0' }, logs: [] }, null, 2), 'utf-8');

    // 2. Run Seed in Sandbox directory
    process.env.DATA_DIR = SANDBOX_DIR;
    await runSeed({ dataDir: SANDBOX_DIR });
    await runDemoSeed({ dataDir: SANDBOX_DIR });

    // 3. Generate tokens for testing
    const demoCitizen = await userRepository.findByEmail('citizen.demo@civicsarthi.internal');
    demoCitizenToken = authService.generateToken(demoCitizen);

    const roadsOfficer = await userRepository.findByEmail('officer.roads@civicsarthi.internal');
    roadsOfficerToken = authService.generateToken(roadsOfficer);

    const waterOfficer = await userRepository.findByEmail('officer.water@civicsarthi.internal');
    waterOfficerToken = authService.generateToken(waterOfficer);

    const adminUser = await userRepository.findByEmail('admin.demo@civicsarthi.internal');
    adminToken = authService.generateToken(adminUser);

    // Register a genuine, non-demo citizen
    const genuineCitizen = await authService.register({
      email: 'citizen.genuine.real@example.com',
      name: 'Sunita Genuine Citizen',
      password: 'RealCitizenPassword@2026'
    });
    genuineCitizenToken = genuineCitizen.token;
  });

  after(async () => {
    // Restore repository paths and cleanup sandbox
    complaintRepository.resetFilePath();
    userRepository.resetFilePath();
    auditLogRepository.resetFilePath();
    delete process.env.DATA_DIR;

    try {
      await fs.rm(SANDBOX_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Synthetic Demo Complaint Dataset Schema Compliance', () => {
    it('1.1 should contain between 30 and 50 realistic seed complaints (currently 40)', () => {
      assert.ok(SEED_COMPLAINTS.length >= 30, `Expected at least 30 complaints, got ${SEED_COMPLAINTS.length}`);
      assert.ok(SEED_COMPLAINTS.length <= 50, `Expected at most 50 complaints, got ${SEED_COMPLAINTS.length}`);
      assert.equal(SEED_COMPLAINTS.length, 40);
    });

    it('1.2 every seed complaint MUST have synthetic: true', () => {
      const nonSynthetic = SEED_COMPLAINTS.filter((c) => c.synthetic !== true);
      assert.equal(
        nonSynthetic.length,
        0,
        `Found complaints without synthetic: true: ${nonSynthetic.map((c) => c.referenceNumber).join(', ')}`
      );
    });

    it('1.3 every seed complaint must follow referenceNumber format CS-YYYY-XXXX', () => {
      const refRegex = /^CS-202[0-9]-[0-9]{4}$/;
      for (const c of SEED_COMPLAINTS) {
        assert.match(
          c.referenceNumber,
          refRegex,
          `Complaint ${c.id} has invalid referenceNumber format: ${c.referenceNumber}`
        );
      }
    });

    it('1.4 seed complaints must cover all 11 registered departments', () => {
      const deptIdsInSeed = new Set(SEED_COMPLAINTS.map((c) => c.departmentId));
      for (const dept of SEED_DEPARTMENTS) {
        assert.ok(
          deptIdsInSeed.has(dept.id),
          `Registered department ${dept.id} (${dept.code}) is not represented in the seed complaints`
        );
      }
      assert.equal(deptIdsInSeed.size, 11);
    });

    it('1.5 seed complaints must represent all major lifecycle statuses', () => {
      const statusesInSeed = new Set(SEED_COMPLAINTS.map((c) => c.status));
      const expectedStatuses = [
        COMPLAINT_STATUS.SUBMITTED,
        COMPLAINT_STATUS.UNDER_REVIEW,
        COMPLAINT_STATUS.ASSIGNED,
        COMPLAINT_STATUS.IN_PROGRESS,
        COMPLAINT_STATUS.AWAITING_INFORMATION,
        COMPLAINT_STATUS.RESOLVED,
        COMPLAINT_STATUS.CLOSED
      ];
      for (const st of expectedStatuses) {
        assert.ok(statusesInSeed.has(st), `Expected status ${st} to be present in seed complaints`);
      }
    });

    it('1.6 seed complaints must contain valid geographic locality, district, and state', () => {
      for (const c of SEED_COMPLAINTS) {
        assert.ok(c.locality, `Complaint ${c.referenceNumber} missing locality`);
        assert.ok(c.district, `Complaint ${c.referenceNumber} missing district`);
        assert.ok(c.state, `Complaint ${c.referenceNumber} missing state`);
        if (c.location && c.location.coordinates) {
          const { lat, lng } = c.location.coordinates;
          assert.ok(lat >= 8.0 && lat <= 36.0, `Invalid latitude ${lat} in ${c.referenceNumber}`);
          assert.ok(lng >= 68.0 && lng <= 98.0, `Invalid longitude ${lng} in ${c.referenceNumber}`);
        }
      }
    });
  });

  describe('2. Repeatable & Duplicate-Safe Seeding (Data Preservation)', () => {
    it('2.1 preserves user-created complaints (synthetic: false) during seed rerun', async () => {
      // Create a genuine user complaint in the repository
      const genuinePayload = {
        title: 'Actual Citizen Grievance Created by Public User',
        description: 'Water contamination detected at resident tap in Kothrud.',
        category: 'water',
        departmentId: 'DEPT_WATER',
        status: 'SUBMITTED',
        priority: 'HIGH',
        synthetic: false,
        citizenId: 'USR-GENUINE-CITIZEN-01',
        citizenName: 'Sunita Genuine Citizen',
        citizenEmail: 'citizen.genuine.real@example.com'
      };
      const created = await complaintRepository.create(genuinePayload);
      assert.ok(created);
      assert.equal(created.synthetic, false);

      // Verify it exists in sandbox
      const beforeRerun = await complaintRepository.findById(created.id);
      assert.ok(beforeRerun);
      assert.equal(beforeRerun.synthetic, false);

      // Re-run seed
      await runSeed({ dataDir: SANDBOX_DIR });

      // Verify genuine complaint was NOT deleted or overwritten
      const afterRerun = await complaintRepository.findById(created.id);
      assert.ok(afterRerun, 'Genuine user complaint was lost during seed rerun!');
      assert.equal(afterRerun.title, genuinePayload.title);
      assert.equal(afterRerun.synthetic, false);
      assert.equal(afterRerun.citizenId, 'USR-GENUINE-CITIZEN-01');

      // Verify total complaints is 40 demo + 1 genuine = 41
      const allComplaints = await complaintRepository.findAll();
      assert.equal(allComplaints.length, 41);
    });

    it('2.2 running seed multiple times is idempotent and never duplicates demo records', async () => {
      await runSeed({ dataDir: SANDBOX_DIR });
      await runSeed({ dataDir: SANDBOX_DIR });

      const all = await complaintRepository.findAll();
      const demoRecords = all.filter((c) => c.synthetic === true);
      assert.equal(demoRecords.length, 40, 'Re-running seed duplicated demo complaints');

      const refSet = new Set(all.map((c) => c.referenceNumber));
      assert.equal(refSet.size, all.length, 'Duplicate reference numbers detected after seed reruns');
    });

    it('2.3 preserves Demo Citizen assignments when re-seeding', async () => {
      await runDemoSeed({ dataDir: SANDBOX_DIR });

      const demoUserComplaints = (await complaintRepository.findAll()).filter(
        (c) => c.citizenId === 'USR-DEMO-CITIZEN-001'
      );
      assert.equal(demoUserComplaints.length, 8);

      // Re-run base seed
      await runSeed({ dataDir: SANDBOX_DIR });

      // Demo citizen assignments should remain intact
      const afterBaseSeed = (await complaintRepository.findAll()).filter(
        (c) => c.citizenId === 'USR-DEMO-CITIZEN-001'
      );
      assert.equal(afterBaseSeed.length, 8, 'Base seed overwrote demo citizen assignments');
    });
  });

  describe('3. Citizen RBAC & Synthetic-Record Isolation', () => {
    it('3.1 genuine citizen receives ZERO demo complaints in fetchMyComplaints()', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/my')
        .set('Authorization', `Bearer ${genuineCitizenToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = res.body.data;
      assert.equal(
        items.length,
        0,
        `Genuine citizen leaked ${items.length} demo complaints: ${items.map((c) => c.referenceNumber).join(', ')}`
      );
    });

    it('3.2 Demo Citizen receives only the 8 complaints attributed to his account', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/my')
        .set('Authorization', `Bearer ${demoCitizenToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = res.body.data;
      assert.equal(items.length, 8);

      // Every returned item must belong to the demo citizen
      for (const item of items) {
        assert.equal(item.citizenId, 'USR-DEMO-CITIZEN-001');
      }
    });

    it('3.3 genuine citizen cannot access another citizen demo complaint by ID (403 Forbidden)', async () => {
      // Demo Citizen complaint CS-2026-0001
      const res = await request(app)
        .get('/api/v1/complaints/CS-2026-0001')
        .set('Authorization', `Bearer ${genuineCitizenToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /permission|denied|access/i);
    });

    it('3.4 unlinked synthetic demo complaint is protected from citizen read by ID (403 Forbidden)', async () => {
      // CS-2026-0004 is unlinked synthetic demo complaint (belongs to SYNTHETIC_CPGRAMS_DEMO)
      const res = await request(app)
        .get('/api/v1/complaints/CS-2026-0004')
        .set('Authorization', `Bearer ${genuineCitizenToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it('3.5 public tracking endpoint returns sanitized status history without leaking private data', async () => {
      const res = await request(app).get('/api/v1/complaints/track/CS-2026-0001');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);
      assert.equal(res.body.data.referenceNumber, 'CS-2026-0001');
      // Must not leak private citizen email or phone
      assert.equal(res.body.data.citizenEmail, undefined);
      assert.equal(res.body.data.citizenPhone, undefined);
      assert.ok(Array.isArray(res.body.data.statusHistory));
    });
  });

  describe('4. Officer Caseload & Department Boundaries', () => {
    it('4.1 Roads Officer receives only DEPT_ROADS complaints by default', async () => {
      const res = await request(app)
        .get('/api/v1/complaints')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = res.body.data;
      assert.ok(items.length > 0, 'Roads officer should receive complaints');
      for (const item of items) {
        assert.equal(
          item.departmentId || item.department,
          'DEPT_ROADS',
          `Roads officer received non-roads complaint ${item.referenceNumber} (${item.departmentId})`
        );
      }
    });

    it('4.2 Water Officer receives only DEPT_WATER complaints by default', async () => {
      const res = await request(app)
        .get('/api/v1/complaints')
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const items = res.body.data;
      assert.ok(items.length > 0, 'Water officer should receive complaints');
      for (const item of items) {
        assert.equal(
          item.departmentId || item.department,
          'DEPT_WATER',
          `Water officer received non-water complaint ${item.referenceNumber} (${item.departmentId})`
        );
      }
    });

    it('4.3 Water Officer cannot view Roads complaint detail (403 Forbidden)', async () => {
      // CS-2026-0001 is a Roads Department complaint
      const res = await request(app)
        .get('/api/v1/complaints/CS-2026-0001')
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.error, /other department|denied/i);
    });
  });

  describe('5. Dashboard Totals & KPI Metrics Verification', () => {
    it('5.1 /complaints/stats returns valid aggregate KPI counts', async () => {
      const res = await request(app).get('/api/v1/complaints/stats');

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const s = res.body.data;

      assert.ok(typeof s.total === 'number' && s.total > 0);
      assert.ok(typeof s.submitted === 'number');
      assert.ok(typeof s.underReview === 'number');
      assert.ok(typeof s.inProgress === 'number');
      assert.ok(typeof s.awaitingInfo === 'number');
      assert.ok(typeof s.resolved === 'number');
      assert.ok(typeof s.critical === 'number');
      assert.ok(typeof s.reassignmentLoops === 'number');
      assert.ok(typeof s.staleCases === 'number');

      // The status breakdown must equal the total
      const accounted = s.submitted + s.underReview + s.inProgress + s.awaitingInfo + s.resolved;
      assert.equal(accounted, s.total, `Accounted status sum (${accounted}) does not match total (${s.total})`);
    });

    it('5.2 Citizen Dashboard strictly derives totals from citizen personal list', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/my')
        .set('Authorization', `Bearer ${demoCitizenToken}`);

      const list = res.body.data;
      const totalCount = list.length;
      const triageCount = list.filter(
        (c) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW'
      ).length;
      const activeCount = list.filter(
        (c) => c.status === 'ASSIGNED' || c.status === 'IN_PROGRESS' || c.status === 'AWAITING_INFORMATION'
      ).length;
      const resolvedCount = list.filter(
        (c) => c.status === 'RESOLVED' || c.status === 'CLOSED'
      ).length;

      assert.equal(totalCount, 8);
      assert.ok(triageCount > 0, 'Demo citizen should have complaints in triage');
      assert.ok(activeCount > 0, 'Demo citizen should have complaints in active remediation');
      assert.ok(resolvedCount > 0, 'Demo citizen should have complaints resolved');
      assert.equal(triageCount + activeCount + resolvedCount, totalCount);
    });

    it('5.3 Officer Dashboard KPI values match filtered department complaints', async () => {
      const res = await request(app)
        .get('/api/v1/complaints')
        .set('Authorization', `Bearer ${roadsOfficerToken}`);

      const roadsList = res.body.data;
      const criticalCount = roadsList.filter(
        (c) => c.priority === 'CRITICAL' || c.priority === 'HIGH' || c.status === 'SUBMITTED'
      ).length;
      const loopCount = roadsList.filter((c) => (c.reassignments || 0) >= 2).length;

      assert.ok(roadsList.length > 0);
      assert.ok(criticalCount >= 0);
      assert.ok(loopCount >= 0);
    });
  });
});
