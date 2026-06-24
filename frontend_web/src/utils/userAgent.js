/**
 * User Agent & Connection detection utility.
 *
 * Wraps the `ua-parser-js` library so pages can read the student's actual
 * browser, OS, and device type, and combines it with the browser's native
 * online/offline + Network Information APIs to drive the "Device Status"
 * card on the Home page (see screenshot reference).
 *
 * IMPORTANT — scope of this file (frontend only, no backend yet):
 * - Everything here reads what the BROWSER exposes on the client
 *   (navigator.userAgent, navigator.onLine, navigator.connection).
 * - It does NOT perform any real handshake, token check, or heartbeat
 *   with a server. "Connecting" is a short UI simulation so the status
 *   badge doesn't just pop straight to Active.
 * - When the backend is ready, replace `checkBrowserCompatibility()` /
 *   the timeout in HomePage with a real API call (e.g. POST /session/verify)
 *   and keep this module purely for the UA/connection parts.
 */

import { UAParser } from 'ua-parser-js';

let cachedResult = null;

// Parse navigator.userAgent once per page load and cache it.
function parseUA() {
    if (!cachedResult) {
        cachedResult = new UAParser().getResult();
    }
    return cachedResult;
}

/**
 * Friendly browser/OS/device labels derived from the UA string.
 * Returns: { browserLabel, osLabel, deviceType, deviceModel, deviceLabel, platform }
 */
function getDesktopDeviceLabel(os, platform, deviceModel) {
    if (deviceModel) {
        return deviceModel;
    }

    const osName = (os.name || '').toLowerCase();

    // Use the actually-detected OS version so the label is specific
    // (e.g. "Windows 10 PC") instead of a generic "Windows PC" for
    // every Windows machine regardless of version.
    if (/windows/.test(osName)) {
        return os.version ? `Windows ${os.version} PC` : 'Windows PC';
    }
    if (/mac os|macos/.test(osName)) {
        return os.version ? `Mac (macOS ${os.version})` : 'Mac';
    }
    if (/(ubuntu|fedora|debian|linux|x11)/.test(osName)) {
        return os.name && !/linux/i.test(os.name) ? `${os.name} PC` : 'Linux PC';
    }

    const normalized = `${platform || ''} ${osName}`;
    if (/windows|win32|win64|windows nt/.test(normalized)) {
        return 'Windows PC';
    }
    if (/mac|macintosh|macintel|macppc|mac68k|os x/.test(normalized)) {
        return 'Mac';
    }
    if (/linux|x11/.test(normalized)) {
        return 'Linux PC';
    }

    return 'Desktop PC';
}

export function getDeviceInfo() {
    const { browser, os, device } = parseUA();

    const browserLabel = browser.name
        ? `${browser.name} ${browser.major || browser.version || ''}`.trim()
        : 'Unknown Browser';

    const osLabel = os.name
        ? `${os.name} ${os.version || ''}`.trim()
        : 'Unknown OS';

    const deviceType = device.type || 'desktop';

    const deviceModel = [device.vendor, device.model].filter(Boolean).join(' ') || null;
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    const deviceLabel = deviceType === 'desktop'
        ? getDesktopDeviceLabel(os, platform, deviceModel)
        : [device.vendor, device.model, device.type].filter(Boolean).join(' ').trim() || 'Unknown Device';

    return { browserLabel, osLabel, deviceType, deviceModel, deviceLabel, platform: platform || null };
}

// Maps a detected device type to a Material Icon name for the UI.
export function getDeviceIcon(deviceType) {
    const icons = {
        mobile: 'smartphone',
        tablet: 'tablet_mac',
        console: 'sports_esports',
        smarttv: 'tv',
        desktop: 'desktop_mac',
    };
    return icons[deviceType] || icons.desktop;
}

/**
 * Live connection snapshot.
 * `navigator.connection` (Network Information API) is Chromium-only, so
 * effectiveType/downlinkMbps will be null on Firefox/Safari — that's a
 * browser limitation, not something this code can fix.
 */
export function getConnectionState() {
    const online = navigator.onLine;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;

    return {
        online,
        effectiveType: conn?.effectiveType || null, // e.g. '4g', '3g'
        downlinkMbps: conn?.downlink ?? null,
        // 'wifi' | 'ethernet' | 'cellular' | 'unknown' — only exposed by
        // a handful of Chromium builds (mostly Android); on most desktop
        // browsers this stays null, which is a genuine browser limitation.
        connectionType: conn?.type || null,
    };
}

/**
 * Best-effort LOCAL network info (the device's own IP on the exam
 * LAN/WiFi) using a WebRTC ICE candidate gathering trick — no STUN/TURN
 * server is contacted, so this never touches the public internet, it
 * only asks the OS for its local interface address.
 *
 * Honest limitation: modern Chrome/Edge/Firefox obfuscate the local IP
 * behind an mDNS hostname (e.g. "xxxxxxxx-....local") by default for
 * privacy, so a raw IPv4 candidate may not appear. When that happens we
 * resolve with detected:false instead of inventing a fake address —
 * the UI should show "IP tidak terdeteksi" rather than a placeholder.
 */
export function getLocalNetworkInfo(timeoutMs = 1500) {
    return new Promise((resolve) => {
        if (typeof RTCPeerConnection === 'undefined') {
            resolve({ ip: null, detected: false });
            return;
        }

        let settled = false;
        let pc;
        const finish = (ip) => {
            if (settled) return;
            settled = true;
            try { pc && pc.close(); } catch (_) { /* noop */ }
            resolve(ip ? { ip, detected: true } : { ip: null, detected: false });
        };

        try {
            pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('exam-poncol-probe');

            pc.onicecandidate = (event) => {
                if (!event || !event.candidate || !event.candidate.candidate) {
                    finish(null); // ICE gathering finished, nothing usable found
                    return;
                }
                const match = event.candidate.candidate.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})/);
                if (match && match[1] !== '0.0.0.0' && !match[1].startsWith('0.')) {
                    finish(match[1]);
                }
            };

            pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
                .catch(() => finish(null));
        } catch (err) {
            finish(null);
            return;
        }

        setTimeout(() => finish(null), timeoutMs);
    });
}

/**
 * Very lightweight, frontend-only compatibility hint — most evergreen
 * browsers pass. Real lockdown/browser-allowlist rules for the exam
 * should live on the backend, not here.
 */
export function checkBrowserCompatibility() {
    const { browser } = parseUA();
    const unsupported = ['IE', 'IEMobile', 'BlackBerry'];
    const supported = browser.name ? !unsupported.includes(browser.name) : true;

    return {
        supported,
        message: supported
            ? 'Browser didukung untuk sesi ujian.'
            : `${browser.name || 'Browser ini'} tidak didukung. Gunakan Chrome/Edge/Firefox versi terbaru.`,
    };
}

/**
 * Subscribes to live connectivity changes (online/offline events, plus
 * connection-type change on browsers that support it) so the UI can react
 * if WiFi/LAN drops mid-session. Returns an unsubscribe function — call it
 * from a page's beforeUnmount() to avoid leaking listeners.
 */
export function subscribeConnectionState(onChange) {
    const handler = () => onChange(getConnectionState());

    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    conn?.addEventListener?.('change', handler);

    return () => {
        window.removeEventListener('online', handler);
        window.removeEventListener('offline', handler);
        conn?.removeEventListener?.('change', handler);
    };
}
