import { Clock, CheckCircle, XCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { REQUEST_STATUSES } from '../../utils/constants';

const configs = {
  pending: {
    label: REQUEST_STATUSES.pending,
    className: 'badge-pending',
    Icon: Clock,
  },
  under_review: {
    label: REQUEST_STATUSES.under_review,
    className: 'badge-under-review',
    Icon: AlertCircle,
  },
  approved: {
    label: REQUEST_STATUSES.approved,
    className: 'badge-approved',
    Icon: CheckCircle,
  },
  rejected: {
    label: REQUEST_STATUSES.rejected,
    className: 'badge-rejected',
    Icon: XCircle,
  },
  returned: {
    label: REQUEST_STATUSES.returned,
    className: 'badge-returned',
    Icon: RotateCcw,
  },
};

export default function StatusBadge({ status }) {
  const config = configs[status] || { label: status, className: 'badge bg-slate-100 text-slate-600', Icon: Clock };
  const { label, className, Icon } = config;

  return (
    <span className={className}>
      <Icon size={11} />
      {label}
    </span>
  );
}
