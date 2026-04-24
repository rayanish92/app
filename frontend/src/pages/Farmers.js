import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
// FIX: Reverted to DownloadSimple to ensure compatibility with your icon library
import { Plus, Trash, Pencil, Phone, WhatsappLogo, ChatCircleDots, DownloadSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// --- ERROR BOUNDARY SAFETY NET ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 m-10 max-w-3xl mx-auto bg-rose-50 border border-rose-200 rounded-[2rem] text-rose-900 shadow-xl">
          <h1 className="text-2xl font-black mb-2">React Crash Detected 🚨</h1>
          <p className="font-medium text-rose-700">The white screen was blocked. Please copy the error below and send it to me:</p>
          <pre className="mt-4 p-6 bg-white rounded-xl overflow-auto text-xs font-mono text-slate-800 border border-rose-100">
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- MAIN CONTENT ---
const FarmersContent = () => {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', land_bigha: 0, land_katha: 0 });

  const fetchData = useCallback(async () => {
    try {
      const [fRes, bRes] = await Promise.all([
        axios.get(`${API_URL}/api/consumers`, { withCredentials: true }),
        axios.get(`${API_URL}/api/bills`, { withCredentials: true })
      ]);
      
      const fetchedFarmers = Array.isArray(fRes.data?.items) ? fRes.data.items : (Array.isArray(fRes.data) ? fRes.data : []);
      const fetchedBills = Array.isArray(bRes.data?.items) ? bRes.data.items : (Array.isArray(bRes.data) ? bRes.data : []);

      const processedFarmers = fetchedFarmers.map(farmer => {
        const farmerId = String(farmer._id || farmer.id);
        const farmerBills = fetchedBills.filter(b => String(b.consumer_id) === farmerId);

        const stats = farmerBills.reduce((acc, bill) => {
          acc.amount += Number(bill.amount || 0);
          acc.paid += Number(bill.paid || 0);
          acc.due += Number(bill.due || 0);
          
          const cat = String(bill.category || 'Unknown').toUpperCase();
          acc.landByCategory[cat] = (acc.landByCategory[cat] || 0) + Number(bill.total_land_in_bigha || 0);
          
          return acc;
        }, { amount: 0, paid: 0, due: 0, landByCategory: {} });

        return { ...farmer, ...stats };
      });

      setFarmers(processedFarmers);
    } catch (error) { 
      toast.error('Failed to fetch farmer data'); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSendBillNotification = async (farmer, type) => {
    const loadingToast = toast.loading(`Preparing notification for ${farmer.name}...`);
    try {
      const landText = `${farmer.land_bigha || 0} বিঘা, ${farmer.land_katha || 0} কাঠা`;
      
      const response = await axios.post(`${API_URL}/api/sms/send-bill`, {
        consumer_id: String(farmer.id || farmer._id),
        land_area: landText,
        amount: Number(farmer.due || 0),
        period: "Current Dues",
        category: "WATER TAX" // You can set this to default to something else if needed
      }, { withCredentials: true });

      if (type === 'sms') {
        if (response.data.sms_status === 'Sent' || response.data.sms_status === 'Success') {
          toast.success("SMS sent successfully", { id: loadingToast });
        } else {
          toast.error("SMS Failed", { id: loadingToast });
        }
      } else {
        // Build direct WhatsApp fallback just in case backend link fails
        const msg = `নমস্কার ${farmer.name},\nবিভাগ: জলের বিল\nজমি: ${landText}\nবাকি পরিমাণ: ₹${Number(farmer.due || 0).toFixed(0)}\nধন্যবাদ।`;
        const waUrl = response.data.whatsapp_url || `https://wa.me/91${farmer.phone}?text=${encodeURIComponent(msg)}`;
        
        window.open(waUrl, '_blank');
        toast.dismiss(loadingToast);
      }
    } catch (error) { 
      toast.error("Failed to send message", { id: loadingToast }); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFarmer) {
        const id = editingFarmer._id || editingFarmer.id;
        await axios.put(`${API_URL}/api/consumers/${id}`, formData, { withCredentials: true });
        toast.success('Farmer updated');
      } else {
        await axios.post(`${API_URL}/api/consumers`, formData, { withCredentials: true });
        toast.success('Farmer added');
      }
      setDialogOpen(false); 
      resetForm(); 
      await fetchData();
    } catch (error) { 
      toast.error('Failed to save farmer data'); 
    }
  };

  const handleDelete = async (farmer) => {
    if (!window.confirm(`Are you sure you want to delete ${farmer.name}?`)) return;
    try {
      const id = farmer._id || farmer.id;
      await axios.delete(`${API_URL}/api/consumers/${id}`, { withCredentials: true });
      toast.success('Farmer deleted');
      await fetchData();
    } catch (error) { 
      toast.error('Failed to delete farmer'); 
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', land_bigha: 0, land_katha: 0 });
    setEditingFarmer(null);
  };

  const openEditDialog = (farmer) => {
    setEditingFarmer(farmer);
    setFormData({ 
      name: farmer.name || '', 
      phone: farmer.phone || '', 
      address: farmer.address || '', 
      land_bigha: Number(farmer.land_bigha || 0), 
      land_katha: Number(farmer.land_katha || 0) 
    });
    setDialogOpen(true);
  };

  const handleExport = (format) => {
    const headers = ['Name', 'Phone', 'Registered Bigha', 'Registered Katha', 'Total Billed', 'Paid', 'Due'];
    const rows = farmers.map(f => [
      f.name || 'Unknown', 
      f.phone || 'N/A', 
      f.land_bigha || 0, 
      f.land_katha || 0, 
      Number(f.amount || 0).toFixed(2), 
      Number(f.paid || 0).toFixed(2), 
      Number(f.due || 0).toFixed(2)
    ]);
    format === 'csv' 
      ? exportToCSV(rows, headers, `Farmers_${new Date().toLocaleDateString()}.csv`) 
      : exportToPDF(rows, headers, 'Farmer Registry', `Farmers_${new Date().toLocaleDateString()}.pdf`);
  };

  if (loading) return <div className="p-12 text-center text-[#051039] font-black animate-pulse">Loading Farmers...</div>;

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-light text-[#051039]">Farmers</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{farmers.length} registered</p>
        </div>
        <div className="flex gap-2">
          {/* FIX: Using DownloadSimple icon which is verified to work on your build */}
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><DownloadSimple size={20} className="text-green-600 mr-1"/> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><DownloadSimple size={20} className="text-red-600 mr-1"/> PDF</Button>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-12 w-12 bg-[#051039] text-white shadow-xl transition-all hover:scale-110 active:scale-95">
                <Plus size={28} />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-8 md:p-10 max-w-lg border-none shadow-3xl">
              <DialogHeader><DialogTitle className="text-2xl font-light text-[#051039]">{editingFarmer ? 'Edit' : 'Register'} Farmer</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <Input className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" placeholder="Full Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                <Input className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" placeholder="Phone Number" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                <Input className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" placeholder="Village / Address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase ml-2">Base Bigha</p>
                    <Input type="number" step="0.01" className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" placeholder="Bigha" value={formData.land_bigha} onChange={(e) => setFormData({...formData, land_bigha: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase ml-2">Base Katha</p>
                    <Input type="number" step="0.01" className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" placeholder="Katha" value={formData.land_katha} onChange={(e) => setFormData({...formData, land_katha: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>
                <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-2xl font-bold shadow-xl text-lg mt-2">Save Farmer</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {farmers.map((farmer) => (
          <div key={farmer._id || farmer.id} className="bg-white border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between">
            
            <div>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-800 leading-tight truncate pr-2">{farmer.name || 'Unknown'}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1"><Phone size={14} weight="fill"/> {farmer.phone || 'N/A'}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleSendBillNotification(farmer, 'whatsapp')} title="WhatsApp" className="text-emerald-500 rounded-full h-8 w-8 p-0"><WhatsappLogo size={20} weight="fill"/></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleSendBillNotification(farmer, 'sms')} title="SMS" className="text-blue-500 rounded-full h-8 w-8 p-0"><ChatCircleDots size={20} weight="fill"/></Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(farmer)} title="Edit" className="text-slate-400 hover:text-[#051039] rounded-full h-8 w-8 p-0"><Pencil size={18}/></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(farmer)} title="Delete" className="text-rose-400 hover:text-rose-600 rounded-full h-8 w-8 p-0"><Trash size={18}/></Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {farmer.landByCategory && Object.keys(farmer.landByCategory).length > 0 ? (
                  Object.entries(farmer.landByCategory).map(([cat, amount]) => (
                    <span key={cat} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold border border-slate-200">
                      {cat.split(' ').slice(0, 2).join(' ')}: {Number(amount).toFixed(2)}B
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-1 rounded-md font-bold italic">No active bills</span>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                <p className="text-sm font-bold text-slate-700">₹{Number(farmer.amount || 0).toFixed(0)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Paid</p>
                <p className="text-sm font-bold text-emerald-600">₹{Number(farmer.paid || 0).toFixed(0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-rose-400 uppercase">Due</p>
                <p className="text-sm font-black text-rose-600">₹{Number(farmer.due || 0).toFixed(0)}</p>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};

// Wraps the component with the safety net before exporting
const Farmers = () => (
  <ErrorBoundary>
    <FarmersContent />
  </ErrorBoundary>
);

export default Farmers;
