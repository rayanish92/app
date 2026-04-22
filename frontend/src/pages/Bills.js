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
        axios.get(`${API_URL}/api/rate-config?category=${TAX_CATEGORIES[0]}`, { withCredentials: true })
      ]);
      setBills(billsRes.data.items || billsRes.data);
      setConsumers(consumersRes.data.items || consumersRes.data);
      if (configRes.data) setRateConfig(configRes.data);
    } catch (error) {
      toast.error('Data sync failed. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- FIX 1: Fetch category-specific rate when switching in settings ---
  const handleCategorySwitchInConfig = async (cat) => {
    try {
      const { data } = await axios.get(`${API_URL}/api/rate-config?category=${cat}`, { withCredentials: true });
      setRateConfig(data);
    } catch (e) {
      setRateConfig({ rate_per_bigha: 100, katha_to_bigha_ratio: 20, category: cat });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success('Bill created');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (e) { toast.error('Failed to create bill'); }
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

  const handleRateUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/rate-config`, rateConfig, { withCredentials: true });
      toast.success(`Updated rate for ${rateConfig.category.toUpperCase()}`);
      setRateDialogOpen(false);
    } catch (e) { toast.error('Update failed'); }
  };

  const openEditDialog = (bill) => {
    setEditingBill(bill);
    setFormData({
      consumer_id: bill.consumer_id,
      land_used_bigha: bill.land_used_bigha,
      land_used_katha: bill.land_used_katha,
      billing_period: bill.billing_period,
      category: bill.category // FIX 3: Load existing category into edit form
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ consumer_id: '', land_used_bigha: 0, land_used_katha: 0, billing_period: '', category: TAX_CATEGORIES[0] });
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-light">Bills</h1>
        <div className="flex gap-2">
          {/* RATE CONFIG DIALOG */}
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" className="h-10 w-10 p-0"><Gear size={20}/></Button></DialogTrigger>
            <DialogContent className="rounded-xl">
              <DialogHeader><DialogTitle>Category Rates</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4">
                <Label className="text-xs uppercase font-bold">Select Category</Label>
                <select 
                    className="w-full h-11 border rounded-md px-3 bg-white"
                    value={rateConfig.category} 
                    onChange={(e) => handleCategorySwitchInConfig(e.target.value)}
                >
                  {TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                </select>
                <Label className="text-xs uppercase font-bold">Rate (₹)</Label>
                <Input type="number" value={rateConfig.rate_per_bigha} onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: parseFloat(e.target.value)})} />
                <Button type="submit" className="w-full h-11 bg-primary text-white">Save Rate</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="rounded-full h-10 w-10 p-0 bg-primary text-white"><Plus size={24}/></Button>
        </div>
      </div>

      {/* BILL LISTING */}
      <div className="space-y-3">
        {bills.map((bill) => (
          <div key={bill.id} className="bg-card border p-4 rounded-xl shadow-sm">
            <div className="flex justify-between">
              <div>
                {/* FIX 2: Displaying the actual category from the database */}
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase font-bold border border-blue-200">
                  {bill.category ? bill.category.toUpperCase() : 'WATER TAX'}
                </span>
                <h3 className="text-lg font-medium mt-1">{bill.consumer_name}</h3>
                <p className="text-xs text-muted-foreground">{bill.billing_period}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => openEditDialog(bill)}><Pencil size={18}/></Button>
                <Button variant="ghost" onClick={() => axios.delete(`${API_URL}/api/bills/${bill.id}`, {withCredentials:true}).then(() => fetchData())} className="text-destructive"><Trash size={18}/></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t text-sm">
              <div><p className="text-muted-foreground text-xs uppercase font-bold">Land</p><p>{bill.total_land_in_bigha} Bigha</p></div>
              <div><p className="text-muted-foreground text-xs uppercase font-bold">Due</p><p className="text-destructive font-bold">₹{bill.due.toFixed(0)}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader><DialogTitle>New Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Label className="text-xs uppercase">Farmer</Label>
            <Select onValueChange={(v) => setFormData({...formData, consumer_id: v})}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Select Farmer" /></SelectTrigger>
              <SelectContent>{consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Label className="text-xs uppercase">Category</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Period" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} />
            <div className="flex gap-2">
              <Input type="number" placeholder="Bigha" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value)})} />
              <Input type="number" placeholder="Katha" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value)})} />
            </div>
            <Button type="submit" className="w-full h-11 bg-primary text-white">Create Bill</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader><DialogTitle>Edit Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <Label className="text-xs uppercase">Category</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={formData.billing_period} onChange={(e) => setFormData({...formData, billing_period: e.target.value})} />
            <div className="flex gap-2">
              <Input type="number" value={formData.land_used_bigha} onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value)})} />
              <Input type="number" value={formData.land_used_katha} onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value)})} />
            </div>
            <Button type="submit" className="w-full h-11 bg-primary text-white">Update Bill</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Bills;
