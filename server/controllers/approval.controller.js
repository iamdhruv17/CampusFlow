const mongoose = require('mongoose');
const { AcademicRequest } = require('../models/AcademicRequest');
const STAGES = ['mentor', 'coordinator', 'hod', 'dean'];
const STAFF_ROLES = [...STAGES, 'teacher'];
const canReview = (role, stage) => role === stage || (role === 'teacher' && stage === 'mentor');

async function listAssigned(req, res, next) {
  try {
    if (!STAFF_ROLES.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Faculty accounts only.' });
    const stage = req.user.role === 'teacher' ? 'mentor' : req.user.role;
    const requests = await AcademicRequest.find({ status: { $in: ['submitted', 'under_review'] }, $or: [{ 'workflow.currentStage': stage }, { workflow: { $exists: false } }] })
      .select('+workflow').populate('requester', 'name email department branch rollNumber').sort({ lastSubmittedAt: 1 }).lean();
    return res.json({ success: true, requests });
  } catch (error) { next(error); }
}

async function getAssignedDetail(req, res, next) {
  try {
    if (!STAFF_ROLES.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Faculty accounts only.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    const request = await AcademicRequest.findById(req.params.id).select('+workflow').populate('requester', 'name email department branch rollNumber').lean();
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    const stage = request.workflow?.currentStage || 'mentor';
    if (!canReview(req.user.role, stage) || !['submitted', 'under_review'].includes(request.status)) return res.status(403).json({ success: false, message: 'This request is not assigned to your approval stage.' });
    return res.json({ success: true, request });
  } catch (error) { next(error); }
}

async function decideRequest(req, res, next) {
  try {
    if (!STAFF_ROLES.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Faculty accounts only.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    const { decision, remarks = '' } = req.body || {};
    if (!['approved', 'returned', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Decision must be approved, returned or rejected.' });
    if (typeof remarks !== 'string' || remarks.trim().length > 1000) return res.status(400).json({ success: false, message: 'Remarks must be 1000 characters or fewer.' });
    if (decision !== 'approved' && remarks.trim().length < 3) return res.status(400).json({ success: false, message: 'Please provide remarks for a returned or rejected request.' });
    const request = await AcademicRequest.findById(req.params.id).select('+workflow');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    const stage = request.workflow?.currentStage || 'mentor';
    if (!canReview(req.user.role, stage) || !['submitted', 'under_review'].includes(request.status)) return res.status(403).json({ success: false, message: 'This request is not assigned to your approval stage.' });
    if (!request.workflow) request.workflow = { currentStage: 'mentor', history: [] };
    request.workflow.history.push({ actor: req.user._id, actorName: req.user.name, actorRole: req.user.role, decision, remarks: remarks.trim(), stage, decidedAt: new Date() });
    if (decision === 'returned' || decision === 'rejected') request.status = decision;
    else {
      const nextIndex = STAGES.indexOf(stage) + 1;
      if (nextIndex >= STAGES.length) { request.status = 'approved'; request.workflow.currentStage = 'completed'; }
      else { request.status = 'under_review'; request.workflow.currentStage = STAGES[nextIndex]; }
    }
    await request.save();
    return res.json({ success: true, message: decision === 'approved' ? (request.status === 'approved' ? 'Request approved at all stages.' : `Request forwarded to ${request.workflow.currentStage}.`) : `Request ${decision}.`, request: request.toObject() });
  } catch (error) { next(error); }
}

async function getApprovalHistory(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid request identifier.' });
    const request = await AcademicRequest.findById(req.params.id).select('+workflow').populate('requester', 'name email').lean();
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    const isOwner = String(request.requester?._id || request.requester) === String(req.user._id);
    if (!isOwner && !STAFF_ROLES.includes(req.user.role) && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Not authorized to view this history.' });
    if (!isOwner && STAFF_ROLES.includes(req.user.role)) {
      const stage = request.workflow?.currentStage || 'mentor';
      if (!canReview(req.user.role, stage) && !(request.workflow?.history || []).some((item) => String(item.actor) === String(req.user._id))) return res.status(403).json({ success: false, message: 'Not authorized to view this history.' });
    }
    return res.json({ success: true, history: request.workflow?.history || [], currentStage: request.workflow?.currentStage || 'mentor', status: request.status });
  } catch (error) { next(error); }
}
module.exports = { listAssigned, getAssignedDetail, decideRequest, getApprovalHistory };
