/**
 * Isolated medical workflow service verification.
 *
 * Set CAMPUSFLOW_TEST_MONGODB_URI to a dedicated database whose name ends in
 * "test" before running. This script never loads server/.env, contacts
 * Cloudinary, or deletes records outside the test fixtures it creates.
 */

const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const User = require('../models/User');
const Request = require('../models/Request');
const ApprovalHistory = require('../models/ApprovalHistory');
const Notification = require('../models/Notification');
const workflow = require('../services/workflow.service');

const stages = ['coordinator', 'mentor', 'hod', 'dean'];
const runId = randomUUID();
const userIds = [];
const requestIds = [];
let passed = 0;
let failed = 0;
let fixtureNumber = 0;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expectError = async (action, messagePart) => {
  try {
    await action();
  } catch (error) {
    assert(
      error.message.toLowerCase().includes(messagePart.toLowerCase()),
      `Expected error containing "${messagePart}", got "${error.message}".`
    );
    return error;
  }
  throw new Error(`Expected an error containing "${messagePart}".`);
};

const check = async (label, action) => {
  try {
    await action();
    passed += 1;
    console.log(`PASS ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${label}: ${error.message}`);
  }
};

const createUser = async (fixture, role, assignments = {}) => {
  const user = await User.create({
    name: `${role} ${fixture.number}`,
    email: `${runId}-${fixture.number}-${role}-${randomUUID()}@workflow-test.invalid`,
    passwordHash: 'workflow-test-password',
    role,
    department: fixture.department,
    branch: fixture.branch,
    year: fixture.year,
    section: fixture.section,
    isActive: true,
    ...assignments,
  });
  userIds.push(user._id);
  return user;
};

const createFixture = async ({
  coordinatorRole = 'coordinator',
  noCoordinator = false,
  noMentor = false,
  noHod = false,
  noDean = false,
  arbitrarySubjectTeacher = false,
} = {}) => {
  const number = ++fixtureNumber;
  const fixture = {
    number,
    branch: `WF${number}`,
    year: 2,
    section: 'A',
    department: `Workflow Department ${number}`,
    approvers: {},
  };
  fixture.student = await createUser(fixture, 'student', {
    rollNumber: `WF-${number}`,
  });

  if (!noCoordinator) {
    fixture.approvers.coordinator = await createUser(
      fixture,
      coordinatorRole,
      { assignedClass: { branch: fixture.branch, year: fixture.year, section: fixture.section } }
    );
  }
  if (arbitrarySubjectTeacher) {
    fixture.arbitraryTeacher = await createUser(fixture, 'teacher', {
      assignedSubjects: [{
        subjectName: 'Workflow Test Subject',
        subjectCode: `WF${number}`,
        branch: fixture.branch,
        year: fixture.year,
        section: fixture.section,
      }],
    });
  }
  if (!noMentor) {
    fixture.approvers.mentor = await createUser(fixture, 'mentor', {
      mentoringClasses: [{
        branch: fixture.branch,
        year: fixture.year,
        section: fixture.section,
      }],
    });
  }
  if (!noHod) {
    fixture.approvers.hod = await createUser(fixture, 'hod', {
      headOfDepartments: [fixture.department],
    });
  }
  if (!noDean) {
    fixture.approvers.dean = await createUser(fixture, 'dean');
  }

  return fixture;
};

const routeRequest = async (fixture) => {
  const route = await workflow.routeNewRequest(
    { requestType: 'medical_leave' },
    fixture.student
  );
  assert(route.stage === 'coordinator', 'New medical leave must start at Coordinator.');
  assert(route.approver, 'New medical leave must have an assigned Coordinator.');

  const request = await Request.create({
    requesterId: fixture.student._id,
    requestType: 'medical_leave',
    description: 'Workflow verification request for medical leave.',
    status: 'under_review',
    currentApprovalStage: route.stage,
    currentApproverId: route.approver._id,
    requesterInfo: {
      name: fixture.student.name,
      email: fixture.student.email,
      branch: fixture.branch,
      year: fixture.year,
      section: fixture.section,
      department: fixture.department,
    },
  });
  requestIds.push(request._id);
  await ApprovalHistory.create({
    requestId: request._id,
    actorId: fixture.student._id,
    actorRole: 'student',
    actorName: fixture.student.name,
    action: 'submitted',
    nextStage: 'coordinator',
  });

  fixture.request = request;
  return request;
};

const currentRequest = async (fixture) => {
  fixture.request = await Request.findById(fixture.request._id);
  return fixture.request;
};

const advanceToStage = async (fixture, targetStage) => {
  const targetIndex = stages.indexOf(targetStage);
  assert(targetIndex >= 0, `Unknown target stage: ${targetStage}.`);

  for (let index = 0; index < targetIndex; index += 1) {
    const request = await currentRequest(fixture);
    await workflow.processApprove(
      request,
      fixture.approvers[stages[index]],
      `Approved at ${stages[index]}.`
    );
  }
  return currentRequest(fixture);
};

const rejectAtStage = async (fixture, stage) => {
  const request = await advanceToStage(fixture, stage);
  await workflow.processReject(request, fixture.approvers[stage], 'Verification rejection.');
  const updated = await currentRequest(fixture);
  assert(updated.status === 'rejected', `${stage} rejection did not end the request.`);
  assert(updated.currentApprovalStage === 'rejected', 'Rejected stage was not recorded.');
  assert(!updated.currentApproverId, 'Rejected request still has a current approver.');
  assert(
    await ApprovalHistory.exists({ requestId: updated._id, action: 'rejected', previousStage: stage }),
    `Missing rejection history for ${stage}.`
  );
};

const returnAndResubmitAtStage = async (fixture, stage) => {
  const request = await advanceToStage(fixture, stage);
  const reviewerId = request.currentApproverId.toString();
  const historyBefore = await ApprovalHistory.countDocuments({ requestId: request._id });

  await workflow.processReturn(request, fixture.approvers[stage], `Correction needed at ${stage}.`);
  const returned = await currentRequest(fixture);
  assert(returned.status === 'returned', `${stage} return did not set returned status.`);
  assert(returned.currentApprovalStage === stage, 'Return did not preserve the stage.');
  assert(returned.currentApproverId.toString() === reviewerId, 'Return did not preserve reviewer identity.');

  await workflow.processResubmit(returned, fixture.student, {
    description: 'Updated medical leave request after requested correction.',
  });
  const resubmitted = await currentRequest(fixture);
  assert(resubmitted.status === 'under_review', 'Resubmitted request is not under review.');
  assert(resubmitted.currentApprovalStage === stage, 'Resubmission restarted or skipped a stage.');
  assert(
    resubmitted.currentApproverId.toString() === reviewerId,
    'Resubmission was not assigned to the active approver for the returned stage.'
  );
  assert(resubmitted.resubmissionCount === 1, 'Resubmission count was not incremented.');
  assert(
    (await ApprovalHistory.countDocuments({ requestId: request._id })) === historyBefore + 2,
    'Return/resubmission history was not preserved.'
  );
};

const main = async () => {
  const testUri = process.env.CAMPUSFLOW_TEST_MONGODB_URI;
  if (!testUri) {
    throw new Error(
      'Set CAMPUSFLOW_TEST_MONGODB_URI to a dedicated MongoDB test database before running this verification.'
    );
  }

  let databaseName;
  try {
    const parsedUri = new URL(testUri);
    databaseName = parsedUri.searchParams.get('dbName') || parsedUri.pathname.slice(1).split('/')[0];
  } catch {
    throw new Error('CAMPUSFLOW_TEST_MONGODB_URI is not a valid MongoDB connection URI.');
  }
  if (!/(^|[-_])tests?$/i.test(decodeURIComponent(databaseName || ''))) {
    throw new Error('The configured database name must end in "test" or "tests". No connection was made.');
  }

  await mongoose.connect(testUri);
  console.log(`Medical workflow checks using isolated database "${mongoose.connection.name}".`);

  await check('Submission routes to the assigned Class Coordinator', async () => {
    const fixture = await createFixture();
    const request = await routeRequest(fixture);
    assert(request.currentApprovalStage === 'coordinator', 'Incorrect initial stage.');
    assert(
      request.currentApproverId.toString() === fixture.approvers.coordinator._id.toString(),
      'Request is not assigned to the class Coordinator.'
    );
  });

  await check('A teacher explicitly assigned as Class Coordinator is supported', async () => {
    const fixture = await createFixture({ coordinatorRole: 'teacher' });
    const request = await routeRequest(fixture);
    assert(
      request.currentApproverId.toString() === fixture.approvers.coordinator._id.toString(),
      'Assigned teacher was not selected as Coordinator.'
    );
  });

  await check('An arbitrary subject teacher is not treated as Coordinator', async () => {
    const fixture = await createFixture({
      noCoordinator: true,
      arbitrarySubjectTeacher: true,
    });
    await expectError(
      () => workflow.routeNewRequest({ requestType: 'medical_leave' }, fixture.student),
      'No active Class Coordinator'
    );
  });

  await check('Coordinator -> Mentor -> HOD -> Dean -> final approval', async () => {
    const fixture = await createFixture({ coordinatorRole: 'teacher' });
    await routeRequest(fixture);
    for (let index = 0; index < stages.length; index += 1) {
      const request = await currentRequest(fixture);
      assert(request.currentApprovalStage === stages[index], `Expected stage ${stages[index]}.`);
      await workflow.processApprove(request, fixture.approvers[stages[index]], `Approve ${stages[index]}.`);
    }

    const completed = await currentRequest(fixture);
    assert(completed.status === 'approved', 'Dean approval did not approve the request.');
    assert(completed.currentApprovalStage === 'completed', 'Final stage is not completed.');
    assert(!completed.currentApproverId, 'Completed request still has an approver.');
    assert(completed.resolvedAt, 'Final approval did not set resolvedAt.');
    assert(
      await ApprovalHistory.exists({
        requestId: completed._id,
        action: 'approved',
        previousStage: 'dean',
        nextStage: 'completed',
      }),
      'Dean final approval was not recorded.'
    );
  });

  await check('Missing Coordinator blocks routing without falling through to Mentor', async () => {
    const fixture = await createFixture({ noCoordinator: true });
    const before = await Request.countDocuments({ requesterId: fixture.student._id });
    await expectError(
      () => workflow.routeNewRequest({ requestType: 'medical_leave' }, fixture.student),
      'No active Class Coordinator'
    );
    assert(
      (await Request.countDocuments({ requesterId: fixture.student._id })) === before,
      'A request was created despite missing Coordinator assignment.'
    );
  });

  await check('Missing Mentor leaves the request at Coordinator, not approved or skipped', async () => {
    const fixture = await createFixture({ noMentor: true });
    const request = await routeRequest(fixture);
    const historyBefore = await ApprovalHistory.countDocuments({ requestId: request._id });
    await expectError(
      () => workflow.processApprove(request, fixture.approvers.coordinator, 'Approve coordinator.'),
      'No active Mentor'
    );
    const unchanged = await currentRequest(fixture);
    assert(unchanged.status === 'under_review', 'Request status changed without a Mentor.');
    assert(unchanged.currentApprovalStage === 'coordinator', 'Coordinator stage was skipped.');
    assert(
      (await ApprovalHistory.countDocuments({ requestId: request._id })) === historyBefore,
      'History changed even though forwarding failed.'
    );
  });

  await check('Missing HOD leaves the request at Mentor', async () => {
    const fixture = await createFixture({ noHod: true });
    await routeRequest(fixture);
    const request = await advanceToStage(fixture, 'mentor');
    await expectError(
      () => workflow.processApprove(request, fixture.approvers.mentor, 'Approve mentor.'),
      'No active HOD'
    );
    const unchanged = await currentRequest(fixture);
    assert(unchanged.currentApprovalStage === 'mentor', 'Mentor stage was skipped.');
    assert(unchanged.status === 'under_review', 'Request status changed without an HOD.');
  });

  await check('Missing Dean leaves the request at HOD', async () => {
    const fixture = await createFixture({ noDean: true });
    await routeRequest(fixture);
    const request = await advanceToStage(fixture, 'hod');
    await expectError(
      () => workflow.processApprove(request, fixture.approvers.hod, 'Approve HOD.'),
      'No active Dean'
    );
    const unchanged = await currentRequest(fixture);
    assert(unchanged.currentApprovalStage === 'hod', 'HOD stage was skipped.');
    assert(unchanged.status === 'under_review', 'Request was finalized without Dean approval.');
  });

  await check('Rejection at each stage terminates the chain and records history', async () => {
    for (const stage of stages) {
      const fixture = await createFixture();
      await routeRequest(fixture);
      await rejectAtStage(fixture, stage);
    }
  });

  await check('Return and resubmission at every stage preserve history and resume that stage', async () => {
    for (const stage of stages) {
      const fixture = await createFixture();
      await routeRequest(fixture);
      await returnAndResubmitAtStage(fixture, stage);
    }
  });

  await check('Resubmission reassigns the same stage to a replacement when its reviewer is inactive', async () => {
    const fixture = await createFixture();
    await routeRequest(fixture);
    const request = await advanceToStage(fixture, 'mentor');
    await workflow.processReturn(request, fixture.approvers.mentor, 'Please correct the details.');
    fixture.approvers.mentor.isActive = false;
    await fixture.approvers.mentor.save();

    const replacement = await createUser(fixture, 'teacher', {
      mentoringClasses: [{
        branch: fixture.branch,
        year: fixture.year,
        section: fixture.section,
      }],
    });
    const returned = await currentRequest(fixture);
    await workflow.processResubmit(returned, fixture.student, {
      description: 'Updated request assigned to the replacement mentor.',
    });
    const resubmitted = await currentRequest(fixture);
    assert(resubmitted.currentApprovalStage === 'mentor', 'Resubmission skipped the Mentor stage.');
    assert(
      resubmitted.currentApproverId.toString() === replacement._id.toString(),
      'Request was not assigned to the active replacement Mentor.'
    );
  });

  await check('Resubmission stays returned when no active reviewer is assigned to that stage', async () => {
    const fixture = await createFixture();
    await routeRequest(fixture);
    const request = await advanceToStage(fixture, 'mentor');
    await workflow.processReturn(request, fixture.approvers.mentor, 'Please correct the details.');
    fixture.approvers.mentor.isActive = false;
    await fixture.approvers.mentor.save();

    await expectError(
      async () => workflow.processResubmit(
        await currentRequest(fixture),
        fixture.student,
        { description: 'Updated request without an assigned Mentor.' }
      ),
      'No active Mentor'
    );
    const unchanged = await currentRequest(fixture);
    assert(unchanged.status === 'returned', 'Request left returned status without a reviewer.');
    assert(unchanged.currentApprovalStage === 'mentor', 'Returned stage was not preserved.');
  });

  await check('An unauthorized teacher cannot act even if the request names them as approver', async () => {
    const fixture = await createFixture({ noCoordinator: true, arbitrarySubjectTeacher: true });
    const request = await Request.create({
      requesterId: fixture.student._id,
      requestType: 'medical_leave',
      description: 'Workflow verification request with invalid approver.',
      status: 'under_review',
      currentApprovalStage: 'coordinator',
      currentApproverId: fixture.arbitraryTeacher._id,
    });
    requestIds.push(request._id);
    await expectError(
      () => workflow.processApprove(request, fixture.arbitraryTeacher, 'Attempt approval.'),
      'not assigned to the coordinator stage'
    );
    const unchanged = await currentRequest(fixture);
    assert(unchanged.currentApprovalStage === 'coordinator', 'Unauthorized action changed the stage.');
  });

  await check('A previous approver cannot approve again after the request advances', async () => {
    const fixture = await createFixture();
    await routeRequest(fixture);
    const coordinator = fixture.approvers.coordinator;
    const request = await currentRequest(fixture);
    await workflow.processApprove(request, coordinator, 'Forward to Mentor.');
    await expectError(
      async () => workflow.processApprove(
        await currentRequest(fixture),
        coordinator,
        'Approve again.'
      ),
      'not the active assigned approver'
    );
    assert((await currentRequest(fixture)).currentApprovalStage === 'mentor', 'Request regressed after old approver action.');
  });

  await check('An inactive current approver cannot process a request', async () => {
    const fixture = await createFixture();
    const request = await routeRequest(fixture);
    fixture.approvers.coordinator.isActive = false;
    await fixture.approvers.coordinator.save();
    await expectError(
      () => workflow.processApprove(request, fixture.approvers.coordinator, 'Inactive approval.'),
      'not the active assigned approver'
    );
    assert((await currentRequest(fixture)).currentApprovalStage === 'coordinator', 'Inactive action changed the stage.');
  });

  await check('Only the request owner can resubmit', async () => {
    const fixture = await createFixture();
    const request = await routeRequest(fixture);
    await workflow.processReturn(request, fixture.approvers.coordinator, 'Please correct the details.');
    const otherStudent = await createUser(fixture, 'student');
    await expectError(
      async () => workflow.processResubmit(
        await currentRequest(fixture),
        otherStudent,
        { description: 'Attempt to resubmit another student request.' }
      ),
      'only resubmit your own'
    );
  });

  await check('Forwarding creates notifications for the student and next approver', async () => {
    const fixture = await createFixture();
    const request = await routeRequest(fixture);
    await workflow.processApprove(request, fixture.approvers.coordinator, 'Forward to Mentor.');
    const studentNotification = await Notification.exists({
      userId: fixture.student._id,
      requestId: request._id,
      type: 'request_forwarded',
    });
    const mentorNotification = await Notification.exists({
      userId: fixture.approvers.mentor._id,
      requestId: request._id,
      type: 'request_assigned',
    });
    assert(studentNotification, 'Student was not notified of forwarding.');
    assert(mentorNotification, 'Next approver was not notified of assignment.');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error(`Workflow verification could not complete: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) {
      try {
        if (requestIds.length > 0) {
          await Notification.deleteMany({ requestId: { $in: requestIds } });
          await ApprovalHistory.deleteMany({ requestId: { $in: requestIds } });
          await Request.deleteMany({ _id: { $in: requestIds } });
        }
        if (userIds.length > 0) {
          await Notification.deleteMany({ userId: { $in: userIds } });
          await User.deleteMany({ _id: { $in: userIds } });
        }
      } catch (error) {
        console.error(`Workflow fixture cleanup failed: ${error.message}`);
        process.exitCode = 1;
      }
    }
    await mongoose.disconnect();
  });
