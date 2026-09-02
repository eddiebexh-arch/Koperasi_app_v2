# PRD - BUB Makekal Hulu Sawit Trading System

## Original Problem Statement
PWA offline-first untuk pencatatan jual-beli sawit di lokasi timbang (tablet Android) + Dashboard web pemantauan (JWT) untuk pengelola BUB Makekal Hulu.

## User Personas
- **Operator Lapangan** (Orang Rimba/pengurus lokal): tablet PWA, no login, tombol besar, offline-first
- **Pengelola/Auditor** (jarak jauh): browser + JWT, read-only audit

## Core Requirements (Static)
1. Entri Timbangan TBS/Berondol offline-first
2. Virtual Pool Stok dengan WAC (Weighted Average Cost)
3. Trip Jual ke Loading — DUAL commodity (TBS + Berondol dalam 1 truk)
4. Grade A & Grade B untuk TBS + Berondol (4 kategori total)
5. Retur Grade B TBS → pool Berondol dengan WAC TBS
6. Biaya Transport (70k/100k/custom) + Bongkar editable per ton (default: TBS 40k, Berondol 60k)
7. Isolated Operational Expenses
8. Backdated Entry (historis 2 bulan input manual)
9. Edit & Delete transaksi (dengan WAC recalc)
10. Auto-sync IndexedDB → MongoDB
11. Dashboard: margin, piutang, anomali susut >5%
12. PWA installable + Capacitor untuk APK Android

## What's Been Implemented (2026-02-02 → 2026-02)
### Backend (`/app/backend/server.py`)
- FastAPI + Motor (MongoDB async)
- JWT auth (Bearer + httpOnly cookie), NO brute-force lockout (per user request)
- CORS with regex for emergentagent preview URLs + explicit list from .env
- POST/PUT/DELETE for purchases, trips, expenses (all with 404 handling)
- Trip supports dual commodity (tbs_dispatched_kg + berondol_dispatched_kg)
- Berondol has Grade A + Grade B in trip
- Backdated entry via `timestamp` / `trip_date` fields
- WAC recalculation on trip delete
- Dashboard `/api/dashboard/stats` protected with JWT
- `re.escape()` for farmer_name regex (prevents 500 on special chars)
- `/api/seed-demo` for demo data reset

### Frontend
- React 19 + Tailwind + Dexie IndexedDB (v2 schema)
- PWA: manifest.json + service-worker.js + icons (192/512/apple-touch)
- Capacitor config at `/app/frontend/capacitor.config.js`
- Auth gate on Manager Dashboard (login modal when not authenticated)
- **SalesTripEntry**: dual commodity cards, 4 grade cards, editable unloading rates per ton, backdate datetime-local, edit mode via `initialData`
- **WeighingEntry**: backdate datetime, edit mode
- **OperationalExpenseEntry**: backdate datetime, edit mode
- **LocalHistoryView**: Edit + Delete buttons per row, confirmation modal, delete tombstone queue
- **EditTransactionModal**: wraps entry forms in edit mode
- **SyncContext**: batch sync + deleted_queue processing + 404-tolerant delete sync

### Mobile App
- PWA: install via Chrome menu → "Add to Home Screen"
- Capacitor: `/app/MOBILE_APP.md` panduan lengkap step-by-step build APK
- Ikon PWA + Apple touch icon di `/app/frontend/public/`

## Backlog (P1 / P2)
- P1: Photo capture upload to object storage (currently base64 in IndexedDB)
- P1: Advanced filtering + export CSV for receivables & margin history
- P1: Protect write endpoints (POST/PUT/DELETE) with JWT (currently only /dashboard/stats + /trips/{id}/pay + /settings protected)
- P2: Partial update support in PUT (currently full replace)
- P2: Per-item sync failure array in POST /api/sync response
- P2: Refactor server.py 1060 lines into routers/services/

## Test Reports
- `/app/test_reports/iteration_3.json` — 17/19 pass (2 critical fixed after)
- `/app/test_reports/iteration_4.json` — 27/28 pass (1 regex bug fixed after)
- All post-fix issues verified via curl

## Credentials
See `/app/memory/test_credentials.md`
- admin@makekal.id / SawitMakekal2026!
