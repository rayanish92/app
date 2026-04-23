import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Drop, ChartLine, Users, FileText, CurrencyDollar, ChatCircleText, SignOut } from '@phosphor-icons/react';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: ChartLine },
    { path: '/farmers', label: 'farmers', icon: Users },
    { path: '/bills', label: 'Bills', icon: FileText },
    { path: '/payments', label: 'Payments', icon: CurrencyDollar },
    { path: '/sms', label: 'SMS', icon: ChatCircleText }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="layout">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Drop size={32} className="text-primary" weight="duotone" />
              <h1 className="font-heading text-xl font-light tracking-tight">
                Water Bill Tracker
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground" data-testid="user-name">{user?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
                data-testid="logout-button"
              >
                <SignOut size={20} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          <aside className="w-48 flex-shrink-0" data-testid="sidebar">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    data-testid={`nav-${item.label.toLowerCase()}`}
                  >
                    <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
