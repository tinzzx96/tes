// frontend_web/src/components/Sidebar.js
import { createElement } from '../utils/dom.js';
import { authService } from '../services/auth.js';
import { getInitials } from '../utils/helpers.js';
import { createModal } from './Modal.js';

/**
 * Sidebar navigation for staff dashboards (Admin, Teacher, Proctor).
 * activeId: id of the currently active menu item.
 * menuItems: [{ id, icon, label, path }]
 * roleLabel: text shown under the logo (e.g. "ADMIN SEKOLAH")
 */
export function createSidebar(activeId, menuItems, roleLabel = '') {
    const sidebar = createElement('aside',
        'sidebar-desktop flex-col w-56 h-screen bg-sidebar-bg flex-shrink-0 flex flex-col'
    );
    sidebar.style.cssText = 'border-right: 1px solid #222222;';

    // ── Brand ─────────────────────────────────────────────────────────────────
    const brand = createElement('div', 'flex items-center gap-3 px-5 py-5');
    brand.style.cssText = 'border-bottom: 1px solid #222222;';
    brand.innerHTML = `
        <img src="/logo-poncol.png" alt="Logo" class="h-7 w-auto flex-shrink-0">
        <div class="min-w-0">
            <div class="font-barlow font-extrabold text-sm tracking-widest text-text-primary leading-none">EXAM-PONCOL</div>
            ${roleLabel ? `<div class="text-xs text-accent-gold font-inter font-semibold tracking-wider mt-1 uppercase opacity-80">${roleLabel}</div>` : ''}
        </div>
    `;
    sidebar.appendChild(brand);

    // ── Menu ──────────────────────────────────────────────────────────────────
    const menu = createElement('nav', 'flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto');
    menuItems.forEach(item => {
        if (item.type === 'heading') {
            const heading = createElement('div', 'text-[10px] font-bold text-text-muted uppercase tracking-widest px-3 mt-4 mb-2 font-inter select-none');
            heading.style.cssText = 'color: #737373; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;';
            heading.textContent = item.label;
            menu.appendChild(heading);
            return;
        }

        const isActive = activeId === item.id;
        const menuItem = createElement('div',
            `flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer font-inter text-sm font-medium transition-colors ${
                isActive
                    ? 'bg-sidebar-active text-text-primary'
                    : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary'
            }`
        );

        if (isActive) {
            menuItem.style.cssText = 'border-left: 2px solid #CC0000; padding-left: 10px;';
        } else {
            menuItem.style.cssText = 'border-left: 2px solid transparent; padding-left: 10px;';
        }

        menuItem.innerHTML = `
            <span class="material-icons text-base flex-shrink-0 ${isActive ? 'text-primary' : 'text-text-muted'}">${item.icon}</span>
            <span class="truncate">${item.label}</span>
        `;
        menuItem.addEventListener('click', () => {
            window.app.router.navigate(item.path);
        });
        menu.appendChild(menuItem);
    });

    // Append logout button directly below menu items
    const logoutItem = createElement('div',
        'flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer font-inter text-sm font-medium text-text-secondary hover:bg-sidebar-hover hover:text-primary transition-colors mt-4'
    );
    logoutItem.id = 'sidebar-logout-btn';
    logoutItem.style.cssText = 'border-left: 2px solid transparent; padding-left: 10px;';
    logoutItem.innerHTML = `
        <span class="material-icons text-base flex-shrink-0 text-text-muted">logout</span>
        <span class="truncate">Keluar</span>
    `;
    menu.appendChild(logoutItem);
    sidebar.appendChild(menu);

    // ── Footer (Administrator User Card) ──────────────────────────────────────
    const user = authService.getCurrentUser() || { name: 'USER', nisn: '' };
    const footer = createElement('div', 'px-3 py-4');
    footer.style.cssText = 'border-top: 1px solid #222222;';
    footer.innerHTML = `
        <div class="flex items-center gap-3 px-2.5 py-3">
            <div class="w-10 h-10 bg-primary rounded flex items-center justify-center font-barlow font-bold text-sm text-white flex-shrink-0">
                ${getInitials(user.name || 'U')}
            </div>
            <div class="overflow-hidden flex-1 min-w-0">
                <div class="font-inter font-bold text-sm text-text-primary truncate" style="font-size: 14px;">${user.name}</div>
                <div class="text-xs text-text-muted font-inter capitalize mt-0.5" style="font-size: 11px;">${user.role || ''}</div>
            </div>
        </div>
    `;
    sidebar.appendChild(footer);

    sidebar.querySelector('#sidebar-logout-btn').addEventListener('click', () => {
        createModal({
            title: 'Konfirmasi Keluar',
            bodyHtml: `
                <div class="flex items-center gap-4">
                    <span class="material-icons text-primary text-3xl">warning</span>
                    <p class="font-inter text-sm text-text-secondary">
                        Apakah Anda yakin ingin keluar dari sistem? Sesi Anda akan diakhiri.
                    </p>
                </div>
            `,
            footerButtons: [
                {
                    text: 'Batal',
                    variant: 'secondary',
                    onClick: (close) => close()
                },
                {
                    text: 'Ya, Keluar',
                    variant: 'primary',
                    onClick: (close) => {
                        close();
                        authService.logout();
                        window.app.router.navigate('/login');
                    }
                }
            ]
        });
    });

    return sidebar;
}

/**
 * Mobile top bar for small screens.
 */
export function createMobileTopBar(activeId, menuItems, title = 'EXAM-PONCOL', showMenuButton = true) {
    const bar = createElement('div',
        'sidebar-mobile-bar flex items-center justify-between px-md py-3 bg-sidebar-bg sticky top-0 z-20'
    );
    bar.style.cssText = 'border-bottom: 1px solid #222222;';

    bar.innerHTML = `
        <div class="flex items-center gap-3">
            <img src="/logo-poncol.png" alt="Logo" class="h-7 w-auto">
            <span class="font-barlow font-extrabold text-sm tracking-widest text-text-primary">${title}</span>
        </div>
        ${showMenuButton ? `
        <button id="mobile-menu-btn" class="p-1.5 rounded hover:bg-sidebar-hover transition-colors">
            <span class="material-icons text-text-secondary text-xl">menu</span>
        </button>
        ` : ''}
    `;

    if (showMenuButton) {
        // Remove existing mobile menu elements first to avoid leaks
        document.getElementById('mobile-menu-overlay')?.remove();
        document.getElementById('mobile-menu-drawer')?.remove();

        // Drawer overlay
        const overlay = createElement('div',
            'fixed inset-0 z-40 bg-black bg-opacity-60 hidden'
        );
        overlay.id = 'mobile-menu-overlay';

        const drawer = createElement('div',
            'fixed top-0 left-0 h-full z-50 w-56 bg-sidebar-bg flex flex-col transform -translate-x-full transition-transform duration-200'
        );
        drawer.id = 'mobile-menu-drawer';
        drawer.style.cssText = 'border-right: 1px solid #222222;';

        // Drawer content
        const drawerBrand = createElement('div', 'flex items-center gap-3 px-5 py-5');
        drawerBrand.style.cssText = 'border-bottom: 1px solid #222222;';
        drawerBrand.innerHTML = `
            <img src="/logo-poncol.png" alt="Logo" class="h-7 w-auto">
            <span class="font-barlow font-extrabold text-sm tracking-widest text-text-primary">EXAM-PONCOL</span>
        `;
        drawer.appendChild(drawerBrand);

        const drawerMenu = createElement('nav', 'flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto');
        menuItems.forEach(item => {
            if (item.type === 'heading') {
                const heading = createElement('div', 'text-[10px] font-bold text-text-muted uppercase tracking-widest px-3 mt-4 mb-2 font-inter select-none');
                heading.style.cssText = 'color: #737373; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;';
                heading.textContent = item.label;
                drawerMenu.appendChild(heading);
                return;
            }

            const isActive = activeId === item.id;
            const mi = createElement('div',
                `flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer font-inter text-sm font-medium transition-colors ${
                    isActive ? 'bg-sidebar-active text-text-primary' : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary'
                }`
            );
            mi.style.cssText = `border-left: 2px solid ${isActive ? '#CC0000' : 'transparent'}; padding-left: 10px;`;
            mi.innerHTML = `
                <span class="material-icons text-base flex-shrink-0 ${isActive ? 'text-primary' : 'text-text-muted'}">${item.icon}</span>
                <span class="truncate">${item.label}</span>
            `;
            mi.addEventListener('click', () => {
                closeDrawer();
                window.app.router.navigate(item.path);
            });
            drawerMenu.appendChild(mi);
        });

        // Append mobile logout button below mobile menu items
        const mobileLogoutItem = createElement('div',
            'flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer font-inter text-sm font-medium text-text-secondary hover:bg-sidebar-hover hover:text-primary transition-colors mt-4'
        );
        mobileLogoutItem.style.cssText = 'border-left: 2px solid transparent; padding-left: 10px;';
        mobileLogoutItem.innerHTML = `
            <span class="material-icons text-base flex-shrink-0 text-text-muted">logout</span>
            <span class="truncate">Keluar</span>
        `;
        mobileLogoutItem.addEventListener('click', () => {
            closeDrawer();
            createModal({
                title: 'Konfirmasi Keluar',
                bodyHtml: `
                    <div class="flex items-center gap-4">
                        <span class="material-icons text-primary text-3xl">warning</span>
                        <p class="font-inter text-sm text-text-secondary">
                            Apakah Anda yakin ingin keluar dari sistem? Sesi Anda akan diakhiri.
                        </p>
                    </div>
                `,
                footerButtons: [
                    {
                        text: 'Batal',
                        variant: 'secondary',
                        onClick: (close) => close()
                    },
                    {
                        text: 'Ya, Keluar',
                        variant: 'primary',
                        onClick: (close) => {
                            close();
                            authService.logout();
                            window.app.router.navigate('/login');
                        }
                    }
                ]
            });
        });
        drawerMenu.appendChild(mobileLogoutItem);

        drawer.appendChild(drawerMenu);

        document.body.appendChild(overlay);
        document.body.appendChild(drawer);

        const openDrawer = () => {
            overlay.classList.remove('hidden');
            drawer.classList.remove('-translate-x-full');
        };
        const closeDrawer = () => {
            overlay.classList.add('hidden');
            drawer.classList.add('-translate-x-full');
        };

        bar.querySelector('#mobile-menu-btn').addEventListener('click', openDrawer);
        overlay.addEventListener('click', closeDrawer);
    }

    return bar;
}