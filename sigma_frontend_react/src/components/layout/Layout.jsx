import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Home, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Bell,
  User,
  Shield
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // Navigation items
  const navigationItems = [
    {
      name: 'Tableau de bord',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: location.pathname === '/dashboard'
    },
    {
      name: 'Leads',
      href: '/leads',
      icon: Users,
      current: location.pathname === '/leads'
    },
    {
      name: 'Biens',
      href: '/biens',
      icon: Home,
      current: location.pathname === '/biens'
    }
  ];

  // Ajouter l'item admin si l'utilisateur est admin
  if (isAdmin()) {
    navigationItems.push({
      name: 'Administration',
      href: '/admin',
      icon: Shield,
      current: location.pathname === '/admin'
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar mobile */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <Sidebar 
            navigationItems={navigationItems} 
            onClose={() => setSidebarOpen(false)}
            isMobile={true}
          />
        </div>
      </div>

      {/* Sidebar desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <Sidebar navigationItems={navigationItems} />
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden -m-2.5 p-2.5 text-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Search bar (placeholder) */}
            <div className="flex-1 max-w-lg mx-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-gray-500">
                <Bell className="h-6 w-6" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" />
              </button>

              {/* User menu */}
              <div className="relative">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {user?.first_name?.[0]}{user?.last_name?.[0]}
                      </span>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="text-sm font-medium text-gray-900">
                      {user?.first_name} {user?.last_name}
                    </div>
                    <div className="text-sm text-gray-500">{user?.email}</div>
                  </div>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-500"
                title="Se déconnecter"
              >
                <LogOut className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Composant Sidebar
const Sidebar = ({ navigationItems, onClose, isMobile = false }) => {
  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center justify-between">
        <div className="flex items-center">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">Σ</span>
          </div>
          <span className="ml-3 text-xl font-bold text-gray-900">
            Sigma Matching
          </span>
        </div>
        {isMobile && (
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigationItems.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    onClick={isMobile ? onClose : undefined}
                    className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors ${
                      item.current
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon
                      className={`h-6 w-6 shrink-0 ${
                        item.current ? 'text-blue-700' : 'text-gray-400 group-hover:text-blue-700'
                      }`}
                    />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>

          {/* Settings section */}
          <li className="mt-auto">
            <Link
              to="/profile"
              className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-blue-700"
            >
              <User className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-blue-700" />
              Profil
            </Link>
            <Link
              to="/settings"
              className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-blue-700"
            >
              <Settings className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-blue-700" />
              Paramètres
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Layout;

