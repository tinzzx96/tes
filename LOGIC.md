# 🔒 ExamApp - Secure Lockdown Browser & Dynamic Exam Monitoring System
### Official Examination System Framework for SMK Poncol Jakarta Pusat

ExamApp adalah ekosistem sistem *Lockdown Browser* (Exambro) komprehensif yang dirancang untuk mengamankan, mengontrol, dan memantau pelaksanaan Ujian Berbasis Komputer (CBT) skala besar dengan kapasitas 900+ siswa secara bersamaan (*concurrent users*). 

Sistem ini berfungsi sebagai **Security Shell (Cangkang Keamanan)** yang memenjarakan sistem operasi perangkat HP siswa maupun PC Komputer Lab sekolah agar fokus mengerjakan ujian berbasis **Google Form**, sekaligus menyediakan **Dashboard Monitoring Real-Time** bagi proktor/guru untuk mendeteksi kecurangan secara instan menggunakan arsitektur berbasis kejadian (*event-driven architecture*).

---

## 🛠️ Arsitektur & Tech Stack (Teknologi yang Digunakan)

Proyek ini dikembangkan menggunakan struktur **Monorepo** yang memisahkan area kerja aplikasi mobile (Frontend HP) dan aplikasi web (Backend API & Dashboard Admin):

```text
ExamApp/ (Root Workspace)
├── exambro-mobile/         # Frontend Aplikasi HP Siswa (Dart & Flutter)
└── exambro-server/         # Backend API, Web Server, & Dashboard Admin (PHP & Laravel)
```

### 1. Sisi Aplikasi Siswa (Mobile App) - `/exambro-mobile`
*   **Language & Framework:** Dart & Flutter (Multi-platform Android/iOS).
*   **Key Packages & Core Functions:**
    *   `flutter_inappwebview`: Memuat target web Google Form secara rahasia, mematikan fungsi *address bar*, dan memblokir fitur *zoom/copy-paste*.
    *   `flutter_windowmanager`: Berkomunikasi dengan level OS untuk memblokir total fitur *screenshot* dan perekaman layar (`FLAG_SECURE`).
    *   `wakelock_plus`: Memaksa layar HP siswa tetap menyala selama ujian berlangsung.
    *   `device_info_plus`: Mengekstrak spesifikasi perangkat keras (Merek, Model, versi OS, dan UUID/Android ID) secara legal untuk kebutuhan autentikasi.
    *   `kiosk_mode` / `startapp_kiosk`: Memicu fitur *Screen Pinning* (Kiosk Mode) resmi Android untuk mematikan fungsi tombol *Home*, *Recent Apps*, *Gestures*, dan *Overlay System*.
    *   `shared_preferences`: Menyimpan data sesi login lokal, token ruangan harian, dan nama siswa di memori internal HP demi efisiensi request API.

### 2. Sisi Backend & Dashboard Admin (Web Server) - `/exambro-server`
*   **Language & Framework:** PHP 8.2+ & Laravel (Sistem Monolith untuk API & Dashboard).
*   **Web Server Engine:** **Nginx + PHP-FPM** (Dipilih untuk menggantikan Apache/XAMPP karena sistem *event-driven*-nya sangat hemat RAM dan tangguh menampung lonjakan *traffic concurrent* 900 siswa).
*   **Database Utama:** MySQL (Menyimpan data akun, jadwal harian terelasi, bank soal/tautan, data whitelist perangkat HP, dan tabel verifikasi inventaris PC Lab).
*   **Database Log Cepat (Bantalan RAM):** **Redis** (Bertindak sebagai penampung kilat di dalam memori RAM untuk ribuan log kecurangan per detik, sebelum dipindahkan secara berkala ke MySQL melalui *Laravel Queue/Background Job* agar harddisk server tidak mengalami *bottleneck*).
*   **Real-time Engine:** **Laravel Reverb / Socket.io** (Menggunakan protokol WebSockets untuk menyiarkan log pelanggaran secara instan dalam hitungan milidetik dari HP murid ke laptop guru).
*   **Frontend Admin UI:** Tailwind CSS & Blade (Tampilan antarmuka Dashboard Admin, Operator, dan Pengawas).
*   **Library Export/Import:** Laravel Excel / PhpSpreadsheet (Memproses file format `.xlsx`).

---

## 🎭 Sistem 4 Hak Akses & Strategi Akun Pengawas Anonim

1. **Admin (IT Sekolah):** Memiliki kontrol absolut sistem, memantau server, mengelola akun Operator, dan memiliki otoritas tertinggi untuk melakukan **Reset Device ID** jika ada siswa yang HP-nya rusak dan harus berganti perangkat baru.
2. **Operator (Panitia Ujian / Kurikulum):** Bertanggung jawab penuh pada pengelolaan data berbasis file Excel: mengimpor data master siswa, data master ruangan pengawas, mengimpor jadwal harian dinamis (900 data per hari), serta mengekspor laporan akhir kecurangan siswa terfilter.
3. **Pengawas / Guru (Proktor Ruangan Anonim):** Akun pengawas tidak dibuat menggunakan nama asli guru, melainkan dibuat berbasis nomor ruangan fisik secara permanen (Contoh: Username `proktor_ruang01` terkunci permanen untuk memantau Ruang 01, sedangkan `proktor_lab01` terkunci permanen memantau Lab Komputer 1). Siapa pun guru yang ditugaskan menjaga ruangan tersebut, mereka cukup *login* menggunakan akun ruangan tersebut. Layar monitor laptop pengawas akan otomatis langsung menyedot broadcast WebSocket dari HP siswa atau PC Lab yang dijadwalkan masuk ke ruangan tersebut hari itu juga.
4. **Murid / Siswa:** Menggunakan aplikasi mobile (HP) atau aplikasi desktop (PC Lab) untuk verifikasi login, registrasi perangkat, mendengarkan instruksi status kunci, dan mengerjakan soal ujian.

---

## 📥 SPESIFIKASI DAN LOGIKA FITUR DATA IMPORT (EXCEL)
*Seksi ini ditujukan agar AI asisten koding memahami aturan validasi, pemetaan kolom, dan struktur kueri insert/update.*

### 1. Import Master Data Siswa (Cukup 1x di Awal Tahun)
*   **Format Kolom Excel:** `nisn` | `nama_siswa` | `kelas_jurusan` | `password_awal`
*   **Logika Koding:** Kolom `nisn` divalidasi `unique`. Kolom `password_awal` dienkripsi otomatis via `Hash::make()`. Kolom `device_id` dibiarkan `NULL` menanti fase *Auto-Binding* di hari pertama.

### 2. Import Master Data Ruangan Proktor (Cukup 1x Seumur Hidup Aplikasi)
*   **Format Kolom Excel:** `username_proktor` | `nama_ruangan_display` | `password` 
*   *Contoh Baris:* `proktor_ruang01` | `LAB TEKNIK KOMPUTER 1` | `poncol2026`
*   **Logika Koding:** Nilai dari `username_proktor` disimpan permanen ke dalam kolom `ruangan` di tabel `users`. Kolom inilah yang dibaca dashboard proktor saat login untuk mengunci jalur WebSocket ruangan tersebut (misal: `presence-monitoring.ruang01`).

### 3. Import Master Data Inventaris Unit PC Lab (Cukup 1x Seumur Hidup Aplikasi)
*   **Tujuan:** Mendaftarkan seluruh komputer aset milik sekolah ke dalam tabel khusus `komputer_labs` agar server bisa mengenali posisi fisik PC saat siswa menempuh ujian di Lab.
*   **Format Kolom Excel:** `pc_code` | `nama_ruangan_lab` | `mac_address_hardware`
*   *Contoh Baris:* `LAB1-PC12` | `lab01` | `00:1A:2B:3C:4D:5E`
*   **Logika Koding:** Berkas pengolah Laravel menyimpannya ke tabel baru `komputer_labs`. Kolom `pc_code` dan `mac_address_hardware` wajib berstatus indeks unik (`unique`) untuk mencegah duplikasi atau kloning identitas komputer.

### 4. Import Master Bank Soal & Link Ujian (Sebelum Pekan Ujian Dimulai)
*   **Format Kolom Excel:** `kode_mapel` | `nama_mata_pelajaran` | `link_google_form_asli`
*   **Logika Koding:** Fungsi ini melakukan kueri `updateOrCreate()` berdasarkan `kode_mapel` agar tautan terisolasi aman di sisi server.

### 5. Import Jadwal Ujian Harian & Pemetaan Ruangan Siswa (Wajib Diimpor Setiap Sore Hari)
*   **Format Kolom Excel:** `nisn` | `kode_mapel` | `tanggal_ujian` (YYYY-MM-DD) | `jam_mulai` (HH:MM:SS) | `jam_selesai` (HH:MM:SS) | `nama_ruangan_siswa` | `token_ruang_pengawas`
*   **Logika Koding Backend (Laravel):** Data disimpan ke tabel relasional terpusat bernama `jadwal_ujians`. Saat beranda memanggil API, Laravel menjalankan kueri filter waktu hari ini. Jika baris cocok, server mengirim detail token harian, nama ruangan (misal: kelas biasa `ruang04` atau ruang lab `lab01`), dan link ujian terenkripsi ke aplikasi siswa.

---

## 📤 FITUR OUTPUT DATA (EXPORT EXCEL REPORT WITH MULTI-FILTERING)

Operator dapat mengunduh berkas laporan rekapitulasi kecurangan siswa dalam format Excel `.xlsx` dengan dua filter utama: **Filter Tanggal** dan **Filter Ruangan** (Dropdown selection seperti `ruang01`, `lab01`).

### 📊 Desain Kerapian Penyajian Data Laporan Excel
*   **Urut Berdasarkan Jurusan (Grouped Data Sorting):** Kueri mengeksekusi `orderBy('kelas')->orderBy('nama')` agar baris Excel mengelompok rapi per jurusan/kelas.
*   **Sel Jenis Pelanggaran Ringkas (Aggregated Column Summary):** Menerapkan fungsi penghitungan kelompok (*grouping count*). Hasil konversi teks memanjang otomatis diringkas menjadi estetik: **`"Screenshot (3x), Sidebar (1x), Keluar Aplikasi (1x)"`**.
*   **Kolom Rekapitulasi Total Terkunci:** Menampilkan sel khusus yang menghitung berapa kali siswa mengalami pembekuan layar (blur total) akibat menyentuh kelipatan 3 kali pelanggaran selama ujian berlangsung, lengkap dengan pencatatan kode unit PC Lab tempat kejadian berlangsung (jika melanggar di komputer Lab).

---

## 📂 Struktur Workspace Monorepo Proyek

```text
ExamApp/
├── exambro-mobile/                # AREA KERJA FRONTEND MOBILE (FLUTTER)
│   ├── lib/
│   │   ├── main.dart              # Titik masuk utama, router linear bertahap, dan pembuatan Bottom Navbar Beranda
│   │   ├── screens/
│   │   │   ├── login_screen.dart  # Form 3 input box (NISN, Password, Token Ruangan) + pemicu info hardware
│   │   │   ├── home_screen.dart   # Dashboard SMK Poncol (Profil, Status Perangkat, Kartu Jadwal, Tombol Mulai Ujian)
│   │   │   ├── exam_screen.dart   # Penjara WebView Google Form, Kiosk Mode, Event Listener, & Layar Blur BackdropFilter
│   │   │   └── schedule_screen.dart# Tampilan list jadwal masa depan harian siswa (Menu 2 Bottom Navbar)
│   └── pubspec.yaml               # Manajemen package (inappwebview, windowmanager, kiosk_mode, device_info_plus)
│
└── exambro-server/                # AREA KERJA BACKEND & DASHBOARD ADMIN (LARAVEL)
    ├── app/Http/Controllers/
    │   ├── Api/
    │   │   └── StudentAuthController.php # Menangani verifikasi login, Auto-Binding Device ID harian, & respon nama siswa
    │   │   └── FraudLogController.php   # Menerima tembakan JSON pelanggaran dari HP/PC untuk diteruskan ke Redis & WebSockets
    │   └── Admin/
    │       └── ExcelController.php      # Menangani logika import 5 jenis file Excel & eksport data pelanggaran terfilter
```

---

## 🚀 Tujuan Utama Proyek (Project Goals)
1. **Zero URL Leakage:** Mengisolasi tautan asli Google Form agar tidak bisa diintip, disalin, atau dideteksi oleh Google Lens dan browser luar.
2. **Device Hardware Locking:** Mengunci 1 akun siswa hanya pada 1 perangkat HP fisik harian untuk mencegah manipulasi akun atau tukar-menukar perangkat di dalam kelas.
3. **Total OS Hardening:** Menutup segala celah kecurangan bawaan OS Android/iOS seperti *Smart Sidebar*, *Floating Apps* (Aplikasi Mengambang), *Split Screen*, *Screenshot*, dan hilangnya fokus aplikasi.
4. **Automated Enforcement (Auto-Lock 3x):** Menerapkan hukuman otomatis berupa pembekuan layar (blur total) jika siswa melanggar aturan sebanyak 3 kali, yang hanya bisa dibuka secara *real-time* oleh pengawas ruangan.
5. **High-Efficiency Logging:** Mampu menahan lonjakan *traffic* (900+ siswa menekan tombol mulai bersamaan) tanpa membebani performa database utama.

---

