import { createElement } from '../utils/dom.js';

/**
 * Simple modal dialog. Returns { overlay, close } so caller can populate body and close programmatically.
 * options: { title, bodyHtml, onMount(bodyEl), footerButtons: [{ text, variant, onClick }] }
 */
export function createModal(options = {}) {
    const { title = '', bodyHtml = '', onMount = null, footerButtons = [] } = options;

    const overlay = createElement('div', 'fixed inset-0 z-[100] bg-black bg-opacity-70 flex items-center justify-center px-lg fade-in');

    const modal = createElement('div', 'bg-bg-surface rounded-card-dark w-full max-w-md max-h-[85vh] overflow-y-auto border border-divider slide-in-up');

    const header = createElement('div', 'flex items-center justify-between px-lg py-md border-b border-divider sticky top-0 bg-bg-surface');
    header.innerHTML = `
        <h3 class="font-barlow font-extrabold text-section-title text-text-primary">${title}</h3>
    `;
    const closeBtn = createElement('span', 'material-icons text-text-secondary cursor-pointer hover:text-text-primary');
    closeBtn.textContent = 'close';
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const body = createElement('div', 'px-lg py-lg');
    body.innerHTML = bodyHtml;
    modal.appendChild(body);

    if (footerButtons.length > 0) {
        const footer = createElement('div', 'flex items-center justify-end gap-sm px-lg py-md border-t border-divider');
        footerButtons.forEach(btnConf => {
            const variantClasses = {
                primary: 'bg-primary hover:bg-primary-dark text-white',
                secondary: 'bg-transparent border border-divider text-text-secondary hover:text-text-primary',
            };
            const btn = createElement(
                'button',
                `px-lg py-2 rounded-btn font-inter font-bold text-sm transition-colors ${variantClasses[btnConf.variant] || variantClasses.primary}`
            );
            btn.textContent = btnConf.text;
            btn.addEventListener('click', () => btnConf.onClick && btnConf.onClick(close, body)
);
            footer.appendChild(btn);
        });
        modal.appendChild(footer);
    }

    overlay.appendChild(modal);

    function close() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    if (onMount) onMount(body, close);

    document.body.appendChild(overlay);

    return { overlay, close, body };
}
