import { createElement } from '../utils/dom.js';

export function createCard(options = {}) {
    const {
        variant = 'light', // light, dark
        className = '',
    } = options;
    
    const baseClasses = variant === 'light' 
        ? 'bg-bg-surface-light rounded-card shadow-card' 
        : 'bg-bg-surface rounded-card-dark';
    
    const card = createElement('div', `${baseClasses} p-md ${className}`);
    return card;
}

export function createScheduleCard(exam) {
    const card = createCard({ variant: 'light' });
    
    const todayBadge = exam.isToday 
        ? `<div class="absolute top-md right-md bg-primary text-text-primary text-badge-today px-sm py-xs rounded-badge font-inter font-bold">TODAY</div>` 
        : '';
    
    card.innerHTML = `
        <div class="relative">
            ${todayBadge}
            <div class="flex items-center gap-sm mb-md">
                <div class="w-2 h-2 bg-primary rounded-full"></div>
                <div class="font-inter font-bold text-label-caps text-text-muted uppercase tracking-label">TODAY'S EXAM</div>
            </div>
            
            <h3 class="font-inter font-bold text-card-title text-text-dark mb-xs">${exam.subject}</h3>
            <p class="text-card-code text-text-muted mb-md font-inter">${exam.code}</p>
            
            <div class="border-b border-divider border-opacity-20 my-md"></div>
            
            <div class="grid grid-cols-2 gap-md mb-md text-sm">
                <div class="flex items-center gap-xs text-text-muted">
                    <span class="material-icons text-sm">access_time</span>
                    <span class="font-inter text-card-meta">${exam.time}</span>
                </div>
                <div class="flex items-center gap-xs text-text-muted">
                    <span class="material-icons text-sm">location_on</span>
                    <span class="font-inter text-card-meta">${exam.room}</span>
                </div>
            </div>
            
            <div class="flex items-center gap-xs text-text-muted mb-lg">
                <span class="material-icons text-sm">person</span>
                <span class="font-inter text-card-meta">${exam.teacher}</span>
            </div>
            
            <p class="text-card-date text-text-muted font-inter text-xs">${exam.date}</p>
        </div>
    `;
    
    return card;
}

export function createExamCard(exam) {
    const completedClasses = exam.isCompleted ? 'opacity-55' : '';
    const card = createElement('div', `relative bg-bg-surface rounded-card-dark p-md border-l-4 border-primary mb-md ${completedClasses}`);

    const segereaBadge = exam.isUrgent && !exam.isCompleted
        ? `<div class="absolute top-md right-md bg-primary text-text-primary text-xs font-inter font-bold px-2 py-1 rounded-badge">SEGERA</div>`
        : '';

    const doneBadge = exam.isCompleted
        ? `<div class="absolute top-md right-md bg-submit-green text-text-primary text-xs font-inter font-bold px-2 py-1 rounded-badge flex items-center gap-1">
               <span class="material-icons text-xs">check</span>SELESAI
           </div>`
        : '';

    card.innerHTML = `
        <div class="flex justify-between items-start mb-md">
            <div>
                <div class="text-label-caps text-text-secondary font-inter tracking-label mb-xs">TODAY'S EXAM</div>
                <h2 class="font-barlow font-extrabold text-exam-title text-text-primary mb-xs">${exam.subject}</h2>
                <p class="text-accent-gold font-inter text-sm font-bold">-${exam.teacher}</p>
            </div>
            ${segereaBadge}${doneBadge}
        </div>
        
        <div class="border-r border-divider pr-md pl-0">
            <div class="text-time-bold font-inter font-bold text-text-secondary mb-xs">${exam.time}</div>
            <div class="text-duration-label font-inter text-text-secondary">Duration</div>
            <div class="text-duration-value font-inter font-bold text-text-primary">${exam.duration} Min</div>
        </div>
    `;
    
    return card;
}

/**
 * History card (PRD Bagian 1 / Phase 1 & 5).
 * Shares the same red 4px left-accent visual family as createExamCard so
 * active and completed exam cards feel like one component family.
 * attempt: { subject, teacher, submittedAt: Date|string, score: number|null }
 */
export function createHistoryCard(attempt) {
    const card = createElement(
        'div',
        'relative bg-bg-surface rounded-card-dark p-md border-l-4 border-primary mb-md'
    );

    const submittedAt = new Date(attempt.submittedAt);
    const hh = String(submittedAt.getHours()).padStart(2, '0');
    const mm = String(submittedAt.getMinutes()).padStart(2, '0');

    const hasScore = attempt.score !== null && attempt.score !== undefined;
    const scoreBadge = hasScore
        ? `<div class="text-right">
               <div class="font-barlow font-extrabold text-2xl text-submit-green leading-none">${attempt.score}</div>
           </div>`
        : `<div class="bg-bg-surface-light bg-opacity-10 text-text-muted text-xs font-inter font-bold px-sm py-xs rounded-badge whitespace-nowrap">Menunggu Nilai</div>`;

    card.innerHTML = `
        <div class="flex justify-between items-start gap-md">
            <div class="min-w-0">
                <h2 class="font-barlow font-extrabold text-card-title text-text-primary uppercase truncate">${attempt.subject}</h2>
                <p class="text-accent-gold font-inter text-sm font-bold mb-sm">-${attempt.teacher}</p>
                <div class="flex items-center gap-xs text-text-secondary text-xs font-inter">
                    <span class="material-icons text-submit-green text-sm">check_circle</span>
                    <span>Disubmit ${hh}:${mm}</span>
                </div>
            </div>
            ${scoreBadge}
        </div>
    `;

    return card;
}

/**
 * Small section header used for History/Schedule date & time-bucket
 * grouping (Phase 1 & 9), e.g. "Selasa - 17 Juni 2026" or "HARI INI (3)".
 */
export function createSectionHeader(label, count) {
    const wrap = createElement('div', 'flex items-center justify-between mt-lg mb-md first:mt-0');
    const title = createElement(
        'h3',
        'font-inter font-bold text-label-caps text-text-muted uppercase tracking-label'
    );
    title.textContent = label;
    wrap.appendChild(title);

    if (count !== undefined && count !== null) {
        const badge = createElement(
            'span',
            'bg-bg-surface text-text-secondary text-xs font-inter font-bold px-sm py-0.5 rounded-full'
        );
        badge.textContent = count;
        wrap.appendChild(badge);
    }

    return wrap;
}
