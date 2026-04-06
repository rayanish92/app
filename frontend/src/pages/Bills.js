import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Bills = () => {
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [rateConfig, setRateConfig] = useState({ rate_per_bigha: 100, katha_to_bigha_ratio: 20 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    consumer_id: '',
    land_used_bigha: 0,
    land_used_katha: 0,
    billing_period: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [billsRes, consumersRes, configRes] = await Promise.all([
        axios.get(`${API_URL}/api/bills`, { withCredentials: true }),
        axios.get(`${API_URL}/api/consumers`, { withCredentials: true }),
        axios.get(`${API_URL}/api/rate-config`, { withCredentials: true })
      ]);
      setBills(billsRes.data);
      setConsumers(consumersRes.data);
      setRateConfig(configRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, {
        withCredentials: true
      });
      toast.success('Bill created successfully');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to create bill');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;
    try {
      await axios.delete(`${API_URL}/api/bills/${id}`, {
        withCredentials: true
      });
      toast.success('Bill deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete bill');
    }
  };

  const handleRateUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/rate-config`, rateConfig, {
        withCredentials: true
      });
      toast.success('Rate configuration updated');
      setRateDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update rate');
    }
  };

  const resetForm = () => {
    setFormData({
      consumer_id: '',
      land_used_bigha: 0,
      land_used_katha: 0,
      billing_period: ''
    });
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="bills-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl sm:text-5xl font-light tracking-tight text-foreground">
            Bills
          </h1>
          <p className="mt-2 text-muted-foreground">{bills.length} total bills</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="configure-rate-button">
                Configure Rate
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="rate-dialog">
              <DialogHeader>
                <DialogTitle className="font-heading text-2xl font-light">Rate Configuration</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="rate_per_bigha" className="text-xs uppercase tracking-[0.2em]">
                    Rate per Bigha (₹)
                  </Label>
                  <Input
                    id="rate_per_bigha"
                    type="number"
                    step="0.01"
                    value={rateConfig.rate_per_bigha}
                    onChange={(e) => setRateConfig({ ...rateConfig, rate_per_bigha: parseFloat(e.target.value) || 0 })}
                    required
                    data-testid="rate-per-bigha-input"
                  />
                </div>
                <div>
                  <Label htmlFor="katha_ratio" className="text-xs uppercase tracking-[0.2em]">
                    Katha to Bigha Ratio
                  </Label>
                  <Input
                    id="katha_ratio"
                    type="number"
                    step="0.01"
                    value={rateConfig.katha_to_bigha_ratio}
                    onChange={(e) => setRateConfig({ ...rateConfig, katha_to_bigha_ratio: parseFloat(e.target.value) || 0 })}
                    required
                    data-testid="katha-ratio-input"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    1 Bigha = {rateConfig.katha_to_bigha_ratio} Katha
                  </p>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRateDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-primary hover:bg-[#152B23]" data-testid="rate-submit-button">
                    Update Rate
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm();
                  setDialogOpen(true);
                }}
                className="bg-primary hover:bg-[#152B23] text-primary-foreground"
                data-testid="add-bill-button"
              >
                <Plus size={20} weight="bold" className="mr-2" />
                Create Bill
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="bill-dialog">
              <DialogHeader>
                <DialogTitle className="font-heading text-2xl font-light">Create New Bill</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="consumer" className="text-xs uppercase tracking-[0.2em]">Consumer</Label>
                  <Select
                    value={formData.consumer_id}
                    onValueChange={(value) => setFormData({ ...formData, consumer_id: value })}
                    required
                  >
                    <SelectTrigger data-testid="bill-consumer-select">
                      <SelectValue placeholder="Select consumer" />
                    </SelectTrigger>
                    <SelectContent>
                      {consumers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} - {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bigha" className="text-xs uppercase tracking-[0.2em]">Land Used (Bigha)</Label>
                    <Input
                      id="bigha"
                      type="number"
                      step="0.01"
                      value={formData.land_used_bigha}
                      onChange={(e) => setFormData({ ...formData, land_used_bigha: parseFloat(e.target.value) || 0 })}
                      data-testid="bill-bigha-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="katha" className="text-xs uppercase tracking-[0.2em]">Land Used (Katha)</Label>
                    <Input
                      id="katha"
                      type="number"
                      step="0.01"
                      value={formData.land_used_katha}
                      onChange={(e) => setFormData({ ...formData, land_used_katha: parseFloat(e.target.value) || 0 })}
                      data-testid="bill-katha-input"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="period" className="text-xs uppercase tracking-[0.2em]">Billing Period</Label>
                  <Input
                    id="period"
                    value={formData.billing_period}
                    onChange={(e) => setFormData({ ...formData, billing_period: e.target.value })}
                    placeholder="e.g., Jan 2026"
                    required
                    data-testid="bill-period-input"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-primary hover:bg-[#152B23]" data-testid="bill-submit-button">
                    Create Bill
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-md">
          <p className="text-muted-foreground">No bills yet. Create your first bill to get started.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="w-full" data-testid="bills-table">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Consumer</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Period</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Land (Bigha)</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Amount</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Paid</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Due</th>
                <th className="text-right p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill, idx) => (
                <tr key={bill.id} className="border-b border-border last:border-0" data-testid={`bill-row-${idx}`}>
                  <td className="p-4">{bill.consumer_name}</td>
                  <td className="p-4">{bill.billing_period}</td>
                  <td className="p-4">{bill.total_land_in_bigha}</td>
                  <td className="p-4">₹{bill.amount.toFixed(2)}</td>
                  <td className="p-4 text-green-600">₹{bill.paid.toFixed(2)}</td>
                  <td className="p-4 text-destructive">₹{bill.due.toFixed(2)}</td>
                  <td className="p-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(bill.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`delete-bill-${idx}`}
                    >
                      <Trash size={18} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Bills;