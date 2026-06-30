import { createElement } from '../utils/dom.js';

/**
 * Generic data table for dashboards.
 * columns: [{ key, label, render?: (row) => htmlString, width?: 'css-width-class' }]
 * rows: array of data objects
 */
export function createTable(columns, rows, options = {}) {
    const { emptyMessage = 'Tidak ada data.', className = '' } = options;

    const wrapper = createElement('div', `bg-bg-surface border border-divider rounded-card overflow-hidden shadow-lg ${className}`);
    const scrollWrap = createElement('div', 'overflow-x-auto');

    const table = createElement('table', 'w-full text-left border-collapse min-w-[640px]');

    // Header
    const thead = createElement('thead', '');
    const headRow = createElement('tr', 'bg-[#181818] border-b border-divider');
    columns.forEach(col => {
        const th = createElement(
            'th',
            `px-md py-4 text-table-header text-text-secondary font-inter uppercase tracking-wider text-xs font-semibold whitespace-nowrap ${col.width || ''}`
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
                `border-b border-white border-opacity-[0.08] hover:bg-[#333333] hover:bg-opacity-20 transition-all duration-200 ease-in-out`
            );
            columns.forEach(col => {
                const td = createElement('td', 'px-md py-4 text-table-cell text-text-primary font-inter align-middle');
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
        online: { bg: 'bg-online bg-opacity-10', border: 'border border-online border-opacity-25', text: 'Online', textColor: 'text-online' },
        offline: { bg: 'bg-offline bg-opacity-15', border: 'border border-offline border-opacity-25', text: 'Offline', textColor: 'text-text-secondary' },
        submit: { bg: 'bg-primary bg-opacity-15', border: 'border border-primary border-opacity-25', text: 'Submit', textColor: 'text-primary' },
        'belum login': { bg: 'bg-white bg-opacity-5', border: 'border border-divider border-opacity-25', text: 'Belum Login', textColor: 'text-text-secondary' },
        aktif: { bg: 'bg-online bg-opacity-10', border: 'border border-online border-opacity-25', text: 'Aktif', textColor: 'text-online' },
        nonaktif: { bg: 'bg-white bg-opacity-5', border: 'border border-divider border-opacity-25', text: 'Nonaktif', textColor: 'text-text-secondary' },
        connecting: { bg: 'bg-pending bg-opacity-10', border: 'border border-pending border-opacity-25', text: 'Connecting...', textColor: 'text-pending' },
        active: { bg: 'bg-online bg-opacity-10', border: 'border border-online border-opacity-25', text: 'Active', textColor: 'text-online' },
        disconnected: { bg: 'bg-offline bg-opacity-15', border: 'border border-offline border-opacity-25', text: 'Disconnected', textColor: 'text-text-secondary' },
    };
    const key = String(status).toLowerCase();
    const conf = map[key] || { bg: 'bg-white bg-opacity-5', border: 'border border-divider border-opacity-25', text: status, textColor: 'text-text-secondary' };
    const dotAnim = key === 'connecting' ? 'animate-pulse' : '';
    const dotColor = conf.textColor.replace('text-', 'bg-');
    
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-xs font-inter font-semibold ${conf.bg} ${conf.border} ${conf.textColor}">
        <span class="w-1.5 h-1.5 rounded-full ${dotColor} opacity-80 ${dotAnim}"></span>${conf.text}
    </span>`;
}
