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

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="p-10 m-10 bg-rose-50 border border-rose-200 rounded-[2rem]">Crash Detected. Please refresh.</div>;
    return this.props.children;
  }
}

const PaymentsContent = () => {
  const [payments, setPayments] = useState([]);
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isOthersCat, setIsOthersCat] = useState(false);
  const [customCatName, setCustomCatName] = useState('');

  const [formData, setFormData] = useState({
    bill_id: '', amount: '', payment_method: 'cash', category: TAX_CATEGORIES[0], notes: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const [paymentsRes, billsRes, consumersRes] = await Promise.all([
        axios.get(`${API_URL}/api/payments`, { withCredentials: true }),
        axios.get(`${API_URL}/api/bills`, { withCredentials: true }),
        axios.get(`${API_URL}/api/consumers`, { withCredentials: true })
      ]);
      
      setPayments(Array.isArray(paymentsRes.data?.items) ? paymentsRes.data.items : []);
      setBills(Array.isArray(billsRes.data?.items) ? billsRes.data.items : []);
      setConsumers(Array.isArray(consumersRes.data?.items) ? consumersRes.data.items : []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    if (!formData.bill_id) return toast.error("Please select a bill.");
    if (!formData.amount || Number(formData.amount) <= 0) return toast.error("Please enter a valid amount.");
    if (isOthersCat && !customCatName) return toast.error("Please enter the custom tax name.");

    try {
      const finalCategory = isOthersCat ? customCatName : formData.category;
      const payload = { ...formData, category: finalCategory, amount: Number(formData.amount) };
      await axios.post(`${API_URL}/api/payments`, payload, { withCredentials: true });
      toast.success('Payment recorded');
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    }
  };

  const handleDelete = async (paymentId) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await axios.delete(`${API_URL}/api/payments/${paymentId}`, { withCredentials: true });
      toast.success('Payment deleted successfully');
      await fetchData();
    } catch (error) { toast.error('Failed to delete payment'); }
  };

  const handleSendSMS = async (payment) => {
    try {
      const bill = bills.find(b => String(b._id || b.id) === String(payment.bill_id)) || {};
      const consumerId = String(payment.consumer_id || bill.consumer_id);
      
      const payload = {
        consumer_id: consumerId,
        land_area: getLandText(consumerId),
        amount: Number(payment.amount || 0),
        period: "Recent",
        category: payment.category || "PAYMENT"
      };
      
      await axios.post(`${API_URL}/api/sms/send-bill`, payload, { withCredentials: true });
      toast.success('Receipt SMS queued');
    } catch (e) { toast.error('Failed to send SMS.'); }
  };

  const sendWhatsApp = (payment) => {
    const bill = bills.find(b => String(b._id || b.id) === String(payment.bill_id)) || {};
    const consumerId = String(payment.consumer_id || bill.consumer_id);
    const consumer = consumers.find(c => String(c._id || c.id) === consumerId);
    
    if (!consumer?.phone) return toast.error("No phone number found.");
    
    const farmerName = getFarmerName(consumerId, payment.consumer_name);
    const catText = getBengaliCategory(payment.category);
    const landText = getLandText(consumerId);
    
    const msg = `নমস্কার ${farmerName},\nবিভাগ: ${catText}\nজমি: ${landText}\nজমা পরিমাণ: ₹${Number(payment.amount || 0)}\nধন্যবাদ।`;
    window.open(`https://wa.me/91${consumer.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const resetForm = () => {
    setFormData({ bill_id: '', amount: '', payment_method: 'cash', category: TAX_CATEGORIES[0], notes: '' });
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

  const selectedBill = bills.find(b => String(b._id || b.id) === String(formData.bill_id));
  const unpaidBills = bills.filter(b => Number(b.due || 0) > 0);

  if (loading) return <div className="p-12 text-center font-black animate-pulse">Syncing...</div>;

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-light text-[#051039]">Payments</h1>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-12 w-12 bg-[#051039] text-white shadow-xl hover:scale-110">
                <Plus size={28} />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-8 md:p-10 max-w-lg border-none shadow-3xl">
              <DialogHeader><DialogTitle className="text-2xl font-light text-[#051039]">Record Payment</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                
                <Select value={formData.bill_id} onValueChange={(v) => setFormData({ ...formData, bill_id: v })} required>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg"><SelectValue placeholder="Select Pending Bill" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl max-h-60">
                    {unpaidBills.map((b) => (
                      <SelectItem key={String(b._id || b.id)} value={String(b._id || b.id)}>
                        {getFarmerName(b.consumer_id, b.consumer_name)} - {b.category?.toUpperCase()} (Due: ₹{Number(b.due || 0).toFixed(0)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBill && <p className="text-xs text-rose-500 font-bold ml-4">Current Due: ₹{Number(selectedBill.due || 0).toFixed(0)}</p>}

                <Select value={formData.category} onValueChange={handleCategorySelect}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg"><SelectValue placeholder="Payment Category" /></SelectTrigger>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Amount (₹)</Label>
                    <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Method</Label>
                    <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                      <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-2xl font-bold shadow-xl text-lg mt-2">Submit Payment</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {payments.map((payment) => (
          <div key={payment._id || payment.id} className="bg-white border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <span className="text-[10px] bg-blue-50 text-[#051039] px-3 py-1 rounded-full uppercase font-black border border-blue-100">
                  {payment.category ? String(payment.category).toUpperCase() : 'PAYMENT'}
                </span>
                <h3 className="text-xl font-bold text-slate-800 mt-3 leading-tight truncate pr-2">
                  {getFarmerName(payment.consumer_id, payment.consumer_name)}
                </h3>
              </div>
              <div className="flex flex-col gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-white pl-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => sendWhatsApp(payment)} title="WhatsApp Receipt" className="text-emerald-500 rounded-full h-8 w-8 p-0"><WhatsappLogo size={22} weight="fill"/></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleSendSMS(payment)} title="SMS Receipt" className="text-blue-500 rounded-full h-8 w-8 p-0"><ChatCircleDots size={22} weight="fill"/></Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(payment._id || payment.id)} title="Delete" className="text-rose-400 hover:text-rose-600 rounded-full h-8 w-8 p-0"><Trash size={20}/></Button>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-50 grid grid-cols-3 gap-2">
              <div className="text-right col-span-3">
                <p className="text-[10px] font-bold text-slate-300 uppercase">Amount Paid</p>
                <p className="text-sm font-black text-emerald-600">₹{Number(payment.amount || 0).toFixed(0)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Payments = () => <ErrorBoundary><PaymentsContent /></ErrorBoundary>;
export default Payments;
