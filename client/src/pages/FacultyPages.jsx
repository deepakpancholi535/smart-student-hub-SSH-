import { useEffect, useState } from 'react';
import { ClipboardCheck, Download, ShieldCheck } from 'lucide-react';
import { api, json } from '../services/api';
import { Field, ErrorState, LoadingState, Notice, PageHeader, Panel, StatusBadge } from '../components/common';

const branches = ['CSE', 'IT', 'IoT', 'AI', 'DS', 'ME', 'EE', 'CE', 'ECE'];
const sections = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function FacultyDashboard() {
  const [assignment, setAssignment] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ branch: '', section: '', group: '' });
  async function load() {
    setLoading(true);
    try {
      const current = await api('/faculty/assignment');
      setAssignment(current.assignment);
      if (current.assignment) setForm(current.assignment);
      const result = await api('/faculty/verifications');
      setRequests(result.verifications);
    } catch (error) { setFailure(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function claim(event) {
    event.preventDefault();
    setFailure('');
    try { const result = await api('/faculty/assignment', json('PUT', form)); setAssignment(result.assignment); setMessage('Your counselor batch has been assigned.'); await load(); }
    catch (error) { setFailure(error.message); }
  }
  async function decide(id, status) {
    const feedback = status === 'verified' ? '' : window.prompt('Enter feedback for the student:') || '';
    if (status !== 'verified' && !feedback.trim()) return;
    try { await api(`/faculty/achievements/${id}/decision`, json('POST', { status, feedback })); setMessage('Verification decision saved.'); await load(); }
    catch (error) { setFailure(error.message); }
  }
  if (loading) return <LoadingState />;
  return <><PageHeader title="Faculty verification" description="Review certificate requests from your assigned branch, section and group." />{message && <Notice>{message}</Notice>}{failure && <ErrorState message={failure} />}{!assignment && <Panel title="Claim your counselor batch"><p className="panel-note">Choose the batch you are responsible for. Each batch can have one counselor, and this assignment cannot be changed without administrator support.</p><form className="form-grid" onSubmit={claim}><Field label="Branch"><select required value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })}><option value="">Select branch</option>{branches.map((branch) => <option key={branch}>{branch}</option>)}</select></Field><Field label="Section"><select required value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })}><option value="">Select section</option>{sections.map((section) => <option key={section}>{section}</option>)}</select></Field><Field label="Group"><select required value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value })}><option value="">Select group</option><option value="1">1</option><option value="2">2</option></select></Field><div className="field-wide form-end"><button className="button button-primary"><ShieldCheck size={15} /> Claim counselor batch</button></div></form></Panel>}{assignment && <Panel title={`Batch ${assignment.branch} · Section ${assignment.section} · Group ${assignment.group}`}><p className="panel-note">Only requests from this batch are shown.</p>{requests.length === 0 ? <div className="empty-state"><ClipboardCheck size={24} /><strong>No pending requests</strong><span>New submissions from your batch will appear here.</span></div> : <div className="verification-list">{requests.map((item) => <article className="verification-item" key={item._id}><div className="verification-icon state-pending"><ShieldCheck size={18} /></div><div className="verification-content"><div className="verification-title"><h3>{item.title}</h3><StatusBadge status="pending" /></div><p>{item.student?.name} · {item.student?.email} · {item.issuer || 'Issuer not specified'}</p><div className="achievement-actions"><a className="button button-secondary button-small" href={`/api/faculty/achievements/${item._id}/certificate`}><Download size={14} /> Certificate</a><button className="button button-primary button-small" onClick={() => decide(item._id, 'verified')}>Verify</button><button className="button button-secondary button-small" onClick={() => decide(item._id, 'needs-correction')}>Request correction</button><button className="button button-danger-quiet button-small" onClick={() => decide(item._id, 'rejected')}>Reject</button></div></div></article>)}</div>}</Panel>}</>;
}
