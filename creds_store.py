"""화면에서 입력한 액세스 키를 이 PC 에 기억한다.

Windows DPAPI(CryptProtectData)로 암호화해 %LOCALAPPDATA%\\Boom\\credentials.bin 에 저장하므로
같은 Windows 사용자 계정으로 로그인했을 때만 복호화된다 (파일을 복사해 가도 다른 PC/계정에선 못 읽음).
Android 앱에서는 Android 키 저장소의 키로 암호화한다 (android/.../Host.java).
"""
from __future__ import annotations

import ctypes
import json
import os
import sys
from pathlib import Path

PATH = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Boom" / "credentials.bin"
ANDROID = hasattr(sys, "getandroidapilevel")
CRYPTPROTECT_UI_FORBIDDEN = 0x1

if os.name == "nt":
    import ctypes.wintypes as wt

    class _Blob(ctypes.Structure):
        _fields_ = [("cbData", wt.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


def _call(fn, data: bytes) -> bytes:
    buf = ctypes.create_string_buffer(data, len(data))
    inp = _Blob(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    out = _Blob()
    if not fn(ctypes.byref(inp), None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(out)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(out.pbData, out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(ctypes.cast(out.pbData, ctypes.c_void_p))


def _host():
    from java import jclass  # Chaquopy
    return jclass("com.boom.app.Host")


def _seal(data: bytes) -> bytes:
    if ANDROID:
        return str(_host().seal(data.decode())).encode()
    return _call(ctypes.windll.crypt32.CryptProtectData, data)


def _open(data: bytes) -> bytes:
    if ANDROID:
        try:
            return str(_host().open(data.decode())).encode()
        except Exception as e:  # 키가 없어졌거나(앱 재설치) 파일이 깨짐
            raise ValueError(str(e)) from e
    return _call(ctypes.windll.crypt32.CryptUnprotectData, data)


def available() -> bool:
    return os.name == "nt" or ANDROID


def save(creds: dict):
    PATH.parent.mkdir(parents=True, exist_ok=True)
    PATH.write_bytes(_seal(json.dumps(creds).encode()))


def load() -> dict | None:
    if not available() or not PATH.exists():
        return None
    try:
        return json.loads(_open(PATH.read_bytes()))
    except (OSError, ValueError):
        return None


def clear():
    PATH.unlink(missing_ok=True)
