/**
 * Central Error-Handling Middleware for CivicSarthi Backend
 */
export const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  let statusCode = err.status || err.statusCode || 500;

  // Mongoose / Schema validation errors default to 400 Bad Request instead of 500 Internal Server Error
  if (err.name === 'ValidationError' && !err.status && !err.statusCode) {
    statusCode = 400;
    if (!err.code) err.code = 'VALIDATION_ERROR';
    if (!err.details && err.errors) {
      err.details = Object.values(err.errors).map((e) => e.message || String(e));
    }
  } else if (err.name === 'CastError' && !err.status && !err.statusCode) {
    statusCode = 400;
    if (!err.code) err.code = 'INVALID_IDENTIFIER';
  }

  // Internal server error log
  // eslint-disable-next-line no-console
  console.error('[CivicSarthi Error]', {
    message: err.message,
    status: statusCode,
    stack: isProduction ? undefined : err.stack,
    url: req.originalUrl,
    method: req.method
  });

  // Security: In production, 500+ errors must not reveal file paths, credentials, or internal stacks
  let clientMessage = err.message || 'Internal Server Error';
  if (isProduction && statusCode >= 500) {
    clientMessage = 'Internal Server Error';
  }

  const responseBody = {
    success: false,
    error: clientMessage
  };

  if (!isProduction && err.stack) {
    responseBody.stack = err.stack;
  }
  if (err.allowed) {
    responseBody.allowed = err.allowed;
  }
  if (err.details && (!isProduction || statusCode < 500)) {
    responseBody.details = err.details;
  }
  if (err.code) {
    responseBody.code = err.code;
  }

  res.status(statusCode).json(responseBody);
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
