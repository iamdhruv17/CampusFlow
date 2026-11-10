const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['student', 'teacher', 'coordinator', 'mentor', 'hod', 'dean', 'admin'];
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'student' },
  department: { type: String, trim: true, default: '' },
  branch: { type: String, trim: true, default: '' },
  year: { type: Number, min: 1, max: 4 },
  section: { type: String, trim: true, default: '' },
  rollNumber: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });

userSchema.index({ role: 1 });
userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};
userSchema.methods.toPublicProfile = function () {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.tokenVersion;
  return user;
};
module.exports = mongoose.model('User', userSchema);
