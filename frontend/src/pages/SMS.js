import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PaperPlaneTilt } from '@phosphor-icons/react';
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

  const quickMessages = [
    {
      label: 'Payment Reminder',
      text: `Dear [Consumer], Your water bill payment of ₹[Amount] is due. Please pay at your earliest convenience. Thank you!`
    },
    {
      label: 'Payment Received',
      text: `Dear [Consumer], We have received your payment of ₹[Amount]. Thank you for your prompt payment!`
    },
    {
      label: 'Bill Generated',
      text: `Dear [Consumer], Your water bill for this period has been generated. Total amount: ₹[Amount]. Please pay by [Date].`
    }
  ];

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6" data-testid="sms-page">
      <div>
        <h1 className="font-heading text-4xl sm:text-5xl font-light tracking-tight text-foreground">
          Send SMS
        </h1>
        <p className="mt-2 text-muted-foreground">Send notifications to consumers</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border p-6 rounded-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="consumer" className="text-xs uppercase tracking-[0.2em]">Select Consumer</Label>
              <Select
                value={formData.consumer_id}
                onValueChange={(value) => setFormData({ ...formData, consumer_id: value })}
                required
              >
                <SelectTrigger data-testid="sms-consumer-select">
                  <SelectValue placeholder="Select consumer" />
                </SelectTrigger>
                <SelectContent>
                  {consumers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} - {c.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedConsumer && (
                <p className="text-xs text-muted-foreground mt-1">
                  Phone: {selectedConsumer.phone} | Due: ₹{selectedConsumer.total_due.toFixed(2)}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="message" className="text-xs uppercase tracking-[0.2em]">Message</Label>
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
              <p className="text-xs text-muted-foreground mt-1">
                {formData.message.length} characters
              </p>
            </div>

            <Button
              type="submit"
              disabled={sending}
              className="w-full bg-primary hover:bg-[#152B23] text-primary-foreground"
              data-testid="sms-send-button"
            >
              <PaperPlaneTilt size={20} weight="bold" className="mr-2" />
              {sending ? 'Sending...' : 'Send SMS'}
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border p-6 rounded-md">
            <h3 className="font-heading text-lg font-light mb-4">Quick Templates</h3>
            <div className="space-y-2">
              {quickMessages.map((template, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => setFormData({ ...formData, message: template.text })}
                  data-testid={`sms-template-${idx}`}
                >
                  <div>
                    <div className="font-medium text-sm">{template.label}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {template.text}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-muted border border-border p-6 rounded-md">
            <h3 className="font-heading text-lg font-light mb-2">SMS Configuration</h3>
            <p className="text-sm text-muted-foreground">
              SMS functionality uses Twilio. To enable actual SMS sending, add your Twilio credentials
              to the backend .env file:
            </p>
            <ul className="text-xs text-muted-foreground mt-3 space-y-1">
              <li>• TWILIO_ACCOUNT_SID</li>
              <li>• TWILIO_AUTH_TOKEN</li>
              <li>• TWILIO_PHONE_NUMBER</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Without credentials, SMS messages will be logged to the backend console.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMS;