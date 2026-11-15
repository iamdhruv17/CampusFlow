import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Search, Edit, Power
} from 'lucide-react';
import { userService } from '../../services/user.service';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { ROLES, BRANCHES, YEARS, SECTIONS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/formatters';
import toast from 'react-hot-toast';

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'teacher',
    department: 'Computer Science',
    branch: 'CSE',
    year: '3',
    section: 'A',
    rollNumber: '',
    // Staff assignment helpers
    assignedSubjectName: '',
    assignedSubjectCode: '',
    assignedClassBranch: 'CSE',
    assignedClassYear: '3',
    assignedClassSection: 'A',
    mentorBranch: 'CSE',
    mentorYear: '3',
    mentorSection: 'A',
    isClassCoordinator: false,
    coordinatorBranch: 'CSE',
    coordinatorYear: '3',
    coordinatorSection: 'A',
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userService.getAll({
        role: roleFilter || undefined,
        search: search || undefined,
        page,
        limit: 10,
      });
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (user) => {
    try {
      const res = await userService.toggleStatus(user._id);
      toast.success(res.data.message);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'teacher',
      department: 'Computer Science',
      branch: 'CSE',
      year: '3',
      section: 'A',
      rollNumber: '',
      assignedSubjectName: '',
      assignedSubjectCode: '',
      assignedClassBranch: 'CSE',
      assignedClassYear: '3',
      assignedClassSection: 'A',
      mentorBranch: 'CSE',
      mentorYear: '3',
      mentorSection: 'A',
      isClassCoordinator: false,
      coordinatorBranch: 'CSE',
      coordinatorYear: '3',
      coordinatorSection: 'A',
    });
    setEditingUser(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      department: user.department || '',
      branch: user.branch || '',
      year: user.year?.toString() || '1',
      section: user.section || 'A',
      rollNumber: user.rollNumber || '',
      assignedSubjectName: user.assignedSubjects?.[0]?.subjectName || '',
      assignedSubjectCode: user.assignedSubjects?.[0]?.subjectCode || '',
      assignedClassBranch: user.assignedClass?.branch || 'CSE',
      assignedClassYear: user.assignedClass?.year?.toString() || '3',
      assignedClassSection: user.assignedClass?.section || 'A',
      mentorBranch: user.mentoringClasses?.[0]?.branch || 'CSE',
      mentorYear: user.mentoringClasses?.[0]?.year?.toString() || '3',
      mentorSection: user.mentoringClasses?.[0]?.section || 'A',
      isClassCoordinator: Boolean(user.assignedClass),
      coordinatorBranch: user.assignedClass?.branch || 'CSE',
      coordinatorYear: user.assignedClass?.year?.toString() || '3',
      coordinatorSection: user.assignedClass?.section || 'A',
    });
    setIsCreateModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      // Build assignment payloads
      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department: formData.department,
        branch: formData.branch,
        section: formData.section,
        rollNumber: formData.rollNumber,
      };

      if (formData.password) payload.password = formData.password;
      if (formData.year) payload.year = Number(formData.year);

      // Role-specific assignments
      if (formData.role === 'teacher') {
        payload.assignedSubjects = formData.assignedSubjectName
          ? [
            {
              subjectName: formData.assignedSubjectName,
              subjectCode: formData.assignedSubjectCode,
              branch: formData.assignedClassBranch,
              year: Number(formData.assignedClassYear),
              section: formData.assignedClassSection,
            },
          ]
          : [];
        if (formData.isClassCoordinator) {
          payload.assignedClass = {
            branch: formData.coordinatorBranch,
            year: Number(formData.coordinatorYear),
            section: formData.coordinatorSection,
          };
        } else if (editingUser?.role === 'teacher' && editingUser.assignedClass) {
          payload.assignedClass = null;
        }
      } else if (formData.role === 'coordinator') {
        payload.assignedClass = {
          branch: formData.assignedClassBranch,
          year: Number(formData.assignedClassYear),
          section: formData.assignedClassSection,
        };
      } else if (formData.role === 'mentor') {
        payload.mentoringClasses = [
          {
            branch: formData.mentorBranch,
            year: Number(formData.mentorYear),
            section: formData.mentorSection,
          },
        ];
      } else if (formData.role === 'hod') {
        payload.headOfDepartments = [formData.department];
      }

      if (editingUser && editingUser.role !== formData.role) {
        payload.assignedSubjects ??= [];
        payload.assignedClass ??= null;
        payload.mentoringClasses ??= [];
        payload.headOfDepartments ??= [];
      }

      if (editingUser) {
        await userService.update(editingUser._id, payload);
        toast.success('User updated successfully!');
      } else {
        await userService.create(payload);
        toast.success('Staff user created successfully!');
      }

      setIsCreateModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">User & Faculty Directory</h1>
          <p className="page-subtitle">Manage campus accounts, faculty responsibilities, and routing assignments.</p>
        </div>
        <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-1.5">
          <UserPlus size={16} /> Create Staff Account
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9 text-xs"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="input text-xs"
            >
              <option value="">All Roles</option>
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="text-right flex items-center justify-end text-xs text-slate-500">
            Total Users: <span className="font-bold ml-1 text-slate-800">{pagination?.total || 0}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner text="Loading users..." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Name & Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department / Class</th>
                  <th className="py-3 px-4">Assignments</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {users.map((u) => {
                  return (
                    <tr key={u._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-slate-400 text-[11px] font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase font-semibold text-[10px]">
                          {ROLES[u.role] || u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.role === 'student' ? (
                          <span>{u.branch} Y{u.year} ({u.section})</span>
                        ) : (
                          <span>{u.department || '—'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {u.role === 'teacher' && u.assignedSubjects?.length > 0 && (
                          <span>Sub: {u.assignedSubjects[0].subjectName} ({u.assignedSubjects[0].branch} Y{u.assignedSubjects[0].year} {u.assignedSubjects[0].section})</span>
                        )}
                        {u.role === 'teacher' && u.assignedClass && (
                          <span className="block">Coordinator: {u.assignedClass.branch} Y{u.assignedClass.year} ({u.assignedClass.section})</span>
                        )}
                        {u.role === 'coordinator' && u.assignedClass && (
                          <span>Coord: {u.assignedClass.branch} Y{u.assignedClass.year} ({u.assignedClass.section})</span>
                        )}
                        {u.role === 'mentor' && u.mentoringClasses?.length > 0 && (
                          <span>Mentor: {u.mentoringClasses[0].branch} Y{u.mentoringClasses[0].year} ({u.mentoringClasses[0].section})</span>
                        )}
                        {u.role === 'hod' && u.headOfDepartments?.length > 0 && (
                          <span>Head: {u.headOfDepartments.join(', ')}</span>
                        )}
                        {u.role === 'dean' && <span>College-Wide Academic Head</span>}
                        {u.role === 'admin' && <span>Administrator</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`badge ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100"
                            title="Edit User"
                          >
                            <Edit size={14} />
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1.5 rounded hover:bg-slate-100 ${
                                u.isActive
                                  ? 'text-slate-400 hover:text-red-600'
                                  : 'text-slate-400 hover:text-emerald-600'
                              }`}
                              title={u.isActive ? 'Deactivate Account' : 'Activate Account'}
                            >
                              <Power size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-slate-100">
            <Pagination pagination={pagination} onPageChange={(p) => setPage(p)} />
          </div>
        </div>
      )}

      {/* Create / Edit Staff Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingUser ? `Edit Account: ${editingUser.name}` : 'Create New Staff Account'}
        size="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Dr. Sunita Sharma"
              />
            </div>

            <div className="form-group">
              <label className="label">College Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
                placeholder="sunita.sharma@college.edu"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">
                Password {editingUser ? '(leave blank to keep unchanged)' : <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                required={!editingUser}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
                placeholder="••••••••"
              />
            </div>

            <div className="form-group">
              <label className="label">Role <span className="text-red-500">*</span></label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="input"
                disabled={editingUser?.role === 'admin'}
              >
                <option value="teacher">Teacher</option>
                <option value="coordinator">Class Coordinator</option>
                <option value="mentor">Mentor</option>
                <option value="hod">HOD</option>
                <option value="dean">Dean</option>
                <option value="student">Student</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Department</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="input"
              placeholder="e.g. Computer Science"
            />
          </div>

          {/* Conditional Routing Assignment Fields */}
          {formData.role === 'teacher' && (
            <>
              <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-3">
                <p className="text-xs font-bold text-indigo-900 uppercase">Subject Assignment (For routing attendance requests)</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="label text-xs">Subject Name</label>
                    <input
                      type="text"
                      value={formData.assignedSubjectName}
                      onChange={(e) => setFormData({ ...formData, assignedSubjectName: e.target.value })}
                      className="input text-xs"
                      placeholder="e.g. Data Structures"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label text-xs">Subject Code</label>
                    <input
                      type="text"
                      value={formData.assignedSubjectCode}
                      onChange={(e) => setFormData({ ...formData, assignedSubjectCode: e.target.value })}
                      className="input text-xs"
                      placeholder="e.g. CS301"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label text-xs">Class Branch</label>
                    <select
                      value={formData.assignedClassBranch}
                      onChange={(e) => setFormData({ ...formData, assignedClassBranch: e.target.value })}
                      className="input text-xs"
                    >
                      {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Year</label>
                    <select
                      value={formData.assignedClassYear}
                      onChange={(e) => setFormData({ ...formData, assignedClassYear: e.target.value })}
                      className="input text-xs"
                    >
                      {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Section</label>
                    <select
                      value={formData.assignedClassSection}
                      onChange={(e) => setFormData({ ...formData, assignedClassSection: e.target.value })}
                      className="input text-xs"
                    >
                      {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                  <input
                    type="checkbox"
                    checked={formData.isClassCoordinator}
                    onChange={(e) => setFormData({ ...formData, isClassCoordinator: e.target.checked })}
                  />
                  This teacher is also a Class Coordinator
                </label>
                {formData.isClassCoordinator && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label text-xs">Coordinator Branch</label>
                      <select
                        value={formData.coordinatorBranch}
                        onChange={(e) => setFormData({ ...formData, coordinatorBranch: e.target.value })}
                        className="input text-xs"
                      >
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Coordinator Year</label>
                      <select
                        value={formData.coordinatorYear}
                        onChange={(e) => setFormData({ ...formData, coordinatorYear: e.target.value })}
                        className="input text-xs"
                      >
                        {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Coordinator Section</label>
                      <select
                        value={formData.coordinatorSection}
                        onChange={(e) => setFormData({ ...formData, coordinatorSection: e.target.value })}
                        className="input text-xs"
                      >
                        {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {formData.role === 'coordinator' && (
            <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-3">
              <p className="text-xs font-bold text-indigo-900 uppercase">Coordinating Class (Stage 1 Medical Leave)</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs">Branch</label>
                  <select
                    value={formData.assignedClassBranch}
                    onChange={(e) => setFormData({ ...formData, assignedClassBranch: e.target.value })}
                    className="input text-xs"
                  >
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Year</label>
                  <select
                    value={formData.assignedClassYear}
                    onChange={(e) => setFormData({ ...formData, assignedClassYear: e.target.value })}
                    className="input text-xs"
                  >
                    {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Section</label>
                  <select
                    value={formData.assignedClassSection}
                    onChange={(e) => setFormData({ ...formData, assignedClassSection: e.target.value })}
                    className="input text-xs"
                  >
                    {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {formData.role === 'mentor' && (
            <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-3">
              <p className="text-xs font-bold text-indigo-900 uppercase">Mentoring Class (Stage 2 Medical Leave)</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs">Branch</label>
                  <select
                    value={formData.mentorBranch}
                    onChange={(e) => setFormData({ ...formData, mentorBranch: e.target.value })}
                    className="input text-xs"
                  >
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Year</label>
                  <select
                    value={formData.mentorYear}
                    onChange={(e) => setFormData({ ...formData, mentorYear: e.target.value })}
                    className="input text-xs"
                  >
                    {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Section</label>
                  <select
                    value={formData.mentorSection}
                    onChange={(e) => setFormData({ ...formData, mentorSection: e.target.value })}
                    className="input text-xs"
                  >
                    {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="btn-secondary"
              disabled={formLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={formLoading}>
              {formLoading ? 'Saving...' : editingUser ? 'Update Account' : 'Create Staff'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
