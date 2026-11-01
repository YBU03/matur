# Panduan Aplikasi Android "Matoer POS"

Panduan ini menjelaskan **apa** aplikasi Android Matoer POS, **dari mana** APK-nya didapat, dan **langkah demi langkah** membuatnya sendiri di Android Studio. Ditulis untuk pemula — setiap langkah ada penjelasan *kenapa*.

---

## 1. Gambaran singkat

| Bagian | Penjelasan |
|---|---|
| **Apa isinya?** | Aplikasi "pembungkus" yang membuka **https://matoer.id/pos** dalam layar penuh, plus **printer Bluetooth bawaan**. |
| **Kenapa perlu aplikasi?** | Browser (Chrome) tidak bisa memakai **Bluetooth klasik** yang dipakai kebanyakan printer thermal (mis. RPP02N). Aplikasi Android bisa — sama seperti Luna POS. |
| **Kalau POS di web berubah?** | Aplikasi **otomatis ikut**, karena halamannya diambil dari server. APK baru hanya perlu dipasang ulang bila bagian aplikasi (printer, ikon, dsb.) yang berubah. |
| **Di mana kodenya?** | Folder `android/` di repo GitHub `YBU03/matur` (satu repo dengan web). |

**Istilah penting**
- **APK** — file pemasang aplikasi Android (seperti `.exe` di Windows).
- **Android Studio** — program resmi Google untuk membuat aplikasi Android.
- **SDK** — kumpulan alat & "bahan" Android yang dipakai Android Studio untuk membangun aplikasi (terunduh otomatis).
- **Gradle** — "mesin perakit" yang menyusun kode menjadi APK (dipakai otomatis oleh Android Studio).
- **Keystore / kunci tanda tangan** — "stempel" digital pemilik aplikasi. APK versi baru hanya bisa memperbarui versi lama **jika stempelnya sama**.
- **Pair / memasangkan** — menghubungkan printer ke tablet sekali di Pengaturan Bluetooth.

---

## 2. Cara tercepat: unduh APK jadi (tanpa Android Studio)

Setiap kali folder `android/` berubah, GitHub membuat APK otomatis.

1. Buka **https://github.com/YBU03/matur/actions** → pilih **"APK Matoer POS"** di kiri.
2. Klik **run paling atas** yang bertanda centang hijau ✅.
3. Gulir ke bawah ke bagian **Artifacts** → klik **MatoerPOS-apk** (terunduh file ZIP).
4. Ekstrak ZIP → di dalamnya ada **`MatoerPOS-1.0.0-release.apk`**.
5. Kirim file APK ke tablet (WhatsApp ke diri sendiri, Google Drive, atau kabel USB).
6. Lanjut ke **Bagian 5 — Memasang APK di tablet**.

> ⚠️ Sebelum "kunci tetap" diatur (Bagian 6), APK dari GitHub ditandatangani kunci **debug acak**. Akibatnya, untuk memasang versi berikutnya Anda harus **hapus (uninstall) aplikasi lama dulu** — hanya perlu login ulang, data transaksi aman di server.

---

## 3. Memasang Android Studio (sekali saja)

**Kebutuhan laptop:** Windows 10/11 atau Mac, RAM minimal 8 GB (16 GB lebih nyaman), ruang kosong ±10 GB, internet stabil.

1. Buka **https://developer.android.com/studio** → klik **Download Android Studio** → setujui syarat → unduh.
2. Jalankan pemasang:
   - **Windows:** klik dua kali file `.exe` → *Next* terus → pastikan **Android Virtual Device** boleh dicentang/tidak (tidak wajib) → *Install*.
   - **Mac:** buka file `.dmg` → seret **Android Studio** ke folder **Applications**.
3. Buka Android Studio pertama kali → pilih **Do not import settings** → **Standard** setup → *Next* → *Finish*.
   *Kenapa lama?* Android Studio sedang mengunduh **SDK** (±1–3 GB). Tunggu sampai selesai.

---

## 4. Membuka proyek & membuat APK di Android Studio

### 4.1 Ambil kode
- **Cara mudah:** buka https://github.com/YBU03/matur → pilih branch **`ccr-2427af56-yvuskv`** → tombol hijau **Code** → **Download ZIP** → ekstrak.
- **Cara Git (opsional):** `git clone https://github.com/YBU03/matur.git`

### 4.2 Buka folder `android`
1. Android Studio → **Open** → pilih folder **`matur/android`** (bukan folder `matur`!) → **OK**.
2. Bila muncul *Trust project?* → **Trust Project**.
3. Tunggu **"Gradle sync"** selesai (bilah di bawah). Pertama kali bisa 5–15 menit karena mengunduh Gradle & library.
   *Kenapa?* Gradle membaca file `build.gradle.kts` lalu mengunduh semua bahan yang dibutuhkan.

### 4.3 Kenali layar Android Studio
- **Kiri (Project):** daftar file. File penting:
  - `app/src/main/java/id/matoer/pos/MainActivity.kt` — layar utama (membuka matoer.id/pos).
  - `app/src/main/java/id/matoer/pos/PrinterBluetooth.kt` — cara mencetak ke printer.
  - `app/src/main/java/id/matoer/pos/JembatanPos.kt` — "jembatan" agar web POS bisa memakai printer aplikasi.
  - `app/build.gradle.kts` — nama versi aplikasi, alamat server.
  - `app/src/main/res/` — ikon & warna.
- **Atas kanan:** tombol ▶ **Run** (jalankan di tablet).
- **Bawah:** tab **Build** & **Logcat** (tempat pesan error / catatan).

### 4.4 Coba jalankan langsung di tablet (opsional, untuk uji cepat)
1. Di tablet: **Setelan → Tentang tablet → ketuk "Nomor build" 7 kali** sampai muncul "Anda sekarang developer".
2. **Setelan → Sistem → Opsi pengembang → aktifkan "USB debugging"**.
3. Sambungkan tablet ke laptop dengan kabel USB → di tablet pilih **Izinkan** saat ditanya.
4. Di Android Studio, pilih nama tablet di kotak perangkat (atas) → klik ▶ **Run**. Aplikasi terpasang & terbuka di tablet.

### 4.5 Membuat kunci tanda tangan (sekali saja — SIMPAN BAIK-BAIK)
1. Menu **Build → Generate Signed App Bundle / APK…** → pilih **APK** → *Next*.
2. Di **Key store path** klik **Create new…**:
   - *Key store path:* simpan misalnya `matur/android/matoer-pos.jks`
   - *Password:* buat kata sandi kuat, **catat di tempat aman**
   - *Alias:* `matoer-pos` — *Password* kunci: boleh sama
   - *Validity:* 25 tahun — isi *First and Last Name*: `Matoer POS`, *Organization*: `CV Hazna Berkah Indonesia`
   - *OK*
3. **PENTING:** cadangkan file `matoer-pos.jks` + kata sandinya (Drive pribadi/flashdisk). Kalau hilang, APK baru **tidak bisa** memperbarui aplikasi lama (harus uninstall di semua tablet).
4. File `.jks` **tidak ikut** ke GitHub (sudah diatur di `.gitignore`) — ini disengaja demi keamanan.

### 4.6 Membuat APK siap pasang
1. **Build → Generate Signed App Bundle / APK… → APK** → pilih keystore tadi, isi kata sandi → *Next*.
2. Pilih **release** → *Create*.
3. Setelah selesai, klik **locate** pada notifikasi. File APK ada di `android/app/release/` (atau `app/build/outputs/apk/release/`).

*Alternatif otomatis:* salin `android/keystore.properties.contoh` menjadi `android/keystore.properties`, isi kata sandi Anda, lalu menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)** langsung memakai kunci tersebut.

---

## 5. Memasang APK di tablet / HP

1. Buka file APK di tablet (dari WhatsApp/Drive/File Manager).
2. Bila muncul *"Untuk keamanan, tablet tidak diizinkan memasang aplikasi dari sumber ini"* → **Setelan** → aktifkan **Izinkan dari sumber ini** → kembali → **Pasang**.
3. Bila Play Protect memperingatkan "aplikasi tidak dikenal" → **Detail lainnya → Tetap pasang** (wajar untuk aplikasi internal yang belum di Play Store).
4. Buka **Matoer POS** dari layar beranda → login akun outlet seperti biasa.

---

## 6. (Disarankan) Kunci tetap untuk APK otomatis di GitHub

Agar APK dari GitHub bisa **memperbarui tanpa uninstall**, simpan kunci dari Bagian 4.5 sebagai **GitHub Secrets** (rahasia — tidak terlihat siapa pun, tidak ada di kode):

1. Ubah file `.jks` menjadi teks base64:
   - **Mac/Linux:** `base64 -i matoer-pos.jks | pbcopy` (Mac) atau `base64 -w0 matoer-pos.jks`
   - **Windows (PowerShell):** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("matoer-pos.jks")) | Set-Clipboard`
2. GitHub → repo **matur** → **Settings → Secrets and variables → Actions → New repository secret**, buat 4 secret:
   - `MATOER_KEYSTORE_BASE64` → tempel teks base64 tadi
   - `MATOER_KEYSTORE_PASSWORD` → kata sandi keystore
   - `MATOER_KEY_ALIAS` → `matoer-pos`
   - `MATOER_KEY_PASSWORD` → kata sandi kunci
3. Jalankan ulang: tab **Actions → APK Matoer POS → Run workflow**. APK berikutnya ditandatangani kunci tetap.

> Setelah memakai kunci tetap, **uninstall sekali** aplikasi lama yang ditandatangani kunci debug, lalu pasang APK baru. Seterusnya cukup pasang menimpa.

---

## 7. Menyambungkan printer di aplikasi

1. Nyalakan printer (mis. RPP02N). Pastikan **tidak sedang tersambung** ke HP/aplikasi lain (mis. Luna POS).
2. Tablet: **Setelan → Bluetooth → Pasangkan perangkat baru** → pilih **RPP02N** → bila diminta PIN: `0000` atau `1234`.
3. Buka **Matoer POS** → tombol **🖨 Printer** (atas) → izinkan **Perangkat di sekitar** bila ditanya → **Muat ulang daftar**.
4. Pilih **RPP02N** → **Pilih** → **Cetak tes**. Kertas tes harus keluar.
5. Selesai — struk dari layar transaksi & Riwayat otomatis tercetak lewat printer ini (dibuka dari aplikasi).

---

## 8. Membuat versi baru

1. Ubah kode yang perlu.
2. Buka `android/app/build.gradle.kts`, **naikkan** angka:
   ```kotlin
   versionCode = 2        // selalu naik 1 setiap rilis
   versionName = "1.0.1"  // nomor versi yang terlihat
   ```
3. Buat APK (Bagian 4.6) atau push ke GitHub (APK otomatis).
4. Pasang di tablet **menimpa** versi lama (data login tetap).

---

## 9. Masalah yang sering muncul

| Masalah | Penyebab & solusi |
|---|---|
| Gradle sync gagal / lama | Internet putus atau pertama kali mengunduh. Klik **File → Sync Project with Gradle Files** lagi. |
| "SDK location not found" | Buka **Tools → SDK Manager**, pastikan **Android 15 (API 35)** terpasang, lalu sync ulang. |
| Tablet tidak muncul di Android Studio | Cek kabel (pakai kabel data), USB debugging aktif, ketuk **Izinkan** di tablet. |
| "App not installed" saat memasang | Tanda tangan berbeda dengan versi lama → uninstall aplikasi lama dulu (Bagian 2/6). |
| Printer tidak ada di daftar | Belum dipasangkan di Setelan Bluetooth, atau izin "Perangkat di sekitar" ditolak (Setelan → Aplikasi → Matoer POS → Izin). |
| Cetak tes gagal | Printer mati / kertas habis / masih tersambung ke HP lain. Matikan-nyalakan printer lalu coba lagi. |
| Halaman "Tidak ada koneksi internet" | Wi-Fi/data mati. Nyalakan lalu tekan **Coba lagi**. |

---

## 10. Catatan teknis (untuk pengembang)

- `applicationId`: `id.matoer.pos`, `minSdk 24`, `targetSdk 35`, AGP 8.7.3, Kotlin 2.0.21, Gradle 8.9 (wrapper), JDK 17.
- Alamat server di `buildConfigField BASE_URL/START_PATH` (`app/build.gradle.kts`).
- Jembatan `window.MatoerAndroid`: `daftarPrinter()`, `pilihPrinter(alamat,nama)`, `printerTerpilih()`, `lupakanPrinter()`, `cetak(base64, id)` → balasan `window.__matoerCetak(id, ok, pesan)`, `simpanFile(base64, nama, mime)`, `versi()`, `muatUlang()`. Sisi web: `src/lib/printer-bt.ts` (`diAplikasi()`), `src/lib/pdf-kop.ts` (`unduh`), `src/app/kasir/(terminal)/printer-tombol.tsx`.
- Printer: SPP/RFCOMM (aman → tidak aman → kanal 1) lalu BLE GATT dengan prioritas jalur cetak yang sama dengan web.
- Hanya domain `matoer.id` dibuka di WebView; tautan lain dibuka di aplikasi luar.
- Play Store: tahap berikutnya (perlu akun developer & kunci unggah terpisah).
