import express from 'express';
import { provisionUser, listUsers, listAuditLogs } from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// All administrative routes strictly enforce admin role
router.use(authenticate, requireRole('admin'));

router.post('/users', provisionUser);
router.get('/users', listUsers);
router.get('/audit-logs', listAuditLogs);

export default router;
