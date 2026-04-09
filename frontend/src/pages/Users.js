import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Trash, UserCircle, ShieldCheck, Key } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user'
  });

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/auth/users`, {
        withCredentials: true
      });
      setUsers(data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/auth/users`, formData, {
        withCredentials: true
      });
      toast.success('User created');
      setDialogOpen(false);
      setFormData({ email: '', password: '', name: '', role: 'user' });
      await fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to create user';
      toast.error(typeof msg === 'string' ? msg : 'Failed to create user');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await axios.delete(`${API_URL}/api/auth/users/${userId}`, {
        withCredentials: true
      });
      toast.success('User deleted');
      await fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Failed to delete user';
      toast.error(typeof msg === 'string' ? msg : 'Failed to delete user');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    try {
      await axios.put(
        `${API_URL}/api/auth/users/${resetTarget._id}/reset-password`,
        { new_password: newPassword },
        { withCredentials: true }
      );
      toast.success(`Password reset for ${resetTarget.email}`);
      setResetDialogOpen(false);
      setResetTarget(null);
      setNewPassword('');
    } catch (error) {
      toast.error('Failed to reset password');
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="text-center py-12" data-testid="users-access-denied">
        <p className="text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-4" data-testid="users-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">
            Users
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{users.length} total</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-primary hover:bg-[#152B23] text-primary-foreground h-10 w-10 p-0 rounded-full"
              data-testid="add-user-button"
            >
              <Plus size={24} weight="bold" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] rounded-xl" data-testid="user-dialog">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl font-light">Add User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="user-name" className="text-xs uppercase tracking-wider">Name</Label>
                <Input
                  id="user-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="h-11"
                  data-testid="user-name-input"
                />
              </div>
              <div>
                <Label htmlFor="user-email" className="text-xs uppercase tracking-wider">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-11"
                  data-testid="user-email-input"
                />
              </div>
              <div>
                <Label htmlFor="user-password" className="text-xs uppercase tracking-wider">Password</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={4}
                  className="h-11"
                  data-testid="user-password-input"
                />
              </div>
              <div>
                <Label htmlFor="user-role" className="text-xs uppercase tracking-wider">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="h-11" data-testid="user-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1 h-11"
                  data-testid="user-cancel-button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 bg-primary hover:bg-[#152B23]"
                  data-testid="user-submit-button"
                >
                  Create
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-xl" data-testid="reset-password-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-light">
              Reset Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reset password for <strong>{resetTarget?.email}</strong>
          </p>
          <form onSubmit={handleResetPassword} className="space-y-3">
            <div>
              <Label htmlFor="new-pw" className="text-xs uppercase tracking-wider">New Password</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={4}
                className="h-11"
                data-testid="admin-reset-password-input"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setResetDialogOpen(false); setNewPassword(''); }}
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11 bg-primary hover:bg-[#152B23]"
                data-testid="admin-reset-submit-button"
              >
                Reset
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {users.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <p className="text-muted-foreground text-sm">No users yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u, idx) => (
            <div
              key={u._id}
              className="bg-card border border-border p-4 rounded-xl"
              data-testid={`user-row-${idx}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                    {u.role === 'admin' ? <ShieldCheck size={20} weight="duotone" /> : <UserCircle size={20} weight="duotone" />}
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-light">{u.name}</h3>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    u.role === 'admin'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    {u.role}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setResetTarget(u); setResetDialogOpen(true); }}
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                    data-testid={`reset-password-user-${idx}`}
                    title="Reset password"
                  >
                    <Key size={18} />
                  </Button>
                  {u._id !== currentUser?._id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(u._id)}
                      className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                      data-testid={`delete-user-${idx}`}
                    >
                      <Trash size={18} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Users;
