import { getDeviceInfo } from '../utils/userAgent.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

class AuthService {
    constructor() {
        this.storageKey = 'exam_poncol_auth';
        this.userKey    = 'exam_poncol_user';
    }

    // ── Login (real API) ──────────────────────────────────────────────────────
    async login(nisn, password, sessionToken) {
        // Step 1: Login → dapat accessToken
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nisn: nisn.trim(),
                password,
                sessionToken: (sessionToken || '').trim().toUpperCase(),
            }),
        });

        const data = await res.json();
        if (!data.success) {
            throw new Error(data.error?.message || data.message || 'Login gagal.');
        }

        const { accessToken } = data.data;
        sessionStorage.setItem(this.storageKey, accessToken);

        // Step 2: Hit /auth/me → dapat role + data lengkap
        const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();

        const fullUser = meData.success ? meData.data : data.data.student;

        const detectedDevice = getDeviceInfo().deviceLabel;
        const user = {
            id:       fullUser.id,
            name:     fullUser.name,
            nisn:     fullUser.nisn,
            class:    fullUser.class || fullUser.classLabel || '-',
            device:   detectedDevice,
            room:     fullUser.room || '-',
            role:     fullUser.role || 'student',
            verified: fullUser.verified ?? true,
        };

        sessionStorage.setItem(this.userKey, JSON.stringify(user));
        return { success: true, user };
    }

    // ── Validasi Token Ujian ──────────────────────────────────────────────────
    async validateExamToken(examId, token) {
        const accessToken = this.getToken();
        if (!accessToken) throw new Error('Sesi tidak ditemukan. Login ulang.');

        const res = await fetch(`${API_BASE_URL}/exam-tokens/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                examId: Number(examId),
                token: token.trim().toUpperCase(),
            }),
        });

        const data = await res.json();
        if (!data.success) {
            throw new Error(data.error?.message || 'Token Ujian salah.');
        }

        sessionStorage.setItem('exam_attempt_id', String(data.data.examAttemptId));
        return data.data;
    }

    // ── Logout ────────────────────────────────────────────────────────────────
    logout() {
        sessionStorage.removeItem(this.storageKey);
        sessionStorage.removeItem(this.userKey);
        sessionStorage.removeItem('exam_attempt_id');
        sessionStorage.removeItem('current_exam_id');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    isAuthenticated() { return !!sessionStorage.getItem(this.storageKey); }
    getCurrentUser()  {
        const u = sessionStorage.getItem(this.userKey);
        return u ? JSON.parse(u) : null;
    }
    getToken()        { return sessionStorage.getItem(this.storageKey); }
    getExamAttemptId() {
        const raw = sessionStorage.getItem('exam_attempt_id');
        return raw ? parseInt(raw, 10) : null;
    }

    // ── Role helpers ──────────────────────────────────────────────────────────
    getRole()    { return this.getCurrentUser()?.role || null; }
    isStudent()  { return this.getRole() === 'student'; }
    isTeacher()  { return this.getRole() === 'teacher'; }
    isAdmin()    { return this.getRole() === 'admin'; }
    isProctor()  { return this.getRole() === 'proctor'; }

    getHomePath() {
        const role = this.getRole();
        if (role === 'admin')   return '/admin';
        if (role === 'teacher') return '/teacher';
        if (role === 'proctor') return '/proctor';
        return '/home';
    }
}

export const authService = new AuthService();