const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../utils/apiResponse');

router.get('/profile', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    sendSuccess(res, 200, 'Profile retrieved.', { user });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', protect, async (req, res, next) => {
  try {
    const body = req.body || {};
    const protectedFields = [
      'role',
      'branch',
      'year',
      'section',
      'rollNumber',
      'department',
      'assignedSubjects',
      'assignedClass',
      'mentoringClasses',
      'headOfDepartments',
      'isActive',
    ];
    const attemptedProtectedField = protectedFields.find((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    );
    if (attemptedProtectedField) {
      return sendError(
        res,
        400,
        'Academic details and protected account settings can only be changed by an administrator.'
      );
    }

    const allowedFields = ['name', 'currentPassword', 'newPassword'];
    const unexpectedField = Object.keys(body).find((field) => !allowedFields.includes(field));
    if (unexpectedField) {
      return sendError(res, 400, 'Only your name and password can be updated through the profile endpoint.');
    }

    const user = await User.findById(req.user._id).select('+tokenVersion');
    if (!user) return sendError(res, 404, 'User not found.');

    if (body.name !== undefined) user.name = body.name;

    const passwordChangeRequested =
      Object.prototype.hasOwnProperty.call(body, 'currentPassword') ||
      Object.prototype.hasOwnProperty.call(body, 'newPassword');
    if (passwordChangeRequested) {
      if (!body.currentPassword || !body.newPassword) {
        return sendError(res, 400, 'Current and new passwords are both required.');
      }

      const userWithPassword = await User.findById(req.user._id).select('+passwordHash');
      const isMatch = await userWithPassword.comparePassword(body.currentPassword);
      if (!isMatch) return sendError(res, 400, 'Current password is incorrect.');
      user.passwordHash = body.newPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await user.save();
    const updatedUser = await User.findById(user._id).select('-passwordHash');
    sendSuccess(res, 200, 'Profile updated.', { user: updatedUser });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
