import express from 'express';
import { z } from 'zod';
import {
  getMyReopeningRequests,
  listReopeningRequests,
  getReopeningRequestById,
  recordReopeningDecision
} from '../controllers/reopening.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

const listReopeningSchema = {
  query: z.object({
    complaintId: z.string().optional(),
    departmentId: z.string().optional(),
    status: z.string().optional()
  })
};

const getReopeningSchema = {
  params: z.object({
    requestId: z.string().min(1, 'Request ID or reference is required')
  })
};

const recordDecisionSchema = {
  params: z.object({
    requestId: z.string().min(1, 'Request ID is required')
  }),
  body: z.object({
    outcome: z.enum(['APPROVED', 'REJECTED']).optional(),
    decision: z.enum(['APPROVED', 'REJECTED']).optional(),
    reason: z.string().min(10, 'A detailed reason of at least 10 characters is required').optional(),
    decisionReason: z.string().min(10, 'A detailed reason of at least 10 characters is required').optional()
  }).refine(d => d.outcome || d.decision, { message: "Decision outcome ('APPROVED' or 'REJECTED') is required" })
    .refine(d => (d.reason && d.reason.length >= 10) || (d.decisionReason && d.decisionReason.length >= 10), { message: "Decision reason of at least 10 characters is required" })
};

// Citizen: List own reopening requests
router.get('/my', authenticate, getMyReopeningRequests);

// Officer & Admin: Reopening Review Desk
router.get(
  '/',
  authenticate,
  requireRole('officer', 'admin'),
  validate(listReopeningSchema),
  listReopeningRequests
);
router.get(
  '/:requestId',
  authenticate,
  validate(getReopeningSchema),
  getReopeningRequestById
);

// Officer & Admin: Record Reopening Decision (Approve or Reject)
router.post(
  '/:requestId/decision',
  authenticate,
  requireRole('officer', 'admin'),
  validate(recordDecisionSchema),
  recordReopeningDecision
);

export default router;
