import { BasePage } from './BasePage.js';
import { createElement } from '../utils/dom.js';
import { createSidebar, createMobileTopBar } from '../components/Sidebar.js';
import { createStatCard } from '../components/StatCard.js';
import { createTable, statusPill } from '../components/Table.js';
import { createButton } from '../components/Button.js';
import { createModal } from '../components/Modal.js';
import { authService } from '../services/auth.js';
import { api } from '../services/api.js';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const MENU_ITEMS = [
    { id: 'overview',      icon: 'dashboard',    label: 'Overview',       path: '/admin' },
    { id: 'guru',          icon: 'school',        label: 'Kelola Guru',    path: '/admin?tab=guru' },
    { id: 'siswa',         icon: 'groups',        label: 'Kelola Siswa',   path: '/admin?tab=siswa' },
    { id: 'mapel',         icon: 'menu_book',     label: 'Mata Pelajaran', path: '/admin?tab=mapel' },
    { id: 'ujian',         icon: 'fact_check',    label: 'Kelola Ujian',   path: '/admin?tab=ujian' },
    { id: 'proktor',       icon: 'security',      label: 'Kelola Proktor', path: '/admin?tab=proktor' },
    { id: 'token-sesi',    icon: 'key',           label: 'Token Sesi',     path: '/admin?tab=token-sesi' },
    { id: 'token-ujian',   icon: 'vpn_key',       label: 'Token Ujian',    path: '/admin?tab=token-ujian' },
];

export class DashboardAdminPage extends BasePage {
    constructor() {
        super();
        this.setTitle('Dashboard Admin');
        this.activeTab = new URLSearchParams(window.location.search).get('tab') || 'overview';
        this._subjectsList = []; // cache mapel untuk dropdown
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
            guru:         () => this._tabGuru(),
            siswa:        () => this._tabSiswa(),
            mapel:        () => this._tabMapel(),
            proktor:      () => this._tabProktor(),
            ujian:        () => this._tabUjian(),
            'token-sesi': () => this._tabTokenSesi(),
            'token-ujian':() => this._tabTokenUjian(),
        };
        (map[this.activeTab] || (() => this._tabOverview()))();
    }

    _header(title, subtitle, btnLabel, onBtn) {
        const h = createElement('div', 'flex flex-wrap items-start justify-between gap-md mb-xl');
        h.innerHTML = `<div>
            <h1 class="font-barlow font-extrabold text-page-title text-text-primary mb-xs">${title}</h1>
            <p class="font-inter text-text-secondary text-sm">${subtitle}</p>
        </div>`;
        if (btnLabel) {
            const btn = createButton(btnLabel, { size: 'sm', icon: 'add_circle', className: 'w-auto', onClick: onBtn });
            h.appendChild(btn);
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
        const btn = createButton('Coba Lagi', { size: 'sm', icon: 'refresh', className: 'w-auto mx-auto', onClick: retry });
        d.appendChild(btn);
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
            const [usersRes, examsRes] = await Promise.all([
                api.get('/admin/users'),
                api.get('/admin/exams'),
            ]);
            const users = usersRes.data?.data ?? [];
            const exams = examsRes.data?.data ?? [];
            const teachers = users.filter(u => u.role === 'teacher');
            const students = users.filter(u => u.role === 'student');

            grid.appendChild(createStatCard({ icon: 'school',      label: 'Total Guru',   value: teachers.length,                            accent: 'gold' }));
            grid.appendChild(createStatCard({ icon: 'groups',      label: 'Total Siswa',  value: students.length,                            accent: 'primary' }));
            grid.appendChild(createStatCard({ icon: 'fact_check',  label: 'Total Ujian',  value: exams.length,                               accent: 'online' }));
            grid.appendChild(createStatCard({ icon: 'check_circle',label: 'Ujian Aktif',  value: exams.filter(e => e.status === 'active').length, accent: 'muted' }));
        } catch (_) {
            grid.innerHTML = `<p class="text-text-muted font-inter text-sm col-span-4">Gagal memuat statistik.</p>`;
        }
    }

    // ── Tab Guru (role=teacher) ────────────────────────────────────────────────

    async _tabGuru() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header(
            'KELOLA GURU', 'Tambah dan kelola akun guru.',
            'TAMBAH GURU', () => this._modalUser(null, 'teacher')
        ));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const [res, banksRes] = await Promise.all([
                api.get('/admin/users?role=teacher'),
                api.get('/admin/question-banks'),
            ]);
            const teachers = res.data?.data ?? [];
            this._subjectsList = [...new Set((banksRes.data?.data ?? []).map(b => b.subject).filter(Boolean))].sort();
            wrap.innerHTML = '';

            const cols = [
                { key: 'name',  label: 'Nama' },
                { key: 'nisn',  label: 'NIP / NISN' },
                { key: 'class', label: 'Kelas / Mapel' },
                { key: 'verified', label: 'Status', render: r => statusPill(r.verified ? 'aktif' : 'nonaktif') },
                { key: 'actions', label: 'Aksi', render: r => `
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

    // ── Tab Siswa (role=student) ───────────────────────────────────────────────

    async _tabSiswa() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header(
            'KELOLA SISWA', 'Tambah, edit, dan kelola akun siswa.',
            'TAMBAH SISWA', () => this._modalUser(null, 'student')
        ));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/users?role=student');
            const students = res.data?.data ?? [];
            wrap.innerHTML = '';

            const cols = [
                { key: 'name',  label: 'Nama Siswa' },
                { key: 'nisn',  label: 'NISN' },
                { key: 'class', label: 'Kelas' },
                { key: 'room',  label: 'Ruang' },
                { key: 'verified', label: 'Status', render: r => statusPill(r.verified ? 'aktif' : 'nonaktif') },
                { key: 'actions', label: 'Aksi', render: r => `
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

    // ── Modal User (guru / siswa) ──────────────────────────────────────────────

    async _modalUser(existing, role) {
        const isEdit = !!existing;
        const roleLabel = role === 'teacher' ? 'Guru' : 'Siswa';
        const subjects = this._subjectsList || [];

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
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">
                            ${role === 'teacher' ? 'Mata Pelajaran' : 'Kelas'}
                        </label>
                        <div id="u-class-wrap"></div>
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Ruang</label>
                        <input id="u-room" type="text" value="${isEdit ? (existing.room ?? '') : ''}" placeholder="cth. Ruang-14" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div id="u-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            onMount: (bodyEl) => {
                const wrap = bodyEl.querySelector('#u-class-wrap');
                if (role === 'teacher') {
                    // Dropdown mata pelajaran dari bank soal
                    const sel = document.createElement('select');
                    sel.id = 'u-class';
                    sel.className = 'w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter';
                    sel.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>' +
                        subjects.map(s => `<option value="${s}" ${isEdit && existing.class === s ? 'selected' : ''}>${s}</option>`).join('');
                    wrap.appendChild(sel);
                    if (!subjects.length) {
                        const info = document.createElement('p');
                        info.className = 'text-xs text-accent-gold font-inter mt-xs';
                        info.textContent = 'Belum ada bank soal. Buat dulu di tab Mata Pelajaran agar mapel muncul di sini.';
                        wrap.appendChild(info);
                    }
                } else {
                    // Input teks untuk kelas siswa
                    const inp = document.createElement('input');
                    inp.id = 'u-class'; inp.type = 'text';
                    inp.value = isEdit ? (existing.class ?? '') : '';
                    inp.placeholder = 'cth. XI RPL 1';
                    inp.className = 'w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter';
                    wrap.appendChild(inp);
                }
            },
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Simpan', variant: 'primary', onClick: async (close, modalEl) => {
                    const name  = modalEl.querySelector('#u-name').value.trim();
                    const nisn  = modalEl.querySelector('#u-nisn').value.trim();
                    const pass  = modalEl.querySelector('#u-pass').value;
                    const kelas = modalEl.querySelector('#u-class').value.trim();
                    const room  = modalEl.querySelector('#u-room').value.trim();
                    const errEl = modalEl.querySelector('#u-err');

                    if (!name || (!isEdit && !nisn)) {
                        errEl.textContent = 'Nama dan NISN wajib diisi.';
                        errEl.classList.remove('hidden'); return;
                    }
                    try {
                        const body = { name, class: kelas, room, role, verified: true };
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
            const [examsRes, banksRes] = await Promise.all([
                api.get('/admin/exams'),
                api.get('/admin/question-banks'),
            ]);
            this._examsList  = examsRes.data?.data ?? [];
            this._banksList  = banksRes.data?.data ?? [];
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
            { key: 'room',    label: 'Ruang' },
            { key: 'token',   label: 'Token', render: r => `<span class="font-mono font-bold text-accent-gold">${r.token}</span>` },
            { key: 'status',  label: 'Status', render: r => statusPill(r.status) },
            { key: 'actions', label: 'Aksi', render: r => `
                <div class="flex gap-sm" data-eid="${r.id}">
                    <button class="e-edit material-icons text-text-muted hover:text-online text-lg" title="Edit">edit</button>
                    ${r.status === 'draft'     ? `<button class="e-activate material-icons text-text-muted hover:text-accent-gold text-lg" title="Aktifkan">play_circle</button>` : ''}
                    ${r.status === 'active'    ? `<button class="e-complete material-icons text-text-muted hover:text-primary text-lg" title="Tutup">lock</button>` : ''}
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
                alert(`Token baru: ${res.data?.data?.token}`);
                this._tabUjian();
            });
            el.querySelector('.e-del')?.addEventListener('click', () => this._confirmDelete(exam, 'admin/exams'));
        });
    }

    _modalUjian(existing) {
        const isEdit = !!existing;
        const banks  = this._banksList || [];
        const fmt    = iso => iso ? new Date(iso).toISOString().slice(0, 16) : '';

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
                    <div class="grid grid-cols-2 gap-md">
                        <div>
                            <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Durasi (menit)</label>
                            <input id="ex-dur" type="number" value="${isEdit ? existing.durationMinutes : 90}" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                        </div>
                        <div>
                            <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Ruang</label>
                            <input id="ex-room" type="text" value="${isEdit ? (existing.room ?? '') : ''}" placeholder="cth. Ruang-14" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                        </div>
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
                    <div id="ex-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            onMount: (bodyEl) => {
                // Tampilkan info mapel + guru saat pilih bank soal
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
                // Trigger langsung jika edit (bank sudah preselected)
                if (isEdit) updateInfo();
            },
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: isEdit ? 'Simpan' : 'Buat Ujian', variant: 'primary', onClick: async (close, bodyEl) => {
                    const bankSel  = bodyEl.querySelector('#ex-bank');
                    const selOpt   = bankSel.options[bankSel.selectedIndex];
                    const errEl    = bodyEl.querySelector('#ex-err');

                    const body = {
                        title:              bodyEl.querySelector('#ex-title').value.trim(),
                        question_bank_id:   Number(bankSel.value),
                        subject:            selOpt?.dataset.subject || '',
                        teacher_id:         Number(selOpt?.dataset.teacherid || 0),
                        room:               bodyEl.querySelector('#ex-room').value.trim(),
                        duration_minutes:   Number(bodyEl.querySelector('#ex-dur').value),
                        start_time:         bodyEl.querySelector('#ex-start').value,
                        end_time:           bodyEl.querySelector('#ex-end').value,
                    };

                    if (!body.title) {
                        errEl.textContent = 'Nama ujian wajib diisi.';
                        errEl.classList.remove('hidden'); return;
                    }
                    if (!body.question_bank_id) {
                        errEl.textContent = 'Pilih bank soal terlebih dahulu.';
                        errEl.classList.remove('hidden'); return;
                    }

                    try {
                        if (isEdit) await api.put(`/admin/exams/${existing.id}`, body);
                        else        await api.post('/admin/exams', body);
                        close(); this._tabUjian();
                    } catch (e) {
                        errEl.textContent = e.response?.data?.message || 'Gagal menyimpan.';
                        errEl.classList.remove('hidden');
                    }
                }},
            ],
        });
    }



    // ── Tab Kelola Proktor ─────────────────────────────────────────────────────

    async _tabProktor() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header(
            'KELOLA PROKTOR', 'Tambah pengawas ujian dan tugaskan ke ruangan.',
            'TAMBAH PROKTOR', () => this._modalProktor(null)
        ));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        // Ambil daftar ruang dari ujian yang ada (untuk dropdown room)
        let rooms = [];
        try {
            const examsRes = await api.get('/admin/exams');
            rooms = [...new Set((examsRes.data?.data ?? []).map(e => e.room).filter(Boolean))].sort();
        } catch (_) {}

        this._roomsList = rooms;

        try {
            const res = await api.get('/admin/proctors');
            const proctors = res.data?.data ?? [];
            wrap.innerHTML = '';

            const cols = [
                { key: 'name',     label: 'Nama Proktor' },
                { key: 'nisn',     label: 'NIP / NISN' },
                { key: 'room',     label: 'Ruang Tugas', render: r =>
                    r.room
                        ? `<span class="font-mono font-bold text-accent-gold">${r.room}</span>`
                        : '<span class="text-text-muted italic">Belum diset</span>' },
                { key: 'verified', label: 'Status', render: r => statusPill(r.verified ? 'aktif' : 'nonaktif') },
                { key: 'actions',  label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-pid="${r.id}">
                        <button class="p-edit material-icons text-text-muted hover:text-online text-lg" title="Edit">edit</button>
                        <button class="p-del material-icons text-text-muted hover:text-primary text-lg" title="Hapus">delete</button>
                    </div>` },
            ];
            wrap.appendChild(createTable(cols, proctors, { emptyMessage: 'Belum ada proktor. Tambahkan proktor terlebih dahulu.' }));

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
                        ${rooms.length ? `
                        <select id="pr-room" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                            <option value="">-- Pilih Ruang --</option>
                            ${rooms.map(r => `<option value="${r}" ${isEdit && existing.room === r ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                        <p class="text-xs text-text-muted font-inter mt-xs">Proktor hanya bisa monitoring siswa di ruang ini</p>
                        ` : `
                        <input id="pr-room" type="text" value="${isEdit ? (existing.room ?? '') : ''}" placeholder="cth. Ruang-7" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                        <p class="text-xs text-accent-gold font-inter mt-xs">⚠ Buat ujian dengan nama ruang dulu agar muncul di dropdown</p>
                        `}
                    </div>
                    <div id="pr-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Simpan', variant: 'primary', onClick: async (close, body) => {
                    const name  = body.querySelector('#pr-name').value.trim();
                    const nisn  = body.querySelector('#pr-nisn').value.trim();
                    const pass  = body.querySelector('#pr-pass').value;
                    const room  = body.querySelector('#pr-room').value.trim();
                    const errEl = body.querySelector('#pr-err');

                    if (!name || (!isEdit && !nisn)) {
                        errEl.textContent = 'Nama dan NIP wajib diisi.';
                        errEl.classList.remove('hidden'); return;
                    }
                    if (!room) {
                        errEl.textContent = 'Ruang tugas wajib diisi.';
                        errEl.classList.remove('hidden'); return;
                    }

                    try {
                        const payload = { name, room, verified: true };
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
            bodyHtml: `<p class="font-inter text-text-primary">Hapus akun proktor <strong>${p.name}</strong> (Ruang: ${p.room || '-'})?</p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Hapus', variant: 'primary', onClick: async (close) => {
                    try {
                        await api.delete(`/admin/proctors/${p.id}`);
                        close(); this._tabProktor();
                    } catch (e) { alert(e.response?.data?.message || 'Gagal menghapus.'); close(); }
                }},
            ],
        });
    }

    // ── Tab Mata Pelajaran ─────────────────────────────────────────────────────

    async _tabMapel() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header(
            'MATA PELAJARAN', 'Daftar bank soal per mata pelajaran.',
            'BUAT BANK SOAL', () => this._modalBuatBankSoal()
        ));
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
                        <button class="bk-del material-icons text-text-muted hover:text-primary text-lg" title="Hapus">delete</button>
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
                        <p class="text-xs text-text-muted font-inter mt-xs">Tulis nama mapel lengkap dan konsisten. Contoh: "Produktif TKRO" bukan "TKR"</p>
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
                    try {
                        await api.post('/admin/question-banks', { name, subject });
                        close(); this._tabMapel();
                    } catch (e) {
                        errEl.textContent = e.response?.data?.message || 'Gagal membuat bank soal.';
                        errEl.classList.remove('hidden');
                    }
                }},
            ],
        });
    }

    _confirmDeleteBank(bank) {
        createModal({
            title: 'Hapus Bank Soal',
            bodyHtml: `<p class="font-inter text-text-primary">Hapus bank soal <strong>${bank.name}</strong> (${bank.subject})?<br>
                       <span class="text-primary text-sm">Semua soal di dalamnya ikut terhapus.</span></p>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Hapus', variant: 'primary', onClick: async (close) => {
                    try {
                        await api.delete(`/admin/question-banks/${bank.id}`);
                        close(); this._tabMapel();
                    } catch (e) { alert(e.response?.data?.message || 'Gagal menghapus.'); close(); }
                }},
            ],
        });
    }

    // ── Tab Token Sesi ─────────────────────────────────────────────────────────

    async _tabTokenSesi() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header(
            'TOKEN SESI', 'Buat token yang dimasukkan siswa saat login.',
            'BUAT TOKEN SESI', () => this._modalTokenSesi()
        ));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const res = await api.get('/admin/sessions');
            const sessions = res.data?.data ?? [];
            wrap.innerHTML = '';

            const cols = [
                { key: 'token',       label: 'Token', render: r => `<span class="font-mono font-bold text-accent-gold">${r.token}</span>` },
                { key: 'description', label: 'Keterangan' },
                { key: 'validUntil',  label: 'Berlaku Sampai', render: r => r.validUntil ? new Date(r.validUntil).toLocaleString('id-ID') : '-' },
                { key: 'active',      label: 'Status', render: r => statusPill(r.active ? 'aktif' : 'nonaktif') },
                { key: 'actions',     label: 'Aksi', render: r => `
                    <div class="flex gap-sm" data-sid="${r.id}">
                        <button class="s-toggle material-icons text-text-muted hover:text-online text-lg" title="${r.active ? 'Nonaktifkan' : 'Aktifkan'}">${r.active ? 'block' : 'check_circle'}</button>
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

    _modalTokenSesi() {
        const todayMidnight = new Date();
        todayMidnight.setHours(23, 59, 0, 0);
        const midStr = todayMidnight.toISOString().slice(0, 16);

        createModal({
            title: 'Buat Token Sesi Baru',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Token (max 20 karakter)</label>
                        <input id="ts-token" type="text" placeholder="cth. SESI02" maxlength="20" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter uppercase">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Keterangan</label>
                        <input id="ts-desc" type="text" placeholder="cth. Token Sesi Hari Selasa" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Berlaku Sampai</label>
                        <input id="ts-until" type="datetime-local" value="${midStr}" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                    </div>
                    <div id="ts-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Buat Token', variant: 'primary', onClick: async (close, body) => {
                    const token = body.querySelector('#ts-token').value.trim().toUpperCase();
                    const desc  = body.querySelector('#ts-desc').value.trim();
                    const until = body.querySelector('#ts-until').value;
                    const errEl = body.querySelector('#ts-err');
                    if (!token) { errEl.textContent = 'Token wajib diisi.'; errEl.classList.remove('hidden'); return; }
                    try {
                        await api.post('/admin/sessions', { token, description: desc, validUntil: until || undefined });
                        close(); this._tabTokenSesi();
                    } catch (e) {
                        errEl.textContent = e.response?.data?.message || 'Gagal membuat token.';
                        errEl.classList.remove('hidden');
                    }
                }},
            ],
        });
    }

    // ── Tab Token Ujian ────────────────────────────────────────────────────────

    async _tabTokenUjian() {
        this.contentArea.innerHTML = '';
        this.contentArea.appendChild(this._header(
            'TOKEN UJIAN', 'Buat token per mapel yang diminta siswa sebelum mengerjakan.',
            'BUAT TOKEN UJIAN', () => this._modalTokenUjian()
        ));
        const wrap = createElement('div', '');
        this.contentArea.appendChild(wrap);
        wrap.appendChild(this._loading());

        try {
            const [tokensRes, examsRes] = await Promise.all([
                api.get('/admin/exam-tokens'),
                api.get('/admin/exams'),
            ]);
            this._examsList = examsRes.data?.data ?? [];
            const tokens = tokensRes.data?.data ?? [];
            wrap.innerHTML = '';

            const cols = [
                { key: 'token', label: 'Token Ujian', render: r => `<span class="font-mono font-bold text-accent-gold">${r.token}</span>` },
                { key: 'exam',  label: 'Ujian', render: r => r.exam?.title ?? '-' },
                { key: 'subject', label: 'Mapel', render: r => r.exam?.subject ?? '-' },
                { key: 'createdAt', label: 'Dibuat', render: r => new Date(r.createdAt).toLocaleString('id-ID') },
            ];
            wrap.appendChild(createTable(cols, tokens));
        } catch (_) {
            wrap.innerHTML = '';
            wrap.appendChild(this._error('Gagal memuat Token Ujian.', () => this._tabTokenUjian()));
        }
    }

    _modalTokenUjian() {
        const exams = this._examsList || [];
        createModal({
            title: 'Buat Token Ujian',
            bodyHtml: `
                <div class="flex flex-col gap-md">
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Pilih Ujian</label>
                        <select id="tu-exam" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter">
                            ${exams.map(e => `<option value="${e.id}">${e.title} (${e.subject})</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label">Token (max 20 karakter)</label>
                        <input id="tu-token" type="text" placeholder="cth. UJIAN02" maxlength="20" class="w-full px-md py-3 bg-bg-primary border border-gray-600 rounded-input text-text-primary font-inter uppercase">
                    </div>
                    <div id="tu-err" class="hidden text-primary text-sm font-inter"></div>
                </div>`,
            footerButtons: [
                { text: 'Batal', variant: 'secondary', onClick: close => close() },
                { text: 'Buat Token', variant: 'primary', onClick: async (close, body) => {
                    const examId = Number(body.querySelector('#tu-exam').value);
                    const token  = body.querySelector('#tu-token').value.trim().toUpperCase();
                    const errEl  = body.querySelector('#tu-err');
                    if (!token) { errEl.textContent = 'Token wajib diisi.'; errEl.classList.remove('hidden'); return; }
                    try {
                        await api.post('/admin/exam-tokens', { examId, token });
                        close(); this._tabTokenUjian();
                    } catch (e) {
                        errEl.textContent = e.response?.data?.message || 'Gagal membuat token.';
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
                    try {
                        await api.delete(`/${path}/${item.id}`);
                        close(); this._renderTab();
                    } catch (e) {
                        alert(e.response?.data?.message || 'Gagal menghapus.');
                        close();
                    }
                }},
            ],
        });
    }
}
