import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash, Gear, Pencil, WhatsappLogo } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Bills = () => {
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [rateConfig, setRateConfig] = useState({ rate_per_bigha: 100, katha_to_bigha_ratio: 20 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [formData, setFormData] = useState({
    consumer_id: '',
    land_used_bigha: 0,
    land_used_katha: 0,
    billing_period: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [billsRes, consumersRes, configRes] = await Promise.all([
        axios.get(`${API_URL}/api/bills`, { withCredentials: true }),
        axios.get(`${API_URL}/api/consumers`, { withCredentials: true }),
        axios.get(`${API_URL}/api/rate-config`, { withCredentials: true })
      ]);
      setBills(billsRes.data.items || billsRes.data);
      setConsumers(consumersRes.data.items || consumersRes.data);
      setRateConfig(configRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, {
        withCredentials: true
      });
      toast.success('Bill created');
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error) {
      toast.error('Failed to create bill');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      // Delete old bill and create new one with updated values
      await axios.delete(`${API_URL}/api/bills/${editingBill.id}`, {
        withCredentials: true
      });
      await axios.post(`${API_URL}/api/bills`, formData, {
        withCredentials: true
      });
      toast.success('Bill updated');
      setEditDialogOpen(false);
      setEditingBill(null);
      resetForm();
      await fetchData();
    } catch (error) {
      toast.error('Failed to update bill');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bill?')) return;
    try {
      await axios.delete(`${API_URL}/api/bills/${id}`, {
        withCredentials: true
      });
      toast.success('Bill deleted');
      await fetchData();
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
      toast.success('Rate updated');
      setRateDialogOpen(false);
      await fetchData();
    } catch (error) {
      toast.error('Failed to update rate');
    }
  };

  const openEditDialog = (bill) => {
    setEditingBill(bill);
    setFormData({
      consumer_id: bill.consumer_id,
      land_used_bigha: bill.land_used_bigha,
      land_used_katha: bill.land_used_katha,
      billing_period: bill.billing_period
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      consumer_id: '',
      land_used_bigha: 0,
      land_used_katha: 0,
      billing_period: ''
    });
  };

  const sendWhatsAppBill = (bill) => {
    const consumer = consumers.find(c => c.id === bill.consumer_id);
    if (!consumer) {
      toast.error('Consumer not found');
      return;
    }
    const message = `নমস্কার ${bill.consumer_name},\n\n*জলের বিল - ${bill.billing_period}*\n\nজমি ব্যবহৃত: ${bill.total_land_in_bigha} বিঘা\nমোট পরিমাণ: ₹${bill.amount.toFixed(0)}\nপরিশোধিত: ₹${bill.paid.toFixed(0)}\nবকেয়া: ₹${bill.due.toFixed(0)}\n\nদয়া করে যত তাড়াতাড়ি সম্ভব আপনার বকেয়া পরিশোধ করুন।\n\nধন্যবাদ!\n\n---\n\nHello ${bill.consumer_name},\n\n*Water Bill - ${bill.billing_period}*\n\nLand Used: ${bill.total_land_in_bigha} Bigha\nTotal Amount: ₹${bill.amount.toFixed(0)}\nPaid: ₹${bill.paid.toFixed(0)}\nDue: ₹${bill.due.toFixed(0)}\n\nPlease pay your dues at the earliest.\n\nThank you!`;
    const whatsappUrl = `https://wa.me/91${consumer.phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-4" data-testid="bills-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">
            Bills
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{bills.length} total bills</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 w-10 p-0" data-testid="configure-rate-button">
                <Gear size={20} />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-xl" data-testid="rate-dialog">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl font-light">Rate Config</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-3">
                <div>
                  <Label htmlFor="rate_per_bigha" className="text-xs uppercase tracking-wider">
                    Rate per Bigha (₹)
                  </Label>
                  <Input
                    id="rate_per_bigha"
                    type="number"
                    step="0.01"
                    value={rateConfig.rate_per_bigha}
                    onChange={(e) => setRateConfig({ ...rateConfig, rate_per_bigha: parseFloat(e.target.value) || 0 })}
                    required
                    className="h-11"
                    data-testid="rate-per-bigha-input"
                  />
                </div>
                <div>
                  <Label htmlFor="katha_ratio" className="text-xs uppercase tracking-wider">
                    Katha to Bigha Ratio
                  </Label>
                  <Input
                    id="katha_ratio"
                    type="number"
                    step="0.01"
                    value={rateConfig.katha_to_bigha_ratio}
                    onChange={(e) => setRateConfig({ ...rateConfig, katha_to_bigha_ratio: parseFloat(e.target.value) || 0 })}
                    required
                    className="h-11"
                    data-testid="katha-ratio-input"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    1 Bigha = {rateConfig.katha_to_bigha_ratio} Katha
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRateDialogOpen(false)}
                    className="flex-1 h-11"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 h-11 bg-primary hover:bg-[#152B23]" data-testid="rate-submit-button">
                    Update
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
                className="bg-primary hover:bg-[#152B23] text-primary-foreground h-10 w-10 p-0 rounded-full"
                data-testid="add-bill-button"
              >
                <Plus size={24} weight="bold" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-xl" data-testid="bill-dialog">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl font-light">Create Bill</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="consumer" className="text-xs uppercase tracking-wider">Consumer</Label>
                  <Select
                    value={formData.consumer_id}
                    onValueChange={(value) => setFormData({ ...formData, consumer_id: value })}
                    required
                  >
                    <SelectTrigger className="h-11" data-testid="bill-consumer-select">
                      <SelectValue placeholder="Select consumer" />
                    </SelectTrigger>
                    <SelectContent>
                      {consumers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bigha" className="text-xs uppercase tracking-wider">Bigha</Label>
                    <Input
                      id="bigha"
                      type="number"
                      step="0.01"
                      value={formData.land_used_bigha}
                      onChange={(e) => setFormData({ ...formData, land_used_bigha: parseFloat(e.target.value) || 0 })}
                      className="h-11"
                      data-testid="bill-bigha-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="katha" className="text-xs uppercase tracking-wider">Katha</Label>
                    <Input
                      id="katha"
                      type="number"
                      step="0.01"
                      value={formData.land_used_katha}
                      onChange={(e) => setFormData({ ...formData, land_used_katha: parseFloat(e.target.value) || 0 })}
                      className="h-11"
                      data-testid="bill-katha-input"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="period" className="text-xs uppercase tracking-wider">Period</Label>
                  <Input
                    id="period"
                    value={formData.billing_period}
                    onChange={(e) => setFormData({ ...formData, billing_period: e.target.value })}
                    placeholder="e.g., Jan 2026"
                    required
                    className="h-11"
                    data-testid="bill-period-input"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                    className="flex-1 h-11"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 h-11 bg-primary hover:bg-[#152B23]" data-testid="bill-submit-button">
                    Create
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Bill Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-[90vw] rounded-xl">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl font-light">Edit Bill</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEdit} className="space-y-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider">Consumer</Label>
                  <div className="text-sm py-2">{editingBill?.consumer_name}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit_bigha" className="text-xs uppercase tracking-wider">Bigha</Label>
                    <Input
                      id="edit_bigha"
                      type="number"
                      step="0.01"
                      value={formData.land_used_bigha}
                      onChange={(e) => setFormData({ ...formData, land_used_bigha: parseFloat(e.target.value) || 0 })}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_katha" className="text-xs uppercase tracking-wider">Katha</Label>
                    <Input
                      id="edit_katha"
                      type="number"
                      step="0.01"
                      value={formData.land_used_katha}
                      onChange={(e) => setFormData({ ...formData, land_used_katha: parseFloat(e.target.value) || 0 })}
                      className="h-11"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit_period" className="text-xs uppercase tracking-wider">Period</Label>
                  <Input
                    id="edit_period"
                    value={formData.billing_period}
                    onChange={(e) => setFormData({ ...formData, billing_period: e.target.value })}
                    required
                    className="h-11"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditDialogOpen(false);
                      setEditingBill(null);
                      resetForm();
                    }}
                    className="flex-1 h-11"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 h-11 bg-primary hover:bg-[#152B23]">
                    Update
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <p className="text-muted-foreground text-sm">No bills yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill, idx) => (
            <div
              key={bill.id}
              className="bg-card border border-border p-4 rounded-xl"
              data-testid={`bill-row-${idx}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-heading text-lg font-light">{bill.consumer_name}</h3>
                  <p className="text-sm text-muted-foreground">{bill.billing_period}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => sendWhatsAppBill(bill)}
                    className="h-9 w-9 p-0 text-green-600 hover:text-green-600"
                    data-testid={`whatsapp-bill-${idx}`}
                  >
                    <WhatsappLogo size={20} weight="fill" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(bill)}
                    className="h-9 w-9 p-0"
                    data-testid={`edit-bill-${idx}`}
                  >
                    <Pencil size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(bill.id)}
                    className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                    data-testid={`delete-bill-${idx}`}
                  >
                    <Trash size={18} />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Land</p>
                  <p className="font-medium">{bill.total_land_in_bigha} Bigha</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-medium">₹{bill.amount.toFixed(0)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-medium text-green-600">₹{bill.paid.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due</p>
                  <p className="font-medium text-destructive">₹{bill.due.toFixed(0)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Bills;
