package com.example.apk_ujian;
# tes
import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.EventChannel;
import io.flutter.plugin.common.MethodChannel;

public class MainActivity extends FlutterActivity {

    private static final String CHANNEL = "com.exam.poncol/security";
    private static final String FOCUS_CHANNEL = "com.exam.poncol/focus_events";

    /**
     * Sink EventChannel untuk mendorong event focus ke Flutter secara instan.
     * Null jika Flutter belum subscribe ke stream (sebelum _boot() jalan).
     */
    private EventChannel.EventSink focusEventSink;

    /**
     * Status fokus window Activity. Saat overlay/floating app (Smart Sidebar,
     * Floating Window OEM, dsb) tampil DI ATAS Activity ini, Android akan
     * memanggil onWindowFocusChanged(false) — meski Activity tetap RESUMED
     * dan WidgetsBindingObserver di Flutter TIDAK mendeteksi perubahan apa
     * pun (karena ini bukan transisi lifecycle, hanya window focus loss).
     * Inilah mengapa floating app ColorOS/FuntouchOS lolos dari deteksi
     * AppLifecycleState semata.
     */
    private boolean hasWindowFocusFlag = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
        );

        getWindow().getDecorView().setFilterTouchesWhenObscured(true);
    }

    /**
     * Dipanggil Android setiap kali window ini KEHILANGAN atau MENDAPATKAN
     * fokus input — termasuk saat floating app/overlay/notification shade
     * tampil di atasnya. Ini jauh lebih sensitif daripada onPause/onResume
     * untuk mendeteksi overlay non-Activity (floating window OEM).
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        hasWindowFocusFlag = hasFocus;

        if (!hasFocus) {
            // Re-assert FLAG_SECURE + immersive setiap kali fokus hilang,
            // beberapa OEM launcher floating window mereset flag ini.
            getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
            );
            // Kirim event ke Flutter SEGERA — tanpa menunggu polling 1 detik.
            // Ini menangkap floating app yang mengambil fokus (keyboard terbuka,
            // dsb.) bahkan jika FLAG_NOT_FOCUSABLE tidak di-set.
            if (focusEventSink != null) {
                focusEventSink.success(false);
            }
        } else {
            // Fokus kembali ke Activity: beri tahu Flutter bahwa overlay sudah
            // ditutup (opsional, untuk keperluan logging / future use).
            if (focusEventSink != null) {
                focusEventSink.success(true);
            }
        }
    }

    @Override
    public void configureFlutterEngine(FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);

        new MethodChannel(
                flutterEngine.getDartExecutor().getBinaryMessenger(),
                CHANNEL
        ).setMethodCallHandler((call, result) -> {
            switch (call.method) {

                case "enableSecureFlag":
                    getWindow().setFlags(
                            WindowManager.LayoutParams.FLAG_SECURE,
                            WindowManager.LayoutParams.FLAG_SECURE
                    );
                    result.success(null);
                    break;

                case "disableSecureFlag":
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    result.success(null);
                    break;

                case "lockUi":
                    lockUi();
                    result.success(null);
                    break;

                case "unlockUi":
                    unlockUi();
                    result.success(null);
                    break;

                case "startLockTask":
                    try {
                        startLockTask();
                        result.success(null);
                    } catch (Exception e) {
                        result.error("LOCK_TASK_ERROR", e.getMessage(), null);
                    }
                    break;

                case "stopLockTask":
                    try {
                        stopLockTask();
                        result.success(null);
                    } catch (Exception e) {
                        result.error("STOP_LOCK_TASK_ERROR", e.getMessage(), null);
                    }
                    break;

                case "isScreenPinned":
                    result.success(isScreenPinned());
                    break;

                // ── BARU: status window focus, dipoll dari Dart tiap 1 detik ──
                // true jika TIDAK ada overlay/floating app di atas Activity ini.
                case "hasWindowFocus":
                    result.success(hasWindowFocusFlag);
                    break;

                default:
                    result.notImplemented();
                    break;
            }
        });

        // EventChannel: push notifikasi focus loss ke Flutter secara instan
        // (tidak bergantung pada polling 1 detik dari anti-cheat timer Dart).
        // Flutter subscribe melalui SecurityGuard.windowFocusStream saat boot.
        new EventChannel(
                flutterEngine.getDartExecutor().getBinaryMessenger(),
                FOCUS_CHANNEL
        ).setStreamHandler(new EventChannel.StreamHandler() {
            @Override
            public void onListen(Object arguments, EventChannel.EventSink events) {
                focusEventSink = events;
            }

            @Override
            public void onCancel(Object arguments) {
                focusEventSink = null;
            }
        });
    }

    private boolean isScreenPinned() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int state = am.getLockTaskModeState();
            return state == ActivityManager.LOCK_TASK_MODE_LOCKED
                    || state == ActivityManager.LOCK_TASK_MODE_PINNED;
        } else {
            //noinspection deprecation
            return am.isInLockTaskMode();
        }
    }

    private void lockUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
        );
    }

    private void unlockUi() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
    }
}