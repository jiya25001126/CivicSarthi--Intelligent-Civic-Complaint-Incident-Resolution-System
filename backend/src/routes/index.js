import express from 'express';
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
import { mockCpgramsRouter } from '../../../mock-cpgrams/index.js';

const apiRouter = express.Router();

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
v1Router.use('/mock-cpgrams', mockCpgramsRouter);

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
apiRouter.use('/mock-cpgrams', mockCpgramsRouter);

export default apiRouter;
