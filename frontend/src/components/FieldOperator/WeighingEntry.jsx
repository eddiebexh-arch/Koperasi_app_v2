import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import { useSync } from '../../context/SyncContext';
import { toast } from 'sonner';
import { Scale, Check, UserPlus, Camera, Trash2, ArrowRight } from 'lucide-react';
import { DigitalReceiptModal } from '../DigitalReceiptModal';

export function WeighingEntry() {
  const { triggerSync, refreshStockPool, updatePendingCount } = useSync();

  // Form States
  const [commodityType, setCommodityType] = useState('TBS'); // TBS or BERONDOL
  const [farmerName, setFarmerName] = useState('');
  const [fieldWeightKg, setFieldWeightKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('2450');
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Farmers Autocomplete & Recent
  const [farmersList, setFarmersList] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [showFarmerSuggestions, setShowFarmerSuggestions] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Load Farmers & Last Prices from IndexedDB
  useEffect(() => {
    loadLocalData();
  }, []);

  const loadLocalData = async () => {
    try {
      const farmers = await db.farmers.toArray();
      setFarmersList(farmers);

      const recent = await db.purchases.orderBy('timestamp').reverse().limit(5).toArray();
      setRecentPurchases(recent);

      const settings = await db.settings.get('default');
      if (settings) {
        if (commodityType === 'BERONDOL' && settings.last_price_berondol) {
          setPricePerKg(String(settings.last_price_berondol));
        } else if (settings.last_price_tbs) {
          setPricePerKg(String(settings.last_price_tbs));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Switch commodity updates default price
  const handleCommodityChange = async (type) => {
    setCommodityType(type);
    const settings = await db.settings.get('default');
    if (settings) {
      setPricePerKg(type === 'BERONDOL' ? String(settings.last_price_berondol || 2700) : String(settings.last_price_tbs || 2450));
    } else {
      setPricePerKg(type === 'BERONDOL' ? '2700' : '2450');
    }
  };

  // Real-time calculations
  const weightNum = parseFloat(fieldWeightKg) || 0;
  const priceNum = parseFloat(pricePerKg) || 0;
  const totalCost = Math.round(weightNum * priceNum);

  // Quick weight increment buttons for rugged tablet touch
  const addWeight = (delta) => {
    const current = parseFloat(fieldWeightKg) || 0;
    setFieldWeightKg(String(current + delta));
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result);
        toast.info('Foto nota / buah berhasil diambil');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!farmerName.trim()) {
      toast.error('Pilih atau masukkan nama petani terlebih dahulu.');
      return;
    }
    if (weightNum <= 0) {
      toast.error('Masukkan berat timbangan yang valid (> 0 Kg).');
      return;
    }
    if (priceNum <= 0) {
      toast.error('Masukkan harga per Kg yang valid.');
      return;
    }

    try {
      setIsSubmitting(true);
      const localId = `PUR-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
      const timestamp = new Date().toISOString();

      const newTransaction = {
        local_id: localId,
        farmer_name: farmerName.trim(),
        commodity_type: commodityType,
        field_weight_kg: weightNum,
        price_per_kg: priceNum,
        total_cost: totalCost,
        photo_url: photoUrl,
        notes: notes.trim(),
        status: 'PAID',
        timestamp: timestamp,
        synced: 0
      };

      // 1. Save to IndexedDB
      await db.purchases.add(newTransaction);

      // 2. Check and save farmer to Master cache if new
      const exists = farmersList.some(f => f.name.toLowerCase() === farmerName.trim().toLowerCase());
      if (!exists) {
        await db.farmers.add({ name: farmerName.trim(), village: 'Makekal Hulu', phone: '' });
      }

      // 3. Update last price in settings cache
      const updateObj = commodityType === 'BERONDOL' ? { last_price_berondol: priceNum } : { last_price_tbs: priceNum };
      await db.settings.update('default', updateObj);

      // 4. Update memory / pool & queue
      await updatePendingCount();
      await refreshStockPool();
      await loadLocalData();

      // 5. Trigger online sync in background
      triggerSync(false);

      // 6. Show digital receipt
      setActiveReceipt(newTransaction);
      toast.success(`Transaksi Timbang ${farmerName} (Rp ${totalCost.toLocaleString('id-ID')}) Berhasil Disimpan!`);

      // 7. Reset form
      setFarmerName('');
      setFieldWeightKg('');
      setPhotoUrl('');
      setNotes('');
    } catch (err) {
      console.error('Error saving purchase:', err);
      toast.error('Gagal menyimpan transaksi ke memori tablet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFarmers = farmersList.filter(f =>
    f.name.toLowerCase().includes(farmerName.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* High-Contrast Tablet Card for Outdoor Sunlight */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-[#1E4620] overflow-hidden">
        {/* Banner Top */}
        <div className="bg-[#1E4620] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4A373] text-[#1E4620] flex items-center justify-center font-black">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-tight">
                Entri Timbangan Pembelian
              </h2>
              <p className="text-xs text-[#FEFAE0]">Input cepat di lokasi timbang • Offline-First Instant</p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-emerald-800 text-emerald-100 font-bold text-xs border border-emerald-600">
            Kalkulasi 100% Otomatis
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {/* Commodity Selector (TBS vs Berondol) */}
          <div>
            <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-2">
              1. Pilih Komoditas Sawit
            </label>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                data-testid="select-commodity-tbs"
                onClick={() => handleCommodityChange('TBS')}
                className={`py-3.5 sm:py-4 px-4 rounded-xl font-black text-sm sm:text-base transition-all flex items-center justify-center gap-2 border-2 ${
                  commodityType === 'TBS'
                    ? 'bg-[#1E4620] text-white border-[#1E4620] shadow-md ring-2 ring-[#D4A373]'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                }`}
              >
                <span>🌴 TBS (Tandan Buah Segar)</span>
              </button>

              <button
                type="button"
                data-testid="select-commodity-berondol"
                onClick={() => handleCommodityChange('BERONDOL')}
                className={`py-3.5 sm:py-4 px-4 rounded-xl font-black text-sm sm:text-base transition-all flex items-center justify-center gap-2 border-2 ${
                  commodityType === 'BERONDOL'
                    ? 'bg-[#8B4513] text-white border-[#8B4513] shadow-md ring-2 ring-[#D4A373]'
                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                }`}
              >
                <span>🌰 Berondol (Buah Lepas)</span>
              </button>
            </div>
          </div>

          {/* Farmer Selection with Autocomplete */}
          <div className="relative">
            <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-2">
              2. Nama Petani / Warga
            </label>
            <div className="relative">
              <input
                type="text"
                data-testid="farmer-name-input"
                value={farmerName}
                onChange={(e) => {
                  setFarmerName(e.target.value);
                  setShowFarmerSuggestions(true);
                }}
                onFocus={() => setShowFarmerSuggestions(true)}
                placeholder="Ketik atau pilih nama petani..."
                className="w-full text-base sm:text-lg font-bold px-4 py-3.5 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] focus:ring-2 focus:ring-[#D4A373] outline-none transition-all"
                autoComplete="off"
              />
            </div>

            {/* Quick Chips for frequent farmers */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] font-semibold text-gray-500 py-1">Pilihan Cepat:</span>
              {farmersList.slice(0, 5).map((f) => (
                <button
                  key={f.name}
                  type="button"
                  data-testid={`quick-farmer-${f.name.replace(/\s+/g, '-').toLowerCase()}`}
                  onClick={() => {
                    setFarmerName(f.name);
                    setShowFarmerSuggestions(false);
                  }}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-[#D4A373]/30 text-gray-800 text-xs font-bold rounded-lg border border-gray-300 transition-colors"
                >
                  {f.name}
                </button>
              ))}
            </div>

            {/* Autocomplete Dropdown */}
            {showFarmerSuggestions && farmerName.trim() && filteredFarmers.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border-2 border-[#1E4620] rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                {filteredFarmers.map((farmer) => (
                  <div
                    key={farmer.name}
                    onClick={() => {
                      setFarmerName(farmer.name);
                      setShowFarmerSuggestions(false);
                    }}
                    className="p-3 hover:bg-[#FEFAE0] cursor-pointer border-b border-gray-100 flex items-center justify-between font-bold text-gray-900 text-sm"
                  >
                    <span>{farmer.name}</span>
                    <span className="text-xs text-gray-500 font-normal">{farmer.village || 'Makekal Hulu'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weight and Price Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Weight Input */}
            <div className="bg-[#F7F6F2] p-4 rounded-xl border border-gray-200 space-y-2">
              <label className="block text-xs font-black uppercase text-gray-700 tracking-wider">
                3. Berat Timbangan Lapangan (Kg)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  inputMode="decimal"
                  data-testid="field-weight-input"
                  value={fieldWeightKg}
                  onChange={(e) => setFieldWeightKg(e.target.value)}
                  placeholder="0.0"
                  className="w-full text-2xl sm:text-3xl font-black px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] focus:ring-2 focus:ring-[#D4A373] outline-none text-right font-mono"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">
                  KG
                </span>
              </div>

              {/* Numpad quick addition buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                <button
                  type="button"
                  data-testid="add-weight-10"
                  onClick={() => addWeight(10)}
                  className="py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-100"
                >
                  +10 kg
                </button>
                <button
                  type="button"
                  data-testid="add-weight-50"
                  onClick={() => addWeight(50)}
                  className="py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-100"
                >
                  +50 kg
                </button>
                <button
                  type="button"
                  data-testid="add-weight-100"
                  onClick={() => addWeight(100)}
                  className="py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-100"
                >
                  +100 kg
                </button>
                <button
                  type="button"
                  data-testid="clear-weight"
                  onClick={() => setFieldWeightKg('')}
                  className="py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100"
                >
                  Hapus
                </button>
              </div>
            </div>

            {/* Price Input */}
            <div className="bg-[#F7F6F2] p-4 rounded-xl border border-gray-200 space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-black uppercase text-gray-700 tracking-wider">
                  4. Harga Beli per Kg (Rp)
                </label>
                <span className="text-[11px] text-gray-500 font-medium">Pre-filled harga terakhir</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  data-testid="price-per-kg-input"
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                  placeholder="2450"
                  className="w-full text-2xl sm:text-3xl font-black px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] focus:ring-2 focus:ring-[#D4A373] outline-none text-right font-mono"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">
                  RP / KG
                </span>
              </div>

              {/* Price preset buttons */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  data-testid="price-preset-2400"
                  onClick={() => setPricePerKg('2400')}
                  className="py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-100"
                >
                  2.400
                </button>
                <button
                  type="button"
                  data-testid="price-preset-2450"
                  onClick={() => setPricePerKg('2450')}
                  className="py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-100"
                >
                  2.450
                </button>
                <button
                  type="button"
                  data-testid="price-preset-2700"
                  onClick={() => setPricePerKg('2700')}
                  className="py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-100"
                >
                  2.700
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Large Calculation Banner */}
          <div className="bg-[#FEFAE0] border-2 border-[#D4A373] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
            <div>
              <p className="text-xs font-bold uppercase text-gray-600 tracking-wider">
                Total Pembayaran ke Petani (Tunai)
              </p>
              <p className="text-xs text-gray-500 font-medium">
                {weightNum > 0 ? `${weightNum} Kg × Rp ${priceNum.toLocaleString('id-ID')}` : 'Masukkan berat & harga'}
              </p>
            </div>
            <div data-testid="live-total-cost" className="text-2xl sm:text-4xl font-black text-[#1E4620] font-sans">
              Rp {totalCost.toLocaleString('id-ID')}
            </div>
          </div>

          {/* Optional Attachments / Notes */}
          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer text-xs font-bold text-gray-700 border border-gray-300 transition-colors">
              <Camera className="w-4 h-4 text-gray-600" />
              <span>{photoUrl ? 'Foto Terlampir (Ubah)' : 'Foto Nota / Buah (Opsional)'}</span>
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
            </label>
            {photoUrl && (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Foto tersimpan di IndexedDB
              </span>
            )}
          </div>

          {/* Submit Action Button with Anti-Double Click Protection */}
          <button
            type="submit"
            disabled={isSubmitting || weightNum <= 0 || !farmerName.trim()}
            data-testid="submit-purchase-btn"
            className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-[#1E4620] hover:bg-[#2C662F] text-white font-black text-lg sm:text-xl shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border-2 border-[#1E4620] active:scale-[0.99]"
          >
            <Check className="w-6 h-6 text-[#D4A373]" />
            <span>{isSubmitting ? 'MENYIMPAN NOTA TIMBANGAN...' : 'SIMPAN NOTA TIMBANGAN (TUNAI)'}</span>
          </button>
        </form>
      </div>

      {/* Recent Purchases List on Tablet */}
      {recentPurchases.length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm space-y-3">
          <h3 className="text-sm font-black uppercase text-gray-700 tracking-wider flex items-center justify-between">
            <span>Riwayat 5 Timbangan Terakhir Hari Ini</span>
            <span className="text-xs font-normal text-gray-500">Tersimpan di Tablet</span>
          </h3>
          <div className="divide-y divide-gray-100">
            {recentPurchases.map((p) => (
              <div
                key={p.local_id || p.id}
                data-testid={`recent-purchase-row-${p.local_id}`}
                className="py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 rounded-lg px-2 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{p.farmer_name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.commodity_type === 'BERONDOL' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                      {p.commodity_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {p.field_weight_kg} Kg @ Rp {Number(p.price_per_kg).toLocaleString('id-ID')} • {new Date(p.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-sm text-[#1E4620]">
                    Rp {Number(p.total_cost).toLocaleString('id-ID')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveReceipt(p)}
                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg"
                    title="Lihat Nota"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Digital Receipt Modal */}
      {activeReceipt && (
        <DigitalReceiptModal data={activeReceipt} onClose={() => setActiveReceipt(null)} />
      )}
    </div>
  );
}
