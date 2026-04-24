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
        <div className="p-10 m-10 bg-rose-50 border border-rose-200 rounded-[2rem] text-rose-900 shadow-xl">
          <h1 className="text-2xl font-black mb-2">React Crash Detected 🚨</h1>
          <p className="font-medium text-rose-700">Please refresh the page.</p>
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
        axios.get(`${API_URL}/api/bills`, { withCredentials: true }),
        axios.get(`${API_URL}/api/consumers`, { withCredentials: true })
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
      const res = await axios.get(`${API_URL}/api/rate-config?category=${targetCat}`, { withCredentials: true });
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
    return `${Number(farmer.land_bigha || 0)} বিঘা, ${Number(farmer.land_katha || 0)} কাঠা`;
  };

  const getBillLandText = (bill, consumerId) => {
    if (bill.land_bigha !== undefined && bill.land_katha !== undefined) {
      return `${Number(bill.land_bigha)} বিঘা, ${Number(bill.land_katha)} কাঠা`;
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
      await axios.put(`${API_URL}/api/rate-config`, payload, { withCredentials: true });
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
        await axios.put(`${API_URL}/api/consumers/${farmer._id || farmer.id}`, payload, { withCredentials: true });
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

    const currentRatio = parseFloat(rateConfig.katha_to_bigha_ratio) || 20;
    const bigha = parseFloat(formData.land_bigha) || 0;
    const katha = parseFloat(formData.land_katha) || 0;
    
    const fullPayload = { 
      consumer_id: String(formData.consumer_id),
      category: isOthersCat ? customCatName : formData.category, 
      amount: parseFloat(formData.amount) || 0,
      land_bigha: bigha,
      land_katha: katha,
      total_land_in_bigha: bigha + (katha / currentRatio),
      notes: formData.notes || ""
    };

    const safeFallbackPayload = {
      consumer_id: String(formData.consumer_id),
      category: isOthersCat ? customCatName : formData.category, 
      amount: parseFloat(formData.amount) || 0,
      notes: formData.notes || ""
    };

    try {
      try {
        // Try the new full payload first
        await axios.post(`${API_URL}/api/bills`, fullPayload, { withCredentials: true });
      } catch (err) {
        // If the backend rejects the extra fields (422 error), catch it and send the simple payload safely!
        if (err.response?.status === 422) {
          await axios.post(`${API_URL}/api/bills`, safeFallbackPayload, { withCredentials: true });
        } else {
          throw err;
        }
      }
      
      await syncFarmerLandSize();
      toast.success('Bill generated');
      setDialogOpen(false); 
      resetForm(); 
      await fetchData();
    } catch (error) { 
      toast.error('Failed to generate bill. Please check your data.'); 
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (isOthersCat && !customCatName) return toast.error("Please enter the custom tax name.");
    
    const currentRatio = parseFloat(rateConfig.katha_to_bigha_ratio) || 20;
    const bigha = parseFloat(formData.land_bigha) || 0;
    const katha = parseFloat(formData.land_katha) || 0;
    
    const fullPayload = { 
      consumer_id: String(formData.consumer_id),
      category: isOthersCat ? customCatName : formData.category, 
      amount: parseFloat(formData.amount) || 0,
      land_bigha: bigha,
      land_katha: katha,
      total_land_in_bigha: bigha + (katha / currentRatio),
      notes: formData.notes || ""
    };

    const safeFallbackPayload = {
      consumer_id: String(formData.consumer_id),
      category: isOthersCat ? customCatName : formData.category, 
      amount: parseFloat(formData.amount) || 0,
      notes: formData.notes || ""
    };

    try {
      const billId = editingBill._id || editingBill.id;
      try {
        await axios.put(`${API_URL}/api/bills/${billId}`, fullPayload, { withCredentials: true });
      } catch (err) {
        if (err.response?.status === 422) {
          await axios.put(`${API_URL}/api/bills/${billId}`, safeFallbackPayload, { withCredentials: true });
        } else {
          throw err;
        }
      }

      await syncFarmerLandSize();
      toast.success('Bill updated');
      setEditDialogOpen(false); 
      resetForm(); 
      await fetchData();
    } catch (error) { 
      toast.error('Failed to update bill.'); 
    }
  };

  const handleDelete = async (billId) => {
    if (!window.confirm('Delete this bill?')) return;
    try {
      await axios.delete(`${API_URL}/api/bills/${billId}`, { withCredentials: true });
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
      await axios.post(`${API_URL}/api/sms/send-bill`, payload, { withCredentials: true });
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
    
    const msg = `নমস্কার ${fName},\nবিভাগ: ${cName}\nজমি: ${lText}\nমোট বিল: ₹${bAmt}\nবাকি: ₹${bDue}\nধন্যবাদ।`;
    window.open(`https://wa.me/91${consumer.phone}?text=${encodeURIComponent(msg)}`, '_blank');
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
      <div className="p-12 text-center animate-pulse text-[#051039] font-bold">
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
        <div className="flex gap-2">
          {filteredBills.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <DownloadSimple size={20} className="text-green-600" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                <DownloadSimple size={20} className="text-red-600" />
              </Button>
            </>
          )}

          {/* RATE SETTINGS BUTTON */}
          <Dialog open={rateDialogOpen} onOpenChange={(open) => { setRateDialogOpen(open); if(open) fetchRateConfig(rateConfig.category); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-12 w-12 bg-slate-100 hover:bg-slate-200 shadow-sm">
                <Gear size={24} weight="fill" />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-8 md:p-10 max-w-2xl border-none shadow-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-light">Configure Rates</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRateUpdate} className="space-y-4 pt-4">
                <Select value={rateConfig.category} onValueChange={(v) => { setRateConfig({...rateConfig, category: v}); fetchRateConfig(v); }}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {TAX_CATEGORIES.filter(c => c !== 'others water tax').map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 ml-2">Rate/Bigha (₹)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={rateConfig.rate_per_bigha} 
                      onChange={(e) => setRateConfig({...rateConfig, rate_per_bigha: parseFloat(e.target.value) || 0})} 
                      className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 ml-2">Rate/Katha (₹)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={rateConfig.rate_per_katha} 
                      onChange={(e) => setRateConfig({...rateConfig, rate_per_katha: parseFloat(e.target.value) || 0})} 
                      className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 ml-2">Katha per Bigha</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={rateConfig.katha_to_bigha_ratio} 
                      onChange={(e) => setRateConfig({...rateConfig, katha_to_bigha_ratio: parseFloat(e.target.value) || 20})} 
                      className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-2xl font-bold shadow-xl text-lg mt-2">
                  Save Rates
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          
          {/* NEW BILL BUTTON */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if(!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-12 w-12 bg-[#051039] text-white shadow-xl hover:scale-110">
                <Plus size={28} />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-6 md:p-8 max-w-md border-none shadow-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-light text-[#051039]">Generate New Bill</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                
                <Select value={formData.consumer_id} onValueChange={handleFarmerSelect} required>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg">
                    <SelectValue placeholder="Select Farmer" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl max-h-60">
                    {consumers.map((c) => (
                      <SelectItem key={String(c._id || c.id)} value={String(c._id || c.id)}>
                        {c.name || 'Unknown'} - {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={formData.category} onValueChange={handleCategorySelect}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg">
                    <SelectValue placeholder="Bill Category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {TAX_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {isOthersCat && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    <Label className="text-[10px] font-bold text-emerald-600 uppercase ml-2">Enter Tax Name</Label>
                    <Input 
                      value={customCatName} 
                      onChange={(e) => setCustomCatName(e.target.value)} 
                      className="h-14 rounded-2xl bg-emerald-50 border-emerald-100 px-6 text-lg mt-1" 
                      required 
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 ml-2">Land (Bigha)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={formData.land_bigha} 
                      onChange={(e) => handleLandChange('land_bigha', e.target.value)} 
                      className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 ml-2">Land (Katha)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={formData.land_katha} 
                      onChange={(e) => handleLandChange('land_katha', e.target.value)} 
                      className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end ml-2 mb-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Total Amount (₹)</Label>
                    {!isOthersCat && formData.consumer_id && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Auto-Calculated</span>
                    )}
                  </div>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })} 
                    required 
                    className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg" 
                  />
                </div>
                
                <div>
                  <Label className="text-[10px] font-bold text-slate-500 ml-2">Notes</Label>
                  <Input 
                    value={formData.notes} 
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                    className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
                  />
                </div>
                <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-2xl font-bold shadow-xl text-lg mt-2">
                  Generate Bill
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* FILTER & SEARCH BAR SECTION */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 items-center">
        <div className="flex items-center gap-2 text-slate-500 font-bold px-2">
          <Funnel size={20} weight="fill" /> Filters
        </div>

        <div className="relative w-full sm:w-auto flex-1 min-w-[200px]">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <MagnifyingGlass size={20} />
          </div>
          <Input 
            placeholder="Search by farmer name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 w-full pl-10 rounded-xl bg-white border-none shadow-sm font-medium" 
          />
        </div>

        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-[150px] h-12 rounded-xl bg-white border-none shadow-sm font-medium">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-xl">
            <SelectItem value="all">All Years</SelectItem>
            {availableYears.map(y => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px] h-12 rounded-xl bg-white border-none shadow-sm font-medium">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-xl">
            <SelectItem value="all">All Categories</SelectItem>
            {availableCategories.map(c => (
              <SelectItem key={c} value={c}>{String(c).toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {(yearFilter !== 'all' || categoryFilter !== 'all' || searchQuery !== '') && (
          <Button 
            variant="ghost" 
            onClick={() => { setYearFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }} 
            className="h-12 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl px-4"
          >
            Clear
          </Button>
        )}
      </div>

      {/* COMPACT BILL CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBills.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white border border-slate-100 rounded-[2rem]">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
              No bills found for this filter
            </p>
          </div>
        ) : (
          filteredBills.map((bill) => {
            const isNegative = Number(bill.due) < 0;
            return (
              <div key={bill._id || bill.id} className="bg-white border p-4 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="text-[10px] bg-purple-50 text-purple-700 px-3 py-1 rounded-full uppercase font-black border border-purple-100">
                        {bill.category ? String(bill.category).toUpperCase() : 'WATER TAX'}
                      </span>
                      <h3 className="text-lg font-bold text-slate-800 mt-2 leading-tight truncate pr-2">
                        {getFarmerName(bill.consumer_id, bill.consumer_name)}
                      </h3>
                      <p className="text-xs font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar size={14} weight="fill" /> 
                        {bill.created_at ? new Date(bill.created_at).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-white pl-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => sendWhatsApp(bill)} className="text-emerald-500 rounded-full h-8 w-8 p-0">
                        <WhatsappLogo size={22} weight="fill" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleSendSMS(bill)} className="text-blue-500 rounded-full h-8 w-8 p-0">
                        <ChatCircleDots size={22} weight="fill" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEditDialog(bill)} className="text-slate-400 rounded-full h-8 w-8 p-0">
                        <Pencil size={20} />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(bill._id || bill.id)} className="text-rose-400 rounded-full h-8 w-8 p-0">
                        <Trash size={20} />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-50 pt-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Land Size</p>
                      <p className="text-sm font-medium text-slate-600">{getBillLandText(bill, bill.consumer_id)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Notes</p>
                      <p className="text-sm font-medium text-slate-600 truncate">{bill.notes || '-'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-50 grid grid-cols-2 gap-2 items-center">
                  <div>
                    <p className="text-[10px] font-bold text-slate-300 uppercase">Total Billed</p>
                    <p className="text-lg font-bold text-slate-700">₹{Number(bill.amount || 0).toFixed(0)}</p>
                  </div>
                  <div className={`text-right p-2 rounded-xl border ${isNegative ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                    <p className={`text-[10px] font-bold uppercase ${isNegative ? 'text-emerald-500' : 'text-rose-400'}`}>
                      {isNegative ? 'Advance Paid' : 'Pending Due'}
                    </p>
                    <p className={`text-lg font-black ${isNegative ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ₹{Math.abs(Number(bill.due || 0)).toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* EDIT BILL DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-6 md:p-8 max-w-md border-none shadow-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-light text-[#051039]">Edit Bill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-4">
            <div>
              <Label className="text-[10px] font-bold text-slate-500 ml-2">Farmer</Label>
              <div className="h-14 rounded-2xl bg-slate-50 px-6 text-lg flex items-center font-bold text-slate-700 mt-1">
                {getFarmerName(editingBill?.consumer_id, editingBill?.consumer_name)}
              </div>
            </div>
            
            <Select value={formData.category} onValueChange={handleCategorySelect}>
              <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                {TAX_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isOthersCat && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <Label className="text-[10px] font-bold text-emerald-600 ml-2">Enter Tax Name</Label>
                <Input 
                  value={customCatName} 
                  onChange={(e) => setCustomCatName(e.target.value)} 
                  className="h-14 rounded-2xl bg-emerald-50 border-emerald-100 px-6 text-lg mt-1" 
                  required 
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] font-bold text-slate-500 ml-2">Land (Bigha)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={formData.land_bigha} 
                  onChange={(e) => handleLandChange('land_bigha', e.target.value)} 
                  className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-slate-500 ml-2">Land (Katha)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={formData.land_katha} 
                  onChange={(e) => handleLandChange('land_katha', e.target.value)} 
                  className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
                />
              </div>
            </div>

            <div>
              <Label className="text-[10px] font-bold text-slate-500 ml-2">Total Amount (₹)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={formData.amount} 
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })} 
                required 
                className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
              />
            </div>
            
            <div>
              <Label className="text-[10px] font-bold text-slate-500 ml-2">Notes</Label>
              <Input 
                value={formData.notes} 
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                className="h-14 rounded-2xl bg-slate-50 border-none px-6 text-lg mt-1" 
              />
            </div>
            
            <Button type="submit" className="w-full h-16 bg-[#051039] text-white rounded-2xl font-bold shadow-xl text-lg mt-2">
              Update Bill
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Bills = () => (
  <ErrorBoundary>
    <BillsContent />
  </ErrorBoundary>
);

export default Bills;
