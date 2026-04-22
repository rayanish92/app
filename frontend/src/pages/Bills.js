import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Plus, 
  Trash, 
  Gear, 
  Pencil, 
  WhatsappLogo, 
  DownloadSimple, 
  ChatCircleDots 
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';
import { TAX_CATEGORIES } from '../lib/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Bills = () => {
  // --- 1. STATE MANAGEMENT ---
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [rateConfig, setRateConfig] = useState({ 
    rate_per_bigha: 100, 
    katha_to_bigha_ratio: 20, 
    category: TAX_CATEGORIES[0] 
  });
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

  // --- 2. DATA FETCHING ---
  const fetchData = useCallback(async () => {
    try {
      const [billsRes, consumersRes, configRes] = await Promise.all([
        axios.get(`${API_URL}/api/bills`, { withCredentials: true }),
        axios.get(`${API_URL}/api/consumers`, { withCredentials: true }),
        axios.get(`${API_URL}/api/rate-config?category=${TAX_CATEGORIES[0]}`, { withCredentials: true })
      ]);
      setBills(billsRes.data.items || billsRes.data);
      setConsumers(consumersRes.data.items || consumersRes.data);
      if (configRes.data) setRateConfig(configRes.data);
    } catch (error) {
      toast.error('Session expired. Please login again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- 3. RATE CONFIG LOGIC (FIXED) ---
  const handleCategorySwitchInConfig = async (cat) => {
    try {
      // Fetches the saved rate for the specific category you just selected
      const { data } = await axios.get(`${API_URL}/api/rate-config?category=${cat}`, { withCredentials: true });
      setRateConfig(data);
    } catch (e) {
      // Default values if category is not yet set in DB
      setRateConfig({ rate_per_bigha: 100, katha_to_bigha_ratio: 20, category: cat });
    }
  };

  const handleRateUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/rate-config`, rateConfig, { withCredentials: true });
      toast.success(`Rate for ${rateConfig.category.toUpperCase()} updated!`);
      setRateDialogOpen(false);
    } catch (e) {
      toast.error('Failed to save rate settings.');
    }
  };

  // --- 4. BILL ACTIONS (CREATE, EDIT, DELETE) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success('Bill created successfully');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e) {
      toast.error('Error creating bill.');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/bills/${editingBill.id}`, formData, { withCredentials: true });
      toast.success('Bill updated');
      setEditDialogOpen(false);
      fetchData();
    } catch (e) {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;
    try {
      await axios.delete(`${API_URL}/api/bills/${id}`, { withCredentials: true });
      toast.success('Bill deleted');
      fetchData();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const openEditDialog = (bill) => {
    setEditingBill(bill);
    setFormData({
      consumer_id: bill.consumer_id,
      land_used_bigha: bill.land_used_bigha,
      land_used_katha: bill.land_used_katha,
      billing_period: bill.billing_period,
      category: bill.category // Pre-loads the saved category
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ 
      consumer_id: '', 
      land_used_bigha: 0, 
      land_used_katha: 0, 
      billing_period: '', 
      category: rateConfig.category || TAX_CATEGORIES[0] 
    });
  };

  // --- 5. NOTIFICATIONS & EXPORT ---
  const handleSendSMS = async (bill) => {
    const load = toast.loading("Sending Bilingual SMS...");
    try {
      await axios.post(`${API_URL}/api/sms/send-bill`, {
        consumer_id: bill.consumer_id,
        land_area: `${bill.total_land_in_bigha} Bigha`,
        amount: bill.amount,
        period: bill.billing_period,
        category: bill.category
      }, { withCredentials: true });
      toast.success("SMS Sent to Farmer!", { id: load });
    } catch (e) {
      toast.error("SMS Gateway Error", { id: load });
    }
  };

  const sendWhatsApp = (bill) => {
    const consumer = consumers.find(c => c.id === bill.consumer_id);
    const msg = `*Water Bill Request*\n\nFarmer: ${bill.consumer_name}\nCategory: ${bill.category.toUpperCase()}\nPeriod: ${bill.billing_period}\nAmount Due: ₹${bill.amount}\n\nPlease pay soon.`;
    window.open(`https://wa.me/91${consumer?.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleExport = (format) => {
    const headers = ['Farmer', 'Category', 'Period', 'Land (Bigha)', 'Total Amount', 'Due'];
    const rows = bills.map(b => [
        b.consumer_name, 
        b.category.toUpperCase(), 
        b.billing_period, 
        b.total_land_in_bigha, 
        b.amount, 
        b.due
    ]);
    format === 'csv' 
        ? exportToCSV(rows, headers, 'bills_report.csv') 
        : exportToPDF(rows, headers, 'Water Billing Report', 'bills_report.pdf');
  };

  // --- 6. RENDER ---
  if (loading) return <div className="flex justify-center p-12 text-muted-foreground">Loading Billing Data...</div>;

  return (
    <div className="space-y-4 p-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Bills</h1>
          <p className="text-sm text-muted-foreground">{bills.length} active bills found</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="h-10 px-3">
            <DownloadSimple size={16} className="mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="h-10 px-3">
            <DownloadSimple size={16} className="mr-1" /> PDF
          </Button>
          
          {/* RATE CONFIG BUTTON */}
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 w-10 p-0"><Gear size={20}/></Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl max-w-md">
              <DialogHeader><DialogTitle>Configure Rates</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold">Crop Category</Label>
                  <select 
                    className="w-full h-11 border rounded-md px-3 bg-white focus:ring-2 focus:ring-primary"
                    value={rateConfig.category} 
                    onChange={(e) => handleCategorySwitchInConfig(e.target.value)}
                  >
                    {TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold">Rate per Bigha (₹)</Label>
                  <Input 
                    type="number" 
                    value={rateConfig.rate_per_bigha} 
                    onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: parseFloat(e.target.value)})} 
                  />
                </div>
                <Button type="submit" className="w-full h-11 bg-primary text-white">Save {rateConfig.category.toUpperCase()} Rate</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-full h-10 w-10 p-0 bg-primary text-white shadow-lg">
            <Plus size={24} />
          </Button>
        </div>
      </div>

      {/* BILL LISTING CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {bills.length === 0 ? (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-2xl text-muted-foreground">
                No bills generated yet. Click the + button to start.
            </div>
        ) : (
          bills.map((bill) => (
            <div key={bill.id} className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full uppercase font-black tracking-widest border border-blue-100">
                    {bill.category ? bill.category.replace(/_/g, ' ') : 'WATER TAX'}
                  </span>
                  <h3 className="text-xl font-medium mt-2 leading-tight">{bill.consumer_name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-1 uppercase">{bill.billing_period}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleSendSMS(bill)} className="text-blue-600 hover:bg-blue-50"><ChatCircleDots size={22} weight="fill"/></Button>
                  <Button variant="ghost" size="sm" onClick={() => sendWhatsApp(bill)} className="text-green-600 hover:bg-green-50"><WhatsappLogo size={22} weight="fill"/></Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(bill)}><Pencil size={20}/></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(bill.id)} className="text-destructive hover:bg-red-50"><Trash size={20}/></Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border">
                <div>
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Land / Bill</p>
                  <p className="font-medium text-sm">{bill.total_land_in_bigha} Bigha / <span className="text-slate-900">₹{bill.amount.toFixed(0)}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Status</p>
                  <p className="text-sm">
                    <span className="text-green-600 font-bold">₹{bill.paid.toFixed(0)} Paid</span>
                    <span className="mx-1">/</span>
                    <span className="text-destructive font-bold">₹{bill.due.toFixed(0)} Due</span>
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE BILL DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-light">Generate New Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Farmer</Label>
              <Select onValueChange={(val) => setFormData({...formData, consumer_id: val})} required>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select a Farmer" /></SelectTrigger>
                <SelectContent>{consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Bill Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Period</Label>
                <Input placeholder="e.g. Boro 2026" className="h-12" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Bigha</Label>
                <Input type="number" step="0.01" className="h-12" placeholder="0.00" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Katha</Label>
                <Input type="number" step="0.01" className="h-12" placeholder="0.00" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 bg-primary text-white font-bold mt-2">Create & Save Bill</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT BILL DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-light">Modify Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Billing Period</Label>
                <Input value={formData.billing_period} className="h-12" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Bigha</Label>
                <Input type="number" step="0.01" value={formData.land_used_bigha} className="h-12" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
               </div>
               <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Katha</Label>
                <Input type="number" step="0.01" value={formData.land_used_katha} className="h-12" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
               </div>
            </div>
            <Button type="submit" className="w-full h-12 bg-primary text-white font-bold">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bills;
