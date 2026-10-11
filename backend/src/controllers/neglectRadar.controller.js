/**
 * @file neglectRadar.controller.js
 * @description Express controller for CivicSarthi Phase 8: Neglect Radar supervisory triage.
 */

import neglectRadarService from '../services/neglectRadar.service.js';

/**
 * Evaluates and lists neglect radar items with filtering, summary metrics, and pagination.
 * Privileged operation: restricted to officers and administrators.
 */
export const getNeglectRadar = async (req, res, next) => {
  try {
    const filters = {
      entityType: req.query.entityType,
      riskLevel: req.query.riskLevel,
      departmentId: req.query.departmentId,
      search: req.query.search,
      signalCode: req.query.signalCode,
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      includeTerminal: req.query.includeTerminal === 'true' || req.query.includeTerminal === true
    };

    const result = await neglectRadarService.getNeglectRadar(filters, req.user);

    res.status(200).json({
      success: true,
      message: 'Neglect radar evaluation completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single evaluated neglect radar item with department authorization and privacy projection.
 * Privileged operation: restricted to officers and administrators.
 */
export const getNeglectRadarItem = async (req, res, next) => {
  try {
    const { entityType, id } = req.params;

    const result = await neglectRadarService.getNeglectRadarItem(entityType, id, req.user);

    res.status(200).json({
      success: true,
      message: 'Neglect radar item retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getNeglectRadar,
  getNeglectRadarItem
};
