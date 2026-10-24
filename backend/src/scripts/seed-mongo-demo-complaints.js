import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ComplaintModel } from '../models/complaint.model.js';
import { StatusHistoryModel } from '../models/statusHistory.model.js';
import { UserModel } from '../models/user.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { SEED_COMPLAINTS } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

/**
 * Curated list of 14 diverse synthetic demo complaints covering all lifecycle statuses,
 * critical/high priorities, and major civic departments.
 */
export const TARGET_DEMO_REFERENCES = [
  'CS-2026-0002', // Pension, IN_PROGRESS, Medium
  'CS-2026-0003', // Pension, SUBMITTED, Critical
  'CS-2026-0004', // Scholarship, ASSIGNED, High
  'CS-2026-0005', // Scholarship, AWAITING_INFORMATION, Medium
  'CS-2026-0006', // Roads, IN_PROGRESS, Critical
  'CS-2026-0007', // Roads, UNDER_REVIEW, High
  'CS-2026-0008', // Roads, RESOLVED, Low
  'CS-2026-0009', // Power, IN_PROGRESS, Critical
  'CS-2026-0010', // Power, UNDER_REVIEW, Medium
  'CS-2026-0011', // Water, IN_PROGRESS, Critical
  'CS-2026-0012', // Water, RESOLVED, Medium
  'CS-2026-0018', // Municipal, ASSIGNED, Medium
  'CS-2026-0032', // Municipal, RESOLVED, Low
  'CS-2026-0040'  // Disaster Relief, CLOSED, High
];

/**
 * Curated resolution details for resolved/closed synthetic demo complaints.
 */
export const RESOLUTION_FIXTURES = {
  'CS-2026-0008': {
    summary: 'Crater cluster cold-mix patch repaired and resurfaced with bituminous macadam; road cleared for traffic.',
    outcomeType: 'FULL_RESOLUTION',
    evidenceProvided: true,
    resolutionEvidence: ['road_repair_completion_photo_synth.jpg', 'quality_assurance_engineer_signoff_synth.pdf'],
    resolvedAt: new Date('2026-03-08T15:30:00.000Z'),
    resolvedBy: 'Rajesh Patel (Roads Nodal Officer)'
  },
  'CS-2026-0012': {
    summary: 'Ruptured cast-iron supply main replaced with 160mm ductile iron pipe; water pressure restored to normal operating range.',
    outcomeType: 'FULL_RESOLUTION',
    evidenceProvided: true,
    resolutionEvidence: ['water_pressure_telemetry_synth.pdf', 'valve_replacement_work_order_synth.jpg'],
    resolvedAt: new Date('2026-07-28T18:00:00.000Z'),
    resolvedBy: 'Sunita Verma (Water Nodal Officer)'
  },
  'CS-2026-0032': {
    summary: 'Overflowing community dumpster cleared by mechanized compactors and daily clearance route established.',
    outcomeType: 'FULL_RESOLUTION',
    evidenceProvided: true,
    resolutionEvidence: ['sanitation_completion_photo_synth.jpg'],
    resolvedAt: new Date('2026-08-14T11:00:00.000Z'),
    resolvedBy: 'Anil Deshmukh (Municipal Nodal Officer)'
  },
  'CS-2026-0040': {
    summary: 'Direct benefit transfer ex-gratia compensation of INR 25,000 successfully disbursed to beneficiary bank account via PFMS.',
    outcomeType: 'FULL_RESOLUTION',
    evidenceProvided: true,
    resolutionEvidence: ['pfms_disbursement_voucher_synth.pdf'],
    resolvedAt: new Date('2026-08-30T14:00:00.000Z'),
    resolvedBy: 'Disaster Relief Compensation Redressal Cell'
  }
};

/**
 * Maps synthetic complaints to real citizen accounts dynamically.
 * Prioritizes the standard demo citizen Aarav Sharma so the Citizen Portal displays
 * complaints across all status tabs (Pending Triage, In Remediation, Resolved, Critical).
 *
 * @param {Array} rawComplaints - Base synthetic complaints
 * @param {Object} citizens - Resolved citizen account identities
 * @returns {Array} Enriched synthetic complaints
 */
export function buildDemoComplaintsPayload(rawComplaints, citizens) {
  const { primaryCitizen, secondaryCitizen } = citizens;

  // Primary citizen demo references: spread across diverse statuses & priorities (8 complaints)
  const primaryCitizenRefs = new Set([
    'CS-2026-0003', // SUBMITTED, Critical (Pending Triage)
    'CS-2026-0007', // UNDER_REVIEW, High (Pending Triage)
    'CS-2026-0004', // ASSIGNED, High (In Remediation)
    'CS-2026-0006', // IN_PROGRESS, Critical (In Remediation)
    'CS-2026-0005', // AWAITING_INFORMATION, Medium (In Remediation)
    'CS-2026-0008', // RESOLVED, Low (Resolved)
    'CS-2026-0012', // RESOLVED, Medium (Resolved)
    'CS-2026-0040'  // CLOSED, High (Resolved)
  ]);

  // Secondary citizen references: providing representation for other accounts (3 complaints)
  const secondaryCitizenRefs = new Set([
    'CS-2026-0002', // IN_PROGRESS, Medium
    'CS-2026-0011', // IN_PROGRESS, Critical
    'CS-2026-0032'  // RESOLVED, Low
  ]);

  // Remaining 3 complaints are general civic demo complaints (unclaimed)
  // 'CS-2026-0009', 'CS-2026-0010', 'CS-2026-0018'

  return rawComplaints.map(c => {
    let citizenId = 'SYNTHETIC_CPGRAMS_DEMO';
    let citizenName = 'Synthetic Grievance Submitter';
    let citizenEmail = 'synthetic.citizen@cpgrams.internal';

    if (primaryCitizenRefs.has(c.referenceNumber)) {
      citizenId = primaryCitizen.id;
      citizenName = primaryCitizen.name;
      citizenEmail = primaryCitizen.email;
    } else if (secondaryCitizenRefs.has(c.referenceNumber) && secondaryCitizen) {
      citizenId = secondaryCitizen.id;
      citizenName = secondaryCitizen.name;
      citizenEmail = secondaryCitizen.email;
    }

    const resolutionDetails = RESOLUTION_FIXTURES[c.referenceNumber] || c.resolutionDetails || null;

    return {
      ...c,
      id: c.referenceNumber, // Enforce id matches referenceNumber for consistent lookups
      referenceNumber: c.referenceNumber,
      text: c.text || c.description,
      department: c.department || c.departmentId,
      citizenId,
      citizenName,
      citizenEmail,
      synthetic: true, // Strictly flagged as synthetic
      resolutionDetails,
      createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
      updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      lastUpdated: c.lastUpdated ? new Date(c.lastUpdated) : new Date()
    };
  });
}

/**
 * Idempotent seeder for populating synthetic demo complaints into an existing MongoDB database.
 *
 * Safety Guarantees:
 * 1. Checks that the target database contains existing CivicSarthi collections ('complaints', 'users', 'departments').
 * 2. Never deletes or updates genuine user-submitted complaints (synthetic: false).
 * 3. Never deletes, overwrites, or alters user accounts or passwords.
 * 4. Idempotent: repeated runs safely skip already seeded records without creating duplicates.
 * 5. Creates both embedded complaint statusHistory and independent StatusHistoryModel records.
 *
 * @param {Object} options - Configuration overrides
 * @returns {Promise<Object>} Seeding execution summary
 */
export async function seedMongoDemoComplaints(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  const uri = options.uri || process.env.MONGODB_URI;
  const expectedDb = options.expectedDb || options.db || (process.argv.find(a => a.startsWith('--db=')) || '').split('=')[1];
  const allowEmptyDb = options.allowEmptyDb || process.argv.includes('--allow-empty-db');

  console.log('[CivicSarthi Mongo Demo Seed] ============================================');
  console.log('[CivicSarthi Mongo Demo Seed] Idempotent MongoDB Demo Complaint Seeder');
  console.log(`[CivicSarthi Mongo Demo Seed] Mode: ${isDryRun ? 'DRY-RUN (Preview Only, No Writes)' : 'LIVE SEEDING (Non-Destructive Upsert)'}`);
  console.log(`[CivicSarthi Mongo Demo Seed] Target Complaint Count: ${TARGET_DEMO_REFERENCES.length}`);
  console.log('[CivicSarthi Mongo Demo Seed] ============================================');

  if (!uri || uri.trim() === '') {
    const errorMsg = 'Cannot seed MongoDB: MONGODB_URI is not set. Please provide MONGODB_URI in the environment or options.';
    console.error(`[CivicSarthi Mongo Demo Seed Error] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // Connect to MongoDB if not already connected
  let didConnectLocally = false;
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      didConnectLocally = true;
    } catch (connErr) {
      const errorMsg = `MongoDB connection failed: ${connErr.message}`;
      console.error(`[CivicSarthi Mongo Demo Seed Error] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  const activeDbName = mongoose.connection.db.databaseName;
  const activeHost = mongoose.connection.host;
  console.log(`[CivicSarthi Mongo Demo Seed] Connected to database: "${activeDbName}" on host "${activeHost}"`);

  // Target database name verification
  if (expectedDb && expectedDb.trim() !== '' && activeDbName !== expectedDb.trim()) {
    const errorMsg = `Safety Check Failed: Expected database "${expectedDb.trim()}", but connected to "${activeDbName}". Aborting to prevent seeding the wrong database.`;
    console.error(`[CivicSarthi Mongo Demo Seed Error] ${errorMsg}`);
    if (didConnectLocally) await mongoose.disconnect();
    return { success: false, error: errorMsg, database: activeDbName };
  }

  // Verify existing collections in target database
  const collections = await mongoose.connection.db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log(`[CivicSarthi Mongo Demo Seed] Existing collections in "${activeDbName}": [${collectionNames.join(', ')}]`);

  const hasUsers = collectionNames.includes('users');
  const hasDepartments = collectionNames.includes('departments');
  const hasComplaints = collectionNames.includes('complaints');

  if (!allowEmptyDb && (!hasUsers || !hasDepartments)) {
    const errorMsg = `Safety Check Failed: Database "${activeDbName}" is missing required CivicSarthi collections (users=${hasUsers}, departments=${hasDepartments}). Aborting to prevent seeding an uninitialized or incorrect database. Pass --allow-empty-db if intentional.`;
    console.error(`[CivicSarthi Mongo Demo Seed Error] ${errorMsg}`);
    if (didConnectLocally) await mongoose.disconnect();
    return { success: false, error: errorMsg, database: activeDbName };
  }

  // Inspect existing users to associate demo complaints with real database IDs
  const existingUsers = hasUsers ? await UserModel.find({}).lean() : [];
  console.log(`[CivicSarthi Mongo Demo Seed] Found ${existingUsers.length} existing user records in "${activeDbName}.users"`);

  const demoCitizenUser = existingUsers.find(u => u.email === 'citizen.demo@civicsarthi.internal');
  const secondaryCitizenUser = existingUsers.find(u => u.role === 'citizen' && u.email !== 'citizen.demo@civicsarthi.internal');

  const primaryCitizen = {
    id: demoCitizenUser?.id || 'USR-DEMO-CITIZEN-001',
    name: demoCitizenUser?.name || 'Aarav Sharma (Citizen)',
    email: demoCitizenUser?.email || 'citizen.demo@civicsarthi.internal'
  };

  const secondaryCitizen = secondaryCitizenUser ? {
    id: secondaryCitizenUser.id,
    name: secondaryCitizenUser.name,
    email: secondaryCitizenUser.email
  } : {
    id: 'USR-MV7T6B5R-W79S',
    name: 'Priya Verma',
    email: 'priya.verma.1791964126694@civicsarthi.internal'
  };

  console.log(`[CivicSarthi Mongo Demo Seed] Primary Demo Citizen: ${primaryCitizen.name} (${primaryCitizen.id}, ${primaryCitizen.email})`);
  console.log(`[CivicSarthi Mongo Demo Seed] Secondary Citizen: ${secondaryCitizen.name} (${secondaryCitizen.id}, ${secondaryCitizen.email})`);

  // Inspect existing complaints in target database
  const existingComplaints = hasComplaints ? await ComplaintModel.find({}).lean() : [];
  const existingMap = new Map(existingComplaints.map(c => [c.referenceNumber, c]));
  console.log(`[CivicSarthi Mongo Demo Seed] Found ${existingComplaints.length} existing complaint(s) in "${activeDbName}.complaints"`);

  // Target candidate complaints by reference number
  const targetRefSet = new Set(TARGET_DEMO_REFERENCES);
  const candidateSeedComplaints = SEED_COMPLAINTS.filter(c => targetRefSet.has(c.referenceNumber));

  // Build the enriched payload with citizen mapping
  const complaintsToSeed = buildDemoComplaintsPayload(candidateSeedComplaints, {
    primaryCitizen,
    secondaryCitizen
  });

  console.log(`[CivicSarthi Mongo Demo Seed] Prepared ${complaintsToSeed.length} synthetic demo complaints for seeding.`);

  const summary = {
    success: true,
    dryRun: isDryRun,
    database: activeDbName,
    collections: {
      complaints: ComplaintModel.collection.name,
      statusHistory: StatusHistoryModel.collection.name
    },
    preExistingComplaintsCount: existingComplaints.length,
    complaints: {
      totalCandidate: complaintsToSeed.length,
      inserted: 0,
      skippedExistingSynthetic: 0,
      skippedGenuinePreserved: 0,
      errors: []
    },
    statusHistory: {
      inserted: 0,
      skippedExisting: 0,
      errors: []
    },
    citizenDistribution: {
      primaryCitizenCount: 0,
      secondaryCitizenCount: 0,
      unclaimedCount: 0
    }
  };

  // Perform idempotent seeding
  for (const c of complaintsToSeed) {
    const existing = existingMap.get(c.referenceNumber);

    if (existing) {
      if (existing.synthetic !== true) {
        summary.complaints.skippedGenuinePreserved++;
        console.log(`[Preserved] ${c.referenceNumber}: Genuine complaint exists. Skipping.`);
        continue;
      }
      summary.complaints.skippedExistingSynthetic++;
      console.log(`[Idempotent Skip] ${c.referenceNumber}: Synthetic complaint already exists in database.`);
    } else {
      if (!isDryRun) {
        try {
          await ComplaintModel.create(c);
          summary.complaints.inserted++;
          console.log(`[Inserted] ${c.referenceNumber}: "${c.title}" -> Status: ${c.status}, Priority: ${c.priority}, Citizen: ${c.citizenName}`);
        } catch (insertErr) {
          summary.complaints.errors.push({ ref: c.referenceNumber, error: insertErr.message });
          console.error(`[Error] Failed to insert ${c.referenceNumber}: ${insertErr.message}`);
          continue;
        }
      } else {
        summary.complaints.inserted++;
        console.log(`[Dry-Run Preview] Would insert ${c.referenceNumber}: "${c.title}" (${c.status}) for ${c.citizenName}`);
      }
    }

    // Track citizen distribution
    if (c.citizenId === primaryCitizen.id) {
      summary.citizenDistribution.primaryCitizenCount++;
    } else if (c.citizenId === secondaryCitizen.id) {
      summary.citizenDistribution.secondaryCitizenCount++;
    } else {
      summary.citizenDistribution.unclaimedCount++;
    }

    // Sync status history into independent StatusHistory collection
    if (Array.isArray(c.statusHistory)) {
      for (let idx = 0; idx < c.statusHistory.length; idx++) {
        const h = c.statusHistory[idx];
        const histId = `HIST-${c.referenceNumber}-${idx + 1}`;

        if (!isDryRun) {
          try {
            const existingHist = await StatusHistoryModel.findOne({ id: histId }).lean();
            if (existingHist) {
              summary.statusHistory.skippedExisting++;
            } else {
              await StatusHistoryModel.create({
                id: histId,
                complaintId: c.id,
                referenceNumber: c.referenceNumber,
                timestamp: h.timestamp ? new Date(h.timestamp) : new Date(),
                status: h.status,
                actorType: h.actorType || 'CITIZEN',
                remarks: h.remarks || '',
                resolutionDetails: c.resolutionDetails || null
              });
              summary.statusHistory.inserted++;
            }
          } catch (histErr) {
            summary.statusHistory.errors.push({ id: histId, error: histErr.message });
          }
        } else {
          summary.statusHistory.inserted++;
        }
      }
    }
  }

  // Get final count if not dry-run
  const postSeedCount = isDryRun ? existingComplaints.length + summary.complaints.inserted : await ComplaintModel.countDocuments();
  summary.postSeedComplaintsCount = postSeedCount;

  console.log('[CivicSarthi Mongo Demo Seed] ============================================');
  console.log('[CivicSarthi Mongo Demo Seed] Execution Summary:');
  console.log(` - Database: ${activeDbName}`);
  console.log(` - Initial Complaints: ${summary.preExistingComplaintsCount}`);
  console.log(` - Synthetic Complaints Inserted: ${summary.complaints.inserted}`);
  console.log(` - Existing Synthetic Skipped: ${summary.complaints.skippedExistingSynthetic}`);
  console.log(` - Genuine Complaints Preserved: ${summary.complaints.skippedGenuinePreserved}`);
  console.log(` - Status History Records Inserted: ${summary.statusHistory.inserted}`);
  console.log(` - Primary Citizen (${primaryCitizen.name}) Caseload: ${summary.citizenDistribution.primaryCitizenCount}`);
  console.log(` - Secondary Citizen (${secondaryCitizen.name}) Caseload: ${summary.citizenDistribution.secondaryCitizenCount}`);
  console.log(` - Total Complaints Now in Database: ${postSeedCount}`);
  console.log('[CivicSarthi Mongo Demo Seed] ============================================');

  if (didConnectLocally && !options.keepConnected) {
    await mongoose.disconnect();
  }

  return summary;
}

// Execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedMongoDemoComplaints()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('[CivicSarthi Mongo Demo Seed Fatal Error]', err);
      process.exit(1);
    });
}
