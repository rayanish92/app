import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallPWA } from './components/InstallPWA';
import { Toaster } from './components/ui/sonner';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consumers from './pages/Consumers';
import Bills from './pages/Bills';
import Payments from './pages/Payments';
import SMS from './pages/SMS';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="consumers" element={<Consumers />} />
            <Route path="bills" element={<Bills />} />
            <Route path="payments" element={<Payments />} />
            <Route path="sms" element={<SMS />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
      <InstallPWA />
    </AuthProvider>
  );
}

export default App;