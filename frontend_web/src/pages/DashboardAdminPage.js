import { BasePage } from './BasePage.js';
import { createElement } from '../utils/dom.js';
import { createSidebar, createMobileTopBar } from '../components/Sidebar.js';
import { createStatCard } from '../components/StatCard.js';
import { createTable, statusPill } from '../components/Table.js';
import { createButton } from '../components/Button.js';
import { createModal } from '../components/Modal.js';
import { authService } from '../services/auth.js';
import { api } from '../services/api.js';
import { ClassMultiSelect } from '../components/ClassMultiSelect.js';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// ── Konstanta jurusan resmi (dipakai di form kelas & import siswa) ─────────────
const JURUSAN_LIST = ['RPL', 'DKV', 'TKRO', 'AKL', 'BP', 'TKJ'];

const MENU_ITEMS = [
    { type: 'heading',     label: 'Utama' },
    { id: 'overview',      icon: 'dashboard',    label: 'Overview',       path: '/admin' },
    { type: 'heading',     label: 'Kelola' },
    { id: 'guru',          icon: 'school',        label: 'Kelola Guru',    path: '/admin?tab=guru' },
    { id: 'siswa',         icon: 'groups',        label: 'Kelola Siswa',   path: '/admin?tab=siswa' },
    { id: 'ujian',         icon: 'fact_check',    label: 'Kelola Ujian',   path: '/admin?tab=ujian' },
    { type: 'heading',     label: 'Konfigurasi' },
    { id: 'mapel',         icon: 'menu_book',     label: 'Mata Pelajaran', path: '/admin?tab=mapel' },
    { id: 'kelas',         icon: 'class',         label: 'Kelola Kelas',   path: '/admin?tab=kelas' },
    { id: 'proktor',       icon: 'security',      label: 'Kelola Proktor', path: '/admin?tab=proktor' },
    { id: 'ruangan',       icon: 'meeting_room',  label: 'Kelola Ruangan', path: '/admin?tab=ruangan' },
    { id: 'token-sesi',    icon: 'key',           label: 'Token Sesi',     path: '/admin?tab=token-sesi' },
];

export class DashboardAdminPage extends BasePage {
    constructor() {
        super();
        this.setTitle('Dashboard Admin');
        this.activeTab = new URLSearchParams(window.location.search).get('tab') || 'overview';
        this._subjectsList = [];
        this._socket = null;
    }

    mounted() {
        this._connectSocket();
    }

    beforeUnmount() {
        if (this._socket) { this._socket.disconnect(); this._socket = null; }
    }

    _connectSocket() {
        try {
            if (typeof io === 'undefined') return;
            const token = authService.getToken();
            const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
            this._socket = io(BASE_URL, { auth: { token } });

            // Admin join room khusus admin
            this._socket.emit('join-room', { roomName: 'admin' });

            // Listen ke event auto-refresh dari backend
            this._socket.on('admin-refresh', (data) => {
                if (data.tab === this.activeTab || data.tab === 'all') {
                    this._renderTab();
                }
            });

            this._socket.on('new-activity', (log) => {
                this._handleNewActivity(log);
            });
        } catch (_) {
            // Abaikan jika socket error (fallback ke manual refresh)
        }
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary flex';
        this.container.setAttribute('data-page', 'admin-dashboard');
        this.container.appendChild(createSidebar(this.activeTab, MENU_ITEMS, 'ADMIN SEKOLAH'));

        const main = createElement('div', 'flex-1 min-h-screen flex flex-col md:pl-56');
        main.appendChild(createMobileTopBar(this.activeTab, MENU_ITEMS, 'EXAM-PONCOL', false));

        const layoutContainer = createElement('div', 'flex-1 flex flex-col md:flex-row w-full min-w-0');
        this.contentArea = createElement('div', 'flex-1 px-lg md:px-xl py-lg md:py-xl min-w-0');
        
        layoutContainer.appendChild(this.contentArea);
        
        this.globalActivitySidebar = this._createPersistentGlobalActivitySidebar();
        layoutContainer.appendChild(this.globalActivitySidebar);
        
        main.appendChild(layoutContainer);
        this.container.appendChild(main);

        // Fetch initial page of activities
        this.adminLogs = [];
        this.activityLoading = false;
        this._fetchActivities();

        this._renderTab();
        return this.container;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    _renderTab() {
        // Toggle persistent activity sidebar visibility (hide on overview, show on other tabs)
        if (this.activeTab === 'overview') {
            this.globalActivitySidebar.className = 'hidden flex-col bg-[#121212]';
        } else {
            this.globalActivitySidebar.className = 'sidebar-right-desktop flex-col bg-[#121212]';
        }

        this.contentArea.className = 'flex-1 px-lg md:px-xl py-lg md:py-xl min-w-0';
        this.contentArea.innerHTML = '';
        const map = {
            guru:          () => this._tabGuru(),
            siswa:         () => this._tabSiswa(),
            mapel:         () => this._tabMapel(),
            proktor:       () => this._tabProktor(),
            ujian:         () => this._tabUjian(),
            kelas:         () => this._tabKelas(),
            ruangan:       () => this._tabRuangan(),
            'token-sesi':  () => this._tabTokenSesi(),
        };

        const tabFn = map[this.activeTab];
        if (tabFn) {
            tabFn();
        } else {
            this._tabOverview();
        }
    }

    _createPersistentGlobalActivitySidebar() {
        const sidebar = createElement('aside', 'sidebar-right-desktop flex-col bg-[#121212]');
        sidebar.style.cssText = 'width: 300px; flex-shrink: 0; border-left: 1px solid #222222; height: 100vh; position: sticky; top: 0; z-index: 10;';
        
        sidebar.innerHTML = `
            <div class="p-4 border-b border-[#222222] flex items-center justify-between flex-shrink-0">
                <h2 class="font-inter font-bold text-sm text-text-primary" style="font-size: 14px;">Aktivitas Terbaru</h2>
                <div class="flex items-center gap-2">
                    <button id="global-activity-print-btn" class="material-icons text-text-muted hover:text-text-primary text-sm cursor-pointer" style="font-size: 16px;" title="Cetak Log">print</button>
                    <span class="w-1.5 h-1.5 rounded-full bg-online animate-pulse" title="Live"></span>
                    <span class="text-[10px] text-text-muted uppercase font-semibold tracking-wider">Live</span>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto min-h-0 flex flex-col justify-between" id="global-activity-scroll-container">
                <div id="global-activity-feed" class="flex flex-col flex-1"></div>
                <button id="global-activity-show-all" class="w-full py-3 text-center text-text-muted hover:text-text-primary text-[10px] font-semibold transition-colors hover:bg-[#161616] border-t border-[#222222] hidden">
                    Lihat Semua
                </button>
            </div>
        `;

        // Attach click event to Show All button
        const btn = sidebar.querySelector('#global-activity-show-all');
        if (btn) {
            btn.onclick = () => this._showAllActivitiesModal();
        }

        // Attach click event to Print button
        const printBtn = sidebar.querySelector('#global-activity-print-btn');
        if (printBtn) {
            printBtn.onclick = () => this._printActivities(this.adminLogs);
        }

        return sidebar;
    }

    async _fetchActivities() {
        if (this.activityLoading) return;
        this.activityLoading = true;

        const feed = this.globalActivitySidebar ? this.globalActivitySidebar.querySelector('#global-activity-feed') : null;
        if (feed) {
            feed.innerHTML = `
                <div class="flex items-center gap-2 p-4 text-text-muted justify-center">
                    <span class="material-icons animate-spin text-sm">progress_activity</span>
                    <span class="font-inter text-xs">Memuat aktivitas...</span>
                </div>
            `;
        }

        try {
            const res = await api.get('/admin/activity?limit=100');
            const logs = res.data?.data?.logs ?? [];
            this.adminLogs = logs.slice(0, 15);

            this._renderSidebarActivities();
            this._updateShowAllButton();
        } catch (err) {
            if (feed) {
                feed.innerHTML = `<p class="text-primary font-inter text-xs p-4 text-center">Gagal memuat aktivitas.</p>`;
            }
        } finally {
            this.activityLoading = false;
        }
    }

    _updateShowAllButton() {
        const btn = this.globalActivitySidebar ? this.globalActivitySidebar.querySelector('#global-activity-show-all') : null;
        if (!btn) return;
        if (this.adminLogs && this.adminLogs.length > 5) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }

    _renderSidebarActivities() {
        const feed = this.globalActivitySidebar ? this.globalActivitySidebar.querySelector('#global-activity-feed') : null;
        if (!feed) return;

        feed.innerHTML = '';
        const logsToShow = this.adminLogs.slice(0, 5);

        if (logsToShow.length === 0) {
            feed.innerHTML = `
                <div class="py-6 text-center">
                    <p class="font-inter text-xs text-text-muted">Belum ada aktivitas.</p>
                </div>
            `;
            return;
        }

        logsToShow.forEach(log => {
            const card = this._createActivityCard(log);
            feed.appendChild(card);
        });
    }

    _renderModalActivities(feed) {
        if (!feed) return;
        feed.innerHTML = '';

        if (this.adminLogs.length === 0) {
            feed.innerHTML = `
                <div class="py-6 text-center">
                    <p class="font-inter text-xs text-text-muted">Belum ada aktivitas.</p>
                </div>
            `;
            return;
        }

        this.adminLogs.forEach(log => {
            const card = this._createActivityCard(log);
            feed.appendChild(card);
        });
    }

    _showAllActivitiesModal() {
        createModal({
            title: 'Semua Aktivitas Log (Maksimal 15)',
            bodyHtml: '<div id="modal-activity-feed" class="flex flex-col gap-0 max-h-[60vh] overflow-y-auto min-w-[320px]"></div>',
            onMount: (bodyEl) => {
                const feed = bodyEl.querySelector('#modal-activity-feed');
                this._renderModalActivities(feed);
            },
            footerButtons: [
                { text: 'Tutup', variant: 'secondary', onClick: (close) => close() }
            ]
        });
    }

    _printActivities(logs = this.adminLogs) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast('Gagal membuka jendela cetak. Izinkan pop-up untuk situs ini.', 'error');
            return;
        }
        
        const rows = (logs || []).map((log, idx) => {
            const description = this._formatActivityDescription(log).replace(/<[^>]*>/g, '');
            const time = new Date(log.createdAt).toLocaleString('id-ID');
            const actor = log.actorName || 'Sistem';
            const action = log.action;
            return `
                <tr>
                    <td style="border: 1px solid #2e2e2e; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #2e2e2e; padding: 8px;">${time}</td>
                    <td style="border: 1px solid #2e2e2e; padding: 8px;"><b>${actor}</b></td>
                    <td style="border: 1px solid #2e2e2e; padding: 8px;">${action}</td>
                    <td style="border: 1px solid #2e2e2e; padding: 8px;">${description}</td>
                </tr>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
            <head>
                <title>Laporan Aktivitas Admin - EXAM PONCOL</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 20px; color: #111; background-color: #fff; }
                    h1 { font-size: 20px; margin-bottom: 5px; color: #000; }
                    p { font-size: 12px; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th { background-color: #f2f2f2; border: 1px solid #2e2e2e; padding: 8px; text-align: left; }
                </style>
            </head>
            <body>
                <h1>Laporan Aktivitas Terbaru Admin</h1>
                <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align: center;">No</th>
                            <th style="width: 150px;">Waktu</th>
                            <th style="width: 120px;">Aktor</th>
                            <th style="width: 150px;">Aksi</th>
                            <th>Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows : '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">Tidak ada data aktivitas.</td></tr>'}
                    </tbody>
                </table>
                <script>
                    window.onload = function() {
                        window.print();
                        window.close();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    _createActivityCard(log) {
        const meta = this._getActivityMeta(log.action);
        const description = this._formatActivityDescription(log);
        const relativeTime = this._relativeTime(log.createdAt);

        const card = createElement('div', 'activity-card flex items-start gap-3 p-3 transition-colors hover:bg-[#1a1a1a] border-b border-[#222222]');
        card.style.cssText = 'border-bottom: 1px solid #1f1f1f;';
        card.innerHTML = `
            <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style="background-color: ${meta.color}15; color: ${meta.color}">
                <span class="material-icons text-xs" style="font-size: 13px;">${meta.icon}</span>
            </div>
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <p class="font-inter text-xs text-text-secondary leading-normal">
                    ${description}
                </p>
                <span class="font-inter text-[9px] text-text-muted mt-1 self-start">
                    ${relativeTime}
                </span>
            </div>
        `;
        return card;
    }

    _getActivityMeta(action) {
        const act = String(action).toUpperCase();
        if (act.includes('IMPORT') || act.startsWith('CREATE')) {
            return { icon: 'add', color: '#00CC66' }; // Green for Import/Create
        } else if (act.startsWith('UPDATE') || act.includes('EDIT') || act === 'TOGGLE_SESSION') {
            return { icon: 'edit', color: '#C9A84C' }; // Yellow for Edit
        } else if (act.startsWith('DELETE') || act.includes('RESET') || act === 'LOGOUT') {
            return { icon: 'delete', color: '#EF4444' }; // Red for Delete/Reset/Logout
        } else if (act === 'LOGIN') {
            return { icon: 'login', color: '#00CC66' };
        }
        return { icon: 'info', color: '#AAAAAA' };
    }

    _formatActivityDescription(log) {
        const actor = log.actorName || 'Sistem';
        const target = log.targetLabel || '';
        switch (log.action) {
            case 'LOGIN':
                return `<span class="font-semibold text-text-primary">${actor}</span> masuk ke sistem`;
            case 'LOGOUT':
                return `<span class="font-semibold text-text-primary">${actor}</span> keluar dari sistem`;
            case 'IMPORT_QUESTIONS':
                return `<span class="font-semibold text-text-primary">${actor}</span> baru saja mengimpor soal <span class="text-text-primary">${target}</span>`;
            case 'CREATE_EXAM':
                return `<span class="font-semibold text-text-primary">${actor}</span> membuat ujian <span class="text-text-primary">${target}</span>`;
            case 'UPDATE_EXAM':
                return `<span class="font-semibold text-text-primary">${actor}</span> memperbarui ujian <span class="text-text-primary">${target}</span>`;
            case 'DELETE_EXAM':
                return `<span class="font-semibold text-text-primary">${actor}</span> menghapus ujian <span class="text-text-primary">${target}</span>`;
            case 'ACTIVATE_EXAM':
                return `<span class="font-semibold text-text-primary">${actor}</span> mengaktifkan ujian <span class="text-text-primary">${target}</span>`;
            case 'COMPLETE_EXAM':
                return `<span class="font-semibold text-text-primary">${actor}</span> menyelesaikan ujian <span class="text-text-primary">${target}</span>`;
            case 'RESET_EXAM_TOKEN':
                return `<span class="font-semibold text-text-primary">${actor}</span> me-reset token ujian <span class="text-text-primary">${target}</span>`;
            case 'CREATE_USER':
                return `<span class="font-semibold text-text-primary">${actor}</span> membuat pengguna <span class="text-text-primary">${target}</span>`;
            case 'UPDATE_USER':
                return `<span class="font-semibold text-text-primary">${actor}</span> memperbarui pengguna <span class="text-text-primary">${target}</span>`;
            case 'DELETE_USER':
                return `<span class="font-semibold text-text-primary">${actor}</span> menghapus pengguna <span class="text-text-primary">${target}</span>`;
            case 'CREATE_CLASS':
                return `<span class="font-semibold text-text-primary">${actor}</span> membuat kelas <span class="text-text-primary">${target}</span>`;
            case 'UPDATE_CLASS':
                return `<span class="font-semibold text-text-primary">${actor}</span> memperbarui kelas <span class="text-text-primary">${target}</span>`;
            case 'DELETE_CLASS':
                return `<span class="font-semibold text-text-primary">${actor}</span> menghapus kelas <span class="text-text-primary">${target}</span>`;
            case 'CREATE_BANK':
                return `<span class="font-semibold text-text-primary">${actor}</span> membuat bank soal <span class="text-text-primary">${target}</span>`;
            case 'UPDATE_BANK':
                return `<span class="font-semibold text-text-primary">${actor}</span> memperbarui bank soal <span class="text-text-primary">${target}</span>`;
            case 'DELETE_BANK':
                return `<span class="font-semibold text-text-primary">${actor}</span> menghapus bank soal <span class="text-text-primary">${target}</span>`;
            case 'CREATE_SESSION':
                return `<span class="font-semibold text-text-primary">${actor}</span> membuat token sesi <span class="text-text-primary">${target}</span>`;
            case 'TOGGLE_SESSION':
                return `<span class="font-semibold text-text-primary">${actor}</span> mengubah status sesi <span class="text-text-primary">${target}</span>`;
            case 'CREATE_ROOM':
                return `<span class="font-semibold text-text-primary">${actor}</span> membuat ruangan <span class="text-text-primary">${target}</span>`;
            case 'UPDATE_ROOM':
                return `<span class="font-semibold text-text-primary">${actor}</span> memperbarui ruangan <span class="text-text-primary">${target}</span>`;
            case 'DELETE_ROOM':
                return `<span class="font-semibold text-text-primary">${actor}</span> menghapus ruangan <span class="text-text-primary">${target}</span>`;
            case 'RESET_STUDENT_SESSION':
                return `<span class="font-semibold text-text-primary">${actor}</span> me-reset sesi ujian <span class="text-text-primary">${target}</span>`;
            default:
                return `<span class="font-semibold text-text-primary">${actor}</span> melakukan aksi ${log.action} ${target ? `pada <span class="text-text-primary">${target}</span>` : ''}`;
        }
    }

    _relativeTime(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1)  return 'Baru saja';
        if (m < 60) return `${m} menit lalu`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} jam lalu`;
        const d = Math.floor(h / 24);
        return `${d} hari lalu`;
    }

    _handleNewGlobalActivity(log) {
        this._handleNewActivity(log);
    }

    _handleNewActivity(log) {
        if (!log || !log.id) return;
        if (!this.adminLogs) this.adminLogs = [];

        // Prevent duplicate logs from being added
        if (this.adminLogs.some(existingLog => existingLog.id === log.id)) {
            return;
        }

        this.adminLogs.unshift(log);
        this.adminLogs = this.adminLogs.slice(0, 15);

        this._renderSidebarActivities();
        this._updateShowAllButton();

        const modalFeed = document.getElementById('modal-activity-feed');
        if (modalFeed) {
            this._renderModalActivities(modalFeed);
        }

        if (this.activeTab === 'overview') {
            const feed = this.contentArea ? this.contentArea.querySelector('#activity-feed') : null;
            const actPanel = feed ? feed.closest('.bg-bg-surface') : null;
            if (feed && actPanel) {
                this._renderOverviewActivities(feed, actPanel);
            }

            const modalFeedOverview = document.getElementById('modal-overview-activity-feed');
            if (modalFeedOverview) {
                this._renderModalOverviewActivities(modalFeedOverview);
            }
        }
    }

    _header(title, subtitle, btnLabel, onBtn, btn2Label, onBtn2) {
        const h = createElement('div', 'flex flex-wrap items-start justify-between gap-md mb-xl');
        h.innerHTML = `<div>
            <h1 class="font-barlow font-extrabold text-page-title text-text-primary mb-xs">${title}</h1>
            <p class="font-inter text-text-secondary text-sm">${subtitle}</p>
        </div>`;
        if (btnLabel || btn2Label) {
            const btnWrap = createElement('div', 'flex gap-sm');
            if (btn2Label) btnWrap.appendChild(createButton(btn2Label, { size: 'sm', variant: 'secondary', icon: 'upload_file', className: 'w-auto', onClick: onBtn2 }));
            if (btnLabel)  btnWrap.appendChild(createButton(btnLabel,  { size: 'sm', icon: 'add_circle',   className: 'w-auto', onClick: onBtn }));
            h.appendChild(btnWrap);
        }
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
        this.contentArea.appendChild(this._header('OVERVIEW SEKOLAH', `Selamat datang, ${user?.name || 'Admin'}`));
        
        // Stat cards grid
        const grid = createElement('div', 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-xl');
        this.contentArea.appendChild(grid);

        // Placeholder cards while loading
        for (let i = 0; i < 4; i++) {
            const ph = createElement('div', 'bg-bg-surface rounded-lg p-5 animate-pulse');
            ph.style.cssText = 'border: 1px solid #2e2e2e; height: 96px;';
            grid.appendChild(ph);
        }

        // Two-column layout: activity (left) + quick actions (right)
        const twoCol = createElement('div', 'grid grid-cols-1 lg:grid-cols-3 gap-md');
        this.contentArea.appendChild(twoCol);

        // Activity log panel (Left, lg:col-span-2)
        const actPanel = createElement('div', 'lg:col-span-2 bg-bg-surface rounded-lg p-5 border border-divider flex flex-col justify-between');
        actPanel.style.cssText = 'border: 1px solid #2e2e2e; min-height: 350px;';
        actPanel.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <span class="material-icons text-text-muted text-base">history</span>
                        <span class="font-inter font-semibold text-sm text-text-primary">Aktivitas Terbaru Admin</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="activity-print-btn" class="material-icons text-text-muted hover:text-text-primary text-sm cursor-pointer" title="Cetak Log">print</button>
                        <div class="w-2 h-2 rounded-full bg-online animate-pulse" id="activity-live-dot" title="Live"></div>
                    </div>
                </div>
                <div id="activity-feed" class="flex flex-col gap-0">
                    <div class="flex items-center gap-2 py-3 text-text-muted">
                        <span class="material-icons animate-spin text-sm">progress_activity</span>
                        <span class="font-inter text-xs">Memuat aktivitas...</span>
                    </div>
                </div>
            </div>
            <div class="mt-4 pt-3 border-t border-divider flex justify-end hidden" id="activity-show-all-container">
                <button id="activity-show-all-btn" class="px-3 py-1.5 rounded bg-transparent border border-divider text-text-secondary hover:text-text-primary hover:bg-[#1f1f1f] transition-colors font-inter text-xs font-semibold">
                    Lihat Semua
                </button>
            </div>
        `;
        twoCol.appendChild(actPanel);

        // Quick actions panel (Right, lg:col-span-1)
        const quickPanel = createElement('div', 'bg-bg-surface rounded-lg p-5 border border-divider');
        quickPanel.style.cssText = 'border: 1px solid #2e2e2e;';
        quickPanel.innerHTML = `
            <div class="flex items-center gap-2 mb-4">
                <span class="material-icons text-text-muted text-base">bolt</span>
                <span class="font-inter font-semibold text-sm text-text-primary">Aksi Cepat</span>
            </div>
        `;
        
        const quickActions = [
            { icon: 'person_add',    label: 'Tambah Guru',    onClick: () => window.app.router.navigate('/admin?tab=guru') },
            { icon: 'group_add',     label: 'Tambah Siswa',   onClick: () => window.app.router.navigate('/admin?tab=siswa') },
            { icon: 'add_box',       label: 'Buat Ujian',     onClick: () => window.app.router.navigate('/admin?tab=ujian') },
            { icon: 'key',           label: 'Token Sesi',     onClick: () => window.app.router.navigate('/admin?tab=token-sesi') },
            { icon: 'menu_book',     label: 'Bank Soal',      onClick: () => window.app.router.navigate('/admin?tab=mapel') },
            { icon: 'meeting_room',  label: 'Ruangan',        onClick: () => window.app.router.navigate('/admin?tab=ruangan') },
        ];
        
        const qaGrid = createElement('div', 'grid grid-cols-2 gap-2');
        quickActions.forEach(qa => {
            const btn = createElement('button',
                'flex items-center gap-2 px-3 py-2.5 rounded text-left font-inter text-xs text-text-secondary hover:text-text-primary hover:bg-sidebar-hover transition-colors w-full border border-divider'
            );
            btn.style.cssText = 'border: 1px solid #262626; background-color: #171717;';
            btn.innerHTML = `<span class="material-icons text-xs text-text-muted">${qa.icon}</span><span class="truncate font-semibold">${qa.label}</span>`;
            btn.onclick = qa.onClick;
            qaGrid.appendChild(btn);
        });
        quickPanel.appendChild(qaGrid);
        twoCol.appendChild(quickPanel);

        try {
            const [usersRes, examsRes, logsRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/exams'),
                api.get('/admin/activity?limit=100').catch(() => null),
            ]);

            const users = usersRes.data?.data ?? [];
            const exams = examsRes.data?.data ?? [];
            
            grid.innerHTML = '';
            grid.appendChild(createStatCard({ icon: 'school',       label: 'Total Guru',  value: users.filter(u => u.role === 'teacher').length, accent: 'gold' }));
            grid.appendChild(createStatCard({ icon: 'groups',       label: 'Total Siswa', value: users.filter(u => u.role === 'student').length, accent: 'primary' }));
            grid.appendChild(createStatCard({ icon: 'fact_check',   label: 'Total Ujian', value: exams.length, accent: 'online' }));
            grid.appendChild(createStatCard({ icon: 'check_circle', label: 'Ujian Aktif', value: exams.filter(e => e.status === 'active').length, accent: 'muted' }));

            // Render activity feed
            const feed = actPanel.querySelector('#activity-feed');
            const logs = logsRes?.data?.data?.logs ?? [];
            this.adminLogs = logs.slice(0, 15);
            
            this._renderOverviewActivities(feed, actPanel);
            
            // Render sidebar as well
            this._renderSidebarActivities();
            this._updateShowAllButton();

            // Bind print button in overview panel
            const printBtn = actPanel.querySelector('#activity-print-btn');
            if (printBtn) {
                printBtn.onclick = () => this._printActivities(this.adminLogs);
            }
        } catch (_) {
            grid.innerHTML = `<p class="text-text-muted font-inter text-sm col-span-4">Gagal memuat statistik.</p>`;
        }
    }

    _renderOverviewActivities(feed, actPanel) {
        if (!feed) return;
        
        const logsToShow = this.adminLogs.slice(0, 5);
        
        if (logsToShow.length === 0) {
            feed.innerHTML = `
                <div class="py-6 text-center">
                    <span class="material-icons text-text-muted text-2xl block mb-2">inbox</span>
                    <p class="font-inter text-xs text-text-muted">Belum ada aktivitas tercatat untuk Admin.</p>
                </div>
            `;
            const showAllContainer = actPanel.querySelector('#activity-show-all-container');
            if (showAllContainer) showAllContainer.classList.add('hidden');
            return;
        }

        const actionLabels = {
            CREATE_EXAM:      { icon: 'add_circle',     label: 'Buat Ujian',         color: 'text-online' },
            UPDATE_EXAM:      { icon: 'edit',           label: 'Edit Ujian',          color: 'text-accent-gold' },
            DELETE_EXAM:      { icon: 'delete',         label: 'Hapus Ujian',         color: 'text-primary' },
            ACTIVATE_EXAM:    { icon: 'play_circle',    label: 'Aktifkan Ujian',      color: 'text-online' },
            COMPLETE_EXAM:    { icon: 'check_circle',   label: 'Tutup Ujian',         color: 'text-text-muted' },
            RESET_EXAM_TOKEN: { icon: 'refresh',        label: 'Reset Token Ujian',   color: 'text-accent-gold' },
            CREATE_USER:      { icon: 'person_add',     label: 'Tambah Pengguna',     color: 'text-online' },
            UPDATE_USER:      { icon: 'manage_accounts',label: 'Edit Pengguna',       color: 'text-accent-gold' },
            DELETE_USER:      { icon: 'person_remove',  label: 'Hapus Pengguna',      color: 'text-primary' },
            CREATE_CLASS:     { icon: 'add_circle',     label: 'Buat Kelas',          color: 'text-online' },
            UPDATE_CLASS:     { icon: 'edit',           label: 'Edit Kelas',          color: 'text-accent-gold' },
            DELETE_CLASS:     { icon: 'delete',         label: 'Hapus Kelas',         color: 'text-primary' },
            CREATE_ROOM:      { icon: 'meeting_room',   label: 'Buat Ruangan',       color: 'text-online' },
            UPDATE_ROOM:      { icon: 'edit',           label: 'Edit Ruangan',       color: 'text-accent-gold' },
            DELETE_ROOM:      { icon: 'delete',         label: 'Hapus Ruangan',      color: 'text-primary' },
            CREATE_BANK:      { icon: 'library_add',    label: 'Buat Bank Soal',      color: 'text-online' },
            UPDATE_BANK:      { icon: 'edit',           label: 'Edit Bank Soal',      color: 'text-accent-gold' },
            DELETE_BANK:      { icon: 'delete',         label: 'Hapus Bank Soal',     color: 'text-primary' },
            CREATE_SESSION:   { icon: 'key',            label: 'Buat Token Sesi',     color: 'text-accent-gold' },
            TOGGLE_SESSION:   { icon: 'toggle_on',      label: 'Ubah Status Sesi',    color: 'text-text-muted' },
            LOGIN:            { icon: 'login',           label: 'Login',               color: 'text-online' },
            LOGOUT:           { icon: 'logout',          label: 'Logout',              color: 'text-primary' },
            IMPORT_QUESTIONS: { icon: 'upload_file',     label: 'Impor Soal',          color: 'text-online' },
            RESET_STUDENT_SESSION: { icon: 'restart_alt', label: 'Reset Sesi Siswa',    color: 'text-primary' },
        };

        feed.innerHTML = '';
        logsToShow.forEach((log, idx) => {
            const meta = actionLabels[log.action] || { icon: 'info', label: log.action, color: 'text-text-muted' };
            const isLast = idx === logsToShow.length - 1;
            const item = createElement('div', `flex items-start gap-3 py-3 ${!isLast ? 'border-b border-divider' : ''}`);
            if (!isLast) item.style.cssText = 'border-bottom: 1px solid #262626;';
            item.innerHTML = `
                <div class="w-7 h-7 rounded-md bg-bg-primary flex items-center justify-center flex-shrink-0 mt-0.5" style="border:1px solid #2e2e2e">
                    <span class="material-icons text-xs ${meta.color}">${meta.icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-inter text-xs font-semibold text-text-primary">${meta.label}</span>
                        <span class="font-inter text-xs text-text-muted flex-shrink-0">${this._relativeTime(log.createdAt)}</span>
                    </div>
                    <div class="font-inter text-xs text-text-muted mt-0.5 truncate">
                        <span class="font-medium text-text-secondary">${log.actorName}</span>
                        ${log.targetLabel ? ` · <span>${log.targetLabel}</span>` : ''}
                    </div>
                </div>
            `;
            feed.appendChild(item);
        });

        // Update button visibility
        const showAllContainer = actPanel.querySelector('#activity-show-all-container');
        if (showAllContainer) {
            if (this.adminLogs.length > 5) {
                showAllContainer.classList.remove('hidden');
                const btn = showAllContainer.querySelector('#activity-show-all-btn');
                if (btn) {
                    btn.onclick = () => this._showAllOverviewActivitiesModal();
                }
            } else {
                showAllContainer.classList.add('hidden');
            }
        }
    }

    _showAllOverviewActivitiesModal() {
        createModal({
            title: 'Semua Aktivitas Admin (Hanya Save 15 Log)',
            bodyHtml: '<div id="modal-overview-activity-feed" class="flex flex-col gap-0 max-h-[60vh] overflow-y-auto min-w-[350px]"></div>',
            onMount: (bodyEl) => {
                const feed = bodyEl.querySelector('#modal-overview-activity-feed');
                this._renderModalOverviewActivities(feed);
            },
            footerButtons: [
                { text: 'Tutup', variant: 'secondary', onClick: (close) => close() }
            ]
        });
    }

    _renderModalOverviewActivities(feed) {
        if (!feed) return;
        feed.innerHTML = '';

        const actionLabels = {
            CREATE_EXAM:      { icon: 'add_circle',     label: 'Buat Ujian',         color: 'text-online' },
            UPDATE_EXAM:      { icon: 'edit',           label: 'Edit Ujian',          color: 'text-accent-gold' },
            DELETE_EXAM:      { icon: 'delete',         label: 'Hapus Ujian',         color: 'text-primary' },
            ACTIVATE_EXAM:    { icon: 'play_circle',    label: 'Aktifkan Ujian',      color: 'text-online' },
            COMPLETE_EXAM:    { icon: 'check_circle',   label: 'Tutup Ujian',         color: 'text-text-muted' },
            RESET_EXAM_TOKEN: { icon: 'refresh',        label: 'Reset Token Ujian',   color: 'text-accent-gold' },
            CREATE_USER:      { icon: 'person_add',     label: 'Tambah Pengguna',     color: 'text-online' },
            UPDATE_USER:      { icon: 'manage_accounts',label: 'Edit Pengguna',       color: 'text-accent-gold' },
            DELETE_USER:      { icon: 'person_remove',  label: 'Hapus Pengguna',      color: 'text-primary' },
            CREATE_CLASS:     { icon: 'add_circle',     label: 'Buat Kelas',          color: 'text-online' },
            UPDATE_CLASS:     { icon: 'edit',           label: 'Edit Kelas',          color: 'text-accent-gold' },
            DELETE_CLASS:     { icon: 'delete',         label: 'Hapus Kelas',         color: 'text-primary' },
            CREATE_ROOM:      { icon: 'meeting_room',   label: 'Buat Ruangan',       color: 'text-online' },
            UPDATE_ROOM:      { icon: 'edit',           label: 'Edit Ruangan',       color: 'text-accent-gold' },
            DELETE_ROOM:      { icon: 'delete',         label: 'Hapus Ruangan',      color: 'text-primary' },
            CREATE_BANK:      { icon: 'library_add',    label: 'Buat Bank Soal',      color: 'text-online' },
            UPDATE_BANK:      { icon: 'edit',           label: 'Edit Bank Soal',      color: 'text-accent-gold' },
            DELETE_BANK:      { icon: 'delete',         label: 'Hapus Bank Soal',     color: 'text-primary' },
            CREATE_SESSION:   { icon: 'key',            label: 'Buat Token Sesi',     color: 'text-accent-gold' },
            TOGGLE_SESSION:   { icon: 'toggle_on',      label: 'Ubah Status Sesi',    color: 'text-text-muted' },
            LOGIN:            { icon: 'login',           label: 'Login',               color: 'text-online' },
            LOGOUT:           { icon: 'logout',          label: 'Logout',              color: 'text-primary' },
            IMPORT_QUESTIONS: { icon: 'upload_file',     label: 'Impor Soal',          color: 'text-online' },
            RESET_STUDENT_SESSION: { icon: 'restart_alt', label: 'Reset Sesi Siswa',    color: 'text-primary' },
        };

        this.adminLogs.forEach((log, idx) => {
            const meta = actionLabels[log.action] || { icon: 'info', label: log.action, color: 'text-text-muted' };
            const isLast = idx === this.adminLogs.length - 1;
            const item = createElement('div', `flex items-start gap-3 py-3 ${!isLast ? 'border-b border-divider' : ''}`);
            if (!isLast) item.style.cssText = 'border-bottom: 1px solid #262626;';
            item.innerHTML = `
                <div class="w-7 h-7 rounded-md bg-bg-primary flex items-center justify-center flex-shrink-0 mt-0.5" style="border:1px solid #2e2e2e">
                    <span class="material-icons text-xs ${meta.color}">${meta.icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-inter text-xs font-semibold text-text-primary">${meta.label}</span>
                        <span class="font-inter text-xs text-text-muted flex-shrink-0">${this._relativeTime(log.createdAt)}</span>
                    </div>
                    <div class="font-inter text-xs text-text-muted mt-0.5 truncate">
                        <span class="font-medium text-text-secondary">${log.actorName}</span>
                        ${log.targetLabel ? ` · <span>${log.targetLabel}</span>` : ''}
                    </div>
                </div>
            `;
            feed.appendChild(item);
        });
    }

    // ── Tab Guru ───────────────────────────────────────────────────────────────

    async _tabGuru() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('KELOLA GURU', 'Tambah dan kelola akun guru.', 'TAMBAH GURU', () => this._modalUser(null, 'teacher')));
        
        if (this._guruFilterSearch === undefined) {
            this._guruFilterSearch = '';
        }

        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/users?role=teacher');
            const teachers = res.data?.data ?? [];
            wrap.innerHTML = '';

            // Filter Bar
            const filterBar = createElement('div', 'bg-bg-surface border border-divider rounded-card p-4 flex flex-col gap-md mb-md');
            filterBar.innerHTML = `
                <div class="flex flex-col md:flex-row gap-md items-center w-full">
                    <!-- Search -->
                    <div class="relative flex-1 w-full">
                        <span class="material-icons absolute left-3 top-3 text-text-muted text-lg">search</span>
                        <input id="f-search" type="text" placeholder="Cari nama atau NIP/NISN..." value="${this._guruFilterSearch}" 
                               class="w-full pl-10 pr-4 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                    </div>

                    <!-- Reset -->
                    <button id="btn-reset" class="w-full md:w-auto px-4 py-2.5 bg-[#2A2A2A] hover:bg-[#333333] border border-divider hover:border-gray-500 rounded-input text-text-secondary hover:text-text-primary text-sm flex items-center justify-center gap-1 transition-colors">
                        <span class="material-icons text-base">restart_alt</span>
                        Reset
                    </button>
                </div>
            `;
            wrap.appendChild(filterBar);

            const tableWrapper = createElement('div', '');
            wrap.appendChild(tableWrapper);

            const cols = [
                { key: 'name',     label: 'Nama' },
                { key: 'nisn',     label: 'NIP / NISN' },
                { key: 'verified', label: 'Status', render: r => statusPill(r.verified ? 'aktif' : 'nonaktif') },
                { key: 'actions',  label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-uid="${r.id}">
                        <button class="u-edit material-icons text-text-muted hover:text-online text-lg">edit</button>
                        <button class="u-del material-icons text-text-muted hover:text-primary text-lg">delete</button>
                    </div>` },
            ];

            const renderGuruTable = () => {
                tableWrapper.innerHTML = '';
                const searchVal = this._guruFilterSearch.toLowerCase();
                const filtered = teachers.filter(t => {
                    return !searchVal || 
                        t.name.toLowerCase().includes(searchVal) || 
                        (t.nisn && t.nisn.includes(searchVal));
                });

                const tableEl = createTable(cols, filtered, { emptyMessage: 'Tidak ada data guru yang cocok.' });
                tableWrapper.appendChild(tableEl);

                tableEl.querySelectorAll('[data-uid]').forEach(el => {
                    const u = filtered.find(t => t.id === Number(el.dataset.uid));
                    if (u) {
                        el.querySelector('.u-edit').onclick = () => this._modalUser(u, 'teacher');
                        el.querySelector('.u-del').onclick  = () => this._confirmDelete(u, 'admin/users');
                    }
                });
            };

            // Event Listeners
            const searchInput = filterBar.querySelector('#f-search');
            let searchTimeout = null;
            searchInput.oninput = (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this._guruFilterSearch = e.target.value.trim();
                    renderGuruTable();
                }, 300);
            };

            const btnReset = filterBar.querySelector('#btn-reset');
            btnReset.onclick = () => {
                searchInput.value = '';
                this._guruFilterSearch = '';
                renderGuruTable();
            };

            renderGuruTable();

        } catch (e) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat data guru.', () => this._renderTab()));
        }
    }

    // ── Tab Siswa ──────────────────────────────────────────────────────────────

    async _tabSiswa() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header(
            'KELOLA SISWA', 'Tambah, edit, dan kelola akun siswa.',
            'TAMBAH SISWA', () => this._modalUser(null, 'student'),
            'IMPORT EXCEL',  () => this._modalImportSiswa()
        ));

        if (this._siswaFilterSearch === undefined) {
            this._siswaFilterSearch = '';
            this._siswaFilterGrade = '';
            this._siswaFilterMajor = '';
            this._siswaFilterYear = '';
        }

        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        const getGradeFromClass = (cls) => {
            if (!cls) return '';
            const upper = cls.toUpperCase();
            if (upper.startsWith('XII') || upper.includes(' XII ')) return 'XII';
            if (upper.startsWith('XI') || upper.includes(' XI ')) return 'XI';
            if (upper.startsWith('X') || upper.includes(' X ')) return 'X';
            return '';
        };

        try {
            const [usersRes, classesRes] = await Promise.all([
                api.get('/admin/users?role=student'),
                api.get('/admin/classes')
            ]);
            const students = usersRes.data?.data ?? [];
            const classes = classesRes.data?.data ?? [];
            const majors = [...new Set(classes.map(c => c.major).filter(Boolean))].sort();

            wrap.innerHTML = '';

            const getMajorFromClass = (cls) => {
                if (!cls) return '';
                const upper = cls.toUpperCase();
                for (const m of majors) {
                    if (upper.includes(m.toUpperCase())) return m;
                }
                const parts = cls.split(/[\s-]+/);
                if (parts.length > 1) return parts[1];
                return '';
            };

            // Filter Bar
            const filterBar = createElement('div', 'bg-bg-surface border border-divider rounded-card p-4 flex flex-col gap-md mb-md');
            filterBar.innerHTML = `
                <div class="flex flex-col md:flex-row gap-md items-center w-full">
                    <!-- Search -->
                    <div class="relative flex-1 w-full">
                        <span class="material-icons absolute left-3 top-3 text-text-muted text-lg">search</span>
                        <input id="f-search" type="text" placeholder="Cari nama atau NISN..." value="${this._siswaFilterSearch}" 
                               class="w-full pl-10 pr-4 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                    </div>
                    
                    <!-- Grade -->
                    <div class="w-full md:w-48">
                        <select id="f-grade" class="w-full px-3 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                            <option value="">Semua Tingkat</option>
                            <option value="X" ${this._siswaFilterGrade === 'X' ? 'selected' : ''}>Kelas X</option>
                            <option value="XI" ${this._siswaFilterGrade === 'XI' ? 'selected' : ''}>Kelas XI</option>
                            <option value="XII" ${this._siswaFilterGrade === 'XII' ? 'selected' : ''}>Kelas XII</option>
                        </select>
                    </div>

                    <!-- Major -->
                    <div class="w-full md:w-48">
                        <select id="f-major" class="w-full px-3 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                            <option value="">Semua Jurusan</option>
                            ${majors.map(m => `<option value="${m}" ${this._siswaFilterMajor === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Year -->
                    <div class="w-full md:w-48">
                        <select id="f-year" class="w-full px-3 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                            <option value="">Semua Tahun</option>
                        </select>
                    </div>

                    <!-- Reset -->
                    <button id="btn-reset" class="w-full md:w-auto px-4 py-2.5 bg-[#2A2A2A] hover:bg-[#333333] border border-divider hover:border-gray-500 rounded-input text-text-secondary hover:text-text-primary text-sm flex items-center justify-center gap-1 transition-colors">
                        <span class="material-icons text-base">restart_alt</span>
                        Reset
                    </button>
                </div>
            `;
            wrap.appendChild(filterBar);

            // Populate Year
            const years = [...new Set(students.map(s => s.academicYear || s.year).filter(Boolean))].sort();
            const yearSel = filterBar.querySelector('#f-year');
            years.forEach(yr => {
                const opt = document.createElement('option');
                opt.value = yr;
                opt.textContent = yr;
                if (yr === this._siswaFilterYear) opt.selected = true;
                yearSel.appendChild(opt);
            });

            const tableWrapper = createElement('div', '');
            wrap.appendChild(tableWrapper);

            const cols = [
                { key: 'name',         label: 'Nama Siswa' },
                { key: 'nisn',         label: 'NISN' },
                { key: 'class',        label: 'Kelas' },
                { key: 'room',         label: 'Ruang' },
                { key: 'academicYear', label: 'Tahun Ajaran', render: r => r.academicYear || r.year || '-' },
                { key: 'actions',      label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-uid="${r.id}">
                        <button class="u-edit material-icons text-text-muted hover:text-online text-lg">edit</button>
                        <button class="u-del material-icons text-text-muted hover:text-primary text-lg">delete</button>
                    </div>` },
            ];

            const renderSiswaTable = () => {
                tableWrapper.innerHTML = '';
                const searchVal = this._siswaFilterSearch.toLowerCase();
                const gradeVal  = this._siswaFilterGrade;
                const majorVal  = this._siswaFilterMajor;
                const yearVal   = this._siswaFilterYear;

                const filtered = students.filter(s => {
                    const searchMatch = !searchVal || 
                        s.name.toLowerCase().includes(searchVal) || 
                        (s.nisn && s.nisn.includes(searchVal));
                    
                    const grade = getGradeFromClass(s.class);
                    const gradeMatch = !gradeVal || grade === gradeVal;
                    
                    const sMajor = getMajorFromClass(s.class);
                    const majorMatch = !majorVal || sMajor.toUpperCase() === majorVal.toUpperCase();
                    
                    const yearMatch = !yearVal || (s.academicYear === yearVal || s.year === yearVal);
                    
                    return searchMatch && gradeMatch && majorMatch && yearMatch;
                });

                const tableEl = createTable(cols, filtered, { emptyMessage: 'Tidak ada data siswa yang cocok.' });
                tableWrapper.appendChild(tableEl);

                tableEl.querySelectorAll('[data-uid]').forEach(el => {
                    const u = filtered.find(s => s.id === Number(el.dataset.uid));
                    if (u) {
                        el.querySelector('.u-edit').onclick = () => this._modalUser(u, 'student');
                        el.querySelector('.u-del').onclick  = () => this._confirmDelete(u, 'admin/users');
                    }
                });
            };

            // Event Listeners
            const searchInput = filterBar.querySelector('#f-search');
            let searchTimeout = null;
            searchInput.oninput = (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this._siswaFilterSearch = e.target.value.trim();
                    renderSiswaTable();
                }, 300);
            };

            const gradeSel = filterBar.querySelector('#f-grade');
            gradeSel.onchange = (e) => {
                this._siswaFilterGrade = e.target.value;
                renderSiswaTable();
            };

            const majorSel = filterBar.querySelector('#f-major');
            majorSel.onchange = (e) => {
                this._siswaFilterMajor = e.target.value;
                renderSiswaTable();
            };

            yearSel.onchange = (e) => {
                this._siswaFilterYear = e.target.value;
                renderSiswaTable();
            };

            const btnReset = filterBar.querySelector('#btn-reset');
            btnReset.onclick = () => {
                searchInput.value = '';
                gradeSel.value = '';
                majorSel.value = '';
                yearSel.value = '';
                this._siswaFilterSearch = '';
                this._siswaFilterGrade = '';
                this._siswaFilterMajor = '';
                this._siswaFilterYear = '';
                renderSiswaTable();
            };

            renderSiswaTable();

        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat data siswa.', () => this._renderTab()));
        }
    }

    // ── Modal Import Siswa Excel ───────────────────────────────────────────────

    _modalImportSiswa() {
        createModal({
            title: 'Import Siswa via Excel',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div class="p-md bg-bg-primary border border-gray-700 rounded-card">
                        <p class="font-inter text-sm text-text-secondary mb-sm">
                            Unduh template, isi data siswa, lalu upload kembali.
                        </p>
                        <button id="btn-dl-template"
                            class="flex items-center gap-xs px-md py-sm bg-bg-surface border border-gray-600 rounded-btn text-text-primary font-inter text-sm hover:border-online transition-colors">
                            <span class="material-icons text-base text-online">download</span>
                            Unduh Template Excel
                        </button>
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Upload File Excel (.xlsx)</label>
                        <input id="imp-file" type="file" accept=".xlsx"
                            class="w-full text-text-secondary font-inter text-sm file:mr-sm file:py-sm file:px-md file:rounded-btn file:border file:border-gray-600 file:bg-bg-surface file:text-text-primary file:font-inter file:text-sm hover:file:border-online cursor-pointer">
                    </div>
                    <div id="imp-preview" class="hidden"></div>
                    <div id="imp-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            onMount: (bodyEl) => {
                bodyEl.querySelector('#btn-dl-template').onclick = async () => {
                    try {
                        const res = await api.get('/admin/import/siswa/template', { responseType: 'blob' });
                        const url = window.URL.createObjectURL(new Blob([res.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', 'template_import_siswa.xlsx');
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                    } catch (e) {
                        showToast('Gagal mengunduh template. Pastikan Anda memiliki akses admin.', 'error');
                    }
                };
            },
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Upload & Proses', variant: 'primary', onClick: async (close, bodyEl) => {
                    const fileInput = bodyEl.querySelector('#imp-file');
                    const errEl     = bodyEl.querySelector('#imp-err');
                    const showErr   = msg => { errEl.textContent = msg; errEl.classList.remove('hidden'); };

                    if (!fileInput.files.length) return showErr('Pilih file Excel terlebih dahulu.');

                    const formData = new FormData();
                    formData.append('file', fileInput.files[0]);

                    try {
                        const res = await api.post('/admin/import/siswa', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        });
                        const data = res.data?.data;

                        // Ada typo yang tidak bisa di-resolve otomatis → tampilkan konfirmasi
                        if (data?.needsConfirmation && data.unresolved?.length) {
                            close();
                            this._modalResolveTypo(data);
                            return;
                        }

                        close();
                        showToast(`Berhasil import ${data?.imported ?? 0} siswa.`, 'success');
                        this._renderTab();
                    } catch (e) {
                        showErr(e.response?.data?.message || 'Gagal memproses file.');
                    }
                }},
            ],
        });
    }

    // ── Modal Resolve Typo Jurusan ─────────────────────────────────────────────

    _modalResolveTypo(data) {
        // data.unresolved = [{ row, nama, nisn, tingkat, jurusanRaw, nomor }]
        const rows = data.unresolved ?? [];

        const rowsHtml = rows.map((r, i) => `
            <div class="p-sm border border-gray-700 rounded-card mb-sm">
                <p class="font-inter text-sm text-text-primary mb-xs">
                    Baris ${r.row}: <strong>${r.nama}</strong> — jurusan tidak dikenal: 
                    <span class="font-mono text-primary font-bold">"${r.jurusanRaw}"</span>
                </p>
                <select data-i="${i}" class="typo-fix w-full px-sm py-xs bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter text-sm">
                    <option value="">-- Pilih Jurusan yang Benar --</option>
                    ${JURUSAN_LIST.map(j => `<option value="${j}">${j}</option>`).join('')}
                </select>
            </div>`).join('');

        createModal({
            title: '⚠️ Jurusan Tidak Dikenal',
            bodyHtml: `
                <div class="flex flex-col gap-sm">
                    <p class="font-inter text-sm text-text-secondary mb-sm">
                        ${rows.length} baris memiliki jurusan yang tidak bisa dikenali otomatis.
                        Pilih jurusan yang benar untuk setiap baris, lalu klik Lanjutkan.
                    </p>
                    ${rowsHtml}
                    <div id="typo-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Lanjutkan Import', variant: 'primary', onClick: async (close, bodyEl) => {
                    const errEl  = bodyEl.querySelector('#typo-err');
                    const showErr = msg => { errEl.textContent = msg; errEl.classList.remove('hidden'); };

                    const fixes = [];
                    let valid = true;
                    bodyEl.querySelectorAll('.typo-fix').forEach((sel, i) => {
                        if (!sel.value) { valid = false; showErr(`Pilih jurusan untuk semua baris.`); return; }
                        fixes.push({ ...rows[i], jurusanFixed: sel.value });
                    });
                    if (!valid) return;

                    try {
                        const res = await api.post('/admin/import/siswa/confirm', {
                            sessionToken: data.sessionToken,
                            fixes,
                        });
                        close();
                        showToast(`Berhasil import ${res.data?.data?.imported ?? 0} siswa.`, 'success');
                        this._renderTab();
                    } catch (e) {
                        showErr(e.response?.data?.message || 'Gagal menyimpan.');
                    }
                }},
            ],
        });
    }

    // ── Modal User (guru / siswa) ──────────────────────────────────────────────

    async _modalUser(existing, role) {
        const isEdit    = !!existing;
        const roleLabel = role === 'teacher' ? 'Guru' : 'Siswa';

        createModal({
            title: isEdit ? `Edit ${roleLabel}` : `Tambah ${roleLabel}`,
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Nama Lengkap</label>
                        <input id="u-name" type="text" value="${isEdit ? existing.name : ''}" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">NISN / NIP</label>
                        <input id="u-nisn" type="text" value="${isEdit ? existing.nisn : ''}" ${isEdit ? 'disabled' : ''} class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter disabled:opacity-50">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Password ${isEdit ? '(kosongkan jika tidak diganti)' : ''}</label>
                        <input id="u-pass" type="password" placeholder="${isEdit ? 'Isi untuk mengganti' : 'Min 6 karakter'}" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    ${role === 'student' ? `
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Kelas</label>
                        <div id="u-class-wrap"></div>
                    </div>
                    <div id="u-room-wrap">
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Ruang</label>
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Tahun Ajaran</label>
                        <input id="u-academic-year" type="text" value="${isEdit ? (existing.academicYear || '') : '2026/2027'}" placeholder="cth. 2026/2027" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>` : ''}
                    <div id="u-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            onMount: async (bodyEl) => {
                if (role === 'student') {
                    const wrap = bodyEl.querySelector('#u-class-wrap');
                    // Dropdown kelas dari API, dikelompokkan per grade
                    const sel = document.createElement('select');
                    sel.id = 'u-class';
                    sel.className = 'w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter';
                    sel.innerHTML = '<option value="">Memuat kelas...</option>';
                    wrap.appendChild(sel);

                    try {
                        const res    = await api.get('/admin/classes/grades');
                        const grades = res.data?.data ?? [];
                        sel.innerHTML = '<option value="">-- Pilih Kelas --</option>';

                        grades.forEach(g => {
                            if (!g.classes?.length) return;
                            const grp = document.createElement('optgroup');
                            grp.label = g.label;
                            g.classes.forEach(c => {
                                const opt = document.createElement('option');
                                opt.value       = c.id;
                                opt.textContent = c.name;
                                // Cocokkan berdasarkan classId (jika ada) atau nama kelas lama
                                if (isEdit && (existing.classId === c.id || existing.class === c.name)) {
                                    opt.selected = true;
                                }
                                grp.appendChild(opt);
                            });
                            sel.appendChild(grp);
                        });

                        if (!grades.length) {
                            sel.innerHTML = '<option value="">Belum ada kelas. Buat di tab Kelola Kelas.</option>';
                        }
                    } catch {
                        sel.innerHTML = '<option value="">Gagal memuat kelas.</option>';
                    }

                    // Load rooms dropdown
                    const roomWrap = bodyEl.querySelector('#u-room-wrap');
                    if (roomWrap) {
                        const roomSel = document.createElement('select');
                        roomSel.id = 'u-room';
                        roomSel.className = 'w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter';
                        roomSel.innerHTML = '<option value="">Memuat ruangan...</option>';
                        roomWrap.appendChild(roomSel);

                        try {
                            const roomsRes = await api.get('/admin/rooms');
                            const rooms = roomsRes.data?.data ?? [];
                            roomSel.innerHTML = '<option value="">-- Pilih Ruangan --</option>' +
                                rooms.map(r => `<option value="${r.id}" ${isEdit && existing.roomId === r.id ? 'selected' : ''}>${r.name}</option>`).join('');
                        } catch {
                            roomSel.innerHTML = '<option value="">Gagal memuat ruangan.</option>';
                        }
                    }
                }
            },
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Simpan', variant: 'primary', onClick: async (close, modalEl) => {
                    const name  = modalEl.querySelector('#u-name').value.trim();
                    const nisn  = modalEl.querySelector('#u-nisn').value.trim();
                    const pass  = modalEl.querySelector('#u-pass').value;
                    const errEl = modalEl.querySelector('#u-err');

                    if (!name || (!isEdit && !nisn)) {
                        errEl.textContent = 'Nama dan NISN wajib diisi.';
                        errEl.classList.remove('hidden'); return;
                    }
                    try {
                        const body = { name, role, verified: true };

                        if (role === 'student') {
                            // Untuk siswa: kirim class_id (integer) dan class name (string)
                            const sel     = modalEl.querySelector('#u-class');
                            const classId = Number(sel.value);
                            const className = sel.options[sel.selectedIndex]?.textContent || '';
                            if (classId) { body.class_id = classId; body.class = className; }

                            const roomSel = modalEl.querySelector('#u-room');
                            if (roomSel && roomSel.value) {
                                body.roomId = Number(roomSel.value);
                            }

                            const academicYearInp = modalEl.querySelector('#u-academic-year');
                            if (academicYearInp) {
                                body.academicYear = academicYearInp.value.trim();
                            }
                        }

                        if (!isEdit) { body.nisn = nisn; body.password = pass || 'siswa123'; }
                        else if (pass) body.password = pass;

                        if (isEdit) await api.put(`/admin/users/${existing.id}`, body);
                        else        await api.post('/admin/users', body);
                        close();
                        this._renderTab();
                    } catch (e) {
                        errEl.textContent = e.response?.data?.message || 'Gagal menyimpan.';
                        errEl.classList.remove('hidden');
                    }
                }},
            ],
        });
    }

    // ── Tab Ujian ──────────────────────────────────────────────────────────────

    async _tabUjian() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('KELOLA UJIAN', 'Buat, aktifkan, dan tutup ujian.', 'BUAT UJIAN', () => this._modalUjian(null)));
        
        if (this._ujianFilterSearch === undefined) {
            this._ujianFilterSearch = '';
            this._ujianFilterMapel = '';
            this._ujianFilterGuru = '';
        }

        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const [examsRes, banksRes] = await Promise.all([api.get('/admin/exams'), api.get('/admin/question-banks')]);
            this._examsList = examsRes.data?.data ?? [];
            this._banksList = banksRes.data?.data ?? [];
            wrap.innerHTML = '';

            // Filter Bar
            const filterBar = createElement('div', 'bg-bg-surface border border-divider rounded-card p-4 flex flex-col gap-md mb-md');
            filterBar.innerHTML = `
                <div class="flex flex-col md:flex-row gap-md items-center w-full">
                    <!-- Search -->
                    <div class="relative flex-1 w-full">
                        <span class="material-icons absolute left-3 top-3 text-text-muted text-lg">search</span>
                        <input id="f-search" type="text" placeholder="Cari nama ujian..." value="${this._ujianFilterSearch}" 
                               class="w-full pl-10 pr-4 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                    </div>
                    
                    <!-- Mapel -->
                    <div class="w-full md:w-56">
                        <select id="f-mapel" class="w-full px-3 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                            <option value="">Semua Mapel</option>
                        </select>
                    </div>

                    <!-- Guru -->
                    <div class="w-full md:w-56">
                        <select id="f-guru" class="w-full px-3 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                            <option value="">Semua Guru</option>
                        </select>
                    </div>

                    <!-- Reset -->
                    <button id="btn-reset" class="w-full md:w-auto px-4 py-2.5 bg-[#2A2A2A] hover:bg-[#333333] border border-divider hover:border-gray-500 rounded-input text-text-secondary hover:text-text-primary text-sm flex items-center justify-center gap-1 transition-colors">
                        <span class="material-icons text-base">restart_alt</span>
                        Reset
                    </button>
                </div>
            `;
            wrap.appendChild(filterBar);

            // Populate Mapel
            const mapels = [...new Set(this._examsList.map(e => e.subject).filter(Boolean))].sort();
            const mapelSel = filterBar.querySelector('#f-mapel');
            mapels.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                if (m === this._ujianFilterMapel) opt.selected = true;
                mapelSel.appendChild(opt);
            });

            // Populate Guru
            const teachers = [...new Set(this._examsList.map(e => e.teacher).filter(Boolean))].sort();
            const guruSel = filterBar.querySelector('#f-guru');
            teachers.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g;
                opt.textContent = g;
                if (g === this._ujianFilterGuru) opt.selected = true;
                guruSel.appendChild(opt);
            });

            const tableWrapper = createElement('div', '');
            wrap.appendChild(tableWrapper);

            const performRender = () => {
                this._renderExamTable(tableWrapper);
            };

            // Event Listeners
            const searchInput = filterBar.querySelector('#f-search');
            let searchTimeout = null;
            searchInput.oninput = (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this._ujianFilterSearch = e.target.value.trim();
                    performRender();
                }, 300);
            };

            mapelSel.onchange = (e) => {
                this._ujianFilterMapel = e.target.value;
                performRender();
            };

            guruSel.onchange = (e) => {
                this._ujianFilterGuru = e.target.value;
                performRender();
            };

            const btnReset = filterBar.querySelector('#btn-reset');
            btnReset.onclick = () => {
                searchInput.value = '';
                mapelSel.value = '';
                guruSel.value = '';
                this._ujianFilterSearch = '';
                this._ujianFilterMapel = '';
                this._ujianFilterGuru = '';
                performRender();
            };

            performRender();

        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat ujian.', () => this._renderTab()));
        }
    }

    _renderExamTable(wrap) {
        wrap.innerHTML = '';
        
        const searchVal = this._ujianFilterSearch.toLowerCase();
        const mapelVal  = this._ujianFilterMapel;
        const guruVal   = this._ujianFilterGuru;

        const filtered = this._examsList.filter(e => {
            const searchMatch = !searchVal || e.title.toLowerCase().includes(searchVal);
            const mapelMatch  = !mapelVal || e.subject === mapelVal;
            const guruMatch   = !guruVal || e.teacher === guruVal;
            return searchMatch && mapelMatch && guruMatch;
        });

        const cols = [
            { key: 'title',   label: 'Nama Ujian' },
            { key: 'subject', label: 'Mapel' },
            { key: 'teacher', label: 'Guru' },
            { key: 'token',   label: 'Token', render: r => `<span class="font-mono font-bold text-accent-gold">${r.token}</span>` },
            { key: 'status',  label: 'Status', render: r => statusPill(r.status) },
            { key: 'actions', label: 'Aksi', render: r => `
                <div class="flex gap-sm" data-eid="${r.id}">
                    <button class="e-edit material-icons text-text-muted hover:text-online text-lg" title="Edit">edit</button>
                    ${r.status === 'draft'  ? `<button class="e-activate material-icons text-text-muted hover:text-accent-gold text-lg" title="Aktifkan">play_circle</button>` : ''}
                    ${r.status === 'active' ? `<button class="e-complete material-icons text-text-muted hover:text-primary text-lg" title="Tutup">lock</button>` : ''}
                    <button class="e-reset material-icons text-text-muted hover:text-text-primary text-lg" title="Reset Token">autorenew</button>
                    <button class="e-del material-icons text-text-muted hover:text-primary text-lg" title="Hapus">delete</button>
                </div>` },
        ];
        wrap.appendChild(createTable(cols, filtered, { emptyMessage: 'Tidak ada ujian yang cocok.' }));

        wrap.querySelectorAll('[data-eid]').forEach(el => {
            const exam = filtered.find(e => e.id === Number(el.dataset.eid));
            if (!exam) return;
            el.querySelector('.e-edit')?.addEventListener('click', () => this._modalUjian(exam));
            el.querySelector('.e-activate')?.addEventListener('click', async () => {
                await api.post(`/admin/exams/${exam.id}/activate`);
                this._renderTab();
            });
            el.querySelector('.e-complete')?.addEventListener('click', async () => {
                if (!confirm(`Tutup ujian "${exam.title}"?`)) return;
                await api.post(`/admin/exams/${exam.id}/complete`);
                this._renderTab();
            });
            el.querySelector('.e-reset')?.addEventListener('click', async () => {
                const res = await api.post(`/admin/exams/${exam.id}/reset-token`);
                 showToast(`Token baru: ${res.data?.data?.token}`, 'success');
                 this._renderTab();
            });
            el.querySelector('.e-del')?.addEventListener('click', () => this._confirmDelete(exam, 'admin/exams'));
        });
    }

    _modalUjian(existing) {
        const isEdit    = !!existing;
        const banks     = this._banksList || [];
        const fmt       = iso => iso ? new Date(iso).toISOString().slice(0, 16) : '';
        let classPicker = null;

        createModal({
            title: isEdit ? 'Edit Ujian' : 'Buat Ujian Baru',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Nama Ujian</label>
                        <input id="ex-title" type="text" value="${isEdit ? existing.title : ''}" placeholder="cth. UAS Matematika Ganjil" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Bank Soal</label>
                        <select id="ex-bank" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                            <option value="">-- Pilih Bank Soal --</option>
                            ${banks.map(b => `<option value="${b.id}"
                                data-subject="${b.subject}"
                                data-teacher="${b.creator || ''}"
                                data-teacherid="${b.createdBy || ''}"
                                ${isEdit && existing.questionBankId === b.id ? 'selected' : ''}>
                                ${b.name} — ${b.subject} (${b.creator || 'Admin'})
                            </option>`).join('')}
                        </select>
                        <div id="ex-bank-info" class="mt-sm text-xs text-text-muted font-inter hidden">
                            Mapel: <span id="ex-info-subj" class="text-accent-gold font-bold"></span> &nbsp;·&nbsp;
                            Guru: <span id="ex-info-teacher" class="text-accent-gold font-bold"></span>
                        </div>
                        ${!banks.length ? '<p class="text-xs text-primary font-inter mt-xs">Belum ada bank soal. Buat dulu di tab Mata Pelajaran.</p>' : ''}
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Durasi (menit)</label>
                        <input id="ex-dur" type="number" value="${isEdit ? existing.durationMinutes : 90}" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div class="grid grid-cols-2 gap-md">
                        <div>
                            <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Jadwal Mulai</label>
                            <input id="ex-start" type="datetime-local" value="${fmt(isEdit ? existing.startTime : '')}" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                        </div>
                        <div>
                            <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Jadwal Selesai</label>
                            <input id="ex-end" type="datetime-local" value="${fmt(isEdit ? existing.endTime : '')}" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                        </div>
                    </div>
                    <div>
                        <div id="ex-class-picker" class="border border-gray-700 rounded-card p-md">
                            <p class="text-xs text-text-muted font-inter animate-pulse">Memuat daftar kelas...</p>
                        </div>
                    </div>
                    <div id="ex-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            onMount: (bodyEl) => {
                const bankSel = bodyEl.querySelector('#ex-bank');
                const infoEl  = bodyEl.querySelector('#ex-bank-info');
                const subjEl  = bodyEl.querySelector('#ex-info-subj');
                const tcrEl   = bodyEl.querySelector('#ex-info-teacher');

                const updateInfo = () => {
                    const opt = bankSel.options[bankSel.selectedIndex];
                    if (opt && opt.value) {
                        subjEl.textContent = opt.dataset.subject || '-';
                        tcrEl.textContent  = opt.dataset.teacher  || '-';
                        infoEl.classList.remove('hidden');
                    } else {
                        infoEl.classList.add('hidden');
                    }
                };
                bankSel.addEventListener('change', updateInfo);
                if (isEdit) updateInfo();

                const pickerWrap  = bodyEl.querySelector('#ex-class-picker');
                const preselected = isEdit ? (existing.classes ?? []).map(c => c.id) : [];
                classPicker = new ClassMultiSelect(pickerWrap, { selected: preselected });
            },
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: isEdit ? 'Simpan' : 'Buat Ujian', variant: 'primary', onClick: async (close, bodyEl) => {
                    const bankSel  = bodyEl.querySelector('#ex-bank');
                    const selOpt   = bankSel.options[bankSel.selectedIndex];
                    const errEl    = bodyEl.querySelector('#ex-err');
                    const showErr  = msg => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
                    const classIds = classPicker ? classPicker.getSelected() : [];

                    const body = {
                        title:            bodyEl.querySelector('#ex-title').value.trim(),
                        question_bank_id: Number(bankSel.value),
                        subject:          selOpt?.dataset.subject || '',
                        teacher_id:       Number(selOpt?.dataset.teacherid || 0),
                        duration_minutes: Number(bodyEl.querySelector('#ex-dur').value),
                        start_time:       bodyEl.querySelector('#ex-start').value,
                        end_time:         bodyEl.querySelector('#ex-end').value,
                        class_ids:        classIds,
                    };

                    if (!body.title)            return showErr('Nama ujian wajib diisi.');
                    if (!body.question_bank_id) return showErr('Pilih bank soal terlebih dahulu.');
                    if (classIds.length === 0)  return showErr('Pilih minimal satu kelas peserta ujian.');

                    try {
                        if (isEdit) await api.put(`/admin/exams/${existing.id}`, body);
                        else        await api.post('/admin/exams', body);
                        close();
                        this._renderTab();
                    } catch (e) {
                        showErr(e.response?.data?.message || 'Gagal menyimpan.');
                    }
                }},
            ],
        });
    }

    // ── Tab Kelas ──────────────────────────────────────────────────────────────

    async _tabKelas() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header(
            'KELOLA KELAS', 'Buat dan kelola rombongan belajar per angkatan.',
            'TAMBAH KELAS', () => this._modalKelas(null)
        ));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/classes');
            const classes = res.data?.data ?? [];
            wrap.innerHTML = '';

            const cols = [
                { key: 'grade',        label: 'Tingkat',   render: r => r.grade?.label ?? '-' },
                { key: 'name',         label: 'Nama Kelas' },
                { key: 'major',        label: 'Jurusan',   render: r => r.major ?? '-' },
                { key: 'studentCount', label: 'Siswa' },
                { key: 'actions', label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-cid="${r.id}">
                        <button class="c-edit material-icons text-text-muted hover:text-online text-lg">edit</button>
                        <button class="c-del material-icons text-text-muted hover:text-primary text-lg">delete</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, classes));
            wrap.querySelectorAll('[data-cid]').forEach(el => {
                const c = classes.find(x => x.id === Number(el.dataset.cid));
                el.querySelector('.c-edit').onclick = () => this._modalKelas(c);
                el.querySelector('.c-del').onclick  = () => this._confirmDelete(c, 'admin/classes');
            });
        } catch (e) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat data kelas.', () => this._renderTab()));
        }
    }

    _modalKelas(existing = null) {
        const isEdit = !!existing;

        // Dropdown jurusan statis 6 pilihan resmi
        const jurusanOptions = JURUSAN_LIST.map(j =>
            `<option value="${j}" ${isEdit && existing.major === j ? 'selected' : ''}>${j}</option>`
        ).join('');

        createModal({
            title: isEdit ? 'Edit Kelas' : 'Tambah Kelas',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Tingkat</label>
                        <select id="k-grade" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                            <option value="">-- Pilih Tingkat --</option>
                        </select>
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Jurusan</label>
                        <select id="k-major" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                            <option value="">-- Pilih Jurusan --</option>
                            ${jurusanOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Nomor Kelas <span class="text-text-muted font-normal">(opsional, isi jika lebih dari 1)</span></label>
                        <input id="k-nomor" type="number" min="1" max="9"
                            value="${isEdit ? (existing._nomor ?? '') : ''}"
                            placeholder="Kosongkan jika hanya 1 kelas"
                            class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                        <p class="text-xs text-text-muted font-inter mt-xs">Nama kelas akan dibuat otomatis. Contoh: <span id="k-preview" class="text-accent-gold font-bold">XI RPL</span></p>
                    </div>
                    <div id="k-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            onMount: async (bodyEl) => {
                // Load grades dari API
                try {
                    const res   = await api.get('/admin/classes/grades');
                    const grades = res.data?.data ?? [];
                    const sel   = bodyEl.querySelector('#k-grade');
                    grades.forEach(g => {
                        const opt = document.createElement('option');
                        opt.value = g.id;
                        opt.textContent = g.label;
                        opt.dataset.name = g.name; // "X" / "XI" / "XII"
                        if (isEdit && existing.gradeId === g.id) opt.selected = true;
                        sel.appendChild(opt);
                    });
                } catch { /* ignore */ }

                // Live preview nama kelas
                const updatePreview = () => {
                    const gradeSel  = bodyEl.querySelector('#k-grade');
                    const majorSel  = bodyEl.querySelector('#k-major');
                    const nomorInp  = bodyEl.querySelector('#k-nomor');
                    const preview   = bodyEl.querySelector('#k-preview');
                    const gradeOpt  = gradeSel.options[gradeSel.selectedIndex];
                    const gradeName = gradeOpt?.dataset.name || '';
                    const major     = majorSel.value;
                    const nomor     = parseInt(nomorInp.value);
                    if (!gradeName || !major) { preview.textContent = '—'; return; }
                    const nama = (!nomor || nomor <= 1) ? `${gradeName} ${major}` : `${gradeName} ${major}-${nomor}`;
                    preview.textContent = nama;
                };
                bodyEl.querySelector('#k-grade').addEventListener('change', updatePreview);
                bodyEl.querySelector('#k-major').addEventListener('change', updatePreview);
                bodyEl.querySelector('#k-nomor').addEventListener('input',  updatePreview);
                if (isEdit) updatePreview();
            },
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Simpan', variant: 'primary', onClick: async (close, bodyEl) => {
                    const errEl   = bodyEl.querySelector('#k-err');
                    const showErr = msg => { errEl.textContent = msg; errEl.classList.remove('hidden'); };

                    const gradeEl  = bodyEl.querySelector('#k-grade');
                    const gradeId  = +gradeEl.value;
                    const gradeOpt = gradeEl.options[gradeEl.selectedIndex];
                    const gradeName = gradeOpt?.dataset.name || '';
                    const major    = bodyEl.querySelector('#k-major').value;
                    const nomor    = parseInt(bodyEl.querySelector('#k-nomor').value);

                    if (!gradeId) return showErr('Pilih tingkat kelas.');
                    if (!major)   return showErr('Pilih jurusan.');

                    // Bangun nama otomatis
                    const name = (!nomor || nomor <= 1) ? `${gradeName} ${major}` : `${gradeName} ${major}-${nomor}`;

                    try {
                        const payload = { name, grade_id: gradeId, major };
                        if (isEdit) await api.put(`/admin/classes/${existing.id}`, payload);
                        else        await api.post('/admin/classes', payload);
                        close();
                        this._renderTab();
                    } catch (e) {
                        showErr(e.response?.data?.message || 'Gagal menyimpan.');
                    }
                }},
            ],
        });
    }

    // ── Tab Kelola Proktor ─────────────────────────────────────────────────────

    async _tabProktor() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('KELOLA PROKTOR', 'Tambah pengawas ujian dan tugaskan ke ruangan.', 'TAMBAH PROKTOR', () => this._modalProktor(null)));
        
        if (this._proktorFilterSearch === undefined) {
            this._proktorFilterSearch = '';
            this._proktorFilterRoom = '';
        }

        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        let rooms = [];
        try {
            const roomsRes = await api.get('/admin/rooms');
            rooms = roomsRes.data?.data ?? [];
        } catch (_) {}
        this._roomsList = rooms;

        try {
            const res = await api.get('/admin/proctors');
            const proctors = res.data?.data ?? [];
            wrap.innerHTML = '';

            // Filter Bar
            const filterBar = createElement('div', 'bg-bg-surface border border-divider rounded-card p-4 flex flex-col gap-md mb-md');
            filterBar.innerHTML = `
                <div class="flex flex-col md:flex-row gap-md items-center w-full">
                    <!-- Search -->
                    <div class="relative flex-1 w-full">
                        <span class="material-icons absolute left-3 top-3 text-text-muted text-lg">search</span>
                        <input id="f-search" type="text" placeholder="Cari nama atau NIP/NISN..." value="${this._proktorFilterSearch}" 
                               class="w-full pl-10 pr-4 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                    </div>
                    
                    <!-- Ruang Tugas -->
                    <div class="w-full md:w-56">
                        <select id="f-room" class="w-full px-3 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                            <option value="">Semua Ruangan</option>
                        </select>
                    </div>

                    <!-- Reset -->
                    <button id="btn-reset" class="w-full md:w-auto px-4 py-2.5 bg-[#2A2A2A] hover:bg-[#333333] border border-divider hover:border-gray-500 rounded-input text-text-secondary hover:text-text-primary text-sm flex items-center justify-center gap-1 transition-colors">
                        <span class="material-icons text-base">restart_alt</span>
                        Reset
                    </button>
                </div>
            `;
            wrap.appendChild(filterBar);

            // Populate Ruang Tugas
            const uniqueRooms = [...new Set(proctors.map(p => p.room).filter(Boolean))].sort();
            const roomSel = filterBar.querySelector('#f-room');
            uniqueRooms.forEach(rm => {
                const opt = document.createElement('option');
                opt.value = rm;
                opt.textContent = rm;
                if (rm === this._proktorFilterRoom) opt.selected = true;
                roomSel.appendChild(opt);
            });

            const tableWrapper = createElement('div', '');
            wrap.appendChild(tableWrapper);

            const cols = [
                { key: 'name',     label: 'Nama Proktor' },
                { key: 'nisn',     label: 'NIP / NISN' },
                { key: 'room',     label: 'Ruang Tugas', render: r => r.room ? `<span class="font-mono font-bold text-accent-gold">${r.room}</span>` : '<span class="text-text-muted italic">Belum diset</span>' },
                { key: 'verified', label: 'Status', render: r => statusPill(r.verified ? 'aktif' : 'nonaktif') },
                { key: 'actions',  label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-pid="${r.id}">
                        <button class="p-edit material-icons text-text-muted hover:text-online text-lg">edit</button>
                        <button class="p-del material-icons text-text-muted hover:text-primary text-lg">delete</button>
                    </div>` },
            ];

            const renderProktorTable = () => {
                tableWrapper.innerHTML = '';
                const searchVal = this._proktorFilterSearch.toLowerCase();
                const roomVal   = this._proktorFilterRoom;
                
                const filtered = proctors.filter(p => {
                    const searchMatch = !searchVal || 
                        p.name.toLowerCase().includes(searchVal) || 
                        (p.nisn && p.nisn.includes(searchVal));
                    const roomMatch = !roomVal || p.room === roomVal;
                    return searchMatch && roomMatch;
                });
                
                const tableEl = createTable(cols, filtered, { emptyMessage: 'Tidak ada data proktor yang cocok.' });
                tableWrapper.appendChild(tableEl);
                
                tableEl.querySelectorAll('[data-pid]').forEach(el => {
                    const p = filtered.find(x => x.id === Number(el.dataset.pid));
                    if (p) {
                        el.querySelector('.p-edit').onclick = () => this._modalProktor(p);
                        el.querySelector('.p-del').onclick  = () => this._confirmDeleteProktor(p);
                    }
                });
            };

            // Event Listeners
            const searchInput = filterBar.querySelector('#f-search');
            let searchTimeout = null;
            searchInput.oninput = (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this._proktorFilterSearch = e.target.value.trim();
                    renderProktorTable();
                }, 300);
            };

            roomSel.onchange = (e) => {
                this._proktorFilterRoom = e.target.value;
                renderProktorTable();
            };

            const btnReset = filterBar.querySelector('#btn-reset');
            btnReset.onclick = () => {
                searchInput.value = '';
                roomSel.value = '';
                this._proktorFilterSearch = '';
                this._proktorFilterRoom = '';
                renderProktorTable();
            };

            renderProktorTable();

        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat data proktor.', () => this._renderTab()));
        }
    }

    _modalProktor(existing) {
        const isEdit = !!existing;
        const rooms  = this._roomsList || [];

        createModal({
            title: isEdit ? 'Edit Proktor' : 'Tambah Proktor',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Nama Lengkap</label>
                        <input id="pr-name" type="text" value="${isEdit ? existing.name : ''}" placeholder="cth. Budi Santoso" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">NIP / NISN</label>
                        <input id="pr-nisn" type="text" value="${isEdit ? existing.nisn : ''}" ${isEdit ? 'disabled' : ''} placeholder="cth. 198812122012001" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter disabled:opacity-50">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Password ${isEdit ? '(kosongkan jika tidak diganti)' : '(default: proktor123)'}</label>
                        <input id="pr-pass" type="password" placeholder="${isEdit ? 'Isi untuk mengganti' : 'Min 6 karakter'}" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Ruang Tugas</label>
                        <select id="pr-room" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                            <option value="">-- Pilih Ruang --</option>
                            ${rooms.map(r => `<option value="${r.id}" ${isEdit && existing.roomId === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                        </select>
                    </div>
                    <div id="pr-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Simpan', variant: 'primary', onClick: async (close, body) => {
                    const name  = body.querySelector('#pr-name').value.trim();
                    const nisn  = body.querySelector('#pr-nisn').value.trim();
                    const pass  = body.querySelector('#pr-pass').value;
                    const roomId = body.querySelector('#pr-room').value;
                    const errEl = body.querySelector('#pr-err');

                    if (!name || (!isEdit && !nisn)) { errEl.textContent = 'Nama dan NIP wajib diisi.'; errEl.classList.remove('hidden'); return; }
                    if (!roomId)                     { errEl.textContent = 'Ruang tugas wajib diisi.'; errEl.classList.remove('hidden'); return; }

                    try {
                        const payload = { name, roomId: Number(roomId), verified: true };
                        if (!isEdit) { payload.nisn = nisn; payload.password = pass || 'proktor123'; }
                        else if (pass) payload.password = pass;

                        if (isEdit) await api.put(`/admin/proctors/${existing.id}`, payload);
                        else        await api.post('/admin/proctors', payload);
                        close(); this._renderTab();
                    } catch (e) {
                        errEl.textContent = e.response?.data?.message || 'Gagal menyimpan.';
                        errEl.classList.remove('hidden');
                    }
                }},
            ],
        });
    }

    _confirmDeleteProktor(p) {
        createModal({
            title: 'Hapus Proktor',
            bodyHtml: `<p class="font-inter text-text-primary">Hapus akun proktor <strong>${p.name}</strong>?</p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Hapus', variant: 'primary', onClick: async (close) => {
                    try { await api.delete(`/admin/proctors/${p.id}`); close(); this._renderTab(); }
                    catch (e) { showToast(e.response?.data?.message || 'Gagal menghapus.', 'error'); close(); }
                }},
            ],
        });
    }

    // ── Tab Mata Pelajaran ─────────────────────────────────────────────────────

    async _tabMapel() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('MATA PELAJARAN', 'Daftar bank soal per mata pelajaran.', 'BUAT BANK SOAL', () => this._modalBuatBankSoal()));

        // Initialize state if not done
        if (this._mapelFilterSearch === undefined) {
            this._mapelFilterSearch = '';
            this._mapelFilterSubject = '';
            this._mapelPage = 1;
            this._mapelLimit = 10;
            this._mapelSortBy = 'createdAt';
            this._mapelSortDir = 'desc';
            this._mapelSelectedIds = [];
        }

        // Summary stats cards container (Skeleton)
        const summaryCards = createElement('div', 'grid grid-cols-1 md:grid-cols-3 gap-md mb-lg');
        summaryCards.innerHTML = `
            <div class="bg-bg-surface rounded-lg p-5 border border-divider animate-pulse h-24"></div>
            <div class="bg-bg-surface rounded-lg p-5 border border-divider animate-pulse h-24"></div>
            <div class="bg-bg-surface rounded-lg p-5 border border-divider animate-pulse h-24"></div>
        `;
        this.contentArea.appendChild(summaryCards);

        // Control/Filter Bar container
        const filterBar = createElement('div', 'bg-bg-surface border border-divider rounded-card p-4 flex flex-col gap-md mb-md');
        filterBar.innerHTML = `
            <div class="flex flex-col md:flex-row gap-md items-center w-full">
                <!-- Search -->
                <div class="relative flex-1 w-full">
                    <span class="material-icons absolute left-3 top-3 text-text-muted text-lg">search</span>
                    <input id="f-search" type="text" placeholder="Cari nama bank soal..." value="${this._mapelFilterSearch}" 
                           class="w-full pl-10 pr-4 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                </div>
                
                <!-- Subject -->
                <div class="w-full md:w-56">
                    <select id="f-subject" class="w-full px-3 py-2.5 bg-bg-primary border border-divider rounded-input text-text-primary text-sm focus:outline-none focus:border-primary">
                        <option value="">Semua Mapel</option>
                        ${this._mapelFilterSubject ? `<option value="${this._mapelFilterSubject}" selected>${this._mapelFilterSubject}</option>` : ''}
                    </select>
                </div>

                <!-- Reset -->
                <button id="btn-reset" class="w-full md:w-auto px-4 py-2.5 bg-[#2A2A2A] hover:bg-[#333333] border border-divider hover:border-gray-500 rounded-input text-text-secondary hover:text-text-primary text-sm flex items-center justify-center gap-1 transition-colors">
                    <span class="material-icons text-base">restart_alt</span>
                    Reset
                </button>
            </div>
        `;
        this.contentArea.appendChild(filterBar);

        // Table Wrapper
        const tableWrapper = createElement('div', '');
        this.contentArea.appendChild(tableWrapper);

        // Fetch Stats & Subjects dynamically
        const subjectSelect = filterBar.querySelector('#f-subject');
        
        this._loadMapelStats(summaryCards, null, subjectSelect);
        this._loadMapelSubjects(subjectSelect);

        // Render Table Initially
        this._fetchAndRenderMapelTable(tableWrapper);

        // Attach listeners for filters
        const searchInput = filterBar.querySelector('#f-search');
        let searchTimeout = null;
        searchInput.oninput = (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this._mapelFilterSearch = e.target.value.trim();
                this._mapelPage = 1;
                this._fetchAndRenderMapelTable(tableWrapper);
            }, 300);
        };

        subjectSelect.onchange = (e) => {
            this._mapelFilterSubject = e.target.value;
            this._mapelPage = 1;
            this._fetchAndRenderMapelTable(tableWrapper);
        };

        const btnReset = filterBar.querySelector('#btn-reset');
        btnReset.onclick = () => {
            searchInput.value = '';
            subjectSelect.value = '';
            
            this._mapelFilterSearch = '';
            this._mapelFilterSubject = '';
            this._mapelPage = 1;
            this._mapelSelectedIds = [];
            
            this._fetchAndRenderMapelTable(tableWrapper);
        };
    }

    async _loadMapelStats(summaryCardsEl, yearSelectEl, subjectSelectEl) {
        try {
            const res = await api.get('/admin/question-banks/summary');
            const data = res.data?.data || { totalBanks: 0, totalQuestions: 0, guruKontributor: 0, academicYears: [] };
            
            summaryCardsEl.innerHTML = '';
            
            const card1 = createStatCard({
                icon: 'menu_book',
                label: 'TOTAL BANK SOAL',
                value: data.totalBanks.toLocaleString(),
                accent: 'primary',
            });
            const card2 = createStatCard({
                icon: 'fact_check',
                label: 'SOAL TERUPLOAD',
                value: data.totalQuestions.toLocaleString(),
                accent: 'gold',
            });
            const card3 = createStatCard({
                icon: 'school',
                label: 'GURU KONTRIBUTOR',
                value: data.guruKontributor.toLocaleString(),
                accent: 'online',
            });
            
            summaryCardsEl.appendChild(card1);
            summaryCardsEl.appendChild(card2);
            summaryCardsEl.appendChild(card3);

            if (yearSelectEl && data.academicYears) {
                const currentVal = yearSelectEl.value;
                yearSelectEl.innerHTML = '<option value="">Semua Tahun</option>';
                data.academicYears.forEach(yr => {
                    const opt = document.createElement('option');
                    opt.value = yr;
                    opt.textContent = yr;
                    if (yr === currentVal) opt.selected = true;
                    yearSelectEl.appendChild(opt);
                });
            }
        } catch (e) {
            summaryCardsEl.innerHTML = '<p class="text-primary text-sm font-inter">Gagal memuat ringkasan data.</p>';
        }
    }

    async _loadMapelSubjects(subjectSelectEl) {
        try {
            const res = await api.get('/admin/question-banks');
            const banks = res.data?.data ?? [];
            const subjects = [...new Set(banks.map(b => b.subject).filter(Boolean))].sort();
            
            const currentVal = subjectSelectEl.value;
            subjectSelectEl.innerHTML = '<option value="">Semua Mapel</option>';
            subjects.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.textContent = sub;
                if (sub === currentVal) opt.selected = true;
                subjectSelectEl.appendChild(opt);
            });
        } catch (e) {
            // fallback silent
        }
    }

    async _fetchAndRenderMapelTable(tableWrapper) {
        tableWrapper.innerHTML = '';
        tableWrapper.appendChild(this._loading());
        
        try {
            const params = {
                search: this._mapelFilterSearch,
                subject: this._mapelFilterSubject,
                page: this._mapelPage,
                limit: this._mapelLimit,
                sortBy: this._mapelSortBy,
                sortDir: this._mapelSortDir
            };
            const res = await api.get('/v1/question-banks', { params });
            const { data: banks, total, page, limit, totalPages } = res.data?.data || { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
            
            tableWrapper.innerHTML = '';
            
            const cols = [
                { key: 'subject',       label: 'Mapel' },
                { key: 'name',          label: 'Nama Bank Soal' },
                { key: 'questionCount', label: 'Jumlah Soal', render: r => (r.questionCount ?? 0).toLocaleString() },
                { key: 'creator',       label: 'Dibuat Oleh', render: r => `
                    <div class="flex flex-col">
                        <span class="text-text-primary">${r.creator || 'Sistem'}</span>
                        <span class="text-[10px] text-text-muted uppercase tracking-wider">${r.creatorRole || 'system'}</span>
                    </div>` },
                { key: 'actions',  label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-bid="${r.id}">
                        <button class="b-edit material-icons text-text-muted hover:text-accent-gold text-lg">edit</button>
                        <button class="b-del material-icons text-text-muted hover:text-primary text-lg">delete</button>
                    </div>` },
            ];

            const tableEl = createTable(cols, banks, { emptyMessage: 'Belum ada bank soal.' });
            tableWrapper.appendChild(tableEl);

            // Listeners
            tableEl.querySelectorAll('[data-bid]').forEach(el => {
                const id = Number(el.dataset.bid);
                const bank = banks.find(b => b.id === id);
                if (bank) {
                    el.querySelector('.b-edit').onclick = () => this._modalBuatBankSoal(bank);
                    el.querySelector('.b-del').onclick  = () => this._confirmDeleteBank(bank, () => this._tabMapel());
                }
            });

            // Pagination Controls
            if (totalPages > 1) {
                const startEntry = total === 0 ? 0 : (page - 1) * limit + 1;
                const endEntry = Math.min(page * limit, total);
                
                const footer = createElement('div', 'flex flex-col sm:flex-row items-center justify-between gap-md mt-md px-1');
                
                const info = createElement('div', 'font-inter text-xs text-text-secondary');
                info.innerHTML = `Menampilkan <span class="text-text-primary font-semibold">${startEntry}-${endEntry}</span> dari <span class="text-text-primary font-semibold">${total}</span> bank soal`;
                footer.appendChild(info);
                
                const controls = createElement('div', 'flex items-center gap-md');
                
                const limitWrap = createElement('div', 'flex items-center gap-xs font-inter text-xs text-text-secondary');
                limitWrap.innerHTML = `
                    <span>Tampilkan:</span>
                    <select id="p-limit" class="px-2 py-1 bg-bg-surface border border-divider rounded text-text-primary text-xs focus:outline-none">
                        <option value="10" ${limit === 10 ? 'selected' : ''}>10</option>
                        <option value="25" ${limit === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${limit === 50 ? 'selected' : ''}>50</option>
                    </select>
                `;
                controls.appendChild(limitWrap);

                const pages = createElement('div', 'flex items-center gap-xs');
                
                const btnPrev = createElement('button', `px-2.5 py-1 rounded bg-bg-surface border border-divider hover:bg-[#252525] text-text-secondary hover:text-text-primary text-xs transition-colors flex items-center ${page <= 1 ? 'opacity-40 cursor-not-allowed' : ''}`);
                btnPrev.innerHTML = `<span class="material-icons text-sm">chevron_left</span>`;
                if (page > 1) {
                    btnPrev.onclick = () => {
                        this._mapelPage = page - 1;
                        this._fetchAndRenderMapelTable(tableWrapper);
                    };
                }
                pages.appendChild(btnPrev);
                
                const maxVisiblePages = 5;
                let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
                
                for (let i = startPage; i <= endPage; i++) {
                    const btnNum = createElement('button', `px-3 py-1 rounded text-xs font-semibold transition-colors ${i === page ? 'bg-primary text-white' : 'bg-bg-surface border border-divider hover:bg-[#252525] text-text-secondary hover:text-text-primary'}`);
                    btnNum.textContent = i;
                    btnNum.onclick = () => {
                        this._mapelPage = i;
                        this._fetchAndRenderMapelTable(tableWrapper);
                    };
                    pages.appendChild(btnNum);
                }
                
                const btnNext = createElement('button', `px-2.5 py-1 rounded bg-bg-surface border border-divider hover:bg-[#252525] text-text-secondary hover:text-text-primary text-xs transition-colors flex items-center ${page >= totalPages ? 'opacity-40 cursor-not-allowed' : ''}`);
                btnNext.innerHTML = `<span class="material-icons text-sm">chevron_right</span>`;
                if (page < totalPages) {
                    btnNext.onclick = () => {
                        this._mapelPage = page + 1;
                        this._fetchAndRenderMapelTable(tableWrapper);
                    };
                }
                pages.appendChild(btnNext);
                
                controls.appendChild(pages);
                footer.appendChild(controls);
                tableWrapper.appendChild(footer);

                const selLimit = footer.querySelector('#p-limit');
                if (selLimit) {
                    selLimit.onchange = (e) => {
                        this._mapelLimit = Number(e.target.value);
                        this._mapelPage = 1;
                        this._fetchAndRenderMapelTable(tableWrapper);
                    };
                }
            }
        } catch (err) {
            tableWrapper.innerHTML = '';
            tableWrapper.appendChild(this._error('Gagal memuat daftar bank soal.', () => this._fetchAndRenderMapelTable(tableWrapper)));
        }
    }

    _modalBuatBankSoal(bank = null) {
        const isEdit = !!bank;
        createModal({
            title: isEdit ? 'Edit Bank Soal' : 'Buat Bank Soal Baru',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Nama Bank Soal</label>
                        <input id="mb-name" type="text" placeholder="cth. PTS Ganjil 2026" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter" value="${isEdit ? bank.name : ''}">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Mata Pelajaran</label>
                        <input id="mb-subj" type="text" placeholder="cth. Produktif TKRO" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter" value="${isEdit ? bank.subject : ''}">
                        <p class="text-xs text-text-muted font-inter mt-xs">Tulis nama mapel lengkap dan konsisten.</p>
                    </div>
                    <div id="mb-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: isEdit ? 'Simpan' : 'Buat', variant: 'primary', onClick: async (close, body) => {
                    const name    = body.querySelector('#mb-name').value.trim();
                    const subject = body.querySelector('#mb-subj').value.trim();
                    const errEl   = body.querySelector('#mb-err');
                    if (!name || !subject) { errEl.textContent = 'Semua field wajib diisi.'; errEl.classList.remove('hidden'); return; }
                    try { 
                        if (isEdit) {
                            await api.put(`/admin/question-banks/${bank.id}`, { name, subject }); 
                        } else {
                            await api.post('/admin/question-banks', { name, subject }); 
                        }
                        close(); 
                        this._tabMapel(); 
                    }
                    catch (e) { errEl.textContent = e.response?.data?.message || 'Gagal.'; errEl.classList.remove('hidden'); }
                }},
            ],
        });
    }

    _confirmDeleteBank(bank, onSuccess) {
        createModal({
            title: 'Hapus Bank Soal',
            bodyHtml: `<p class="font-inter text-text-primary">Hapus bank soal <strong>${bank.name}</strong> (${bank.subject})?<br><span class="text-primary text-sm">Semua soal di dalamnya ikut terhapus.</span></p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Hapus', variant: 'primary', onClick: async (close) => {
                    try { 
                        await api.delete(`/admin/question-banks/${bank.id}`); 
                        close(); 
                        if (onSuccess) onSuccess(); else this._renderTab(); 
                    }
                    catch (e) { showToast(e.response?.data?.message || 'Gagal menghapus.', 'error'); close(); }
                }},
            ],
        });
    }

    _confirmBulkDeleteBank(onSuccess) {
        createModal({
            title: 'Hapus Massal Bank Soal',
            bodyHtml: `<p class="font-inter text-text-primary">Hapus <strong>${this._mapelSelectedIds.length}</strong> bank soal terpilih?<br><span class="text-primary text-sm">Semua soal di dalamnya ikut terhapus permanen.</span></p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Hapus Semua', variant: 'primary', onClick: async (close) => {
                    try { 
                        await api.delete('/admin/question-banks/bulk', { data: { ids: this._mapelSelectedIds } }); 
                        showToast(`${this._mapelSelectedIds.length} bank soal berhasil dihapus.`, 'success');
                        close(); 
                        if (onSuccess) onSuccess(); else this._renderTab(); 
                    }
                    catch (e) { showToast(e.response?.data?.message || 'Gagal menghapus massal.', 'error'); close(); }
                }},
            ],
        });
    }

    // ── Tab Token Sesi ─────────────────────────────────────────────────────────

    async _tabTokenSesi() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('TOKEN SESI', 'Buat token yang dimasukkan siswa saat login.', 'BUAT TOKEN SESI', () => this._modalTokenSesi()));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/sessions');
            const sessions = res.data?.data ?? [];
            wrap.innerHTML = '';

            const formatDateTime = (isoStr) => {
                if (!isoStr) return '-';
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return '-';
                const pad = n => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };

            const cols = [
                { key: 'token',       label: 'Token Sesi', render: r => `<span class="font-mono font-bold text-accent-gold text-lg">${r.token}</span>` },
                { key: 'room',        label: 'Ruangan', render: r => r.room ? r.room.name : '-' },
                { key: 'proctor',     label: 'Proktor', render: r => r.proctor ? r.proctor.name : '-' },
                { key: 'validFrom',   label: 'Mulai Aktif', render: r => formatDateTime(r.validFrom) },
                { key: 'validUntil',  label: 'Selesai Aktif', render: r => formatDateTime(r.validUntil) },
                { key: 'description', label: 'Keterangan' },
                { key: 'active',      label: 'Status', render: r => statusPill(r.active ? 'aktif' : 'nonaktif') },
                { key: 'actions',     label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-sid="${r.id}">
                        <button class="s-toggle material-icons text-text-muted hover:text-online text-lg" title="${r.active ? 'Nonaktifkan' : 'Aktifkan'}">${r.active ? 'block' : 'check_circle'}</button>
                        <button class="s-del material-icons text-text-muted hover:text-primary text-lg" title="Hapus">delete</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, sessions));
            wrap.querySelectorAll('[data-sid]').forEach(el => {
                const sess = sessions.find(s => s.id === Number(el.dataset.sid));
                if (!sess) return;
                el.querySelector('.s-toggle').onclick = async () => {
                    await api.patch(`/admin/sessions/${sess.id}`, { active: !sess.active });
                    this._renderTab();
                };
                el.querySelector('.s-del').onclick = () => {
                    this._confirmDelete(sess, 'admin/sessions');
                };
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat Token Sesi.', () => this._renderTab()));
        }
    }

    async _modalTokenSesi() {
        createModal({
            title: 'Buat Token Sesi Baru',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Ruangan</label>
                        <select id="ts-room" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                            <option value="">Memuat ruangan...</option>
                        </select>
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Proktor Tugas <span class="text-text-muted font-normal">(opsional)</span></label>
                        <select id="ts-proctor" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                            <option value="">Memuat proktor...</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-md">
                        <div>
                            <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Mulai Aktif</label>
                            <input id="ts-start" type="datetime-local" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                        </div>
                        <div>
                            <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Selesai Aktif</label>
                            <input id="ts-end" type="datetime-local" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                        </div>
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Keterangan <span class="text-text-muted font-normal">(opsional)</span></label>
                        <input id="ts-desc" type="text" placeholder="cth. Sesi Ujian Produktif" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div id="ts-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            onMount: async (bodyEl) => {
                const roomSel = bodyEl.querySelector('#ts-room');
                const proctorSel = bodyEl.querySelector('#ts-proctor');
                const startInp = bodyEl.querySelector('#ts-start');
                const endInp = bodyEl.querySelector('#ts-end');

                // Set default dates in local time
                const formatLocalDate = (date) => {
                    const tzoffset = date.getTimezoneOffset() * 60000;
                    return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
                };

                const defaultStart = new Date();
                defaultStart.setHours(0, 0, 0, 0);
                startInp.value = formatLocalDate(defaultStart);

                const defaultEnd = new Date();
                defaultEnd.setHours(23, 59, 59, 999);
                endInp.value = formatLocalDate(defaultEnd);

                try {
                    const [roomsRes, proctorsRes] = await Promise.all([
                        api.get('/admin/rooms'),
                        api.get('/admin/proctors')
                    ]);
                    const rooms = roomsRes.data?.data ?? [];
                    const proctors = proctorsRes.data?.data ?? [];

                    roomSel.innerHTML = '<option value="">-- Pilih Ruangan --</option>' +
                        rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

                    proctorSel.innerHTML = '<option value="">-- Pilih Proktor (Opsional) --</option>' +
                        proctors.map(p => `<option value="${p.id}">${p.name} (${p.room ? p.room : 'Belum diset'})</option>`).join('');
                } catch (e) {
                    roomSel.innerHTML = '<option value="">Gagal memuat data.</option>';
                    proctorSel.innerHTML = '<option value="">Gagal memuat data.</option>';
                }
            },
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Buat Token', variant: 'primary', onClick: async (close, bodyEl) => {
                    const roomId = bodyEl.querySelector('#ts-room').value;
                    const proctorId = bodyEl.querySelector('#ts-proctor').value;
                    const desc  = bodyEl.querySelector('#ts-desc').value.trim();
                    const validFrom = bodyEl.querySelector('#ts-start').value;
                    const validUntil = bodyEl.querySelector('#ts-end').value;
                    const errEl = bodyEl.querySelector('#ts-err');

                    if (!roomId) { errEl.textContent = 'Pilih ruangan terlebih dahulu.'; errEl.classList.remove('hidden'); return; }

                    if (validFrom && validUntil && new Date(validUntil) <= new Date(validFrom)) {
                        errEl.textContent = 'Waktu selesai aktif harus setelah waktu mulai aktif.';
                        errEl.classList.remove('hidden');
                        return;
                    }

                    try {
                        const payload = { roomId: Number(roomId) };
                        if (proctorId) payload.proctorId = Number(proctorId);
                        if (desc) payload.description = desc;
                        if (validFrom) payload.validFrom = new Date(validFrom).toISOString();
                        if (validUntil) payload.validUntil = new Date(validUntil).toISOString();

                        const res = await api.post('/admin/sessions', payload);
                        close();
                        showToast(`Token Sesi dibuat: ${res.data?.data?.token}`, 'success');
                        this._renderTab();
                    } catch (e) {
                        errEl.textContent = e.response?.data?.message || 'Gagal.';
                        errEl.classList.remove('hidden');
                    }
                }},
            ],
        });
    }

    // ── Tab Kelola Ruangan ──────────────────────────────────────────────────────

    async _tabRuangan() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('KELOLA RUANGAN', 'Tambah, edit, dan hapus master data ruangan fisik.', 'TAMBAH RUANGAN', () => this._modalRuangan(null)));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/rooms');
            const rooms = res.data?.data ?? [];
            wrap.innerHTML = '';

            const cols = [
                { key: 'name',        label: 'Nama Ruangan', render: r => `<span class="font-mono font-bold text-accent-gold text-base">${r.name}</span>` },
                { key: 'maxCapacity', label: 'Kapasitas Maksimal', render: r => `${r.maxCapacity} Siswa` },
                { key: 'actions',     label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-rid="${r.id}">
                        <button class="r-edit material-icons text-text-muted hover:text-online text-lg">edit</button>
                        <button class="r-del material-icons text-text-muted hover:text-primary text-lg">delete</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, rooms, { emptyMessage: 'Belum ada ruangan.' }));
            wrap.querySelectorAll('[data-rid]').forEach(el => {
                const r = rooms.find(x => x.id === Number(el.dataset.rid));
                el.querySelector('.r-edit').onclick = () => this._modalRuangan(r);
                el.querySelector('.r-del').onclick  = () => this._confirmDelete(r, 'admin/rooms');
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat data ruangan.', () => this._renderTab()));
        }
    }

    _modalRuangan(existing = null) {
        const isEdit = !!existing;
        createModal({
            title: isEdit ? 'Edit Ruangan' : 'Tambah Ruangan Baru',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Nama Ruangan (max 20 karakter)</label>
                        <input id="rm-name" type="text" value="${isEdit ? existing.name : ''}" placeholder="cth. RUANG-14" maxlength="20" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter uppercase">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Kapasitas Maksimal</label>
                        <input id="rm-cap" type="number" min="1" value="${isEdit ? existing.maxCapacity : '36'}" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div id="rm-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: isEdit ? 'Simpan' : 'Buat', variant: 'primary', onClick: async (close, bodyEl) => {
                    const name = bodyEl.querySelector('#rm-name').value.trim().toUpperCase();
                    const maxCapacity = bodyEl.querySelector('#rm-cap').value;
                    const errEl = bodyEl.querySelector('#rm-err');

                    if (!name) { errEl.textContent = 'Nama ruangan wajib diisi.'; errEl.classList.remove('hidden'); return; }
                    if (!maxCapacity || Number(maxCapacity) <= 0) { errEl.textContent = 'Kapasitas maksimal wajib berupa angka positif.'; errEl.classList.remove('hidden'); return; }

                    try {
                        const payload = { name, maxCapacity: Number(maxCapacity) };
                        if (isEdit) {
                            await api.put(`/admin/rooms/${existing.id}`, payload);
                        } else {
                            await api.post('/admin/rooms', payload);
                        }
                        close();
                        this._renderTab();
                    } catch (e) {
                        errEl.textContent = e.response?.data?.message || 'Gagal menyimpan.';
                        errEl.classList.remove('hidden');
                    }
                }},
            ],
        });
    }

    // ── Confirm Delete ─────────────────────────────────────────────────────────

    _confirmDelete(item, path) {
        createModal({
            title: 'Konfirmasi Hapus',
            bodyHtml: `<p class="font-inter text-text-primary">Hapus <strong>${item.name || item.title || item.token}</strong>? Tindakan ini tidak dapat dibatalkan.</p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Hapus', variant: 'primary', onClick: async (close) => {
                    try { await api.delete(`/${path}/${item.id}`); close(); this._renderTab(); }
                    catch (e) { showToast(e.response?.data?.message || 'Gagal menghapus.', 'error'); close(); }
                }},
            ],
        });
    }
}