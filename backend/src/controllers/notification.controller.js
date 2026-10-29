/**
 * @file notification.controller.js
 * @description Controller for citizen notification preferences and officer/admin delivery logs.
 */

import { notificationService } from '../services/notification/notification.service.js';
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
    if (phone !== undefined) {
      updates.phone = phone ? String(phone).trim() : null;
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

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        citizenId: user.id,
        phone: updatedUser.phone || null,
        preferences: updatedPrefs
      }
    });
  } catch (err) {
    next(err);
  }
}

