import { AlertCircle, Check, LoaderCircle } from 'lucide-react';

export function PageHeader({ eyebrow = 'STUDENT PORTAL', title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && <div className="panel-heading">{title && <h2>{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <div className="empty-icon"><Icon size={20} /></div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Loading your information…' }) {
  return <div className="state-message"><LoaderCircle className="spin" size={18} /> {label}</div>;
}

export function ErrorState({ message, retry }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && <button className="text-button" onClick={retry}>Try again</button>}
    </div>
  );
}

export function Notice({ children, kind = 'success' }) {
  return <div className={`notice notice-${kind}`} role="status">{kind === 'success' && <Check size={16} />}{children}</div>;
}

export function StatusBadge({ status }) {
  const map = {
    draft: ['Draft', 'status-neutral'],
    pending: ['Pending verification', 'status-pending'],
    verified: ['Verified', 'status-verified'],
    'needs-correction': ['Needs correction', 'status-pending'],
    rejected: ['Rejected', 'status-rejected'],
  };
  const [label, className] = map[status] || [status, 'status-neutral'];
  return <span className={`status-badge ${className}`}>{status === 'verified' && <Check size={13} />}{label}</span>;
}

export function VerificationBadge() {
  return <span className="verified-mark" title="Verified by faculty" aria-label="Verified by faculty"><Check size={12} /></span>;
}

export function Field({ label, children, hint, className = '' }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function FormError({ children }) {
  return children ? <p className="form-error" role="alert">{children}</p> : null;
}
