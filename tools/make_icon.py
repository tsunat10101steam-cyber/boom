"""static/icon.svg → static/icon-512.png, static/icon-192.png, app.ico

Edge(또는 Chrome) headless 로 SVG 를 투명 배경 PNG 로 렌더링한 뒤 Pillow 로 ICO 를 만든다.
아이콘을 수정했을 때만 다시 실행하면 된다:  .venv\\Scripts\\python tools\\make_icon.py
"""
import os
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "static" / "icon.svg"
BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
]


def render(size=1024):
    exe = next(b for b in BROWSERS if os.path.exists(b))
    with tempfile.TemporaryDirectory() as tmp:
        html = Path(tmp) / "i.html"
        html.write_text(
            f'<html><body style="margin:0;background:transparent">'
            f'<img src="{SVG.as_uri()}" width="{size}" height="{size}"></body></html>',
            encoding="utf-8")
        out = Path(tmp) / "o.png"
        subprocess.run([exe, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--default-background-color=00000000", f"--window-size={size},{size}",
                        f"--user-data-dir={tmp}\\ud", f"--screenshot={out}", html.as_uri()],
                       check=True, timeout=60, capture_output=True)
        return Image.open(out).convert("RGBA").copy()


def main():
    img = render()
    img.resize((512, 512), Image.LANCZOS).save(ROOT / "static" / "icon-512.png")
    img.resize((192, 192), Image.LANCZOS).save(ROOT / "static" / "icon-192.png")
    img.save(ROOT / "app.ico", sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    print("ok")


if __name__ == "__main__":
    main()
