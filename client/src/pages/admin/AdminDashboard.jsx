import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, UserPlus, FileText, CheckCircle2, AlertTriangle,
  ArrowRight, ShieldCheck
} from 'lucide-react';
import { userService } from '../../services/user.service';
import { requestService } from '../../services/request.service';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getErrorMessage } from '../../utils/formatters';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [userCounts, setUserCounts] = useState({ totalUsers: 0, students: 0, staff: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, adminStatsRes] = await Promise.all([
          requestService.getStats(),
          userService.getAdminStats(),
        ]);

        setStats(statsRes.data.stats);
        setUserCounts(adminStatsRes.data.stats);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner text="Loading system metrics..." />;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
            <ShieldCheck size={13} /> System Administration
          </span>
          <h1 className="page-title mt-2">CampusFlow System Overview</h1>
          <p className="page-subtitle">Configure faculty assignments, manage user accounts, and oversee system workflows.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin/users" className="btn-primary">
            <UserPlus size={16} /> Manage Users & Staff
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total System Users"
          value={userCounts.totalUsers}
          icon={Users}
          color="indigo"
          description={`${userCounts.students} Students · ${userCounts.staff} Staff`}
        />
        <StatCard
          label="Total Requests"
          value={stats?.total ?? 0}
          icon={FileText}
          color="slate"
        />
        <StatCard
          label="In Progress / Review"
          value={(stats?.pending ?? 0) + (stats?.under_review ?? 0)}
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          label="Resolved Approvals"
          value={stats?.approved ?? 0}
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <Users size={20} />
          </div>
          <h2 className="text-base font-bold text-slate-800">User & Faculty Directory</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Create new staff accounts (Teachers, Coordinators, Mentors, HODs, Dean), assign classes, and manage account statuses.
          </p>
          <Link to="/admin/users" className="btn-secondary btn-sm flex items-center gap-1.5 w-fit">
            Open User Management <ArrowRight size={13} />
          </Link>
        </div>

        <div className="card p-6 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <FileText size={20} />
          </div>
          <h2 className="text-base font-bold text-slate-800">System Requests Audit</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            View all academic requests system-wide across all departments, inspect audit logs, and monitor approval timelines.
          </p>
          <Link to="/requests" className="btn-secondary btn-sm flex items-center gap-1.5 w-fit">
            View All Requests <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Workflow Architecture Reminder */}
      <div className="card p-6 bg-slate-900 text-white">
        <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-2">
          Strict Workflow Routing Rules
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          Requests are routed dynamically using faculty assignments:
        </p>
        <ul className="text-xs text-slate-400 mt-3 space-y-1.5 list-disc list-inside">
          <li><strong>Attendance Correction:</strong> Routed to the assigned subject teacher, then the student's department HOD if needed.</li>
          <li><strong>Event Attendance:</strong> Routed to the matching Subject Teacher, Class Coordinator, then department HOD. No Dean fallback.</li>
          <li><strong>Medical Leave (4-Stage Chain):</strong> Class Coordinator → Mentor → HOD → Dean. No stage can be skipped.</li>
          <li><strong>Academic Grievance:</strong> Routed to the selected target department HOD, with the existing Dean fallback.</li>
        </ul>
      </div>
    </div>
  );
}
