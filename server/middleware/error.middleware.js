/**
 * Centralized error handling middleware.
 * Must be registered last in Express app.
 */
const errorHandler = (err, req, res, next) => {
  // Log error internally (never expose raw stack in production)
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error]', err);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join('. ') });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `An account with this ${field} already exists.`,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format.' });
  }

  // Multer / File Validation error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5 MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'A request may include no more than 5 supporting documents.',
    });
  }
  if (
    err.message &&
    (err.message.includes('Only PDF') ||
      err.message.includes('Invalid file content') ||
      err.message.includes('Unsupported file extension') ||
      err.message.includes('Unsupported MIME type') ||
      err.message.includes('File exceeds the 5 MB'))
  ) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Default
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error.'
      : err.message || 'Internal server error.';

  res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;
