import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Calendar, Pencil, Trash, DownloadSimple, WhatsappLogo, ChatCircleDots, Gear, Funnel, MagnifyingGlass } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { exportToCSV, exportToPDF } from '../lib/exportUtils';
import { TAX_CATEGORIES, getBengaliCategory } from '../lib/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL;

class ErrorBoundary extends React.Component {
  constructor(props) { 
    super(props); 
    this.state = { hasError: false, error: null }; 
  }
  static getDerivedStateFromError(error) { 
    return { hasError: true, error }; 
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 m-10 bg-rose-50 border border-rose-200 rounded-[2rem]">
          Crash Detected. Please refresh.
        </div>
      );
    }
    return this.props.children;
  }
}

const BillsContent = () => {
  const [bills, setBills] = useState([]);
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);

  const [isOthersCat, setIsOthersCat] = useState(false);
  const [customCatName, setCustomCatName] = useState('');
  
  const [formData, setFormData] = useState({ 
    consumer_id: '', 
    amount: '', 
    category: TAX_CATEGORIES[0], 
    notes: '', 
    land_bigha: '', 
    land_katha: '' 
  });
  
  const [rateConfig, setRateConfig] = useState({ 
    rate_per_bigha: 0, 
    rate_per_katha: 0, 
    katha_to_bigha_ratio: 20, 
    category: TAX_CATEGORIES[0] 
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const [billsRes, consumersRes] = await Promise.all([
        axios.get(API_URL + '/api/bills', { withCredentials: true }),
        axios.get(API_URL + '/api/consumers', { withCredentials: true })
      ]);
      setBills(Array.isArray(billsRes.data?.items) ? billsRes.data.items : []);
      setConsumers(Array.isArray(consumersRes.data?.items) ? consumersRes.data.items : []);
    } catch (error) { 
      toast.error('Failed to load data'); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  const fetchRateConfig = async (categoryToFetch) => {
    try {
      const targetCat = TAX_CATEGORIES.includes(categoryToFetch) ? categoryToFetch : TAX_CATEGORIES[0];
      const res = await axios.get(API_URL + '/api/rate-config?category=' + targetCat, { withCredentials: true });
      if (res.data) {
        setRateConfig({
          ...res.data,
          katha_to_bigha_ratio: res.data.katha_to_bigha_ratio || 20
        });
      }
      return res.data;
    } catch (e) { 
      return null; 
    }
  };

  useEffect(() => { 
    fetchData(); 
    fetchRateConfig(TAX_CATEGORIES[0]); 
  }, [fetchData]);

  const getFarmerName = (consumerId, fallbackName) => {
    const farmer = consumers.find(c => String(c._id || c.id) === String(consumerId));
    if (farmer && farmer.name) return farmer.name;
    return fallbackName || 'Unknown Farmer';
  };

  const getLandText = (consumerId) => {
    const farmer = consumers.find(c => String(c._id || c.id) === String(consumerId)) || {};
    return Number(farmer.land_bigha || 0) + " বিঘা, " + Number(farmer.land_katha || 0) + " কাঠা";
  };

  const getBillLandText = (bill, consumerId) => {
    if (bill.land_bigha !== undefined && bill.land_katha !== undefined) {
      return Number(bill.land_bigha) + " বিঘা, " + Number(bill.land_katha) + " কাঠা";
    }
    return getLandText(consumerId);
  };

  const availableYears = [...new Set(bills.map(b => b.created_at ? new Date(b.created_at).getFullYear().toString() : null).filter(Boolean))].sort((a, b) => b - a);
  const availableCategories = [...new Set(bills.map(b => b.category).filter(Boolean))].sort();

  const filteredBills = bills.filter(b => {
    const billYear = b.created_at ? new Date(b.created_at).getFullYear().toString() : null;
    const matchYear = yearFilter === 'all' || billYear === yearFilter;
    const matchCategory = categoryFilter === 'all' || b.category === categoryFilter;
    const farmerName = getFarmerName(b.consumer_id, b.consumer_name).toLowerCase();
    const matchSearch = farmerName.includes(searchQuery.toLowerCase());
    return matchYear && matchCategory && matchSearch;
  });

  const calculateAmount = (bigha, katha, rates) => {
    const b = parseFloat(bigha) || 0;
    const k = parseFloat(katha) || 0;
    const rB = parseFloat(rates?.rate_per_bigha) || 0;
    const rK = parseFloat(rates?.rate_per_katha) || 0;
    const total = (b * rB) + (k * rK);
    return total > 0 ? total.toFixed(2) : '';
  };

  const handleFarmerSelect = (val) => {
    const farmer = consumers.find(c => String(c._id || c.id) === String(val));
    const b = farmer ? (farmer.land_bigha || 0) : '';
    const k = farmer ? (farmer.land_katha || 0) : '';
    let newAmt = formData.amount;
    if (!isOthersCat) {
      newAmt = calculateAmount(b, k, rateConfig);
    }
    setFormData({ ...formData, consumer_id: val, land_bigha: b, land_katha: k, amount: newAmt });
  };

  const handleLandChange = (field, value) => {
    const newForm = { ...formData, [field]: value };
    if (!isOthersCat) {
      newForm.amount = calculateAmount(newForm.land_bigha, newForm.land_katha, rateConfig);
    }
    setFormData(newForm);
  };

  const handleCategorySelect = async (val) => {
    setIsOthersCat(val === 'others water tax');
    let newForm = { ...formData, category: val };
    if (val !== 'others water tax') {
      const rates = await fetchRateConfig(val);
      if (rates) {
        newForm.amount = calculateAmount(newForm.land_bigha, newForm.land_katha, rates);
      }
    }
    setFormData(newForm);
  };

  const handleRateUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        category: rateConfig.category,
        rate_per_bigha: parseFloat(rateConfig.rate_per_bigha) || 0,
        rate_per_katha: parseFloat(rateConfig.rate_per_katha) || 0,
        katha_to_bigha_ratio: parseFloat(rateConfig.katha_to_bigha_ratio) || 20
      };
      await axios.put(API_URL + '/api/rate-config', payload, { withCredentials: true });
      toast.success('Rates saved');
      setRateDialogOpen(false);
      fetchRateConfig(rateConfig.category); 
    } catch (error) { 
      toast.error('Failed to save rates'); 
    }
  };

  const syncFarmerLandSize = async () => {
    const farmer = consumers.find(c => String(c._id || c.id) === String(formData.consumer_id));
    if (farmer && (Number(farmer.land_bigha) !== Number(formData.land_bigha) || Number(farmer.land_katha) !== Number(formData.land_katha))) {
      try {
        const payload = {
          ...farmer,
          land_bigha: parseFloat(formData.land_bigha) || 0,
          land_katha: parseFloat(formData.land_katha) || 0
        };
        await axios.put(API_URL + '/api/consumers/' + (farmer._id || farmer.id), payload, { withCredentials: true });
      } catch (err) { 
        console.error("Failed to sync", err); 
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.consumer_id) return toast.error("Please select a farmer.");
    if (!formData.amount || Number(formData.amount) <= 0) return toast.error("Please enter a valid amount.");
    if (isOthersCat && !customCatName) return toast.error("Please enter the custom tax name.");

    try {
      const currentRatio = parseFloat(rateConfig.katha_to_bigha_ratio) || 20;
      const bigha = parseFloat(formData.land_bigha) || 0;
      const katha = parseFloat(formData.land_katha) || 0;
      
      const billPayload = { 
        consumer_id: String(formData.consumer_id),
        category: isOthersCat ? customCatName : formData.category, 
        amount: parseFloat(formData.amount) || 0,
        land_bigha: bigha,
        land_katha: katha,
        total_land_in_bigha: bigha + (katha / currentRatio),
        notes: formData.notes || ""
      };
      await axios.post(API_URL + '/api/bills', billPayload, { withCredentials: true });
      await syncFarmerLandSize();
      toast.success('Bill generated');
      setDialogOpen(false); 
      resetForm(); 
      await fetchData();
    } catch (error) { 
      toast.error('Failed to generate bill'); 
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (isOthersCat && !customCatName) return toast.error("Please enter the custom tax name.");
    try {
      const currentRatio = parseFloat(rateConfig.katha_to_bigha_ratio) || 20;
      const bigha = parseFloat(formData.land_bigha) || 0;
      const katha = parseFloat(formData.land_katha) || 0;
      
      const payload = { 
        consumer_id: String(formData.consumer_id),
        category: isOthersCat ? customCatName : formData.category, 
        amount: parseFloat(formData.amount) || 0,
        land_bigha: bigha,
        land_katha: katha,
        total_land_in_bigha: bigha + (katha / currentRatio),
        notes: formData.notes || ""
      };
      await axios.put(API_URL + '/api/bills/' + (editingBill._id || editingBill.id), payload, { withCredentials: true });
      await syncFarmerLandSize();
      toast.success('Bill updated');
      setEditDialogOpen(false); 
      resetForm(); 
      await fetchData();
    } catch (error) { 
      toast.error('Failed to update bill'); 
    }
  };

  const handleDelete = async (billId) => {
    if (!window.confirm('Delete this bill?')) return;
    try {
      await axios.delete(API_URL + '/api/bills/' + billId, { withCredentials: true });
      toast.success('Bill deleted'); 
      await fetchData();
    } catch (error) { 
      toast.error('Failed to delete'); 
    }
  };

  const handleSendSMS = async (bill) => {
    try {
      const consumerId = String(bill.consumer_id);
      const payload = { 
        consumer_id: consumerId, 
        land_area: getBillLandText(bill, consumerId), 
        amount: Number(bill.due || bill.amount || 0), 
        period: "Current Bill", 
        category: bill.category || "WATER TAX" 
      };
      await axios.post(API_URL + '/api/sms/send-bill', payload, { withCredentials: true });
      toast.success('Bill SMS queued');
    } catch (e) { 
      toast.error('Failed to send SMS'); 
    }
  };

  const sendWhatsApp = (bill) => {
    const consumerId = String(bill.consumer_id);
    const consumer = consumers.find(c => String(c._id || c.id) === consumerId);
    if (!consumer?.phone) {
      return toast.error("No phone number found.");
    }
    
    const fName = getFarmerName(consumerId, bill.consumer_name);
    const cName = getBengaliCategory(bill.category);
    const lText = getBillLandText(bill, consumerId);
    const bAmt = Number(bill.amount || 0);
    const bDue = Number(bill.due || 0);
    
    const msg = "নমস্কার " + fName + ",\nবিভাগ: " + cName + "\nজমি: " + lText + "\nমোট বিল: ₹" + bAmt + "\nবাকি: ₹" + bDue + "\nধন্যবাদ।";
    window.open("https://wa.me/91" + consumer.phone + "?text=" + encodeURIComponent(msg), "_blank");
  };

  const resetForm = () => { 
    setFormData({ 
      consumer_id: '', 
      amount: '', 
      category: TAX_CATEGORIES[0], 
      notes: '', 
      land_bigha: '', 
      land_katha: '' 
    }); 
    setEditingBill(null); 
    setIsOthersCat(false); 
    setCustomCatName(''); 
  };

  const openEditDialog = (bill) => {
    setEditingBill(bill);
    const isCustom = !TAX_CATEGORIES.includes(bill.category?.toLowerCase());
    setIsOthersCat(isCustom); 
    setCustomCatName(isCustom ? bill.category : '');
    const farmer = consumers.find(c => String(c._id || c.id) === String(bill.consumer_id));

    setFormData({ 
      consumer_id: bill.consumer_id || '', 
      amount: bill.amount || '', 
      category: isCustom ? 'others water tax' : (bill.category?.toLowerCase() || TAX_CATEGORIES[0]), 
      notes: bill.notes || '',
      land_bigha: bill.land_bigha !== undefined ? bill.land_bigha : (farmer ? (farmer.land_bigha || 0) : 0),
      land_katha: bill.land_katha !== undefined ? bill.land_katha : (farmer ? (farmer.land_katha || 0) : 0)
    });
    setEditDialogOpen(true);
  };

  const handleExport = (format) => {
    if (filteredBills.length === 0) return toast.error("No data to export");
    const headers = ['Farmer', 'Category', 'Land Size', 'Total Amount', 'Paid', 'Due', 'Date', 'Notes'];
    const rows = filteredBills.map(b => [
      getFarmerName(b.consumer_id, b.consumer_name), 
      b.category ? String(b.category).toUpperCase() : '-', 
      getBillLandText(b, b.consumer_id),
      Number(b.amount || 0), 
      Number(b.paid || 0), 
      Number(b.due || 0),
      b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A', 
      b.notes || '-'
    ]);
    
    if (format === 'csv') {
      exportToCSV(rows, headers, "Bills.csv");
    } else {
      exportToPDF(rows, headers, 'Water Bills Report', "Bills.pdf");
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center animate-pulse">
        Syncing Bills...
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end border-b pb-4">
        <div>
          <h1 className="text-3xl font-light text-[#051039]">Bills</h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            {filteredBills.length} records found
          </p>
        </div>
        <div className
