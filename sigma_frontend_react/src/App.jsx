import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import BiensPage from './pages/BiensPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import LoadingSpinner from './components/ui/LoadingSpinner';
import './App.css';

// Composant pour protéger les routes authentifiées
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

// Composant pour protéger les routes admin
const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Composant principal de l'application
function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Route d'authentification */}
          <Route 
            path="/auth" 
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage />
            } 
          />

          {/* Routes protégées */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Redirection par défaut vers le dashboard */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            {/* Pages principales */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="biens" element={<BiensPage />} />
            <Route path="profile" element={<ProfilePage />} />
            
            {/* Page admin */}
            <Route 
              path="admin" 
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              } 
            />
          </Route>

          {/* Route 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* Notifications toast */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              theme: {
                primary: '#4aed88',
              },
            },
            error: {
              duration: 5000,
              theme: {
                primary: '#f56565',
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

// Composant racine avec le provider d'authentification
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

