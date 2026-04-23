import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, Trash, Pencil, Phone, MapPin, WhatsappLogo, DownloadSimple, ChatCircleDots } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';
import { TAX_CATEGORIES } from '../lib/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Consumers = () => {
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConsumer, setEditingConsumer] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', land_bigha: 0, land_katha: 0 });

  const fetchConsumers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/consumers`, { withCredentials: true });
      setConsumers(data.items || data);
    } catch (error) { toast.error('Failed to fetch consumers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConsumers(); }, [fetchConsumers]);

  const handleSendBillNotification = async (consumer, type) => {
    const loadingToast = toast.loading(`Preparing notification for ${consumer.name}...`);
    try {
      const response = await axios.post(`${API_URL}/api/sms/send-bill`, {
        consumer_id: consumer.id,
        land_area: `${consumer.land_bigha} Bigha, ${consumer.land_katha} Katha`,
        amount: consumer.total_due,
        period: "Current Dues",
        category: "Boro chas tax" // Default or pull from rate-config
      }, { withCredentials: true });

      if (type === 'sms') {
        if (response.data.sms_status === 'Success') toast.success("Bilingual SMS sent", { id: loadingToast });
        else toast.error("SMS Failed", { id: loadingToast });
      } else {
        window.open(response.data.whatsapp_url, '_blank');
        toast.dismiss(loadingToast);
      }
    } catch (error) { toast.error("Gateway error", { id: loadingToast }); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingConsumer) {
        await axios.put(`${API_URL}/api/consumers/${editingConsumer.id}`, formData, { withCredentials: true });
        toast.success('Updated');
      } else {
        await axios.post(`${API_URL}/api/consumers`, formData, { withCredentials: true });
        toast.success('Added');
      }
      setDialogOpen(false); resetForm(); await fetchConsumers();
    } catch (error) { toast.error('Failed to save'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return;
    try {
      await axios.delete(`${API_URL}/api/consumers/${id}`, { withCredentials: true });
      await fetchConsumers();
    } catch (error) { toast.error('Failed to delete'); }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', land_bigha: 0, land_katha: 0 });
    setEditingConsumer(null);
  };

  const openEditDialog = (consumer) => {
    setEditingConsumer(consumer);
    setFormData({ name: consumer.name, phone: consumer.phone, address: consumer.address, land_bigha: consumer.land_bigha, land_katha: consumer.land_katha });
    setDialogOpen(true);
  };

  const handleExport = (format) => {
    const headers = ['Name', 'Phone', 'Address', 'Bigha', 'Katha', 'Total Due'];
    const rows = consumers.map(c => [c.name, c.phone, c.address, c.land_bigha, c.land_katha, c.total_due]);
    format === 'csv' ? exportToCSV(rows, headers, 'consumers.csv') : exportToPDF(rows, headers, 'Consumers', 'consumers.pdf');
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-light">Consumers</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="rounded-full h-10 w-10 p-0"><Plus size={24} /></Button></DialogTrigger>
          <DialogContent className="rounded-xl">
            <DialogHeader><DialogTitle>{editingConsumer ? 'Edit' : 'Add'} Consumer</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input placeholder="Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              <Input placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
              <Input placeholder="Address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Bigha" value={formData.land_bigha} onChange={(e) => setFormData({...formData, land_bigha: parseFloat(e.target.value)})} />
                <Input type="number" placeholder="Katha" value={formData.land_katha} onChange={(e) => setFormData({...formData, land_katha: parseFloat(e.target.value)})} />
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {consumers.map((consumer, idx) => (
          <div key={consumer.id} className="bg-card border p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium">{consumer.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone size={14}/> {consumer.phone}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleSendBillNotification(consumer, 'sms')} className="text-blue-600"><ChatCircleDots size={20} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => handleSendBillNotification(consumer, 'whatsapp')} className="text-green-600"><WhatsappLogo size={20} weight="fill"/></Button>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(consumer)}><Pencil size={18}/></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(consumer.id)} className="text-destructive"><Trash size={18}/></Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t text-sm">
              <div><p className="text-muted-foreground">Bigha</p><p>{consumer.land_bigha}</p></div>
              <div><p className="text-muted-foreground">Katha</p><p>{consumer.land_katha}</p></div>
              <div><p className="text-muted-foreground">Due</p><p className="text-destructive font-bold">₹{consumer.total_due.toFixed(0)}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Consumers;

