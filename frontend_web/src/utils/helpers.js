// Format time display (HH:MM)
export function formatTime(date) {
    if (!date) return '--:--';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Format countdown (MM:SS)
export function formatCountdown(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Format date (DD Mon YYYY)
export function formatDate(date) {
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(date).toLocaleDateString('id-ID', options);
}

// Truncate text
export function truncate(text, length = 50) {
    return text.length > length ? text.substring(0, length) + '...' : text;
}

// Get initials from name (PRD Bagian 6: 2 huruf pertama dari nama depan +
// nama belakang, mis. "Danang Prakoso" -> "DP"). Uses first word + last
// word only (not every middle name) so it always resolves to exactly
// 2 letters regardless of how many words the name has.
export function getInitials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
    return (first + last).toUpperCase();
}

// Parse time range "HH:MM - HH:MM"
export function parseTimeRange(timeStr) {
    const [start, end] = timeStr.split('-').map(t => t.trim());
    return { start, end };
}

// Contextual greeting based on current hour (PRD: Greeting Kontekstual)
export function getGreeting(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 0 && hour < 11) return 'Selamat pagi';
    if (hour >= 11 && hour < 15) return 'Selamat siang';
    if (hour >= 15 && hour < 18) return 'Selamat sore';
    return 'Selamat malam';
}

const ID_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ID_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Full Indonesian date, e.g. "Rabu, 18 Juni 2026"
export function formatIndonesianDate(date = new Date()) {
    const d = new Date(date);
    const day = ID_DAYS[d.getDay()];
    const month = ID_MONTHS[d.getMonth()];
    return `${day}, ${d.getDate()} ${month} ${d.getFullYear()}`;
}

// "Selasa - 17 Juni 2026" used as History group headers
export function formatIndonesianDateDash(date = new Date()) {
    const d = new Date(date);
    const day = ID_DAYS[d.getDay()];
    const month = ID_MONTHS[d.getMonth()];
    return `${day} - ${d.getDate()} ${month} ${d.getFullYear()}`;
}

// Group an array of items by the calendar day of `dateKey`, newest day first.
// Returns [{ key: 'YYYY-MM-DD', label: 'Selasa - 17 Juni 2026', items: [...] }]
export function groupByDate(items, dateKey = 'submittedAt') {
    const groups = new Map();
    items.forEach(item => {
        const d = new Date(item[dateKey]);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!groups.has(key)) {
            groups.set(key, { key, date: d, label: formatIndonesianDateDash(d), items: [] });
        }
        groups.get(key).items.push(item);
    });
    return Array.from(groups.values()).sort((a, b) => b.date - a.date);
}

// Today's exam summary text (PRD Bagian 4)
export function getTodayExamSummaryText(total, completed) {
    if (total === 0) return 'Tidak ada ujian';
    if (completed >= total) return 'Semua ujian selesai';
    return `${total} ujian - ${completed} selesai`;
}
