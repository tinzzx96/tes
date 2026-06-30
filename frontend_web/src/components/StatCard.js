// frontend_web/src/components/StatCard.js
import { createElement } from '../utils/dom.js';

/**
 * Stat card — clean SaaS dashboard style.
 * options: { icon, label, value, accent, sub }
 * accent: 'primary' | 'gold' | 'online' | 'muted'
 * sub: optional subtitle text under value
 */
export function createStatCard(options = {}) {
    const {
        icon    = 'insights',
        label   = '',
        value   = '0',
        accent  = 'primary',
        sub     = '',
        className = '',
    } = options;

    const accentMap = {
        primary: { icon: 'text-primary',     dot: 'bg-primary',     bg: 'bg-primary bg-opacity-10'  },
        gold:    { icon: 'text-accent-gold',  dot: 'bg-accent-gold', bg: 'bg-accent-gold bg-opacity-10' },
        online:  { icon: 'text-online',       dot: 'bg-online',      bg: 'bg-online bg-opacity-10'   },
        muted:   { icon: 'text-text-muted',   dot: 'bg-text-muted',  bg: 'bg-text-muted bg-opacity-10' },
    };
    const a = accentMap[accent] || accentMap.primary;

    const card = createElement('div',
        `bg-bg-surface rounded-lg p-5 flex flex-col gap-3 ${className}`
    );
    card.style.cssText = 'border: 1px solid #2e2e2e;';

    card.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-xs font-inter font-semibold text-text-muted uppercase tracking-widest">${label}</span>
            <div class="w-8 h-8 rounded-md flex items-center justify-center ${a.bg} flex-shrink-0">
                <span class="material-icons text-base ${a.icon}">${icon}</span>
            </div>
        </div>
        <div>
            <div class="font-barlow font-extrabold text-3xl text-text-primary leading-none">${value}</div>
            ${sub ? `<div class="text-xs font-inter text-text-muted mt-1">${sub}</div>` : ''}
        </div>
    `;

    return card;
}