const mongoose = require('mongoose');

const approvalHistorySchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    actorName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'returned', 'resubmitted', 'forwarded', 'escalated'],
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    previousStage: {
      type: String,
      default: null,
    },
    nextStage: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Disable updates on this collection to protect audit trail integrity
    timestamps: false,
  }
);

// Make the collection append-only from application perspective
// (enforced by never calling update/delete in services)
approvalHistorySchema.index({ requestId: 1, timestamp: 1 });

module.exports = mongoose.model('ApprovalHistory', approvalHistorySchema);
