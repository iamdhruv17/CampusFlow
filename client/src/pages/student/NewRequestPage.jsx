import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { requestService } from '../../services/request.service';
import { REQUEST_TYPES } from '../../utils/constants';
import { getErrorMessage, formatFileSize } from '../../utils/formatters';
import toast from 'react-hot-toast';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_SIZE = 5 * 1024 * 1024;

function FileUploadZone({ files, setFiles, required, label }) {
  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  };

  const handleChange = (e) => {
    addFiles(Array.from(e.target.files));
  };

  const addFiles = (newFiles) => {
    const valid = newFiles.filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: Only PDF, JPG, PNG allowed.`);
        return false;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name}: File too large (max 5 MB).`);
        return false;
      }
      return true;
    });
    const remainingSlots = Math.max(0, 5 - files.length);
    if (valid.length > remainingSlots) {
      toast.error('A request may include no more than 5 supporting documents.');
    }
    setFiles(prev => [...prev, ...valid.slice(0, remainingSlots)]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="form-group">
      <label className="label">{label || 'Supporting Documents'} {required && <span className="text-red-500">*</span>}</label>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer"
        onClick={() => document.getElementById('file-input').click()}
      >
        <Upload size={24} className="text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">Drop files here or click to upload</p>
        <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG · Max 5 MB per file · Up to 5 files</p>
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          onChange={handleChange}
        />
      </div>
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <FileText size={16} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
              </div>
              <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewRequestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { requestType: searchParams.get('type') || '' },
  });

  const requestType = watch('requestType');

  useEffect(() => {
    const typeFromQuery = searchParams.get('type');
    if (typeFromQuery) setValue('requestType', typeFromQuery);
  }, [searchParams, setValue]);

  const onSubmit = async (data) => {
    if (!Object.prototype.hasOwnProperty.call(REQUEST_TYPES, data.requestType)) {
      toast.error('Please select a supported request category.');
      return;
    }
    if (data.description.trim().length < 10) {
      toast.error('Description must be at least 10 characters long.');
      return;
    }
    if (
      data.requestType === 'medical_leave' &&
      data.leaveStartDate > data.leaveEndDate
    ) {
      toast.error('Leave end date must be on or after the leave start date.');
      return;
    }
    if (data.requestType === 'medical_leave' && files.length === 0) {
      toast.error('Please upload at least one medical document.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== '') formData.append(key, val);
      });
      files.forEach(file => formData.append('files', file));

      await requestService.create(formData);
      toast.success('Request submitted successfully!');
      navigate('/requests');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const renderTypeSpecificFields = () => {
    switch (requestType) {
      case 'attendance_correction':
        return (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Subject Name <span className="text-red-500">*</span></label>
                <input type="text" className={`input ${errors.subject ? 'input-error' : ''}`}
                  placeholder="e.g. Data Structures"
                  {...register('subject', { required: 'Subject is required' })} />
                {errors.subject && <p className="error-text">{errors.subject.message}</p>}
              </div>
              <div className="form-group">
                <label className="label">Subject Code</label>
                <input type="text" className="input" placeholder="e.g. CS301"
                  {...register('subjectCode')} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Date of Lecture <span className="text-red-500">*</span></label>
                <input type="date" className={`input ${errors.attendanceDate ? 'input-error' : ''}`}
                  {...register('attendanceDate', { required: 'Date is required' })} />
                {errors.attendanceDate && <p className="error-text">{errors.attendanceDate.message}</p>}
              </div>
              <div className="form-group">
                <label className="label">Lecture / Period Number</label>
                <input type="text" className="input" placeholder="e.g. 3rd period"
                  {...register('lectureNumber')} />
              </div>
            </div>
            <FileUploadZone files={files} setFiles={setFiles} label="Supporting Evidence (optional)" />
          </>
        );

      case 'event_attendance':
        return (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Event Name <span className="text-red-500">*</span></label>
                <input type="text" className={`input ${errors.eventName ? 'input-error' : ''}`}
                  placeholder="e.g. Inter-College Coding Competition"
                  {...register('eventName', { required: 'Event name is required' })} />
                {errors.eventName && <p className="error-text">{errors.eventName.message}</p>}
              </div>
              <div className="form-group">
                <label className="label">Event Date <span className="text-red-500">*</span></label>
                <input type="date" className={`input ${errors.eventDate ? 'input-error' : ''}`}
                  {...register('eventDate', { required: 'Event date is required' })} />
                {errors.eventDate && <p className="error-text">{errors.eventDate.message}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Event Organizer / Coordinator</label>
                <input type="text" className="input" placeholder="e.g. Tech Club"
                  {...register('eventOrganizer')} />
              </div>
              <div className="form-group">
                <label className="label">Subject for Attendance Credit</label>
                <input type="text" className="input" placeholder="e.g. Data Structures"
                  {...register('subject')} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Participation Details</label>
              <input type="text" className="input" placeholder="e.g. Team lead, won 2nd prize"
                {...register('participationDetails')} />
            </div>
            <FileUploadZone files={files} setFiles={setFiles} label="Certificate / Evidence (recommended)" />
          </>
        );

      case 'medical_leave':
        return (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Leave Start Date <span className="text-red-500">*</span></label>
                <input type="date" className={`input ${errors.leaveStartDate ? 'input-error' : ''}`}
                  {...register('leaveStartDate', { required: 'Start date is required' })} />
                {errors.leaveStartDate && <p className="error-text">{errors.leaveStartDate.message}</p>}
              </div>
              <div className="form-group">
                <label className="label">Leave End Date <span className="text-red-500">*</span></label>
                <input type="date" className={`input ${errors.leaveEndDate ? 'input-error' : ''}`}
                  {...register('leaveEndDate', { required: 'End date is required' })} />
                {errors.leaveEndDate && <p className="error-text">{errors.leaveEndDate.message}</p>}
              </div>
            </div>
            <div className="form-group">
              <label className="label">Medical Description</label>
              <input type="text" className="input" placeholder="e.g. High fever and throat infection"
                {...register('medicalDescription')} />
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex gap-2">
              <AlertCircle size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">Medical leave requires at least one supporting document (medical certificate, prescription, or discharge summary).</p>
            </div>
            <FileUploadZone files={files} setFiles={setFiles} label="Medical Certificate / Documents" required />
          </>
        );

      case 'other_grievance':
        return (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="label">Grievance Category <span className="text-red-500">*</span></label>
                <input type="text" className={`input ${errors.grievanceCategory ? 'input-error' : ''}`}
                  placeholder="e.g. Exam Re-evaluation"
                  {...register('grievanceCategory', { required: 'Category is required' })} />
                {errors.grievanceCategory && <p className="error-text">{errors.grievanceCategory.message}</p>}
              </div>
              <div className="form-group">
                <label className="label">Target Department</label>
                <input type="text" className="input" placeholder="e.g. Computer Science"
                  {...register('targetDepartment')} />
              </div>
            </div>
            <FileUploadZone files={files} setFiles={setFiles} label="Supporting Evidence (if any)" />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title">Submit New Request</h1>
        <p className="page-subtitle">Fill in the details below and our team will review your request.</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Request Type */}
          <div className="form-group">
            <label className="label">Request Category <span className="text-red-500">*</span></label>
            <select
              className={`input ${errors.requestType ? 'input-error' : ''}`}
              {...register('requestType', { required: 'Please select a request category' })}
            >
              <option value="">— Select a category —</option>
              {Object.entries(REQUEST_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {errors.requestType && <p className="error-text">{errors.requestType.message}</p>}
          </div>

          {/* Dynamic fields */}
          {requestType && (
            <div className="space-y-5 pt-2 border-t border-slate-100">
              {renderTypeSpecificFields()}

              {/* Description — always present */}
              <div className="form-group">
                <label className="label">
                  {requestType === 'medical_leave' ? 'Reason for Leave' : 'Detailed Explanation'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  className={`input resize-none ${errors.description ? 'input-error' : ''}`}
                  placeholder="Provide a clear and detailed explanation of your request..."
                  {...register('description', {
                    required: 'Description is required',
                    minLength: { value: 10, message: 'At least 10 characters required' },
                  })}
                />
                {errors.description && <p className="error-text">{errors.description.message}</p>}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading || !requestType}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
