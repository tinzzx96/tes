import { createElement } from '../utils/dom.js';

export function createInputField(options = {}) {
    const {
        type = 'text',
        label = '',
        placeholder = '',
        value = '',
        onChange = null,
        className = '',
    } = options;
    
    const container = createElement('div', `mb-lg ${className}`);
    
    if (label) {
        const labelEl = createElement('label', 'block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label');
        labelEl.textContent = label;
        container.appendChild(labelEl);
    }
    
    const input = createElement('input', 'w-full px-md py-3 bg-transparent border border-gray-600 rounded-input text-text-primary placeholder-text-secondary font-inter text-input-hint focus:border-primary focus:outline-none transition-colors');
    
    input.type = type;
    input.placeholder = placeholder;
    input.value = value;
    
    if (onChange) {
        input.addEventListener('change', onChange);
        input.addEventListener('input', onChange);
    }
    
    container.appendChild(input);
    
    return { container, input };
}

export function createTextarea(options = {}) {
    const {
        label = '',
        placeholder = '',
        value = '',
        rows = 4,
        onChange = null,
        className = '',
    } = options;
    
    const container = createElement('div', `mb-lg ${className}`);
    
    if (label) {
        const labelEl = createElement('label', 'block font-inter font-bold text-input-label text-text-primary mb-sm uppercase tracking-label');
        labelEl.textContent = label;
        container.appendChild(labelEl);
    }
    
    const textarea = createElement('textarea', 'w-full px-md py-md bg-transparent border border-gray-600 rounded-input text-text-primary placeholder-text-secondary font-inter focus:border-primary focus:outline-none transition-colors');
    
    textarea.placeholder = placeholder;
    textarea.value = value;
    textarea.rows = rows;
    
    if (onChange) {
        textarea.addEventListener('change', onChange);
        textarea.addEventListener('input', onChange);
    }
    
    container.appendChild(textarea);
    
    return { container, textarea };
}
