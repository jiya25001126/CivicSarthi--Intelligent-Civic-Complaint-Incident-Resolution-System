/**
 * @file clarification.service.js
 * @description Business logic, authorization, throttling, and lifecycles
 * for Feature A: Citizen-Initiated Clarification Requests & Officer Responses.
 */

import { clarificationRepository } from '../repositories/clarification.repository.js';
import { complaintRepository } from '../repositories/complaint.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import { notificationService as defaultNotificationService } from './notification/notification.service.js';
import {
  CLARIFICATION_STATUS,
  CLARIFICATION_TYPE,
  CLARIFICATION_BOUNDS
} from '../constants/clarification.constants.js';

export class ClarificationService {
  constructor(
    clarificationRepo = clarificationRepository,
    complaintRepo = complaintRepository,
    auditRepo = auditLogRepository,
    notifService = defaultNotificationService
  ) {
    this.clarificationRepo = clarificationRepo;
    this.complaintRepo = complaintRepo;
    this.auditRepo = auditRepo;
    this.notificationService = notifService;
  }

  /**
   * Submit citizen clarification question or supplementary info on an owned complaint
   */
  async createClarification(complaintIdOrRef, { requestType = CLARIFICATION_TYPE.CLARIFICATION, content }, user) {
    if (!user || user.role !== 'citizen') {
      const err = new Error('Access denied: only authenticated citizens may initiate clarification requests');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const complaint = await this.complaintRepo.findById(complaintIdOrRef);
    if (!complaint) {
      const err = new Error('Grievance record not found');
      err.status = 404;
      err.code = 'COMPLAINT_NOT_FOUND';
      throw err;
    }

    // Ownership check: citizen must own this grievance
    if (complaint.citizenId !== user.id) {
      const err = new Error('Access denied: you can only submit clarification requests for complaints you filed');
      err.status = 403;
      err.code = 'FORBIDDEN_COMPLAINT_OWNER';
      throw err;
    }

    // Validate request type
    if (!Object.values(CLARIFICATION_TYPE).includes(requestType)) {
      const err = new Error(`Invalid requestType. Allowed values: ${Object.values(CLARIFICATION_TYPE).join(', ')}`);
      err.status = 400;
      err.code = 'INVALID_REQUEST_TYPE';
      throw err;
    }

    // Validate content
    const cleanContent = content ? String(content).trim() : '';
    if (cleanContent.length < CLARIFICATION_BOUNDS.MIN_CONTENT_LENGTH) {
      const err = new Error(`Clarification content must be at least ${CLARIFICATION_BOUNDS.MIN_CONTENT_LENGTH} characters`);
      err.status = 400;
      err.code = 'CONTENT_TOO_SHORT';
      throw err;
    }
    if (cleanContent.length > CLARIFICATION_BOUNDS.MAX_CONTENT_LENGTH) {
      const err = new Error(`Clarification content cannot exceed ${CLARIFICATION_BOUNDS.MAX_CONTENT_LENGTH} characters`);
      err.status = 400;
      err.code = 'CONTENT_TOO_LONG';
      throw err;
    }

    // Throttling: limit active OPEN requests per complaint to prevent spamming
    const existing = await this.clarificationRepo.findAll({
      complaintId: complaint.id,
      status: CLARIFICATION_STATUS.OPEN
    });
    if (existing.length >= CLARIFICATION_BOUNDS.MAX_ACTIVE_PER_COMPLAINT) {
      const err = new Error(
        `Throttled: This complaint already has ${existing.length} active open clarification requests awaiting officer response.`
      );
      err.status = 429;
      err.code = 'CLARIFICATION_THROTTLED';
      throw err;
    }

    const departmentId = complaint.departmentId || complaint.department || 'GENERAL';

    const record = await this.clarificationRepo.create({
      complaintId: complaint.id,
      complaintReference: complaint.referenceNumber || complaint.id,
      citizenId: user.id,
      citizenName: user.name || 'Citizen',
      departmentId,
      requestType,
      content: cleanContent,
      status: CLARIFICATION_STATUS.OPEN,
      responses: []
    });

    try {
      await this.auditRepo.create({
        action: 'CREATE_CLARIFICATION_REQUEST',
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        targetResource: record.id,
        complaintId: complaint.id,
        details: {
          clarificationId: record.id,
          complaintId: complaint.id,
          departmentId,
          requestType
        }
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed for clarification request:', auditErr.message);
    }

    return record;
  }

  /**
   * Get all clarifications for a given complaint with strict role & ownership scoping
   */
  async getClarificationsForComplaint(complaintIdOrRef, user) {
    if (!user) {
      const err = new Error('Authentication required');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const complaint = await this.complaintRepo.findById(complaintIdOrRef);
    if (!complaint) {
      const err = new Error('Grievance record not found');
      err.status = 404;
      err.code = 'COMPLAINT_NOT_FOUND';
      throw err;
    }

    // Role checks
    if (user.role === 'citizen') {
      if (complaint.citizenId !== user.id) {
        const err = new Error('Access denied: citizens cannot view clarification threads for complaints they do not own');
        err.status = 403;
        err.code = 'FORBIDDEN_COMPLAINT_OWNER';
        throw err;
      }
    } else if (user.role === 'officer') {
      const dept = complaint.departmentId || complaint.department;
      if (user.departmentId && dept !== user.departmentId) {
        const err = new Error(`Access denied: officer is not authorized for department '${dept}'`);
        err.status = 403;
        err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
        throw err;
      }
    }

    const list = await this.clarificationRepo.findAll({ complaintId: complaint.id });

    // Sanitize to guarantee zero leakage of internal officer notes or other citizens' records
    return list.map((item) => this.sanitizeClarification(item));
  }

  /**
   * Get single clarification by ID with authorization checks
   */
  async getClarificationById(id, user) {
    if (!user) {
      const err = new Error('Authentication required');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const item = await this.clarificationRepo.findById(id);
    if (!item) {
      const err = new Error(`Clarification request with id '${id}' not found`);
      err.status = 404;
      err.code = 'CLARIFICATION_NOT_FOUND';
      throw err;
    }

    if (user.role === 'citizen') {
      if (item.citizenId !== user.id) {
        const err = new Error('Access denied: you do not have permission to view this clarification request');
        err.status = 403;
        err.code = 'FORBIDDEN_COMPLAINT_OWNER';
        throw err;
      }
    } else if (user.role === 'officer') {
      if (user.departmentId && item.departmentId !== user.departmentId) {
        const err = new Error(`Access denied: request belongs to department '${item.departmentId}'`);
        err.status = 403;
        err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
        throw err;
      }
    }

    return this.sanitizeClarification(item);
  }

  /**
   * List clarification requests with filters (officers/admins or citizen's own)
   */
  async listClarifications(filters = {}, user) {
    if (!user) {
      const err = new Error('Authentication required');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const queryFilters = { ...filters };

    if (user.role === 'citizen') {
      // Citizen can only ever see their own clarification requests
      queryFilters.citizenId = user.id;
    } else if (user.role === 'officer') {
      // Officer can only see clarifications within their assigned department
      queryFilters.departmentId = user.departmentId;
    }

    const list = await this.clarificationRepo.findAll(queryFilters);
    return list.map((item) => this.sanitizeClarification(item));
  }

  /**
   * Officer or admin provides a citizen-visible response to an open clarification request
   */
  async respondToClarification(id, { response }, user) {
    if (!user || (user.role !== 'officer' && user.role !== 'admin')) {
      const err = new Error('Access denied: only authorized departmental officers or administrators can respond to clarification requests');
      err.status = 403;
      err.code = 'FORBIDDEN_ROLE';
      throw err;
    }

    const item = await this.clarificationRepo.findById(id);
    if (!item) {
      const err = new Error(`Clarification request with id '${id}' not found`);
      err.status = 404;
      err.code = 'CLARIFICATION_NOT_FOUND';
      throw err;
    }

    if (user.role === 'officer' && user.departmentId && item.departmentId !== user.departmentId) {
      const err = new Error(`Access denied: officer is not authorized for department '${item.departmentId}'`);
      err.status = 403;
      err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
      throw err;
    }

    // Validate response content
    const cleanResponse = response ? String(response).trim() : '';
    if (cleanResponse.length < CLARIFICATION_BOUNDS.MIN_RESPONSE_LENGTH) {
      const err = new Error(`Officer response must be at least ${CLARIFICATION_BOUNDS.MIN_RESPONSE_LENGTH} characters`);
      err.status = 400;
      err.code = 'RESPONSE_TOO_SHORT';
      throw err;
    }
    if (cleanResponse.length > CLARIFICATION_BOUNDS.MAX_RESPONSE_LENGTH) {
      const err = new Error(`Officer response cannot exceed ${CLARIFICATION_BOUNDS.MAX_RESPONSE_LENGTH} characters`);
      err.status = 400;
      err.code = 'RESPONSE_TOO_LONG';
      throw err;
    }

    const updated = await this.clarificationRepo.addResponse(item.id, {
      response: cleanResponse,
      responderId: user.id,
      responderName: user.name || 'Department Officer',
      responderRole: user.role
    });

    try {
      await this.auditRepo.create({
        action: 'RESPOND_CLARIFICATION_REQUEST',
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        targetResource: item.id,
        complaintId: item.complaintId,
        details: {
          clarificationId: item.id,
          complaintId: item.complaintId,
          departmentId: item.departmentId,
          responderId: user.id
        }
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed for clarification response:', auditErr.message);
    }

    try { if (this.notificationService && typeof this.notificationService.notifyCitizen === 'function') { this.complaintRepo.findById(item.complaintId).then((comp) => { if (comp) { this.notificationService.notifyCitizen({ citizenId: item.citizenId, recipientPhone: comp.citizenPhone || comp.contactPhone, eventType: 'CLARIFICATION_RESPONDED', complaint: comp, templateParams: { referenceNumber: item.complaintReference || item.complaintId }, stateIdentifier: 'clarification_resp_' + item.id }).catch(() => {}); } }).catch(() => {}); } } catch {}
    return this.sanitizeClarification(updated);
  }

  /**
   * Citizen or officer closes a clarification thread
   */
  async closeClarification(id, { reason }, user) {
    if (!user) {
      const err = new Error('Authentication required');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const item = await this.clarificationRepo.findById(id);
    if (!item) {
      const err = new Error(`Clarification request with id '${id}' not found`);
      err.status = 404;
      err.code = 'CLARIFICATION_NOT_FOUND';
      throw err;
    }

    if (user.role === 'citizen' && item.citizenId !== user.id) {
      const err = new Error('Access denied: citizens can only close their own clarification requests');
      err.status = 403;
      err.code = 'FORBIDDEN_COMPLAINT_OWNER';
      throw err;
    }

    if (user.role === 'officer' && user.departmentId && item.departmentId !== user.departmentId) {
      const err = new Error(`Access denied: officer is not authorized for department '${item.departmentId}'`);
      err.status = 403;
      err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
      throw err;
    }

    const updated = await this.clarificationRepo.closeRequest(item.id, {
      closedBy: user.id,
      closedRole: user.role,
      reason: reason || 'Closed by user'
    });

    try {
      await this.auditRepo.create({
        action: 'CLOSE_CLARIFICATION_REQUEST',
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        targetResource: item.id,
        complaintId: item.complaintId,
        details: {
          clarificationId: item.id,
          reason
        }
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed for clarification close:', auditErr.message);
    }

    try { if (this.notificationService && typeof this.notificationService.notifyCitizen === 'function') { this.complaintRepo.findById(item.complaintId).then((comp) => { if (comp) { this.notificationService.notifyCitizen({ citizenId: item.citizenId, recipientPhone: comp.citizenPhone || comp.contactPhone, eventType: 'CLARIFICATION_RESPONDED', complaint: comp, templateParams: { referenceNumber: item.complaintReference || item.complaintId }, stateIdentifier: 'clarification_resp_' + item.id }).catch(() => {}); } }).catch(() => {}); } } catch {}
    return this.sanitizeClarification(updated);
  }

  /**
   * Sanitize clarification records: ensures zero leakage of internal notes
   */
  sanitizeClarification(record) {
    if (!record) return null;
    return {
      id: record.id,
      complaintId: record.complaintId,
      complaintReference: record.complaintReference,
      citizenId: record.citizenId,
      citizenName: record.citizenName,
      departmentId: record.departmentId,
      requestType: record.requestType,
      content: record.content,
      status: record.status,
      responses: (record.responses || []).map((r) => ({
        response: r.response,
        responderName: r.responderName || 'Department Officer',
        responderRole: r.responderRole || 'officer',
        respondedAt: r.respondedAt
      })),
      closedAt: record.closedAt || null,
      closedBy: record.closedBy || null,
      closedReason: record.closedReason || null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}

export const clarificationService = new ClarificationService();
export default clarificationService;
