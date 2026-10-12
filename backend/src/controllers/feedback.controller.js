import { feedbackService } from '../services/feedback.service.js';

export const submitFeedback = async (req, res, next) => {
  try {
    const feedback = await feedbackService.submitFeedback(req.params.id, req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Citizen resolution feedback submitted successfully',
      data: feedback
    });
  } catch (err) {
    next(err);
  }
};

export const getComplaintFeedback = async (req, res, next) => {
  try {
    const list = await feedbackService.getFeedbackForComplaint(req.params.id, req.user);
    res.json({
      success: true,
      data: list
    });
  } catch (err) {
    next(err);
  }
};

export const getMyFeedback = async (req, res, next) => {
  try {
    const list = await feedbackService.getMyFeedback(req.user);
    res.json({
      success: true,
      data: list
    });
  } catch (err) {
    next(err);
  }
};

export const getFeedbackSummary = async (req, res, next) => {
  try {
    const summary = await feedbackService.getFeedbackSummary(req.query, req.user);
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    next(err);
  }
};
