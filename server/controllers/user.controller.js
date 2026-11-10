const User = require('../models/User');
const jwt = require('jsonwebtoken');
const COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' };
async function getProfile(req, res, next) {
  try { const user = await User.findById(req.user._id); if (!user) return res.status(404).json({ success: false, message: 'User not found.' }); return res.json({ success: true, user: user.toPublicProfile() }); } catch (err) { next(err); }
}
async function updateProfile(req, res, next) {
  try {
    const body = req.body || {}; const allowed = ['name', 'currentPassword', 'newPassword'];
    const unexpected = Object.keys(body).find((key) => !allowed.includes(key));
    if (unexpected) return res.status(400).json({ success: false, message: 'Only your name and password can be changed here.' });
    const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (body.name !== undefined) { if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 80) return res.status(400).json({ success: false, message: 'Name must be between 2 and 80 characters.' }); user.name = body.name.trim(); }
    const changingPassword = body.currentPassword !== undefined || body.newPassword !== undefined;
    if (changingPassword) {
      if (!body.currentPassword || !body.newPassword) return res.status(400).json({ success: false, message: 'Enter both current and new passwords.' });
      if (typeof body.newPassword !== 'string' || body.newPassword.length < 8 || body.newPassword.length > 72) return res.status(400).json({ success: false, message: 'New password must be 8–72 characters.' });
      if (!(await user.comparePassword(body.currentPassword))) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      user.passwordHash = body.newPassword; user.tokenVersion += 1;
    }
    await user.save();
    if (changingPassword) { const token = jwt.sign({ id: user._id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }); res.cookie('token', token, COOKIE); }
    return res.json({ success: true, message: 'Profile updated successfully.', user: user.toPublicProfile() });
  } catch (err) { next(err); }
}
module.exports = { getProfile, updateProfile };
