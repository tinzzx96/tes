import { createElement } from '../utils/dom.js';

export function createBadge(text, variant = 'primary') {
    const variantClasses = {
        primary: 'bg-primary text-text-primary',
        secondary: 'bg-surface text-text-primary',
        muted: 'bg-divider text-text-secondary',
    };
    
    const badge = createElement('span', `inline-block ${variantClasses[variant]} text-badge-today font-inter font-bold px-sm py-xs rounded-badge`);
    badge.textContent = text;
    
    return badge;
}
