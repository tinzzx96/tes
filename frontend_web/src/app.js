import { setupRouter } from './router.js';
import { authService } from './services/auth.js';
import { setupEventListeners } from './utils/events.js';

export function initApp() {
    console.log('🚀 EXAM PONCOL v1.0.1 - Initializing...');
    
    // Check authentication status
    const isAuthenticated = authService.isAuthenticated();
    const currentUser = authService.getCurrentUser();
    
    console.log('Auth Status:', { isAuthenticated, currentUser });
    
    // Setup router (handles navigation)
    setupRouter();
    
    // Setup global event listeners
    setupEventListeners();
    
    // Initial route
    if (isAuthenticated) {
        window.app.router.navigate('/home');
    } else {
        window.app.router.navigate('/login');
    }
}

// Expose app to window for debugging
window.app = {
    router: null,
    auth: authService,
    version: '1.0.1'
};
