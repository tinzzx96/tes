import { BasePage } from './BasePage.js';
import { createElement } from '../utils/dom.js';
import { createInputField } from '../components/Input.js';
import { createButton } from '../components/Button.js';
import { createWarningBanner } from '../components/WarningBanner.js';
import { createGreeting } from '../components/Greeting.js';
import { authService } from '../services/auth.js';
import { getConnectionState } from '../utils/userAgent.js';

export class LoginPage extends BasePage {
    constructor() {
        super();
        this.setTitle('Login');
    }
    
    render() {
        this.container.className = 'min-h-screen bg-bg-primary flex flex-col items-center justify-center px-lg';
        this.container.setAttribute('data-page', 'login');

        // Real, live connection check — no device model/name shown here
        // per PRD Bagian 7: login only needs a simple "Server Terhubung"
        // signal, not device detail (that lives on the Home page).
        const { online } = getConnectionState();
        const connectedDotCls = online ? 'text-online' : 'text-primary';
        const connectedLabel = online ? 'Server Terhubung' : 'Tidak Terhubung';

        // Logo
        const logoContainer = createElement('div', 'mb-xxl flex flex-col items-center');
        logoContainer.innerHTML = `
            <img src="/logo-poncol.png" alt="Logo" class="h-32 w-32 mb-lg">
            <h1 class="font-barlow font-extrabold text-page-title text-text-primary mb-md text-center tracking-title">EXAM PONCOL</h1>
            <p class="font-inter text-subtitle text-text-secondary">Secure Examination System</p>
            <div class="flex items-center gap-sm text-text-secondary mt-md">
                <span class="material-icons text-sm ${connectedDotCls}">brightness_1</span>
                <span class="font-inter text-sm">${connectedLabel}</span>
            </div>
        `;
        this.container.appendChild(logoContainer);

        // Contextual greeting (Phase 3)
        const greeting = createGreeting({ className: 'mb-lg text-center' });
        this.container.appendChild(greeting);
        
        // Form container
        const formContainer = createElement('form', 'w-full max-w-md');
        formContainer.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // NISN Input
        const nisnField = createInputField({
            type: 'text',
            label: 'NISN',
            placeholder: 'Ketik NISN disini...',
        });
        formContainer.appendChild(nisnField.container);
        this.nisnInput = nisnField.input;
        
        // Password Input
        const passwordField = createInputField({
            type: 'password',
            label: 'PASSWORD',
            placeholder: 'Ketik Password disini...',
        });
        formContainer.appendChild(passwordField.container);
        this.passwordInput = passwordField.input;
        
        // Token Input
        const tokenField = createInputField({
            type: 'text',
            label: 'TOKEN SESI',
            placeholder: 'Ketik Token disini...',
        });
        formContainer.appendChild(tokenField.container);
        this.tokenInput = tokenField.input;
        
        // Submit Button
        const submitBtn = createButton('MASUK', {
            type: 'button',
            icon: 'lock',
            size: 'lg',
            onClick: (e) => this.handleSubmit(e),
        });
        formContainer.appendChild(submitBtn);
        
        this.container.appendChild(formContainer);
        
        // Warning Banner
        const warning = createWarningBanner(
            'Perangkat Anda akan diverifikasi sebelum ujian dimulai. Pastikan koneksi internet stabil selama sesi berlangsung.'
        );
        this.container.appendChild(warning);

        // Staff role quick access (Guru / Admin / Pengawas) — PRD section 5: multi-role system
        const staffAccess = createElement('div', 'w-full max-w-md mt-lg');
        staffAccess.innerHTML = `
            <div class="flex items-center gap-md mb-md">
                <div class="flex-1 border-t border-divider"></div>
                <span class="text-xs text-text-secondary font-inter uppercase tracking-label">Login Sebagai Staff</span>
                <div class="flex-1 border-t border-divider"></div>
            </div>
        `;
        const staffGrid = createElement('div', 'grid grid-cols-3 gap-sm');
        const staffRoles = [
            { role: 'guru', label: 'Guru', icon: 'school', path: '/teacher' },
            { role: 'admin', label: 'Admin', icon: 'admin_panel_settings', path: '/admin' },
            { role: 'pengawas', label: 'Pengawas', icon: 'visibility', path: '/proctor' },
        ];
        staffRoles.forEach(({ role, label, icon, path }) => {
            const btn = createElement('button', 'flex flex-col items-center gap-xs py-md rounded-input border border-divider text-text-secondary hover:border-accent-gold hover:text-accent-gold transition-colors font-inter text-xs');
            btn.innerHTML = `<span class="material-icons text-xl">${icon}</span>${label}`;
            btn.addEventListener('click', () => {
                authService.loginAs(role);
                window.app.router.navigate(path);
            });
            staffGrid.appendChild(btn);
        });
        staffAccess.appendChild(staffGrid);
        this.container.appendChild(staffAccess);

        // Footer
        const footer = createElement('div', 'mt-xl text-center text-caption text-text-secondary font-inter');
        footer.textContent = 'ExamApp v1.0.1 • SMK Poncol Jakarta';
        this.container.appendChild(footer);
        
        return this.container;
    }
    
    // src/pages/LoginPage.js — GANTI FUNGSI handleSubmit() SAJA
// ════════════════════════════════════════════════════════════════════════════
// Cari blok handleSubmit(e) di LoginPage.js dan GANTI seluruh isinya.
// Sisa file (render, constructor, dll) TIDAK DIUBAH.
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// PATCH: src/pages/LoginPage.js
// Ganti HANYA fungsi handleSubmit() — sisa file tidak diubah
// ════════════════════════════════════════════════════════════════════════════

    async handleSubmit(e) {
        e.preventDefault();

        const nisn     = this.nisnInput.value.trim();
        const password = this.passwordInput.value.trim();
        const token    = this.tokenInput.value.trim();

        if (!nisn || !password || !token) {
            showToast('Semua field harus diisi!', 'warning');
            return;
        }

        // Disable tombol saat loading
        const btn = this.container.querySelector('button');
        if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

        try {
            // Login real API — token = Token Sesi (bukan Token Ujian)
            await authService.login(nisn, password, token);

            // Redirect ke halaman sesuai role (admin→/admin, guru→/teacher, dst)
            window.app.router.navigate(authService.getHomePath());

        } catch (err) {
            showToast(err.message || 'Login gagal. Periksa NISN, password, dan Token Sesi.', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'MASUK'; }
        }
    }

// ── CATATAN ───────────────────────────────────────────────────────────────────
// Pastikan di render() ada input untuk Token Sesi (field ketiga).
// Field ini sudah ada di render() asli dengan label 'TOKEN UJIAN' —
// cukup ganti labelnya ke 'TOKEN SESI' agar tidak membingungkan siswa.
// Token Ujian yang sesungguhnya (per mapel) diminta di TokenPage.js / popup.
}
