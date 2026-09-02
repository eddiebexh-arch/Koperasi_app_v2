import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { toast } from 'sonner';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  DollarSign,
  Layers,
  Users,
  Settings,
  RefreshCcw,
  Sparkles,
  Search,
  Plus
} from 'lucide-react';
import { AdminAuthModal } from './AdminAuthModal';
import { DigitalReceiptModal } from '../DigitalReceiptModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export function ManagerDashboard() {
  const { user } = useAuth();
  const { triggerSync } = useSync();

  const [activeTab, setActiveTab] = useState('SUMMARY'); // 'SUMMARY' | 'ANOMALIES' | 'RECEIVABLES' | 'FARMERS' | 'SETTINGS'
  const [stats, setStats] = useState(null);
  const [farmers, setFarmers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  // New Farmer form state
  const [newFarmerName, setNewFarmerName] = useState('');
  const [newFarmerVillage, setNewFarmerVillage] = useState('Makekal Hulu');
  const [newFarmerPhone, setNewFarmerPhone] = useState('');

  // Settings form state
  const [transportRate, setTransportRate] = useState(70000);
  const [shrinkageThreshold, setShrinkageThreshold] = useState(5.0);
  const [unloadingTbs, setUnloadingTbs] = useState(25);
  const [unloadingBerondol, setUnloadingBerondol] = useState(30);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, farmersRes, settingsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/farmers`),
        axios.get(`${API}/settings`)
      ]);

      setStats(statsRes.data);
      setFarmers(farmersRes.data);
      setSettings(settingsRes.data);

      if (settingsRes.data) {
        setTransportRate(settingsRes.data.default_transport_rate_per_ton || 70000);
        setShrinkageThreshold(settingsRes.data.shrinkage_alert_pct || 5.0);
        setUnloadingTbs(settingsRes.data.default_unloading_rate_tbs || 25);
        setUnloadingBerondol(settingsRes.data.default_unloading_rate_berondol || 30);
      }
    } catch (e) {
      console.error('Error loading dashboard data:', e);
      toast.error('Gagal mengambil data dashboard dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleSeedDemo = async () => {
    try {
      const res = await axios.post(`${API}/seed-demo`);
      toast.success('Data simulasi demo berhasil dimuat!');
      await loadDashboardData();
      triggerSync(true);
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat data simulasi.');
    }
  };

  const handleMarkPaid = async (tripId) => {
    try {
      await axios.patch(`${API}/trips/${tripId}/pay`, {}, { withCredentials: true });
      toast.success('Status piutang trip berhasil diubah menjadi Lunas (COD)!');
      await loadDashboardData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.detail || 'Gagal mengubah status piutang.');
    }
  };

  const handleAddFarmer = async (e) => {
    e.preventDefault();
    if (!newFarmerName.trim()) return;

    try {
      await axios.post(`${API}/farmers`, {
        name: newFarmerName.trim(),
        village: newFarmerVillage.trim(),
        phone: newFarmerPhone.trim()
      });
      toast.success(`Petani ${newFarmerName} berhasil ditambahkan.`);
      setNewFarmerName('');
      setNewFarmerPhone('');
      await loadDashboardData();
    } catch (e) {
      console.error(e);
      toast.error('Gagal menambah petani.');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${API}/settings`,
        {
          default_transport_rate_per_ton: parseFloat(transportRate),
          transport_preset_options: [70000, 100000],
          default_unloading_rate_tbs: parseFloat(unloadingTbs),
          default_unloading_rate_berondol: parseFloat(unloadingBerondol),
          shrinkage_alert_pct: parseFloat(shrinkageThreshold)
        },
        { withCredentials: true }
      );
      toast.success('Pengaturan sistem berhasil disimpan!');
      await loadDashboardData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.detail || 'Gagal menyimpan pengaturan.');
    }
  };

  const summary = stats?.financial_summary || {};
  const stockPool = stats?.stock_pool || {};
  const anomalyTrips = stats?.anomaly_trips || [];
  const pendingReceivables = stats?.pending_receivables || [];

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header */}
      <div className="bg-[#1E4620] rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#D4A373] text-[#1E4620] flex items-center justify-center font-black">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-tight">
              Dashboard Pemantauan & Audit Pengelola
            </h2>
            <p className="text-xs text-[#FEFAE0]">
              BUB Makekal Hulu • Monitoring Margin, Piutang Loading & Deteksi Anomali
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            data-testid="seed-demo-data-btn"
            onClick={handleSeedDemo}
            className="px-3.5 py-2 rounded-xl bg-[#D4A373] hover:bg-[#e0b080] text-[#1E4620] font-black text-xs flex items-center gap-1.5 shadow-md transition-all border border-[#b88c5d]"
          >
            <Sparkles className="w-4 h-4" />
            <span>Muat Data Simulasi Demo</span>
          </button>

          <button
            data-testid="refresh-dashboard-btn"
            onClick={loadDashboardData}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Refresh Data"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'SUMMARY', label: 'Ringkasan Eksekutif', count: null },
          { id: 'ANOMALIES', label: 'Deteksi Anomali Susut (>5%)', count: anomalyTrips.length, isAlert: anomalyTrips.length > 0 },
          { id: 'RECEIVABLES', label: 'Pelacakan Piutang Loading', count: pendingReceivables.length },
          { id: 'FARMERS', label: 'Master Petani', count: farmers.length },
          { id: 'SETTINGS', label: 'Pengaturan & Tarif', count: null }
        ].map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id.toLowerCase()}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all ${
              activeTab === tab.id
                ? 'bg-[#1E4620] text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span
                data-testid={`tab-count-${tab.id.toLowerCase()}`}
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  tab.isAlert ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-800'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: EXECUTIVE SUMMARY */}
      {activeTab === 'SUMMARY' && (
        <div className="space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Trade Margin */}
            <div className="bg-white p-5 rounded-2xl border-2 border-[#1E4620] shadow-sm">
              <span className="text-xs font-black uppercase text-gray-500 tracking-wider block">
                Total Margin Dagang Bersih
              </span>
              <div
                data-testid="summary-total-net-margin"
                className={`text-2xl sm:text-3xl font-black mt-2 font-mono ${
                  (summary.total_net_margin || 0) >= 0 ? 'text-emerald-800' : 'text-red-700'
                }`}
              >
                Rp {Number(summary.total_net_margin || 0).toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Omzet - HPP Terjual - Logistik</p>
            </div>

            {/* Total Omzet Penjualan */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <span className="text-xs font-black uppercase text-gray-500 tracking-wider block">
                Total Omzet Penjualan
              </span>
              <div
                data-testid="summary-total-revenue"
                className="text-2xl sm:text-3xl font-black mt-2 text-gray-900 font-mono"
              >
                Rp {Number(summary.total_revenue || 0).toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Hasil Timbang Loading RAM</p>
            </div>

            {/* Isolated Operational Expenses */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <span className="text-xs font-black uppercase text-gray-500 tracking-wider block">
                Beban Operasional Terisolasi
              </span>
              <div
                data-testid="summary-total-expenses"
                className="text-2xl sm:text-3xl font-black mt-2 text-amber-900 font-mono"
              >
                Rp {Number(summary.total_operational_expenses || 0).toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Makan, BBM, Sosial (Non-Margin)</p>
            </div>

            {/* Coop Net Profit */}
            <div className="bg-[#FEFAE0] p-5 rounded-2xl border-2 border-[#D4A373] shadow-sm">
              <span className="text-xs font-black uppercase text-gray-700 tracking-wider block">
                Sisa Hasil Usaha / Laba Bersih BUB
              </span>
              <div
                data-testid="summary-coop-net-profit"
                className={`text-2xl sm:text-3xl font-black mt-2 font-mono ${
                  (summary.coop_net_profit || 0) >= 0 ? 'text-[#1E4620]' : 'text-red-700'
                }`}
              >
                Rp {Number(summary.coop_net_profit || 0).toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">Margin Dagang - Beban Operasional</p>
            </div>
          </div>

          {/* Stock Pool Live Status */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase text-gray-700 tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1E4620]" />
              <span>Status Saldo Virtual Pool Stok Menunggu Jual</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs text-gray-500 font-bold block">Stok Pending TBS</span>
                <span data-testid="dashboard-pending-tbs" className="text-2xl font-black text-emerald-900 font-mono">
                  {Number(stockPool.pending_tbs_kg || 0).toLocaleString('id-ID')} Kg
                </span>
                <span className="text-xs block text-gray-500 mt-0.5">
                  WAC: Rp {Number(stockPool.wac_tbs || 2450).toLocaleString('id-ID')}/Kg
                </span>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs text-gray-500 font-bold block">Stok Pending Berondol</span>
                <span data-testid="dashboard-pending-berondol" className="text-2xl font-black text-amber-900 font-mono">
                  {Number(stockPool.pending_berondol_kg || 0).toLocaleString('id-ID')} Kg
                </span>
                <span className="text-xs block text-gray-500 mt-0.5">
                  WAC: Rp {Number(stockPool.wac_berondol || 2700).toLocaleString('id-ID')}/Kg
                </span>
              </div>

              <div className="bg-[#FEFAE0] p-4 rounded-xl border border-[#D4A373]">
                <span className="text-xs text-gray-700 font-bold block">Total Nilai Modal Pool</span>
                <span data-testid="dashboard-total-pool-value" className="text-2xl font-black text-[#1E4620] font-mono">
                  Rp {Number(stockPool.total_pending_value || 0).toLocaleString('id-ID')}
                </span>
                <span className="text-xs block text-gray-600 mt-0.5">
                  Total Tonase: {Number(stockPool.total_pending_kg || 0).toLocaleString('id-ID')} Kg
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANOMALIES (SUSUT > 5%) */}
      {activeTab === 'ANOMALIES' && (
        <div className="space-y-4">
          <div className="bg-red-50 border-2 border-red-300 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-900">
              <p className="font-bold text-sm text-red-950">
                Sistem Peringatan Deteksi Anomali Susut Timbangan
              </p>
              <p className="mt-0.5">
                Trip yang mengalami selisih timbangan antara Pos Timbang Lapangan dan Loading RAM di atas{' '}
                <strong>{summary.shrinkage_threshold_pct || 5.0}%</strong> ditandai secara otomatis untuk diaudit oleh pengelola BUB.
              </p>
            </div>
          </div>

          {anomalyTrips.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
              <p className="font-bold text-base text-gray-800">Semua Trip Dalam Batas Wajar</p>
              <p className="text-xs text-gray-500 mt-1">
                Tidak ada anomali susut timbangan melebihi ambang batas {summary.shrinkage_threshold_pct || 5.0}%.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalyTrips.map((trip) => (
                <div
                  key={trip.local_id || trip.id}
                  data-testid={`anomaly-trip-card-${trip.local_id}`}
                  className="bg-white p-5 rounded-2xl border-2 border-red-400 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-red-600 text-white font-black text-xs rounded-full uppercase">
                        ANOMALI SUSUT {trip.weight_loss_pct}%
                      </span>
                      <span className="font-bold text-gray-900 text-base">{trip.loading_name}</span>
                      <span className="text-xs text-gray-500">({trip.nota_number})</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Berangkat: <strong>{trip.dispatched_weight_kg} Kg</strong> → Loading: <strong>{trip.loading_weight_kg} Kg</strong> (Susut: <strong>{trip.weight_loss_kg} Kg</strong>)
                    </p>
                    {trip.notes && <p className="text-xs text-red-800 italic">Catatan: {trip.notes}</p>}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">Margin Trip:</span>
                      <span className={`font-mono font-bold text-sm ${trip.net_margin >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                        Rp {Number(trip.net_margin).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid={`view-anomaly-receipt-${trip.local_id}`}
                      onClick={() => setActiveReceipt(trip)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs"
                    >
                      Lihat Nota
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RECEIVABLES / PIUTANG */}
      {activeTab === 'RECEIVABLES' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Clock className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-amber-950">Pelacakan Tagihan Piutang Loading RAM</p>
                <p className="text-xs text-amber-800">
                  Total Piutang Belum Dibayar: <strong>Rp {Number(summary.total_receivables_amount || 0).toLocaleString('id-ID')}</strong> ({pendingReceivables.length} Trip)
                </p>
              </div>
            </div>
          </div>

          {pendingReceivables.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
              <p className="font-bold text-base text-gray-800">Semua Tagihan Lunas</p>
              <p className="text-xs text-gray-500 mt-1">Tidak ada piutang pending dari pihak Loading RAM.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReceivables.map((trip) => (
                <div
                  key={trip.local_id || trip.id}
                  data-testid={`receivable-card-${trip.local_id}`}
                  className="bg-white p-5 rounded-2xl border-2 border-amber-400 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-amber-600 text-white font-black text-xs rounded-full uppercase">
                        PIUTANG TEMPO
                      </span>
                      <span className="font-bold text-gray-900 text-base">{trip.loading_name}</span>
                      <span className="text-xs text-gray-500">({trip.nota_number})</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Jatuh Tempo: <strong>{trip.due_date || 'Tidak ditentukan'}</strong> • Tonase: <strong>{trip.loading_weight_kg} Kg</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">Nominal Tagihan:</span>
                      <span className="font-mono font-black text-lg text-amber-900">
                        Rp {Number(trip.total_revenue).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <button
                      type="button"
                      data-testid={`mark-paid-btn-${trip.local_id}`}
                      onClick={() => handleMarkPaid(trip.local_id || trip.id)}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                    >
                      Tandai Lunas
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FARMERS MASTER */}
      {activeTab === 'FARMERS' && (
        <div className="space-y-6">
          {/* Add Farmer Form */}
          <div className="bg-white p-5 rounded-2xl border-2 border-[#1E4620] shadow-sm">
            <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#1E4620]" />
              <span>Tambah Master Petani / Kelompok Tani Baru</span>
            </h3>
            <form onSubmit={handleAddFarmer} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                data-testid="new-farmer-name-input"
                value={newFarmerName}
                onChange={(e) => setNewFarmerName(e.target.value)}
                placeholder="Nama Petani..."
                className="px-3.5 py-2.5 rounded-xl border border-gray-300 font-bold text-sm outline-none"
                required
              />
              <input
                type="text"
                data-testid="new-farmer-village-input"
                value={newFarmerVillage}
                onChange={(e) => setNewFarmerVillage(e.target.value)}
                placeholder="Dusun / Wilayah..."
                className="px-3.5 py-2.5 rounded-xl border border-gray-300 font-bold text-sm outline-none"
              />
              <input
                type="text"
                data-testid="new-farmer-phone-input"
                value={newFarmerPhone}
                onChange={(e) => setNewFarmerPhone(e.target.value)}
                placeholder="Nomor HP..."
                className="px-3.5 py-2.5 rounded-xl border border-gray-300 font-bold text-sm outline-none"
              />
              <button
                type="submit"
                data-testid="add-farmer-btn"
                className="py-2.5 px-4 rounded-xl bg-[#1E4620] hover:bg-[#2C662F] text-white font-bold text-sm shadow-md transition-all"
              >
                + Simpan Petani
              </button>
            </form>
          </div>

          {/* Farmers List */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">
              Daftar Petani Terdaftar ({farmers.length} Petani)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {farmers.map((f) => (
                <div
                  key={f.id || f.name}
                  data-testid={`farmer-card-${f.name.replace(/\s+/g, '-').toLowerCase()}`}
                  className="p-3.5 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-gray-900 text-sm block">{f.name}</span>
                    <span className="text-xs text-gray-500">{f.village || 'Makekal Hulu'}</span>
                  </div>
                  {f.phone && <span className="text-xs text-gray-400 font-mono">{f.phone}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === 'SETTINGS' && (
        <div className="bg-white p-6 rounded-2xl border-2 border-[#1E4620] shadow-sm max-w-2xl space-y-5">
          <h3 className="text-sm font-black uppercase text-gray-800 tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#1E4620]" />
            <span>Pengaturan Tarif Standar & Ambang Anomali</span>
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Tarif Transport Standar (Rp / Ton)
              </label>
              <input
                type="number"
                data-testid="settings-transport-rate-input"
                value={transportRate}
                onChange={(e) => setTransportRate(e.target.value)}
                className="w-full font-bold px-3.5 py-2.5 rounded-xl border border-gray-300 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Biaya Bongkar TBS (Rp / Kg)
                </label>
                <input
                  type="number"
                  data-testid="settings-unloading-tbs-input"
                  value={unloadingTbs}
                  onChange={(e) => setUnloadingTbs(e.target.value)}
                  className="w-full font-bold px-3.5 py-2.5 rounded-xl border border-gray-300 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Biaya Bongkar Berondol (Rp / Kg)
                </label>
                <input
                  type="number"
                  data-testid="settings-unloading-berondol-input"
                  value={unloadingBerondol}
                  onChange={(e) => setUnloadingBerondol(e.target.value)}
                  className="w-full font-bold px-3.5 py-2.5 rounded-xl border border-gray-300 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Ambang Batas Peringatan Anomali Susut Timbangan (%)
              </label>
              <input
                type="number"
                step="0.1"
                data-testid="settings-shrinkage-threshold-input"
                value={shrinkageThreshold}
                onChange={(e) => setShrinkageThreshold(e.target.value)}
                className="w-full font-bold px-3.5 py-2.5 rounded-xl border border-gray-300 outline-none"
              />
              <span className="text-xs text-gray-500 mt-1 block">
                Trip dengan susut melebihi nilai ini akan ditandai merah secara otomatis.
              </span>
            </div>

            <button
              type="submit"
              data-testid="save-settings-btn"
              className="w-full py-3 px-4 rounded-xl bg-[#1E4620] hover:bg-[#2C662F] text-white font-bold text-sm shadow-md transition-all"
            >
              Simpan Pengaturan
            </button>
          </form>
        </div>
      )}

      {/* Receipt Modal */}
      {activeReceipt && (
        <DigitalReceiptModal data={activeReceipt} onClose={() => setActiveReceipt(null)} />
      )}

      {/* Auth Modal */}
      <AdminAuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
