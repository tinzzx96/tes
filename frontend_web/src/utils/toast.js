import { createElement } from './dom.js';

let container = null;

function getContainer() {
    if (!container) {
        container = createElement('div', 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none');
        document.body.appendChild(container);
    }
    return container;
}

export function showToast(message, type = 'success', duration = 3000) {
    const parent = getContainer();
    
    // Type configurations
    const styles = {
        success: {
            border: 'border-online',
            icon: 'check_circle',
            iconColor: 'text-online'
        },
        error: {
            border: 'border-primary',
            icon: 'error',
            iconColor: 'text-primary'
        },
        warning: {
            border: 'border-accent-gold',
            icon: 'warning',
            iconColor: 'text-accent-gold'
        },
        info: {
            border: 'border-divider',
            icon: 'info',
            iconColor: 'text-text-secondary'
        }
    };
    
    const config = styles[type] || styles.info;
    
    const toast = createElement('div', `pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-card border shadow-lg bg-bg-surface text-text-primary slide-in-up transition-all duration-300 ${config.border}`);
    
    toast.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="material-icons text-lg ${config.iconColor}">${config.icon}</span>
            <span class="font-inter text-sm leading-snug">${message}</span>
        </div>
        <button class="material-icons text-text-muted hover:text-text-primary text-sm focus:outline-none transition-colors ml-2 pointer-events-auto" title="Tutup">close</button>
    `;
    
    const closeBtn = toast.querySelector('button');
    if (closeBtn) {
        closeBtn.onclick = () => dismiss();
    }
    
    parent.appendChild(toast);
    
    let dismissTimeout = setTimeout(() => {
        dismiss();
    }, duration);
    
    function dismiss() {
        clearTimeout(dismissTimeout);
        toast.classList.remove('slide-in-up');
        toast.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// Bind showToast to window so it can be called easily globally (like alert)
window.showToast = showToast;
