import { useState } from 'react';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, FormError } from '../components/common';

export function AuthPage({ register = false }) {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/student/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(form, register);
      navigate('/student/dashboard', { replace: true });
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
        <p className="auth-switch">{register ? 'Already have an account?' : 'New to Smart Student Hub?'} <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</Link></p>
      </section>
      <p className="auth-footer">Your information is protected and only shared when you choose.</p>
    </main>
  );
}
