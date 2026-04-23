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
import { TAX_CATEGORIES } from '../lib/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
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
      setPayments(paymentsRes.data.items || paymentsRes.data || []);
      setBills(billsRes.data.items || billsRes.data || []);
      setConsumers(consumersRes.data.items || consumersRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bill_id) return toast.error("Please select a bill.");
    if (!formData.amount || formData.amount <= 0) return toast.error("Please enter a valid amount.");

    try {
      const payload = { ...formData, amount: Number(formData.amount) };
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
    if (!window.confirm('Delete this payment record? This will add the due amount back to the farmer.')) return;
    try {
      await axios.delete(`${API_URL}/api/payments/${paymentId}`, { withCredentials: true });
      toast.success('Payment deleted successfully');
      await fetchData();
    } catch (error) {
      toast.error('Failed to delete payment');
    }
  };

  const handleSendSMS = async (payment) => {
    try {
      const bill = bills.find(b => String(b._id || b.id) === String(payment.bill_id)) || {};
      const consumerId = String(payment.consumer_id || bill.consumer_id);
      
      const payload = {
        consumer_id: consumerId,
        land_area: "Payment Receipt",
        amount: Number(payment.amount),
        period: new Date(payment.created_at).toLocaleDateString(),
        category: payment.category || "PAYMENT"
      };
      
      await axios.post(`${API_URL}/api/sms/send-bill`, payload, { withCredentials: true });
      toast.success(`Receipt SMS queued for ${payment.consumer_name}`);
    } catch (e) { 
      toast.error('Failed to send SMS. Check your API Key.'); 
    }
  };

  const sendWhatsApp = (payment) => {
    const bill = bills.find(b => String(b._id || b.id) === String(payment.bill_id)) || {};
    const consumerId = String(payment.consumer_id || bill.consumer_id);
    const consumer = consumers.find(c => String(c._id || c.id) === consumerId);

    if (!consumer?.phone) return toast.error("No phone number found for this farmer.");
    
    const msg = `নমস্কার ${payment.consumer_name},\nবিভাগ: ${(payment.category || 'বিল').toUpperCase()}\nজমা পরিমাণ: ₹${payment.amount}\nধন্যবাদ।`;
    window.open(`https://wa.me/91${consumer.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const resetForm = () => setFormData({ bill_id: '', amount: '', payment_method: 'cash', category: TAX_CATEGORIES[0], notes: '' });

  const handleExport = (format) => {
    if (payments.length === 0) return toast.error("No data to export");
    const headers = ['Farmer', 'Category', 'Amount', 'Method', 'Notes', 'Date'];
    const rows = payments.map(p => [
      p.consumer_name || 'Unknown', p.category?.toUpperCase() || '-', p.amount, p.payment_method, p.notes, new Date(p.created_at).toLocaleDateString()
    ]);
    format === 'csv' 
      ? exportToCSV(rows, headers, `Payments_${new Date().toLocaleDateString()}.csv`) 
      : exportToPDF(rows, headers, 'Payment Collection Report', `Payments_${new Date().toLocaleDateString()}.pdf`);
  };

  // STRICT MATH FIX: Ensures React accurately finds bills that have dues > 0
  const selectedBill = bills.find(b => String(b._id || b.id) === String(formData.bill_id));
  const unpaidBills = bills.filter(b => Number(b.due) > 0);

  if (loading) return <div className="p-12 text-center text-[#051039] font-black animate-pulse">Syncing Payments...</div>;

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-light text-[#051039]">Payments</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{payments.length} total records</p>
        </div>
        <div className="flex gap-2">
          {payments.length > 0 && (
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
              <DialogHeader><DialogTitle className="text-2xl font-light text-[#051039]">Record Payment</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                
                <Select value={formData.bill_id} onValueChange={(v) => setFormData({ ...formData, bill_id: v })} required>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg"><SelectValue placeholder="Select Pending Bill" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl max-h-60">
                    {unpaidBills.length === 0 ? (
                       <SelectItem value="none" disabled>No pending bills found</SelectItem>
                    ) : (
                      unpaidBills.map((b) => (
                        <SelectItem key={String(b._id || b.id)} value={String(b._id || b.id)}>
                          {b.consumer_name || 'Unknown'} - {b.category?.toUpperCase() || 'TAX'} (Due: ₹{Number(b.due || 0).toFixed(0)})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedBill && <p className="text-xs text-rose-500 font-bold ml-4">Current Due: ₹{Number(selectedBill.due || 0).toFixed(0)}</p>}

                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg"><SelectValue placeholder="Payment Category" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {TAX_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>

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
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Notes</Label>
                  <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional" className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" />
                </div>

                <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-2xl font-bold shadow-xl text-lg mt-2">Submit Payment</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-12 bg-white border border-slate-100 rounded-[2rem]">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No payments recorded</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {payments.map((payment) => (
            <div key={payment._id || payment.id} className="bg-white border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <span className="text-[10px] bg-blue-50 text-[#051039] px-3 py-1 rounded-full uppercase font-black border border-blue-100">
                    {payment.category || 'PAYMENT'}
                  </span>
                  <h3 className="text-xl font-bold text-slate-800 mt-3 leading-tight truncate pr-2">
                    {payment.consumer_name || 'Unknown Farmer'}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-tighter flex items-center gap-1">
                    <Calendar size={14} weight="fill"/> {new Date(payment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-white pl-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => sendWhatsApp(payment)} title="WhatsApp Receipt" className="text-emerald-500 rounded-full h-8 w-8 p-0"><WhatsappLogo size={22} weight="fill"/></Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleSendSMS(payment)} title="SMS Receipt" className="text-blue-500 rounded-full h-8 w-8 p-0"><ChatCircleDots size={22} weight="fill"/></Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(payment._id || payment.id)} title="Delete" className="text-rose-400 hover:text-rose-600 rounded-full h-8 w-8 p-0"><Trash size={20}/></Button>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-50 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-300 uppercase">Method</p>
                  <p className="text-sm font-bold text-slate-700 capitalize">{payment.payment_method?.replace('_', ' ') || 'Cash'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-300 uppercase">Notes</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{payment.notes || '-'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-300 uppercase">Amount Paid</p>
                  <p className="text-sm font-black text-emerald-600">₹{Number(payment.amount || 0).toFixed(0)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Payments;
