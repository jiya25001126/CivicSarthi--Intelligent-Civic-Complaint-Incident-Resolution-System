import express from 'express';
import { z } from 'zod';
import {
  getMyAppeals,
  listAppeals,
  getAppealById,
  getAppealTracking,
  updateAppealStatus,
  addAppealNote,
  recordAppealDecision
} from '../controllers/appeal.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { APPEAL_STATUS } from '../constants/feedback.constants.js';

const router = express.Router();

const listAppealsSchema = {
  query: z.object({
    complaintId: z.string().optional(),
    departmentId: z.string().optional(),
    status: z.string().optional()
  })
};

const getAppealSchema = {
  params: z.object({
    appealId: z.string().min(1, 'Appeal ID or reference is required')
  })
};

const trackingSchema = {
  params: z.object({
    reference: z.string().min(1, 'Appeal reference is required')
  })
};

const updateStatusSchema = {
  params: z.object({
    appealId: z.string().min(1, 'Appeal ID is required')
  }),
  body: z.object({
    status: z.enum(Object.values(APPEAL_STATUS)),
    remarks: z.string().optional()
  })
};

const addNoteSchema = {
  params: z.object({
    appealId: z.string().min(1, 'Appeal ID is required')
  }),
  body: z.object({
    note: z.string().min(1, 'Note cannot be empty').max(2000, 'Note too long')
  })
};

const recordDecisionSchema = {
  params: z.object({
    appealId: z.string().min(1, 'Appeal ID is required')
  }),
  body: z.object({
    outcome: z.enum(['UPHELD', 'REJECTED']).optional(),
    decision: z.enum(['UPHELD', 'REJECTED']).optional(),
    reason: z.string().min(10, 'A detailed reason of at least 10 characters is required').optional(),
    decisionReason: z.string().min(10, 'A detailed reason of at least 10 characters is required').optional(),
    citizenExplanation: z.string().optional()
  }).refine(d => d.outcome || d.decision, { message: "Verdict outcome ('UPHELD' or 'REJECTED') is required" })
    .refine(d => (d.reason && d.reason.length >= 10) || (d.decisionReason && d.decisionReason.length >= 10), { message: "Decision reason of at least 10 characters is required" })
};

// ==========================================
// Public Tracking Endpoint
// ==========================================
router.get('/track/:reference', validate(trackingSchema), getAppealTracking);

// ==========================================
// Protected Endpoints
// ==========================================
// Citizen: List own appeals
router.get('/my', authenticate, getMyAppeals);

// Officer & Admin: Appeal Review Desk
router.get('/', authenticate, requireRole('officer', 'admin'), validate(listAppealsSchema), listAppeals);
router.get('/:appealId', authenticate, validate(getAppealSchema), getAppealById);

// Officer & Admin: Review Actions
router.patch(
  '/:appealId/status',
  authenticate,
  requireRole('officer', 'admin'),
  validate(updateStatusSchema),
  updateAppealStatus
);
router.post(
  '/:appealId/notes',
  authenticate,
  requireRole('officer', 'admin'),
  validate(addNoteSchema),
  addAppealNote
);
router.post(
  '/:appealId/decision',
  authenticate,
  requireRole('officer', 'admin'),
  validate(recordDecisionSchema),
  recordAppealDecision
);

export default router;
