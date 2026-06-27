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
    { id: 'overview',      icon: 'dashboard',    label: 'Overview',       path: '/admin' },
    { id: 'guru',          icon: 'school',        label: 'Kelola Guru',    path: '/admin?tab=guru' },
    { id: 'siswa',         icon: 'groups',        label: 'Kelola Siswa',   path: '/admin?tab=siswa' },
    { id: 'mapel',         icon: 'menu_book',     label: 'Mata Pelajaran', path: '/admin?tab=mapel' },
    { id: 'ujian',         icon: 'fact_check',    label: 'Kelola Ujian',   path: '/admin?tab=ujian' },
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
        } catch (_) {
            // Abaikan jika socket error (fallback ke manual refresh)
        }
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary flex';
        this.container.setAttribute('data-page', 'admin-dashboard');
        this.container.appendChild(createSidebar(this.activeTab, MENU_ITEMS, 'ADMIN SEKOLAH'));

        const main = createElement('div', 'flex-1 min-h-screen flex flex-col');
        main.appendChild(createMobileTopBar('EXAM-PONCOL', MENU_ITEMS, this.activeTab));

        this.contentArea = createElement('div', 'flex-1 px-lg md:px-xl py-lg md:py-xl');
        main.appendChild(this.contentArea);
        this.container.appendChild(main);

        this._renderTab();
        return this.container;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    _renderTab() {
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
        (map[this.activeTab] || (() => this._tabOverview()))();
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
        const grid = createElement('div', 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-xl');
        this.contentArea.appendChild(grid);

        try {
            const [usersRes, examsRes] = await Promise.all([api.get('/admin/users'), api.get('/admin/exams')]);
            const users = usersRes.data?.data ?? [];
            const exams = examsRes.data?.data ?? [];
            grid.appendChild(createStatCard({ icon: 'school',       label: 'Total Guru',  value: users.filter(u => u.role === 'teacher').length, accent: 'gold' }));
            grid.appendChild(createStatCard({ icon: 'groups',       label: 'Total Siswa', value: users.filter(u => u.role === 'student').length, accent: 'primary' }));
            grid.appendChild(createStatCard({ icon: 'fact_check',   label: 'Total Ujian', value: exams.length, accent: 'online' }));
            grid.appendChild(createStatCard({ icon: 'check_circle', label: 'Ujian Aktif', value: exams.filter(e => e.status === 'active').length, accent: 'muted' }));
        } catch (_) {
            grid.innerHTML = `<p class="text-text-muted font-inter text-sm col-span-4">Gagal memuat statistik.</p>`;
        }
    }

    // ── Tab Guru ───────────────────────────────────────────────────────────────

    async _tabGuru() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('KELOLA GURU', 'Tambah dan kelola akun guru.', 'TAMBAH GURU', () => this._modalUser(null, 'teacher')));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/users?role=teacher');
            const teachers = res.data?.data ?? [];
            wrap.innerHTML = '';

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
            wrap.appendChild(createTable(cols, teachers));
            wrap.querySelectorAll('[data-uid]').forEach(el => {
                const u = teachers.find(t => t.id === Number(el.dataset.uid));
                el.querySelector('.u-edit').onclick = () => this._modalUser(u, 'teacher');
                el.querySelector('.u-del').onclick  = () => this._confirmDelete(u, 'admin/users');
            });
        } catch (e) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat data guru.', () => this._tabGuru()));
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
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/users?role=student');
            const students = res.data?.data ?? [];
            wrap.innerHTML = '';

            const cols = [
                { key: 'name',     label: 'Nama Siswa' },
                { key: 'nisn',     label: 'NISN' },
                { key: 'class',    label: 'Kelas' },
                { key: 'room',     label: 'Ruang' },
                { key: 'verified', label: 'Status', render: r => statusPill(r.verified ? 'aktif' : 'nonaktif') },
                { key: 'actions',  label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-uid="${r.id}">
                        <button class="u-edit material-icons text-text-muted hover:text-online text-lg">edit</button>
                        <button class="u-del material-icons text-text-muted hover:text-primary text-lg">delete</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, students));
            wrap.querySelectorAll('[data-uid]').forEach(el => {
                const u = students.find(s => s.id === Number(el.dataset.uid));
                el.querySelector('.u-edit').onclick = () => this._modalUser(u, 'student');
                el.querySelector('.u-del').onclick  = () => this._confirmDelete(u, 'admin/users');
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat data siswa.', () => this._tabSiswa()));
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
                        this._tabSiswa();
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
                        this._tabSiswa();
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
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const [examsRes, banksRes] = await Promise.all([api.get('/admin/exams'), api.get('/admin/question-banks')]);
            this._examsList = examsRes.data?.data ?? [];
            this._banksList = banksRes.data?.data ?? [];
            wrap.innerHTML = '';
            this._renderExamTable(wrap);
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat ujian.', () => this._tabUjian()));
        }
    }

    _renderExamTable(wrap) {
        wrap.innerHTML = '';
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
        wrap.appendChild(createTable(cols, this._examsList));

        wrap.querySelectorAll('[data-eid]').forEach(el => {
            const exam = this._examsList.find(e => e.id === Number(el.dataset.eid));
            el.querySelector('.e-edit')?.addEventListener('click', () => this._modalUjian(exam));
            el.querySelector('.e-activate')?.addEventListener('click', async () => {
                await api.post(`/admin/exams/${exam.id}/activate`);
                this._tabUjian();
            });
            el.querySelector('.e-complete')?.addEventListener('click', async () => {
                if (!confirm(`Tutup ujian "${exam.title}"?`)) return;
                await api.post(`/admin/exams/${exam.id}/complete`);
                this._tabUjian();
            });
            el.querySelector('.e-reset')?.addEventListener('click', async () => {
                const res = await api.post(`/admin/exams/${exam.id}/reset-token`);
                 showToast(`Token baru: ${res.data?.data?.token}`, 'success');
                 this._tabUjian();
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
                        this._tabUjian();
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
            wrap.appendChild(this._error('Gagal memuat data kelas.', () => this._tabKelas()));
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
                        this._tabKelas();
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
            wrap.appendChild(createTable(cols, proctors, { emptyMessage: 'Belum ada proktor.' }));
            wrap.querySelectorAll('[data-pid]').forEach(el => {
                const p = proctors.find(x => x.id === Number(el.dataset.pid));
                el.querySelector('.p-edit').onclick = () => this._modalProktor(p);
                el.querySelector('.p-del').onclick  = () => this._confirmDeleteProktor(p);
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat data proktor.', () => this._tabProktor()));
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
                        close(); this._tabProktor();
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
                    try { await api.delete(`/admin/proctors/${p.id}`); close(); this._tabProktor(); }
                    catch (e) { showToast(e.response?.data?.message || 'Gagal menghapus.', 'error'); close(); }
                }},
            ],
        });
    }

    // ── Tab Mata Pelajaran ─────────────────────────────────────────────────────

    async _tabMapel() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header('MATA PELAJARAN', 'Daftar bank soal per mata pelajaran.', 'BUAT BANK SOAL', () => this._modalBuatBankSoal()));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/question-banks');
            const banks = res.data?.data ?? [];
            this._subjectsList = [...new Set(banks.map(b => b.subject).filter(Boolean))].sort();
            wrap.innerHTML = '';

            const cols = [
                { key: 'subject',       label: 'Mata Pelajaran' },
                { key: 'name',          label: 'Nama Bank Soal' },
                { key: 'questionCount', label: 'Jumlah Soal' },
                { key: 'creator',       label: 'Dibuat Oleh' },
                { key: 'actions', label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-bid="${r.id}">
                        <button class="bk-del material-icons text-text-muted hover:text-primary text-lg">delete</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, banks, { emptyMessage: 'Belum ada bank soal.' }));
            wrap.querySelectorAll('[data-bid]').forEach(el => {
                const bank = banks.find(b => b.id === Number(el.dataset.bid));
                el.querySelector('.bk-del').onclick = () => this._confirmDeleteBank(bank);
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat mata pelajaran.', () => this._tabMapel()));
        }
    }

    _modalBuatBankSoal() {
        createModal({
            title: 'Buat Bank Soal Baru',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Nama Bank Soal</label>
                        <input id="mb-name" type="text" placeholder="cth. PTS Ganjil 2026" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Mata Pelajaran</label>
                        <input id="mb-subj" type="text" placeholder="cth. Produktif TKRO" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                        <p class="text-xs text-text-muted font-inter mt-xs">Tulis nama mapel lengkap dan konsisten.</p>
                    </div>
                    <div id="mb-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Buat', variant: 'primary', onClick: async (close, body) => {
                    const name    = body.querySelector('#mb-name').value.trim();
                    const subject = body.querySelector('#mb-subj').value.trim();
                    const errEl   = body.querySelector('#mb-err');
                    if (!name || !subject) { errEl.textContent = 'Semua field wajib diisi.'; errEl.classList.remove('hidden'); return; }
                    try { await api.post('/admin/question-banks', { name, subject }); close(); this._tabMapel(); }
                    catch (e) { errEl.textContent = e.response?.data?.message || 'Gagal.'; errEl.classList.remove('hidden'); }
                }},
            ],
        });
    }

    _confirmDeleteBank(bank) {
        createModal({
            title: 'Hapus Bank Soal',
            bodyHtml: `<p class="font-inter text-text-primary">Hapus bank soal <strong>${bank.name}</strong> (${bank.subject})?<br><span class="text-primary text-sm">Semua soal di dalamnya ikut terhapus.</span></p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Hapus', variant: 'primary', onClick: async (close) => {
                    try { await api.delete(`/admin/question-banks/${bank.id}`); close(); this._tabMapel(); }
                    catch (e) { showToast(e.response?.data?.message || 'Gagal menghapus.', 'error'); close(); }
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

            const cols = [
                { key: 'token',       label: 'Token Sesi', render: r => `<span class="font-mono font-bold text-accent-gold text-lg">${r.token}</span>` },
                { key: 'room',        label: 'Ruangan', render: r => r.room ? r.room.name : '-' },
                { key: 'proctor',     label: 'Proktor', render: r => r.proctor ? r.proctor.name : '-' },
                { key: 'description', label: 'Keterangan' },
                { key: 'active',      label: 'Status', render: r => statusPill(r.active ? 'aktif' : 'nonaktif') },
                { key: 'actions',     label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-sid="${r.id}">
                        <button class="s-toggle material-icons text-text-muted hover:text-online text-lg">${r.active ? 'block' : 'check_circle'}</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, sessions));
            wrap.querySelectorAll('[data-sid]').forEach(el => {
                const sess = sessions.find(s => s.id === Number(el.dataset.sid));
                el.querySelector('.s-toggle').onclick = async () => {
                    await api.patch(`/admin/sessions/${sess.id}`, { active: !sess.active });
                    this._tabTokenSesi();
                };
            });
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat Token Sesi.', () => this._tabTokenSesi()));
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
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Keterangan <span class="text-text-muted font-normal">(opsional)</span></label>
                        <input id="ts-desc" type="text" placeholder="cth. Sesi Ujian Produktif" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div id="ts-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            onMount: async (bodyEl) => {
                const roomSel = bodyEl.querySelector('#ts-room');
                const proctorSel = bodyEl.querySelector('#ts-proctor');

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
                    const errEl = bodyEl.querySelector('#ts-err');

                    if (!roomId) { errEl.textContent = 'Pilih ruangan terlebih dahulu.'; errEl.classList.remove('hidden'); return; }

                    try {
                        const payload = { roomId: Number(roomId) };
                        if (proctorId) payload.proctorId = Number(proctorId);
                        if (desc) payload.description = desc;

                        const res = await api.post('/admin/sessions', payload);
                        close();
                        showToast(`Token Sesi dibuat: ${res.data?.data?.token}`, 'success');
                        this._tabTokenSesi();
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
            wrap.appendChild(this._error('Gagal memuat data ruangan.', () => this._tabRuangan()));
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
                        this._tabRuangan();
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