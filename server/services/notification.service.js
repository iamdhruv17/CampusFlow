const Notification = require('../models/Notification');

/**
 * Create a notification for a user.
 */
const createNotification = async ({ userId, requestId, message, type }) => {
  try {
    await Notification.create({ userId, requestId, message, type });
  } catch (err) {
    // Notifications are non-critical — log but don't crash the workflow
    console.error('[Notifications] Failed to create notification:', err.message);
  }
};

/**
 * Notify the student about a status update on their request.
 */
const notifyStudent = async (request, message, type) => {
  await createNotification({
    userId: request.requesterId,
    requestId: request._id,
    message,
    type,
  });
};

/**
 * Notify an approver that a request has been assigned to them.
 */
const notifyApprover = async (approverId, request, message) => {
  await createNotification({
    userId: approverId,
    requestId: request._id,
    message,
    type: 'request_assigned',
  });
};

module.exports = { createNotification, notifyStudent, notifyApprover };
