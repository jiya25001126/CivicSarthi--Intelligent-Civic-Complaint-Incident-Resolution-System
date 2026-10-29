/**
 * @file historicalResolution.controller.js
 * @description Controller endpoint for Historical Resolution Suggestions (Feature C).
 */

import { historicalResolutionService } from '../services/historicalResolution.service.js';

export async function getHistoricalSuggestions(req, res, next) {
  try {
    const complaintId = req.params.id;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
    const threshold = req.query.threshold ? parseFloat(req.query.threshold) : 0.25;

    const result = await historicalResolutionService.getSuggestions(complaintId, req.user, {
      limit,
      threshold
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

