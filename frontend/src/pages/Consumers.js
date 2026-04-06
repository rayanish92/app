import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, Trash, Pencil } from '@phosphor-icons/react';
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

  useEffect(() => {
    fetchConsumers();
  }, []);

  const fetchConsumers = async () => {
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingConsumer) {
        await axios.put(
          `${API_URL}/api/consumers/${editingConsumer.id}`,
          formData,
          { withCredentials: true }
        );
        toast.success('Consumer updated successfully');
      } else {
        await axios.post(`${API_URL}/api/consumers`, formData, {
          withCredentials: true
        });
        toast.success('Consumer added successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchConsumers();
    } catch (error) {
      toast.error('Failed to save consumer');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this consumer?')) return;
    try {
      await axios.delete(`${API_URL}/api/consumers/${id}`, {
        withCredentials: true
      });
      toast.success('Consumer deleted successfully');
      fetchConsumers();
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

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="consumers-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl sm:text-5xl font-light tracking-tight text-foreground">
            Consumers
          </h1>
          <p className="mt-2 text-muted-foreground">{consumers.length} total consumers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              className="bg-primary hover:bg-[#152B23] text-primary-foreground"
              data-testid="add-consumer-button"
            >
              <Plus size={20} weight="bold" className="mr-2" />
              Add Consumer
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="consumer-dialog">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl font-light">
                {editingConsumer ? 'Edit Consumer' : 'Add New Consumer'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-xs uppercase tracking-[0.2em]">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="consumer-name-input"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs uppercase tracking-[0.2em]">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  data-testid="consumer-phone-input"
                />
              </div>
              <div>
                <Label htmlFor="address" className="text-xs uppercase tracking-[0.2em]">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  data-testid="consumer-address-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="land_bigha" className="text-xs uppercase tracking-[0.2em]">Land (Bigha)</Label>
                  <Input
                    id="land_bigha"
                    type="number"
                    step="0.01"
                    value={formData.land_bigha}
                    onChange={(e) => setFormData({ ...formData, land_bigha: parseFloat(e.target.value) || 0 })}
                    data-testid="consumer-land-bigha-input"
                  />
                </div>
                <div>
                  <Label htmlFor="land_katha" className="text-xs uppercase tracking-[0.2em]">Land (Katha)</Label>
                  <Input
                    id="land_katha"
                    type="number"
                    step="0.01"
                    value={formData.land_katha}
                    onChange={(e) => setFormData({ ...formData, land_katha: parseFloat(e.target.value) || 0 })}
                    data-testid="consumer-land-katha-input"
                  />
                </div>
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
                  data-testid="consumer-cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-[#152B23]"
                  data-testid="consumer-submit-button"
                >
                  {editingConsumer ? 'Update' : 'Add'} Consumer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {consumers.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-md">
          <p className="text-muted-foreground">No consumers yet. Add your first consumer to get started.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <table className="w-full" data-testid="consumers-table">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Name</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Phone</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Address</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Land (Bigha)</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Land (Katha)</th>
                <th className="text-left p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Total Due</th>
                <th className="text-right p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {consumers.map((consumer, idx) => (
                <tr key={consumer.id} className="border-b border-border last:border-0" data-testid={`consumer-row-${idx}`}>
                  <td className="p-4">{consumer.name}</td>
                  <td className="p-4">{consumer.phone}</td>
                  <td className="p-4">{consumer.address}</td>
                  <td className="p-4">{consumer.land_bigha}</td>
                  <td className="p-4">{consumer.land_katha}</td>
                  <td className="p-4">₹{consumer.total_due.toFixed(2)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(consumer)}
                        data-testid={`edit-consumer-${idx}`}
                      >
                        <Pencil size={18} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(consumer.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`delete-consumer-${idx}`}
                      >
                        <Trash size={18} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Consumers;