/**
 * @file incident.routes.js
 * @description Express routes and validation schemas for Phase 7 Parent Incidents and Complaint Coordination.
 */

import express from 'express';
import { z } from 'zod';
import {
  createIncident,
  listIncidents,
  getIncident,
  updateIncidentStatus,
  linkComplaint,
  unlinkComplaint,
  transferComplaint
} from '../controllers/incident.controller.js';
import {
  createSubtask,
  listSubtasks
} from '../controllers/subtask.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import {
  INCIDENT_STATUS,
  INCIDENT_PRIORITY,
  SUBTASK_STATUS
} from '../constants/incident.constants.js';

const router = express.Router();

const listIncidentsSchema = {
  query: z.object({
    status: z.string().optional(),
    category: z.string().optional(),
    leadDepartment: z.string().optional(),
    priority: z.string().optional(),
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional()
  })
};

const getIncidentSchema = {
  params: z.object({
    id: z.string().min(1, 'Incident ID is required')
  })
};

const createIncidentSchema = {
  body: z.object({
    title: z.string().trim().min(3, 'Incident title must be at least 3 characters').max(200, 'Incident title cannot exceed 200 characters'),
    category: z.string().min(2, 'Incident category is required'),
    leadDepartment: z.string().min(2, 'Incident leadDepartment is required'),
    description: z.string().max(3000, 'Description cannot exceed 3000 characters').optional(),
    priority: z.enum(Object.values(INCIDENT_PRIORITY), {
      errorMap: () => ({ message: `Invalid priority. Allowed: ${Object.values(INCIDENT_PRIORITY).join(', ')}` })
    }).optional(),
    status: z.enum(Object.values(INCIDENT_STATUS), {
      errorMap: () => ({ message: `Invalid status. Allowed: ${Object.values(INCIDENT_STATUS).join(', ')}` })
    }).optional(),
    participatingDepartments: z.array(z.string()).optional(),
    location: z.object({
      locality: z.string().optional(),
      district: z.string().optional(),
      state: z.string().optional()
    }).optional(),
    linkedComplaints: z.array(z.string()).optional()
  })
};

const updateIncidentStatusSchema = {
  params: z.object({
    id: z.string().min(1, 'Incident ID is required')
  }),
  body: z.object({
    status: z.enum(Object.values(INCIDENT_STATUS), {
      errorMap: () => ({ message: `Invalid status. Allowed: ${Object.values(INCIDENT_STATUS).join(', ')}` })
    }),
    resolutionSummary: z.string().optional(),
    overrideIncompleteSubtasks: z.boolean().optional(),
    overrideJustification: z.string().optional(),
    propagateToComplaints: z.boolean().optional(),
    complaintResolutionRemarks: z.string().optional()
  })
};

const linkComplaintSchema = {
  params: z.object({
    id: z.string().min(1, 'Incident ID is required')
  }),
  body: z.object({
    complaintId: z.string().min(1, 'Complaint ID or reference is required'),
    remarks: z.string().optional()
  })
};

const unlinkComplaintSchema = {
  params: z.object({
    id: z.string().min(1, 'Incident ID is required'),
    complaintId: z.string().min(1, 'Complaint ID or reference is required')
  }),
  query: z.object({
    remarks: z.string().optional()
  }).optional()
};

const transferComplaintSchema = {
  params: z.object({
    id: z.string().optional()
  }).optional(),
  body: z.object({
    fromIncidentId: z.string().min(1, 'Source incident ID is required').optional(),
    toIncidentId: z.string().min(1, 'Target incident ID is required'),
    complaintId: z.string().min(1, 'Complaint ID or reference is required'),
    justification: z.string().trim().min(10, 'An explicit transfer justification of at least 10 characters is required')
  })
};

const createNestedSubtaskSchema = {
  params: z.object({
    incidentId: z.string().min(1, 'Parent incident ID is required')
  }),
  body: z.object({
    title: z.string().trim().min(3, 'Subtask title must be at least 3 characters').max(200),
    department: z.string().min(2, 'Subtask department is required'),
    status: z.enum(Object.values(SUBTASK_STATUS), {
      errorMap: () => ({ message: `Invalid status. Allowed: ${Object.values(SUBTASK_STATUS).join(', ')}` })
    }).optional(),
    assignedOfficerId: z.string().nullable().optional(),
    officerId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    remarks: z.string().optional(),
    complaintId: z.string().nullable().optional()
  })
};

const listNestedSubtasksSchema = {
  params: z.object({
    incidentId: z.string().min(1, 'Parent incident ID is required')
  }),
  query: z.object({
    department: z.string().optional(),
    status: z.string().optional(),
    assignedOfficerId: z.string().optional()
  })
};

// ==========================================
// Incident Routes
// ==========================================

// Global transfer route (must precede :id route to prevent collision)
router.post(
  '/transfer-complaint',
  authenticate,
  requireRole('officer', 'admin'),
  validate(transferComplaintSchema),
  transferComplaint
);

// Incident collection
router.get('/', authenticate, validate(listIncidentsSchema), listIncidents);
router.post('/', authenticate, requireRole('officer', 'admin'), validate(createIncidentSchema), createIncident);

// Single Incident Operations
router.get('/:id', authenticate, validate(getIncidentSchema), getIncident);
router.patch(
  '/:id/status',
  authenticate,
  requireRole('officer', 'admin'),
  validate(updateIncidentStatusSchema),
  updateIncidentStatus
);

// Complaint Linkage & Transfers
router.post(
  '/:id/complaints',
  authenticate,
  requireRole('officer', 'admin'),
  validate(linkComplaintSchema),
  linkComplaint
);
router.delete(
  '/:id/complaints/:complaintId',
  authenticate,
  requireRole('officer', 'admin'),
  validate(unlinkComplaintSchema),
  unlinkComplaint
);
router.post(
  '/:id/transfer-complaint',
  authenticate,
  requireRole('officer', 'admin'),
  validate(transferComplaintSchema),
  transferComplaint
);

// Nested Subtasks under Incident
router.post(
  '/:incidentId/subtasks',
  authenticate,
  requireRole('officer', 'admin'),
  validate(createNestedSubtaskSchema),
  createSubtask
);
router.get(
  '/:incidentId/subtasks',
  authenticate,
  requireRole('officer', 'admin'),
  validate(listNestedSubtasksSchema),
  listSubtasks
);

export default router;
