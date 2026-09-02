import React, { useState, useEffect } from 'react';
import { db } from '../../db';
import { useSync } from '../../context/SyncContext';
import { History, Eye, CheckCircle2, Clock, Filter, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DigitalReceiptModal } from '../DigitalReceiptModal';
import { EditTransactionModal } from '../EditTransactionModal';

export function LocalHistoryView() {
  const { isSyncing, triggerSync, refreshStockPool, updatePendingCount } = useSync();
  const [filterType, setFilterType] = useState('ALL');
  const [items, setItems] = useState([]);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [editing, setEditing] = useState(null); // { type, item }
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadAllLocalItems(); }, [filterType]);

  const loadAllLocalItems = async () => {
    try {
      const purchases = await db.purchases.toArray();
      const trips = await db.trips.toArray();
      const expenses = await db.expenses.toArray();
      const combined = [
        ...purchases.map(p => ({ ...p, _type: 'PURCHASE', _time: new Date(p.timestamp || 0) })),
        ...trips.map(t => ({ ...t, _type: 'TRIP', _time: new Date(t.trip_date || 0) })),
        ...expenses.map(e => ({ ...e, _type: 'EXPENSE', _time: new Date(e.timestamp || 0) }))
      ];
      combined.sort((a, b) => b._time - a._time);
      setItems(filterType === 'ALL' ? combined : combined.filter(i => i._type === filterType));
    } catch (e) { console.error(e); }
  };

  const handleEdit = (item) => {
    setEditing({ type: item._type, item });
  };

  const handleDelete = async (item) => {
    try {
      const localId = item.local_id;
      const type = item._type;

      // Queue for server-side delete on next sync
      await db.deleted_queue.add({
        entity_type: type,
        local_id: localId,
        deleted_at: new Date().toISOString(),
        synced: 0
      });

      // Remove from local table
      if (type === 'PURCHASE') await db.purchases.where('local_id').equals(localId).delete();
      else if (type === 'TRIP') await db.trips.where('local_id').equals(localId).delete();
      else if (type === 'EXPENSE') await db.expenses.where('local_id').equals(localId).delete();

      toast.success('Data berhasil dihapus dari tablet.');
      setDeleteConfirm(null);
      await loadAllLocalItems();
      await updatePendingCount();
      await refreshStockPool();
      triggerSync(false);
    } catch (e) {
      console.error(e);
      toast.error('Gagal menghapus data.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border-2 border-[#1E4620] overflow-hidden">
        <div className="bg-[#1E4620] text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4A373] text-[#1E4620] flex items-center justify-center font-black">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-tight">
                Riwayat Transaksi Lokal Tablet
              </h2>
              <p className="text-xs text-[#FEFAE0]">Tersimpan di IndexedDB • Bisa Edit & Hapus</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="refresh-local-history-btn"
            onClick={() => { loadAllLocalItems(); triggerSync(true); }}
            disabled={isSyncing}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sinkronkan Sekarang</span>
          </button>
        </div>

        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-500 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'ALL', label: 'Semua' },
            { id: 'PURCHASE', label: 'Timbangan Petani' },
            { id: 'TRIP', label: 'Trip Loading RAM' },
            { id: 'EXPENSE', label: 'Biaya Operasional' }
          ].map(f => (
            <button
              key={f.id}
              data-testid={`filter-history-${f.id.toLowerCase()}`}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                filterType === f.id ? 'bg-[#1E4620] text-white shadow-sm' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">Belum ada catatan transaksi.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.local_id || item.id}
                  data-testid={`history-item-${item.local_id}`}
                  className="bg-white p-4 rounded-xl border border-gray-200 hover:border-[#1E4620] shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase mt-0.5 flex-shrink-0 ${
                      item._type === 'PURCHASE' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : item._type === 'TRIP' ? 'bg-blue-100 text-blue-900 border border-blue-300'
                      : 'bg-red-100 text-red-900 border border-red-300'
                    }`}>
                      {item._type === 'PURCHASE' ? 'Beli' : item._type === 'TRIP' ? 'Trip' : 'Beban'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-base">
                          {item.farmer_name || item.loading_name || item.category}
                        </span>
                        {item.commodity_type && (
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-semibold text-gray-700">
                            {item.commodity_type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item._type === 'PURCHASE' && `${item.field_weight_kg} Kg @ Rp ${Number(item.price_per_kg).toLocaleString('id-ID')}`}
                        {item._type === 'TRIP' && `Berangkat: ${item.dispatched_weight_kg} Kg → Loading: ${item.loading_weight_kg} Kg (Susut: ${item.weight_loss_pct}%)`}
                        {item._type === 'EXPENSE' && item.description}
                        {' • '}
                        {item._time.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                    <div className="text-right">
                      <span className={`font-mono font-black text-base block ${
                        item._type === 'PURCHASE' ? 'text-[#1E4620]'
                        : item._type === 'TRIP' ? 'text-blue-900'
                        : 'text-red-700'
                      }`}>
                        {item._type === 'PURCHASE' && `Rp ${Number(item.total_cost).toLocaleString('id-ID')}`}
                        {item._type === 'TRIP' && `Margin: Rp ${Number(item.net_margin).toLocaleString('id-ID')}`}
                        {item._type === 'EXPENSE' && `- Rp ${Number(item.amount).toLocaleString('id-ID')}`}
                      </span>
                      <span className="text-[10px] font-bold flex items-center justify-end gap-1 text-gray-400">
                        {item.synced ? (
                          <span className="text-emerald-700 flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Tersinkron
                          </span>
                        ) : (
                          <span className="text-amber-700 flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-amber-600" /> Tersimpan Lokal
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {item._type !== 'EXPENSE' && (
                        <button
                          type="button"
                          data-testid={`view-receipt-btn-${item.local_id}`}
                          onClick={() => setActiveReceipt(item)}
                          className="p-2 bg-gray-100 hover:bg-[#D4A373]/30 text-gray-800 rounded-xl"
                          title="Lihat Nota"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid={`edit-btn-${item.local_id}`}
                        onClick={() => handleEdit(item)}
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl"
                        title="Edit Data"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-btn-${item.local_id}`}
                        onClick={() => setDeleteConfirm(item)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl"
                        title="Hapus Data"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeReceipt && <DigitalReceiptModal data={activeReceipt} onClose={() => setActiveReceipt(null)} />}
      {editing && (
        <EditTransactionModal
          type={editing.type}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={loadAllLocalItems}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-gray-900 mb-2">Konfirmasi Hapus</h3>
            <p className="text-sm text-gray-600 mb-1">
              Yakin ingin menghapus data ini?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-bold text-gray-900">
                {deleteConfirm.farmer_name || deleteConfirm.loading_name || deleteConfirm.category}
              </p>
              <p className="text-[11px] text-gray-500">
                {deleteConfirm._type === 'PURCHASE' && `${deleteConfirm.field_weight_kg} Kg • Rp ${Number(deleteConfirm.total_cost).toLocaleString('id-ID')}`}
                {deleteConfirm._type === 'TRIP' && `Trip • Margin Rp ${Number(deleteConfirm.net_margin).toLocaleString('id-ID')}`}
                {deleteConfirm._type === 'EXPENSE' && `Rp ${Number(deleteConfirm.amount).toLocaleString('id-ID')}`}
              </p>
            </div>
            <p className="text-[11px] text-amber-700 mb-4">
              Data akan dihapus dari tablet & server. Modal WAC pool akan dihitung ulang otomatis.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm"
              >
                Batal
              </button>
              <button
                type="button"
                data-testid="confirm-delete-btn"
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm"
              >
                Ya, Hapus Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
