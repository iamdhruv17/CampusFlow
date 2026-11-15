const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const ApprovalHistory = require('../models/ApprovalHistory');
const { protect } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const { authorize } = require('../middleware/role.middleware');
const { uploadFile, tryDeleteFileRecord } = require('../services/storage.service');
const workflowService = require('../services/workflow.service');
const { notifyStudent, notifyApprover } = require('../services/notification.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const {
  approveRequest,
  rejectRequest,
  returnRequest,
  escalateRequest,
} = require('../controllers/request.controller');

const REQUEST_TYPES = new Set([
  'attendance_correction',
  'event_attendance',
  'medical_leave',
  'other_grievance',
]);

const isValidDate = (value) => {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const dateValue = (value) =>
  value instanceof Date ? value.getTime() : new Date(`${value}T00:00:00.000Z`).getTime();

const validateRequestFields = (requestType, fields) => {
  if (!REQUEST_TYPES.has(requestType)) {
    return 'Unsupported request type. Choose Attendance Correction, Event Attendance, Medical Leave, or Other Academic Grievance.';
  }
  if (typeof fields.description !== 'string' || fields.description.trim().length < 10) {
    return 'Description is required and must be at least 10 characters long.';
  }

  const requiredTextFields = {
    attendance_correction: ['subject'],
    event_attendance: ['eventName'],
    medical_leave: [],
    other_grievance: ['grievanceCategory'],
  }[requestType];
  for (const field of requiredTextFields) {
    if (typeof fields[field] !== 'string' || !fields[field].trim()) {
      return `${field} is required for this request type.`;
    }
  }
  if (
    requestType === 'other_grievance' &&
    fields.targetDepartment !== undefined &&
    fields.targetDepartment !== null &&
    typeof fields.targetDepartment !== 'string'
  ) {
    return 'targetDepartment must be a department name.';
  }

  const requiredDates = {
    attendance_correction: ['attendanceDate'],
    event_attendance: ['eventDate'],
    medical_leave: ['leaveStartDate', 'leaveEndDate'],
    other_grievance: [],
  }[requestType];
  for (const field of requiredDates) {
    if (!fields[field]) return `${field} is required for this request type.`;
    if (!isValidDate(fields[field])) return `${field} must be a valid calendar date.`;
  }

  if (
    requestType === 'medical_leave' &&
    dateValue(fields.leaveStartDate) > dateValue(fields.leaveEndDate)
  ) {
    return 'Leave end date must be on or after the leave start date.';
  }
  return null;
};

const requestFieldsByType = {
  attendance_correction: ['subject', 'subjectCode', 'attendanceDate', 'lectureNumber'],
  event_attendance: [
    'subject',
    'eventName',
    'eventDate',
    'eventOrganizer',
    'participationDetails',
  ],
  medical_leave: ['leaveStartDate', 'leaveEndDate', 'medicalDescription'],
  other_grievance: ['grievanceCategory', 'targetDepartment'],
};

router.get('/stats', protect, async (req, res, next) => {
  try {
    let matchFilter = {};
    const isStaff = !['student', 'admin'].includes(req.user.role);

    if (req.user.role === 'student') {
      matchFilter.requesterId = req.user._id;
    } else if (req.user.role !== 'admin') {
      const historicalIds = await ApprovalHistory.distinct('requestId', {
        actorId: req.user._id,
      });
      matchFilter = {
        $or: [
          { currentApproverId: req.user._id },
          { _id: { $in: historicalIds } },
        ],
      };
    }

    const [total, pending, approved, rejected, returned, under_review] = await Promise.all([
      Request.countDocuments(matchFilter),
      Request.countDocuments({
        ...(isStaff ? { currentApproverId: req.user._id } : matchFilter),
        status: 'pending',
      }),
      Request.countDocuments({ ...matchFilter, status: 'approved' }),
      Request.countDocuments({ ...matchFilter, status: 'rejected' }),
      Request.countDocuments({ ...matchFilter, status: 'returned' }),
      Request.countDocuments({
        ...(isStaff ? { currentApproverId: req.user._id } : matchFilter),
        status: 'under_review',
      }),
    ]);

    sendSuccess(res, 200, 'Stats retrieved.', {
      stats: { total, pending, approved, rejected, returned, under_review },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', protect, authorize('student'), upload.array('files', 5), async (req, res, next) => {
  try {
    const requester = req.user;
    const body = req.body || {};
    const { requestType, description } = body;

    const validationError = validateRequestFields(requestType, body);
    if (validationError) return sendError(res, 400, validationError);
    if (requestType === 'medical_leave' && (!req.files || req.files.length === 0)) {
      return sendError(res, 400, 'Medical leave requests require at least one supporting document.');
    }

    const requestData = {
      requesterId: requester._id,
      requestType,
      description,
      requesterInfo: {
        name: requester.name,
        email: requester.email,
        branch: requester.branch,
        year: requester.year,
        section: requester.section,
        rollNumber: requester.rollNumber,
        department: requester.department,
      },
      status: 'pending',
    };

    for (const field of requestFieldsByType[requestType]) {
      if (body[field] !== undefined) {
        requestData[field] =
          typeof body[field] === 'string' ? body[field].trim() : body[field];
      }
    }
    requestData.description = description.trim();

    // Resolve the initial approver before creating the request or uploading files.
    let route;
    try {
      route = await workflowService.routeNewRequest(requestData, requester);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.statusCode, error.message);
      }
      return next(error);
    }

    const { approver, stage } = route || {};
    if (!approver || !approver._id || approver.isActive !== true || !stage) {
      const stageLabels = {
        teacher: 'subject teacher',
        coordinator: 'Class Coordinator',
        mentor: 'Mentor',
        hod: 'HOD',
        dean: 'Dean',
      };
      return sendError(
        res,
        503,
        `No active ${stageLabels[stage] || 'approver'} is available to review this request. Contact the administrator before proceeding.`
      );
    }
    requestData.currentApproverId = approver._id;
    requestData.currentApprovalStage = stage;
    requestData.status = 'under_review';

    const request = await Request.create(requestData);
    const fileIds = [];

    try {
      for (const file of req.files || []) {
        const record = await uploadFile({
          buffer: file.buffer,
          mimetype: file.mimetype,
          originalname: file.originalname,
          uploaderId: requester._id,
          requestId: request._id,
        });
        fileIds.push(record._id);
      }

      request.attachments = fileIds;
      await workflowService.saveRequestWithHistory(request, {
        requestId: request._id,
        actorId: requester._id,
        actorRole: requester.role,
        actorName: requester.name,
        action: 'submitted',
        previousStage: null,
        nextStage: stage,
      });
    } catch (error) {
      for (const fileId of fileIds) {
        await tryDeleteFileRecord(fileId);
      }
      await Request.findByIdAndDelete(request._id);
      throw error;
    }

    await notifyStudent(request, 'Your request has been submitted successfully.', 'request_submitted');
    if (approver) {
      await notifyApprover(
        approver._id,
        request,
        `A new ${requestType.replace(/_/g, ' ')} request has been assigned to you from ${requester.name}.`
      );
    }

    const populated = await Request.findById(request._id)
      .populate('currentApproverId', 'name role email')
      .populate('attachments');
    sendSuccess(res, 201, 'Request submitted successfully.', { request: populated });
  } catch (error) {
    next(error);
  }
});

router.get('/', protect, async (req, res, next) => {
  try {
    const { status, requestType, page = 1, limit = 10, search } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
    const actionableOnly = req.query.actionable === 'true';
    if (actionableOnly && ['student', 'admin'].includes(req.user.role)) {
      return sendError(res, 403, 'Only assigned staff can request actionable items.');
    }
    const filter = {};

    if (actionableOnly) {
      filter.currentApproverId = req.user._id;
      filter.status = ['pending', 'under_review'].includes(status)
        ? status
        : { $in: ['pending', 'under_review'] };
    } else if (req.user.role === 'student') {
      filter.requesterId = req.user._id;
    } else if (req.user.role !== 'admin') {
      const historicalIds = await ApprovalHistory.distinct('requestId', {
        actorId: req.user._id,
      });
      filter.$or = [
        { currentApproverId: req.user._id },
        { _id: { $in: historicalIds } },
      ];
    }

    if (status && !actionableOnly) filter.status = status;
    if (requestType) filter.requestType = requestType;
    if (search) {
      const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { description: { $regex: escapedSearch, $options: 'i' } },
            { 'requesterInfo.name': { $regex: escapedSearch, $options: 'i' } },
            { 'requesterInfo.rollNumber': { $regex: escapedSearch, $options: 'i' } },
          ],
        },
      ];
    }

    const skip = (pageNumber - 1) * pageSize;
    const [total, requests] = await Promise.all([
      Request.countDocuments(filter),
      Request.find(filter)
        .populate('requesterId', 'name email branch year section rollNumber')
        .populate('currentApproverId', 'name role email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
    ]);

    sendSuccess(res, 200, 'Requests retrieved.', {
      requests,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', protect, async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return sendError(res, 404, 'Request not found.');

    if (req.user.role === 'student') {
      if (request.requesterId.toString() !== req.user._id.toString()) {
        return sendError(res, 403, 'Access denied.');
      }
    } else if (req.user.role !== 'admin') {
      const isCurrentApprover =
        request.currentApproverId?.toString() === req.user._id.toString();
      const hasActed = await ApprovalHistory.exists({
        requestId: request._id,
        actorId: req.user._id,
      });
      if (!isCurrentApprover && !hasActed) {
        return sendError(res, 403, 'Access denied.');
      }
    }

    const history = await ApprovalHistory.find({ requestId: request._id })
      .sort({ timestamp: 1 })
      .populate('actorId', 'name email role');
    sendSuccess(res, 200, 'History retrieved.', { history });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('requesterId', 'name email branch year section rollNumber department')
      .populate('currentApproverId', 'name role email')
      .populate('attachments');

    if (!request) return sendError(res, 404, 'Request not found.');

    if (req.user.role === 'student') {
      if (request.requesterId._id.toString() !== req.user._id.toString()) {
        return sendError(res, 403, 'Access denied.');
      }
    } else if (req.user.role !== 'admin') {
      const isCurrentApprover =
        request.currentApproverId?._id.toString() === req.user._id.toString();
      const hasActed = await ApprovalHistory.exists({
        requestId: request._id,
        actorId: req.user._id,
      });
      if (!isCurrentApprover && !hasActed) {
        return sendError(res, 403, 'Access denied.');
      }
    }

    sendSuccess(res, 200, 'Request retrieved.', { request });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/approve', protect, approveRequest);
router.put('/:id/reject', protect, rejectRequest);
router.put('/:id/return', protect, returnRequest);
router.put('/:id/escalate', protect, escalateRequest);

router.put('/:id/resubmit', protect, upload.array('files', 5), async (req, res, next) => {
  try {
    const body = req.body || {};
    const request = await Request.findById(req.params.id);
    if (!request) return sendError(res, 404, 'Request not found.');
    if (
      req.user.role !== 'student' ||
      request.requesterId.toString() !== req.user._id.toString()
    ) {
      return sendError(res, 403, 'Only the original student may resubmit this request.');
    }
    if (request.status !== 'returned') {
      return sendError(res, 400, 'Only returned requests can be resubmitted.');
    }
    if (!REQUEST_TYPES.has(request.requestType)) {
      return sendError(res, 400, 'The saved request has an unsupported request type.');
    }

    const updates = {};
    for (const field of ['description', ...requestFieldsByType[request.requestType]]) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updates[field] =
          typeof body[field] === 'string' ? body[field].trim() : body[field];
      }
    }
    const validationError = validateRequestFields(request.requestType, {
      ...request.toObject(),
      ...updates,
    });
    if (validationError) return sendError(res, 400, validationError);

    const existingFileCount = request.attachments?.length || 0;
    const newFileCount = req.files?.length || 0;
    if (existingFileCount + newFileCount > 5) {
      return sendError(res, 400, 'A request may have no more than 5 supporting documents.');
    }
    if (
      request.requestType === 'medical_leave' &&
      existingFileCount + newFileCount === 0
    ) {
      return sendError(res, 400, 'Medical leave requests require at least one supporting document.');
    }

    const fileIds = [];
    try {
      for (const file of req.files || []) {
        const record = await uploadFile({
          buffer: file.buffer,
          mimetype: file.mimetype,
          originalname: file.originalname,
          uploaderId: req.user._id,
          requestId: request._id,
        });
        fileIds.push(record._id);
      }

      if (fileIds.length > 0) updates.attachments = fileIds;
      await workflowService.processResubmit(request, req.user, updates);
    } catch (error) {
      for (const fileId of fileIds) {
        await tryDeleteFileRecord(fileId);
      }
      throw error;
    }

    const populated = await Request.findById(request._id)
      .populate('currentApproverId', 'name role')
      .populate('attachments');
    sendSuccess(res, 200, 'Request resubmitted successfully.', { request: populated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
