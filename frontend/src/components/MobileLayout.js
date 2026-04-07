import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Drop, ChartLine, Users, FileText, CurrencyDollar, ChatCircleText, SignOut } from '@phosphor-icons/react';

const MobileLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: ChartLine },
    { path: '/consumers', label: 'Consumers', icon: Users },
    { path: '/bills', label: 'Bills', icon: FileText },
    { path: '/payments', label: 'Payments', icon: CurrencyDollar },
    { path: '/sms', label: 'SMS', icon: ChatCircleText }
  ];

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="layout">
      {/* Mobile Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Drop size={28} className="text-primary" weight="duotone" />
              <div>
                <h1 className="font-heading text-lg font-light tracking-tight leading-none">
                  Water Tracker
                </h1>
                <p className="text-xs text-muted-foreground" data-testid="user-name">{user?.name}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground h-9 w-9 p-0"
              data-testid="logout-button"
            >
              <SignOut size={22} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-inset-bottom" style={{ zIndex: 99999 }} data-testid="bottom-nav">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default MobileLayout;