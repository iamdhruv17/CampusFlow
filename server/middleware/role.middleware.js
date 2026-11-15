/**
 * Role-based access control middleware factory.
 * Usage: authorize('admin', 'hod') — allows users with any of the listed roles.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
};

/**
 * Staff-only guard (any non-student role)
 */
const staffOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  if (req.user.role === 'student') {
    return res.status(403).json({ success: false, message: 'Access denied. Staff only.' });
  }
  next();
};

module.exports = { authorize, staffOnly };
