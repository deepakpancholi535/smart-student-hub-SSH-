import { useState } from 'react';
import { Github, GraduationCap, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, FormError } from '../components/common';

export function AuthPage({ register = false }) {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.roles.includes('faculty') && !user.roles.includes('student') ? '/faculty' : '/student/dashboard'} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const signedInUser = await signIn(form, register);
      navigate(signedInUser?.roles?.includes('faculty') && !signedInUser.roles.includes('student') ? '/faculty' : '/student/dashboard', { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand"><div className="brand-mark"><GraduationCap size={22} /></div><strong>smartstudent <span>HUB</span></strong></div>
      <section className="auth-card">
        <div className="auth-icon"><ShieldCheck size={21} /></div>
        <p className="eyebrow">STUDENT PORTAL</p>
        <h1>{register ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-description">{register ? 'Start building your academic profile and career portfolio.' : 'Sign in to continue to your student hub.'}</p>
        <form onSubmit={submit} className="form-stack">
          {register && <Field label="Full name"><input autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your full name" /></Field>}
          <Field label="College email"><input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@college.edu" /></Field>
          <Field label="Password" hint={register ? 'Use 10–72 characters.' : undefined}><input type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={10} maxLength={72} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="10–72 characters" /></Field>
          <FormError>{error}</FormError>
          <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
        </form>
        <div className="auth-divider"><span>or continue with</span></div>
        <div className="oauth-buttons" aria-label="OAuth sign-in options">
          <button type="button" className="oauth-button" disabled title="Google sign-in is coming soon">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.73 7.18l7.64 5.93c4.46-4.12 7.13-10.2 7.13-17.58Z" /><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.54 2.56 10.78l7.97-6.19Z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.87l-7.64-5.93c-2.12 1.42-4.84 2.27-8.26 2.27-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" /></svg>
            <span>Google</span>
          </button>
          <button type="button" className="oauth-button" disabled title="GitHub sign-in is coming soon">
            <Github size={18} aria-hidden="true" />
            <span>GitHub</span>
          </button>
        </div>
        <p className="oauth-coming-soon">OAuth sign-in is coming soon.</p>
        <p className="auth-switch">{register ? 'Already have an account?' : 'New to Smart Student Hub?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      </section>
      <p className="auth-footer">Your information is protected and only shared when you choose.</p>
    </main>
  );
}
