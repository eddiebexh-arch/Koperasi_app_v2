import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import { useSync } from '../../context/SyncContext';
import { toast } from 'sonner';
import { Truck, Calculator, AlertTriangle, Check, RotateCcw, Calendar } from 'lucide-react';
import { DigitalReceiptModal } from '../DigitalReceiptModal';
import { nowLocalDateTimeInput, fromLocalDateTimeInput, toLocalDateTimeInput } from '../../lib/dateUtils';

/**
 * SalesTripEntry
 * - Dual commodity (TBS + Berondol in one truck) with proportional transport split
 * - Editable unloading rate per ton (default: TBS 40k, Berondol 60k)
 * - Backdated trip_date via datetime-local input (unlimited past)
 * - Edit mode when `initialData` is provided
 */
export function SalesTripEntry({ prefilledDispatchedKg, initialData, onDone }) {
  const isEditing = !!initialData;
  const { stockPool, triggerSync, refreshStockPool, updatePendingCount } = useSync();

  // Header
  const [tripDateLocal, setTripDateLocal] = useState(
    initialData?.trip_date ? toLocalDateTimeInput(initialData.trip_date) : nowLocalDateTimeInput()
  );
  const [loadingName, setLoadingName] = useState(initialData?.loading_name || 'Loading RAM Sawit Sejahtera');
  const [notaNumber, setNotaNumber] = useState(initialData?.nota_number || '');

  // Dual commodity weights
  const [tbsDispatchedKg, setTbsDispatchedKg] = useState(
    initialData?.tbs_dispatched_kg
      ? String(initialData.tbs_dispatched_kg)
      : (initialData?.commodity_type === 'BERONDOL' ? '' : (prefilledDispatchedKg ? String(prefilledDispatchedKg) : ''))
  );
  const [brdDispatchedKg, setBrdDispatchedKg] = useState(
    initialData?.berondol_dispatched_kg ? String(initialData.berondol_dispatched_kg) : ''
  );
  const [tbsLoadingKg, setTbsLoadingKg] = useState(
    initialData?.tbs_loading_kg ? String(initialData.tbs_loading_kg) : ''
  );
  const [brdLoadingKg, setBrdLoadingKg] = useState(
    initialData?.berondol_loading_kg ? String(initialData.berondol_loading_kg) : ''
  );

  // TBS Grading
  const [gradeAWeight, setGradeAWeight] = useState(
    initialData?.grade_a?.weight_kg ? String(initialData.grade_a.weight_kg) : ''
  );
  const [gradeAPrice, setGradeAPrice] = useState(
    initialData?.grade_a?.price_per_kg ? String(initialData.grade_a.price_per_kg) : '2650'
  );
  const [gradeBWeight, setGradeBWeight] = useState(
    initialData?.grade_b_sold?.weight_kg ? String(initialData.grade_b_sold.weight_kg) : ''
  );
  const [gradeBPrice, setGradeBPrice] = useState(
    initialData?.grade_b_sold?.price_per_kg ? String(initialData.grade_b_sold.price_per_kg) : '2200'
  );
  const [gradeBReturnedKg, setGradeBReturnedKg] = useState(
    initialData?.grade_b_returned_kg ? String(initialData.grade_b_returned_kg) : ''
  );

  // Berondol direct sale (jual langsung di trip yang sama)
  const [brdSoldWeight, setBrdSoldWeight] = useState(
    initialData?.berondol_sold?.weight_kg ? String(initialData.berondol_sold.weight_kg) : ''
  );
  const [brdSoldPrice, setBrdSoldPrice] = useState(
    initialData?.berondol_sold?.price_per_kg ? String(initialData.berondol_sold.price_per_kg) : '2900'
  );

  // Logistics
  const [transportRateType, setTransportRateType] = useState(
    initialData?.transport_rate_per_ton === 100000 ? '100000'
    : initialData?.transport_rate_per_ton && initialData.transport_rate_per_ton !== 70000 ? 'CUSTOM'
    : '70000'
  );
  const [customTransportRate, setCustomTransportRate] = useState(
    initialData?.transport_rate_per_ton ? String(initialData.transport_rate_per_ton) : '70000'
  );
  const [unloadingRateTbsTon, setUnloadingRateTbsTon] = useState(
    initialData?.unloading_rate_tbs_per_ton ? String(initialData.unloading_rate_tbs_per_ton) : '40000'
  );
  const [unloadingRateBrdTon, setUnloadingRateBrdTon] = useState(
    initialData?.unloading_rate_berondol_per_ton ? String(initialData.unloading_rate_berondol_per_ton) : '60000'
  );
  const [tips, setTips] = useState(initialData?.tips !== undefined ? String(initialData.tips) : '10000');

  // Payment
  const [paymentStatus, setPaymentStatus] = useState(initialData?.payment_status || 'COD');
  const [dueDate, setDueDate] = useState(initialData?.due_date || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  useEffect(() => {
    if (prefilledDispatchedKg && !isEditing) {
      setTbsDispatchedKg(String(prefilledDispatchedKg));
    }
  }, [prefilledDispatchedKg, isEditing]);

  // ---------- CALCULATIONS ----------
  const tbsDisp = parseFloat(tbsDispatchedKg) || 0;
  const brdDisp = parseFloat(brdDispatchedKg) || 0;
  const tbsLoad = parseFloat(tbsLoadingKg) || 0;
  const brdLoad = parseFloat(brdLoadingKg) || 0;

  const totalDisp = tbsDisp + brdDisp;
  const totalLoad = tbsLoad + brdLoad;

  // Susut
  const weightLossKg = Math.max(0, totalDisp - totalLoad);
  const weightLossPct = totalDisp > 0 ? (weightLossKg / totalDisp) * 100 : 0;
  const isAnomaly = weightLossPct > 5.0;

  // 2% deduction (informational)
  const deduction2pctKg = totalLoad * 0.02;
  const billableWeightKg = totalLoad * 0.98;

  // Revenue
  const gA_w = parseFloat(gradeAWeight) || 0;
  const gA_p = parseFloat(gradeAPrice) || 0;
  const gA_rev = gA_w * gA_p;

  const gB_w = parseFloat(gradeBWeight) || 0;
  const gB_p = parseFloat(gradeBPrice) || 0;
  const gB_rev = gB_w * gB_p;

  const brdS_w = parseFloat(brdSoldWeight) || 0;
  const brdS_p = parseFloat(brdSoldPrice) || 0;
  const brdS_rev = brdS_w * brdS_p;

  const totalRevenue = gA_rev + gB_rev + brdS_rev;

  // COGS
  const wacTbs = stockPool.wac_tbs || 2450;
  const wacBrd = stockPool.wac_berondol || 2700;
  const returB_kg = parseFloat(gradeBReturnedKg) || 0;

  const netTbsSoldKg = Math.max(0, tbsDisp - returB_kg);
  const cogsTbs = netTbsSoldKg * wacTbs;
  const cogsBrd = brdDisp * wacBrd;
  const cogsAllocated = Math.round(cogsTbs + cogsBrd);

  // Logistics
  const activeTransportRate = transportRateType === 'CUSTOM'
    ? parseFloat(customTransportRate) || 0
    : parseFloat(transportRateType) || 70000;
  const totalTon = totalDisp / 1000.0;
  const transportCost = Math.round(totalTon * activeTransportRate);
  // Proportional split (informational)
  const transportShareTbs = totalDisp > 0 ? Math.round(transportCost * (tbsDisp / totalDisp)) : 0;
  const transportShareBrd = totalDisp > 0 ? transportCost - transportShareTbs : 0;

  const rateTbsTon = parseFloat(unloadingRateTbsTon) || 40000;
  const rateBrdTon = parseFloat(unloadingRateBrdTon) || 60000;
  const unloadingCostTbs = Math.round((tbsLoad / 1000) * rateTbsTon);
  const unloadingCostBrd = Math.round((brdLoad / 1000) * rateBrdTon);
  const unloadingCost = unloadingCostTbs + unloadingCostBrd;

  const tipsCost = parseFloat(tips) || 0;
  const totalLogistics = transportCost + unloadingCost + tipsCost;

  const netMargin = Math.round(totalRevenue - cogsAllocated - totalLogistics);

  // Auto-fill Grade A helper
  const handleAutoFillGradeA = () => {
    // Fill Grade A with TBS loading weight * 0.98 minus already allocated (grade B sold + returned)
    const tbsBillable = tbsLoad * 0.98;
    const remaining = Math.max(0, tbsBillable - gB_w - returB_kg);
    setGradeAWeight(String(Math.round(remaining * 10) / 10));
  };

  const commodityLabel = tbsDisp > 0 && brdDisp > 0 ? 'DUAL' : (brdDisp > 0 ? 'BERONDOL' : 'TBS');

  const handleSubmitTrip = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (totalDisp <= 0 || totalLoad <= 0) {
      toast.error('Masukkan minimal 1 komoditas dengan berat lapangan & berat loading.');
      return;
    }
    if (totalRevenue <= 0) {
      toast.error('Masukkan data penjualan (Grade A / Grade B / Berondol).');
      return;
    }

    try {
      setIsSubmitting(true);
      const localId = initialData?.local_id
        || `TRIP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
      const tripDate = fromLocalDateTimeInput(tripDateLocal);

      const tripDoc = {
        local_id: localId,
        trip_date: tripDate,
        loading_name: loadingName.trim(),
        nota_number: notaNumber.trim() || `NOTA-${localId.slice(-6)}`,
        commodity_type: commodityLabel,
        // Dual weights
        tbs_dispatched_kg: tbsDisp,
        berondol_dispatched_kg: brdDisp,
        tbs_loading_kg: tbsLoad,
        berondol_loading_kg: brdLoad,
        dispatched_weight_kg: totalDisp,
        loading_weight_kg: totalLoad,
        weight_loss_kg: Math.round(weightLossKg * 100) / 100,
        weight_loss_pct: Math.round(weightLossPct * 100) / 100,
        is_anomaly: isAnomaly,
        deduction_2pct_kg: Math.round(deduction2pctKg * 100) / 100,
        billable_weight_kg: Math.round(billableWeightKg * 100) / 100,
        // Grading
        grade_a: { weight_kg: gA_w, price_per_kg: gA_p, revenue: Math.round(gA_rev) },
        grade_b_sold: { weight_kg: gB_w, price_per_kg: gB_p, revenue: Math.round(gB_rev) },
        grade_b_returned_kg: returB_kg,
        berondol_sold: { weight_kg: brdS_w, price_per_kg: brdS_p, revenue: Math.round(brdS_rev) },
        // Costs
        cogs_allocated: cogsAllocated,
        wac_tbs_applied: wacTbs,
        wac_berondol_applied: wacBrd,
        transport_rate_per_ton: activeTransportRate,
        transport_cost: transportCost,
        unloading_rate_tbs_per_ton: rateTbsTon,
        unloading_rate_berondol_per_ton: rateBrdTon,
        unloading_cost: unloadingCost,
        tips: tipsCost,
        total_logistic_expenses: totalLogistics,
        total_revenue: Math.round(totalRevenue),
        net_margin: netMargin,
        payment_status: paymentStatus,
        due_date: paymentStatus === 'PENDING' ? dueDate : null,
        notes: notes.trim(),
        synced: 0,
        updated_at: new Date().toISOString()
      };

      if (isEditing) {
        // update by id if we have local dexie id, else by local_id
        const existing = await db.trips.where('local_id').equals(localId).first();
        if (existing) {
          await db.trips.update(existing.id, tripDoc);
        } else {
          await db.trips.add(tripDoc);
        }
        toast.success(`Trip berhasil diperbarui. Margin Baru: Rp ${netMargin.toLocaleString('id-ID')}`);
      } else {
        await db.trips.add(tripDoc);
        toast.success(`Trip ke ${loadingName} Berhasil Disimpan! Margin Bersih: Rp ${netMargin.toLocaleString('id-ID')}`);
      }

      await updatePendingCount();
      await refreshStockPool();
      triggerSync(false);

      if (!isEditing) {
        setActiveReceipt(tripDoc);
        // reset
        setTbsDispatchedKg('');
        setBrdDispatchedKg('');
        setTbsLoadingKg('');
        setBrdLoadingKg('');
        setGradeAWeight('');
        setGradeBWeight('');
        setGradeBReturnedKg('');
        setBrdSoldWeight('');
        setNotaNumber('');
        setTripDateLocal(nowLocalDateTimeInput());
      }

      if (onDone) onDone(tripDoc);
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
        <div className="bg-[#1E4620] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4A373] text-[#1E4620] flex items-center justify-center font-black">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-tight">
                {isEditing ? 'Edit Trip Jual ke Loading' : 'Entri Trip Jual ke Loading RAM'}
              </h2>
              <p className="text-xs text-[#FEFAE0]">
                Mendukung TBS + Berondol dalam 1 truk (Dual Commodity)
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-emerald-800 text-emerald-100 font-bold text-xs border border-emerald-600">
            WAC TBS: Rp {Number(wacTbs).toLocaleString('id-ID')} • Berondol: Rp {Number(wacBrd).toLocaleString('id-ID')}
          </span>
        </div>

        <form onSubmit={handleSubmitTrip} className="p-5 sm:p-6 space-y-6">
          {/* Trip Date + Loading Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Tanggal & Jam Trip
              </label>
              <input
                type="datetime-local"
                data-testid="trip-date-input"
                value={tripDateLocal}
                onChange={(e) => setTripDateLocal(e.target.value)}
                className="w-full text-sm font-bold px-3 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none"
              />
              <p className="text-[10px] text-gray-500 mt-1">Bisa isi tanggal mundur untuk backfill data lama</p>
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1.5">
                Nama RAM / Loading Tujuan
              </label>
              <input
                type="text"
                data-testid="trip-loading-name-input"
                value={loadingName}
                onChange={(e) => setLoadingName(e.target.value)}
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
                placeholder="Otomatis jika kosong"
                className="w-full text-base font-bold px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none"
              />
            </div>
          </div>

          {/* Dual Commodity Weight Grid */}
          <div className="bg-[#F7F6F2] p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#1E4620]" />
              <span>1. Berat Timbangan per Komoditas (Bisa Salah Satu / Keduanya)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* TBS Card */}
              <div className="bg-emerald-50/70 p-4 rounded-xl border-2 border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-900 uppercase">🌴 TBS (Tandan Buah Segar)</span>
                  <span className="text-[10px] font-bold text-emerald-700">Isi 0 jika tidak muat TBS</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block">Berat Lapangan (Kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      data-testid="trip-tbs-dispatched-input"
                      value={tbsDispatchedKg}
                      onChange={(e) => setTbsDispatchedKg(e.target.value)}
                      placeholder="0"
                      className="w-full text-lg font-black px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-emerald-700 outline-none text-right font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block">Berat Loading (Kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      data-testid="trip-tbs-loading-input"
                      value={tbsLoadingKg}
                      onChange={(e) => setTbsLoadingKg(e.target.value)}
                      placeholder="0"
                      className="w-full text-lg font-black px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-emerald-700 outline-none text-right font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Berondol Card */}
              <div className="bg-amber-50/70 p-4 rounded-xl border-2 border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 uppercase">🌰 Berondol (Buah Lepas)</span>
                  <span className="text-[10px] font-bold text-amber-700">Isi 0 jika tidak muat Berondol</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block">Berat Lapangan (Kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      data-testid="trip-brd-dispatched-input"
                      value={brdDispatchedKg}
                      onChange={(e) => setBrdDispatchedKg(e.target.value)}
                      placeholder="0"
                      className="w-full text-lg font-black px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-amber-700 outline-none text-right font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block">Berat Loading (Kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      data-testid="trip-brd-loading-input"
                      value={brdLoadingKg}
                      onChange={(e) => setBrdLoadingKg(e.target.value)}
                      placeholder="0"
                      className="w-full text-lg font-black px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-amber-700 outline-none text-right font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Aggregate indicators */}
            {totalLoad > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div
                  data-testid="shrinkage-indicator-card"
                  className={`p-3 rounded-xl border-2 flex items-center justify-between ${
                    isAnomaly ? 'bg-red-50 border-red-400 text-red-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isAnomaly && <AlertTriangle className="w-5 h-5 text-red-600 animate-bounce" />}
                    <div>
                      <span className="text-[11px] uppercase font-bold block">Susut Total</span>
                      <span className="text-xs font-medium">
                        {isAnomaly ? 'Anomali > 5% Perlu Cek' : 'Dalam Batas Normal'}
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
                <div className="p-3 rounded-xl border-2 bg-blue-50 border-blue-300 text-blue-900 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase font-bold block">Potongan Wajib 2% (Total)</span>
                    <span className="text-xs font-medium">Dipungut Loading</span>
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

          {/* Grading */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-gray-200 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">
                2. Penjualan: TBS (Grade A / B) & Berondol Langsung
              </h3>
              {tbsLoad > 0 && (
                <button
                  type="button"
                  data-testid="auto-fill-grade-a-btn"
                  onClick={handleAutoFillGradeA}
                  className="text-xs font-bold text-[#1E4620] hover:underline"
                >
                  Isi Otomatis Grade A dari TBS
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Grade A */}
              <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                <span className="text-xs font-black text-emerald-900 uppercase block">TBS Grade A</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 block">Berat (Kg)</label>
                    <input
                      type="number" step="0.1"
                      data-testid="grade-a-weight-input"
                      value={gradeAWeight}
                      onChange={(e) => setGradeAWeight(e.target.value)}
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 block">Harga/Kg</label>
                    <input
                      type="number"
                      data-testid="grade-a-price-input"
                      value={gradeAPrice}
                      onChange={(e) => setGradeAPrice(e.target.value)}
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                </div>
                <div className="text-right text-xs font-black text-emerald-900">
                  Rp {Math.round(gA_rev).toLocaleString('id-ID')}
                </div>
              </div>

              {/* Grade B Sold */}
              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-2">
                <span className="text-xs font-black text-amber-900 uppercase block">TBS Grade B (Diskon)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 block">Berat (Kg)</label>
                    <input
                      type="number" step="0.1"
                      data-testid="grade-b-weight-input"
                      value={gradeBWeight}
                      onChange={(e) => setGradeBWeight(e.target.value)}
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 block">Harga/Kg</label>
                    <input
                      type="number"
                      data-testid="grade-b-price-input"
                      value={gradeBPrice}
                      onChange={(e) => setGradeBPrice(e.target.value)}
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                </div>
                <div className="text-right text-xs font-black text-amber-900">
                  Rp {Math.round(gB_rev).toLocaleString('id-ID')}
                </div>
              </div>

              {/* Berondol Direct Sale */}
              <div className="bg-orange-50/60 p-3.5 rounded-xl border border-orange-200 space-y-2">
                <span className="text-xs font-black text-orange-900 uppercase block">Berondol Langsung</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-600 block">Berat (Kg)</label>
                    <input
                      type="number" step="0.1"
                      data-testid="brd-sold-weight-input"
                      value={brdSoldWeight}
                      onChange={(e) => setBrdSoldWeight(e.target.value)}
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 block">Harga/Kg</label>
                    <input
                      type="number"
                      data-testid="brd-sold-price-input"
                      value={brdSoldPrice}
                      onChange={(e) => setBrdSoldPrice(e.target.value)}
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                </div>
                <div className="text-right text-xs font-black text-orange-900">
                  Rp {Math.round(brdS_rev).toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Retur Grade B Bawa Pulang */}
            <div className="bg-[#FEFAE0] p-4 rounded-xl border-2 border-[#D4A373] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <RotateCcw className="w-5 h-5 text-amber-800 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-black uppercase text-gray-800 block">
                    Fitur Retur: Grade B TBS Bawa Pulang (Kg)
                  </span>
                  <p className="text-xs text-gray-600">
                    Otomatis kembali ke pool Berondol dengan modal WAC TBS.
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-44 relative">
                <input
                  type="number" step="0.1"
                  data-testid="grade-b-returned-input"
                  value={gradeBReturnedKg}
                  onChange={(e) => setGradeBReturnedKg(e.target.value)}
                  placeholder="0.0"
                  className="w-full font-mono font-black text-lg px-3 py-2 rounded-xl border-2 border-[#D4A373] outline-none text-right bg-white"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">RETUR KG</span>
              </div>
            </div>
          </div>

          {/* Logistics */}
          <div className="bg-[#F7F6F2] p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
            <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">
              3. Biaya Logistik (Transport, Bongkar per Komoditas)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Transport */}
              <div className="space-y-1.5 md:col-span-1">
                <label className="block text-xs font-bold text-gray-700">Tarif Transport / Ton</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { v: '70000', l: '70 Ribu', t: 'transport-rate-70k' },
                    { v: '100000', l: '100 Ribu', t: 'transport-rate-100k' },
                    { v: 'CUSTOM', l: 'Custom', t: 'transport-rate-custom' }
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      data-testid={opt.t}
                      onClick={() => setTransportRateType(opt.v)}
                      className={`py-2 px-1 text-xs font-bold rounded-lg border ${
                        transportRateType === opt.v
                          ? 'bg-[#1E4620] text-white border-[#1E4620]'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                {transportRateType === 'CUSTOM' && (
                  <input
                    type="number"
                    data-testid="custom-transport-rate-input"
                    value={customTransportRate}
                    onChange={(e) => setCustomTransportRate(e.target.value)}
                    placeholder="Tarif per ton..."
                    className="w-full font-mono text-sm px-3 py-1.5 rounded-lg border border-gray-300 outline-none text-right"
                  />
                )}
                <div className="text-right text-xs font-bold text-gray-700 pt-1">
                  Total Transport: Rp {transportCost.toLocaleString('id-ID')}
                </div>
                {tbsDisp > 0 && brdDisp > 0 && (
                  <div className="text-[10px] text-gray-500 text-right">
                    Split: TBS Rp {transportShareTbs.toLocaleString('id-ID')} • Berondol Rp {transportShareBrd.toLocaleString('id-ID')}
                  </div>
                )}
              </div>

              {/* Unloading (Editable, Default Berondol 60k, TBS 40k per ton) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  Biaya Bongkar per Ton (Editable)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500">TBS (Rp/Ton)</label>
                    <input
                      type="number"
                      data-testid="unloading-rate-tbs-input"
                      value={unloadingRateTbsTon}
                      onChange={(e) => setUnloadingRateTbsTon(e.target.value)}
                      placeholder="40000"
                      className="w-full font-mono text-sm px-2 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Berondol (Rp/Ton)</label>
                    <input
                      type="number"
                      data-testid="unloading-rate-brd-input"
                      value={unloadingRateBrdTon}
                      onChange={(e) => setUnloadingRateBrdTon(e.target.value)}
                      placeholder="60000"
                      className="w-full font-mono text-sm px-2 py-2 rounded-lg border border-gray-300 outline-none text-right"
                    />
                  </div>
                </div>
                <div className="text-right text-[11px] text-gray-600 pt-0.5">
                  TBS: Rp {unloadingCostTbs.toLocaleString('id-ID')} • Berondol: Rp {unloadingCostBrd.toLocaleString('id-ID')}
                </div>
                <div className="text-right text-xs font-bold text-gray-700">
                  Total Bongkar: Rp {unloadingCost.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Tips / Uang Kopi Bongkar</label>
                <input
                  type="number"
                  data-testid="trip-tips-input"
                  value={tips}
                  onChange={(e) => setTips(e.target.value)}
                  placeholder="10000"
                  className="w-full font-mono text-sm px-3 py-2 rounded-lg border border-gray-300 outline-none text-right"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Catatan Trip (Opsional)</label>
                <input
                  type="text"
                  data-testid="trip-notes-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Nomor plat, kondisi jalan, dll."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Live Margin Card */}
          <div className="bg-[#1E4620] text-white p-5 rounded-2xl shadow-xl space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b border-white/20 pb-4">
              <div>
                <span className="text-gray-300 block">Total Omzet:</span>
                <span data-testid="live-total-revenue" className="font-bold text-sm text-[#D4A373]">
                  Rp {Math.round(totalRevenue).toLocaleString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-gray-300 block">Modal (COGS):</span>
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
                <span className="text-gray-300 block">Komoditas:</span>
                <span className="font-bold text-sm">{commodityLabel}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div>
                <span className="text-xs font-black uppercase text-[#D4A373] tracking-wider block">
                  MARGIN DAGANG BERSIH
                </span>
                <span className="text-xs text-gray-300">Omzet − Modal − Transport − Bongkar − Tips</span>
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

          {/* Payment */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <label className="block text-xs font-black uppercase text-gray-700 tracking-wider">
              4. Status Pembayaran dari Loading RAM
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
                Tunai di Tempat (COD)
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
                Piutang (Pending Tempo)
              </button>
            </div>
            {paymentStatus === 'PENDING' && (
              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Jatuh Tempo</label>
                <input
                  type="date"
                  data-testid="trip-due-date-input"
                  value={dueDate || ''}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full sm:w-64 font-bold px-3 py-2 rounded-lg border border-gray-300 outline-none"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || totalDisp <= 0 || totalLoad <= 0}
            data-testid="submit-trip-btn"
            className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-[#1E4620] hover:bg-[#2C662F] text-white font-black text-lg sm:text-xl shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border-2 border-[#1E4620] active:scale-[0.99]"
          >
            <Check className="w-6 h-6 text-[#D4A373]" />
            <span>
              {isSubmitting
                ? 'MENYIMPAN...'
                : (isEditing ? 'PERBARUI TRIP & REKONSILIASI STOK' : 'SIMPAN TRIP & REKONSILIASI STOK')}
            </span>
          </button>
        </form>
      </div>

      {activeReceipt && (
        <DigitalReceiptModal data={activeReceipt} onClose={() => setActiveReceipt(null)} />
      )}
    </div>
  );
}
