import express from 'express';
import { register, login, logout, getCurrentUser } from '../controllers/auth.controller.js';
import { authenticate, authRateLimiter } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public Authentication endpoints with rate limiting
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/logout', logout);

// Authenticated current-user identity check
router.get('/me', authenticate, getCurrentUser);

export default router;
