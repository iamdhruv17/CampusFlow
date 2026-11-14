const mongoose = require('mongoose');
const { REQUEST_CATEGORIES, REQUEST_STATUSES } = require('../utils/requestConstants');
const academicRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: REQUEST_CATEGORIES, required: true },
  title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
  description: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
  // Member 3 owns review decisions and will update this field through the approval workflow.
  status: { type: String, enum: REQUEST_STATUSES, default: 'submitted', index: true },
  submittedAt: { type: Date, default: Date.now },
  lastSubmittedAt: { type: Date, default: Date.now },
  resubmissionCount: { type: Number, default: 0, min: 0 },
  // Reserved for the future approval workflow; not writable through student endpoints.
  workflow: {
    currentStage: { type: String, enum: ['mentor', 'coordinator', 'hod', 'dean', 'completed'], default: 'mentor' },
    history: [{ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, actorName: String, actorRole: String, decision: { type: String, enum: ['approved', 'returned', 'rejected'], required: true }, remarks: { type: String, default: '' }, stage: String, decidedAt: { type: Date, default: Date.now } }],
  },
}, { timestamps: true });

academicRequestSchema.index({ requester: 1, createdAt: -1 });
academicRequestSchema.index({ requester: 1, status: 1 });

module.exports = {
  AcademicRequest: mongoose.model('AcademicRequest', academicRequestSchema),
  REQUEST_CATEGORIES,
  REQUEST_STATUSES,
};
