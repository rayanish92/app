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
    } catch (e) { 
      toast.error('Sync failed. Please check your connection.'); 
    } finally { 
      setLoading(false); 
    }
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
      const payload = {
        ...rateConfig,
        rate_per_bigha: parseFloat(rateConfig.rate_per_bigha),
        rate_per_katha: parseFloat(rateConfig.rate_per_katha),
        katha_to_bigha_ratio: parseFloat(rateConfig.katha_to_bigha_ratio)
      };
      await axios.put(`${API_URL}/api/rate-config`, payload, { withCredentials: true });
      toast.success(`Rates for ${rateConfig.category.toUpperCase()} updated successfully`);
      setRateDialogOpen(false);
      fetchData(); 
    } catch (e) { 
      toast.error('Update failed. Please use valid numbers.'); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.consumer_id) return toast.error("Please select a farmer.");
    if (rateConfig.katha_to_bigha_ratio === 0) return toast.error("Katha ratio in settings cannot be 0.");

    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success('Bill Created & Calculated');
      setDialogOpen(false);
      setFormData({ consumer_id: '', land_used_bigha: 0, land_used_katha: 0, billing_period: '', category: TAX_CATEGORIES[0] });
      fetchData();
    } catch (e) { 
      const backendMessage = e.response?.data?.detail;
      if (Array.isArray(backendMessage)) {
         toast.error(`Validation Error: ${backendMessage[0].loc[1]} is missing or invalid`);
      } else if (typeof backendMessage === 'string') {
         toast.error(`Error: ${backendMessage}`);
      } else {
         toast.error('Server error. Press F12 and check the console.');
      }
    }
  };

  const openEditDialog = (bill) => {
    setEditingBill(bill);
    setFormData({
      consumer_id: String(bill.consumer_id), 
      land_used_bigha: bill.land_used_bigha,
      land_used_katha: bill.land_used_katha, 
      billing_period: bill.billing_period,
      category: bill.category
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const billId = editingBill._id || editingBill.id; 
      await axios.put(`${API_URL}/api/bills/${billId}`, formData, { withCredentials: true });
      toast.success('Record updated & recalculated successfully');
      setEditDialogOpen(false);
      fetchData();
    } catch (e) { 
      toast.error('Failed to update the bill.'); 
    }
  };

  const handleDelete = async (bill) => {
    if (window.confirm(`Are you sure you want to delete this bill for ${bill.consumer_name}?`)) {
      try {
        const billId = bill._id || bill.id;
        await axios.delete(`${API_URL}/api/bills/${billId}`, { withCredentials: true });
        toast.success('Bill deleted successfully');
        fetchData();
      } catch (e) {
        toast.error('Failed to delete bill.');
      }
    }
  };

  const handleSendSMS = async (bill) => {
    try {
      const payload = {
        consumer_id: String(bill.consumer_id),
        land_area: `${bill.land_used_bigha} Bigha, ${bill.land_used_katha} Katha`,
        amount: bill.amount,
        period: bill.billing_period,
        category: bill.category
      };
      await axios.post(`${API_URL}/api/sms/send-bill`, payload, { withCredentials: true });
      toast.success(`SMS queued for ${bill.consumer_name}`);
    } catch (e) { 
      toast.error('Failed to send SMS. Check your Fast2SMS API Key.'); 
    }
  };

  const sendWhatsApp = (bill) => {
    const consumer = consumers.find(c => String(c._id || c.id) === String(bill.consumer_id));
    if (!consumer?.phone) return toast.error("No phone number found for this farmer.");
    
    const msg = `নমস্কার ${bill.consumer_name},\nবিভাগ: ${bill.category.toUpperCase()}\nপরিমাণ: ₹${bill.amount}\nধন্যবাদ।`;
    window.open(`https://wa.me/91${consumer.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleExport = (format) => {
    if (bills.length === 0) return toast.error("No data to export");
    const headers = ['Farmer', 'Category', 'Land (Bigha)', 'Total (₹)', 'Paid (₹)', 'Due (₹)'];
    const rows = bills.map(b => [ b.consumer_name || 'Unknown', b.category ? b.category.toUpperCase() : 'N/A', b.total_land_in_bigha, b.amount, b.paid, b.due ]);
    
    format === 'csv' 
        ? exportToCSV(rows, headers, `Water_Bills_${new Date().toLocaleDateString()}.csv`)
        : exportToPDF(rows, headers, 'Water Tax Collection Report', `Water_Bills_${new Date().toLocaleDateString()}.pdf`);
  };

  if (loading) return <div className="p-12 text-center text-[#051039] font-black animate-pulse">Syncing Database...</div>;

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-light text-[#051039]">Bills</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{bills.length} active bills</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><FileCsv size={20} className="text-green-600"/></Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><FilePdf size={20} className="text-red-600"/></Button>
          
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" size="icon" className="rounded-full"><Gear size={22}/></Button></DialogTrigger>
            <DialogContent className="rounded-2xl border-none shadow-2xl">
              <DialogHeader><DialogTitle className="text-2xl font-bold text-[#051039]">Category Rates</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4 pt-2">
                <select className="w-full h-11 border rounded-xl px-4 bg-slate-50 font-semibold" value={rateConfig.category} onChange={(e) => handleRateCategorySwitch(e.target.value)}>
                  {TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Rate/Bigha (₹)</Label>
                    <Input type="number" step="0.01" value={rateConfig.rate_per_bigha} onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: e.target.value})} />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Rate/Katha (₹)</Label>
                    <Input type="number" step="0.01" value={rateConfig.rate_per_katha} onChange={(e) => setRateConfig({...rateConfig, rate_per_katha: e.target.value})} />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Katha to Bigha Ratio</Label>
                  <Input type="number" step="0.01" value={rateConfig.katha_to_bigha_ratio} onChange={(e) => setRateConfig({...rateConfig, katha_to_bigha_ratio: e.target.value})} />
                </div>
                <Button type="submit" className="w-full h-12 bg-[#051039] text-white rounded-xl font-bold shadow-lg">Save Rates</Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Button onClick={() => setDialogOpen(true)} className="rounded-full h-12 w-12 bg-[#051039] text-white shadow-xl transition-all hover:scale-110 active:scale-95"><Plus size={28}/></Button>
        </div>
      </div>

      {/* BILL CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bills.map((bill) => (
          <div key={bill._id || bill.id} className="bg-white border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <span className="text-[10px] bg-blue-50 text-[#051039] px-3 py-1 rounded-full uppercase font-black border border-blue-100">
                  {bill.category || 'WATER TAX'}
                </span>
                <h3 className="text-xl font-bold text-slate-800 mt-3 leading-tight truncate pr-2">{bill.consumer_name || 'Unknown Farmer'}</h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Period: {bill.billing_period}</p>
              </div>
              <div className="flex flex-col gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-white pl-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => sendWhatsApp(bill)} title="WhatsApp" className="text-emerald-500 rounded-full h-8 w-8 p-0"><WhatsappLogo size={22} weight="fill"/></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleSendSMS(bill)} title="SMS" className="text-blue-500 rounded-full h-8 w-8 p-0"><ChatCircleDots size={22} weight="fill"/></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => openEditDialog(bill)} title="Edit" className="text-slate-400 hover:text-[#051039] rounded-full h-8 w-8 p-0"><Pencil size={20}/></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(bill)} title="Delete" className="text-rose-400 hover:text-rose-600 rounded-full h-8 w-8 p-0"><Trash size={20}/></Button>
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-slate-50 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-300 uppercase">Land / Total</p>
                  <p className="text-sm font-bold text-slate-700">{bill.total_land_in_bigha} B / ₹{bill.amount}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-300 uppercase">Paid / Due</p>
                  <p className="text-sm font-black text-emerald-600">₹{bill.paid} / <span className="text-rose-600">₹{bill.due}</span></p>
                </div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE BILL DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 md:p-10 max-w-lg border-none shadow-3xl">
          <DialogHeader><DialogTitle className="text-2xl font-light text-[#051039]">Create Invoice</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            
            <Select onValueChange={(v) => setFormData({...formData, consumer_id: v})} required>
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg"><SelectValue placeholder="Identify Farmer" /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl max-h-60">
                  {/* FIX: Force keys and values to Strings to prevent UI crash */}
                  {consumers.map(c => (
                    <SelectItem key={String(c._id || c.id)} value={String(c._id || c.id)}>
                      {c.name || 'Unknown'} ({c.phone || 'No Phone'})
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>

            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  {TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}
                </SelectContent>
            </Select>

            <Input placeholder="Season/Year (e.g. 2024-25)" className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} required />
            
            <div className="grid grid-cols-2 gap-4">
                <Input type="number" step="0.01" className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" placeholder="Bigha" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
                <Input type="number" step="0.01" className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" placeholder="Katha" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
            </div>

            <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-2xl font-black text-xl shadow-xl hover:bg-blue-900 transition-all mt-2">Generate Bill</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT BILL DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 md:p-10 max-w-lg border-none shadow-3xl">
          <DialogHeader><DialogTitle className="text-2xl font-light text-[#051039]">Update Record</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-4">
            
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  {TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}
                </SelectContent>
            </Select>

            <Input value={formData.billing_period} placeholder="Season/Year" className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} required/>
            
            <div className="grid grid-cols-2 gap-5">
                <div>
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Bigha</Label>
                  <Input type="number" step="0.01" value={formData.land_used_bigha} className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Katha</Label>
                  <Input type="number" step="0.01" value={formData.land_used_katha} className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value) || 0})} />
                </div>
            </div>

            <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-2xl font-bold shadow-xl text-lg mt-2">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bills;
