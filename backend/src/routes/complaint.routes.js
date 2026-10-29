import express from 'express';
import { z } from 'zod';
import {
  listComplaints,
  listMyComplaints,
  getComplaintStats,
  getComplaint,
  createComplaint,
  updateComplaintStatus,
  updateComplaintDepartment,
  addOfficerNote,
  getComplaintHistory,
  getComplaintTracking,
  analyzeGrievancePreview,
  getComplaintIntelligence,
  getComplaintDuplicates,
  updateComplaintPriority,
  linkDuplicateComplaint,
  uploadComplaintAttachment,
  getComplaintAttachment
} from '../controllers/complaint.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  authenticate,
  requireRole,
  trackingRateLimiter,
  submissionRateLimiter
} from '../middleware/auth.middleware.js';
import { COMPLAINT_STATUS, COMPLAINT_PRIORITY } from '../constants/status.constants.js';
import { APPEAL_REASONS, REOPENING_REASONS } from '../constants/feedback.constants.js';
import { submitFeedback, getComplaintFeedback } from '../controllers/feedback.controller.js';
import { createAppeal } from '../controllers/appeal.controller.js';
import { createReopeningRequest } from '../controllers/reopening.controller.js';
import { createClarification, getComplaintClarifications } from '../controllers/clarification.controller.js';
import { requestReminder, checkReminderEligibility, getComplaintReminders } from '../controllers/reminder.controller.js';
import { getStatusExplanation } from '../controllers/statusTranslator.controller.js';
import { CLARIFICATION_TYPE } from '../constants/clarification.constants.js';

const router = express.Router();

const listComplaintsSchema = {
  query: z.object({
    category: z.string().optional(),
    departmentId: z.string().optional(),
    department: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    search: z.string().optional(),
    sort: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional()
  })
};

const getComplaintSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID or reference number is required')
  })
};

const getComplaintByRefSchema = {
  params: z.object({
    reference: z.string().min(1, 'Tracking reference is required')
  })
};

const createComplaintSchema = {
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
    description: z.string().trim().min(10, 'Description must be at least 10 characters').max(3000, 'Description cannot exceed 3000 characters'),
    category: z.string().min(2, 'Category is required'),
    state: z.string().min(2, 'State is required'),
    district: z.string().min(2, 'District is required'),
    locality: z.string().max(300, 'Locality cannot exceed 300 characters').optional(),
    preferredLanguage: z.string().max(20).optional(),
    departmentId: z.string().optional(),
    evidence: z.array(
      z.string()
        .max(255)
        .regex(/^[\w\-.\s]{1,255}$/, 'Evidence must be a safe filename or identifier without directory traversal')
    ).max(10, 'Maximum 10 attachments allowed').optional(),
    citizenName: z.string().max(100).optional(),
    citizenEmail: z.string().email().optional(),
    citizenPhone: z.string().max(20).optional(),
    idempotencyKey: z.string().max(100).optional()
  })
};

const uploadAttachmentSchema = {
  body: z.object({
    filename: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(100),
    base64Data: z.string().min(1, 'Image data is required').optional(),
    data: z.string().min(1, 'Image data is required').optional()
  }).refine((d) => d.base64Data || d.data, {
    message: 'Image data payload is required'
  })
};

const updateStatusSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  }),
  body: z.object({
    status: z.enum(Object.values(COMPLAINT_STATUS), {
      errorMap: () => ({ message: `Invalid status. Must be one of: ${Object.values(COMPLAINT_STATUS).join(', ')}` })
    }),
    remarks: z.string().optional(),
    actorType: z.enum(['OFFICER', 'CITIZEN', 'SYSTEM']).optional()
  }).passthrough()
};

const updateDepartmentSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  }),
  body: z.object({
    departmentId: z.string().min(1, 'Target departmentId is required'),
    remarks: z.string().optional(),
    actorType: z.string().optional()
  })
};

const addNoteSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  }),
  body: z.object({
    note: z.string().min(1, 'Officer note cannot be empty').max(2000, 'Note too long'),
    officerId: z.string().optional()
  })
};

const analyzeSchema = {
  body: z.object({
    title: z.string().max(200).optional(),
    description: z.string().max(3000).optional(),
    category: z.string().optional(),
    state: z.string().optional(),
    district: z.string().optional(),
    locality: z.string().optional()
  })
};

const updatePrioritySchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  }),
  body: z.object({
    priority: z.enum(Object.values(COMPLAINT_PRIORITY), {
      errorMap: () => ({ message: `Invalid priority. Must be one of: ${Object.values(COMPLAINT_PRIORITY).join(', ')}` })
    }),
    remarks: z.string().optional()
  })
};

const linkDuplicateSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  }),
  body: z.object({
    duplicateOf: z.string().optional(),
    duplicateOfId: z.string().optional(),
    remarks: z.string().optional()
  }).refine(data => Boolean(data.duplicateOf || data.duplicateOfId), {
    message: 'Target duplicate reference number or ID is required'
  })
};
const submitFeedbackSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comments: z.string().max(2000).optional()
  })
};

const createAppealNestedSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  }),
  body: z.object({
    reasonCategory: z.enum(Object.values(APPEAL_REASONS), {
      errorMap: () => ({ message: `Invalid reasonCategory. Allowed: ${Object.values(APPEAL_REASONS).join(', ')}` })
    }),
    explanation: z.string().trim().optional(),
    citizenExplanation: z.string().trim().optional(),
    evidence: z.array(z.string()).optional(),
    supportingEvidence: z.array(z.string()).optional()
  }).refine(d => (d.explanation && d.explanation.length >= 10) || (d.citizenExplanation && d.citizenExplanation.length >= 10), {
    message: 'Appeal explanation must be at least 10 characters'
  })
};

const createReopeningNestedSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  }),
  body: z.object({
    reasonCategory: z.enum(Object.values(REOPENING_REASONS), {
      errorMap: () => ({ message: `Invalid reasonCategory. Allowed: ${Object.values(REOPENING_REASONS).join(', ')}` })
    }),
    explanation: z.string().trim().optional(),
    citizenExplanation: z.string().trim().optional(),
    evidence: z.array(z.string()).optional(),
    supportingEvidence: z.array(z.string()).optional()
  }).refine(d => (d.explanation && d.explanation.length >= 10) || (d.citizenExplanation && d.citizenExplanation.length >= 10), {
    message: 'Reopening explanation must be at least 10 characters'
  })
};

const createClarificationNestedSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  }),
  body: z.object({
    requestType: z.enum(Object.values(CLARIFICATION_TYPE)).optional(),
    content: z
      .string()
      .trim()
      .min(5, 'Clarification content must be at least 5 characters')
      .max(2000, 'Clarification content cannot exceed 2000 characters')
  })
};

// ==========================================
// Public Endpoints (No authentication required)
// ==========================================
router.get('/stats', getComplaintStats);
router.get('/track/:reference/status-explanation', trackingRateLimiter, getStatusExplanation);
router.get('/track/:reference', trackingRateLimiter, validate(getComplaintByRefSchema), getComplaintTracking);
router.get('/:id/status-explanation', trackingRateLimiter, getStatusExplanation);
router.get('/:id/track', trackingRateLimiter, validate(getComplaintSchema), getComplaintTracking);
router.post('/analyze', submissionRateLimiter, validate(analyzeSchema), analyzeGrievancePreview);

// ==========================================
// Protected Endpoints (Authentication strictly required)
// NOTE: Static routes (/my, /upload, /attachments) must precede dynamic param routes (/:id)
// ==========================================
router.get('/my', authenticate, validate(listComplaintsSchema), listMyComplaints);
router.post('/upload', authenticate, submissionRateLimiter, validate(uploadAttachmentSchema), uploadComplaintAttachment);
router.get('/attachments/:filename', authenticate, getComplaintAttachment);
router.get('/', authenticate, validate(listComplaintsSchema), listComplaints);
router.get('/:id', authenticate, validate(getComplaintSchema), getComplaint);
router.get('/:id/intelligence', authenticate, validate(getComplaintSchema), getComplaintIntelligence);
router.get('/:id/duplicates', authenticate, validate(getComplaintSchema), getComplaintDuplicates);
router.post('/', authenticate, submissionRateLimiter, validate(createComplaintSchema), createComplaint);
router.patch('/:id/status', authenticate, requireRole('officer', 'admin'), validate(updateStatusSchema), updateComplaintStatus);
router.patch('/:id/priority', authenticate, requireRole('officer', 'admin'), validate(updatePrioritySchema), updateComplaintPriority);
router.patch('/:id/duplicate', authenticate, requireRole('officer', 'admin'), validate(linkDuplicateSchema), linkDuplicateComplaint);
router.patch('/:id/department', authenticate, requireRole('admin'), validate(updateDepartmentSchema), updateComplaintDepartment);
router.get('/:id/history', authenticate, validate(getComplaintSchema), getComplaintHistory);
router.post('/:id/notes', authenticate, requireRole('officer', 'admin'), validate(addNoteSchema), addOfficerNote);

// Phase 10: Nested Feedback, Appeal, and Reopening Endpoints
router.post('/:id/feedback', authenticate, validate(submitFeedbackSchema), submitFeedback);
router.get('/:id/feedback', authenticate, validate(getComplaintSchema), getComplaintFeedback);
router.post('/:id/appeals', authenticate, validate(createAppealNestedSchema), createAppeal);
router.post('/:id/reopening-requests', authenticate, validate(createReopeningNestedSchema), createReopeningRequest);

// Phase 12: Citizen Clarification & Reminder Endpoints
router.post('/:id/clarifications', authenticate, requireRole('citizen'), validate(createClarificationNestedSchema), createClarification);
router.get('/:id/clarifications', authenticate, validate(getComplaintSchema), getComplaintClarifications);
router.post('/:id/reminders', authenticate, requireRole('citizen'), validate(getComplaintSchema), requestReminder);
router.get('/:id/reminders/eligibility', authenticate, validate(getComplaintSchema), checkReminderEligibility);
router.get('/:id/reminders', authenticate, validate(getComplaintSchema), getComplaintReminders);

export default router;
