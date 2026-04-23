import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallPWA } from './components/InstallPWA';
import { Toaster } from './components/ui/sonner';
import MobileLayout from './components/MobileLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Farmers from './pages/Farmers'; // <-- Correctly imported
import Bills from './pages/Bills';
import Payments from './pages/Payments';
import SMS from './pages/SMS';
import Users from './pages/Users';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MobileLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            {/* FIX: Changed element={<Consumers />} to element={<Farmers />} */}
            <Route path="farmers" element={<Farmers />} />
            <Route path="bills" element={<Bills />} />
            <Route path="payments" element={<Payments />} />
            <Route path="sms" element={<SMS />} />
            <Route path="users" element={<Users />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" />
      <InstallPWA />
    </AuthProvider>
  );
}

export default App;
