import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import { useSync } from '../../context/SyncContext';
import { toast } from 'sonner';
import { Truck, Calculator, AlertTriangle, Check, DollarSign, RotateCcw } from 'lucide-react';
import { DigitalReceiptModal } from '../DigitalReceiptModal';

export function SalesTripEntry({ prefilledDispatchedKg }) {
  const { stockPool, triggerSync, refreshStockPool, updatePendingCount } = useSync();

  // Form States
  const [loadingName, setLoadingName] = useState('Loading RAM Sawit Sejahtera');
  const [notaNumber, setNotaNumber] = useState('');
  const [commodityType, setCommodityType] = useState('TBS');
  const [dispatchedWeightKg, setDispatchedWeightKg] = useState(prefilledDispatchedKg ? String(prefilledDispatchedKg) : '');
  const [loadingWeightKg, setLoadingWeightKg] = useState('');

  // Grading
  const [gradeAWeight, setGradeAWeight] = useState('');
  const [gradeAPrice, setGradeAPrice] = useState('2650');
  const [gradeBWeight, setGradeBWeight] = useState('');
  const [gradeBPrice, setGradeBPrice] = useState('2200');
  const [gradeBReturnedKg, setGradeBReturnedKg] = useState(''); // Bawa pulang ke berondol

  // Logistics
  const [transportRateType, setTransportRateType] = useState('70000'); // '70000', '100000', 'CUSTOM'
  const [customTransportRate, setCustomTransportRate] = useState('70000');
  const [unloadingRateTbs, setUnloadingRateTbs] = useState('25');
  const [unloadingRateBerondol, setUnloadingRateBerondol] = useState('30');
  const [tips, setTips] = useState('10000');

  // Payment Status
  const [paymentStatus, setPaymentStatus] = useState('COD'); // 'COD' or 'PENDING'
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  useEffect(() => {
    if (prefilledDispatchedKg) {
      setDispatchedWeightKg(String(prefilledDispatchedKg));
    }
  }, [prefilledDispatchedKg]);

  // Calculations
  const dispW = parseFloat(dispatchedWeightKg) || 0;
  const loadW = parseFloat(loadingWeightKg) || 0;

  // Susut Timbangan
  const weightLossKg = Math.max(0, dispW - loadW);
  const weightLossPct = dispW > 0 ? (weightLossKg / dispW) * 100 : 0;
  const isAnomaly = weightLossPct > 5.0;

  // Potongan Wajib 2%
  const deduction2pctKg = loadW * 0.02;
  const billableWeightKg = loadW * 0.98;

  // Auto-fill Grade A with billable weight if empty
  const handleAutoFillGradeA = () => {
    const retB = parseFloat(gradeBReturnedKg) || 0;
    const soldB = parseFloat(gradeBWeight) || 0;
    const remaining = Math.max(0, billableWeightKg - soldB - retB);
    setGradeAWeight(String(Math.round(remaining * 10) / 10));
  };

  // Revenues
  const gA_w = parseFloat(gradeAWeight) || 0;
  const gA_p = parseFloat(gradeAPrice) || 0;
  const gA_rev = gA_w * gA_p;

  const gB_w = parseFloat(gradeBWeight) || 0;
  const gB_p = parseFloat(gradeBPrice) || 0;
  const gB_rev = gB_w * gB_p;

  const totalRevenue = gA_rev + gB_rev;

  // COGS using current WAC
  const currentWac = commodityType === 'BERONDOL' ? (stockPool.wac_berondol || 2700) : (stockPool.wac_tbs || 2450);
  const returB_kg = parseFloat(gradeBReturnedKg) || 0;
  // Dispatched sold = dispatched weight minus Grade B brought back to pool
  const netDispatchedSoldKg = Math.max(0, dispW - returB_kg);
  const cogsAllocated = Math.round(netDispatchedSoldKg * currentWac);

  // Logistics
  const activeTransportRate = transportRateType === 'CUSTOM' ? parseFloat(customTransportRate) || 0 : parseFloat(transportRateType) || 70000;
  const tonase = dispW / 1000.0;
  const transportCost = Math.round(tonase * activeTransportRate);

  const unloadingRate = commodityType === 'BERONDOL' ? parseFloat(unloadingRateBerondol) || 30 : parseFloat(unloadingRateTbs) || 25;
  const unloadingCost = Math.round(loadW * unloadingRate);
  const tipsCost = parseFloat(tips) || 0;
  const totalLogistics = transportCost + unloadingCost + tipsCost;

  // Net Margin
  const netMargin = Math.round(totalRevenue - cogsAllocated - totalLogistics);

  const handleSubmitTrip = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (dispW <= 0 || loadW <= 0) {
      toast.error('Masukkan berat keberangkatan & berat timbang loading.');
      return;
    }
    if (totalRevenue <= 0) {
      toast.error('Masukkan data Grade A / Grade B penjualan.');
      return;
    }

    try {
      setIsSubmitting(true);
      const localId = `TRIP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
      const tripDate = new Date().toISOString();

      const tripDoc = {
        local_id: localId,
        trip_date: tripDate,
        loading_name: loadingName.trim(),
        nota_number: notaNumber.trim() || `NOTA-${localId.slice(-6)}`,
        commodity_type: commodityType,
        dispatched_weight_kg: dispW,
        loading_weight_kg: loadW,
        weight_loss_kg: Math.round(weightLossKg * 100) / 100,
        weight_loss_pct: Math.round(weightLossPct * 100) / 100,
        is_anomaly: isAnomaly,
        deduction_2pct_kg: Math.round(deduction2pctKg * 100) / 100,
        billable_weight_kg: Math.round(billableWeightKg * 100) / 100,
        grade_a: {
          weight_kg: gA_w,
          price_per_kg: gA_p,
          revenue: Math.round(gA_rev)
        },
        grade_b_sold: {
          weight_kg: gB_w,
          price_per_kg: gB_p,
          revenue: Math.round(gB_rev)
        },
        grade_b_returned_kg: returB_kg,
        cogs_allocated: cogsAllocated,
        wac_unit_applied: currentWac,
        transport_rate_per_ton: activeTransportRate,
        transport_cost: transportCost,
        unloading_cost: unloadingCost,
        tips: tipsCost,
        total_logistic_expenses: totalLogistics,
        total_revenue: Math.round(totalRevenue),
        net_margin: netMargin,
        payment_status: paymentStatus,
        due_date: paymentStatus === 'PENDING' ? dueDate : null,
        notes: notes.trim(),
        synced: 0
      };

      // 1. Save to IndexedDB
      await db.trips.add(tripDoc);

      // 2. Refresh memory & pool
      await updatePendingCount();
      await refreshStockPool();

      // 3. Trigger background sync
      triggerSync(false);

      // 4. Show receipt modal
      setActiveReceipt(tripDoc);
      toast.success(`Trip ke ${loadingName} Berhasil Disimpan! Margin Bersih: Rp ${netMargin.toLocaleString('id-ID')}`);

      // 5. Reset
      setDispatchedWeightKg('');
      setLoadingWeightKg('');
      setGradeAWeight('');
      setGradeBWeight('');
      setGradeBReturnedKg('');
      setNotaNumber('');
    } catch (err) {
      console.error('Error saving sales trip:', err);
      toast.error('Gagal menyimpan trip penjualan ke memori lokal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border-2 border-[#1E4620] overflow-hidden">
        {/* Banner */}
        <div className="bg-[#1E4620] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4A373] text-[#1E4620] flex items-center justify-center font-black">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-tight">
                Entri Trip Jual ke Loading RAM
              </h2>
              <p className="text-xs text-[#FEFAE0]">
                Perhitungan otomatis Potongan 2%, Susut, Retur Grade B & Margin Dagang
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-emerald-800 text-emerald-100 font-bold text-xs border border-emerald-600">
            WAC Terkini: Rp {Number(currentWac).toLocaleString('id-ID')}/Kg
          </span>
        </div>

        <form onSubmit={handleSubmitTrip} className="p-5 sm:p-6 space-y-6">
          {/* Top Info: Loading Name & Commodity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1.5">
                Nama RAM / Loading Tujuan
              </label>
              <input
                type="text"
                data-testid="trip-loading-name-input"
                value={loadingName}
                onChange={(e) => setLoadingName(e.target.value)}
                placeholder="Contoh: RAM Sawit Sejahtera..."
                className="w-full text-base font-bold px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1.5">
                Nomor Nota Loading
              </label>
              <input
                type="text"
                data-testid="trip-nota-number-input"
                value={notaNumber}
                onChange={(e) => setNotaNumber(e.target.value)}
                placeholder="Contoh: NOTA-RAM-901"
                className="w-full text-base font-bold px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none"
              />
            </div>
          </div>

          {/* Section 1: Weights & Shrinkage */}
          <div className="bg-[#F7F6F2] p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#1E4620]" />
              <span>1. Rekonsiliasi Timbangan & Potongan Wajib 2%</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Berat Berangkat dari Lapangan (Kg)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    data-testid="trip-dispatched-weight-input"
                    value={dispatchedWeightKg}
                    onChange={(e) => setDispatchedWeightKg(e.target.value)}
                    placeholder="Contoh: 2000"
                    className="w-full text-xl font-black px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none text-right font-mono"
                    required
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    LAPANGAN
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Berat Hasil Timbang Loading RAM (Kg)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    data-testid="trip-loading-weight-input"
                    value={loadingWeightKg}
                    onChange={(e) => setLoadingWeightKg(e.target.value)}
                    placeholder="Contoh: 1960"
                    className="w-full text-xl font-black px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none text-right font-mono"
                    required
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    LOADING
                  </span>
                </div>
              </div>
            </div>

            {/* Susut & Deduction Indicators */}
            {loadW > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Shrinkage Pill */}
                <div
                  data-testid="shrinkage-indicator-card"
                  className={`p-3 rounded-xl border-2 flex items-center justify-between ${
                    isAnomaly
                      ? 'bg-red-50 border-red-400 text-red-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isAnomaly && <AlertTriangle className="w-5 h-5 text-red-600 animate-bounce" />}
                    <div>
                      <span className="text-[11px] uppercase font-bold block">
                        Susut Timbangan (Selisih)
                      </span>
                      <span className="text-xs font-medium">
                        {isAnomaly ? '⚠️ Anomali Susut > 5% Perlu Perhatian' : 'Dalam Batas Normal'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span data-testid="shrinkage-weight-kg" className="font-mono font-black text-base block">
                      {weightLossKg.toFixed(1)} Kg
                    </span>
                    <span data-testid="shrinkage-percentage" className="text-xs font-bold">
                      ({weightLossPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* 2% Mandatory Deduction */}
                <div className="p-3 rounded-xl border-2 bg-blue-50 border-blue-300 text-blue-900 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase font-bold block">Potongan Wajib 2%</span>
                    <span className="text-xs font-medium">Dipungut oleh Pabrik/Loading</span>
                  </div>
                  <div className="text-right">
                    <span data-testid="deduction-2pct-kg" className="font-mono font-black text-base block">
                      {deduction2pctKg.toFixed(1)} Kg
                    </span>
                    <span data-testid="billable-weight-kg" className="text-xs font-bold text-blue-800">
                      Net: {billableWeightKg.toFixed(1)} Kg
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Grading Split & Retur Grade B */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-gray-200 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">
                2. Rincian Grading & Logika Bawa Pulang Grade B
              </h3>
              {billableWeightKg > 0 && (
                <button
                  type="button"
                  data-testid="auto-fill-grade-a-btn"
                  onClick={handleAutoFillGradeA}
                  className="text-xs font-bold text-[#1E4620] hover:underline"
                >
                  Isi Otomatis Grade A
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Grade A */}
              <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                <span className="text-xs font-black text-emerald-900 uppercase block">
                  Grade A (Diterima Penuh)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 block">Berat (Kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      data-testid="grade-a-weight-input"
                      value={gradeAWeight}
                      onChange={(e) => setGradeAWeight(e.target.value)}
                      placeholder="0.0"
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 block">Harga/Kg (Rp)</label>
                    <input
                      type="number"
                      data-testid="grade-a-price-input"
                      value={gradeAPrice}
                      onChange={(e) => setGradeAPrice(e.target.value)}
                      placeholder="2650"
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                </div>
                <div className="text-right text-xs font-black text-emerald-900 pt-1">
                  Subtotal: Rp {Math.round(gA_rev).toLocaleString('id-ID')}
                </div>
              </div>

              {/* Grade B Terjual */}
              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-2">
                <span className="text-xs font-black text-amber-900 uppercase block">
                  Grade B (Terjual Diskon)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 block">Berat Terjual (Kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      data-testid="grade-b-weight-input"
                      value={gradeBWeight}
                      onChange={(e) => setGradeBWeight(e.target.value)}
                      placeholder="0.0"
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 block">Harga/Kg (Rp)</label>
                    <input
                      type="number"
                      data-testid="grade-b-price-input"
                      value={gradeBPrice}
                      onChange={(e) => setGradeBPrice(e.target.value)}
                      placeholder="2200"
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                </div>
                <div className="text-right text-xs font-black text-amber-900 pt-1">
                  Subtotal: Rp {Math.round(gB_rev).toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Special Feature: Grade B Bawa Pulang (Retur ke Berondol) */}
            <div className="bg-[#FEFAE0] p-4 rounded-xl border-2 border-[#D4A373] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <RotateCcw className="w-5 h-5 text-amber-800 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-black uppercase text-gray-800 block">
                    Fitur Retur: Grade B Bawa Pulang (Kg)
                  </span>
                  <p className="text-xs text-gray-600">
                    Jika tidak dijual, masukkan berat buah yang dibawa pulang untuk dijadikan berondol. Sistem otomatis mengembalikan berat ini ke Pool Berondol.
                  </p>
                </div>
              </div>

              <div className="w-full sm:w-44">
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    data-testid="grade-b-returned-input"
                    value={gradeBReturnedKg}
                    onChange={(e) => setGradeBReturnedKg(e.target.value)}
                    placeholder="0.0"
                    className="w-full font-mono font-black text-lg px-3 py-2 rounded-xl border-2 border-[#D4A373] outline-none text-right bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    RETUR KG
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Logistics Costs */}
          <div className="bg-[#F7F6F2] p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">
              3. Kalkulasi Biaya Logistik & Operasional Trip
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Transport Rate Options */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">Tarif Transport / Ton</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    data-testid="transport-rate-70k"
                    onClick={() => setTransportRateType('70000')}
                    className={`py-2 px-1 text-xs font-bold rounded-lg border ${
                      transportRateType === '70000'
                        ? 'bg-[#1E4620] text-white border-[#1E4620]'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    70 Ribu
                  </button>
                  <button
                    type="button"
                    data-testid="transport-rate-100k"
                    onClick={() => setTransportRateType('100000')}
                    className={`py-2 px-1 text-xs font-bold rounded-lg border ${
                      transportRateType === '100000'
                        ? 'bg-[#1E4620] text-white border-[#1E4620]'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    100 Ribu
                  </button>
                  <button
                    type="button"
                    data-testid="transport-rate-custom"
                    onClick={() => setTransportRateType('CUSTOM')}
                    className={`py-2 px-1 text-xs font-bold rounded-lg border ${
                      transportRateType === 'CUSTOM'
                        ? 'bg-[#1E4620] text-white border-[#1E4620]'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {transportRateType === 'CUSTOM' && (
                  <input
                    type="number"
                    data-testid="custom-transport-rate-input"
                    value={customTransportRate}
                    onChange={(e) => setCustomTransportRate(e.target.value)}
                    placeholder="Tarif per ton..."
                    className="w-full mt-1 font-mono text-sm px-3 py-1.5 rounded-lg border border-gray-300 outline-none text-right"
                  />
                )}
                <div className="text-right text-xs font-bold text-gray-700 pt-1">
                  Total: Rp {transportCost.toLocaleString('id-ID')}
                </div>
              </div>

              {/* Unloading Costs */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">Biaya Bongkar (Rp/Kg)</label>
                <input
                  type="number"
                  data-testid="unloading-rate-input"
                  value={unloadingRateTbs}
                  onChange={(e) => setUnloadingRateTbs(e.target.value)}
                  placeholder="25"
                  className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                />
                <div className="text-right text-xs font-bold text-gray-700 pt-1">
                  Total Bongkar: Rp {unloadingCost.toLocaleString('id-ID')}
                </div>
              </div>

              {/* Tips */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">Tips / Uang Kopi Bongkar</label>
                <input
                  type="number"
                  data-testid="trip-tips-input"
                  value={tips}
                  onChange={(e) => setTips(e.target.value)}
                  placeholder="10000"
                  className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                />
                <div className="text-right text-xs font-bold text-gray-700 pt-1">
                  Tips: Rp {tipsCost.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Live Net Margin Summary Card */}
          <div className="bg-[#1E4620] text-white p-5 rounded-2xl shadow-xl space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b border-white/20 pb-4">
              <div>
                <span className="text-gray-300 block">Total Omzet:</span>
                <span data-testid="live-total-revenue" className="font-bold text-sm text-[#D4A373]">
                  Rp {Math.round(totalRevenue).toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-gray-300 block">Modal Pokok (COGS):</span>
                <span data-testid="live-cogs-allocated" className="font-bold text-sm">
                  Rp {cogsAllocated.toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-gray-300 block">Biaya Logistik:</span>
                <span data-testid="live-total-logistics" className="font-bold text-sm">
                  Rp {totalLogistics.toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-gray-300 block">WAC Modal Digunakan:</span>
                <span className="font-bold text-sm">
                  Rp {Number(currentWac).toLocaleString('id-ID')} / Kg
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div>
                <span className="text-xs font-black uppercase text-[#D4A373] tracking-wider block">
                  MARGIN DAGANG BERSIH (NET MARGIN TRIP)
                </span>
                <span className="text-xs text-gray-300">
                  Omzet − Modal Terjual − Transport − Bongkar − Tips
                </span>
              </div>
              <div
                data-testid="live-net-margin"
                className={`text-2xl sm:text-3xl font-black font-mono ${
                  netMargin >= 0 ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                Rp {netMargin.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Payment Status (COD vs Piutang) */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <label className="block text-xs font-black uppercase text-gray-700 tracking-wider">
              4. Status Pembayaran dari Pihak Loading RAM
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="payment-status-cod"
                onClick={() => setPaymentStatus('COD')}
                className={`py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all ${
                  paymentStatus === 'COD'
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-md'
                    : 'bg-gray-100 text-gray-700 border-gray-300'
                }`}
              >
                💵 Tunai di Tempat (COD / Lunas)
              </button>
              <button
                type="button"
                data-testid="payment-status-pending"
                onClick={() => setPaymentStatus('PENDING')}
                className={`py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all ${
                  paymentStatus === 'PENDING'
                    ? 'bg-amber-700 text-white border-amber-700 shadow-md'
                    : 'bg-gray-100 text-gray-700 border-gray-300'
                }`}
              >
                ⏳ Piutang (Pending Tempo)
              </button>
            </div>

            {paymentStatus === 'PENDING' && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Tanggal Jatuh Tempo Pelunasan
                </label>
                <input
                  type="date"
                  data-testid="trip-due-date-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full sm:w-64 font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
            )}
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isSubmitting || dispW <= 0 || loadW <= 0}
            data-testid="submit-trip-btn"
            className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-[#1E4620] hover:bg-[#2C662F] text-white font-black text-lg sm:text-xl shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border-2 border-[#1E4620] active:scale-[0.99]"
          >
            <Check className="w-6 h-6 text-[#D4A373]" />
            <span>{isSubmitting ? 'MENYIMPAN LAPORAN TRIP...' : 'SIMPAN TRIP & REKONSILIASI STOK'}</span>
          </button>
        </form>
      </div>

      {activeReceipt && (
        <DigitalReceiptModal data={activeReceipt} onClose={() => setActiveReceipt(null)} />
      )}
    </div>
  );
}
