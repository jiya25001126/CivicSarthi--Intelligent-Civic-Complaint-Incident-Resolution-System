/**
 * @file neglectRadar.routes.js
 * @description Express routes and validation schemas for Phase 8 Neglect Radar & Supervisory Monitoring.
 *
 * Enforces strict authentication, officer/admin role gating (citizen denial),
 * and validated parameter boundaries.
 */

import express from 'express';
import { z } from 'zod';
import {
  getNeglectRadar,
  getNeglectRadarItem
} from '../controllers/neglectRadar.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import {
  NEGLECT_ENTITY_TYPES,
  NEGLECT_RISK_LEVELS,
  NEGLECT_SIGNAL_CODES
} from '../constants/neglectRadar.constants.js';

const router = express.Router();

const validEntityTypes = ['ALL', ...Object.values(NEGLECT_ENTITY_TYPES), 'all', 'complaint', 'incident', 'subtask'];
const validRiskLevels = ['ALL', ...Object.values(NEGLECT_RISK_LEVELS), 'all', 'critical', 'high', 'medium', 'low', 'insufficient_data'];
const validSignalCodes = Object.values(NEGLECT_SIGNAL_CODES);
const validSorts = ['riskScore_desc', 'riskScore_asc', 'createdAt_desc', 'createdAt_asc', 'updatedAt_desc'];

/**
 * Validation schema for listing / querying Neglect Radar items
 */
const listRadarSchema = {
  query: z.object({
    entityType: z.enum(validEntityTypes, {
      errorMap: () => ({ message: `Invalid entityType. Allowed: ALL, COMPLAINT, INCIDENT, SUBTASK` })
    }).optional(),
    riskLevel: z.enum(validRiskLevels, {
      errorMap: () => ({ message: `Invalid riskLevel. Allowed: ALL, CRITICAL, HIGH, MEDIUM, LOW, INSUFFICIENT_DATA` })
    }).optional(),
    departmentId: z.string().max(50, 'Department ID cannot exceed 50 characters').optional(),
    search: z.string().max(100, 'Search query cannot exceed 100 characters').optional(),
    signalCode: z.enum(validSignalCodes, {
      errorMap: () => ({ message: `Invalid signalCode. Allowed: ${validSignalCodes.join(', ')}` })
    }).optional(),
    sort: z.enum(validSorts, {
      errorMap: () => ({ message: `Invalid sort order. Allowed: ${validSorts.join(', ')}` })
    }).optional(),
    page: z.string().regex(/^\d+$/, 'Page must be a positive integer').optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a positive integer').optional(),
    includeTerminal: z.enum(['true', 'false']).optional()
  })
};

/**
 * Validation schema for retrieving a single Neglect Radar item
 */
const getRadarItemSchema = {
  params: z.object({
    entityType: z.enum(
      ['COMPLAINT', 'INCIDENT', 'SUBTASK', 'complaint', 'incident', 'subtask'],
      { errorMap: () => ({ message: 'Entity type must be one of: COMPLAINT, INCIDENT, SUBTASK' }) }
    ),
    id: z.string().trim().min(1, 'Entity ID is required').max(100, 'Entity ID cannot exceed 100 characters')
  })
};

// ==========================================
// Neglect Radar Routes (Privileged: officer, admin)
// Citizens are denied (HTTP 403 Forbidden)
// ==========================================

// List and evaluate neglect radar items with filters, summary metrics, and pagination
router.get(
  '/',
  authenticate,
  requireRole('officer', 'admin'),
  validate(listRadarSchema),
  getNeglectRadar
);

// Retrieve single evaluated neglect radar item
router.get(
  '/:entityType/:id',
  authenticate,
  requireRole('officer', 'admin'),
  validate(getRadarItemSchema),
  getNeglectRadarItem
);

export default router;
