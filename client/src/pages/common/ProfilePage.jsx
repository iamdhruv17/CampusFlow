import { useState } from 'react';
import { User, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/user.service';
import { ROLES } from '../../utils/constants';
import { getErrorMessage } from '../../utils/formatters';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const payload = { name };
      if (newPassword) {
        if (!currentPassword) {
          toast.error('Current password is required to set a new password.');
          setLoading(false);
          return;
        }
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await userService.updateProfile(payload);
      updateUser(res.data.user);
      toast.success('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Account Profile</h1>
        <p className="page-subtitle">View and update your personal credentials and college profile.</p>
      </div>

      {/* Profile Overview Card */}
      <div className="card p-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center flex-shrink-0 shadow-md">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{user?.name}</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{user?.email}</p>
            <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase font-semibold text-[10px] mt-2 inline-flex">
              {ROLES[user?.role] || user?.role}
            </span>
          </div>
        </div>

        {/* Read-Only Academic / Department Info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-6 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Role</span>
            <span className="font-semibold text-slate-800 capitalize">{ROLES[user?.role] || user?.role}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Branch</span>
            <span className="font-semibold text-slate-800">{user?.branch || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Year</span>
            <span className="font-semibold text-slate-800">{user?.year || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Section</span>
            <span className="font-semibold text-slate-800">{user?.section || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Roll Number</span>
            <span className="font-semibold text-slate-800">{user?.rollNumber || '—'}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Department</span>
            <span className="font-semibold text-slate-800">{user?.department || '—'}</span>
          </div>
        </div>
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Academic details and account settings can only be changed by an administrator.
        </p>

        {/* Edit Profile Form */}
        <form onSubmit={handleUpdateProfile} className="pt-6 space-y-5">
          <h3 className="section-title text-base flex items-center gap-2">
            <User size={18} className="text-indigo-600" /> Personal Details
          </h3>

          <div className="form-group">
            <label className="label">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input text-sm"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h3 className="section-title text-base flex items-center gap-2">
              <KeyRound size={18} className="text-indigo-600" /> Change Password
            </h3>

            <div className="form-group">
              <label className="label">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required only to change password"
                className="input text-sm"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="input text-sm"
                />
              </div>

              <div className="form-group">
                <label className="label">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="input text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
