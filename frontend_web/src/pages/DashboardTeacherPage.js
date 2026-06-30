// frontend_web/src/pages/DashboardTeacherPage.js
import { BasePage } from './BasePage.js';
import { createElement } from '../utils/dom.js';
import { createSidebar, createMobileTopBar } from '../components/Sidebar.js';
import { createStatCard } from '../components/StatCard.js';
import { createTable, statusPill } from '../components/Table.js';
import { createButton } from '../components/Button.js';
import { createModal } from '../components/Modal.js';
import { authService } from '../services/auth.js';
import { api } from '../services/api.js';

const MENU_ITEMS = [
    { id: 'overview',  icon: 'dashboard',   label: 'Overview',      path: '/teacher' },
    { id: 'bank-soal', icon: 'menu_book',   label: 'Bank Soal',     path: '/teacher?tab=bank-soal' },
    { id: 'ujian',     icon: 'fact_check',  label: 'Kelola Ujian',  path: '/teacher?tab=ujian' },
    { id: 'hasil',     icon: 'leaderboard', label: 'Hasil Ujian',   path: '/teacher?tab=hasil' },
];

export class DashboardTeacherPage extends BasePage {
    constructor() {
        super();
        this.setTitle('Dashboard Guru');
        this.activeTab = new URLSearchParams(window.location.search).get('tab') || 'overview';
        this._exams    = [];
        this._banks    = [];
        this._selectedExamId = null;
        this._socket   = null;
    }

    mounted() { this._connectSocket(); }

    beforeUnmount() {
        if (this._socket) { this._socket.disconnect(); this._socket = null; }
    }

    _connectSocket() {
        try {
            if (typeof io === 'undefined') return;
            const token   = authService.getToken();
            const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
            this._socket  = io(baseUrl, { auth: { token } });
            this._socket.on('teacher-refresh', () => this._renderTab());
        } catch (_) {}
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary flex';
        this.container.setAttribute('data-page', 'teacher-dashboard');
        this.container.appendChild(createSidebar(this.activeTab, MENU_ITEMS, 'Guru'));

        const main = createElement('div', 'flex-1 min-h-screen flex flex-col min-w-0 md:pl-56');
        main.appendChild(createMobileTopBar(this.activeTab, MENU_ITEMS, 'EXAM-PONCOL'));

        this.contentArea = createElement('div', 'flex-1 p-6 md:p-8 max-w-6xl');
        main.appendChild(this.contentArea);
        this.container.appendChild(main);

        this._renderTab();
        return this.container;
    }

    _renderTab() {
        this.contentArea.innerHTML = '';
        ({
            'bank-soal': () => this._tabBankSoal(),
            'ujian':     () => this._tabUjian(),
            'hasil':     () => this._tabHasil(),
        }[this.activeTab] || (() => this._tabOverview()))();
    }

    _header(title, subtitle, btnLabel, onBtn) {
        const h = createElement('div', 'flex flex-wrap items-start justify-between gap-4 mb-6');
        h.innerHTML = `
            <div>
                <h1 class="font-barlow font-extrabold text-2xl text-text-primary leading-none mb-1">${title}</h1>
                <p class="font-inter text-text-muted text-sm">${subtitle}</p>
            </div>
        `;
        if (btnLabel) {
            const btn = createButton(btnLabel, { size: 'sm', icon: 'add', className: 'w-auto flex-shrink-0', onClick: onBtn });
            h.appendChild(btn);
        }
        return h;
    }

    _loading() {
        const d = createElement('div', 'flex items-center gap-2 text-text-muted py-8');
        d.innerHTML = `<span class="material-icons animate-spin text-base">progress_activity</span>
                       <span class="font-inter text-sm">Memuat data...</span>`;
        return d;
    }

    _error(msg, retry) {
        const d = createElement('div', 'py-8 text-center');
        d.innerHTML = `<p class="text-primary font-inter text-sm mb-4">${msg}</p>`;
        d.appendChild(createButton('Coba Lagi', { size: 'sm', icon: 'refresh', className: 'w-auto mx-auto', onClick: retry }));
        return d;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── OVERVIEW ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    async _tabOverview() {
        const user = authService.getCurrentUser();
        const now  = new Date();
        const hour = now.getHours();
        const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';

        // Greeting header
        const topBar = createElement('div', 'flex items-center justify-between mb-6');
        topBar.innerHTML = `
            <div>
                <p class="font-inter text-text-muted text-sm mb-0.5">${greeting},</p>
                <h1 class="font-barlow font-extrabold text-2xl text-text-primary leading-none">${user?.name || 'Guru'}</h1>
            </div>
            <div class="text-right hidden sm:block">
                <div class="font-barlow font-bold text-text-primary text-sm">${now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
        `;
        this.contentArea.appendChild(topBar);

        const divider = createElement('div', 'mb-6');
        divider.style.cssText = 'border-top: 1px solid #2a2a2a;';
        this.contentArea.appendChild(divider);

        // Stat cards
        const statsGrid = createElement('div', 'grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6');
        this.contentArea.appendChild(statsGrid);

        // Placeholder
        for (let i = 0; i < 3; i++) {
            const ph = createElement('div', 'bg-bg-surface rounded-lg p-5 animate-pulse');
            ph.style.cssText = 'border: 1px solid #2e2e2e; height: 88px;';
            statsGrid.appendChild(ph);
        }

        // Upcoming exams section
        const examSection = createElement('div', 'bg-bg-surface rounded-lg p-5');
        examSection.style.cssText = 'border: 1px solid #2e2e2e;';
        examSection.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                    <span class="material-icons text-text-muted text-base">event</span>
                    <span class="font-inter font-semibold text-sm text-text-primary">Ujian Saya</span>
                </div>
                <button id="goto-ujian" class="font-inter text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1">
                    Lihat semua <span class="material-icons text-xs">chevron_right</span>
                </button>
            </div>
            <div id="exam-preview" class="flex flex-col gap-0">
                <div class="flex items-center gap-2 py-3 text-text-muted">
                    <span class="material-icons animate-spin text-sm">progress_activity</span>
                    <span class="font-inter text-xs">Memuat...</span>
                </div>
            </div>
        `;
        this.contentArea.appendChild(examSection);

        examSection.querySelector('#goto-ujian').onclick = () => {
            this.activeTab = 'ujian';
            window.history.pushState({}, '', '/teacher?tab=ujian');
            this.contentArea.innerHTML = '';
            this._renderTab();
        };

        try {
            const [examsRes, banksRes] = await Promise.all([
                api.get('/teacher/exams'),
                api.get('/admin/question-banks'),
            ]);
            this._exams = examsRes.data?.data ?? [];
            this._banks = banksRes.data?.data ?? [];

            const aktif    = this._exams.filter(e => e.status === 'active');
            const totalPes = this._exams.reduce((s, e) => s + (e._count?.attempts ?? 0), 0);

            statsGrid.innerHTML = '';
            statsGrid.appendChild(createStatCard({ icon: 'menu_book',  label: 'Bank Soal',     value: this._banks.length,  sub: 'dimiliki',       accent: 'gold' }));
            statsGrid.appendChild(createStatCard({ icon: 'play_circle',label: 'Ujian Aktif',   value: aktif.length,         sub: 'berlangsung',    accent: 'online' }));
            statsGrid.appendChild(createStatCard({ icon: 'groups',     label: 'Total Peserta', value: totalPes,             sub: 'semua ujian',    accent: 'primary' }));

            // Exam preview
            const preview = examSection.querySelector('#exam-preview');
            const recent = this._exams.slice(0, 5);
            if (recent.length === 0) {
                preview.innerHTML = `<p class="font-inter text-xs text-text-muted py-4 text-center">Belum ada ujian yang ditugaskan.</p>`;
            } else {
                preview.innerHTML = '';
                recent.forEach((exam, idx) => {
                    const isLast = idx === recent.length - 1;
                    const statusColor = exam.status === 'active' ? 'text-online' : exam.status === 'completed' ? 'text-text-muted' : 'text-accent-gold';
                    const row = createElement('div', `flex items-center justify-between py-3 ${!isLast ? '' : ''}`);
                    if (!isLast) row.style.cssText = 'border-bottom: 1px solid #262626;';
                    row.innerHTML = `
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${exam.status === 'active' ? 'bg-online' : exam.status === 'completed' ? 'bg-text-muted' : 'bg-accent-gold'}"></div>
                            <div class="min-w-0">
                                <div class="font-inter text-sm font-medium text-text-primary truncate">${exam.title}</div>
                                <div class="font-inter text-xs text-text-muted">${exam.subject} · ${exam._count?.attempts ?? 0} peserta</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0 ml-4">
                            <span class="font-mono text-xs font-bold text-accent-gold">${exam.token}</span>
                            <span class="font-inter text-xs ${statusColor} font-medium capitalize">${exam.status}</span>
                        </div>
                    `;
                    preview.appendChild(row);
                });
            }
        } catch (_) {
            statsGrid.innerHTML = `<p class="font-inter text-text-muted text-xs col-span-3">Gagal memuat statistik.</p>`;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── BANK SOAL ────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    async _tabBankSoal() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('Bank Soal', 'Kelola kumpulan soal per mata pelajaran.', 'Upload DOCX', () => this._modalUploadDocx()));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());
        try {
            const res = await api.get('/admin/question-banks');
            this._banks = res.data?.data ?? [];
            wrap.innerHTML = '';
            const cols = [
                { key: 'name',    label: 'Nama Bank Soal' },
                { key: 'subject', label: 'Mata Pelajaran' },
                { key: '_count',  label: 'Soal', render: r => r._count?.questions ?? 0 },
                { key: 'actions', label: '', render: r => `
                    <div class="flex gap-2" data-bid="${r.id}">
                        <button class="b-view material-icons text-text-muted hover:text-online text-lg" title="Lihat Soal">visibility</button>
                        <button class="b-upload material-icons text-text-muted hover:text-accent-gold text-lg" title="Upload Soal">upload_file</button>
                        <button class="b-del material-icons text-text-muted hover:text-primary text-lg" title="Hapus">delete</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, this._banks));
            wrap.querySelectorAll('[data-bid]').forEach(el => {
                const b = this._banks.find(x => x.id === Number(el.dataset.bid));
                el.querySelector('.b-view').onclick   = () => this._modalLihatSoal(b);
                el.querySelector('.b-upload').onclick = () => this._modalUploadDocx(b);
                el.querySelector('.b-del').onclick    = () => this._confirmHapusBank(b);
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat bank soal.', () => this._renderTab()));
        }
    }

    _modalUploadDocx(bank = null) {
        createModal({
            title: bank ? `Upload Soal ke: ${bank.name}` : 'Upload Bank Soal (DOCX)',
            bodyHtml: `
                <div class="space-y-4">
                    ${!bank ? `
                    <div>
                        <label class="block font-inter text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Nama Bank Soal Baru</label>
                        <input type="text" id="doc-bank-name" placeholder="Misal: Ujian Harian Matematika" class="w-full bg-bg-primary border border-divider rounded p-2.5 font-inter text-sm text-text-primary focus:border-primary outline-none mb-3">
                    </div>
                    <div>
                        <label class="block font-inter text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Mata Pelajaran</label>
                        <input type="text" id="doc-bank-subject" placeholder="Misal: Matematika" class="w-full bg-bg-primary border border-divider rounded p-2.5 font-inter text-sm text-text-primary focus:border-primary outline-none">
                    </div>` : ''}
                    <div>
                        <label class="block font-inter text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">File DOCX</label>
                        <input type="file" id="doc-file" accept=".docx" class="w-full font-inter text-sm text-text-primary bg-bg-primary border border-divider rounded p-2 file:bg-primary file:text-white file:border-0 file:rounded file:px-3 file:py-1 file:text-xs file:font-bold file:mr-3 file:cursor-pointer">
                        <p class="font-inter text-xs text-text-muted mt-2">Format: soal PG atau essay dalam template Word standar.</p>
                    </div>
                    <div id="doc-progress" class="hidden">
                        <div class="flex items-center gap-2 text-text-muted">
                            <span class="material-icons animate-spin text-sm">progress_activity</span>
                            <span class="font-inter text-xs">Mengupload dan memproses...</span>
                        </div>
                    </div>
                    <div id="doc-err" class="hidden font-inter text-xs text-primary bg-primary bg-opacity-10 rounded p-2"></div>
                </div>
            `,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Upload', variant: 'primary', onClick: async (close, bodyEl) => {
                    const file   = bodyEl.querySelector('#doc-file').files[0];
                    const errEl  = bodyEl.querySelector('#doc-err');
                    const prog   = bodyEl.querySelector('#doc-progress');
                    const show   = msg => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
                    
                    if (!file) return show('Pilih file DOCX.');
                    
                    let bankId = bank?.id;
                    
                    prog.classList.remove('hidden');
                    errEl.classList.add('hidden');
                    
                    try {
                        if (!bankId) {
                            const name = bodyEl.querySelector('#doc-bank-name')?.value?.trim();
                            const subject = bodyEl.querySelector('#doc-bank-subject')?.value?.trim();
                            
                            if (!name) {
                                prog.classList.add('hidden');
                                return show('Nama bank soal wajib diisi.');
                            }
                            if (!subject) {
                                prog.classList.add('hidden');
                                return show('Mata pelajaran wajib diisi.');
                            }
                            
                            const newBankRes = await api.post('/admin/question-banks', { name, subject });
                            bankId = newBankRes.data?.data?.id;
                            
                            if (!bankId) {
                                throw new Error('Gagal membuat bank soal baru.');
                            }
                        }
                        
                        const form = new FormData();
                        form.append('file', file);
                        
                        await api.post(`/admin/question-banks/${bankId}/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
                        close();
                        this._renderTab();
                    } catch (e) {
                        prog.classList.add('hidden');
                        show(e.response?.data?.message || e.message || 'Gagal memproses.');
                    }
                }},
            ],
        });
    }

    async _modalLihatSoal(bank) {
        const modal = createModal({
            title: `Soal: ${bank.name}`,
            bodyHtml: `<div id="soal-wrap" class="space-y-3 font-inter text-sm text-text-secondary">
                <div class="flex items-center gap-2 text-text-muted">
                    <span class="material-icons animate-spin text-sm">progress_activity</span>
                    <span class="text-xs">Memuat soal...</span>
                </div>
            </div>`,
            footerButtons: [
                { text: 'Tutup', variant: 'secondary', onClick: close => close() },
            ],
        });
        try {
            const res = await api.get(`/admin/question-banks/${bank.id}/questions`);
            const questions = res.data?.data ?? [];
            const wrap = modal.body.querySelector('#soal-wrap');
            if (questions.length === 0) {
                wrap.innerHTML = `<p class="text-text-muted text-xs text-center py-4">Belum ada soal.</p>`;
                return;
            }
            
            const renderOptionBody = (body, baseUrl) => {
                if (!body) return '';
                if (body.includes('[IMAGE:')) {
                    const match = body.match(/\[IMAGE:(.+?)\]/);
                    if (match) {
                        const filename = match[1];
                        const text = body.replace(/\[IMAGE:.+?\]/g, '').trim();
                        const imageUrl = `${baseUrl}/uploads/questions/${filename}`;
                        return `
                            ${text ? `<span>${text}</span><br/>` : ''}
                            <div class="mt-1 max-w-xs"><img src="${imageUrl}" alt="Gambar opsi" class="rounded max-h-32 object-contain bg-white p-1 border border-divider"></div>
                        `;
                    }
                }
                return body;
            };

            wrap.innerHTML = questions.map((q, i) => {
                const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
                const imageUrl = q.questionImage ? `${baseUrl}/uploads/questions/${q.questionImage}` : null;
                return `
                <div class="py-3 ${i < questions.length - 1 ? 'border-b border-divider' : ''}">
                    <p class="font-medium text-text-primary text-sm mb-2">${i + 1}. ${q.body}</p>
                    ${imageUrl ? `<div class="mb-3 max-w-md"><img src="${imageUrl}" alt="Gambar soal" class="rounded max-h-48 object-contain bg-white p-1 border border-divider"></div>` : ''}
                    ${q.options?.map((o, j) => `
                        <p class="text-xs pl-4 mb-1 ${o.isCorrect ? 'text-online font-bold' : 'text-text-muted'}">
                            ${String.fromCharCode(65 + j)}. ${renderOptionBody(o.body, baseUrl)}${o.isCorrect ? ' ✓' : ''}
                        </p>`).join('') || ''}
                </div>`;
            }).join('');
        } catch (_) {
            const wrap = modal.body.querySelector('#soal-wrap');
            if (wrap) wrap.textContent = 'Gagal memuat soal.';
        }
    }

    _confirmHapusBank(bank) {
        createModal({
            title: 'Hapus Bank Soal',
            bodyHtml: `<p class="font-inter text-sm text-text-primary">Hapus <strong>${bank.name}</strong> beserta semua soal di dalamnya? Tindakan ini tidak dapat dibatalkan.</p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Hapus', variant: 'primary', onClick: async (close) => {
                    try { await api.delete(`/admin/question-banks/${bank.id}`); close(); this._renderTab(); }
                    catch (_) { close(); }
                }},
            ],
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── UJIAN ────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    async _tabUjian() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('Kelola Ujian', 'Daftar ujian yang ditugaskan kepada kamu.'));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());
        try {
            const res = await api.get('/teacher/exams');
            this._exams = res.data?.data ?? [];
            wrap.innerHTML = '';
            if (this._exams.length === 0) {
                wrap.innerHTML = `<div class="py-12 text-center">
                    <span class="material-icons text-text-muted text-3xl block mb-3">fact_check</span>
                    <p class="font-inter text-sm text-text-muted">Belum ada ujian yang ditugaskan. Hubungi Admin untuk membuat ujian.</p>
                </div>`;
                return;
            }
            const cols = [
                { key: 'title',          label: 'Nama Ujian' },
                { key: 'subject',        label: 'Mapel' },
                { key: 'durationMinutes',label: 'Durasi', render: r => `${r.durationMinutes} mnt` },
                { key: '_count',         label: 'Peserta', render: r => r._count?.attempts ?? 0 },
                { key: 'token',          label: 'Token', render: r => `<span class="font-mono font-bold text-accent-gold">${r.token}</span>` },
                { key: 'status',         label: 'Status', render: r => statusPill(r.status) },
            ];
            wrap.appendChild(createTable(cols, this._exams));
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat ujian.', () => this._renderTab()));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── HASIL UJIAN ──────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    async _tabHasil() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('Hasil Ujian', 'Rekap nilai dan detail pengerjaan per ujian.'));

        // Exam selector & Export wrap
        const selectorWrap = createElement('div', 'flex flex-wrap items-end justify-between gap-4 mb-6');
        selectorWrap.innerHTML = `
            <div class="flex-1 min-w-[260px] max-w-md">
                <label class="block font-inter text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Pilih Ujian</label>
                <select id="hasil-exam-select" class="w-full bg-bg-surface border border-divider rounded p-2.5 font-inter text-sm text-text-primary focus:border-primary outline-none">
                    <option value="">Memuat ujian...</option>
                </select>
            </div>
            <div id="export-area" class="hidden">
                <button id="export-csv-btn" class="flex items-center gap-1.5 px-4 py-2.5 rounded font-inter text-sm font-semibold text-text-primary bg-bg-surface border border-divider hover:bg-bg-primary hover:border-text-muted transition-all">
                    <span class="material-icons text-sm text-accent-gold">download</span>
                    Ekspor Excel / CSV
                </button>
            </div>
        `;
        this.contentArea.appendChild(selectorWrap);

        const tableArea = createElement('div', '');
        this.contentArea.appendChild(tableArea);
        tableArea.appendChild(this._loading());

        const loadResults = async (examId) => {
            tableArea.innerHTML = '';
            const exportArea = selectorWrap.querySelector('#export-area');
            if (exportArea) exportArea.classList.add('hidden');

            if (!examId) { tableArea.innerHTML = `<p class="font-inter text-xs text-text-muted py-4">Pilih ujian untuk melihat hasil.</p>`; return; }
            tableArea.appendChild(this._loading());
            try {
                const res = await api.get(`/teacher/exams/${examId}/results`);
                const d = res.data?.data ?? {};
                const results = d.results ?? [];
                const summary = d.summary ?? {};
                tableArea.innerHTML = '';
                
                if (results.length === 0) {
                    tableArea.innerHTML = `<p class="font-inter text-xs text-text-muted py-4 text-center">Belum ada siswa yang mengumpulkan.</p>`;
                    return;
                }

                // Show export button and bind event handler
                if (exportArea) {
                    exportArea.classList.remove('hidden');
                    const exportBtn = exportArea.querySelector('#export-csv-btn');
                    exportBtn.onclick = async () => {
                        const origText = exportBtn.innerHTML;
                        exportBtn.disabled = true;
                        exportBtn.innerHTML = `<span class="material-icons text-sm animate-spin">progress_activity</span> Mengunduh...`;
                        try {
                            const response = await api.get(`/teacher/exams/${examId}/results/export`, { responseType: 'blob' });
                            const blob = new Blob([response.data], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `hasil_ujian_${examId}.csv`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                        } catch (err) {
                            alert('Gagal mengunduh file CSV.');
                        } finally {
                            exportBtn.disabled = false;
                            exportBtn.innerHTML = origText;
                        }
                    };
                }

                // Render stats cards
                const statsRow = createElement('div', 'grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6');
                statsRow.appendChild(createStatCard({ icon: 'groups', label: 'Total Peserta', value: summary.totalParticipants ?? 0, sub: 'siswa', accent: 'primary' }));
                statsRow.appendChild(createStatCard({ icon: 'trending_up', label: 'Rata-Rata Nilai', value: summary.averageScore ?? 0, sub: 'skor rata-rata', accent: 'online' }));
                statsRow.appendChild(createStatCard({ icon: 'workspace_premium', label: 'Nilai Tertinggi', value: summary.highestScore ?? 0, sub: 'skor tertinggi', accent: 'gold' }));
                statsRow.appendChild(createStatCard({ icon: 'trending_down', label: 'Nilai Terendah', value: summary.lowestScore ?? 0, sub: 'skor terendah', accent: 'primary' }));
                tableArea.appendChild(statsRow);

                const cols = [
                    { key: 'name',               label: 'Nama Siswa', render: r => r.name ?? '-' },
                    { key: 'class',             label: 'Kelas', render: r => r.class ?? '-' },
                    { key: 'score',             label: 'Nilai', render: r => r.score != null
                        ? `<span class="font-barlow font-bold text-lg ${r.score >= 75 ? 'text-online' : 'text-primary'}">${r.score}</span>`
                        : `<span class="text-text-muted">-</span>` },
                    { key: 'status',            label: 'Status', render: r => statusPill(r.status || 'submitted') },
                    { key: 'counterPelanggaran',label: 'Pelanggaran', render: r => r.counterPelanggaran > 0
                        ? `<span class="text-primary font-bold">${r.counterPelanggaran}x</span>`
                        : `<span class="text-text-muted">0</span>` },
                ];
                tableArea.appendChild(createTable(cols, results));
            } catch (_) {
                tableArea.innerHTML = '';
                tableArea.appendChild(this._error('Gagal memuat hasil.', () => loadResults(examId)));
            }
        };

        try {
            const res = await api.get('/teacher/exams');
            const exams = res.data?.data ?? [];
            const sel   = selectorWrap.querySelector('#hasil-exam-select');
            sel.innerHTML = `<option value="">-- Pilih Ujian --</option>${exams.map(e => `<option value="${e.id}">${e.title} (${e.subject})</option>`).join('')}`;
            sel.onchange = () => { this._selectedExamId = Number(sel.value) || null; loadResults(this._selectedExamId); };
            // auto select first exam that has attempts
            const first = exams.find(e => (e._count?.attempts ?? 0) > 0) || exams[0];
            if (first) { sel.value = first.id; this._selectedExamId = first.id; loadResults(first.id); }
            else tableArea.innerHTML = '';
        } catch (_) {
            tableArea.innerHTML = '';
            tableArea.appendChild(this._error('Gagal memuat data ujian.', () => this._renderTab()));
        }
    }
}