import { BasePage } from './BasePage.js';
import { createElement, fadeUpClass } from '../utils/dom.js';
import { createMiniHeader } from '../components/Header.js';
import { createBottomNav } from '../components/Navigation.js';
import { createScheduleCard, createSectionHeader } from '../components/Card.js';
import { createStatusHeader } from '../components/StatusHeader.js';
import { api } from '../services/api.js';

/**
 * Buckets schedule items into HARI INI / BESOK / MINGGU INI.
 * Empty buckets are omitted entirely.
 */
function bucketSchedule(schedule, now = new Date()) {
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today    = startOfDay(now);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd  = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

    const buckets = { 'HARI INI': [], 'BESOK': [], 'MINGGU INI': [] };

    schedule.forEach(exam => {
        const examDate = startOfDay(new Date(exam.dateValue));
        if      (examDate.getTime() === today.getTime())    buckets['HARI INI'].push(exam);
        else if (examDate.getTime() === tomorrow.getTime()) buckets['BESOK'].push(exam);
        else if (examDate > tomorrow && examDate < weekEnd) buckets['MINGGU INI'].push(exam);
    });

    return Object.entries(buckets).filter(([, items]) => items.length > 0);
}

export class SchedulePage extends BasePage {
    constructor() {
        super();
        this.setTitle('Schedule');
    }

    render() {
        this.container.className = 'min-h-screen bg-bg-primary pb-20';
        this.container.setAttribute('data-page', 'schedule');

        const header = createMiniHeader();
        this.container.appendChild(header);

        const status = createStatusHeader();
        this.statusHeaderDestroy = status.destroy;
        this.container.appendChild(status.element);

        const titleContainer = createElement('div', 'px-lg py-xl bg-bg-primary border-b border-accent-gold');
        const title = createElement('h1', 'font-alumni font-extrabold text-page-title text-text-primary tracking-title');
        title.textContent = 'EXAM SCHEDULE';
        titleContainer.appendChild(title);
        this.container.appendChild(titleContainer);

        // Container diisi async oleh loadSchedule()
        this.scheduleList = createElement('div', 'px-lg py-lg');
        this.scheduleList.innerHTML = `
            <div class="flex items-center gap-sm text-text-secondary py-lg">
                <span class="material-icons text-sm animate-spin">progress_activity</span>
                <span class="font-inter text-sm">Memuat jadwal...</span>
            </div>
        `;
        this.container.appendChild(this.scheduleList);

        const nav = createBottomNav('schedule');
        this.container.appendChild(nav);

        return this.container;
    }

    mounted() {
        this.loadSchedule();
    }

    async loadSchedule() {
        try {
            const res = await api.getExams();
            const exams = res.data?.data ?? [];

            if (!this.scheduleList) return;
            this.scheduleList.innerHTML = '';

            if (exams.length === 0) {
                this.scheduleList.innerHTML = `
                    <div class="text-center py-xxl text-text-secondary font-inter text-sm">
                        Tidak ada ujian yang terjadwal.
                    </div>
                `;
                return;
            }

            // Konversi ke format yang dipakai bucketSchedule()
            const schedule = exams.map(e => ({
                subject:   e.subject,
                code:      e.examCode,
                time:      `${this._fmt(e.startTime)} - ${this._fmt(e.endTime)}`,
                room:      e.room ?? '-',
                teacher:   e.teacher ?? '-',
                date:      'Hari ini',
                dateValue: new Date(e.startTime),
                isToday:   true,
                examId:    e.id,
                status:    e.status,
                attemptStatus: e.attemptStatus,
            }));

            const buckets = bucketSchedule(schedule, new Date());
            let itemIndex = 0;

            if (buckets.length === 0) {
                this.scheduleList.innerHTML = `
                    <div class="text-center py-xxl text-text-secondary font-inter text-sm">
                        Tidak ada ujian yang terjadwal untuk hari ini, besok, atau minggu ini.
                    </div>
                `;
                return;
            }

            buckets.forEach(([label, items]) => {
                this.scheduleList.appendChild(createSectionHeader(label, items.length));
                items.forEach(exam => {
                    const card = createScheduleCard(exam);
                    card.classList.add(...fadeUpClass(itemIndex).split(' '));
                    this.scheduleList.appendChild(card);
                    itemIndex++;
                });
            });

        } catch (err) {
            if (!this.scheduleList) return;
            this.scheduleList.innerHTML = `
                <div class="text-center py-xl font-inter text-sm">
                    <span class="text-primary">Gagal memuat jadwal.</span>
                    <button class="ml-sm underline text-text-secondary" id="retry-schedule">Coba lagi</button>
                </div>
            `;
            this.scheduleList.querySelector('#retry-schedule')?.addEventListener('click', () => this.loadSchedule());
        }
    }

    _fmt(iso) {
        if (!iso) return '--:--';
        return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    beforeUnmount() {
        this.statusHeaderDestroy?.();
    }
}
