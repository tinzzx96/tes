# EXAM PONCOL - Frontend (Vanilla JS)

> Secure Examination System Frontend - Built with Vanilla JavaScript, Vite, and Tailwind CSS

## 📋 Project Structure

```
exam-poncol-frontend/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/            # Page components
│   ├── services/         # API & Auth services
│   ├── styles/           # CSS/Tailwind
│   ├── utils/            # Helper functions
│   ├── app.js            # App initialization
│   ├── router.js         # Routing logic
│   └── main.js           # Entry point
├── public/               # Static assets (logo, etc)
├── index.html            # HTML template
├── package.json          # Dependencies
├── vite.config.js        # Vite config
├── tailwind.config.js    # Tailwind config
└── README.md            # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Dev server akan berjalan di `https://localhost:5173`

## 🎨 Design System

Semua warna, font, dan spacing mengikuti `DESIGN_SYSTEM.md`:

- **Colors**: Dark background (#1C1C1C), Red accent (#CC0000)
- **Typography**: Barlow Condensed (heading), Inter (body)
- **Spacing**: 8px grid system

## 📱 Pages

✅ **Login Page** - NISN + Password + Token input (+ akses cepat staff)
✅ **Home Page** - Device status, Today's exams
✅ **Schedule Page** - Full exam schedule
✅ **Exam Player** - One question per screen, navigator tanpa nomor, timer server-side, auto-save, flag
✅ **Result Page** - Score display + detail pengerjaan
✅ **Teacher Dashboard** - Upload DOCX, Bank Soal, Buat Ujian, Hasil & Export
✅ **Admin Dashboard** - Kelola Guru, Siswa, Kelas, Mapel, Ujian, Tahun Ajaran
✅ **Proctor Dashboard** - Monitoring real-time, Generate Token, Reset Sesi, Tutup Ujian

## 🧭 Routes

| Path | Halaman | Role |
|------|---------|------|
| `/login` | Login | semua |
| `/home` | Home | Siswa |
| `/schedule` | Jadwal | Siswa |
| `/exam/:id` | Exam Player | Siswa |
| `/result/:id` | Hasil Ujian | Siswa |
| `/teacher` | Dashboard Guru | Guru |
| `/admin` | Dashboard Admin | Admin |
| `/proctor` | Dashboard Pengawas | Pengawas |

Dashboard staff menggunakan query string untuk tab, mis. `/teacher?tab=bank-soal`, `/admin?tab=guru`, `/proctor?tab=token`.

## 🔌 API Integration

API endpoints di `src/services/api.js`:

```javascript
// Example
api.getExams()           // GET /exams
api.getQuestion(id)      // GET /questions/:id
api.submitAnswer(id, data) // POST /answers
```

## 🌐 Environment Variables

Copy `.env.example` ke `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_SEB_MODE=false
```

## 📦 Dependencies

- **axios** - HTTP client
- **ua-parser-js** - Deteksi browser/OS/device dari `navigator.userAgent`, dipakai di Device Status (Home page)
- **vite** - Build tool
- **tailwindcss** - CSS framework

## 📡 Device Status & Connection (Home Page)

Card "DEVICE STATUS" di Home page (`src/pages/HomePage.js`) memakai `src/utils/userAgent.js`:

- `getDeviceInfo()` → baca `navigator.userAgent` via `ua-parser-js`, hasilnya ditampilkan sebagai "Detected: Chrome 125 · Windows 11".
- `getConnectionState()` / `subscribeConnectionState()` → pakai `navigator.onLine` (+ `navigator.connection` kalau browsernya support) untuk badge **Session** (Connecting → Active/Disconnected).
- Badge "Connecting..." muncul dulu lalu berubah otomatis setelah ~700ms (`HomePage.mounted()`), dan ikut berubah live kalau koneksi user putus/nyambung lagi.

**Batasan — ini murni deteksi sisi browser, BUKAN handshake ke server:**
- Tidak ada validasi token/session asli ke backend.
- "Network: LAN-EXAM-14" masih nilai statis/dari data user, bukan hasil deteksi (browser tidak bisa tahu nama LAN).
- Field `device` & `room` masih dari `authService` (mock), idealnya datang dari API exam session.

Saat backend siap, ganti `setTimeout` di `HomePage.mounted()` dengan call API verifikasi sesi (mis. `POST /session/verify`), dan biarkan `userAgent.js` tetap menangani bagian UA/koneksi browser saja.

## 🔒 Security (SEB Mode)

Untuk Secure Exam Browser:

```env
VITE_SEB_MODE=true
VITE_LOCK_WINDOW=true
```

Fitur:
- Disable right-click
- Disable escape key
- Prevent window resize (SEB only)
- Auto-save answers
- Timer sync dengan server

## 🛠 Development

### Component Structure

```javascript
// src/components/MyComponent.js
export function createMyComponent(options) {
    const el = createElement('div', 'className');
    el.innerHTML = `...`;
    return el;
}
```

### Page Structure

```javascript
// src/pages/MyPage.js
import { BasePage } from './BasePage.js';

export class MyPage extends BasePage {
    render() {
        // Return DOM element
        return this.container;
    }
    
    mounted() {
        // Lifecycle hook after mount
    }
}
```

## 🧪 Testing

```bash
# Test di browser biasa
npm run dev

# Test di SEB (setelah di-build)
npm run build
```

## 🚢 Deployment

### Apache

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### Nginx

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Vercel

```bash
vercel deploy
```

## 📝 License

Internal Use Only - SMK Poncol Jakarta

## 👤 Author

Dimas - Frontend Developer
