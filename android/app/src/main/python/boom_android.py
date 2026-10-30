"""Android 앱(MainActivity)에서 Boom 서버를 띄운다. Windows 판 `python app.py` 의 자리.

화면 파일(static/ · app.ico)은 APK assets 에서 내부 저장소로 풀린 폴더(root)를 쓴다.
PyInstaller 판과 같은 방식(sys._MEIPASS)으로 app.py 에 알려 준다.
"""
import os
import socket
import sys
import threading
import time
import types

PORTS = (8765, 8766, 8767, 8768)  # localStorage(토폴로지 배치 등)는 포트별로 따로라 되도록 같은 포트를 쓴다


def _free(port):
    with socket.socket() as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def start(root, files_dir):
    sys._MEIPASS = root
    os.environ.setdefault("LOCALAPPDATA", files_dir)  # creds_store 가 저장하는 곳
    # 창 모드(테두리 없는 창)는 Windows 전용이라 Android 에선 아무것도 안 하는 것으로 바꿔 끼운다
    sys.modules["window_mode"] = types.SimpleNamespace(AVAILABLE=False, set_mode=lambda *a, **k: (False, "win_only", ""))
    import app

    port = next((p for p in PORTS if _free(p)), 0)
    if not port:
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
    app.PORT, app.URL = port, f"http://127.0.0.1:{port}"
    threading.Thread(target=lambda: app.app.run(host="127.0.0.1", port=port, debug=False, threaded=True,
                                                use_reloader=False), daemon=True).start()
    for _ in range(100):
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
            return port
        except OSError:
            time.sleep(0.1)
    raise RuntimeError("server did not start")
