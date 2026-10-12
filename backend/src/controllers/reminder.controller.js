/**
 * @file reminder.controller.js
 * @description Controller endpoints for Feature B: Citizen Reminders & Follow-Ups.
 */

import { reminderService } from '../services/reminder.service.js';

export const requestReminder = async (req, res, next) => {
  try {
    const complaintId = req.params.id || req.body.complaintId;
    const result = await reminderService.requestReminder(complaintId, req.user);

    res.status(200).json({
      success: true,
      message: 'Reminder request accepted and recorded in-app for department review',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const checkReminderEligibility = async (req, res, next) => {
  try {
    const complaintId = req.params.id;
    const result = await reminderService.checkEligibility(complaintId, req.user);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getComplaintReminders = async (req, res, next) => {
  try {
    const complaintId = req.params.id;
    const list = await reminderService.getRemindersForComplaint(complaintId, req.user);

    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    next(error);
  }
};

export const listReminders = async (req, res, next) => {
  try {
    const filters = {
      complaintId: req.query.complaintId,
      departmentId: req.query.departmentId,
      status: req.query.status
    };

    const list = await reminderService.listReminders(filters, req.user);

    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    next(error);
  }
};

export default {
  requestReminder,
  checkReminderEligibility,
  getComplaintReminders,
  listReminders
};
