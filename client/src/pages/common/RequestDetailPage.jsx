import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, CheckCircle, XCircle, RotateCcw,
  AlertTriangle, Send
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { requestService } from '../../services/request.service';
import { fileService } from '../../services/user.service';
import StatusBadge from '../../components/common/StatusBadge';
import ApprovalTimeline from '../../components/requests/ApprovalTimeline';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorState from '../../components/common/ErrorState';
import { REQUEST_TYPES, APPROVAL_STAGES } from '../../utils/constants';
import { formatDate, formatDateTime, formatFileSize, getErrorMessage } from '../../utils/formatters';
import toast from 'react-hot-toast';

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_REQUEST_FILES = 5;

export default function RequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [request, setRequest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Approval Action Modals
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject' | 'return' | 'escalate' | 'resubmit'
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Resubmit fields
  const [resubmitDescription, setResubmitDescription] = useState('');
  const [resubmitFiles, setResubmitFiles] = useState([]);
  const [previewingFileId, setPreviewingFileId] = useState(null);

  const fetchRequestDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, histRes] = await Promise.all([
        requestService.getById(id),
        requestService.getHistory(id),
      ]);
      setRequest(reqRes.data.request);
      setHistory(histRes.data.history);
      setResubmitDescription(reqRes.data.request.description || '');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequestDetails();
  }, [fetchRequestDetails]);

  const handlePreviewFile = async (fileId) => {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      toast.error('Please allow pop-ups to preview this document.');
      return;
    }

    previewWindow.opener = null;
    setPreviewingFileId(fileId);
    let objectUrl;
    try {
      const response = await fileService.getPreview(fileId);
      if (previewWindow.closed) {
        throw new Error('The preview tab was closed before the document loaded.');
      }

      const contentType = response.headers['content-type'] || response.data.type;
      const blob = new Blob([response.data], { type: contentType });
      objectUrl = URL.createObjectURL(blob);
      previewWindow.location.replace(objectUrl);

      // Keep the URL alive while the browser viewer consumes it, then release it.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (err) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (!previewWindow.closed) previewWindow.close();
      const status = err.response?.status;
      const message =
        status === 401
          ? 'Your session has expired. Please sign in again.'
          : status === 403
            ? 'You are not authorized to view this document.'
            : getErrorMessage(err);
      toast.error(message);
    } finally {
      setPreviewingFileId(null);
    }
  };

  const handleWorkflowAction = async () => {
    if (['reject', 'return', 'escalate'].includes(actionType) && !remarks.trim()) {
      toast.error('Remarks are required for this action.');
      return;
    }

    setActionLoading(true);
    try {
      if (actionType === 'approve') {
        await requestService.approve(id, { remarks });
        toast.success('Request approved successfully!');
      } else if (actionType === 'reject') {
        await requestService.reject(id, { remarks });
        toast.success('Request rejected.');
      } else if (actionType === 'return') {
        await requestService.returnForCorrection(id, { remarks });
        toast.success('Request returned for correction.');
      } else if (actionType === 'escalate') {
        await requestService.escalate(id, { remarks });
        toast.success('Grievance escalated to the HOD.');
      }
      setActionType(null);
      setRemarks('');
      await fetchRequestDetails();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async (e) => {
    e.preventDefault();
    if (resubmitDescription.trim().length < 10) {
      toast.error('Description must be at least 10 characters long.');
      return;
    }
    if ((request.attachments?.length || 0) + resubmitFiles.length > MAX_REQUEST_FILES) {
      toast.error('A request may include no more than 5 supporting documents.');
      return;
    }
    const invalidFile = resubmitFiles.find((file) => {
      const extension = `.${file.name.split('.').pop()}`.toLowerCase();
      return (
        !ALLOWED_FILE_TYPES.includes(file.type) ||
        !ALLOWED_FILE_EXTENSIONS.includes(extension) ||
        file.size > MAX_FILE_SIZE
      );
    });
    if (invalidFile) {
      toast.error(`${invalidFile.name}: Use a PDF, JPG, or PNG file no larger than 5 MB.`);
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('description', resubmitDescription);
      resubmitFiles.forEach(file => formData.append('files', file));

      await requestService.resubmit(id, formData);
      toast.success('Request resubmitted successfully!');
      setActionType(null);
      setResubmitFiles([]);
      await fetchRequestDetails();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading request details..." />;
  if (error) return <ErrorState message={error} onRetry={fetchRequestDetails} />;
  if (!request) return null;

  const isOwner = user?.role === 'student' && (request.requesterId?._id === user._id || request.requesterId === user._id);
  const isCurrentApprover =
    request.currentApproverId &&
    (request.currentApproverId?._id === user._id || request.currentApproverId === user._id);
  const allowedRolesByStage = {
    teacher: ['teacher'],
    coordinator: ['teacher', 'coordinator'],
    mentor: ['teacher', 'mentor'],
    hod: ['hod'],
    dean: ['dean'],
  };
  const canAct =
    isCurrentApprover &&
    allowedRolesByStage[request.currentApprovalStage]?.includes(user.role) &&
    ['pending', 'under_review'].includes(request.status);
  const canEscalate =
    canAct &&
    request.requestType === 'other_grievance' &&
    request.currentApprovalStage === 'coordinator';
  const canResubmit = isOwner && request.status === 'returned';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top back button and status banner */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary btn-sm flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">REQ-{request._id.slice(-6).toUpperCase()}</span>
          <StatusBadge status={request.status} />
        </div>
      </div>

      {/* Main Request Overview Card */}
      <div className="card p-6">
        <div className="border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-0.5 rounded-full">
                {REQUEST_TYPES[request.requestType] || request.requestType}
              </span>
              <h1 className="text-xl font-bold text-slate-900 mt-2">
                {request.subject || request.eventName || request.medicalDescription || 'Academic Request'}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Submitted on {formatDateTime(request.submittedAt || request.createdAt)}
              </p>
            </div>

            {/* Current Stage Indicator */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-right">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Current Stage</p>
              <p className="text-sm font-bold text-slate-800">
                {APPROVAL_STAGES[request.currentApprovalStage] || request.currentApprovalStage || 'Finished'}
              </p>
              {request.currentApproverId && (
                <p className="text-xs text-indigo-600 font-medium mt-0.5">
                  Assigned to: {request.currentApproverId.name || 'Faculty'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Requester Profile Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 mb-6 text-xs">
          <div>
            <p className="text-slate-400 font-medium">Student</p>
            <p className="text-slate-800 font-semibold mt-0.5">{request.requesterInfo?.name || request.requesterId?.name}</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Roll Number</p>
            <p className="text-slate-800 font-semibold mt-0.5">{request.requesterInfo?.rollNumber || '—'}</p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Class / Section</p>
            <p className="text-slate-800 font-semibold mt-0.5">
              {request.requesterInfo?.branch} Y{request.requesterInfo?.year} ({request.requesterInfo?.section})
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-medium">Email</p>
            <p className="text-slate-800 font-semibold mt-0.5 truncate">{request.requesterInfo?.email || request.requesterId?.email}</p>
          </div>
        </div>

        {/* Request-specific Meta Information */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Request Details</h2>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {request.subject && (
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Subject</span>
                <span className="font-semibold text-slate-800">{request.subject} {request.subjectCode && `(${request.subjectCode})`}</span>
              </div>
            )}
            {request.attendanceDate && (
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Attendance Date</span>
                <span className="font-semibold text-slate-800">{formatDate(request.attendanceDate)}</span>
              </div>
            )}
            {request.lectureNumber && (
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Lecture / Period</span>
                <span className="font-semibold text-slate-800">{request.lectureNumber}</span>
              </div>
            )}
            {request.eventName && (
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Event Name</span>
                <span className="font-semibold text-slate-800">{request.eventName}</span>
              </div>
            )}
            {request.eventDate && (
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Event Date</span>
                <span className="font-semibold text-slate-800">{formatDate(request.eventDate)}</span>
              </div>
            )}
            {request.leaveStartDate && (
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Leave Period</span>
                <span className="font-semibold text-slate-800">{formatDate(request.leaveStartDate)} to {formatDate(request.leaveEndDate)}</span>
              </div>
            )}
            {request.grievanceCategory && (
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Grievance Category</span>
                <span className="font-semibold text-slate-800">{request.grievanceCategory}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Description / Justification
            </h3>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {request.description}
            </p>
          </div>

          {/* Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Attached Documents ({request.attachments.length})
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {request.attachments.map((att) => (
                  <div
                    key={att._id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={18} className="text-indigo-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{att.originalName}</p>
                        <p className="text-[11px] text-slate-400">{formatFileSize(att.fileSize || att.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePreviewFile(att._id)}
                      disabled={previewingFileId === att._id}
                      className="btn-secondary btn-sm px-2.5 py-1 text-xs ml-2 flex items-center gap-1"
                      title="Open Document"
                    >
                      <Download size={13} />
                      {previewingFileId === att._id ? 'Opening...' : 'View'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons for Approver / Student */}
        {canAct && (
          <div className="mt-8 pt-5 border-t border-slate-200 flex flex-wrap gap-3 justify-end bg-indigo-50/40 -mx-6 -mb-6 p-6 rounded-b-xl">
            {canEscalate && <button
              onClick={() => { setActionType('escalate'); setRemarks(''); }}
              className="btn-primary"
            >
              <Send size={15} />
              Escalate to HOD
            </button>}
            <button
              onClick={() => { setActionType('return'); setRemarks(''); }}
              className="btn-warning"
            >
              <RotateCcw size={15} />
              Return for Correction
            </button>
            <button
              onClick={() => { setActionType('reject'); setRemarks(''); }}
              className="btn-danger"
            >
              <XCircle size={15} />
              Reject Request
            </button>
            <button
              onClick={() => { setActionType('approve'); setRemarks(''); }}
              className="btn-success"
            >
              <CheckCircle size={15} />
              {request.requestType === 'other_grievance'
                ? (request.currentApprovalStage === 'coordinator' ? 'Resolve Grievance' : 'Resolve Grievance')
                : request.currentApprovalStage === 'hod' || request.currentApprovalStage === 'dean'
                  ? 'Final Approve'
                  : request.requestType === 'event_attendance' || request.requestType === 'medical_leave'
                    ? 'Approve & Forward'
                    : 'Approve Request'}
            </button>
          </div>
        )}

        {/* Resubmit button for Student when Returned */}
        {canResubmit && (
          <div className="mt-6 p-4 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-bold text-orange-800 flex items-center gap-1.5">
                <AlertTriangle size={16} /> Request Returned for Correction
              </p>
              <p className="text-xs text-orange-700 mt-0.5">
                Please update the description or provide supplementary files to resubmit for review.
              </p>
            </div>
            <button
              onClick={() => setActionType('resubmit')}
              className="btn-primary btn-sm flex items-center gap-1.5"
            >
              <Send size={14} /> Correct & Resubmit
            </button>
          </div>
        )}
      </div>

      {/* Visual Timeline and Audit Trail */}
      <ApprovalTimeline request={request} history={history} />

      {/* Approver Action Modal (Approve / Reject / Return) */}
      <Modal
        isOpen={['approve', 'reject', 'return', 'escalate'].includes(actionType)}
        onClose={() => setActionType(null)}
        title={
          actionType === 'approve'
            ? 'Approve Request'
            : actionType === 'escalate'
            ? 'Escalate Grievance'
            : actionType === 'reject'
            ? 'Reject Request'
            : 'Return for Correction'
        }
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {actionType === 'approve'
              ? 'Are you sure you want to approve this request? It will be marked as approved or forwarded to the next reviewer in the chain.'
              : actionType === 'escalate'
              ? 'Provide mandatory remarks explaining why this grievance requires HOD review.'
              : actionType === 'reject'
              ? 'Are you sure you want to reject this request? Rejection ends the approval chain.'
              : 'Return this request back to the student so they can correct details and re-upload supporting documents.'}
          </p>

          <div className="form-group">
            <label className="label">
              Remarks {actionType !== 'approve' && <span className="text-red-500">* (Mandatory)</span>}
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                actionType === 'approve'
                  ? 'Optional approval remarks or verification notes...'
                  : 'Specify the reason or what correction is required...'
              }
              className="input resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => setActionType(null)}
              className="btn-secondary"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleWorkflowAction}
              disabled={actionLoading}
              className={
                actionType === 'approve'
                  ? 'btn-success'
                  : actionType === 'escalate'
                  ? 'btn-primary'
                  : actionType === 'reject'
                  ? 'btn-danger'
                  : 'btn-warning'
              }
            >
              {actionLoading ? 'Processing...' : actionType === 'escalate' ? 'Escalate to HOD' : 'Confirm Action'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Student Resubmission Modal */}
      <Modal
        isOpen={actionType === 'resubmit'}
        onClose={() => setActionType(null)}
        title="Resubmit Request"
        size="lg"
      >
        <form onSubmit={handleResubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Address the approver's remarks and update your explanation. You may also attach additional documents.
          </p>

          <div className="form-group">
            <label className="label">Updated Description <span className="text-red-500">*</span></label>
            <textarea
              rows={4}
              value={resubmitDescription}
              onChange={(e) => setResubmitDescription(e.target.value)}
              className="input resize-none"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Add More Documents (Optional)</label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setResubmitFiles(Array.from(e.target.files))}
              className="input text-xs"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setActionType(null)}
              className="btn-secondary"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={actionLoading}
            >
              {actionLoading ? 'Submitting...' : 'Resubmit Now'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
