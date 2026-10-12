/**
 * @file reminder.service.js
 * @description Business logic, eligibility validation, cooldown enforcement,
 * and transparent in-app audit tracking for Feature B: Citizen Grievance Reminders.
 */

import { reminderRepository } from '../repositories/reminder.repository.js';
import { complaintRepository } from '../repositories/complaint.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';
import config from '../config/app.config.js';
import { COMPLAINT_STATUS } from '../constants/status.constants.js';
import {
  REMINDER_STATUS,
  REMINDER_DELIVERY_CHANNEL,
  REMINDER_DELIVERY_STATUS,
  REMINDER_CONFIG
} from '../constants/clarification.constants.js';

export class ReminderService {
  constructor(
    reminderRepo = reminderRepository,
    complaintRepo = complaintRepository,
    auditRepo = auditLogRepository,
    appConfig = config
  ) {
    this.reminderRepo = reminderRepo;
    this.complaintRepo = complaintRepo;
    this.auditRepo = auditRepo;
    this.config = appConfig;
  }

  /**
   * Get configured cooldown period in hours
   */
  getCooldownHours() {
    return Number(this.config?.reminders?.cooldownHours || REMINDER_CONFIG.DEFAULT_COOLDOWN_HOURS);
  }

  /**
   * Check reminder eligibility and cooldown status for a complaint
   */
  async checkEligibility(complaintIdOrRef, user) {
    const complaint = await this.complaintRepo.findById(complaintIdOrRef);
    if (!complaint) {
      const err = new Error('Grievance record not found');
      err.status = 404;
      err.code = 'COMPLAINT_NOT_FOUND';
      throw err;
    }

    if (user && user.role === 'citizen' && complaint.citizenId !== user.id) {
      const err = new Error('Access denied: you can only query reminder eligibility for complaints you filed');
      err.status = 403;
      err.code = 'FORBIDDEN_COMPLAINT_OWNER';
      throw err;
    }

    const isClosedOrResolved =
      complaint.status === COMPLAINT_STATUS.RESOLVED || complaint.status === COMPLAINT_STATUS.CLOSED;

    if (isClosedOrResolved) {
      return {
        eligible: false,
        reason: `Complaint is already ${complaint.status}. Reminders are only eligible for active, unresolved grievances.`,
        status: REMINDER_STATUS.NOT_ELIGIBLE,
        complaintStatus: complaint.status
      };
    }

    const cooldownHours = this.getCooldownHours();
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const now = Date.now();

    const latest = await this.reminderRepo.findLatestByComplaintId(complaint.id);

    if (latest) {
      const lastRequestedTime = new Date(latest.requestedAt || latest.createdAt).getTime();
      const elapsedMs = now - lastRequestedTime;

      if (elapsedMs < cooldownMs) {
        const remainingMs = cooldownMs - elapsedMs;
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        const cooldownExpiresAt = new Date(lastRequestedTime + cooldownMs).toISOString();

        return {
          eligible: false,
          throttled: true,
          status: REMINDER_STATUS.THROTTLED,
          cooldownHours,
          timeRemainingMinutes: remainingMinutes,
          cooldownExpiresAt,
          latestReminder: latest,
          reason: `Reminder cooldown active. Please wait ${remainingMinutes} minute(s) before requesting another follow-up.`
        };
      }
    }

    return {
      eligible: true,
      throttled: false,
      status: REMINDER_STATUS.ACCEPTED,
      cooldownHours,
      latestReminder: latest || null
    };
  }

  /**
   * Submit citizen follow-up reminder request on an owned complaint
   */
  async requestReminder(complaintIdOrRef, user) {
    if (!user || user.role !== 'citizen') {
      const err = new Error('Access denied: only authenticated citizens may submit grievance follow-up reminders');
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

    // Citizen ownership check
    if (complaint.citizenId !== user.id) {
      const err = new Error('Access denied: you can only submit reminders for grievances you filed');
      err.status = 403;
      err.code = 'FORBIDDEN_COMPLAINT_OWNER';
      throw err;
    }

    // Eligibility check
    const isClosedOrResolved =
      complaint.status === COMPLAINT_STATUS.RESOLVED || complaint.status === COMPLAINT_STATUS.CLOSED;

    if (isClosedOrResolved) {
      const err = new Error(
        `Reminder not accepted: Grievance is already '${complaint.status}'. Follow-up reminders are only allowed for active, unresolved grievances.`
      );
      err.status = 400;
      err.code = 'INELIGIBLE_FOR_REMINDER';
      err.details = { complaintStatus: complaint.status };
      throw err;
    }

    // Cooldown check
    const cooldownHours = this.getCooldownHours();
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const now = Date.now();

    const latest = await this.reminderRepo.findLatestByComplaintId(complaint.id);

    if (latest) {
      const lastRequestedTime = new Date(latest.requestedAt || latest.createdAt).getTime();
      const elapsedMs = now - lastRequestedTime;

      if (elapsedMs < cooldownMs) {
        const remainingMs = cooldownMs - elapsedMs;
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        const cooldownExpiresAt = new Date(lastRequestedTime + cooldownMs).toISOString();

        const err = new Error(
          `Reminder throttled: A reminder was already logged recently. Please wait until ${new Date(
            cooldownExpiresAt
          ).toLocaleString()} (${remainingMinutes} minute(s) remaining) before sending another follow-up.`
        );
        err.status = 429;
        err.code = 'REMINDER_THROTTLED';
        err.details = {
          throttled: true,
          cooldownHours,
          timeRemainingMinutes: remainingMinutes,
          cooldownExpiresAt,
          latestReminderId: latest.id
        };
        throw err;
      }
    }

    const requestedAtDate = new Date();
    const cooldownExpiresAtDate = new Date(requestedAtDate.getTime() + cooldownMs);
    const departmentId = complaint.departmentId || complaint.department || 'GENERAL';

    // Record the reminder transparently in-app (no false external claims)
    const newReminder = await this.reminderRepo.create({
      complaintId: complaint.id,
      complaintReference: complaint.referenceNumber || complaint.id,
      citizenId: user.id,
      departmentId,
      status: REMINDER_STATUS.ACCEPTED,
      deliveryChannel: REMINDER_DELIVERY_CHANNEL.IN_APP,
      deliveryStatus: REMINDER_DELIVERY_STATUS.LOGGED_IN_APP,
      requestedAt: requestedAtDate.toISOString(),
      cooldownExpiresAt: cooldownExpiresAtDate.toISOString(),
      message: 'Citizen requested expedited follow-up. Recorded in-app for assigned department review.'
    });

    try {
      await this.auditRepo.create({
        action: 'REQUEST_COMPLAINT_REMINDER',
        userId: user.id,
        userEmail: user.email,
        role: user.role,
        targetResource: newReminder.id,
        complaintId: complaint.id,
        details: {
          reminderId: newReminder.id,
          complaintId: complaint.id,
          departmentId,
          deliveryChannel: REMINDER_DELIVERY_CHANNEL.IN_APP,
          deliveryStatus: REMINDER_DELIVERY_STATUS.LOGGED_IN_APP
        }
      });
    } catch (auditErr) {
      console.warn('Audit log creation failed for reminder request:', auditErr.message);
    }

    return {
      accepted: true,
      status: REMINDER_STATUS.ACCEPTED,
      reminder: newReminder,
      delivery: {
        channel: REMINDER_DELIVERY_CHANNEL.IN_APP,
        status: REMINDER_DELIVERY_STATUS.LOGGED_IN_APP,
        delivered: true,
        note: 'Reminder logged in platform database for departmental inspection; external SMS/Email is unconfigured and not claimed.'
      }
    };
  }

  /**
   * Get reminder history for a complaint
   */
  async getRemindersForComplaint(complaintIdOrRef, user) {
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

    if (user.role === 'citizen' && complaint.citizenId !== user.id) {
      const err = new Error('Access denied: you can only view reminders for complaints you filed');
      err.status = 403;
      err.code = 'FORBIDDEN_COMPLAINT_OWNER';
      throw err;
    }

    if (user.role === 'officer') {
      const dept = complaint.departmentId || complaint.department;
      if (user.departmentId && dept !== user.departmentId) {
        const err = new Error(`Access denied: officer is not authorized for department '${dept}'`);
        err.status = 403;
        err.code = 'FORBIDDEN_DEPARTMENT_MISMATCH';
        throw err;
      }
    }

    return this.reminderRepo.findAll({ complaintId: complaint.id });
  }

  /**
   * List reminders with role-based filters
   */
  async listReminders(filters = {}, user) {
    if (!user) {
      const err = new Error('Authentication required');
      err.status = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const queryFilters = { ...filters };

    if (user.role === 'citizen') {
      queryFilters.citizenId = user.id;
    } else if (user.role === 'officer') {
      queryFilters.departmentId = user.departmentId;
    }

    return this.reminderRepo.findAll(queryFilters);
  }
}

export const reminderService = new ReminderService();
export default reminderService;
