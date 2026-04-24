import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Calendar, Pencil, Trash, DownloadSimple, WhatsappLogo, ChatCircleDots } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';
import { TAX_CATEGORIES, getBengaliCategory } from '../lib/constants';

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
          <p className="font-medium text-rose-700">Please copy the error below and send it to me:</p>
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
const BillsContent = () => {
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isOthersCat, setIsOthersCat] = useState(false);
  const [customCatName, setCustomCatName] = useState('');

  const [formData, setFormData] = useState({
    consumer_id: '', amount: '', category: TAX_CATEGORIES[0], notes: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [billsRes, consumersRes] = await Promise.all([
        axios.get(`${API_URL}/api/bills`, { withCredentials: true }),
        axios.get(`${API_URL}/api/consumers`, { withCredentials: true })
      ]);
      
      setBills(Array.isArray(billsRes.data?.items) ? billsRes.data.items : (Array.isArray(billsRes.data) ? billsRes.data : []));
      setConsumers(Array.isArray(consumersRes.data?.items) ? consumersRes.data.items : (Array.isArray(consumersRes.data) ? consumersRes.data : []));
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- SMART LOOKUPS ---
  const getFarmerName = (consumerId, fallbackName) => {
    const farmer = consumers.find(c => String(c._id || c.id) === String(consumerId));
    if (farmer && farmer.name) return farmer.name;
    return fallbackName || 'Unknown Farmer';
  };

  const getLandText = (consumerId) => {
    const farmer = consumers.find(c => String(c._id || c.id) === String(consumerId)) || {};
    return `${farmer.land_bigha || 0} বিঘা, ${farmer.land_katha || 0} কাঠা`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.consumer_id) return toast.error("Please select a farmer.");
    if (!formData.amount || Number(formData.amount) <= 0) return toast.error("Please enter a valid amount.");
    if (isOthersCat && !customCatName) return toast.error("Please enter the custom tax name.");

    try {
      const finalCategory = isOthersCat ? customCatName : formData.category;
      const payload = { ...formData, category: finalCategory, amount: Number(formData.amount) };
      
      await axios.post(`${API_URL}/api/bills`, payload, { withCredentials: true });
      toast.success('Bill generated successfully');
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate bill');
    }
  };

  const handleDelete = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;
    try {
      await axios.delete(`${API_URL}/api/bills/${billId}`, { withCredentials: true });
      toast.success('Bill deleted successfully');
      await fetchData();
    } catch (error) { toast.error('Failed to delete bill'); }
  };

  // --- BENGALI MESSAGING LOGIC ---
  const handleSendSMS = async (bill) => {
    try {
      const consumerId = String(bill.consumer_id);
      const farmerName = getFarmerName(consumerId, bill.consumer_name);
      
      const payload = {
        consumer_id: consumerId,
        land_area: getLandText(consumerId),
        amount: Number(bill.due || bill.amount || 0),
        period: "Current Bill",
        category: bill.category || "WATER TAX"
      };
      
      await axios.post(`${API_URL}/api/sms/send-bill`, payload, { withCredentials: true });
      toast.success(`Bill SMS queued for ${farmerName}`);
    } catch (e) { toast.error('Failed to send SMS. Check your API Key.'); }
  };

  const sendWhatsApp = (bill) => {
    const consumerId = String(bill.consumer_id);
    const consumer = consumers.find(c => String(c._id || c.id) === consumerId);
    
    if (!consumer?.phone) return toast.error("No phone number found for this farmer.");
    
    const farmerName = getFarmerName(consumerId, bill.consumer_name);
    const catText = getBengaliCategory(bill.category);
    const landText = getLandText(consumerId);
    
    const msg = `নমস্কার ${farmerName},\nবিভাগ: ${catText}\nজমি: ${landText}\nমোট বিল: ₹${Number(bill.amount || 0)}\nবাকি: ₹${Number(bill.due || 0)}\nধন্যবাদ।`;
    window.open(`https://wa.me/91${consumer.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const resetForm = () => {
    setFormData({ consumer_id: '', amount: '', category: TAX_CATEGORIES[0], notes: '' });
    setIsOthersCat(false);
    setCustomCatName('');
  };

  const handleCategorySelect = (val) => {
    if (val === 'others water tax') {
      setIsOthersCat(true);
      setFormData({ ...formData, category: val });
    } else {
      setIsOthersCat(false);
      setFormData({ ...formData, category: val });
    }
  };

  const handleExport = (format) => {
    if (bills.length === 0) return toast.error("No data to export");
    const headers = ['Farmer', 'Category', 'Total Amount', 'Paid', 'Due', 'Date', 'Notes'];
    const rows = bills.map(b => [
      getFarmerName(b.consumer_id, b.consumer_name), 
      b.category ? String(b.category).toUpperCase() : '-', 
      Number(b.amount || 0),
      Number(b.paid || 0),
      Number(b.due || 0),
      b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A',
      b.notes || '-'
    ]);
    format === 'csv' 
      ? exportToCSV(rows, headers, `Bills_${new Date().toLocaleDateString()}.csv`) 
      : exportToPDF(rows, headers, 'Water Bills Report', `Bills_${new Date().toLocaleDateString()}.pdf`);
  };

  if (loading) return <div className="p-12 text-center text-[#051039] font-black animate-pulse">Syncing Bills...</div>;

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-light text-[#051039]">Bills</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{bills.length} total records</p>
        </div>
        <div className="flex gap-2">
          {bills.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><DownloadSimple size={20} className="text-green-600"/></Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}><DownloadSimple size={20} className="text-red-600"/></Button>
            </>
          )}
          
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-12 w-12 bg-[#051039] text-white shadow-xl transition-all hover:scale-110 active:scale-95">
                <Plus size={28} />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-8 md:p-10 max-w-lg border-none shadow-3xl">
              <DialogHeader><DialogTitle className="text-2xl font-light text-[#051039]">Generate New Bill</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                
                <Select value={formData.consumer_id} onValueChange={(v) => setFormData({ ...formData, consumer_id: v })} required>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg"><SelectValue placeholder="Select Farmer" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl max-h-60">
                    {consumers.map((c) => (
                      <SelectItem key={String(c._id || c.id)} value={String(c._id || c.id)}>
                        {c.name || 'Unknown'} - {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={formData.category} onValueChange={handleCategorySelect}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg"><SelectValue placeholder="Bill Category" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {TAX_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* THE NEW CUSTOM TAX INPUT FIELD */}
                {isOthersCat && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    <Label className="text-[10px] font-bold text-emerald-600 uppercase ml-2">Enter Tax Name (Bengali Preferred)</Label>
                    <Input 
                      placeholder="e.g., নতুন জল ট্যাক্স" 
                      value={customCatName} 
                      onChange={(e) => setCustomCatName(e.target.value)} 
                      className="h-14 rounded-2xl bg-emerald-50 border-emerald-100 px-6 text-lg mt-1" 
                      required 
                    />
                  </div>
                )}

                <div>
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Total Amount (₹)</Label>
                  <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" />
                </div>

                <div>
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Notes</Label>
                  <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional details..." className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" />
                </div>

                <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-2xl font-bold shadow-xl text-lg mt-2">Generate Bill</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-100 rounded-[2rem]">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No bills generated</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bills.map((bill) => (
            <div key={bill._id || bill.id} className="bg-white border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col justify-between">
              
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-[10px] bg-purple-50 text-purple-700 px-3 py-1 rounded-full uppercase font-black border border-purple-100">
                      {bill.category ? String(bill.category).toUpperCase() : 'WATER TAX'}
                    </span>
                    <h3 className="text-xl font-bold text-slate-800 mt-3 leading-tight truncate pr-2">
                      {/* SMART NAME LOOKUP */}
                      {getFarmerName(bill.consumer_id, bill.consumer_name)}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-tighter flex items-center gap-1">
                      <Calendar size={14} weight="fill"/> {bill.created_at ? new Date(bill.created_at).toLocaleDateString() : 'Unknown Date'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-white pl-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => sendWhatsApp(bill)} title="WhatsApp Bill" className="text-emerald-500 rounded-full h-8 w-8 p-0"><WhatsappLogo size={22} weight="fill"/></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleSendSMS(bill)} title="SMS Bill" className="text-blue-500 rounded-full h-8 w-8 p-0"><ChatCircleDots size={22} weight="fill"/></Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(bill._id || bill.id)} title="Delete" className="text-rose-400 hover:text-rose-600 rounded-full h-8 w-8 p-0"><Trash size={20}/></Button>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Notes</p>
                  <p className="text-sm font-medium text-slate-600 truncate">{bill.notes || 'No additional notes'}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-300 uppercase">Total Billed</p>
                  <p className="text-lg font-bold text-slate-700">₹{Number(bill.amount || 0).toFixed(0)}</p>
                </div>
                <div className="text-right bg-rose-50 p-2 rounded-xl border border-rose-100">
                  <p className="text-[10px] font-bold text-rose-400 uppercase">Pending Due</p>
                  <p className="text-lg font-black text-rose-600">₹{Number(bill.due || 0).toFixed(0)}</p>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Wraps the component with the safety net
const Bills = () => (
  <ErrorBoundary>
    <BillsContent />
  </ErrorBoundary>
);

export default Bills;
