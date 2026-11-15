const Request = require('../models/Request');
const workflowService = require('../services/workflow.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const getAssignedRequest = async (id, user) => {
  const request = await Request.findById(id);
  if (!request) return null;

  if (!['pending', 'under_review'].includes(request.status)) {
    return { completed: true, request };
  }
  if (
    !request.currentApproverId ||
    request.currentApproverId.toString() !== user._id.toString()
  ) {
    return { denied: true };
  }
  return { request };
};

const approveRequest = async (req, res, next) => {
  try {
    const result = await getAssignedRequest(req.params.id, req.user);
    if (!result) return sendError(res, 404, 'Request not found.');
    if (result.denied) {
      return sendError(res, 403, 'You are not authorized to approve this request.');
    }
    if (result.completed) {
      return sendError(res, 400, `Request is already ${result.request.status}.`);
    }

    const updated = await workflowService.processApprove(
      result.request,
      req.user,
      typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : ''
    );
    const populated = await Request.findById(updated._id)
      .populate('requesterId', 'name email')
      .populate('currentApproverId', 'name role');
    sendSuccess(res, 200, 'Request approved.', { request: populated });
  } catch (error) {
    next(error);
  }
};

const rejectRequest = async (req, res, next) => {
  try {
    const result = await getAssignedRequest(req.params.id, req.user);
    if (!result) return sendError(res, 404, 'Request not found.');
    if (result.denied) {
      return sendError(res, 403, 'You are not authorized to reject this request.');
    }
    if (result.completed) {
      return sendError(res, 400, `Request is already ${result.request.status}.`);
    }
    if (typeof req.body?.remarks !== 'string' || req.body.remarks.trim() === '') {
      return sendError(res, 400, 'Remarks are required when rejecting a request.');
    }

    const updated = await workflowService.processReject(
      result.request,
      req.user,
      req.body.remarks.trim()
    );
    const populated = await Request.findById(updated._id)
      .populate('requesterId', 'name email')
      .populate('currentApproverId', 'name role');
    sendSuccess(res, 200, 'Request rejected.', { request: populated });
  } catch (error) {
    next(error);
  }
};

const returnRequest = async (req, res, next) => {
  try {
    const result = await getAssignedRequest(req.params.id, req.user);
    if (!result) return sendError(res, 404, 'Request not found.');
    if (result.denied) {
      return sendError(res, 403, 'You are not authorized to return this request.');
    }
    if (result.completed) {
      return sendError(res, 400, `Request is already ${result.request.status}.`);
    }
    if (typeof req.body?.remarks !== 'string' || req.body.remarks.trim() === '') {
      return sendError(res, 400, 'Remarks are required when returning a request.');
    }

    const updated = await workflowService.processReturn(
      result.request,
      req.user,
      req.body.remarks.trim()
    );
    const populated = await Request.findById(updated._id)
      .populate('requesterId', 'name email')
      .populate('currentApproverId', 'name role');
    sendSuccess(res, 200, 'Request returned for correction.', { request: populated });
  } catch (error) {
    next(error);
  }
};

const escalateRequest = async (req, res, next) => {
  try {
    const result = await getAssignedRequest(req.params.id, req.user);
    if (!result) return sendError(res, 404, 'Request not found.');
    if (result.denied) return sendError(res, 403, 'You are not authorized to escalate this request.');
    if (result.completed) return sendError(res, 409, `Request is already ${result.request.status}.`);
    if (typeof req.body?.remarks !== 'string' || req.body.remarks.trim() === '') {
      return sendError(res, 400, 'Remarks are required when escalating a grievance.');
    }

    const updated = await workflowService.processEscalate(
      result.request,
      req.user,
      req.body.remarks.trim()
    );
    const populated = await Request.findById(updated._id)
      .populate('requesterId', 'name email')
      .populate('currentApproverId', 'name role');
    sendSuccess(res, 200, 'Grievance escalated to the HOD.', { request: populated });
  } catch (error) {
    next(error);
  }
};

module.exports = { approveRequest, rejectRequest, returnRequest, escalateRequest };
