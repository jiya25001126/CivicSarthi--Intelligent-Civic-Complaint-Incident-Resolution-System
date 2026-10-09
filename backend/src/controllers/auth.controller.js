import config from '../config/app.config.js';
import authService from '../services/auth.service.js';

const isProduction = config.env === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

const csrfCookieOptions = {
  httpOnly: false, // Must be readable by client script to send in x-csrf-token header
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000
};

export const register = async (req, res, next) => {
  try {
    const { user, token, csrfToken } = await authService.register(req.body);

    res.cookie(config.auth.cookieName, token, cookieOptions);
    res.cookie(config.auth.csrfCookieName, csrfToken, csrfCookieOptions);

    res.status(201).json({
      success: true,
      message: 'Citizen account registered successfully',
      data: {
        user,
        token,
        csrfToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { user, token, csrfToken } = await authService.login(req.body);

    res.cookie(config.auth.cookieName, token, cookieOptions);
    res.cookie(config.auth.csrfCookieName, csrfToken, csrfCookieOptions);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token,
        csrfToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (req, res) => {
  res.clearCookie(config.auth.cookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  });

  res.clearCookie(config.auth.csrfCookieName, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

export const getCurrentUser = (req, res) => {
  const csrfToken = req.cookies?.[config.auth.csrfCookieName] || authService.generateCsrfToken();
  res.cookie(config.auth.csrfCookieName, csrfToken, csrfCookieOptions);

  res.json({
    success: true,
    data: req.user,
    csrfToken
  });
};

export default {
  register,
  login,
  logout,
  getCurrentUser
};
