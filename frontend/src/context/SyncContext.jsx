import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { db, initLocalDatabase } from '../db';
import { toast } from 'sonner';

const SyncContext = createContext();
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [stockPool, setStockPool] = useState({
    pending_tbs_kg: 0,
    pending_berondol_kg: 0,
    total_pending_kg: 0,
    wac_tbs: 2450,
    wac_berondol: 2700,
    total_pending_value: 0,
    target_kg: 2000,
    target_progress_pct: 0
  });
  const [lastSyncedTime, setLastSyncedTime] = useState(null);

  // Update pending count from local IndexedDB
  const updatePendingCount = useCallback(async () => {
    try {
      const unsyncedPurchases = await db.purchases.where('synced').equals(0).count();
      const unsyncedTrips = await db.trips.where('synced').equals(0).count();
      const unsyncedExpenses = await db.expenses.where('synced').equals(0).count();
      setPendingCount(unsyncedPurchases + unsyncedTrips + unsyncedExpenses);
    } catch (e) {
      console.error('Error counting pending items:', e);
    }
  }, []);

  // Compute stock pool locally or fetch from server if online
  const refreshStockPool = useCallback(async () => {
    if (navigator.onLine) {
      try {
        const res = await axios.get(`${API}/stock-pool`);
        if (res.data) {
          setStockPool(res.data);
          return res.data;
        }
      } catch (e) {
        console.warn('Could not fetch remote stock pool, computing locally.');
      }
    }

    // Local Stock Pool Computation Fallback
    try {
      const allPurchases = await db.purchases.toArray();
      const allTrips = await db.trips.toArray();

      let tbsBoughtKg = 0;
      let tbsCost = 0;
      let berondolBoughtKg = 0;
      let berondolCost = 0;

      allPurchases.forEach(p => {
        const w = parseFloat(p.field_weight_kg || 0);
        const cost = parseFloat(p.total_cost || 0) || (w * parseFloat(p.price_per_kg || 0));
        if (p.commodity_type === 'BERONDOL') {
          berondolBoughtKg += w;
          berondolCost += cost;
        } else {
          tbsBoughtKg += w;
          tbsCost += cost;
        }
      });

      let tbsDispatchedKg = 0;
      let berondolDispatchedKg = 0;
      let returnedBkg = 0;

      allTrips.forEach(t => {
        const retB = parseFloat(t.grade_b_returned_kg || 0);
        returnedBkg += retB;

        // Prefer dual breakdown when available
        const tbsD = parseFloat(t.tbs_dispatched_kg || 0);
        const brdD = parseFloat(t.berondol_dispatched_kg || 0);
        if (tbsD > 0 || brdD > 0) {
          tbsDispatchedKg += tbsD;
          berondolDispatchedKg += brdD;
        } else {
          const dispW = parseFloat(t.dispatched_weight_kg || 0);
          if (t.commodity_type === 'BERONDOL') berondolDispatchedKg += dispW;
          else tbsDispatchedKg += dispW;
        }
      });

      const wacTbs = tbsBoughtKg > 0 ? tbsCost / tbsBoughtKg : 2450;
      const berondolEffKg = berondolBoughtKg + returnedBkg;
      const berondolEffCost = berondolCost + (returnedBkg * wacTbs);
      const wacBerondol = berondolEffKg > 0 ? berondolEffCost / berondolEffKg : 2700;

      const pendingTbs = Math.max(0, tbsBoughtKg - tbsDispatchedKg);
      const pendingBerondol = Math.max(0, berondolEffKg - berondolDispatchedKg);
      const totalPending = pendingTbs + pendingBerondol;
      const totalValue = (pendingTbs * wacTbs) + (pendingBerondol * wacBerondol);

      const targetKg = 2000;
      const progress = Math.min(100, (totalPending / targetKg) * 100);

      const calculated = {
        pending_tbs_kg: Math.round(pendingTbs * 100) / 100,
        pending_berondol_kg: Math.round(pendingBerondol * 100) / 100,
        total_pending_kg: Math.round(totalPending * 100) / 100,
        wac_tbs: Math.round(wacTbs),
        wac_berondol: Math.round(wacBerondol),
        total_pending_value: Math.round(totalValue),
        target_kg: targetKg,
        target_progress_pct: Math.round(progress * 10) / 10
      };

      setStockPool(calculated);
      return calculated;
    } catch (e) {
      console.error('Local pool calc error:', e);
    }
  }, []);

  // Main Sync Function: sends un-synced items to server
  const triggerSync = useCallback(async (manual = false) => {
    if (!navigator.onLine) {
      if (manual) toast.error('Koneksi internet offline. Data tetap aman di tablet.');
      return;
    }

    try {
      setIsSyncing(true);
      const unsyncedPurchases = await db.purchases.where('synced').equals(0).toArray();
      const unsyncedTrips = await db.trips.where('synced').equals(0).toArray();
      const unsyncedExpenses = await db.expenses.where('synced').equals(0).toArray();
      // Deletion tombstones to propagate to server
      let unsyncedDeletes = [];
      try {
        unsyncedDeletes = await db.deleted_queue.where('synced').equals(0).toArray();
      } catch (_) {}

      // Process deletions first (server accepts DELETE with local_id)
      for (const d of unsyncedDeletes) {
        try {
          const path =
            d.entity_type === 'PURCHASE' ? 'purchases'
            : d.entity_type === 'TRIP' ? 'trips'
            : 'expenses';
          await axios.delete(`${API}/${path}/${encodeURIComponent(d.local_id)}`);
          await db.deleted_queue.update(d.id, { synced: 1 });
        } catch (err) {
          console.warn('Delete sync failed for', d, err?.response?.status);
        }
      }

      if (unsyncedPurchases.length === 0 && unsyncedTrips.length === 0 && unsyncedExpenses.length === 0) {
        await refreshStockPool();
        await updatePendingCount();
        if (manual) toast.success('Semua data sudah tersinkronisasi sempurna!');
        setIsSyncing(false);
        return;
      }

      const payload = {
        purchases: unsyncedPurchases,
        trips: unsyncedTrips,
        expenses: unsyncedExpenses
      };

      const res = await axios.post(`${API}/sync`, payload);
      if (res.data && res.data.status === 'success') {
        // Mark items as synced in IndexedDB
        for (const p of unsyncedPurchases) {
          if (p.id) await db.purchases.update(p.id, { synced: 1 });
        }
        for (const t of unsyncedTrips) {
          if (t.id) await db.trips.update(t.id, { synced: 1 });
        }
        for (const ex of unsyncedExpenses) {
          if (ex.id) await db.expenses.update(ex.id, { synced: 1 });
        }

        if (res.data.stock_pool) {
          setStockPool(res.data.stock_pool);
        }

        setLastSyncedTime(new Date());
        await updatePendingCount();
        const count = res.data.synced_counts.total;
        if (manual || count > 0) {
          toast.success(`Sinkronisasi Berhasil: ${count} data baru terkirim ke server!`);
        }
      }
    } catch (e) {
      console.error('Sync failed:', e);
      if (manual) toast.error('Gagal menyinkronkan data ke server. Coba beberapa saat lagi.');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshStockPool, updatePendingCount]);

  useEffect(() => {
    initLocalDatabase();
    updatePendingCount();
    refreshStockPool();

    const handleOnline = () => {
      setIsOnline(true);
      toast.info('Koneksi internet terdeteksi. Memulai sinkronisasi otomatis...');
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Mode Offline aktif. Transaksi tersimpan lokal di IndexedDB.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto-sync poll every 15 seconds if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        triggerSync(false);
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [triggerSync, updatePendingCount, refreshStockPool]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        stockPool,
        lastSyncedTime,
        triggerSync,
        updatePendingCount,
        refreshStockPool
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
