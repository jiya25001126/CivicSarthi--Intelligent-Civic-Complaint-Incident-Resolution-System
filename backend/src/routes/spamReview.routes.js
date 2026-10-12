import express from 'express';
import { z } from 'zod';
import {
  listFlaggedComplaints,
  getSpamReviewDetail,
  recordReviewDecision,
  getMyReputation,
  getCitizenReputationDetail
} from '../controllers/spamReview.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { SPAM_REVIEW_OUTCOMES } from '../constants/spam.constants.js';

const router = express.Router();

const listReviewsSchema = {
  query: z.object({
    departmentId: z.string().optional(),
    reviewStatus: z.string().optional(),
    riskLevel: z.string().optional(),
    citizenId: z.string().optional(),
    complaintId: z.string().optional()
  })
};

const getReviewSchema = {
  params: z.object({
    id: z.string().min(1, 'Review ID or complaint ID is required')
  })
};

const recordReviewDecisionSchema = {
  params: z.object({
    id: z.string().min(1, 'Review ID or complaint ID is required')
  }),
  body: z.object({
    outcome: z.enum(Object.values(SPAM_REVIEW_OUTCOMES)).optional(),
    decision: z.enum(Object.values(SPAM_REVIEW_OUTCOMES)).optional(),
    reason: z.string().min(10, 'A detailed review reason of at least 10 characters is required').optional(),
    decisionReason: z.string().min(10, 'A detailed review reason of at least 10 characters is required').optional()
  }).refine((d) => d.outcome || d.decision, {
    message: `Review outcome is required (${Object.values(SPAM_REVIEW_OUTCOMES).join(', ')})`
  }).refine((d) => (d.reason && d.reason.length >= 10) || (d.decisionReason && d.decisionReason.length >= 10), {
    message: 'Decision explanation of at least 10 characters is required'
  })
};

// Citizen endpoint: Check own reputation standing
router.get(
  '/reputation',
  authenticate,
  requireRole(['citizen', 'officer', 'admin']),
  getMyReputation
);

router.get(
  '/citizen/reputation',
  authenticate,
  requireRole(['citizen', 'officer', 'admin']),
  getMyReputation
);

// Officer/Admin endpoint: Review citizen reputation profile
router.get(
  '/citizens/:citizenId/reputation',
  authenticate,
  requireRole(['officer', 'admin']),
  getCitizenReputationDetail
);

router.get(
  '/citizen/:citizenId',
  authenticate,
  requireRole(['officer', 'admin']),
  getCitizenReputationDetail
);

// Officer/Admin review queue
router.get(
  '/',
  authenticate,
  requireRole(['officer', 'admin']),
  validate(listReviewsSchema),
  listFlaggedComplaints
);

// Review detail
router.get(
  '/:id',
  authenticate,
  requireRole(['officer', 'admin']),
  validate(getReviewSchema),
  getSpamReviewDetail
);

// Record human review determination
router.post(
  '/:id/decision',
  authenticate,
  requireRole(['officer', 'admin']),
  validate(recordReviewDecisionSchema),
  recordReviewDecision
);

export default router;
