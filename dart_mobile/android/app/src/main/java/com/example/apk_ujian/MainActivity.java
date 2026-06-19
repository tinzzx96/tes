package com.example.apk_ujian;

import android.app.ActivityManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.MethodChannel;

public class MainActivity extends FlutterActivity {

    private static final String CHANNEL = "com.exam.poncol/security";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void configureFlutterEngine(FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);

        new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), CHANNEL)
                .setMethodCallHandler((call, result) -> {
                    switch (call.method) {

                        // ── Existing: FLAG_SECURE ──────────────────────────────
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

                        // ── Existing: Immersive UI ─────────────────────────────
                        case "lockUi":
                            applyImmersiveMode();
                            result.success(null);
                            break;

                        case "unlockUi":
                            getWindow().getDecorView()
                                    .setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                            result.success(null);
                            break;

                        // ── New: Screen Pinning ────────────────────────────────
                        case "startLockTask":
                            startLockTask();
                            getWindow().setFlags(
                                    WindowManager.LayoutParams.FLAG_SECURE,
                                    WindowManager.LayoutParams.FLAG_SECURE
                            );
                            applyImmersiveMode();
                            result.success(null);
                            break;

                        case "stopLockTask":
                            stopLockTask();
                            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                            result.success(null);
                            break;

                        case "isScreenPinned":
                            result.success(isScreenPinned());
                            break;

                        default:
                            result.notImplemented();
                    }
                });
    }

    private void applyImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    private boolean isScreenPinned() {
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        if (am == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
        }
        return am.isInLockTaskMode();
    }
}
