import { createElement } from '../utils/dom.js';

export function createHeader(title = 'EXAM PONCOL') {
    const header = createElement('header', 'sticky top-0 z-50 bg-bg-primary border-b border-accent-gold');
    
    header.innerHTML = `
        <div class="flex items-center justify-between px-lg py-md">
            <div class="flex items-center gap-md">
                <img src="/logo-poncol.png" alt="Logo" class="h-9 w-auto">
                <div class="font-barlow font-extrabold text-app-title text-text-primary tracking-title">
                    ${title}
                </div>
            </div>
        </div>
    `;
    
    return header;
}

export function createMiniHeader() {
    const header = createElement('div', 'flex items-center gap-md px-lg py-md bg-bg-primary border-b border-accent-gold');
    
    header.innerHTML = `
        <img src="/logo-poncol.png" alt="Logo" class="h-8 w-auto">
        <div class="font-barlow font-extrabold text-lg tracking-title text-text-primary">
            EXAM-PONCOL
        </div>
    `;
    
    return header;
}
