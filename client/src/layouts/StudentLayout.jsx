import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BriefcaseBusiness, CircleUserRound, ClipboardCheck, FileSearch, FolderKanban,
  GraduationCap, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, UserRound, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ProfileAvatar } from '../components/ProfileAvatar';

const items = [
  { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/student/profile', label: 'My profile', icon: UserRound },
  { to: '/student/achievements', label: 'Skills & achievements', icon: FolderKanban },
  { to: '/student/verification', label: 'Faculty verification', icon: ShieldCheck },
  { to: '/student/resume-analyzer', label: 'AI resume analyzer', icon: FileSearch },
  { to: '/student/ats-checker', label: 'General ATS check', icon: ClipboardCheck },
  { to: '/student/portfolio', label: 'Digital portfolio', icon: BriefcaseBusiness },
  { to: '/student/notifications', label: 'Notifications', icon: Bell, count: true },
];

export function StudentLayout() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadError, setUnreadError] = useState(false);
  const [portalMenuOpen, setPortalMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const otherRoles = (user?.roles || []).filter((role) => role !== 'student');
  const roleLabels = {
    faculty: 'Faculty Portal',
    recruiter: 'Recruiter Portal',
    'placement-officer': 'Placement Officer Portal',
    admin: 'Admin Portal',
  };

  useEffect(() => {
    api('/student/notifications')
      .then((data) => setUnread(data.unreadCount))
      .catch(() => setUnreadError(true));
    function handleUnreadChange(event) {
      setUnread(event.detail);
    }
    window.addEventListener('ssh:unread-count', handleUnreadChange);
    return () => window.removeEventListener('ssh:unread-count', handleUnreadChange);
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      window.alert(error.message);
    }
  }

  function closeDrawer() {
    setOpen(false);
  }

  return (
    <div className="app-shell">
      {open && <button className="drawer-scrim" aria-label="Close navigation" onClick={closeDrawer} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={22} /></div>
          <div><strong>smartstudent</strong><small>HUB</small></div>
          <button className="icon-button mobile-close" aria-label="Close menu" onClick={closeDrawer}><X size={19} /></button>
        </div>
        <div className="portal-label">CURRENT PORTAL</div>
        {otherRoles.length > 0 ? <div className="portal-switcher-wrap">
          <button className="portal-switcher" aria-expanded={portalMenuOpen} onClick={() => setPortalMenuOpen(!portalMenuOpen)}><span className="portal-dot" /> Student Portal <span className="portal-menu-hint">Switch portal</span></button>
          {portalMenuOpen && <div className="portal-menu"><strong>Portals available to you</strong><span className="portal-option portal-option-current">Student Portal <span>Current</span></span>{otherRoles.map((role) => <span className="portal-option portal-option-disabled" key={role}>{roleLabels[role] || role} <span>Not available yet</span></span>)}</div>}
        </div> : <div className="portal-switcher"><span className="portal-dot" /> Student Portal</div>}
        <nav className="side-nav" aria-label="Student portal navigation">
          <div className="nav-group-label">WORKSPACE</div>
          {items.map(({ to, label, icon: Icon, count }) => (
            <NavLink key={to} to={to} onClick={closeDrawer} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{count && unread > 0 && <span className="nav-count">{unread}</span>}
            </NavLink>
          ))}
          <div className="nav-group-label nav-group-spaced">ACCOUNT</div>
          <NavLink to="/student/settings" onClick={closeDrawer} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
            <Settings size={18} strokeWidth={1.8} /><span>Settings</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleUserRound size={17} /></div><strong>Your next opportunity<br />starts with your profile.</strong><span>Keep it current and show your best work.</span></div>
          <button className="profile-menu" onClick={handleSignOut}>
            <ProfileAvatar name={user?.name} className="avatar" />
            <div className="profile-menu-text"><strong>{user?.name || 'Student'}</strong><span>{user?.email}</span></div>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb">Student Portal <span>/</span> <strong>{items.find((item) => item.to === location.pathname)?.label || (location.pathname.endsWith('settings') ? 'Settings' : 'Workspace')}</strong></div>
          <div className="topbar-right">
            {unreadError && <span className="caption" role="alert">Notifications unavailable</span>}
            <button className="top-icon" aria-label="Notifications" onClick={() => navigate('/student/notifications')}><Bell size={19} />{unread > 0 && <i />}</button>
            <div className="topbar-user"><ProfileAvatar name={user?.name} className="avatar avatar-small" /><span>{user?.name?.split(' ')[0]}</span></div>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
}
