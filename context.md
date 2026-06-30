Konteks Fitur: Optimalkan halaman "Mata Pelajaran" (Manajemen Bank Soal) pada Dashboard Admin Hero Exam (sebagaimana terlihat pada screenshot sumber) untuk menangani data skala besar (1.000+ bank soal) dengan menambahkan fungsionalitas pencarian, pemfilteran, dan pemantauan aktivitas real-time.
Prinsip Desain (Clean & Professional):
Tema: Konsisten dengan Dark Mode yang ada (Latar belakang gelap, teks putih/abu-abu terang).
Minimalis: Hindari warna yang terlalu kontras; gunakan warna aksen hanya untuk indikator status.
Spacing: Gunakan padding yang luas dan subtle borders untuk memisahkan elemen.
1. Elemen Statis: Dashboard Summary Cards (Top Section)
Tambahkan 3 kartu ringkasan di bagian atas tabel untuk visibilitas cepat:
Total Bank Soal: Menghitung baris di tabel question_banks.
Soal Terupload: Total questions dari seluruh bank soal.
Guru Kontributor: Jumlah unik users dengan role 'Guru' yang memiliki bank soal.
Styling: Kartu tanpa border tebal, menggunakan background satu tingkat lebih terang dari latar belakang utama dengan angka yang menonjol (Bold).
2. Elemen Kontrol: Search & Advanced Filtering
Ganti area kosong di atas tabel dengan baris kontrol yang efisien:
Search Bar: Input field minimalis dengan icon magnifying glass. Placeholder: "Cari nama soal atau guru...". Query harus mencakup kolom BANK_SOAL dan nama guru pembuat.
Filter Tingkat (Dropdown): Opsi berdasarkan struktur akademik (X, XI, XII atau VII, VIII, IX) sesuai jenjang sekolah
.
Filter Mata Pelajaran (Dropdown): Kategorisasi per mata pelajaran (Matematika, IPA, Produktif, dll)
.
Filter Tahun Ajaran (Dropdown): Memfilter data berdasarkan periode aktif di tabel academic_years.
Reset Button: Satu tombol kecil (icon refresh) untuk mengosongkan semua filter sekaligus.
3. Elemen Tabel: Enhanced Data Grid
Tingkatkan tabel utama dengan fitur berikut:
Bulk Action: Checkbox pada setiap baris dan di header untuk aksi massal (misal: Hapus massal).
Sorting: Header kolom (Nama Bank Soal, Jumlah Soal, Dibuat Oleh) dapat diklik untuk mengurutkan secara ascending/descending.
Pagination: Footer tabel yang menampilkan "Showing 1-10 of 1,000" dan navigasi halaman. Dukung opsi "Show 10/25/50 entries".
4. Elemen Real-Time: Global Activity Sidebar (Area Border Merah)
Implementasikan sidebar kanan sebagai feed aktivitas sistem
:
Data Source: Mengambil 15 data terbaru dari tabel audit_logs
.
Real-Time Engine: Menggunakan Socket.io dengan pola Passive Subscribe pada channel global-activity
.
Card Design: Card aktivitas minimalis. Contoh: "Drs. Rajan Johnson baru saja mengimpor soal Matematika" dengan timestamp relatif (misal: "2m yang lalu").
Status Icons: Icon kecil berwarna hijau untuk 'Import', kuning untuk 'Edit', dan merah untuk 'Delete/Reset'.
5. Spesifikasi Teknik (Backend & Performance)
Query Optimization: Gunakan Prisma ORM dengan fitur include untuk relasi guna menghindari N+1 Query saat filter dijalankan
.
Response Time: Pastikan eksekusi pencarian dan filter mengembalikan hasil dalam waktu < 500ms meskipun data mencapai ribuan baris
.
API Structure: Buat endpoint GET /api/v1/question-banks yang menerima query params search, grade, subject, year, page, dan limit.