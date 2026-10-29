import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../../data');

const DEMO_PASSWORD_PLAINTEXT = 'DemoUser@2026';
const DEMO_PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD_PLAINTEXT, 10);

export const DEMO_ACCOUNTS = [
  {
    id: 'USR-DEMO-CITIZEN-001',
    email: 'citizen.demo@civicsarthi.internal',
    passwordHash: DEMO_PASSWORD_HASH,
    name: 'Aarav Sharma (Citizen)',
    role: 'citizen',
    departmentId: null,
    isActive: true
  },
  {
    id: 'USR-DEMO-ROADS-002',
    email: 'officer.roads@civicsarthi.internal',
    passwordHash: DEMO_PASSWORD_HASH,
    name: 'Rajesh Patel (Roads Nodal Officer)',
    role: 'officer',
    departmentId: 'DEPT_ROADS',
    isActive: true
  },
  {
    id: 'USR-DEMO-WATER-003',
    email: 'officer.water@civicsarthi.internal',
    passwordHash: DEMO_PASSWORD_HASH,
    name: 'Sunita Verma (Water Nodal Officer)',
    role: 'officer',
    departmentId: 'DEPT_WATER',
    isActive: true
  },
  {
    id: 'USR-DEMO-MUNICIPAL-004',
    email: 'officer.municipal@civicsarthi.internal',
    passwordHash: DEMO_PASSWORD_HASH,
    name: 'Anil Deshmukh (Municipal Nodal Officer)',
    role: 'officer',
    departmentId: 'DEPT_MUNICIPAL',
    isActive: true
  },
  {
    id: 'USR-DEMO-ADMIN-005',
    email: 'admin.demo@civicsarthi.internal',
    passwordHash: DEMO_PASSWORD_HASH,
    name: 'Kavita Mehta (System Administrator)',
    role: 'admin',
    departmentId: null,
    isActive: true
  }
];

export async function runDemoSeed(options = {}) {
  const targetDir = options.dataDir || process.env.DATA_DIR || DATA_DIR;
  console.log('===============================================================');
  console.log('CivicSarthi Demonstration Fixture & Synthetic Account Seeder');
  console.log('===============================================================');
  console.log(`Target Data Directory: ${targetDir}`);

  await fs.mkdir(targetDir, { recursive: true });

  // 1. Seed Demo Accounts in users.json (PRESERVING existing users)
  const usersPath = path.join(targetDir, 'users.json');
  let existingUsers = [];
  try {
    const raw = await fs.readFile(usersPath, 'utf-8');
    const parsed = JSON.parse(raw);
    existingUsers = Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    existingUsers = [];
  }

  const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
  const mergedUsers = [...existingUsers];

  for (const demoAcct of DEMO_ACCOUNTS) {
    const idx = mergedUsers.findIndex(u => u.email.toLowerCase() === demoAcct.email.toLowerCase());
    const now = new Date().toISOString();
    if (idx >= 0) {
      // Update password hash and role while preserving other fields
      mergedUsers[idx] = {
        ...mergedUsers[idx],
        passwordHash: demoAcct.passwordHash,
        role: demoAcct.role,
        departmentId: demoAcct.departmentId,
        isActive: true,
        updatedAt: now
      };
    } else {
      mergedUsers.push({
        ...demoAcct,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  await fs.writeFile(
    usersPath,
    JSON.stringify(
      {
        metadata: {
          version: '1.1.0',
          description: 'CivicSarthi User Directory'
        },
        users: mergedUsers
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`[Demo Seed] Provisioned ${DEMO_ACCOUNTS.length} demo accounts (Total users: ${mergedUsers.length})`);

  // 2. Attribute Demo Complaints to Demo Citizen in complaints.json
  const complaintsPath = path.join(targetDir, 'complaints.json');
  try {
    const rawComp = await fs.readFile(complaintsPath, 'utf-8');
    const compData = JSON.parse(rawComp);
    if (Array.isArray(compData.complaints)) {
      let modified = false;
      const demoCitizenRefs = new Set([
        'CS-2026-0001',
        'CS-2026-0002',
        'CS-2026-0003',
        'CS-2026-0008',
        'CS-2026-0009',
        'CS-2026-0011',
        'CS-2026-0020',
        'CS-2026-0021'
      ]);
      compData.complaints = compData.complaints.map(c => {
        if (demoCitizenRefs.has(c.referenceNumber) && (!c.citizenId || c.citizenId === 'SYNTHETIC_CPGRAMS_DEMO' || c.citizenId === 'USR-DEMO-CITIZEN-001')) {
          modified = true;
          return {
            ...c,
            citizenId: 'USR-DEMO-CITIZEN-001',
            citizenName: 'Aarav Sharma',
            citizenEmail: 'citizen.demo@civicsarthi.internal'
          };
        }
        return c;
      });
      if (modified) {
        await fs.writeFile(complaintsPath, JSON.stringify(compData, null, 2), 'utf-8');
        console.log(`[Demo Seed] Linked ${demoCitizenRefs.size} sample complaints across multiple lifecycle stages to Demo Citizen (Aarav Sharma)`);
      }
    }
  } catch (err) {
    console.warn('[Demo Seed Warning] Complaints file update skipped:', err.message);
  }

  // 3. Seed Clarifications in clarifications.json (Non-destructive merge)
  const clarificationsPath = path.join(targetDir, 'clarifications.json');
  const demoClarifications = [
    {
      id: 'CLR-2026-0001',
      complaintId: 'CPG-2026-00101',
      referenceNumber: 'CS-2026-0001',
      citizenId: 'USR-DEMO-CITIZEN-001',
      citizenName: 'Aarav Sharma',
      departmentId: 'DEPT_PENSION',
      threadType: 'CLARIFICATION',
      status: 'RESPONDED',
      content: 'Can the zonal accounts desk confirm if the superannuation verification booklet was forwarded to CPAO?',
      responses: [
        {
          id: 'CLR-RESP-001',
          responderId: 'OFF_001',
          responderName: 'P. Sengupta (Accounts Officer)',
          responderRole: 'officer',
          responderDepartmentId: 'DEPT_PENSION',
          responseText: 'Booklet verification acknowledged on Oct 10. Annexure II forwarded to Central Pension Accounting Office; PPO dispatch expected within 7 business days.',
          isOfficial: true,
          createdAt: '2026-10-11T10:30:00.000Z'
        }
      ],
      createdAt: '2026-10-10T14:15:00.000Z',
      updatedAt: '2026-10-11T10:30:00.000Z'
    },
    {
      id: 'CLR-2026-0002',
      complaintId: 'CPG-2026-00121',
      referenceNumber: 'CS-2026-0021',
      citizenId: 'USR-DEMO-CITIZEN-001',
      citizenName: 'Aarav Sharma',
      departmentId: 'DEPT_WATER',
      threadType: 'LANDMARK_UPDATE',
      status: 'OPEN',
      content: 'Water pressure drop is particularly acute at Building C and D, opposite Datta Mandir.',
      responses: [],
      createdAt: '2026-10-12T08:20:00.000Z',
      updatedAt: '2026-10-12T08:20:00.000Z'
    }
  ];

  let existingClarifications = [];
  try {
    const raw = await fs.readFile(clarificationsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    existingClarifications = Array.isArray(parsed.clarifications) ? parsed.clarifications : [];
  } catch {}
  const demoClarificationIds = new Set(demoClarifications.map(c => c.id));
  const mergedClarifications = [
    ...existingClarifications.filter(c => !demoClarificationIds.has(c.id)),
    ...demoClarifications
  ];

  await fs.writeFile(
    clarificationsPath,
    JSON.stringify(
      {
        metadata: {
          version: '1.0.0',
          description: 'CivicSarthi Citizen-Initiated Clarification Threads'
        },
        clarifications: mergedClarifications
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`[Demo Seed] Seeded ${demoClarifications.length} synthetic clarification threads (Total: ${mergedClarifications.length})`);

  // 4. Seed Reminders in reminders.json (Non-destructive merge)
  const remindersPath = path.join(targetDir, 'reminders.json');
  const demoReminders = [
    {
      id: 'REM-2026-0001',
      complaintId: 'CPG-2026-00101',
      referenceNumber: 'CS-2026-0001',
      citizenId: 'USR-DEMO-CITIZEN-001',
      citizenName: 'Aarav Sharma',
      departmentId: 'DEPT_PENSION',
      reason: 'PPO generation delay is exceeding 4 months; request expedited verification.',
      status: 'ACCEPTED',
      deliveryChannel: 'IN_APP',
      deliveryStatus: 'LOGGED_IN_APP',
      requestedAt: '2026-10-11T12:00:00.000Z',
      createdAt: '2026-10-11T12:00:00.000Z',
      updatedAt: '2026-10-11T12:00:00.000Z'
    }
  ];

  let existingReminders = [];
  try {
    const raw = await fs.readFile(remindersPath, 'utf-8');
    const parsed = JSON.parse(raw);
    existingReminders = Array.isArray(parsed.reminders) ? parsed.reminders : [];
  } catch {}
  const demoReminderIds = new Set(demoReminders.map(r => r.id));
  const mergedReminders = [
    ...existingReminders.filter(r => !demoReminderIds.has(r.id)),
    ...demoReminders
  ];

  await fs.writeFile(
    remindersPath,
    JSON.stringify(
      {
        metadata: {
          version: '1.0.0',
          description: 'CivicSarthi Citizen Grievance Reminders and Follow-up Log'
        },
        reminders: mergedReminders
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`[Demo Seed] Seeded ${demoReminders.length} synthetic reminder records (Total: ${mergedReminders.length})`);

  // 5. Seed Appeals in appeals.json (Non-destructive merge)
  const appealsPath = path.join(targetDir, 'appeals.json');
  const demoAppeals = [
    {
      id: 'APP-2026-0001',
      complaintId: 'CPG-2026-00103',
      referenceNumber: 'CS-2026-0003',
      citizenId: 'USR-DEMO-CITIZEN-001',
      citizenName: 'Aarav Sharma',
      departmentId: 'DEPT_WATER',
      reasonCategory: 'INCOMPLETE_WORK',
      status: 'UNDER_REVIEW',
      explanation: 'Pipeline leak was patched with temporary clamp, but water pressure is still leaking onto pedestrian footpath.',
      evidence: ['sub_base_leakage_photo_synth.jpg'],
      statusHistory: [
        {
          timestamp: '2026-10-10T16:00:00.000Z',
          fromStatus: 'SUBMITTED',
          toStatus: 'UNDER_REVIEW',
          actor: 'officer.water@civicsarthi.internal',
          remarks: 'Appeals desk review initiated by Water Department Nodal Officer.'
        }
      ],
      internalNotes: [
        {
          id: 'NOTE-001',
          authorId: 'USR-DEMO-WATER-003',
          authorEmail: 'officer.water@civicsarthi.internal',
          authorRole: 'officer',
          text: 'Field engineer ordered to re-excavate and install permanent pressure collar.',
          timestamp: '2026-10-10T16:05:00.000Z'
        }
      ],
      createdAt: '2026-10-10T15:30:00.000Z',
      updatedAt: '2026-10-10T16:05:00.000Z'
    },
    {
      id: 'APP-2026-0002',
      complaintId: 'CPG-2026-00108',
      referenceNumber: 'CS-2026-0008',
      citizenId: 'USR-DEMO-CITIZEN-001',
      citizenName: 'Aarav Sharma',
      departmentId: 'DEPT_HEALTH',
      reasonCategory: 'OFFICER_ERROR',
      status: 'UPHELD',
      explanation: 'Empanelled civil hospital refused to provide prescribed generic medicines under Jan Aushadhi scheme.',
      evidence: ['pharmacy_refusal_receipt_synth.pdf'],
      decision: {
        outcome: 'UPHELD',
        reason: 'Hospital inspection confirmed medicine stock was diverted; show cause notice issued.',
        citizenExplanation: 'Your appeal has been upheld. Civil Surgeon issued instructions for reimbursement and drug restock.',
        decidedBy: 'officer.health@civicsarthi.internal',
        decidedAt: '2026-10-11T14:00:00.000Z'
      },
      statusHistory: [
        {
          timestamp: '2026-10-09T10:00:00.000Z',
          fromStatus: 'SUBMITTED',
          toStatus: 'UNDER_REVIEW',
          actor: 'officer.health@civicsarthi.internal',
          remarks: 'Health Department appeal under investigation.'
        },
        {
          timestamp: '2026-10-11T14:00:00.000Z',
          fromStatus: 'UNDER_REVIEW',
          toStatus: 'UPHELD',
          actor: 'officer.health@civicsarthi.internal',
          remarks: 'Appeal upheld in citizen favor.'
        }
      ],
      internalNotes: [],
      createdAt: '2026-10-09T09:00:00.000Z',
      updatedAt: '2026-10-11T14:00:00.000Z'
    }
  ];

  let existingAppeals = [];
  try {
    const raw = await fs.readFile(appealsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    existingAppeals = Array.isArray(parsed.appeals) ? parsed.appeals : [];
  } catch {}
  const demoAppealIds = new Set(demoAppeals.map(a => a.id));
  const mergedAppeals = [
    ...existingAppeals.filter(a => !demoAppealIds.has(a.id)),
    ...demoAppeals
  ];

  await fs.writeFile(
    appealsPath,
    JSON.stringify(
      {
        metadata: {
          version: '1.0.0',
          description: 'CivicSarthi Formal Resolution Appeals'
        },
        appeals: mergedAppeals
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`[Demo Seed] Seeded ${demoAppeals.length} synthetic appeal records (Total: ${mergedAppeals.length})`);

  // 6. Seed Reopening Requests in reopening_requests.json (Non-destructive merge)
  const reopeningsPath = path.join(targetDir, 'reopening_requests.json');
  const demoReopenings = [
    {
      id: 'REOPEN-2026-0001',
      referenceNumber: 'REQ-2026-0001',
      complaintId: 'CPG-2026-00109',
      complaintReference: 'CS-2026-0009',
      citizenId: 'USR-DEMO-CITIZEN-001',
      citizenName: 'Aarav Sharma',
      departmentId: 'DEPT_ROADS',
      reasonCategory: 'ISSUE_PERSISTS',
      explanation: 'Streetlight fixture was replaced but phase circuit trips every night after 10 PM leaving the stretch dark.',
      status: 'PENDING_REVIEW',
      statusHistory: [
        {
          timestamp: '2026-10-12T09:00:00.000Z',
          fromStatus: null,
          toStatus: 'PENDING_REVIEW',
          actor: 'citizen.demo@civicsarthi.internal',
          remarks: 'Reopening petition submitted by citizen.'
        }
      ],
      createdAt: '2026-10-12T09:00:00.000Z',
      updatedAt: '2026-10-12T09:00:00.000Z'
    }
  ];

  let existingReopenings = [];
  try {
    const raw = await fs.readFile(reopeningsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    existingReopenings = Array.isArray(parsed.reopeningRequests) ? parsed.reopeningRequests : [];
  } catch {}
  const demoReopeningIds = new Set(demoReopenings.map(r => r.id));
  const mergedReopenings = [
    ...existingReopenings.filter(r => !demoReopeningIds.has(r.id)),
    ...demoReopenings
  ];

  await fs.writeFile(
    reopeningsPath,
    JSON.stringify(
      {
        metadata: {
          version: '1.0.0',
          description: 'CivicSarthi Controlled Reopening Requests'
        },
        reopeningRequests: mergedReopenings
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`[Demo Seed] Seeded ${demoReopenings.length} synthetic reopening requests (Total: ${mergedReopenings.length})`);

  // 7. Seed Citizen Feedback in feedback.json (Non-destructive merge)
  const feedbackPath = path.join(targetDir, 'feedback.json');
  const demoFeedback = [
    {
      id: 'FB-2026-0001',
      complaintId: 'CPG-2026-00111',
      referenceNumber: 'CS-2026-0011',
      citizenId: 'USR-DEMO-CITIZEN-001',
      rating: 4,
      comments: 'Water pipeline repaired reasonably quickly. Slight excavation debris left on shoulder.',
      createdAt: '2026-10-09T17:00:00.000Z',
      updatedAt: '2026-10-09T17:00:00.000Z'
    },
    {
      id: 'FB-2026-0002',
      complaintId: 'CPG-2026-00108',
      referenceNumber: 'CS-2026-0008',
      citizenId: 'USR-DEMO-CITIZEN-001',
      rating: 5,
      comments: 'District health inspector intervened directly to correct hospital pharmacy billing.',
      createdAt: '2026-10-11T16:00:00.000Z',
      updatedAt: '2026-10-11T16:00:00.000Z'
    }
  ];

  let existingFeedback = [];
  try {
    const raw = await fs.readFile(feedbackPath, 'utf-8');
    const parsed = JSON.parse(raw);
    existingFeedback = Array.isArray(parsed.feedback) ? parsed.feedback : [];
  } catch {}
  const demoFeedbackIds = new Set(demoFeedback.map(f => f.id));
  const mergedFeedback = [
    ...existingFeedback.filter(f => !demoFeedbackIds.has(f.id)),
    ...demoFeedback
  ];

  await fs.writeFile(
    feedbackPath,
    JSON.stringify(
      {
        metadata: {
          version: '1.0.0',
          description: 'CivicSarthi Citizen Resolution Feedback Records'
        },
        feedback: mergedFeedback
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`[Demo Seed] Seeded ${demoFeedback.length} synthetic feedback records (Total: ${mergedFeedback.length})`);

  // 8. Seed Spam Reviews in spam_reviews.json (Non-destructive merge)
  const spamReviewsPath = path.join(targetDir, 'spam_reviews.json');
  const demoSpamReviews = [
    {
      id: 'REV-2026-0001',
      complaintId: 'CPG-2026-00104',
      referenceNumber: 'CS-2026-0004',
      citizenId: 'USR-MV5PDNOR-EFQA',
      departmentId: 'DEPT_ROADS',
      screeningScore: 45,
      riskLevel: 'MEDIUM',
      screeningSignals: {
        burstRate: false,
        identicalText: false,
        gibberishScore: 0.1,
        duplicateCandidates: 2,
        fairnessProtected: true
      },
      screeningReasons: ['Multiple duplicate candidate grievances detected across identical road stretch within 24h.'],
      reviewStatus: 'PENDING_REVIEW',
      decision: null,
      reviewHistory: [],
      evaluatedAt: '2026-10-12T11:00:00.000Z',
      createdAt: '2026-10-12T11:00:00.000Z',
      updatedAt: '2026-10-12T11:00:00.000Z'
    }
  ];

  let existingSpamReviews = [];
  try {
    const raw = await fs.readFile(spamReviewsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    existingSpamReviews = Array.isArray(parsed.spamReviews) ? parsed.spamReviews : [];
  } catch {}
  const demoSpamIds = new Set(demoSpamReviews.map(s => s.id));
  const mergedSpamReviews = [
    ...existingSpamReviews.filter(s => !demoSpamIds.has(s.id)),
    ...demoSpamReviews
  ];

  await fs.writeFile(
    spamReviewsPath,
    JSON.stringify(
      {
        metadata: {
          version: '1.0.0',
          description: 'CivicSarthi Flagged Spam & Suspicious Complaint Review Queue'
        },
        spamReviews: mergedSpamReviews
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`[Demo Seed] Seeded ${demoSpamReviews.length} synthetic spam review records (Total: ${mergedSpamReviews.length})`);

  // If MongoDB is configured/connected, also synchronize demo accounts into MongoDB
  try {
    const { isConnected, connectDatabase } = await import('../config/database.js');
    if (!isConnected() && process.env.MONGODB_URI) {
      await connectDatabase();
    }
    if (isConnected()) {
      const forceSync = process.env.FORCE_DEMO_PASSWORD_SYNC === 'true';
      await initializeDemoAccounts({ force: true, forcePasswordSync: forceSync });
    }
  } catch (mongoErr) {
    console.warn('[Demo Seed Warning] MongoDB demo sync skipped:', mongoErr.message);
  }

  console.log('---------------------------------------------------------------');
  console.log('DEMO ACCOUNTS READY FOR EVALUATION:');
  console.log('  1. Citizen:      citizen.demo@civicsarthi.internal');
  console.log('  2. Roads Officer: officer.roads@civicsarthi.internal (DEPT_ROADS)');
  console.log('  3. Water Officer: officer.water@civicsarthi.internal (DEPT_WATER)');
  console.log('  4. Municipal Off: officer.municipal@civicsarthi.internal (DEPT_MUNICIPAL)');
  console.log('  5. System Admin:  admin.demo@civicsarthi.internal');
  console.log('===============================================================');

  return { success: true };
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDemoSeed().catch(err => {
    console.error('[Demo Seed Fatal Error]', err);
    process.exit(1);
  });
}

export default runDemoSeed;
