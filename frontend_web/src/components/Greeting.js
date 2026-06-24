import { createElement } from '../utils/dom.js';
import { getGreeting, formatIndonesianDate } from '../utils/helpers.js';

/**
 * Small, unobtrusive contextual greeting (PRD Bagian 3 / Phase 3).
 * `withDate=true` (Home page) appends the full Indonesian date.
 */
export function createGreeting({ withDate = false, className = '' } = {}) {
    const el = createElement('p', `font-inter text-sm text-text-secondary ${className}`);
    const greeting = getGreeting();
    el.textContent = withDate ? `${greeting} • ${formatIndonesianDate()}` : greeting;
    return el;
}

/**
 * "3 ujian - 1 selesai" pill (PRD Bagian 4 / Phase 4).
 */
export function createTodaySummaryPill(text, { allDone = false } = {}) {
    const el = createElement(
        'div',
        `inline-flex items-center gap-1.5 px-sm py-1 rounded-full font-inter text-xs font-bold ${
            allDone ? 'bg-online bg-opacity-15 text-online' : 'bg-bg-surface text-text-secondary'
        }`
    );
    const icon = allDone ? 'check_circle' : 'description';
    el.innerHTML = `<span class="material-icons text-sm">${icon}</span><span>${text}</span>`;
    return el;
}
