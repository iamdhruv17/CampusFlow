import { CheckCircle2, Clock, XCircle, RotateCcw, UserCheck } from 'lucide-react';
import { APPROVAL_STAGES } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatters';

const chains = {
  attendance_correction: ['teacher'],
  event_attendance: ['coordinator', 'hod'],
  medical_leave: ['mentor', 'dean'],
  other_grievance: ['coordinator'],
};

export default function ApprovalTimeline({ request, history = [] }) {
  const escalated = request.requestType === 'other_grievance' &&
    (request.currentApprovalStage === 'hod' || history.some((record) => record.action === 'escalated'));
  const stages = escalated ? ['coordinator', 'hod'] : (chains[request.requestType] || [request.currentApprovalStage]);
  const currentIndex = stages.indexOf(request.currentApprovalStage);

  const getStageStatus = (stage) => {
    const returned = history.find((record) => record.action === 'returned' && record.previousStage === stage);
    const rejected = history.find((record) => record.action === 'rejected' && record.previousStage === stage);
    if (rejected) return 'rejected';
    if (returned && request.status === 'returned' && request.currentApprovalStage === stage) return 'returned';
    if (request.status === 'approved' || request.currentApprovalStage === 'completed') return 'approved';
    const index = stages.indexOf(stage);
    if (index < currentIndex) return 'approved';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 bg-gradient-to-r from-slate-50 to-indigo-50/40">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Approval Progression Chain</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stages.map((stage, index) => {
            const status = getStageStatus(stage);
            return (
              <div key={stage} className={`p-3 rounded-lg border ${
                status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                status === 'current' ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-500/20' :
                status === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' :
                status === 'returned' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                'bg-white/80 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Stage {index + 1}</span>
                  {status === 'approved' && <CheckCircle2 size={15} />}
                  {status === 'current' && <Clock size={15} />}
                  {status === 'rejected' && <XCircle size={15} />}
                  {status === 'returned' && <RotateCcw size={15} />}
                </div>
                <p className="text-sm font-semibold">{APPROVAL_STAGES[stage] || stage}</p>
                <p className="text-[11px] mt-0.5 opacity-80 capitalize">{status === 'current' ? 'Under Review' : status}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="section-title text-base mb-4 flex items-center gap-2"><UserCheck size={18} className="text-indigo-600" />Approval & Action History</h3>
        {history.length === 0 ? <p className="text-sm text-slate-400 py-3">No activity recorded yet.</p> : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {history.map((record, index) => (
              <div key={record._id || index} className="relative">
                <span className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white ring-2 ${
                  record.action === 'approved' ? 'bg-emerald-500 ring-emerald-200' :
                  record.action === 'rejected' ? 'bg-red-500 ring-red-200' :
                  record.action === 'returned' ? 'bg-orange-500 ring-orange-200' :
                  record.action === 'escalated' || record.action === 'forwarded' ? 'bg-blue-500 ring-blue-200' :
                  'bg-slate-400 ring-slate-200'
                }`} />
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-800">{record.actorName || record.actorId?.name || 'User'}</span><span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5 uppercase">{record.actorRole}</span></div>
                    <span className="text-xs text-slate-400">{formatDateTime(record.timestamp)}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Action: <span className="font-bold text-slate-900">{record.action}</span>{record.nextStage && <span className="ml-1 text-slate-500 font-normal">(Target: {APPROVAL_STAGES[record.nextStage] || record.nextStage})</span>}</p>
                  {record.remarks && <div className="mt-2 text-xs bg-white p-2.5 rounded border border-slate-200 text-slate-700"><span className="font-semibold text-slate-900">Remarks: </span>{record.remarks}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
