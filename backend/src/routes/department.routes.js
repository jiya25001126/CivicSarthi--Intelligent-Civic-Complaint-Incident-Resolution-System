import express from 'express';
import { listDepartments } from '../controllers/department.controller.js';

const router = express.Router();

router.get('/', listDepartments);

export default router;
