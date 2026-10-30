import express from 'express';
import config from '../config/app.config.js';
import healthRoutes from './health.routes.js';
import complaintRoutes from './complaint.routes.js';
import departmentRoutes from './department.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import incidentRoutes from './incident.routes.js';
import subtaskRoutes from './subtask.routes.js';
import neglectRadarRoutes from './neglectRadar.routes.js';
import feedbackRoutes from './feedback.routes.js';
import appealRoutes from './appeal.routes.js';
import reopeningRoutes from './reopening.routes.js';
import spamReviewRoutes from './spamReview.routes.js';
import clarificationRoutes from './clarification.routes.js';
import reminderRoutes from './reminder.routes.js';
import notificationRoutes from './notification.routes.js';
import historicalResolutionRoutes from './historicalResolution.routes.js';
import analyticsRoutes from './analytics.routes.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { mockCpgramsRouter } from '../../../mock-cpgrams/index.js';

const apiRouter = express.Router();

/**
 * SEC-01 Hardening: Strict Mock CPGRAMS Mount Policy.
 * In production, mock CPGRAMS endpoints are NEVER mounted under any circumstances,
 * unconditionally ignoring any ENABLE_MOCK_CPGRAMS flag to prevent accidental production leakage.
 * In non-production (development/test), mock routes require explicit opt-in (ENABLE_MOCK_CPGRAMS === 'true').
 * When enabled in development/test, routes strictly require authentication and officer/admin authorization.
 */
export const isMockCpgramsAllowed = (env = config.env, envVars = process.env) => {
  // Strict rule: NEVER allowed in production
  if (env === 'production') {
    return false;
  }
  // Non-production requires explicit opt-in
  return envVars.ENABLE_MOCK_CPGRAMS === 'true';
};

const secureMockCpgramsMount = express.Router();
if (isMockCpgramsAllowed()) {
  // When enabled in non-production, enforce authentication and supervisory roles
  secureMockCpgramsMount.use(authenticate, requireRole('officer', 'admin'), mockCpgramsRouter);
} else {
  // Disabled route returns clean 404
  secureMockCpgramsMount.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Mock CPGRAMS service is disabled in this environment'
    });
  });
}

// Version 1 Router (/api/v1/...)
const v1Router = express.Router();
v1Router.use('/health', healthRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/complaints', complaintRoutes);
v1Router.use('/departments', departmentRoutes);
v1Router.use('/incidents', incidentRoutes);
v1Router.use('/subtasks', subtaskRoutes);
v1Router.use('/neglect-radar', neglectRadarRoutes);
v1Router.use('/feedback', feedbackRoutes);
v1Router.use('/appeals', appealRoutes);
v1Router.use('/reopening-requests', reopeningRoutes);
v1Router.use('/spam-reviews', spamReviewRoutes);
v1Router.use('/citizen', spamReviewRoutes);
v1Router.use('/clarifications', clarificationRoutes);
v1Router.use('/reminders', reminderRoutes);
v1Router.use('/notifications', notificationRoutes);
v1Router.use('/historical-resolutions', historicalResolutionRoutes);
v1Router.use('/analytics', analyticsRoutes);
v1Router.use('/mock-cpgrams', secureMockCpgramsMount);

// Mount /api/v1
apiRouter.use('/v1', v1Router);

// Backward Compatibility Aliases (/api/...)
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/complaints', complaintRoutes);
apiRouter.use('/departments', departmentRoutes);
apiRouter.use('/incidents', incidentRoutes);
apiRouter.use('/subtasks', subtaskRoutes);
apiRouter.use('/neglect-radar', neglectRadarRoutes);
apiRouter.use('/feedback', feedbackRoutes);
apiRouter.use('/appeals', appealRoutes);
apiRouter.use('/reopening-requests', reopeningRoutes);
apiRouter.use('/spam-reviews', spamReviewRoutes);
apiRouter.use('/citizen', spamReviewRoutes);
apiRouter.use('/clarifications', clarificationRoutes);
apiRouter.use('/reminders', reminderRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/historical-resolutions', historicalResolutionRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/mock-cpgrams', secureMockCpgramsMount);

export default apiRouter;
