import express from 'express';
import { register, login, logout, getCurrentUser, getCsrfToken } from '../controllers/auth.controller.js';
import { authenticate, authRateLimiter } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public Authentication endpoints with rate limiting
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/logout', logout);

// CSRF Token generation endpoints (publicly accessible)
router.get('/csrf', getCsrfToken);
router.get('/csrf-token', getCsrfToken);

// Authenticated current-user identity check
router.get('/me', authenticate, getCurrentUser);

export default router;
