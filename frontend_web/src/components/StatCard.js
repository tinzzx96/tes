import { createElement } from '../utils/dom.js';

/**
 * Small stat card used across dashboards (e.g. "1,245 Total Siswa").
 * options: { icon, label, value, variant: 'light'|'dark', accent: 'primary'|'gold'|'online'|'muted' }
 */
export function createStatCard(options = {}) {
    const {
        icon = 'insights',
        label = '',
        value = '0',
        variant = 'dark',
        accent = 'primary',
        className = '',
    } = options;

    const accentColorMap = {
        primary: 'text-primary',
        gold: 'text-accent-gold',
        online: 'text-online',
        muted: 'text-text-muted',
    };

    const baseClasses = variant === 'light'
        ? 'bg-bg-surface-light'
        : 'bg-bg-surface';

    const card = createElement('div', `${baseClasses} rounded-card-dark p-md ${className}`);
    const textColor = variant === 'light' ? 'text-text-dark' : 'text-text-primary';
    const labelColor = variant === 'light' ? 'text-text-muted' : 'text-text-secondary';

    card.innerHTML = `
        <div class="flex items-center justify-between mb-sm">
            <span class="text-label-caps ${labelColor} font-inter font-bold uppercase tracking-label">${label}</span>
            <span class="material-icons ${accentColorMap[accent] || accentColorMap.primary} text-xl">${icon}</span>
        </div>
        <div class="font-barlow font-extrabold text-stat-value ${textColor}">${value}</div>
    `;

    return card;
}
