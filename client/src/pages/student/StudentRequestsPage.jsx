import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestService } from '../../services/request.service';

const LABELS = { attendance_correction: 'Attendance correction', medical_leave: 'Medical leave', event_participation: 'Event participation', general_academic: 'General academic request' };
const STATUSES = ['all', 'submitted', 'under_review', 'returned', 'approved', 'rejected'];
const prettyStatus = (value) => value.replaceAll('_', ' ');

export default function StudentRequestsPage() {
  const [requests, setRequests] = useState([]); const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let alive = true; setLoading(true); requestService.list(status === 'all' ? {} : { status }).then(({ data }) => { if (alive) setRequests(data.requests); }).catch((e) => { if (alive) setError(e.response?.data?.message || 'Unable to load your requests.'); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [status]);
  return <div className="content-page">
    <div className="page-heading request-heading"><div><span className="eyebrow">STUDENT WORKSPACE</span><h1>My academic requests</h1><p className="muted">Create requests and follow their progress from one place.</p></div><Link className="primary-link" to="/student/requests/new">＋ New request</Link></div>
    <div className="request-toolbar"><label>Filter by status <select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All requests' : prettyStatus(s)}</option>)}</select></label></div>
    {error && <div className="alert error">{error}</div>}
    {loading ? <p className="muted">Loading your requests…</p> : requests.length === 0 ? <div className="empty-state"><h2>No requests found</h2><p className="muted">Your submitted academic requests will appear here.</p><Link to="/student/requests/new" className="primary-link">Create your first request</Link></div> : <div className="request-list">{requests.map((r) => <article className="request-card" key={r._id}><div className="request-card-top"><span className="request-category">{LABELS[r.category] || r.category}</span><span className={`status-pill status-${r.status}`}>{prettyStatus(r.status)}</span></div><h2>{r.title}</h2><p>{r.description.length > 180 ? `${r.description.slice(0, 180)}…` : r.description}</p><div className="request-card-bottom"><span>Submitted {new Date(r.submittedAt || r.createdAt).toLocaleDateString()}</span><Link to={`/student/requests/${r._id}`}>View details →</Link></div></article>)}</div>}
  </div>;
}
