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
      title: 'Total Consumers',
      value: stats.total_consumers,
      icon: Users,
      color: 'text-primary',
      testId: 'total-consumers-card'
    },
    {
      title: 'Total Bills',
      value: stats.total_bills,
      icon: FileText,
      color: 'text-accent',
      testId: 'total-bills-card'
    },
    {
      title: 'Total Amount',
      value: `₹${stats.total_amount.toFixed(2)}`,
      icon: CurrencyDollar,
      color: 'text-primary',
      testId: 'total-amount-card'
    },
    {
      title: 'Total Paid',
      value: `₹${stats.total_paid.toFixed(2)}`,
      icon: Drop,
      color: 'text-green-600',
      testId: 'total-paid-card'
    },
    {
      title: 'Total Due',
      value: `₹${stats.total_due.toFixed(2)}`,
      icon: Warning,
      color: 'text-destructive',
      testId: 'total-due-card'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="font-heading text-4xl sm:text-5xl font-light tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-card border border-border p-6 rounded-md hover:-translate-y-px transition-transform"
              data-testid={card.testId}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="text-2xl font-heading font-light">{card.value}</p>
                </div>
                <Icon size={24} className={card.color} weight="duotone" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border p-8 rounded-md">
        <h2 className="font-heading text-2xl sm:text-3xl font-light tracking-tight mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/consumers"
            className="p-6 border border-border rounded-md hover:border-primary hover:-translate-y-px transition-all"
            data-testid="quick-action-consumers"
          >
            <Users size={32} className="text-primary mb-3" weight="duotone" />
            <h3 className="font-heading text-lg font-light mb-1">Manage Consumers</h3>
            <p className="text-sm text-muted-foreground">Add, edit, or delete consumer records</p>
          </a>
          <a
            href="/bills"
            className="p-6 border border-border rounded-md hover:border-accent hover:-translate-y-px transition-all"
            data-testid="quick-action-bills"
          >
            <FileText size={32} className="text-accent mb-3" weight="duotone" />
            <h3 className="font-heading text-lg font-light mb-1">Generate Bills</h3>
            <p className="text-sm text-muted-foreground">Create and manage water bills</p>
          </a>
          <a
            href="/payments"
            className="p-6 border border-border rounded-md hover:border-primary hover:-translate-y-px transition-all"
            data-testid="quick-action-payments"
          >
            <CurrencyDollar size={32} className="text-primary mb-3" weight="duotone" />
            <h3 className="font-heading text-lg font-light mb-1">Record Payments</h3>
            <p className="text-sm text-muted-foreground">Add payment entries and view history</p>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;