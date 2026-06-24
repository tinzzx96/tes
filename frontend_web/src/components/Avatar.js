import { createElement } from '../utils/dom.js';
import { getInitials } from '../utils/helpers.js';

export function createAvatar(name, size = 'md') {
    const sizeMap = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-14 h-14 text-lg',
        lg: 'w-32 h-32 text-3xl',
    };
    
    const avatar = createElement('div', `${sizeMap[size]} bg-avatar-bg rounded-avatar flex items-center justify-center border-[1.5px] border-avatar-border font-barlow font-bold text-avatar-text`);
    avatar.textContent = getInitials(name);
    
    return avatar;
}
