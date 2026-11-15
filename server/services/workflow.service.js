/**
 * Approval Workflow Service
 *
 * This service is the single source of truth for workflow progression.
 * No other part of the code should directly modify request.status or
 * request.currentApproverId without going through this service.
 *
 * Medical Leave chain: mentor → dean
 * Attendance Correction: teacher (direct)
 * Event Attendance: coordinator → hod
 * Other Grievance: coordinator, optionally escalated to hod
 */

const Request = require('../models/Request');
const ApprovalHistory = require('../models/ApprovalHistory');
const User = require('../models/User');
const { notifyStudent, notifyApprover } = require('./notification.service');

// ─────────────────────────────────────────────────────────────────────────────
// Routing helpers
// ─────────────────────────────────────────────────────────────────────────────

const createWorkflowError = (message, statusCode = 503) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sameId = (left, right) =>
  left && right && left.toString() === right.toString();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Find teacher assigned to a subject for a given student.
 */
const findTeacherForSubject = async (subjectName, branch, year, section) => {
  const normalizedSubject = typeof subjectName === 'string' ? subjectName.trim() : '';
  if (!normalizedSubject) return null;

  const teacher = await User.findOne({
    role: 'teacher',
    isActive: true,
    assignedSubjects: {
      $elemMatch: {
        subjectName: {
          $regex: `^${escapeRegex(normalizedSubject)}$`,
          $options: 'i',
        },
        branch,
        year: Number(year),
        section,
      },
    },
  });
  return teacher;
};

/**
 * Find Class Coordinator for a given class.
 * Note: A Class Coordinator may have the specific role 'coordinator' or the general
 * faculty role 'teacher' with an assigned class responsibility (assignedClass).
 */
const findCoordinator = async (branch, year, section) => {
  const coordinator = await User.findOne({
    role: { $in: ['coordinator', 'teacher'] },
    isActive: true,
    assignedClass: { branch, year: Number(year), section },
  });
  return coordinator;
};

/**
 * Find Mentor for a given class.
 * Note: A Mentor may have role 'mentor' or general faculty role 'teacher' with mentoringClasses.
 */
const findMentor = async (branch, year, section) => {
  const mentor = await User.findOne({
    role: { $in: ['mentor', 'teacher'] },
    isActive: true,
    mentoringClasses: {
      $elemMatch: { branch, year: Number(year), section },
    },
  });
  return mentor;
};

/**
 * Find HOD for a department.
 */
const findHOD = async (department) => {
  if (typeof department !== 'string' || !department.trim()) return null;
  return User.findOne({
    role: 'hod',
    isActive: true,
    headOfDepartments: { $in: [department.trim()] },
  });
};

const getHodDepartment = (request, requester) =>
  request.requestType === 'other_grievance' &&
  typeof request.targetDepartment === 'string' &&
  request.targetDepartment.trim()
    ? request.targetDepartment.trim()
    : requester.department || requester.branch;

/**
 * Find the Dean.
 */
const findDean = async () => {
  return User.findOne({ role: 'dean', isActive: true });
};

const requireInitialApprover = (approver, stage) => {
  const stageLabels = {
    teacher: 'subject teacher',
    coordinator: 'Class Coordinator',
    mentor: 'Mentor',
    hod: 'HOD',
    dean: 'Dean',
  };
  if (!approver || !approver._id || approver.isActive !== true) {
    throw createWorkflowError(
      `No active ${stageLabels[stage] || stage} is available to review this request. Contact the administrator before proceeding.`
    );
  }
  return approver;
};

const getMedicalLeaveApprover = async (stage, requester) => {
  const { branch, year, section } = requester;
  let approver;
  let roleLabel;

  if (stage === 'mentor') {
    approver = await findMentor(branch, year, section);
    roleLabel = 'Mentor';
  } else if (stage === 'dean') {
    approver = await findDean();
    roleLabel = 'Dean';
  } else {
    throw createWorkflowError(`Invalid medical leave approval stage: ${stage}.`, 409);
  }

  if (!approver) {
    throw createWorkflowError(
      `No active ${roleLabel} is assigned. Contact the administrator before proceeding.`
    );
  }

  return approver;
};

const assertMedicalLeaveApprover = (request, actor, requester) => {
  const stage = request.currentApprovalStage;
  const { branch, year, section } = requester;
  const assignedClass = actor.assignedClass;
  let isAssigned = false;

  if (!['mentor', 'dean'].includes(stage)) {
    throw createWorkflowError(
      `Legacy medical leave stage "${stage}" cannot continue under the current Mentor -> Dean workflow.`,
      409
    );
  }
  if (actor.isActive === false || !sameId(request.currentApproverId, actor._id)) {
    throw createWorkflowError('You are not the active assigned approver for this request.', 403);
  }

  if (stage === 'mentor') {
    isAssigned =
      ['mentor', 'teacher'].includes(actor.role) &&
      actor.mentoringClasses?.some(
        (assignment) =>
          assignment.branch === branch &&
          Number(assignment.year) === Number(year) &&
          assignment.section === section
      );
  } else if (stage === 'hod') {
    isAssigned =
      actor.role === 'hod' &&
      actor.headOfDepartments?.includes(requester.department || branch);
  } else if (stage === 'dean') {
    isAssigned = actor.role === 'dean';
  }

  if (!isAssigned) {
    throw createWorkflowError(
      `The current user is not assigned to the ${stage} stage of this request.`,
      403
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Initial routing — called when a new request is submitted
// ─────────────────────────────────────────────────────────────────────────────

const routeNewRequest = async (request, requester) => {
  const { requestType, subject } = request;
  const { branch: rb, year: ry, section: rs, department: rd } = requester;

  let approver = null;
  let stage = 'teacher';

  if (requestType === 'attendance_correction') {
    approver = await findTeacherForSubject(subject, rb, ry, rs);
    stage = 'teacher';
    if (!approver) {
      throw createWorkflowError(
        'No subject teacher is assigned for this subject and class. Please contact the administrator.'
      );
    }
  } else if (requestType === 'event_attendance') {
    approver = await findCoordinator(rb, ry, rs);
    stage = 'coordinator';
  } else if (requestType === 'medical_leave') {
    approver = await getMedicalLeaveApprover('mentor', requester);
    stage = 'mentor';
  } else if (requestType === 'other_grievance') {
    approver = await findCoordinator(rb, ry, rs);
    stage = 'coordinator';
  } else {
    throw createWorkflowError(`Unsupported request type: ${requestType}.`, 400);
  }

  approver = requireInitialApprover(approver, stage);
  return { approver, stage };
};

// ─────────────────────────────────────────────────────────────────────────────
// Next approver — called after each approval in a multi-stage chain
// ─────────────────────────────────────────────────────────────────────────────

const getNextApproverForMedicalLeave = async (currentStage, requester) => {
  if (currentStage === 'dean') {
    return { approver: null, stage: 'completed' };
  }

  const nextStages = { mentor: 'dean' };
  const nextStage = nextStages[currentStage];
  if (!nextStage) {
    throw createWorkflowError(
      `Cannot advance medical leave from approval stage "${currentStage}".`,
      409
    );
  }

  return {
    approver: await getMedicalLeaveApprover(nextStage, requester),
    stage: nextStage,
  };
};

const getApproverForStage = async (stage, request, requester) => {
  const { branch, year, section } = requester;
  let approver;
  if (stage === 'teacher') {
    approver = await findTeacherForSubject(
      request.subject || '',
      branch,
      year,
      section
    );
  } else if (stage === 'coordinator') {
    approver = await findCoordinator(branch, year, section);
  } else if (stage === 'mentor') {
    approver = await findMentor(branch, year, section);
  } else if (stage === 'hod') {
    approver = await findHOD(getHodDepartment(request, requester));
  } else if (stage === 'dean') {
    approver = await findDean();
  } else {
    throw createWorkflowError(
      `Cannot resubmit request because "${stage}" is not a valid approval stage.`,
      409
    );
  }

  if (!approver) {
    const stageLabel = {
      teacher: 'subject teacher',
      coordinator: 'Class Coordinator',
      mentor: 'Mentor',
      hod: 'HOD',
      dean: 'Dean',
    }[stage];
    throw createWorkflowError(
      `No active ${stageLabel} is assigned to the returned ${stage} stage. The request remains returned.`
    );
  }
  return approver;
};

const assertActionableAndAssigned = (request, actor) => {
  if (!['pending', 'under_review'].includes(request.status)) {
    throw createWorkflowError(`Request is already ${request.status}.`, 409);
  }
  if (
    actor.isActive === false ||
    !sameId(request.currentApproverId, actor._id)
  ) {
    throw createWorkflowError('You are not the active assigned approver for this request.', 403);
  }

  const rolesByStage = {
    teacher: ['teacher'],
    coordinator: ['teacher', 'coordinator'],
    mentor: ['teacher', 'mentor'],
    hod: ['hod'],
    dean: ['dean'],
  };
  if (!rolesByStage[request.currentApprovalStage]?.includes(actor.role)) {
    throw createWorkflowError(
      `Your role is not permitted to act at the ${request.currentApprovalStage} stage.`,
      403
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Core actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record an action in ApprovalHistory.
 */
const saveRequestWithHistory = async (request, {
  requestId,
  actorId,
  actorRole,
  actorName,
  action,
  remarks,
  previousStage,
  nextStage,
}) => {
  const history = await ApprovalHistory.create({
    requestId: requestId || request._id,
    actorId,
    actorRole,
    actorName,
    action,
    remarks: remarks || '',
    previousStage,
    nextStage,
  });

  try {
    await request.save();
  } catch (error) {
    try {
      await ApprovalHistory.deleteOne({ _id: history._id });
    } catch (cleanupError) {
      console.error(
        `[Workflow] Failed to remove uncommitted history ${history._id}: ${cleanupError.message}`
      );
    }
    throw error;
  }
};

/**
 * Process APPROVE action by an authorized approver.
 */
const processApprove = async (request, actor, remarks) => {
  assertActionableAndAssigned(request, actor);
  const requester = await User.findById(request.requesterId);
  if (!requester) throw new Error('Requester not found.');

  const previousStage = request.currentApprovalStage;

  if (request.requestType === 'medical_leave') {
    assertMedicalLeaveApprover(request, actor, requester);

    const { approver: nextApprover, stage: nextStage } =
      await getNextApproverForMedicalLeave(previousStage, requester);

    if (previousStage === 'dean') {
      // Final approval
      request.status = 'approved';
      request.currentApprovalStage = 'completed';
      request.currentApproverId = null;
      request.resolvedAt = new Date();

      await saveRequestWithHistory(request, {
        requestId: request._id,
        actorId: actor._id,
        actorRole: actor.role,
        actorName: actor.name,
        action: 'approved',
        remarks,
        previousStage,
        nextStage: 'completed',
      });

      await notifyStudent(
        request,
        `Your medical leave request has been finally approved by the ${actor.role.toUpperCase()}.`,
        'request_approved'
      );
    } else {
      // Forward to next stage
      request.status = 'under_review';
      request.currentApprovalStage = nextStage;
      request.currentApproverId = nextApprover._id;

      await saveRequestWithHistory(request, {
        requestId: request._id,
        actorId: actor._id,
        actorRole: actor.role,
        actorName: actor.name,
        action: 'forwarded',
        remarks,
        previousStage,
        nextStage,
      });

      await notifyStudent(
        request,
        `Your medical leave request has been approved by the ${previousStage.toUpperCase()} and forwarded to the ${nextStage.toUpperCase()}.`,
        'request_forwarded'
      );

      await notifyApprover(
        nextApprover._id,
        request,
        `A Medical Leave request has been forwarded to you by the Mentor.`
      );
    }
  } else if (request.requestType === 'event_attendance') {
    if (previousStage === 'coordinator') {
      const nextApprover = await findHOD(requester.department || requester.branch);
      requireInitialApprover(nextApprover, 'hod');
      request.status = 'under_review';
      request.currentApprovalStage = 'hod';
      request.currentApproverId = nextApprover._id;
      await saveRequestWithHistory(request, {
        requestId: request._id, actorId: actor._id, actorRole: actor.role,
        actorName: actor.name, action: 'forwarded', remarks, previousStage, nextStage: 'hod',
      });
      await notifyStudent(request, 'Your Event Attendance request has been forwarded to the HOD.', 'request_forwarded');
      await notifyApprover(nextApprover._id, request, 'An Event Attendance request has been forwarded to you for final approval.');
    } else if (previousStage === 'hod') {
      request.status = 'approved';
      request.currentApprovalStage = 'completed';
      request.currentApproverId = null;
      request.resolvedAt = new Date();
      await saveRequestWithHistory(request, {
        requestId: request._id, actorId: actor._id, actorRole: actor.role,
        actorName: actor.name, action: 'approved', remarks, previousStage, nextStage: 'completed',
      });
      await notifyStudent(request, 'Your Event Attendance request has been finally approved by the HOD.', 'request_approved');
    } else {
      throw createWorkflowError(`Cannot advance Event Attendance from "${previousStage}".`, 409);
    }
  } else if (request.requestType === 'other_grievance') {
    request.status = 'approved';
    request.currentApprovalStage = 'completed';
    request.currentApproverId = null;
    request.resolvedAt = new Date();
    await saveRequestWithHistory(request, {
      requestId: request._id, actorId: actor._id, actorRole: actor.role,
      actorName: actor.name, action: 'approved', remarks, previousStage, nextStage: 'completed',
    });
    await notifyStudent(
      request,
      previousStage === 'coordinator'
        ? 'Your academic grievance has been resolved by the Class Coordinator.'
        : 'Your academic grievance has been resolved by the HOD.',
      'request_approved'
    );
  } else {
    request.status = 'approved';
    request.currentApprovalStage = 'completed';
    request.currentApproverId = null;
    request.resolvedAt = new Date();

    await saveRequestWithHistory(request, {
      requestId: request._id,
      actorId: actor._id,
      actorRole: actor.role,
      actorName: actor.name,
      action: 'approved',
      remarks,
      previousStage,
      nextStage: 'completed',
    });

    const typeLabels = {
      attendance_correction: 'Attendance Correction',
      event_attendance: 'Event Attendance',
      other_grievance: 'Academic Grievance',
    };

    await notifyStudent(
      request,
      `Your ${typeLabels[request.requestType] || 'request'} has been approved.`,
      'request_approved'
    );
  }

  return request;
};

const processEscalate = async (request, actor, remarks) => {
  if (typeof remarks !== 'string' || remarks.trim() === '') {
    throw createWorkflowError('Remarks are required when escalating a grievance.', 400);
  }
  if (request.requestType !== 'other_grievance') {
    throw createWorkflowError('Only academic grievances can be escalated.', 400);
  }
  if (request.status !== 'under_review' || request.currentApprovalStage !== 'coordinator') {
    throw createWorkflowError('This grievance is not at the Coordinator stage.', 409);
  }
  assertActionableAndAssigned(request, actor);
  const requester = await User.findById(request.requesterId);
  if (!requester) throw new Error('Requester not found.');
  const hod = await findHOD(getHodDepartment(request, requester));
  requireInitialApprover(hod, 'hod');

  request.status = 'under_review';
  request.currentApprovalStage = 'hod';
  request.currentApproverId = hod._id;
  await saveRequestWithHistory(request, {
    requestId: request._id, actorId: actor._id, actorRole: actor.role,
    actorName: actor.name, action: 'escalated', remarks: remarks.trim(),
    previousStage: 'coordinator', nextStage: 'hod',
  });
  await notifyApprover(hod._id, request, 'An academic grievance has been escalated to you for review.');
  await notifyStudent(request, 'Your grievance has been escalated to the HOD for further review.', 'request_escalated');
  return request;
};

/**
 * Process REJECT action.
 */
const processReject = async (request, actor, remarks) => {
  if (typeof remarks !== 'string' || remarks.trim() === '') {
    throw new Error('Remarks are required when rejecting a request.');
  }
  assertActionableAndAssigned(request, actor);

  const previousStage = request.currentApprovalStage;

  if (request.requestType === 'medical_leave') {
    if (!['pending', 'under_review'].includes(request.status)) {
      throw createWorkflowError(`Request is already ${request.status}.`, 409);
    }
    const requester = await User.findById(request.requesterId);
    if (!requester) throw new Error('Requester not found.');
    assertMedicalLeaveApprover(request, actor, requester);
  }

  request.status = 'rejected';
  request.currentApprovalStage = 'rejected';
  request.currentApproverId = null;
  request.resolvedAt = new Date();

  await saveRequestWithHistory(request, {
    requestId: request._id,
    actorId: actor._id,
    actorRole: actor.role,
    actorName: actor.name,
    action: 'rejected',
    remarks,
    previousStage,
    nextStage: 'rejected',
  });

  await notifyStudent(
    request,
    `Your request has been rejected by the ${actor.role.toUpperCase()}. Reason: ${remarks}`,
    'request_rejected'
  );

  return request;
};

/**
 * Process RETURN FOR CORRECTION action.
 */
const processReturn = async (request, actor, remarks) => {
  if (typeof remarks !== 'string' || remarks.trim() === '') {
    throw new Error('Remarks are required when returning a request.');
  }
  assertActionableAndAssigned(request, actor);

  const previousStage = request.currentApprovalStage;

  if (request.requestType === 'medical_leave') {
    if (!['pending', 'under_review'].includes(request.status)) {
      throw createWorkflowError(`Request is already ${request.status}.`, 409);
    }
    const requester = await User.findById(request.requesterId);
    if (!requester) throw new Error('Requester not found.');
    assertMedicalLeaveApprover(request, actor, requester);
  }

  request.status = 'returned';
  // Keep the stage for resubmission, but only medical requests retain their assigned approver.
  if (request.requestType !== 'medical_leave') {
    request.currentApproverId = null;
  }

  await saveRequestWithHistory(request, {
    requestId: request._id,
    actorId: actor._id,
    actorRole: actor.role,
    actorName: actor.name,
    action: 'returned',
    remarks,
    previousStage,
    nextStage: 'student',
  });

  await notifyStudent(
    request,
    `Your request has been returned for correction by the ${actor.role.toUpperCase()}. Please review and resubmit. Remarks: ${remarks}`,
    'request_returned'
  );

  return request;
};

/**
 * Process RESUBMIT action by student after a return.
 * Sends request back to the stage where it was returned.
 */
const processResubmit = async (request, requester, updates) => {
  if (request.status !== 'returned') {
    throw new Error('Only returned requests can be resubmitted.');
  }
  if (
    requester.role !== 'student' ||
    request.requesterId.toString() !== requester._id.toString()
  ) {
    throw new Error('You can only resubmit your own requests.');
  }

  const returnedFromStage = request.currentApprovalStage;
  const previousApproverId = request.currentApproverId;
  let nextApprover;

  if (request.requestType === 'medical_leave') {
    nextApprover = await getMedicalLeaveApprover(returnedFromStage, requester);
  }

  const allowedUpdatesByType = {
    attendance_correction: [
      'description', 'subject', 'subjectCode', 'attendanceDate', 'lectureNumber',
    ],
    event_attendance: [
      'description', 'subject', 'eventName', 'eventDate', 'eventOrganizer',
      'participationDetails',
    ],
    medical_leave: [
      'description', 'leaveStartDate', 'leaveEndDate', 'medicalDescription',
    ],
    other_grievance: ['description', 'grievanceCategory', 'targetDepartment'],
  };
  const allowedUpdates = allowedUpdatesByType[request.requestType];
  if (!allowedUpdates) {
    throw createWorkflowError(`Unsupported request type: ${request.requestType}.`, 400);
  }
  allowedUpdates.forEach((field) => {
    if (updates[field] !== undefined) request[field] = updates[field];
  });

  if (updates.attachments && Array.isArray(updates.attachments)) {
    request.attachments.push(...updates.attachments);
  }

  if (request.requestType !== 'medical_leave') {
    nextApprover = await getApproverForStage(returnedFromStage, request, requester);
  }

  request.status = 'under_review';
  request.currentApprovalStage = returnedFromStage;
  request.currentApproverId = nextApprover ? nextApprover._id : null;
  request.resubmissionCount += 1;

  const reassignmentRemark =
    previousApproverId &&
    !sameId(previousApproverId, nextApprover._id)
      ? ' The request was assigned to the active approver currently responsible for this stage.'
      : '';
  await saveRequestWithHistory(request, {
    requestId: request._id,
    actorId: requester._id,
    actorRole: 'student',
    actorName: requester.name,
    action: 'resubmitted',
    remarks: `Student resubmitted after correction.${reassignmentRemark}`,
    previousStage: 'student',
    nextStage: returnedFromStage,
  });

  if (nextApprover) {
    await notifyApprover(
      nextApprover._id,
      request,
      `A request has been resubmitted by ${requester.name} and is awaiting your review.`
    );
  }

  await notifyStudent(
    request,
    `Your request has been resubmitted and is now under review.`,
    'request_resubmitted'
  );

  return request;
};

module.exports = {
  routeNewRequest,
  processApprove,
  processEscalate,
  processReject,
  processReturn,
  processResubmit,
  saveRequestWithHistory,
};
