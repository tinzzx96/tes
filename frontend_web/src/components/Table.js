import { createElement } from '../utils/dom.js';

/**
 * Generic data table for dashboards.
 * columns: [{ key, label, render?: (row) => htmlString, width?: 'css-width-class' }]
 * rows: array of data objects
 */
export function createTable(columns, rows, options = {}) {
    const { emptyMessage = 'Tidak ada data.', className = '' } = options;

    const wrapper = createElement('div', `bg-bg-surface-light rounded-card overflow-hidden ${className}`);
    const scrollWrap = createElement('div', 'overflow-x-auto');

    const table = createElement('table', 'w-full text-left border-collapse min-w-[640px]');

    // Header
    const thead = createElement('thead', '');
    const headRow = createElement('tr', 'bg-bg-primary');
    columns.forEach(col => {
        const th = createElement(
            'th',
            `px-md py-3 text-table-header text-text-secondary font-inter uppercase tracking-label whitespace-nowrap ${col.width || ''}`
        );
        th.textContent = col.label;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Body
    const tbody = createElement('tbody', '');

    if (!rows || rows.length === 0) {
        const tr = createElement('tr', '');
        const td = createElement('td', 'px-md py-xl text-center text-text-muted font-inter text-sm');
        td.colSpan = columns.length;
        td.textContent = emptyMessage;
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        rows.forEach((row, idx) => {
            const tr = createElement(
                'tr',
                `border-t border-divider border-opacity-10 ${idx % 2 === 1 ? 'bg-black bg-opacity-[0.02]' : ''} hover:bg-black hover:bg-opacity-5 transition-colors`
            );
            columns.forEach(col => {
                const td = createElement('td', 'px-md py-3 text-table-cell text-text-dark font-inter align-middle');
                if (col.render) {
                    td.innerHTML = col.render(row);
                } else {
                    td.textContent = row[col.key] ?? '-';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    table.appendChild(tbody);
    scrollWrap.appendChild(table);
    wrapper.appendChild(scrollWrap);

    return wrapper;
}

/**
 * Status pill helper for use inside table.render() cells (e.g. Online/Offline/Submit).
 */
export function statusPill(status) {
    const map = {
        online: { color: 'bg-online', text: 'Online', textColor: 'text-text-dark' },
        offline: { color: 'bg-offline', text: 'Offline', textColor: 'text-white' },
        submit: { color: 'bg-primary', text: 'Submit', textColor: 'text-white' },
        'belum login': { color: 'bg-gray-300', text: 'Belum Login', textColor: 'text-text-dark' },
        aktif: { color: 'bg-online', text: 'Aktif', textColor: 'text-text-dark' },
        nonaktif: { color: 'bg-gray-300', text: 'Nonaktif', textColor: 'text-text-dark' },
        // Device/session connection states (Home page Device Status card)
        connecting: { color: 'bg-pending', text: 'Connecting...', textColor: 'text-text-dark' },
        active: { color: 'bg-online', text: 'Active', textColor: 'text-text-dark' },
        disconnected: { color: 'bg-offline', text: 'Disconnected', textColor: 'text-white' },
    };
    const key = String(status).toLowerCase();
    const conf = map[key] || { color: 'bg-gray-300', text: status, textColor: 'text-text-dark' };
    const dotAnim = key === 'connecting' ? 'animate-pulse' : '';
    return `<span class="inline-flex items-center gap-1.5 px-sm py-1 rounded-badge text-xs font-inter font-bold ${conf.color} ${conf.textColor}">
        <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70 ${dotAnim}"></span>${conf.text}
    </span>`;
}
