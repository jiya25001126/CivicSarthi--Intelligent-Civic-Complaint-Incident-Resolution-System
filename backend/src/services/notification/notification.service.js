/**
 * @file notification.service.js
 * @description Core orchestrator for Live SMS and WhatsApp Notifications (Feature A).
 * Handles template rendering, consent verification, opt-out checking,
 * idempotency duplicate suppression, delivery tracking, and department authorization.
 */

import { notificationAdapter } from './notification.adapter.js';
import { notificationLogRepository } from '../../repositories/notificationLog.repository.js';
import { userRepository } from '../../repositories/user.repository.js';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_EVENT,
  NOTIFICATION_STATUS,
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_CONFIG
} from '../../constants/notification.constants.js';

export class NotificationService {
  constructor(
    adapter = notificationAdapter,
    logRepo = notificationLogRepository,
    userRepo = userRepository
  ) {
    this.adapter = adapter;
    this.logRepo = logRepo;
    this.userRepo = userRepo;
  }

  /**
   * Normalizes and validates phone number to E.164 format
   */
  normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return null;
    let clean = phone.replace(/[\s\-\(\)]/g, '').trim();
    if (!clean) return null;

    // Standard 10-digit Indian mobile number
    if (/^[6-9]\d{9}$/.test(clean)) {
      return `+91${clean}`;
    }

    // 12-digit Indian number with 91 prefix without plus
    if (/^91[6-9]\d{9}$/.test(clean)) {
      return `+${clean}`;
    }

    // Standard E.164 international format (+ followed by 10-15 digits)
    if (/^\+[1-9]\d{9,14}$/.test(clean)) {
      return clean;
    }

    return null;
  }

  /**
   * Generates a deterministic idempotency key for deduplication
   */
  generateIdempotencyKey(eventType, entityId, channel, stateIdentifier = '') {
    return `${eventType}:${entityId}:${channel}:${stateIdentifier}`.toLowerCase();
  }

  /**
   * Checks whether a citizen has opted out of notifications for a channel
   */
  async checkCitizenConsent(citizenId, channel) {
    if (!citizenId) return { allowed: true, preferences: null };

    try {
      const user = await this.userRepo.findById(citizenId);
      if (!user) return { allowed: true, preferences: null };

      const prefs = user.notificationPreferences || {};

      // Global opt-out
      if (prefs.enabled === false) {
        return { allowed: false, reason: 'Citizen has disabled all notifications', preferences: prefs };
      }

      // Channel-specific opt-out
      if (channel === NOTIFICATION_CHANNEL.SMS && prefs.smsOptOut === true) {
        return { allowed: false, reason: 'Citizen opted out of SMS alerts', preferences: prefs };
      }

      if (channel === NOTIFICATION_CHANNEL.WHATSAPP && prefs.whatsappOptOut === true) {
        return { allowed: false, reason: 'Citizen opted out of WhatsApp messages', preferences: prefs };
      }

      // Preferred dispatch channel enforcement
      if (prefs.preferredChannel && prefs.preferredChannel !== 'both') {
        const pref = String(prefs.preferredChannel).toLowerCase();
        if (pref === 'sms' && channel !== NOTIFICATION_CHANNEL.SMS) {
          return { allowed: false, reason: 'Citizen preferred dispatch channel is SMS only', preferences: prefs };
        }
        if (pref === 'whatsapp' && channel !== NOTIFICATION_CHANNEL.WHATSAPP) {
          return { allowed: false, reason: 'Citizen preferred dispatch channel is WhatsApp only', preferences: prefs };
        }
      }

      return { allowed: true, preferences: prefs, user };
    } catch {
      return { allowed: true, preferences: null };
    }
  }

  /**
   * Core dispatcher for a notification on a specific channel
   */
  async dispatchNotification({
    channel,
    eventType,
    recipientPhone,
    citizenId = null,
    complaintId = null,
    complaintReference = null,
    templateParams = {},
    stateIdentifier = ''
  }) {
    // Fallback if recipientPhone was not passed directly but citizenId is available
    let phoneToUse = recipientPhone;
    if (!phoneToUse && citizenId && this.userRepo) {
      try {
        const user = await this.userRepo.findById(citizenId);
        if (user) {
          phoneToUse = user.phone || user.phoneNumber || null;
        }
      } catch {}
    }

    const normalizedPhone = this.normalizePhoneNumber(phoneToUse);
    const idempotencyKey = this.generateIdempotencyKey(
      eventType,
      complaintId || citizenId || normalizedPhone,
      channel,
      stateIdentifier
    );

    // 1. Phone Number Validation
    if (!normalizedPhone) {
      return this.logRepo.create({
        recipientPhone: recipientPhone || 'UNKNOWN',
        channel,
        eventType,
        complaintId,
        complaintReference,
        citizenId,
        status: NOTIFICATION_STATUS.SKIPPED_INVALID_RECIPIENT,
        error: 'Phone number missing or invalid format',
        idempotencyKey
      });
    }

    // 2. Consent & Opt-Out Verification
    const consent = await this.checkCitizenConsent(citizenId, channel);
    if (!consent.allowed) {
      return this.logRepo.create({
        recipientPhone: normalizedPhone,
        channel,
        eventType,
        complaintId,
        complaintReference,
        citizenId,
        status: NOTIFICATION_STATUS.SKIPPED_OPT_OUT,
        error: consent.reason,
        idempotencyKey
      });
    }

    // 3. Duplicate Send Prevention (Idempotency check within window)
    const existingRecent = await this.logRepo.findLatestByIdempotencyKey(idempotencyKey);
    if (existingRecent) {
      const elapsed = Date.now() - new Date(existingRecent.createdAt).getTime();
      if (
        elapsed < NOTIFICATION_CONFIG.DEDUPLICATION_WINDOW_MS &&
        (existingRecent.status === NOTIFICATION_STATUS.SENT || existingRecent.status === NOTIFICATION_STATUS.DELIVERED || existingRecent.status === NOTIFICATION_STATUS.SIMULATED)
      ) {
        return this.logRepo.create({
          recipientPhone: normalizedPhone,
          channel,
          eventType,
          complaintId,
          complaintReference,
          citizenId,
          status: NOTIFICATION_STATUS.DUPLICATE_SUPPRESSED,
          error: `Suppressed duplicate dispatch within ${NOTIFICATION_CONFIG.DEDUPLICATION_WINDOW_MS / 60000}m window`,
          idempotencyKey
        });
      }
    }

    // 4. Render Message Template
    const templateDef = NOTIFICATION_TEMPLATES[eventType];
    let messageBody = '';
    let templateName = null;

    if (templateDef) {
      if (channel === NOTIFICATION_CHANNEL.SMS) {
        messageBody = typeof templateDef.sms === 'function' ? templateDef.sms(templateParams) : String(templateDef.sms);
      } else if (channel === NOTIFICATION_CHANNEL.WHATSAPP) {
        templateName = templateDef.whatsapp?.templateName || null;
        messageBody =
          typeof templateDef.whatsapp?.fallbackText === 'function'
            ? templateDef.whatsapp.fallbackText(templateParams)
            : String(templateDef.whatsapp?.fallbackText || '');
      }
    }

    if (!messageBody) {
      messageBody = `CivicSarthi Notification: Update on complaint ${complaintReference || complaintId || ''}.`;
    }

    // 5. Create Pending Notification Record
    const logEntry = await this.logRepo.create({
      recipientPhone: normalizedPhone,
      channel,
      eventType,
      complaintId,
      complaintReference,
      citizenId,
      status: NOTIFICATION_STATUS.PENDING,
      messageBody,
      templateName,
      idempotencyKey,
      sentAt: new Date().toISOString()
    });

    // 6. Deliver via Provider Adapter
    try {
      let receipt;
      if (channel === NOTIFICATION_CHANNEL.SMS) {
        receipt = await this.adapter.sendSms({
          to: normalizedPhone,
          message: messageBody,
          metadata: { logId: logEntry.id, eventType, complaintReference }
        });
      } else {
        receipt = await this.adapter.sendWhatsApp({
          to: normalizedPhone,
          message: messageBody,
          templateName,
          templateParams,
          metadata: { logId: logEntry.id, eventType, complaintReference }
        });
      }

      // Distinguish simulated dispatch, provider gateway acceptance, and verified delivery receipt
      let finalStatus = NOTIFICATION_STATUS.SENT;
      if (receipt.provider === 'mock' || receipt.simulated) {
        finalStatus = NOTIFICATION_STATUS.SIMULATED;
      } else if (receipt.status === 'delivered') {
        finalStatus = NOTIFICATION_STATUS.DELIVERED;
      } else {
        finalStatus = NOTIFICATION_STATUS.SENT;
      }

      return await this.logRepo.update(logEntry.id, {
        status: finalStatus,
        provider: receipt.provider || 'mock',
        providerMessageId: receipt.providerMessageId || null,
        sentAt: receipt.timestamp || new Date().toISOString()
      });
    } catch (err) {
      return await this.logRepo.update(logEntry.id, {
        status: NOTIFICATION_STATUS.FAILED,
        error: err.message
      });
    }
  }

  /**
   * Helper to dispatch across enabled channels (SMS & WhatsApp)
   */
  async notifyCitizen({ citizenId, recipientPhone, eventType, complaint, templateParams = {}, stateIdentifier = '' }) {
    let phone = recipientPhone || complaint?.citizenPhone || complaint?.contactPhone || null;
    const cid = citizenId || complaint?.citizenId || null;

    // Fallback: If phone is not on complaint, look up citizen profile from userRepo
    if (!phone && cid && this.userRepo) {
      try {
        const user = await this.userRepo.findById(cid);
        if (user) {
          phone = user.phone || user.phoneNumber || null;
        }
      } catch (err) {
        console.warn(`[NotificationService] Failed to look up citizen phone for ${cid}:`, err.message);
      }
    }
    const ref = complaint?.referenceNumber || complaint?.id || null;

    const channels = [NOTIFICATION_CHANNEL.SMS, NOTIFICATION_CHANNEL.WHATSAPP];
    const results = [];

    for (const channel of channels) {
      try {
        const res = await this.dispatchNotification({
          channel,
          eventType,
          recipientPhone: phone,
          citizenId: cid,
          complaintId: complaint?.id || null,
          complaintReference: ref,
          templateParams: {
            ...templateParams,
            referenceNumber: ref,
            category: complaint?.category || '',
            departmentName: complaint?.departmentId || complaint?.department || ''
          },
          stateIdentifier
        });
        results.push(res);
      } catch (err) {
        console.warn(`[NotificationService] Non-fatal notification error on ${channel}:`, err.message);
      }
    }

    return results;
  }

  /**
   * Triggers citizen registration notification
   */
  async notifyRegistration(user) {
    if (!user || (!user.phone && !user.phoneNumber)) return [];
    const phone = user.phone || user.phoneNumber;
    return this.notifyCitizen({
      citizenId: user.id,
      recipientPhone: phone,
      eventType: NOTIFICATION_EVENT.CITIZEN_REGISTRATION,
      templateParams: { name: user.name || 'Citizen' },
      stateIdentifier: 'registration'
    });
  }

  /**
   * Triggers grievance registered notification
   */
  async notifyComplaintCreated(complaint) {
    if (!complaint) return [];
    return this.notifyCitizen({
      citizenId: complaint.citizenId,
      recipientPhone: complaint.citizenPhone || complaint.contactPhone,
      eventType: NOTIFICATION_EVENT.COMPLAINT_REGISTERED,
      complaint,
      templateParams: {
        referenceNumber: complaint.referenceNumber || complaint.id,
        category: complaint.category,
        departmentName: complaint.departmentId || complaint.department
      },
      stateIdentifier: 'created'
    });
  }

  /**
   * Triggers status update notification
   */
  async notifyStatusChanged(complaint, newStatus, statusDescription = '') {
    if (!complaint || !newStatus) return [];

    // Distinct event for resolution
    if (newStatus === 'RESOLVED') {
      return this.notifyComplaintResolved(
        complaint,
        complaint.resolutionDetails?.actionCompleted ||
          complaint.resolutionDetails?.closureRemarks ||
          complaint.remarks ||
          statusDescription
      );
    }

    return this.notifyCitizen({
      citizenId: complaint.citizenId,
      recipientPhone: complaint.citizenPhone || complaint.contactPhone,
      eventType: NOTIFICATION_EVENT.STATUS_CHANGED,
      complaint,
      templateParams: {
        referenceNumber: complaint.referenceNumber || complaint.id,
        status: newStatus,
        statusDescription
      },
      stateIdentifier: newStatus
    });
  }

  /**
   * Triggers clarification requested notification
   */
  async notifyClarificationRequested(complaint, prompt = '') {
    if (!complaint) return [];
    return this.notifyCitizen({
      citizenId: complaint.citizenId,
      recipientPhone: complaint.citizenPhone || complaint.contactPhone,
      eventType: NOTIFICATION_EVENT.CLARIFICATION_REQUESTED,
      complaint,
      templateParams: {
        referenceNumber: complaint.referenceNumber || complaint.id,
        prompt
      },
      stateIdentifier: `clarification_${Date.now()}`
    });
  }

  /**
   * Triggers grievance resolved notification
   */
  async notifyComplaintResolved(complaint, resolutionSummary = '') {
    if (!complaint) return [];
    return this.notifyCitizen({
      citizenId: complaint.citizenId,
      recipientPhone: complaint.citizenPhone || complaint.contactPhone,
      eventType: NOTIFICATION_EVENT.COMPLAINT_RESOLVED,
      complaint,
      templateParams: {
        referenceNumber: complaint.referenceNumber || complaint.id,
        resolutionSummary,
        departmentName: complaint.departmentId || complaint.department
      },
      stateIdentifier: 'RESOLVED'
    });
  }

  /**
   * Processes carrier delivery receipt to transition message from SENT to DELIVERED or FAILED
   */
  async processDeliveryReceipt({ providerMessageId, status, error = null, timestamp = null }) {
    if (!providerMessageId) {
      throw new Error('providerMessageId is required to process delivery receipt');
    }
    const log = typeof this.logRepo.findByProviderMessageId === 'function'
      ? await this.logRepo.findByProviderMessageId(providerMessageId)
      : (await this.logRepo.findAll({ providerMessageId }))[0];

    if (!log) {
      return null;
    }

    const updates = {
      status: status || NOTIFICATION_STATUS.DELIVERED,
      ...(error ? { error } : {}),
      sentAt: timestamp || new Date().toISOString()
    };

    return this.logRepo.update(log.id, updates);
  }

  /**
   * Queries delivery logs with role authorization enforcement
   */
  async getDeliveryLogs(filters = {}, user = null) {
    if (user && user.role === 'citizen') {
      filters.citizenId = user.id;
    }
    return this.logRepo.findAll(filters);
  }
}

export const notificationService = new NotificationService();
export default notificationService;

