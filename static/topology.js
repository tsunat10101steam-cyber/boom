"use strict";
// 토폴로지(아키텍처) 뷰.
// 리전(세계지도 위 실제 위치) > VPC > AZ > 서브넷 > 리소스, 그리고 피어링/TGW/라우팅 연결선.
// 마우스를 화면 가장자리에 대면 그 방향으로 이동, 휠 = 확대/축소, 드래그 = 이동.
// index.html 의 전역(api, esc, checked, identity, TYPE_COLORS)을 사용한다.
(() => {
  // 리전 위치 [위도, 경도] (데이터센터가 있는 도시 기준). 세계지도 위 이 자리에 리전 상자를 놓는다. 이름은 i18n.js 의 regionName()
  const GEO = {"us-west-1": [37.4, -122], "us-west-2": [45.8, -119.7], "us-gov-west-1": [45.5, -122.7], "ca-west-1": [51, -114],
    "mx-central-1": [20.6, -100.4], "us-east-2": [40, -83], "us-east-1": [38.9, -77.5], "us-gov-east-1": [39.9, -82.9],
    "ca-central-1": [45.5, -73.6], "sa-east-1": [-23.5, -46.6], "eu-west-1": [53.3, -6.3], "eu-south-2": [41.6, -0.9],
    "eu-west-2": [51.5, -0.1], "eu-west-3": [48.9, 2.35], "eu-central-1": [50.1, 8.7], "eu-central-2": [47.4, 8.5],
    "eu-south-1": [45.5, 9.2], "eu-north-1": [59.3, 18.1], "af-south-1": [-33.9, 18.4], "il-central-1": [32.1, 34.8],
    "me-south-1": [26.1, 50.6], "me-central-1": [24.5, 54.4], "ap-south-1": [19.1, 72.9], "ap-south-2": [17.4, 78.5],
    "ap-southeast-7": [13.75, 100.5], "ap-southeast-5": [3.1, 101.7], "ap-southeast-1": [1.35, 103.8], "ap-southeast-3": [-6.2, 106.8],
    "cn-northwest-1": [38.5, 106.3], "cn-north-1": [39.9, 116.4], "ap-east-1": [22.3, 114.2], "ap-east-2": [25, 121.5],
    "ap-northeast-2": [37.6, 127], "ap-northeast-3": [34.7, 135.5], "ap-northeast-1": [35.7, 139.7], "ap-southeast-4": [-37.8, 145],
    "ap-southeast-2": [-33.9, 151.2], "ap-southeast-6": [-36.8, 174.8]};
  const MAP_TOP = 84, MAP_BOTTOM = -56, MAP_PAD = 220, BOX_GAP = 48;  // 지도에 그릴 위도 범위, 바깥 여백, 상자 사이 간격
  const EDGE = 56, EDGE_SPEED = 1300;

  // 서비스 아이콘 (AWS 아키텍처 아이콘 느낌의 자체 제작 SVG: 카테고리 색 사각형 + 흰 선 그림)
  const C = { compute: "#ED7100", storage: "#7AA116", net: "#8C4FFF", db: "#2E73B8", vpc: "#d946ef", region: "#14b8a6", priv: "#5b6b82" };
  const ICONS = {
    ec2: [C.compute, '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3"/>'],
    s3: [C.storage, '<path d="M5 7c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5S5 8.4 5 7z"/><path d="M5 7l1.6 10.2c.2 1.3 2.6 2.3 5.4 2.3s5.2-1 5.4-2.3L19 7"/>'],
    rds: [C.db, '<ellipse cx="12" cy="6.5" rx="6" ry="2.5"/><path d="M6 6.5v11c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-11M6 12c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5"/>'],
    nat: [C.net, '<circle cx="12" cy="12" r="7"/><path d="M8 12h7.5M13 9l3 3-3 3"/>'],
    elb: [C.net, '<circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 12h8M7.8 11l8.4-4.1M7.8 13l8.4 4.1"/>'],
    ep: [C.net, '<path d="M9 4v4M15 4v4M7 8h10v3a5 5 0 0 1-10 0zM12 16v4"/>'],
    igw: [C.net, '<circle cx="12" cy="12" r="7.5"/><path d="M4.5 12h15M12 4.5c2.3 2.3 2.3 12.7 0 15M12 4.5c-2.3 2.3-2.3 12.7 0 15"/>'],
    tgw: [C.net, '<circle cx="12" cy="12" r="2.5"/><circle cx="5.5" cy="5.5" r="1.6"/><circle cx="18.5" cy="5.5" r="1.6"/><circle cx="5.5" cy="18.5" r="1.6"/><circle cx="18.5" cy="18.5" r="1.6"/><path d="M6.7 6.7l3.5 3.5M17.3 6.7l-3.5 3.5M6.7 17.3l3.5-3.5M17.3 17.3l-3.5-3.5"/>'],
    rt: [C.net, '<rect x="5" y="5" width="14" height="14" rx="1.5"/><path d="M5 10h14M5 14.5h14M10 5v14"/>'],
    pcx: [C.net, '<circle cx="7" cy="12" r="3.2"/><circle cx="17" cy="12" r="3.2"/><path d="M10.2 12h3.6"/>'],
    vpc: [C.vpc, '<path d="M7.5 17.5h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1A4 4 0 0 0 7.5 17.5z"/>'],
    region: [C.region, '<path d="M6.5 20V4M6.5 5h11l-2.6 3.5L17.5 12h-11"/>'],
    pub: [C.storage, '<circle cx="12" cy="12" r="7"/><path d="M5 12h14M12 5c2 2 2 12 0 14M12 5c-2 2-2 12 0 14"/>'],
    priv: [C.priv, '<rect x="7" y="11" width="10" height="8" rx="1.5"/><path d="M9 11V8.5a3 3 0 0 1 6 0V11"/>'],
  };
  const TYPE_ICON = { "EC2": "ec2", "S3": "s3", "RDS": "rds", "NAT Gateway": "nat", "ELB": "elb", "VPC Endpoint": "ep" };
  const icon = (key, size = 18) => {
    const [bg, glyph] = ICONS[key] || ICONS.ec2;
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="${bg}"/>` +
      `<g fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;
  };

  const $t = (id) => document.getElementById(id);
  const S = {
    on: false, data: null, peerings: [], x: 0, y: 0, s: 1, goal: null, W: 1, H: 1,
    mx: -1, my: -1, inside: false, overUI: false, drag: null, dragged: false,
    nodes: new Map(), rects: new Map(), regionRects: [], vpcRects: [], sel: null, hover: null,
    showDefault: false, showRoutes: false, fitted: false, linesDirty: false, viewDirty: true, creators: {},
  };

  // ------------------------------------------------------------ 진입 / 종료
  function enter() {
    if (S.on) return;
    S.on = true;
    document.body.classList.add("topo-on");
    $t("topo").classList.remove("hidden");
    // 앱 창 자체를 테두리 없는 창으로 (게임처럼 바탕화면·작업 표시줄이 안 보이고, Esc 로 풀리지 않음).
    // 브라우저 전체화면(Fullscreen API)은 'Esc 를 길게 누르세요' 안내와 X 버튼이 떠서 쓰지 않는다.
    windowMode("borderless").then(async (r) => {
      if (!r.ok) return toast(t("t_borderless_failed", { r: t("err." + (r.reason || "win_failed"), { detail: r.detail }) }));
      // Edge 가 직접 그리는 제목 표시줄/가장자리가 남아 있으면 그 두께만큼 창을 화면 밖으로 밀어낸다
      await new Promise(res => setTimeout(res, 250));
      const dpr = devicePixelRatio || 1;
      const side = Math.max(0, Math.round((outerWidth - innerWidth) / 2 * dpr));
      const top = Math.max(0, Math.round((outerHeight - innerHeight) * dpr) - side);
      if (S.on && (side || top)) await windowMode("borderless", { left: side, top, right: side, bottom: side });
    }, (e) => toast(t("t_borderless_failed", { r: e.message })));
    if (!S.data) load();
    else requestAnimationFrame(() => { measure(); drawLines(); clampView(); S.viewDirty = true; });
  }
  function exit() {
    if (!S.on) return;
    S.on = false;
    closeMenu(); closeForm();
    windowMode("normal").catch(() => {});
    document.body.classList.remove("topo-on");
    $t("topo").classList.add("hidden");
  }
  // 서버가 '이 창'을 정확히 찾도록 제목에 일회용 태그를 잠깐 붙였다가 되돌린다 (Boom 창이 여러 개여도 안전)
  function windowMode(mode, crop) {
    const tag = `Boom·${Math.random().toString(36).slice(2, 8)}`;
    document.title = tag;
    return api("/api/window", { mode, title: tag, crop }).finally(() => { document.title = "Boom"; });
  }

  async function load() {
    msg(t("t_loading"));
    $t("tRefresh").disabled = true;
    try {
      S.data = await api("/api/topology", { regions: [] });  // 켜진 리전 전부 (대시보드 스캔 범위와 무관)
      render();
    } catch (e) {
      msg(identity ? t("t_load_failed", { e: e.message }) : t("err.need_connect"));
    }
    $t("tRefresh").disabled = false;
  }
  function msg(text) {
    const m = $t("tMsg");
    m.textContent = text || "";
    m.classList.toggle("hidden", !text);
  }

  // ------------------------------------------------------------ 렌더링
  const hasStuff = (v) => v.subnets.some(s => s.resources.length) || v.tgw_attachments.length ||
    v.gateway_endpoints.length || S.peerings.some(p => p.a.vpc === v.id || p.b.vpc === v.id);
  const vpcVisible = (v) => !v.default || S.showDefault || hasStuff(v);
  const reg = (id, kind, data, extra) => S.nodes.set(id, { kind, data, ...extra });

  function render() {
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
    // 지도 + 상자 전체가 들어가도록 원점을 옮긴다
    const mapW = 360 * k, mapH = (MAP_TOP - MAP_BOTTOM) * k;
    const minX = Math.min(0, ...boxes.map(b => b.x)), minY = Math.min(0, ...boxes.map(b => b.y));
    const maxX = Math.max(mapW, ...boxes.map(b => b.x + b.w)), maxY = Math.max(mapH, ...boxes.map(b => b.y + b.h));
    const dx = MAP_PAD - minX, dy = MAP_PAD - minY, W = Math.ceil(maxX - minX + 2 * MAP_PAD), H = Math.ceil(maxY - minY + 2 * MAP_PAD);
    for (const b of boxes) { b.el.style.left = `${Math.round(b.x + dx)}px`; b.el.style.top = `${Math.round(b.y + dy)}px`; }
    rg.style.width = `${W}px`; rg.style.height = `${H}px`;

    const P = (pt) => { const [x, y] = proj(pt); return [x + dx, y + dy]; };
    const ring = (poly) => "M" + poly.map(pt => P(pt).map(v => v.toFixed(1)).join(",")).join("L") + "Z";
    S.land = (window.WORLD_LAND || []).map(poly => poly.map(P));
    S.holes = (window.WORLD_HOLES || []).map(poly => poly.map(P));
    const grid = [];
    for (let lon = -150; lon <= 150; lon += 30) { const [x] = P([lon, 0]); grid.push(`M${x},${dy}V${dy + mapH}`); }
    for (let lat = -30; lat <= 60; lat += 30) { const [, y] = P([0, lat]); grid.push(`M${dx},${y}H${dx + mapW}`); }
    const pins = boxes.map(b => {
      const px = b.ax + dx, py = b.ay + dy, x = b.x + dx, y = b.y + dy;
      const cx = Math.max(x, Math.min(px, x + b.w)), cy = Math.max(y, Math.min(py, y + b.h));
      const cls = b.el.classList.contains("blocked") ? "blocked" : b.el.classList.contains("slot") ? "slot" : "";
      const far = Math.hypot(px - cx, py - cy) > 4;
      return `<g class="t-pin ${cls}">${far ? `<path d="M${px},${py}L${cx},${cy}"/>` : ""}<circle cx="${px}" cy="${py}" r="${far ? 7 : 0}"/></g>`;
    }).join("");
    const svg = $t("topoMap");
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.innerHTML = `<rect class="t-sea" x="${dx}" y="${dy}" width="${mapW}" height="${mapH}" rx="${k * 2}"/>` +
      `<path class="t-grid" d="${grid.join("")}"/>` +
      `<path class="t-land" fill-rule="evenodd" d="${[...WORLD_LAND, ...WORLD_HOLES].map(ring).join("")}"/>` + pins;
  }

  // ------------------------------------------------------------ 좌표 측정 / 연결선
  function measure() {
    const wr = $t("topoWorld").getBoundingClientRect();
    const toWorld = (el) => {
      const r = el.getBoundingClientRect();
      return { x: (r.left - wr.left) / S.s, y: (r.top - wr.top) / S.s, w: r.width / S.s, h: r.height / S.s };
    };
    S.rects.clear();
    document.querySelectorAll("#topoRegions [data-node]").forEach(n => {
      if (!S.rects.has(n.dataset.node)) S.rects.set(n.dataset.node, toWorld(n));
    });
    S.regionRects = [...document.querySelectorAll("#topoRegions .t-region")].map(n => ({ ...toWorld(n), code: n.dataset.region,
      slot: n.classList.contains("slot"), blocked: n.classList.contains("blocked") }));
    S.vpcRects = [...document.querySelectorAll("#topoRegions .t-vpc")].map(toWorld);
    const rg = $t("topoRegions");
    S.W = rg.offsetWidth; S.H = rg.offsetHeight;
  }

  function curve(a, b) {
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const dx = bc.x - ac.x, dy = bc.y - ac.y;
    let p1, p2, nx = 0, ny = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
      nx = Math.sign(dx) || 1;
      p1 = { x: nx > 0 ? a.x + a.w : a.x, y: ac.y }; p2 = { x: nx > 0 ? b.x : b.x + b.w, y: bc.y };
    } else {
      ny = Math.sign(dy) || 1;
      p1 = { x: ac.x, y: ny > 0 ? a.y + a.h : a.y }; p2 = { x: bc.x, y: ny > 0 ? b.y : b.y + b.h };
    }
    const k = Math.max(50, Math.hypot(dx, dy) * 0.35);
    const c1 = { x: p1.x + nx * k, y: p1.y + ny * k }, c2 = { x: p2.x - nx * k, y: p2.y - ny * k };
    const mid = { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
    return { d: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`, p2, mid };
  }
  function line(a, b, cls, label) {
    const c = curve(a, b);
    return `<path class="${cls}" d="${c.d}"/><circle class="t-end" cx="${c.p2.x}" cy="${c.p2.y}" r="4" style="fill:currentColor"/>` +
      (label ? `<text class="t-lbl" x="${c.mid.x}" y="${c.mid.y - 6}" text-anchor="middle">${esc(label)}</text>` : "");
  }

  function routeSubnets() {
    if (S.showRoutes) return [...S.nodes.values()].filter(n => n.kind === "subnet").map(n => n.data);
    const n = S.nodes.get(S.hover || S.sel);
    if (!n) return [];
    if (n.kind === "subnet") return [n.data];
    if (n.kind === "res" && n.subnet) return [S.nodes.get(n.subnet).data];
    if (n.kind === "rt") return [...S.nodes.values()].filter(x => x.kind === "subnet" && x.data.rt === n.data.id).map(x => x.data);
    return [];
  }
  function routeTarget(target, vpcId) {
    if (target.startsWith("pcx-")) {
      const p = S.peerings.find(p => p.id === target);
      return p ? (p.a.vpc === vpcId ? p.b.vpc : p.a.vpc) : target;
    }
    return target;
  }

  function drawLines() {
    S.linesDirty = false;
    const svg = $t("topoLines");
    svg.setAttribute("width", S.W); svg.setAttribute("height", S.H);
    const out = [];
    for (const p of S.peerings) {
      const a = S.rects.get(p.a.vpc), b = S.rects.get(p.b.vpc);
      if (a && b) out.push(`<g style="color:var(--warn)">${line(a, b, `t-l pcx ${p.status === "active" ? "" : "pending"}`, `${p.name || p.id} · ${p.status}`)}</g>`);
    }
    for (const [, n] of S.nodes) {
      if (n.kind !== "att") continue;
      const a = S.rects.get(n.data.tgw), b = S.rects.get(n.vpc);
      if (a && b) out.push(`<g style="color:#06b6d4">${line(a, b, "t-l tgw", "")}</g>`);
    }
    for (const s of routeSubnets()) {
      const sn = S.nodes.get(s.id), rt = S.nodes.get(s.rt)?.data, a = S.rects.get(s.id);
      if (!rt || !a) continue;
      for (const r of rt.routes) {
        if (r.target === "local") continue;
        const b = S.rects.get(routeTarget(r.target, sn.vpc));
        if (!b) continue;
        const bh = r.state === "blackhole";
        out.push(`<g style="color:var(${bh ? "--danger" : "--accent"})">${line(a, b, `t-l route ${bh ? "bh" : ""}`, S.showRoutes ? "" : r.dest)}</g>`);
      }
    }
    svg.innerHTML = out.join("");
  }

  // ------------------------------------------------------------ 선택 / 인스펙터
  function markSel() {
    document.querySelectorAll("#topoRegions .sel").forEach(n => n.classList.remove("sel"));
    if (S.sel) document.querySelectorAll(`#topoRegions [data-node="${CSS.escape(S.sel)}"]`).forEach(n => n.classList.add("sel"));
  }
  function select(id) {
    S.sel = id;
    markSel();
    S.linesDirty = true;
    const box = $t("tInsp");
    if (!id || !S.nodes.has(id)) { box.classList.add("hidden"); return; }
    box.innerHTML = `<button class="ghost t-close" id="tInspClose" aria-label="${esc(t("close"))}">✕</button>` + inspectHTML(id);
    box.classList.remove("hidden");
    $t("tInspClose").onclick = () => select(null);
  }
  const kv = (k, v) => (v == null || v === "" ? "" : `<div class="t-kv"><span>${k}</span><span>${v}</span></div>`);
  const go = (id, label) => `<a class="t-link" data-go="${esc(id)}">${esc(label || id)}</a>`;
  const goNode = (id) => { const n = S.nodes.get(id); return go(id, n?.data?.name || id); };

  function routesTable(rt, vpcId) {
    return `<table><tr><th>${esc(t("th_dest"))}</th><th>${esc(t("th_target"))}</th><th>${esc(t("th_state"))}</th></tr>${rt.routes.map(r => {
      const t = routeTarget(r.target, vpcId);
      return `<tr><td class="mono">${esc(r.dest)}</td><td>${S.nodes.has(t) ? goNode(t) : esc(r.target)}</td>
        <td class="${r.state === "blackhole" ? "err" : ""}">${esc(r.state)}</td></tr>`;
    }).join("")}</table>`;
  }

  function inspectHTML(id) {
    const n = S.nodes.get(id), d = n.data;
    switch (n.kind) {
      case "region":
        return `<h4>${esc(regionName(id))}</h4><div class="kind">${esc(t("k.region"))} · ${esc(id)}</div>
          ${n.block ? `<div class="err" style="margin-bottom:8px">${esc(t("t_reg_" + n.block))}</div>` : ""}
          ${kv("VPC", (d.vpcs || []).length)}${kv("Transit Gateway", (d.tgws || []).length)}`;
      case "vpc": {
        const peers = S.peerings.filter(p => p.a.vpc === id || p.b.vpc === id);
        return `<h4>${esc(d.name || id)}</h4><div class="kind">VPC · ${esc(regionName(n.region))}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv("CIDR", `<span class="mono">${esc(d.cidr)}</span>`)}
          ${kv(t("f_default"), t(d.default ? "yes" : "no"))}${kv(t("f_igw"), d.igw ? go(d.igw) : t("none_"))}
          ${kv(t("f_subnets"), d.subnets.length)}
          <div class="sec">${esc(t("f_rts"))}</div>${d.route_tables.map(rt => `<div class="t-kv"><span>${go(rt.id, rt.name || rt.id)}${rt.main ? " (main)" : ""}</span><span>${esc(t("subnets_n", { n: rt.subnets.length }))}</span></div>`).join("")}
          ${peers.length ? `<div class="sec">${esc(t("f_peering"))}</div>${peers.map(p => `<div class="t-kv"><span>${go(p.id, p.name || p.id)}</span><span>${esc(p.status)}</span></div>`).join("")}` : ""}
          ${d.tgw_attachments.length ? `<div class="sec">Transit Gateway</div>${d.tgw_attachments.map(a => `<div class="t-kv"><span>${goNode(a.tgw)}</span><span>${esc(a.state)}</span></div>`).join("")}` : ""}
          ${d.gateway_endpoints.length ? `<div class="sec">${esc(t("f_gw_eps"))}</div>${d.gateway_endpoints.map(e => `<div class="t-kv"><span>${go(e.id, e.name)}</span><span>${esc(e.state)}</span></div>`).join("")}` : ""}`;
      }
      case "subnet": {
        const rt = S.nodes.get(d.rt)?.data;
        return `<h4>${esc(d.name || id)}</h4><div class="kind">${esc(t("k.subnet"))} · ${d.public ? "Public" : "Private"} · ${esc(d.az)}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv("CIDR", `<span class="mono">${esc(d.cidr)}</span>`)}
          ${kv("VPC", goNode(n.vpc))}${kv(t("f_free_ips"), d.free_ips)}
          ${kv(t("f_rt"), rt ? `${go(rt.id, rt.name || rt.id)}${rt.main && !rt.subnets.includes(id) ? " " + esc(t("implicit_main")) : ""}` : "-")}
          ${rt ? `<div class="sec">${esc(t("f_routes"))}</div>${routesTable(rt, n.vpc)}` : ""}
          ${d.resources.length ? `<div class="sec">${esc(t("res_n", { n: d.resources.length }))}</div>${d.resources.map(x => `<div class="t-kv"><span>${go(x.id, x.name || x.id)}</span><span>${esc(x.type)} · ${esc(stateText(x.state))}</span></div>`).join("")}` : ""}`;
      }
      case "rt":
        return `<h4>${esc(d.name || id)}</h4><div class="kind">${esc(t("k.rt"))}${d.main ? " · main" : ""}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv("VPC", goNode(n.vpc))}
          <div class="sec">${esc(t("f_routes"))}</div>${routesTable(d, n.vpc)}
          <div class="sec">${esc(t("assoc_subnets"))}</div>
          ${d.subnets.length ? d.subnets.map(s => `<div class="t-kv"><span>${goNode(s)}</span><span>${esc(t("explicit"))}</span></div>`).join("") : ""}
          ${d.main ? `<div class="muted" style="font-size:12px;margin-top:6px">${esc(t("main_note"))}</div>` : ""}`;
      case "pcx":
        return `<h4>${esc(d.name || id)}</h4><div class="kind">${esc(t("k.pcx"))} · ${esc(d.status)}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}
          <div class="sec">${esc(t("requester"))}</div>${kv("VPC", S.nodes.has(d.a.vpc) ? goNode(d.a.vpc) : esc(d.a.vpc))}${kv(t("k.region"), esc(d.a.region))}${kv("CIDR", esc(d.a.cidr))}${kv(t("f_account"), esc(d.a.owner))}
          <div class="sec">${esc(t("accepter"))}</div>${kv("VPC", S.nodes.has(d.b.vpc) ? goNode(d.b.vpc) : esc(d.b.vpc))}${kv(t("k.region"), esc(d.b.region))}${kv("CIDR", esc(d.b.cidr))}${kv(t("f_account"), esc(d.b.owner))}`;
      case "tgw": {
        const atts = [...S.nodes.values()].filter(x => x.kind === "att" && x.data.tgw === id);
        return `<h4>${esc(d.name || id)}</h4><div class="kind">Transit Gateway · ${esc(d.state)}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}
          <div class="sec">${esc(t("attached_vpcs"))}</div>${atts.map(a => `<div class="t-kv"><span>${goNode(a.vpc)}</span><span>${esc(a.data.state)}</span></div>`).join("") || `<div class="muted">${esc(t("none_"))}</div>`}`;
      }
      case "att":
        return `<h4>${esc(t("k.att"))}</h4><div class="kind">${esc(d.state)}</div>${kv("ID", `<span class="mono">${esc(id)}</span>`)}
          ${kv("Transit Gateway", S.nodes.has(d.tgw) ? goNode(d.tgw) : esc(d.tgw))}${kv("VPC", goNode(n.vpc))}`;
      case "igw":
        return `<h4>${esc(t("k.igw"))}</h4><div class="kind">IGW</div>${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv("VPC", goNode(n.vpc))}`;
      default:
        return `<h4>${esc(d.name || id)}</h4><div class="kind">${esc(d.type)} · ${esc(stateText(d.state))}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv(t("col_detail"), esc(d.detail))}
          ${kv(t("f_priv_ip"), esc(d.private_ip))}${kv(t("f_pub_ip"), esc(d.public_ip))}
          ${kv(t("f_sgs"), d.sgs?.length ? esc(d.sgs.join(", ")) : "")}
          ${d.managed ? kv(t("f_managed"), managedBadge(d.managed)) : ""}
          ${n.region ? kv(t("f_creator"), S.creators[id] ? whoText(S.creators[id]) : `<a class="t-link" data-who="${esc(id)}">${esc(t("lookup_ct"))}</a>`) : ""}
          ${n.subnet ? kv(t("k.subnet"), goNode(n.subnet)) : ""}${kv("VPC", goNode(n.vpc))}${kv(t("k.region"), esc(regionName(n.region)))}`;
    }
  }

  async function lookupWho(id) {
    const n = S.nodes.get(id);
    S.creators[id] = { loading: true }; select(id);
    try { S.creators[id] = await api("/api/creator", { region: n.region, id, type: n.data.type }); }
    catch (e) { S.creators[id] = { error: e.message }; }
    if (S.sel === id) select(id);
  }

  // ------------------------------------------------------------ 이동 / 확대
  // 움직이는 동안만 will-change 로 비트맵을 늘려 부드럽게 그리고, 멈추면 풀어서 지금 배율로 다시 그리게 한다.
  // (계속 켜 두면 처음 배율의 그림을 확대만 해서 글자·선이 흐려진다)
  function apply() {
    const w = $t("topoWorld");
    w.style.willChange = "transform";
    w.style.transform = `translate(${Math.round(S.x)}px, ${Math.round(S.y)}px) scale(${S.s})`;
    clearTimeout(S.crispTimer);
    S.crispTimer = setTimeout(() => { w.style.willChange = "auto"; }, 180);
    drawMini();
  }
  function clampView() {
    const fitAxis = (v, view, size) => (size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, v)));
    S.x = fitAxis(S.x, innerWidth, S.W * S.s);
    S.y = fitAxis(S.y, innerHeight, S.H * S.s);
  }
  function fit(instant) {
    const s = Math.max(0.12, Math.min(1, Math.min(innerWidth / S.W, (innerHeight - 60) / S.H)));
    const g = { s, x: (innerWidth - S.W * s) / 2, y: (innerHeight - S.H * s) / 2 + 30 };
    if (instant) Object.assign(S, g, { goal: null }); else S.goal = g;
    S.viewDirty = true;
  }
  function zoomAt(px, py, factor) {
    const ns = Math.max(0.12, Math.min(2.5, S.s * factor));
    S.x = px - (px - S.x) * ns / S.s; S.y = py - (py - S.y) * ns / S.s; S.s = ns;
    S.goal = null; clampView(); S.viewDirty = true;
  }
  function focus(id) {
    const r = S.rects.get(id);
    if (!r) return;
    select(id);
    const s = Math.max(S.s, 0.7);
    S.goal = { s, x: innerWidth / 2 - (r.x + r.w / 2) * s, y: innerHeight / 2 - (r.y + r.h / 2) * s };
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    if (S.on && S.data) {
      let vx = 0, vy = 0;
      if (S.inside && !S.drag && !S.rdrag && !S.overUI && !S.menuOpen && !S.formOpen) {
        if (S.mx < EDGE) vx = EDGE_SPEED * (1 - S.mx / EDGE);
        else if (S.mx > innerWidth - EDGE) vx = -EDGE_SPEED * (1 - (innerWidth - S.mx) / EDGE);
        if (S.my < EDGE) vy = EDGE_SPEED * (1 - S.my / EDGE);
        else if (S.my > innerHeight - EDGE) vy = -EDGE_SPEED * (1 - (innerHeight - S.my) / EDGE);
      }
      $t("tEdgeL").classList.toggle("act", vx > 0); $t("tEdgeR").classList.toggle("act", vx < 0);
      $t("tEdgeT").classList.toggle("act", vy > 0); $t("tEdgeB").classList.toggle("act", vy < 0);
      if (vx || vy) {
        const px = S.x, py = S.y;
        S.x += vx * dt; S.y += vy * dt; S.goal = null; clampView();
        if (px !== S.x || py !== S.y) S.viewDirty = true;
      }
      if (S.goal) {
        const g = S.goal, k = 1 - Math.pow(0.001, dt);
        S.x += (g.x - S.x) * k; S.y += (g.y - S.y) * k; S.s += (g.s - S.s) * k;
        if (Math.abs(g.x - S.x) < 0.5 && Math.abs(g.y - S.y) < 0.5 && Math.abs(g.s - S.s) < 0.002) {
          Object.assign(S, { x: g.x, y: g.y, s: g.s }); S.goal = null; clampView();
        }
        S.viewDirty = true;
      }
      if (S.linesDirty) drawLines();
      if (S.viewDirty) { S.viewDirty = false; apply(); }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ------------------------------------------------------------ 미니맵
  function drawMini() {
    const c = $t("tMini"), dpr = devicePixelRatio || 1, cw = 220, ch = 130;
    if (c.width !== cw * dpr) { c.width = cw * dpr; c.height = ch * dpr; }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);
    const m = Math.min(cw / S.W, ch / S.H), ox = (cw - S.W * m) / 2, oy = (ch - S.H * m) / 2;
    S.mini = { m, ox, oy };
    const cs = getComputedStyle(document.documentElement), v = (k) => cs.getPropertyValue(k).trim();
    g.lineWidth = 1;
    if (S.land) {
      g.beginPath();
      for (const poly of [...S.land, ...S.holes]) poly.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](ox + x * m, oy + y * m));
      g.fillStyle = v("--line"); g.fill("evenodd");
    }
    for (const r of S.regionRects) {
      g.globalAlpha = r.slot ? 0.45 : 1;
      g.fillStyle = v("--panel2"); g.strokeStyle = r.blocked ? v("--danger") : C.region;
      g.fillRect(ox + r.x * m, oy + r.y * m, r.w * m, r.h * m); g.strokeRect(ox + r.x * m, oy + r.y * m, r.w * m, r.h * m);
    }
    g.globalAlpha = 1;
    g.globalAlpha = 0.4; g.fillStyle = C.vpc;
    for (const r of S.vpcRects) g.fillRect(ox + r.x * m, oy + r.y * m, r.w * m, r.h * m);
    g.globalAlpha = 1; g.fillStyle = v("--mute"); g.font = "10px Segoe UI, sans-serif";
    for (const r of S.regionRects) {
      const w = r.w * m - 6;
      let label = regionName(r.code);
      if (w < 14) continue;
      while (label.length > 1 && g.measureText(label).width > w) label = label.slice(0, -1);
      g.fillText(label, ox + r.x * m + 3, oy + r.y * m + 11);
    }
    g.strokeStyle = v("--text"); g.lineWidth = 1.5;
    g.strokeRect(ox + (-S.x / S.s) * m, oy + (-S.y / S.s) * m, innerWidth / S.s * m, innerHeight / S.s * m);
  }
  function miniJump(e) {
    const r = $t("tMini").getBoundingClientRect(), mm = S.mini;
    if (!mm) return;
    const wx = (e.clientX - r.left - mm.ox) / mm.m, wy = (e.clientY - r.top - mm.oy) / mm.m;
    S.x = innerWidth / 2 - wx * S.s; S.y = innerHeight / 2 - wy * S.s; S.goal = null;
    clampView(); S.viewDirty = true;
  }

  // ------------------------------------------------------------ 우클릭 메뉴
  // 짧게 누름 = 메뉴, 꾹 누르거나(HOLD_MS) 누른 채 움직이면 = 화면 이동
  const HOLD_MS = 220;
  const SEP = { sep: true };
  const item = (label, fn, ic) => ({ label, fn, ic });
  const copyId = (id) => navigator.clipboard.writeText(id).then(() => toast(t("copied", { id })), () => toast(t("copy_failed")));

  function menuItems(id, n, region) {
    const view = [item(t("m_details"), () => select(id)), item(t("m_goto"), () => focus(id)), item(t("m_copy_id"), () => copyId(id))];
    if (n?.kind === "region" && n.block) return [item(t("m_details"), () => select(id))];
    if (!n || n.kind === "region") {
      return [item(t("m_create_vpc"), () => openForm("vpc", { region }), "vpc"), SEP,
        item(t("m_fit"), () => fit()), item(t("m_refresh"), () => load()),
        item(t(S.showDefault ? "m_hide_default" : "m_show_default"), () => $t("tDefault").click()),
        item(t(S.showRoutes ? "m_hide_routes" : "m_show_routes"), () => $t("tRoutes").click())];
    }
    if (n.kind === "vpc") {
      return [item(t("m_create_subnet"), () => openForm("subnet", { region, vpc: n.data }), "priv"),
        item(t("m_create_instance"), () => openForm("instance", { region, vpc: n.data }), "ec2"),
        ...(n.data.igw ? [] : [item(t("m_create_igw"), () => openForm("igw", { region, vpc: n.data }), "igw")]),
        SEP, ...view];
    }
    if (n.kind === "subnet") {
      const vpc = S.nodes.get(n.vpc).data;
      return [item(t("m_create_instance"), () => openForm("instance", { region, vpc, subnet: n.data }), "ec2"),
        item(t("m_create_subnet"), () => openForm("subnet", { region, vpc }), "priv"), SEP, ...view];
    }
    return view;
  }

  function openMenu(x, y, target) {
    const el = target.closest?.("#topoRegions [data-node]") || target.closest?.("#topoRegions .t-region.slot");
    const id = el?.dataset.node || el?.dataset.region, n = id ? S.nodes.get(id) : null;
    const region = n?.region || target.closest?.(".t-region")?.dataset.region || null;
    const items = menuItems(id, n, region);
    const title = n ? `${n.kind === "res" ? n.data.type : t("k." + n.kind)} · ${n.kind === "region" ? regionName(id) : (n.data.name || id)}` :
      (region ? regionName(region) : t("topology"));
    const m = $t("tMenu");
    m.innerHTML = `<div class="t-mh">${esc(title)}</div>` + items.map((it, i) => it.sep ? '<div class="t-ms"></div>' :
      `<button class="t-mi" data-i="${i}">${it.ic ? icon(it.ic) : '<span class="sp"></span>'}${esc(it.label)}</button>`).join("");
    m.classList.remove("hidden");
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.min(x, innerWidth - w - 8) + "px";
    m.style.top = Math.min(y, innerHeight - h - 8) + "px";
    m.querySelectorAll(".t-mi").forEach(b => b.onclick = (e) => { e.stopPropagation(); closeMenu(); items[+b.dataset.i].fn(); });
    S.menuOpen = true;
  }
  function closeMenu() { $t("tMenu").classList.add("hidden"); S.menuOpen = false; }

  function toast(text) {
    const t = $t("tToast");
    t.textContent = text; t.classList.remove("hidden"); t.style.opacity = 1;
    clearTimeout(toast.h);
    toast.h = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.classList.add("hidden"), 200); }, 2200);
  }

  // ------------------------------------------------------------ 만들기 폼 (VPC / 서브넷 / IGW / 인스턴스)
  const ip2n = (ip) => ip.split(".").reduce((a, o) => (a * 256) + +o, 0);
  const n2ip = (n) => [24, 16, 8, 0].map(s => Math.floor(n / 2 ** s) % 256).join(".");
  const block = (cidr) => { const [ip, len] = cidr.split("/"); return [ip2n(ip), 2 ** (32 - +len)]; };
  const overlaps = (a, b) => a[0] < b[0] + b[1] && b[0] < a[0] + a[1];
  function freeCidr(parent, taken, len) {
    const [base, size] = block(parent), step = 2 ** (32 - len), used = taken.map(block);
    for (let a = base; a + step <= base + size; a += step) if (!used.some(u => overlaps([a, step], u))) return `${n2ip(a)}/${len}`;
    return "";
  }
  function suggestVpcCidr(region) {
    const used = (S.data.regions.find(r => r.region === region)?.vpcs || []).map(v => block(v.cidr));
    for (let i = 0; i < 256; i++) {
      const c = `10.${i}.0.0/16`;
      if (!used.some(u => overlaps(block(c), u))) return c;
    }
    return "10.0.0.0/16";
  }
  const regionLabel = (r) => `${regionName(r)} (${r})`;
  const field = (label, html) => `<label class="row"><span>${label}</span>${html}</label>`;

  function openForm(kind, ctx) {
    closeMenu();
    const regions = S.data.regions.map(r => r.region);
    const region = ctx.region || regions[0];
    let title, sub, body, note = "";
    if (kind === "vpc") {
      title = [icon("vpc", 22), esc(t("m_create_vpc"))]; sub = t("fm_vpc_sub");
      body = field(esc(t("k.region")), `<select name="region">${regions.map(r => `<option value="${esc(r)}" ${r === region ? "selected" : ""}>${esc(regionLabel(r))}</option>`).join("")}</select>`) +
        field(esc(t("fm_name")), `<input type="text" name="name" placeholder="my-vpc">`) +
        field(esc(t("fm_cidr")), `<input type="text" name="cidr" class="mono" value="${suggestVpcCidr(region)}">`) +
        `<label class="chk"><input type="checkbox" name="with_igw" checked> ${esc(t("fm_with_igw"))}</label>`;
    } else if (kind === "subnet") {
      const azs = S.data.regions.find(r => r.region === region)?.azs || [];
      title = [icon("priv", 22), esc(t("m_create_subnet"))]; sub = `${ctx.vpc.name || ctx.vpc.id} · ${ctx.vpc.cidr}`;
      body = field(esc(t("fm_az")), `<select name="az">${azs.map(a => `<option>${esc(a)}</option>`).join("")}</select>`) +
        field(esc(t("fm_name")), `<input type="text" name="name" placeholder="private-a">`) +
        field(esc(t("fm_cidr")), `<input type="text" name="cidr" class="mono" value="${freeCidr(ctx.vpc.cidr, ctx.vpc.subnets.map(s => s.cidr), 24)}">`);
      note = t("fm_subnet_note");
    } else if (kind === "igw") {
      title = [icon("igw", 22), esc(t("m_create_igw"))]; sub = `${ctx.vpc.name || ctx.vpc.id}`;
      body = field(esc(t("fm_name")), `<input type="text" name="name" value="${esc((ctx.vpc.name || "vpc") + "-igw")}">`);
      note = t("fm_igw_note");
    } else {
      const subnets = ctx.vpc.subnets;
      const pick = ctx.subnet || subnets[0];
      title = [icon("ec2", 22), esc(t("m_create_instance"))]; sub = `${ctx.vpc.name || ctx.vpc.id} · ${regionLabel(region)}`;
      body = (subnets.length ? field(esc(t("fm_subnet")), `<select name="subnet">${subnets.map(s =>
          `<option value="${esc(s.id)}" data-public="${s.public}" ${s.id === pick?.id ? "selected" : ""}>${esc(s.name || s.id)} · ${esc(s.az)} · ${s.public ? "Public" : "Private"}</option>`).join("")}</select>`)
          : `<div class="err" style="margin-bottom:12px">${esc(t("fm_no_subnet"))}</div>`) +
        field(esc(t("fm_name")), `<input type="text" name="name" placeholder="web-1">`) +
        field(esc(t("fm_type")), `<select name="instance_type">${["t3.micro", "t3.small", "t3.medium", "t3.large", "m5.large"].map(ty => `<option>${ty}</option>`).join("")}</select>`) +
        `<label class="chk"><input type="checkbox" name="public_ip" ${pick?.public ? "checked" : ""}> ${esc(t("fm_public_ip"))}</label>`;
      note = t("fm_inst_note");
    }
    const wrap = $t("tForm");
    wrap.innerHTML = `<form class="t-form" autocomplete="off"><h3>${title.join("")}</h3><div class="sub">${esc(sub)}</div>
      ${body}${note ? `<div class="note">${esc(note)}</div>` : ""}<div class="err" id="tFormErr" style="font-size:12.5px;margin-bottom:10px"></div>
      <div class="btns"><button type="button" id="tFormCancel">${esc(t("cancel"))}</button><button type="submit" class="primary">${esc(t("create"))}</button></div></form>`;
    wrap.classList.remove("hidden");
    S.formOpen = true;
    const f = wrap.querySelector("form");
    const subSel = f.elements.subnet;
    if (subSel) subSel.onchange = () => { f.elements.public_ip.checked = subSel.selectedOptions[0].dataset.public === "true"; };
    if (f.elements.region && f.elements.cidr) f.elements.region.onchange = () => { f.elements.cidr.value = suggestVpcCidr(f.elements.region.value); };
    $t("tFormCancel").onclick = closeForm;
    (f.querySelector("input[type=text]") || f.querySelector("select"))?.focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const val = (k) => f.elements[k]?.type === "checkbox" ? f.elements[k].checked : f.elements[k]?.value;
      const body = { kind, region: val("region") || region, name: val("name"), cidr: val("cidr"), with_igw: val("with_igw"),
        az: val("az"), vpc: ctx.vpc?.id, subnet: val("subnet"), instance_type: val("instance_type"), public_ip: val("public_ip") };
      if (kind === "instance" && !body.subnet) return;
      const btn = f.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = t("creating"); $t("tFormErr").textContent = "";
      try {
        const res = await api("/api/create", body);
        closeForm();
        toast(t("created", { id: res.id }));
        S.pendingFocus = res.id;
        load();
      } catch (err) {
        $t("tFormErr").textContent = err.message;
        btn.disabled = false; btn.textContent = t("create");
      }
    };
  }
  function closeForm() { $t("tForm").classList.add("hidden"); $t("tForm").innerHTML = ""; S.formOpen = false; }

  // ------------------------------------------------------------ 입력
  const view = $t("topo");
  view.addEventListener("contextmenu", (e) => e.preventDefault());  // 브라우저 기본 우클릭 메뉴 차단
  view.addEventListener("mousedown", (e) => {
    if (e.button !== 2 || e.target.closest(".t-ui, .t-menu, .t-form-wrap")) return;
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
    S.mx = e.clientX; S.my = e.clientY; S.inside = true;
    S.overUI = !!e.target.closest(".t-ui, .t-menu, .t-form-wrap");
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
    const mini = !!e.target.closest(".t-mini");
    if (e.target.closest(".t-ui, .t-menu, .t-form-wrap") && !mini) return;
    S.drag = { sx: e.clientX, sy: e.clientY, x0: S.x, y0: S.y, mini };
    S.dragged = false;
    if (mini) miniJump(e);
  });
  addEventListener("mouseup", () => { S.drag = null; view.classList.remove("dragging"); });
  view.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (S.formOpen) return;
    if (S.menuOpen) closeMenu();
    if (e.target.closest(".t-insp")) { $t("tInsp").scrollTop += e.deltaY; return; }
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  view.addEventListener("click", (e) => {
    if (S.dragged) { S.dragged = false; return; }
    const who = e.target.closest("[data-who]");
    if (who) { lookupWho(who.dataset.who); return; }
    const link = e.target.closest("[data-go]");
    if (link) { focus(link.dataset.go); return; }
    if (e.target.closest(".t-ui, .t-menu, .t-form-wrap")) return;
    const n = e.target.closest("#topoRegions [data-node]");
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

  function relang() {
    closeMenu();
    if (S.data) render();
    if (S.sel && S.nodes.has(S.sel)) select(S.sel);
  }

  window.Topology = { enter, exit, key, relang, get on() { return S.on; } };
})();
