import express from 'express';
import { z } from 'zod';
import {
  requestReminder,
  checkReminderEligibility,
  getComplaintReminders,
  listReminders
} from '../controllers/reminder.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

const listRemindersSchema = {
  query: z.object({
    complaintId: z.string().optional(),
    departmentId: z.string().optional(),
    status: z.string().optional()
  })
};

const reminderComplaintSchema = {
  params: z.object({
    id: z.string().min(1, 'Complaint ID is required')
  })
};

const topLevelReminderSchema = {
  body: z.object({
    complaintId: z.string().min(1, 'Complaint ID is required')
  })
};

// List reminders (scoped: citizen gets own, officer gets dept, admin gets all)
router.get('/', authenticate, validate(listRemindersSchema), listReminders);

// Top-level request reminder (complaintId in body)
router.post('/', authenticate, requireRole('citizen'), validate(topLevelReminderSchema), requestReminder);

export default router;
