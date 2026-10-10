import complaintService from '../services/complaint.service.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import complaintRepository from '../repositories/complaint.repository.js';
import aiIntelligenceService from '../services/aiIntelligence.service.js';

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

// In-memory idempotency cache for duplicate submission prevention (10-minute TTL)
const idempotencyCache = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of idempotencyCache.entries()) {
    if (now > item.expiresAt) {
      idempotencyCache.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * List complaints owned exclusively by the authenticated citizen (or caller)
 */
export const listMyComplaints = async (req, res, next) => {
  try {
    const filters = {
      category: req.query.category,
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      citizenId: req.user.id
    };

    const result = await complaintService.getAllComplaints(filters, false);

    if (result && result.pagination) {
      return res.json({
        success: true,
        count: result.items.length,
        pagination: result.pagination,
        data: result.items.map(c => complaintService.sanitizeForCitizen(c))
      });
    }

    const items = Array.isArray(result) ? result : [];
    res.json({
      success: true,
      count: items.length,
      data: items.map(c => complaintService.sanitizeForCitizen(c))
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
    const target = req.params.reference || req.params.id;
    const trackingData = await complaintService.getComplaintForTracking(target);

    if (!trackingData) {
      return res.status(404).json({
        success: false,
        error: `Complaint with reference '${target}' not found`
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
    // Check idempotency key if supplied
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
    if (idempotencyKey) {
      const cacheKey = `${req.user.id}:${idempotencyKey}`;
      const cached = idempotencyCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return res.status(201).json(cached.response);
      }
    }

    // Role check: officers cannot submit citizen grievances through this endpoint
    if (req.user.role === 'officer') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: officers cannot submit citizen grievances through this endpoint'
      });
    }

    // Server-controlled identity and sanitized input fields
    const complaintData = {
      title: req.body.title?.trim(),
      description: req.body.description?.trim(),
      text: req.body.description?.trim(),
      category: req.body.category,
      state: req.body.state,
      district: req.body.district,
      locality: req.body.locality ? req.body.locality.trim() : '',
      preferredLanguage: req.body.preferredLanguage || 'en',
      departmentId: req.body.departmentId,
      evidence: Array.isArray(req.body.evidence) ? req.body.evidence : [],
      citizenId: req.user.id,
      citizenName: req.body.citizenName || req.user.name,
      citizenEmail: req.body.citizenEmail || req.user.email,
      citizenPhone: req.body.citizenPhone || undefined
    };

    const complaint = await complaintService.createComplaint(complaintData);
    const citizenSafeData = complaintService.sanitizeForCitizen(complaint);

    const responsePayload = {
      success: true,
      message: 'Complaint submitted successfully',
      referenceNumber: complaint.referenceNumber,
      data: citizenSafeData
    };

    if (idempotencyKey) {
      const cacheKey = `${req.user.id}:${idempotencyKey}`;
      idempotencyCache.set(cacheKey, {
        response: responsePayload,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes TTL
      });
    }

    res.status(201).json(responsePayload);
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

/**
 * Analyze grievance text in real-time before or during submission.
 * Returns classification recommendations, priority assessment, and sanitized duplicate warnings.
 */
export const analyzeGrievancePreview = async (req, res, next) => {
  try {
    const { title, description, category, district, locality } = req.body;

    const existingResult = await complaintRepository.findAll();
    const existingList = Array.isArray(existingResult) ? existingResult : (existingResult?.items || []);

    const analysis = aiIntelligenceService.evaluateIntelligence(
      { title, description, category, district, locality },
      existingList
    );

    // If caller is citizen or unauthenticated, sanitize duplicate candidate summaries
    const isOfficerOrAdmin = req.user && (req.user.role === 'officer' || req.user.role === 'admin');
    const duplicates = isOfficerOrAdmin
      ? analysis.duplicates
      : aiIntelligenceService.sanitizeDuplicatesForCitizen(analysis.duplicates);

    res.json({
      success: true,
      data: {
        classification: analysis.classification,
        priorityRecommendation: analysis.priorityRecommendation,
        duplicates,
        potentialDuplicates: duplicates,
        summary: analysis.summary
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve intelligence analysis for an existing complaint.
 * Role-scoped: citizen can only view their own complaint's sanitized intelligence;
 * officers can only view complaints in their department.
 */
export const getComplaintIntelligence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isOfficerOrAdmin = req.user.role === 'officer' || req.user.role === 'admin';
    const complaint = await complaintService.getComplaintById(id, isOfficerOrAdmin);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    if (req.user.role === 'citizen') {
      if (complaint.citizenId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: you do not have permission to view this complaint'
        });
      }
      const intelligence = await complaintService.getComplaintIntelligence(id);
      return res.json({
        success: true,
        data: {
          classification: intelligence.classification,
          priorityRecommendation: intelligence.priorityRecommendation,
          duplicates: aiIntelligenceService.sanitizeDuplicatesForCitizen(intelligence.duplicates),
          summary: intelligence.summary
        }
      });
    }

    if (req.user.role === 'officer') {
      if (complaint.departmentId !== req.user.departmentId && complaint.department !== req.user.departmentId) {
        return res.status(403).json({
          success: false,
          error: `Access denied: officer is not authorized for department '${complaint.departmentId}'`
        });
      }
    }

    const intelligence = await complaintService.getComplaintIntelligence(id);
    res.json({
      success: true,
      data: intelligence
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve potential duplicate grievances for a specific complaint.
 */
export const getComplaintDuplicates = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isOfficerOrAdmin = req.user.role === 'officer' || req.user.role === 'admin';
    const complaint = await complaintService.getComplaintById(id, isOfficerOrAdmin);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    if (req.user.role === 'citizen') {
      if (complaint.citizenId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: you do not have permission to view this complaint'
        });
      }
      const duplicates = await complaintService.getComplaintDuplicates(id);
      return res.json({
        success: true,
        count: duplicates.length,
        data: aiIntelligenceService.sanitizeDuplicatesForCitizen(duplicates)
      });
    }

    if (req.user.role === 'officer') {
      if (complaint.departmentId !== req.user.departmentId && complaint.department !== req.user.departmentId) {
        return res.status(403).json({
          success: false,
          error: `Access denied: officer is not authorized for department '${complaint.departmentId}'`
        });
      }
    }

    const duplicates = await complaintService.getComplaintDuplicates(id);
    res.json({
      success: true,
      count: duplicates.length,
      data: duplicates
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update complaint priority by authorized officer or admin.
 * Verifies department scope for officers and logs to audit trail.
 */
export const updateComplaintPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { priority, remarks } = req.body;

    const complaint = await complaintService.getComplaintById(id, true);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    // Role scope verification: officers can only adjust priority in their assigned department
    if (req.user.role === 'officer') {
      if (complaint.departmentId !== req.user.departmentId && complaint.department !== req.user.departmentId) {
        return res.status(403).json({
          success: false,
          error: `Access denied: officer is not authorized for department '${complaint.departmentId}'`
        });
      }
    }

    const previousPriority = complaint.priority;
    const updated = await complaintService.updateComplaintPriority(id, {
      priority,
      remarks: remarks || `Priority updated by ${req.user.role}`,
      actorType: 'OFFICER'
    });

    // Audit logging for consequential human decision
    try {
      await auditLogRepository.create({
        userId: req.user.id,
        userEmail: req.user.email,
        role: req.user.role,
        action: 'UPDATE_PRIORITY',
        complaintId: complaint.id,
        targetResource: complaint.referenceNumber || complaint.id,
        details: {
          complaintId: complaint.id,
          fromPriority: previousPriority,
          toPriority: priority,
          remarks: remarks || 'Priority modified by officer',
          ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1'
        }
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed for priority update:', auditErr.message);
    }

    res.json({
      success: true,
      message: `Complaint priority updated from ${previousPriority} to ${priority}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Link complaint as duplicate of an existing incident without deleting or auto-merging records.
 */
export const linkDuplicateComplaint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const duplicateOf = req.body.duplicateOf || req.body.duplicateOfId;
    const { remarks } = req.body;

    if (duplicateOf === id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot link complaint as a duplicate of itself'
      });
    }

    const complaint = await complaintService.getComplaintById(id, true);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: `Complaint with id '${id}' not found`
      });
    }

    const targetComplaint = await complaintService.getComplaintById(duplicateOf, true);
    if (!targetComplaint) {
      return res.status(404).json({
        success: false,
        error: `Target complaint with id or reference '${duplicateOf}' not found`
      });
    }

    if (req.user.role === 'officer') {
      if (complaint.departmentId !== req.user.departmentId && complaint.department !== req.user.departmentId) {
        return res.status(403).json({
          success: false,
          error: `Access denied: officer is not authorized for department '${complaint.departmentId}'`
        });
      }
    }

    const updated = await complaintService.linkDuplicateComplaint(id, {
      duplicateOf,
      remarks: remarks || `Linked as duplicate of ${duplicateOf}`,
      actorType: 'OFFICER'
    });

    try {
      await auditLogRepository.create({
        userId: req.user.id,
        userEmail: req.user.email,
        role: req.user.role,
        action: 'LINK_DUPLICATE',
        complaintId: complaint.id,
        targetResource: complaint.referenceNumber || complaint.id,
        details: {
          complaintId: complaint.id,
          duplicateOf,
          remarks: remarks || `Linked to parent grievance ${duplicateOf}`,
          ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1'
        }
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed for duplicate link:', auditErr.message);
    }

    res.json({
      success: true,
      message: `Complaint linked as potential duplicate of ${duplicateOf}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

export default {
  listComplaints,
  listMyComplaints,
  getComplaintStats,
  getComplaint,
  getComplaintTracking,
  createComplaint,
  updateComplaintStatus,
  updateComplaintDepartment,
  addOfficerNote,
  getComplaintHistory,
  analyzeGrievancePreview,
  getComplaintIntelligence,
  getComplaintDuplicates,
  updateComplaintPriority,
  linkDuplicateComplaint
};
