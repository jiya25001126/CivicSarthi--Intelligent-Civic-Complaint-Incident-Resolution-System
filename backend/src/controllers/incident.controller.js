/**
 * @file incident.controller.js
 * @description Express controller for Phase 7 Parent Incident Management and Complaint Coordination.
 */

import incidentService from '../services/incident.service.js';

/**
 * Create a new parent incident.
 * Privileged operation: restricted to officers and administrators.
 */
export const createIncident = async (req, res, next) => {
  try {
    const incidentData = {
      title: req.body.title?.trim(),
      description: req.body.description?.trim(),
      category: req.body.category?.trim(),
      leadDepartment: req.body.leadDepartment?.trim(),
      participatingDepartments: req.body.participatingDepartments,
      priority: req.body.priority,
      status: req.body.status,
      location: req.body.location,
      linkedComplaints: req.body.linkedComplaints,
      createdBy: req.user.id
    };

    const created = await incidentService.createIncident(incidentData, req.user);

    res.status(201).json({
      success: true,
      message: 'Incident created successfully',
      data: created
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List incidents with filtering and pagination.
 * Citizens receive sanitized views; officers/admins receive full operational data.
 */
export const listIncidents = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      category: req.query.category,
      leadDepartment: req.query.leadDepartment,
      priority: req.query.priority,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit
    };

    const isCitizen = req.user?.role === 'citizen';
    const result = await incidentService.listIncidents(filters, req.user);

    if (result && result.pagination) {
      const items = isCitizen
        ? result.items.map(inc => incidentService.sanitizeForCitizen(inc))
        : result.items;

      return res.json({
        success: true,
        count: items.length,
        pagination: result.pagination,
        data: items
      });
    }

    const items = Array.isArray(result) ? result : [];
    const data = isCitizen
      ? items.map(inc => incidentService.sanitizeForCitizen(inc))
      : items;

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch incident by ID with subtask aggregation.
 * Citizens receive sanitized summary; officers/admins receive full enriched data.
 */
export const getIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isOfficer = req.user && (req.user.role === 'officer' || req.user.role === 'admin');

    const incident = await incidentService.getIncidentById(
      id,
      { includeSubtasks: true, isOfficer },
      req.user
    );

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: `Incident '${id}' not found`
      });
    }

    res.json({
      success: true,
      data: incident
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update incident status with lifecycle transition validation and subtask completion guards.
 * Privileged operation: restricted to lead department officers or administrators.
 */
export const updateIncidentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      status,
      resolutionSummary,
      overrideIncompleteSubtasks,
      overrideJustification,
      propagateToComplaints,
      complaintResolutionRemarks,
      resolutionData,
      complaintResolutions
    } = req.body;

    const updated = await incidentService.updateIncidentStatus(
      id,
      {
        status,
        resolutionSummary,
        overrideIncompleteSubtasks,
        overrideJustification,
        propagateToComplaints,
        complaintResolutionRemarks,
        resolutionData,
        complaintResolutions
      },
      req.user
    );

    let message = 'Incident status updated successfully';
    if (updated.propagationReport) {
      const rep = updated.propagationReport;
      if (rep.failedCount > 0) {
        message = 'Incident resolved, but complaint propagation encountered failures. Reconciliation is required.';
      } else if (rep.skippedCount > 0 && rep.resolvedCount > 0) {
        message = 'Incident resolved with partial complaint propagation (some complaints skipped due to lifecycle rules).';
      } else if (rep.skippedCount > 0 && rep.resolvedCount === 0) {
        message = 'Incident resolved, but linked complaints were skipped due to lifecycle rules.';
      } else if (rep.resolvedCount > 0) {
        message = 'Incident resolved and linked complaints propagated to RESOLVED successfully.';
      }
    }

    res.json({
      success: true,
      message,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Link a complaint to a parent incident.
 * Privileged operation: restricted to lead department officers, complaint department officers, or administrators.
 */
export const linkComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { complaintId, remarks } = req.body;

    const result = await incidentService.linkComplaintToIncident(
      id,
      complaintId,
      req.user,
      remarks
    );

    res.json({
      success: true,
      message: result.alreadyLinked
        ? 'Complaint is already linked to this incident'
        : 'Complaint linked to incident successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unlink a complaint from a parent incident.
 * Privileged operation: restricted to lead department officers, complaint department officers, or administrators.
 */
export const unlinkComplaint = async (req, res, next) => {
  try {
    const { id, complaintId } = req.params;
    const remarks = req.query.remarks || req.body?.remarks || '';

    const result = await incidentService.unlinkComplaintFromIncident(
      id,
      complaintId,
      req.user,
      remarks
    );

    res.json({
      success: true,
      message: result.alreadyUnlinked
        ? 'Complaint is already unlinked from this incident'
        : 'Complaint unlinked from incident successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer a complaint from one parent incident to another.
 * Privileged operation: requires authority over both incidents or administrator role.
 */
export const transferComplaint = async (req, res, next) => {
  try {
    const fromIncidentId = req.params.id || req.body.fromIncidentId;
    const { toIncidentId, complaintId, justification } = req.body;

    const result = await incidentService.transferComplaintBetweenIncidents(
      fromIncidentId,
      toIncidentId,
      complaintId,
      req.user,
      justification
    );

    res.json({
      success: true,
      message: 'Complaint transferred between incidents successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
