import { reopeningService } from '../services/reopening.service.js';

export const createReopeningRequest = async (req, res, next) => {
  try {
    const request = await reopeningService.createReopeningRequest(req.params.id, req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Controlled reopening request submitted successfully',
      data: request
    });
  } catch (err) {
    next(err);
  }
};

export const getMyReopeningRequests = async (req, res, next) => {
  try {
    const list = await reopeningService.getMyReopeningRequests(req.user);
    res.json({
      success: true,
      data: list
    });
  } catch (err) {
    next(err);
  }
};

export const listReopeningRequests = async (req, res, next) => {
  try {
    const list = await reopeningService.listReopeningRequests(req.query, req.user);
    res.json({
      success: true,
      data: list
    });
  } catch (err) {
    next(err);
  }
};

export const getReopeningRequestById = async (req, res, next) => {
  try {
    const request = await reopeningService.getReopeningRequestById(req.params.requestId, req.user);
    res.json({
      success: true,
      data: request
    });
  } catch (err) {
    next(err);
  }
};

export const recordReopeningDecision = async (req, res, next) => {
  try {
    const updated = await reopeningService.recordReopeningDecision(req.params.requestId, req.body, req.user);
    res.json({
      success: true,
      message: `Reopening request decision recorded: ${updated.status}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};
