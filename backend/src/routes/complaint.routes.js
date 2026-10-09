import express from 'express';
import { z } from 'zod';
import {
  listComplaints,
  getComplaintStats,
  getComplaint,
  createComplaint,
  updateComplaintStatus,
  updateComplaintDepartment,
  addOfficerNote,
  getComplaintHistory
} from '../controllers/complaint.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { COMPLAINT_STATUS } from '../constants/status.constants.js';

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

const createComplaintSchema = {
  body: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
    description: z.string().min(10, 'Description must be at least 10 characters').max(3000, 'Description cannot exceed 3000 characters'),
    category: z.string().min(2, 'Category is required'),
    state: z.string().min(2, 'State is required'),
    district: z.string().min(2, 'District is required'),
    locality: z.string().optional(),
    preferredLanguage: z.string().optional(),
    departmentId: z.string().optional(),
    evidence: z.array(z.string()).optional()
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
  })
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

// Route endpoints
router.get('/', validate(listComplaintsSchema), listComplaints);
router.get('/stats', getComplaintStats);
router.get('/:id', validate(getComplaintSchema), getComplaint);
router.post('/', validate(createComplaintSchema), createComplaint);
router.patch('/:id/status', validate(updateStatusSchema), updateComplaintStatus);
router.patch('/:id/department', validate(updateDepartmentSchema), updateComplaintDepartment);
router.get('/:id/history', validate(getComplaintSchema), getComplaintHistory);
router.post('/:id/notes', validate(addNoteSchema), addOfficerNote);

export default router;
