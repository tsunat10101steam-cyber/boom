  // ------------------------------------------------------------ 설계 초안의 그림 요소: AWS 밖 요소 · 직접 그은 연결선
  // 실제 리소스가 아니라 그림에만 있는 것들 (사용자 · 웹 앱 · 인터넷 ... 과 화살표). 초안(Ctrl+Alt+E)에서만 보이고 계정별로 저장된다.
  // 연결선: 요소 추가 바의 '연결선 그리기'(Ctrl+Alt+L)를 켜고 요소에서 요소로 끈다. 선을 누르면 라벨 · 방향 · 모양을 고친다
  Object.assign(ICONS, {
    user: ["#475569", '<circle cx="12" cy="8.5" r="3.3"/><path d="M5.5 19c.7-3.8 3.3-5.8 6.5-5.8s5.8 2 6.5 5.8"/>'],
    web: ["#475569", '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 9h16M10 12.3l-2 1.9 2 1.9M14 12.3l2 1.9-2 1.9"/>'],
    mobile: ["#475569", '<rect x="8" y="4" width="8" height="16" rx="1.5"/><path d="M11 17h2"/>'],
    internet: ["#475569", '<circle cx="12" cy="12" r="7"/><path d="M5 12h14M12 5c2 2 2 12 0 14M12 5c-2 2-2 12 0 14"/>'],
    onprem: ["#475569", '<path d="M5 19V6h9v13M14 10h5v9M4 19h16M8 9h3M8 12h3M8 15h3"/>'],
    extsvc: ["#475569", '<path d="M12 4l7 4v8l-7 4-7-4V8zM5 8l7 4 7-4M12 12v8"/>'],
    group: ["#64748b", '<rect x="4.5" y="6" width="15" height="12" rx="1.5" stroke-dasharray="2.5 2"/><path d="M7.5 9.5h4"/>'],
    note: ["#ca8a04", '<path d="M6 4.5h12v10l-5 5H6z"/><path d="M13 19.5v-5h5M9 9h6M9 12h4"/>'],
    link: ["#64748b", '<path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>'],
  });
  const EXT_KINDS = [["user", "user"], ["web", "web"], ["mobile", "mobile"], ["internet", "internet"], ["onprem", "onprem"], ["extsvc", "extsvc"],
    ["group", "group"], ["note", "note"]];  // 묶음 상자 (Frontend / Backend 같은 점선 상자) · 메모
  const EXT_SET = new Set(EXT_KINDS.map(([k]) => k));
  const annotKey = () => "topoDraftX:" + (identity?.account || "-");
  function readAnnot() {
    try { const a = JSON.parse(store.get(annotKey()) || "{}") || {}; return { items: a.items || [], links: a.links || [] }; }
    catch { return { items: [], links: [] }; }
  }
  function saveAnnot() { store.set(annotKey(), JSON.stringify(S.annot)); }
  const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // ---- AWS 밖 요소: 놓은 자리(월드 좌표)에 아이콘 + 이름. 편집기에서 옮긴 만큼은 다른 요소처럼 S.offsets["ext:..."]
  // 묶음 상자 = 이름표 달린 점선 상자 (안쪽은 클릭이 아래 요소로 지나간다), 메모 = 글 상자. 둘 다 오른쪽 아래 모서리로 크기 조절
  function annotHTML() {
    return S.annot.items.map(x => {
      const id = "ext:" + x.id, o = S.offsets[id];
      reg(id, "ext", x, {});
      const pos = `left:${x.x}px;top:${x.y}px;${o ? `translate:${o[0]}px ${o[1]}px;` : ""}`;
      if (x.kind === "group") return `<div class="t-ann t-grp" data-node="${esc(id)}" style="${pos}width:${x.w}px;height:${x.h}px">
        <span class="t-grp-l">${esc(x.label)}</span><span class="t-rs" data-rs="${esc(id)}"></span></div>`;
      if (x.kind === "note") return `<div class="t-ann t-note" data-node="${esc(id)}" style="${pos}width:${x.w}px">${esc(x.label)}<span class="t-rs" data-rs="${esc(id)}"></span></div>`;
      return `<div class="t-ann t-ext" data-node="${esc(id)}" style="${pos}">${icon(x.kind, 46)}<span>${esc(x.label)}</span></div>`;
    }).join("");
  }
  // 묶음 상자 · 메모 크기 조절 (모서리 끌기). 메모는 너비만
  function resizeStart(h, e) {
    const x = S.annot.items.find(i => "ext:" + i.id === h.dataset.rs);
    if (!x) return false;
    e.preventDefault(); e.stopPropagation();
    S.gresize = { x, el: h.parentElement, sx: e.clientX, sy: e.clientY, w0: x.w, h0: x.h };
    S.dragged = true;
    return true;
  }
  function resizeStep(e) {
    const g = S.gresize, dx = (e.clientX - g.sx) / S.s, dy = (e.clientY - g.sy) / S.s;
    g.x.w = Math.max(g.x.kind === "note" ? 120 : 100, Math.round(g.w0 + dx));
    g.el.style.width = g.x.w + "px";
    if (g.x.kind === "group") { g.x.h = Math.max(60, Math.round(g.h0 + dy)); g.el.style.height = g.x.h + "px"; }
  }
  function resizeEnd() {
    S.gresize = null;
    saveAnnot(); measure(); drawLines(); S.viewDirty = true;
  }
  // 메모 글 고치기 (오른쪽 창, 여러 줄)
  function openNoteEditor(id) {
    const x = S.annot.items.find(i => "ext:" + i.id === id);
    if (!x) return;
    closeMenu();
    const wrap = $t("tForm");
    wrap.dataset.mode = "note";
    wrap.innerHTML = `<form class="t-form" autocomplete="off">
      <div class="t-form-h"><h3>${icon("note", 24)}<span>${esc(t("el.note"))}</span></h3>
        <button type="button" class="ghost t-close" id="tFormX" aria-label="${esc(t("close"))}">✕</button></div>
      <div class="t-form-b"><div class="t-sec"><textarea name="text" rows="8" class="t-notearea">${esc(x.label)}</textarea></div></div>
      <div class="t-form-f"><div class="btns"><button type="submit" class="primary">${esc(t("close"))}</button></div></div></form>`;
    wrap.classList.remove("hidden");
    wrap.classList.remove("in"); void wrap.offsetWidth; wrap.classList.add("in");
    S.formOpen = true;
    const f = wrap.querySelector("form"), el = document.querySelector(`#topoRegions [data-node="${CSS.escape(id)}"]`);
    f.elements.text.oninput = () => {
      x.label = f.elements.text.value.slice(0, 1000);
      if (el) el.firstChild.textContent = x.label;
      saveAnnot(); S.remeasure = true;
    };
    f.onsubmit = (e) => { e.preventDefault(); closeForm(); };
    $t("tFormX").onclick = closeForm;
    f.elements.text.focus();
  }
  function addExt(kind, e) {
    const wx = (e.clientX - S.x) / S.s, wy = (e.clientY - S.y) / S.s;
    const size = kind === "group" ? { w: 360, h: 220 } : kind === "note" ? { w: 220 } : {};
    const label = kind === "note" ? t("note_default") : kind === "group" ? t("group_default") : t("el." + kind);
    S.annot.items.push({ id: newId("x"), kind, label, x: Math.max(0, Math.round(wx - 46)), y: Math.max(0, Math.round(wy - 36)), ...size });
    saveAnnot(); render();
  }
  function renameExt(id) {
    const x = S.annot.items.find(i => "ext:" + i.id === id);
    if (x?.kind === "note") return openNoteEditor(id);
    const v = x && prompt(t("dr_rename_q"), x.label);
    if (!v || !v.trim()) return;
    x.label = v.trim().slice(0, 60); saveAnnot(); render();
  }
  function removeExt(id) {
    S.annot.items = S.annot.items.filter(i => "ext:" + i.id !== id);
    S.annot.links = S.annot.links.filter(l => l.a !== id && l.b !== id);
    saveAnnot(); select(null); render();
  }

  // ---- 연결선: 끝점 = 요소 id 또는 상자("box:리전")
  const linkEnd = (target) => {
    const n = target?.closest?.("#topoRegions [data-node]");
    if (n) return n.dataset.node;
    const b = target?.closest?.("#topoRegions .t-region:not(.slot)");
    return b ? "box:" + b.dataset.region : null;
  };
  const endEl = (id) => id.startsWith("box:") ? document.querySelector(`#topoRegions .t-region[data-region="${CSS.escape(id.slice(4))}"]`)
    : document.querySelector(`#topoRegions [data-node="${CSS.escape(id)}"]`);
  const endRect = (id) => id.startsWith("box:") ? S.regionRects.find(r => r.code === id.slice(4)) : S.rects.get(id);
  const endName = (id) => id.startsWith("box:") ? regionName(id.slice(4)) : (S.nodes.get(id)?.data?.label || S.nodes.get(id)?.data?.name || id);

  function setLinkMode(on) {
    S.linkMode = on; S.ldrag = null;
    $t("tLasso").innerHTML = "";
    $t("topo").classList.toggle("linking", on);
    $t("tPal").querySelector('[data-tool="link"]')?.classList.toggle("on", on);
    if (on) toast(t("ln_on"));
  }
  function linkDown(e) {
    const from = linkEnd(e.target);
    if (!from) return false;
    e.preventDefault();
    S.ldrag = { from, sx: e.clientX, sy: e.clientY };
    S.dragged = true;  // 뒤따르는 click 으로 선택되지 않게
    return true;
  }
  function linkMove(e) {
    const d = S.ldrag, to = linkEnd(document.elementFromPoint(e.clientX, e.clientY));
    $t("tLasso").innerHTML = `<path class="t-ltmp" d="M${d.sx},${d.sy}L${e.clientX},${e.clientY}"/>`;
    document.querySelectorAll(".t-ltgt").forEach(x => x.classList.remove("t-ltgt"));
    if (to && to !== d.from) endEl(to)?.classList.add("t-ltgt");
  }
  function linkUp(e) {
    const d = S.ldrag;
    S.ldrag = null;
    $t("tLasso").innerHTML = "";
    document.querySelectorAll(".t-ltgt").forEach(x => x.classList.remove("t-ltgt"));
    const to = linkEnd(document.elementFromPoint(e.clientX, e.clientY));
    if (!to || to === d.from) return;
    const l = { id: newId("l"), a: d.from, b: to, dir: "->", dash: false, label: "" };
    S.annot.links.push(l);
    saveAnnot();
    openLinkEditor(l.id);
  }
  function annotLinesSVG() {
    if (!S.draftOn || !S.annot?.links.length) return "";
    return `<defs><marker id="tArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path class="t-arr" d="M0,0L10,5L0,10z"/></marker></defs>` + S.annot.links.map(l => {
      const a = endRect(l.a), b = endRect(l.b);
      if (!a || !b) return "";  // 끝점을 초안에서 뺐으면 (다시 넣으면 다시 보인다)
      const c = curve(a, b);
      return `<g class="t-ulg ${S.selLink === l.id ? "on" : ""}"><path class="t-ulhit" data-link="${l.id}" d="${c.d}"/>
        <path class="t-ul ${l.dash ? "dash" : ""}" d="${c.d}"${l.dir.includes(">") ? ' marker-end="url(#tArr)"' : ""}${l.dir.includes("<") ? ' marker-start="url(#tArr)"' : ""}/>
        ${l.label ? `<text class="t-lbl t-ullbl" x="${c.mid.x}" y="${c.mid.y - 8}" text-anchor="middle">${esc(l.label)}</text>` : ""}</g>`;
    }).join("");
  }
  // 오른쪽 '연결선' 창: 고치는 대로 바로 저장
  function openLinkEditor(id) {
    const l = S.annot.links.find(x => x.id === id);
    if (!l) return;
    closeMenu();
    S.selLink = id; S.linesDirty = true;
    const wrap = $t("tForm");
    wrap.dataset.mode = "link";
    const DIRS = [["->", "→"], ["<-", "←"], ["<->", "↔"], ["-", "—"]];
    wrap.innerHTML = `<form class="t-form" autocomplete="off">
      <div class="t-form-h"><h3>${icon("link", 24)}<span>${esc(t("ln_title"))}</span></h3>
        <button type="button" class="ghost t-close" id="tFormX" aria-label="${esc(t("close"))}">✕</button></div>
      <div class="sub">${esc(endName(l.a))} — ${esc(endName(l.b))}</div>
      <div class="t-form-b"><div class="t-sec">
        ${field(esc(t("ln_label")), `<input type="text" name="label" value="${esc(l.label)}" placeholder="HTTPS 443">`, t("ln_label_d"))}
        ${field(esc(t("ln_dir")), `<select name="dir">${DIRS.map(([v, s]) => `<option value="${v}" ${l.dir === v ? "selected" : ""}>${s}</option>`).join("")}</select>`)}
        ${field(esc(t("ln_style")), `<select name="dash"><option value="0">${esc(t("ln_solid"))}</option><option value="1" ${l.dash ? "selected" : ""}>${esc(t("ln_dash"))}</option></select>`)}
      </div></div>
      <div class="t-form-f"><div class="btns"><button type="button" id="tLnDel">${esc(t("ln_delete"))}</button>
        <button type="submit" class="primary">${esc(t("close"))}</button></div></div></form>`;
    wrap.classList.remove("hidden");
    wrap.classList.remove("in"); void wrap.offsetWidth; wrap.classList.add("in");
    S.formOpen = true;
    const f = wrap.querySelector("form");
    f.oninput = f.onchange = () => {
      l.label = f.elements.label.value.trim().slice(0, 60); l.dir = f.elements.dir.value; l.dash = f.elements.dash.value === "1";
      saveAnnot(); S.linesDirty = true;
    };
    f.onsubmit = (e) => { e.preventDefault(); closeForm(); };
    $t("tFormX").onclick = closeForm;
    $t("tLnDel").onclick = () => { S.annot.links = S.annot.links.filter(x => x.id !== id); saveAnnot(); closeForm(); };
    f.elements.label.focus();
  }

  $t("tPal").addEventListener("click", (e) => {
    if (e.target.closest('[data-tool="link"]') && S.draftOn) setLinkMode(!S.linkMode);
  });

