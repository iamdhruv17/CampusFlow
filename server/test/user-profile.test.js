const assert = require('node:assert/strict');
const { afterEach, beforeEach, describe, it } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const userRoutes = require('../routes/user.routes');
const adminRoutes = require('../routes/admin.routes');

const testSecret = 'campusflow-profile-route-test-secret';
const originalJwtSecret = process.env.JWT_SECRET;
let originalFindById;
let originalFindOne;
let originalCreate;
let server;
let user;
let baseUrl;

const createUser = (role = 'student') => ({
  _id: 'profile-test-user',
  name: 'Test User',
  email: 'test-user@example.invalid',
  role,
  department: 'Engineering',
  branch: 'Computer Science',
  year: 2,
  section: 'A',
  rollNumber: 'TEST-001',
  assignedSubjects: [{ subjectName: 'Test Subject' }],
  assignedClass: { branch: 'Computer Science', year: 2, section: 'A' },
  mentoringClasses: [{ branch: 'Computer Science', year: 2, section: 'A' }],
  headOfDepartments: ['Engineering'],
  isActive: true,
  passwordHash: 'stored-hash',
  comparePassword: async (candidate) => candidate === 'correct-current-password',
  save: async function () {
    this.saveCount = (this.saveCount || 0) + 1;
  },
  toPublicProfile: function () {
    const { passwordHash, ...profile } = this;
    return profile;
  },
});

const makeQuery = (result) => ({
  select: async () => result,
  then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
});

const tokenFor = (
  role = user.role,
  id = user._id,
  tokenVersion = id === user._id ? user.tokenVersion || 0 : 0
) =>
  jwt.sign({ id, role, tokenVersion }, testSecret);

const send = async (path, { method = 'PUT', body, token } = {}) => {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: await response.json() };
};

describe('profile update security', () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = testSecret;
    originalFindById = User.findById;
    originalFindOne = User.findOne;
    originalCreate = User.create;
    user = createUser();
    User.findById = (id) => makeQuery(String(id) === user._id ? user : null);
    User.findOne = async () => null;
    User.create = async (data) => ({
      ...data,
      _id: 'created-user',
      toPublicProfile() {
        return { ...this };
      },
    });

    const app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
    app.use('/api/admin', adminRoutes);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('listening', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  afterEach(async () => {
    User.findById = originalFindById;
    User.findOne = originalFindOne;
    User.create = originalCreate;
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
  });

  it('allows an authenticated student to update their name', async () => {
    const { response, data } = await send('/users/profile', {
      body: { name: 'Updated Name' },
      token: tokenFor(),
    });

    assert.equal(response.status, 200);
    assert.equal(data.user.name, 'Updated Name');
    assert.equal(user.branch, 'Computer Science');
  });

  for (const [field, value] of [
    ['branch', 'Changed Branch'],
    ['year', 4],
    ['section', 'B'],
    ['role', 'admin'],
    ['rollNumber', 'CHANGED-001'],
    ['department', 'Changed Department'],
    ['assignedSubjects', []],
    ['assignedClass', { branch: 'Changed Branch', year: 4, section: 'B' }],
    ['mentoringClasses', []],
    ['headOfDepartments', []],
    ['isActive', false],
  ]) {
    it(`rejects self-service changes to ${field}`, async () => {
      const { response, data } = await send('/users/profile', {
        body: { [field]: value },
        token: tokenFor(),
      });

      assert.equal(response.status, 400);
      assert.match(data.message, /only be changed by an administrator/i);
      assert.equal(user.saveCount, undefined);
    });
  }

  it('rejects faculty assignment changes by authenticated staff', async () => {
    user.role = 'teacher';
    const { response, data } = await send('/users/profile', {
      body: {
        assignedSubjects: [],
        assignedClass: {},
        mentoringClasses: [],
        headOfDepartments: [],
      },
      token: tokenFor(),
    });

    assert.equal(response.status, 400);
    assert.match(data.message, /only be changed by an administrator/i);
    assert.equal(user.saveCount, undefined);
  });

  it('allows an authenticated user to change password with the correct current password', async () => {
    const { response, data } = await send('/users/profile', {
      body: {
        currentPassword: 'correct-current-password',
        newPassword: 'new-password',
      },
      token: tokenFor(),
    });

    assert.equal(response.status, 200);
    assert.equal(user.passwordHash, 'new-password');
    assert.equal(user.tokenVersion, 1);
    assert.equal(user.saveCount, 1);
    assert.equal(data.success, true);
  });

  it('increments the existing token version across repeated profile password changes', async () => {
    const first = await send('/users/profile', {
      body: {
        currentPassword: 'correct-current-password',
        newPassword: 'new-password',
      },
      token: tokenFor(),
    });
    assert.equal(first.response.status, 200);
    assert.equal(user.tokenVersion, 1);

    user.comparePassword = async (candidate) => candidate === 'new-password';
    const second = await send('/users/profile', {
      body: {
        currentPassword: 'new-password',
        newPassword: 'newer-password',
      },
      token: tokenFor(),
    });
    assert.equal(second.response.status, 200);
    assert.equal(user.passwordHash, 'newer-password');
    assert.equal(user.tokenVersion, 2);
  });

  it('rejects an incorrect current password', async () => {
    const { response, data } = await send('/users/profile', {
      body: { currentPassword: 'incorrect', newPassword: 'new-password' },
      token: tokenFor(),
    });

    assert.equal(response.status, 400);
    assert.equal(data.message, 'Current password is incorrect.');
    assert.equal(user.passwordHash, 'stored-hash');
    assert.equal(user.saveCount, undefined);
  });

  it('rejects unauthenticated profile updates', async () => {
    const { response } = await send('/users/profile', { body: { name: 'Updated Name' } });

    assert.equal(response.status, 401);
  });

  it('allows an administrator to update academic information through user management', async () => {
    const admin = createUser('admin');
    admin._id = 'admin-test-user';
    const target = user;
    User.findById = (id) => makeQuery(String(id) === admin._id ? admin : target);

    const { response, data } = await send('/admin/users/profile-test-user', {
      body: { branch: 'Updated Branch', year: 3, section: 'C' },
      token: tokenFor('admin', admin._id),
    });

    assert.equal(response.status, 200);
    assert.equal(target.branch, 'Updated Branch');
    assert.equal(target.year, 3);
    assert.equal(target.section, 'C');
    assert.equal(data.user.branch, 'Updated Branch');
  });

  it('increments the existing token version across repeated admin password changes', async () => {
    const admin = createUser('admin');
    admin._id = 'admin-password-user';
    user.tokenVersion = 4;
    User.findById = (id) => makeQuery(String(id) === admin._id ? admin : user);

    const first = await send('/admin/users/profile-test-user', {
      body: { password: 'admin-password-one' },
      token: tokenFor('admin', admin._id),
    });
    assert.equal(first.response.status, 200);
    assert.equal(user.tokenVersion, 5);

    const second = await send('/admin/users/profile-test-user', {
      body: { password: 'admin-password-two' },
      token: tokenFor('admin', admin._id),
    });
    assert.equal(second.response.status, 200);
    assert.equal(user.tokenVersion, 6);
  });

  it('rejects coordinator, mentor, and HOD accounts without valid assignments', async () => {
    const admin = createUser('admin');
    admin._id = 'assignment-admin';
    User.findById = (id) =>
      makeQuery(String(id) === admin._id ? admin : user);

    for (const [role, message] of [
      ['coordinator', /must be assigned to a class/i],
      ['mentor', /must be assigned to at least one class/i],
      ['hod', /must be assigned to at least one department/i],
    ]) {
      const { response, data } = await send('/admin/users', {
        method: 'POST',
        body: {
          name: 'New Staff',
          email: `${role}@example.invalid`,
          password: 'valid-password',
          role,
        },
        token: tokenFor('admin', admin._id),
      });

      assert.equal(response.status, 400);
      assert.match(data.message, message);
    }
  });

  it('rejects malformed or conflicting class assignments from the admin API', async () => {
    const admin = createUser('admin');
    admin._id = 'assignment-admin';
    User.findById = (id) =>
      makeQuery(String(id) === admin._id ? admin : user);

    const baseBody = {
      name: 'New Coordinator',
      email: 'coordinator@example.invalid',
      password: 'valid-password',
      role: 'coordinator',
    };
    const invalidAssignment = await send('/admin/users', {
      method: 'POST',
      body: { ...baseBody, assignedClass: { branch: 'CSE', year: 7, section: 'A' } },
      token: tokenFor('admin', admin._id),
    });
    assert.equal(invalidAssignment.response.status, 400);
    assert.match(invalidAssignment.data.message, /year \(1-4\)/i);

    User.findOne = async (filter) =>
      filter.assignedClass ? { _id: 'existing-coordinator' } : null;
    const conflictingAssignment = await send('/admin/users', {
      method: 'POST',
      body: {
        ...baseBody,
        email: 'conflicting-coordinator@example.invalid',
        assignedClass: { branch: 'CSE', year: 3, section: 'A' },
      },
      token: tokenFor('admin', admin._id),
    });
    assert.equal(conflictingAssignment.response.status, 400);
    assert.match(conflictingAssignment.data.message, /already has an active Class Coordinator/i);
  });

  it('validates assignment updates and prevents conflicting staff activation', async () => {
    const admin = createUser('admin');
    admin._id = 'assignment-admin';
    User.findById = (id) =>
      makeQuery(String(id) === admin._id ? admin : user);
    user.role = 'teacher';
    user.assignedClass = null;
    user.assignedSubjects = [];
    user.mentoringClasses = [];
    user.headOfDepartments = [];

    const invalidUpdate = await send('/admin/users/profile-test-user', {
      body: { assignedClass: { branch: 'CSE', year: 0, section: 'A' } },
      token: tokenFor('admin', admin._id),
    });
    assert.equal(invalidUpdate.response.status, 400);
    assert.match(invalidUpdate.data.message, /year \(1-4\)/i);
    assert.equal(user.saveCount, undefined);

    user.role = 'coordinator';
    user.assignedClass = { branch: 'CSE', year: 3, section: 'A' };
    user.isActive = false;
    User.findOne = async (filter) =>
      filter.assignedClass ? { _id: 'existing-coordinator' } : null;
    const activation = await send('/admin/users/profile-test-user/status', {
      method: 'PATCH',
      token: tokenFor('admin', admin._id),
    });
    assert.equal(activation.response.status, 400);
    assert.match(activation.data.message, /already has an active Class Coordinator/i);
    assert.equal(user.isActive, false);
  });
});
