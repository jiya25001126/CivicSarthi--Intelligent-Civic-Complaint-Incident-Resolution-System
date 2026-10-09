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

// Fail safely in production if JWT_SECRET is not configured
if (env === 'production' && (!jwtSecret || jwtSecret.length < 16)) {
  console.error('[CivicSarthi Security Fatal] In production, JWT_SECRET must be set and contain at least 16 characters.');
  process.exit(1);
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
    complaints: path.resolve(__dirname, '../../../data/complaints.json'),
    departments: path.resolve(__dirname, '../../../data/departments.json'),
    officers: path.resolve(__dirname, '../../../data/officers.json'),
    incidents: path.resolve(__dirname, '../../../data/incidents.json'),
    subtasks: path.resolve(__dirname, '../../../data/subtasks.json'),
    statusHistory: path.resolve(__dirname, '../../../data/status_history.json'),
    users: path.resolve(__dirname, '../../../data/users.json'),
    auditLogs: path.resolve(__dirname, '../../../data/audit_logs.json')
  }
};

export default config;
