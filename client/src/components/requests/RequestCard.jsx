import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import { REQUEST_TYPES } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/formatters';

export default function RequestCard({ request, showRequester = false }) {
  const typeLabel = REQUEST_TYPES[request.requestType] || request.requestType;

  return (
    <Link
      to={`/requests/${request._id}`}
      className="card p-4 flex items-start justify-between gap-4 hover:shadow-md hover:border-indigo-200 transition-all group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5">
            {typeLabel}
          </span>
          <StatusBadge status={request.status} />
        </div>
        <p className="text-sm font-medium text-slate-800 truncate mt-1.5">
          {request.description}
        </p>
        {showRequester && request.requesterId && (
          <p className="text-xs text-slate-500 mt-1">
            {request.requesterId.name} · {request.requesterInfo?.branch} Y{request.requesterInfo?.year} {request.requesterInfo?.section}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-1.5">{formatRelativeTime(request.submittedAt || request.createdAt)}</p>
      </div>
      <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 flex-shrink-0 mt-1 transition-colors" />
    </Link>
  );
}
