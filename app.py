"""Boom — 로컬 대시보드 앱.

    python app.py             →  Edge/Chrome 앱 창으로 실행 (창을 닫으면 서버도 종료)
    python app.py --browser   →  기본 브라우저 탭으로 실행 (서버는 계속 실행)

자격 증명은 메모리에만 보관되며 이 프로세스가 종료되면 사라진다.
"""
from __future__ import annotations

import ipaddress
import os
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from pathlib import Path

from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError, ProfileNotFound
from flask import Flask, jsonify, request, send_from_directory

import aws_resources as aws
import creds_store
import updater
import window_mode
from version import REPO, __version__

# PyInstaller 로 묶은 exe 에서는 static/app.ico 가 임시 압축해제 폴더(_MEIPASS)에 있다
ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
STATIC_VER = str(int(time.time()))
if sys.stdout is None:  # 콘솔 없는 실행(pythonw / --windowed exe)
    sys.stdout = sys.stderr = open(os.devnull, "w")
app = Flask(__name__, static_folder=str(ROOT / "static"))
# 앱 창(Edge 프로필)이 예전 버전 js/css 를 캐시해 두고 쓰지 않도록 매번 재검증
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

STATE = {
    "session": None,
    "identity": None,
    "regions": [],
    "items": {},     # key -> item (마지막 스캔 결과)
    "scan": None,    # 진행 중 스캔 상태
    "costs": None,   # (timestamp, data)
    "last_beat": None,
}
JOBS: dict[str, dict] = {}
LOCK = threading.Lock()


def _public(item):
    return {k: v for k, v in item.items() if k != "extra"}


def fail(code, status=400, **params):
    """오류 응답. 문장 대신 코드와 값만 보내고 화면(i18n.js)이 사용자 언어로 바꾼다."""
    return jsonify(error=code, params=params), status


def _require_session():
    if not STATE["session"]:
        return fail("need_connect")
    return None


@app.get("/")
def index():
    # js/css 주소에 실행마다 바뀌는 버전을 붙여서, 업데이트 후 앱 창이 예전 파일을 캐시에서 꺼내 쓰지 않게 한다
    html = (Path(app.static_folder) / "index.html").read_text(encoding="utf-8")
    for name in ("topology.js", "topology.css", "i18n.js"):
        html = html.replace(f'/static/{name}"', f'/static/{name}?v={STATIC_VER}"')
    resp = app.response_class(html, mimetype="text/html")
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.get("/favicon.ico")
def favicon():
    return send_from_directory(ROOT, "app.ico")


@app.get("/manifest.json")
def manifest():
    return jsonify(name="Boom", short_name="Boom", start_url="/", display="standalone",
                   background_color="#0e0f1a", theme_color="#0e0f1a",
                   icons=[{"src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png"},
                          {"src": "/static/icon.svg", "sizes": "any", "type": "image/svg+xml"}])


@app.get("/api/profiles")
def profiles():
    return jsonify(profiles=aws.available_profiles(), saved_keys=creds_store.load() is not None,
                   can_remember=creds_store.available())


@app.post("/api/connect")
def connect():
    body = request.get_json(force=True)
    keys = {k: (body.get(k) or "").strip() for k in ("access_key", "secret_key", "session_token")}
    if body.get("use_saved"):
        keys = creds_store.load() or {}
        if not keys:
            return fail("no_saved_keys")
    try:
        sess = aws.make_session(profile=body.get("profile"), **keys)
        ident = aws.whoami(sess)
        regions = aws.list_regions(sess)
    except (ClientError, BotoCoreError, NoCredentialsError, ProfileNotFound) as e:
        return fail("connect_failed", detail=str(e))
    if keys.get("access_key") and body.get("remember") and creds_store.available():
        creds_store.save(keys)
    STATE.update(session=sess, identity=ident, regions=regions, items={}, costs=None)
    return jsonify(identity=ident, regions=regions, types=aws.TYPE_ORDER)


@app.post("/api/disconnect")
def disconnect():
    """연결 해제 = 이 PC 에 기억한 키도 삭제."""
    creds_store.clear()
    STATE.update(session=None, identity=None, regions=[], items={}, scan=None, costs=None)
    return jsonify(ok=True)


@app.post("/api/scan")
def scan():
    if (r := _require_session()):
        return r
    body = request.get_json(force=True)
    regions = body.get("regions") or STATE["regions"]
    types = body.get("types") or aws.TYPE_ORDER
    with LOCK:
        if STATE["scan"] and STATE["scan"]["status"] == "running":
            return fail("scan_running", 409)
        STATE["scan"] = {"status": "running", "done": 0, "total": 0, "waiting": [], "started": time.time()}

    def progress(done, total, waiting):
        STATE["scan"].update(done=done, total=total, waiting=waiting)

    def run():
        try:
            items, warnings = aws.scan_all(STATE["session"], regions, types, progress)
            STATE["items"] = {i["key"]: i for i in items}
            STATE["scan"].update(status="done", warnings=warnings)
        except Exception as e:  # noqa: BLE001 — UI 에 그대로 보여준다
            STATE["scan"].update(status="error", error=str(e))

    threading.Thread(target=run, daemon=True).start()
    return jsonify(ok=True)


@app.get("/api/scan")
def scan_status():
    s = STATE["scan"] or {"status": "idle"}
    out = dict(s)
    if s.get("status") == "done":
        out["items"] = [_public(i) for i in STATE["items"].values()]
    return jsonify(out)


@app.post("/api/topology")
def topology():
    if (r := _require_session()):
        return r
    body = request.get_json(force=True)
    regions = body.get("regions") or STATE["regions"]
    return jsonify(aws.scan_topology(STATE["session"], regions))


@app.post("/api/creator")
def creator():
    """리소스를 누가 만들었는지 CloudTrail 에서 조회. 표에선 key, 토폴로지에선 region/id/type 으로 요청."""
    if (r := _require_session()):
        return r
    b = request.get_json(force=True)
    item = STATE["items"].get(b.get("key") or "")
    if item:
        region, rid, rtype = item["region"], item["id"], item["type"]
        alt = [item["extra"]["arn"]] if item["extra"].get("arn") else []
    else:
        region, rid, rtype, alt = b.get("region"), b.get("id"), b.get("type"), []
    if region == "global" or region not in STATE["regions"] or not rid:
        return fail("bad_resource")
    try:
        return jsonify(aws.who_created(STATE["session"], region, rid, rtype, alt))
    except (ClientError, BotoCoreError) as e:
        return fail("aws", detail=aws._err(e))


INSTANCE_TYPES = ("t3.micro", "t3.small", "t3.medium", "t3.large", "m5.large")


def _cidr(text, lo, hi):
    try:
        net = ipaddress.ip_network((text or "").strip(), strict=True)
    except ValueError:
        raise aws.BoomError("bad_cidr") from None
    if net.version != 4 or not lo <= net.prefixlen <= hi:
        raise aws.BoomError("cidr_range", lo=lo, hi=hi)
    return str(net)


@app.post("/api/create")
def create():
    """토폴로지 우클릭 메뉴에서 VPC / 서브넷 / IGW / 인스턴스 만들기."""
    if (r := _require_session()):
        return r
    b = request.get_json(force=True)
    kind, region = b.get("kind"), b.get("region")
    if region not in STATE["regions"]:
        return fail("bad_region")
    name = (b.get("name") or "").strip()[:128]
    s = STATE["session"]
    try:
        if kind == "vpc":
            res = aws.create_vpc(s, region, _cidr(b.get("cidr"), 16, 28), name, bool(b.get("with_igw")))
        elif kind == "subnet":
            res = aws.create_subnet(s, region, b["vpc"], b["az"], _cidr(b.get("cidr"), 16, 28), name)
        elif kind == "igw":
            res = aws.create_igw(s, region, b["vpc"], name)
        elif kind == "instance":
            if b.get("instance_type") not in INSTANCE_TYPES:
                return fail("bad_type")
            res = aws.launch_instance(s, region, b["subnet"], b["instance_type"], name, bool(b.get("public_ip")))
        else:
            return fail("bad_action")
    except aws.BoomError as e:
        return fail(e.code, **e.params)
    except KeyError as e:
        return fail("missing", field=str(e))
    except (ClientError, BotoCoreError) as e:
        return fail("aws", detail=aws._err(e))
    return jsonify(res)


@app.get("/api/costs")
def costs():
    """비용은 1시간 캐시. ?refresh=1 이면 강제 갱신 (CE API 요청당 $0.01)."""
    if (r := _require_session()):
        return r
    cached = STATE.get("costs")
    if cached and not request.args.get("refresh") and time.time() - cached[0] < 3600:
        return jsonify(cached[1])
    try:
        data = aws.get_costs(STATE["session"])
    except (ClientError, BotoCoreError) as e:
        return fail("aws", detail=aws._err(e))
    STATE["costs"] = (time.time(), data)
    return jsonify(data)


@app.get("/api/version")
def version():
    return jsonify(version=__version__, repo=f"https://github.com/{REPO}")


@app.get("/api/update")
def update_check():
    return jsonify(updater.check(force=bool(request.args.get("force"))))


@app.post("/api/update")
def update_apply():
    """업데이트 진행 창(초록 막대)을 띄우고 Boom 은 종료한다. 내려받기·설치·재실행은 그 창이 한다."""
    info = updater.check()
    if not info.get("available") or not info.get("asset"):
        return fail("no_update")
    dest = updater.install_dir()
    if not dest:
        return fail("dev_mode", url=info["url"])
    if _busy():
        return fail("busy", 409)
    labels = (request.get_json(silent=True) or {}).get("labels") or {}
    try:
        updater.launch_update_window(info["asset"], info.get("kind", "zip"), str(dest), os.getpid(), labels)
    except OSError as e:
        return fail("download_failed", detail=str(e))
    threading.Timer(1.0, lambda: os._exit(0)).start()  # 대시보드 창이 닫힐 시간을 주고 종료 → 진행 창이 설치
    return jsonify(ok=True, version=info["latest"])


@app.post("/api/window")
def window():
    """토폴로지 진입/종료 시 앱 창을 테두리 없는 창 ↔ 원래 창으로."""
    body = request.get_json(force=True)
    mode = body.get("mode")
    if mode not in ("borderless", "normal"):
        return fail("bad_mode")
    c = body.get("crop") or {}
    crop = tuple(max(0, min(120, int(c.get(k, 0)))) for k in ("left", "top", "right", "bottom"))
    ok, reason, detail = window_mode.set_mode(mode, body.get("title"), crop, STATE.get("browser_pid"))
    return jsonify(ok=ok, reason=reason, detail=detail)


@app.post("/api/heartbeat")
def heartbeat():
    STATE["last_beat"] = time.time()
    return jsonify(ok=True)


@app.post("/api/delete")
def delete():
    if (r := _require_session()):
        return r
    body = request.get_json(force=True)
    dry_run = bool(body.get("dry_run", True))
    if not dry_run and body.get("confirm") != STATE["identity"]["account"]:
        return fail("confirm_mismatch")
    items = [STATE["items"][k] for k in body.get("keys", []) if k in STATE["items"]]
    if not items:
        return fail("nothing_selected")

    job_id = uuid.uuid4().hex[:8]
    job = {"status": "running", "logs": [], "results": {}}
    JOBS[job_id] = job
    opts = {"dry_run": dry_run,
            "ec2_mode": body.get("ec2_mode", "terminate"),
            "rds_snapshot": bool(body.get("rds_snapshot"))}

    def run():
        # 로그 한 줄 = {"k": 메시지 코드, "p": 값}. 화면이 사용자 언어로 문장을 만든다.
        def log(k, **p):
            job["logs"].append({"k": k, "p": p})
        log("start", dry=dry_run, n=len(items), account=STATE["identity"]["account"])
        try:
            res = aws.delete_items(STATE["session"], items, opts, log)
            job["results"] = res
            ok = sum(1 for v in res.values() if v["ok"])
            log("done", ok=ok, fail=len(res) - ok)
            if not dry_run:
                for k, v in res.items():
                    if v["ok"]:
                        STATE["items"].pop(k, None)
            job["status"] = "done"
        except Exception as e:  # noqa: BLE001
            log("aborted", detail=str(e))
            job["status"] = "error"

    threading.Thread(target=run, daemon=True).start()
    return jsonify(job_id=job_id)


@app.get("/api/jobs/<job_id>")
def job_status(job_id):
    job = JOBS.get(job_id)
    if not job:
        return fail("no_job", 404)
    since = int(request.args.get("since", 0))
    return jsonify(status=job["status"], logs=job["logs"][since:],
                   next=len(job["logs"]), results=job["results"])


@app.post("/api/bye")
def bye():
    """앱 창이 닫히면 호출된다. 새로고침이나 다른 창이 있으면 heartbeat 가 다시 오므로 잠시 기다렸다 판단."""
    t = time.time()

    def later():
        time.sleep(15)
        if (STATE["last_beat"] or 0) < t and not _busy():
            os._exit(0)
    if APP_MODE:
        threading.Thread(target=later, daemon=True).start()
    return "", 204


# ---------------------------------------------------------------- launcher
PORT = 8765
URL = f"http://127.0.0.1:{PORT}"
APP_MODE = False
BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
]


def _open_app_window():
    exe = next((b for b in BROWSERS if os.path.exists(b)), None)
    if not exe:
        return False
    profile = Path(os.environ.get("LOCALAPPDATA", ROOT)) / "Boom" / "browser"
    STATE["browser_pid"] = subprocess.Popen([exe, f"--app={URL}", f"--user-data-dir={profile}",
                                             "--window-size=1440,920", "--no-first-run",
                                             "--no-default-browser-check"]).pid
    return True


def _busy():
    return any(j["status"] == "running" for j in JOBS.values())


def _watchdog():
    """창이 닫힌 뒤(heartbeat 끊김) 서버 종료. 최소화된 창은 타이머가 느려지므로 넉넉히."""
    while True:
        time.sleep(15)
        beat = STATE["last_beat"]
        if beat and time.time() - beat > 180 and not _busy():
            os._exit(0)


def _already_running():
    import urllib.request
    try:
        urllib.request.urlopen(URL + "/api/profiles", timeout=1)
        return True
    except OSError:
        return False


if __name__ == "__main__":
    use_browser = "--browser" in sys.argv
    if _already_running():
        # 이미 떠 있으면 창만 하나 더 연다
        if use_browser or not _open_app_window():
            webbrowser.open(URL)
        sys.exit(0)
    if not use_browser:
        APP_MODE = True
        threading.Thread(target=_watchdog, daemon=True).start()

        def launch():
            if not _open_app_window():
                webbrowser.open(URL)
        threading.Timer(0.8, launch).start()
    else:
        threading.Timer(0.8, lambda: webbrowser.open(URL)).start()
    print(f"Boom → {URL}")
    # 로컬 전용: 외부 인터페이스에 바인딩하지 않는다
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True)
