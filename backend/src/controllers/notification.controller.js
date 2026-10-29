/**
 * @file notification.controller.js
 * @description Controller for citizen notification preferences and officer/admin delivery logs.
 */

import { notificationService } from '../services/notification/notification.service.js';
import { NOTIFICATION_STATUS } from '../constants/notification.constants.js';
import { userRepository } from '../repositories/user.repository.js';
import { auditLogRepository } from '../repositories/auditLog.repository.js';

export async function getNotificationLogs(req, res, next) {
  try {
    const filters = {};
    if (req.query.complaintId) filters.complaintId = req.query.complaintId;
    if (req.query.channel) filters.channel = req.query.channel;
    if (req.query.eventType) filters.eventType = req.query.eventType;
    if (req.query.status) filters.status = req.query.status;

    // Enforce role scoping: citizens can only view their own logs
    const logs = await notificationService.getDeliveryLogs(filters, req.user);
    res.json({
      success: true,
      data: logs,
      count: logs.length
    });
  } catch (err) {
    next(err);
  }
}

export async function getPreferences(req, res, next) {
  try {
    const user = await userRepository.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    const preferences = user.notificationPreferences || {
      enabled: true,
      smsOptOut: false,
      whatsappOptOut: false,
      preferredChannel: 'both'
    };

    res.json({
      success: true,
      data: {
        citizenId: user.id,
        phone: user.phone || user.phoneNumber || null,
        preferences
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const { enabled, smsOptOut, whatsappOptOut, preferredChannel, phone } = req.body;
    const user = await userRepository.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found' });
    }

    const currentPrefs = user.notificationPreferences || {};
    const updatedPrefs = {
      ...currentPrefs,
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
      ...(smsOptOut !== undefined ? { smsOptOut: Boolean(smsOptOut) } : {}),
      ...(whatsappOptOut !== undefined ? { whatsappOptOut: Boolean(whatsappOptOut) } : {}),
      ...(preferredChannel ? { preferredChannel: String(preferredChannel).toLowerCase() } : {})
    };

    const updates = { notificationPreferences: updatedPrefs };
    // Do not overwrite an existing registered number unless user explicitly requests removal
    if (req.body.removePhone === true || req.body.action === 'remove_phone') {
      updates.phone = null;
      updates.phoneNumber = null;
    } else if (phone !== undefined && phone !== null) {
      const trimmed = String(phone).trim();
      if (trimmed) {
        const normalized = notificationService.normalizePhoneNumber(trimmed);
        updates.phone = normalized || trimmed;
        updates.phoneNumber = updates.phone;
      }
    }

    const updatedUser = await userRepository.update(user.id, updates);

    // Audit log preference change
    try {
      await auditLogRepository.create({
        action: 'UPDATE_NOTIFICATION_PREFERENCES',
        actorId: req.user.id,
        actorRole: req.user.role,
        targetId: user.id,
        targetType: 'USER_PREFERENCES',
        details: { updatedPrefs }
      });
    } catch {}

    const preservedPhone = (updates.phone === null)
      ? null
      : (updatedUser?.phone || updatedUser?.phoneNumber || user.phone || user.phoneNumber || null);

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        citizenId: user.id,
        phone: preservedPhone,
        preferences: updatedUser?.notificationPreferences || updatedPrefs
      }
    });
  } catch (err) {
    next(err);
  }
}


export async function processDeliveryReceiptWebhook(req, res, next) {
  try {
    const payload = req.body || {};
    const providerMessageId = payload.MessageSid || payload.SmsSid || payload.messageId || payload.id || payload.providerMessageId;
    const rawStatus = (payload.MessageStatus || payload.SmsStatus || payload.status || '').toLowerCase();

    if (!providerMessageId) {
      return res.status(400).json({ success: false, error: 'providerMessageId is required' });
    }

    let status = NOTIFICATION_STATUS.DELIVERED;
    if (['failed', 'undelivered'].includes(rawStatus)) {
      status = NOTIFICATION_STATUS.FAILED;
    } else if (['sent', 'queued', 'accepted'].includes(rawStatus)) {
      status = NOTIFICATION_STATUS.SENT;
    } else if (rawStatus === 'delivered') {
      status = NOTIFICATION_STATUS.DELIVERED;
    }

    const updated = await notificationService.processDeliveryReceipt({
      providerMessageId,
      status,
      error: payload.ErrorMessage || payload.error || null,
      timestamp: new Date().toISOString()
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Notification record not found' });
    }

    res.json({
      success: true,
      message: 'Delivery receipt processed successfully',
      data: {
        id: updated.id,
        status: updated.status,
        providerMessageId
      }
    });
  } catch (err) {
    next(err);
  }
}
