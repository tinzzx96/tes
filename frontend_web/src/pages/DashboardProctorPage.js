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
    { id: 'monitoring', icon: 'monitor_heart', label: 'Monitoring Ruang', path: '/proctor' },
    { id: 'token',      icon: 'key',           label: 'Token Ujian',      path: '/proctor?tab=token' },
];

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');

export class DashboardProctorPage extends BasePage {
    constructor() {
        super();
        this.setTitle('Dashboard Pengawas');
        this.activeTab      = new URLSearchParams(window.location.search).get('tab') || 'monitoring';
        this._exams         = [];
        this._examId        = null;
        this._participants  = [];
        this._totalQuestions= 40; // default — bisa di-override dari data ujian
        this._socket        = null;
        this._pollTimer     = null;
        this._pinAlerts     = []; // antrian PIN yang belum dikonfirmasi
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary flex';
        this.container.setAttribute('data-page', 'proctor-dashboard');
        this.container.appendChild(createSidebar(this.activeTab, MENU_ITEMS, 'PENGAWAS'));

        const main = createElement('div', 'flex-1 min-h-screen flex flex-col');
        main.appendChild(createMobileTopBar('EXAM-PONCOL', MENU_ITEMS, this.activeTab));
        this.contentArea = createElement('div', 'flex-1 px-lg md:px-xl py-lg md:py-xl');
        main.appendChild(this.contentArea);
        this.container.appendChild(main);

        this._renderTab();
        return this.container;
    }

    mounted() {
        this._connectSocket();
    }

    beforeUnmount() {
        this._stopPoll();
        if (this._socket) { this._socket.disconnect(); this._socket = null; }
    }

    _renderTab() {
        this.contentArea.innerHTML = '';
        if (this.activeTab === 'token') this._tabToken();
        else this._tabMonitoring();
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

    // ── WebSocket ──────────────────────────────────────────────────────────────
    _connectSocket() {
        try {
            if (typeof io === 'undefined') return;
            const token = authService.getToken();
            this._socket = io(BASE_URL, { auth: { token } });

            // Join room WebSocket sesuai room proktor
            const user = authService.getCurrentUser();
            if (user?.room) {
                this._socket.emit('join-room', { roomName: user.room });
            }

            // ── PIN alert dari siswa yang terblokir ───────────────────────────
            this._socket.on('pin-generated', (data) => {
                this._showPinAlert(data);
                // Update status di tabel jika sedang ditampilkan
                const p = this._participants.find(x => x.userId === `stu_${data.studentId}` || x.name === data.studentName);
                if (p) { p.isBlocked = true; this._rerenderTable(); }
            });

            // ── Status siswa berubah (online/offline) ─────────────────────────
            this._socket.on('student-status-changed', ({ studentId, status }) => {
                const p = this._participants.find(x => x.userId === studentId);
                if (p) { p.status = status; this._rerenderTable(); }
            });
        } catch (_) {
            // Socket.io tidak tersedia — fallback ke polling
        }
    }

    // ── PIN Alert — muncul di area khusus, tidak modal (agar tidak interrupt) ──
    _showPinAlert(data) {
        const pinArea = this.contentArea.querySelector('#pin-alerts-area');
        if (!pinArea) return;

        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const alert = createElement('div',
            'flex items-start justify-between bg-bg-surface border-l-4 border-primary rounded-r-card p-md mb-md animate-fade-in');
        alert.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-sm mb-xs">
                    <span class="material-icons text-primary text-base">lock</span>
                    <p class="font-inter font-bold text-text-primary text-sm">${data.studentName}</p>
                    <span class="text-xs text-text-muted font-inter">${data.subjectName} · ${now}</span>
                </div>
                <p class="text-xs text-text-muted font-inter mb-sm">Siswa terblokir. Berikan PIN ini:</p>
                <div class="flex items-center gap-md">
                    <span class="font-mono font-extrabold text-3xl text-accent-gold tracking-widest">${data.pin}</span>
                    <button class="copy-pin flex items-center gap-xs text-xs font-inter text-text-muted hover:text-text-primary transition-colors"
                            data-pin="${data.pin}">
                        <span class="material-icons text-base">content_copy</span> Salin
                    </button>
                </div>
                <p class="text-xs text-text-muted font-inter mt-xs">Pastikan PIN ini diberikan ke <strong>${data.studentName}</strong>, bukan siswa lain.</p>
            </div>
            <button class="dismiss-pin material-icons text-text-muted hover:text-primary text-xl ml-md flex-shrink-0">close</button>`;

        alert.querySelector('.copy-pin').onclick = (e) => {
            navigator.clipboard?.writeText(e.currentTarget.dataset.pin);
            e.currentTarget.innerHTML = '<span class="material-icons text-base text-online">check</span> Disalin';
            setTimeout(() => { e.currentTarget.innerHTML = '<span class="material-icons text-base">content_copy</span> Salin'; }, 2000);
        };
        alert.querySelector('.dismiss-pin').onclick = () => alert.remove();

        pinArea.prepend(alert);
    }

    // ── Tab Monitoring ─────────────────────────────────────────────────────────
    async _tabMonitoring() {
        const user = authService.getCurrentUser();
        const proctorRoom = user?.room;

        // Header
        const header = createElement('div', 'flex flex-wrap items-start justify-between gap-md mb-lg');
        const leftHead = createElement('div', '');
        leftHead.innerHTML = `
            <h1 class="font-barlow font-extrabold text-page-title text-text-primary mb-xs">MONITORING RUANG</h1>
            <div class="flex items-center gap-sm">
                <span class="material-icons text-accent-gold text-base">meeting_room</span>
                <p class="font-inter text-text-secondary text-sm">
                    ${proctorRoom
                        ? `Kamu bertugas di <span class="font-bold text-accent-gold">${proctorRoom}</span>`
                        : '<span class="text-primary">Ruang belum diset — hubungi Admin</span>'}
                </p>
            </div>`;
        header.appendChild(leftHead);
        this.contentArea.appendChild(header);

        if (!proctorRoom) {
            this.contentArea.appendChild(this._error('Kamu belum ditugaskan ke ruang manapun. Hubungi Admin untuk mengatur ruang.', () => {}));
            return;
        }

        // PIN alerts area — di atas segalanya
        const pinArea = createElement('div', 'mb-lg');
        pinArea.id = 'pin-alerts-area';
        this.contentArea.appendChild(pinArea);

        // Picker ujian — sudah difilter backend by room proktor
        const pickWrap = createElement('div', 'mb-lg max-w-sm');
        pickWrap.innerHTML = `<label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Pilih Ujian di ${proctorRoom}</label>`;
        const select = createElement('select', 'w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter');
        select.innerHTML = '<option value="">-- Pilih ujian --</option>';
        pickWrap.appendChild(select);
        this.contentArea.appendChild(pickWrap);

        // Stats row
        this.statsArea = createElement('div', 'grid grid-cols-2 sm:grid-cols-4 gap-md mb-lg');
        this.contentArea.appendChild(this.statsArea);

        // Live indicator
        const liveNote = createElement('div', 'flex items-center gap-xs text-xs text-text-muted font-inter mb-md');
        liveNote.innerHTML = `<span class="w-2 h-2 rounded-full bg-online animate-pulse inline-block"></span>
                              Status diperbarui otomatis setiap 30 detik`;
        this.contentArea.appendChild(liveNote);

        // Table area
        this.tableArea = createElement('div', '');
        this.contentArea.appendChild(this.tableArea);

        // Load ujian di ruang ini
        try {
            const res = await api.get('/proctor/my-exams');
            this._exams = res.data?.data ?? [];
            this._exams.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.id;
                opt.textContent = `${e.title} — ${e.subject} (${e.status})`;
                select.appendChild(opt);
            });
        } catch (_) {
            select.innerHTML = '<option value="">Gagal memuat ujian</option>';
        }

        select.onchange = () => {
            this._examId = Number(select.value) || null;
            this._stopPoll();
            this.statsArea.innerHTML = '';
            this.tableArea.innerHTML = '';
            if (this._examId) {
                // Tambah tombol Tutup Ujian jika ujian aktif
                const exam = this._exams.find(e => e.id === this._examId);
                const existingBtn = header.querySelector('.btn-close-exam');
                if (existingBtn) existingBtn.remove();
                if (exam?.status === 'active') {
                    const closeBtn = createButton('TUTUP UJIAN', {
                        size: 'sm', icon: 'lock', className: 'w-auto btn-close-exam',
                        onClick: () => this._confirmClose(exam),
                    });
                    header.appendChild(closeBtn);
                }
                this._fetchParticipants();
                this._startPoll();
            }
        };
    }

    async _fetchParticipants() {
        if (!this._examId) return;
        try {
            const res = await api.get(`/proctor/exam/${this._examId}/participants`);
            const d   = res.data?.data ?? {};
            this._participants = d.participants ?? [];
            if (d.exam) this._totalQuestions = d.exam.durationMinutes ?? 40; // fallback
            this._rerenderTable();
        } catch (e) {
            if (this.tableArea) {
                this.tableArea.innerHTML = '';
                this.tableArea.appendChild(this._error(
                    e.response?.data?.message || 'Gagal memuat peserta.',
                    () => this._fetchParticipants()
                ));
            }
        }
    }

    _rerenderTable() {
        const p = this._participants;

        // Stats
        if (this.statsArea) {
            this.statsArea.innerHTML = '';
            this.statsArea.appendChild(createStatCard({ icon: 'wifi',        label: 'Online',      value: p.filter(x => x.status === 'online').length,        accent: 'online' }));
            this.statsArea.appendChild(createStatCard({ icon: 'check_circle',label: 'Submit',      value: p.filter(x => x.status === 'submitted').length,     accent: 'primary' }));
            this.statsArea.appendChild(createStatCard({ icon: 'wifi_off',    label: 'Offline',     value: p.filter(x => x.status === 'offline').length,       accent: 'muted' }));
            this.statsArea.appendChild(createStatCard({ icon: 'lock',        label: 'Terblokir',   value: p.filter(x => x.isBlocked).length,                  accent: 'gold' }));
        }

        if (!this.tableArea) return;
        this.tableArea.innerHTML = '';

        const exam = this._exams.find(e => e.id === this._examId);
        const totalQ = exam?.totalQuestions || 40;

        const cols = [
            { key: 'name',   label: 'Nama Siswa' },
            { key: 'class',  label: 'Kelas' },
            // Progress bar real-time
            { key: 'progress', label: 'Progress Soal', render: r => {
                const pct = Math.min(100, Math.round((r.progress / totalQ) * 100));
                const color = r.status === 'submitted' ? 'bg-online'
                            : r.status === 'offline'   ? 'bg-gray-400'
                            : 'bg-primary';
                return `<div class="flex items-center gap-sm min-w-32">
                    <div class="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div class="${color} h-full transition-all duration-500" style="width:${pct}%"></div>
                    </div>
                    <span class="text-xs text-text-muted font-mono whitespace-nowrap">${r.progress}/${totalQ}</span>
                </div>`;
            }},
            // Status badge
            { key: 'status', label: 'Session', render: r => {
                const map = {
                    submitted:    { label: 'Submit',        cls: 'bg-online bg-opacity-20 text-online border-online' },
                    online:       { label: 'Active',        cls: 'bg-primary bg-opacity-20 text-primary border-primary' },
                    offline:      { label: 'Offline',       cls: 'bg-gray-600 bg-opacity-40 text-gray-300 border-gray-500' },
                    not_logged_in:{ label: 'Belum Login',   cls: 'bg-gray-800 text-text-muted border-gray-700' },
                };
                const s = map[r.status] || map.not_logged_in;
                return `<span class="inline-flex items-center px-sm py-1 rounded-full border text-xs font-inter font-bold ${s.cls}">${s.label}</span>`;
            }},
            // Pelanggaran + blokir
            { key: 'security', label: 'Keamanan', render: r => {
                if (r.isBlocked) return `<span class="flex items-center gap-xs text-primary text-xs font-bold">
                    <span class="material-icons text-sm">lock</span>TERBLOKIR (${r.counterPelanggaran}x)</span>`;
                if (r.counterPelanggaran > 0) return `<span class="text-accent-gold text-xs font-bold">${r.counterPelanggaran}x pelanggaran</span>`;
                return '<span class="text-text-muted text-xs">-</span>';
            }},
            { key: 'lastSeen', label: 'Terakhir Aktif', render: r =>
                r.lastSeen ? new Date(r.lastSeen).toLocaleTimeString('id-ID') : '-' },
            { key: 'actions', label: 'Aksi', render: r => `
                <div data-uid="${r.userId}">
                    <button class="p-reset text-xs font-inter font-bold text-accent-gold hover:text-primary transition-colors flex items-center gap-xs
                        ${r.status === 'not_logged_in' ? 'opacity-30 pointer-events-none' : ''}">
                        <span class="material-icons text-base">restart_alt</span>Reset
                    </button>
                </div>` },
        ];

        this.tableArea.appendChild(createTable(cols, p, { emptyMessage: 'Belum ada peserta yang bergabung.' }));

        this.tableArea.querySelectorAll('[data-uid]').forEach(el => {
            const participant = p.find(x => x.userId === el.dataset.uid);
            el.querySelector('.p-reset')?.addEventListener('click', () => this._confirmReset(participant));
        });
    }

    _startPoll() { this._pollTimer = setInterval(() => this._fetchParticipants(), 30_000); }
    _stopPoll()  { if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; } }

    _confirmReset(p) {
        createModal({
            title: 'Reset Sesi Peserta',
            bodyHtml: `<p class="font-inter text-text-primary mb-sm">Reset sesi <strong>${p.name}</strong>?</p>
                       <p class="text-sm text-text-muted font-inter">Jawaban yang sudah tersimpan tidak akan hilang. Siswa bisa login ulang dan lanjut ujian.</p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Reset', variant: 'primary', onClick: async (close) => {
                    try {
                        const userId = p.userId.replace('stu_', '');
                        await api.patch(`/admin/users/${userId}`, { verified: true });
                        close(); this._fetchParticipants();
                    } catch (_) { alert('Gagal reset sesi.'); close(); }
                }},
            ],
        });
    }

    _confirmClose(exam) {
        createModal({
            title: 'Tutup Ujian',
            bodyHtml: `<p class="font-inter text-text-primary mb-sm">Tutup ujian <strong>${exam.title}</strong>?</p>
                       <p class="text-sm text-primary font-inter">Seluruh peserta yang masih mengerjakan akan otomatis di-submit. Tidak dapat dibatalkan.</p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Tutup Ujian', variant: 'primary', onClick: async (close) => {
                    try {
                        await api.post(`/admin/exams/${exam.id}/complete`);
                        close(); this._renderTab();
                    } catch (_) { alert('Gagal menutup ujian.'); close(); }
                }},
            ],
        });
    }

    // ── Tab Token ──────────────────────────────────────────────────────────────
    async _tabToken() {
        this.contentArea.innerHTML = '';
        const user = authService.getCurrentUser();
        this.contentArea.innerHTML = `
            <h1 class="font-barlow font-extrabold text-page-title text-text-primary mb-xs">TOKEN UJIAN</h1>
            <p class="font-inter text-text-secondary text-sm mb-xl">
                Token yang dimasukkan siswa sebelum mengerjakan ujian di <span class="text-accent-gold font-bold">${user?.room || '(ruang belum diset)'}</span>.
            </p>`;

        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const [tokensRes, examsRes] = await Promise.all([
                api.get('/admin/exam-tokens'),
                api.get('/proctor/my-exams'),
            ]);
            const tokens  = tokensRes.data?.data ?? [];
            const exams   = examsRes.data?.data ?? [];
            wrap.innerHTML = '';

            if (!exams.length) {
                wrap.innerHTML = `<p class="text-text-muted font-inter text-sm">Tidak ada ujian di ruang kamu.</p>`;
                return;
            }

            exams.forEach(exam => {
                const examTokens = tokens.filter(t => t.examId === exam.id);
                const card = createElement('div', 'bg-bg-surface-light rounded-card p-lg mb-md');
                card.innerHTML = `
                    <div class="flex items-center justify-between mb-md">
                        <div>
                            <p class="font-inter font-bold text-text-primary">${exam.title} — ${exam.subject}</p>
                            <p class="text-xs text-text-muted font-inter">Status: <span class="font-bold ${exam.status === 'active' ? 'text-online' : 'text-text-muted'}">${exam.status}</span></p>
                        </div>
                    </div>`;

                if (!examTokens.length) {
                    const noToken = createElement('p', 'text-xs text-text-muted font-inter italic');
                    noToken.textContent = 'Belum ada token ujian. Minta Admin untuk membuat.';
                    card.appendChild(noToken);
                } else {
                    examTokens.forEach(t => {
                        const row = createElement('div', 'flex items-center justify-between bg-bg-primary rounded-input px-lg py-md mb-sm');
                        row.innerHTML = `
                            <span class="font-mono font-extrabold text-2xl text-accent-gold tracking-widest">${t.token}</span>
                            <button class="copy-btn material-icons text-text-secondary hover:text-text-primary cursor-pointer" data-token="${t.token}">content_copy</button>`;
                        row.querySelector('.copy-btn').onclick = (e) => {
                            navigator.clipboard?.writeText(e.currentTarget.dataset.token);
                            e.currentTarget.textContent = 'check';
                            setTimeout(() => e.currentTarget.textContent = 'content_copy', 2000);
                        };
                        card.appendChild(row);
                    });
                }
                wrap.appendChild(card);
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat token.', () => this._tabToken()));
        }
    }
}
