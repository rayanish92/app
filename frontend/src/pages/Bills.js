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
  // --- 1. STATE MANAGEMENT ---
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

  // --- 3. RATE CONFIG LOGIC (WITH RATIO & CATEGORY LOOKUP) ---
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
      toast.success(`Rates & Ratio for ${rateConfig.category.toUpperCase()} saved`);
      setRateDialogOpen(false);
    } catch (e) {
      toast.error('Failed to save rate configuration.');
    }
  };

  // --- 4. BILL ACTIONS (CREATE, EDIT, DELETE) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success('Bill generated successfully');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e) {
      toast.error('Error creating bill. Check land values.');
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

  const openEditDialog = (bill) => {
    setEditingBill(bill);
    setFormData({
      consumer_id: bill.consumer_id,
      land_used_bigha: bill.land_used_bigha,
      land_used_katha: bill.land_used_katha,
      billing_period: bill.billing_period,
      category: bill.category // Pre-loads saved category correctly
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

  // --- 5. EXPORTS & NOTIFICATIONS ---
  const handleExport = (format) => {
    const headers = ['Farmer', 'Category', 'Period', 'Land (Bigha)', 'Amount', 'Due'];
    const rows = bills.map(b => [
      b.consumer_name, 
      (b.category || 'Tax').toUpperCase(), 
      b.billing_period, 
      b.total_land_in_bigha, 
      b.amount.toFixed(0), 
      b.due.toFixed(0)
    ]);
    format === 'csv' 
      ? exportToCSV(rows, headers, 'water_bills.csv') 
      : exportToPDF(rows, headers, 'Water Billing Report', 'water_bills.pdf');
    toast.success(`Exporting ${format.toUpperCase()}...`);
  };

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
      toast.success("SMS Sent!", { id: load });
    } catch (e) {
      toast.error("SMS Provider Error", { id: load });
    }
  };

  const sendWhatsApp = (bill) => {
    const consumer = consumers.find(c => c.id === bill.consumer_id);
    const msg = `*Water Bill Request*\n\nFarmer: ${bill.consumer_name}\nCategory: ${bill.category.toUpperCase()}\nPeriod: ${bill.billing_period}\nAmount: ₹${bill.amount}\n\nPlease pay as soon as possible. Thank you.`;
    window.open(`https://wa.me/91${consumer?.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) return <div className="flex justify-center p-12 text-muted-foreground">Syncing billing data...</div>;

  return (
    <div className="space-y-4 p-4">
      {/* HEADER & EXPORT ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-[#051039]">Bills</h1>
          <p className="text-sm text-muted-foreground">{bills.length} active records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="h-10 px-3 border-slate-200">
            <FileCsv size={18} className="mr-1 text-green-600" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="h-10 px-3 border-slate-200">
            <FilePdf size={18} className="mr-1 text-red-600" /> PDF
          </Button>
          
          {/* RATE SETTINGS (GEAR) */}
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 w-10 p-0"><Gear size={20}/></Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-md bg-white">
              <DialogHeader><DialogTitle>Category Pricing & Ratio</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Crop Category</Label>
                  <select 
                    className="w-full h-11 border rounded-md px-3 bg-white focus:ring-2 focus:ring-[#051039]"
                    value={rateConfig.category} 
                    onChange={(e) => handleCategorySwitchInConfig(e.target.value)}
                  >
                    {TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Rate / Bigha (₹)</Label>
                    <Input type="number" step="0.01" value={rateConfig.rate_per_bigha} onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Rate / Katha (₹)</Label>
                    <Input type="number" step="0.01" value={rateConfig.rate_per_katha} onChange={(e) => setRateConfig({...rateConfig, rate_per_katha: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase font-bold text-[#051039]">Katha to Bigha Ratio</Label>
                  <Input type="number" step="0.01" value={rateConfig.katha_to_bigha_ratio} onChange={(e) => setRateConfig({...rateConfig, katha_to_bigha_ratio: parseFloat(e.target.value) || 20})} />
                  <p className="text-[10px] text-muted-foreground mt-1">Default is 20 (Local land unit conversion)</p>
                </div>
                <Button type="submit" className="w-full h-11 bg-[#051039] text-white font-bold">Save Configuration</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-full h-10 w-10 p-0 bg-[#051039] text-white shadow-lg hover:bg-opacity-90">
            <Plus size={24} />
          </Button>
        </div>
      </div>

      {/* BILL LISTING CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {bills.map((bill) => (
          <div key={bill.id} className="bg-card border border-border p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-blue-50 text-[#051039] px-2.5 py-1 rounded-full uppercase font-black tracking-widest border border-blue-100">
                  {bill.category ? bill.category.replace(/_/g, ' ') : 'WATER TAX'}
                </span>
                <h3 className="text-xl font-medium mt-2 leading-tight">{bill.consumer_name}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{bill.billing_period}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleSendSMS(bill)} className="text-blue-600 hover:bg-blue-50"><ChatCircleDots size={22} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => sendWhatsApp(bill)} className="text-green-600 hover:bg-green-50"><WhatsappLogo size={22} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(bill)}><Pencil size={20}/></Button>
                <Button variant="ghost" size="sm" onClick={() => axios.delete(`${API_URL}/api/bills/${bill.id}`, {withCredentials:true}).then(() => fetchData())} className="text-destructive hover:bg-red-50"><Trash size={20}/></Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border">
              <div>
                <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Land Area</p>
                <p className="font-medium text-sm text-slate-800">{bill.total_land_in_bigha} Bigha</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider text-right">Balance Due</p>
                <p className="text-sm font-black text-destructive text-right tracking-tight">₹{bill.due.toFixed(0)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DIALOGS (CREATE & EDIT) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg bg-white">
          <DialogHeader><DialogTitle className="text-2xl font-light">Generate Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Farmer</Label>
              <Select onValueChange={(val) => setFormData({...formData, consumer_id: val})} required>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select Farmer" /></SelectTrigger>
                <SelectContent>{consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Period (e.g. Boro 2026)" className="h-12" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} required />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" step="0.01" className="h-12" placeholder="Bigha" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
              <Input type="number" step="0.01" className="h-12" placeholder="Katha" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
            </div>
            <Button type="submit" className="w-full h-12 bg-[#051039] text-white font-bold mt-2 shadow-xl">Create & Save</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg bg-white">
          <DialogHeader><DialogTitle className="text-2xl font-light">Modify Record</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input value={formData.billing_period} className="h-12" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input type="number" step="0.01" value={formData.land_used_bigha} className="h-12" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
              <Input type="number" step="0.01" value={formData.land_used_katha} className="h-12" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
            </div>
            <Button type="submit" className="w-full h-12 bg-[#051039] text-white font-bold shadow-lg">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bills;
