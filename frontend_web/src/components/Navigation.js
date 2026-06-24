import { createElement } from '../utils/dom.js';

export function createBottomNav(activePage = 'home') {
    const nav = createElement('nav', 'fixed bottom-0 left-0 right-0 bg-nav-bg border-t border-divider flex justify-around items-center h-16');
    
    const navItems = [
        { id: 'home', icon: 'home', label: 'Home', path: '/home' },
        { id: 'schedule', icon: 'schedule', label: 'Schedule', path: '/schedule' },
        { id: 'history', icon: 'history', label: 'History', path: '/history' },
    ];
    
    navItems.forEach(item => {
        const navItem = createElement('div', `flex flex-col items-center justify-center cursor-pointer transition-colors py-2`);
        const isActive = activePage === item.id;
        
        const iconColor = isActive ? 'text-nav-active' : 'text-nav-inactive';
        const labelColor = isActive ? 'text-nav-active' : 'text-nav-inactive';
        
        navItem.innerHTML = `
            <span class="material-icons ${iconColor} text-2xl">${item.icon}</span>
            <span class="text-label-caps mt-1 font-inter font-bold ${labelColor}">${item.label}</span>
        `;
        
        navItem.addEventListener('click', () => {
            window.app.router.navigate(item.path);
        });
        
        nav.appendChild(navItem);
    });
    
    return nav;
}
