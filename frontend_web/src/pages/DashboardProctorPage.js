// frontend_web/src/pages/DashboardProctorPage.js
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
    { id: 'pin',        icon: 'lock',          label: 'Lock PIN',         path: '/proctor?tab=pin' },
];

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');

export class DashboardProctorPage extends BasePage {
    constructor() {
        super();
        this.setTitle('Dashboard Pengawas');
        this.activeTab     = new URLSearchParams(window.location.search).get('tab') || 'monitoring';
        this._exams        = [];
        this._examId       = null;
        this._participants = [];
        this._socket       = null;
        this._pollTimer    = null;
        this.statsArea     = null;
        this.tableArea     = null;
        this.pinAlertArea  = null;
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary flex';
        this.container.setAttribute('data-page', 'proctor-dashboard');
        this.container.appendChild(createSidebar(this.activeTab, MENU_ITEMS, 'Pengawas'));

        const main = createElement('div', 'flex-1 min-h-screen flex flex-col min-w-0 md:pl-56');
        main.appendChild(createMobileTopBar(this.activeTab, MENU_ITEMS, 'EXAM-PONCOL'));

        this.contentArea = createElement('div', 'flex-1 p-6 md:p-8 max-w-6xl');
        main.appendChild(this.contentArea);
        this.container.appendChild(main);

        this._renderTab();
        return this.container;
    }

    mounted() { this._connectSocket(); }

    beforeUnmount() {
        this._stopPoll();
        if (this._socket) { this._socket.disconnect(); this._socket = null; }
    }

    _connectSocket() {
        try {
            if (typeof io === 'undefined') return;
            const token = authService.getToken();
            this._socket = io(BASE_URL, { auth: { token } });

            const user = authService.getCurrentUser();
            if (user?.room) this._socket.emit('join-room', { roomName: user.room });

            this._socket.on('student-status-changed', (data) => {
                const idx = this._participants.findIndex(p => p.userId === data.studentId);
                if (idx !== -1) {
                    this._participants[idx] = { ...this._participants[idx], ...data };
                    if (this.activeTab === 'pin') {
                        this._rerenderPinList();
                    } else {
                        this._rerenderTable();
                    }
                }
            });

            this._socket.on('pin-generated', (data) => {
                this._showPinAlert(data);
                const studentIdStr = data.studentId?.toString() || '';
                const idx = this._participants.findIndex(p => 
                    p.userId === studentIdStr || 
                    p.userId === `stu_${studentIdStr}` || 
                    p.name === data.studentName
                );
                if (idx !== -1) {
                    this._participants[idx].isBlocked = true;
                    this._participants[idx].unlockPin = data.pin;
                    if (this.activeTab === 'pin') {
                        this._rerenderPinList();
                    } else {
                        this._rerenderTable();
                    }
                } else {
                    this._fetchParticipants();
                }
            });

            this._socket.on('exam-status-changed', (data) => {
                if (this.activeTab === 'token' || this.activeTab === 'pin') this._renderTab();
                else if (this.activeTab === 'monitoring' && this._examId && Number(data?.examId) === this._examId) this._renderTab();
            });
        } catch (_) {}
    }

    _renderTab() {
        this.contentArea.innerHTML = '';
        this.statsArea    = null;
        this.tableArea    = null;
        this.pinAlertArea = null;
        if (this.activeTab === 'token') this._tabToken();
        else if (this.activeTab === 'pin') this._tabPin();
        else this._tabMonitoring();
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
    // ── MONITORING ───────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    async _tabMonitoring() {
        this.contentArea.innerHTML = '';
        // Header
        const header = createElement('div', 'flex items-start justify-between mb-6');
        header.innerHTML = `
            <div>
                <h1 class="font-barlow font-extrabold text-2xl text-text-primary leading-none mb-1">Monitoring Ruang</h1>
                <p class="font-inter text-text-muted text-sm">Pantau peserta ujian secara real-time.</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <div class="w-2 h-2 rounded-full bg-online animate-pulse"></div>
                <span class="font-inter text-xs text-text-muted">Live</span>
            </div>
        `;
        this.contentArea.appendChild(header);

        // PIN Alert area (for blocked students)
        this.pinAlertArea = createElement('div', 'mb-4');
        this.pinAlertArea.id = 'pin-alerts-area';
        this.contentArea.appendChild(this.pinAlertArea);

        // Exam selector row
        const selectorRow = createElement('div', 'flex items-center gap-3 mb-4');
        selectorRow.innerHTML = `
            <label class="font-inter text-xs font-semibold text-text-muted uppercase tracking-wider flex-shrink-0">Pilih Ujian</label>
            <select id="proctor-exam-sel" class="flex-1 bg-bg-surface border border-divider rounded p-2.5 font-inter text-sm text-text-primary focus:border-primary outline-none max-w-xs">
                <option value="">Memuat daftar ujian...</option>
            </select>
            <button id="refresh-btn" class="flex items-center gap-1.5 px-3 py-2 rounded font-inter text-xs text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors border border-divider">
                <span class="material-icons text-sm">refresh</span>
                Refresh
            </button>
        `;
        this.contentArea.appendChild(selectorRow);

        // Stats row
        this.statsArea = createElement('div', 'grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4');
        this.contentArea.appendChild(this.statsArea);

        // Table area
        this.tableArea = createElement('div', '');
        this.contentArea.appendChild(this.tableArea);
        this.tableArea.appendChild(this._loading());

        // Close exam button area
        this._closeExamArea = createElement('div', 'mt-4');
        this.contentArea.appendChild(this._closeExamArea);

        // Load exams
        try {
            const res = await api.get('/proctor/my-exams');
            this._exams = res.data?.data ?? [];

            const sel = selectorRow.querySelector('#proctor-exam-sel');
            sel.innerHTML = this._exams.map(e => `<option value="${e.id}">${e.title} (${e.subject})${e.status === 'active' ? ' ● (Aktif)' : ''}</option>`).join('');

            sel.onchange = () => {
                this._stopPoll();
                this._examId = Number(sel.value) || null;
                this.statsArea.innerHTML = '';
                this._fetchParticipants();
                this._startPoll();
            };

            selectorRow.querySelector('#refresh-btn').onclick = (e) => this._handleManualRefresh(e.currentTarget);

            // Auto-select active exam
            const active = this._exams.find(e => e.status === 'active') || this._exams[0];
            if (active) {
                sel.value     = active.id;
                this._examId  = active.id;
                this._fetchParticipants();
                this._startPoll();
            } else {
                sel.innerHTML = `<option value="">Tidak ada ujian aktif</option>`;
                this.tableArea.innerHTML = '';
                this.tableArea.innerHTML = `
                    <div class="py-12 text-center">
                        <span class="material-icons text-text-muted text-3xl block mb-3">event_busy</span>
                        <p class="font-inter text-sm text-text-muted">Tidak ada ujian yang ditugaskan di ruangan ini.</p>
                    </div>
                `;
            }
        } catch (e) {
            this.tableArea.innerHTML = '';
            this.tableArea.appendChild(this._error('Gagal memuat daftar ujian.', () => this._renderTab()));
        }
    }

    async _fetchParticipants() {
        if (!this._examId) return;
        try {
            const res = await api.get(`/proctor/exam/${this._examId}/participants`);
            const d   = res.data?.data ?? {};
            this._participants = d.participants ?? [];
            if (this.activeTab === 'pin') {
                this._rerenderPinList();
            } else {
                this._rerenderTable();
            }
            this._rerenderCloseBtn(d.exam);
        } catch (e) {
            if (this.tableArea) {
                this.tableArea.innerHTML = '';
                this.tableArea.appendChild(this._error('Gagal memuat peserta.', () => this._fetchParticipants()));
            }
        }
    }

    async _handleManualRefresh(btn) {
        if (!btn) return;
        const origContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="material-icons text-sm animate-spin">progress_activity</span> Memuat...`;

        try {
            const res = await api.get('/proctor/my-exams');
            this._exams = res.data?.data ?? [];

            const sel = document.getElementById('proctor-exam-sel');
            if (sel) {
                const currentVal = sel.value;
                sel.innerHTML = this._exams.map(e => `<option value="${e.id}">${e.title} (${e.subject})${e.status === 'active' ? ' ● (Aktif)' : ''}</option>`).join('');
                if (this._exams.some(e => e.id === Number(currentVal))) {
                    sel.value = currentVal;
                    this._examId = Number(currentVal);
                } else {
                    const active = this._exams.find(e => e.status === 'active') || this._exams[0];
                    if (active) {
                        sel.value = active.id;
                        this._examId = active.id;
                    } else {
                        sel.innerHTML = `<option value="">Tidak ada ujian aktif</option>`;
                        this._examId = null;
                    }
                }
            }

            await this._fetchParticipants();
        } catch (err) {
            // Silently ignore or fallback
        } finally {
            btn.disabled = false;
            btn.innerHTML = origContent;
        }
    }

    _rerenderTable() {
        const p = this._participants;
        const exam = this._exams.find(e => e.id === this._examId);
        const totalQ = exam?.totalQuestions || 40;

        // Update stats
        if (this.statsArea) {
            this.statsArea.innerHTML = '';
            this.statsArea.appendChild(createStatCard({ icon: 'wifi',        label: 'Online',    value: p.filter(x => x.status === 'online').length,    accent: 'online' }));
            this.statsArea.appendChild(createStatCard({ icon: 'check_circle',label: 'Submit',    value: p.filter(x => x.status === 'submitted').length,  accent: 'primary' }));
            this.statsArea.appendChild(createStatCard({ icon: 'wifi_off',    label: 'Offline',   value: p.filter(x => x.status === 'offline').length,    accent: 'muted' }));
            this.statsArea.appendChild(createStatCard({ icon: 'lock',        label: 'Terblokir', value: p.filter(x => x.isBlocked).length,               accent: 'gold' }));
        }

        if (!this.tableArea) return;
        this.tableArea.innerHTML = '';

        const cols = [
            { key: 'name',  label: 'Nama Siswa', render: r => `
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        r.status === 'online'    ? 'bg-online' :
                        r.status === 'submitted' ? 'bg-primary' :
                        r.status === 'offline'   ? 'bg-text-muted' : 'bg-accent-gold'
                    }"></div>
                    <span class="font-inter text-sm font-medium text-text-primary">${r.name}</span>
                    ${r.isBlocked ? '<span class="material-icons text-primary text-xs" title="Terblokir">lock</span>' : ''}
                </div>` },
            { key: 'class', label: 'Kelas', render: r => `<span class="text-text-muted text-sm">${r.className || '-'}</span>` },
            { key: 'progress', label: 'Progress', render: r => {
                const pct  = Math.min(100, Math.round((r.progress / totalQ) * 100));
                const color = r.status === 'submitted' ? 'bg-online' : r.status === 'offline' ? 'bg-text-muted' : 'bg-primary';
                return `
                    <div class="flex items-center gap-2 min-w-24">
                        <div class="flex-1 h-1.5 bg-bg-primary rounded-full overflow-hidden" style="min-width:64px">
                            <div class="${color} h-full rounded-full transition-all" style="width:${pct}%"></div>
                        </div>
                        <span class="font-mono text-xs text-text-muted flex-shrink-0">${r.progress}/${totalQ}</span>
                    </div>
                `;
            }},
            { key: 'counterPelanggaran', label: 'Pelanggaran', render: r => r.counterPelanggaran > 0
                ? `<span class="font-bold text-primary text-sm">${r.counterPelanggaran}x</span>`
                : `<span class="text-text-muted text-sm">—</span>` },
            { key: 'status', label: 'Status', render: r => statusPill(r.status) },
            { key: 'actions', label: '', render: r => `
                <div class="flex gap-1.5" data-uid="${r.userId}">
                    <button class="p-reset flex items-center gap-1 px-2 py-1 rounded font-inter text-xs text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors border border-divider ${r.status === 'submitted' || r.status === 'waiting' ? 'opacity-30 pointer-events-none' : ''}">
                        <span class="material-icons text-xs">restart_alt</span>
                        Reset
                    </button>
                    <button class="p-reset-device flex items-center gap-1 px-2 py-1 rounded font-inter text-xs text-text-muted hover:text-primary hover:bg-bg-surface transition-colors border border-divider" title="Hapus kunci perangkat">
                        <span class="material-icons text-xs">phonelink_erase</span>
                        Device
                    </button>
                </div>` },
        ];

        this.tableArea.appendChild(createTable(cols, p, { emptyMessage: 'Belum ada peserta yang bergabung.' }));

        this.tableArea.querySelectorAll('[data-uid]').forEach(el => {
            const participant = p.find(x => x.userId === el.dataset.uid);
            if (participant) {
                el.querySelector('.p-reset')?.addEventListener('click', () => this._confirmReset(participant));
                el.querySelector('.p-reset-device')?.addEventListener('click', () => this._confirmResetDevice(participant));
            }
        });
    }

    _rerenderCloseBtn(exam) {
        if (!this._closeExamArea || !exam) return;
        this._closeExamArea.innerHTML = '';
        if (exam.status === 'active') {
            const btn = createButton('Tutup Ujian', {
                size: 'sm', icon: 'stop_circle', variant: 'secondary',
                className: 'w-auto border-primary text-primary hover:bg-primary hover:text-white',
                onClick: () => this._confirmClose(exam),
            });
            this._closeExamArea.appendChild(btn);
        }
    }

    _showPinAlert(data) {
        if (!this.pinAlertArea) return;
        const now   = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const alert = createElement('div', 'flex items-start justify-between rounded-lg p-4 mb-2');
        alert.style.cssText = 'background: #2A1010; border: 1px solid #CC0000; border-left: 3px solid #CC0000;';
        alert.innerHTML = `
            <div class="flex items-start gap-3 flex-1">
                <span class="material-icons text-primary text-base flex-shrink-0 mt-0.5">lock</span>
                <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-inter font-bold text-text-primary text-sm">${data.studentName}</span>
                        <span class="font-inter text-xs text-text-muted">${data.subjectName || ''} · ${now}</span>
                    </div>
                    <p class="font-inter text-xs text-text-muted mb-2">Siswa terblokir. Minta PIN untuk membuka kunci.</p>
                    <div class="flex items-center gap-2">
                        <span class="font-inter text-xs text-text-muted">PIN:</span>
                        <span class="font-mono font-bold text-accent-gold text-lg tracking-widest">${data.unlockPin || '------'}</span>
                    </div>
                </div>
            </div>
            <button class="dismiss-pin material-icons text-text-muted hover:text-text-primary flex-shrink-0 ml-3">close</button>
        `;
        alert.querySelector('.dismiss-pin').onclick = () => alert.remove();
        this.pinAlertArea.prepend(alert);
        setTimeout(() => { if (alert.parentNode) alert.remove(); }, 120_000);
    }

    _startPoll() { this._pollTimer = setInterval(() => this._fetchParticipants(), 30_000); }
    _stopPoll()  { if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; } }

    _confirmReset(p) {
        createModal({
            title: 'Reset Sesi Peserta',
            bodyHtml: `
                <p class="font-inter text-sm text-text-primary mb-2">Reset sesi ujian <strong>${p.name}</strong>?</p>
                <p class="font-inter text-xs text-text-muted">Jawaban yang sudah tersimpan tidak akan hilang. Siswa dapat login ulang dan melanjutkan ujian.</p>
            `,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Reset Sesi', variant: 'primary', onClick: async (close) => {
                    try {
                        const userId = p.userId.replace('stu_', '');
                        await api.post(`/proctor/exam/${this._examId}/reset/${userId}`);
                        close(); this._fetchParticipants();
                    } catch (_) { close(); }
                }},
            ],
        });
    }

    _confirmResetDevice(p) {
        createModal({
            title: '🔓 Reset Kunci Perangkat',
            bodyHtml: `
                <p class="font-inter text-sm text-text-primary mb-3">Reset kunci perangkat milik <strong>${p.name}</strong>?</p>
                <div class="rounded-lg p-3 mb-3" style="background: #1A0A0A; border: 1px solid #CC000033;">
                    <p class="font-inter text-xs text-text-muted leading-relaxed">
                        ⚠️ Gunakan ini <strong class="text-text-primary">HANYA</strong> jika siswa mengalami kendala teknis nyata
                        (HP rusak, layar pecah, dll). Setelah reset, siswa diizinkan login dari perangkat lain.
                    </p>
                </div>
                <p class="font-inter text-xs text-text-muted">Tindakan ini tercatat dalam audit log.</p>
            `,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Reset Kunci Device', variant: 'primary', onClick: async (close) => {
                    try {
                        const userId = p.userId.replace('stu_', '');
                        await api.post(`/proctor/exam/${this._examId}/reset-device/${userId}`);
                        close();
                        this._fetchParticipants();
                    } catch (e) {
                        close();
                        console.error('Reset device error:', e);
                    }
                }},
            ],
        });
    }

    _confirmClose(exam) {
        createModal({
            title: 'Tutup Ujian',
            bodyHtml: `
                <p class="font-inter text-sm text-text-primary mb-2">Tutup ujian <strong>${exam.title}</strong>?</p>
                <p class="font-inter text-xs text-primary">Seluruh peserta yang masih mengerjakan akan otomatis di-submit. Tindakan ini tidak dapat dibatalkan.</p>
            `,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Tutup Ujian', variant: 'primary', onClick: async (close) => {
                    try { await api.post(`/admin/exams/${exam.id}/complete`); close(); this._renderTab(); }
                    catch (_) { close(); }
                }},
            ],
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── TOKEN UJIAN ──────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    async _tabToken() {
        this.contentArea.innerHTML = '';
        // Header
        const header = createElement('div', 'mb-6');
        header.innerHTML = `
            <h1 class="font-barlow font-extrabold text-2xl text-text-primary leading-none mb-1">Token Ujian</h1>
            <p class="font-inter text-text-muted text-sm">Token yang diinput siswa sebelum memulai pengerjaan.</p>
        `;
        this.contentArea.appendChild(header);

        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/proctor/my-exams');
            this._exams = res.data?.data ?? [];
            wrap.innerHTML = '';

            if (this._exams.length === 0) {
                wrap.innerHTML = `
                    <div class="py-12 text-center">
                        <span class="material-icons text-text-muted text-3xl block mb-3">key_off</span>
                        <p class="font-inter text-sm text-text-muted">Tidak ada ujian yang ditugaskan.</p>
                    </div>
                `;
                return;
            }

            this._exams.forEach((exam, idx) => {
                const isLast = idx === this._exams.length - 1;
                const card = createElement('div', `bg-bg-surface rounded-lg p-5 ${!isLast ? 'mb-3' : ''}`);
                card.style.cssText = 'border: 1px solid #2e2e2e;';

                const statusColor = exam.status === 'active' ? 'text-online' : exam.status === 'completed' ? 'text-text-muted' : 'text-accent-gold';
                card.innerHTML = `
                    <div class="flex items-start justify-between gap-4 mb-4">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="font-inter text-xs font-semibold ${statusColor} uppercase tracking-wider">${exam.status}</span>
                                <span class="text-divider">·</span>
                                <span class="font-inter text-xs text-text-muted">${exam.subject}</span>
                            </div>
                            <h3 class="font-inter font-semibold text-base text-text-primary truncate">${exam.title}</h3>
                        </div>
                        ${exam.status === 'active' ? `
                        <button class="btn-reset-token flex items-center gap-1.5 px-3 py-1.5 rounded font-inter text-xs text-text-muted hover:text-text-primary hover:bg-bg-primary transition-colors border border-divider flex-shrink-0" data-eid="${exam.id}">
                            <span class="material-icons text-xs">refresh</span>
                            Generate Baru
                        </button>` : ''}
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex-1 bg-bg-primary rounded-lg px-4 py-3 flex items-center justify-center" style="border:1px solid #C9A84C33">
                            <span class="font-barlow font-extrabold text-4xl text-accent-gold tracking-widest token-display">${exam.token || '——'}</span>
                        </div>
                        <button class="btn-copy-token w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors border border-divider" data-token="${exam.token}" title="Salin token">
                            <span class="material-icons text-base">content_copy</span>
                        </button>
                    </div>
                    <p class="font-inter text-xs text-text-muted mt-3">Siswa menginput token ini setelah memilih mata pelajaran di aplikasi.</p>
                `;

                // Copy token
                card.querySelector('.btn-copy-token')?.addEventListener('click', (e) => {
                    const t = e.currentTarget.dataset.token;
                    navigator.clipboard.writeText(t).then(() => {
                        e.currentTarget.querySelector('.material-icons').textContent = 'check';
                        setTimeout(() => { e.currentTarget.querySelector('.material-icons').textContent = 'content_copy'; }, 1500);
                    });
                });

                // Reset token
                card.querySelector('.btn-reset-token')?.addEventListener('click', () => {
                    this._confirmResetToken(exam, card.querySelector('.token-display'));
                });

                wrap.appendChild(card);
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat token ujian.', () => this._renderTab()));
        }
    }

    _confirmResetToken(exam, tokenEl) {
        createModal({
            title: 'Generate Token Baru',
            bodyHtml: `
                <p class="font-inter text-sm text-text-primary mb-2">Generate token ujian baru untuk <strong>${exam.title}</strong>?</p>
                <p class="font-inter text-xs text-text-muted">Token lama tidak akan berlaku lagi. Siswa yang belum masuk harus menggunakan token baru.</p>
            `,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Generate Token Baru', variant: 'primary', onClick: async (close) => {
                    try {
                        const res = await api.post(`/proctor/exam/${exam.id}/reset-token`);
                        const newToken = res.data?.data?.token;
                        if (newToken && tokenEl) tokenEl.textContent = newToken;
                        close();
                    } catch (_) { close(); }
                }},
            ],
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── LOCK PIN ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    async _tabPin() {
        this.contentArea.innerHTML = '';
        // Header
        const header = createElement('div', 'flex items-start justify-between mb-6');
        header.innerHTML = `
            <div>
                <h1 class="font-barlow font-extrabold text-2xl text-text-primary leading-none mb-1">Lock PIN</h1>
                <p class="font-inter text-text-muted text-sm">Buka blokir ujian siswa terdeteksi curang.</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <span class="material-icons text-primary animate-pulse">lock</span>
            </div>
        `;
        this.contentArea.appendChild(header);

        // Exam selector row
        const selectorRow = createElement('div', 'flex items-center gap-3 mb-4');
        selectorRow.innerHTML = `
            <label class="font-inter text-xs font-semibold text-text-muted uppercase tracking-wider flex-shrink-0">Ujian</label>
            <select id="proctor-exam-sel" class="flex-1 bg-bg-surface border border-divider rounded p-2.5 font-inter text-sm text-text-primary focus:border-primary outline-none max-w-xs">
                <option value="">Memuat ujian...</option>
            </select>
            <button id="refresh-btn" class="flex items-center gap-1.5 px-3 py-2 rounded font-inter text-xs text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors border border-divider">
                <span class="material-icons text-sm">refresh</span>
                Refresh
            </button>
        `;
        this.contentArea.appendChild(selectorRow);

        // Table area as list container
        this.tableArea = createElement('div', '');
        this.contentArea.appendChild(this.tableArea);
        this.tableArea.appendChild(this._loading());

        // Load exams
        try {
            const res = await api.get('/proctor/my-exams');
            this._exams = res.data?.data ?? [];

            const sel = selectorRow.querySelector('#proctor-exam-sel');
            sel.innerHTML = `<option value="">-- Pilih Ujian --</option>` +
                this._exams.map(e => `<option value="${e.id}">${e.title} (${e.subject})${e.status === 'active' ? ' ●' : ''}</option>`).join('');

            sel.onchange = () => {
                this._stopPoll();
                this._examId = Number(sel.value) || null;
                this._fetchParticipants();
                this._startPoll();
            };

            selectorRow.querySelector('#refresh-btn').onclick = (e) => this._handleManualRefresh(e.currentTarget);

            // Auto-select active exam
            const active = this._exams.find(e => e.status === 'active') || this._exams[0];
            if (active) {
                sel.value     = active.id;
                this._examId  = active.id;
                this._fetchParticipants();
                this._startPoll();
            } else {
                this.tableArea.innerHTML = `
                    <div class="py-12 text-center">
                        <span class="material-icons text-text-muted text-3xl block mb-3">event_busy</span>
                        <p class="font-inter text-sm text-text-muted">Tidak ada ujian yang ditugaskan di ruangan ini.</p>
                    </div>
                `;
            }
        } catch (e) {
            this.tableArea.innerHTML = '';
            this.tableArea.appendChild(this._error('Gagal memuat daftar ujian.', () => this._renderTab()));
        }
    }

    _rerenderPinList() {
        if (!this.tableArea) return;
        this.tableArea.innerHTML = '';

        const blockedStudents = this._participants.filter(p => p.isBlocked);

        if (blockedStudents.length === 0) {
            const emptyState = createElement('div', 'py-12 text-center flex flex-col items-center justify-center');
            emptyState.innerHTML = `
                <div class="p-6 bg-online bg-opacity-10 rounded-full mb-4 flex items-center justify-center" style="background: rgba(16, 185, 129, 0.1); width: 80px; height: 80px;">
                    <span class="material-icons text-online text-4xl">verified_user</span>
                </div>
                <h3 class="font-inter font-bold text-lg text-text-primary mb-1">Sistem Berjalan Kondusif</h3>
                <p class="font-inter text-sm text-text-muted font-medium">Tidak ada siswa terblokir di ruang ujian ini.</p>
            `;
            this.tableArea.appendChild(emptyState);
            return;
        }

        const grid = createElement('div', 'grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in');
        blockedStudents.forEach(student => {
            const card = createElement('div', 'bg-bg-surface rounded-lg p-5 flex flex-col gap-4');
            card.style.cssText = 'border: 1.5px solid #CC0000;';

            const pin = student.unlockPin || '----';

            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="material-icons text-primary text-xl">lock</span>
                    <div class="min-w-0 flex-1">
                        <h3 class="font-inter font-bold text-base text-text-primary truncate">${student.name}</h3>
                        <p class="font-inter text-xs text-text-muted">${student.nisn || '-'} · ${student.className || '-'}</p>
                    </div>
                </div>
                <hr class="border-divider">
                <div>
                    <span class="font-inter text-xs font-semibold text-text-muted uppercase tracking-wider block mb-3">Metode Buka Blokir</span>
                    <div class="grid grid-cols-2 gap-3">
                        <!-- Jalur Otomatis -->
                        <div>
                            <span class="font-inter text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">Jalur Otomatis</span>
                            <button class="btn-auto-unlock w-full h-11 ${student.unlockPin ? 'bg-primary hover:bg-red-700 cursor-pointer' : 'bg-bg-primary border border-divider cursor-not-allowed opacity-50'} text-white font-inter text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5" data-uid="${student.userId}" ${!student.unlockPin ? 'disabled' : ''}>
                                ${student.unlockPin ? 'BUKA OTOMATIS' : 'PIN TIDAK TERSEDIA'}
                            </button>
                        </div>
                        <!-- Jalur Manual -->
                        <div>
                            <span class="font-inter text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">Jalur Manual (PIN)</span>
                            <div class="h-11 flex items-center justify-center bg-bg-primary border border-divider rounded">
                                <span class="font-barlow font-black text-xl text-accent-gold tracking-widest">${pin}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <p class="font-inter text-[11px] text-text-muted leading-relaxed">
                    Gunakan Jalur Otomatis untuk membuka layar siswa secara remote. Jika internet siswa bermasalah, bacakan kode PIN manual di atas.
                </p>
            `;

            card.querySelector('.btn-auto-unlock').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                const origText = btn.textContent;
                btn.disabled = true;
                btn.innerHTML = `<span class="material-icons animate-spin text-sm">progress_activity</span>`;

                try {
                    const user = authService.getCurrentUser();
                    const payload = {
                        studentId: Number(student.userId.replace('stu_', '')) || 0,
                        studentName: student.name,
                        examAttemptId: student.examAttemptId,
                        pin: student.unlockPin,
                        roomName: user?.room || '',
                        subjectName: 'Ujian',
                        fromProctor: true,
                    };

                    if (this._socket) {
                        this._socket.emit('pin-generated', payload);
                    }

                    await new Promise(resolve => setTimeout(resolve, 600));

                    showToast(`Sinyal buka otomatis dikirim ke ${student.name}.`, 'success');
                } catch (err) {
                    showToast('Gagal mengirim sinyal otomatis.', 'error');
                } finally {
                    btn.disabled = false;
                    btn.textContent = origText;
                }
            });

            grid.appendChild(card);
        });

        this.tableArea.appendChild(grid);
    }
}