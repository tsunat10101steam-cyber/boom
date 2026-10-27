"""Boom 앱 창을 '테두리 없는 창(borderless windowed)'으로 바꾸고 되돌린다. Windows 전용.

브라우저 전체화면(Fullscreen API)은 'Esc 를 눌러 종료' 안내가 뜨고 Esc 로 풀려 버리므로,
게임처럼 창의 제목 표시줄/테두리를 OS 수준에서 없애고 모니터 전체(작업 표시줄 포함)를 덮는다.
"""
from __future__ import annotations

import ctypes
import ctypes.wintypes as wt
import os
import time

AVAILABLE = os.name == "nt"

GWL_STYLE = -16
WS_CAPTION, WS_THICKFRAME, WS_SYSMENU = 0x00C00000, 0x00040000, 0x00080000
WS_MINIMIZEBOX, WS_MAXIMIZEBOX = 0x00020000, 0x00010000
FRAME_BITS = WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX
# 게임의 테두리 없는 창과 같은 POPUP 스타일. 일반 창은 OS 가 최대 크기를 '화면+테두리'로 묶어서
# 제목 표시줄을 화면 밖으로 밀어낼 만큼 키우지 못하고, 그러면 화면을 다 덮지 못해 작업 표시줄이 남는다.
WS_POPUP = 0x80000000
SWP_NOSIZE, SWP_NOMOVE, SWP_NOZORDER, SWP_FRAMECHANGED = 0x0001, 0x0002, 0x0004, 0x0020
SWP_SHOWWINDOW, SWP_NOOWNERZORDER = 0x0040, 0x0200
SW_RESTORE, MONITOR_DEFAULTTONEAREST = 9, 2


class MONITORINFO(ctypes.Structure):
    _fields_ = [("cbSize", wt.DWORD), ("rcMonitor", wt.RECT), ("rcWork", wt.RECT), ("dwFlags", wt.DWORD)]


class WINDOWPLACEMENT(ctypes.Structure):
    _fields_ = [("length", wt.UINT), ("flags", wt.UINT), ("showCmd", wt.UINT), ("ptMinPosition", wt.POINT),
                ("ptMaxPosition", wt.POINT), ("rcNormalPosition", wt.RECT)]


_saved: dict[int, tuple[int, WINDOWPLACEMENT]] = {}  # hwnd -> (원래 style, 원래 위치)
_user32 = None


def _u32():
    global _user32
    if _user32 is None:
        u = ctypes.windll.user32
        u.GetWindowLongPtrW.restype = ctypes.c_ssize_t
        u.GetWindowLongPtrW.argtypes = [wt.HWND, ctypes.c_int]
        u.SetWindowLongPtrW.restype = ctypes.c_ssize_t
        u.SetWindowLongPtrW.argtypes = [wt.HWND, ctypes.c_int, ctypes.c_ssize_t]
        u.GetForegroundWindow.restype = wt.HWND
        u.MonitorFromWindow.restype = wt.HANDLE
        u.SetWindowPos.argtypes = [wt.HWND, wt.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wt.UINT]
        # 모니터 크기를 실제 픽셀로 받으려면 DPI 인식이 필요하다 (안 하면 125%/150% 배율에서 창이 덜 덮음)
        try:
            u.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))  # PER_MONITOR_AWARE_V2
        except (AttributeError, OSError):
            u.SetProcessDPIAware()
        _user32 = u
    return _user32


def find_window(title, wait=1.5):
    """제목이 정확히 title 인 Edge/Chrome 창. 페이지가 방금 바꾼 제목이 반영될 때까지 잠깐 기다린다.

    title 은 요청한 페이지가 잠깐 붙이는 일회용 태그라서 Boom 창이 여러 개여도 그 창 하나만 잡힌다.
    """
    deadline = time.time() + wait
    while True:
        hwnd = _find_once(title)
        if hwnd or time.time() > deadline:
            return hwnd
        time.sleep(0.05)


def _find_once(title):
    u = _u32()
    found = []

    @ctypes.WINFUNCTYPE(wt.BOOL, wt.HWND, wt.LPARAM)
    def cb(hwnd, _):
        if not u.IsWindowVisible(hwnd):
            return True
        cls = ctypes.create_unicode_buffer(64)
        u.GetClassNameW(hwnd, cls, 64)
        if cls.value == "Chrome_WidgetWin_1":
            buf = ctypes.create_unicode_buffer(256)
            u.GetWindowTextW(hwnd, buf, 256)
            if title in buf.value:
                found.append(hwnd)
        return True

    u.EnumWindows(cb, 0)
    return found[0] if found else None


def borderless(hwnd, crop=(0, 0, 0, 0)):
    """crop = (왼, 위, 오른, 아래) 물리 픽셀. Edge 앱 창은 제목 표시줄을 OS 가 아니라 자기가 그리므로
    스타일만 빼면 그 줄이 남는다 → 그만큼 창을 모니터 밖으로 키워서 화면에 안 보이게 한다."""
    u = _u32()
    if hwnd not in _saved:
        wp = WINDOWPLACEMENT()
        wp.length = ctypes.sizeof(wp)
        u.GetWindowPlacement(hwnd, ctypes.byref(wp))
        _saved[hwnd] = (u.GetWindowLongPtrW(hwnd, GWL_STYLE), wp)
    style = _saved[hwnd][0]
    if u.IsZoomed(hwnd):
        u.ShowWindow(hwnd, SW_RESTORE)  # 최대화 상태에선 크기 지정이 안 먹는다
    u.SetWindowLongPtrW(hwnd, GWL_STYLE, (style & ~FRAME_BITS) | WS_POPUP)
    mi = MONITORINFO()
    mi.cbSize = ctypes.sizeof(mi)
    u.GetMonitorInfoW(u.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), ctypes.byref(mi))
    r = mi.rcMonitor
    cl, ct, cr, cb = crop
    u.SetWindowPos(hwnd, None, r.left - cl, r.top - ct, r.right - r.left + cl + cr, r.bottom - r.top + ct + cb,
                   SWP_FRAMECHANGED | SWP_NOOWNERZORDER | SWP_SHOWWINDOW)
    u.SetForegroundWindow(hwnd)


def restore(hwnd):
    u = _u32()
    saved = _saved.pop(hwnd, None)
    if not saved:
        return
    style, wp = saved
    u.SetWindowLongPtrW(hwnd, GWL_STYLE, style)
    u.SetWindowPlacement(hwnd, ctypes.byref(wp))
    u.SetWindowPos(hwnd, None, 0, 0, 0, 0,
                   SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER)


def windows_of(pid):
    """그 프로세스의 보이는 Edge/Chrome 최상위 창들."""
    u = _u32()
    found = []

    @ctypes.WINFUNCTYPE(wt.BOOL, wt.HWND, wt.LPARAM)
    def cb(hwnd, _):
        p = wt.DWORD()
        u.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
        if p.value == pid and u.IsWindowVisible(hwnd):
            cls = ctypes.create_unicode_buffer(64)
            u.GetClassNameW(hwnd, cls, 64)
            if cls.value == "Chrome_WidgetWin_1" and u.GetWindowTextLengthW(hwnd):
                found.append(hwnd)
        return True

    u.EnumWindows(cb, 0)
    return found


def set_mode(mode, title, crop=(0, 0, 0, 0), browser_pid=None):
    """mode: 'borderless' | 'normal'. (성공 여부, 실패 이유 코드, 자세한 내용) 반환.

    창은 페이지가 붙인 일회용 제목 태그로 찾고, 안 되면 Boom 이 띄운 Edge 프로세스의 창이 하나뿐일 때 그 창을 쓴다.
    """
    if not AVAILABLE:
        return False, "win_only", ""
    try:
        hwnd = find_window(title) if title else None
        if not hwnd and browser_pid:
            wins = windows_of(browser_pid)
            hwnd = wins[0] if len(wins) == 1 else None
        if not hwnd:
            return False, "no_window", ""
        borderless(hwnd, crop) if mode == "borderless" else restore(hwnd)
        return True, "", ""
    except OSError as e:
        return False, "win_failed", str(e)
