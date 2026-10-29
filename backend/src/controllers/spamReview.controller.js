/**
 * @file spamReview.controller.js
 * @description HTTP controllers for CivicSarthi Phase 11:
 * Spam/Fake Complaint Detection with Human Review.
 */

import spamReviewService from '../services/spamReview.service.js';
import citizenReputationService from '../services/citizenReputation.service.js';

export const listFlaggedComplaints = async (req, res, next) => {
  try {
    const list = await spamReviewService.listFlaggedComplaints(req.query, req.user);
    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    next(err);
  }
};

export const getSpamReviewDetail = async (req, res, next) => {
  try {
    const detail = await spamReviewService.getReviewDetail(req.params.id, req.user);
    res.json({
      success: true,
      data: detail
    });
  } catch (err) {
    next(err);
  }
};

export const recordReviewDecision = async (req, res, next) => {
  try {
    const updated = await spamReviewService.recordReviewDecision(
      req.params.id,
      req.body,
      req.user
    );
    res.json({
      success: true,
      message: `Review determination recorded: ${updated.decision?.outcome}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

export const getMyReputation = async (req, res, next) => {
  try {
    const rep = await citizenReputationService.getReputation(req.user.id, req.user);
    res.json({
      success: true,
      data: rep
    });
  } catch (err) {
    next(err);
  }
};

export const getCitizenReputationDetail = async (req, res, next) => {
  try {
    const rep = await citizenReputationService.getReputation(req.params.citizenId, req.user);
    res.json({
      success: true,
      data: rep
    });
  } catch (err) {
    next(err);
  }
};

export const flagComplaint = async (req, res, next) => {
  try {
    const complaintId = req.params.id || req.body.complaintId;
    const result = await spamReviewService.flagComplaintManually(complaintId, req.body, req.user);
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.review
    });
  } catch (err) {
    next(err);
  }
};

