import express from 'express';
import healthRoutes from './health.routes.js';
import complaintRoutes from './complaint.routes.js';
import departmentRoutes from './department.routes.js';
import { mockCpgramsRouter } from '../../../mock-cpgrams/index.js';

const apiRouter = express.Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/complaints', complaintRoutes);
apiRouter.use('/departments', departmentRoutes);

// Isolated mock CPGRAMS router mounted for sandbox simulation
apiRouter.use('/mock-cpgrams', mockCpgramsRouter);

export default apiRouter;
