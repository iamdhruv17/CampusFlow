/**
 * CampusFlow Demo Data Seeder
 *
 * Run: npm run seed
 *
 * WARNING: This script is for local development and demonstration ONLY.
 * Do NOT run in production. It will clear and recreate demo data.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Request = require('../models/Request');
const ApprovalHistory = require('../models/ApprovalHistory');
const Notification = require('../models/Notification');
const FileRecord = require('../models/FileRecord');
const { uploadFile } = require('../services/storage.service');
const { isCloudinaryConfigured } = require('../config/cloudinary');

const DEMO_PASSWORD = 'Demo@1234';

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
}

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  // Clear all collections
  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Request.deleteMany({}),
    ApprovalHistory.deleteMany({}),
    Notification.deleteMany({}),
    FileRecord.deleteMany({}),
  ]);
  console.log('Data cleared.');

  const hash = await hashPassword(DEMO_PASSWORD);

  // ── Create users ──────────────────────────────────────────────────────────

  console.log('Creating users...');

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@campusflow.edu',
    passwordHash: hash,
    role: 'admin',
    department: 'Administration',
    isActive: true,
  });

  const teacher = await User.create({
    name: 'Prof. Ramesh Kumar',
    email: 'ramesh.kumar@campusflow.edu',
    passwordHash: hash,
    role: 'teacher',
    department: 'Computer Science',
    branch: 'CSE',
    isActive: true,
    assignedSubjects: [
      { subjectName: 'Data Structures', subjectCode: 'CS301', branch: 'CSE', year: 3, section: 'A' },
      { subjectName: 'Algorithms', subjectCode: 'CS302', branch: 'CSE', year: 3, section: 'A' },
      { subjectName: 'Data Structures', subjectCode: 'CS301', branch: 'CSE', year: 3, section: 'B' },
    ],
  });

  const coordinator = await User.create({
    name: 'Dr. Sunita Sharma',
    email: 'sunita.sharma@campusflow.edu',
    passwordHash: hash,
    role: 'coordinator',
    department: 'Computer Science',
    branch: 'CSE',
    isActive: true,
    assignedClass: { branch: 'CSE', year: 3, section: 'A' },
  });

  const mentor = await User.create({
    name: 'Prof. Vijay Mehta',
    email: 'vijay.mehta@campusflow.edu',
    passwordHash: hash,
    role: 'mentor',
    department: 'Computer Science',
    branch: 'CSE',
    isActive: true,
    mentoringClasses: [
      { branch: 'CSE', year: 3, section: 'A' },
      { branch: 'CSE', year: 3, section: 'B' },
    ],
  });

  const hod = await User.create({
    name: 'Dr. Priya Verma',
    email: 'priya.verma@campusflow.edu',
    passwordHash: hash,
    role: 'hod',
    department: 'Computer Science',
    branch: 'CSE',
    isActive: true,
    headOfDepartments: ['Computer Science', 'CSE'],
  });

  const dean = await User.create({
    name: 'Dr. Anil Gupta',
    email: 'anil.gupta@campusflow.edu',
    passwordHash: hash,
    role: 'dean',
    department: 'Administration',
    isActive: true,
  });

  const student = await User.create({
    name: 'Arjun Singh',
    email: 'arjun.singh@campusflow.edu',
    passwordHash: hash,
    role: 'student',
    department: 'Computer Science',
    branch: 'CSE',
    year: 3,
    section: 'A',
    rollNumber: 'CSE21001',
    isActive: true,
  });

  const student2 = await User.create({
    name: 'Priya Patel',
    email: 'priya.patel@campusflow.edu',
    passwordHash: hash,
    role: 'student',
    department: 'Computer Science',
    branch: 'CSE',
    year: 3,
    section: 'A',
    rollNumber: 'CSE21002',
    isActive: true,
  });

  console.log('Users created.');

  // ── Create sample requests ─────────────────────────────────────────────────

  console.log('Creating sample requests...');

  const studentInfo = {
    name: student.name,
    email: student.email,
    branch: student.branch,
    year: student.year,
    section: student.section,
    rollNumber: student.rollNumber,
    department: student.department,
  };

  // 1. Pending attendance correction
  const req1 = await Request.create({
    requesterId: student._id,
    requestType: 'attendance_correction',
    status: 'under_review',
    currentApproverId: teacher._id,
    currentApprovalStage: 'teacher',
    subject: 'Data Structures',
    subjectCode: 'CS301',
    attendanceDate: new Date('2026-10-15'),
    lectureNumber: '3',
    description: 'I was present in the Data Structures lecture on 15th October 2026 during 3rd period, but was marked absent. I have supporting evidence available.',
    requesterInfo: studentInfo,
    submittedAt: new Date('2026-10-16'),
  });

  await ApprovalHistory.create({
    requestId: req1._id,
    actorId: student._id,
    actorRole: 'student',
    actorName: student.name,
    action: 'submitted',
    remarks: '',
    previousStage: null,
    nextStage: 'teacher',
    timestamp: new Date('2026-10-16T09:00:00'),
  });

  await Notification.create({
    userId: teacher._id,
    requestId: req1._id,
    message: `A new attendance correction request has been assigned to you from ${student.name}.`,
    type: 'request_assigned',
  });

  // 2. Approved event attendance
  const req2 = await Request.create({
    requesterId: student._id,
    requestType: 'event_attendance',
    status: 'approved',
    currentApproverId: null,
    currentApprovalStage: 'completed',
    eventName: 'Inter-College Coding Competition',
    eventDate: new Date('2026-10-10'),
    eventOrganizer: 'Tech Club',
    participationDetails: 'Participated as team lead, won 2nd prize.',
    subject: 'Data Structures',
    description: 'I participated in the Inter-College Coding Competition on 10th October. I request attendance credit for the missed classes on that day.',
    requesterInfo: studentInfo,
    submittedAt: new Date('2026-10-11'),
    resolvedAt: new Date('2026-10-12'),
  });

  if (isCloudinaryConfigured()) {
    try {
      const req2Cert = await uploadFile({
        buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9]),
        mimetype: 'image/jpeg',
        originalname: 'coding_certificate.jpg',
        uploaderId: student._id,
        requestId: req2._id,
      });
      req2.attachments = [req2Cert._id];
      await req2.save();
    } catch (err) {
      console.warn('Cloudinary upload skipped during seed:', err.message);
    }
  }

  await ApprovalHistory.create([
    {
      requestId: req2._id,
      actorId: student._id,
      actorRole: 'student',
      actorName: student.name,
      action: 'submitted',
      remarks: '',
      previousStage: null,
      nextStage: 'teacher',
      timestamp: new Date('2026-10-11T09:00:00'),
    },
    {
      requestId: req2._id,
      actorId: teacher._id,
      actorRole: 'teacher',
      actorName: teacher.name,
      action: 'approved',
      remarks: 'Verified with Tech Club records. Attendance credit granted.',
      previousStage: 'teacher',
      nextStage: 'completed',
      timestamp: new Date('2026-10-12T11:00:00'),
    },
  ]);

  // 3. Medical leave waiting for Coordinator
  const req3 = await Request.create({
    requesterId: student._id,
    requestType: 'medical_leave',
    status: 'under_review',
    currentApproverId: coordinator._id,
    currentApprovalStage: 'coordinator',
    leaveStartDate: new Date('2026-10-20'),
    leaveEndDate: new Date('2026-10-23'),
    medicalDescription: 'High fever and throat infection.',
    description: 'I was unwell from 20th to 23rd October with high fever and throat infection. I am submitting my medical certificate for review.',
    requesterInfo: studentInfo,
    submittedAt: new Date('2026-10-24'),
  });

  if (isCloudinaryConfigured()) {
    try {
      const req3MedDoc = await uploadFile({
        buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf-8'),
        mimetype: 'application/pdf',
        originalname: 'medical_certificate.pdf',
        uploaderId: student._id,
        requestId: req3._id,
      });
      req3.attachments = [req3MedDoc._id];
      await req3.save();
    } catch (err) {
      console.warn('Cloudinary upload skipped during seed:', err.message);
    }
  }

  await ApprovalHistory.create({
    requestId: req3._id,
    actorId: student._id,
    actorRole: 'student',
    actorName: student.name,
    action: 'submitted',
    remarks: '',
    previousStage: null,
    nextStage: 'coordinator',
    timestamp: new Date('2026-10-24T08:00:00'),
  });

  // 4. Medical leave waiting for Mentor (coordinator approved)
  const req4 = await Request.create({
    requesterId: student2._id,
    requestType: 'medical_leave',
    status: 'under_review',
    currentApproverId: mentor._id,
    currentApprovalStage: 'mentor',
    leaveStartDate: new Date('2026-10-05'),
    leaveEndDate: new Date('2026-10-08'),
    medicalDescription: 'Viral fever and body pain.',
    description: 'I was down with viral fever from 5th to 8th October. Medical certificate attached.',
    requesterInfo: {
      name: student2.name,
      email: student2.email,
      branch: student2.branch,
      year: student2.year,
      section: student2.section,
      rollNumber: student2.rollNumber,
      department: student2.department,
    },
    submittedAt: new Date('2026-10-09'),
  });

  await ApprovalHistory.create([
    {
      requestId: req4._id,
      actorId: student2._id,
      actorRole: 'student',
      actorName: student2.name,
      action: 'submitted',
      remarks: '',
      previousStage: null,
      nextStage: 'coordinator',
      timestamp: new Date('2026-10-09T09:00:00'),
    },
    {
      requestId: req4._id,
      actorId: coordinator._id,
      actorRole: 'coordinator',
      actorName: coordinator.name,
      action: 'forwarded',
      remarks: 'Documents verified. Forwarding to Mentor.',
      previousStage: 'coordinator',
      nextStage: 'mentor',
      timestamp: new Date('2026-10-10T10:00:00'),
    },
  ]);

  // 5. Medical leave waiting for HOD
  const req5 = await Request.create({
    requesterId: student._id,
    requestType: 'medical_leave',
    status: 'under_review',
    currentApproverId: hod._id,
    currentApprovalStage: 'hod',
    leaveStartDate: new Date('2026-09-15'),
    leaveEndDate: new Date('2026-09-18'),
    medicalDescription: 'Severe migraine requiring hospitalization.',
    description: 'I was hospitalized from 15th to 18th September due to severe migraine. Discharge summary and prescription attached.',
    requesterInfo: studentInfo,
    submittedAt: new Date('2026-09-20'),
  });

  await ApprovalHistory.create([
    { requestId: req5._id, actorId: student._id, actorRole: 'student', actorName: student.name, action: 'submitted', remarks: '', previousStage: null, nextStage: 'coordinator', timestamp: new Date('2026-09-20T09:00:00') },
    { requestId: req5._id, actorId: coordinator._id, actorRole: 'coordinator', actorName: coordinator.name, action: 'forwarded', remarks: 'Hospitalization verified.', previousStage: 'coordinator', nextStage: 'mentor', timestamp: new Date('2026-09-21T10:00:00') },
    { requestId: req5._id, actorId: mentor._id, actorRole: 'mentor', actorName: mentor.name, action: 'forwarded', remarks: 'Records checked. Forwarding to HOD.', previousStage: 'mentor', nextStage: 'hod', timestamp: new Date('2026-09-22T11:00:00') },
  ]);

  // 6. Medical leave waiting for Dean
  const req6 = await Request.create({
    requesterId: student._id,
    requestType: 'medical_leave',
    status: 'under_review',
    currentApproverId: dean._id,
    currentApprovalStage: 'dean',
    leaveStartDate: new Date('2026-08-01'),
    leaveEndDate: new Date('2026-08-07'),
    medicalDescription: 'Surgery and post-operative recovery.',
    description: 'I underwent a planned surgery from 1st to 7th August and required complete rest for recovery. All medical documents attached.',
    requesterInfo: studentInfo,
    submittedAt: new Date('2026-08-10'),
  });

  await ApprovalHistory.create([
    { requestId: req6._id, actorId: student._id, actorRole: 'student', actorName: student.name, action: 'submitted', remarks: '', previousStage: null, nextStage: 'coordinator', timestamp: new Date('2026-08-10T09:00:00') },
    { requestId: req6._id, actorId: coordinator._id, actorRole: 'coordinator', actorName: coordinator.name, action: 'forwarded', remarks: 'Surgery documents verified.', previousStage: 'coordinator', nextStage: 'mentor', timestamp: new Date('2026-08-11T10:00:00') },
    { requestId: req6._id, actorId: mentor._id, actorRole: 'mentor', actorName: mentor.name, action: 'forwarded', remarks: 'Approved and forwarded.', previousStage: 'mentor', nextStage: 'hod', timestamp: new Date('2026-08-12T11:00:00') },
    { requestId: req6._id, actorId: hod._id, actorRole: 'hod', actorName: hod.name, action: 'forwarded', remarks: 'Approved. Forwarding to Dean.', previousStage: 'hod', nextStage: 'dean', timestamp: new Date('2026-08-13T14:00:00') },
  ]);

  // 7. Rejected request
  const req7 = await Request.create({
    requesterId: student._id,
    requestType: 'attendance_correction',
    status: 'rejected',
    currentApproverId: null,
    currentApprovalStage: 'rejected',
    subject: 'Algorithms',
    subjectCode: 'CS302',
    attendanceDate: new Date('2026-10-01'),
    lectureNumber: '2',
    description: 'I was present in the Algorithms lecture on 1st October but was marked absent.',
    requesterInfo: studentInfo,
    submittedAt: new Date('2026-10-02'),
    resolvedAt: new Date('2026-10-03'),
  });

  await ApprovalHistory.create([
    { requestId: req7._id, actorId: student._id, actorRole: 'student', actorName: student.name, action: 'submitted', remarks: '', previousStage: null, nextStage: 'teacher', timestamp: new Date('2026-10-02T09:00:00') },
    { requestId: req7._id, actorId: teacher._id, actorRole: 'teacher', actorName: teacher.name, action: 'rejected', remarks: 'Attendance record has been verified. The student was indeed absent on this date.', previousStage: 'teacher', nextStage: 'rejected', timestamp: new Date('2026-10-03T11:00:00') },
  ]);

  // 8. Returned request
  const req8 = await Request.create({
    requesterId: student._id,
    requestType: 'other_grievance',
    status: 'returned',
    currentApproverId: null,
    currentApprovalStage: 'hod',
    grievanceCategory: 'Exam Paper Re-evaluation',
    targetDepartment: 'Computer Science',
    description: 'I believe my exam paper was not evaluated correctly and I request a re-evaluation.',
    requesterInfo: studentInfo,
    submittedAt: new Date('2026-10-05'),
  });

  await ApprovalHistory.create([
    { requestId: req8._id, actorId: student._id, actorRole: 'student', actorName: student.name, action: 'submitted', remarks: '', previousStage: null, nextStage: 'hod', timestamp: new Date('2026-10-05T09:00:00') },
    { requestId: req8._id, actorId: hod._id, actorRole: 'hod', actorName: hod.name, action: 'returned', remarks: 'Please attach the answer booklet and specify which questions you are disputing.', previousStage: 'hod', nextStage: 'student', timestamp: new Date('2026-10-06T14:00:00') },
  ]);

  await Notification.create({
    userId: student._id,
    requestId: req8._id,
    message: `Your request has been returned for correction. Please review and resubmit.`,
    type: 'request_returned',
  });

  console.log('Sample requests created.');

  console.log('\n========================================');
  console.log('  DEMO SEED COMPLETE');
  console.log('========================================');
  console.log('\nDemo accounts (password for all: Demo@1234)');
  console.log('  Admin:       admin@campusflow.edu');
  console.log('  Teacher:     ramesh.kumar@campusflow.edu');
  console.log('  Coordinator: sunita.sharma@campusflow.edu');
  console.log('  Mentor:      vijay.mehta@campusflow.edu');
  console.log('  HOD:         priya.verma@campusflow.edu');
  console.log('  Dean:        anil.gupta@campusflow.edu');
  console.log('  Student 1:   arjun.singh@campusflow.edu');
  console.log('  Student 2:   priya.patel@campusflow.edu');
  console.log('========================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
