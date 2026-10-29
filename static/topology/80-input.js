  // ------------------------------------------------------------ 입력
  const view = $t("topo");
  view.addEventListener("contextmenu", (e) => e.preventDefault());  // 브라우저 기본 우클릭 메뉴 차단
  view.addEventListener("mousedown", (e) => {
    if (e.button !== 2 || e.target.closest(".t-ui, .t-menu")) return;
    closeMenu();
    S.rdrag = { sx: e.clientX, sy: e.clientY, x0: S.x, y0: S.y, pan: false, target: e.target };
    clearTimeout(S.rhold);
    S.rhold = setTimeout(() => { if (S.rdrag) { S.rdrag.pan = true; view.classList.add("rpan"); } }, HOLD_MS);
  });
  addEventListener("mouseup", (e) => {
    if (e.button !== 2 || !S.rdrag) return;
    clearTimeout(S.rhold);
    const d = S.rdrag;
    S.rdrag = null;
    view.classList.remove("rpan");
    if (!d.pan && S.on) openMenu(e.clientX, e.clientY, d.target);
  });
  view.addEventListener("mousemove", (e) => {
    S.mx = e.clientX; S.my = e.clientY; S.inside = true; S.shift = e.shiftKey;
    S.overUI = !!e.target.closest(".t-ui, .t-menu");
    if (S.pdrag) { paletteMove(e); return; }
    if (S.edrag) { dragStep(); return; }
    if (S.lasso) {
      const last = S.lasso.pts[S.lasso.pts.length - 1];
      if (Math.hypot(e.clientX - last[0], e.clientY - last[1]) > 3) { S.lasso.pts.push([e.clientX, e.clientY]); drawLasso(); }
      return;
    }
    if (S.rdrag) {
      const d = S.rdrag, dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.pan && Math.abs(dx) + Math.abs(dy) > 6) { d.pan = true; view.classList.add("rpan"); }
      if (d.pan) { S.x = d.x0 + dx; S.y = d.y0 + dy; S.goal = null; clampView(); S.viewDirty = true; }
      return;
    }
    if (S.drag) {
      const dx = e.clientX - S.drag.sx, dy = e.clientY - S.drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) { S.dragged = true; view.classList.add("dragging"); }
      if (S.drag.mini) { miniJump(e); return; }
      S.x = S.drag.x0 + dx; S.y = S.drag.y0 + dy; S.goal = null; clampView(); S.viewDirty = true;
    }
  });
  view.addEventListener("mouseleave", () => { S.inside = false; });
  view.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (S.menuOpen && !e.target.closest(".t-menu")) closeMenu();
    const add = e.target.closest("[data-add]");
    if (add) {  // 요소 추가 바에서 끌기 시작
      e.preventDefault();
      const g = $t("tGhost");
      g.innerHTML = add.innerHTML; g.classList.remove("hidden");
      S.pdrag = { kind: add.dataset.add, target: null };
      paletteMove(e);
      return;
    }
    const mini = !!e.target.closest(".t-mini");
    if (e.target.closest(".t-ui, .t-menu") && !mini) return;
    if (S.del && !mini && e.ctrlKey) {  // Ctrl 누른 채 끌기 = 올가미
      e.preventDefault();
      S.lasso = { pts: [[e.clientX, e.clientY]], target: e.target };
      S.dragged = false;
      return;
    }
    const el = S.edit && !mini && e.target.closest(DRAG_SEL);
    if (el && $t("topoRegions").contains(el)) { S.mx = e.clientX; S.my = e.clientY; startElementDrag(el, e); return; }
    S.drag = { sx: e.clientX, sy: e.clientY, x0: S.x, y0: S.y, mini };
    S.dragged = false;
    if (mini) miniJump(e);
  });
  addEventListener("mouseup", (e) => {
    if (e.button === 0 && S.pdrag) paletteDrop(e);
    if (e.button === 0 && S.edrag) endElementDrag();
    if (e.button === 0 && S.lasso) endLasso(e);
    S.drag = null; view.classList.remove("dragging");
  });
  // Ctrl 을 누르고 있는 동안 삭제 모드 커서가 올가미로
  const ctrlCursor = (on) => view.classList.toggle("ctrl", on);
  addEventListener("keydown", (e) => { if (e.key === "Control") ctrlCursor(true); });
  addEventListener("keyup", (e) => { if (e.key === "Control") ctrlCursor(false); });
  addEventListener("blur", () => ctrlCursor(false));
  view.addEventListener("wheel", (e) => {
    if (e.target.closest("#tVpc")) return;  // VPC 안은 보통 페이지처럼 스크롤
    e.preventDefault();
    if (S.menuOpen) closeMenu();
    const sc = e.target.closest(".t-insp, .t-form-b");
    if (sc) { sc.scrollTop += e.deltaY; return; }
    if (e.target.closest(".t-ui")) return;
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  view.addEventListener("click", (e) => {
    if (S.dragged) { S.dragged = false; return; }
    const who = e.target.closest("[data-who]");
    if (who) { lookupWho(who.dataset.who); return; }
    const link = e.target.closest("[data-go]");
    if (link) { focus(link.dataset.go); return; }
    if (e.target.closest(".t-ui, .t-menu")) return;
    const n = e.target.closest("#topoRegions [data-node]");
    if (S.del) {  // 삭제 모드: 클릭 = 그것만 고르기, Ctrl+클릭 = 넣고 빼기, 빈 곳 = 선택 해제
      if (S.delJob) return;
      if (n) delToggle(n, e.ctrlKey);
      else if (!e.ctrlKey && S.delSel.size) { S.delSel.clear(); markDel(); renderDelPanel(); }
      return;
    }
    const slot = !n && e.target.closest("#topoRegions .t-region.slot");
    select(n ? n.dataset.node : slot ? slot.dataset.region : null);
  });
  view.addEventListener("dblclick", (e) => {
    const n = e.target.closest("#topoRegions [data-node]");
    if (n) focus(n.dataset.node);
  });
  $t("topoRegions").addEventListener("mouseover", (e) => {
    const n = e.target.closest("[data-node]");
    const id = n && ["subnet", "rt", "res"].includes(S.nodes.get(n.dataset.node)?.kind) ? n.dataset.node : null;
    if (id !== S.hover) { S.hover = id; S.linesDirty = true; }
  });
  $t("topoRegions").addEventListener("mouseleave", () => { if (S.hover) { S.hover = null; S.linesDirty = true; } });
  addEventListener("resize", () => { if (S.on) { clampView(); S.viewDirty = true; } });

  function key(e) {
    if (S.vpcv) {  // VPC 안: Esc = 세부 정보 → 만들기 창 → VPC 순으로 하나씩 닫기. Alt+Esc = 곧바로 토폴로지
      if (!e.altKey) {
        if (e.key !== "Escape") return;
        if (S.pdrag) cancelPaletteDrag();
        else if (S.formOpen) closeForm();
        else if (S.vpcv.open) { S.vpcv.open = null; vpcRender(); }
        else closeVpc();
        return;
      }
      if (e.ctrlKey && e.code === "KeyI") { if (S.vpcv.data) setPalette(!S.palette); return; }  // VPC 안의 요소 추가 바
      if (e.code !== "Escape" && !(e.ctrlKey && ["KeyX", "KeyR", "KeyE"].includes(e.code))) return;
      closeVpc();  // Ctrl+Alt+X / R 은 VPC 를 닫고 그 모드로
    }
    if (e.altKey) {  // 편집기 / 요소 추가 / 삭제 모드 (index.html 이 Alt 조합 중 X·S·I·R·Y·Esc 만 넘겨준다)
      if (e.code === "Escape") { toViewer(); return; }
      if (!S.data) return;
      if (e.code === "KeyX") setEdit(e.ctrlKey);
      else if (e.code === "KeyS" && !e.ctrlKey && S.edit) saveLayout();
      else if (e.code === "KeyI" && e.ctrlKey) setPalette(!S.palette);
      else if (e.code === "KeyR" && e.ctrlKey) setDel(!S.del);
      else if (e.code === "KeyE" && e.ctrlKey) setDraft(!S.draftOn);
      else if (e.code === "KeyY" && !e.ctrlKey && S.del) runDelete();
      return;
    }
    if (e.key === "Escape" && S.pdrag) { cancelPaletteDrag(); return; }
    if (e.key === "Escape" && S.lasso) { S.lasso = null; $t("tLasso").innerHTML = ""; return; }
    if (e.key === "Escape" && S.del && S.delSel.size && !S.delJob) { S.delSel.clear(); markDel(); renderDelPanel(); return; }
    if (e.key === "Escape" && (S.formOpen || S.menuOpen)) { closeForm(); closeMenu(); return; }
    if (S.formOpen || !S.data) return;
    const step = 160;
    const byKey = { "=": "Equal", "+": "Equal", "-": "Minus", "0": "Digit0", Escape: "Escape",
                    ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown" };
    switch (e.code || byKey[e.key]) {
      case "ArrowLeft": S.x += step; break;
      case "ArrowRight": S.x -= step; break;
      case "ArrowUp": S.y += step; break;
      case "ArrowDown": S.y -= step; break;
      case "Equal": case "NumpadAdd": zoomAt(innerWidth / 2, innerHeight / 2, 1.2); return;
      case "Minus": case "NumpadSubtract": zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.2); return;
      case "Digit0": case "Numpad0": fit(); return;
      case "Escape": select(null); return;
      default: return;
    }
    S.goal = null; clampView(); S.viewDirty = true;
  }

  const toggle = (btn, prop, rerender) => {
    btn.onclick = () => {
      S[prop] = !S[prop];
      btn.classList.toggle("on", S[prop]);
      if (rerender) render(); else S.linesDirty = true;
    };
  };
  toggle($t("tDefault"), "showDefault", true);
  toggle($t("tRoutes"), "showRoutes", false);
  $t("tFit").onclick = () => fit();
  $t("tRefresh").onclick = () => load();
  $t("tExit").onclick = () => exit();
  $t("tReset").onclick = () => resetLayout();

  function relang() {
    closeMenu();
    if (S.palette) setPalette(true);
    if (S.edit || S.del) updateBadge();
    if (!$t("tLoad").classList.contains("hidden")) loading(true);
    if (!S.data) return;
    if (!S.on) { S.needRender = true; return; }
    render();
    if (S.sel && S.nodes.has(S.sel)) select(S.sel);
    if (S.del) renderDelPanel();
    if (S.vpcv) vpcRender();
  }

  window.Topology = { enter, exit, key, relang, get on() { return S.on; } };
