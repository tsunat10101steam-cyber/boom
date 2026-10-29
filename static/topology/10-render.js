  // ------------------------------------------------------------ 렌더링
  const hasStuff = (v) => v.subnets.some(s => s.resources.length) || v.tgw_attachments.length ||
    v.gateway_endpoints.length || S.peerings.some(p => p.a.vpc === v.id || p.b.vpc === v.id);
  const vpcVisible = (v) => !v.default || S.showDefault || hasStuff(v);
  const reg = (id, kind, data, extra) => S.nodes.set(id, { kind, data, ...extra });

  function render() {
    S.needRender = false;
    S.nodes.clear();
    const D = S.draftOn ? draftView(S.data) : S.data;  // 설계 초안이면 초안에 넣은 것만
    const peer = new Map();
    D.regions.forEach(r => r.peerings.forEach(p => peer.set(p.id, p)));
    S.peerings = [...peer.values()];
    S.peerings.forEach(p => reg(p.id, "pcx", p, {}));
    // AWS 의 모든 리전을 지도 위 자기 자리에. 내용 있는 리전 = 상자, 빈 리전 = 흐린 빈 자리, 못 쓰는 리전 = 빨강
    const byRegion = new Map(D.regions.map(r => [r.region, r]));
    const codes = [...new Set([...Object.keys(GEO), ...Object.keys(S.data.region_status || {}), ...byRegion.keys()])]
      .sort((a, b) => (GEO[a]?.[1] ?? 999) - (GEO[b]?.[1] ?? 999) || a.localeCompare(b));
    // 설계 초안은 지도 없는 빈 화면: 넣은 리전만 상자로 (빈 자리 · 못 쓰는 리전 표시 없음)
    const html = S.draftOn ? D.regions.map(regionHTML).join("")
      : codes.map(code => byRegion.has(code) ? regionHTML(byRegion.get(code)) || slotHTML(code, null) : slotHTML(code, regionBlock(code))).join("");
    $t("topoRegions").innerHTML = (D.global ? globalHTML(D.global) : "") + html + (S.draftOn ? annotHTML() : "");
    applyOffsets();
    layoutMap();
    const anyContent = !!document.querySelector("#topoRegions .t-region:not(.slot)");
    if (S.draftOn) $t("topoRegions").classList.toggle("t-draft-empty", !anyContent);

    let nv = 0, ns = 0, ni = 0, nr = 0, nb = 0;
    for (const [, n] of S.nodes) {
      if (n.kind === "vpc") nv++; else if (n.kind === "subnet") ns++;
      else if (n.kind === "region" && !n.slot) nr++;
      else if (n.kind === "res" && n.data.type === "EC2") ni++;
      else if (n.kind === "res" && n.data.type === "S3") nb++;
    }
    $t("tStats").textContent = t("t_stats", { r: nr, v: nv, s: ns, i: ni, b: nb, p: S.peerings.length, t: S.data.as_of });
    $t("tWarn").textContent = S.data.warnings.length ? t("warnings_n", { n: S.data.warnings.length }) : "";
    $t("tWarn").title = S.data.warnings.map(warnText).join("\n");
    msg(anyContent ? "" : t(S.draftOn ? "dr_empty" : S.showDefault ? "t_no_vpc" : "t_only_default"));
    if (S.sel && !S.nodes.has(S.sel)) select(null);

    requestAnimationFrame(() => {
      measure();
      if (!S.fitted) { fit(true); S.fitted = true; }
      clampView();
      drawLines();
      if (S.sel) markSel();
      if (S.delSel.size) markDel();
      if (S.pendingFocus && S.rects.has(S.pendingFocus)) focus(S.pendingFocus);
      S.pendingFocus = null;
      S.viewDirty = true;
    });
  }

  function regionHTML(r) {
    const vpcs = S.draftOn ? r.vpcs : r.vpcs.filter(vpcVisible), buckets = [...(r.buckets || []), ...(r.services || [])];  // 리전 서비스 (VPC 밖)
    const empty = !vpcs.length && !r.tgws.length && !buckets.length;
    if (empty && !S.draftOn) return "";  // 초안에서는 넣어 둔 리전이면 비어 있어도 상자로
    reg(r.region, "region", r, { region: r.region });
    const name = regionName(r.region);
    const azs = r.azs?.length ? r.azs : [...new Set(vpcs.flatMap(v => v.subnets.map(s => s.az)))].sort();
    r.tgws.forEach(t => reg(t.id, "tgw", t, { region: r.region }));
    buckets.forEach(b => reg(b.id, "res", b, { region: r.region }));
    return `<section class="t-region" data-region="${esc(r.region)}">
      <header>${icon("region", 22)}<span class="t-rname">${esc(name)}</span><span class="t-rcode mono">${esc(r.region)}</span>
        <span class="t-azlist">${azs.map(a => `<span class="t-tag">${esc(a)}</span>`).join("")}</span></header>
      ${empty ? `<div class="t-slot-note">${esc(t("dr_region_hint"))}</div>` : ""}
      <div class="t-vpcs">${vpcs.map(v => vpcHTML(r, v)).join("")}</div>
      ${r.tgws.length ? `<div class="t-tgws">${r.tgws.map(t =>
        `<span class="t-node t-tgw" data-node="${esc(t.id)}">${icon("tgw")}Transit Gateway · ${esc(t.name || t.id)}</span>`).join("")}</div>` : ""}
      ${buckets.length ? `<div class="t-svcs"><div class="t-svcs-h">${esc(t("t_region_svcs"))}</div>${buckets.map(resHTML).join("")}</div>` : ""}
    </section>`;
  }

  // 글로벌: 리전에 속하지 않는 서비스 (Route 53 · CloudFront · IAM). 리전 상자처럼 옮기고 감쌀 수 있게 같은 구조로
  function globalHTML(g) {
    const groups = [["Route 53", "r53", g.zones], ["CloudFront", "cf", g.dists], [t("t_iam_users"), "iamu", g.users],
                    [t("t_iam_roles"), "iamr", g.roles], ["ACM", "acm", g.certs || []]].filter(([, , list]) => list.length);
    if (!groups.length && !S.draftOn) return "";
    reg("global", "global", g, {});
    groups.forEach(([, , list]) => list.forEach(x => reg(x.id, "res", x, { global: true })));
    return `<section class="t-region t-global" data-region="global">
      <header>${icon("global", 22)}<span class="t-rname">${esc(t("t_global"))}</span><span class="t-rcode mono">global</span></header>
      ${groups.length ? "" : `<div class="t-slot-note">${esc(t("dr_global_hint"))}</div>`}
      ${groups.map(([title, ic, list]) => `<div class="t-svcs"><div class="t-svcs-h">${icon(ic, 14)} ${esc(title)} <span class="muted">(${list.length})</span>${
        ic === "iamr" && g.hidden_roles ? ` <span class="muted">· ${esc(t("t_hidden_roles", { n: g.hidden_roles }))}</span>` : ""}</div>${list.map(resHTML).join("")}</div>`).join("")}
    </section>`;
  }

  // 이 계정에서 못 쓰는 리전인지: 옵트인 안 함 / 다른 파티션(GovCloud·중국) / 스캔 오류(권한·응답 없음)
  function regionBlock(code) {
    const st = S.data.region_status || {};
    if (st[code] === "not-opted-in") return "optin";
    const w = S.data.warnings.find(x => x.region === code && !x.type);
    if (w) return w.code === "timeout" ? "timeout" : "denied";
    if (Object.keys(st).length && !(code in st)) return "partition";
    return null;
  }

  // 리소스가 없는 리전: 상자 없이 흐린 빈 자리 (리소스가 생기면 상자로 바뀐다). block 이 있으면 빨강
  function slotHTML(code, block) {
    const accessible = !block;
    reg(code, "region", byRegionData(code) || { region: code, vpcs: [], tgws: [], buckets: [] },
      { region: code, slot: true, block });
    return `<section class="t-region slot ${block ? "blocked" : ""}" data-region="${esc(code)}" title="${esc(block ? t("t_reg_" + block) : "")}">
      <header>${icon("region", 18)}<span class="t-rname">${esc(regionName(code))}</span><span class="t-rcode mono">${esc(code)}</span></header>
      <div class="t-slot-note">${esc(block ? t("t_reg_" + block) : (accessible ? t("t_reg_empty") : ""))}</div>
    </section>`;
  }
  const byRegionData = (code) => S.data.regions.find(r => r.region === code);

  function vpcHTML(r, v) {
    reg(v.id, "vpc", v, { region: r.region });
    if (v.igw) reg(v.igw, "igw", { id: v.igw, vpc: v.id }, { region: r.region, vpc: v.id });
    v.route_tables.forEach(rt => reg(rt.id, "rt", rt, { region: r.region, vpc: v.id }));
    v.tgw_attachments.forEach(a => reg(a.id, "att", a, { region: r.region, vpc: v.id }));
    v.gateway_endpoints.forEach(e => reg(e.id, "res", e, { region: r.region, vpc: v.id }));
    const byAz = {};
    v.subnets.forEach(s => (byAz[s.az] ||= []).push(s));
    const peers = S.peerings.filter(p => p.a.vpc === v.id || p.b.vpc === v.id);
    const title = v.name || (v.default ? t("t_default_vpc") : v.id);
    return `<div class="t-vpc ${v.default ? "default" : ""}" data-node="${esc(v.id)}">
      ${v.igw ? `<span class="t-node t-igw" data-node="${esc(v.igw)}">${icon("igw")}IGW</span>` : ""}
      <div class="t-vpc-h">${icon("vpc", 20)}<b>${esc(title)}</b><span class="mono muted">${esc(v.cidr)}</span>
        ${v.default ? '<span class="t-tag">default</span>' : ""}<span class="mono muted t-id">${esc(v.id)}</span></div>
      <div class="t-azs">${Object.keys(byAz).sort().map(az => `<div class="t-az"><div class="t-az-h">${esc(az)}</div>
        ${byAz[az].map(s => subnetHTML(r, v, s)).join("")}</div>`).join("") || `<span class="muted">${esc(t("t_no_subnet"))}</span>`}</div>
      <div class="t-vpc-f">
        ${v.route_tables.map(rt => `<span class="t-node t-rt" data-node="${esc(rt.id)}">${icon("rt", 16)}${esc(rt.name || rt.id)}${rt.main ? " · main" : ""}</span>`).join("")}
        ${v.gateway_endpoints.map(resHTML).join("")}
        ${peers.map(p => `<span class="t-node t-pcx ${esc(p.status)}" data-node="${esc(p.id)}">${icon("pcx", 16)}${esc(p.name || p.id)} · ${esc(p.status)}</span>`).join("")}
        ${v.tgw_attachments.map(a => `<span class="t-node t-att" data-node="${esc(a.id)}">${icon("tgw", 16)}${esc(t("t_tgw_att"))} · ${esc(a.state)}</span>`).join("")}
        ${(v.asgs || []).map(a => { reg(a.id, "res", a, { region: r.region, vpc: v.id }); return asgChip(a); }).join("")}
      </div></div>`;
  }

  function subnetHTML(r, v, s) {
    reg(s.id, "subnet", s, { region: r.region, vpc: v.id });
    const rt = v.route_tables.find(t => t.id === s.rt);
    s.resources.forEach(x => reg(x.id, "res", x, { region: r.region, vpc: v.id, subnet: s.id }));
    return `<div class="t-subnet ${s.public ? "pub" : "priv"}" data-node="${esc(s.id)}">
      <div class="t-sub-h">${icon(s.public ? "pub" : "priv", 16)}<span class="t-sname">${esc(s.name || s.id)}</span>
        <span class="t-badge ${s.public ? "pub" : "priv"}">${s.public ? "Public" : "Private"}</span></div>
      <div class="t-sub-m mono"><span class="t-sub-cidr">${esc(s.cidr)}</span><span class="t-sub-rt"> · ⇄ ${esc(rt?.name || s.rt || "-")}</span></div>
      ${s.resources.map(resHTML).join("")}
    </div>`;
  }

  function resHTML(x) {
    const off = /stopped|stopping/.test(x.state);
    return `<div class="t-node t-res ${off ? "off" : ""} ${x.asg ? "in-asg" : ""}" data-node="${esc(x.id)}" title="${esc(x.type)} · ${esc(x.id)} · ${esc(x.state)}${x.asg ? ` · ASG ${esc(x.asg)}` : ""}">
      ${icon(TYPE_ICON[x.type])}<span class="t-rn">${esc(x.name || x.id)}</span>${badgeHTML(x)}${x.managed?.respawn
        ? `<span class="t-rsp" title="${esc(t("managed_respawn", { by: managerName(x.managed.by) }))}">↻</span>` : ""}</div>`;
  }

  // ------------------------------------------------------------ 세계지도 배치
  // 리전 상자를 지도(등장방형 투영) 위 실제 위치에 놓고, 겹치는 상자는 서로 밀어낸다.
  // 밀려난 상자는 실제 위치의 핀과 가는 선으로 이어 준다. 상자가 크면 지도 배율도 키운다.
  function layoutMap() {
    if (S.draftOn) return layoutBlank();
    const rg = $t("topoRegions");
    const boxes = [...rg.querySelectorAll(".t-region")].map((el, i) => ({ el, i, code: el.dataset.region, w: el.offsetWidth, h: el.offsetHeight }));
    const area = boxes.reduce((a, b) => a + (b.w + BOX_GAP) * (b.h + BOX_GAP), 0);
    const k = Math.max(20, Math.sqrt(area / (360 * (MAP_TOP - MAP_BOTTOM) * 0.2)));  // 1도 = k px
    const proj = ([lon, lat]) => [(lon + 180) * k, (MAP_TOP - lat) * k];
    let unknown = 0;  // 좌표를 모르는 새 리전은 지도 아래쪽에 한 줄로
    for (const b of boxes) {
      const g = b.code === "global" ? GLOBAL_AT : GEO[b.code];
      [b.ax, b.ay] = g ? proj([g[1], g[0]]) : proj([-170 + 14 * unknown++, MAP_BOTTOM + 3]);
      b.x = b.ax - b.w / 2; b.y = b.ay - b.h / 2;
    }
    // 겹침 풀기: 덜 겹친 축으로 밀어내고(작은 상자가 더 많이 움직임), 초반에는 제자리로 살짝 당긴다
    const N = 500;
    for (let it = 0; it < N; it++) {
      let moved = false;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + BOX_GAP;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + BOX_GAP;
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const sa = a.w * a.h, sb = b.w * b.h, wa = sb / (sa + sb), wb = 1 - wa;
        if (ox < oy) {
          const d = Math.sign((a.x + a.w / 2) - (b.x + b.w / 2)) || Math.sign(a.ax - b.ax) || -1;
          a.x += d * ox * wa; b.x -= d * ox * wb;
        } else {
          const d = Math.sign((a.y + a.h / 2) - (b.y + b.h / 2)) || Math.sign(a.ay - b.ay) || -1;
          a.y += d * oy * wa; b.y -= d * oy * wb;
        }
      }
      if (it < N * 0.6) for (const b of boxes) { b.x += (b.ax - b.w / 2 - b.x) * 0.03; b.y += (b.ay - b.h / 2 - b.y) * 0.03; }
      else if (!moved) break;
    }
    // 편집기에서 옮긴 리전은 자동 위치 + 이동량. 지도 + 상자 전체가 들어가도록 원점을 옮긴다
    const off = (b) => S.offsets["R:" + b.code] || [0, 0];
    for (const b of boxes) b.el.style.translate = S.offsets["R:" + b.code] ? `${off(b)[0]}px ${off(b)[1]}px` : "";
    const mapW = 360 * k, mapH = (MAP_TOP - MAP_BOTTOM) * k;
    const minX = Math.min(0, ...boxes.map(b => b.x + off(b)[0])), minY = Math.min(0, ...boxes.map(b => b.y + off(b)[1]));
    const maxX = Math.max(mapW, ...boxes.map(b => b.x + off(b)[0] + b.w)), maxY = Math.max(mapH, ...boxes.map(b => b.y + off(b)[1] + b.h));
    const dx = MAP_PAD - minX, dy = MAP_PAD - minY;
    for (const b of boxes) {
      b.el.style.left = `${Math.round(b.x + dx)}px`; b.el.style.top = `${Math.round(b.y + dy)}px`;
      b.px = b.ax + dx; b.py = b.ay + dy;
    }
    S.boxes = boxes;
    S.baseW = Math.ceil(maxX - minX + 2 * MAP_PAD); S.baseH = Math.ceil(maxY - minY + 2 * MAP_PAD);

    const P = (pt) => { const [x, y] = proj(pt); return [x + dx, y + dy]; };
    const ring = (poly) => "M" + poly.map(pt => P(pt).map(v => v.toFixed(1)).join(",")).join("L") + "Z";
    S.land = (window.WORLD_LAND || []).map(poly => poly.map(P));
    S.holes = (window.WORLD_HOLES || []).map(poly => poly.map(P));
    const grid = [];
    for (let lon = -150; lon <= 150; lon += 30) { const [x] = P([lon, 0]); grid.push(`M${x},${dy}V${dy + mapH}`); }
    for (let lat = -30; lat <= 60; lat += 30) { const [, y] = P([0, lat]); grid.push(`M${dx},${y}H${dx + mapW}`); }
    $t("topoMap").innerHTML = `<rect class="t-sea" x="${dx}" y="${dy}" width="${mapW}" height="${mapH}" rx="${k * 2}"/>` +
      `<path class="t-grid" d="${grid.join("")}"/>` +
      `<path class="t-land" fill-rule="evenodd" d="${[...WORLD_LAND, ...WORLD_HOLES].map(ring).join("")}"/><g id="tPins"></g>`;
    drawPins();
  }

  // 설계 초안: 세계지도 없이 상자만. 글로벌 먼저, 리전은 서쪽 → 동쪽 순서로 왼쪽부터 늘어놓고 너무 길면 다음 줄로.
  // 편집기에서 옮긴 만큼(S.offsets "R:...")은 일반 화면처럼 더한다
  const BLANK_ROW = 2600;
  function layoutBlank() {
    const lon = (code) => code === "global" ? -999 : GEO[code]?.[1] ?? 999;
    const boxes = [...$t("topoRegions").querySelectorAll(".t-region")]
      .map(el => ({ el, code: el.dataset.region, w: el.offsetWidth, h: el.offsetHeight }))
      .sort((a, b) => lon(a.code) - lon(b.code) || a.code.localeCompare(b.code));
    const gap = BOX_GAP * 2;
    let x = 0, y = 0, rowH = 0;
    for (const b of boxes) {
      if (x && x + b.w > BLANK_ROW) { x = 0; y += rowH + gap; rowH = 0; }
      b.x = x; b.y = y; x += b.w + gap; rowH = Math.max(rowH, b.h);
    }
    const off = (b) => S.offsets["R:" + b.code] || [0, 0];
    let maxX = 0, maxY = 0;
    for (const b of boxes) {
      b.el.style.translate = S.offsets["R:" + b.code] ? `${off(b)[0]}px ${off(b)[1]}px` : "";
      b.el.style.left = `${b.x + MAP_PAD}px`; b.el.style.top = `${b.y + MAP_PAD}px`;
      b.px = b.x + MAP_PAD + b.w / 2; b.py = b.y + MAP_PAD + b.h / 2;
      maxX = Math.max(maxX, b.x + b.w + off(b)[0]); maxY = Math.max(maxY, b.y + b.h + off(b)[1]);
    }
    S.boxes = boxes;
    S.baseW = Math.ceil(maxX + 2 * MAP_PAD); S.baseH = Math.ceil(maxY + 2 * MAP_PAD);
    for (const el of $t("topoRegions").querySelectorAll(".t-ann")) {
      const o = S.offsets[el.dataset.node] || [0, 0];
      S.baseW = Math.max(S.baseW, Math.ceil(el.offsetLeft + o[0] + el.offsetWidth + MAP_PAD));
      S.baseH = Math.max(S.baseH, Math.ceil(el.offsetTop + o[1] + el.offsetHeight + MAP_PAD));
    }
    S.land = []; S.holes = [];  // 미니맵에도 대륙 없이
    $t("topoMap").innerHTML = '<g id="tPins"></g>';
    drawPins();
  }

  // 리전 핀(실제 위치)과 상자를 잇는 선. 상자를 옮기거나 커지면 다시 그린다. 상자가 바깥으로 나가면 월드도 넓힌다
  function drawPins() {
    let W = S.baseW, H = S.baseH;
    const pins = S.boxes.map(b => {
      const o = S.offsets["R:" + b.code] || [0, 0];
      const x = b.el.offsetLeft + o[0], y = b.el.offsetTop + o[1], w = b.el.offsetWidth, h = b.el.offsetHeight;
      W = Math.max(W, Math.ceil(x + w + MAP_PAD)); H = Math.max(H, Math.ceil(y + h + MAP_PAD));
      const cx = Math.max(x, Math.min(b.px, x + w)), cy = Math.max(y, Math.min(b.py, y + h));
      const cls = b.el.classList.contains("blocked") ? "blocked" : b.el.classList.contains("slot") ? "slot" : "";
      const far = Math.hypot(b.px - cx, b.py - cy) > 4;
      if (b.code === "global" || S.draftOn) return "";  // 글로벌은 실제 위치가 없고, 초안은 지도가 없으니 핀 없음
      return `<g class="t-pin ${cls}">${far ? `<path d="M${b.px},${b.py}L${cx},${cy}"/>` : ""}<circle cx="${b.px}" cy="${b.py}" r="${far ? 7 : 0}"/></g>`;
    }).join("");
    const rg = $t("topoRegions"), svg = $t("topoMap");
    rg.style.width = `${W}px`; rg.style.height = `${H}px`;
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    $t("tPins").innerHTML = pins;
  }
