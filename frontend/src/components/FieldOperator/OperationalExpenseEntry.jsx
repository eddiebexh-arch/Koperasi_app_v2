import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import { useSync } from '../../context/SyncContext';
import { toast } from 'sonner';
import { Receipt, Plus, ShieldCheck, Utensils, Fuel, Wrench, HeartHandshake, HelpCircle } from 'lucide-react';

export function OperationalExpenseEntry() {
  const { triggerSync, updatePendingCount } = useSync();

  const [category, setCategory] = useState('Makan Pekerja');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [workerCount, setWorkerCount] = useState('3');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentExpenses, setRecentExpenses] = useState([]);

  const categories = [
    { name: 'Makan Pekerja', icon: Utensils },
    { name: 'BBM/Transport Lapangan', icon: Fuel },
    { name: 'Perlengkapan/Alat', icon: Wrench },
    { name: 'Dana Sosial', icon: HeartHandshake },
    { name: 'Lain-lain', icon: Receipt }
  ];

  useEffect(() => {
    loadLocalExpenses();
  }, []);

  const loadLocalExpenses = async () => {
    try {
      const list = await db.expenses.orderBy('timestamp').reverse().limit(10).toArray();
      setRecentExpenses(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amountNum = parseFloat(amount) || 0;
    if (amountNum <= 0) {
      toast.error('Masukkan nominal pengeluaran yang valid.');
      return;
    }
    if (!description.trim()) {
      toast.error('Tuliskan keterangan pengeluaran singkat.');
      return;
    }

    try {
      setIsSubmitting(true);
      const localId = `EXP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
      const timestamp = new Date().toISOString();

      const newExpense = {
        local_id: localId,
        category,
        amount: amountNum,
        description: description.trim(),
        worker_count: parseInt(workerCount) || 0,
        timestamp,
        synced: 0
      };

      await db.expenses.add(newExpense);
      await updatePendingCount();
      await loadLocalExpenses();
      triggerSync(false);

      toast.success(`Pengeluaran Rp ${amountNum.toLocaleString('id-ID')} berhasil dicatat!`);
      setAmount('');
      setDescription('');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mencatat pengeluaran ke memori lokal.');
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
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-tight">
                Pengeluaran Operasional & Sosial
              </h2>
              <p className="text-xs text-[#FEFAE0]">
                Pencatatan biaya non-dagang yang diisolasi dari margin jual-beli sawit
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 rounded-full bg-blue-900 text-blue-100 font-bold text-xs border border-blue-700">
            Kategori Terisolasi
          </span>
        </div>

        {/* Isolation Notice */}
        <div className="bg-[#FEFAE0] border-b border-[#D4A373] p-4 text-xs text-gray-800 flex items-start gap-2">
          <ShieldCheck className="w-5 h-5 text-[#1E4620] flex-shrink-0 mt-0.5" />
          <p>
            <strong>Prinsip Akuntansi Koperasi:</strong> Biaya operasional lapangan (konsumsi, genset, tali, dana sosial warga) diisolasi agar tidak mengaburkan persentase margin murni perdagangan sawit.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* Category Selector Chips */}
          <div>
            <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-2">
              Kategori Pengeluaran
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    data-testid={`category-btn-${cat.name.replace(/\s+|\//g, '-').toLowerCase()}`}
                    onClick={() => setCategory(cat.name)}
                    className={`p-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 border-2 transition-all ${
                      isSelected
                        ? 'bg-[#1E4620] text-white border-[#1E4620] shadow-md'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-center">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1.5">
                Nominal Rupiah (Rp)
              </label>
              <div className="relative">
                <input
                  type="number"
                  data-testid="expense-amount-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full text-2xl font-black px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none text-right font-mono"
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  RP
                </span>
              </div>
            </div>

            {/* Worker count (if relevant) */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1.5">
                Jumlah Orang / Pekerja Terkait
              </label>
              <input
                type="number"
                data-testid="expense-workers-input"
                value={workerCount}
                onChange={(e) => setWorkerCount(e.target.value)}
                placeholder="0"
                className="w-full text-xl font-bold px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-black uppercase text-gray-700 tracking-wider mb-1.5">
              Keterangan / Rincian Pengeluaran
            </label>
            <textarea
              data-testid="expense-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Nasi bungkus makan siang 3 orang buruh angkut..."
              rows={2}
              className="w-full text-sm font-medium p-3 rounded-xl border-2 border-gray-300 focus:border-[#1E4620] outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !amount}
            data-testid="submit-expense-btn"
            className="w-full py-4 px-6 rounded-2xl bg-[#1E4620] hover:bg-[#2C662F] text-white font-black text-base sm:text-lg shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5 text-[#D4A373]" />
            <span>{isSubmitting ? 'MENYIMPAN...' : 'SIMPAN PENGELUARAN OPERASIONAL'}</span>
          </button>
        </form>
      </div>

      {/* Recent expenses list */}
      {recentExpenses.length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm space-y-3">
          <h3 className="text-xs font-black uppercase text-gray-700 tracking-wider">
            Daftar Pengeluaran Terakhir di Tablet
          </h3>
          <div className="divide-y divide-gray-100">
            {recentExpenses.map((ex) => (
              <div key={ex.local_id || ex.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{ex.category}</span>
                    {ex.worker_count > 0 && (
                      <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-semibold">
                        {ex.worker_count} Orang
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{ex.description}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-red-700">
                    - Rp {Number(ex.amount).toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] block text-gray-400">
                    {new Date(ex.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
