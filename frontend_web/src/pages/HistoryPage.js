import { BasePage } from './BasePage.js';
import { createElement, fadeUpClass } from '../utils/dom.js';
import { createMiniHeader } from '../components/Header.js';
import { createBottomNav } from '../components/Navigation.js';
import { createStatusHeader } from '../components/StatusHeader.js';
import { createSectionHeader, createHistoryCard } from '../components/Card.js';
import { createButton } from '../components/Button.js';
import { api } from '../services/api.js';
import { groupByDate } from '../utils/helpers.js';

/**
 * History page (PRD Bagian 1 / ADD_FEATURE Phase 1).
 *
 * IMPORTANT: history is NEVER cached in localStorage/sessionStorage/cookies.
 * It is refetched from the server every time the page mounts and every
 * time the tab/window regains focus, so the data is always authoritative
 * even after a cache clear or device change.
 */
export class HistoryPage extends BasePage {
    constructor() {
        super();
        this.setTitle('History');
        this.state = 'loading'; // loading | empty | error | ready
        this.attempts = [];
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary pb-20';
        this.container.setAttribute('data-page', 'history');

        this.container.appendChild(createMiniHeader());

        const status = createStatusHeader();
        this.statusHeaderDestroy = status.destroy;
        this.container.appendChild(status.element);

        const titleContainer = createElement('div', 'px-lg py-xl bg-bg-primary border-b border-accent-gold flex items-center justify-between');
        const title = createElement('h1', 'font-alumni font-extrabold text-page-title text-text-primary tracking-title');
        title.textContent = 'EXAM HISTORY';
        titleContainer.appendChild(title);

        const refreshBtn = createElement('button', 'text-text-secondary hover:text-text-primary transition-colors');
        refreshBtn.innerHTML = `<span class="material-icons">refresh</span>`;
        refreshBtn.setAttribute('aria-label', 'Muat ulang riwayat');
        refreshBtn.addEventListener('click', () => this.fetchHistory());
        titleContainer.appendChild(refreshBtn);

        this.container.appendChild(titleContainer);

        this.content = createElement('div', 'px-lg py-lg');
        this.container.appendChild(this.content);

        this.container.appendChild(createBottomNav('history'));

        this.renderState();
        return this.container;
    }

    mounted() {
        this.fetchHistory();

        // Refetch when the tab/page becomes active again (PRD: "Refetch
        // ketika tab kembali aktif" — no stale data on revisit).
        this._visibilityHandler = () => {
            if (document.visibilityState === 'visible') this.fetchHistory();
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
    }

    beforeUnmount() {
        document.removeEventListener('visibilitychange', this._visibilityHandler);
        this.statusHeaderDestroy?.();
    }

    async fetchHistory() {
        this.state = 'loading';
        this.renderState();

        try {
            const response = await api.getExamHistory();
            const attempts = response.data?.data ?? response.data ?? [];
            this.attempts = Array.isArray(attempts) ? attempts : [];
            this.state = this.attempts.length === 0 ? 'empty' : 'ready';
        } catch (err) {
            console.error('Failed to load exam history:', err);
            this.state = 'error';
        }

        this.renderState();
    }

    renderState() {
        if (!this.content) return;
        this.content.innerHTML = '';

        if (this.state === 'loading') {
            const loading = createElement('div', 'flex flex-col items-center justify-center py-xxl text-text-secondary');
            loading.innerHTML = `
                <span class="material-icons text-3xl mb-md animate-spin">progress_activity</span>
                <p class="font-inter text-sm">Memuat riwayat ujian...</p>
            `;
            this.content.appendChild(loading);
            return;
        }

        if (this.state === 'error') {
            const error = createElement('div', 'flex flex-col items-center justify-center py-xxl text-text-secondary text-center');
            error.innerHTML = `
                <span class="material-icons text-3xl mb-md text-primary">error_outline</span>
                <p class="font-inter text-sm mb-lg">Gagal memuat riwayat. Periksa koneksi internet Anda.</p>
            `;
            const retryBtn = createButton('Coba Lagi', { size: 'sm', icon: 'refresh', onClick: () => this.fetchHistory() });
            error.appendChild(retryBtn);
            this.content.appendChild(error);
            return;
        }

        if (this.state === 'empty') {
            const empty = createElement('div', 'flex flex-col items-center justify-center py-xxl text-text-secondary text-center');
            empty.innerHTML = `
                <span class="material-icons text-3xl mb-md">inbox</span>
                <p class="font-inter text-sm">Belum ada riwayat ujian</p>
            `;
            this.content.appendChild(empty);
            return;
        }

        // ready: grouped by submit date, newest day first
        const groups = groupByDate(this.attempts, 'submittedAt');
        let itemIndex = 0;
        groups.forEach(group => {
            this.content.appendChild(createSectionHeader(group.label));
            group.items.forEach(attempt => {
                const card = createHistoryCard(attempt);
                card.classList.add(...fadeUpClass(itemIndex).split(' '));
                this.content.appendChild(card);
                itemIndex += 1;
            });
        });
    }
}
