/**
 * @file subtask.controller.js
 * @description Express controller for Phase 7 Multi-Department Subtask Coordination.
 */

import incidentService from '../services/incident.service.js';

/**
 * Create a new subtask attached to a parent incident.
 * Privileged operation: restricted to lead department officers, assigned subtask department officers, or administrators.
 */
export const createSubtask = async (req, res, next) => {
  try {
    const incidentId = req.params.incidentId || req.body.incidentId;
    const subtaskData = {
      ...req.body,
      incidentId
    };

    const created = await incidentService.createSubtask(subtaskData, req.user);

    res.status(201).json({
      success: true,
      message: 'Subtask created successfully',
      data: created
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List subtasks by incident and supported query filters.
 * Privileged operation: restricted to officers and administrators.
 */
export const listSubtasks = async (req, res, next) => {
  try {
    const incidentId = req.params.incidentId || req.query.incidentId;
    const filters = {
      ...(incidentId ? { incidentId } : {}),
      ...(req.query.department ? { department: req.query.department } : {}),
      ...(req.query.status ? { status: req.query.status } : {}),
      ...(req.query.assignedOfficerId ? { assignedOfficerId: req.query.assignedOfficerId } : {})
    };

    const subtasks = await incidentService.listSubtasks(filters, req.user);

    res.json({
      success: true,
      count: subtasks.length,
      data: subtasks
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch a single subtask by ID.
 * Privileged operation: restricted to officers and administrators.
 */
export const getSubtask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subtask = await incidentService.getSubtaskById(id, req.user);

    if (!subtask) {
      return res.status(404).json({
        success: false,
        error: `Subtask '${id}' not found`
      });
    }

    res.json({
      success: true,
      data: subtask
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update subtask status with lifecycle transition validation.
 * Privileged operation: restricted to assigned department officers, parent incident lead department officers, or administrators.
 */
export const updateSubtaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const updated = await incidentService.updateSubtaskStatus(
      id,
      { status, remarks },
      req.user
    );

    res.json({
      success: true,
      message: 'Subtask status updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * General update of subtask properties.
 * Privileged operation: restricted to assigned department officers, parent incident lead department officers, or administrators.
 */
export const updateSubtask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await incidentService.updateSubtask(id, req.body, req.user);

    res.json({
      success: true,
      message: 'Subtask updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};
