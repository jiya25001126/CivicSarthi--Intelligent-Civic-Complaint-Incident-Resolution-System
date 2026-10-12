/**
 * @file analytics.routes.js
 * @description Route definitions and request validations for CivicSarthi Phase 13 Analytics & Reporting.
 */

import express from 'express';
import { z } from 'zod';
import {
  getOverview,
  getTimeSeriesTrends,
  getDepartmentPerformance,
  getCategoryAndGeography,
  getWorkflowAndQuality,
  exportReport
} from '../controllers/analytics.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = express.Router();

// Strict server-side RBAC: All analytics endpoints require authentication and officer or admin role.
// Citizens are denied access with 403 Forbidden.
router.use(authenticate);
router.use(requireRole('officer', 'admin'));

const analyticsQuerySchema = {
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    departmentId: z.string().optional(),
    category: z.string().optional()
  })
};

const trendsQuerySchema = {
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    departmentId: z.string().optional(),
    category: z.string().optional(),
    interval: z.enum(['day', 'week', 'month']).optional()
  })
};

const exportSchema = {
  query: z.object({
    format: z.string().optional(),
    reportType: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    departmentId: z.string().optional(),
    category: z.string().optional()
  })
};

// Overview KPI Summary
router.get('/overview', validate(analyticsQuerySchema), getOverview);

// Time-Series Trends
router.get('/trends', validate(trendsQuerySchema), getTimeSeriesTrends);

// Department Performance Matrix
router.get('/departments', validate(analyticsQuerySchema), getDepartmentPerformance);

// Category & Geography Breakdown
router.get('/categories', validate(analyticsQuerySchema), getCategoryAndGeography);

// Operational Workflow, Quality & Follow-Ups
router.get('/workflow', validate(analyticsQuerySchema), getWorkflowAndQuality);

// Report Generation & Safe CSV Export
router.get('/export', validate(exportSchema), exportReport);
router.post('/export', validate(exportSchema), exportReport);

export default router;
