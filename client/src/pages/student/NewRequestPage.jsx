import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestService } from '../../services/request.service';

const initial = { category: 'general_academic', title: '', description: '' };
export default function NewRequestPage() {
  const [values, setValues] = useState(initial); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  const update = (e) => setValues((old) => ({ ...old, [e.target.name]: e.target.value }));
  async function submit(e) { e.preventDefault(); setError(''); setBusy(true); try { const { data } = await requestService.create(values); navigate(`/student/requests/${data.request._id}`, { replace: true, state: { notice: data.message } }); } catch (err) { setError(err.response?.data?.message || 'Unable to submit your request.'); } finally { setBusy(false); } }
  return <div className="content-page narrow-page"><div className="page-heading"><span className="eyebrow">STUDENT WORKSPACE</span><h1>Submit an academic request</h1><p className="muted">Provide clear details so the appropriate campus team can review your request.</p></div><form className="request-form" onSubmit={submit}>
    <label>Request category<select name="category" value={values.category} onChange={update}><option value="general_academic">General academic request</option><option value="attendance_correction">Attendance correction</option><option value="medical_leave">Medical leave</option><option value="event_participation">Event participation</option></select></label>
    <label>Request title<input name="title" value={values.title} onChange={update} minLength="5" maxLength="120" required placeholder="e.g. Request for attendance correction"/><small>5–120 characters</small></label>
    <label>Explain your request<textarea name="description" value={values.description} onChange={update} minLength="20" maxLength="5000" required rows="7" placeholder="Include dates, relevant course/event details and the action you are requesting."/><small>20–5000 characters</small></label>
    {error && <div className="alert error">{error}</div>}
    <div className="form-actions"><Link to="/student/requests" className="secondary-link">Cancel</Link><button className="primary-button submit-request" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'} <span>→</span></button></div>
  </form><p className="upload-note">Supporting document uploads will be added after the team configures a secure file-storage provider. Do not include sensitive medical details beyond what is necessary in this text form.</p></div>;
}
