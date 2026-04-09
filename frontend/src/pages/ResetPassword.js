import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/reset-password`, {
        token,
        new_password: newPassword
      });
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to reset password';
      toast.error(typeof msg === 'string' ? msg : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background" data-testid="reset-password-page">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h2 className="font-heading text-3xl font-light tracking-tight text-foreground">
            Reset Password
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the reset token and your new password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token" className="text-xs uppercase tracking-[0.2em]">Reset Token</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="h-12"
              placeholder="Paste your reset token"
              data-testid="reset-token-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-xs uppercase tracking-[0.2em]">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={4}
              className="h-12"
              placeholder="New password"
              data-testid="reset-new-password-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-xs uppercase tracking-[0.2em]">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={4}
              className="h-12"
              placeholder="Confirm password"
              data-testid="reset-confirm-password-input"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary hover:bg-[#152B23]"
            data-testid="reset-submit-button"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
          <div className="text-center">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
