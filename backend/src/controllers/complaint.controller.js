import complaintService from '../services/complaint.service.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';

export const listComplaints = async (req, res, next) => {
  try {
    const filters = {
      category: req.query.category,
      departmentId: req.query.departmentId,
      department: req.query.department,
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit
    };

    // Server-Side RBAC & Scope Isolation:
    // Citizen: strictly restricted to complaints owned by their account
    // Officer: strictly restricted to complaints assigned to their authorized department
    // Admin: granted cross-department platform visibility
    if (req.user.role === 'citizen') {
      filters.citizenId = req.user.id;
    } else if (req.user.role === 'officer') {
      filters.departmentId = req.user.departmentId;
    }

    const isOfficerOrAdmin = req.user.role === 'officer' || req.user.role === 'admin';
    const result = await complaintService.getAllComplaints(filters, isOfficerOrAdmin);

    // Citizens must never receive internal notes or other citizens' private data
    if (req.user.role === 'citizen') {
      if (result && result.pagination) {
        result.items = result.items.map(c => complaintService.sanitizeForCitizen(c));
      } else if (Array.isArray(result)) {
        return res.json({
          success: true,
          count: result.length,
          data: result.map(c => complaintService.sanitizeForCitizen(c))
        });
      }
    }

    if (result && result.pagination) {
      return res.json({
        success: true,
        count: result.items.length,
        pagination: result.pagination,
        data: result.items
      });
    }

    res.json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaintStats = async (req, res, next) => {
  try {
    const stats = await complaintService.getSummaryStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isOfficerOrAdmin = req.user.role === 'officer' || req.user.role === 'admin';
    const complaint = await complaintService.getComplaintById(id, isOfficerOrAdmin);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id or reference '${id}' not found`
      });
    }

    // Role-based Ownership & Department Scope Verification:
    if (req.user.role === 'citizen') {
      // Citizen A cannot read Citizen B's complaint
      if (complaint.citizenId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: you do not have permission to view this complaint'
        });
      }
      return res.json({
        success: true,
        data: complaintService.sanitizeForCitizen(complaint)
      });
    }

    if (req.user.role === 'officer') {
      // Officer cannot read complaints belonging to other departments
      if (complaint.departmentId !== req.user.departmentId && complaint.department !== req.user.departmentId) {
        return res.status(403).json({
          success: false,
          error: `Access denied: officer is not authorized for department '${complaint.departmentId}'`
        });
      }
      return res.json({
        success: true,
        data: complaint
      });
    }

    // Admin has full access
    res.json({
      success: true,
      data: complaint
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public Tracking endpoint.
 * Returns public lifecycle information without requiring authentication while
 * guaranteeing zero exposure of confidential officer notes or private citizen contact details.
 */
export const getComplaintTracking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const trackingData = await complaintService.getComplaintForTracking(id);

    if (!trackingData) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id or reference '${id}' not found`
      });
    }

    res.json({
      success: true,
      data: trackingData
    });
  } catch (error) {
    next(error);
  }
};

export const createComplaint = async (req, res, next) => {
  try {
    const complaintData = {
      ...req.body,
      citizenId: req.user.id,
      citizenName: req.body.citizenName || req.user.name,
      citizenEmail: req.body.citizenEmail || req.user.email
    };

    const complaint = await complaintService.createComplaint(complaintData);
    const citizenSafeData = complaintService.sanitizeForCitizen(complaint);

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      referenceNumber: complaint.referenceNumber,
      data: citizenSafeData
    });
  } catch (error) {
    next(error);
  }
};

export const updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks, actorType } = req.body;

    const complaint = await complaintService.getComplaintById(id, true);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    if (req.user.role === 'officer') {
      if (complaint.departmentId !== req.user.departmentId && complaint.department !== req.user.departmentId) {
        return res.status(403).json({
          success: false,
          error: `Access denied: officer is not authorized to update status for department '${complaint.departmentId}'`
        });
      }
    }

    const updated = await complaintService.updateComplaintStatus(id, {
      status,
      remarks,
      actorType: req.user.role === 'admin' ? (actorType || 'SYSTEM') : 'OFFICER'
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    res.json({
      success: true,
      message: `Status updated to ${status}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const updateComplaintDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { departmentId, remarks, actorType } = req.body;

    // Administrative operation
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: administrative privileges required for department reassignment'
      });
    }

    const complaint = await complaintService.getComplaintById(id, true);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    const oldDept = complaint.departmentId;
    const updated = await complaintService.updateComplaintDepartment(id, {
      departmentId,
      remarks,
      actorType: actorType || 'SYSTEM'
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    // Record administrative reassignment in audit log
    try {
      await auditLogRepository.create({
        userId: req.user.id,
        userEmail: req.user.email,
        role: req.user.role,
        action: 'UPDATE_DEPARTMENT',
        targetResource: complaint.referenceNumber || complaint.id,
        details: {
          fromDepartment: oldDept,
          toDepartment: departmentId,
          remarks
        }
      });
    } catch (auditErr) {
      console.error('[Audit Log Warning] Failed to log department update:', auditErr.message);
    }

    res.json({
      success: true,
      message: `Complaint reassigned to department ${departmentId}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const addOfficerNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const complaint = await complaintService.getComplaintById(id, true);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    if (req.user.role === 'officer') {
      if (complaint.departmentId !== req.user.departmentId && complaint.department !== req.user.departmentId) {
        return res.status(403).json({
          success: false,
          error: `Access denied: officer is not authorized to add notes for department '${complaint.departmentId}'`
        });
      }
    }

    const officerId = req.body.officerId || (req.user.name ? `${req.user.name} (${req.user.id})` : req.user.id);
    const updated = await complaintService.addOfficerNote(id, {
      note,
      officerId
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    res.json({
      success: true,
      message: 'Officer review note appended successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaintHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const complaint = await complaintService.getComplaintById(id, true);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    if (req.user.role === 'citizen' && complaint.citizenId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: you do not have permission to view this complaint'
      });
    }

    if (req.user.role === 'officer' && complaint.departmentId !== req.user.departmentId && complaint.department !== req.user.departmentId) {
      return res.status(403).json({
        success: false,
        error: `Access denied: officer is not authorized for department '${complaint.departmentId}'`
      });
    }

    const history = await complaintService.getStatusHistory(id);

    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

export default {
  listComplaints,
  getComplaintStats,
  getComplaint,
  getComplaintTracking,
  createComplaint,
  updateComplaintStatus,
  updateComplaintDepartment,
  addOfficerNote,
  getComplaintHistory
};
