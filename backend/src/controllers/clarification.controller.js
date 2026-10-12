/**
 * @file clarification.controller.js
 * @description Controller endpoints for Feature A: Citizen Clarifications & Officer Responses.
 */

import { clarificationService } from '../services/clarification.service.js';

export const createClarification = async (req, res, next) => {
  try {
    const complaintId = req.params.id || req.body.complaintId;
    const { requestType, content } = req.body;

    const record = await clarificationService.createClarification(
      complaintId,
      { requestType, content },
      req.user
    );

    res.status(201).json({
      success: true,
      message: 'Clarification request logged successfully and routed to the assigned department',
      data: record
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaintClarifications = async (req, res, next) => {
  try {
    const { id } = req.params;
    const list = await clarificationService.getClarificationsForComplaint(id, req.user);

    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    next(error);
  }
};

export const listClarifications = async (req, res, next) => {
  try {
    const filters = {
      complaintId: req.query.complaintId,
      status: req.query.status,
      requestType: req.query.requestType,
      departmentId: req.query.departmentId
    };

    const list = await clarificationService.listClarifications(filters, req.user);

    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    next(error);
  }
};

export const getClarificationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await clarificationService.getClarificationById(id, req.user);

    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

export const respondToClarification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { response } = req.body;

    const updated = await clarificationService.respondToClarification(
      id,
      { response },
      req.user
    );

    res.json({
      success: true,
      message: 'Officer response recorded and published to the citizen thread',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const closeClarification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const updated = await clarificationService.closeClarification(
      id,
      { reason },
      req.user
    );

    res.json({
      success: true,
      message: 'Clarification thread closed',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createClarification,
  getComplaintClarifications,
  listClarifications,
  getClarificationById,
  respondToClarification,
  closeClarification
};
