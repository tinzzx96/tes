import axios from 'axios';
import { authService } from './auth.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// ── Inject token ke semua request ─────────────────────────────────────────────
apiClient.interceptors.request.use(
    config => {
        const token = authService.getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    error => Promise.reject(error)
);

// ── Handle 401 → redirect login ───────────────────────────────────────────────
apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            authService.logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const api = {

    // ── Generic (dipakai DashboardAdminPage langsung) ─────────────────────────
    get:    (url, config)       => apiClient.get(url, config),
    post:   (url, data, config) => apiClient.post(url, data, config),
    put:    (url, data, config) => apiClient.put(url, data, config),
    patch:  (url, data, config) => apiClient.patch(url, data, config),
    delete: (url, config)       => apiClient.delete(url, config),

    // ── Auth ──────────────────────────────────────────────────────────────────
    getMe: () => apiClient.get('/auth/me'),

    // ── Student: Exams ────────────────────────────────────────────────────────
    getExams:    ()       => apiClient.get('/exams'),
    getExam:     (id)     => apiClient.get(`/exams/${id}`),
    startExam:   (examId) => apiClient.post(`/exams/${examId}/start`),
    getTimer:    (examId) => apiClient.get(`/exams/${examId}/timer`),
    getQuestions:(examId) => apiClient.get(`/exams/${examId}/questions`),
    submitExam:  (examId) => apiClient.post(`/exams/${examId}/submit`),
    getResult:   (examId) => apiClient.get(`/exams/${examId}/result`),

    // ── Student: Auto-Save (URL BARU — pakai examAttemptId) ───────────────────
    saveAnswer: (examAttemptId, questionId, selectedOptionIndex) =>
        apiClient.post(`/exam-attempts/${examAttemptId}/answers`, {
            questionId: Number(questionId),
            selectedOptionIndex: selectedOptionIndex != null ? Number(selectedOptionIndex) : null,
            clientTimestamp: new Date().toISOString(),
        }),

    // ── Student: History (URL FIXED — hapus /v1/) ────────────────────────────
    getExamHistory: () => apiClient.get('/exam-attempts/history'),

    // ── Student: Heartbeat ────────────────────────────────────────────────────
    sendHeartbeat: (examAttemptId, deviceName) =>
        apiClient.post('/monitor/heartbeat', {
            examAttemptId: Number(examAttemptId),
            ...(deviceName ? { device: deviceName } : {}),
        }),

    // ── Student: Token Ujian ──────────────────────────────────────────────────
    validateExamToken: (examId, token) =>
        apiClient.post('/exam-tokens/validate', {
            examId: Number(examId),
            token: token.trim().toUpperCase(),
        }),

    // ── Security ──────────────────────────────────────────────────────────────
    reportViolation: (examAttemptId, reasonCode, violationNumber) =>
        apiClient.post('/security/report-violation', {
            examAttemptId: Number(examAttemptId),
            reasonCode,
            violationNumber: Number(violationNumber),
        }),
    verifyUnlock: (examAttemptId, pin) =>
        apiClient.post('/security/verify-unlock', {
            examAttemptId: Number(examAttemptId),
            pin: pin.trim().toUpperCase(),
        }),
    getSecurityStatus: (examAttemptId) =>
        apiClient.get(`/security/status/${examAttemptId}`),

    // ── Admin: Users ──────────────────────────────────────────────────────────
    // Dipakai via api.get('/admin/users') langsung di DashboardAdminPage

    // ── Teacher: Exams & Results ──────────────────────────────────────────────
    // Dipakai via api.get('/teacher/exams') langsung di DashboardTeacherPage

    // ── Monitor: Participants ─────────────────────────────────────────────────
    getParticipants: (examId) =>
        apiClient.get(`/monitor/exam/${examId}/participants`),

    // ── Device ────────────────────────────────────────────────────────────────
    updateDeviceStatus: (data) => apiClient.post('/device/status', data),
};

export default apiClient;