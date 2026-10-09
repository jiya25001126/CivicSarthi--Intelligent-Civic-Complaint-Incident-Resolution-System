import express from 'express';
import healthRoutes from './health.routes.js';
import complaintRoutes from './complaint.routes.js';
import departmentRoutes from './department.routes.js';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin.routes.js';
import { mockCpgramsRouter } from '../../../mock-cpgrams/index.js';

const apiRouter = express.Router();

// Version 1 Router (/api/v1/...)
const v1Router = express.Router();
v1Router.use('/health', healthRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/complaints', complaintRoutes);
v1Router.use('/departments', departmentRoutes);
v1Router.use('/mock-cpgrams', mockCpgramsRouter);

// Mount /api/v1
apiRouter.use('/v1', v1Router);

// Backward Compatibility Aliases (/api/...)
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/complaints', complaintRoutes);
apiRouter.use('/departments', departmentRoutes);
apiRouter.use('/mock-cpgrams', mockCpgramsRouter);

export default apiRouter;
