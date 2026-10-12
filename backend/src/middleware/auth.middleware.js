import rateLimit from 'express-rate-limit';
import config from '../config/app.config.js';
import authService from '../services/auth.service.js';

/**
 * Extract token from either HttpOnly session cookie or Authorization Bearer header
 */
export const extractToken = (req) => {
  if (req.cookies && req.cookies[config.auth.cookieName]) {
    return { token: req.cookies[config.auth.cookieName], source: 'cookie' };
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { token: authHeader.substring(7).trim(), source: 'header' };
  }

  return { token: null, source: null };
};

/**
 * Authentication middleware.
 * Verifies session token, checks CSRF for cookie-based state-modifying requests,
 * and attaches verified user identity to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    const { token, source } = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in.'
      });
    }

    const user = await authService.verifySessionToken(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid. Please log in again.'
      });
    }

    // CSRF Protection for state-changing requests when authenticated via browser cookie
    if (source === 'cookie' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const isAuthPath = req.baseUrl.includes('/auth') || req.path.includes('/auth');
      // Only enforce CSRF on non-auth paths or state-changing app paths
      if (!isAuthPath) {
        const csrfCookie = req.cookies?.[config.auth.csrfCookieName];
        const csrfHeader = req.headers['x-csrf-token'];
        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
          return res.status(403).json({
            success: false,
            error: 'Invalid or missing CSRF token'
          });
        }
      }
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication: attaches req.user if a valid token is present, but does not reject if absent.
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const { token } = extractToken(req);
    if (token) {
      const user = await authService.verifySessionToken(token);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch {
    next();
  }
};

/**
 * Role-Based Access Control middleware.
 * Guarantees that only users with one of the specified roles can proceed.
 * Strictly ignores any client-supplied headers like 'x-portal-role'.
 */
export const requireRole = (...allowedRoles) => {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied: role '${req.user.role}' is not authorized for this action`
      });
    }

    next();
  };
};

/**
 * Rate Limiter for authentication endpoints to prevent brute force attacks.
 */
export const createAuthRateLimiter = (customMax = null) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: customMax !== null
      ? customMax
      : (process.env.AUTH_RATE_LIMIT_MAX
        ? parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10)
        : (process.env.NODE_ENV === 'test' ? 100 : 15)),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many authentication attempts from this IP, please try again after 15 minutes'
    }
  });
};

export const authRateLimiter = createAuthRateLimiter();

/**
 * Rate Limiter for public tracking endpoints to prevent automated enumeration
 */
export const createTrackingRateLimiter = (customMax = null) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: customMax !== null
      ? customMax
      : (process.env.TRACKING_RATE_LIMIT_MAX
        ? parseInt(process.env.TRACKING_RATE_LIMIT_MAX, 10)
        : (process.env.NODE_ENV === 'test' ? 500 : 60)),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many tracking requests from this IP, please try again after 15 minutes'
    }
  });
};

export const trackingRateLimiter = createTrackingRateLimiter();

/**
 * Rate Limiter for complaint submission to prevent spamming
 */
export const createSubmissionRateLimiter = (customMax = null) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: customMax !== null
      ? customMax
      : (process.env.SUBMISSION_RATE_LIMIT_MAX
        ? parseInt(process.env.SUBMISSION_RATE_LIMIT_MAX, 10)
        : (process.env.NODE_ENV === 'test' ? 200 : 30)),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Grievance submission rate limit exceeded, please try again later'
    }
  });
};

export const submissionRateLimiter = createSubmissionRateLimiter();

export default {
  authenticate,
  optionalAuthenticate,
  requireRole,
  createAuthRateLimiter,
  authRateLimiter,
  createTrackingRateLimiter,
  trackingRateLimiter,
  createSubmissionRateLimiter,
  submissionRateLimiter,
  extractToken
};
