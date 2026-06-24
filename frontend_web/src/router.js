import { LoginPage } from './pages/LoginPage.js';
import { TokenPage } from './pages/TokenPage.js';
import { HomePage } from './pages/HomePage.js';
import { SchedulePage } from './pages/SchedulePage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { ExamPlayerPage } from './pages/ExamPlayerPage.js';
import { ResultPage } from './pages/ResultPage.js';
import { DashboardTeacherPage } from './pages/DashboardTeacherPage.js';
import { DashboardAdminPage } from './pages/DashboardAdminPage.js';
import { DashboardProctorPage } from './pages/DashboardProctorPage.js';
import { authService } from './services/auth.js';

const routes = [
    { path: '/login',    component: LoginPage,            requireAuth: false },
    { path: '/token',    component: TokenPage,            requireAuth: true,  roles: ['student'] },
    { path: '/home',     component: HomePage,             requireAuth: true,  roles: ['student'] },
    { path: '/schedule', component: SchedulePage,         requireAuth: true,  roles: ['student'] },
    { path: '/history',  component: HistoryPage,          requireAuth: true,  roles: ['student'] },
    { path: '/exam/:id', component: ExamPlayerPage,       requireAuth: true,  roles: ['student'] },
    { path: '/result/:id',component: ResultPage,          requireAuth: true,  roles: ['student'] },
    { path: '/teacher',  component: DashboardTeacherPage, requireAuth: true,  roles: ['teacher', 'admin'] },
    { path: '/admin',    component: DashboardAdminPage,   requireAuth: true,  roles: ['admin'] },
    { path: '/proctor',  component: DashboardProctorPage, requireAuth: true,  roles: ['proctor', 'admin'] },
];

class Router {
    constructor() {
        this.currentPath = '/';
        this.currentPage = null;
        window.addEventListener('popstate', () => this.handleNavigation());
    }

    navigate(path) {
        window.history.pushState({}, '', path);
        this.handleNavigation();
    }

    handleNavigation() {
        const path = window.location.pathname;
        const route = this.matchRoute(path);

        // Route tidak ditemukan → login
        if (!route) {
            this.navigate('/login');
            return;
        }

        // Belum login → login
        if (route.requireAuth && !authService.isAuthenticated()) {
            this.navigate('/login');
            return;
        }

        // Sudah login tapi buka /login → redirect ke home sesuai role
        if (!route.requireAuth && authService.isAuthenticated()) {
            this.navigate(authService.getHomePath());
            return;
        }

        // Cek role — jika role tidak sesuai, redirect ke halaman yang benar
        if (route.roles && authService.isAuthenticated()) {
            const role = authService.getRole();
            if (!route.roles.includes(role)) {
                this.navigate(authService.getHomePath());
                return;
            }
        }

        this.renderPage(route, path);
        this.currentPath = path;
    }

    matchRoute(path) {
        // Strip query string untuk matching
        const cleanPath = path.split('?')[0];
        return routes.find(route => {
            const pattern = this.pathToRegex(route.path);
            return pattern.test(cleanPath);
        });
    }

    pathToRegex(path) {
        const escaped = path.replace(/\//g, '\\/');
        const pattern = escaped.replace(/:\w+/g, '([\\w-]+)');
        return new RegExp(`^${pattern}$`);
    }

    extractParams(routePath, actualPath) {
        const routeParts = routePath.split('/');
        const pathParts  = actualPath.split('?')[0].split('/');
        const params = {};
        routeParts.forEach((part, i) => {
            if (part.startsWith(':')) params[part.slice(1)] = pathParts[i];
        });
        return params;
    }

    renderPage(route, path) {
        const app = document.getElementById('app');
        this.currentPage?.beforeUnmount?.();

        const params = this.extractParams(route.path, path);
        const page   = new route.component(params);

        app.innerHTML = '';
        app.appendChild(page.render());

        // Guard: mounted() hanya dipanggil kalau method-nya ada
        if (typeof page.mounted === 'function') page.mounted();

        this.currentPage = page;
    }
}

let router = null;

export function setupRouter() {
    router = new Router();
    window.app.router = router;
    router.handleNavigation();
}