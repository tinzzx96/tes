import { BasePage } from './BasePage.js';
import { createElement, fadeUpClass } from '../utils/dom.js';
import { createMiniHeader } from '../components/Header.js';
import { createBottomNav } from '../components/Navigation.js';
import { createAvatar } from '../components/Avatar.js';
import { createCard, createExamCard } from '../components/Card.js';
import { createButton } from '../components/Button.js';
import { statusPill } from '../components/Table.js';
import { createStatusHeader } from '../components/StatusHeader.js';
import { createGreeting, createTodaySummaryPill } from '../components/Greeting.js';
import { authService } from '../services/auth.js';
import { api } from '../services/api.js';
import { getTodayExamSummaryText } from '../utils/helpers.js';
import {
    getDeviceInfo,
    getDeviceIcon,
    getConnectionState,
    getLocalNetworkInfo,
    checkBrowserCompatibility,
    subscribeConnectionState,
} from '../utils/userAgent.js';

export class HomePage extends BasePage {
    constructor() {
        super();
        this.setTitle('Home');
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary pb-20';
        this.container.setAttribute('data-page', 'home');

        const header = createMiniHeader();
        this.container.appendChild(header);

        const status = createStatusHeader({ onDevRefresh: () => this.handleDevRefresh() });
        this.statusHeaderDestroy = status.destroy;
        this.container.appendChild(status.element);

        const content = createElement('div', 'px-lg py-lg');

        content.appendChild(createGreeting({ withDate: true, className: 'mb-md' }));

        const user = authService.getCurrentUser();
        const userSection = createElement('div', 'flex items-start justify-between mb-xl');

        const identity = createElement('div', 'flex items-center gap-md');
        const avatar = createAvatar(user.name, 'md');
        avatar.classList.add('border-white', 'border-opacity-85');
        avatar.style.borderRadius = '11px';
        identity.appendChild(avatar);

        const userInfo = createElement('div', '');
        const nameEl = createElement('h2', 'font-alumni font-bold text-student-name text-text-primary uppercase tracking-wide');
        nameEl.textContent = user.name;
        userInfo.appendChild(nameEl);

        const chips = createElement('div', 'flex items-center gap-sm mt-xs flex-wrap');
        chips.innerHTML = `
            <span class="inline-flex items-center gap-1 bg-bg-surface text-text-secondary text-xs font-inter px-sm py-0.5 rounded-full">
                <span class="material-icons text-xs">badge</span>${user.nisn}
            </span>
            <span class="inline-flex items-center gap-1 bg-bg-surface text-text-secondary text-xs font-inter px-sm py-0.5 rounded-full">
                <span class="material-icons text-xs">school</span>${user.class}
            </span>
        `;
        userInfo.appendChild(chips);
        identity.appendChild(userInfo);
        userSection.appendChild(identity);

        const readyBadge = createElement('div', 'flex items-center gap-1.5 bg-bg-surface px-sm py-1 rounded-full mt-1');
        readyBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-online"></span><span class="text-xs font-inter font-bold text-online">Siap</span>`;
        userSection.appendChild(readyBadge);

        content.appendChild(userSection);

        // Device Status Card
        const deviceSection = createElement('div', '');
        deviceSection.innerHTML = `<h3 class="font-inter font-bold text-label-caps text-text-muted mb-md uppercase tracking-label">DEVICE STATUS</h3>`;

        const deviceInfo = getDeviceInfo();
        this.compatibility = checkBrowserCompatibility();

        const deviceCard = createCard({ variant: 'light' });
        deviceCard.innerHTML = `
            <div class="grid grid-cols-2 gap-md mb-md">
                <div>
                    <p class="text-label-caps text-text-muted font-inter mb-xs uppercase">Device</p>
                    <p class="font-inter font-bold text-card-title text-text-dark">${deviceInfo.deviceLabel}</p>
                </div>
                <div>
                    <p class="text-label-caps text-text-muted font-inter mb-xs uppercase">Room</p>
                    <p class="font-inter font-bold text-card-title text-text-dark">${user.room || '-'}</p>
                </div>
                <div>
                    <p class="text-label-caps text-text-muted font-inter mb-xs uppercase">Network</p>
                    <p class="font-inter font-bold text-card-title text-text-dark" id="network-value">Mendeteksi...</p>
                </div>
                <div>
                    <p class="text-label-caps text-text-muted font-inter mb-xs uppercase">Session</p>
                    <div id="session-status-badge">${statusPill('connecting')}</div>
                </div>
            </div>
            <div class="border-t border-divider pt-md mt-md">
                <div class="flex items-center gap-sm text-text-secondary text-sm font-inter mb-sm">
                    <span class="material-icons text-sm">${getDeviceIcon(deviceInfo.deviceType)}</span>
                    <span>Detected: ${deviceInfo.browserLabel} · ${deviceInfo.osLabel}</span>
                </div>
                <div class="flex items-center justify-center gap-sm text-text-secondary text-sm font-inter">
                    <span class="material-icons text-sm">verified_user</span>
                    <span>Perangkat Terverifikasi</span>
                </div>
            </div>
        `;
        deviceSection.appendChild(deviceCard);
        content.appendChild(deviceSection);

        this.sessionStatusBadge = deviceCard.querySelector('#session-status-badge');
        this.networkValueEl = deviceCard.querySelector('#network-value');

        // Today's Exams — container diisi oleh loadExams() di mounted()
        const examsSection = createElement('div', 'mt-xl');
        const examsHeader = createElement('div', 'flex items-center justify-between mb-md');
        examsHeader.innerHTML = `<h3 class="font-inter font-bold text-label-caps text-text-muted uppercase tracking-label">TODAY'S EXAMS</h3>`;
        this.examsSummaryTarget = examsHeader; // untuk update summary pill
        examsSection.appendChild(examsHeader);

        // Container kosong — diisi async setelah mount
        this.examsList = createElement('div', '');
        this.examsList.innerHTML = `
            <div class="flex items-center gap-sm text-text-secondary py-lg">
                <span class="material-icons text-sm animate-spin">progress_activity</span>
                <span class="font-inter text-sm">Memuat jadwal ujian...</span>
            </div>
        `;
        examsSection.appendChild(this.examsList);

        content.appendChild(examsSection);
        this.container.appendChild(content);

        const nav = createBottomNav('home');
        this.container.appendChild(nav);

        return this.container;
    }

    mounted() {
        this._connectTimeout = setTimeout(() => this.refreshSessionStatus(), 700);
        this.unsubscribeConnection = subscribeConnectionState(() => this.refreshSessionStatus());

        getLocalNetworkInfo().then(({ ip, detected }) => {
            if (!this.networkValueEl) return;
            const { connectionType } = getConnectionState();
            const typeLabel = connectionType ? ` (${connectionType.toUpperCase()})` : '';
            this.networkValueEl.textContent = detected ? `${ip}${typeLabel}` : 'IP tidak terdeteksi';
        });

        // Load ujian dari server
        this.loadExams();
    }

    async loadExams() {
        try {
            const res = await api.getExams();
            const exams = res.data?.data ?? [];

            if (!this.examsList) return;
            this.examsList.innerHTML = '';

            if (exams.length === 0) {
                this.examsList.innerHTML = `
                    <div class="text-center py-xl text-text-secondary font-inter text-sm">
                        Tidak ada ujian hari ini.
                    </div>
                `;
                return;
            }

            // Update summary pill
            const completedCount = exams.filter(e => e.attemptStatus === 'submitted').length;
            const summaryText = getTodayExamSummaryText(exams.length, completedCount);
            const pill = createTodaySummaryPill(summaryText, {
                allDone: exams.length > 0 && completedCount >= exams.length,
            });
            // Hapus pill lama jika ada
            const oldPill = this.examsSummaryTarget?.querySelector('[data-summary-pill]');
            if (oldPill) oldPill.remove();
            pill.setAttribute('data-summary-pill', '');
            this.examsSummaryTarget?.appendChild(pill);

            exams.forEach((exam, idx) => {
                const isCompleted = exam.attemptStatus === 'submitted';
                const isActive    = exam.status === 'active';

                const examCard = createExamCard({
                    subject:     exam.subject,
                    teacher:     exam.teacher ?? '-',
                    time:        `${this._fmt(exam.startTime)} – ${this._fmt(exam.endTime)}`,
                    duration:    exam.durationMinutes,
                    isUrgent:    isActive && !isCompleted,
                    isCompleted,
                    code:        exam.examCode,
                });
                examCard.classList.add(...fadeUpClass(idx).split(' '));
                this.examsList.appendChild(examCard);

                const btnContainer = createElement('div', 'mb-md');
                let btn;
                if (isCompleted) {
                    btn = createButton('SELESAI', { size: 'md', icon: 'check', variant: 'secondary', disabled: true });
                } else if (isActive) {
                    btn = createButton('MULAI UJIAN', {
                        size: 'md',
                        icon: 'flash_on',
                        onClick: () => {
                            sessionStorage.setItem('current_exam_id', String(exam.id));
                            window.app.router.navigate('/token');
                        },
                    });
                } else {
                    btn = createButton('BELUM AKTIF', { size: 'md', icon: 'schedule', variant: 'secondary', disabled: true });
                }
                btnContainer.appendChild(btn);
                this.examsList.appendChild(btnContainer);
            });

        } catch (err) {
            if (!this.examsList) return;
            this.examsList.innerHTML = `
                <div class="text-center py-xl font-inter text-sm">
                    <span class="text-primary">Gagal memuat jadwal.</span>
                    <button class="ml-sm underline text-text-secondary" id="retry-exams">Coba lagi</button>
                </div>
            `;
            this.examsList.querySelector('#retry-exams')?.addEventListener('click', () => this.loadExams());
        }
    }

    _fmt(iso) {
        if (!iso) return '--:--';
        return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    refreshSessionStatus() {
        if (!this.sessionStatusBadge) return;
        const { online } = getConnectionState();
        let status = 'active';
        if (!online) status = 'disconnected';
        else if (!this.compatibility?.supported) status = 'connecting';
        this.sessionStatusBadge.innerHTML = statusPill(status);
    }

    handleDevRefresh() {
        if (!this.sessionStatusBadge) return;
        this.sessionStatusBadge.innerHTML = statusPill('connecting');
        clearTimeout(this._connectTimeout);
        this._connectTimeout = setTimeout(() => this.refreshSessionStatus(), 700);
    }

    beforeUnmount() {
        clearTimeout(this._connectTimeout);
        this.unsubscribeConnection?.();
        this.statusHeaderDestroy?.();
    }
}
