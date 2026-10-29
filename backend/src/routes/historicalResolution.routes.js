/**
 * @file historicalResolution.routes.js
 * @description Routes for Historical Resolution Suggestions (Feature C).
 */

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { getHistoricalSuggestions } from '../controllers/historicalResolution.controller.js';

const router = express.Router({ mergeParams: true });

// Strictly authorized for departmental officers and system administrators
router.get('/:id/historical-resolutions', authenticate, requireRole('officer', 'admin'), getHistoricalSuggestions);
router.get('/:id/suggestions', authenticate, requireRole('officer', 'admin'), getHistoricalSuggestions);

export default router;
