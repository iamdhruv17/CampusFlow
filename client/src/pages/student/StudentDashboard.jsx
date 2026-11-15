import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle, XCircle, RotateCcw,
  PlusCircle, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { requestService } from '../../services/request.service';
import StatCard from '../../components/common/StatCard';
import RequestCard from '../../components/requests/RequestCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { getErrorMessage } from '../../utils/formatters';
import toast from 'react-hot-toast';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, requestsRes] = await Promise.all([
          requestService.getStats(),
          requestService.getAll({ page: 1, limit: 5 }),
        ]);
        setStats(statsRes.data.stats);
        setRecentRequests(requestsRes.data.requests);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">
            {user?.branch} · Year {user?.year} · Section {user?.section}
            {user?.rollNumber && ` · ${user.rollNumber}`}
          </p>
        </div>
        <Link to="/requests/new" className="btn-primary">
          <PlusCircle size={16} />
          New Request
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total" value={stats?.total ?? 0} icon={FileText} color="slate" />
        <StatCard label="Pending" value={stats?.pending ?? 0} icon={Clock} color="amber" />
        <StatCard label="Under Review" value={stats?.under_review ?? 0} icon={AlertCircle} color="blue" />
        <StatCard label="Approved" value={stats?.approved ?? 0} icon={CheckCircle} color="emerald" />
        <StatCard label="Rejected" value={stats?.rejected ?? 0} icon={XCircle} color="red" />
        <StatCard label="Returned" value={stats?.returned ?? 0} icon={RotateCcw} color="orange" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Requests */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Recent Requests</h2>
            <Link to="/requests" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {recentRequests.length === 0 ? (
              <div className="card p-8 text-center">
                <FileText size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No requests yet.</p>
                <Link to="/requests/new" className="btn-primary btn-sm mt-4 inline-flex">
                  Submit your first request
                </Link>
              </div>
            ) : (
              recentRequests.map(req => <RequestCard key={req._id} request={req} />)
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {[
              { to: '/requests/new?type=attendance_correction', label: 'Attendance Correction', desc: 'Report a marking error', color: 'bg-blue-50 border-blue-200 text-blue-700' },
              { to: '/requests/new?type=event_attendance', label: 'Event Attendance', desc: 'Claim participation credit', color: 'bg-purple-50 border-purple-200 text-purple-700' },
              { to: '/requests/new?type=medical_leave', label: 'Medical Leave', desc: 'Submit with medical docs', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { to: '/requests/new?type=other_grievance', label: 'Academic Grievance', desc: 'Raise any other issue', color: 'bg-amber-50 border-amber-200 text-amber-700' },
            ].map(({ to, label, desc, color }) => (
              <Link
                key={to}
                to={to}
                className={`block card p-4 border ${color.split(' ').slice(1).join(' ')} hover:shadow-md transition-shadow`}
              >
                <p className={`text-sm font-semibold ${color.split(' ')[2]}`}>{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </Link>
            ))}
          </div>

          {/* Returned requests reminder */}
          {stats?.returned > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-orange-50 border border-orange-200">
              <div className="flex items-center gap-2 mb-1">
                <RotateCcw size={14} className="text-orange-600" />
                <p className="text-sm font-semibold text-orange-700">Action Required</p>
              </div>
              <p className="text-xs text-orange-600">
                You have {stats.returned} request{stats.returned > 1 ? 's' : ''} returned for correction.
              </p>
              <Link to="/requests?status=returned" className="text-xs font-medium text-orange-700 hover:underline mt-1 inline-block">
                Review now →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
