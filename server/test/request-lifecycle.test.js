const assert = require('node:assert/strict');
const { after, before, beforeEach, describe, it } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Request = require('../models/Request');
const ApprovalHistory = require('../models/ApprovalHistory');
const Notification = require('../models/Notification');
const FileRecord = require('../models/FileRecord');
const storageService = require('../services/storage.service');
const workflowService = require('../services/workflow.service');
const errorHandler = require('../middleware/error.middleware');
const notificationRoutes = require('../routes/notification.routes');

const JWT_SECRET = 'request-lifecycle-isolated-test-secret';
const originalJwtSecret = process.env.JWT_SECRET;
const realWorkflow = { ...workflowService };
const users = new Map();
const requests = new Map();
const fileRecords = new Map();
let notifications = [];
let history = [];
let server;
let baseUrl;
let nextRequestId = 0;
let uploadCount = 0;
let deletedFiles = [];
let failUploadAt = 0;
let failResubmit = false;
let routedRequestCount = 0;
let lastResubmitUpdates;
let uploadImplementation = async () => ({ _id: 'file-unconfigured' });
let deleteImplementation = async () => {};
let signedUrlImplementation = () => ({
  signedUrl: 'https://example.invalid/signed-file',
  expiresAt: 0,
});

storageService.uploadFile = (...args) => uploadImplementation(...args);
storageService.tryDeleteFileRecord = (...args) => deleteImplementation(...args);
storageService.generateSignedDownloadUrl = (...args) => signedUrlImplementation(...args);

const requestRoutes = require('../routes/request.routes');
const fileRoutes = require('../routes/file.routes');

const makeId = (value) => ({
  _id: value,
  toString: () => value,
});

const makeUser = (id, role = 'student', overrides = {}) => ({
  _id: id,
  name: `${role} ${id}`,
  email: `${id}@example.invalid`,
  role,
  isActive: true,
  branch: 'Test Branch',
  year: 2,
  section: 'A',
  department: 'Test Department',
  rollNumber: `ROLL-${id}`,
  assignedClass: { branch: 'Test Branch', year: 2, section: 'A' },
  mentoringClasses: [{ branch: 'Test Branch', year: 2, section: 'A' }],
  headOfDepartments: ['Test Department'],
  ...overrides,
});

const makeDocument = (data) => {
  const document = {
    ...data,
    _id: data._id || `request-${++nextRequestId}`,
    requesterId:
      data.requesterId && typeof data.requesterId === 'string'
        ? makeId(data.requesterId)
        : data.requesterId,
    currentApproverId:
      data.currentApproverId && typeof data.currentApproverId === 'string'
        ? makeId(data.currentApproverId)
        : data.currentApproverId,
    attachments: data.attachments || [],
    save: async function () {
      requests.set(this._id, this);
      return this;
    },
    toObject: function () {
      const { save, toObject, ...plain } = this;
      return {
        ...plain,
        requesterId: this.requesterId?.toString(),
        currentApproverId: this.currentApproverId?.toString() || null,
      };
    },
  };
  requests.set(document._id, document);
  return document;
};

const queryFor = (source) => {
  let result = source;
  const query = {
    select() {
      return this;
    },
    populate(path) {
      if (result && path === 'requesterId' && result.requesterId) {
        const id = result.requesterId.toString();
        result = { ...result, requesterId: users.get(id) || makeId(id) };
      }
      if (result && path === 'currentApproverId' && result.currentApproverId) {
        const id = result.currentApproverId.toString();
        result = { ...result, currentApproverId: users.get(id) || makeId(id) };
      }
      return this;
    },
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
};

const matchesFilter = (request, filter = {}) => {
  if (
    filter.requesterId &&
    request.requesterId.toString() !== filter.requesterId.toString()
  ) {
    return false;
  }
  if (
    filter.currentApproverId &&
    request.currentApproverId?.toString() !== filter.currentApproverId.toString()
  ) {
    return false;
  }
  if (
    filter.status &&
    (filter.status.$in
      ? !filter.status.$in.includes(request.status)
      : request.status !== filter.status)
  ) {
    return false;
  }
  if (filter.requestType && request.requestType !== filter.requestType) return false;
  if (
    filter.$or &&
    !filter.$or.some((condition) => {
      if (condition.currentApproverId) {
        return (
          request.currentApproverId?.toString() ===
          condition.currentApproverId.toString()
        );
      }
      if (condition._id?.$in) return condition._id.$in.includes(request._id);
      return false;
    })
  ) {
    return false;
  }
  return true;
};

const tokenFor = (user) =>
  jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);

const send = async (path, { user, method = 'GET', body, multipart = false } = {}) => {
  const headers = {};
  if (user) headers.authorization = `Bearer ${tokenFor(user)}`;
  if (body !== undefined && !multipart) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : multipart
        ? body
        : JSON.stringify(body),
  });
  return { response, data: await response.json() };
};

const requestFields = {
  attendance_correction: {
    subject: 'Test Subject',
    attendanceDate: '2026-10-01',
  },
  event_attendance: {
    eventName: 'Test Event',
    eventDate: '2026-10-02',
  },
  medical_leave: {
    leaveStartDate: '2026-10-03',
    leaveEndDate: '2026-10-05',
  },
  other_grievance: {
    grievanceCategory: 'Exam Re-evaluation',
  },
};

const createSubmissionBody = (type, extra = {}) => ({
  requestType: type,
  description: 'A sufficiently detailed request explanation.',
  ...requestFields[type],
  ...extra,
});

const makeFormData = (fields, fileCount = 0) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  for (let index = 0; index < fileCount; index += 1) {
    data.append('files', new Blob(['%PDF-1.7'], { type: 'application/pdf' }), `doc-${index}.pdf`);
  }
  return data;
};

const seedRequest = (overrides = {}) =>
  makeDocument({
    requesterId: 'student-1',
    requestType: 'attendance_correction',
    description: 'A sufficiently detailed request explanation.',
    status: 'under_review',
    currentApproverId: 'teacher-1',
    currentApprovalStage: 'teacher',
    subject: 'Test Subject',
    attendanceDate: new Date('2026-10-01T00:00:00.000Z'),
    requesterInfo: {
      name: 'student student-1',
      branch: 'Test Branch',
      year: 2,
      section: 'A',
      rollNumber: 'ROLL-student-1',
    },
    ...overrides,
  });

const installRouteMocks = () => {
  User.findById = (id) => queryFor(users.get(String(id)) || null);
  User.findOne = async () => null;
  Request.create = async (data) => makeDocument(data);
  Request.findById = (id) => queryFor(requests.get(String(id)) || null);
  Request.findByIdAndDelete = async (id) => requests.delete(String(id));
  Request.countDocuments = async (filter) =>
    [...requests.values()].filter((request) => matchesFilter(request, filter)).length;
  Request.find = (filter) =>
    queryFor([...requests.values()].filter((request) => matchesFilter(request, filter)));
  FileRecord.findById = (id) => queryFor(fileRecords.get(String(id)) || null);

  ApprovalHistory.create = async (entry) => {
    const saved = { ...entry, _id: `history-${history.length + 1}`, timestamp: new Date() };
    history.push(saved);
    return saved;
  };
  ApprovalHistory.deleteOne = async ({ _id }) => {
    history = history.filter((entry) => entry._id !== _id);
  };
  ApprovalHistory.distinct = async (_field, filter) => [
    ...new Set(
      history
        .filter((entry) => entry.actorId.toString() === filter.actorId.toString())
        .map((entry) => entry.requestId.toString())
    ),
  ];
  ApprovalHistory.exists = async ({ requestId, actorId }) =>
    history.some(
      (entry) =>
        entry.requestId.toString() === requestId.toString() &&
        entry.actorId.toString() === actorId.toString()
    );
  ApprovalHistory.find = () => queryFor(history);
  Notification.create = async (data) => {
    const notification = {
      ...data,
      _id: `notification-${notifications.length + 1}`,
      isRead: false,
      createdAt: new Date(),
    };
    notifications.push(notification);
    return notification;
  };
  Notification.find = (filter) => {
    let result = notifications.filter(
      (notification) => notification.userId.toString() === filter.userId.toString()
    );
    const query = {
      sort() {
        return this;
      },
      skip(amount) {
        result = result.slice(amount);
        return this;
      },
      limit(amount) {
        result = result.slice(0, amount);
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  };
  Notification.countDocuments = async (filter) =>
    notifications.filter(
      (notification) =>
        notification.userId.toString() === filter.userId.toString() &&
        (filter.isRead === undefined || notification.isRead === filter.isRead)
    ).length;
  Notification.findOneAndUpdate = async (filter, update) => {
    const notification = notifications.find(
      (item) =>
        item._id === String(filter._id) &&
        item.userId.toString() === filter.userId.toString()
    );
    if (notification) Object.assign(notification, update);
    return notification || null;
  };
  Notification.updateMany = async (filter, update) => {
    let modifiedCount = 0;
    for (const notification of notifications) {
      if (
        notification.userId.toString() === filter.userId.toString() &&
        (filter.isRead === undefined || notification.isRead === filter.isRead)
      ) {
        Object.assign(notification, update);
        modifiedCount += 1;
      }
    }
    return { modifiedCount };
  };

  uploadImplementation = async () => {
    uploadCount += 1;
    if (failUploadAt === uploadCount) throw new Error('Mock upload failure.');
    return { _id: `file-${uploadCount}` };
  };
  deleteImplementation = async (id) => {
    deletedFiles.push(id);
  };

  workflowService.routeNewRequest = async (request, requester) => {
    routedRequestCount += 1;
    if (request.requestType === 'medical_leave' && !findCoordinatorEnabled) {
      const error = new Error('No active Class Coordinator is assigned.');
      error.statusCode = 503;
      throw error;
    }
    return {
      approver: { _id: 'teacher-1', isActive: true },
      stage: request.requestType === 'medical_leave' ? 'coordinator' : 'teacher',
    };
  };
  workflowService.saveRequestWithHistory = async (request, entry) => {
    history.push({ ...entry, timestamp: new Date() });
    await request.save();
  };
  workflowService.processApprove = async () => ({ _id: 'request-1' });
  workflowService.processReject = async () => ({ _id: 'request-1' });
  workflowService.processReturn = async () => ({ _id: 'request-1' });
  workflowService.processResubmit = async (request, requester, updates) => {
    lastResubmitUpdates = updates;
    if (failResubmit) throw new Error('Mock resubmission failure.');
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'attachments') request[key] = value;
    }
    if (updates.attachments) request.attachments.push(...updates.attachments);
    request.status = 'under_review';
    request.currentApproverId = makeId('teacher-1');
    request.resubmissionCount += 1;
    await request.save();
    return request;
  };
};

let findCoordinatorEnabled = true;

describe('request lifecycle routes and workflow', () => {
  before(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const app = express();
    app.use(express.json());
    app.use('/api/requests', requestRoutes);
    app.use('/api/files', fileRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('listening', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  beforeEach(() => {
    users.clear();
    requests.clear();
    fileRecords.clear();
    notifications = [];
    history = [];
    nextRequestId = 0;
    uploadCount = 0;
    deletedFiles = [];
    failUploadAt = 0;
    failResubmit = false;
    findCoordinatorEnabled = true;
    routedRequestCount = 0;
    lastResubmitUpdates = undefined;

    users.set('student-1', makeUser('student-1'));
    users.set('student-2', makeUser('student-2'));
    users.set('teacher-1', makeUser('teacher-1', 'teacher'));
    users.set('teacher-2', makeUser('teacher-2', 'teacher'));
    users.set('admin-1', makeUser('admin-1', 'admin'));
    installRouteMocks();
  });

  after(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  for (const type of Object.keys(requestFields)) {
    it(`submits a valid ${type} request using authenticated academic identity`, async () => {
      const body = createSubmissionBody(type, {
        branch: 'Attacker Branch',
        rollNumber: 'ATTACKER-ROLL',
        requesterId: 'student-2',
      });
      const { response, data } = await send('/requests', {
        user: users.get('student-1'),
        method: 'POST',
        body: makeFormData(body, type === 'medical_leave' ? 1 : 0),
        multipart: true,
      });

      assert.equal(response.status, 201);
      const savedRequest = requests.get(data.request._id);
      assert.equal(savedRequest.requesterId.toString(), 'student-1');
      assert.equal(savedRequest.requesterInfo.branch, 'Test Branch');
      assert.equal(savedRequest.requesterInfo.rollNumber, 'ROLL-student-1');
      assert.equal(history.at(-1).action, 'submitted');
      assert.equal(history.at(-1).actorId, 'student-1');
      assert.equal(history.at(-1).actorRole, 'student');
      assert.equal(history.at(-1).actorName, 'student student-1');
      assert.equal(history.at(-1).nextStage, data.request.currentApprovalStage);
      assert.ok(history.at(-1).timestamp instanceof Date);
    });

    it(`rejects ${type} requests missing type-specific required fields before writes`, async () => {
      const { response, data } = await send('/requests', {
        user: users.get('student-1'),
        method: 'POST',
        body: makeFormData({
          requestType: type,
          description: 'A sufficiently detailed request explanation.',
        }, type === 'medical_leave' ? 1 : 0),
        multipart: true,
      });

      assert.equal(response.status, 400);
      assert.match(data.message, /required/i);
      assert.equal(requests.size, 0);
      assert.equal(uploadCount, 0);
    });
  }

  it('rejects unsupported request types and short descriptions', async () => {
    for (const body of [
      { requestType: 'unknown', description: 'Long enough description.' },
      { requestType: 'other_grievance', description: 'short', grievanceCategory: 'Other' },
    ]) {
      const { response } = await send('/requests', {
        user: users.get('student-1'),
        method: 'POST',
        body: makeFormData(body),
        multipart: true,
      });
      assert.equal(response.status, 400);
    }
    assert.equal(requests.size, 0);
  });

  it('rejects invalid dates and reversed medical leave ranges', async () => {
    const invalidCases = [
      createSubmissionBody('attendance_correction', { attendanceDate: '2026-02-30' }),
      createSubmissionBody('event_attendance', { eventDate: 'not-a-date' }),
      createSubmissionBody('medical_leave', {
        leaveStartDate: '2026-10-06',
        leaveEndDate: '2026-10-05',
      }),
    ];
    for (const body of invalidCases) {
      const { response } = await send('/requests', {
        user: users.get('student-1'),
        method: 'POST',
        body: makeFormData(body, body.requestType === 'medical_leave' ? 1 : 0),
        multipart: true,
      });
      assert.equal(response.status, 400);
    }
    assert.equal(requests.size, 0);
  });

  it('rejects a malformed target department before routing or creating a request', async () => {
    const { response, data } = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: {
        ...createSubmissionBody('other_grievance'),
        targetDepartment: { name: 'Target Department' },
      },
    });

    assert.equal(response.status, 400);
    assert.match(data.message, /targetDepartment must be a department name/i);
    assert.equal(requests.size, 0);
    assert.equal(notifications.length, 0);
  });

  it('requires a medical document and does not upload when it is missing', async () => {
    const { response, data } = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: makeFormData(createSubmissionBody('medical_leave')),
      multipart: true,
    });

    assert.equal(response.status, 400);
    assert.match(data.message, /supporting document/i);
    assert.equal(requests.size, 0);
    assert.equal(uploadCount, 0);
    assert.equal(routedRequestCount, 0);
  });

  it('enforces the existing file type and per-request file count limits', async () => {
    const invalidType = makeFormData(createSubmissionBody('attendance_correction'));
    invalidType.append('files', new Blob(['not a PDF'], { type: 'text/plain' }), 'notes.txt');
    const invalidResponse = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: invalidType,
      multipart: true,
    });
    assert.equal(invalidResponse.response.status, 400);

    const tooManyFiles = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: makeFormData(createSubmissionBody('attendance_correction'), 6),
      multipart: true,
    });
    assert.equal(tooManyFiles.response.status, 400);
    assert.match(tooManyFiles.data.message, /no more than 5/i);

    const oversized = makeFormData(createSubmissionBody('attendance_correction'));
    oversized.append(
      'files',
      new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'application/pdf' }),
      'large.pdf'
    );
    const oversizedResponse = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: oversized,
      multipart: true,
    });
    assert.equal(oversizedResponse.response.status, 400);
    assert.match(oversizedResponse.data.message, /5 MB/i);
    assert.equal(requests.size, 0);
    assert.equal(uploadCount, 0);
  });

  it('uses storage-service file signature validation in addition to MIME and extension checks', () => {
    assert.doesNotThrow(() =>
      storageService.validateFileBuffer(
        Buffer.from('%PDF-1.7'),
        'medical.pdf',
        'application/pdf'
      )
    );
    assert.throws(
      () =>
        storageService.validateFileBuffer(
          Buffer.from('not a PDF'),
          'medical.pdf',
          'application/pdf'
        ),
      /Signature does not match PDF/
    );
  });

  it('blocks medical submission without an active Class Coordinator before create or upload', async () => {
    findCoordinatorEnabled = false;
    const { response, data } = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: makeFormData(createSubmissionBody('medical_leave'), 1),
      multipart: true,
    });

    assert.equal(response.status, 503);
    assert.match(data.message, /Class Coordinator/i);
    assert.equal(requests.size, 0);
    assert.equal(uploadCount, 0);
    assert.equal(notifications.length, 0);
  });

  for (const [type, unavailableRole] of [
    ['attendance_correction', 'HOD'],
    ['event_attendance', 'HOD'],
    ['medical_leave', 'Class Coordinator'],
    ['other_grievance', 'Dean'],
  ]) {
    it(`blocks ${type} submission when no eligible initial approver exists`, async () => {
      workflowService.routeNewRequest = realWorkflow.routeNewRequest;
      User.findOne = async () => null;
      const { response, data } = await send('/requests', {
        user: users.get('student-1'),
        method: 'POST',
        body: makeFormData(
          createSubmissionBody(type),
          type === 'medical_leave' ? 1 : 0
        ),
        multipart: true,
      });

      assert.equal(response.status, 503);
      assert.match(data.message, new RegExp(unavailableRole, 'i'));
      assert.equal(requests.size, 0);
      assert.equal(uploadCount, 0);
      assert.equal(history.length, 0);
      assert.equal(notifications.length, 0);
    });
  }

  it('rejects a routed approver that is not active before creating or uploading', async () => {
    workflowService.routeNewRequest = async () => ({
      approver: { _id: 'inactive-approver', isActive: false },
      stage: 'teacher',
    });
    const { response, data } = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: makeFormData(createSubmissionBody('attendance_correction'), 1),
      multipart: true,
    });

    assert.equal(response.status, 503);
    assert.match(data.message, /active subject teacher/i);
    assert.equal(requests.size, 0);
    assert.equal(uploadCount, 0);
    assert.equal(history.length, 0);
    assert.equal(notifications.length, 0);
  });

  it('rejects an invalid routed approver before creating or uploading', async () => {
    workflowService.routeNewRequest = async () => ({
      approver: { isActive: true },
      stage: 'teacher',
    });
    const { response, data } = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: makeFormData(createSubmissionBody('attendance_correction'), 1),
      multipart: true,
    });

    assert.equal(response.status, 503);
    assert.match(data.message, /active subject teacher/i);
    assert.equal(requests.size, 0);
    assert.equal(uploadCount, 0);
    assert.equal(history.length, 0);
  });

  it('cleans uploaded files and removes the request when submission fails', async () => {
    failUploadAt = 2;
    const { response } = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: makeFormData(createSubmissionBody('medical_leave'), 2),
      multipart: true,
    });

    assert.equal(response.status, 500);
    assert.equal(requests.size, 0);
    assert.deepEqual(deletedFiles, ['file-1']);
    assert.equal(history.length, 0);
    assert.equal(notifications.length, 0);
  });

  it('notifies only the student and routed staff after a request is created', async () => {
    const { response, data } = await send('/requests', {
      user: users.get('student-1'),
      method: 'POST',
      body: makeFormData(createSubmissionBody('event_attendance')),
      multipart: true,
    });

    assert.equal(response.status, 201);
    assert.deepEqual(
      notifications.map(({ userId, requestId, type }) => ({
        userId: userId.toString(),
        requestId: requestId.toString(),
        type,
      })),
      [
        {
          userId: 'student-1',
          requestId: data.request._id,
          type: 'request_submitted',
        },
        {
          userId: 'teacher-1',
          requestId: data.request._id,
          type: 'request_assigned',
        },
      ]
    );
    assert.equal(notifications.length, 2);
  });

  it('prevents students from viewing another student’s request and history', async () => {
    const request = seedRequest({ requesterId: 'student-2' });
    for (const path of [`/requests/${request._id}`, `/requests/${request._id}/history`]) {
      const { response } = await send(path, { user: users.get('student-1') });
      assert.equal(response.status, 403);
    }
  });

  it('scopes student, staff, and admin request lists to their access rules', async () => {
    const assigned = seedRequest({ requesterId: 'student-2', currentApproverId: 'teacher-1' });
    const acted = seedRequest({ requesterId: 'student-2', currentApproverId: 'teacher-2' });
    const unrelated = seedRequest({ requesterId: 'student-2', currentApproverId: 'teacher-2' });
    const own = seedRequest({ requesterId: 'student-1', currentApproverId: 'teacher-2' });
    history.push({ requestId: acted._id, actorId: 'teacher-1', action: 'approved' });

    const studentList = await send('/requests', { user: users.get('student-1') });
    assert.deepEqual(
      studentList.data.requests.map((request) => request._id),
      [own._id]
    );
    const staffList = await send('/requests', { user: users.get('teacher-1') });
    assert.deepEqual(
      new Set(staffList.data.requests.map((request) => request._id)),
      new Set([assigned._id, acted._id])
    );
    const adminList = await send('/requests', { user: users.get('admin-1') });
    assert.equal(adminList.data.requests.length, 4);
    assert.ok(!staffList.data.requests.some((request) => request._id === unrelated._id));
  });

  it('counts staff action items only while they are the current approver', async () => {
    const assigned = seedRequest({ currentApproverId: 'teacher-1' });
    const previouslyActed = seedRequest({ currentApproverId: 'teacher-2' });
    history.push({
      requestId: previouslyActed._id,
      actorId: 'teacher-1',
      action: 'forwarded',
    });

    const stats = await send('/requests/stats', { user: users.get('teacher-1') });
    assert.equal(stats.data.stats.total, 2);
    assert.equal(stats.data.stats.under_review, 1);

    const actionable = await send('/requests?actionable=true&limit=6', {
      user: users.get('teacher-1'),
    });
    assert.deepEqual(
      actionable.data.requests.map((request) => request._id),
      [assigned._id]
    );
  });

  it('prevents staff without current assignment or prior action from viewing request or history', async () => {
    const request = seedRequest({ requesterId: 'student-2', currentApproverId: 'teacher-2' });
    for (const path of [`/requests/${request._id}`, `/requests/${request._id}/history`]) {
      const { response } = await send(path, { user: users.get('teacher-1') });
      assert.equal(response.status, 403);
    }
  });

  it('allows staff who previously acted on a request to view its history', async () => {
    const request = seedRequest({ requesterId: 'student-2', currentApproverId: 'teacher-2' });
    history.push({ requestId: request._id, actorId: 'teacher-1', action: 'forwarded' });
    const { response } = await send(`/requests/${request._id}/history`, {
      user: users.get('teacher-1'),
    });
    assert.equal(response.status, 200);
  });

  it('limits notification lists, unread counts, and read updates to their owner', async () => {
    notifications.push(
      { _id: 'student-1-notification', userId: 'student-1', isRead: false, message: 'Own.' },
      { _id: 'student-2-notification', userId: 'student-2', isRead: false, message: 'Private.' }
    );

    const list = await send('/notifications', { user: users.get('student-1') });
    assert.deepEqual(
      list.data.notifications.map((notification) => notification._id),
      ['student-1-notification']
    );
    assert.equal(list.data.unreadCount, 1);

    const denied = await send('/notifications/student-2-notification/read', {
      user: users.get('student-1'),
      method: 'PATCH',
    });
    assert.equal(denied.response.status, 404);
    assert.equal(notifications[1].isRead, false);

    const marked = await send('/notifications/student-1-notification/read', {
      user: users.get('student-1'),
      method: 'PATCH',
    });
    assert.equal(marked.response.status, 200);
    assert.equal(notifications[0].isRead, true);

    const updatedList = await send('/notifications', { user: users.get('student-1') });
    assert.equal(updatedList.data.unreadCount, 0);
  });

  it('marks all and only the authenticated user’s notifications as read', async () => {
    notifications.push(
      { _id: 'student-1-unread', userId: 'student-1', isRead: false, message: 'Own.' },
      { _id: 'student-2-unread', userId: 'student-2', isRead: false, message: 'Private.' }
    );
    const result = await send('/notifications/read-all', {
      user: users.get('student-1'),
      method: 'PATCH',
    });

    assert.equal(result.response.status, 200);
    assert.equal(notifications[0].isRead, true);
    assert.equal(notifications[1].isRead, false);
  });

  it('restricts file access to owners, assigned/acting staff, and admins', async () => {
    const request = seedRequest({
      requesterId: 'student-2',
      currentApproverId: 'teacher-2',
    });
    fileRecords.set('file-access-test', {
      _id: 'file-access-test',
      requestId: request._id,
      uploaderId: 'teacher-1',
      originalName: 'evidence.pdf',
      mimeType: 'application/pdf',
      fileSize: 8,
      format: 'pdf',
    });

    const unassignedStaff = await send('/files/file-access-test', {
      user: users.get('teacher-1'),
    });
    assert.equal(unassignedStaff.response.status, 403);

    const owner = await send('/files/file-access-test', {
      user: users.get('student-2'),
    });
    assert.equal(owner.response.status, 200);

    const otherStudent = await send('/files/file-access-test', {
      user: users.get('student-1'),
    });
    assert.equal(otherStudent.response.status, 403);

    const admin = await send('/files/file-access-test', {
      user: users.get('admin-1'),
    });
    assert.equal(admin.response.status, 200);

    history.push({ requestId: request._id, actorId: 'teacher-1', action: 'returned' });
    const priorActor = await send('/files/file-access-test', {
      user: users.get('teacher-1'),
    });
    assert.equal(priorActor.response.status, 200);
  });

  it('allows only the currently assigned approver to act', async () => {
    const request = seedRequest({ currentApproverId: 'teacher-2' });
    const { response } = await send(`/requests/${request._id}/approve`, {
      user: users.get('teacher-1'),
      method: 'PUT',
      body: { remarks: 'Reviewed.' },
    });
    assert.equal(response.status, 403);
  });

  it('denies workflow actions to students and admins even if a request points to their account', async () => {
    workflowService.processApprove = realWorkflow.processApprove;

    for (const actor of [users.get('student-1'), users.get('admin-1')]) {
      const request = seedRequest({
        currentApproverId: actor._id,
        currentApprovalStage: 'teacher',
      });
      const { response } = await send(`/requests/${request._id}/approve`, {
        user: actor,
        method: 'PUT',
        body: { remarks: 'Attempted approval.' },
      });

      assert.equal(response.status, 403);
      assert.equal(request.status, 'under_review');
    }
  });

  for (const action of ['reject', 'return']) {
    it(`requires non-empty remarks to ${action} a request`, async () => {
      const request = seedRequest();
      const { response, data } = await send(`/requests/${request._id}/${action}`, {
        user: users.get('teacher-1'),
        method: 'PUT',
        body: { remarks: '   ' },
      });
      assert.equal(response.status, 400);
      assert.match(data.message, /remarks are required/i);
    });
  }

  it('prevents actions on already completed requests', async () => {
    const request = seedRequest({
      status: 'approved',
      currentApprovalStage: 'completed',
      currentApproverId: null,
    });
    const { response, data } = await send(`/requests/${request._id}/approve`, {
      user: users.get('teacher-1'),
      method: 'PUT',
      body: {},
    });
    assert.equal(response.status, 400);
    assert.match(data.message, /already approved/i);
  });

  it('allows only the original student to resubmit a returned request', async () => {
    const request = seedRequest({
      requesterId: 'student-2',
      status: 'returned',
      currentApproverId: 'teacher-1',
    });
    const { response } = await send(`/requests/${request._id}/resubmit`, {
      user: users.get('student-1'),
      method: 'PUT',
      body: makeFormData({ description: 'Updated and sufficiently detailed explanation.' }),
      multipart: true,
    });
    assert.equal(response.status, 403);
    assert.equal(uploadCount, 0);
  });

  it('does not allow resubmission unless the request is returned', async () => {
    const request = seedRequest({ status: 'under_review' });
    const { response, data } = await send(`/requests/${request._id}/resubmit`, {
      user: users.get('student-1'),
      method: 'PUT',
      body: makeFormData({
        description: 'Updated and sufficiently detailed explanation.',
      }),
      multipart: true,
    });
    assert.equal(response.status, 400);
    assert.match(data.message, /only returned requests/i);
    assert.equal(uploadCount, 0);
  });

  it('passes only permitted resubmission fields and preserves existing attachments', async () => {
    const request = seedRequest({
      status: 'returned',
      attachments: ['old-file-1'],
      currentApprovalStage: 'teacher',
    });
    const { response } = await send(`/requests/${request._id}/resubmit`, {
      user: users.get('student-1'),
      method: 'PUT',
      body: makeFormData({
        description: 'Updated and sufficiently detailed explanation.',
        subject: 'Updated Subject',
        requesterId: 'student-2',
        requesterInfo: '{"name":"Changed"}',
        requestType: 'medical_leave',
        status: 'approved',
        currentApproverId: 'teacher-2',
        currentApprovalStage: 'dean',
        workflowHistory: '[]',
      }, 1),
      multipart: true,
    });

    assert.equal(response.status, 200);
    assert.equal(lastResubmitUpdates.description, 'Updated and sufficiently detailed explanation.');
    assert.equal(lastResubmitUpdates.subject, 'Updated Subject');
    for (const protectedField of [
      'requesterId',
      'requesterInfo',
      'requestType',
      'status',
      'currentApproverId',
      'currentApprovalStage',
      'workflowHistory',
    ]) {
      assert.equal(Object.hasOwn(lastResubmitUpdates, protectedField), false);
    }
    assert.deepEqual(request.attachments, ['old-file-1', 'file-1']);
  });

  it('cleans newly uploaded files when resubmission fails', async () => {
    const request = seedRequest({ status: 'returned', attachments: ['old-file-1'] });
    failResubmit = true;
    const { response } = await send(`/requests/${request._id}/resubmit`, {
      user: users.get('student-1'),
      method: 'PUT',
      body: makeFormData({
        description: 'Updated and sufficiently detailed explanation.',
      }, 1),
      multipart: true,
    });

    assert.equal(response.status, 500);
    assert.deepEqual(deletedFiles, ['file-1']);
    assert.deepEqual(request.attachments, ['old-file-1']);
    assert.equal(request.status, 'returned');
  });

  it('requires medical supporting documents to remain attached on resubmission', async () => {
    const request = seedRequest({
      requestType: 'medical_leave',
      status: 'returned',
      currentApprovalStage: 'coordinator',
      attachments: [],
      leaveStartDate: new Date('2026-10-03T00:00:00.000Z'),
      leaveEndDate: new Date('2026-10-05T00:00:00.000Z'),
    });
    const { response, data } = await send(`/requests/${request._id}/resubmit`, {
      user: users.get('student-1'),
      method: 'PUT',
      body: makeFormData({
        description: 'Updated and sufficiently detailed explanation.',
      }),
      multipart: true,
    });
    assert.equal(response.status, 400);
    assert.match(data.message, /supporting document/i);
    assert.equal(uploadCount, 0);
  });

  it('resubmits medical and non-medical requests to their original approval stage', async () => {
    const student = users.get('student-1');
    const coordinator = makeUser('coordinator-1', 'coordinator');
    const mentor = makeUser('mentor-1', 'mentor');
    User.findOne = async (filter) => {
      if (filter.role?.$in?.includes('coordinator')) return coordinator;
      if (filter.role?.$in?.includes('mentor')) return mentor;
      if (filter.role === 'hod') return makeUser('hod-1', 'hod');
      if (filter.role === 'dean') return makeUser('dean-1', 'dean');
      return null;
    };

    for (const [type, stage, expectedApprover] of [
      ['medical_leave', 'mentor', mentor],
      ['event_attendance', 'coordinator', coordinator],
      ['other_grievance', 'hod', makeUser('hod-1', 'hod')],
      ['other_grievance', 'dean', makeUser('dean-1', 'dean')],
    ]) {
      const request = makeDocument({
        requesterId: student._id,
        requestType: type,
        status: 'returned',
        currentApprovalStage: stage,
        currentApproverId: 'teacher-1',
        description: 'A sufficiently detailed request explanation.',
        attachments: type === 'medical_leave' ? ['medical-file'] : [],
      });
      await realWorkflow.processResubmit(request, student, {
        description: 'A corrected and sufficiently detailed explanation.',
      });

      assert.equal(request.currentApprovalStage, stage);
      assert.equal(request.currentApproverId.toString(), expectedApprover._id);
      assert.equal(request.status, 'under_review');
      assert.equal(history.at(-1).action, 'resubmitted');
      assert.equal(history.at(-1).actorId, student._id);
      assert.equal(history.at(-1).previousStage, 'student');
      assert.equal(history.at(-1).nextStage, stage);
    }
  });

  it('leaves non-medical resubmissions returned when that approval stage is unavailable', async () => {
    const request = makeDocument({
      requesterId: 'student-1',
      requestType: 'event_attendance',
      status: 'returned',
      currentApprovalStage: 'coordinator',
      currentApproverId: 'teacher-1',
      eventName: 'Test Event',
      eventDate: new Date('2026-10-02T00:00:00.000Z'),
    });
    User.findOne = async () => null;
    const historyCount = history.length;

    await assert.rejects(
      realWorkflow.processResubmit(request, users.get('student-1'), {
        description: 'A corrected and sufficiently detailed explanation.',
      }),
      /No active Class Coordinator.*request remains returned/
    );
    assert.equal(request.status, 'returned');
    assert.equal(request.currentApprovalStage, 'coordinator');
    assert.equal(history.length, historyCount);
  });

  it('does not route requests to an HOD from an unrelated department', async () => {
    User.findOne = async (filter) => {
      if (filter.role === 'hod' && !filter.headOfDepartments) {
        return makeUser('unassigned-hod', 'hod');
      }
      return null;
    };

    await assert.rejects(
      realWorkflow.routeNewRequest(
        { requestType: 'attendance_correction', subject: 'Test Subject' },
        users.get('student-1')
      ),
      /No active HOD is available/
    );
  });

  it('routes grievances to the selected target department HOD', async () => {
    const targetHod = makeUser('target-hod', 'hod', {
      headOfDepartments: ['Target Department'],
    });
    let requestedDepartments;
    User.findOne = async (filter) => {
      if (filter.role === 'hod') {
        requestedDepartments = filter.headOfDepartments.$in;
        return requestedDepartments.includes('Target Department') ? targetHod : null;
      }
      return null;
    };

    const route = await realWorkflow.routeNewRequest(
      { requestType: 'other_grievance', targetDepartment: 'Target Department' },
      users.get('student-1')
    );
    assert.deepEqual(requestedDepartments, ['Target Department']);
    assert.equal(route.approver._id, targetHod._id);
    assert.equal(route.stage, 'hod');
  });

  it('resubmits a grievance to the HOD for its saved target department', async () => {
    const student = users.get('student-1');
    const targetHod = makeUser('target-hod', 'hod', {
      headOfDepartments: ['Target Department'],
    });
    User.findOne = async (filter) => {
      if (
        filter.role === 'hod' &&
        filter.headOfDepartments.$in.includes('Target Department')
      ) {
        return targetHod;
      }
      return null;
    };
    const request = makeDocument({
      requesterId: student._id,
      requestType: 'other_grievance',
      targetDepartment: 'Target Department',
      status: 'returned',
      currentApprovalStage: 'hod',
      currentApproverId: 'old-hod',
      description: 'A sufficiently detailed request explanation.',
    });

    await realWorkflow.processResubmit(request, student, {
      description: 'A corrected and sufficiently detailed explanation.',
    });

    assert.equal(request.currentApprovalStage, 'hod');
    assert.equal(request.currentApproverId.toString(), targetHod._id);
  });

  it('does not assign new requests to inactive staff', async () => {
    let coordinatorFilter;
    User.findOne = async (filter) => {
      if (filter.role?.$in?.includes('coordinator')) {
        coordinatorFilter = filter;
        return null;
      }
      return null;
    };

    await assert.rejects(
      realWorkflow.routeNewRequest({ requestType: 'medical_leave' }, users.get('student-1')),
      /No active Class Coordinator is assigned/
    );
    assert.equal(coordinatorFilter.isActive, true);
  });

  it('does not route Event Attendance with no subject to an arbitrary subject teacher or Dean', async () => {
    const coordinator = makeUser('coordinator-1', 'coordinator');
    let subjectLookupCount = 0;
    User.findOne = async (filter) => {
      if (filter.assignedSubjects) {
        subjectLookupCount += 1;
        return makeUser('subject-teacher', 'teacher');
      }
      if (filter.role?.$in?.includes('coordinator')) return coordinator;
      if (filter.role === 'dean') return makeUser('dean-1', 'dean');
      return null;
    };

    const route = await realWorkflow.routeNewRequest(
      { requestType: 'event_attendance', eventName: 'Campus Event' },
      users.get('student-1')
    );
    assert.equal(subjectLookupCount, 0);
    assert.equal(route.approver._id, coordinator._id);
    assert.equal(route.stage, 'coordinator');

    User.findOne = async (filter) =>
      filter.role === 'dean' ? makeUser('dean-1', 'dean') : null;
    await assert.rejects(
      realWorkflow.routeNewRequest(
        { requestType: 'event_attendance', eventName: 'Campus Event' },
        users.get('student-1')
      ),
      /No active HOD is available/
    );
  });

  it('does not skip a medical stage when its next approver is unavailable', async () => {
    const student = users.get('student-1');
    const coordinator = makeUser('teacher-1', 'teacher');
    coordinator.assignedClass = { branch: 'Test Branch', year: 2, section: 'A' };
    User.findOne = async () => null;
    const request = makeDocument({
      requesterId: student._id,
      requestType: 'medical_leave',
      status: 'under_review',
      currentApprovalStage: 'coordinator',
      currentApproverId: coordinator._id,
    });
    const historyCount = history.length;

    await assert.rejects(
      realWorkflow.processApprove(request, coordinator, 'Coordinator review complete.'),
      /No active Mentor/
    );
    assert.equal(request.status, 'under_review');
    assert.equal(request.currentApprovalStage, 'coordinator');
    assert.equal(history.length, historyCount);
  });

  it('notifies the correct recipients for each medical workflow event', async () => {
    const student = users.get('student-1');
    const coordinator = makeUser('coordinator-1', 'coordinator');
    const mentor = makeUser('mentor-1', 'mentor');
    const dean = makeUser('dean-1', 'dean');
    User.findOne = async (filter) => {
      if (filter.role?.$in?.includes('coordinator')) return coordinator;
      if (filter.role?.$in?.includes('mentor')) return mentor;
      if (filter.role === 'hod') return makeUser('hod-1', 'hod');
      if (filter.role === 'dean') return dean;
      return null;
    };
    const makeMedicalRequest = (stage, approver, status = 'under_review') =>
      makeDocument({
        requesterId: student._id,
        requestType: 'medical_leave',
        status,
        currentApprovalStage: stage,
        currentApproverId: approver._id,
        description: 'A sufficiently detailed request explanation.',
      });

    const forwarded = makeMedicalRequest('coordinator', coordinator);
    await realWorkflow.processApprove(forwarded, coordinator, 'Forwarding notes.');
    assert.deepEqual(
      notifications.map(({ userId, type }) => [userId.toString(), type]),
      [
        ['student-1', 'request_forwarded'],
        ['mentor-1', 'request_assigned'],
      ]
    );
    assert.ok(notifications.every((notification) => !Object.hasOwn(notification, 'attachments')));

    notifications = [];
    const rejected = makeMedicalRequest('coordinator', coordinator);
    await realWorkflow.processReject(rejected, coordinator, 'Rejected notes.');
    assert.deepEqual(
      notifications.map(({ userId, type }) => [userId.toString(), type]),
      [['student-1', 'request_rejected']]
    );

    notifications = [];
    const returned = makeMedicalRequest('coordinator', coordinator);
    await realWorkflow.processReturn(returned, coordinator, 'Correction notes.');
    assert.deepEqual(
      notifications.map(({ userId, type }) => [userId.toString(), type]),
      [['student-1', 'request_returned']]
    );

    notifications = [];
    const resubmitted = makeMedicalRequest('coordinator', coordinator, 'returned');
    await realWorkflow.processResubmit(resubmitted, student, {
      description: 'A corrected and sufficiently detailed explanation.',
    });
    assert.deepEqual(
      notifications.map(({ userId, type }) => [userId.toString(), type]),
      [
        ['coordinator-1', 'request_assigned'],
        ['student-1', 'request_resubmitted'],
      ]
    );

    notifications = [];
    const finallyApproved = makeMedicalRequest('dean', dean);
    await realWorkflow.processApprove(finallyApproved, dean, 'Final approval.');
    assert.equal(finallyApproved.status, 'approved');
    assert.deepEqual(
      notifications.map(({ userId, type }) => [userId.toString(), type]),
      [['student-1', 'request_approved']]
    );
  });

  it('does not undo a successful workflow action when notification storage fails', async () => {
    const approver = users.get('teacher-1');
    const request = makeDocument({
      requesterId: 'student-1',
      requestType: 'attendance_correction',
      status: 'under_review',
      currentApprovalStage: 'teacher',
      currentApproverId: approver._id,
    });
    const originalCreate = Notification.create;
    const originalConsoleError = console.error;
    Notification.create = async () => {
      throw new Error('Mock notification failure.');
    };
    console.error = () => {};

    try {
      await realWorkflow.processReject(request, approver, 'Rejected notes.');
    } finally {
      Notification.create = originalCreate;
      console.error = originalConsoleError;
    }

    assert.equal(request.status, 'rejected');
    assert.equal(history.at(-1).action, 'rejected');
  });

  it('records forward, approve, reject, and return history with correct actors, stages and remarks', async () => {
    const student = users.get('student-1');
    const coordinator = makeUser('teacher-1', 'teacher');
    coordinator.assignedClass = { branch: 'Test Branch', year: 2, section: 'A' };
    const mentor = makeUser('mentor-1', 'mentor');
    User.findOne = async () => mentor;
    const medicalRequest = makeDocument({
      requesterId: student._id,
      requestType: 'medical_leave',
      status: 'under_review',
      currentApprovalStage: 'coordinator',
      currentApproverId: coordinator._id,
    });
    await realWorkflow.processApprove(medicalRequest, coordinator, 'Forwarding notes.');
    assert.deepEqual(
      {
        actorId: history.at(-1).actorId,
        actorRole: history.at(-1).actorRole,
        actorName: history.at(-1).actorName,
        action: history.at(-1).action,
        remarks: history.at(-1).remarks,
        previousStage: history.at(-1).previousStage,
        nextStage: history.at(-1).nextStage,
      },
      {
        actorId: coordinator._id,
        actorRole: 'teacher',
        actorName: coordinator.name,
        action: 'forwarded',
        remarks: 'Forwarding notes.',
        previousStage: 'coordinator',
        nextStage: 'mentor',
      }
    );
    assert.ok(history.at(-1).timestamp instanceof Date);

    const approver = users.get('teacher-1');
    const approved = makeDocument({
      requesterId: student._id,
      requestType: 'attendance_correction',
      status: 'under_review',
      currentApprovalStage: 'teacher',
      currentApproverId: approver._id,
    });
    await realWorkflow.processApprove(approved, approver, 'Approved notes.');
    assert.equal(history.at(-1).action, 'approved');
    assert.equal(history.at(-1).actorId, approver._id);
    assert.equal(history.at(-1).actorRole, 'teacher');
    assert.equal(history.at(-1).actorName, approver.name);
    assert.equal(history.at(-1).previousStage, 'teacher');
    assert.equal(history.at(-1).nextStage, 'completed');

    const rejected = makeDocument({
      requesterId: student._id,
      requestType: 'attendance_correction',
      status: 'under_review',
      currentApprovalStage: 'teacher',
      currentApproverId: approver._id,
    });
    await realWorkflow.processReject(rejected, approver, 'Rejected notes.');
    assert.equal(history.at(-1).action, 'rejected');
    assert.equal(history.at(-1).actorId, approver._id);
    assert.equal(history.at(-1).actorRole, 'teacher');
    assert.equal(history.at(-1).actorName, approver.name);
    assert.equal(history.at(-1).remarks, 'Rejected notes.');
    assert.equal(history.at(-1).previousStage, 'teacher');
    assert.equal(history.at(-1).nextStage, 'rejected');

    const returned = makeDocument({
      requesterId: student._id,
      requestType: 'attendance_correction',
      status: 'under_review',
      currentApprovalStage: 'teacher',
      currentApproverId: approver._id,
    });
    await realWorkflow.processReturn(returned, approver, 'Correction notes.');
    assert.equal(history.at(-1).action, 'returned');
    assert.equal(history.at(-1).actorId, approver._id);
    assert.equal(history.at(-1).actorRole, 'teacher');
    assert.equal(history.at(-1).actorName, approver.name);
    assert.equal(history.at(-1).remarks, 'Correction notes.');
    assert.equal(history.at(-1).previousStage, 'teacher');
    assert.equal(history.at(-1).nextStage, 'student');
    assert.ok(history.at(-1).timestamp instanceof Date);
  });
});
