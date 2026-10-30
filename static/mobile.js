// Android 앱(android/)에서만 붙는 스크립트 — app.py 의 index() 가 Android 일 때만 넣는다.
// 터치를 마우스 동작으로 바꾸고, 키보드 단축키 대신 버튼을 주고, 파일 저장 · 뒤로 가기를 앱에 잇는다.
"use strict";
(() => {
  const KO = LANG === "ko";
  const L = (ko, en) => (KO ? ko : en);

  // ---- 파일 저장: WebView 는 <a download> 를 처리하지 않으므로 앱의 '다운로드' 폴더 저장으로 넘긴다
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download || !/^(blob|data):/.test(this.href) || !window.BoomAndroid) return click.call(this);
    const name = this.download;
    fetch(this.href).then(r => r.blob()).then(blob => new Promise((ok, no) => {
      const fr = new FileReader();
      fr.onload = () => ok([blob.type, String(fr.result).split(",")[1] || ""]);
      fr.onerror = no;
      fr.readAsDataURL(blob);
    })).then(([type, b64]) => {
      if (!BoomAndroid.saveFile(name, type, b64)) alert(L("파일을 저장하지 못했습니다: ", "Couldn't save the file: ") + name);
    }).catch(() => alert(L("파일을 저장하지 못했습니다: ", "Couldn't save the file: ") + name));
  };
  // 업데이트 화면은 새 APK 를 브라우저로 내려받게 한 뒤 창을 닫으려 한다 → 앱에선 대화 상자만 닫는다
  window.close = () => document.querySelectorAll("dialog[open]").forEach(d => d.close());

  // ---- 뒤로 가기 (MainActivity 가 부른다): 대화 상자 → 토폴로지 순서로 닫고, 닫은 게 있으면 true
  window.boomBack = () => {
    const dlg = [...document.querySelectorAll("dialog[open]")].pop();
    if (dlg) { dlg.close(); return true; }
    if (window.Topology?.on) { window.Topology.exit(); return true; }
    return false;
  };

  // ---- PC 기준 문구를 폰에 맞게 (다른 언어는 영어 문구로)
  const WORDS = {
    en: { remember: "Remember on this phone", remember_note: "(encrypted with the Android keystore)",
          keys_local: "Your keys never leave this phone.",
          disconnect_confirm: "Disconnect? Access keys saved on this phone will also be deleted.",
          l_hint: "Drag = move · long-press = menu · pinch = zoom" },
    ko: { remember: "이 폰에 기억하기", remember_note: "(Android 키 저장소로 암호화 저장)",
          keys_local: "키는 이 폰 밖으로 나가지 않습니다.",
          disconnect_confirm: "연결을 해제할까요? 이 폰에 기억한 액세스 키도 삭제됩니다.",
          l_hint: "끌기 = 이동 · 길게 누르기 = 메뉴 · 두 손가락 = 확대" },
  };
  for (const [lang, table] of Object.entries(I18N)) {
    if (!table.remember) continue;
    for (const k of Object.keys(WORDS.en)) {
      if (WORDS[lang]) table[k] = WORDS[lang][k]; else delete table[k];
    }
  }
  applyStaticText();
  // 폰에는 ~/.aws 프로필이 없으니 '액세스 키 입력' 탭만
  const profTab = document.querySelector('[data-tab="profile"]');
  if (profTab) { profTab.classList.add("hidden"); profTab.parentElement.querySelector("[data-tab]:not([data-tab=profile])")?.click(); }
  // 화면이 열리자마자 입력칸에 초점이 가서 키보드가 화면 반을 덮지 않게 — 사용자가 한 번 만지기 전까지는 막는다
  let touched = false;
  addEventListener("touchstart", () => { touched = true; }, { capture: true, passive: true, once: true });
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (...a) {
    if (!touched && this.matches("input, textarea")) return;
    return focus.apply(this, a);
  };
  if (document.activeElement?.matches?.("input, textarea")) document.activeElement.blur();

  // ---- 키보드 대신: 머리글의 Boom 로고를 길게 누르면 토폴로지 (데스크톱의 Ctrl+Shift+T)
  const logo = document.querySelector("header img, header h1");
  const header = document.querySelector("header");
  let logoHold = null, logoAt = null;
  header.addEventListener("touchstart", (e) => {
    if (!e.target.closest("img, h1")) return;
    logoAt = [e.touches[0].clientX, e.touches[0].clientY];
    logoHold = setTimeout(() => { navigator.vibrate?.(20); window.Topology?.enter(); }, 800);
  }, { passive: true });
  header.addEventListener("touchmove", (e) => {  // 손가락이 살짝 떨리는 정도는 그대로 둔다
    if (logoAt && Math.hypot(e.touches[0].clientX - logoAt[0], e.touches[0].clientY - logoAt[1]) > 10) clearTimeout(logoHold);
  }, { passive: true });
  header.addEventListener("touchend", () => clearTimeout(logoHold), { passive: true });
  // 길게 누르면 WebView 가 이미지 메뉴 · 글자 선택을 띄우며 터치를 취소하므로 막는다
  header.addEventListener("contextmenu", (e) => { if (e.target.closest("img, h1")) e.preventDefault(); });
  if (logo) logo.draggable = false;
  header.querySelectorAll("img, h1").forEach(el => { el.style.webkitTouchCallout = "none"; el.style.userSelect = "none"; });

  const key = (code, mods = {}) => document.body.dispatchEvent(new KeyboardEvent("keydown", {
    code, key: code === "Escape" ? "Escape" : code.replace(/^(Key|Digit)/, "").toLowerCase(),
    bubbles: true, cancelable: true, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, shiftKey: !!mods.shift }));

  // ---- 토폴로지 안에서 쓰는 버튼 묶음 (토폴로지가 켜졌을 때만 보인다)
  let ctrl = false;  // 'Ctrl 고정' — 삭제 모드에서 여러 개 고르기 · 올가미
  const css = document.createElement("style");
  css.textContent = `
    /* 지도 위 터치는 아래 touchstart 에서 막는다. #topo 전체에 touch-action: none 을 주면 도구 막대 · 폼의 스크롤까지 막힌다 */
    @media (max-width: 640px) {
      #topo .t-hud { overflow-x: auto; scrollbar-width: none; }
      #topo .t-hud > * { flex-shrink: 0; white-space: nowrap; }
      #topo .t-hud .stats { max-width: 40vw; }
      #topo .t-legend { display: none; }
      #topo .t-mini canvas { width: 150px; height: 89px; }
    }
    #topo .t-kbd { display: none; }
    #mKeys { position: fixed; left: 12px; top: 30%; z-index: 90; display: none; flex-direction: column; align-items: flex-start; gap: 8px;
             font: 13px/1.2 system-ui, sans-serif; }
    body.topo-on #mKeys { display: flex; }
    #mKeys > button { width: 48px; height: 48px; border-radius: 50%; border: 0; background: #7c5cf0; color: #fff; font-size: 20px;
                      box-shadow: 0 4px 14px rgba(0,0,0,.25); }
    #mKeys .grid { display: none; grid-template-columns: repeat(2, auto); gap: 6px; padding: 8px; border-radius: 12px;
                   background: rgba(24,24,28,.92); box-shadow: 0 6px 20px rgba(0,0,0,.3); }
    #mKeys.open .grid { display: grid; }
    #mKeys .grid button { min-width: 92px; padding: 10px 8px; border-radius: 8px; border: 1px solid #3a3a42; background: #26262c;
                          color: #f2f2f5; text-align: left; }
    #mKeys .grid button.on { background: #7c5cf0; border-color: #7c5cf0; }`;
  document.head.append(css);
  const box = document.createElement("div");
  box.id = "mKeys";
  const KEYS = [
    [L("편집", "Edit"), () => key("KeyX", { ctrl: true, alt: true })],
    [L("배치 저장", "Save layout"), () => key("KeyS", { alt: true })],
    [L("요소 추가", "Add"), () => key("KeyI", { ctrl: true, alt: true })],
    [L("아이콘 보기", "Icons"), () => key("KeyV", { ctrl: true, alt: true })],
    [L("설계 초안", "Draft"), () => key("KeyE", { ctrl: true, alt: true })],
    [L("연결선", "Links"), () => key("KeyL", { ctrl: true, alt: true })],
    [L("삭제 모드", "Delete mode"), () => key("KeyR", { ctrl: true, alt: true })],
    [L("삭제 실행", "Delete"), () => key("KeyY", { alt: true })],
    [L("Ctrl 고정", "Hold Ctrl"), (b) => { ctrl = !ctrl; b.classList.toggle("on", ctrl); }],
    [L("기본 화면", "Main view"), () => key("Escape", { alt: true })],
    [L("전체 보기", "Fit"), () => key("Digit0")],
    [L("나가기", "Exit"), () => window.Topology?.exit()],
  ];
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const [label, run] of KEYS) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = (e) => { e.stopPropagation(); run(b); if (label !== KEYS[8][0]) box.classList.remove("open"); };
    grid.append(b);
  }
  const fab = document.createElement("button");
  fab.textContent = "⌨";
  fab.onclick = (e) => { e.stopPropagation(); box.classList.toggle("open"); };
  box.append(fab, grid);  // 왼쪽 가운데 — 오른쪽 아래는 미니맵, 아래쪽은 범례 자리
  document.body.append(box);

  // ---- 터치 → 마우스: 한 손가락 끌기 = 왼쪽 끌기, 길게 누르기 = 오른쪽 클릭(메뉴), 두 번 탭 = 더블클릭, 두 손가락 = 확대/축소
  const view = document.getElementById("topo");
  if (!view) return;
  const NATIVE = ".t-ui:not(.t-mini *):not(.t-mini), .t-menu, #tVpc, input, textarea, select, #mKeys";
  const mouse = (type, x, y, button = 0, target = null) => {
    const el = target || document.elementFromPoint(x, y) || view;
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y,
      button, buttons: type === "mouseup" ? 0 : button === 2 ? 2 : 1, ctrlKey: ctrl }));
  };
  let one = null, pinch = null, lastTap = null;
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const mid = (a, b) => [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2];

  view.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (e.touches.length === 1) {
      if (e.target.closest(NATIVE) && !e.target.closest("[data-add], [data-rs]")) return;  // 버튼 · 폼 · 스크롤 칸은 그대로
      e.preventDefault();
      one = { x: t.clientX, y: t.clientY, lx: t.clientX, ly: t.clientY, target: e.target, moved: false, long: false };
      one.timer = setTimeout(() => {
        if (!one || one.moved) return;
        one.long = true;
        navigator.vibrate?.(15);
        mouse("mousedown", one.x, one.y, 2, one.target);
        mouse("mouseup", one.x, one.y, 2, one.target);
      }, 550);
    } else if (e.touches.length === 2) {
      e.preventDefault();
      if (one) { clearTimeout(one.timer); if (one.moved) mouse("mouseup", one.lx, one.ly, 0, one.target); one = null; }
      pinch = { d: dist(e.touches[0], e.touches[1]), target: e.target };
    }
  }, { passive: false });

  view.addEventListener("touchmove", (e) => {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      const d = dist(e.touches[0], e.touches[1]);
      const [cx, cy] = mid(e.touches[0], e.touches[1]);
      if (d > 0 && pinch.d > 0) {
        pinch.target.dispatchEvent(new WheelEvent("wheel", {
          bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: -Math.log(d / pinch.d) / 0.0015 }));
      }
      pinch.d = d;
      return;
    }
    if (!one) return;
    e.preventDefault();
    const t = e.touches[0];
    one.lx = t.clientX; one.ly = t.clientY;
    if (one.long) return;
    if (!one.moved && Math.hypot(t.clientX - one.x, t.clientY - one.y) > 8) {
      one.moved = true;
      clearTimeout(one.timer);
      mouse("mousedown", one.x, one.y, 0, one.target);
    }
    // 끌기 중엔 지도가 매 프레임 다시 그려지므로, 위치 찾기(elementFromPoint) 없이 처음 잡은 요소로 한 프레임에 한 번만 보낸다
    if (one.moved && !one.raf) one.raf = requestAnimationFrame(() => {
      if (!one) return;
      one.raf = 0;
      mouse("mousemove", one.lx, one.ly, 0, one.target);
    });
  }, { passive: false });

  const end = (e) => {
    if (pinch && e.touches.length < 2) { pinch = null; return; }
    if (!one) return;
    e.preventDefault();
    clearTimeout(one.timer);
    const o = one;
    one = null;
    if (o.long) return;
    if (o.moved) { cancelAnimationFrame(o.raf); mouse("mousemove", o.lx, o.ly, 0, o.target); mouse("mouseup", o.lx, o.ly, 0, o.target); return; }
    mouse("mousedown", o.x, o.y, 0, o.target);
    mouse("mouseup", o.x, o.y, 0, o.target);
    mouse("click", o.x, o.y, 0, o.target);
    const now = Date.now();
    if (lastTap && now - lastTap.t < 320 && Math.hypot(o.x - lastTap.x, o.y - lastTap.y) < 24) {
      mouse("dblclick", o.x, o.y, 0, o.target);
      lastTap = null;
    } else lastTap = { t: now, x: o.x, y: o.y };
  };
  view.addEventListener("touchend", end, { passive: false });
  view.addEventListener("touchcancel", end, { passive: false });
})();
