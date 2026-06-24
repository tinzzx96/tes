import { BasePage } from './BasePage.js';
import { createElement } from '../utils/dom.js';
import { authService } from '../services/auth.js';
import { api } from '../services/api.js';
import { getInitials } from '../utils/helpers.js';

/**
 * Exam Player — PRD section 12-17.
 * Desktop-optimized layout for SEB Windows.
 *
 * Integrasi backend:
 *  - Soal diambil dari GET /exams/:examId/questions (sudah teracak server)
 *  - Timer dari GET /exams/:examId/timer (server-side), sync ulang tiap 60 detik
 *  - Auto-save ke POST /exam-attempts/:attemptId/answers tiap pilih jawaban
 *  - Heartbeat ke POST /monitor/heartbeat tiap 30 detik
 *  - Submit ke POST /exams/:examId/submit
 */
export class ExamPlayerPage extends BasePage {
    constructor(params) {
        super();
        this.setTitle('Ujian Berlangsung');

        // examId dari route params (/exam/:id) atau sessionStorage
        this.examId = params?.id ? Number(params.id) : Number(sessionStorage.getItem('current_exam_id'));

        this.exam = { title: 'Memuat...', code: '-', durationMinutes: 90 };
        this.questions      = [];
        this.currentIndex   = 0;
        this.answers        = {};   // { questionId(int): optionIndex(int) }
        this.flagged        = new Set();
        this.remainingSeconds = 0;
        this.timerInterval    = null;
        this.serverSyncInterval = null;
        this.heartbeatInterval  = null;
        this.autoSaveTimeout    = null;
        this.timerExpired       = false;
        this.isLoading          = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    render() {
        this.container.className = 'h-screen bg-bg-primary flex flex-col overflow-hidden';
        this.container.setAttribute('data-page', 'exam-player');

        this.container.appendChild(this._renderTopBar());
        this.container.appendChild(this._renderProgressBar());

        const body = createElement('div', 'flex-1 flex overflow-hidden');

        this.questionArea = createElement('div', 'flex-1 overflow-y-auto p-lg');
        // Loading state awal
        this.questionArea.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-text-secondary">
                <span class="material-icons text-3xl mb-md animate-spin">progress_activity</span>
                <p class="font-inter text-sm">Memuat soal ujian...</p>
            </div>
        `;
        body.appendChild(this.questionArea);

        this.navigatorPanel = this._buildNavigatorPanel();
        body.appendChild(this.navigatorPanel);

        this.container.appendChild(body);

        this.bottomBar = createElement('div', 'flex-shrink-0 bg-bg-surface border-t border-divider px-lg py-md flex items-center justify-between gap-md');
        this.bottomBar.id = 'bottom-action-bar';
        this.container.appendChild(this.bottomBar);

        return this.container;
    }

    mounted() {
        this._initExam();
    }

    beforeUnmount() {
        if (this.timerInterval)      clearInterval(this.timerInterval);
        if (this.serverSyncInterval) clearInterval(this.serverSyncInterval);
        if (this.heartbeatInterval)  clearInterval(this.heartbeatInterval);
        if (this.autoSaveTimeout)    clearTimeout(this.autoSaveTimeout);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Init — ambil data dari server
    // ─────────────────────────────────────────────────────────────────────────
    async _initExam() {
        try {
            // 1. Mulai sesi ujian (status: waiting → started)
            await api.startExam(this.examId);

            // 2. Ambil timer dari server
            const timerRes = await api.getTimer(this.examId);
            const timerData = timerRes.data?.data;
            this.remainingSeconds = timerData?.remainingSeconds ?? 5400;

            // 3. Ambil soal (sudah teracak, savedOptionId untuk resume)
            const qRes = await api.getQuestions(this.examId);
            const rawQuestions = qRes.data?.data?.questions ?? [];

            // Konversi ke format internal
            this.questions = rawQuestions.map((q) => ({
                id:      q.id,        // int dari server
                text:    q.body,
                image:   q.questionImage
                    ? `${(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '')}/uploads/questions/${q.questionImage}`
                    : null,
                options: q.options.reduce((acc, opt, idx) => {
                    acc[String.fromCharCode(97 + idx)] = opt.body; // a, b, c, d
                    return acc;
                }, {}),
                optionIds: q.options.map(o => o.id),
            }));

            // Restore jawaban tersimpan (resume)
            rawQuestions.forEach((q, qIdx) => {
                if (q.savedOptionId != null) {
                    const optIdx = q.options.findIndex(o => o.id === q.savedOptionId);
                    if (optIdx >= 0) {
                        const key = String.fromCharCode(97 + optIdx);
                        this.answers[q.id] = key;
                    }
                }
            });

            this.isLoading = false;

            // Update exam info di top bar
            if (this.examTitleEl) this.examTitleEl.textContent = `Ujian · ${this.examId}`;

            // Render soal pertama
            this._renderQuestion();
            this._startTimer();
            this._startHeartbeat();
            this._startServerTimerSync();

        } catch (err) {
            if (this.questionArea) {
                this.questionArea.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-center px-lg">
                        <span class="material-icons text-3xl text-primary mb-md">error_outline</span>
                        <p class="font-inter text-sm text-text-secondary mb-lg">${err.message || 'Gagal memuat ujian.'}</p>
                        <button onclick="window.app.router.navigate('/home')"
                                class="px-xl py-md rounded-btn bg-primary text-white font-inter font-bold text-sm">
                            Kembali ke Home
                        </button>
                    </div>
                `;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Top Bar
    // ─────────────────────────────────────────────────────────────────────────
    _renderTopBar() {
        const user     = authService.getCurrentUser() || { name: 'PESERTA', nisn: '-' };
        const initials = getInitials(user.name || 'P');

        const bar = createElement('div', 'flex-shrink-0 bg-bg-primary border-b border-accent-gold px-lg py-md flex items-center justify-between gap-md');
        bar.innerHTML = `
            <div class="flex items-center gap-md min-w-0">
                <div class="w-10 h-10 bg-avatar-bg rounded-avatar flex items-center justify-center font-barlow font-bold text-avatar-text flex-shrink-0 text-base">
                    ${initials}
                </div>
                <div class="min-w-0">
                    <div class="font-inter font-bold text-sm text-text-primary truncate">${user.name}</div>
                    <div class="text-xs text-text-secondary font-inter" id="exam-title-sub">Memuat ujian...</div>
                </div>
            </div>
            <div class="flex items-center gap-sm">
                <div class="flex items-center gap-sm bg-bg-surface px-lg py-2 rounded-btn border border-divider" id="timer-box">
                    <span class="material-icons text-accent-gold text-lg">timer</span>
                    <span class="font-barlow font-extrabold text-xl text-text-primary tracking-wide" id="timer-display">--:--</span>
                </div>
                <div id="autosave-chip" class="hidden flex items-center gap-xs bg-bg-surface px-md py-2 rounded-btn border border-divider text-xs font-inter text-text-secondary">
                    <span class="material-icons text-sm" id="autosave-icon">sync</span>
                    <span id="autosave-text">Menyimpan...</span>
                </div>
            </div>
        `;

        this.examTitleEl  = bar.querySelector('#exam-title-sub');
        this.timerDisplay = bar.querySelector('#timer-display');
        this.timerBox     = bar.querySelector('#timer-box');
        this.autosaveChip = bar.querySelector('#autosave-chip');
        this.autosaveIcon = bar.querySelector('#autosave-icon');
        this.autosaveText = bar.querySelector('#autosave-text');

        return bar;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Progress Bar
    // ─────────────────────────────────────────────────────────────────────────
    _renderProgressBar() {
        const wrap = createElement('div', 'flex-shrink-0 bg-bg-primary border-b border-divider px-lg py-sm');
        const labelRow = createElement('div', 'flex items-center justify-between mb-xs');
        const label = createElement('span', 'font-inter text-xs font-bold text-text-secondary tabular-nums');
        labelRow.appendChild(label);
        wrap.appendChild(labelRow);

        const track = createElement('div', 'w-full h-1.5 bg-divider rounded-full overflow-hidden');
        const fill  = createElement('div', 'h-full bg-submit-green rounded-full transition-all duration-300 ease-out');
        fill.style.width = '0%';
        track.appendChild(fill);
        wrap.appendChild(track);

        this.progressLabel = label;
        this.progressFill  = fill;
        return wrap;
    }

    _updateProgress() {
        if (!this.progressFill || !this.progressLabel) return;
        const total    = this.questions.length;
        const answered = Object.keys(this.answers).length;
        const pct      = total > 0 ? Math.round((answered / total) * 100) : 0;
        this.progressLabel.textContent = `Terjawab ${answered} / ${total}`;
        this.progressFill.style.width  = `${pct}%`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Question area
    // ─────────────────────────────────────────────────────────────────────────
    _renderQuestion() {
        if (!this.questions.length) return;

        const q         = this.questions[this.currentIndex];
        const selected  = this.answers[q.id];
        const isFlagged = this.flagged.has(q.id);
        const slotNum   = this.currentIndex + 1;

        this.questionArea.innerHTML = '';

        const card = createElement('div', 'bg-bg-surface-light rounded-card p-xl flex flex-col gap-lg max-w-4xl mx-auto fade-content');

        const headerRow = createElement('div', 'flex items-center justify-between');
        headerRow.innerHTML = `
            <div>
                <span class="text-xs font-inter font-bold text-text-muted uppercase tracking-label">Soal Pilihan Ganda</span>
                <span class="ml-md text-xs font-inter text-text-muted">Slot ${slotNum} dari ${this.questions.length}</span>
            </div>
        `;
        const flagBtn = createElement('button',
            `flex items-center gap-xs px-md py-2 rounded-btn font-inter text-xs font-bold transition-colors border ${
                isFlagged
                    ? 'bg-accent-gold border-accent-gold text-text-dark'
                    : 'border-divider text-text-muted hover:border-accent-gold hover:text-accent-gold'
            }`
        );
        flagBtn.innerHTML = `<span class="material-icons text-sm">flag</span> ${isFlagged ? 'Ditandai' : 'Tandai Soal'}`;
        flagBtn.addEventListener('click', () => this._toggleFlag(q.id));
        headerRow.appendChild(flagBtn);
        card.appendChild(headerRow);

        card.appendChild(createElement('hr', 'border-divider border-opacity-30'));

        const qText = createElement('p', 'font-inter text-lg text-text-dark font-semibold leading-relaxed');
        qText.textContent = q.text;
        card.appendChild(qText);

        if (q.image) {
            const imgOuter = createElement('div', 'flex justify-center');
            const imgWrap  = createElement('div', 'inline-block max-w-full rounded-input overflow-hidden border border-divider border-opacity-30 bg-white');
            const img      = createElement('img', 'block max-w-full h-auto');
            img.src = q.image;
            img.alt = 'Gambar soal';
            imgWrap.appendChild(img);
            imgOuter.appendChild(imgWrap);
            card.appendChild(imgOuter);
        }

        const optionsWrap = createElement('div', 'flex flex-col gap-sm');
        Object.entries(q.options).forEach(([key, label]) => {
            const isSelected = selected === key;
            const row = createElement('label',
                `flex items-center gap-md px-md py-md rounded-input border-2 cursor-pointer transition-colors ${
                    isSelected
                        ? 'border-primary bg-primary bg-opacity-5'
                        : 'border-divider border-opacity-20 hover:border-primary hover:border-opacity-50'
                }`
            );
            row.innerHTML = `
                <span class="w-8 h-8 rounded-full flex items-center justify-center font-barlow font-bold text-sm flex-shrink-0 ${
                    isSelected ? 'bg-primary text-white' : 'bg-white text-text-dark border border-divider border-opacity-40'
                }">${key.toUpperCase()}</span>
                <span class="font-inter text-text-dark text-sm">${label}</span>
            `;
            row.addEventListener('click', () => this._selectAnswer(q.id, key));
            optionsWrap.appendChild(row);
        });
        card.appendChild(optionsWrap);

        this.questionArea.appendChild(card);
        this._updateNavigator();
        this._updateBottomBar();
        this._updateProgress();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Navigator
    // ─────────────────────────────────────────────────────────────────────────
    _buildNavigatorPanel() {
        const panel = createElement('div', 'w-72 flex-shrink-0 bg-bg-surface border-l border-divider flex flex-col overflow-hidden');

        const panelHeader = createElement('div', 'px-lg py-md border-b border-divider flex-shrink-0');
        panelHeader.innerHTML = `<span class="text-xs font-inter font-bold text-text-secondary uppercase tracking-label">Navigator Soal</span>`;
        panel.appendChild(panelHeader);

        const legend = createElement('div', 'px-lg py-sm border-b border-divider flex-shrink-0 flex flex-wrap gap-sm');
        legend.innerHTML = `
            <div class="flex items-center gap-xs text-xs text-text-secondary font-inter">
                <span class="w-3 h-3 rounded-sm bg-bg-primary border border-divider inline-block"></span> Belum
            </div>
            <div class="flex items-center gap-xs text-xs text-text-secondary font-inter">
                <span class="w-3 h-3 rounded-sm bg-online inline-block"></span> Dijawab
            </div>
            <div class="flex items-center gap-xs text-xs text-text-secondary font-inter">
                <span class="w-3 h-3 rounded-sm bg-primary inline-block"></span> Aktif
            </div>
            <div class="flex items-center gap-xs text-xs text-text-secondary font-inter">
                <span class="material-icons text-accent-gold" style="font-size:11px">star</span> Ditandai
            </div>
        `;
        panel.appendChild(legend);

        const gridWrap = createElement('div', 'flex-1 overflow-y-auto px-lg py-md');
        const grid     = createElement('div', 'grid gap-sm');
        grid.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
        grid.id = 'navigator-grid';
        gridWrap.appendChild(grid);
        panel.appendChild(gridWrap);

        const summary = createElement('div', 'flex-shrink-0 px-lg py-md border-t border-divider text-xs font-inter text-text-secondary');
        summary.id = 'navigator-summary';
        panel.appendChild(summary);

        this.navigatorGrid    = grid;
        this.navigatorSummary = summary;
        return panel;
    }

    _updateNavigator() {
        const grid = this.navigatorGrid;
        if (!grid) return;
        grid.innerHTML = '';

        this.questions.forEach((q, idx) => {
            const isCurrent  = idx === this.currentIndex;
            const isAnswered = this.answers[q.id] != null;
            const isFlagged  = this.flagged.has(q.id);

            let cls = 'bg-bg-primary border border-divider text-text-secondary';
            if (isAnswered && !isCurrent) cls = 'bg-online border border-online text-text-dark';
            if (isCurrent)               cls = 'bg-primary border-2 border-primary text-white';

            const cell = createElement('button',
                `relative w-full aspect-square rounded-input flex items-center justify-center cursor-pointer transition-all font-barlow font-bold text-sm ${cls}`
            );
            cell.textContent = String(idx + 1);

            if (isFlagged) {
                const star = createElement('span', 'material-icons text-accent-gold absolute -top-1 -right-1 bg-bg-surface rounded-full leading-none');
                star.style.fontSize = '10px';
                star.textContent = 'star';
                cell.appendChild(star);
            }

            cell.addEventListener('click', () => {
                this.currentIndex = idx;
                this._renderQuestion();
            });
            grid.appendChild(cell);
        });

        const summary = this.navigatorSummary;
        if (summary) {
            const answeredCount = Object.keys(this.answers).length;
            summary.innerHTML = `
                <div class="flex justify-between mb-xs"><span>Total Soal</span><span class="font-bold text-text-primary">${this.questions.length}</span></div>
                <div class="flex justify-between mb-xs"><span>Dijawab</span><span class="font-bold text-online">${answeredCount}</span></div>
                <div class="flex justify-between"><span>Ditandai</span><span class="font-bold text-accent-gold">${this.flagged.size}</span></div>
            `;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bottom Bar
    // ─────────────────────────────────────────────────────────────────────────
    _updateBottomBar() {
        const bar = this.bottomBar;
        if (!bar) return;
        bar.innerHTML = '';

        const isFirst = this.currentIndex === 0;
        const isLast  = this.currentIndex === this.questions.length - 1;

        // SEBELUMNYA
        const prevCls = isFirst
            ? 'flex items-center gap-xs px-xl py-md rounded-btn font-inter font-bold text-sm bg-bg-surface text-text-secondary cursor-not-allowed'
            : 'flex items-center gap-xs px-xl py-md rounded-btn font-inter font-bold text-sm border border-divider text-text-primary hover:border-primary transition-colors';
        const prevBtn = createElement('button', prevCls);
        prevBtn.innerHTML = `<span class="material-icons text-base">arrow_back</span> SEBELUMNYA`;
        prevBtn.disabled  = isFirst;
        if (!isFirst) {
            prevBtn.addEventListener('click', () => {
                this.currentIndex--;
                this._renderQuestion();
                this._autoSave('Navigasi previous');
            });
        }
        bar.appendChild(prevBtn);

        // SUBMIT
        const timerLabel = this._formatTime(this.remainingSeconds);
        let submitBtn;
        if (isLast && this.timerExpired) {
            submitBtn = createElement('button', 'flex items-center gap-xs px-xl py-md rounded-btn font-inter font-bold text-sm bg-online text-text-dark hover:opacity-90 transition-opacity');
            submitBtn.innerHTML = `<span class="material-icons text-base">send</span> SUBMIT`;
        } else {
            submitBtn = createElement('button', 'flex items-center gap-xs px-xl py-md rounded-btn font-inter font-bold text-sm border border-divider text-text-secondary hover:border-accent-gold transition-colors');
            submitBtn.innerHTML = `<span class="material-icons text-base" style="font-size:16px">send</span> SUBMIT <span class="font-barlow text-accent-gold ml-xs">(${timerLabel})</span>`;
        }
        submitBtn.id = 'submit-btn';
        submitBtn.addEventListener('click', () => this._confirmSubmit());
        this.submitBtnEl = submitBtn;
        bar.appendChild(submitBtn);

        // SELANJUTNYA
        if (!isLast) {
            const nextBtn = createElement('button', 'flex items-center gap-xs px-xl py-md rounded-btn font-inter font-bold text-sm bg-primary hover:bg-primary-dark text-white transition-colors');
            nextBtn.innerHTML = `SELANJUTNYA <span class="material-icons text-base">arrow_forward</span>`;
            nextBtn.addEventListener('click', () => {
                this.currentIndex++;
                this._renderQuestion();
                this._autoSave('Navigasi next');
            });
            bar.appendChild(nextBtn);
        } else {
            const ph = createElement('div', 'px-xl py-md opacity-0 pointer-events-none select-none');
            ph.textContent = 'SELANJUTNYA';
            bar.appendChild(ph);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Jawaban + Auto-Save ke server
    // ─────────────────────────────────────────────────────────────────────────
    _selectAnswer(questionId, key) {
        this.answers[questionId] = key;
        this._renderQuestion();
        this._autoSave('Jawaban dipilih');
    }

    _toggleFlag(questionId) {
        if (this.flagged.has(questionId)) this.flagged.delete(questionId);
        else this.flagged.add(questionId);
        this._renderQuestion();
    }

    _autoSave(reason) {
        clearTimeout(this.autoSaveTimeout);
        this._showSaveChip('Menyimpan...', false);

        this.autoSaveTimeout = setTimeout(async () => {
            try {
                const q = this.questions[this.currentIndex];
                if (!q) return;

                const selectedKey = this.answers[q.id];
                const selectedOptionIndex = selectedKey != null
                    ? Object.keys(q.options).indexOf(selectedKey)
                    : null;

                const attemptId = authService.getExamAttemptId();
                if (attemptId) {
                    // Endpoint BARU: POST /exam-attempts/:attemptId/answers
                    await api.saveAnswer(attemptId, q.id, selectedOptionIndex);
                }

                this._showSaveChip('Tersimpan', true);
            } catch (_) {
                // Silent fail — koneksi putus
                this._showSaveChip('Tersimpan (lokal)', true);
            }
        }, 400);
    }

    _showSaveChip(text, done) {
        const chip  = this.autosaveChip;
        const icon  = this.autosaveIcon;
        const label = this.autosaveText;
        if (!chip) return;
        chip.classList.remove('hidden');
        if (icon)  { icon.textContent = done ? 'check_circle' : 'sync'; icon.className = `material-icons text-sm ${done ? 'text-online' : 'text-accent-gold'}`; }
        if (label) label.textContent = text;
        clearTimeout(this._chipTimeout);
        if (done) this._chipTimeout = setTimeout(() => chip.classList.add('hidden'), 1500);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Timer — sumber dari server, countdown lokal
    // ─────────────────────────────────────────────────────────────────────────
    _startTimer() {
        this._updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            if (this.remainingSeconds > 0) {
                this.remainingSeconds--;
                this._updateTimerDisplay();
            } else {
                clearInterval(this.timerInterval);
                this.timerExpired = true;
                this._onTimerExpired();
            }
        }, 1000);
    }

    // Sync timer dari server setiap 60 detik (PRD: server-side timer)
    _startServerTimerSync() {
        this.serverSyncInterval = setInterval(async () => {
            try {
                const res = await api.getTimer(this.examId);
                const serverRemaining = res.data?.data?.remainingSeconds;
                if (serverRemaining != null && Math.abs(this.remainingSeconds - serverRemaining) > 5) {
                    this.remainingSeconds = serverRemaining;
                }
            } catch (_) {}
        }, 60_000);
    }

    // Heartbeat setiap 30 detik
    _startHeartbeat() {
        const send = () => {
            const attemptId = authService.getExamAttemptId();
            if (attemptId) api.sendHeartbeat(attemptId).catch(() => {});
        };
        send();
        this.heartbeatInterval = setInterval(send, 30_000);
    }

    _updateTimerDisplay() {
        const display  = this.timerDisplay;
        const timerBox = this.timerBox;
        if (!display) return;

        display.textContent = this._formatTime(this.remainingSeconds);

        if (this.remainingSeconds <= 300 && timerBox) {
            timerBox.classList.add('border-primary');
            display.classList.add('text-primary');
            display.classList.remove('text-text-primary');
        }

        const submitBtn = this.submitBtnEl;
        if (submitBtn && !this.timerExpired) {
            const timerSpan = submitBtn.querySelector('span.font-barlow');
            if (timerSpan) timerSpan.textContent = `(${this._formatTime(this.remainingSeconds)})`;
        }
    }

    _onTimerExpired() {
        this._updateBottomBar();
        window.alert('Waktu ujian telah habis. Jawaban Anda akan dikirim otomatis.');
        this._submitExam();
    }

    _formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Submit
    // ─────────────────────────────────────────────────────────────────────────
    _confirmSubmit() {
        const answeredCount = Object.keys(this.answers).length;
        const unanswered    = this.questions.length - answeredCount;
        const msg = unanswered > 0
            ? `Masih ada ${unanswered} soal yang belum dijawab. Yakin ingin menyelesaikan ujian?`
            : 'Semua soal sudah dijawab. Yakin ingin menyelesaikan ujian?';
        if (window.confirm(msg)) this._submitExam();
    }

    async _submitExam() {
        // Hentikan semua interval
        if (this.timerInterval)      clearInterval(this.timerInterval);
        if (this.serverSyncInterval) clearInterval(this.serverSyncInterval);
        if (this.heartbeatInterval)  clearInterval(this.heartbeatInterval);

        try {
            await api.submitExam(this.examId);
        } catch (err) {
            window.alert(`Gagal mengirim jawaban: ${err.response?.data?.error?.message || err.message}. Coba lagi.`);
            return;
        }

        // Bersihkan session storage
        sessionStorage.removeItem('exam_attempt_id');
        sessionStorage.removeItem('current_exam_id');

        window.app.router.navigate(`/result/${this.examId}`);
    }
}
