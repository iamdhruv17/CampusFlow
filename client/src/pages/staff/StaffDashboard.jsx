import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle, XCircle, AlertCircle,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { requestService } from '../../services/request.service';
import StatCard from '../../components/common/StatCard';
import RequestCard from '../../components/requests/RequestCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { ROLES } from '../../utils/constants';
import { getErrorMessage } from '../../utils/formatters';
import toast from 'react-hot-toast';

export default function StaffDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [assignedRequests, setAssignedRequests] = useState([]);
  const [pendingActionRequests, setPendingActionRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, reqRes, actionableRes] = await Promise.all([
          requestService.getStats(),
          requestService.getAll({ limit: 6 }),
          requestService.getAll({ limit: 6, actionable: true }),
        ]);
        setStats(statsRes.data.stats);
        setAssignedRequests(reqRes.data.requests);
        setPendingActionRequests(actionableRes.data.requests);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner text="Loading staff dashboard..." />;
  const actionableCount = (stats?.pending ?? 0) + (stats?.under_review ?? 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full uppercase">
            {ROLES[user?.role] || user?.role} Dashboard
          </span>
          <h1 className="page-title mt-2">Welcome, {user?.name}</h1>
          <p className="page-subtitle">
            {user?.department || 'Academic Staff'}
            {user?.assignedClass && ` · Class: ${user.assignedClass.branch} Y${user.assignedClass.year} (${user.assignedClass.section})`}
          </p>
        </div>
        <Link to="/requests" className="btn-secondary">
          View All Authorized Requests
        </Link>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Handled / Assigned"
          value={stats?.total ?? 0}
          icon={FileText}
          color="slate"
        />
        <StatCard
          label="Awaiting Review"
          value={(stats?.pending ?? 0) + (stats?.under_review ?? 0)}
          icon={Clock}
          color="amber"
          description="Needs your attention"
        />
        <StatCard
          label="Approved Decisions"
          value={stats?.approved ?? 0}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          label="Rejected / Returned"
          value={(stats?.rejected ?? 0) + (stats?.returned ?? 0)}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Awaiting Action Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500" />
            <h2 className="section-title text-base">Requests Awaiting Your Action</h2>
          </div>
          <span className="badge-pending">{actionableCount} pending</span>
        </div>

        {actionableCount === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">All caught up!</p>
            <p className="text-xs text-slate-400 mt-0.5">No requests currently require your review.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingActionRequests.map((req) => (
              <RequestCard key={req._id} request={req} showRequester={true} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity / All Authorized Requests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title text-base">Recent Academic Requests Activity</h2>
          <Link to="/requests" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            View full list <ArrowRight size={13} />
          </Link>
        </div>

        {assignedRequests.length === 0 ? (
          <EmptyState title="No requests found" message="Requests routed to you will appear here." />
        ) : (
          <div className="space-y-3">
            {assignedRequests.map((req) => (
              <RequestCard key={req._id} request={req} showRequester={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
