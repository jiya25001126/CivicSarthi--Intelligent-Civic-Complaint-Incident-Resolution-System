import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

// Load SLA config
const slaConfigPath = path.resolve(__dirname, 'sla.json');
const slaConfig = JSON.parse(fs.readFileSync(slaConfigPath, 'utf-8'));

const env = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || (env === 'production' ? null : 'civicsarthi_dev_insecure_jwt_secret_change_in_production');

export function validateProductionConfig(targetEnv = process.env.NODE_ENV || 'development', envVars = process.env) {
  if (targetEnv !== 'production') {
    return { valid: true, errors: [] };
  }

  const errors = [];
  const secret = envVars.JWT_SECRET;
  if (!secret || secret.length < 16) {
    errors.push('JWT_SECRET must be set and contain at least 16 characters in production.');
  }

  const persistence = (envVars.PERSISTENCE_MODE || '').toLowerCase();
  if (persistence !== 'mongodb') {
    errors.push('PERSISTENCE_MODE must be set to mongodb in production.');
  }

  const mongoUri = envVars.MONGODB_URI;
  if (!mongoUri || mongoUri.trim() === '') {
    errors.push('MONGODB_URI must be set in production.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Fail safely in production if JWT_SECRET is not configured
if (env === 'production' && (!jwtSecret || jwtSecret.length < 16)) {
  console.error('[CivicSarthi Security Fatal] In production, JWT_SECRET must be set and contain at least 16 characters.');
  process.exit(1);
}

/**
 * Robustly detects whether the runtime context is currently executing automated tests.
 */
export function isTestEnvironment() {
  return (
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.DATA_DIR && process.env.DATA_DIR.includes('sandbox')) ||
    (process.execArgv && process.execArgv.some(a => a.includes('--test'))) ||
    (process.argv && process.argv.some(a => a.includes('test') || a.includes('node:test')))
  );
}

/**
 * Resolves the active data storage directory:
 * - Uses process.env.DATA_DIR if explicitly configured
 * - In test environment, automatically routes to dedicated test sandbox
 * - In standard runtime (dev/prod), routes to application data directory
 */
export function getResolvedDataDir() {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  if (isTestEnvironment()) {
    return path.resolve(__dirname, '../../tests/sandbox-test-data');
  }
  return path.resolve(__dirname, '../../../data');
}

/**
 * Anti-silent-fallback safety guard.
 * Refuses to allow tests to write to the live application data directory.
 */
export function assertSafeWritePath(targetPath) {
  if (!targetPath) return;
  if (isTestEnvironment()) {
    const liveDataDir = path.resolve(__dirname, '../../../data');
    const resolved = path.resolve(targetPath);
    if (resolved.startsWith(liveDataDir) && !resolved.includes('sandbox') && !resolved.includes('.test.')) {
      throw new Error(
        `[Test Data Safety Error] Anti-silent-fallback triggered: Test environment attempted to write to protected live data directory: ${resolved}`
      );
    }
  }
}

export function resolveDataPath(filename) {
  return path.resolve(getResolvedDataDir(), filename);
}

export const config = {
  appName: 'CivicSarthi',
  version: '1.0.0',
  description: 'CivicSarthi — Intelligent Civic Complaint & Incident Resolution System',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  env,
  auth: {
    jwtSecret: jwtSecret || 'civicsarthi_dev_insecure_jwt_secret_change_in_production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    cookieName: 'civicsarthi_session',
    csrfCookieName: 'civicsarthi_csrf',
    bcryptSaltRounds: 10
  },
  sla: {
    resolutionDeadlineDays: Number(process.env.SLA_RESOLUTION_DEADLINE_DAYS || slaConfig.resolutionDeadlineDays),
    staleUpdateDays: Number(process.env.SLA_STALE_UPDATE_DAYS || slaConfig.staleUpdateDays),
    reassignmentLoopThreshold: Number(process.env.SLA_REASSIGNMENT_LOOP_THRESHOLD || slaConfig.reassignmentLoopThreshold)
  },
  persistence: {
    mode: (process.env.PERSISTENCE_MODE || (process.env.MONGODB_URI ? 'mongodb' : 'json')).toLowerCase()
  },
  dataPath: {
    get complaints() { return resolveDataPath('complaints.json'); },
    get departments() { return resolveDataPath('departments.json'); },
    get officers() { return resolveDataPath('officers.json'); },
    get incidents() { return resolveDataPath('incidents.json'); },
    get subtasks() { return resolveDataPath('subtasks.json'); },
    get statusHistory() { return resolveDataPath('status_history.json'); },
    get users() { return resolveDataPath('users.json'); },
    get auditLogs() { return resolveDataPath('audit_logs.json'); },
    get feedback() { return resolveDataPath('feedback.json'); },
    get appeals() { return resolveDataPath('appeals.json'); },
    get reopeningRequests() { return resolveDataPath('reopening_requests.json'); },
    get spamReviews() { return resolveDataPath('spam_reviews.json'); },
    get citizenReputations() { return resolveDataPath('citizen_reputations.json'); },
    get clarifications() { return resolveDataPath('clarifications.json'); },
    get reminders() { return resolveDataPath('reminders.json'); },
    get notifications() { return resolveDataPath('notifications.json'); }
  },
  reminders: {
    cooldownHours: Number(process.env.REMINDER_COOLDOWN_HOURS || 24)
  }
};

export default config;
