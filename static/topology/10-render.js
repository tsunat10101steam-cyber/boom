  // ------------------------------------------------------------ 렌더링
  const hasStuff = (v) => v.subnets.some(s => s.resources.length) || v.tgw_attachments.length ||
    v.gateway_endpoints.length || S.peerings.some(p => p.a.vpc === v.id || p.b.vpc === v.id);
  const vpcVisible = (v) => !v.default || S.showDefault || hasStuff(v);
  const reg = (id, kind, data, extra) => S.nodes.set(id, { kind, data, ...extra });

  function render() {
    S.needRender = false;
    S.nodes.clear();
    const peer = new Map();
    S.data.regions.forEach(r => r.peerings.forEach(p => peer.set(p.id, p)));
    S.peerings = [...peer.values()];
    S.peerings.forEach(p => reg(p.id, "pcx", p, {}));
    // AWS 의 모든 리전을 지도 위 자기 자리에. 내용 있는 리전 = 상자, 빈 리전 = 흐린 빈 자리, 못 쓰는 리전 = 빨강
    const byRegion = new Map(S.data.regions.map(r => [r.region, r]));
    const codes = [...new Set([...Object.keys(GEO), ...Object.keys(S.data.region_status || {}), ...byRegion.keys()])]
      .sort((a, b) => (GEO[a]?.[1] ?? 999) - (GEO[b]?.[1] ?? 999) || a.localeCompare(b));
    const html = codes.map(code => byRegion.has(code) ? regionHTML(byRegion.get(code)) || slotHTML(code, null) : slotHTML(code, regionBlock(code))).join("");
    $t("topoRegions").innerHTML = html;
    applyOffsets();
    layoutMap();
    const anyContent = !!document.querySelector("#topoRegions .t-region:not(.slot)");

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
    msg(anyContent ? "" : t(S.showDefault ? "t_no_vpc" : "t_only_default"));
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
    const vpcs = r.vpcs.filter(vpcVisible), buckets = r.buckets || [];
    if (!vpcs.length && !r.tgws.length && !buckets.length) return "";
    reg(r.region, "region", r, { region: r.region });
    const name = regionName(r.region);
    const azs = r.azs?.length ? r.azs : [...new Set(vpcs.flatMap(v => v.subnets.map(s => s.az)))].sort();
    r.tgws.forEach(t => reg(t.id, "tgw", t, { region: r.region }));
    buckets.forEach(b => reg(b.id, "res", b, { region: r.region }));
    return `<section class="t-region" data-region="${esc(r.region)}">
      <header>${icon("region", 22)}<span class="t-rname">${esc(name)}</span><span class="t-rcode mono">${esc(r.region)}</span>
        <span class="t-azlist">${azs.map(a => `<span class="t-tag">${esc(a)}</span>`).join("")}</span></header>
      <div class="t-vpcs">${vpcs.map(v => vpcHTML(r, v)).join("")}</div>
      ${r.tgws.length ? `<div class="t-tgws">${r.tgws.map(t =>
        `<span class="t-node t-tgw" data-node="${esc(t.id)}">${icon("tgw")}Transit Gateway · ${esc(t.name || t.id)}</span>`).join("")}</div>` : ""}
      ${buckets.length ? `<div class="t-svcs"><div class="t-svcs-h">${esc(t("t_region_svcs"))}</div>${buckets.map(resHTML).join("")}</div>` : ""}
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
      </div></div>`;
  }

  function subnetHTML(r, v, s) {
    reg(s.id, "subnet", s, { region: r.region, vpc: v.id });
    const rt = v.route_tables.find(t => t.id === s.rt);
    s.resources.forEach(x => reg(x.id, "res", x, { region: r.region, vpc: v.id, subnet: s.id }));
    return `<div class="t-subnet" data-node="${esc(s.id)}">
      <div class="t-sub-h">${icon(s.public ? "pub" : "priv", 16)}<span class="t-sname">${esc(s.name || s.id)}</span>
        <span class="t-badge ${s.public ? "pub" : "priv"}">${s.public ? "Public" : "Private"}</span></div>
      <div class="t-sub-m mono">${esc(s.cidr)} · ⇄ ${esc(rt?.name || s.rt || "-")}</div>
      ${s.resources.map(resHTML).join("")}
    </div>`;
  }

  function resHTML(x) {
    const off = /stopped|stopping/.test(x.state);
    return `<div class="t-node t-res ${off ? "off" : ""}" data-node="${esc(x.id)}" title="${esc(x.type)} · ${esc(x.id)} · ${esc(x.state)}">
      ${icon(TYPE_ICON[x.type])}<span class="t-rn">${esc(x.name || x.id)}</span>${x.managed?.respawn
        ? `<span class="t-rsp" title="${esc(t("managed_respawn", { by: managerName(x.managed.by) }))}">↻</span>` : ""}</div>`;
  }

  // ------------------------------------------------------------ 세계지도 배치
  // 리전 상자를 지도(등장방형 투영) 위 실제 위치에 놓고, 겹치는 상자는 서로 밀어낸다.
  // 밀려난 상자는 실제 위치의 핀과 가는 선으로 이어 준다. 상자가 크면 지도 배율도 키운다.
  function layoutMap() {
    const rg = $t("topoRegions");
    const boxes = [...rg.querySelectorAll(".t-region")].map((el, i) => ({ el, i, code: el.dataset.region, w: el.offsetWidth, h: el.offsetHeight }));
    const area = boxes.reduce((a, b) => a + (b.w + BOX_GAP) * (b.h + BOX_GAP), 0);
    const k = Math.max(20, Math.sqrt(area / (360 * (MAP_TOP - MAP_BOTTOM) * 0.2)));  // 1도 = k px
    const proj = ([lon, lat]) => [(lon + 180) * k, (MAP_TOP - lat) * k];
    let unknown = 0;  // 좌표를 모르는 새 리전은 지도 아래쪽에 한 줄로
    for (const b of boxes) {
      const g = GEO[b.code];
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
      return `<g class="t-pin ${cls}">${far ? `<path d="M${b.px},${b.py}L${cx},${cy}"/>` : ""}<circle cx="${b.px}" cy="${b.py}" r="${far ? 7 : 0}"/></g>`;
    }).join("");
    const rg = $t("topoRegions"), svg = $t("topoMap");
    rg.style.width = `${W}px`; rg.style.height = `${H}px`;
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    $t("tPins").innerHTML = pins;
  }
