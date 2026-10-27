"""GitHub 릴리스로 업데이트 확인 / 자동 설치.

릴리스에는 Boom-vX.Y.Z.zip (PyInstaller 로 만든 Boom 폴더) 이 붙는다 (.github/workflows/release.yml).
설치: zip 을 받아 풀어 두고 → 작은 PowerShell 스크립트가 Boom 이 꺼지길 기다렸다가
설치 폴더를 새 파일로 바꾸고 → Boom.exe 를 다시 실행한다.
"""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

from version import REPO, __version__

API = f"https://api.github.com/repos/{REPO}/releases/latest"
RELEASES_URL = f"https://github.com/{REPO}/releases"
_cache = {"t": 0.0, "data": None}


def _ver(s):
    parts = (s or "0").lstrip("vV").split("-")[0].split(".")
    nums = [int(p) if p.isdigit() else 0 for p in parts]
    return tuple(nums + [0] * (3 - len(nums)))


def _get(url, timeout=10):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "Boom"})
    return urllib.request.urlopen(req, timeout=timeout)


def check(force=False):
    """최신 릴리스 확인 (1시간 캐시). GitHub API 비로그인 한도는 시간당 60회."""
    if not force and _cache["data"] and time.time() - _cache["t"] < 3600:
        return _cache["data"]
    data = {"current": __version__, "available": False, "url": RELEASES_URL}
    try:
        with _get(API) as r:
            rel = json.load(r)
        asset = next((a for a in rel.get("assets", []) if a["name"].lower().endswith(".zip")), None)
        latest = rel.get("tag_name", "").lstrip("vV")
        data.update(latest=latest, notes=rel.get("body") or "", url=rel.get("html_url") or RELEASES_URL,
                    published=rel.get("published_at"), asset=asset["browser_download_url"] if asset else None,
                    available=bool(asset) and _ver(latest) > _ver(__version__))
    except urllib.error.HTTPError as e:
        data["error"] = "아직 릴리스가 없습니다" if e.code == 404 else f"GitHub 응답 {e.code}"
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        data["error"] = f"업데이트 확인 실패: {e}"
    _cache.update(t=time.time(), data=data)
    return data


def install_dir():
    """지금 실행 중인 Boom.exe 폴더. 개발 모드(python app.py)면 None."""
    if not getattr(sys, "frozen", False) or os.name != "nt":
        return None
    d = Path(sys.executable).resolve().parent
    # 엉뚱한 폴더를 통째로 덮어쓰지 않도록, Boom 설치 폴더 모양일 때만
    return d if (d / "Boom.exe").exists() and (d / "_internal").is_dir() else None


def download(asset_url):
    """릴리스 zip 을 받아 임시 폴더에 풀고, Boom.exe 가 든 폴더 경로를 돌려준다."""
    tmp = Path(tempfile.mkdtemp(prefix="boom-update-"))
    zpath = tmp / "Boom.zip"
    with _get(asset_url, timeout=60) as r, open(zpath, "wb") as f:
        while chunk := r.read(1 << 16):
            f.write(chunk)
    with zipfile.ZipFile(zpath) as z:
        for name in z.namelist():  # zip 안의 ../ 경로로 임시 폴더 밖에 쓰는 것 방지
            if name.startswith(("/", "\\")) or ".." in Path(name).parts:
                raise ValueError("업데이트 파일 형식이 올바르지 않습니다")
        z.extractall(tmp / "x")
    exe = next((p for p in (tmp / "x").rglob("Boom.exe")), None)
    if not exe or not (exe.parent / "_internal").is_dir():
        raise ValueError("업데이트 파일에 Boom.exe 가 없습니다")
    return tmp, exe.parent


def launch_installer(tmp, src, dest, pid, relaunch=True):
    """pid(지금 Boom)가 꺼지면 dest 를 src 로 바꾸고 다시 실행하는 숨은 PowerShell 을 띄운다."""
    script = f"""
$ErrorActionPreference = 'SilentlyContinue'
Wait-Process -Id {int(pid)} -Timeout 90
Start-Sleep -Milliseconds 700
robocopy "{src}" "{dest}" /mir /njh /njs /nfl /ndl /r:10 /w:1 | Out-Null
{f'Start-Process "{dest}{os.sep}Boom.exe"' if relaunch else ''}
Remove-Item -Recurse -Force "{tmp}"
"""
    enc = base64.b64encode(script.encode("utf-16-le")).decode()
    flags = 0x00000008 | 0x00000200 | 0x08000000  # DETACHED_PROCESS | NEW_PROCESS_GROUP | NO_WINDOW
    return subprocess.Popen(["powershell", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden",
                             "-EncodedCommand", enc], creationflags=flags, close_fds=True)
