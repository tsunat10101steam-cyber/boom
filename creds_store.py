"""화면에서 입력한 액세스 키를 이 PC 에 기억한다.

Windows DPAPI(CryptProtectData)로 암호화해 %LOCALAPPDATA%\\Boom\\credentials.bin 에 저장하므로
같은 Windows 사용자 계정으로 로그인했을 때만 복호화된다 (파일을 복사해 가도 다른 PC/계정에선 못 읽음).
"""
from __future__ import annotations

import ctypes
import ctypes.wintypes as wt
import json
import os
from pathlib import Path

PATH = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Boom" / "credentials.bin"
CRYPTPROTECT_UI_FORBIDDEN = 0x1


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


def available() -> bool:
    return os.name == "nt"


def save(creds: dict):
    PATH.parent.mkdir(parents=True, exist_ok=True)
    PATH.write_bytes(_call(ctypes.windll.crypt32.CryptProtectData, json.dumps(creds).encode()))


def load() -> dict | None:
    if not available() or not PATH.exists():
        return None
    try:
        return json.loads(_call(ctypes.windll.crypt32.CryptUnprotectData, PATH.read_bytes()))
    except (OSError, ValueError):
        return None


def clear():
    PATH.unlink(missing_ok=True)
