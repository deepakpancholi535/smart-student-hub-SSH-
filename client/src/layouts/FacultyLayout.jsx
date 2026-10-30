import { useState } from 'react';
import { ClipboardCheck, GraduationCap, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function FacultyLayout({ children }) {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try { await signOut(); window.location.assign('/login'); } finally { setBusy(false); }
  }
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><GraduationCap size={22} /></div><div><strong>smartstudent</strong><small>HUB</small></div></div><div className="portal-label">CURRENT PORTAL</div><div className="portal-switcher"><span className="portal-dot" /> Faculty Portal</div><nav className="side-nav"><div className="nav-group-label">WORKSPACE</div><div className="nav-link nav-link-active"><ClipboardCheck size={18} /><span>Verification requests</span></div></nav><div className="sidebar-bottom"><button className="profile-menu" disabled={busy} onClick={logout}><div className="profile-menu-text"><strong>{user?.name}</strong><span>{user?.email}</span></div><LogOut size={16} /></button></div></aside><main className="main-area"><header className="topbar"><div className="breadcrumb">Faculty Portal <span>/</span> <strong>Verification requests</strong></div></header><div className="page-content">{children}</div></main></div>;
}
