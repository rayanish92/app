import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Users, 
  FileText, 
  CurrencyInr, 
  CheckCircle, 
  WarningCircle, 
  ArrowsClockwise 
} from '@phosphor-icons/react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_consumers: 0,
    total_bills: 0,
    total_amount: 0,
    total_paid: 0,
    total_due: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/api/dashboard/stats`, {
        withCredentials: true
      });
      
      // Ensure we are setting the data exactly as the backend sends it
      setStats({
        total_consumers: data.total_consumers || 0,
        total_bills: data.total_bills || 0,
        total_amount: data.total_amount || 0,
        total_paid: data.total_paid || 0,
        total_due: data.total_due || 0
      });
    } catch (error) {
      console.error("Dashboard Error:", error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = [
    {
      title: "Total Consumers",
      value: stats.total_consumers,
      icon: <Users size={24} weight="light" />,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      title: "Total Bills",
      value: stats.total_bills,
      icon: <FileText size={24} weight="light" />,
      color: "text-purple-600",
      bg: "bg-purple-50"
    },
    {
      title: "Total Amount",
      value: `₹${stats.total_amount.toLocaleString()}`,
      icon: <CurrencyInr size={24} weight="light" />,
      color: "text-slate-700",
      bg: "bg-slate-50"
    },
    {
      title: "Collected",
      value: `₹${stats.total_paid.toLocaleString()}`,
      icon: <CheckCircle size={24} weight="light" />,
      color: "text-green-600",
      bg: "bg-green-50"
    },
    {
      title: "Pending Dues",
      value: `₹${stats.total_due.toLocaleString()}`,
      icon: <WarningCircle size={24} weight="light" />,
      color: "text-destructive",
      bg: "bg-red-50"
    }
  ];

  if (loading && stats.total_consumers === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="animate-spin text-primary">
          <ArrowsClockwise size={32} />
        </div>
        <p className="text-sm text-muted-foreground font-light">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your water management system
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchStats}
          disabled={loading}
          className="h-10 px-4"
        >
          <ArrowsClockwise size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, idx) => (
          <Card key={idx} className="border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                {card.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-heading font-light tracking-tight">
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="mt-8 p-6 bg-primary/5 rounded-2xl border border-primary/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div>
            <h3 className="font-medium text-primary">Billing Efficiency</h3>
            <p className="text-sm text-muted-foreground">
              You have collected {stats.total_amount > 0 
                ? ((stats.total_paid / stats.total_amount) * 100).toFixed(1) 
                : 0}% of total billed amounts.
            </p>
          </div>
          <div className="h-2 w-full md:w-64 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-1000" 
              style={{ width: `${stats.total_amount > 0 ? (stats.total_paid / stats.total_amount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
