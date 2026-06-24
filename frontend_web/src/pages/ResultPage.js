import { BasePage } from './BasePage.js';
import { createElement } from '../utils/dom.js';
import { createMiniHeader } from '../components/Header.js';
import { createBottomNav } from '../components/Navigation.js';
import { createButton } from '../components/Button.js';
import { api } from '../services/api.js';

/**
 * Result Page — ambil hasil dari GET /exams/:examId/result
 * score null → tampilkan "Menunggu Nilai" (guru belum menilai).
 */
export class ResultPage extends BasePage {
    constructor(params) {
        super();
        this.setTitle('Hasil Ujian');
        this.examId = params?.id ? Number(params.id) : Number(sessionStorage.getItem('current_exam_id'));
        this.result = null;
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary pb-20';
        this.container.setAttribute('data-page', 'result');

        const header = createMiniHeader();
        this.container.appendChild(header);

        const content = createElement('div', 'px-lg py-xl');

        // Status banner — selalu tampil
        const banner = createElement('div', 'flex flex-col items-center text-center mb-xl');
        banner.innerHTML = `
            <span class="material-icons text-online text-5xl mb-md">check_circle</span>
            <h1 class="font-barlow font-extrabold text-page-title text-text-primary mb-xs">UJIAN SELESAI</h1>
            <p class="font-inter text-text-secondary text-sm" id="result-subtitle">Memuat hasil ujian...</p>
        `;
        content.appendChild(banner);
        this.subtitleEl = banner.querySelector('#result-subtitle');

        // Container hasil — diisi oleh loadResult()
        this.resultContainer = createElement('div', '');
        this.resultContainer.innerHTML = `
            <div class="flex items-center justify-center gap-sm text-text-secondary py-xl">
                <span class="material-icons animate-spin">progress_activity</span>
                <span class="font-inter text-sm">Memuat hasil...</span>
            </div>
        `;
        content.appendChild(this.resultContainer);

        // Tombol kembali
        const backBtn = createButton('KEMBALI KE HOME', {
            size: 'lg',
            icon: 'home',
            onClick: () => window.app.router.navigate('/home'),
            className: 'mt-xl',
        });
        content.appendChild(backBtn);

        this.container.appendChild(content);

        const nav = createBottomNav('home');
        this.container.appendChild(nav);

        return this.container;
    }

    mounted() {
        this.loadResult();
    }

    async loadResult() {
        try {
            const res    = await api.getResult(this.examId);
            const result = res.data?.data;

            if (this.subtitleEl) {
                this.subtitleEl.textContent = `${result.subject ?? 'Ujian'} · Exam #${this.examId}`;
            }

            if (!this.resultContainer) return;
            this.resultContainer.innerHTML = '';

            // Score card
            if (result.score != null) {
                this.resultContainer.appendChild(this._renderScoreCard(result));
            } else {
                this.resultContainer.appendChild(this._renderHiddenScoreCard());
            }

            // Detail card
            this.resultContainer.appendChild(this._renderDetailCard(result));

        } catch (err) {
            if (!this.resultContainer) return;

            const msg = err.response?.data?.error?.message || 'Hasil ujian belum tersedia.';

            this.resultContainer.innerHTML = `
                <div class="bg-bg-surface-light rounded-card p-xl text-center mb-lg">
                    <span class="material-icons text-text-muted text-4xl mb-md">hourglass_empty</span>
                    <p class="font-inter text-text-muted text-sm leading-relaxed">${msg}</p>
                </div>
            `;
        }
    }

    _renderScoreCard(result) {
        const card = createElement('div', 'bg-bg-surface-light rounded-card p-xl text-center mb-lg');
        card.innerHTML = `
            <p class="text-label-caps text-text-muted font-inter font-bold uppercase tracking-label mb-sm">Nilai Akhir</p>
            <div class="font-barlow font-extrabold text-6xl text-primary mb-md">${result.score?.toFixed(1) ?? '-'}</div>
            <div class="flex items-center justify-center gap-lg text-sm font-inter">
                <div class="flex items-center gap-xs text-online">
                    <span class="material-icons text-base">check</span>
                    ${result.correctAnswers ?? '-'} Benar
                </div>
                <div class="flex items-center gap-xs text-primary">
                    <span class="material-icons text-base">close</span>
                    ${result.totalQuestions != null && result.correctAnswers != null
                        ? result.totalQuestions - result.correctAnswers
                        : '-'} Salah
                </div>
            </div>
        `;
        return card;
    }

    _renderHiddenScoreCard() {
        const card = createElement('div', 'bg-bg-surface-light rounded-card p-xl text-center mb-lg');
        card.innerHTML = `
            <span class="material-icons text-text-muted text-4xl mb-md">visibility_off</span>
            <p class="font-inter text-text-muted text-sm leading-relaxed">
                Nilai ujian ini belum dapat ditampilkan.<br>Silakan tunggu pengumuman dari guru/admin.
            </p>
        `;
        return card;
    }

    _renderDetailCard(result) {
        const card = createElement('div', 'bg-bg-surface rounded-card-dark p-lg');

        const finishedAt = result.finishedAt
            ? new Date(result.finishedAt).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })
            : '-';

        const rows = [
            { label: 'Total Soal',      value: result.totalQuestions ?? '-' },
            { label: 'Pelanggaran',     value: result.counterPelanggaran != null ? `${result.counterPelanggaran}x` : '-' },
            { label: 'Waktu Submit',    value: finishedAt },
        ];

        card.innerHTML = `
            <h3 class="font-inter font-bold text-label-caps text-text-muted mb-md uppercase tracking-label">Detail Pengerjaan</h3>
            ${rows.map(r => `
                <div class="flex items-center justify-between py-2 border-b border-divider border-opacity-50 last:border-b-0">
                    <span class="font-inter text-sm text-text-secondary">${r.label}</span>
                    <span class="font-inter text-sm font-bold text-text-primary">${r.value}</span>
                </div>
            `).join('')}
        `;
        return card;
    }
}
