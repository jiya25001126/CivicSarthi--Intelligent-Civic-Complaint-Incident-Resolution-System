/**
 * @file subtask.routes.js
 * @description Express routes and validation schemas for Multi-Department Subtasks.
 */

import express from 'express';
import { z } from 'zod';
import {
  createSubtask,
  listSubtasks,
  getSubtask,
  updateSubtaskStatus,
  updateSubtask
} from '../controllers/subtask.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { SUBTASK_STATUS } from '../constants/incident.constants.js';

const router = express.Router();

const listSubtasksSchema = {
  query: z.object({
    incidentId: z.string().optional(),
    department: z.string().optional(),
    status: z.string().optional(),
    assignedOfficerId: z.string().optional()
  })
};

const getSubtaskSchema = {
  params: z.object({
    id: z.string().min(1, 'Subtask ID is required')
  })
};

const createSubtaskSchema = {
  body: z.object({
    incidentId: z.string().min(1, 'Parent incident ID is required').optional(),
    title: z.string().trim().min(3, 'Subtask title must be at least 3 characters').max(200, 'Subtask title cannot exceed 200 characters'),
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

const updateSubtaskStatusSchema = {
  params: z.object({
    id: z.string().min(1, 'Subtask ID is required')
  }),
  body: z.object({
    status: z.enum(Object.values(SUBTASK_STATUS), {
      errorMap: () => ({ message: `Invalid status. Allowed: ${Object.values(SUBTASK_STATUS).join(', ')}` })
    }),
    remarks: z.string().optional()
  })
};

const updateSubtaskSchema = {
  params: z.object({
    id: z.string().min(1, 'Subtask ID is required')
  }),
  body: z.object({
    title: z.string().trim().min(3, 'Subtask title must be at least 3 characters').max(200).optional(),
    status: z.enum(Object.values(SUBTASK_STATUS)).optional(),
    assignedOfficerId: z.string().nullable().optional(),
    officerId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    remarks: z.string().optional()
  })
};

// All subtask endpoints require officer or administrator authorization
router.get('/', authenticate, requireRole('officer', 'admin'), validate(listSubtasksSchema), listSubtasks);
router.post('/', authenticate, requireRole('officer', 'admin'), validate(createSubtaskSchema), createSubtask);
router.get('/:id', authenticate, requireRole('officer', 'admin'), validate(getSubtaskSchema), getSubtask);
router.patch('/:id/status', authenticate, requireRole('officer', 'admin'), validate(updateSubtaskStatusSchema), updateSubtaskStatus);
router.patch('/:id', authenticate, requireRole('officer', 'admin'), validate(updateSubtaskSchema), updateSubtask);

export default router;
