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

export const config = {
  appName: 'CivicSarthi',
  version: '1.0.0',
  description: 'CivicSarthi — Intelligent Civic Complaint & Incident Resolution System',
  port: parseInt(process.env.PORT || '5000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  env: process.env.NODE_ENV || 'development',
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
    statusHistory: path.resolve(__dirname, '../../../data/status_history.json')
  }
};

export default config;
