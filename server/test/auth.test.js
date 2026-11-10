const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');

test('public profile never exposes password or token version', () => {
  const user = new User({ name: 'Test Student', email: 'test@example.com', passwordHash: 'secretpass', role: 'student' });
  user.tokenVersion = 3;
  const profile = user.toPublicProfile();
  assert.equal(profile.name, 'Test Student');
  assert.equal(profile.email, 'test@example.com');
  assert.equal('passwordHash' in profile, false);
  assert.equal('tokenVersion' in profile, false);
});

test('public profile contains role identity', () => {
  const user = new User({ name: 'Test Student', email: 'test@example.com', passwordHash: 'secretpass', role: 'student' });
  assert.equal(user.toPublicProfile().role, 'student');
});
