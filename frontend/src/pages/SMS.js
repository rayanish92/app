import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PaperPlaneTilt, User, Phone } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SMS = () => {
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    consumer_id: '',
    message: ''
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
    setSending(true);
    try {
      await axios.post(`${API_URL}/api/sms/send`, formData, {
        withCredentials: true
      });
      toast.success('SMS sent successfully');
      setFormData({ consumer_id: '', message: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const selectedConsumer = consumers.find(c => c.id === formData.consumer_id);

  const templates = [
    {
      label: 'Payment Reminder',
      text: (consumer) => `Dear ${consumer?.name || '[Consumer]'}, your water bill payment of ₹${consumer?.total_due.toFixed(0) || '[Amount]'} is due. Please pay at your earliest convenience. Thank you!`
    },
    {
      label: 'Payment Received',
      text: (consumer) => `Dear ${consumer?.name || '[Consumer]'}, we have received your payment. Thank you for your prompt payment!`
    },
    {
      label: 'Bill Generated',
      text: (consumer) => `Dear ${consumer?.name || '[Consumer]'}, your water bill has been generated. Total amount: ₹${consumer?.total_due.toFixed(0) || '[Amount]'}. Please pay soon.`
    }
  ];

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-4" data-testid="sms-page">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">
          Send SMS
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Send notifications to consumers</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-card border border-border p-4 rounded-xl">
          <Label htmlFor="consumer" className="text-xs uppercase tracking-wider mb-2 block">Select Consumer</Label>
          <Select
            value={formData.consumer_id}
            onValueChange={(value) => setFormData({ ...formData, consumer_id: value })}
            required
          >
            <SelectTrigger className="h-11" data-testid="sms-consumer-select">
              <SelectValue placeholder="Choose consumer" />
            </SelectTrigger>
            <SelectContent>
              {consumers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedConsumer && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">{selectedConsumer.phone}</span>
              </div>
              <div className="text-sm mt-1">
                <span className="text-muted-foreground">Due: </span>
                <span className="font-medium text-destructive">₹{selectedConsumer.total_due.toFixed(0)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border p-4 rounded-xl">
          <Label htmlFor="message" className="text-xs uppercase tracking-wider mb-2 block">Message</Label>
          <Textarea
            id="message"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            required
            rows={6}
            placeholder="Type your message here..."
            className="resize-none"
            data-testid="sms-message-input"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {formData.message.length} characters
          </p>
        </div>

        <Button
          type="submit"
          disabled={sending}
          className="w-full h-12 bg-primary hover:bg-[#152B23] text-primary-foreground rounded-xl"
          data-testid="sms-send-button"
        >
          <PaperPlaneTilt size={20} weight="bold" className="mr-2" />
          {sending ? 'Sending...' : 'Send SMS'}
        </Button>
      </form>

      <div className="bg-card border border-border p-4 rounded-xl">
        <h3 className="font-heading text-lg font-light mb-3">Quick Templates</h3>
        <div className="space-y-2">
          {templates.map((template, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setFormData({ ...formData, message: template.text(selectedConsumer) })}
              className="w-full text-left p-3 border border-border rounded-lg active:bg-muted"
              data-testid={`sms-template-${idx}`}
            >
              <div className="font-medium text-sm">{template.label}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {template.text(selectedConsumer)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-muted border border-border p-4 rounded-xl">
        <h3 className="font-heading text-base font-light mb-2">📱 SMS Info</h3>
        <p className="text-xs text-muted-foreground">
          SMS uses Twilio. Add credentials to backend .env to enable actual sending. Without credentials, messages are logged to console.
        </p>
      </div>
    </div>
  );
};

export default SMS;
