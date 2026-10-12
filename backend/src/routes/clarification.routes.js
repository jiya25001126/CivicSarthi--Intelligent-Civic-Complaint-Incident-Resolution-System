import express from 'express';
import { z } from 'zod';
import {
  createClarification,
  getComplaintClarifications,
  listClarifications,
  getClarificationById,
  respondToClarification,
  closeClarification
} from '../controllers/clarification.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { CLARIFICATION_TYPE, CLARIFICATION_STATUS } from '../constants/clarification.constants.js';

const router = express.Router();

const createClarificationSchema = {
  body: z.object({
    complaintId: z.string().optional(),
    requestType: z.enum(Object.values(CLARIFICATION_TYPE)).optional(),
    content: z
      .string()
      .trim()
      .min(5, 'Clarification content must be at least 5 characters')
      .max(2000, 'Clarification content cannot exceed 2000 characters')
  })
};

const respondClarificationSchema = {
  params: z.object({
    id: z.string().min(1, 'Clarification ID is required')
  }),
  body: z.object({
    response: z
      .string()
      .trim()
      .min(5, 'Officer response must be at least 5 characters')
      .max(2000, 'Officer response cannot exceed 2000 characters')
  })
};

const closeClarificationSchema = {
  params: z.object({
    id: z.string().min(1, 'Clarification ID is required')
  }),
  body: z.object({
    reason: z.string().trim().max(500).optional()
  })
};

const getClarificationSchema = {
  params: z.object({
    id: z.string().min(1, 'Clarification ID is required')
  })
};

const listClarificationsSchema = {
  query: z.object({
    complaintId: z.string().optional(),
    status: z.enum(Object.values(CLARIFICATION_STATUS)).optional(),
    requestType: z.enum(Object.values(CLARIFICATION_TYPE)).optional(),
    departmentId: z.string().optional()
  })
};

// List clarification requests (scoped by user role: citizen gets own, officer gets dept, admin gets all)
router.get('/', authenticate, validate(listClarificationsSchema), listClarifications);

// Create clarification from top-level endpoint (with complaintId in body)
router.post('/', authenticate, requireRole('citizen'), validate(createClarificationSchema), createClarification);

// Get single clarification request
router.get('/:id', authenticate, validate(getClarificationSchema), getClarificationById);

// Officer responds to citizen clarification
router.post(
  '/:id/respond',
  authenticate,
  requireRole(['officer', 'admin']),
  validate(respondClarificationSchema),
  respondToClarification
);

// Close clarification thread
router.post('/:id/close', authenticate, validate(closeClarificationSchema), closeClarification);
router.patch('/:id/close', authenticate, validate(closeClarificationSchema), closeClarification);

export default router;
