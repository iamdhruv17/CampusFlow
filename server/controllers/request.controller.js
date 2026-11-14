const mongoose = require('mongoose');
const { AcademicRequest } = require('../models/AcademicRequest');
const { validateRequestInput } = require('../utils/requestValidation');

function studentOnly(req, res) {
  if (req.user?.role !== 'student') {
    res.status(403).json({ success: false, message: 'Only student accounts can manage student academic requests.' });
    return false;
  }
  return true;
}

async function createRequest(req, res, next) {
  try {
    if (!studentOnly(req, res)) return;
    const result = validateRequestInput(req.body);
    if (!result.valid) return res.status(400).json({ success: false, message: result.errors.join(' '), errors: result.errors });

    // Requester identity is always derived from the authenticated session, never the request body.
    const request = await AcademicRequest.create({ ...result.value, requester: req.user._id });
    return res.status(201).json({ success: true, message: 'Your academic request has been submitted.', request });
  } catch (error) { next(error); }
}

async function listMyRequests(req, res, next) {
  try {
    if (!studentOnly(req, res)) return;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const filter = { requester: req.user._id };
    if (req.query.status && ['submitted', 'under_review', 'returned', 'approved', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
    const [requests, total] = await Promise.all([
      AcademicRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AcademicRequest.countDocuments(filter),
    ]);
    return res.json({ success: true, requests, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
}

async function getRequestSummary(req, res, next) {
  try {
    if (!studentOnly(req, res)) return;
    const rows = await AcademicRequest.aggregate([
      { $match: { requester: new mongoose.Types.ObjectId(req.user._id) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const summary = { total: 0, submitted: 0, under_review: 0, returned: 0, approved: 0, rejected: 0 };
    for (const row of rows) { summary[row._id] = row.count; summary.total += row.count; }
    return res.json({ success: true, summary });
  } catch (error) { next(error); }
}

async function getRequestById(req, res, next) {
  try {
    if (!studentOnly(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    const request = await AcademicRequest.findOne({ _id: req.params.id, requester: req.user._id }).lean();
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    return res.json({ success: true, request });
  } catch (error) { next(error); }
}

async function resubmitRequest(req, res, next) {
  try {
    if (!studentOnly(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    const unexpected = Object.keys(req.body || {}).filter((key) => !['category', 'title', 'description'].includes(key));
    if (unexpected.length) return res.status(400).json({ success: false, message: 'Only category, title and description can be updated when resubmitting.' });
    const result = validateRequestInput(req.body);
    if (!result.valid) return res.status(400).json({ success: false, message: result.errors.join(' '), errors: result.errors });

    // Atomic ownership + returned-status filter prevents editing another student's or active request.
    const request = await AcademicRequest.findOneAndUpdate(
      { _id: req.params.id, requester: req.user._id, status: 'returned' },
      { $set: { ...result.value, status: 'submitted', lastSubmittedAt: new Date(), 'workflow.currentStage': 'mentor' }, $inc: { resubmissionCount: 1 } },
      { new: true, runValidators: true },
    );
    if (!request) {
      const owned = await AcademicRequest.exists({ _id: req.params.id, requester: req.user._id });
      if (!owned) return res.status(404).json({ success: false, message: 'Request not found.' });
      return res.status(409).json({ success: false, message: 'Only returned requests can be resubmitted.' });
    }
    return res.json({ success: true, message: 'Your request has been resubmitted.', request });
  } catch (error) { next(error); }
}

module.exports = { createRequest, listMyRequests, getRequestSummary, getRequestById, resubmitRequest };
