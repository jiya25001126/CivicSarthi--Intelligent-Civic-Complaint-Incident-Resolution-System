import { appealService } from '../services/appeal.service.js';

export const createAppeal = async (req, res, next) => {
  try {
    const appeal = await appealService.createAppeal(req.params.id, req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Formal resolution appeal submitted successfully',
      data: appeal
    });
  } catch (err) {
    next(err);
  }
};

export const getMyAppeals = async (req, res, next) => {
  try {
    const list = await appealService.getMyAppeals(req.user);
    res.json({
      success: true,
      data: list
    });
  } catch (err) {
    next(err);
  }
};

export const listAppeals = async (req, res, next) => {
  try {
    const list = await appealService.listAppeals(req.query, req.user);
    res.json({
      success: true,
      data: list
    });
  } catch (err) {
    next(err);
  }
};

export const getAppealById = async (req, res, next) => {
  try {
    const appeal = await appealService.getAppealById(req.params.appealId, req.user);
    res.json({
      success: true,
      data: appeal
    });
  } catch (err) {
    next(err);
  }
};

export const getAppealTracking = async (req, res, next) => {
  try {
    const tracking = await appealService.getAppealTracking(req.params.reference);
    res.json({
      success: true,
      data: tracking
    });
  } catch (err) {
    next(err);
  }
};

export const updateAppealStatus = async (req, res, next) => {
  try {
    const updated = await appealService.updateAppealStatus(req.params.appealId, req.body, req.user);
    res.json({
      success: true,
      message: 'Appeal status updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

export const addAppealNote = async (req, res, next) => {
  try {
    const updated = await appealService.addAppealNote(req.params.appealId, req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Internal review note added to appeal',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

export const recordAppealDecision = async (req, res, next) => {
  try {
    const updated = await appealService.recordAppealDecision(req.params.appealId, req.body, req.user);
    res.json({
      success: true,
      message: `Appeal decision recorded: ${req.body.outcome}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

export const getComplaintAppeals = async (req, res, next) => {
  try {
    const list = await appealService.getAppealsForComplaint(req.params.id, req.user);
    res.json({
      success: true,
      data: list
    });
  } catch (err) {
    next(err);
  }
};
