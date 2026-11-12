const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRequestInput } = require('../utils/requestValidation');

test('accepts a valid academic request payload', () => {
  const result = validateRequestInput({ category: 'attendance_correction', title: 'Correct my attendance', description: 'Please review my attendance for the database systems lecture on Monday.' });
  assert.equal(result.valid, true);
  assert.equal(result.value.category, 'attendance_correction');
});

test('rejects unsupported categories and short content', () => {
  const result = validateRequestInput({ category: 'admin_access', title: 'Help', description: 'Short' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
});

test('trims request text before validation and storage', () => {
  const result = validateRequestInput({ category: 'general_academic', title: '  Need academic help  ', description: '  Please help me with this academic request.  ' });
  assert.equal(result.valid, true);
  assert.equal(result.value.title, 'Need academic help');
});
