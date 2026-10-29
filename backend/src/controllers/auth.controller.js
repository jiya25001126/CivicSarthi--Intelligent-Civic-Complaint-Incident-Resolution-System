import config from '../config/app.config.js';
import authService from '../services/auth.service.js';

const isProduction = config.env === 'production';

export const getCookieOptions = (isSessionCookie = true) => ({
  httpOnly: Boolean(isSessionCookie),
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
});

export const getClearCookieOptions = (isSessionCookie = true) => ({
  httpOnly: Boolean(isSessionCookie),
  secure: isProduction,
  sameSite: 'lax',
  path: '/'
});

export const register = async (req, res, next) => {
  try {
    const { user, token, csrfToken } = await authService.register(req.body);

    res.cookie(config.auth.cookieName, token, getCookieOptions(true));
    res.cookie(config.auth.csrfCookieName, csrfToken, getCookieOptions(false));

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

    res.cookie(config.auth.cookieName, token, getCookieOptions(true));
    res.cookie(config.auth.csrfCookieName, csrfToken, getCookieOptions(false));

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
  res.clearCookie(config.auth.cookieName, getClearCookieOptions(true));
  res.clearCookie(config.auth.csrfCookieName, getClearCookieOptions(false));

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

export const getCurrentUser = (req, res) => {
  const csrfToken = req.cookies?.[config.auth.csrfCookieName] || authService.generateCsrfToken();
  res.cookie(config.auth.csrfCookieName, csrfToken, getCookieOptions(false));

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
  getCurrentUser,
  getCookieOptions,
  getClearCookieOptions
};
