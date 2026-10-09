import express from 'express';
import { listDepartments, getDepartment } from '../controllers/department.controller.js';

const router = express.Router();

router.get('/', listDepartments);
router.get('/:id', getDepartment);

export default router;
