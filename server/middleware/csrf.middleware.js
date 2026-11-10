const crypto = require('crypto');
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const cookieOptions = () => ({ httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrfToken', token, cookieOptions());
  return token;
}
function requireCsrfToken(req, res, next) {
  if (SAFE.has(req.method) || !req.cookies?.token) return next();
  const cookie = req.cookies?.csrfToken;
  const header = req.get('x-csrf-token');
  if (!cookie || !header || cookie.length !== header.length || !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token. Refresh and try again.' });
  }
  next();
}
module.exports = { issueCsrfToken, requireCsrfToken, cookieOptions };
