import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Gear, Plus, Pencil, Trash, WhatsappLogo, ChatCircleDots, FileCsv, FilePdf } from '@phosphor-icons/react';
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
    } catch (e) { toast.error('Sync failed'); }
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
      // parseFloat prevents data type errors on the backend
      const payload = {
        ...rateConfig,
        rate_per_bigha: parseFloat(rateConfig.rate_per_bigha),
        rate_per_katha: parseFloat(rateConfig.rate_per_katha),
        katha_to_bigha_ratio: parseFloat(rateConfig.katha_to_bigha_ratio)
      };
      await axios.put(`${API_URL}/api/rate-config`, payload, { withCredentials: true });
      toast.success(`Rates for ${rateConfig.category.toUpperCase()} saved`);
      setRateDialogOpen(false);
    } catch (e) { toast.error('Failed to update rates'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success('Bill generated');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e) { toast.error('Check fields or rates'); }
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

  const sendWhatsApp = (bill) => {
    const consumer = consumers.find(c => c.id === bill.consumer_id);
    const msg = `নমস্কার ${bill.consumer_name},\nবিভাগ: ${bill.category.toUpperCase()}\nপরিমাণ: ₹${bill.amount}\nধন্যবাদ।`;
    window.open(`https://wa.me/91${consumer?.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const resetForm = () => {
    setFormData({ consumer_id: '', land_used_bigha: 0, land_used_katha: 0, billing_period: '', category: TAX_CATEGORIES[0] });
  };

  if (loading) return <div className="p-12 text-center text-[#051039] font-bold">Connecting...</div>;

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-light text-[#051039]">Bills</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{bills.length} Total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV(bills.map(b => [b.consumer_name, b.category, b.amount, b.due]), ['Farmer', 'Category', 'Amount', 'Due'], 'bills.csv')}><FileCsv size={20} className="text-green-600"/></Button>
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" size="icon" className="rounded-full"><Gear size={22}/></Button></DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader><DialogTitle>Category Rates</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4">
                <select className="w-full h-11 border rounded-xl px-4" value={rateConfig.category} onChange={(e) => handleRateCategorySwitch(e.target.value)}>
                    {TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs font-bold uppercase">Rate/Bigha</Label><Input type="number" step="0.01" value={rateConfig.rate_per_bigha} onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: e.target.value})} /></div>
                  <div><Label className="text-xs font-bold uppercase">Rate/Katha</Label><Input type="number" step="0.01" value={rateConfig.rate_per_katha} onChange={(e) => setRateConfig({...rateConfig, rate_per_katha: e.target.value})} /></div>
                </div>
                <div><Label className="text-xs font-bold uppercase">Land Ratio</Label><Input type="number" step="0.01" value={rateConfig.katha_to_bigha_ratio} onChange={(e) => setRateConfig({...rateConfig, katha_to_bigha_ratio: e.target.value})} /></div>
                <Button type="submit" className="w-full h-12 bg-[#051039] text-white rounded-xl">Save Configuration</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-full h-12 w-12 bg-[#051039] text-white shadow-xl"><Plus size={28}/></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bills.map((bill) => (
          <div key={bill.id} className="bg-white border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                {/* DYNAMIC CATEGORY BADGE (FIRST 2 WORDS) */}
                <span className="text-[10px] bg-blue-50 text-[#051039] px-3 py-1 rounded-full uppercase font-black border border-blue-100">
                  {bill.category ? bill.category.split(' ').slice(0, 2).join(' ') : 'WATER TAX'}
                </span>
                <h3 className="text-xl font-bold text-slate-800 mt-3 leading-tight">{bill.consumer_name}</h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase">{bill.billing_period}</p>
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => sendWhatsApp(bill)} className="text-emerald-500 rounded-full"><WhatsappLogo size={22} weight="fill"/></Button>
                {/* RESTORED SMS ICON */}
                <Button variant="ghost" size="sm" onClick={() => axios.post(`${API_URL}/api/sms/send-bill`, bill, {withCredentials:true}).then(() => toast.success("SMS Sent"))} className="text-blue-500 rounded-full"><ChatCircleDots size={22} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(bill)} className="text-slate-400 rounded-full"><Pencil size={20}/></Button>
                <Button variant="ghost" size="sm" onClick={() => axios.delete(`${API_URL}/api/bills/${bill.id}`, {withCredentials:true}).then(() => fetchData())} className="text-rose-500 rounded-full"><Trash size={20}/></Button>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-50 grid grid-cols-2 gap-2">
                <div><p className="text-[10px] font-bold text-slate-300 uppercase">Land / Bill</p><p className="text-sm font-bold text-slate-700">{bill.total_land_in_bigha} B / ₹{bill.amount}</p></div>
                <div className="text-right"><p className="text-[10px] font-bold text-slate-300 uppercase">Paid / Due</p><p className="text-sm font-black text-emerald-600">₹{bill.paid} / <span className="text-rose-600">₹{bill.due}</span></p></div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-light text-[#051039]">Create Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <Select onValueChange={(v) => setFormData({...formData, consumer_id: v})} required>
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6"><SelectValue placeholder="Select Farmer" /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl">{consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl">{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Season (e.g. Boro 2026)" className="h-14 rounded-2xl bg-slate-50 border-none px-6" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} required />
            <div className="grid grid-cols-2 gap-4">
                <Input type="number" step="0.01" className="h-14 rounded-2xl bg-slate-50 border-none px-6" placeholder="Bigha" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
                <Input type="number" step="0.01" className="h-14 rounded-2xl bg-slate-50 border-none px-6" placeholder="Katha" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
            </div>
            <Button type="submit" className="w-full h-14 bg-[#051039] text-white rounded-2xl font-bold shadow-xl">Generate Bill</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bills;
