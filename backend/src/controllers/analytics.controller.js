/**
 * @file analytics.controller.js
 * @description HTTP controllers for CivicSarthi Phase 13 Analytics & Reporting endpoints.
 */

import { analyticsService } from '../services/analytics.service.js';

export const getOverview = async (req, res, next) => {
  try {
    const data = await analyticsService.getOverview(req.query, req.user);
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getTimeSeriesTrends = async (req, res, next) => {
  try {
    const data = await analyticsService.getTimeSeriesTrends(req.query, req.user);
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentPerformance = async (req, res, next) => {
  try {
    const data = await analyticsService.getDepartmentPerformance(req.query, req.user);
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getCategoryAndGeography = async (req, res, next) => {
  try {
    const data = await analyticsService.getCategoryAndGeography(req.query, req.user);
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getWorkflowAndQuality = async (req, res, next) => {
  try {
    const data = await analyticsService.getWorkflowAndQuality(req.query, req.user);
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const exportReport = async (req, res, next) => {
  try {
    const filters = { ...req.query, ...req.body };
    const result = await analyticsService.exportReport(filters, req.user, req);

    res.setHeader('Content-Type', result.contentType || 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.csvData);
  } catch (err) {
    next(err);
  }
};
