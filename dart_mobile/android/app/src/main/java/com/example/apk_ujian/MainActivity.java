package com.example.apk_ujian;

import android.app.ActivityManager;
import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Process;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.MethodChannel;

public class MainActivity extends FlutterActivity {

    private static final String CHANNEL = "com.exam.poncol/security";

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

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        hasWindowFocusFlag = hasFocus;

        if (!hasFocus) {
            getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
            );
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

                case "hasWindowFocus":
                    result.success(hasWindowFocusFlag);
                    break;

                // ── BARU: cek izin Usage Access ──────────────────────────────
                case "hasUsageStatsPermission":
                    result.success(hasUsageStatsPermission());
                    break;

                // ── BARU: buka halaman Settings untuk grant Usage Access ────
                case "openUsageAccessSettings":
                    openUsageAccessSettings();
                    result.success(null);
                    break;

                // ── BARU: cek apakah app LAIN (selain kita) baru saja pindah
                // ke foreground dalam beberapa detik terakhir. Ini sinyal kuat
                // bahwa floating app/browser pihak ketiga sedang dipakai aktif
                // di atas layar ujian.
                case "isOtherAppForeground":
                    result.success(isOtherAppRecentlyForeground());
                    break;

                // ── BARU: buka halaman pengaturan WiFi sistem Android ───────
                case "openWifiSettings":
                    try {
                        Intent intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        result.success(null);
                    } catch (Exception e) {
                        result.error("OPEN_WIFI_SETTINGS_ERROR", e.getMessage(), null);
                    }
                    break;

                // ── BARU: buka halaman pengaturan jaringan/data seluler ─────
                case "openNetworkSettings":
                    try {
                        Intent intent;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            intent = new Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY);
                        } else {
                            intent = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
                        }
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        result.success(null);
                    } catch (Exception e) {
                        result.error("OPEN_NETWORK_SETTINGS_ERROR", e.getMessage(), null);
                    }
                    break;

                default:
                    result.notImplemented();
                    break;
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Usage Access — deteksi app lain yang baru aktif di foreground
    // ─────────────────────────────────────────────────────────────────────

    private boolean hasUsageStatsPermission() {
        try {
            AppOpsManager appOps =
                    (AppOpsManager) getSystemService(Context.APP_OPS_SERVICE);
            int mode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mode = appOps.unsafeCheckOpNoThrow(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(),
                        getPackageName()
                );
            } else {
                //noinspection deprecation
                mode = appOps.checkOpNoThrow(
                        AppOpsManager.OPSTR_GET_USAGE_STATS,
                        Process.myUid(),
                        getPackageName()
                );
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    private void openUsageAccessSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    /**
     * Mengecek apakah ada package SELAIN kita yang menghasilkan event
     * MOVE_TO_FOREGROUND dalam 4 detik terakhir. Floating window/overlay app
     * (TYPE_APPLICATION_OVERLAY) TIDAK selalu memicu event ini secara
     * konsisten di semua OEM — sehingga ini dipakai sebagai sinyal TAMBAHAN,
     * bukan satu-satunya sumber kebenaran. Dikombinasikan dengan
     * onWindowFocusChanged di sisi Dart untuk menaikkan akurasi deteksi.
     */
    private boolean isOtherAppRecentlyForeground() {
        if (!hasUsageStatsPermission()) return false;

        try {
            UsageStatsManager usm =
                    (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return false;

            long now = System.currentTimeMillis();
            long windowStart = now - 4000; // 4 detik terakhir

            UsageEvents events = usm.queryEvents(windowStart, now);
            UsageEvents.Event event = new UsageEvents.Event();
            String myPackage = getPackageName();

            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                boolean isForegroundEvent =
                        event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND
                                || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                                && event.getEventType() == UsageEvents.Event.ACTIVITY_RESUMED);

                if (isForegroundEvent && !myPackage.equals(event.getPackageName())) {
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────

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