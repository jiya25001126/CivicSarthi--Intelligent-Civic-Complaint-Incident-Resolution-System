import express from 'express';
import { getHealth, getLiveness, getReadiness } from '../controllers/health.controller.js';

const router = express.Router();
router.get('/', getHealth);
router.get('/live', getLiveness);
router.get('/ready', getReadiness);

export default router;

