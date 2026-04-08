import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, Trash, Pencil, Phone, MapPin, WhatsappLogo } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Consumers = () => {
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConsumer, setEditingConsumer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    land_bigha: 0,
    land_katha: 0
  });

  const fetchConsumers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/consumers`, {
        withCredentials: true
      });
      setConsumers(data);
    } catch (error) {
      toast.error('Failed to fetch consumers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsumers();
  }, [fetchConsumers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingConsumer) {
        await axios.put(
          `${API_URL}/api/consumers/${editingConsumer.id}`,
          formData,
          { withCredentials: true }
        );
        toast.success('Consumer updated');
      } else {
        await axios.post(`${API_URL}/api/consumers`, formData, {
          withCredentials: true
        });
        toast.success('Consumer added');
      }
      setDialogOpen(false);
      resetForm();
      await fetchConsumers();
    } catch (error) {
      toast.error('Failed to save consumer');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this consumer?')) return;
    try {
      await axios.delete(`${API_URL}/api/consumers/${id}`, {
        withCredentials: true
      });
      toast.success('Consumer deleted');
      await fetchConsumers();
    } catch (error) {
      toast.error('Failed to delete consumer');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      land_bigha: 0,
      land_katha: 0
    });
    setEditingConsumer(null);
  };

  const openEditDialog = (consumer) => {
    setEditingConsumer(consumer);
    setFormData({
      name: consumer.name,
      phone: consumer.phone,
      address: consumer.address,
      land_bigha: consumer.land_bigha,
      land_katha: consumer.land_katha
    });
    setDialogOpen(true);
  };

  const sendWhatsApp = (consumer) => {
    const message = `নমস্কার ${consumer.name},\n\nআপনার জলের বিল বিবরণ:\nমোট বকেয়া: ₹${consumer.total_due.toFixed(0)}\n\nদয়া করে যত তাড়াতাড়ি সম্ভব পরিশোধ করুন।\n\nধন্যবাদ!\n\n---\n\nHello ${consumer.name},\n\nYour water bill details:\nTotal Due: ₹${consumer.total_due.toFixed(0)}\n\nPlease pay at your earliest convenience.\n\nThank you!`;
    const whatsappUrl = `https://wa.me/91${consumer.phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-4" data-testid="consumers-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">
            Consumers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{consumers.length} total</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              className="bg-primary hover:bg-[#152B23] text-primary-foreground h-10 w-10 p-0 rounded-full"
              data-testid="add-consumer-button"
            >
              <Plus size={24} weight="bold" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-xl" data-testid="consumer-dialog">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl font-light">
                {editingConsumer ? 'Edit Consumer' : 'Add Consumer'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="name" className="text-xs uppercase tracking-wider">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="h-11"
                  data-testid="consumer-name-input"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs uppercase tracking-wider">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="h-11"
                  placeholder="10-digit number"
                  data-testid="consumer-phone-input"
                />
              </div>
              <div>
                <Label htmlFor="address" className="text-xs uppercase tracking-wider">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="h-11"
                  data-testid="consumer-address-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="land_bigha" className="text-xs uppercase tracking-wider">Bigha</Label>
                  <Input
                    id="land_bigha"
                    type="number"
                    step="0.01"
                    value={formData.land_bigha}
                    onChange={(e) => setFormData({ ...formData, land_bigha: parseFloat(e.target.value) || 0 })}
                    className="h-11"
                    data-testid="consumer-land-bigha-input"
                  />
                </div>
                <div>
                  <Label htmlFor="land_katha" className="text-xs uppercase tracking-wider">Katha</Label>
                  <Input
                    id="land_katha"
                    type="number"
                    step="0.01"
                    value={formData.land_katha}
                    onChange={(e) => setFormData({ ...formData, land_katha: parseFloat(e.target.value) || 0 })}
                    className="h-11"
                    data-testid="consumer-land-katha-input"
                  />
                </div>
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
                  data-testid="consumer-cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 bg-primary hover:bg-[#152B23]"
                  data-testid="consumer-submit-button"
                >
                  {editingConsumer ? 'Update' : 'Add'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {consumers.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <p className="text-muted-foreground text-sm">No consumers yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consumers.map((consumer, idx) => (
            <div
              key={consumer.id}
              className="bg-card border border-border p-4 rounded-xl"
              data-testid={`consumer-row-${idx}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-heading text-lg font-light">{consumer.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Phone size={14} />
                    <span>{consumer.phone}</span>
                  </div>
                  {consumer.address && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin size={14} />
                      <span>{consumer.address}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => sendWhatsApp(consumer)}
                    className="h-9 w-9 p-0 text-green-600 hover:text-green-600"
                    data-testid={`whatsapp-consumer-${idx}`}
                  >
                    <WhatsappLogo size={20} weight="fill" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(consumer)}
                    className="h-9 w-9 p-0"
                    data-testid={`edit-consumer-${idx}`}
                  >
                    <Pencil size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(consumer.id)}
                    className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                    data-testid={`delete-consumer-${idx}`}
                  >
                    <Trash size={18} />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Bigha</p>
                  <p className="font-medium">{consumer.land_bigha}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Katha</p>
                  <p className="font-medium">{consumer.land_katha}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due</p>
                  <p className="font-medium text-destructive">₹{consumer.total_due.toFixed(0)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Consumers;