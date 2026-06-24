import { createElement } from '../utils/dom.js';

export function createButton(text, options = {}) {
    const {
        type = 'button',
        variant = 'primary', // primary, secondary, danger
        size = 'md', // sm, md, lg
        icon = null,
        disabled = false,
        onClick = null,
        className = '',
    } = options;
    
    const baseClasses = 'font-barlow font-bold rounded-btn transition-colors';
    const sizeClasses = {
        sm: 'px-md py-sm text-sm',
        md: 'px-lg py-md text-button-primary w-full',
        lg: 'px-xl py-lg text-lg w-full',
    };
    
    const variantClasses = {
        primary: 'bg-primary hover:bg-primary-dark text-text-primary disabled:opacity-50',
        secondary: 'bg-surface hover:bg-surface text-text-primary border border-divider',
        danger: 'bg-primary hover:bg-primary-dark text-text-primary',
    };
    
    const button = createElement('button', `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`);
    
    button.type = type;
    button.disabled = disabled;
    
    if (onClick) {
        button.addEventListener('click', onClick);
    }
    
    let content = text;
    if (icon) {
        content = `<span class="material-icons inline mr-2 align-middle">${icon}</span>${text}`;
    }
    
    button.innerHTML = content;
    
    return button;
}

export function createIconButton(icon, options = {}) {
    const {
        size = 'md',
        className = '',
        onClick = null,
    } = options;
    
    const sizeClasses = {
        sm: 'p-1 text-xl',
        md: 'p-md text-2xl',
        lg: 'p-lg text-3xl',
    };
    
    const button = createElement('button', `text-text-secondary hover:text-text-primary transition-colors ${sizeClasses[size]} ${className}`);
    button.innerHTML = `<span class="material-icons">${icon}</span>`;
    
    if (onClick) {
        button.addEventListener('click', onClick);
    }
    
    return button;
}
