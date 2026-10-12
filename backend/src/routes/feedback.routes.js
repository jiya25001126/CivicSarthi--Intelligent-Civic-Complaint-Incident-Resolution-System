import express from 'express';
import { z } from 'zod';
import {
  getMyFeedback,
  getFeedbackSummary
} from '../controllers/feedback.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

const feedbackSummarySchema = {
  query: z.object({
    departmentId: z.string().optional()
  })
};

// Citizen: view all feedback submitted by self
router.get('/my', authenticate, getMyFeedback);

// Officer & Admin: aggregate feedback metrics & rating distribution
router.get(
  '/summary',
  authenticate,
  requireRole('officer', 'admin'),
  validate(feedbackSummarySchema),
  getFeedbackSummary
);

export default router;
