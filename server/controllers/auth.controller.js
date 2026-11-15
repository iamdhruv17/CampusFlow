const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { notifyStudent } = require('../services/notification.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { issueCsrfToken, cookieOptions } = require('../middleware/csrf.middleware');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const signToken = (userId, tokenVersion = 0) => {
  return jwt.sign({ id: userId, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// POST /api/auth/register  — students only
const register = async (req, res, next) => {
  try {
    const { name, email, password, branch, year, section, rollNumber, department } = req.body;

    // Role is ALWAYS 'student' on public registration — never trust client input
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return sendError(res, 409, 'An account with this email already exists.');
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password, // will be hashed by pre-save hook
      role: 'student',         // hardcoded — cannot be overridden
      branch,
      year: Number(year),
      section,
      rollNumber,
      department: department || branch,
    });

    // Welcome notification
    await notifyStudent(
      { requesterId: user._id, _id: null },
      `Welcome to CampusFlow, ${name}! You can now submit academic requests.`,
      'general'
    ).catch(() => {});

    const token = signToken(user._id, user.tokenVersion);
    res.cookie('token', token, COOKIE_OPTIONS);
    issueCsrfToken(res);

    sendSuccess(res, 201, 'Registration successful.', { user: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required.');
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +tokenVersion');
    if (!user) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Account is deactivated. Please contact the administrator.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid email or password.');
    }

    const token = signToken(user._id, user.tokenVersion);
    res.cookie('token', token, COOKIE_OPTIONS);
    issueCsrfToken(res);

    sendSuccess(res, 200, 'Login successful.', { user: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.clearCookie('csrfToken', cookieOptions());
  sendSuccess(res, 200, 'Logged out successfully.');
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = typeof req.user.toPublicProfile === 'function'
      ? req.user.toPublicProfile()
      : req.user;
    delete user.passwordHash;
    delete user.tokenVersion;
    sendSuccess(res, 200, 'User retrieved.', { user });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, logout, getMe };
