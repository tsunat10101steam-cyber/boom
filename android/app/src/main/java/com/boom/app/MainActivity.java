package com.boom.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import com.chaquo.python.PyObject;
import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Boom 의 Flask 서버를 이 앱 안의 파이썬으로 띄우고(127.0.0.1), 화면은 WebView 로 보여 준다.
 * Windows 판에서 Edge 앱 창이 하던 일을 WebView 가 한다.
 */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Host.init(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        FrameLayout box = new FrameLayout(this);
        box.addView(web);
        setContentView(box);
        // 화면이 상태 표시줄 · 내비게이션 바 · 키보드 밑으로 들어가지 않게 (WebView 자체 padding 은 내용을 밀지 않는다)
        box.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets b = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                v.setPadding(b.left, b.top, b.right, b.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);  // 토폴로지 배치 · 메모 · 설정은 localStorage 에 둔다
        s.setTextZoom(100);
        s.setSupportMultipleWindows(false);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        web.setWebChromeClient(new WebChromeClient());  // alert · confirm · prompt
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("127.0.0.1".equals(u.getHost())) return false;
                Host.openUrl(u.toString());  // GitHub · AWS 콘솔 링크 등은 브라우저로
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "BoomAndroid");
        web.loadData(splash("Boom 시작 중…"), "text/html; charset=utf-8", null);

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::back);
        }
        new Thread(this::startServer, "boom-server").start();
    }

    private void startServer() {
        try {
            File root = unpackAssets();
            if (!Python.isStarted()) Python.start(new AndroidPlatform(this));
            PyObject port = Python.getInstance().getModule("boom_android")
                    .callAttr("start", root.getAbsolutePath(), getFilesDir().getAbsolutePath());
            String url = "http://127.0.0.1:" + port.toInt() + "/";
            runOnUiThread(() -> web.loadUrl(url));
        } catch (Throwable t) {
            String msg = String.valueOf(t.getMessage()).replace("&", "&amp;").replace("<", "&lt;");
            runOnUiThread(() -> web.loadData(splash("시작하지 못했습니다<br><small>" + msg + "</small>"),
                    "text/html; charset=utf-8", null));
        }
    }

    /** assets/boom (static/ · app.ico) 을 내부 저장소로 푼다. 앱이 업데이트되면 다시 푼다. */
    private File unpackAssets() throws Exception {
        long stamp = getPackageManager().getPackageInfo(getPackageName(), 0).lastUpdateTime;
        File root = new File(getFilesDir(), "boom");
        File mark = new File(root, ".stamp");
        if (mark.exists() && Long.toString(stamp).equals(new String(java.nio.file.Files.readAllBytes(mark.toPath())))) return root;
        deleteTree(root);
        copyAsset("boom", root);
        try (OutputStream o = new FileOutputStream(mark)) { o.write(Long.toString(stamp).getBytes()); }
        return root;
    }

    private void copyAsset(String path, File dest) throws Exception {
        String[] kids = getAssets().list(path);
        if (kids != null && kids.length > 0) {
            dest.mkdirs();
            for (String k : kids) copyAsset(path + "/" + k, new File(dest, k));
            return;
        }
        try (InputStream in = getAssets().open(path); OutputStream out = new FileOutputStream(dest)) {
            byte[] buf = new byte[65536];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        }
    }

    private static void deleteTree(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        f.delete();
    }

    private static String splash(String text) {
        return "<html><body style=\"margin:0;height:100vh;display:grid;place-items:center;font-family:sans-serif;"
                + "color:#5d5677;text-align:center\">" + text + "</body></html>";
    }

    /** 뒤로 가기: 열린 대화 상자 · 토폴로지는 화면(mobile.js)이 먼저 닫고, 더 닫을 게 없으면 앱을 뒤로 보낸다. */
    private void back() {
        web.evaluateJavascript("window.boomBack ? boomBack() : false", r -> {
            if (!"true".equals(r)) moveTaskToBack(true);
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {  // Android 12 이하
        back();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    /** 화면의 파일 저장(키 페어 .pem · 토폴로지 PNG/SVG)을 '다운로드' 폴더로. WebView 는 a.download 를 처리하지 않는다. */
    private final class Bridge {
        @JavascriptInterface
        public String saveFile(String name, String mime, String base64) {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "";
                try (OutputStream o = getContentResolver().openOutputStream(uri)) {
                    o.write(Base64.decode(base64, Base64.DEFAULT));
                }
                return name;
            } catch (Exception e) {
                return "";
            }
        }
    }
}
