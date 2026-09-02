import Dexie from 'dexie';

export const db = new Dexie('PalmOilMakekalDB');

// Schema declaration for offline-first storage
db.version(1).stores({
  farmers: '++id, local_id, name, village',
  purchases: '++id, local_id, timestamp, farmer_name, commodity_type, field_weight_kg, price_per_kg, total_cost, status, synced',
  trips: '++id, local_id, trip_date, loading_name, commodity_type, dispatched_weight_kg, loading_weight_kg, net_margin, payment_status, synced',
  expenses: '++id, local_id, timestamp, category, amount, synced',
  settings: 'setting_id, default_transport_rate_per_ton, last_price_tbs, last_price_berondol',
  sync_queue: '++id, entity_type, entity_id, action, timestamp'
});

// Helper to seed initial local farmers and settings cache
export async function initLocalDatabase() {
  const farmerCount = await db.farmers.count();
  if (farmerCount === 0) {
    await db.farmers.bulkAdd([
      { name: 'Pak Budi Makekal', village: 'Makekal Hulu', phone: '081234567801' },
      { name: 'Pak Tumenggung Marituha', village: 'Makekal Hulu', phone: '081234567802' },
      { name: 'Pak Nyenong', village: 'Makekal Hulu', phone: '081234567803' },
      { name: 'Pak Ngotap', village: 'Makekal Hulu', phone: '081234567804' },
      { name: 'Bu Siti Aminah', village: 'Makekal Hilir', phone: '081234567805' },
      { name: 'Pak Hasan Basri', village: 'Makekal Hulu', phone: '081234567806' }
    ]);
  }

  const settings = await db.settings.get('default');
  if (!settings) {
    await db.settings.put({
      setting_id: 'default',
      default_transport_rate_per_ton: 70000,
      transport_preset_options: [70000, 100000],
      default_unloading_rate_tbs: 25,
      default_unloading_rate_berondol: 30,
      shrinkage_alert_pct: 5.0,
      last_price_tbs: 2450,
      last_price_berondol: 2700,
      minimum_pool_target_kg: 2000
    });
  }
}
