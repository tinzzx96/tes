HERO EXAM
Product Requirements Document — Enterprise V1
Secure Computer Based Test Platform for Schools
Platform: Android (Flutter Native) · Windows LAB (Safe Exam Browser)
Backend: Node.js (Express/Fastify) REST API
Status: Final — Disetujui untuk Pengembangan (Revisi Stack Backend)
Target Skala: 1.000 → 5.000+ peserta aktif bersamaan
Catatan Revisi: Backend stack diganti dari Laravel (PHP) ke Node.js. Library import DOCX disesuaikan menjadi berbasis Node.js (mammoth.js sebagai parser
utama, docx4js sebagai alternatif), menggantikan PHPWord.
1. Project Overview
Hero Exam adalah platform Computer Based Test (CBT) yang dirancang untuk kebutuhan ujian sekolah secara digital, aman, dan terkontrol. Platform ini
menggunakan satu backend terpusat berbasis Node.js yang melayani dua platform klien: aplikasi Android berbasis Flutter Native dan komputer LAB Windows yang
menggunakan Safe Exam Browser (SEB). Seluruh soal dikelola dalam satu Question Bank terpusat, dan guru dapat mengimpor soal massal melalui file Microsoft
Word (DOCX).
Target Pengguna: Sekolah umum, SMK, SMA, SMP, Bimbingan Belajar (Bimbel), dan institusi pendidikan lainnya.
1.1 Masalah yang Diselesaikan
Kecurangan sulit dicegah. Pada sistem ujian konvensional maupun CBT sederhana, siswa dapat dengan mudah menyalin jawaban, berbagi soal secara verbal,
atau menggunakan browser bebas untuk mencari jawaban di internet selama ujian berlangsung.
Input soal memakan waktu lama. Guru harus memasukkan soal satu per satu melalui dashboard — proses yang sangat tidak efisien, terutama ketika bank
soal berisi ratusan soal.
Tidak ada sistem resume ujian. Jika koneksi terputus atau perangkat siswa bermasalah di tengah ujian, jawaban yang sudah dikerjakan berisiko hilang dan
ujian harus diulang dari awal.
Penggunaan satu akun oleh lebih dari satu orang. Tidak ada mekanisme yang mencegah siswa menitipkan akunnya ke orang lain untuk dikerjakan di
perangkat berbeda secara bersamaan.
Tidak ada monitoring peserta secara real-time. Pengawas tidak memiliki visibilitas terhadap siapa yang sedang online, siapa yang sudah submit, atau siapa
yang mengalami masalah koneksi selama ujian berlangsung.
Timer rawan dimanipulasi. Pada sistem berbasis timer lokal, siswa dapat mengubah waktu perangkat untuk memperpanjang durasi ujian.
1.2 Primary Goals
Mencegah kecurangan melalui desain sistem, bukan melalui pengawasan invasif. Randomisasi soal dan jawaban, navigator tanpa nomor urut, single session
policy, dan pembatasan browser adalah mekanisme pencegahan yang dibangun langsung ke dalam arsitektur platform.
Mempermudah proses input soal oleh guru. Guru cukup menulis soal di Microsoft Word menggunakan format yang sudah ditentukan, lalu upload satu file untuk
mengimpor ratusan soal sekaligus — termasuk soal bergambar.
Menjamin keberlangsungan ujian meski terjadi gangguan teknis. Jawaban tersimpan otomatis di setiap interaksi, timer berjalan di server, dan siswa dapat resume
ujian dari posisi terakhir tanpa kehilangan progress.
Memberikan visibilitas penuh kepada pengawas. Dashboard pengawas menampilkan status setiap peserta secara real-time, lengkap dengan kemampuan reset
sesi dan tutup ujian.
Menyediakan platform yang ringan dan mudah diadopsi. Tidak membutuhkan perangkat khusus atau infrastruktur yang mahal — cukup Android 8+ atau Windows
10+ dengan SEB yang bisa diinstall gratis.
1.3 Business Goals
Menguasai segmen sekolah menengah di Indonesia. Target awal adalah institusi jenjang SMP, SMA, dan SMK yang belum memiliki platform CBT sendiri dan
selama ini bergantung pada solusi improvisasi (Google Form, LMS umum, atau ujian kertas).
Model V1 sebagai fondasi Single School. Versi pertama dirancang untuk satu sekolah per instalasi — memudahkan onboarding, implementasi, dan dukungan
teknis per klien.
Skalabilitas menuju Multi School SaaS (V2). Arsitektur backend dirancang sejak awal untuk mendukung pertumbuhan menuju model multi-tenant, di mana banyak
sekolah dapat menggunakan satu platform yang sama.
Mengurangi ketergantungan pada solusi asing yang mahal. Platform ini dikembangkan secara lokal, memungkinkan harga yang lebih kompetitif dan dukungan
yang lebih relevan untuk kebutuhan institusi pendidikan Indonesia.
Membangun ekosistem konten (Roadmap V2). Marketplace Bank Soal pada roadmap V2 membuka peluang bisnis baru di mana guru atau institusi dapat berbagi
atau menjual konten soal antar sekolah.
2. Core Philosophy
PREVENT CHEATING — bukan DETECT CHEATING.
Hero Exam tidak berusaha menjadi sistem AI pengawas yang mendeteksi kecurangan setelah terjadi. Sebaliknya, platform ini dirancang agar peluang menyontek
menjadi sangat kecil melalui desain sistem itu sendiri — bukan melalui pengawasan invasif berbasis AI, kamera, atau analisis perilaku.
Filosofi ini menjadi landasan seluruh keputusan desain: arsitektur exam player, sistem randomisasi soal dan jawaban, kontrol sesi tunggal, hingga pembatasan akses
browser di Windows. Pendekatan pencegahan dipilih karena lebih andal, lebih ringan secara teknis, lebih ramah privasi siswa, dan lebih mudah diaudit dibanding
pendekatan deteksi berbasis AI yang rentan false positive maupun false negative.
3. Target Scale
Peserta: Target awal 1.000 peserta aktif bersamaan, target jangka panjang 5.000+ peserta aktif bersamaan.
Versi: V1 dirancang untuk Single School (satu institusi per instalasi). V2 akan mendukung Multi School SaaS (multi-tenant, beberapa sekolah dalam satu platform).
4. Supported Platform
Platform
Teknologi
Minimum OS
Android
Flutter Native App
Android 8+
Windows LAB
Safe Exam Browser (SEB)
Windows 10+
5. User Roles & Hak Akses
Super Admin
Memiliki akses penuh ke seluruh sistem: mengelola sekolah, mengelola akun admin sekolah, melakukan monitoring server, dan menjalankan maintenance sistem.
Admin Sekolah
Mengelola data operasional sekolah: guru, siswa, kelas, mata pelajaran, ujian, dan tahun ajaran.
Guru
Dapat mengupload soal via DOCX, mengelola bank soal (edit, hapus, preview), membuat dan mengkonfigurasi ujian, serta melihat dan mengekspor hasil ujian.
Pengawas
Bertugas saat ujian berlangsung: generate token ujian, monitoring status peserta secara real-time, reset sesi peserta yang bermasalah, dan menutup sesi ujian.
Siswa
Dapat login ke sistem, mengikuti ujian sesuai jadwal, dan melihat hasil ujian (opsional, dikonfigurasi oleh guru/admin).
6. Struktur Akademik
Sistem mendukung hierarki akademik: Tahun Ajaran → Tingkat → Kelas → Mata Pelajaran.
Penamaan tingkat mengikuti jenjang: SMA/SMK menggunakan X, XI, XII; SMP menggunakan VII, VIII, IX. Kelas diberi nama seperti X-A, X-B, XI-A, XI-B, dan seterusnya.
Mata pelajaran yang didukung antara lain Matematika, Bahasa Indonesia, Bahasa Inggris, IPA, IPS, Produktif TKJ, Produktif RPL, dan mata pelajaran lain sesuai
kebutuhan sekolah.
7. DOCX Import System
Guru tidak perlu membuat soal satu per satu melalui dashboard. Cukup gunakan Microsoft Word yang sudah familiar, lalu upload file-nya untuk diproses otomatis
oleh sistem.
Format penulisan soal di Word:
MAPEL: Matematika
KELAS: X
BANK_SOAL: PTS GANJIL
1. 2 + 2 = ?
a. 3
b. 4
c. 5
d. 6
KUNCI: B
Revisi Stack: Parser: mammoth.js (utama), docx4js (alternatif) — berjalan native di atas Node.js backend, menggantikan PHPWord yang sebelumnya
digunakan pada stack Laravel.
Elemen yang didukung di V1: Text, Gambar, Tabel, Bold, Italic, Underline, Multiple Choice.
Elemen yang belum didukung di V1: Audio, Video, Formula Matematika Kompleks.
8. Soal Bergambar & Import Flow
Guru cukup copy-paste gambar langsung ke dalam dokumen Word, tanpa perlu melakukan upload gambar secara terpisah. Sistem akan otomatis mengekstrak
gambar saat file DOCX diproses.
Contoh format soal bergambar:
1. Perhatikan gambar berikut
[ GAMBAR ]
a. 10  b. 20  c. 30  d. 40
KUNCI: B
Import Flow: DOCX → Parser (mammoth.js / docx4js) → Extract Image → Storage → Database
9. Bank Soal
Bank soal diorganisir secara hierarkis: Mata Pelajaran → Bank Soal → Soal. Satu mata pelajaran dapat memiliki beberapa bank soal (misalnya: PTS Ganjil, PAS, Try
Out). Setiap bank soal menampung sejumlah soal individual.
Contoh: Matematika → PTS Ganjil → 100 Soal.
10. Exam Management
Parameter
Keterangan
Nama ujian
Judul yang ditampilkan kepada peserta
Durasi
Lama waktu pengerjaan ujian (dalam menit)
Token
Kode akses yang harus dimasukkan peserta untuk memulai ujian
Kelas
Kelas yang dijadwalkan mengikuti ujian
Mata pelajaran
Mapel terkait ujian
Jumlah soal
Total soal yang akan diujikan
Acak soal
Aktif/non-aktif — urutan soal diacak per peserta
Acak jawaban
Aktif/non-aktif — posisi opsi jawaban diacak per peserta
Jadwal mulai
Waktu ujian dibuka
Jadwal selesai
Waktu ujian ditutup otomatis
11. Randomization Engine
Acak Soal: Setiap peserta menerima urutan soal yang berbeda dari soal sumber yang sama. Peserta A bisa mendapat urutan soal 5-2-9-1-4, sementara Peserta B
mendapat 9-1-4-5-2.
Acak Jawaban: Posisi opsi jawaban (A, B, C, D) diacak secara independen per peserta. Kunci jawaban tetap valid karena dipetakan secara dinamis di backend.
Misalnya, jawaban benar "Jakarta" bisa menjadi opsi A untuk satu peserta, dan opsi C untuk peserta lain — namun sistem tetap mencatat dengan benar mana yang
dipilih.
12. Exam Player Design
Filosofi: One Question Per Screen. Satu soal ditampilkan penuh per layar untuk menjaga fokus peserta dan konsistensi pengalaman ujian. Desain bergaya Google
Form (semua soal dalam satu halaman scroll panjang) tidak digunakan.
Komponen layout:
Sidebar Profil: Menampilkan identitas peserta yang sedang login.
Area Soal: Menampilkan konten soal dan opsi jawaban aktif.
Timer: Menampilkan sisa waktu ujian secara real-time.
Navigator: Navigasi antar soal beserta indikator status jawaban.
13. Question Navigator
Navigator tidak menampilkan nomor urut soal (seperti 1, 2, 3, 4, dst.) karena nomor yang konsisten memudahkan komunikasi antar peserta ("soal nomor 5
jawabannya apa?"). Sebagai gantinya, navigator menampilkan indikator visual berbasis simbol/status:
Simbol
Status
■
Belum Dijawab
■
Sudah Dijawab
★
Ditandai (flagged untuk ditinjau ulang)
Karena urutan soal sudah diacak per individu, peserta tidak dapat dengan mudah merujuk "soal nomor sekian" kepada peserta lain — bahkan jika mereka berhasil
berkomunikasi.
14. Timer System
Timer berjalan di sisi server (Node.js), bukan di perangkat siswa. Ini berarti waktu tidak dapat dimanipulasi dengan mengubah jam/tanggal pada perangkat lokal.
Ketika waktu ujian habis, sistem secara otomatis menyelesaikan ujian peserta dan mengirimkan seluruh jawaban yang sudah tersimpan — tanpa perlu tindakan
apapun dari peserta.
15. Auto Save
Aksi Peserta
Hasil
Memilih jawaban
Jawaban langsung tersimpan ke server
Klik Next (soal berikutnya)
Jawaban tersimpan otomatis
Klik Previous (soal sebelumnya)
Jawaban tersimpan otomatis
Tandai soal (flag)
Status tanda tersimpan otomatis
Peserta tidak perlu menekan tombol "simpan" secara manual. Risiko kehilangan jawaban akibat lupa menyimpan dieliminasi sepenuhnya.
16. Single Session Policy
Aturan: 1 akun = 1 perangkat aktif pada satu waktu. Jika peserta mencoba login di perangkat lain sementara sesi di perangkat pertama masih aktif, maka sesi lama
akan otomatis ditutup oleh sistem.
Kebijakan ini mencegah satu akun digunakan secara bersamaan di lebih dari satu perangkat, yang merupakan salah satu vektor kecurangan paling umum pada ujian
digital (misalnya menitipkan akun ke orang lain).
17. Resume System
Sistem dirancang untuk tetap menjaga kelangsungan ujian meskipun terjadi gangguan teknis, termasuk: internet terputus, aplikasi crash, browser tertutup tidak
sengaja, atau laptop restart mendadak.
Garansi sistem: Jika salah satu kondisi di atas terjadi, jawaban yang sudah dipilih tetap tersimpan, timer tetap berjalan di server, dan siswa dapat melanjutkan ujian
dari posisi terakhir setelah perangkat atau koneksi kembali normal.
18. Android Security
Fitur Keamanan
Penjelasan
Native Flutter App
Tidak menggunakan browser — akses ke URL bar, tab baru, dan fitur browser standar tidak tersedia
Fullscreen Mode
Status bar Android disembunyikan selama ujian berlangsung
Immersive Mode
Navigation bar (tombol back/home/recent) disembunyikan selama ujian
Screenshot Protection
FLAG_SECURE diaktifkan untuk mencegah screenshot dan screen recording di sebagian besar perangkat Android
Single Session
Aktif, mengacu pada kebijakan di Bagian 16
19. Windows Security
Komputer LAB wajib menggunakan Safe Exam Browser (SEB) untuk mengakses ujian. Jika request yang masuk ke backend Node.js tidak berasal dari SEB (misalnya
menggunakan Chrome, Edge, atau Firefox biasa), maka akses akan otomatis ditolak oleh sistem.
Konfigurasi
Status
Address Bar
Hidden — URL tidak terlihat oleh siswa
New Tab
Disabled
New Window
Disabled
Browser Navigation (Back/Forward)
Disabled
Context Menu (klik kanan)
Disabled
20. Dashboard Pengawas
Dashboard pengawas menampilkan status seluruh peserta ujian secara real-time. Pengawas dapat memantau siapa saja yang sedang aktif, sudah submit, terputus,
atau belum mulai.
Nama Siswa
Status
Ujang
Online
Asep
Submit
Marlino
Offline
Dedi
Belum Login
Fitur yang tersedia di dashboard pengawas:
Generate Token: Membuat kode token yang harus dimasukkan peserta untuk memulai ujian. Token ini dapat di-generate ulang jika diperlukan.
Reset Sesi: Jika peserta mengalami masalah teknis (misalnya terlogout paksa atau perangkat bermasalah), pengawas dapat mereset sesi peserta tersebut agar
bisa login ulang tanpa kehilangan jawaban.
Monitoring Status Real-time: Melihat status setiap peserta (Online / Offline / Submit / Belum Login) yang diperbarui melalui heartbeat setiap 30–60 detik.
Tutup Ujian: Pengawas dapat menutup sesi ujian secara manual sebelum waktu habis jika diperlukan.
21. Dashboard Guru
Upload DOCX: Import soal massal dari file Word.
Edit Soal: Mengubah teks soal, opsi jawaban, atau kunci jawaban secara individual.
Hapus Soal: Menghapus soal dari bank soal.
Preview Soal: Melihat tampilan soal sebagaimana akan terlihat oleh peserta ujian.
Buat Ujian: Mengkonfigurasi ujian baru (nama, durasi, token, kelas, jumlah soal, jadwal, opsi acak).
Lihat Hasil: Melihat rekap nilai dan jawaban peserta setelah ujian selesai.
Export Nilai: Mengunduh data nilai peserta.
22. Dashboard Admin
Kelola Guru: Tambah, edit, nonaktifkan akun guru.
Kelola Siswa: Tambah, edit, nonaktifkan akun siswa.
Kelola Kelas: Membuat dan mengelola rombongan belajar.
Kelola Mata Pelajaran: Menambah atau mengedit daftar mapel yang tersedia.
Kelola Ujian: Melihat dan mengelola semua ujian yang ada di sistem.
Kelola Tahun Ajaran: Mengatur periode tahun ajaran aktif.
23. Database Design — Overview
Revisi Stack: ORM/Query layer menggunakan Prisma ORM (atau Sequelize sebagai alternatif) di atas Node.js, menggantikan Eloquent ORM milik Laravel.
Struktur tabel di bawah ini tidak berubah.
Tabel
Fungsi
users
Data seluruh pengguna sistem
roles
Definisi peran pengguna (admin, guru, pengawas, siswa, dst.)
schools
Data sekolah/institusi
academic_years
Data tahun ajaran
grades
Data tingkat kelas
classes
Data kelas (rombongan belajar)
subjects
Data mata pelajaran
question_banks
Kumpulan bank soal per mapel
questions
Data soal individual
question_images
Gambar yang terkait dengan soal
exams
Data ujian yang dijadwalkan
exam_classes
Relasi ujian dengan kelas peserta
exam_attempts
Catatan setiap percobaan pengerjaan ujian oleh peserta
answers
Jawaban peserta per soal
sessions
Sesi login aktif pengguna
exam_tokens
Token akses ujian
audit_logs
Catatan jejak aktivitas sistem
24. Tabel: Questions
Kolom
Keterangan
id
Primary key
question_bank_id
Relasi ke bank soal
subject_id
Relasi ke mata pelajaran
grade_id
Relasi ke tingkat kelas
question_text
Isi teks soal
question_image
Path/referensi gambar soal (jika ada)
option_a
Opsi jawaban A
option_b
Opsi jawaban B
option_c
Opsi jawaban C
option_d
Opsi jawaban D
correct_answer
Kunci jawaban yang benar
difficulty
Tingkat kesulitan soal
display_order
Urutan tampilan default
created_at
Timestamp pembuatan
updated_at
Timestamp pembaruan terakhir
25. Tabel: Exams
Kolom
Keterangan
id
Primary key
title
Judul ujian
subject_id
Relasi ke mata pelajaran
duration
Durasi ujian (menit)
total_questions
Jumlah total soal dalam ujian
random_question
Status pengacakan soal (aktif/non-aktif)
random_answer
Status pengacakan jawaban (aktif/non-aktif)
token
Token akses ujian
start_time
Waktu mulai ujian
end_time
Waktu selesai ujian
created_by
Relasi ke pembuat ujian (guru)
26. Tabel: Exam Attempts
Kolom
Keterangan
id
Primary key
user_id
Relasi ke peserta
exam_id
Relasi ke ujian
started_at
Waktu mulai pengerjaan
finished_at
Waktu selesai pengerjaan
score
Nilai hasil ujian
status
Status: berjalan / selesai / dibatalkan
device_id
Identifikasi perangkat yang digunakan
ip_address
Alamat IP saat pengerjaan
27. API Modules
Revisi Stack: Seluruh modul API berikut diimplementasikan sebagai REST API berbasis Node.js (framework Express.js atau Fastify), menggantikan
implementasi Laravel sebelumnya.
Modul API
Fungsi
Authentication API
Login, logout, dan manajemen token akses
Question API
Operasi CRUD terhadap soal dan bank soal
Exam API
Pembuatan dan pengelolaan ujian
Monitoring API
Pemantauan status peserta secara real-time
Result API
Pengambilan dan pengelolaan hasil ujian
Admin API
Operasi administratif sistem
Import API
Proses import soal dari DOCX (mammoth.js/docx4js)
Session API
Pengelolaan sesi login dan validasi perangkat
28. Audit Log System
Sistem mencatat semua aktivitas penting untuk keperluan keamanan dan akuntabilitas. Aktivitas yang dilog:
Login · Logout · Import Soal · Edit Soal · Hapus Soal · Mulai Ujian · Submit Ujian · Reset Sesi
29. Performance Target
Metrik
Target
Peserta Aktif Bersamaan
1.000+
API Response Time
< 500ms
Uptime
99.9%
30. Backup System
Jenis Backup
Frekuensi
Database Backup
Harian
Media Backup
Harian
Retention Period: 30 hari. Backup disimpan selama 30 hari sebelum dihapus secara otomatis.
31. Server Architecture
Revisi Stack: "API Backend" pada seluruh jalur akses di bawah ini kini berjalan di atas Node.js (Express/Fastify), menggantikan Laravel (PHP).
Tiga jalur akses menuju backend yang sama:
Web (Windows LAB): SEB → Frontend Web → API Backend (Node.js) → Database
Android: Flutter App → API Backend (Node.js) → Database
Web Umum: Frontend Web → API Backend (Node.js) → Database
32. Monitoring Architecture
Heartbeat: Setiap perangkat peserta mengirimkan sinyal heartbeat ke server Node.js setiap 30–60 detik untuk memperbarui status koneksi.
Data yang disimpan: Status Online, Status Offline, Status Submit, Current Session.
Data yang TIDAK disimpan: Mouse Tracking, Keyboard Tracking, dan Screen Recording. Ini selaras dengan filosofi prevent-cheating yang menghindari
pengawasan invasif terhadap privasi peserta.
33. Security Philosophy
Aspek
Status
Keterangan
Menyalin seluruh soal
✔ Dicegah
Soal diacak & ditampilkan satu per satu
Melihat soal teman
✔ Dicegah
Urutan soal berbeda tiap peserta
Pakai browser biasa di LAB
✔ Dicegah
Backend (Node.js) validasi user-agent SEB
Screenshot mudah
✔ Dicegah
FLAG_SECURE aktif di Android
Login multi perangkat
✔ Dicegah
Single session policy
AI Anti Cheat
✘ Tidak diimplementasikan
Bukan pendekatan yang dipilih
Face Detection
✘ Tidak diimplementasikan
Invasif, tidak selaras filosofi
Eye Tracking
✘ Tidak diimplementasikan
Invasif, tidak selaras filosofi
Webcam Monitoring
✘ Tidak diimplementasikan
Invasif, tidak selaras filosofi
Behavior Analysis
✘ Tidak diimplementasikan
Invasif, tidak selaras filosofi
34. Future Roadmap V2
Essay Exam: Dukungan soal esai selain pilihan ganda.
PDF Export: Ekspor soal dan hasil ujian ke format PDF.
LAN Mode: Ujian dapat berjalan di jaringan lokal tanpa internet.
Offline Package: Paket ujian yang bisa dijalankan secara offline.
iOS App: Aplikasi native untuk perangkat iOS/iPad.
Multi School SaaS: Platform multi-tenant untuk beberapa sekolah dalam satu sistem.
CBT Analytics: Analitik mendalam tentang performa siswa dan soal.
Marketplace Bank Soal: Platform berbagi bank soal antar sekolah.
35. Final Architecture & Final Decision
Diagram Arsitektur Akhir:
Guru → DOCX → Node.js (mammoth.js Parser) → Database Hero Exam
   ↓
Hero Exam Web (SEB Windows)     Flutter App (Android)
   ↓                                  ↓
Peserta Windows                  Peserta Android
Keputusan
Status
Android = Flutter Native App
✔ Disetujui
Windows = Hero Exam Web + SEB
✔ Disetujui
Backend = Node.js (Express/Fastify)
✔ Disetujui (Revisi dari Laravel)
DOCX Import = mammoth.js / docx4js
✔ Disetujui (Revisi dari PHPWord)
ORM = Prisma / Sequelize
✔ Disetujui (Revisi dari Eloquent)
Soal Bergambar = Supported
✔ Disetujui
Acak Soal = Enabled
✔ Disetujui
Acak Jawaban = Enabled
✔ Disetujui
Auto Save = Enabled
✔ Disetujui
Timer Server Side = Enabled
✔ Disetujui
Single Session = Enabled
✔ Disetujui
Navigator Tanpa Nomor = Enabled
✔ Disetujui
Dashboard Pengawas = Enabled
✔ Disetujui
Dashboard Guru = Enabled
✔ Disetujui
Dashboard Admin = Enabled
✔ Disetujui
AI Anti Cheat = Disabled
✘ Ditolak
Face Detection = Disabled
✘ Ditolak
Eye Tracking = Disabled
✘ Ditolak
Webcam Monitoring = Disabled
✘ Ditolak
Dokumen ini merupakan revisi dari Hero_Exam_PRD_V3, dengan perubahan pada stack teknologi backend dari Laravel (PHP) menjadi Node.js. Seluruh fitur, kebijakan keamanan,
struktur data, dan filosofi produk tetap sama persis dengan dokumen asli.
36. Mobile App Security Implementation (Addendum)
Bagian 36–41 adalah ADDENDUM yang menambahkan detail implementasi aplikasi Android Hero 
Exam yang sudah dibangun dan berjalan normal, TANPA mengubah satu pun ketentuan pada 
Bagian 1–35 di atas. Seluruh filosofi, struktur data, dan kebijakan keamanan pada dokumen asli 
tetap berlaku penuh.
Bagian ini merinci implementasi nyata dari kebijakan Android Security (Bagian 18), yang 
sebelumnya hanya didefinisikan di level kebijakan (FLAG_SECURE, Fullscreen, Immersive Mode, 
Single Session).
Arsitektur Integrasi: Komunikasi Flutter (Dart) dengan Android Native (Java) memakai dua kanal 
komunikasi:
Kanal
Nama Channel
Fungsi
MethodChannel
com.exam.poncol/security
Perintah satu-arah dari Dart ke native: 
startLockTask, stopLockTask, isScreenPinned, 
enableSecureFlag, openWifiSettings, dll.
EventChannel
com.exam.poncol/
focus_events
Notifikasi instan saat window Activity 
kehilangan/mendapat fokus, menghindari delay 
polling 1 detik.
Persyaratan Minimum SDK: dependency freeRASP (deteksi emulator) mensyaratkan 
minSdkVersion 23, compileSdk 35, NDK 27.0.12077973 — dinaikkan dari konfigurasi default 
Flutter. Perangkat di bawah Android 6.0 tidak lagi didukung, namun ini MASIH SESUAI target 
Bagian 4 (“Android 8+”), sehingga tidak ada penyempitan target pengguna.
Screen Pinning: diimplementasikan murni menggunakan Android Screen Pinning API 
(startLockTask/stopLockTask) bawaan OS, tanpa plugin kiosk pihak ketiga. Tantangan teknis: tanpa 
status Device Owner, Android wajib menampilkan dialog konfirmasi sistem (“Pasang layar ini?”) 
setiap kali startLockTask() dipanggil. Solusi: flag pengaman berbasis status (bukan berbasis 
waktu/timer) yang menahan seluruh jalur deteksi pelanggaran sampai layar benar-benar 
terkonfirmasi tersemat.
Kunci Navigasi: ExamPlayerScreen mengunci tombol back/gesture back secara permanen selama 
ujian berlangsung. Menekan tombol back TIDAK dianggap pelanggaran dan TIDAK menaikkan 
counter — hanya mengunci layar di tempat, untuk menghindari murid dihukum akibat refleks 
menekan back tanpa kesalahan nyata.
Deteksi Emulator/Virtual Environment: library freeRASP diintegrasikan untuk mendeteksi 
eksekusi aplikasi di dalam emulator/VM, mencegah murid menjalankan Hero Exam di lingkungan 
virtual untuk memanipulasi sistem keamanan.
Deteksi Floating App/Overlay Window: tiga sinyal deteksi berjalan paralel untuk menutup celah 
masing-masing pendekatan:
Sinyal
Mekanisme
Cakupan
1. Window Focus Loss
EventChannel — instan
Overlay OEM yang mencuri fokus 
(Smart Sidebar, Game Space bawaan)
2. Lifecycle Observer
AppLifecycleState.inactive/paused
Transisi lifecycle resmi saat app 
kehilangan prioritas
3. Usage Stats Polling
UsageStatsManager, polling 1 detik, 
butuh izin PACKAGE_USAGE_STATS
Floating app pihak ketiga (mis. floating 
browser) yang sengaja didesain tidak 
mencuri fokus
Sistem Akumulasi Pelanggaran: setiap pelanggaran terdeteksi memicu fungsi penanganan blokir 
dengan logika berikut:
Kondisi Counter
Perilaku Sistem
counterPelanggaran < 5
Mode Blokir Normal: overlay solid hitam menutup penuh konten soal, 
dialog meminta PIN Supervisor.
counterPelanggaran ≥ 5
Tanpa dialog PIN. Sistem otomatis mengirim paksa jawaban ke server dan 
menampilkan layar diskualifikasi permanen.
Status blokir & counter disimpan persisten — jika app dibunuh paksa/HP restart, sistem mendeteksi 
cache ini dan langsung mengunci layar sejak detik pertama dengan counter yang tetap berlanjut. 
PIN Supervisor yang valid akan membersihkan status blokir (counter tetap tersimpan) dan memicu 
ulang proses screen pinning secara otomatis.
37. Keterbatasan Teknis & Mitigasi
Bagian ini mencatat batasan nyata dari arsitektur “Native App tanpa Device Owner” yang dipilih, 
sesuai keputusan Bagian 35 (“Android = Flutter Native App”, tanpa MDM/DPC).
Floating App Pihak Ketiga (SYSTEM_ALERT_WINDOW): aplikasi floating browser dari Play 
Store yang memakai permission resmi Android SYSTEM_ALERT_WINDOW dapat muncul di atas 
layar ujian TANPA mencuri window focus — ini perilaku resmi yang diizinkan Android untuk kasus 
penggunaan sah (chat bubble, screen recorder overlay), bukan celah/bug. Mitigasi: Sinyal 3 
(UsageStatsManager) mendeteksi app lain yang baru aktif di foreground sebagai sinyal tambahan, 
namun efektivitasnya bergantung pada izin Usage Access yang harus diaktifkan manual oleh murid. 
Tanpa status Device Owner/MDM, tidak ada cara 100% mencegah overlay ini muncul — ini batasan 
resmi platform Android, bukan limitasi implementasi.
Rendering Blur (BackdropFilter): percobaan awal menggunakan efek blur di balik dialog blokir 
gagal render secara silent di sejumlah device Android dengan Impeller rendering engine — bug 
resmi yang dikenal luas di komunitas Flutter, terutama chipset kelas menengah-bawah. Keputusan 
final: overlay blokir memakai warna solid hitam pekat yang dijamin selalu merender sempurna di 
semua device, karena keamanan tidak boleh bergantung pada efek visual yang tidak terjamin 
tampil.
Kontrol Data Seluler & WiFi: Android tidak mengizinkan aplikasi pihak ketiga 
menghidupkan/mematikan WiFi atau data seluler secara programatik — ini kontrol sistem operasi 
sejak Android 10. Tombol WiFi & Data di header berfungsi sebagai shortcut yang membuka 
halaman Settings sistem; murid tetap menekan toggle secara manual di situ. Tap pada tombol ini 
SAAT ujian berlangsung memunculkan dialog peringatan eksplisit terlebih dahulu.
Indikator Kekuatan Sinyal WiFi: Android mewajibkan izin lokasi untuk membaca kekuatan sinyal 
WiFi (RSSI) sejak Android 8.1+, sebagai proteksi privasi. Keputusan: indikator WiFi hanya 2 status 
(terhubung/tidak terhubung, real-time), tanpa signal bar bertingkat, demi menghindari permintaan 
izin lokasi yang janggal untuk konteks aplikasi ujian.
38. Penambahan & Revisi UI/UX (Mobile)
Seluruh penambahan berikut bersifat kosmetik/UX dan TIDAK mengubah arsitektur keamanan 
maupun struktur data. Prinsip desain: clean, minim distraksi (selaras Bagian 12 — “One Question 
Per Screen”), dan tidak ada elemen yang memberi kesan pengawasan invasif (selaras Bagian 2 & 
33).
Header Status Bar (Login, Home, Schedule): jam digital real-time, indikator WiFi 2-state, tombol 
Data (shortcut Settings), dan tombol Refresh (KHUSUS tahap development, lihat Bagian 41).
Penyesuaian Konten — Selaras Filosofi Prevent (bukan Detect): teks “Screen sharing active · Proctor 
visibility: ON” pada Device Status Card (Home) diganti menjadi “Perangkat Terverifikasi”, karena teks lama 
mengindikasikan pengawasan real-time oleh manusia/AI yang TIDAK pernah benar-benar 
diimplementasikan — bertentangan dengan Bagian 2 & 33. Detail nama perangkat pada Login Screen 
turut disederhanakan, menyisakan indikator “Server Terhubung” yang relevan dengan kepastian timer 
server-side (Bagian 14).
Konten Dinamis: sapaan kontekstual berdasarkan jam (Login), ringkasan tanggal & status ujian 
(Home), pengelompokan jadwal “Hari Ini/Besok/Minggu Ini” (Schedule), serta progress bar 
“Terjawab X/Y” dengan transisi halus antar soal (Exam).
Identitas Visual: avatar inisial (2 huruf) dipertahankan sebagai representasi murid — BUKAN foto 
individual, demi menghindari beban storage/bandwidth untuk skala 900+ peserta dan mengurangi 
risiko privasi data foto siswa.
39. Skema Data Lokal Sementara (Pra-Integrasi Backend)
Selama backend Node.js (Bagian 27–31) belum terhubung penuh ke aplikasi Android, sejumlah 
state disimpan sementara di local storage perangkat (shared_preferences). Struktur tabel resmi 
pada Bagian 23–26 TIDAK BERUBAH — tabel berikut murni pemetaan sementara di sisi client 
sebelum API tersambung penuh.
Kunci Lokal (Client)
Fungsi Sementara
Pengganti di Production
completed_exam_ids
TIDAK LAGI disimpan di local storage 
(shared_preferences) sisi client. Status 
penyelesaian ujian wajib ditarik SECARA 
DINAMIS dan REAL-TIME setiap kali 
halaman Schedule dimuat, melalui query 
REST API Node.js ke tabel 
exam_attempts berdasarkan ID siswa 
yang sedang login (lihat Bagian 26, 27).
 Sudah Diadopsi — 
✔
Result API (GET 
exam_attempts 
berdasarkan user_id)
hero_exam_is_blokir
Status blokir aktif/tidak, persisten lintas 
restart app
Disimpan di 
exam_attempts/audit_logs 
sisi server
hero_exam_counter_pelang
garan
Counter pelanggaran — kini terikat per 
exam_attempt di server, lihat Pembaruan 
Status di bawah
audit_logs (Bagian 28)
hero_exam_last_active_date
Tanggal aktif terakhir, dipakai fitur Auto 
Logout Tengah Malam (Bagian 40)
Session API — validasi 
masa berlaku token di 
server
Pembaruan Status — Resolusi Counter Pelanggaran Global: dengan diintegrasikannya status 
penyelesaian ujian (completed_exam_ids) secara langsung ke Result API yang menarik data dari tabel 
exam_attempts (bukan lagi shared_preferences lokal sebagaimana disebutkan pada catatan kritis versi 
sebelumnya), permasalahan counter pelanggaran yang sebelumnya bersifat GLOBAL lintas mapel turut 
TERSELESAIKAN. Karena setiap exam_attempt tercatat sebagai baris independen pada database server 
beserta riwayat pelanggarannya masing-masing, counter pelanggaran kini secara inheren terikat per sesi 
ujian (per examId) di sisi server, bukan lagi nilai tunggal pada perangkat client. Risiko siswa 
terdiskualifikasi akibat akumulasi pelanggaran lintas mapel yang berbeda tidak lagi relevan pada arsitektur 
Result API ini.
40. Auto Logout Tengah Malam (Fitur Baru)
Murid otomatis logout dari aplikasi setiap pergantian hari (pukul 00:00), sehingga esok harinya wajib 
login ulang menggunakan Token Ruangan yang baru. Fitur ini menutup celah token ujian hari 
sebelumnya yang sudah kedaluwarsa tetap tersimpan di sesi lokal perangkat, selaras dengan 
Single Session Policy (Bagian 16) dan parameter Token pada Exam Management (Bagian 10).
Dua Mekanisme Deteksi Paralel: berjalan bersamaan untuk menutup celah masing-masing 
pendekatan.
Mekanisme
Cakupan
Timer presisi ke tengah malam berikutnya
Aktif selama aplikasi berjalan di foreground.
Pengecekan tanggal saat app di-resume
Menutup celah jika app sempat di-background/di-kill 
melewati tengah malam, lalu dibuka kembali esok 
harinya.
Pengamanan Terhadap Ujian yang Sedang Berlangsung: auto-logout TIDAK PERNAH memaksa 
keluar murid yang sedang mengerjakan ujian — ini akan bentrok langsung dengan screen pinning yang 
aktif (Bagian 36) dan berisiko meninggalkan layar dalam kondisi terkunci tanpa jalan keluar. Jika tengah 
malam lewat selagi ujian berlangsung, logout DITUNDA dan baru dieksekusi otomatis tepat setelah ujian 
disubmit/selesai.
Saat logout otomatis dieksekusi, status submit ujian dan riwayat pelanggaran (counter) TIDAK 
DIHAPUS — keduanya melekat pada riwayat exam_attempt yang sudah terjadi, bukan pada sesi 
login, dan harus tetap menjadi catatan historis terlepas dari logout/login ulang.
40.B. History Screen (Layar Riwayat Ujian)
Spesifikasi fungsional untuk satu layar baru pada aplikasi Flutter Hero Exam yang menampilkan 
riwayat permanen ujian yang telah disubmit oleh murid, sebagai konsekuensi langsung dari migrasi 
status penyelesaian ujian ke Result API (lihat Bagian 39).
Fungsi: menampilkan daftar SELURUH ujian yang telah disubmit oleh murid secara permanen, 
terlepas dari riwayat instalasi aplikasi pada perangkat yang sedang digunakan.
Sumber Data: layar ini WAJIB menembak REST API Node.js pada endpoint GET /api/v1/exam-
attempts/history, yang mengambil data dari tabel exam_attempts dengan kriteria filter status = 
'selesai' (lihat Bagian 26, 27).
Jaminan Sistem: data pada layar ini wajib tetap utuh dan sinkron meskipun murid melakukan 
uninstall aplikasi atau berganti perangkat, karena status mutlak bersumber dari database server, 
bukan dari local storage pada perangkat client (selaras dengan jaminan Resume System pada 
Bagian 17).
Spesifikasi UI Layout (Grouped History Cards): tampilan riwayat wajib dikelompokkan secara 
terstruktur menggunakan header/title penanda waktu berformat “Hari - Tanggal” (contoh: Selasa - 
17 Juni 2026). Di bawah setiap header tanggal, sistem wajib merender daftar card mata pelajaran 
yang berhasil disubmit dan terkirim ke database pada hari yang bersangkutan, mengikuti kaidah 
visual ExamCard yang telah ditetapkan pada Bagian 38.
41. Production Readiness Checklist
Status implementasi setiap item Addendum ini terhadap kesiapan rilis Production:
Item
Status
Screen Pinning + State-Based Guard
 Selesai, berjalan normal
✔
Deteksi Emulator (freeRASP)
 Berjalan, signingCertHashes 
⚠
masih placeholder — wajib diisi hash 
APK release sebelum Production
Deteksi Floating App (3 sinyal)
 Selesai, berjalan normal (lihat 
✔
batasan Bagian 37)
Sistem Akumulasi Pelanggaran & Auto-Submit
 Selesai, berjalan normal
✔
Auto Logout Tengah Malam
 Selesai, berjalan normal
✔
Counter Pelanggaran Per-Ujian (bukan global)
 Belum diperbaiki — WAJIB 
✘
sebelum Production
PIN Supervisor via Authentication API
 Masih hardcoded — wajib dipindah
✘
 
ke endpoint API
Tombol Refresh (bypass reset status)
 WAJIB DIHAPUS sebelum 
✘
Production
Migrasi DummyDataRepository ke REST API Node.js
 Belum dilakukan
✘
Filter Jadwal per classLabel Siswa
 Belum terhubung ke hasil validasi 
✘
login
Provisioning Device Owner/MDM (opsional, BYOD)
 Direkomendasikan dievaluasi 
⚠
untuk sekolah dengan kebutuhan 
keamanan lebih tinggi
42. Distribusi PIN Supervisor via WebSocket (Real-Time)
Temuan kritis: pada skenario ruangan ujian dengan kepadatan tinggi (contoh: Ruang 13 dengan 15 
dari sejumlah peserta terkena blokir PIN secara bersamaan), distribusi PIN Supervisor wajib 
memiliki mekanisme anti-tertukar yang tegas, serta wajib menggunakan arsitektur yang tidak 
membebani server Node.js dengan permintaan berulang (polling) dari puluhan laptop pengawas 
sekaligus.
Anti-Tertukar PIN — Pengikatan ke Identitas Siswa: PIN Supervisor TIDAK PERNAH 
ditampilkan sebagai angka tunggal generik di layar pengawas. Setiap PIN yang digenerate wajib 
dipasangkan secara eksplisit dengan identitas siswa pemiliknya, ditampilkan di Dashboard 
Pengawas (Bagian 20) dalam format tabel:
Nama Siswa
PIN Supervisor
Danang Prakoso
4452
Putri Amelia
7810
Validasi Kecocokan Sisi Server (Anti Salah Baca Pengawas): PIN bersifat unik per 
exam_attempt (bukan per ruangan atau per sesi ujian secara global), dan disimpan terikat ke baris 
exam_attempts milik siswa yang bersangkutan di database. Saat pengawas memasukkan PIN ke 
perangkat murid, backend Node.js WAJIB memvalidasi kecocokan PIN tersebut SPESIFIK terhadap 
exam_attempt_id murid yang sedang meminta verifikasi — BUKAN sekadar mencocokkan terhadap 
daftar PIN aktif di seluruh ruangan. Jika pengawas keliru membaca/memasukkan PIN milik siswa 
lain (mis. PIN milik Putri Amelia dimasukkan ke perangkat Danang Prakoso), server WAJIB 
menolak verifikasi tersebut meskipun PIN itu valid dan sedang aktif, karena tidak terikat pada 
exam_attempt_id yang benar. Ini mencegah skenario PIN tertukar antar dua siswa yang sama-
sama terblokir secara bersamaan.
Arsitektur Real-Time — WebSocket (Socket.io), Bukan Polling: untuk mencegah beban berlebih 
pada server Node.js (terutama pada skala 1.000–5.000+ peserta aktif bersamaan sesuai Bagian 3), 
distribusi PIN ke Dashboard Pengawas WAJIB menggunakan komunikasi event-driven dua arah 
berbasis WebSocket (library socket.io di atas Node.js), BUKAN mekanisme polling berkala 
(setInterval fetch tiap beberapa detik) dari sisi client.
Aspek
Ketentuan
Peran Laptop Pengawas
PASIF — hanya melakukan subscribe/listen pada event WebSocket khusus 
ruangannya (mis. room channel “room-13”). Tidak pernah melakukan 
permintaan (request) berulang ke server.
Pemicu Pengiriman Data
Server Node.js HANYA mengirimkan event PIN baru ke laptop pengawas 
PADA DETIK SAAT seorang murid di ruangan tersebut terblokir (trigger oleh 
endpoint Monitoring API saat status blokir tercatat) — bukan dikirim 
berkala/terus-menerus.
Pengelompokan Channel
Setiap ruangan ujian memiliki channel/room WebSocket terpisah (mis. 
dipetakan dari room_name pada Bagian 10), sehingga pengawas Ruang 13 
TIDAK menerima event dari Ruang 14 atau ruangan lain.
Payload Event
Berisi minimal: nama siswa, PIN Supervisor, exam_attempt_id, dan nama mata 
pelajaran — cukup untuk pengawas mencocokkan secara visual tanpa 
ambiguitas.
Pendekatan ini selaras dengan Monitoring Architecture (Bagian 32) yang sudah menetapkan 
heartbeat 30–60 detik untuk status Online/Offline/Submit — distribusi PIN Supervisor merupakan 
KANAL TERPISAH yang bersifat event-driven murni (zero-polling), bukan bagian dari siklus 
heartbeat berkala tersebut.
43. Validasi Izin Usage Access (Halaman Validasi Awal)
 
✔Status: Selesai Diimplementasikan — ValidationScreen (lihat detail di bawah)
Fitur deteksi floating app pihak ketiga melalui UsageStatsManager (Bagian 36) membutuhkan izin 
sistem PACKAGE_USAGE_STATS yang harus diaktifkan manual oleh murid. Bagian ini 
menetapkan alur Halaman Validasi Awal (sebelum ExamPlayerScreen) agar proses ini tidak 
membingungkan murid maupun keliru tercatat sebagai pelanggaran.
Implementasi: Halaman Validasi Awal direalisasikan sebagai SCREEN TERPISAH sungguhan 
(ValidationScreen) dalam navigasi aplikasi — BUKAN logic yang menyatu di dalam 
ExamPlayerScreen seperti pendekatan awal. Pemisahan penuh ini memberikan tiga manfaat teknis 
yang tidak tercapai pada pendekatan menyatu:
Aspek
Manfaat Pemisahan Screen
Asynchronous Delay
Layar putih kosong menjadi tirai penutup mutlak selama dialog konfirmasi 
sistem Android berlangsung — tidak ada kemungkinan murid mengintip soal di 
baliknya, karena ExamPlayerScreen belum pernah di-mount sama sekali pada 
titik ini.
Isolasi 
WidgetsBindingObserver
Observer fokus layar pada ExamPlayerScreen baru aktif SETELAH proses 
pinning selesai sepenuhnya — dialog konfirmasi sistem yang menggoyang 
fokus window TIDAK PERNAH berisiko disalahartikan sebagai floating app, 
karena tidak ada observer ujian yang mendengarkan sama sekali selama 
proses berlangsung di ValidationScreen.
Tempat Pengecekan 
Usage Access
Pengecekan izin sistem dilakukan sepenuhnya di ValidationScreen, sebelum 
ExamPlayerScreen dibuka — tidak mengotori lembar soal utama dengan logic 
permission yang hanya relevan sekali di awal sesi.
Alur Penerimaan (Accept): jika murid MENERIMA dialog konfirmasi penyematan layar (screen 
pinning), ValidationScreen melanjutkan navigasi ke ExamPlayerScreen menggunakan push() biasa 
(bukan pushReplacement), dengan hasil submit ujian dipropagasikan kembali secara utuh ke Home 
Screen begitu murid selesai — memastikan status "sudah disubmit" pada ExamCard selalu ter-
update dengan benar.
Alur Penolakan (Reject): jika murid MENOLAK dialog konfirmasi atau proses pinning melewati 
batas waktu 30 detik, ValidationScreen WAJIB mengeluarkan (kick) murid kembali ke Home Screen 
— BUKAN memblokir murid di dalam Halaman Validasi itu sendiri (selaras dengan alur Fase Start 
pada implementasi screen pinning, Bagian 36).
Ketentuan Krusial — Larangan Penambahan Counter Pelanggaran pada Percobaan Ulang: jika 
murid menolak penyematan layar pada percobaan pertama, lalu kembali membuka ujian yang sama dan 
MENERIMA pada percobaan kedua, sistem DILARANG KERAS menaikkan counterPelanggaran akibat 
penolakan di percobaan pertama tersebut. Counter WAJIB tetap bernilai 0 pada awal sesi ujian yang baru 
berhasil dimulai. Penolakan pada Halaman Validasi Awal (sebelum ujian benar-benar dimulai) secara 
konseptual BERBEDA dari pelanggaran screen pinning yang terjadi SETELAH ujian berlangsung (Bagian 
36) — keduanya tidak boleh berbagi mekanisme akumulasi counter yang sama.
44. Penanganan Race Condition pada Auto Save
Temuan kritis pada mekanisme Auto Save (Bagian 15): pada kondisi jaringan WiFi sekolah dengan 
latensi tinggi, murid yang menekan beberapa opsi jawaban secara cepat berurutan (mis. memilih 
opsi A, berpindah ke opsi B, lalu menekan Next dalam rentang waktu sangat singkat) berpotensi 
memicu beberapa permintaan HTTP POST yang saling mendahului (race condition). Akibatnya, 
permintaan yang dikirim lebih dulu (opsi A) berpotensi tiba di server SETELAH permintaan yang 
dikirim belakangan (opsi B), sehingga jawaban final yang tersimpan di database menjadi keliru 
karena urutan penulisan yang terbalik.
Mitigasi Sisi Client (Flutter): tombol opsi jawaban WAJIB diberi mekanisme debouncing — 
dinonaktifkan sementara (disabled) selama 300 milidetik setelah ditekan, sebelum dapat menerima 
input berikutnya. Ini memastikan permintaan auto-save sebelumnya memiliki cukup waktu untuk 
terkirim dan diterima server sebelum permintaan berikutnya dikirim, tanpa mengorbankan 
responsivitas yang dirasakan murid.
Mitigasi Sisi Backend (Node.js / Prisma ORM): endpoint penyimpanan jawaban WAJIB 
menggunakan transaksi database (Prisma Transaction) yang mengunci baris data (row-level 
locking) pada tabel answers, spesifik per kombinasi siswa dan soal yang sedang ditulis. Penguncian 
ini memastikan permintaan tulis yang tiba lebih belakangan secara waktu kirim TETAP diproses 
sesuai urutan kedatangan di server (server-side timestamp), bukan urutan keberangkatan dari client 
— sehingga jawaban final yang tersimpan selalu konsisten dengan interaksi TERAKHIR murid di 
perangkat, terlepas dari kondisi jaringan.
45. Isolasi Proses Parsing DOCX dari Event Loop Utama
Temuan kritis pada DOCX Import System (Bagian 7) dan Dashboard Guru (Bagian 21): proses 
pembacaan file biner .docx serta ekstraksi gambar di dalamnya (Import Flow, Bagian 8) merupakan 
operasi CPU-bound dengan beban memori dan komputasi tinggi. Pada skenario minggu ujian 
dengan 10–20 guru mengunggah bank soal secara bersamaan, eksekusi parser mammoth.js 
secara langsung pada Event Loop utama Node.js berisiko memblokir (block) seluruh proses 
request-response server — termasuk permintaan dari siswa yang sedang mengerjakan ujian secara 
bersamaan, berpotensi menyebabkan terputusnya koneksi siswa secara mendadak akibat server 
tidak merespons.
Solusi Wajib — Worker Threads: fungsi parser mammoth.js (dan docx4js sebagai alternatif) 
WAJIB dibungkus dan dieksekusi di dalam Worker Threads bawaan Node.js (modul 
worker_threads), bukan dijalankan langsung pada thread utama. Dengan demikian, proses 
ekstraksi dokumen yang berat — termasuk decoding gambar dan parsing struktur DOCX — 
berjalan pada thread terpisah, sehingga Event Loop utama tetap bebas melayani permintaan-
permintaan kritis dari siswa yang sedang ujian (auto-save jawaban, validasi token, heartbeat 
monitoring) tanpa jeda atau penundaan, terlepas dari berapa banyak proses impor DOCX yang 
berjalan bersamaan di latar belakang.
Ketentuan ini berlaku sebagai persyaratan WAJIB pada implementasi Import API (Bagian 27), dan 
menjadi prasyarat teknis sebelum fitur impor massal DOCX dapat dinyatakan siap Production pada 
skala peserta aktif bersamaan yang ditetapkan Bagian 3.
46. Token Sesi vs Token Ujian (Dua Entitas Terpisah)
Temuan implementasi: aplikasi Android sebelumnya hanya mengenal SATU jenis token (field 
"Token Ujian" pada Login Screen). Implementasi terbaru memisahkan konsep ini menjadi DUA 
entitas berbeda dengan fungsi, titik validasi, dan siklus hidup yang tidak sama. Bagian ini 
menetapkan kontrak resmi keduanya terhadap backend Node.js.
Aspek
Token Sesi (Login Screen)
Token Ujian (Popup, per-mapel)
Kapan diminta
SEKALI saat login, sebelum masuk 
AppShell (Home/Schedule/History)
BERULANG — setiap kali murid 
menekan "MULAI UJIAN" untuk mapel 
tertentu
Fungsi
Validasi identitas & perangkat awal 
murid
Validasi izin murid memulai SESI 
PENGERJAAN SOAL pada 
exam_attempt tertentu
Terikat ke
users / sessions (PRD Bagian 23)
exam_attempt_id spesifik — BUKAN 
sekadar daftar token aktif global (selaras 
prinsip anti-tertukar PIN pada Bagian 42)
Sumber generate
Backend Node.js, sesuai 
Authentication API (Bagian 27)
Backend Node.js via schema.prisma, 
model exam_tokens YANG SUDAH ADA 
(Bagian 23) — TIDAK MEMERLUKAN 
kolom database baru
Siklus hidup
Berlaku sepanjang sesi login 
berlangsung
Berlaku HANYA untuk satu kali 
pembukaan ExamPlayerScreen; token 
berbeda untuk mapel/sesi berikutnya
Ketentuan Penamaan — Wajib Dihindari Kerancuan Istilah: tim Backend dan Frontend Website WAJIB 
menggunakan istilah "Token Sesi" dan "Token Ujian" secara konsisten sesuai definisi pada tabel di atas, 
baik pada penamaan endpoint API, variabel kode, maupun salinan UI. Penggunaan istilah "Token" generik 
tanpa kualifikasi (Sesi/Ujian) TIDAK DIPERKENANKAN pada dokumentasi maupun kode baru, untuk 
mencegah kekeliruan implementasi lintas tim.
47. Performa & Skalabilitas Backend (Temuan Audit Teknis)
Bagian ini mencatat lima temuan audit teknis kritis terhadap implementasi awal backend Node.js, 
yang berdampak langsung pada stabilitas sistem di skala target 1.000–5.000+ peserta aktif 
bersamaan (PRD Bagian 3). Seluruh temuan WAJIB diperbaiki sebelum simulasi/ujian skala penuh 
dilakukan.
47.1 Prisma Client Instance Bloating (Kebocoran Connection Pool)
 
✘Risiko: Setiap file controller yang menulis new PrismaClient() sendiri-sendiri membuat 
connection pool baru per request — MySQL kehabisan slot koneksi ("Too many connections") saat 
ratusan siswa melakukan auto-save bersamaan.
Solusi Wajib: instance PrismaClient WAJIB bersifat Singleton. Satu file khusus 
(src/config/database.js) menginisialisasi PrismaClient SATU KALI, lalu instance tersebut di-export 
dan dipakai bersama (shared) di SELURUH controller — bukan membuat instance baru per file/per 
request.
47.2 N+1 Query Loop pada Endpoint “Mulai Ujian”
 
✘Risiko: Mengambil 40–50 soal sekaligus dengan query database DI DALAM perulangan 
(for/forEach) untuk mengecek relasi gambar satu per satu — CPU database melonjak hingga 100% 
saat 1.000 siswa membuka ujian bersamaan.
Solusi Wajib: gunakan fitur include (atau relasi join) bawaan Prisma untuk menarik data soal 
BESERTA relasi bank soal dan gambarnya dalam SATU kali query tunggal — bukan satu query per 
soal di dalam loop.
47.3 Skalabilitas Horizontal Socket.io (Memory Leak Lintas Server)
 
✘Risiko: Socket.io secara default menyimpan data room & state koneksi di memori lokal (RAM) 
satu proses Node.js. Jika backend dijalankan multi-instance (mis. PM2 cluster) untuk menampung 
beban hari-H, pengawas yang terhubung ke Server A TIDAK BISA melihat status siswa yang 
terhubung ke Server B.
Solusi Wajib: pasang Socket.io Redis Adapter SEJAK AWAL implementasi WebSocket (Bagian 42 
& 47 API Contract terkait) — Redis menjadi jembatan informasi lintas proses/server, sehingga event 
pin-generated dan student-status-changed tetap tersinkronisasi terlepas dari instance Node.js mana 
yang menerima koneksi WebSocket tertentu.
47.4 Payload Size Berlebih pada Gambar Soal
 
✘Risiko: Gambar hasil jepretan kamera HP (3–5MB) yang disisipkan guru ke dokumen Word, jika 
disimpan APA ADANYA, akan melumpuhkan bandwidth jaringan lokal sekolah saat 1.000 siswa 
membuka soal bergambar yang sama secara bersamaan.
Solusi Wajib: pada modul Import API (proses ekstraksi DOCX di dalam Worker Threads, Bagian 
45), WAJIB ditambahkan kompresi otomatis menggunakan library sharp. Setiap gambar yang 
diekstrak WAJIB di-resize ke lebar maksimal 800px dan dikonversi ke format .webp sebelum 
disimpan ke folder /uploads — dilakukan SEBELUM file disimpan ke disk, bukan saat diakses 
siswa.
47.5 Pembersihan Sesi Mati (Garbage Collector Sesi)
 
✘Risiko: Jika siswa menutup paksa aplikasi atau perangkat mati mendadak, status koneksi 
terakhirnya (PRD Bagian 32) bisa menggantung selamanya di database/memori jika tidak ada 
mekanisme pembersihan — data sampah ini menumpuk dan memperlambat pencarian data di 
Dashboard Pengawas (PRD Bagian 20).
Solusi Wajib: backend WAJIB menjalankan tugas terjadwal (cron job atau setInterval sederhana, 
berjalan setiap ± 2 menit) yang memindai tabel sesi aktif dan otomatis mengubah status siswa yang 
TIDAK mengirim heartbeat selama lebih dari 90 detik (ambang yang sudah ditetapkan PRD Bagian 
32) menjadi offline.
Catatan Cakupan: kelima temuan pada Bagian 47 ini murni bersifat backend/infrastruktur — TIDAK 
mengubah kontrak API (request/response/event WebSocket) yang sudah ditetapkan pada dokumen API 
Contract terpisah maupun Addendum Bagian 36–46. Aplikasi mobile (Flutter) TIDAK memerlukan 
perubahan apa pun akibat perbaikan-perbaikan ini.
Dokumen ini merupakan Addendum (Bagian 36–47) dari Hero_Exam_PRD_V3 (Node.js Backend 
Revision). Seluruh fitur, kebijakan keamanan, struktur data, dan filosofi produk pada Bagian 1–35 
TETAP BERLAKU PENUH dan TIDAK DIUBAH oleh penambahan ini.
