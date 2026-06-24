import { createElement } from '../utils/dom.js';

export function createWarningBanner(message) {
    const banner = createElement('div', 'bg-warning-bg border border-warning-border rounded-warning p-md flex items-start gap-md mb-lg');
    
    banner.innerHTML = `
        <span class="material-icons text-warning-text flex-shrink-0">warning_amber</span>
        <p class="font-inter text-warning text-text-warning leading-relaxed">${message}</p>
    `;
    
    return banner;
}
