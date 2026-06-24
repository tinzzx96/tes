// src/pages/TokenPage.js — GANTI SELURUH FILE INI
// ════════════════════════════════════════════════════════════════════════════
// HERO EXAM Web — Token Ujian Page (integrasi real API)
// Flow:
//   1. Siswa klik "MULAI UJIAN" di HomePage → examId disimpan di sessionStorage
//   2. Navigasi ke /token
//   3. Siswa input Token Ujian (per mapel, dari pengawas)
//   4. Validasi ke POST /api/exam-tokens/validate
//   5. examAttemptId tersimpan di sessionStorage
//   6. Navigasi ke /exam/:examId
// ════════════════════════════════════════════════════════════════════════════

import { BasePage } from './BasePage.js';
import { createElement } from '../utils/dom.js';
import { createInputField } from '../components/Input.js';
import { createButton } from '../components/Button.js';
import { authService } from '../services/auth.js';

export class TokenPage extends BasePage {
    constructor() {
        super();
        this.setTitle('Token Ujian');
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary flex flex-col items-center justify-center px-lg';
        this.container.setAttribute('data-page', 'token');

        const content = createElement('div', 'w-full max-w-md');

        const title = createElement('h1', 'font-barlow font-extrabold text-page-title text-text-primary mb-sm text-center');
        title.textContent = 'Token Ujian';
        content.appendChild(title);

        const subtitle = createElement('p', 'font-inter text-sm text-text-secondary text-center mb-xl');
        subtitle.textContent = 'Masukkan token yang diberikan pengawas untuk memulai ujian.';
        content.appendChild(subtitle);

        // Error message area
        this.errorEl = createElement('div', 'hidden mb-md p-md rounded-input bg-primary bg-opacity-10 border border-primary text-primary font-inter text-sm text-center');
        content.appendChild(this.errorEl);

        const tokenField = createInputField({
            type: 'text',
            label: 'TOKEN UJIAN',
            placeholder: 'Contoh: MATH99',
        });
        content.appendChild(tokenField.container);
        this.tokenInput = tokenField.input;
        // Auto-uppercase saat diketik
        this.tokenInput.addEventListener('input', () => {
            const pos = this.tokenInput.selectionStart;
            this.tokenInput.value = this.tokenInput.value.toUpperCase();
            this.tokenInput.setSelectionRange(pos, pos);
        });

        this.submitBtn = createButton('LANJUTKAN', {
            type: 'button',
            size: 'lg',
            icon: 'arrow_forward',
            onClick: (e) => this.handleSubmit(e),
        });
        content.appendChild(this.submitBtn);

        // Tombol kembali
        const backBtn = createElement('button', 'mt-md w-full text-center font-inter text-sm text-text-secondary hover:text-text-primary transition-colors');
        backBtn.textContent = '← Kembali';
        backBtn.addEventListener('click', () => window.app.router.navigate('/home'));
        content.appendChild(backBtn);

        this.container.appendChild(content);
        return this.container;
    }

    async handleSubmit(e) {
        e.preventDefault();
        const token = this.tokenInput.value.trim().toUpperCase();

        if (!token) {
            this._showError('Token harus diisi!');
            return;
        }

        // Ambil examId yang disimpan saat klik "MULAI UJIAN" di HomePage
        const examId = sessionStorage.getItem('current_exam_id');
        if (!examId) {
            this._showError('Sesi tidak valid. Kembali ke halaman utama.');
            return;
        }

        this._setLoading(true);
        this._hideError();

        try {
            // Validasi token ke server — simpan examAttemptId otomatis di authService
            const result = await authService.validateExamToken(Number(examId), token);

            if (result.valid) {
                // Navigasi ke ExamPlayerPage dengan examId
                window.app.router.navigate(`/exam/${examId}`);
            }
        } catch (err) {
            this._showError(err.message || 'Token tidak valid. Coba lagi.');
        } finally {
            this._setLoading(false);
        }
    }

    _showError(msg) {
        if (!this.errorEl) return;
        this.errorEl.textContent = msg;
        this.errorEl.classList.remove('hidden');
    }

    _hideError() {
        if (!this.errorEl) return;
        this.errorEl.classList.add('hidden');
    }

    _setLoading(loading) {
        if (!this.submitBtn) return;
        this.submitBtn.disabled = loading;
        this.submitBtn.textContent = loading ? 'Memvalidasi...' : 'LANJUTKAN';
    }
}