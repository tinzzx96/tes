import { createElement } from '../utils/dom.js';
import { formatTime } from '../utils/helpers.js';
import { getConnectionState, subscribeConnectionState } from '../utils/userAgent.js';

/**
 * Global status header (PRD Bagian 2 / ADD_FEATURE Phase 2).
 * Shows a realtime HH:MM clock, a simple Terhubung/Tidak Terhubung
 * indicator (no 1-4 bar signal — that needs geolocation permission
 * mobile doesn't need for an exam app), and a dev-only refresh button.
 *
 * Returns { element, destroy } — call destroy() from the page's
 * beforeUnmount() to clear the clock interval and connection listener.
 */
export function createStatusHeader(options = {}) {
    const { onDevRefresh = null } = options;

    const bar = createElement(
        'div',
        'flex items-center justify-between px-lg py-xs bg-bg-primary text-text-primary'
    );

    const clockEl = createElement('span', 'font-inter text-sm text-white text-opacity-70 tabular-nums');

    const connectionWrap = createElement('div', 'flex items-center gap-sm');
    const connectionDot = createElement('span', 'w-1.5 h-1.5 rounded-full');
    const connectionLabel = createElement('span', 'font-inter text-xs font-bold');
    connectionWrap.appendChild(connectionDot);
    connectionWrap.appendChild(connectionLabel);

    const rightWrap = createElement('div', 'flex items-center gap-md');
    rightWrap.appendChild(connectionWrap);

    const isDev = Boolean(import.meta.env?.DEV);
    if (isDev) {
        const devBtn = createElement(
            'button',
            'flex items-center gap-1 px-sm py-1 rounded-badge border border-warning-border text-warning-text text-xs font-inter font-bold'
        );
        devBtn.innerHTML = `<span class="material-icons text-xs">bug_report</span>DEV REFRESH`;
        devBtn.title = 'Dev-only: reset status submit untuk testing. Sembunyikan/hapus saat production.';
        devBtn.addEventListener('click', () => onDevRefresh?.());
        rightWrap.appendChild(devBtn);
    }

    bar.appendChild(clockEl);
    bar.appendChild(rightWrap);

    function renderClock() {
        clockEl.textContent = formatTime(new Date());
    }

    function renderConnection() {
        const { online } = getConnectionState();
        connectionDot.className = `w-1.5 h-1.5 rounded-full ${online ? 'bg-online' : 'bg-offline'}`;
        connectionLabel.className = `font-inter text-xs font-bold ${online ? 'text-online' : 'text-offline'}`;
        connectionLabel.textContent = online ? 'Terhubung' : 'Tidak Terhubung';
    }

    renderClock();
    renderConnection();

    // Align the tick to the next minute boundary, then update every minute.
    const msToNextMinute = 60000 - (Date.now() % 60000);
    let intervalId = null;
    const alignTimeout = setTimeout(() => {
        renderClock();
        intervalId = setInterval(renderClock, 60000);
    }, msToNextMinute);

    const unsubscribeConnection = subscribeConnectionState(renderConnection);

    function destroy() {
        clearTimeout(alignTimeout);
        if (intervalId) clearInterval(intervalId);
        unsubscribeConnection?.();
    }

    return { element: bar, destroy };
}
