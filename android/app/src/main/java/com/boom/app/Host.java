package com.boom.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** 파이썬(creds_store · app.py)이 부르는 Android 기능. Windows 판의 DPAPI · 브라우저 열기 자리. */
public final class Host {
    private static final String KEY_ALIAS = "boom-credentials";
    private static Context app;

    private Host() {}

    static void init(Context context) {
        app = context.getApplicationContext();
    }

    /** Android 키 저장소의 AES 키로 암호화. 키는 기기 밖으로 꺼낼 수 없어서, 파일을 복사해 가도 다른 기기에선 못 읽는다. */
    public static String seal(String plain) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key());
        byte[] iv = c.getIV();
        byte[] body = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        ByteBuffer out = ByteBuffer.allocate(1 + iv.length + body.length);
        out.put((byte) iv.length).put(iv).put(body);
        return Base64.encodeToString(out.array(), Base64.NO_WRAP);
    }

    public static String open(String sealed) throws Exception {
        ByteBuffer in = ByteBuffer.wrap(Base64.decode(sealed, Base64.NO_WRAP));
        byte[] iv = new byte[in.get()];
        in.get(iv);
        byte[] body = new byte[in.remaining()];
        in.get(body);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        return new String(c.doFinal(body), StandardCharsets.UTF_8);
    }

    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return g.generateKey();
    }

    /** 기본 브라우저로 연다 (새 버전 APK 내려받기 등). */
    public static void openUrl(String url) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        app.startActivity(i);
    }
}
