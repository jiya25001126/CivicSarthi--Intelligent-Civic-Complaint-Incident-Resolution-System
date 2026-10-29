/**
 * @file test-env.js
 * @description Preload environment hook for CivicSarthi automated tests.
 * Configures isolated sandbox test storage, disables production services,
 * and ensures tests cannot access or mutate production/development data.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Force test environment
process.env.NODE_ENV = 'test';
process.env.NOTIFICATION_PROVIDER = 'mock';

// 2. Prevent accidental remote MongoDB connections during test runs
if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('127.0.0.1') && !process.env.MONGODB_URI.includes('localhost')) {
  console.warn('[Test Env] Neutralizing remote MONGODB_URI for test isolation.');
  delete process.env.MONGODB_URI;
}

// 3. Configure dedicated isolated test data directory
const TEST_DATA_DIR = path.resolve(__dirname, 'sandbox-test-data');
process.env.DATA_DIR = TEST_DATA_DIR;

// 4. Ensure sandbox-test-data directory exists and is initialized with baseline fixtures
export function initTestSandbox() {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }

  // Baseline data source directory (prefers environment or local backup if available, otherwise data/)
  const backupDir = process.env.BACKUP_DATA_DIR || (process.platform === 'win32' && fs.existsSync('C:\\Users\\Hp\\CivicSarthi_backup_pre_change\\data') ? 'C:\\Users\\Hp\\CivicSarthi_backup_pre_change\\data' : null);
  const liveDataDir = path.resolve(__dirname, '../../data');
  const sourceDir = (backupDir && fs.existsSync(backupDir)) ? backupDir : liveDataDir;

  const filesToSeed = [
    'complaints.json',
    'departments.json',
    'officers.json',
    'incidents.json',
    'subtasks.json',
    'status_history.json',
    'users.json',
    'audit_logs.json',
    'feedback.json',
    'appeals.json',
    'reopening_requests.json',
    'spam_reviews.json',
    'citizen_reputations.json',
    'clarifications.json',
    'reminders.json',
    'notifications.json'
  ];

  for (const file of filesToSeed) {
    const targetFile = path.join(TEST_DATA_DIR, file);
    const sourceFile = path.join(sourceDir, file);

    // Only copy if the target doesn't already exist in the test sandbox
    if (!fs.existsSync(targetFile)) {
      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile);
      } else {
        // Initialize clean empty store for files like notifications.json
        const key = file.replace('.json', '');
        const collectionKey = {
          audit_logs: 'logs',
          citizen_reputations: 'reputations',
          spam_reviews: 'spamReviews',
          reopening_requests: 'reopeningRequests',
          status_history: 'history'
        }[key] || key;

        const initial = {
          metadata: { version: '1.0.0', description: `CivicSarthi Test Fixture for ${key}` },
          [collectionKey]: []
        };
        fs.writeFileSync(targetFile, JSON.stringify(initial, null, 2), 'utf-8');
      }
    }
  }
}

// Run initialization immediately on preload
initTestSandbox();
