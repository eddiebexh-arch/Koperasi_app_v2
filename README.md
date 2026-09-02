# BUB Makekal Hulu — Sistem Pencatatan Jual-Beli Sawit

Aplikasi web berbasis **PWA (Progressive Web App) Offline-First** untuk tablet Android di lokasi penimbangan, plus **Dashboard Web Pemantauan** jarak jauh bagi pengelola BUB Makekal Hulu.

## 🌟 Fitur Utama

### Operator Lapangan (Tablet PWA)
- ✅ Entri Timbangan TBS & Berondol (kalkulasi otomatis)
- ✅ Master Petani + Autocomplete
- ✅ Pool Stok Virtual dengan Weighted Average Cost (WAC)
- ✅ Trip Jual ke Loading — **mendukung DUAL commodity (TBS + Berondol dalam 1 truk)**
- ✅ Grade A & Grade B untuk TBS DAN Berondol
- ✅ Retur Grade B TBS (bawa pulang jadi Berondol)
- ✅ Biaya Transport (70k / 100k / Custom) + Bongkar per ton editable (TBS 40k, Berondol 60k default)
- ✅ Backdated Entry (input data historis bulan lalu)
- ✅ Edit & Hapus Transaksi (dengan konfirmasi & WAC recalculation)
- ✅ Auto-sync IndexedDB → Cloud saat online
- ✅ Digital Receipt (nota digital)

### Dashboard Pengelola (Web / JWT Login)
- ✅ Ringkasan Keuangan Real-time
- ✅ Pelacakan Piutang Loading RAM
- ✅ Deteksi Anomali Susut >5%
- ✅ Read-only audit dari mana saja

## 🚀 Quick Start

**Akses PWA (Tablet Android):**
1. Buka di Chrome/Edge: `https://palm-ledger-hub.preview.emergentagent.com`
2. Menu ⋮ → **Install App / Add to Home Screen**
3. Aplikasi seperti native app di homescreen

**Login Dashboard Pengelola:**
```
Email: admin@makekal.id
Password: SawitMakekal2026!
```

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Tailwind CSS + Dexie (IndexedDB) |
| Backend | FastAPI (Python 3.11+) + Motor (async MongoDB) |
| Database | MongoDB |
| Auth | JWT (OAuth2 Password Bearer) |
| PWA | Service Worker + Manifest |
| Mobile Wrapper | Capacitor (opsional untuk APK Android) |

## 📱 Versi Mobile App Native

Lihat panduan lengkap di **[MOBILE_APP.md](./MOBILE_APP.md)** untuk build APK Android via Capacitor.

## 📂 Struktur Project

```
/app/
├── backend/            # FastAPI + MongoDB
│   ├── server.py       # Main API + models + business logic
│   ├── requirements.txt
│   └── .env            # MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_*, CORS_ORIGINS
├── frontend/           # React PWA
│   ├── src/
│   │   ├── db.js              # Dexie IndexedDB schema
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── SyncContext.jsx
│   │   ├── components/
│   │   │   ├── FieldOperator/  # Operator tablet UI
│   │   │   ├── ManagerDashboard/
│   │   │   ├── EditTransactionModal.jsx
│   │   │   └── ...
│   │   └── lib/dateUtils.js
│   ├── public/
│   │   ├── manifest.json
│   │   ├── service-worker.js
│   │   └── icon-*.png
│   ├── capacitor.config.js
│   └── .env
└── MOBILE_APP.md         # Panduan build APK
```

## 🔑 Endpoint API Utama

| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/auth/login` | Login pengelola |
| POST | `/api/auth/setup-admin` | Setup admin pertama kali |
| GET | `/api/farmers` | Daftar master petani |
| POST | `/api/purchases` | Entri timbangan (upsert by local_id) |
| PUT | `/api/purchases/{id}` | Edit timbangan |
| DELETE | `/api/purchases/{id}` | Hapus timbangan |
| POST | `/api/trips` | Entri trip loading (dual commodity) |
| PUT | `/api/trips/{id}` | Edit trip |
| DELETE | `/api/trips/{id}` | Hapus trip |
| POST | `/api/expenses` | Pengeluaran operasional |
| GET | `/api/stock-pool` | Virtual pool + WAC |
| GET | `/api/dashboard/stats` | Statistik pengelola |
| POST | `/api/sync` | Batch sync dari tablet |
| POST | `/api/seed-demo` | Reset & seed data demo |

## 🎯 Prinsip Kalkulasi Kunci

**Weighted Average Cost (WAC):**
```
WAC_TBS = Σ(Total Cost Beli TBS Belum Terjual) / Σ(Berat TBS Belum Terjual)
```

**Berondol Effective Pool:**
```
Berondol Kg = Beli Berondol + Retur Grade B TBS
Modal Berondol = (Cost Beli Berondol + Retur_Kg × WAC_TBS) / Berondol Kg
```

**Trip Margin Bersih:**
```
Net Margin = Total Revenue − COGS_Allocated − Transport − Bongkar − Tips
```

Transport dibagi proporsional per tonase komoditas saat trip campuran.

## 🌱 License

Internal use — BUB Makekal Hulu / Koperasi Orang Rimba.

---

Dibuat dengan ❤️ untuk warga Makekal Hulu.
