  // ------------------------------------------------------------ 편집기: 옮긴 위치 적용 / 감싸는 상자 넓히기
  // 리전 = 지도 위 어디든, VPC = 자기 리전 안, 서브넷 = 자기 AZ 안, 인스턴스 등 = 자기 서브넷(없으면 VPC·리전) 안.
  // 상자 안에서는 세로 줄에 묶이지 않고 어디든 (옆으로 나란히도) 놓을 수 있다. 감싸는 상자는 안쪽 요소에 맞춰 커지고 줄어든다
  // (왼쪽·위로는 상자 밖으로 못 나감)
  const DRAG_SEL = ".t-region, .t-vpc, .t-subnet, .t-node, .t-ann";
  const elKey = (el) => el.classList.contains("t-region") ? "R:" + el.dataset.region :
    el.dataset.node + (el.classList.contains("t-pcx") ? "@" + (el.closest(".t-vpc")?.dataset.node || "") : "");  // 피어링 칩은 양쪽 VPC 에 하나씩
  function containerOf(el) {
    if (el.classList.contains("t-region")) return null;
    if (el.classList.contains("t-vpc")) return el.closest(".t-region");
    if (el.classList.contains("t-subnet")) return el.closest(".t-az");
    return el.parentElement.closest(".t-subnet, .t-vpc, .t-region");
  }
  const HEAD = { "t-region": ":scope > header", "t-vpc": ":scope > .t-vpc-h", "t-az": ":scope > .t-az-h", "t-subnet": ":scope > .t-sub-m" };
  const worldRect = (el) => {
    const wr = $t("topoWorld").getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: (r.left - wr.left) / S.s, y: (r.top - wr.top) / S.s, w: r.width / S.s, h: r.height / S.s };
  };
  // 화면에 그려진 것만 (아이콘 보기에서 숨긴 라우팅 테이블 칩 등은 위치가 엉뚱하게 재어져 상자를 끝없이 늘린다)
  const shown = (el) => el.getClientRects().length > 0;
  const kidsOf = (c) => [...c.querySelectorAll(".t-vpc, .t-subnet, .t-node")].filter(k => containerOf(k) === c && shown(k));
  const labelsOf = (c) => [...c.querySelectorAll(":scope > .t-svcs > .t-svcs-h")];  // 리전의 '리전 서비스' 제목
  // 자유 상자: 안쪽 요소를 하나라도 옮긴 상자는 안쪽 요소를 모두 지금 자리(자동 배치 자리)에 절대 위치로 고정한다.
  // 그러면 옮겨 간 요소의 빈자리가 남지 않고(다른 요소는 그대로), 상자는 안쪽 요소를 감싸는 크기로 줄거나 는다.
  // 옮긴 양(S.offsets)은 예전처럼 '자동 배치 자리에서 얼마나'라서 저장된 배치와 그대로 맞는다
  function freeze(c) {
    if (c.classList.contains("t-free")) return;
    const cr = worldRect(c), cs = getComputedStyle(c);
    const bl = parseFloat(cs.borderLeftWidth), bt = parseFloat(cs.borderTopWidth);
    const items = [...kidsOf(c), ...labelsOf(c)].map(k => [k, worldRect(k)]);  // 모두 재고 나서 한꺼번에 바꾼다
    c.classList.add("t-free");
    for (const [k, r] of items) {
      k.dataset.bx = r.x - cr.x - bl; k.dataset.by = r.y - cr.y - bt;
      // VPC 는 내용에 맞는 너비로 — 안의 AZ 가 넓어지면 VPC 도 따라 넓어지게 (고정 px 면 AZ 가 VPC 밖으로 삐져나감)
      Object.assign(k.style, { position: "absolute", margin: "0", boxSizing: "border-box",
                               width: k.classList.contains("t-vpc") ? "max-content" : `${r.w}px`, translate: "" });
      placeKid(k);
    }
  }
  function placeKid(k) {
    const o = k.classList.contains("t-svcs-h") ? [0, 0] : S.offsets[elKey(k)] || [0, 0];
    k.style.left = `${+k.dataset.bx + o[0]}px`; k.style.top = `${+k.dataset.by + o[1]}px`;
  }
  function grow(c) {
    c.style.minWidth = c.style.minHeight = "";
    const kids = [...kidsOf(c), ...labelsOf(c)];
    if (!kids.length) return;
    // AZ 는 서브넷을 자기 너비로 늘리므로, 한 서브넷 때문에 AZ 가 넓어져도 다른 서브넷은 원래 너비 그대로 두게 고정
    if (c.classList.contains("t-az") && !c.classList.contains("t-free"))
      kids.forEach(k => { if (!k.style.width) Object.assign(k.style, { boxSizing: "border-box", width: `${worldRect(k).w}px` }); });
    const cr = worldRect(c), cs = getComputedStyle(c);
    let r = 0, b = 0;
    for (const k of kids) { const kr = worldRect(k); r = Math.max(r, kr.x + kr.w); b = Math.max(b, kr.y + kr.h); }
    const w = r - cr.x + parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
    const h = b - cr.y + parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    if (w > cr.w + 0.5) c.style.minWidth = `${Math.ceil(w)}px`;
    if (h > cr.h + 0.5) c.style.minHeight = `${Math.ceil(h)}px`;
  }
  const chainOf = (el) => { const out = []; for (let c = containerOf(el); c; c = c.classList.contains("t-region") ? null : containerOf(c)) out.push(c); return out; };
  function applyOffsets() {  // render() 직후 (새로 그린 DOM) 에만 부른다
    const rg = $t("topoRegions"), free = new Set(), need = new Set();
    rg.querySelectorAll(".t-vpc, .t-subnet, .t-node").forEach(el => {
      const o = S.offsets[elKey(el)];
      if (o && (o[0] || o[1])) { free.add(containerOf(el)); chainOf(el).forEach(c => need.add(c)); }
    });
    // 안쪽 상자부터 (문서 순서의 역순 = 자식이 부모보다 먼저) — 바깥 상자는 안쪽 상자 크기가 정해진 뒤에 잰다.
    // 바깥의 보통 상자도 grow: AZ 처럼 최대 너비가 있는 상자가 넓어진 안쪽 상자를 감싸도록
    [...rg.querySelectorAll(".t-subnet, .t-az, .t-vpc, .t-region")].reverse().filter(c => need.has(c))
      .forEach(c => { if (free.has(c)) freeze(c); grow(c); });
  }

  // 편집기 켜기/끄기. 끌 때 저장 안 한 이동은 되돌린다 (일반 토폴로지 화면 = 언제나 저장된 배치)
  // 초안 · 아이콘 보기는 요소 크기와 모양이 달라서 배치를 따로 저장한다
  const layoutKey = () => "topoLayout:" + (S.draftOn ? "draft:" : "") + (S.icons ? "icons:" : "") + (identity?.account || "-");
  function readLayout() { try { return JSON.parse(store.get(layoutKey()) || "{}") || {}; } catch { return {}; } }
  function setEdit(on) {
    if (on === S.edit) return;
    S.edit = on;
    S.edrag = null;
    if (!on && S.unsaved) {
      S.unsaved = false; S.offsets = readLayout();
      if (S.data) render();
      toast(t("e_discarded"));
    }
    if (on) setDel(false);
    view.classList.remove("edit");
    if (on) { void view.offsetWidth; view.classList.add("edit"); }  // 격자 등장 애니메이션을 매번 처음부터
    updateBadge();
    S.viewDirty = true;
  }
  function markUnsaved(v) { S.unsaved = v; $t("tUnsaved").classList.toggle("hidden", !v); }
  function saveLayout() {
    const clean = Object.fromEntries(Object.entries(S.offsets).filter(([, o]) => o[0] || o[1]));
    S.offsets = clean;
    store.set(layoutKey(), JSON.stringify(clean));
    markUnsaved(false);
    toast(t("e_saved"));
  }
  function resetLayout() {
    S.offsets = {};
    markUnsaved(true);
    render();
    toast(t("e_reset_done"));
  }

  // 요소 끌기 (편집기). 화면 가장자리 자동 이동 중에도 커서를 따라가도록 매 프레임 dragStep() 을 부른다
  function startElementDrag(el, e) {
    const c = containerOf(el);
    if (c && !c.classList.contains("t-free")) { freeze(c); grow(c); }  // 끌기 시작하면 그 상자는 자유 상자로 (보이는 건 그대로)
    const key = elKey(el), o0 = [...(S.offsets[key] || [0, 0])], r0 = worldRect(el);
    let minX, minY;
    if (!c) { minX = o0[0] - r0.x; minY = o0[1] - r0.y; }  // 리전: 월드 왼쪽·위 밖으로만 못 나감
    else {
      const cr = worldRect(c), cs = getComputedStyle(c), head = c.querySelector(HEAD[[...c.classList].find(k => HEAD[k])]);
      const left = cr.x + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft) / 2;
      const top = head ? worldRect(head).y + worldRect(head).h : cr.y + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop) / 2;
      minX = o0[0] - Math.max(0, r0.x - left); minY = o0[1] - Math.max(0, r0.y - top);
    }
    S.edrag = { el, key, o0, r0, minX, minY, chain: chainOf(el), w0: [(e.clientX - S.x) / S.s, (e.clientY - S.y) / S.s], moved: false };
    S.dragged = false;
  }
  function dragStep() {
    const d = S.edrag;
    const wx = (S.mx - S.x) / S.s, wy = (S.my - S.y) / S.s;
    let ox = d.o0[0] + wx - d.w0[0], oy = d.o0[1] + wy - d.w0[1];
    if (!d.moved && Math.abs(ox - d.o0[0]) + Math.abs(oy - d.o0[1]) < 4 / S.s) return;
    if (!d.moved) { d.moved = true; S.dragged = true; d.el.classList.add("t-moving"); view.classList.add("dragging"); select(null); }
    if (!S.shift) {  // 격자에 붙이기: 상자의 왼쪽 위 모서리를 격자선에
      const lx = d.r0.x + ox - d.o0[0], ly = d.r0.y + oy - d.o0[1];
      ox += Math.round(lx / GRID) * GRID - lx; oy += Math.round(ly / GRID) * GRID - ly;
    }
    ox = Math.round(Math.max(d.minX, ox)); oy = Math.round(Math.max(d.minY, oy));
    const cur = S.offsets[d.key];
    if (cur && cur[0] === ox && cur[1] === oy) return;
    S.offsets[d.key] = [ox, oy];
    if (d.chain.length) placeKid(d.el); else d.el.style.translate = `${ox}px ${oy}px`;  // 리전은 지도 위에서 translate
    d.chain.forEach(grow);
    drawPins();
    S.remeasure = true;
    markUnsaved(true);
  }
  function endElementDrag() {
    const d = S.edrag;
    S.edrag = null;
    if (!d) return;
    d.el.classList.remove("t-moving"); view.classList.remove("dragging");
    if (d.moved) { measure(); drawLines(); clampView(); S.viewDirty = true; }
  }

  // ------------------------------------------------------------ 요소 추가 바 (Ctrl+Alt+I): 끌어다 지도 위에 놓으면 오른쪽에 'OO 추가' 창
  const ADD_KINDS = [["region", "region"], ["vpc", "vpc"], ["subnet", "priv"], ["igw", "igw"], ["instance", "ec2"], ["bucket", "s3"]];
  const DROP_ON = { region: ".t-region:not(.t-global)", vpc: ".t-region:not(.blocked):not(.t-global)", bucket: ".t-region:not(.blocked):not(.t-global)",
                    subnet: ".t-vpc", igw: ".t-vpc", instance: ".t-subnet, .t-vpc" };
  // VPC 연결 화면 안에서는 VPC 안의 요소들. 서브넷 카드에 놓으면 그 서브넷, 라우팅 테이블 카드에 놓으면 그 테이블로 미리 골라 둔다
  const VADD_KINDS = [["subnet", "priv"], ["rt", "rt"], ["igw", "igw"], ["nat", "nat"], ["sg", "sg"], ["eip", "eip"], ["ep", "ep"], ["instance", "ec2"]];
  const VDROP = { subnet: '.t-vcard[data-k="subnets"]', rt: '.t-vcard[data-k="subnets"]', nat: '.t-vcard[data-k="subnets"]',
                  instance: '.t-vcard[data-k="subnets"]', ep: '.t-vcard[data-k="rts"]' };
  function setPalette(on) {
    if (on) setDel(false);
    S.palette = on;
    const p = $t("tPal"), inVpc = !!S.vpcv;
    const draft = S.draftOn && !inVpc;  // 초안: 실제 리소스 고르기 / 일반: 실제 리소스 만들기. 둘 다 아래에 AWS 밖 요소 + 연결선 도구
    const kinds = inVpc ? VADD_KINDS : [...(draft ? DRAFT_KINDS : ADD_KINDS), ["-", "pal_sec_ext"], ...EXT_KINDS];
    if (on) p.innerHTML = `<div class="t-pal-h">${esc(t("p_title"))}<span class="t-kbd">Ctrl+Alt+I</span></div>` +
      kinds.map(([k, ic]) => k === "-" ? `<div class="t-pal-sec">${esc(t(ic))}</div>`
        : `<div class="t-pal-i" data-add="${k}">${icon(ic, 22)}<span>${esc(t("el." + k))}</span></div>`).join("") +
      (!inVpc ? `<div class="t-pal-sec"></div><div class="t-pal-i t-pal-tool ${S.linkMode ? "on" : ""}" data-tool="link">${icon("link", 22)}<span>${esc(t("pal_link"))}</span>
        <span class="t-kbd">Ctrl+Alt+L</span></div>` : "") +
      `<div class="t-pal-f">${esc(t(inVpc ? "p_hint_vpc" : S.draftOn ? "p_hint_draft" : "p_hint"))}</div>` +
      (S.draftOn && !inVpc ? `<button class="ghost t-pal-clear" data-draft-clear>${esc(t("dr_clear"))}</button>` : "");
    p.classList.toggle("hidden", !on);
    p.classList.toggle("in-vpc", on && inVpc);
    p.classList.toggle("draft", on && !inVpc);  // 항목이 많아서 촘촘하게
    $t("topo").classList.toggle("vpal", on && inVpc);
    $t("tVpc").querySelector('[data-v="pal"]')?.classList.toggle("on", on);
    if (!on) cancelPaletteDrag();
  }
  function dropTarget(kind, x, y) {
    const el = document.elementFromPoint(x, y);
    if (S.vpcv) return el && $t("tVmain")?.contains(el) ? (VDROP[kind] && el.closest(VDROP[kind])) || $t("tVmain") : null;
    if (S.draftOn) return el && $t("topoRegions").contains(el) && DRAFT_DROP[kind] ? el.closest(DRAFT_DROP[kind]) : null;
    return el && $t("topoRegions").contains(el) ? el.closest(DROP_ON[kind]) : null;
  }
  function paletteMove(e) {
    const d = S.pdrag, g = $t("tGhost");
    g.style.left = `${e.clientX + 12}px`; g.style.top = `${e.clientY + 10}px`;
    const tg = dropTarget(d.kind, e.clientX, e.clientY);
    if (tg !== d.target) { d.target?.classList.remove("t-drop"); tg?.classList.add("t-drop"); d.target = tg; }
  }
  function cancelPaletteDrag() {
    if (!S.pdrag) return;
    S.pdrag.target?.classList.remove("t-drop");
    S.pdrag = null;
    $t("tGhost").classList.add("hidden");
  }
  function paletteDrop(e) {
    const d = S.pdrag;
    cancelPaletteDrag();
    if (e.target.closest?.(".t-palette")) return;  // 바 위에 도로 놓으면 취소
    if (S.vpcv) {
      const v = S.vpcv, tg = d.target, k = tg?.dataset.k, id = tg?.dataset.m;
      if (!tg) return;
      if (!topoVpc(v)) return toast(t("err.vpc_gone", { id: v.id }));
      return openForm(d.kind, { region: v.region, vpc: topoVpc(v), locked: true, subnet: k === "subnets" ? { id } : null,
        rt: k === "rts" ? id : null, az: k === "subnets" ? v.data?.subnets.find(s => s.id === id)?.az : null }, true);
    }
    if (S.draftOn) return draftDrop(d.kind, d.target, e);
    if (EXT_SET.has(d.kind)) return addExt(d.kind, e);  // 그림 요소는 놓은 자리에 바로
    const tg = d.target, region = tg?.closest(".t-region")?.dataset.region;
    const vpc = tg?.closest(".t-vpc") && S.nodes.get(tg.closest(".t-vpc").dataset.node)?.data;
    const subnet = tg?.classList.contains("t-subnet") ? S.nodes.get(tg.dataset.node)?.data : null;
    openForm(d.kind, { region, vpc, subnet, optin: d.kind === "region" ? region : null }, true);
  }
