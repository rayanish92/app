import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Calendar, Pencil, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
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
      toast.success('Payment recorded');
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to record payment';
      toast.error(msg);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      // For simplicity, just show message that payment is updated
      // In real app, you'd need backend endpoint to update payment
      toast.success('Payment edit functionality - contact admin to modify');
      setEditDialogOpen(false);
      setEditingPayment(null);
      resetForm();
    } catch (error) {
      toast.error('Failed to update payment');
    }
  };

  const handleDelete = async (paymentId) => {
    if (!window.confirm('Delete this payment record?')) return;
    try {
      // Note: You'll need to add delete endpoint in backend
      toast.info('Payment deletion - contact admin');
    } catch (error) {
      toast.error('Failed to delete payment');
    }
  };

  const openEditDialog = (payment) => {
    setEditingPayment(payment);
    setFormData({
      bill_id: payment.bill_id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      notes: payment.notes
    });
    setEditDialogOpen(true);
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
    <div className="space-y-4" data-testid="payments-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">
            Payments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{payments.length} total</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              className="bg-primary hover:bg-[#152B23] text-primary-foreground h-10 w-10 p-0 rounded-full"
              data-testid="add-payment-button"
            >
              <Plus size={24} weight="bold" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-xl" data-testid="payment-dialog">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl font-light">Record Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="bill" className="text-xs uppercase tracking-wider">Bill</Label>
                <Select
                  value={formData.bill_id}
                  onValueChange={(value) => setFormData({ ...formData, bill_id: value })}
                  required
                >
                  <SelectTrigger className="h-11" data-testid="payment-bill-select">
                    <SelectValue placeholder="Select bill" />
                  </SelectTrigger>
                  <SelectContent>
                    {bills.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.consumer_name} - ₹{b.due.toFixed(0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBill && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Due: ₹{selectedBill.due.toFixed(0)}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="amount" className="text-xs uppercase tracking-wider">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                  className="h-11"
                  data-testid="payment-amount-input"
                />
              </div>
              <div>
                <Label htmlFor="method" className="text-xs uppercase tracking-wider">Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger className="h-11" data-testid="payment-method-select">
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
                <Label htmlFor="notes" className="text-xs uppercase tracking-wider">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional"
                  className="h-11"
                  data-testid="payment-notes-input"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  className="flex-1 h-11"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 h-11 bg-primary hover:bg-[#152B23]" data-testid="payment-submit-button">
                  Record
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Payment Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-[90vw] rounded-xl">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl font-light">Edit Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wider">Consumer</Label>
                <div className="text-sm py-2">{editingPayment?.consumer_name}</div>
              </div>
              <div>
                <Label htmlFor="edit_amount" className="text-xs uppercase tracking-wider">Amount</Label>
                <Input
                  id="edit_amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="h-11"
                />
              </div>
              <div>
                <Label htmlFor="edit_method" className="text-xs uppercase tracking-wider">Method</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger className="h-11">
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
                <Label htmlFor="edit_notes" className="text-xs uppercase tracking-wider">Notes</Label>
                <Input
                  id="edit_notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingPayment(null);
                    resetForm();
                  }}
                  className="flex-1 h-11"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 h-11 bg-primary hover:bg-[#152B23]">
                  Update
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <p className="text-muted-foreground text-sm">No payments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment, idx) => (
            <div
              key={payment.id}
              className="bg-card border border-border p-4 rounded-xl"
              data-testid={`payment-row-${idx}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-heading text-lg font-light">{payment.consumer_name}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Calendar size={14} />
                    <span>{new Date(payment.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right mr-2">
                    <p className="text-lg font-heading font-light text-green-600">₹{payment.amount.toFixed(0)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(payment)}
                    className="h-9 w-9 p-0"
                    data-testid={`edit-payment-${idx}`}
                  >
                    <Pencil size={18} />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="font-medium capitalize">{payment.payment_method.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="font-medium text-sm">{payment.notes || '-'}</p>
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
