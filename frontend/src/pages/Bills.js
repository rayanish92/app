import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Gear, Plus, Pencil, Trash, DownloadSimple, ChatCircleDots, WhatsappLogo, FileCsv, FilePdf 
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';
import { TAX_CATEGORIES } from '../lib/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Bills = () => {
  // --- 1. STATE ---
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

  // --- 2. DATA FETCH ---
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
    } catch (e) { toast.error('Sync failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- 3. LOGIC ---
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
      toast.success(`Config saved for ${rateConfig.category.toUpperCase()}`);
      setRateDialogOpen(false);
    } catch (e) { toast.error('Save failed'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success('Bill generated');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e) { toast.error('Creation failed'); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/bills/${editingBill.id}`, formData, { withCredentials: true });
      toast.success('Bill updated');
      setEditDialogOpen(false);
      fetchData();
    } catch (e) { toast.error('Edit failed'); }
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
    const headers = ['Farmer', 'Category', 'Land', 'Total', 'Paid', 'Due'];
    const rows = bills.map(b => [b.consumer_name, b.category.toUpperCase(), b.total_land_in_bigha, b.amount, b.paid, b.due]);
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

  if (loading) return <div className="p-12 text-center text-[#051039] font-bold">Synchronizing...</div>;

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b-2 border-slate-100 pb-6">
        <div>
          <h1 className="text-4xl font-light text-[#051039] tracking-tight">Billing Center</h1>
          <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-[0.2em]">{bills.length} active invoices</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="icon" onClick={() => handleExport('csv')} className="rounded-full hover:bg-emerald-50"><FileCsv size={22} className="text-emerald-600"/></Button>
          <Button variant="outline" size="icon" onClick={() => handleExport('pdf')} className="rounded-full hover:bg-rose-50"><FilePdf size={22} className="text-rose-600"/></Button>
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" size="icon" className="rounded-full"><Gear size={22} className="text-slate-600"/></Button></DialogTrigger>
            <DialogContent className="rounded-3xl border-none shadow-2xl">
              <DialogHeader><DialogTitle className="text-2xl font-bold text-[#051039]">Rate Configuration</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-5">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Crop Category</Label>
                    <select className="w-full h-12 border-2 border-slate-100 rounded-2xl px-4 bg-slate-50 focus:border-[#051039] transition-all" value={rateConfig.category} onChange={(e) => handleRateCategorySwitch(e.target.value)}>
                        {TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Rate / Bigha</Label><Input className="h-12 rounded-2xl border-2" type="number" value={rateConfig.rate_per_bigha} onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: parseFloat(e.target.value)})} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Rate / Katha</Label><Input className="h-12 rounded-2xl border-2" type="number" value={rateConfig.rate_per_katha} onChange={(e) => setRateConfig({...rateConfig, rate_per_katha: parseFloat(e.target.value)})} /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-[#051039]">Land Ratio (Katha/Bigha)</Label><Input className="h-12 rounded-2xl border-2 border-[#051039]/20" type="number" value={rateConfig.katha_to_bigha_ratio} onChange={(e) => setRateConfig({...rateConfig, katha_to_bigha_ratio: parseFloat(e.target.value)})} /></div>
                <Button type="submit" className="w-full h-14 bg-[#051039] text-white rounded-2xl font-bold shadow-lg shadow-[#051039]/20 hover:scale-[1.02] active:scale-95 transition-all">Update {rateConfig.category.toUpperCase()}</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-full h-14 w-14 bg-[#051039] text-white shadow-xl hover:rotate-90 transition-all duration-500"><Plus size={32}/></Button>
        </div>
      </div>

      {/* CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {bills.map((bill) => (
          <div key={bill.id} className="bg-white border-2 border-slate-50 p-7 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-[#051039]/5 text-[#051039] px-4 py-1.5 rounded-full uppercase font-black tracking-widest border-2 border-[#051039]/5">
                  {bill.category ? bill.category.toUpperCase() : 'WATER TAX'}
                </span>
                <h3 className="text-2xl font-bold text-slate-800 mt-4 leading-tight">{bill.consumer_name}</h3>
                <p className="text-[11px] font-bold text-slate-300 mt-1 uppercase tracking-widest">{bill.billing_period}</p>
              </div>
              <div className="flex flex-col gap-2 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500">
                <Button variant="ghost" size="sm" onClick={() => sendWhatsApp(bill)} className="text-emerald-500 hover:bg-emerald-50 rounded-full"><WhatsappLogo size={24} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(bill)} className="text-slate-400 hover:bg-slate-50 rounded-full"><Pencil size={22}/></Button>
                <Button variant="ghost" size="sm" onClick={() => axios.delete(`${API_URL}/api/bills/${bill.id}`, {withCredentials:true}).then(() => fetchData())} className="text-rose-500 hover:bg-rose-50 rounded-full"><Trash size={22}/></Button>
              </div>
            </div>

            {/* STATS SECTION */}
            <div className="mt-8 grid grid-cols-2 gap-6 pt-6 border-t-2 border-slate-50">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Land / Bill</p>
                    <p className="text-base font-bold text-slate-700">{bill.total_land_in_bigha} B / ₹{bill.amount}</p>
                </div>
                <div className="text-right space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Balance Status</p>
                    <div className="flex flex-col items-end">
                        <span className={`text-base font-black ${bill.due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {bill.due > 0 ? `₹${bill.due} DUE` : 'CLEARED'}
                        </span>
                        <p className="text-[10px] text-emerald-500 font-black">₹{bill.paid} Received</p>
                    </div>
                </div>
            </div>

            <Button 
                variant="ghost" 
                className="w-full mt-6 h-12 rounded-2xl bg-slate-50 text-[#051039] font-black text-[10px] uppercase tracking-widest hover:bg-[#051039] hover:text-white transition-all"
                onClick={() => axios.post(`${API_URL}/api/sms/send-bill`, bill, {withCredentials:true}).then(() => toast.success("Reminder Sent"))}
            >
                <ChatCircleDots size={20} className="mr-2" /> Dispatch SMS Reminder
            </Button>
          </div>
        ))}
      </div>

      {/* CREATE MODAL */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10 max-w-xl border-none shadow-3xl">
          <DialogHeader><DialogTitle className="text-4xl font-light text-[#051039] mb-4">Generate Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Select onValueChange={(v) => setFormData({...formData, consumer_id: v})} required>
                <SelectTrigger className="h-16 rounded-3xl bg-slate-50 border-none px-8 text-lg"><SelectValue placeholder="Identify Farmer" /></SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">{consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                <SelectTrigger className="h-16 rounded-3xl bg-slate-50 border-none px-8 text-lg"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Season Name" className="h-16 rounded-3xl bg-slate-50 border-none px-8 text-lg" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} required />
            <div className="grid grid-cols-2 gap-5">
                <Input type="number" step="0.01" className="h-16 rounded-3xl bg-slate-50 border-none px-8 text-lg" placeholder="Bigha" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
                <Input type="number" step="0.01" className="h-16 rounded-3xl bg-slate-50 border-none px-8 text-lg" placeholder="Katha" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
            </div>
            <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-3xl font-black text-xl shadow-2xl shadow-[#051039]/40 hover:scale-[1.02] transition-all mt-4 uppercase">Authorize & Create Bill</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bills;
