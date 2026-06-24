import { createElement } from '../utils/dom.js';
import { authService } from '../services/auth.js';
import { getInitials } from '../utils/helpers.js';

/**
 * Sidebar navigation for staff dashboards (Admin, Teacher, Proctor).
 * activeId: id of the currently active menu item.
 * menuItems: [{ id, icon, label, path }]
 * roleLabel: text shown under the logo (e.g. "ADMIN SEKOLAH")
 */
export function createSidebar(activeId, menuItems, roleLabel = '') {
    const sidebar = createElement('aside', 'sidebar-desktop flex-col w-64 min-h-screen bg-sidebar-bg border-r border-divider flex-shrink-0');

    // Logo / Brand
    const brand = createElement('div', 'flex items-center gap-md px-lg py-lg border-b border-divider');
    brand.innerHTML = `
        <img src="/logo-poncol.png" alt="Logo" class="h-9 w-auto">
        <div>
            <div class="font-barlow font-extrabold text-base tracking-title text-text-primary leading-none">EXAM-PONCOL</div>
            ${roleLabel ? `<div class="text-label-caps text-accent-gold font-inter font-bold uppercase tracking-label mt-1">${roleLabel}</div>` : ''}
        </div>
    `;
    sidebar.appendChild(brand);

    // Menu
    const menu = createElement('nav', 'flex-1 px-md py-lg flex flex-col gap-xs');
    menuItems.forEach(item => {
        const isActive = activeId === item.id;
        const menuItem = createElement(
            'div',
            `flex items-center gap-md px-md py-3 rounded-btn cursor-pointer transition-colors font-inter text-sidebar-label ${
                isActive
                    ? 'bg-sidebar-active text-text-primary border-l-4 border-primary'
                    : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary border-l-4 border-transparent'
            }`
        );
        menuItem.innerHTML = `
            <span class="material-icons text-xl ${isActive ? 'text-primary' : ''}">${item.icon}</span>
            <span>${item.label}</span>
        `;
        menuItem.addEventListener('click', () => {
            window.app.router.navigate(item.path);
        });
        menu.appendChild(menuItem);
    });
    sidebar.appendChild(menu);

    // Footer - user + logout
    const user = authService.getCurrentUser() || { name: 'USER', nisn: '' };
    const footer = createElement('div', 'border-t border-divider px-lg py-lg');
    footer.innerHTML = `
        <div class="flex items-center gap-sm mb-md">
            <div class="w-9 h-9 bg-avatar-bg rounded-avatar flex items-center justify-center font-barlow font-bold text-sm text-avatar-text flex-shrink-0">
                ${getInitials(user.name || 'U')}
            </div>
            <div class="overflow-hidden">
                <div class="font-inter font-bold text-sm text-text-primary truncate">${user.name}</div>
                <div class="text-xs text-text-muted font-inter truncate">${user.role || ''}</div>
            </div>
        </div>
        <button class="w-full flex items-center justify-center gap-sm py-2 rounded-btn border border-divider text-text-secondary hover:text-primary hover:border-primary transition-colors font-inter text-sm font-bold" id="sidebar-logout-btn">
            <span class="material-icons text-base">logout</span>
            LOGOUT
        </button>
    `;
    sidebar.appendChild(footer);

    footer.querySelector('#sidebar-logout-btn').addEventListener('click', () => {
        authService.logout();
        window.app.router.navigate('/login');
    });

    return sidebar;
}

/**
 * Mobile top bar shown alongside sidebar on small screens, with a menu trigger.
 * Keeps the same header brand as student app for visual consistency.
 */
export function createMobileTopBar(title, menuItems, activeId) {
    const bar = createElement('div', 'mobile-topbar sticky top-0 z-50 bg-bg-primary border-b border-accent-gold');
    bar.innerHTML = `
        <div class="flex items-center justify-between px-lg py-md">
            <div class="flex items-center gap-md">
                <img src="/logo-poncol.png" alt="Logo" class="h-8 w-auto">
                <div class="font-barlow font-extrabold text-lg tracking-title text-text-primary">${title}</div>
            </div>
            <span class="material-icons text-text-primary cursor-pointer" id="mobile-menu-toggle">menu</span>
        </div>
        <div class="hidden flex-col border-t border-divider" id="mobile-menu-dropdown"></div>
    `;

    const dropdown = bar.querySelector('#mobile-menu-dropdown');
    menuItems.forEach(item => {
        const isActive = activeId === item.id;
        const row = createElement(
            'div',
            `flex items-center gap-md px-lg py-3 font-inter text-sm font-bold cursor-pointer ${isActive ? 'text-primary' : 'text-text-secondary'}`
        );
        row.innerHTML = `<span class="material-icons text-lg">${item.icon}</span> ${item.label}`;
        row.addEventListener('click', () => window.app.router.navigate(item.path));
        dropdown.appendChild(row);
    });

    bar.querySelector('#mobile-menu-toggle').addEventListener('click', () => {
        dropdown.classList.toggle('hidden');
        dropdown.classList.toggle('flex');
    });

    return bar;
}
