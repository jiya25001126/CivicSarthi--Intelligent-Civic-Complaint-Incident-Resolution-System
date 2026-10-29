/**
 * @file notification.routes.js
 * @description API routes for notification delivery logs and citizen consent preferences.
 */

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import {
  getNotificationLogs,
  getPreferences,
  updatePreferences,
  processDeliveryReceiptWebhook
} from '../controllers/notification.controller.js';

const router = express.Router();

// Citizen preferences routes (authenticated citizens, officers, admins)
router.get('/preferences', authenticate, getPreferences);
router.put('/preferences', authenticate, updatePreferences);

// Delivery logs (officers, admins, or citizen reading own logs)
router.get('/logs', authenticate, getNotificationLogs);

// Provider delivery receipt webhook (public callback from carrier gateway)
router.post('/webhook/delivery-receipt', processDeliveryReceiptWebhook);

export default router;
