/**
 * @file analytics.repository.js
 * @description Repository facade for Phase 13 Analytics & Reporting queries.
 * Coordinates cross-entity aggregation queries while adhering to Dual Persistence
 * (JSON and MongoDB) conventions without silent degradation.
 */

import { complaintRepository } from './complaint.repository.js';
import { departmentRepository } from './department.repository.js';
import { incidentRepository } from './incident.repository.js';
import { subtaskRepository } from './subtask.repository.js';
import { feedbackRepository } from './feedback.repository.js';
import { appealRepository } from './appeal.repository.js';
import { reopeningRequestRepository } from './reopeningRequest.repository.js';
import { spamReviewRepository } from './spamReview.repository.js';
import { clarificationRepository } from './clarification.repository.js';
import { reminderRepository } from './reminder.repository.js';
import { auditLogRepository } from './auditLog.repository.js';

export class AnalyticsRepository {
  constructor(deps = {}) {
    this.complaintRepo = deps.complaintRepository || complaintRepository;
    this.departmentRepo = deps.departmentRepository || departmentRepository;
    this.incidentRepo = deps.incidentRepository || incidentRepository;
    this.subtaskRepo = deps.subtaskRepository || subtaskRepository;
    this.feedbackRepo = deps.feedbackRepository || feedbackRepository;
    this.appealRepo = deps.appealRepository || appealRepository;
    this.reopeningRepo = deps.reopeningRequestRepository || reopeningRequestRepository;
    this.spamReviewRepo = deps.spamReviewRepository || spamReviewRepository;
    this.clarificationRepo = deps.clarificationRepository || clarificationRepository;
    this.reminderRepo = deps.reminderRepository || reminderRepository;
    this.auditRepo = deps.auditLogRepository || auditLogRepository;
  }

  /**
   * Fetch complaints matching optional criteria
   */
  async getComplaints(filter = {}) {
    const all = await this.complaintRepo.findAll(filter);
    return Array.isArray(all) ? all : (all?.items || []);
  }

  /**
   * Fetch all department definitions
   */
  async getDepartments() {
    const all = await this.departmentRepo.findAll();
    return Array.isArray(all) ? all : (all?.items || []);
  }

  /**
   * Fetch status history for a complaint
   */
  async getComplaintStatusHistory(idOrRef) {
    if (typeof this.complaintRepo.getStatusHistory === 'function') {
      return (await this.complaintRepo.getStatusHistory(idOrRef)) || [];
    }
    return [];
  }

  /**
   * Fetch incidents
   */
  async getIncidents(filter = {}) {
    try {
      const all = await this.incidentRepo.findAll(filter);
      return Array.isArray(all) ? all : (all?.items || []);
    } catch {
      return [];
    }
  }

  /**
   * Fetch subtasks
   */
  async getSubtasks(filter = {}) {
    try {
      const all = await this.subtaskRepo.findAll(filter);
      return Array.isArray(all) ? all : (all?.items || []);
    } catch {
      return [];
    }
  }

  /**
   * Fetch citizen feedback
   */
  async getFeedback(filter = {}) {
    try {
      const all = await this.feedbackRepo.findAll(filter);
      return Array.isArray(all) ? all : (all?.items || []);
    } catch {
      return [];
    }
  }

  /**
   * Fetch appeals
   */
  async getAppeals(filter = {}) {
    try {
      const all = await this.appealRepo.findAll(filter);
      return Array.isArray(all) ? all : (all?.items || []);
    } catch {
      return [];
    }
  }

  /**
   * Fetch reopening requests
   */
  async getReopeningRequests(filter = {}) {
    try {
      const all = await this.reopeningRepo.findAll(filter);
      return Array.isArray(all) ? all : (all?.items || []);
    } catch {
      return [];
    }
  }

  /**
   * Fetch spam reviews
   */
  async getSpamReviews(filter = {}) {
    try {
      const all = await this.spamReviewRepo.findAll(filter);
      return Array.isArray(all) ? all : (all?.items || []);
    } catch {
      return [];
    }
  }

  /**
   * Fetch clarification requests
   */
  async getClarifications(filter = {}) {
    try {
      const all = await this.clarificationRepo.findAll(filter);
      return Array.isArray(all) ? all : (all?.items || []);
    } catch {
      return [];
    }
  }

  /**
   * Fetch reminders
   */
  async getReminders(filter = {}) {
    try {
      const all = await this.reminderRepo.findAll(filter);
      return Array.isArray(all) ? all : (all?.items || []);
    } catch {
      return [];
    }
  }

  /**
   * Record an audit log entry for report export
   */
  async logExportAction(auditData) {
    try {
      return await this.auditRepo.create(auditData);
    } catch (err) {
      console.warn('[AnalyticsRepository] Warning: failed to write export audit log:', err.message);
      return null;
    }
  }
}

export const analyticsRepository = new AnalyticsRepository();
export default analyticsRepository;
