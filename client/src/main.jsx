import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudentLayout } from './layouts/StudentLayout';
import { AuthPage } from './pages/AuthPage';
import { PublicPortfolioPage, studentRoutes } from './pages/StudentPages';
import { LoadingState } from './components/common';
import './styles.css';

function ProtectedStudent() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.roles.includes('student')) return <main className="access-denied"><h1>Portal not available</h1><p>This account does not have access to the Student Portal.</p></main>;
  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage register />} />
          <Route path="/portfolio/:slug" element={<PublicPortfolioPage />} />
          <Route element={<ProtectedStudent />}>
            <Route path="/student" element={<StudentLayout />}>
              {studentRoutes.map(({ path, element }) => <Route key={path} path={path} element={element} />)}
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/student/dashboard" replace />} />
          <Route path="*" element={<main className="access-denied"><h1>Page not found</h1><a href="/student/dashboard">Return to your dashboard</a></main>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
