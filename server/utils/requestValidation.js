const { REQUEST_CATEGORIES } = require('./requestConstants');

function validateRequestInput(input = {}) {
  const errors = [];
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';

  if (!REQUEST_CATEGORIES.includes(category)) errors.push('Choose a valid academic request category.');
  if (title.length < 5 || title.length > 120) errors.push('Title must be between 5 and 120 characters.');
  if (description.length < 20 || description.length > 5000) errors.push('Description must be between 20 and 5000 characters.');

  return { valid: errors.length === 0, errors, value: { category, title, description } };
}

module.exports = { validateRequestInput };
