export const REQUEST_TYPES = {
  attendance_correction: 'Attendance Correction',
  event_attendance: 'Event Attendance',
  medical_leave: 'Medical Leave',
  other_grievance: 'Other Academic Grievance',
};

export const REQUEST_STATUSES = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned for Correction',
};

export const APPROVAL_STAGES = {
  teacher: 'Subject Teacher',
  coordinator: 'Class Coordinator',
  mentor: 'Mentor',
  hod: 'HOD',
  dean: 'Dean',
  completed: 'Completed',
  rejected: 'Rejected',
};

export const ROLES = {
  student: 'Student',
  teacher: 'Teacher',
  coordinator: 'Class Coordinator',
  mentor: 'Mentor',
  hod: 'HOD',
  dean: 'Dean',
  admin: 'Admin',
};

export const MEDICAL_LEAVE_STAGES = ['mentor', 'dean'];

export const BRANCHES = ['CSE', 'ECE', 'ME', 'CE', 'EE', 'IT', 'AIML', 'DS'];
export const YEARS = [1, 2, 3, 4];
export const SECTIONS = ['A', 'B', 'C', 'D'];
