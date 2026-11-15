const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Request = require('../models/Request');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { sendSuccess, sendError } = require('../utils/apiResponse');

router.use(protect, authorize('admin'));

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isValidClassAssignment = (assignment) =>
  Boolean(
    assignment &&
      typeof assignment === 'object' &&
      typeof assignment.branch === 'string' &&
      assignment.branch.trim() &&
      Number.isInteger(Number(assignment.year)) &&
      Number(assignment.year) >= 1 &&
      Number(assignment.year) <= 4 &&
      typeof assignment.section === 'string' &&
      assignment.section.trim()
  );

const assignmentKey = (assignment) =>
  `${assignment.branch.trim()}|${Number(assignment.year)}|${assignment.section.trim()}`;

const validateAssignments = async (candidate, existingUserId) => {
  const {
    role,
    assignedSubjects = [],
    assignedClass = null,
    mentoringClasses = [],
    headOfDepartments = [],
    isActive = true,
  } = candidate;

  if (!Array.isArray(assignedSubjects)) return 'Subject assignments must be a list.';
  if (!Array.isArray(mentoringClasses)) return 'Mentor assignments must be a list.';
  if (!Array.isArray(headOfDepartments)) return 'HOD departments must be a list.';

  if (assignedClass !== null && !isValidClassAssignment(assignedClass)) {
    return 'Coordinator assignment requires a branch, year (1-4), and section.';
  }
  if (role === 'coordinator' && !assignedClass) {
    return 'A Class Coordinator must be assigned to a class.';
  }
  if (assignedClass && !['teacher', 'coordinator'].includes(role)) {
    return 'Only teachers and coordinators can have a coordinator class assignment.';
  }

  for (const assignment of mentoringClasses) {
    if (!isValidClassAssignment(assignment)) {
      return 'Each mentor assignment requires a branch, year (1-4), and section.';
    }
  }
  if (role === 'mentor' && mentoringClasses.length === 0) {
    return 'A Mentor must be assigned to at least one class.';
  }
  if (mentoringClasses.length > 0 && !['teacher', 'mentor'].includes(role)) {
    return 'Only teachers and mentors can have mentor class assignments.';
  }

  for (const assignment of assignedSubjects) {
    if (
      !assignment ||
      typeof assignment.subjectName !== 'string' ||
      !assignment.subjectName.trim() ||
      !isValidClassAssignment(assignment)
    ) {
      return 'Each subject assignment requires a subject, branch, year (1-4), and section.';
    }
  }
  if (assignedSubjects.length > 0 && ['student', 'admin'].includes(role)) {
    return 'Only academic staff can have subject assignments.';
  }

  if (
    headOfDepartments.some(
      (department) => typeof department !== 'string' || !department.trim()
    )
  ) {
    return 'HOD departments must contain non-empty department names.';
  }
  if (role === 'hod' && headOfDepartments.length === 0) {
    return 'An HOD must be assigned to at least one department.';
  }
  if (headOfDepartments.length > 0 && role !== 'hod') {
    return 'Only HOD accounts can have department assignments.';
  }

  const subjectKeys = assignedSubjects.map(
    (assignment) =>
      `${assignment.subjectName.trim().toLowerCase()}|${assignmentKey(assignment)}`
  );
  const classKeys = mentoringClasses.map(assignmentKey);
  if (new Set(subjectKeys).size !== subjectKeys.length) {
    return 'Duplicate subject assignments are not allowed.';
  }
  if (new Set(classKeys).size !== classKeys.length) {
    return 'Duplicate mentor class assignments are not allowed.';
  }

  if (isActive === false) return null;

  const existingFilter = existingUserId ? { _id: { $ne: existingUserId } } : {};
  const conflicts = [];
  if (assignedClass) {
    conflicts.push([
      {
        role: { $in: ['teacher', 'coordinator'] },
        isActive: true,
        assignedClass: {
          branch: assignedClass.branch.trim(),
          year: Number(assignedClass.year),
          section: assignedClass.section.trim(),
        },
        ...existingFilter,
      },
      'This class already has an active Class Coordinator.',
    ]);
  }
  if (mentoringClasses.length > 0) {
    conflicts.push([
      {
        role: { $in: ['teacher', 'mentor'] },
        isActive: true,
        $or: mentoringClasses.map(({ branch, year, section }) => ({
          mentoringClasses: {
            $elemMatch: {
              branch: branch.trim(),
              year: Number(year),
              section: section.trim(),
            },
          },
        })),
        ...existingFilter,
      },
      'One or more classes already have an active Mentor.',
    ]);
  }
  if (headOfDepartments.length > 0) {
    conflicts.push([
      {
        role: 'hod',
        isActive: true,
        headOfDepartments: { $in: headOfDepartments.map((department) => department.trim()) },
        ...existingFilter,
      },
      'One or more departments already have an active HOD.',
    ]);
  }
  for (const assignment of assignedSubjects) {
    conflicts.push([
      {
        role: { $in: ['teacher', 'coordinator', 'mentor', 'hod', 'dean'] },
        isActive: true,
        assignedSubjects: {
          $elemMatch: {
            subjectName: {
              $regex: `^${escapeRegex(assignment.subjectName.trim())}$`,
              $options: 'i',
            },
            branch: assignment.branch.trim(),
            year: Number(assignment.year),
            section: assignment.section.trim(),
          },
        },
        ...existingFilter,
      },
      `The subject ${assignment.subjectName.trim()} already has an active teacher for this class.`,
    ]);
  }

  for (const [filter, message] of conflicts) {
    if (await User.findOne(filter)) return message;
  }
  return null;
};

router.get('/stats', async (req, res, next) => {
  try {
    const [totalUsers, students, totalRequests, pendingRequests] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      Request.countDocuments(),
      Request.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
    ]);

    sendSuccess(res, 200, 'Admin statistics retrieved.', {
      stats: {
        totalUsers,
        students,
        staff: totalUsers - students,
        totalRequests,
        pendingRequests,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
    const filter = {};

    if (role) filter.role = role;
    if (search) {
      const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
    ]);
    sendSuccess(res, 200, 'Users retrieved.', {
      users,
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

router.post('/users', async (req, res, next) => {
  try {
    const {
      name, email, password, role, department, branch, year, section, rollNumber,
      assignedSubjects, assignedClass, mentoringClasses, headOfDepartments,
    } = req.body;
    const allowedRoles = ['teacher', 'coordinator', 'mentor', 'hod', 'dean', 'student'];
    if (!allowedRoles.includes(role)) {
      return sendError(res, 400, `Invalid role. Allowed: ${allowedRoles.join(', ')}.`);
    }

    const assignmentError = await validateAssignments({
      role,
      assignedSubjects,
      assignedClass,
      mentoringClasses,
      headOfDepartments,
    });
    if (assignmentError) return sendError(res, 400, assignmentError);

    const existing = await User.findOne({ email: String(email || '').toLowerCase() });
    if (existing) return sendError(res, 409, 'An account with this email already exists.');

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role,
      department: department || '',
      branch: branch || '',
      year: year ? Number(year) : undefined,
      section: section || '',
      rollNumber: rollNumber || '',
      assignedSubjects,
      assignedClass,
      mentoringClasses,
      headOfDepartments,
    });
    sendSuccess(res, 201, 'User account created.', { user: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return sendError(res, 404, 'User not found.');
    sendSuccess(res, 200, 'User retrieved.', { user });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const {
      name, email, role, department, branch, year, section, rollNumber,
      assignedSubjects, assignedClass, mentoringClasses, headOfDepartments, password,
    } = req.body;
    const user = await User.findById(req.params.id).select('+tokenVersion');
    if (!user) return sendError(res, 404, 'User not found.');
    const allowedRoles = ['teacher', 'coordinator', 'mentor', 'hod', 'dean', 'student'];
    if (
      role !== undefined &&
      !allowedRoles.includes(role) &&
      !(role === 'admin' && user.role === 'admin')
    ) {
      return sendError(res, 400, `Invalid role. Allowed: ${allowedRoles.join(', ')}.`);
    }

    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return sendError(res, 409, 'An account with this email already exists.');
    }

    const assignmentFields = [
      'role',
      'assignedSubjects',
      'assignedClass',
      'mentoringClasses',
      'headOfDepartments',
    ];
    if (assignmentFields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
      const assignmentError = await validateAssignments(
        {
          role: role === undefined ? user.role : role,
          assignedSubjects:
            assignedSubjects === undefined ? user.assignedSubjects : assignedSubjects,
          assignedClass: assignedClass === undefined ? user.assignedClass : assignedClass,
          mentoringClasses:
            mentoringClasses === undefined ? user.mentoringClasses : mentoringClasses,
          headOfDepartments:
            headOfDepartments === undefined ? user.headOfDepartments : headOfDepartments,
          isActive: user.isActive,
        },
        user._id
      );
      if (assignmentError) return sendError(res, 400, assignmentError);
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (department !== undefined) user.department = department;
    if (branch !== undefined) user.branch = branch;
    if (year !== undefined) user.year = Number(year);
    if (section !== undefined) user.section = section;
    if (rollNumber !== undefined) user.rollNumber = rollNumber;
    if (assignedSubjects !== undefined) user.assignedSubjects = assignedSubjects;
    if (assignedClass !== undefined) user.assignedClass = assignedClass;
    if (mentoringClasses !== undefined) user.mentoringClasses = mentoringClasses;
    if (headOfDepartments !== undefined) user.headOfDepartments = headOfDepartments;
    if (password) {
      user.passwordHash = password;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await user.save();
    const updatedUser = await User.findById(user._id).select('-passwordHash');
    sendSuccess(res, 200, 'User updated.', { user: updatedUser });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found.');
    if (user.role === 'admin') {
      return sendError(res, 403, 'Cannot deactivate admin accounts through this endpoint.');
    }

    if (!user.isActive) {
      const assignmentError = await validateAssignments(
        {
          role: user.role,
          assignedSubjects: user.assignedSubjects,
          assignedClass: user.assignedClass,
          mentoringClasses: user.mentoringClasses,
          headOfDepartments: user.headOfDepartments,
          isActive: true,
        },
        user._id
      );
      if (assignmentError) return sendError(res, 400, assignmentError);
    }

    user.isActive = !user.isActive;
    await user.save();
    sendSuccess(res, 200, `User ${user.isActive ? 'activated' : 'deactivated'}.`, {
      user: user.toPublicProfile(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
