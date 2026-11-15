const mongoose = require('mongoose');

const REQUEST_TYPES = [
  'attendance_correction',
  'event_attendance',
  'medical_leave',
  'other_grievance',
];

const REQUEST_STATUSES = [
  'pending',
  'under_review',
  'approved',
  'rejected',
  'returned',
];

const APPROVAL_STAGES = [
  'teacher',
  'coordinator',
  'mentor',
  'hod',
  'dean',
  'completed',
  'rejected',
];

const requestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestType: {
      type: String,
      enum: REQUEST_TYPES,
      required: [true, 'Request type is required'],
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'pending',
    },
    currentApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    currentApprovalStage: {
      type: String,
      enum: APPROVAL_STAGES,
      default: 'teacher',
    },

    // --- Attendance Correction fields ---
    subject: { type: String, trim: true },
    subjectCode: { type: String, trim: true },
    attendanceDate: { type: Date },
    lectureNumber: { type: String, trim: true },

    // --- Event Attendance fields ---
    eventName: { type: String, trim: true },
    eventDate: { type: Date },
    eventOrganizer: { type: String, trim: true },
    participationDetails: { type: String, trim: true },

    // --- Medical Leave fields ---
    leaveStartDate: { type: Date },
    leaveEndDate: { type: Date },
    medicalDescription: { type: String, trim: true },

    // --- Other Grievance fields ---
    grievanceCategory: { type: String, trim: true },
    targetDepartment: { type: String, trim: true },

    // --- Common fields ---
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
    },

    // Student academic info snapshot (so it shows correctly even if user edits profile)
    requesterInfo: {
      name: String,
      email: String,
      branch: String,
      year: Number,
      section: String,
      rollNumber: String,
      department: String,
    },

    // File references
    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FileRecord',
      },
    ],

    submittedAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: { type: Date },

    // Track if this is a resubmission
    resubmissionCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

requestSchema.index({ requesterId: 1, status: 1 });
requestSchema.index({ currentApproverId: 1, status: 1 });

module.exports = mongoose.model('Request', requestSchema);
