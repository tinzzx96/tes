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
    { id: 'overview',   icon: 'dashboard',   label: 'Overview',      path: '/teacher' },
    { id: 'bank-soal',  icon: 'menu_book',   label: 'Bank Soal',     path: '/teacher?tab=bank-soal' },
    { id: 'ujian',      icon: 'fact_check',  label: 'Kelola Ujian',  path: '/teacher?tab=ujian' },
    { id: 'hasil',      icon: 'leaderboard', label: 'Hasil Ujian',   path: '/teacher?tab=hasil' },
];

export class DashboardTeacherPage extends BasePage {
    constructor() {
        super();
        this.setTitle('Dashboard Guru');
        this.activeTab = new URLSearchParams(window.location.search).get('tab') || 'overview';
        this._exams = [];
        this._banks = [];
        this._selectedExamId = null;
        this._socket = null;
    }

    mounted() {
        this._connectSocket();
    }

    beforeUnmount() {
        if (this._socket) {
            this._socket.disconnect();
            this._socket = null;
        }
    }

    _connectSocket() {
        try {
            if (typeof io === 'undefined') return;
            const token = authService.getToken();
            const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
            this._socket = io(BASE_URL, { auth: { token } });

            this._socket.emit('join-room', { roomName: 'admin' });

            this._socket.on('exam-status-changed', () => {
                this._renderTab();
            });

            this._socket.on('student-status-changed', () => {
                if (this.activeTab === 'hasil') {
                    this._renderTab();
                }
            });
        } catch (_) {
            // Silently fail
        }
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary flex';
        this.container.setAttribute('data-page', 'teacher-dashboard');
        this.container.appendChild(createSidebar(this.activeTab, MENU_ITEMS, 'GURU'));

        const main = createElement('div', 'flex-1 min-h-screen flex flex-col');
        main.appendChild(createMobileTopBar('EXAM-PONCOL', MENU_ITEMS, this.activeTab));
        this.contentArea = createElement('div', 'flex-1 px-lg md:px-xl py-lg md:py-xl');
        main.appendChild(this.contentArea);
        this.container.appendChild(main);

        this._renderTab();
        return this.container;
    }

    _renderTab() {
        this.contentArea.innerHTML = '';
        const map = {
            'bank-soal': () => this._tabBankSoal(),
            ujian:       () => this._tabUjian(),
            hasil:       () => this._tabHasil(),
        };
        (map[this.activeTab] || (() => this._tabOverview()))();
    }

    _header(title, subtitle) {
        const h = createElement('div', 'mb-xl');
        h.innerHTML = `<h1 class="font-barlow font-extrabold text-page-title text-text-primary mb-xs">${title}</h1>
                       <p class="font-inter text-text-secondary text-sm">${subtitle}</p>`;
        return h;
    }

    _loading() {
        const d = createElement('div', 'flex items-center gap-sm text-text-secondary py-xl');
        d.innerHTML = `<span class="material-icons animate-spin text-lg">progress_activity</span>
                       <span class="font-inter text-sm">Memuat data...</span>`;
        return d;
    }

    _error(msg, retry) {
        const d = createElement('div', 'py-xl text-center');
        d.innerHTML = `<p class="text-primary font-inter text-sm mb-md">${msg}</p>`;
        d.appendChild(createButton('Coba Lagi', { size: 'sm', icon: 'refresh', className: 'w-auto mx-auto', onClick: retry }));
        return d;
    }

    // ── Overview ───────────────────────────────────────────────────────────────
    async _tabOverview() {
        this.contentArea.innerHTML = '';
        const user = authService.getCurrentUser();
        this.contentArea.appendChild(this._header('OVERVIEW', `Selamat datang, ${user?.name || 'Guru'}`));

        const grid = createElement('div', 'grid grid-cols-1 sm:grid-cols-3 gap-md mb-xl');
        this.contentArea.appendChild(grid);

        try {
            const [examsRes, banksRes] = await Promise.all([
                api.get('/teacher/exams'),
                api.get('/admin/question-banks'),
            ]);
            this._exams = examsRes.data?.data ?? [];
            this._banks = banksRes.data?.data ?? [];

            grid.appendChild(createStatCard({ icon: 'menu_book',   label: 'Bank Soal',    value: this._banks.length,                                      accent: 'gold' }));
            grid.appendChild(createStatCard({ icon: 'fact_check',  label: 'Ujian Aktif',  value: this._exams.filter(e => e.status === 'active').length,   accent: 'online' }));
            grid.appendChild(createStatCard({ icon: 'groups',      label: 'Total Peserta',value: this._exams.reduce((s, e) => s + (e._count?.attempts ?? 0), 0), accent: 'primary' }));
        } catch (_) {
            grid.innerHTML = `<p class="text-text-muted font-inter text-sm col-span-3">Gagal memuat statistik.</p>`;
        }

        const shortcuts = createElement('div', 'grid grid-cols-1 md:grid-cols-3 gap-md');
        [
            { icon: 'menu_book',   label: 'Bank Soal',   desc: 'Kelola & upload soal DOCX', tab: 'bank-soal' },
            { icon: 'fact_check',  label: 'Kelola Ujian',desc: 'Atur ujian kamu',            tab: 'ujian' },
            { icon: 'leaderboard', label: 'Lihat Hasil', desc: 'Nilai & rekap peserta',      tab: 'hasil' },
        ].forEach(a => {
            const c = createElement('div', 'bg-bg-surface-light rounded-card p-lg cursor-pointer hover:opacity-90 transition-opacity');
            c.innerHTML = `<span class="material-icons text-primary text-3xl mb-md">${a.icon}</span>
                           <h3 class="font-inter font-bold text-card-title text-text-dark mb-xs">${a.label}</h3>
                           <p class="text-sm text-text-muted font-inter">${a.desc}</p>`;
            c.onclick = () => window.app.router.navigate(`/teacher?tab=${a.tab}`);
            shortcuts.appendChild(c);
        });
        this.contentArea.appendChild(shortcuts);
    }

    // ── Bank Soal ──────────────────────────────────────────────────────────────
    async _tabBankSoal() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('BANK SOAL', 'Kelola bank soal: buat bank, tambah soal, upload DOCX.'));

        const actionRow = createElement('div', 'flex flex-wrap gap-md mb-lg');
        actionRow.appendChild(createButton('BUAT BANK SOAL', {
            size: 'sm', icon: 'add_circle', className: 'w-auto',
            onClick: () => this._modalBuatBank(),
        }));
        actionRow.appendChild(createButton('LIHAT FORMAT DOCX', {
            size: 'sm', icon: 'info', className: 'w-auto',
            onClick: () => this._modalFormatDocx(),
        }));
        this.contentArea.appendChild(actionRow);

        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/question-banks');
            this._banks = res.data?.data ?? [];
            wrap.innerHTML = '';

            if (this._banks.length === 0) {
                wrap.innerHTML = `<div class="text-center py-xl text-text-muted font-inter text-sm">
                    Belum ada bank soal. Klik "BUAT BANK SOAL" untuk memulai.
                </div>`;
                return;
            }

            const cols = [
                { key: 'name',          label: 'Nama Bank Soal' },
                { key: 'subject',       label: 'Mata Pelajaran' },
                { key: 'questionCount', label: 'Jumlah Soal' },
                { key: 'creator',       label: 'Dibuat Oleh' },
                { key: 'actions', label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-bid="${r.id}">
                        <button class="b-soal material-icons text-text-muted hover:text-accent-gold text-lg" title="Lihat Soal">menu_book</button>
                        <button class="b-upload material-icons text-text-muted hover:text-online text-lg" title="Upload DOCX">upload_file</button>
                        <button class="b-del material-icons text-text-muted hover:text-primary text-lg" title="Hapus">delete</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, this._banks, { emptyMessage: 'Belum ada bank soal.' }));

            wrap.querySelectorAll('[data-bid]').forEach(el => {
                const bank = this._banks.find(b => b.id === Number(el.dataset.bid));
                el.querySelector('.b-soal').onclick   = () => this._lihatSoal(bank);
                el.querySelector('.b-upload').onclick = () => this._modalUploadDocx(bank);
                el.querySelector('.b-del').onclick    = () => this._confirmHapusBank(bank);
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat bank soal.', () => this._tabBankSoal()));
        }
    }

    _modalBuatBank() {
        createModal({
            title: 'Buat Bank Soal Baru',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Nama Bank Soal</label>
                        <input id="bk-name" type="text" placeholder="cth. PTS Ganjil 2026" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Mata Pelajaran</label>
                        <input id="bk-subj" type="text" placeholder="cth. Matematika" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div id="bk-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Buat', variant: 'primary', onClick: async (close, body) => {
                    const name    = body.querySelector('#bk-name').value.trim();
                    const subject = body.querySelector('#bk-subj').value.trim();
                    const errEl   = body.querySelector('#bk-err');
                    if (!name || !subject) { errEl.textContent = 'Semua field wajib diisi.'; errEl.classList.remove('hidden'); return; }
                    try {
                        await api.post('/admin/question-banks', { name, subject });
                        close(); this._tabBankSoal();
                    } catch (e) {
                        errEl.textContent = e.response?.data?.message || 'Gagal membuat bank soal.';
                        errEl.classList.remove('hidden');
                    }
                }},
            ],
        });
    }

    _modalUploadDocx(bank) {
        createModal({
            title: `Upload DOCX — ${bank.name}`,
            bodyHtml: `
                <div class="border-2 border-dashed border-divider rounded-card-dark p-xl text-center mb-md">
                    <span class="material-icons text-text-muted text-4xl mb-md">description</span>
                    <p class="font-inter text-sm text-text-secondary mb-md">Pilih file .docx soal</p>
                    <input type="file" accept=".docx" id="docx-file" class="block w-full text-sm text-text-secondary font-inter">
                </div>
                <p class="text-xs text-text-muted font-inter leading-relaxed">
                    Format: MAPEL, KELAS, BANK_SOAL — diikuti soal pilihan ganda + KUNCI.
                    Gambar bisa di-paste langsung ke Word.
                </p>
                <div id="docx-err" class="hidden text-primary text-sm font-inter mt-md"></div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Import Sekarang', variant: 'primary', onClick: async (close, bodyEl) => {
                    const fileInput = bodyEl.querySelector('#docx-file');
                    const errEl     = bodyEl.querySelector('#docx-err');
                    const btnImport = bodyEl.closest('.fixed')?.querySelector('button:last-child');

                    if (!fileInput.files.length) {
                        errEl.textContent = 'Pilih file DOCX terlebih dahulu.';
                        errEl.classList.remove('hidden'); return;
                    }

                    // Set loading state
                    if (btnImport) { btnImport.disabled = true; btnImport.textContent = 'Mengimport...'; }
                    errEl.classList.add('hidden');

                    try {
                        const formData = new FormData();
                        formData.append('file', fileInput.files[0]);

                        const token = authService.getToken();
                        const base  = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
                        const res   = await fetch(`${base}/admin/question-banks/${bank.id}/import`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData,
                        });
                        const data = await res.json();

                        if (data.success) {
                            const { imported, parseErrors } = data.data;
                            close();
                            showToast(`Berhasil import ${imported} soal ke "${bank.name}"!` +
                                (parseErrors?.length ? ` (${parseErrors.length} baris dilewati)` : ''), 'success');
                            this._tabBankSoal();
                        } else {
                            errEl.textContent = data.message || 'Gagal import. Periksa format file.';
                            errEl.classList.remove('hidden');
                        }
                    } catch (e) {
                        errEl.textContent = 'Gagal terhubung ke server.';
                        errEl.classList.remove('hidden');
                    } finally {
                        if (btnImport) { btnImport.disabled = false; btnImport.textContent = 'Import Sekarang'; }
                    }
                }},
            ],
        });
    }

    _modalFormatDocx() {
        createModal({
            title: 'Format Penulisan Soal DOCX',
            bodyHtml: `
                <pre class="bg-bg-primary text-text-primary text-xs font-mono p-md rounded-input overflow-x-auto whitespace-pre-wrap">MAPEL: Matematika
KELAS: X
BANK_SOAL: PTS GANJIL

1. 2 + 2 = ?
a. 3
b. 4
c. 5
d. 6
KUNCI: B

2. Akar dari 144 adalah?
a. 10
b. 11
c. 12
d. 13
KUNCI: C</pre>
                <p class="text-xs text-text-muted font-inter mt-md leading-relaxed">
                    Untuk soal bergambar, paste gambar langsung setelah teks soal di Word.
                    Sistem akan mengekstrak gambar otomatis saat parsing.
                </p>`,
            footerButtons: [{ text: 'Tutup', variant: 'primary', onClick: close => close() }],
        });
    }

    async _lihatSoal(bank) {
        createModal({
            title: `Soal — ${bank.name} (${bank.subject})`,
            bodyHtml: `<div id="soal-wrap" class="py-md text-text-secondary font-inter text-sm">Memuat soal...</div>`,
            footerButtons: [{ text: 'Tutup', variant: 'primary', onClick: close => close() }],
        });

        try {
            const res = await api.get(`/admin/question-banks/${bank.id}/questions`);
            const questions = res.data?.data ?? [];
            const wrap = document.getElementById('soal-wrap');
            if (!wrap) return;

            if (questions.length === 0) {
                wrap.textContent = 'Belum ada soal di bank ini.';
                return;
            }

            wrap.innerHTML = questions.map((q, i) => `
                <div class="mb-lg pb-lg border-b border-divider last:border-0">
                    <p class="font-inter font-bold text-text-primary text-sm mb-sm">${i + 1}. ${q.body}</p>
                    ${q.options?.map((o, j) => `
                        <p class="text-xs font-inter pl-md mb-xs ${o.isCorrect ? 'text-online font-bold' : 'text-text-secondary'}">
                            ${String.fromCharCode(97 + j)}. ${o.body} ${o.isCorrect ? '✓' : ''}
                        </p>`).join('') || ''}
                </div>`).join('');
        } catch (_) {
            const wrap = document.getElementById('soal-wrap');
            if (wrap) wrap.textContent = 'Gagal memuat soal.';
        }
    }

    _confirmHapusBank(bank) {
        createModal({
            title: 'Hapus Bank Soal',
            bodyHtml: `<p class="font-inter text-text-primary">Hapus bank soal <strong>${bank.name}</strong> beserta semua soal di dalamnya?<br>
                       <span class="text-primary text-sm">Tindakan ini tidak dapat dibatalkan.</span></p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Hapus', variant: 'primary', onClick: async (close) => {
                    try {
                        await api.delete(`/admin/question-banks/${bank.id}`);
                        close(); this._tabBankSoal();
                    } catch (e) {
                        showToast(e.response?.data?.message || 'Gagal menghapus.', 'error'); close();
                    }
                }},
            ],
        });
    }

    // ── Kelola Ujian ───────────────────────────────────────────────────────────
    async _tabUjian() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('KELOLA UJIAN', 'Daftar ujian yang dibuat oleh kamu.'));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/teacher/exams');
            this._exams = res.data?.data ?? [];
            wrap.innerHTML = '';

            if (this._exams.length === 0) {
                wrap.innerHTML = `<div class="text-center py-xl text-text-muted font-inter text-sm">
                    Belum ada ujian. Ujian dibuat oleh Admin — minta Admin untuk membuat ujian dan assign ke kamu.
                </div>`;
                return;
            }

            const cols = [
                { key: 'title',          label: 'Nama Ujian' },
                { key: 'subject',        label: 'Mapel' },
                { key: 'durationMinutes',label: 'Durasi', render: r => `${r.durationMinutes} menit` },
                { key: '_count',         label: 'Peserta', render: r => r._count?.attempts ?? 0 },
                { key: 'status',         label: 'Status', render: r => statusPill(r.status) },
                { key: 'actions', label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-eid="${r.id}">
                        <button class="e-hasil material-icons text-text-muted hover:text-accent-gold text-lg" title="Lihat Hasil">leaderboard</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, this._exams, { emptyMessage: 'Belum ada ujian.' }));

            wrap.querySelectorAll('[data-eid]').forEach(el => {
                el.querySelector('.e-hasil').onclick = () => {
                    this._selectedExamId = Number(el.dataset.eid);
                    window.app.router.navigate('/teacher?tab=hasil');
                };
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat ujian.', () => this._tabUjian()));
        }
    }

    // ── Hasil Ujian ────────────────────────────────────────────────────────────
    async _tabHasil() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('HASIL UJIAN', 'Rekap nilai peserta per ujian.'));

        const pickWrap = createElement('div', 'mb-lg max-w-sm');
        pickWrap.innerHTML = `<label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Pilih Ujian</label>`;
        const select = createElement('select', 'w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter');
        select.innerHTML = '<option value="">-- Pilih ujian --</option>';
        pickWrap.appendChild(select);
        this.contentArea.appendChild(pickWrap);

        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);

        try {
            if (!this._exams.length) {
                const r = await api.get('/teacher/exams');
                this._exams = r.data?.data ?? [];
            }
            this._exams.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = `${e.title} — ${e.subject}`;
                if (e.id === this._selectedExamId) opt.selected = true;
                select.appendChild(opt);
            });
        } catch (_) {}

        const loadResults = async (examId) => {
            if (!examId) { wrap.innerHTML = ''; return; }
            wrap.innerHTML = '';
            wrap.appendChild(this._loading());
            try {
                const res = await api.get(`/teacher/exams/${examId}/results`);
                const { results, summary } = res.data?.data ?? {};
                wrap.innerHTML = '';

                if (summary) {
                    const bar = createElement('div', 'grid grid-cols-2 sm:grid-cols-4 gap-md mb-lg');
                    bar.appendChild(createStatCard({ icon: 'groups',       label: 'Peserta',   value: summary.totalParticipants, accent: 'primary' }));
                    bar.appendChild(createStatCard({ icon: 'leaderboard',  label: 'Rata-rata', value: summary.averageScore,      accent: 'gold' }));
                    bar.appendChild(createStatCard({ icon: 'arrow_upward', label: 'Tertinggi', value: summary.highestScore,      accent: 'online' }));
                    bar.appendChild(createStatCard({ icon: 'arrow_downward',label: 'Terendah', value: summary.lowestScore,       accent: 'muted' }));
                    wrap.appendChild(bar);
                }

                const exportBtn = createButton('EXPORT CSV', {
                    size: 'sm', icon: 'download', className: 'w-auto mb-lg',
                    onClick: () => {
                        const token = authService.getToken();
                        const base  = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api');
                        window.open(`${base}/teacher/exams/${examId}/results/export`, '_blank');
                    },
                });
                wrap.appendChild(exportBtn);

                const cols = [
                    { key: 'rank',  label: '#' },
                    { key: 'name',  label: 'Nama Siswa' },
                    { key: 'nisn',  label: 'NISN' },
                    { key: 'class', label: 'Kelas' },
                    { key: 'score', label: 'Nilai', render: r => r.score != null
                        ? `<span class="font-barlow font-extrabold text-lg ${r.score >= 70 ? 'text-online' : 'text-primary'}">${r.score}</span>`
                        : '<span class="text-text-muted">-</span>' },
                    { key: 'counterPelanggaran', label: 'Pelanggaran', render: r =>
                        r.counterPelanggaran > 0
                            ? `<span class="text-primary font-bold">${r.counterPelanggaran}x</span>`
                            : '<span class="text-text-muted">0</span>' },
                ];
                wrap.appendChild(createTable(cols, results ?? [], { emptyMessage: 'Belum ada peserta yang submit.' }));
            } catch (_) {
                wrap.innerHTML = '';
                wrap.appendChild(this._error('Gagal memuat hasil.', () => loadResults(examId)));
            }
        };

        select.onchange = () => {
            this._selectedExamId = Number(select.value) || null;
            loadResults(this._selectedExamId);
        };
        if (this._selectedExamId) loadResults(this._selectedExamId);
    }
}
