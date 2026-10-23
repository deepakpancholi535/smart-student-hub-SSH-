import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, Award, Bell, BriefcaseBusiness, Check, CheckCircle2,
  ChevronRight, CircleHelp, ClipboardCheck, Copy, ExternalLink, FileBadge2, FileSearch,
  Code2, FileText, Github, Globe2, GraduationCap, Link2, LoaderCircle, Plus, RefreshCw,
  Pencil, ShieldCheck, Sparkles, Trash2, Upload, UserRound, X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, apiBlob, json } from '../services/api';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { ProfileImageCropper } from '../components/ProfileImageCropper';
import {
  EmptyState, ErrorState, Field, FormError, LoadingState, Notice, PageHeader, Panel, StatusBadge, VerificationBadge,
} from '../components/common';

function useLoad(path, initial = null) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api(path));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, setData, loading, error, refresh };
}

function Dashboard() {
  const { data, loading, error, refresh } = useLoad('/student/dashboard');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={refresh} />;
  const profile = data.profile;
  const academicDetails = [
    profile.department && { label: 'Department', value: profile.department },
    profile.degree && { label: 'Degree', value: profile.degree },
    profile.graduationYear && { label: 'Graduation year', value: profile.graduationYear },
    profile.cgpa != null && { label: 'CGPA', value: `${profile.cgpa} / 10` },
    ...(profile.semesterGrades || []).map((grade) => ({ label: `Semester ${grade.semester} SGPA`, value: `${grade.sgpa} / 10` })),
  ].filter(Boolean);
  const activity = [
    ...data.recentNotifications.map((item) => ({ ...item, date: item.createdAt })),
    ...(data.latestAnalysis ? [{
      _id: data.latestAnalysis._id,
      title: 'Resume analysis completed',
      message: `Resume reviewed against ${data.latestAnalysis.jobTitle}.`,
      createdAt: data.latestAnalysis.createdAt,
      date: data.latestAnalysis.createdAt,
      route: '/student/resume-analyzer',
    }] : []),
  ].sort((left, right) => new Date(right.date) - new Date(left.date)).slice(0, 5);
  return (
    <>
      <PageHeader eyebrow="YOUR STUDENT HUB" title={`Good to see you, ${data.user.name.split(' ')[0]}.`} description={[profile.department, profile.graduationYear && `Class of ${profile.graduationYear}`].filter(Boolean).join(' · ') || 'A clear view of your profile, achievements and career readiness.'} action={<Link to="/student/profile" className="button button-primary"><UserRound size={16} /> {data.completion === 100 ? 'View profile' : 'Complete profile'} <ArrowRight size={16} /></Link>} />
      <section className="completion-banner">
        <div className="completion-copy"><span className="eyebrow">PROFILE COMPLETION</span><strong>{data.completion}%</strong><p>{data.missingProfileFields.length ? `A few details will help you stand out: ${data.missingProfileFields.join(', ')}.` : 'Your student profile is complete and ready to share.'}</p>{data.missingProfileFields.length > 0 && <Link to="/student/profile" className="text-button">Continue your profile <ArrowRight size={14} /></Link>}</div>
        <div className="completion-ring" style={{ '--completion': `${data.completion * 3.6}deg` }}><div><strong>{data.completion}%</strong><span>complete</span></div></div>
      </section>
      <div className="stat-grid">
        <Stat icon={Award} label="Achievements" value={String(data.stats.totalAchievements)} foot={`${data.stats.verifiedAchievements} verified`} />
        <Stat icon={ShieldCheck} label="Verified achievements" value={String(data.stats.verifiedAchievements)} foot="Approved by faculty" />
        <Stat icon={ShieldCheck} label="Awaiting verification" value={String(data.stats.pendingVerifications)} foot="Certificates submitted to faculty" />
        <Stat icon={FileText} label="Resume" value={profile.resume?.originalName || 'Not uploaded'} foot={profile.resume?.updatedAt ? `Updated ${formatDate(profile.resume.updatedAt)}` : 'Upload a PDF to get started'} />
      </div>
      <Panel title="Academic summary" className="academic-panel">
        {academicDetails.length ? <div className="academic-details">{academicDetails.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div> : <EmptyState icon={GraduationCap} title="Academic details haven't been added yet." description="Add your degree, department, CGPA or graduation year to your profile." action={<Link to="/student/profile" className="text-button">Update academic details <ArrowRight size={14} /></Link>} />}
      </Panel>
      <div className="content-grid dashboard-grid">
        <Panel title="Recent activity" action={<Link className="panel-link" to="/student/notifications">View notifications <ChevronRight size={15} /></Link>}>
          {activity.length ? <div className="list-rows">{activity.map((item) => <Link className="list-row" key={item._id} to={item.route || '/student/notifications'}><div className="row-icon"><Bell size={16} /></div><div className="row-main"><strong>{item.title}</strong><span>{item.message}</span><span>{formatDate(item.date)}</span></div><ChevronRight size={15} /></Link>)}</div> : <EmptyState icon={Bell} title="No recent activity yet." description="Updates from your profile and verification requests will appear here." />}
        </Panel>
        <Panel title="Resume readiness" className="resume-panel">
          <div className="resume-symbol"><FileSearch size={21} /></div><h3>A resume that fits the opportunity.</h3>
          <p>Compare your PDF resume against an internship or job description and get evidence-based suggestions.</p>
          <Link className={`button ${profile.resume?.originalName ? 'button-primary' : 'button-secondary'} button-wide`} to="/student/resume-analyzer">{profile.resume?.originalName ? 'Analyze my resume' : 'Upload a resume'} <ArrowRight size={15} /></Link>
          {!data.aiConfigured && <span className="caption">AI analysis is not configured yet.</span>}
        </Panel>
      </div>
      <Panel title="Quick actions" className="quick-panel">
        <div className="quick-actions">
          <Quick to="/student/profile" icon={UserRound} label="Update profile" />
          <Quick to="/student/achievements" icon={Plus} label="Add achievement" />
          <Quick to="/student/verification" icon={ClipboardCheck} label="Check verification" />
          <Quick to="/student/portfolio" icon={Globe2} label="Digital portfolio" />
        </div>
      </Panel>
    </>
  );
}

function Stat({ icon: Icon, label, value, foot }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={18} /></div><strong className="stat-value">{value}</strong><span className="stat-foot">{foot}</span></article>;
}

function ActivityHeatmap({ platform, data, icon: Icon }) {
  if (!data || data.status !== 'available') {
    return (
      <section className="activity-card">
        <div className="activity-card-heading"><span className="activity-icon"><Icon size={16} /></span><h3>{platform}</h3></div>
        <div className="activity-unavailable">{data?.message || `${platform} activity is unavailable.`}</div>
      </section>
    );
  }

  const days = data.days;
  const offset = days.length ? new Date(`${days[0].date}T00:00:00Z`).getUTCDay() : 0;
  const weekCount = Math.ceil((offset + days.length) / 7);
  const monthLabels = Array(weekCount).fill('');
  days.forEach((day, index) => {
    if (day.date.slice(8, 10) === '01') {
      const week = Math.floor((offset + index) / 7);
      if (!monthLabels[week]) monthLabels[week] = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`));
    }
  });

  return (
    <section className="activity-card">
      <div className="activity-card-heading">
        <span className="activity-icon"><Icon size={16} /></span>
        <h3>{platform}</h3>
        <strong>{data.totalContributions.toLocaleString()} <span>{platform === 'GitHub' ? 'contributions' : 'submissions'}</span></strong>
      </div>
      <div className="activity-scroll" role="group" aria-label={`${platform} activity for the last 12 months`}>
        <div className="activity-months" style={{ '--activity-weeks': weekCount }}>
          {monthLabels.map((month, index) => <span key={index}>{month}</span>)}
        </div>
        <div className="activity-calendar">
          <div className="activity-weekdays"><span>Mon</span><span>Wed</span><span>Fri</span></div>
          <div className="activity-days" style={{ '--activity-weeks': weekCount }}>
            {Array.from({ length: weekCount * 7 }, (_, index) => {
              const dayIndex = index - offset;
              const day = days[dayIndex];
              if (!day) return <span className="activity-day activity-day-empty" key={`empty-${index}`} />;
              const label = `${day.count} ${platform === 'GitHub' ? 'contribution' : 'submission'}${day.count === 1 ? '' : 's'} on ${formatDate(day.date)}`;
              return <span className={`activity-day activity-level-${day.level}`} key={day.date} title={label} role="img" aria-label={label} />;
            })}
          </div>
        </div>
      </div>
      <div className="activity-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <span className={`activity-day activity-level-${level}`} key={level} />)}<span>More</span></div>
    </section>
  );
}

function Quick({ to, icon: Icon, label }) {
  return <Link to={to} className="quick-link"><span><Icon size={17} /></span><strong>{label}</strong><ArrowRight size={15} /></Link>;
}

const blankProfile = {
  phone: '', department: '', degree: '', graduationYear: '', semester: '', cgpa: '', semesterGrades: [],
  institution: '', summary: '', careerInterests: '', skills: [], links: { github: '', linkedin: '', portfolio: '' }, projects: [], resume: null,
};

function ProfilePage() {
  const { data, loading, error, refresh } = useLoad('/student/profile');
  const { data: activityData, loading: activityLoading, error: activityError, refresh: refreshActivity } = useLoad('/student/profile/activity');
  const [form, setForm] = useState(blankProfile);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState('technical');
  const [file, setFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [croppedPreview, setCroppedPreview] = useState('');
  const [cropFile, setCropFile] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);
  const [gradeInput, setGradeInput] = useState({ semester: '', sgpa: '' });
  const [project, setProject] = useState({ title: '', description: '', technologies: '', githubUrl: '', demoUrl: '', type: 'project', organization: '', duration: '' });
  const [editingProjectId, setEditingProjectId] = useState('');
  const [addingProject, setAddingProject] = useState(false);

  useEffect(() => {
    if (!data?.profile) return;
    const { user, ...profile } = data.profile;
    setForm({ ...blankProfile, ...profile, links: { ...blankProfile.links, ...profile.links }, careerInterests: (profile.careerInterests || []).join(', ') });
  }, [data]);

  useEffect(() => {
    if (!imageFile) {
      setCroppedPreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(imageFile);
    setCroppedPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={refresh} />;

  async function saveProfile(event) {
    event.preventDefault();
    setMessage('');
    setFailure('');
    setSaving(true);
    try {
      await api('/student/profile', json('PUT', {
        ...form,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
        semester: form.semester ? Number(form.semester) : null,
        cgpa: form.cgpa ? Number(form.cgpa) : null,
        careerInterests: form.careerInterests ? form.careerInterests.split(',').map((entry) => entry.trim()).filter(Boolean) : [],
      }));
      setMessage('Your profile has been saved.');
      await Promise.all([refresh(), refreshActivity()]);
    } catch (err) { setFailure(err.message); }
    finally { setSaving(false); }
  }

  async function addSkill(event) {
    event.preventDefault();
    if (!skillName.trim()) return;
    try {
      const skills = [...form.skills, { name: skillName.trim(), category: skillCategory }];
      await api('/student/profile', json('PUT', { skills }));
      setSkillName('');
      await refresh();
      setMessage('Skill added to your profile.');
    } catch (err) { setFailure(err.message); }
  }

  async function removeSkill(index) {
    try {
      await api('/student/profile', json('PUT', { skills: form.skills.filter((_, position) => position !== index) }));
      await refresh();
    } catch (err) { setFailure(err.message); }
  }

  async function uploadResume(event) {
    event.preventDefault();
    if (!file) return;
    setFailure('');
    const body = new FormData();
    body.append('file', file);
    try {
      await api('/student/resume', { method: 'POST', body });
      setFile(null);
      event.target.reset();
      await refresh();
      setMessage('Your resume was uploaded.');
    } catch (err) { setFailure(err.message); }
  }

  async function uploadProfileImage() {
    if (!imageFile) {
      imageInputRef.current?.click();
      return;
    }
    setFailure('');
    setMessage('');
    setImageUploading(true);
    const body = new FormData();
    body.append('file', imageFile);
    try {
      await api('/student/profile/image', { method: 'POST', body });
      const storedImage = await apiBlob('/student/profile/image');
      if (!storedImage?.size) throw new Error('The server did not return the saved picture. Please try uploading again.');
      await refresh();
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      window.dispatchEvent(new Event('ssh:profile-image-changed'));
      setMessage('Your profile picture was updated.');
    } catch (err) { setFailure(err.message); }
    finally { setImageUploading(false); }
  }

  async function deleteProfileImage() {
    if (!window.confirm('Remove your profile picture?')) return;
    try {
      await api('/student/profile/image', { method: 'DELETE' });
      await refresh();
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      window.dispatchEvent(new Event('ssh:profile-image-changed'));
      setMessage('Your profile picture was removed.');
    } catch (err) { setFailure(err.message); }
  }

  function addSemesterGrade() {
    const semester = Number(gradeInput.semester);
    const sgpa = Number(gradeInput.sgpa);
    if (form.semesterGrades.some((grade) => grade.semester === semester)) {
      setFailure(`Semester ${semester} already has an SGPA entry.`);
      return;
    }
    setFailure('');
    setForm({ ...form, semesterGrades: [...form.semesterGrades, { semester, sgpa }].sort((left, right) => left.semester - right.semester) });
    setGradeInput({ semester: '', sgpa: '' });
  }

  async function deleteResume() {
    if (!window.confirm('Remove your current resume?')) return;
    try {
      await api('/student/resume', { method: 'DELETE' });
      await refresh();
      setMessage('Your resume was removed.');
    } catch (err) { setFailure(err.message); }
  }

  async function addProject(event) {
    event.preventDefault();
    setAddingProject(true);
    setFailure('');
    try {
      await api(editingProjectId ? `/student/projects/${editingProjectId}` : '/student/projects', json(editingProjectId ? 'PUT' : 'POST', {
        ...project,
        technologies: project.technologies.split(',').map((entry) => entry.trim()).filter(Boolean),
      }));
      setProject({ title: '', description: '', technologies: '', githubUrl: '', demoUrl: '', type: 'project', organization: '', duration: '' });
      setEditingProjectId('');
      await refresh();
      setMessage(editingProjectId ? 'Project or experience updated.' : 'Project or experience added.');
    } catch (err) { setFailure(err.message); }
    finally { setAddingProject(false); }
  }

  async function deleteProject(id) {
    if (!window.confirm('Delete this project or experience?')) return;
    try { await api(`/student/projects/${id}`, { method: 'DELETE' }); await refresh(); }
    catch (err) { setFailure(err.message); }
  }

  function editProject(item) {
    setEditingProjectId(item._id);
    setProject({
      title: item.title || '',
      description: item.description || '',
      technologies: (item.technologies || []).join(', '),
      githubUrl: item.githubUrl || '',
      demoUrl: item.demoUrl || '',
      type: item.type || 'project',
      organization: item.organization || '',
      duration: item.duration || '',
    });
    document.querySelector('.project-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <>
      <PageHeader title="My profile" description="Your information, academic background and professional experience in one place." />
      {message && <Notice>{message}</Notice>}{failure && <ErrorState message={failure} />}
      <form className="profile-form" onSubmit={saveProfile}>
        <Panel title="Profile picture" className="form-panel">
          <div className="profile-picture-row">
            {croppedPreview
              ? <img className="profile-picture-preview" src={croppedPreview} alt="Cropped profile picture preview" />
              : <ProfileAvatar name={data.profile.user.name} className="profile-picture-preview" fallbackClassName="profile-picture-preview profile-picture-placeholder" alt="Your profile" onError={(reason) => setFailure(`Could not load your saved profile picture: ${reason}`)} />}
            <div className="profile-picture-controls">
              <p>Select a JPEG, PNG or WebP image up to 2 MB. Crop it, then upload the square preview. Your picture is private to your account.</p>
              <div className="upload-line"><input ref={imageInputRef} aria-label="Select profile picture" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                event.target.value = '';
                setMessage('');
                if (selected && selected.size > 2 * 1024 * 1024) {
                  setImageFile(null);
                  setCropFile(null);
                  setFailure('Profile pictures must be 2 MB or smaller.');
                  return;
                }
                setFailure('');
                if (selected) {
                  setImageFile(null);
                  setCropFile(selected);
                }
              }} /><button type="button" className={`button ${imageFile ? 'button-upload-ready' : 'button-secondary'}`} disabled={imageUploading} aria-describedby="profile-picture-selection" onClick={() => {
                if (imageFile) uploadProfileImage();
                else imageInputRef.current?.click();
              }}><Upload size={14} /> {imageUploading ? 'Uploading…' : imageFile ? 'Upload' : 'Choose picture'}</button>{imageFile && <button type="button" className="button button-secondary button-small" disabled={imageUploading} onClick={() => imageInputRef.current?.click()}>Change crop</button>}{data.profile.profileImageAvailable && <button type="button" className="button button-danger-quiet button-small" disabled={imageUploading} onClick={deleteProfileImage}>Remove</button>}</div>
              <small id="profile-picture-selection" aria-live="polite">{imageFile ? 'Cropped preview ready. Select Upload to save this picture.' : 'Choose a picture to open the crop editor.'}</small>
            </div>
          </div>
        </Panel>
        <Panel title="Personal information" className="form-panel">
          <div className="form-grid">
            <Field label="Full name"><input value={data.profile.user.name} readOnly /></Field>
            <Field label="College email"><input type="email" value={data.profile.user.email} readOnly /></Field>
            <Field label="Phone number"><input maxLength={30} value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Optional" /></Field>
            <Field label="Department"><input maxLength={120} value={form.department || ''} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="e.g. Computer Science" /></Field>
            <Field label="Career interests" className="field-wide"><input maxLength={500} value={form.careerInterests || ''} onChange={(event) => setForm({ ...form, careerInterests: event.target.value })} placeholder="Software engineering, data science" /><small>Separate interests with commas.</small></Field>
            <Field label="Professional summary" className="field-wide"><textarea rows="4" maxLength={1000} value={form.summary || ''} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="A few sentences about your experience and what you hope to do next." /></Field>
          </div>
        </Panel>
        <Panel title="Academic information" className="form-panel">
          <p className="panel-note">Student-entered academic details are not institution-verified. Contact your institution to correct official records.</p>
          <div className="form-grid">
            <Field label="Institution"><input maxLength={160} value={form.institution || ''} onChange={(event) => setForm({ ...form, institution: event.target.value })} /></Field>
            <Field label="Degree"><input maxLength={120} value={form.degree || ''} onChange={(event) => setForm({ ...form, degree: event.target.value })} placeholder="e.g. B.Tech" /></Field>
            <Field label="Graduation year"><input type="number" min="1950" max="2100" value={form.graduationYear || ''} onChange={(event) => setForm({ ...form, graduationYear: event.target.value })} /></Field>
            <Field label="Current semester"><input type="number" min="1" max="12" value={form.semester || ''} onChange={(event) => setForm({ ...form, semester: event.target.value })} /></Field>
            <Field label="CGPA (out of 10)"><input type="number" step="0.01" min="0" max="10" value={form.cgpa ?? ''} onChange={(event) => setForm({ ...form, cgpa: event.target.value })} /></Field>
          </div>
          <div className="sgpa-section">
            <div className="sgpa-heading"><strong>Semester-wise SGPA</strong><span className="caption">Student-entered and not institution-verified.</span></div>
            {form.semesterGrades.length > 0 && <div className="sgpa-list">{form.semesterGrades.map((grade) => <span className="skill-chip" key={grade.semester}>Semester {grade.semester} · {grade.sgpa}<button aria-label={`Remove semester ${grade.semester} SGPA`} onClick={() => setForm({ ...form, semesterGrades: form.semesterGrades.filter((item) => item.semester !== grade.semester) })}><X size={13} /></button></span>)}</div>}
            <div className="sgpa-add-form"><Field label="Semester"><input type="number" min="1" max="12" value={gradeInput.semester} onChange={(event) => setGradeInput({ ...gradeInput, semester: event.target.value })} /></Field><Field label="SGPA (out of 10)"><input type="number" step="0.01" min="0" max="10" value={gradeInput.sgpa} onChange={(event) => setGradeInput({ ...gradeInput, sgpa: event.target.value })} /></Field><button type="button" className="button button-secondary" disabled={!gradeInput.semester || !gradeInput.sgpa} onClick={addSemesterGrade}><Plus size={14} /> Add SGPA</button></div>
          </div>
        </Panel>
        <Panel title="Professional links" className="form-panel">
          <div className="form-grid">
            <Field label="GitHub"><input type="url" maxLength={300} value={form.links?.github || ''} onChange={(event) => setForm({ ...form, links: { ...form.links, github: event.target.value } })} placeholder="https://github.com/username" /></Field>
            <Field label="LinkedIn"><input type="url" maxLength={300} value={form.links?.linkedin || ''} onChange={(event) => setForm({ ...form, links: { ...form.links, linkedin: event.target.value } })} placeholder="https://linkedin.com/in/username" /></Field>
            <Field label="Portfolio website"><input type="url" maxLength={300} value={form.links?.portfolio || ''} onChange={(event) => setForm({ ...form, links: { ...form.links, portfolio: event.target.value } })} placeholder="https://example.com" /></Field>
            <Field label="LeetCode username"><input maxLength={30} pattern="[A-Za-z0-9_-]{1,30}" value={form.links?.leetcodeUsername || ''} onChange={(event) => setForm({ ...form, links: { ...form.links, leetcodeUsername: event.target.value } })} placeholder="your-leetcode-username" /><small>Enter your username, not a profile URL.</small></Field>
          </div>
        </Panel>
        <div className="form-footer"><span className="caption">Enrollment identifiers are managed by your institution.</span><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </form>
      {cropFile && <ProfileImageCropper file={cropFile} onCancel={() => setCropFile(null)} onComplete={(croppedFile) => {
        setImageFile(croppedFile);
        setCropFile(null);
      }} />}
      <Panel
        title="Coding activity"
        className="section-spaced activity-panel"
        action={<button className="text-button" onClick={refreshActivity}><RefreshCw size={13} /> Refresh</button>}
      >
        <p className="panel-note">Public GitHub contributions and LeetCode submissions over the last 12 months. Activity updates when you refresh.</p>
        {activityLoading ? <LoadingState label="Loading coding activity…" /> : activityError ? <ErrorState message={activityError} retry={refreshActivity} /> : (
          <div className="activity-grid">
            <ActivityHeatmap platform="GitHub" data={activityData.github} icon={Github} />
            <ActivityHeatmap platform="LeetCode" data={activityData.leetcode} icon={Code2} />
          </div>
        )}
        <p className="activity-disclosure">Activity is fetched from public profile data and may not include private repositories or submissions. If a provider is unavailable, the rest of your profile still works.</p>
      </Panel>
      <Panel title="Skills" className="section-spaced">
        {form.skills?.length > 0 ? <div className="skill-list">{form.skills.map((skill, index) => <span className="skill-chip" key={`${skill.name}-${index}`}>{skill.name} <small>{skill.category === 'soft' ? 'Soft skill' : 'Technical'}</small><button aria-label={`Remove ${skill.name}`} onClick={() => removeSkill(index)}><X size={13} /></button></span>)}</div> : <p className="panel-note">Add the skills you want to highlight on your profile.</p>}
        <form className="inline-form" onSubmit={addSkill}><input aria-label="Skill name" required maxLength={60} value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder="e.g. JavaScript" /><select aria-label="Skill category" value={skillCategory} onChange={(event) => setSkillCategory(event.target.value)}><option value="technical">Technical</option><option value="soft">Soft skill</option></select><button className="button button-secondary"><Plus size={15} /> Add skill</button></form>
      </Panel>
      <Panel title="Resume" className="section-spaced">
        {data.profile.resume?.originalName ? <div className="resume-file"><FileText size={19} /><div><strong>{data.profile.resume.originalName}</strong><span>Updated {formatDate(data.profile.resume.updatedAt)}</span></div><a className="icon-button" href="/api/student/resume/file" aria-label="Download resume"><ArrowDownToLine size={18} /></a><button className="icon-button danger-icon" onClick={deleteResume} aria-label="Remove resume"><Trash2 size={17} /></button></div> : <p className="panel-note">No resume yet. Upload a PDF (up to 5 MB) to use the AI Resume Analyzer.</p>}
        <form className="upload-line" onSubmit={uploadResume}><input aria-label="Select resume PDF" type="file" accept=".pdf,application/pdf" required onChange={(event) => setFile(event.target.files?.[0] || null)} /><button className="button button-secondary"><Upload size={15} /> {data.profile.resume ? 'Replace resume' : 'Upload resume'}</button></form>
      </Panel>
      <Panel title="Projects & experience" className="section-spaced">
        {data.profile.projects?.length ? <div className="project-list">{data.profile.projects.map((item) => <article className="project-card" key={item._id}><div className="project-card-head"><div><span className="eyebrow">{item.type === 'internship' ? 'EXPERIENCE' : 'PROJECT'}</span><h3>{item.title}</h3></div><div className="project-card-actions"><button className="icon-button" onClick={() => editProject(item)} aria-label={`Edit ${item.title}`}><Pencil size={15} /></button><button className="icon-button danger-icon" onClick={() => deleteProject(item._id)} aria-label={`Delete ${item.title}`}><Trash2 size={16} /></button></div></div><p>{item.description}</p>{item.organization && <span className="caption">{item.organization} {item.duration && `· ${item.duration}`}</span>}{item.technologies?.length > 0 && <div className="skill-list">{item.technologies.map((technology) => <span className="skill-chip" key={technology}>{technology}</span>)}</div>}<div className="project-links">{item.githubUrl && <a href={item.githubUrl} target="_blank" rel="noreferrer"><Github size={14} /> GitHub</a>}{item.demoUrl && <a href={item.demoUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Live demo</a>}</div></article>)}</div> : <p className="panel-note">Add a project or internship to show the work behind your skills.</p>}
        <form className="project-form" onSubmit={addProject}>
          <div className="form-grid"><Field label="Title"><input required maxLength={120} value={project.title} onChange={(event) => setProject({ ...project, title: event.target.value })} placeholder="Project or internship title" /></Field><Field label="Type"><select value={project.type} onChange={(event) => setProject({ ...project, type: event.target.value })}><option value="project">Project</option><option value="internship">Internship</option></select></Field><Field label="Organization (internship)"><input maxLength={120} value={project.organization} onChange={(event) => setProject({ ...project, organization: event.target.value })} /></Field><Field label="Duration"><input maxLength={100} value={project.duration} onChange={(event) => setProject({ ...project, duration: event.target.value })} placeholder="e.g. June–August 2025" /></Field><Field label="Description" className="field-wide"><textarea rows="3" maxLength={1500} value={project.description} onChange={(event) => setProject({ ...project, description: event.target.value })} /></Field><Field label="Technologies" className="field-wide"><input value={project.technologies} onChange={(event) => setProject({ ...project, technologies: event.target.value })} placeholder="React, Node.js, MongoDB" /></Field><Field label="GitHub URL"><input type="url" value={project.githubUrl} onChange={(event) => setProject({ ...project, githubUrl: event.target.value })} /></Field><Field label="Live demo URL"><input type="url" value={project.demoUrl} onChange={(event) => setProject({ ...project, demoUrl: event.target.value })} /></Field></div>
          <button className="button button-secondary" disabled={addingProject}>{editingProjectId ? <Pencil size={15} /> : <Plus size={15} />}{addingProject ? 'Saving…' : editingProjectId ? 'Save project or experience' : 'Add project or experience'}</button>
          {editingProjectId && <button type="button" className="button button-secondary" onClick={() => { setEditingProjectId(''); setProject({ title: '', description: '', technologies: '', githubUrl: '', demoUrl: '', type: 'project', organization: '', duration: '' }); }}>Cancel edit</button>}
        </form>
      </Panel>
    </>
  );
}

function AchievementsPage() {
  const { data, loading, error, refresh } = useLoad('/student/achievements');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [achievementForm, setAchievementForm] = useState({
    title: '', category: 'certification', issuer: '', issueDate: '', credentialId: '', credentialUrl: '', description: '', file: null,
  });

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={refresh} />;

  async function addAchievement(event) {
    event.preventDefault();
    setBusy(true);
    setFailure('');
    setMessage('');
    const body = new FormData();
    Object.entries(achievementForm).forEach(([key, value]) => {
      if (value !== null && (editingId || value !== '')) body.append(key, value);
    });
    try {
      await api(editingId ? `/student/achievements/${editingId}` : '/student/achievements', { method: editingId ? 'PUT' : 'POST', body });
      const wasEditing = Boolean(editingId);
      setEditingId('');
      setAchievementForm({ title: '', category: 'certification', issuer: '', issueDate: '', credentialId: '', credentialUrl: '', description: '', file: null });
      await refresh();
      setMessage(wasEditing ? 'Achievement updated.' : 'Achievement saved as a draft.');
    } catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  }

  function editAchievement(item) {
    setEditingId(item._id);
    setAchievementForm({
      title: item.title || '',
      category: item.category || 'other',
      issuer: item.issuer || '',
      issueDate: item.issueDate ? new Date(item.issueDate).toISOString().slice(0, 10) : '',
      credentialId: item.credentialId || '',
      credentialUrl: item.credentialUrl || '',
      description: item.description || '',
      file: null,
    });
    document.querySelector('.achievement-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function submitForVerification(id) {
    setFailure('');
    try {
      await api(`/student/achievements/${id}/submit`, { method: 'POST' });
      await refresh();
      setMessage('Certificate submitted for faculty verification.');
    } catch (err) { setFailure(err.message); }
  }

  async function removeAchievement(id) {
    if (!window.confirm('Delete this draft achievement?')) return;
    try { await api(`/student/achievements/${id}`, { method: 'DELETE' }); await refresh(); }
    catch (err) { setFailure(err.message); }
  }

  return (
    <>
      <PageHeader title="Skills & achievements" description="Show the skills, projects and credentials that make your journey yours." action={<Link className="button button-secondary" to="/student/profile"><UserRound size={16} /> Manage skills</Link>} />
      {message && <Notice>{message}</Notice>}{failure && <ErrorState message={failure} />}
      <Panel title={`Your achievements · ${data.achievements.length}`}>
        {data.achievements.length === 0 ? <EmptyState icon={Award} title="You haven't added any achievements yet." description="Add a certification, workshop, competition or other milestone to get started." /> : <div className="achievement-grid">{data.achievements.map((item) => <article className="achievement-card" key={item._id}><div className="achievement-top"><div className="row-icon"><Award size={17} /></div><StatusBadge status={item.status} /></div><h3>{item.title}{item.status === 'verified' && <VerificationBadge />}</h3><p>{item.issuer || 'Issuer not specified'} {item.issueDate && `· ${formatDate(item.issueDate)}`}</p><span className="category-label">{formatCategory(item.category)}</span>{item.description && <p className="achievement-description">{item.description}</p>}{item.feedback && <div className="feedback-note"><strong>Faculty feedback</strong><span>{item.feedback}</span></div>}<div className="achievement-actions">{['draft', 'needs-correction', 'rejected'].includes(item.status) && <button className="button button-secondary button-small" onClick={() => editAchievement(item)}><Pencil size={13} /> Edit</button>}{['draft', 'needs-correction', 'rejected'].includes(item.status) && <button className="button button-secondary button-small" disabled={!item.certificateKey} onClick={() => submitForVerification(item._id)}><ShieldCheck size={14} /> {item.status === 'draft' ? 'Request verification' : 'Resubmit'}</button>}{item.status === 'draft' && <button className="icon-button danger-icon" aria-label="Delete draft" onClick={() => removeAchievement(item._id)}><Trash2 size={16} /></button>}{item.certificateKey && <a className="icon-button" href={`/api/student/achievements/${item._id}/certificate`} aria-label="View my certificate"><FileText size={16} /></a>}</div></article>)}</div>}
      </Panel>
      <Panel title={editingId ? 'Edit achievement' : 'Add an achievement'} className="section-spaced">
        <form className="form-grid achievement-form" onSubmit={addAchievement}>
          <Field label="Title"><input required maxLength={160} value={achievementForm.title} onChange={(event) => setAchievementForm({ ...achievementForm, title: event.target.value })} placeholder="e.g. Cloud fundamentals certification" /></Field>
          <Field label="Category"><select value={achievementForm.category} onChange={(event) => setAchievementForm({ ...achievementForm, category: event.target.value })}><option value="certification">Technical certification</option><option value="internship">Internship</option><option value="hackathon">Hackathon</option><option value="workshop">Workshop</option><option value="competition">Competition</option><option value="research">Research publication</option><option value="volunteering">Volunteering</option><option value="other">Other</option></select></Field>
          <Field label="Issuing organization"><input maxLength={160} value={achievementForm.issuer} onChange={(event) => setAchievementForm({ ...achievementForm, issuer: event.target.value })} placeholder="Organization or institution" /></Field>
          <Field label="Issue or completion date"><input type="date" max={new Date().toISOString().slice(0, 10)} value={achievementForm.issueDate} onChange={(event) => setAchievementForm({ ...achievementForm, issueDate: event.target.value })} /></Field>
          <Field label="Credential ID (optional)"><input maxLength={120} value={achievementForm.credentialId} onChange={(event) => setAchievementForm({ ...achievementForm, credentialId: event.target.value })} /></Field>
          <Field label="Verification URL (optional)"><input type="url" maxLength={300} value={achievementForm.credentialUrl} onChange={(event) => setAchievementForm({ ...achievementForm, credentialUrl: event.target.value })} placeholder="https://" /></Field>
          <Field label="Description" className="field-wide"><textarea maxLength={1200} rows="3" value={achievementForm.description} onChange={(event) => setAchievementForm({ ...achievementForm, description: event.target.value })} placeholder="Share what you learned or accomplished." /></Field>
          <Field label="Certificate (PDF, max 5 MB)" className="field-wide" hint={editingId && data.achievements.find((item) => item._id === editingId)?.certificateKey ? 'Leave empty to keep your current certificate.' : undefined}><input type="file" accept=".pdf,application/pdf" onChange={(event) => setAchievementForm({ ...achievementForm, file: event.target.files?.[0] || null })} /></Field>
          <div className="field-wide form-end"><button className="button button-primary" disabled={busy}>{editingId ? <Pencil size={14} /> : <Plus size={15} />}{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save achievement'}</button>{editingId && <button type="button" className="button button-secondary" onClick={() => { setEditingId(''); setAchievementForm({ title: '', category: 'certification', issuer: '', issueDate: '', credentialId: '', credentialUrl: '', description: '', file: null }); }}>Cancel edit</button>}</div>
        </form>
      </Panel>
      <p className="privacy-note"><ShieldCheck size={15} /> Only authorized faculty can verify a submitted certificate. The verification badge appears only after their approval.</p>
    </>
  );
}

function VerificationPage() {
  const { data, loading, error, refresh } = useLoad('/student/verifications');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={refresh} />;
  return (
    <>
      <PageHeader title="Faculty verification" description="Track submitted certificates, read faculty feedback and follow up on corrections." />
      <Panel title={`Verification requests · ${data.verifications.length}`}>
        {data.verifications.length === 0 ? <EmptyState icon={ClipboardCheck} title="No certificates have been submitted for verification." description="When you're ready, add an achievement and submit its certificate for faculty review." action={<Link to="/student/achievements" className="button button-secondary">Go to achievements <ArrowRight size={15} /></Link>} /> :
          <div className="verification-list">{data.verifications.map((item) => <article className="verification-item" key={item._id}><div className={`verification-icon state-${item.status}`}><ShieldCheck size={18} /></div><div className="verification-content"><div className="verification-title"><h3>{item.title}{item.status === 'verified' && <VerificationBadge />}</h3><StatusBadge status={item.status} /></div><p>{item.issuer || 'Issuer not specified'} · Submitted {formatDate(item.submittedAt)}</p>{item.feedback && <div className={`feedback-note ${item.status === 'rejected' ? 'feedback-rejected' : ''}`}><strong>Faculty feedback</strong><span>{item.feedback}</span></div>}<details className="history-details"><summary>View status history</summary><div>{item.history.map((event, index) => <p key={`${event._id || event.createdAt}-${index}`}><span>{formatCategory(event.action)}</span><time>{formatDate(event.createdAt)}</time>{event.feedback && <span>{event.feedback}</span>}</p>)}</div></details></div></article>)}</div>}
      </Panel>
    </>
  );
}

function AnalyzerPage() {
  const { data: historyData, loading, error, refresh } = useLoad('/student/resume/analyses');
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  async function analyze(event) {
    event.preventDefault();
    setBusy(true);
    setFailure('');
    setResult(null);
    const body = new FormData(event.currentTarget);
    try {
      const response = await api('/student/resume/analyze', { method: 'POST', body });
      setResult(response.analysis);
      await refresh();
    } catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="AI resume analyzer" description="See how your resume's evidence aligns with a role you're interested in." />
      <div className="privacy-note"><ShieldCheck size={16} /><span>Your resume is private. A sanitized text extract is sent to the configured AI provider only when you request analysis. Scanned PDFs aren't supported.</span></div>
      {!loading && historyData && !historyData.aiConfigured && <div className="notice notice-warning"><CircleHelp size={16} /> Cloudflare Workers AI is not configured. Add the Cloudflare account ID and API token to the server environment; no simulated results will be shown.</div>}
      {failure && <ErrorState message={failure} />}
      <div className="content-grid analyzer-grid">
        <Panel title="Compare against a job description">
          <form className="form-stack" onSubmit={analyze}>
            <Field label="Job title"><input name="jobTitle" required minLength={2} maxLength={120} placeholder="e.g. Frontend engineering intern" /></Field>
            <Field label="Job description" hint="Include responsibilities, required skills and qualifications."><textarea name="jobDescription" required minLength={100} maxLength={12000} rows="9" placeholder="Paste the job description here…" /></Field>
            <Field label="Resume PDF (optional)" hint="Leave empty to use your saved profile resume. Maximum 5 MB."><input name="file" type="file" accept=".pdf,application/pdf" /></Field>
            <button className="button button-primary" disabled={busy || (!historyData?.aiConfigured && !loading)}>{busy ? <><LoaderCircle className="spin" size={16} /> Analyzing evidence…</> : <><Sparkles size={16} /> Analyze resume</>}</button>
          </form>
        </Panel>
        <Panel title={result ? 'Analysis results' : 'What you’ll get'} className="result-panel">
          {result ? <AnalysisResult analysis={result} /> : <div className="analyzer-intro"><div className="resume-symbol"><FileSearch size={21} /></div><h3>Specific, evidence-led feedback.</h3><p>Your analysis will highlight matching skills, role requirements not yet evidenced and practical ways to improve your resume.</p><ul><li><CheckCircle2 size={16} /> Skills matched to the role</li><li><CheckCircle2 size={16} /> Relevant resume evidence</li><li><CheckCircle2 size={16} /> Useful next improvements</li></ul><span className="caption">The score estimates profile alignment; it is not a hiring probability.</span></div>}
        </Panel>
      </div>
      <Panel title="Analysis history" className="section-spaced">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={refresh} /> : historyData.analyses.length === 0 ? <EmptyState icon={FileSearch} title="Your previous resume analyses will appear here." description="Run an analysis to start building a useful history." /> : <div className="list-rows">{historyData.analyses.map((item) => <button className="list-row history-row" key={item._id} onClick={async () => { try { const response = await api(`/student/resume/analyses/${item._id}`); setResult(response.analysis); } catch (err) { setFailure(err.message); } }}><div className="row-icon"><FileSearch size={17} /></div><div className="row-main"><strong>{item.jobTitle}</strong><span>{formatDate(item.createdAt)}</span></div><span className="score-pill">{item.score}% match</span><ChevronRight size={16} /></button>)}</div>}
      </Panel>
    </>
  );
}

function AtsCheckerPage() {
  const { data: historyData, loading, error, refresh } = useLoad('/student/resume/ats-reviews');
  const [review, setReview] = useState(null);
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);

  async function checkResume(event) {
    event.preventDefault();
    setBusy(true);
    setFailure('');
    setReview(null);
    try {
      const response = await api('/student/resume/ats-check', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      });
      setReview(response.review);
      await refresh();
    } catch (requestError) {
      setFailure(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function openReview(id) {
    setFailure('');
    try {
      const response = await api(`/student/resume/ats-reviews/${id}`);
      setReview(response.review);
    } catch (requestError) {
      setFailure(requestError.message);
    }
  }

  const issues = review ? [...review.issues].sort((left, right) => (
    { high: 0, medium: 1, low: 2 }[left.priority] - { high: 0, medium: 1, low: 2 }[right.priority]
  )) : [];

  return (
    <>
      <PageHeader title="General ATS resume check" description="Review resume readability, structure, formatting signals, and wording for any profession—without needing a job description." />
      <div className="privacy-note"><ShieldCheck size={16} /><span>Your resume stays private. A sanitized text extract is sent to Cloudflare only when you request a check. This general review does not compare against a job posting.</span></div>
      {!loading && historyData && !historyData.aiConfigured && <div className="notice notice-warning"><CircleHelp size={16} /> Cloudflare Workers AI is not configured. Add the Cloudflare account ID and API token to the server environment.</div>}
      {failure && <ErrorState message={failure} />}
      <div className="content-grid analyzer-grid ats-checker-grid">
        <Panel title="Run a general resume check">
          <form className="form-stack" onSubmit={checkResume}>
            <Field label="Resume PDF" hint="Upload a PDF for this check, or leave empty to use your saved profile resume. Maximum 5 MB.">
              <input name="file" type="file" accept=".pdf,application/pdf" />
            </Field>
            <button className="button button-primary" disabled={busy || (!historyData?.aiConfigured && !loading)}>
              {busy ? <><LoaderCircle className="spin" size={16} /> Checking resume…</> : <><ClipboardCheck size={16} /> Check ATS readiness</>}
            </button>
          </form>
          <div className="ats-rubric">
            <h3>What the score checks</h3>
            <ul>
              <li>PDF text extraction and readable structure</li>
              <li>Common sections such as experience, education, and skills</li>
              <li>Scannable bullets, action-oriented wording, and specific outcomes</li>
              <li>Consistency signals available in extracted text</li>
            </ul>
          </div>
        </Panel>
        <Panel title={review ? 'ATS readiness report' : 'A role-neutral review'} className="result-panel">
          {review ? <AtsReviewResult review={review} issues={issues} /> : <div className="analyzer-intro">
            <div className="resume-symbol"><ClipboardCheck size={21} /></div>
            <h3>Detailed feedback, not a job-match score.</h3>
            <p>Get a general ATS-readiness estimate and a prioritized list of issues with practical fixes. It works across technical and non-technical resumes and does not require a job description.</p>
            <span className="caption">ATS platforms differ. This is an advisory checklist, not a guarantee that a resume will pass a particular employer’s system.</span>
          </div>}
        </Panel>
      </div>
      <Panel title="ATS check history" className="section-spaced">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={refresh} /> : !historyData?.reviews.length
          ? <EmptyState icon={ClipboardCheck} title="Your ATS checks will appear here." description="Run a general check to get a score breakdown and prioritized resume improvements." />
          : <div className="list-rows">{historyData.reviews.map((item) => <button className="list-row history-row" key={item._id} onClick={() => openReview(item._id)}>
            <div className="row-icon"><ClipboardCheck size={17} /></div>
            <div className="row-main"><strong>General ATS review</strong><span>{formatDate(item.createdAt)}</span></div>
            <span className="score-pill">{item.score}/100</span><ChevronRight size={16} />
          </button>)}</div>}
      </Panel>
    </>
  );
}

function AtsReviewResult({ review, issues }) {
  const priorityLabels = { high: 'High priority', medium: 'Medium priority', low: 'Polish' };
  return <div className="ats-review-results">
    <div className="score-row">
      <div className="score-circle" aria-label={`ATS readiness score ${review.score} out of 100`}><strong>{review.score}</strong><span>/ 100</span></div>
      <div><span className="eyebrow">GENERAL ATS READINESS</span><p>{review.summary}</p></div>
    </div>
    <p className="scoring-note">{review.limitations}</p>
    <h3>Score breakdown</h3>
    <div className="ats-dimensions">{review.dimensions.map((dimension) => <div className="ats-dimension" key={dimension.name}>
      <div><strong>{dimension.name}</strong><span>{dimension.score}/{dimension.max}</span></div>
      <progress max={dimension.max} value={dimension.score} aria-label={`${dimension.name}: ${dimension.score} of ${dimension.max}`} />
      <p>{dimension.detail}</p>
    </div>)}</div>
    <h3>Issues and improvements <span className="ats-issue-count">{issues.length}</span></h3>
    <div className="ats-issue-list">{issues.map((issue, index) => <article className={`ats-issue ats-issue-${issue.priority}`} key={`${issue.category}-${issue.title}-${index}`}>
      <div className="ats-issue-heading">
        <span className={`ats-priority ats-priority-${issue.priority}`}>{priorityLabels[issue.priority]}</span>
        <span className="ats-category">{formatCategory(issue.category)}</span>
      </div>
      <h4>{issue.title}</h4>
      <p>{issue.issue}</p>
      <div className="ats-recommendation"><strong>What to improve</strong><span>{issue.recommendation}</span></div>
      {issue.example && <div className="ats-example"><strong>Example</strong><span>{issue.example}</span></div>}
    </article>)}</div>
    <p className="caption">Suggested edits are advisory. Keep every claim accurate and only include results you can support.</p>
  </div>;
}

function AnalysisResult({ analysis }) {
  const result = analysis.result;
  return <div className="analysis-results"><div className="score-row"><div className="score-circle"><strong>{analysis.score}</strong><span>/ 100</span></div><div><span className="eyebrow">PROFILE ALIGNMENT ESTIMATE</span><h3>{analysis.jobTitle}</h3><p>{result.summary}</p></div></div><p className="scoring-note">{result.limitations}</p><h4>Skills in the job description</h4><div className="match-list">{result.requiredSkills.map((item, index) => <div className="match-item" key={`${item.name}-${index}`}><div><strong>{item.name}</strong><p>{item.evidence || (item.matched ? 'Evidence appears in your resume.' : 'Not mentioned in the resume; this does not mean you lack this skill.')}</p></div><span className={item.matched ? 'match-yes' : 'match-no'}>{item.matched ? 'Evidence found' : 'Not mentioned'}</span></div>)}</div>{result.responsibilities.length > 0 && <><h4>Relevant responsibilities</h4><div className="match-list">{result.responsibilities.map((item, index) => <div className="match-item" key={`${item.requirement}-${index}`}><div><strong>{item.requirement}</strong><p>{item.evidence || 'No supporting resume evidence was identified.'}</p></div><span className={item.demonstrated ? 'match-yes' : 'match-no'}>{item.demonstrated ? 'Demonstrated' : 'Insufficient evidence'}</span></div>)}</div></>}{result.qualifications?.length > 0 && <><h4>Qualifications</h4><div className="tag-list">{result.qualifications.map((item, index) => <span className="skill-chip" key={`${item.requirement}-${index}`}>{item.requirement} · {formatCategory(item.status)}</span>)}</div></>}{result.suggestions.length > 0 && <><h4>Resume improvements</h4><ul className="suggestion-list">{result.suggestions.map((item, index) => <li key={index}>{item}</li>)}</ul></>}{result.focusAreas.length > 0 && <><h4>Suggested focus areas</h4><ul className="suggestion-list">{result.focusAreas.map((item, index) => <li key={index}>{item}</li>)}</ul></>}<p className="caption">AI-generated advice may contain errors. Review each suggestion before using it.</p></div>;
}

function PortfolioPage() {
  const { data: portfolioData, loading, error, refresh } = useLoad('/student/portfolio');
  const { data: profileData } = useLoad('/student/profile');
  const [failure, setFailure] = useState('');
  const [message, setMessage] = useState('');
  const portfolio = portfolioData?.portfolio;
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={refresh} />;
  const publicUrl = portfolio ? `${window.location.origin}/portfolio/${portfolio.slug}` : '';

  async function generate() {
    setFailure('');
    try { await api('/student/portfolio/generate', json('POST', {})); setMessage('Your digital portfolio is live.'); await refresh(); }
    catch (err) { setFailure(err.message); }
  }

  async function changeSettings(updates) {
    setFailure('');
    setMessage('');
    try { await api('/student/portfolio/settings', json('PATCH', updates)); await refresh(); setMessage('Portfolio privacy settings saved.'); }
    catch (err) { setFailure(err.message); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); setMessage('Portfolio link copied.'); }
    catch { setFailure('Clipboard access is unavailable. Copy the portfolio URL directly.'); }
  }

  const missingFields = !profileData?.profile?.summary || !profileData?.profile?.skills?.length;
  return (
    <>
      <PageHeader title="Digital portfolio" description="Turn your saved profile into a simple, shareable showcase." />
      {message && <Notice>{message}</Notice>}{failure && <ErrorState message={failure} />}
      {!portfolio ? <Panel className="portfolio-empty-panel"><EmptyState icon={Globe2} title="Your portfolio is ready when you are." description={missingFields ? 'Add a professional summary and at least one skill before generating your portfolio.' : 'Generate a public portfolio that shares only your name, professional summary, skills, projects and selected achievements.'} action={<button className="button button-primary" disabled={missingFields} onClick={generate}><Globe2 size={16} /> Generate my digital portfolio</button>} /></Panel> :
        <>
          <Panel title="Your portfolio link" className="portfolio-link-panel">
            <div className="portfolio-live"><div className={`visibility-indicator ${portfolio.isPublic ? 'visible' : ''}`}><Globe2 size={18} /></div><div><strong>{portfolio.isPublic ? 'Your portfolio is public' : 'Your portfolio is private'}</strong><span>{portfolio.isPublic ? 'Anyone with your link can view the information you have chosen to share.' : 'Turn public visibility on when you’re ready to share your profile.'}</span></div></div>
            <div className="portfolio-url"><Link2 size={17} /><span>{publicUrl}</span><button className="icon-button" onClick={copyLink} aria-label="Copy portfolio link"><Copy size={17} /></button><a className="icon-button" href={portfolio.isPublic ? publicUrl : undefined} target="_blank" rel="noreferrer" aria-label="Open portfolio" aria-disabled={!portfolio.isPublic} onClick={(event) => !portfolio.isPublic && event.preventDefault()}><ExternalLink size={17} /></a></div>
          </Panel>
          <Panel title="Public information" className="section-spaced">
            <p className="panel-note">Your name, summary and links are displayed on the portfolio when it is public. Choose which skills, projects, achievements and academic details to share. Email, phone number, enrollment number and faculty feedback stay private. Resume downloads are off by default.</p>
            <SettingsToggle label="Make portfolio public" description="Allow anyone with the link to view your portfolio." checked={portfolio.isPublic} onChange={(value) => changeSettings({ isPublic: value })} />
            <SettingsToggle label="Show my skills" description="Display your self-reported skills on the public page." checked={portfolio.showSkills} onChange={(value) => changeSettings({ showSkills: value })} />
            <SettingsToggle label="Show my projects and experience" description="Display projects and internships saved in your profile." checked={portfolio.showProjects} onChange={(value) => changeSettings({ showProjects: value })} />
            <SettingsToggle label="Show achievements" description="Display achievement titles and faculty-approved verification badges." checked={portfolio.showAchievements} onChange={(value) => changeSettings({ showAchievements: value })} />
            <SettingsToggle label="Show my department" description="Display your department on the public page." checked={portfolio.showDepartment} onChange={(value) => changeSettings({ showDepartment: value })} />
            <SettingsToggle label="Show graduation year" description="Display your expected graduation year on the public page." checked={portfolio.showGraduationYear} onChange={(value) => changeSettings({ showGraduationYear: value })} />
            <SettingsToggle label="Enable resume download" description="Allow visitors with your public portfolio link to download your current resume." checked={portfolio.showResume} onChange={(value) => changeSettings({ showResume: value })} />
          </Panel>
          <div className="portfolio-action-row"><button className="button button-secondary" onClick={generate}><RefreshCw size={15} /> Update portfolio</button><button className="button button-danger-quiet" onClick={() => changeSettings({ isPublic: false })}><X size={15} /> Disable public access</button></div>
        </>}
    </>
  );
}

function SettingsToggle({ label, description, checked, onChange }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="toggle-switch" /></label>;
}

function PublicPortfolioPage() {
  const slug = window.location.pathname.split('/').filter(Boolean).at(-1);
  const { data, loading, error } = useLoad(`/public/portfolios/${encodeURIComponent(slug)}`);
  if (loading) return <div className="public-state"><LoadingState /></div>;
  if (error) return <div className="public-state"><EmptyState icon={Globe2} title="This portfolio is unavailable." description="It may have been taken offline or the link may have changed." /></div>;
  const { portfolio } = data;
  return <main className="public-portfolio"><nav className="public-nav"><div className="brand-mark"><GraduationCap size={21} /></div><strong>smartstudent <span>HUB</span></strong><span>STUDENT PORTFOLIO</span></nav><header className="public-hero"><div className="public-avatar">{portfolio.name.slice(0, 1).toUpperCase()}</div><p className="eyebrow">STUDENT PORTFOLIO</p><h1>{portfolio.name}</h1><p className="public-meta">{[portfolio.department, portfolio.graduationYear && `Class of ${portfolio.graduationYear}`].filter(Boolean).join(' · ')}</p><p className="public-summary">{portfolio.summary}</p><div className="public-links">{portfolio.links.github && <a href={portfolio.links.github} target="_blank" rel="noreferrer"><Github size={16} /> GitHub <ExternalLink size={14} /></a>}{portfolio.resumeAvailable && <a href={`/api/public/portfolios/${encodeURIComponent(slug)}/resume`}><ArrowDownToLine size={15} /> Download resume</a>}</div></header><section className="public-section"><h2>Skills</h2>{portfolio.skills.length ? <div className="skill-list">{portfolio.skills.map((skill, index) => <span className="skill-chip" key={`${skill.name}-${index}`}>{skill.name}</span>)}</div> : <p className="panel-note">No skills shared yet.</p>}</section>{portfolio.projects.length > 0 && <section className="public-section"><h2>Projects & experience</h2><div className="public-card-grid">{portfolio.projects.map((item, index) => <article className="project-card" key={`${item.title}-${index}`}><span className="eyebrow">{item.type === 'internship' ? 'EXPERIENCE' : 'PROJECT'}</span><h3>{item.title}</h3><p>{item.description}</p>{item.organization && <span className="caption">{item.organization}</span>}{item.technologies?.length > 0 && <div className="skill-list">{item.technologies.map((technology) => <span className="skill-chip" key={technology}>{technology}</span>)}</div>}<div className="project-links">{item.githubUrl && <a href={item.githubUrl} target="_blank" rel="noreferrer"><Github size={14} /> GitHub</a>}{item.demoUrl && <a href={item.demoUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Live demo</a>}</div></article>)}</div></section>}{portfolio.achievements.length > 0 && <section className="public-section"><h2>Achievements & certifications</h2><div className="list-rows">{portfolio.achievements.map((achievement, index) => <div className="list-row" key={`${achievement.title}-${index}`}><div className="row-icon"><Award size={17} /></div><div className="row-main"><strong>{achievement.title}{achievement.verified && <VerificationBadge />}</strong><span>{achievement.issuer || formatCategory(achievement.category)}</span></div>{achievement.verified && <span className="verified-copy"><ShieldCheck size={14} /> Verified by faculty</span>}</div>)}</div></section>}<footer className="public-footer">A student portfolio · Smart Student Hub</footer></main>;
}

function NotificationsPage() {
  const { data, loading, error, refresh, setData } = useLoad('/student/notifications');
  const navigate = useNavigate();
  const [failure, setFailure] = useState('');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={refresh} />;

  async function markRead(notification) {
    if (!notification.readAt) {
      try {
        const { notification: updated } = await api(`/student/notifications/${notification._id}/read`, { method: 'PATCH' });
        const unreadCount = Math.max(0, data.unreadCount - 1);
        setData({ ...data, notifications: data.notifications.map((item) => item._id === updated._id ? updated : item), unreadCount });
        window.dispatchEvent(new CustomEvent('ssh:unread-count', { detail: unreadCount }));
      } catch (err) { setFailure(err.message); return; }
    }
    if (notification.route) navigate(notification.route);
  }

  async function markAll() {
    try { await api('/student/notifications/read-all', { method: 'PATCH' }); setData({ ...data, notifications: data.notifications.map((item) => ({ ...item, readAt: item.readAt || new Date() })), unreadCount: 0 }); window.dispatchEvent(new CustomEvent('ssh:unread-count', { detail: 0 })); }
    catch (err) { setFailure(err.message); }
  }

  return <><PageHeader title="Notifications" description="Updates about your profile, resume and verification requests." action={data.unreadCount > 0 && <button className="button button-secondary" onClick={markAll}><Check size={15} /> Mark all as read</button>} />{failure && <ErrorState message={failure} />}<Panel title={`${data.unreadCount} unread`} >{data.notifications.length === 0 ? <EmptyState icon={Bell} title="No notifications yet." description="Updates about your profile and verification requests will appear here." /> : <div className="notification-list">{data.notifications.map((item) => <button key={item._id} className={`notification-item ${item.readAt ? 'notification-read' : ''}`} onClick={() => markRead(item)}><span className="notification-icon"><Bell size={17} /></span><span className="notification-copy"><strong>{item.title}</strong><span>{item.message}</span><time>{formatDateTime(item.createdAt)}</time></span>{!item.readAt && <i className="unread-dot" />}{item.route && <ChevronRight size={17} />}</button>)}</div>}</Panel></>;
}

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { data, loading, error, refresh } = useLoad('/student/portfolio');
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} retry={refresh} />;

  async function changePassword(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setFailure('');
    try { const result = await api('/auth/password', json('PUT', password)); setMessage(result.message); setPassword({ currentPassword: '', newPassword: '' }); }
    catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  }

  async function togglePrivacy(value) {
    setFailure('');
    setMessage('');
    try { await api('/student/portfolio/settings', json('PATCH', { isPublic: value })); await refresh(); setMessage(`Portfolio visibility is ${value ? 'on' : 'off'}.`); }
    catch (err) { setFailure(err.message); }
  }

  async function logout() {
    try { await signOut(); navigate('/login'); }
    catch (err) { setFailure(err.message); }
  }

  return <><PageHeader title="Settings" description="Account access, privacy and your profile visibility." />{message && <Notice>{message}</Notice>}{failure && <ErrorState message={failure} />}<Panel title="Account" className="settings-panel"><div className="account-summary"><ProfileAvatar name={user?.name} className="avatar" /><div><strong>{user?.name}</strong><span>{user?.email}</span><small>Student account</small></div></div><form className="password-form" onSubmit={changePassword}><h3>Change password</h3><div className="form-grid"><Field label="Current password"><input type="password" autoComplete="current-password" required minLength={1} maxLength={72} value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} /></Field><Field label="New password"><input type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} /><small>10–72 UTF-8 bytes. Changing your password signs out other active sessions.</small></Field></div><button className="button button-secondary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form></Panel><Panel title="Privacy" className="settings-panel"><p className="panel-note">Your portfolio is the only information visible to people with its public link. Enrollment identifiers, phone number, private email, faculty feedback and private certificates are never shown on it.</p>{data.portfolio ? <SettingsToggle label="Public portfolio" description="Make your student portfolio visible to anyone with the link." checked={data.portfolio.isPublic} onChange={togglePrivacy} /> : <div className="settings-empty"><Globe2 size={17} /><span>You have not generated a digital portfolio.</span><Link className="text-button" to="/student/portfolio">Manage portfolio <ArrowRight size={14} /></Link></div>}</Panel><Panel title="Session" className="settings-panel"><p className="panel-note">Sign out of this browser. Your private profile and documents remain protected.</p><button className="button button-danger-quiet" onClick={logout}><X size={15} /> Sign out</button></Panel></>;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatCategory(value = '') {
  return value.split(/[-_]/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export const studentRoutes = [
  { path: 'dashboard', element: <Dashboard /> },
  { path: 'profile', element: <ProfilePage /> },
  { path: 'achievements', element: <AchievementsPage /> },
  { path: 'verification', element: <VerificationPage /> },
  { path: 'resume-analyzer', element: <AnalyzerPage /> },
  { path: 'ats-checker', element: <AtsCheckerPage /> },
  { path: 'portfolio', element: <PortfolioPage /> },
  { path: 'notifications', element: <NotificationsPage /> },
  { path: 'settings', element: <SettingsPage /> },
];

export { PublicPortfolioPage };
