import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Drop, ChartLine, Users, FileText, CurrencyInr, SignOut, UserCircle, WifiSlash, ArrowsClockwise } from '@phosphor-icons/react';
import { toast } from 'sonner';
import axios from 'axios';
import { getQueue, syncQueue } from '../lib/offlineQueue';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MobileLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingOps, setPendingOps] = useState(getQueue().length);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      handleSync();
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Check pending queue periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingOps(getQueue().length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;
    setSyncing(true);
    try {
      const result = await syncQueue(axios, API_URL);
      setPendingOps(getQueue().length);
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} pending operation(s)`);
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} operation(s) failed to sync`);
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: ChartLine },
    { path: '/farmers', label: 'Farmers', icon: Users },
    { path: '/bills', label: 'Bills', icon: FileText },
    { path: '/payments', label: 'Payments', icon: CurrencyInr },
    ...(user?.role === 'admin' ? [{ path: '/users', label: 'Users', icon: UserCircle }] : [])
  ];

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="layout">
      {/* Offline / Sync Banner */}
      {(isOffline || pendingOps > 0) && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between ${isOffline ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`} data-testid="offline-banner">
          <div className="flex items-center gap-2">
            {isOffline && <WifiSlash size={16} weight="bold" />}
            <span>
              {isOffline ? 'You are offline' : ''}
              {pendingOps > 0 && `${isOffline ? ' — ' : ''}${pendingOps} pending operation(s)`}
            </span>
          </div>
          {pendingOps > 0 && !isOffline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="h-7 px-2 text-xs"
              data-testid="sync-button"
            >
              <ArrowsClockwise size={14} className={syncing ? 'animate-spin' : ''} />
              <span className="ml-1">{syncing ? 'Syncing...' : 'Sync'}</span>
            </Button>
          )}
        </div>
      )}

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
        <div className={`grid h-16 ${user?.role === 'admin' ? 'grid-cols-5' : 'grid-cols-4'}`}>
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
