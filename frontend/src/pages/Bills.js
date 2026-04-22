import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash, Gear, Pencil, WhatsappLogo, DownloadSimple, ChatCircleDots } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';
import { TAX_CATEGORIES } from '../lib/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Bills = () => {
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [rateConfig, setRateConfig] = useState({ rate_per_bigha: 100, katha_to_bigha_ratio: 20, category: TAX_CATEGORIES[0] });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  
  const [formData, setFormData] = useState({
    consumer_id: '',
    land_used_bigha: 0,
    land_used_katha: 0,
    billing_period: '',
    category: TAX_CATEGORIES[0]
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
      // Initialize rate config with the first category's data
      if (configRes.data) {
        const initialConfig = Array.isArray(configRes.data) 
          ? configRes.data.find(c => c.category === TAX_CATEGORIES[0]) || configRes.data[0]
          : configRes.data;
        setRateConfig(initialConfig);
      }
    } catch (error) {
      toast.error('Failed to fetch data. Please login again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- NEW: Fetch specific rate when category changes in Rate Config Dialog ---
  const handleCategoryChangeInConfig = async (newCategory) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/rate-config?category=${newCategory}`, { withCredentials: true });
      // If backend returns a specific config for this category, use it; else reset to default
      setRateConfig({
        rate_per_bigha: data.rate_per_bigha || 100,
        katha_to_bigha_ratio: data.katha_to_bigha_ratio || 20,
        category: newCategory
      });
    } catch (error) {
      setRateConfig(prev => ({ ...prev, category: newCategory }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
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
      // Re-posting with the updated formData (which now holds the correct category)
      await axios.delete(`${API_URL}/api/bills/${editingBill.id}`, { withCredentials: true });
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success('Bill updated');
      setEditDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error) {
      toast.error('Failed to update bill');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bill?')) return;
    try {
      await axios.delete(`${API_URL}/api/bills/${id}`, { withCredentials: true });
      toast.success('Bill deleted');
      await fetchData();
    } catch (error) {
      toast.error('Failed to delete bill');
    }
  };

  const handleRateUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/rate-config`, rateConfig, { withCredentials: true });
      toast.success(`Rate for ${rateConfig.category.toUpperCase()} Updated`);
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
      billing_period: bill.billing_period,
      category: bill.category // This ensures the dropdown pre-selects the bill's saved category
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      consumer_id: '',
      land_used_bigha: 0,
      land_used_katha: 0,
      billing_period: '',
      category: TAX_CATEGORIES[0]
    });
  };

  const handleSendSMS = async (bill) => {
    const load = toast.loading("Sending SMS...");
    try {
      await axios.post(`${API_URL}/api/sms/send-bill`, {
        consumer_id: bill.consumer_id,
        land_area: `${bill.total_land_in_bigha} Bigha`,
        amount: bill.amount,
        period: bill.billing_period,
        category: bill.category
      }, { withCredentials: true });
      toast.success("SMS Sent!", { id: load });
    } catch (e) { toast.error("SMS Failed", { id: load }); }
  };

  const sendWhatsApp = (bill) => {
    const consumer = consumers.find(c => c.id === bill.consumer_id);
    const msg = `নমস্কার ${bill.consumer_name}, আপনার বিল।\nবিভাগ: ${bill.category.toUpperCase()}\nপরিমাণ: ₹${bill.amount}`;
    window.open(`https://wa.me/91${consumer?.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleExport = (format) => {
    const headers = ['Consumer', 'Category', 'Period', 'Land', 'Amount', 'Due'];
    const rows = bills.map(b => [b.consumer_name, b.category, b.billing_period, b.total_land_in_bigha, b.amount, b.due]);
    format === 'csv' ? exportToCSV(rows, headers, 'bills.csv') : exportToPDF(rows, headers, 'Bills Report', 'bills.pdf');
  };

  if (loading) return <div className="flex justify-center p-8">Loading Bills...</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Bills</h1>
          <p className="text-sm text-muted-foreground">{bills.length} total bills</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><DownloadSimple size={16}/></Button>
          
          {/* RATE CONFIG DIALOG */}
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 w-10 p-0"><Gear size={20} /></Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-xl">
              <DialogHeader><DialogTitle>Rate Settings</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4">
                <div>
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Select Category to Configure</Label>
                  <select 
                    value={rateConfig.category} 
                    onChange={(e) => handleCategoryChangeInConfig(e.target.value)}
                    className="w-full h-11 border rounded-md px-3 bg-white mt-1"
                  >
                    {TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Rate per Bigha (₹)</Label>
                  <Input type="number" step="0.01" value={rateConfig.rate_per_bigha} onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: parseFloat(e.target.value)})} />
                </div>
                <div>
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Katha to Bigha Ratio</Label>
                  <Input type="number" step="0.01" value={rateConfig.katha_to_bigha_ratio} onChange={(e) => setRateConfig({...rateConfig, katha_to_bigha_ratio: parseFloat(e.target.value)})} />
                </div>
                <Button type="submit" className="w-full h-11 bg-primary text-white">Save {rateConfig.category.toUpperCase()} Rate</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-full h-10 w-10 p-0 bg-primary text-white"><Plus size={24} /></Button>
        </div>
      </div>

      {/* CREATE BILL DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-xl">
          <DialogHeader><DialogTitle>Create New Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs uppercase">Select Farmer</Label>
              <Select onValueChange={(val) => setFormData({...formData, consumer_id: val})}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Farmer Name" /></SelectTrigger>
                <SelectContent>{consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
                <Label className="text-xs uppercase">Billing Period</Label>
                <Input placeholder="e.g. Boro 2026" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs uppercase">Bigha</Label>
                <Input type="number" step="0.01" placeholder="0" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Label className="text-xs uppercase">Katha</Label>
                <Input type="number" step="0.01" placeholder="0" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 bg-primary text-white">Generate Bill</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT BILL DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-xl">
          <DialogHeader><DialogTitle>Edit Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <Label className="text-xs uppercase">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
                <Label className="text-xs uppercase">Billing Period</Label>
                <Input value={formData.billing_period} onChange={(e) => setFormData({...formData, billing_period: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
               <div>
                <Label className="text-xs uppercase">Bigha</Label>
                <Input type="number" step="0.01" value={formData.land_used_bigha} onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
               </div>
               <div>
                <Label className="text-xs uppercase">Katha</Label>
                <Input type="number" step="0.01" value={formData.land_used_katha} onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
               </div>
            </div>
            <Button type="submit" className="w-full h-11 bg-primary text-white">Update Bill</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* BILL LISTING */}
      <div className="space-y-3">
        {bills.map((bill, idx) => (
          <div key={bill.id} className="bg-card border p-4 rounded-xl shadow-sm border-border">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full uppercase font-extrabold tracking-widest border border-blue-100">
                  {bill.category ? bill.category.replace(/_/g, ' ') : 'Tax'}
                </span>
                <h3 className="font-heading text-lg font-light mt-1">{bill.consumer_name}</h3>
                <p className="text-xs text-muted-foreground">{bill.billing_period}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleSendSMS(bill)} className="text-blue-600 hover:bg-blue-50"><ChatCircleDots size={20} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => sendWhatsApp(bill)} className="text-green-600 hover:bg-green-50"><WhatsappLogo size={20} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(bill)} className="hover:bg-slate-100"><Pencil size={18}/></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(bill.id)} className="text-destructive hover:bg-red-50"><Trash size={18}/></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border text-sm">
              <div><p className="text-muted-foreground text-xs uppercase font-bold">Land / Amount</p><p className="font-medium">{bill.total_land_in_bigha} Bigha / ₹{bill.amount.toFixed(0)}</p></div>
              <div><p className="text-muted-foreground text-xs uppercase font-bold">Paid / Due</p><p><span className="text-green-600 font-bold">₹{bill.paid.toFixed(0)}</span> / <span className="text-destructive font-bold">₹{bill.due.toFixed(0)}</span></p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Bills;
