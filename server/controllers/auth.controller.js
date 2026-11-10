const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { issueCsrfToken, cookieOptions } = require('../middleware/csrf.middleware');
const COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' };
const signToken = (user) => jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const setSession = (res, user) => { res.cookie('token', signToken(user), COOKIE); issueCsrfToken(res); };
const validPassword = (password) => typeof password === 'string' && password.length >= 8 && password.length <= 72;

async function register(req, res, next) {
  try {
    const { name, email, password, branch = '', year, section = '', rollNumber = '' } = req.body || {};
    if (!name?.trim() || !email?.trim() || !validPassword(password)) return res.status(400).json({ success: false, message: 'Name, valid email and password (8–72 characters) are required.' });
    if (name.trim().length < 2) return res.status(400).json({ success: false, message: 'Name must contain at least 2 characters.' });
    if (year !== undefined && year !== '' && (!Number.isInteger(Number(year)) || Number(year) < 1 || Number(year) > 4)) return res.status(400).json({ success: false, message: 'Year must be between 1 and 4.' });
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    // Public sign-up always creates a student. Never accept a role from the browser.
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash: password, role: 'student', branch, year: year ? Number(year) : undefined, section, rollNumber, department: branch });
    setSession(res, user);
    return res.status(201).json({ success: true, message: 'Your CampusFlow account has been created.', user: user.toPublicProfile() });
  } catch (err) { if (err.code === 11000) return res.status(409).json({ success: false, message: 'An account with this email already exists.' }); next(err); }
}
async function login(req, res, next) {
  try {
    const email = req.body?.email?.trim().toLowerCase(); const password = req.body?.password;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
    const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ success: false, message: 'Incorrect email or password.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Your account is inactive. Contact an administrator.' });
    setSession(res, user);
    return res.json({ success: true, message: 'Welcome back to CampusFlow.', user: user.toPublicProfile() });
  } catch (err) { next(err); }
}
function logout(_req, res) {
  res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', path: '/' });
  res.clearCookie('csrfToken', cookieOptions());
  return res.json({ success: true, message: 'You have been logged out.' });
}
function csrf(_req, res) { const csrfToken = issueCsrfToken(res); return res.json({ success: true, csrfToken }); }
function me(req, res) { return res.json({ success: true, user: req.user.toPublicProfile() }); }
module.exports = { register, login, logout, csrf, me };
