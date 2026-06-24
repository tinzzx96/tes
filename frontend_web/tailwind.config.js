/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,html}",
  ],
  theme: {
    extend: {
      colors: {
        // Background
        'bg-primary': '#1C1C1C',
        'bg-surface': '#2A2A2A',
        'bg-surface-light': '#F0F0F0',
        
        // Primary Colors
        'primary': '#CC0000',
        'primary-dark': '#990000',
        'accent-gold': '#C9A84C',
        
        // Text Colors
        'text-primary': '#FFFFFF',
        'text-secondary': '#AAAAAA',
        'text-dark': '#1C1C1C',
        'text-muted': '#666666',
        'text-accent': '#CC0000',
        
        // Status & Utility
        'online': '#00CC66',
        'offline': '#666666',
        'pending': '#C9A84C',
        'submit-green': '#00CC66',
        'danger-soft': '#E54848',
        'warning-bg': '#3D3200',
        'warning-border': '#C9A84C',
        'warning-text': '#C9A84C',
        'divider': '#333333',
        
        // Navigation
        'nav-bg': '#FFFFFF',
        'nav-active': '#CC0000',
        'nav-inactive': '#1C1C1C',
        
        // Sidebar (staff dashboards)
        'sidebar-bg': '#161616',
        'sidebar-hover': '#262626',
        'sidebar-active': '#2A1010',
        
        // Avatar
        'avatar-bg': '#CC0000',
        'avatar-text': '#FFFFFF',
        'avatar-border': '#C9A84C',
      },
      fontFamily: {
        'barlow': ['Barlow Condensed', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
        'alumni': ['Alumni Sans', 'sans-serif'],
      },
      fontSize: {
        'app-title': ['22px', { lineHeight: '1', fontWeight: '800' }],
        'page-title': ['32px', { lineHeight: '1', fontWeight: '800' }],
        'exam-title': ['24px', { lineHeight: '1', fontWeight: '800' }],
        'student-name': ['20px', { lineHeight: '1', fontWeight: '700' }],
        'student-meta': ['13px', { lineHeight: '1', fontWeight: '400' }],
        'label-caps': ['11px', { lineHeight: '1', fontWeight: '600' }],
        'button-primary': ['16px', { lineHeight: '1', fontWeight: '700' }],
        'card-title': ['18px', { lineHeight: '1', fontWeight: '700' }],
        'card-code': ['13px', { lineHeight: '1', fontWeight: '400' }],
        'card-meta': ['13px', { lineHeight: '1', fontWeight: '400' }],
        'card-date': ['12px', { lineHeight: '1', fontWeight: '400' }],
        'badge-today': ['11px', { lineHeight: '1', fontWeight: '700' }],
        'subtitle': ['14px', { lineHeight: '1', fontWeight: '400' }],
        'input-label': ['12px', { lineHeight: '1', fontWeight: '700' }],
        'input-hint': ['14px', { lineHeight: '1', fontWeight: '400' }],
        'caption': ['11px', { lineHeight: '1', fontWeight: '400' }],
        'time-bold': ['20px', { lineHeight: '1', fontWeight: '700' }],
        'duration-label': ['12px', { lineHeight: '1', fontWeight: '400' }],
        'duration-value': ['18px', { lineHeight: '1', fontWeight: '700' }],
        'stat-value': ['28px', { lineHeight: '1', fontWeight: '800' }],
        'stat-label': ['12px', { lineHeight: '1', fontWeight: '600' }],
        'table-header': ['11px', { lineHeight: '1', fontWeight: '700' }],
        'table-cell': ['14px', { lineHeight: '1.3', fontWeight: '400' }],
        'sidebar-label': ['14px', { lineHeight: '1', fontWeight: '600' }],
        'section-title': ['18px', { lineHeight: '1', fontWeight: '800' }],
      },
      borderRadius: {
        'card': '12px',
        'card-dark': '8px',
        'btn': '6px',
        'input': '4px',
        'avatar': '8px',
        'badge': '4px',
        'warning': '6px',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '48px',
      },
      boxShadow: {
        'card': '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      letterSpacing: {
        'title': '4px',
        'label': '2px',
      },
    },
  },
  plugins: [],
}
