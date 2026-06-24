// Create element with classes
export function createElement(tag, classes = '', html = '') {
    const el = document.createElement(tag);
    if (classes) el.className = classes;
    if (html) el.innerHTML = html;
    return el;
}

// Material Icon
export function createMaterialIcon(iconName, classes = '') {
    const icon = createElement('span', `material-icons ${classes}`, iconName);
    return icon;
}

// Show/Hide element
export function show(el) {
    if (el) el.classList.remove('hidden');
}

export function hide(el) {
    if (el) el.classList.add('hidden');
}

// Add/Remove classes
export function addClass(el, ...classes) {
    if (el) el.classList.add(...classes);
}

export function removeClass(el, ...classes) {
    if (el) el.classList.remove(...classes);
}

export function toggleClass(el, className) {
    if (el) el.classList.toggle(className);
}

// Set attributes
export function setAttr(el, attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
        el.setAttribute(key, value);
    });
}

// Remove element
export function remove(el) {
    if (el?.parentNode) el.parentNode.removeChild(el);
}

// Returns "fade-up fade-up-stagger-N" for list items, capped at 6 so
// long lists don't feel slow (item 7+ shares the max delay).
export function fadeUpClass(index = 0) {
    const step = Math.min(index + 1, 6);
    return `fade-up fade-up-stagger-${step}`;
}
