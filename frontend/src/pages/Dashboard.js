import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Drop, Users, FileText, CurrencyDollar, Warning } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total_consumers: 0,
    total_bills: 0,
    total_amount: 0,
    total_paid: 0,
    total_due: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/dashboard/stats`, {
        withCredentials: true
      });
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Consumers',
      value: stats.total_consumers,
      icon: Users,
      color: 'bg-primary/10 text-primary',
      testId: 'total-consumers-card'
    },
    {
      title: 'Bills',
      value: stats.total_bills,
      icon: FileText,
      color: 'bg-accent/10 text-accent',
      testId: 'total-bills-card'
    },
    {
      title: 'Total Amount',
      value: `₹${stats.total_amount.toFixed(0)}`,
      icon: CurrencyDollar,
      color: 'bg-primary/10 text-primary',
      testId: 'total-amount-card'
    },
    {
      title: 'Paid',
      value: `₹${stats.total_paid.toFixed(0)}`,
      icon: Drop,
      color: 'bg-green-100 text-green-700',
      testId: 'total-paid-card'
    },
    {
      title: 'Due',
      value: `₹${stats.total_due.toFixed(0)}`,
      icon: Warning,
      color: 'bg-destructive/10 text-destructive',
      testId: 'total-due-card'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-card border border-border p-4 rounded-xl"
              data-testid={card.testId}
            >
              <div className="space-y-2">
                <div className={`inline-flex p-2 rounded-lg ${card.color}`}>
                  <Icon size={20} weight="duotone" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="text-xl font-heading font-light mt-1">{card.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border p-5 rounded-xl">
        <h2 className="font-heading text-xl font-light tracking-tight mb-4">
          Quick Actions
        </h2>
        <div className="space-y-2">
          <a
            href="/consumers"
            className="flex items-center gap-3 p-4 border border-border rounded-lg active:bg-muted"
            data-testid="quick-action-consumers"
          >
            <div className="bg-primary/10 p-2 rounded-lg">
              <Users size={22} className="text-primary" weight="duotone" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading text-base font-light">Manage Consumers</h3>
              <p className="text-xs text-muted-foreground">Add or edit consumer records</p>
            </div>
          </a>
          <a
            href="/bills"
            className="flex items-center gap-3 p-4 border border-border rounded-lg active:bg-muted"
            data-testid="quick-action-bills"
          >
            <div className="bg-accent/10 p-2 rounded-lg">
              <FileText size={22} className="text-accent" weight="duotone" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading text-base font-light">Generate Bills</h3>
              <p className="text-xs text-muted-foreground">Create and manage water bills</p>
            </div>
          </a>
          <a
            href="/payments"
            className="flex items-center gap-3 p-4 border border-border rounded-lg active:bg-muted"
            data-testid="quick-action-payments"
          >
            <div className="bg-primary/10 p-2 rounded-lg">
              <CurrencyDollar size={22} className="text-primary" weight="duotone" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading text-base font-light">Record Payments</h3>
              <p className="text-xs text-muted-foreground">Add payment entries</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;