const jwt = require('jsonwebtoken');
const User = require('../models/User');
async function protect(req, res, next) {
  try {
    const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select('+tokenVersion');
    if (!user) return res.status(401).json({ success: false, message: 'Account no longer exists.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Your account is inactive. Contact an administrator.' });
    if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) return res.status(401).json({ success: false, message: 'Your session has expired. Please log in again.' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Your session is invalid or expired. Please log in again.' });
    next(err);
  }
}
module.exports = { protect };
