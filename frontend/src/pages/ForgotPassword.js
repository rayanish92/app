import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email });
      setSubmitted(true);
      toast.success('Reset link generated. Check server console.');
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background" data-testid="forgot-password-page">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h2 className="font-heading text-3xl font-light tracking-tight text-foreground">
            Forgot Password
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email to receive a reset token
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-sm text-green-800" data-testid="reset-success-message">
              If the email exists, a reset token has been generated. Check the server console for the reset link.
            </div>
            <div className="space-y-2">
              <Button
                onClick={() => navigate('/reset-password')}
                className="w-full h-12 bg-primary hover:bg-[#152B23]"
                data-testid="go-to-reset-button"
              >
                Enter Reset Token
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/login')}
                className="w-full h-12"
              >
                Back to Login
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em]">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
                placeholder="your@email.com"
                data-testid="forgot-email-input"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-[#152B23]"
              data-testid="forgot-submit-button"
            >
              {loading ? 'Sending...' : 'Send Reset Token'}
            </Button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
