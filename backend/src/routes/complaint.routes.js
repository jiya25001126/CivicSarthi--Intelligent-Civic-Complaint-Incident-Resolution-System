import express from 'express';
import { z } from 'zod';
import { listComplaints, getComplaint } from '../controllers/complaint.controller.js';
import { validate } from '../middleware/validate.middleware.js';

const router = express.Router();

const listComplaintsSchema = {
  query: z.object({
    category: z.string().optional(),
    department: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional()
  })
};

const getComplaintSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  })
};

router.get('/', validate(listComplaintsSchema), listComplaints);
router.get('/:id', validate(getComplaintSchema), getComplaint);

export default router;
