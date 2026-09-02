import React, { useEffect } from 'react';
import { useSync } from '../../context/SyncContext';
import { Layers, TrendingUp, AlertCircle, Truck, PackageCheck, HelpCircle } from 'lucide-react';

export function StockPoolView({ onSelectTripDispatch }) {
  const { stockPool, refreshStockPool } = useSync();

  useEffect(() => {
    refreshStockPool();
  }, [refreshStockPool]);

  const targetKg = stockPool.target_kg || 2000;
  const progressPct = Math.min(100, Math.round(((stockPool.total_pending_kg || 0) / targetKg) * 100));
  const isTargetReached = (stockPool.total_pending_kg || 0) >= targetKg;

  return (
    <div className="space-y-6">
      {/* Hero Stock Pool Status Card */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-[#1E4620] overflow-hidden">
        <div className="bg-[#1E4620] text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#D4A373] text-[#1E4620] flex items-center justify-center font-black">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-tight">
                Virtual Pool Saldo Stok Berjalan
              </h2>
              <p className="text-xs text-[#FEFAE0]">
                Eliminasi error spreadsheet • Agregasi WAC & Penanganan Muat Parsial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSelectTripDispatch && (
              <button
                type="button"
                data-testid="dispatch-now-btn"
                onClick={() => onSelectTripDispatch(stockPool.total_pending_kg)}
                className="px-4 py-2.5 rounded-xl bg-[#D4A373] hover:bg-[#e0b080] text-[#1E4620] font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 border border-[#b88c5d]"
              >
                <Truck className="w-4 h-4" />
                <span>Kirim Muatan ke Loading</span>
              </button>
            )}
          </div>
        </div>

        {/* Volume Target Progress Bar (Target 2 Ton) */}
        <div className="p-5 sm:p-6 bg-[#F7F6F2] border-b border-gray-200">
          <div className="flex justify-between items-end mb-2">
            <div>
              <span className="text-xs font-black uppercase text-gray-700 tracking-wider">
                Indikator Volume Target Muat Truk (Min. 2.000 Kg / 2 Ton)
              </span>
              <p className="text-xs text-gray-500">
                {isTargetReached
                  ? '🎯 Target muatan truk tercapai! Siap diberangkatkan ke Loading RAM.'
                  : `Kurang ${Math.round(targetKg - (stockPool.total_pending_kg || 0))} Kg untuk mencapai muatan ideal 2 Ton.`}
              </p>
            </div>
            <span
              data-testid="target-progress-percentage"
              className={`text-lg font-black ${isTargetReached ? 'text-emerald-700' : 'text-amber-800'}`}
            >
              {progressPct}%
            </span>
          </div>

          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden border border-gray-300 shadow-inner">
            <div
              data-testid="target-progress-bar"
              className={`h-full transition-all duration-500 ${
                isTargetReached
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-700'
                  : 'bg-gradient-to-r from-amber-400 to-[#D4A373]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 3 Metric Grid Cards */}
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Pending in Pool */}
          <div className="bg-[#FEFAE0] border-2 border-[#D4A373] p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-gray-700 tracking-wide">
                Total Stok Siap Angkut
              </span>
              <PackageCheck className="w-5 h-5 text-[#1E4620]" />
            </div>
            <div
              data-testid="pool-total-pending-kg"
              className="text-3xl font-black text-[#1E4620] mt-2 font-mono"
            >
              {Number(stockPool.total_pending_kg || 0).toLocaleString('id-ID')} <span className="text-sm font-sans font-bold">Kg</span>
            </div>
            <p className="text-xs text-gray-600 mt-1 font-medium">
              Nilai Modal: Rp {Number(stockPool.total_pending_value || 0).toLocaleString('id-ID')}
            </p>
          </div>

          {/* TBS Pool & WAC */}
          <div className="bg-white border-2 border-emerald-200 p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-emerald-900 tracking-wide">
                Stok TBS (Tandan Buah Segar)
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                TBS
              </span>
            </div>
            <div
              data-testid="pool-pending-tbs-kg"
              className="text-3xl font-black text-emerald-900 mt-2 font-mono"
            >
              {Number(stockPool.pending_tbs_kg || 0).toLocaleString('id-ID')} <span className="text-sm font-sans font-bold">Kg</span>
            </div>
            <p className="text-xs text-gray-600 mt-1 font-medium flex items-center justify-between">
              <span>Modal Rata-rata (WAC):</span>
              <span data-testid="pool-wac-tbs" className="font-bold text-emerald-800">
                Rp {Number(stockPool.wac_tbs || 2450).toLocaleString('id-ID')} / Kg
              </span>
            </p>
          </div>

          {/* Berondol Pool & WAC */}
          <div className="bg-white border-2 border-amber-200 p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-amber-900 tracking-wide">
                Stok Berondol (Buah Lepas)
              </span>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                Berondol
              </span>
            </div>
            <div
              data-testid="pool-pending-berondol-kg"
              className="text-3xl font-black text-amber-900 mt-2 font-mono"
            >
              {Number(stockPool.pending_berondol_kg || 0).toLocaleString('id-ID')} <span className="text-sm font-sans font-bold">Kg</span>
            </div>
            <p className="text-xs text-gray-600 mt-1 font-medium flex items-center justify-between">
              <span>Modal Rata-rata (WAC):</span>
              <span data-testid="pool-wac-berondol" className="font-bold text-amber-800">
                Rp {Number(stockPool.wac_berondol || 2700).toLocaleString('id-ID')} / Kg
              </span>
            </p>
          </div>
        </div>

        {/* Explainability & Business Logic Callout */}
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 space-y-1">
              <p className="font-bold">Bagaimana Virtual Pool BUB Makekal Bekerja?</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-800/90">
                <li>
                  <strong>Bebas Masalah Baris Spreadsheet:</strong> Seluruh nota timbangan petani masuk ke pool agregasi secara otomatis tanpa menghubungkan baris satu per satu.
                </li>
                <li>
                  <strong>Muat Sebagian (Partial Dispatch):</strong> Jika truk hanya memuat 2,5 Ton dari 3,2 Ton stok, sistem langsung memotong 2,5 Ton dengan modal rata-rata tertimbang (*Weighted Average Cost*), menyisakan 0,7 Ton di pool.
                </li>
                <li>
                  <strong>Retur Grade B:</strong> Buah Grade B yang dibawa pulang langsung dikembalikan ke stok Berondol pada harga pokok modal.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
