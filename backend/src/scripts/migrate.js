import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import config from '../config/app.config.js';
import { connectDatabase, disconnectDatabase, isConnected } from '../config/database.js';
import { ComplaintModel } from '../models/complaint.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { StatusHistoryModel } from '../models/statusHistory.model.js';
import { UserModel } from '../models/user.model.js';
import { initializeDemoAccounts } from '../services/demoInit.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../../data');

/**
 * Migration Utility: JSON File Records -> MongoDB
 * Validates data schemas, prevents duplicate collisions, supports dry-run preview,
 * and provides structured audit logs of imported, skipped, and rejected records.
 */
export async function runMigration(options = {}) {
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  const isForce = options.force || process.argv.includes('--force') || process.argv.includes('--reset');
  const dataDir = options.dataDir || DATA_DIR;

  console.log('[CivicSarthi Migrate] ============================================');
  console.log('[CivicSarthi Migrate] JSON to MongoDB Data Migration Utility');
  console.log(`[CivicSarthi Migrate] Mode: ${isDryRun ? 'DRY-RUN (Preview Only)' : isForce ? 'FORCE (Reset & Overwrite)' : 'SAFE (Non-Destructive Upsert)'}`);
  console.log(`[CivicSarthi Migrate] Source: ${dataDir}`);
  console.log('[CivicSarthi Migrate] ============================================');

  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === '') {
    const errorMsg = 'Cannot migrate to MongoDB: MONGODB_URI is not set. Please set MONGODB_URI in environment or .env.';
    console.error(`[CivicSarthi Migrate Error] ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
      departments: { total: 0, imported: 0, skipped: 0, rejected: 0 },
      complaints: { total: 0, imported: 0, skipped: 0, rejected: 0 },
      statusHistory: { total: 0, imported: 0, skipped: 0, rejected: 0 }
    };
  }

  // Connect to database
  const connResult = await connectDatabase();
  if (!connResult.connected) {
    const errorMsg = `Database connection failed: ${connResult.error || 'Unable to reach MongoDB'}`;
    console.error(`[CivicSarthi Migrate Error] ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
      departments: { total: 0, imported: 0, skipped: 0, rejected: 0 },
      complaints: { total: 0, imported: 0, skipped: 0, rejected: 0 },
      statusHistory: { total: 0, imported: 0, skipped: 0, rejected: 0 }
    };
  }

  const summary = {
    success: true,
    dryRun: isDryRun,
    departments: { total: 0, imported: 0, skipped: 0, rejected: 0, errors: [] },
    complaints: { total: 0, imported: 0, skipped: 0, rejected: 0, errors: [] },
    statusHistory: { total: 0, imported: 0, skipped: 0, rejected: 0, errors: [] },
    users: { total: 0, imported: 0, skipped: 0, rejected: 0, errors: [] }
  };

  try {
    // If force mode and not dry run, optionally clear target collections
    if (isForce && !isDryRun) {
      console.log('[CivicSarthi Migrate] Force reset requested. Clearing existing collections in MongoDB...');
      await DepartmentModel.deleteMany({});
      await ComplaintModel.deleteMany({});
      await StatusHistoryModel.deleteMany({});
    }

    // 1. Migrate Departments
    const deptPath = path.join(dataDir, 'departments.json');
    try {
      const rawDept = await fs.readFile(deptPath, 'utf-8');
      const parsedDept = JSON.parse(rawDept);
      const deptList = Array.isArray(parsedDept.departments) ? parsedDept.departments : [];
      summary.departments.total = deptList.length;

      for (const d of deptList) {
        if (!d.id || !d.code || !d.name) {
          summary.departments.rejected++;
          summary.departments.errors.push(`Invalid department missing id/code/name: ${JSON.stringify(d)}`);
          continue;
        }

        const existing = await DepartmentModel.findOne({
          $or: [{ id: d.id }, { code: d.code }]
        });

        if (existing && !isForce) {
          summary.departments.skipped++;
        } else {
          if (!isDryRun) {
            await DepartmentModel.updateOne(
              { id: d.id },
              { $set: d },
              { upsert: true }
            );
          }
          summary.departments.imported++;
        }
      }
      console.log(`[CivicSarthi Migrate] Departments: ${summary.departments.imported} imported, ${summary.departments.skipped} skipped, ${summary.departments.rejected} rejected`);
    } catch (err) {
      console.warn(`[CivicSarthi Migrate Warning] Could not process ${deptPath}: ${err.message}`);
    }

    // 2. Migrate Complaints
    const compPath = path.join(dataDir, 'complaints.json');
    try {
      const rawComp = await fs.readFile(compPath, 'utf-8');
      const parsedComp = JSON.parse(rawComp);
      const compList = Array.isArray(parsedComp.complaints) ? parsedComp.complaints : [];
      summary.complaints.total = compList.length;

      for (const c of compList) {
        if (!c.referenceNumber || !c.title || !c.description) {
          summary.complaints.rejected++;
          summary.complaints.errors.push(`Invalid complaint missing ref/title/description: ${c.id || 'unknown'}`);
          continue;
        }

        const existing = await ComplaintModel.findOne({
          $or: [{ referenceNumber: c.referenceNumber }, { id: c.id }]
        });

        if (existing && !isForce) {
          summary.complaints.skipped++;
        } else {
          if (!isDryRun) {
            const formatted = {
              ...c,
              id: c.id || c.referenceNumber,
              referenceNumber: c.referenceNumber,
              text: c.text || c.description,
              department: c.department || c.departmentId,
              createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
              updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
              lastUpdated: c.lastUpdated ? new Date(c.lastUpdated) : new Date()
            };
            await ComplaintModel.updateOne(
              { referenceNumber: c.referenceNumber },
              { $set: formatted },
              { upsert: true }
            );
          }
          summary.complaints.imported++;
        }
      }
      console.log(`[CivicSarthi Migrate] Complaints: ${summary.complaints.imported} imported, ${summary.complaints.skipped} skipped, ${summary.complaints.rejected} rejected`);
    } catch (err) {
      console.warn(`[CivicSarthi Migrate Warning] Could not process ${compPath}: ${err.message}`);
    }

    // 3. Migrate Status History
    const histPath = path.join(dataDir, 'status_history.json');
    try {
      const rawHist = await fs.readFile(histPath, 'utf-8');
      const parsedHist = JSON.parse(rawHist);
      const histList = Array.isArray(parsedHist.history) ? parsedHist.history : [];
      summary.statusHistory.total = histList.length;

      for (const h of histList) {
        if (!h.complaintId || !h.referenceNumber || !h.status) {
          summary.statusHistory.rejected++;
          summary.statusHistory.errors.push(`Invalid history entry: ${JSON.stringify(h)}`);
          continue;
        }

        const histId = h.id || `HIST-${h.referenceNumber}-${new Date(h.timestamp).getTime()}`;
        const existing = await StatusHistoryModel.findOne({ id: histId });

        if (existing && !isForce) {
          summary.statusHistory.skipped++;
        } else {
          if (!isDryRun) {
            await StatusHistoryModel.updateOne(
              { id: histId },
              {
                $set: {
                  id: histId,
                  complaintId: h.complaintId,
                  referenceNumber: h.referenceNumber,
                  timestamp: h.timestamp ? new Date(h.timestamp) : new Date(),
                  status: h.status,
                  actorType: h.actorType || 'CITIZEN',
                  remarks: h.remarks || ''
                }
              },
              { upsert: true }
            );
          }
          summary.statusHistory.imported++;
        }
      }
      console.log(`[CivicSarthi Migrate] Status History: ${summary.statusHistory.imported} imported, ${summary.statusHistory.skipped} skipped, ${summary.statusHistory.rejected} rejected`);
    } catch (err) {
      console.warn(`[CivicSarthi Migrate Warning] Could not process ${histPath}: ${err.message}`);
    }

    // 4. Migrate Users
    const usersPath = path.join(dataDir, 'users.json');
    try {
      const rawUsers = await fs.readFile(usersPath, 'utf-8');
      const parsedUsers = JSON.parse(rawUsers);
      const userList = Array.isArray(parsedUsers.users) ? parsedUsers.users : [];
      summary.users.total = userList.length;

      for (const u of userList) {
        if (!u.email || !u.name || !u.passwordHash) {
          summary.users.rejected++;
          summary.users.errors.push(`Invalid user missing email/name/passwordHash: ${JSON.stringify(u)}`);
          continue;
        }

        const normalizedEmail = u.email.trim().toLowerCase();
        const existing = await UserModel.findOne({ email: normalizedEmail });

        if (existing && !isForce) {
          summary.users.skipped++;
        } else {
          if (!isDryRun) {
            await UserModel.updateOne(
              { email: normalizedEmail },
              {
                $set: {
                  id: u.id || `USR-${Date.now().toString(36).toUpperCase()}`,
                  email: normalizedEmail,
                  name: u.name.trim(),
                  passwordHash: u.passwordHash,
                  role: u.role || 'citizen',
                  departmentId: u.departmentId || null,
                  isActive: u.isActive !== undefined ? u.isActive : true
                }
              },
              { upsert: true }
            );
          }
          summary.users.imported++;
        }
      }
      console.log(`[CivicSarthi Migrate] Users: ${summary.users.imported} imported, ${summary.users.skipped} skipped, ${summary.users.rejected} rejected`);
    } catch (err) {
      console.warn(`[CivicSarthi Migrate Warning] Could not process ${usersPath}: ${err.message}`);
    }

    // Ensure all demo accounts exist
    if (!isDryRun) {
      await initializeDemoAccounts();
    }

    console.log('[CivicSarthi Migrate] ============================================');
    console.log('[CivicSarthi Migrate] Migration process completed successfully.');
    console.log('[CivicSarthi Migrate] ============================================');
    return summary;
  } finally {
    await disconnectDatabase();
  }
}

// Execute if run directly via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration().catch(err => {
    console.error('[CivicSarthi Migrate Fatal Error]', err);
    process.exit(1);
  });
}
