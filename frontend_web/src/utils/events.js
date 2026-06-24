// Global event listeners setup
export function setupEventListeners() {
    // Prevent right-click (for SEB mode)
    if (import.meta.env.VITE_SEB_MODE === 'true') {
        document.addEventListener('contextmenu', e => e.preventDefault());
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Window unload warning
    window.addEventListener('beforeunload', e => {
        // Only warn if in exam
        const inExam = document.querySelector('[data-page="exam-player"]');
        if (inExam) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

function handleKeyboardShortcuts(e) {
    // Cmd/Ctrl + S = Save answer
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const saveEvent = new CustomEvent('save-answer');
        document.dispatchEvent(saveEvent);
    }
    
    // Escape = (disabled if in SEB)
    if (e.key === 'Escape' && import.meta.env.VITE_SEB_MODE === 'true') {
        e.preventDefault();
    }
}
