/**
 * Central Error-Handling Middleware for CivicSarthi Backend
 */
export const errorHandler = (err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[CivicSarthi Error]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    url: req.originalUrl,
    method: req.method
  });

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

/**
 * 404 Route Not Found Middleware
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
};
