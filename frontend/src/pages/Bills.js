import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Gear, Pencil, Trash, WhatsappLogo } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { TAX_CATEGORIES } from '../lib/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Bills = () => {
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [rateConfig, setRateConfig] = useState({ rate_per_bigha: 100, katha_to_bigha_ratio: 20, category: TAX_CATEGORIES[0] });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    consumer_id: '',
    land_used_bigha: 0,
    land_used_katha: 0,
    billing_period: '',
    category: TAX_CATEGORIES[0]
  });

  const fetchData = useCallback(async () => {
    try {
      const [bRes, cRes, rRes] = await Promise.all([
        axios.get(`${API_URL}/api/bills`, { withCredentials: true }),
        axios.get(`${API_URL}/api/consumers`, { withCredentials: true }),
        axios.get(`${API_URL}/api/rate-config`, { withCredentials: true })
      ]);
      setBills(bRes.data.items || bRes.data);
      setConsumers(cRes.data.items || cRes.data);
      if (rRes.data) setRateConfig(rRes.data);
    } catch (e) { toast.error("Data failed to load. Please login again."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/bills`, formData, { withCredentials: true });
      toast.success("Bill Created");
      setDialogOpen(false);
      fetchData();
    } catch (e) { toast.error("Check all fields"); }
  };

  if (loading) return <div className="p-8 text-center">Connecting to server...</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Bills</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRateDialogOpen(true)}><Gear size={20}/></Button>
          <Button onClick={() => setDialogOpen(true)} className="rounded-full"><Plus size={20}/></Button>
        </div>
      </div>

      {/* CREATE BILL DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Bill</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Consumer</Label>
              <Select onValueChange={(val) => setFormData({...formData, consumer_id: val})}>
                <SelectTrigger><SelectValue placeholder="Select Farmer" /></SelectTrigger>
                <SelectContent>{consumers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TAX_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Period (e.g. Boro 2026)" onChange={(e) => setFormData({...formData, billing_period: e.target.value})} required />
            <div className="flex gap-2">
              <Input type="number" placeholder="Bigha" onChange={(e) => setFormData({...formData, land_used_bigha: parseFloat(e.target.value)})} />
              <Input type="number" placeholder="Katha" onChange={(e) => setFormData({...formData, land_used_katha: parseFloat(e.target.value)})} />
            </div>
            <Button type="submit" className="w-full">Create Bill</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* BILL LISTING */}
      <div className="grid gap-3">
        {bills.map(bill => (
          <div key={bill.id} className="p-4 border rounded-xl bg-white shadow-sm">
            <div className="flex justify-between">
              <div>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                  {bill.category || 'Tax'}
                </span>
                <h3 className="font-bold text-lg">{bill.consumer_name}</h3>
                <p className="text-sm text-gray-500">{bill.billing_period}</p>
              </div>
              <p className="text-xl font-bold">₹{bill.amount}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Bills;
