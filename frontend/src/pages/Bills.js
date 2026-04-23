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
  ChatCircleDots,
  FileCsv,
  FilePdf
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';
import { TAX_CATEGORIES } from '../lib/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Bills = () => {
  // --- STATE ---
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [rateConfig, setRateConfig] = useState({ 
    rate_per_bigha: 100, 
    rate_per_katha: 5, 
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

  // --- DATA FETCHING ---
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

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- RATE CONFIG LOGIC ---
  const handleCategorySwitchInConfig = async (cat) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/rate-config?category=${cat}`, { withCredentials: true });
      setRateConfig(data);
    } catch (e) {
      setRateConfig({ rate_per_bigha: 100, rate_per_katha: 5, katha_to_bigha_ratio: 20, category: cat });
    }
  };

  const handleRateUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/rate-config`, rateConfig, { withCredentials: true });
      toast.success(`Rates for ${rateConfig.category.toUpperCase()} saved`);
      setRateDialogOpen(false);
    } catch (e) { toast.error('Failed to save rate settings.'); }
  };

  // --- ACTIONS ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success('Bill generated');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e) { toast.error('Check all fields'); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/bills/${editingBill.id}`, formData, { withCredentials: true });
      toast.success('Bill updated');
      setEditDialogOpen(false);
      fetchData();
    } catch (e) { toast.error('Update failed'); }
  };

  const openEditDialog = (bill) => {
    setEditingBill(bill);
    setFormData({
      consumer_id: bill.consumer_id,
      land_used_bigha: bill.land_used_bigha,
      land_used_katha: bill.land_used_katha,
      billing_period: bill.billing_period,
      category: bill.category
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ consumer_id: '', land_used_bigha: 0, land_used_katha: 0, billing_period: '', category: TAX_CATEGORIES[0] });
  };

  // --- EXPORT LOGIC ---
  const handleExport = (format) => {
    const headers = ['Farmer', 'Category', 'Period', 'Land', 'Amount', 'Paid', 'Due'];
    const rows = bills.map(b => [
      b.consumer_name,
      (b.category || 'Tax').toUpperCase(),
      b.billing_period,
      `${b.total_land_in_bigha} Bigha`,
      b.amount.toFixed(0),
      b.paid.toFixed(0),
      b.due.toFixed(0)
    ]);
    const date = new Date().toLocaleDateString().replace(/\//g, '-');
    if (format === 'csv') {
      exportToCSV(rows, headers, `Water_Bills_${date}.csv`);
    } else {
      exportToPDF(rows, headers, 'Water Billing Report', `Water_Bills_${date}.pdf`);
    }
    toast.success(`${format.toUpperCase()} Downloaded`);
  };

  // --- NOTIFICATIONS ---
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
      toast.success("SMS Sent", { id: load });
    } catch (e) { toast.error("SMS Failed", { id: load }); }
  };

  if (loading) return <div className="flex justify-center p-12">Syncing billing database...</div>;

  return (
    <div className="space-y-4 p-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Bills</h1>
          <p className="text-sm text-muted-foreground">{bills.length} billing records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="h-10 border-slate-200">
            <FileCsv size={18} className="mr-1 text-green-600" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="h-10 border-slate-200">
            <FilePdf size={18} className="mr-1 text-red-600" /> PDF
          </Button>
          
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 w-10 p-0"><Gear size={20}/></Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl max-w-md">
              <DialogHeader><DialogTitle>Category Pricing</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4">
                <select className="w-full h-11 border rounded-md px-3 bg-white" value={rateConfig.category} onChange={(e) => handleCategorySwitchInConfig(e.target.value)}>
                  {TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Rate / Bigha</Label>
                    <Input type="number" step="0.01" value={rateConfig.rate_per_bigha} onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: parseFloat(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Rate / Katha</Label>
                    <Input type="number" step="0.01" value={rateConfig.rate_per_katha} onChange={(e) => setRateConfig({...rateConfig, rate_per_katha: parseFloat(e.target.value)})} />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 bg-primary text-white font-bold uppercase tracking-widest text-xs">Save Settings</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-full h-10 w-10 p-0 bg-primary shadow-lg">
            <Plus size={24} color="white" />
          </Button>
        </div>
      </div>

      {/* BILL LISTING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bills.map((bill) => (
          <div key={bill.id} className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full uppercase font-black tracking-widest border border-blue-100">
                  {bill.category ? bill.category.replace(/_/g, ' ') : 'WATER TAX'}
                </span>
                <h3 className="text-xl font-medium mt-2">{bill.consumer_name}</h3>
                <p className="text-xs text-muted-foreground">{bill.billing_period}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleSendSMS(bill)} className="text-blue-600 hover:bg-blue-50"><ChatCircleDots size={22} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(bill)}><Pencil size={20}/></Button>
                <Button variant="ghost" size="sm" onClick={() => axios.delete(`${API_URL}/api/bills/${bill.id}`, {withCredentials:true}).then(() => fetchData())} className="text-destructive hover:bg-red-50"><Trash size={20}/></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border">
              <div><p className="text-muted-foreground text-[10px] uppercase font-bold">Land / Total</p><p className="text-sm">{bill.total_land_in_bigha} B / ₹{bill.amount.toFixed(0)}</p></div>
              <div className="text-right"><p className="text-muted-foreground text-[10px] uppercase font-bold text-right">Balance</p><p className="text-sm text-destructive font-black text-right">₹{bill.due.toFixed(0)} DUE</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* DIALOGS (CREATE & EDIT) - Similar structures, using the category-pre-load logic */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>New Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <Select onValueChange={(val) => setFormData({...formData, consumer_id: val})} required>
              <SelectTrigger className="h-12"><SelectValue placeholder="Select Farmer" /></SelectTrigger>
              <SelectContent>{consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Period" className="h-12" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} required />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" step="0.01" className="h-12" placeholder="Bigha" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
              <Input type="number" step="0.01" className="h-12" placeholder="Katha" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
            </div>
            <Button type="submit" className="w-full h-12 bg-primary text-white font-bold shadow-lg">Save Record</Button>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* EDIT MODAL (Identical structure to create, ensures pre-population) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>Update Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
              <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={formData.billing_period} className="h-12" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" step="0.01" value={formData.land_used_bigha} className="h-12" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
              <Input type="number" step="0.01" value={formData.land_used_katha} className="h-12" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
            </div>
            <Button type="submit" className="w-full h-12 bg-primary text-white font-bold">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bills;
