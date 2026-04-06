import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    bill_id: '',
    amount: 0,
    payment_method: 'cash',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [paymentsRes, billsRes] = await Promise.all([
        axios.get(`${API_URL}/api/payments`, { withCredentials: true }),
        axios.get(`${API_URL}/api/bills`, { withCredentials: true })
      ]);
      setPayments(paymentsRes.data);
      setBills(billsRes.data.filter(b => b.due > 0));
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/payments`, formData, {
        withCredentials: true
      });
      toast.success('Payment recorded successfully');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to record payment';
      toast.error(msg);
    }
  };

  const resetForm = () => {
    setFormData({
      bill_id: '',
      amount: 0,
      payment_method: 'cash',
      notes: ''
    });
  };

  const selectedBill = bills.find(b => b.id === formData.bill_id);

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="payments-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl sm:text-5xl font-light tracking-tight text-foreground">
            Payments
          </h1>
          <p className="mt-2 text-muted-foreground">{payments.length} total payments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              className="bg-primary hover:bg-[#152B23] text-primary-foreground"
              data-testid="add-payment-button"
            >
              <Plus size={20} weight="bold" className="mr-2" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="payment-dialog">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl font-light">Record Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="bill" className="text-xs uppercase tracking-[0.2em]">Bill</Label>
                <Select
                  value={formData.bill_id}
                  onValueChange={(value) => setFormData({ ...formData, bill_id: value })}
                  required
                >
                  <SelectTrigger data-testid="payment-bill-select">
                    <SelectValue placeholder="Select bill" />
                  </SelectTrigger>
                  <SelectContent>
                    {bills.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.consumer_name} - {b.billing_period} (Due: ₹{b.due.toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBill && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Outstanding due: ₹{selectedBill.due.toFixed(2)}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="amount" className="text-xs uppercase tracking-[0.2em]">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                  data-testid="payment-amount-input"
                />
              </div>
              <div>
                <Label htmlFor="method" className="text-xs uppercase tracking-[0.2em]">Payment Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger data-testid="payment-method-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes" className="text-xs uppercase tracking-[0.2em]">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any additional notes"
                  data-testid="payment-notes-input"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-primary hover:bg-[#152B23]" data-testid="payment-submit-button">
                  Record Payment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-md">
          <p className="text-muted-foreground">No payments yet. Record your first payment to get started.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="w-full" data-testid="payments-table">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Date</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Consumer</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Amount</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Method</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, idx) => (
                <tr key={payment.id} className="border-b border-border last:border-0" data-testid={`payment-row-${idx}`}>
                  <td className="p-4">{new Date(payment.created_at).toLocaleDateString()}</td>
                  <td className="p-4">{payment.consumer_name}</td>
                  <td className="p-4 text-green-600">₹{payment.amount.toFixed(2)}</td>
                  <td className="p-4 capitalize">{payment.payment_method.replace('_', ' ')}</td>
                  <td className="p-4 text-muted-foreground">{payment.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Payments;