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
import { TAX_CATEGORIES } from '../lib/constants'; // Import the constants

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Bills = () => {
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
    category: TAX_CATEGORIES[0] // Added Category
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
      if (configRes.data) setRateConfig(configRes.data);
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
      await axios.delete(`${API_URL}/api/bills/${editingBill.id}`, { withCredentials: true });
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
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
      toast.success('Rate and Default Category updated');
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
      category: bill.category || TAX_CATEGORIES[0]
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

  // --- Send Bilingual Normal SMS via Backend ---
  const handleSendNormalSMS = async (bill) => {
    const loadingToast = toast.loading("Sending SMS...");
    try {
      const response = await axios.post(`${API_URL}/api/sms/send-bill`, {
        consumer_id: bill.consumer_id,
        land_area: `${bill.land_used_bigha} Bigha, ${bill.land_used_katha} Katha`,
        amount: bill.amount,
        period: bill.billing_period,
        category: bill.category || "Water Tax"
      }, { withCredentials: true });

      if (response.data.sms_status === 'Success') {
        toast.success("SMS sent successfully", { id: loadingToast });
      } else {
        toast.error("SMS Failed to send", { id: loadingToast });
      }
    } catch (error) {
      toast.error("Gateway connection error", { id: loadingToast });
    }
  };

  const sendWhatsAppBill = (bill) => {
    const consumer = consumers.find(c => c.id === bill.consumer_id);
    if (!consumer) {
      toast.error('Consumer not found');
      return;
    }
    
    // Mapping for Bengali display
    const catMap = {
      "boro chas tax": "বোরো চাষ ট্যাক্স",
      "boro seed water tax": "বোরো বীজ জল ট্যাক্স",
      "potato water tax": "আলু জল ট্যাক্স",
      "mustard water tax": "সরষে জল ট্যাক্স",
      "others water tax": "অন্যান্য জল ট্যাক্স"
    };
    const bCat = catMap[bill.category] || bill.category;

    const message = `নমস্কার ${bill.consumer_name},\n\n*জলের বিল - ${bill.billing_period}*\nবিভাগ: ${bCat}\nজমি: ${bill.total_land_in_bigha} বিঘা\nমোট: ₹${bill.amount.toFixed(0)}\nবকেয়া: ₹${bill.due.toFixed(0)}\n\nধন্যবাদ!\n\n---\n\nHello, Water Bill for ${bill.category.toUpperCase()}.\nAmount: ₹${bill.amount.toFixed(0)}`;
    
    const whatsappUrl = `https://wa.me/91${consumer.phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleExport = (format) => {
    const headers = ['Consumer', 'Category', 'Period', 'Land (Bigha)', 'Amount', 'Paid', 'Due'];
    const rows = bills.map(b => [b.consumer_name, b.category, b.billing_period, b.total_land_in_bigha, b.amount, b.paid, b.due]);
    format === 'csv' ? exportToCSV(rows, headers, 'bills.csv') : exportToPDF(rows, headers, 'Bills Report', 'bills.pdf');
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="space-y-4" data-testid="bills-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">Bills</h1>
          <p className="mt-1 text-sm text-muted-foreground">{bills.length} total bills</p>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {bills.length > 0 && (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="h-10 px-3 text-xs"><DownloadSimple size={16} className="mr-1" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="h-10 px-3 text-xs"><DownloadSimple size={16} className="mr-1" /> PDF</Button>
            </div>
          )}
          
          {/* Rate Config Dialog */}
          <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-10 w-10 p-0"><Gear size={20} /></Button></DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-xl">
              <DialogHeader><DialogTitle className="font-heading text-xl font-light">Rate Config</DialogTitle></DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-3">
                <div>
                  <Label className="text-xs uppercase">Rate per Bigha (₹)</Label>
                  <Input type="number" step="0.01" value={rateConfig.rate_per_bigha} onChange={(e) => setRateConfig({ ...rateConfig, rate_per_bigha: parseFloat(e.target.value) || 0 })} required />
                </div>
                <div>
                  <Label className="text-xs uppercase">Default Category</Label>
                  <select 
                    value={rateConfig.category} 
                    onChange={(e) => setRateConfig({ ...rateConfig, category: e.target.value })}
                    className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm outline-none"
                  >
                    {TAX_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                  </select>
                </div>
                <Button type="submit" className="w-full h-11">Update Settings</Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Add Bill Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-primary h-10 w-10 p-0 rounded-full"><Plus size={24} weight="bold" /></Button></DialogTrigger>
            <DialogContent className="max-w-[90vw] rounded-xl">
              <DialogHeader><DialogTitle className="font-heading text-xl font-light">Create Bill</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label className="text-xs uppercase">Consumer</Label>
                  <Select value={formData.consumer_id} onValueChange={(val) => setFormData({ ...formData, consumer_id: val })} required>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select consumer" /></SelectTrigger>
                    <SelectContent>{consumers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase">Category</Label>
                  <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })} required>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent>{TAX_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" placeholder="Bigha" value={formData.land_used_bigha} onChange={(e) => setFormData({ ...formData, land_used_bigha: parseFloat(e.target.value) || 0 })} />
                  <Input type="number" placeholder="Katha" value={formData.land_used_katha} onChange={(e) => setFormData({ ...formData, land_used_katha: parseFloat(e.target.value) || 0 })} />
                </div>
                <Input placeholder="Period (e.g. Boro 2026)" value={formData.billing_period} onChange={(e) => setFormData({ ...formData, billing_period: e.target.value })} required />
                <Button type="submit" className="w-full h-11">Create Bill</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bills List */}
      <div className="space-y-3">
        {bills.map((bill, idx) => (
          <div key={bill.id} className="bg-card border border-border p-4 rounded-xl shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase font-bold tracking-tight">
                  {bill.category || 'Standard'}
                </span>
                <h3 className="font-heading text-lg font-light mt-1">{bill.consumer_name}</h3>
                <p className="text-xs text-muted-foreground">{bill.billing_period}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleSendNormalSMS(bill)} className="h-9 w-9 p-0 text-blue-600"><ChatCircleDots size={20} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => sendWhatsAppBill(bill)} className="h-9 w-9 p-0 text-green-600"><WhatsappLogo size={20} weight="fill" /></Button>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(bill)} className="h-9 w-9 p-0"><Pencil size={18} /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(bill.id)} className="h-9 w-9 p-0 text-destructive"><Trash size={18} /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div><p className="text-xs text-muted-foreground">Land / Amount</p><p className="text-sm">{bill.total_land_in_bigha} Bigha / ₹{bill.amount.toFixed(0)}</p></div>
              <div><p className="text-xs text-muted-foreground">Paid / Due</p><p className="text-sm font-medium"><span className="text-green-600">₹{bill.paid.toFixed(0)}</span> / <span className="text-destructive">₹{bill.due.toFixed(0)}</span></p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Bills;
