# Panduan Membangun Versi Mobile App Android — BUB Makekal Hulu

Aplikasi ini sudah **PWA (Progressive Web App)** yang bisa langsung di-install ke HP/tablet Android tanpa perlu build APK. Namun kalau Anda mau versi **APK Android native** untuk distribusi luas atau Play Store, panduan ini akan menuntun dari nol.

---

## 🚀 Opsi 1 — Install PWA Langsung (Cara Termudah, Tanpa Build)

**Tidak butuh Android Studio, tidak butuh komputer.** App sudah siap.

### Langkah:
1. Buka aplikasi di **Chrome / Edge** di tablet/HP Android:
   ```
   https://palm-ledger-hub.preview.emergentagent.com
   ```
2. Ketuk menu **⋮** (tiga titik pojok kanan atas Chrome).
3. Pilih **"Install App"** atau **"Add to Home Screen"** (Tambahkan ke Layar Utama).
4. Beri nama shortcut → **Tambahkan**.
5. Ikon aplikasi muncul di homescreen. Ketuk untuk buka **fullscreen seperti app native**.

### Kelebihan PWA:
- ✅ Bekerja **offline** (transaksi tersimpan di IndexedDB)
- ✅ Update otomatis, tidak perlu install ulang
- ✅ Ringan (< 5 MB), hemat memori tablet
- ✅ Bisa langsung dipakai operator lapangan hari ini

---

## 📦 Opsi 2 — Build APK Android Native (via Capacitor)

Cocok bila Anda ingin:
- Distribusi via Google Play Store
- Side-load APK ke tablet tanpa internet awal
- Akses fitur native (kamera, storage) yang lebih mendalam

### Prasyarat di Komputer Anda:
1. **Node.js 18+** — https://nodejs.org
2. **Yarn** — `npm install -g yarn`
3. **Java JDK 17** — https://adoptium.net
4. **Android Studio** (terbaru) — https://developer.android.com/studio
   - Saat setup pertama, install: Android SDK 34, Android SDK Build-Tools, Android Emulator (opsional).

### Langkah 1: Clone Repository dari GitHub
```bash
git clone https://github.com/<username>/bub-makekal-hulu.git
cd bub-makekal-hulu/frontend
```

### Langkah 2: Install Dependencies + Capacitor
```bash
yarn install
yarn add @capacitor/core @capacitor/cli @capacitor/android
yarn add @capacitor/splash-screen @capacitor/status-bar @capacitor/app
```

### Langkah 3: Konfigurasi Environment (WAJIB)
Buat file `.env` di folder `frontend/`:
```bash
REACT_APP_BACKEND_URL=https://<your-production-backend>.com
```
Ini adalah URL backend FastAPI yang **sudah live di internet**, bukan `localhost`. Karena APK berjalan di HP fisik, HP harus bisa menjangkau backend Anda.

> **Deploy backend dulu** (Emergent, Railway, Render, atau VPS) — supaya APK punya server tujuan sync. Untuk testing lokal, deploy backend ke ngrok/localtunnel sebagai stopgap.

### Langkah 4: Build React Production
```bash
yarn build
```
Akan menghasilkan folder `build/` yang berisi HTML/JS/CSS terkompilasi.

### Langkah 5: Add Android Platform ke Capacitor
```bash
npx cap add android
npx cap sync android
```
Ini membuat folder `android/` (proyek Android Studio) dan menyalin `build/` ke asset native.

### Langkah 6: Buka di Android Studio
```bash
npx cap open android
```
Android Studio akan terbuka dengan proyek Android siap build.

### Langkah 7: Build APK
Di Android Studio:
1. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Setelah selesai, klik **"locate"** pada notifikasi hijau di kanan bawah — file APK berada di:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```
3. Copy APK tersebut ke tablet Android via USB atau ShareIt, lalu install (aktifkan **"Install unknown apps"** di Setting > Security).

### Langkah 8 (Opsional): Signed APK untuk Play Store
1. **Build → Generate Signed Bundle / APK**
2. Buat keystore baru (simpan file `.jks` dengan aman + password)
3. Pilih **release** build variant → next → APK dihasilkan siap upload ke Play Console.

---

## 🔄 Alur Update Aplikasi

### Jika hanya update JS/HTML (kode React):
```bash
yarn build
npx cap sync android
# Rebuild APK di Android Studio
```

### Jika ubah manifest / permission Android:
Edit `android/app/src/main/AndroidManifest.xml` langsung, lalu rebuild.

---

## 📋 File-file Kunci yang Sudah Disiapkan

| File | Fungsi |
|---|---|
| `frontend/capacitor.config.js` | Konfigurasi Capacitor (appId, appName, plugin) |
| `frontend/public/manifest.json` | PWA manifest (ikon, warna tema) |
| `frontend/public/service-worker.js` | Service worker untuk offline caching |
| `frontend/public/icon-192.png` | Ikon PWA 192x192 |
| `frontend/public/icon-512.png` | Ikon PWA 512x512 |
| `frontend/public/apple-touch-icon.png` | Ikon untuk install di iOS |

---

## 🛠 Troubleshooting

**Q: "Gradle build failed" saat build APK**
- Buka `android/build.gradle` — pastikan `com.android.tools.build:gradle` versinya kompatibel dengan Android Studio Anda (biasanya 8.x untuk AS 2023+).
- Coba `File → Invalidate Caches → Invalidate and Restart`.

**Q: APK terinstall tapi blank white screen**
- Cek `REACT_APP_BACKEND_URL` di `.env` sudah benar dan backend accessible.
- Aktifkan `chrome://inspect#devices` di Chrome desktop → connect via USB debugging → lihat console error di app.

**Q: Data offline tidak sync setelah dapat sinyal**
- Sudah dihandle otomatis di `SyncContext.jsx` (auto-sync setiap 15 detik saat online). Cek `navigator.onLine` dan network di device.

**Q: Bisakah APK tetap dipakai walau backend down?**
- Ya. Data disimpan di IndexedDB device. Saat backend hidup lagi, otomatis sync via mutation queue.

---

## 🔗 Referensi

- Capacitor: https://capacitorjs.com/docs/android
- PWA Install: https://web.dev/install-criteria/
- Android APK Signing: https://developer.android.com/studio/publish/app-signing

Selamat membangun aplikasi mobile untuk BUB Makekal Hulu! 🌴
