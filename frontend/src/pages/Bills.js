import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Plus, Trash, Gear, Pencil, WhatsappLogo, DownloadSimple, ChatCircleDots, FileCsv, FilePdf 
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';
import { TAX_CATEGORIES } from '../lib/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Bills = () => {
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [rateConfig, setRateConfig] = useState({ 
    rate_per_bigha: 100, rate_per_katha: 5, katha_to_bigha_ratio: 20, category: TAX_CATEGORIES[0] 
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  
  const [formData, setFormData] = useState({
    consumer_id: '', land_used_bigha: 0, land_used_katha: 0, billing_period: '', category: TAX_CATEGORIES[0]
  });

  const fetchData = useCallback(async () => {
    try {
      const [bRes, cRes, cfgRes] = await Promise.all([
        axios.get(`${API_URL}/api/bills`, { withCredentials: true }),
        axios.get(`${API_URL}/api/consumers`, { withCredentials: true }),
        axios.get(`${API_URL}/api/rate-config?category=${TAX_CATEGORIES[0]}`, { withCredentials: true })
      ]);
      setBills(bRes.data.items || bRes.data);
      setConsumers(cRes.data.items || cRes.data);
      if (cfgRes.data) setRateConfig(cfgRes.data);
    } catch (e) { toast.error('Connection error. Refresh required.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRateCategorySwitch = async (cat) => {
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
    } catch (e) { toast.error('Update failed'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success('Bill generated');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e) { toast.error('Failed to create. Check fields.'); }
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
      consumer_id: bill.consumer_id, land_used_bigha: bill.land_used_bigha,
      land_used_katha: bill.land_used_katha, billing_period: bill.billing_period,
      category: bill.category
    });
    setEditDialogOpen(true);
  };

  const handleExport = (format) => {
    const headers = ['Farmer', 'Category', 'Land', 'Amount', 'Due'];
    const rows = bills.map(b => [b.consumer_name, b.category.toUpperCase(), b.total_land_in_bigha, b.amount, b.due]);
    format === 'csv' ? exportToCSV(rows, headers, 'bills.csv') : exportToPDF(rows, headers, 'Report', 'bills.pdf');
  };

  const sendWhatsApp = (bill) => {
    const consumer = consumers.find(c => c.id === bill.consumer_id);
    const msg = `নমস্কার ${bill.consumer_name},\nবিভাগ: ${bill.category.toUpperCase()}\nপরিমাণ: ₹${bill.amount}\nধন্যবাদ।`;
    window.open(`https://wa.me/91${consumer?.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const resetForm = () => {
    setFormData({ consumer_id: '', land_used_bigha: 0, land_used_katha: 0, billing_period: '', category: TAX_CATEGORIES[0] });
  };

  if (loading) return <div className="p-12 text-center text-[#051039]">Synchronizing...</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <div><h1 className="text-3xl font-light text-[#051039]">Bills</h1><p className="text-xs text-muted-foreground">{bills.length} active</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><FileCsv size={20} className="text-green-600"/></Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><FilePdf size={20} className="text-red-600"/></Button>
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" className="h-10 w-10 p-0"><Gear size={20}/></Button></DialogTrigger>
            <DialogContent className="rounded-xl bg-white"><DialogHeader><DialogTitle>Category Rate Settings</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4">
                <select className="w-full h-11 border rounded-md px-3 bg-white" value={rateConfig.category} onChange={(e) => handleRateCategorySwitch(e.target.value)}>{TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}</select>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-[10px] uppercase">Rate / Bigha</Label><Input type="number" step="0.01" value={rateConfig.rate_per_bigha} onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: parseFloat(e.target.value)})} /></div>
                  <div><Label className="text-[10px] uppercase">Rate / Katha</Label><Input type="number" step="0.01" value={rateConfig.rate_per_katha} onChange={(e) => setRateConfig({...rateConfig, rate_per_katha: parseFloat(e.target.value)})} /></div>
                </div>
                <div><Label className="text-[10px] uppercase text-[#051039]">Katha to Bigha Ratio</Label><Input type="number" step="0.01" value={rateConfig.katha_to_bigha_ratio} onChange={(e) => setRateConfig({...rateConfig, katha_to_bigha_ratio: parseFloat(e.target.value)})} /></div>
                <Button type="submit" className="w-full h-11 bg-[#051039] text-white">Save All Configuration</Button>
              </form></DialogContent></Dialog>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-full h-10 w-10 p-0 bg-[#051039] text-white"><Plus size={24}/></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bills.map((bill) => (
          <div key={bill.id} className="bg-card border p-5 rounded-2xl shadow-sm border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div><span className="text-[10px] bg-blue-50 text-[#051039] px-2 py-0.5 rounded-full uppercase font-black border border-blue-100">{bill.category ? bill.category.replace(/_/g, ' ') : 'TAX'}</span><h3 className="text-xl font-medium mt-2 leading-tight">{bill.consumer_name}</h3><p className="text-xs text-muted-foreground">{bill.billing_period}</p></div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => sendWhatsApp(bill)} className="text-green-600 hover:bg-green-50"><WhatsappLogo size={22} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => axios.post(`${API_URL}/api/sms/send-bill`, {consumer_id: bill.consumer_id, land_area: bill.total_land_in_bigha, amount: bill.amount, period: bill.billing_period, category: bill.category}, {withCredentials:true}).then(() => toast.success("SMS Sent"))} className="text-blue-600 hover:bg-blue-50"><ChatCircleDots size={22} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(bill)}><Pencil size={20}/></Button>
                <Button variant="ghost" size="sm" onClick={() => axios.delete(`${API_URL}/api/bills/${bill.id}`, {withCredentials:true}).then(() => fetchData())} className="text-destructive hover:bg-red-50"><Trash size={20}/></Button>
              </div>
            </div>
            <div className="flex justify-between mt-5 pt-4 border-t border-slate-50 text-sm font-bold">
                <p>{bill.total_land_in_bigha} B / ₹{bill.amount}</p><p className="text-destructive font-black">₹{bill.due} DUE</p>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg bg-white"><DialogHeader><DialogTitle className="text-2xl font-light">Generate Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <Select onValueChange={(v) => setFormData({...formData, consumer_id: v})} required><SelectTrigger className="h-12"><SelectValue placeholder="Select Farmer" /></SelectTrigger><SelectContent>{consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent></Select>
            <Input placeholder="Period" className="h-12" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} required />
            <div className="grid grid-cols-2 gap-4"><Input type="number" step="0.01" className="h-12" placeholder="Bigha" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} /><Input type="number" step="0.01" className="h-12" placeholder="Katha" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} /></div>
            <Button type="submit" className="w-full h-12 bg-[#051039] text-white font-bold shadow-xl">Create & Save</Button>
          </form></DialogContent></Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg bg-white"><DialogHeader><DialogTitle className="text-2xl font-light">Update Record</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent></Select>
            <Input value={formData.billing_period} className="h-12" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} />
            <div className="grid grid-cols-2 gap-4"><Input type="number" step="0.01" value={formData.land_used_bigha} className="h-12" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} /><Input type="number" step="0.01" value={formData.land_used_katha} className="h-12" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} /></div>
            <Button type="submit" className="w-full h-12 bg-[#051039] text-white font-bold shadow-lg">Save Changes</Button>
          </form></DialogContent></Dialog>
    </div>
  );
};

export default Bills;
