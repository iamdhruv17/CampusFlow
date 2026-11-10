module.exports = function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: Object.values(err.errors).map((e) => e.message).join(', ') });
  if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid identifier.' });
  return res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message || 'Internal server error.' });
};
