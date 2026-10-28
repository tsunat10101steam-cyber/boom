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
    trash: ["#e5484d", '<path d="M5.5 7.5h13M10 7.5V5.5h4v2M7.5 7.5l.9 11.5h7.2l.9-11.5M10.5 10.5v6M13.5 10.5v6"/>'],
    eigw: [C.net, '<circle cx="11" cy="12" r="6.5"/><path d="M4.5 12h13M11 5.5c2 2 2 11 0 13M15 8l4-4M16 4h3v3"/>'],
    dhcp: [C.net, '<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M8 10h2M8 14h8M13 10h3"/>'],
    eip: [C.net, '<path d="M4.5 12.5l7.5-7.5h7v7l-7.5 7.5z"/><circle cx="15.5" cy="8.5" r="1.3"/>'],
    pl: [C.net, '<path d="M9 7h10M9 12h10M9 17h10M5 7h.5M5 12h.5M5 17h.5"/>'],
    nacl: ["#DD344C", '<rect x="5" y="5" width="14" height="14" rx="1.5"/><path d="M8 9h8M8 12h8M8 15h5"/>'],
    sg: ["#DD344C", '<path d="M12 4l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V7z"/><path d="M9.5 12l2 2 3.5-3.5"/>'],
    priv: [C.priv,'<rect x="7" y="11" width="10" height="8" rx="1.5"/><path d="M9 11V8.5a3 3 0 0 1 6 0V11"/>'],
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
    // 편집기: offsets = 요소별 [x, y] 이동량 (자동 배치 위치 기준, 화면에서만). 저장하면 계정별로 기억
    edit: false, offsets: {}, unsaved: false, edrag: null, palette: false, pdrag: null, boxes: [], remeasure: false,
    // 삭제 모드: delSel = 고른 요소 {key: target}, lasso = 그리는 중인 올가미, delJob = 지우는 중인 작업
    del: false, delSel: new Map(), lasso: null, delJob: null,
  };
  const GRID = 20;  // 편집기 격자 (월드 px)

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
    else if (S.needRender) render();  // 꺼져 있는 동안 언어가 바뀌었으면 (숨은 상태에선 크기를 못 재므로) 지금 다시 그린다
    else requestAnimationFrame(() => { measure(); drawLines(); clampView(); S.viewDirty = true; });
  }
  function exit() {
    if (!S.on) return;
    setEdit(false); setPalette(false); setDel(false); closeVpc();
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
    msg("");
    loading(true);
    $t("tRefresh").disabled = true;
    try {
      S.data = await api("/api/topology", { regions: [] });  // 켜진 리전 전부 (대시보드 스캔 범위와 무관)
      if (!S.edit) S.offsets = readLayout();  // 편집 중 새로고침이면 아직 저장 안 한 이동도 그대로 둔다
      render();
    } catch (e) {
      msg(identity ? t("t_load_failed", { e: e.message }) : t("err.need_connect"));
    }
    loading(false);
    $t("tRefresh").disabled = false;
  }

  // 네트워크 불러오는 동안 도는 로딩 애니메이션: 가운데 허브와 둘레 노드 사이로 패킷이 오간다
  function loaderHTML(text) {
    const n = 6, R = 62, pts = [...Array(n)].map((_, i) => [80 + R * Math.cos(i * 2 * Math.PI / n - Math.PI / 2), 80 + R * Math.sin(i * 2 * Math.PI / n - Math.PI / 2)]);
    const cols = ["var(--c-region)", "var(--c-vpc)", "var(--accent)"];
    return `<div class="t-load-card"><svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true"><g class="t-load-spin">
      ${pts.map(([x, y], i) => `<line class="t-load-ring" x1="${x}" y1="${y}" x2="${pts[(i + 1) % n][0]}" y2="${pts[(i + 1) % n][1]}"/>`).join("")}
      ${pts.map(([x, y]) => `<line class="t-load-spoke" x1="80" y1="80" x2="${x}" y2="${y}"/>`).join("")}
      ${pts.map(([x, y], i) => `<line class="t-load-pkt" style="animation-delay:${(i * 0.23).toFixed(2)}s;stroke:${cols[i % 3]}" x1="80" y1="80" x2="${x}" y2="${y}"/>`).join("")}
      ${pts.map(([x, y], i) => `<circle class="t-load-node" style="animation-delay:${(i * 0.2).toFixed(2)}s;fill:${cols[i % 3]};transform-origin:${x}px ${y}px" cx="${x}" cy="${y}" r="9"/>`).join("")}
      </g><circle class="t-load-hub" cx="80" cy="80" r="15"/></svg><div class="t-load-txt">${esc(text)}</div></div>`;
  }
  function loading(on) {
    const el = $t("tLoad");
    if (on && !el.firstChild) el.innerHTML = loaderHTML("");
    el.querySelector(".t-load-txt") && (el.querySelector(".t-load-txt").textContent = t("t_loading"));
    el.classList.toggle("hidden", !on);
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

  // ------------------------------------------------------------ 편집기: 옮긴 위치 적용 / 감싸는 상자 넓히기
  // 리전 = 지도 위 어디든, VPC = 자기 리전 안, 서브넷 = 자기 AZ 안, 인스턴스 등 = 자기 서브넷(없으면 VPC·리전) 안.
  // 안쪽 요소를 오른쪽·아래로 끌면 감싸는 상자가 그만큼 커진다 (왼쪽·위로는 상자 밖으로 못 나감)
  const DRAG_SEL = ".t-region, .t-vpc, .t-subnet, .t-node";
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
  function grow(c) {
    c.style.minWidth = c.style.minHeight = "";
    const kids = [...c.querySelectorAll(".t-vpc, .t-subnet, .t-node")].filter(k => containerOf(k) === c);
    if (!kids.length) return;
    const cr = worldRect(c), cs = getComputedStyle(c);
    let r = 0, b = 0;
    for (const k of kids) { const kr = worldRect(k); r = Math.max(r, kr.x + kr.w); b = Math.max(b, kr.y + kr.h); }
    const w = r - cr.x + parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
    const h = b - cr.y + parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    if (w > cr.w + 0.5) c.style.minWidth = `${Math.ceil(w)}px`;
    if (h > cr.h + 0.5) c.style.minHeight = `${Math.ceil(h)}px`;
  }
  const chainOf = (el) => { const out = []; for (let c = containerOf(el); c; c = c.classList.contains("t-region") ? null : containerOf(c)) out.push(c); return out; };
  function applyOffsets() {
    const rg = $t("topoRegions"), need = new Set();
    rg.querySelectorAll(".t-vpc, .t-subnet, .t-node").forEach(el => {
      const o = S.offsets[elKey(el)];
      el.style.translate = o ? `${o[0]}px ${o[1]}px` : "";
      if (o) chainOf(el).forEach(c => need.add(c));
    });
    // 안쪽 상자부터 (문서 순서의 역순 = 자식이 부모보다 먼저)
    [...rg.querySelectorAll(".t-subnet, .t-az, .t-vpc, .t-region")].reverse().filter(c => need.has(c)).forEach(grow);
  }

  // 편집기 켜기/끄기. 끌 때 저장 안 한 이동은 되돌린다 (일반 토폴로지 화면 = 언제나 저장된 배치)
  const layoutKey = () => "topoLayout:" + (identity?.account || "-");
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
    const key = elKey(el), o0 = [...(S.offsets[key] || [0, 0])], r0 = worldRect(el), c = containerOf(el);
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
    d.el.style.translate = `${ox}px ${oy}px`;
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
  const DROP_ON = { region: ".t-region", vpc: ".t-region:not(.blocked)", bucket: ".t-region:not(.blocked)",
                    subnet: ".t-vpc", igw: ".t-vpc", instance: ".t-subnet, .t-vpc" };
  function setPalette(on) {
    if (on) setDel(false);
    S.palette = on;
    const p = $t("tPal");
    if (on) p.innerHTML = `<div class="t-pal-h">${esc(t("p_title"))}<span class="t-kbd">Ctrl+Alt+I</span></div>` +
      ADD_KINDS.map(([k, ic]) => `<div class="t-pal-i" data-add="${k}">${icon(ic, 22)}<span>${esc(t("el." + k))}</span></div>`).join("") +
      `<div class="t-pal-f">${esc(t("p_hint"))}</div>`;
    p.classList.toggle("hidden", !on);
    if (!on) cancelPaletteDrag();
  }
  function dropTarget(kind, x, y) {
    const el = document.elementFromPoint(x, y);
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
    const tg = d.target, region = tg?.closest(".t-region")?.dataset.region;
    const vpc = tg?.closest(".t-vpc") && S.nodes.get(tg.closest(".t-vpc").dataset.node)?.data;
    const subnet = tg?.classList.contains("t-subnet") ? S.nodes.get(tg.dataset.node)?.data : null;
    openForm(d.kind, { region, vpc, subnet, optin: d.kind === "region" ? region : null }, true);
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
    if (S.edit) drawGrid();
    drawMini();
  }
  // 편집기 격자: 화면에 그리되 월드와 같이 움직인다 (확대해도 선이 흐려지지 않게). 너무 촘촘하면 5칸씩 묶어서
  function drawGrid() {
    let minor = GRID * S.s;
    while (minor < 9) minor *= 5;
    const major = minor * 5, g = $t("tGrid").style;
    g.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`;
    g.backgroundPosition = `${S.x}px ${S.y}px`;
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
      if (S.inside && !S.vpcv && !S.drag && !S.rdrag && !S.lasso && !S.overUI && !S.menuOpen && !S.formOpen) {
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
        if (px !== S.x || py !== S.y) { S.viewDirty = true; if (S.edrag) dragStep(); }
      }
      if (S.remeasure) { S.remeasure = false; measure(); S.linesDirty = true; }
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
      return [item(t("m_enter_vpc"), () => openVpc(region, id), "vpc"), SEP,
        item(t("m_create_subnet"), () => openForm("subnet", { region, vpc: n.data }), "priv"),
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
  const field = (label, html, desc) => `<label class="row"><span>${label}</span>${desc ? `<small>${esc(desc)}</small>` : ""}${html}</label>`;

  // 오른쪽 'OO 추가' 창 (AWS 콘솔의 만들기 화면처럼: 위치 → 설정 → 만들기). 우클릭 메뉴와 요소 추가 바가 함께 쓴다.
  // add = 요소 추가 바에서 끌어 놓은 경우 (제목이 'OO 추가'). 위치(리전·VPC)를 바꾸면 창을 다시 그린다
  const FORM_ICON = { region: "region", vpc: "vpc", subnet: "priv", igw: "igw", instance: "ec2", bucket: "s3" };
  const MENU_TITLE = { vpc: "m_create_vpc", subnet: "m_create_subnet", igw: "m_create_igw", instance: "m_create_instance" };
  const VPC_OK = { igw: (v) => !v.igw, instance: (v) => v.subnets.length > 0, subnet: () => true };
  const vpcsIn = (region) => S.data.regions.find(r => r.region === region)?.vpcs || [];

  function openForm(kind, ctx, add, keep = {}) {
    closeMenu();
    const regions = S.data.regions.map(r => r.region);
    let region = regions.includes(ctx.region) ? ctx.region : regions[0];
    let vpc = ctx.vpc || null;
    const needVpc = !!VPC_OK[kind];
    if (needVpc && !vpc) {  // 놓은 곳에 VPC 가 없으면: 이 리전의 알맞은 VPC → 없으면 알맞은 VPC 가 있는 첫 리전
      const ok = VPC_OK[kind];
      const r = [S.data.regions.find(r => r.region === region), ...S.data.regions].find(r => r?.vpcs.some(ok));
      if (r) { region = r.region; vpc = r.vpcs.find(ok); }
      else vpc = vpcsIn(region)[0] || null;
    }
    const regionSel = (list, cur) => `<select name="region">${list.map(r => `<option value="${esc(r)}" ${r === cur ? "selected" : ""}>${esc(regionLabel(r))}</option>`).join("")}</select>`;
    const vpcLabel = (v) => `${v.name || (v.default ? t("t_default_vpc") : v.id)} · ${v.cidr}`;
    const place = [], set = [];
    let note = "", ok = true, sub = "";
    if (kind === "region") {
      const optin = Object.entries(S.data.region_status || {}).filter(([, s]) => s === "not-opted-in").map(([r]) => r).sort();
      if (optin.length) place.push(field(esc(t("fm_region_pick")), regionSel(optin, optin.includes(ctx.optin) ? ctx.optin : optin[0]).replace('name="region"', 'name="optin"')));
      else { place.push(`<div class="err">${esc(t("fm_no_optin"))}</div>`); ok = false; }
      note = t("fm_region_note");
    } else {
      place.push(field(esc(t("k.region")), regionSel(regions, region)));
      if (needVpc) place.push(vpc ? field("VPC", `<select name="vpc">${vpcsIn(region).map(v =>
        `<option value="${esc(v.id)}" ${v.id === vpc.id ? "selected" : ""}>${esc(vpcLabel(v))}</option>`).join("")}</select>`)
        : `<div class="err">${esc(t("fm_no_vpc"))}</div>`);
      if (needVpc && !vpc) ok = false;
    }
    if (kind === "vpc") {
      sub = t("fm_vpc_sub");
      set.push(field(esc(t("fm_name")), `<input type="text" name="name" placeholder="my-vpc">`, t("d_name")),
        field(esc(t("fm_cidr")), `<input type="text" name="cidr" class="mono" value="${suggestVpcCidr(region)}">`, t("d_vpc_cidr")),
        `<label class="chk"><input type="checkbox" name="with_igw" checked> ${esc(t("fm_with_igw"))}</label>`,
        `<label class="chk"><input type="checkbox" name="public_subnet" checked> ${esc(t("fm_public_subnet"))}</label>`);
    } else if (kind === "subnet" && vpc) {
      const azs = S.data.regions.find(r => r.region === region)?.azs || [];
      set.push(field(esc(t("fm_az")), `<select name="az">${azs.map(a => `<option>${esc(a)}</option>`).join("")}</select>`),
        field(esc(t("fm_name")), `<input type="text" name="name" placeholder="private-a">`, t("d_name")),
        field(esc(t("fm_cidr")), `<input type="text" name="cidr" class="mono" value="${freeCidr(vpc.cidr, vpc.subnets.map(s => s.cidr), 24)}">`, t("d_sub_cidr")),
        `<label class="chk"><input type="checkbox" name="public" ${vpc.igw ? "checked" : "disabled"}> ${esc(t("fm_sub_public"))}</label>`);
      note = vpc.igw ? t("fm_sub_public_note") : t("fm_sub_no_igw");
    } else if (kind === "igw" && vpc) {
      set.push(field(esc(t("fm_name")), `<input type="text" name="name" value="${esc((vpc.name || "vpc") + "-igw")}">`, t("d_name")));
      note = vpc.igw ? `${t("k.igw")} · ${vpc.igw}` : t("fm_igw_note");
      if (vpc.igw) ok = false;
    } else if (kind === "instance" && vpc) {
      const pick = vpc.subnets.find(s => s.id === ctx.subnet?.id) || vpc.subnets[0];
      set.push(vpc.subnets.length ? field(esc(t("fm_subnet")), `<select name="subnet">${vpc.subnets.map(s =>
          `<option value="${esc(s.id)}" data-public="${s.public}" ${s.id === pick?.id ? "selected" : ""}>${esc(s.name || s.id)} · ${esc(s.az)} · ${s.public ? "Public" : "Private"}</option>`).join("")}</select>`)
          : `<div class="err">${esc(t("fm_no_subnet"))}</div>`,
        field(esc(t("fm_name")), `<input type="text" name="name" placeholder="web-1">`, t("d_name")),
        field(esc(t("fm_type")), `<select name="instance_type">${["t3.micro", "t3.small", "t3.medium", "t3.large", "m5.large"].map(ty => `<option>${ty}</option>`).join("")}</select>`),
        `<label class="chk"><input type="checkbox" name="public_ip" ${pick?.public ? "checked" : ""}> ${esc(t("fm_public_ip"))}</label>`);
      note = t("fm_inst_note");
      if (!vpc.subnets.length) ok = false;
    } else if (kind === "bucket") {
      set.push(field(esc(t("fm_bucket_name")), `<input type="text" name="name" class="mono" value="boom-${esc(identity?.account || "")}-${Math.random().toString(36).slice(2, 7)}">`, t("err.bad_bucket")));
      note = t("fm_bucket_note");
    }
    if (vpc && needVpc) sub = `${vpcLabel(vpc)} · ${regionLabel(region)}`;
    const title = add || !MENU_TITLE[kind] ? t("add_x", { x: t("el." + kind) }) : t(MENU_TITLE[kind]);
    const wrap = $t("tForm");
    delete wrap.dataset.mode;
    wrap.innerHTML = `<form class="t-form" autocomplete="off">
      <div class="t-form-h"><h3>${icon(FORM_ICON[kind], 24)}<span>${esc(title)}</span></h3>
        <button type="button" class="ghost t-close" id="tFormX" aria-label="${esc(t("close"))}">✕</button></div>
      ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
      <div class="t-form-b">
        <div class="t-sec"><div class="t-sec-h">${esc(t("fs_place"))}</div>${place.join("")}</div>
        ${set.length ? `<div class="t-sec"><div class="t-sec-h">${esc(t("fs_settings"))}</div>${set.join("")}</div>` : ""}
        ${note ? `<div class="note">${esc(note)}</div>` : ""}
      </div>
      <div class="t-form-f"><div class="err" id="tFormErr"></div>
        <div class="btns"><button type="button" id="tFormCancel">${esc(t("cancel"))}</button>
        <button type="submit" class="primary" ${ok ? "" : "disabled"}>${esc(t(kind === "region" ? "enable" : "create"))}</button></div></div></form>`;
    wrap.classList.remove("hidden");
    wrap.classList.remove("in"); void wrap.offsetWidth; wrap.classList.add("in");
    S.formOpen = true;
    select(null);
    const f = wrap.querySelector("form");
    if (keep.name != null && f.elements.name) f.elements.name.value = keep.name;
    const reopen = (patch) => openForm(kind, { ...ctx, ...patch }, add, { name: f.elements.name?.value });
    if (kind !== "region" && f.elements.region) f.elements.region.onchange = () => reopen({ region: f.elements.region.value, vpc: null, subnet: null });
    if (f.elements.vpc) f.elements.vpc.onchange = () => reopen({ region, vpc: vpcsIn(region).find(v => v.id === f.elements.vpc.value), subnet: null });
    const subSel = f.elements.subnet;
    if (f.elements.with_igw) f.elements.with_igw.onchange = () => {
      f.elements.public_subnet.disabled = !f.elements.with_igw.checked;
      f.elements.public_subnet.checked = f.elements.with_igw.checked;
    };
    if (kind === "subnet" && f.elements.public && !f.elements.public.disabled) {
      const pub = f.elements.public, nm = f.elements.name, sync = () => {
        f.querySelector(".note").textContent = t(pub.checked ? "fm_sub_public_note" : "fm_subnet_note");
        if (/^(public|private)-a$/.test(nm.placeholder)) nm.placeholder = pub.checked ? "public-a" : "private-a";
      };
      pub.onchange = sync; sync();
    }
    if (subSel) subSel.onchange = () => { f.elements.public_ip.checked = subSel.selectedOptions[0].dataset.public === "true"; };
    $t("tFormCancel").onclick = closeForm; $t("tFormX").onclick = closeForm;
    (f.querySelector("input[type=text]") || f.querySelector("select"))?.focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const val = (k) => f.elements[k]?.type === "checkbox" ? f.elements[k].checked : f.elements[k]?.value;
      const body = kind === "region" ? { kind, region: val("optin") } :
        { kind, region: val("region") || region, name: val("name"), cidr: val("cidr"), with_igw: val("with_igw"), public_subnet: val("public_subnet"), public: val("public"),
          az: val("az"), vpc: vpc?.id, subnet: val("subnet"), instance_type: val("instance_type"), public_ip: val("public_ip") };
      if ((kind === "instance" && !body.subnet) || !body.region) return;
      const btn = f.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = t("creating"); $t("tFormErr").textContent = "";
      try {
        const res = await api("/api/create", body);
        closeForm();
        if (kind === "region") { toast(t("region_requested", { r: regionName(res.id) })); return; }
        toast(t("created", { id: res.id }));
        S.pendingFocus = res.id;
        load();
        if (S.vpcv) vpcLoad();
      } catch (err) {
        $t("tFormErr").textContent = err.message;
        btn.disabled = false; btn.textContent = t(kind === "region" ? "enable" : "create");
      }
    };
  }
  function closeForm() { $t("tForm").classList.add("hidden"); $t("tForm").innerHTML = ""; delete $t("tForm").dataset.mode; S.formOpen = false; }

  // ------------------------------------------------------------ 요소 삭제 모드 (Ctrl+Alt+R)
  // 커서가 X 로 바뀌고, 클릭 = 그 요소만 고르기 · Ctrl+클릭 = 넣고 빼기 · Ctrl+드래그 = 올가미로 여러 개.
  // 오른쪽 창에 고른 요소가 쌓이고 Alt+Y 로 실제 AWS 에서 지운다 (EC2 종료, RDS 는 마지막 스냅샷 남김)
  const DEL_RES = new Set(["EC2", "NAT Gateway", "VPC Endpoint", "ELB", "RDS", "S3"]);
  function delTarget(el) {
    const id = el.dataset.node, n = S.nodes.get(id), region = el.closest(".t-region")?.dataset.region;
    if (!n || !region) return null;
    const ok = (n.kind === "res" && DEL_RES.has(n.data.type)) || ["vpc", "subnet", "igw", "pcx"].includes(n.kind) || (n.kind === "rt" && !n.data.main);
    if (!ok) return null;
    const kindLabel = n.kind === "res" ? n.data.type : t("k." + n.kind);
    const ic = n.kind === "res" ? TYPE_ICON[n.data.type] : n.kind === "subnet" ? (n.data.public ? "pub" : "priv") : n.kind;
    return { key: `${n.kind}|${region}|${id}`, kind: n.kind, region, id, type: n.kind === "res" ? n.data.type : undefined,
             name: n.kind === "igw" ? "" : (n.data.name || ""), kindLabel, ic, managed: n.data.managed };
  }
  function setDel(on) {
    if (on === S.del) return;
    if (on) { setEdit(false); setPalette(false); closeForm(); select(null); }
    S.del = on;
    S.lasso = null;
    $t("tLasso").innerHTML = "";
    view.classList.toggle("del", on);
    if (!on) { if (!S.delJob) S.delSel.clear(); markDel(); closeDelPanel(); }
    else renderDelPanel();
    updateBadge();
  }
  function markDel() {
    document.querySelectorAll("#topoRegions .t-del").forEach(n => n.classList.remove("t-del"));
    for (const [key, d] of S.delSel) {
      const els = [...document.querySelectorAll(`#topoRegions [data-node="${CSS.escape(d.id)}"]`)];
      if (!els.length && !S.delJob) { S.delSel.delete(key); continue; }  // 새로고침 뒤 사라진 요소
      els.forEach(n => n.classList.add("t-del"));
    }
  }
  function delToggle(el, additive) {
    const d = delTarget(el);
    if (!d) { toast(t("d_cant")); return; }
    if (additive) { if (S.delSel.has(d.key)) S.delSel.delete(d.key); else S.delSel.set(d.key, d); }
    else { const only = S.delSel.size === 1 && S.delSel.has(d.key); S.delSel.clear(); if (!only) S.delSel.set(d.key, d); }
    markDel(); renderDelPanel();
  }
  // 올가미: 커서가 지나간 길로 다각형을 만들고, 가운데 점이 그 안에 든 요소를 모두 고른다
  const inPoly = (x, y, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  function drawLasso() {
    const p = S.lasso.pts;
    $t("tLasso").innerHTML = `<path d="M${p.map(q => q.join(",")).join("L")}Z"/>`;
  }
  function endLasso(e) {
    const L = S.lasso;
    S.lasso = null;
    $t("tLasso").innerHTML = "";
    S.dragged = true;  // 이어서 오는 click 은 무시
    const xs = L.pts.map(p => p[0]), ys = L.pts.map(p => p[1]);
    if (Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) < 8) {  // 거의 안 움직였으면 Ctrl+클릭
      const el = L.target.closest?.("#topoRegions [data-node]");
      if (el) delToggle(el, true);
      return;
    }
    let added = 0;
    document.querySelectorAll("#topoRegions [data-node]").forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !inPoly(r.left + r.width / 2, r.top + r.height / 2, L.pts)) return;
      const d = delTarget(el);
      if (d && !S.delSel.has(d.key)) { S.delSel.set(d.key, d); added++; }
    });
    if (added) { markDel(); renderDelPanel(); }
  }
  function closeDelPanel() {
    if ($t("tForm").dataset.mode === "del") { $t("tForm").classList.add("hidden"); $t("tForm").innerHTML = ""; delete $t("tForm").dataset.mode; }
  }
  function renderDelPanel() {
    if (!S.del) return;
    const wrap = $t("tForm"), list = [...S.delSel.values()], job = S.delJob;
    const has = (fn) => list.some(fn);
    const respawn = list.filter(d => d.managed?.respawn).length;
    const warns = [has(d => d.kind === "vpc") && t("d_warn_vpc"), has(d => d.type === "EC2") && t("d_warn_ec2"),
      has(d => d.type === "RDS") && t("d_warn_rds"), has(d => d.type === "S3") && t("d_warn_s3"),
      respawn && t("d_warn_respawn", { n: respawn })].filter(Boolean);
    const fresh = wrap.dataset.mode !== "del";
    wrap.dataset.mode = "del";
    wrap.innerHTML = `<div class="t-form t-delp">
      <div class="t-form-h"><h3>${icon("trash", 24)}<span>${esc(list.length ? t("d_title", { n: list.length }) : t("d_mode"))}</span></h3></div>
      <div class="sub">${esc(t("d_hint"))}</div>
      <div class="t-form-b">
        ${list.length && !job ? warns.map(w => `<div class="note">${esc(w)}</div>`).join("") + `<div class="note err">${esc(t("d_irrev"))}</div>` : ""}
        ${list.length ? `<div class="t-dlist">${list.map(d => `<div class="t-ditem ${job?.results[d.key] ? (job.results[d.key].ok ? "ok" : "bad") : ""}">
            ${icon(d.ic, 20)}<div class="t-dtxt"><b>${esc(d.name || d.id)}</b><span class="mono muted">${esc(d.kindLabel)} · ${esc(d.id)} · ${esc(d.region)}</span>
            ${job?.results[d.key] ? `<span class="${job.results[d.key].ok ? "" : "err"}">${esc(resultText(job.results[d.key].k, job.results[d.key].p))}</span>` : ""}</div>
            ${job ? "" : `<button class="ghost" data-undel="${esc(d.key)}" aria-label="${esc(t("close"))}">✕</button>`}</div>`).join("")}</div>`
          : `<div class="t-dempty">${esc(t("d_empty"))}</div>`}
        ${job ? `<pre class="t-dlog">${esc(job.logs.map(logText).join("\n"))}</pre>` : ""}
      </div>
      <div class="t-form-f"><div class="btns">
        <button type="button" id="tDelClear" ${list.length && !job?.running ? "" : "disabled"}>${esc(t("d_clear"))}</button>
        <button type="button" class="danger" id="tDelGo" ${list.length && !job ? "" : "disabled"}>${esc(job?.running ? t("d_running") : t("d_go"))}</button></div></div></div>`;
    wrap.classList.remove("hidden");
    if (fresh) { wrap.classList.remove("in"); void wrap.offsetWidth; wrap.classList.add("in"); }
    wrap.querySelectorAll("[data-undel]").forEach(b => b.onclick = () => { S.delSel.delete(b.dataset.undel); markDel(); renderDelPanel(); });
    $t("tDelClear").onclick = () => { S.delJob = null; S.delSel.clear(); markDel(); renderDelPanel(); };
    $t("tDelGo").onclick = () => runDelete();
    const lg = wrap.querySelector(".t-dlog");
    if (lg) lg.scrollTop = lg.scrollHeight;
  }
  async function runDelete() {
    if (!S.del || !S.delSel.size || S.delJob) return;
    const targets = [...S.delSel.values()].map(({ kind, region, id, type, name }) => ({ kind, region, id, type, name }));
    S.delJob = { running: true, logs: [], results: {} };
    renderDelPanel();
    let jobId;
    try { jobId = (await api("/api/topo_delete", { targets })).job_id; }
    catch (e) { S.delJob = null; renderDelPanel(); toast(e.message); return; }
    let since = 0;
    for (;;) {
      const j = await api(`/api/jobs/${jobId}?since=${since}`).catch(() => null);
      if (j) { S.delJob.logs.push(...j.logs); since = j.next; S.delJob.results = j.results || {}; }
      if (j && j.status !== "running") break;
      renderDelPanel();
      await new Promise(r => setTimeout(r, 1000));
    }
    const res = Object.values(S.delJob.results), ok = res.filter(r => r.ok).length;
    S.delJob.running = false;
    renderDelPanel();
    toast(t("d_done", { ok, fail: res.length - ok }));
    // 지운 것은 목록에서 빼고, 실패한 것은 이유와 함께 남겨 둔다
    for (const [key] of S.delSel) if (S.delJob.results[key]?.ok) S.delSel.delete(key);
    const failed = S.delJob.results;
    S.delJob = null;
    await load();
    if (S.del) {
      renderDelPanel();
      document.querySelectorAll(".t-ditem").forEach(el => {
        const key = el.querySelector("[data-undel]")?.dataset.undel, r = failed[key];
        if (r && !r.ok) el.querySelector(".t-dtxt").insertAdjacentHTML("beforeend", `<span class="err">${esc(resultText(r.k, r.p))}</span>`);
      });
    }
  }
  function updateBadge() {
    const on = S.edit || S.del;
    $t("tEditBadge").classList.toggle("hidden", !on);
    $t("tEditBadge").classList.toggle("del", S.del);
    $t("tModeName").textContent = on ? t(S.del ? "d_mode" : "e_mode") : "";
    $t("tReset").classList.toggle("hidden", !S.edit);
    markUnsaved(S.edit && S.unsaved);
  }
  // Alt+Esc: 편집기·요소 추가·삭제 모드를 모두 끄고 곧바로 일반 토폴로지 화면으로
  function toViewer() {
    cancelPaletteDrag();
    if (S.edrag) endElementDrag();
    setEdit(false); setPalette(false); setDel(false);
    closeVpc(); closeForm(); closeMenu();
  }

  // ------------------------------------------------------------ VPC 연결 (VPC 안으로 들어가기)
  // VPC 우클릭 → 'VPC 연결'. AWS 콘솔의 VPC 화면처럼 가운데 = 리소스 맵 (서브넷 → 라우팅 테이블 → 네트워크 연결),
  // 왼쪽 = VPC 대시보드 항목 (서브넷, 라우팅 테이블, 인터넷 게이트웨이 ... 보안 그룹, 엔드포인트).
  // 항목을 누르면 표, 표의 행을 누르면 아래에 세부 정보. Esc = 한 단계씩 닫기, Alt+Esc = 곧바로 토폴로지로
  const VNAV = [
    [null, [["map", "v_map", "vpc"], ["vpc", "v_vpc", "vpc"]]],
    ["v_g_vpc", [["subnets", "v_subnets", "priv"], ["rts", "v_rts", "rt"], ["igws", "v_igws", "igw"], ["eigws", "v_eigws", "eigw"],
      ["dhcp", "v_dhcp", "dhcp"], ["eips", "v_eips", "eip"], ["pls", "v_pls", "pl"], ["nats", "v_nats", "nat"], ["pcxs", "v_pcxs", "pcx"]]],
    ["v_g_sec", [["nacls", "v_nacls", "nacl"], ["sgs", "v_sgs", "sg"]]],
    ["PrivateLink", [["eps", "v_eps", "ep"]]],
    ["Transit Gateway", [["atts", "v_atts", "tgw"]]],
  ];
  const VNAV_ICON = Object.fromEntries(VNAV.flatMap(([, items]) => items.map(([p, , ic]) => [p, ic])));
  const topoVpc = (v) => vpcsIn(v.region).find(x => x.id === v.id);

  function openVpc(region, id) {
    toViewer(); select(null);
    S.vpcv = { region, id, page: "map", data: null, err: null, open: null, filter: "" };
    $t("topo").classList.add("vpcv");
    $t("tVpc").classList.remove("hidden");
    vpcLoad();
  }
  function closeVpc() {
    if (!S.vpcv) return;
    S.vpcv = null;
    closeForm();
    $t("tVpc").classList.add("hidden"); $t("tVpc").innerHTML = "";
    $t("topo").classList.remove("vpcv");
  }
  async function vpcLoad() {
    const v = S.vpcv;
    v.data = null; v.err = null; vpcRender();
    try { const d = await api("/api/vpc_detail", { region: v.region, vpc: v.id }); if (S.vpcv === v) v.data = d; }
    catch (e) { if (S.vpcv === v) v.err = e.message; }
    if (S.vpcv === v) vpcRender();
  }
  function vpcGo(page, open = null) {
    const v = S.vpcv;
    if (v.page !== page) v.filter = "";
    v.page = page; v.open = open;
    vpcRender();
    if (open) $t("tVpc").querySelector(`tr[data-row="${CSS.escape(open)}"]`)?.scrollIntoView({ block: "center" });
    else $t("tVmain").scrollTop = 0;
  }

  function vpcRender() {
    const v = S.vpcv, d = v.data, tv = topoVpc(v), box = $t("tVpc");
    const name = d?.vpc.name || tv?.name || v.id;
    const nav = VNAV.map(([g, items]) => `${g ? `<div class="t-vng">${esc(t(g))}</div>` : ""}${items.map(([p, label]) => {
      const n = d && VLIST[p] ? VLIST[p].rows(d).length : null;
      return `<button class="t-vni ${v.page === p ? "on" : ""}" data-vp="${p}">${icon(VNAV_ICON[p], 18)}<span>${esc(t(label))}</span>${n != null ? `<span class="n">${n}</span>` : ""}</button>`;
    }).join("")}`).join("");
    S.vpcHover = null;
    const keepScroll = $t("tVmain")?.scrollTop || 0, keepPage = box.dataset.page;
    box.innerHTML = `<header class="t-vh">
        <button class="ghost t-vback" data-v="back">← ${esc(t("v_back"))}</button>
        <div class="t-vcrumb">${icon("vpc", 22)}<b>${esc(name)}</b><span class="mono muted">${esc(v.id)}</span>
          <span class="t-tag">${esc(regionName(v.region))} · ${esc(v.region)}</span></div>
        <span class="sp"></span><span class="t-kbd">Esc</span>
        <button data-v="refresh">${esc(t("t_refresh"))}</button></header>
      <div class="t-vbody"><nav class="t-vnav">${nav}</nav><main class="t-vmain" id="tVmain">${vpcPage()}</main></div>`;
    box.dataset.page = v.page;
    if (keepPage === v.page) $t("tVmain").scrollTop = keepScroll;
    const f = box.querySelector(".t-vfilter");
    if (f) f.oninput = () => { v.filter = f.value; box.querySelector(".t-vtable").innerHTML = vpcTable(v.page); };
    if (v.page === "map" && d) requestAnimationFrame(drawVpcLines);
  }

  function vpcPage() {
    const v = S.vpcv, d = v.data;
    if (v.err) return `<div class="t-vmsg"><div class="err">${esc(t("v_load_failed", { e: v.err }))}</div><button data-v="refresh">${esc(t("v_retry"))}</button></div>`;
    if (!d) return `<div class="t-vmsg">${loaderHTML(t("t_loading"))}</div>`;
    const warn = d.warnings.length ? `<div class="t-vwarn">${esc(t("warnings_n", { n: d.warnings.length }))} · ${esc(d.warnings.map(w => w.detail).join(" / "))}</div>` : "";
    if (v.page === "map") return warn + vpcSummary(d) + vpcMapHTML(d);
    if (v.page === "vpc") return warn + vpcDetailsHTML(d);
    const L = VLIST[v.page], rows = L.rows(d);
    const create = L.create?.(d);
    return `${warn}<div class="t-vph"><h2>${icon(VNAV_ICON[v.page], 24)}${esc(t(VNAV.flatMap(([, i]) => i).find(([p]) => p === v.page)[1]))}
        <span class="muted">(${rows.length})</span></h2><span class="sp"></span>
        <input type="text" class="t-vfilter" placeholder="${esc(t("v_filter"))}" value="${esc(v.filter)}">
        ${create ? `<button class="primary" data-v="create">${esc(t(create))}</button>` : ""}</div>
      ${L.note ? `<div class="t-vnote">${esc(L.note(d))}</div>` : ""}
      <div class="t-vtable">${vpcTable(v.page)}</div>`;
  }

  // ---- 표 정의: rows = 행 목록, cols = [제목, 칸 HTML], det = 행을 눌렀을 때 아래에 펼칠 세부 정보
  const nm = (x) => x.name ? esc(x.name) : '<span class="muted">–</span>';
  const mono = (s) => s == null || s === "" ? '<span class="muted">–</span>' : `<span class="mono">${esc(s)}</span>`;
  const vgo = (page, id, label) => id ? `<a class="t-link" data-vgo="${page}:${esc(id)}">${esc(label || id)}</a>` : '<span class="muted">–</span>';
  const yn = (b) => esc(t(b ? "yes" : "no"));
  const ST_OK = /^(available|active|attached|associated|create-complete|modify-complete)$/, ST_BAD = /blackhole|fail|reject|delet|expired/;
  const st = (s) => s ? `<span class="t-st ${ST_OK.test(s) ? "ok" : ST_BAD.test(s) ? "bad" : "wait"}">${esc(s)}</span>` : '<span class="muted">–</span>';
  const pubBadge = (p) => `<span class="t-badge ${p ? "pub" : "priv"}">${p ? "Public" : "Private"}</span>`;
  const TARGET_PAGE = [["igw-", "igws"], ["eigw-", "eigws"], ["nat-", "nats"], ["vpce-", "eps"], ["pcx-", "pcxs"], ["tgw-", "atts"]];
  function targetLink(d, target) {
    const p = TARGET_PAGE.find(([pre]) => String(target).startsWith(pre))?.[1];
    if (!p) return mono(target);
    const id = p === "atts" ? d.atts.find(a => a.tgw === target)?.id : target;
    return id ? vgo(p, id, target) : mono(target);
  }
  const rtsTo = (d, id) => d.rts.filter(r => r.routes.some(x => x.target === id || (id.startsWith("tgw-attach") && x.target === d.atts.find(a => a.id === id)?.tgw)));
  const usedBy = (d, id) => { const r = rtsTo(d, id); return `<div class="sec">${esc(t("v_used_by"))}</div>${r.length ? r.map(x => `<div class="t-kv"><span>${vgo("rts", x.id, x.name || x.id)}</span><span>${x.main ? "main" : ""}</span></div>`).join("") : `<div class="muted">${esc(t("none_"))}</div>`}`; };
  const subName = (d, id) => d.subnets.find(s => s.id === id)?.name || id;
  const subLinks = (d, ids) => ids.length ? ids.map(id => vgo("subnets", id, subName(d, id))).join(", ") : '<span class="muted">–</span>';
  const tbl = (head, rows) => `<table class="t-vt"><tr>${head.map(h => `<th>${esc(t(h))}</th>`).join("")}</tr>${rows.join("") || `<tr><td colspan="${head.length}" class="muted">${esc(t("none_"))}</td></tr>`}</table>`;
  const routesTbl = (d, rt) => tbl(["th_dest", "th_target", "th_state"], rt.routes.map(r =>
    `<tr><td class="mono">${esc(r.dest)}</td><td>${targetLink(d, r.target)}</td><td>${st(r.state)}</td></tr>`));
  const sgTbl = (rules, dir) => tbl(["v_proto", "v_ports", dir === "in" ? "v_src" : "v_dst", "v_desc"], rules.map(r =>
    `<tr><td>${esc(r.proto === "all" ? t("v_all") : r.proto)}</td><td class="mono">${esc(r.ports === "all" ? t("v_all") : r.ports)}</td><td class="mono">${esc(r.peer)}</td><td>${esc(r.desc)}</td></tr>`));
  const naclTbl = (entries) => tbl(["v_rule", "v_proto", "v_ports", "CIDR", "v_action"], entries.map(e =>
    `<tr><td class="mono">${e.no === 32767 ? "*" : e.no}</td><td>${esc(e.proto === "all" ? t("v_all") : e.proto)}</td><td class="mono">${esc(e.ports === "all" ? t("v_all") : e.ports)}</td>
      <td class="mono">${esc(e.cidr)}</td><td><span class="t-st ${e.action === "allow" ? "ok" : "bad"}">${esc(t(e.action === "allow" ? "v_allow" : "v_deny"))}</span></td></tr>`));

  const VLIST = {
    subnets: {
      rows: (d) => d.subnets, create: () => "m_create_subnet",
      cols: [["fm_name", nm], ["ID", (s) => mono(s.id)], ["th_state", (s) => st(s.state)], ["IPv4 CIDR", (s) => mono(s.cidr)],
        ["f_free_ips", (s) => esc(s.free)], ["fm_az", (s) => esc(s.az)], ["f_rt", (s, d) => vgo("rts", s.rt, d.rts.find(r => r.id === s.rt)?.name || s.rt)],
        ["v_nacls", (s) => vgo("nacls", s.nacl)], ["v_auto_pub", (s) => yn(s.map_public)], ["", (s) => pubBadge(s.public)]],
      det: (s, d) => {
        const rt = d.rts.find(r => r.id === s.rt), res = topoVpc(S.vpcv)?.subnets.find(x => x.id === s.id)?.resources || [];
        return `${kv("ID", mono(s.id))}${kv("IPv4 CIDR", mono(s.cidr))}${kv("IPv6 CIDR", s.ipv6.length ? mono(s.ipv6.join(", ")) : "")}
          ${kv(t("fm_az"), `${esc(s.az)} <span class="muted">(${esc(s.az_id)})</span>`)}${kv(t("f_free_ips"), esc(s.free))}
          ${kv(t("v_auto_pub"), yn(s.map_public))}${kv(t("v_default_az"), yn(s.default_az))}
          ${kv(t("f_rt"), `${vgo("rts", s.rt, rt?.name || s.rt)}${s.rt_explicit ? "" : " " + esc(t("implicit_main"))}`)}${kv(t("v_nacls"), vgo("nacls", s.nacl))}
          ${rt ? `<div class="sec">${esc(t("f_routes"))}</div>${routesTbl(d, rt)}` : ""}
          <div class="sec">${esc(t("res_n", { n: res.length }))}</div>${res.map(x => `<div class="t-kv"><span>${icon(TYPE_ICON[x.type], 16)} ${esc(x.name || x.id)}</span><span>${esc(x.type)} · ${esc(stateText(x.state))}</span></div>`).join("")}`;
      },
    },
    rts: {
      rows: (d) => d.rts,
      cols: [["fm_name", nm], ["ID", (r) => mono(r.id)], ["v_explicit_assoc", (r) => esc(t("subnets_n", { n: r.subnets.length }))],
        ["v_main", (r) => yn(r.main)], ["f_routes", (r) => esc(r.routes.length)]],
      det: (r, d) => {
        const implicit = r.main ? d.subnets.filter(s => !s.rt_explicit).map(s => s.id) : [];
        return `${kv("ID", mono(r.id))}${kv(t("v_main"), yn(r.main))}
          <div class="sec">${esc(t("f_routes"))}</div>${routesTbl(d, r)}
          <div class="sec">${esc(t("v_explicit_assoc"))}</div><div>${subLinks(d, r.subnets)}</div>
          ${r.main ? `<div class="sec">${esc(t("implicit_main"))}</div><div>${subLinks(d, implicit)}</div><div class="muted" style="font-size:12px;margin-top:6px">${esc(t("main_note"))}</div>` : ""}
          ${r.edges.length ? `<div class="sec">${esc(t("v_edge"))}</div><div>${r.edges.map(mono).join(", ")}</div>` : ""}`;
      },
    },
    igws: {
      rows: (d) => d.igws, create: (d) => d.igws.length ? null : "m_create_igw",
      cols: [["fm_name", nm], ["ID", (g) => mono(g.id)], ["th_state", (g) => st(g.state)], ["VPC", () => mono(S.vpcv.id)]],
      det: (g, d) => `${kv("ID", mono(g.id))}${kv(t("th_state"), st(g.state))}${usedBy(d, g.id)}`,
    },
    eigws: {
      rows: (d) => d.eigws,
      cols: [["fm_name", nm], ["ID", (g) => mono(g.id)], ["th_state", (g) => st(g.state)], ["VPC", () => mono(S.vpcv.id)]],
      det: (g, d) => `${kv("ID", mono(g.id))}${kv(t("th_state"), st(g.state))}${usedBy(d, g.id)}`,
    },
    dhcp: {
      rows: (d) => d.dhcp, note: (d) => d.vpc.dhcp === "default" || !d.vpc.dhcp ? t("v_dhcp_default") : "",
      cols: [["fm_name", nm], ["ID", (x) => mono(x.id)], ["v_owner", (x) => mono(x.owner)]],
      det: (x) => `${kv("ID", mono(x.id))}${x.config.map(c => kv(esc(c.key), mono(c.values.join(", ")))).join("")}`,
    },
    eips: {
      rows: (d) => d.eips,
      cols: [["fm_name", nm], ["v_alloc", (x) => mono(x.id)], ["f_pub_ip", (x) => mono(x.ip)], ["f_priv_ip", (x) => mono(x.private_ip)],
        ["v_eni", (x) => mono(x.eni)], ["v_instance", (x) => mono(x.instance)], ["k.subnet", (x, d) => vgo("subnets", x.subnet, subName(d, x.subnet))]],
      det: (x, d) => `${kv(t("v_alloc"), mono(x.id))}${kv(t("f_pub_ip"), mono(x.ip))}${kv(t("f_priv_ip"), mono(x.private_ip))}
        ${kv(t("v_assoc"), mono(x.assoc))}${kv(t("v_eni"), mono(x.eni))}${kv(t("v_type"), esc(x.eni_type))}${kv(t("v_instance"), mono(x.instance))}
        ${kv(t("k.subnet"), vgo("subnets", x.subnet, subName(d, x.subnet)))}${(() => { const n = d.nats.find(n => n.alloc === x.id); return n ? kv(t("v_nats"), vgo("nats", n.id, n.name || n.id)) : ""; })()}`,
    },
    pls: {
      rows: (d) => d.pls, note: () => t("v_pl_note"),
      cols: [["fm_name", (x) => esc(x.name)], ["ID", (x) => mono(x.id)], ["v_af", (x) => esc(x.af)], ["v_max", (x) => esc(x.max ?? "–")],
        ["v_version", (x) => esc(x.version ?? "–")], ["th_state", (x) => st(x.state)], ["v_owner", (x) => mono(x.owner)]],
      det: (x, d) => `${kv("ID", mono(x.id))}${kv(t("fm_name"), esc(x.name))}${kv(t("v_af"), esc(x.af))}${kv(t("v_owner"), mono(x.owner))}${usedBy(d, x.id)}`,
    },
    nats: {
      rows: (d) => d.nats,
      cols: [["fm_name", nm], ["ID", (n) => mono(n.id)], ["th_state", (n) => st(n.state)], ["v_conn_type", (n) => esc(n.connectivity)],
        ["f_pub_ip", (n) => mono(n.ip)], ["f_priv_ip", (n) => mono(n.private_ip)], ["k.subnet", (n, d) => vgo("subnets", n.subnet, subName(d, n.subnet))],
        ["v_created", (n) => esc(n.created ? new Date(n.created).toLocaleString() : "–")]],
      det: (n, d) => `${kv("ID", mono(n.id))}${kv(t("th_state"), st(n.state))}${kv(t("v_conn_type"), esc(n.connectivity))}
        ${kv(t("f_pub_ip"), mono(n.ip))}${kv(t("v_alloc"), n.alloc ? vgo("eips", n.alloc) : "")}${kv(t("f_priv_ip"), mono(n.private_ip))}
        ${kv(t("k.subnet"), vgo("subnets", n.subnet, subName(d, n.subnet)))}${usedBy(d, n.id)}`,
    },
    pcxs: {
      rows: (d) => d.pcxs,
      cols: [["fm_name", nm], ["ID", (p) => mono(p.id)], ["th_state", (p) => st(p.status)],
        ["requester", (p) => `${mono(p.a.vpc)} <span class="muted mono">${esc(p.a.cidr || "")}</span>`],
        ["accepter", (p) => `${mono(p.b.vpc)} <span class="muted mono">${esc(p.b.cidr || "")}</span>`]],
      det: (p, d) => `${kv("ID", mono(p.id))}${kv(t("th_state"), st(p.status))}
        ${["a", "b"].map(k => `<div class="sec">${esc(t(k === "a" ? "requester" : "accepter"))}</div>${kv("VPC", mono(p[k].vpc))}${kv("CIDR", mono(p[k].cidr))}
          ${kv(t("k.region"), esc(regionName(p[k].region)))}${kv(t("f_account"), mono(p[k].owner))}`).join("")}${usedBy(d, p.id)}`,
    },
    nacls: {
      rows: (d) => d.nacls,
      cols: [["fm_name", nm], ["ID", (n) => mono(n.id)], ["assoc_subnets", (n) => esc(t("subnets_n", { n: n.subnets.length }))],
        ["v_main", (n) => yn(n.default)], ["v_in", (n) => esc(n.entries.filter(e => !e.egress).length)], ["v_out", (n) => esc(n.entries.filter(e => e.egress).length)]],
      det: (n, d) => `${kv("ID", mono(n.id))}${kv(t("v_main"), yn(n.default))}
        <div class="sec">${esc(t("v_in"))}</div>${naclTbl(n.entries.filter(e => !e.egress))}
        <div class="sec">${esc(t("v_out"))}</div>${naclTbl(n.entries.filter(e => e.egress))}
        <div class="sec">${esc(t("assoc_subnets"))}</div><div>${subLinks(d, n.subnets)}</div>`,
    },
    sgs: {
      rows: (d) => d.sgs,
      cols: [["v_group", (g) => esc(g.group)], ["ID", (g) => mono(g.id)], ["fm_name", nm], ["v_desc", (g) => esc(g.desc)],
        ["v_in", (g) => esc(g.in.length)], ["v_out", (g) => esc(g.out.length)]],
      det: (g) => `${kv("ID", mono(g.id))}${kv(t("v_group"), esc(g.group))}${kv(t("v_desc"), esc(g.desc))}${kv(t("v_owner"), mono(g.owner))}
        <div class="sec">${esc(t("v_in"))}</div>${sgTbl(g.in, "in")}<div class="sec">${esc(t("v_out"))}</div>${sgTbl(g.out, "out")}`,
    },
    eps: {
      rows: (d) => d.eps,
      cols: [["fm_name", nm], ["ID", (e) => mono(e.id)], ["v_type", (e) => esc(e.type)], ["v_service", (e) => mono(e.service)],
        ["th_state", (e) => st(e.state)], ["v_created", (e) => esc(e.created ? new Date(e.created).toLocaleString() : "–")]],
      det: (e, d) => `${kv("ID", mono(e.id))}${kv(t("v_type"), esc(e.type))}${kv(t("v_service"), mono(e.service))}${kv(t("th_state"), st(e.state))}
        ${e.subnets.length ? `<div class="sec">${esc(t("f_subnets"))}</div><div>${subLinks(d, e.subnets)}</div>` : ""}
        ${e.rts.length ? `<div class="sec">${esc(t("f_rts"))}</div><div>${e.rts.map(id => vgo("rts", id, d.rts.find(r => r.id === id)?.name || id)).join(", ")}</div>` : ""}`,
    },
    atts: {
      rows: (d) => d.atts,
      cols: [["fm_name", nm], ["ID", (a) => mono(a.id)], ["Transit Gateway", (a) => mono(a.tgw)], ["th_state", (a) => st(a.state)], ["v_owner", (a) => mono(a.owner)]],
      det: (a, d) => `${kv("ID", mono(a.id))}${kv("Transit Gateway", mono(a.tgw))}${kv(t("th_state"), st(a.state))}${usedBy(d, a.id)}`,
    },
  };

  function vpcTable(page) {
    const v = S.vpcv, d = v.data, L = VLIST[page], q = v.filter.trim().toLowerCase();
    const text = (x) => L.cols.map(([, f]) => f(x, d)).join(" ").replace(/<[^>]*>/g, " ").toLowerCase();  // 화면에 보이는 칸만 검색
    const rows = L.rows(d).filter(x => !q || text(x).includes(q) || x.id.toLowerCase().includes(q));
    if (!L.rows(d).length) return `<div class="t-vempty">${esc(t("v_empty"))}</div>`;
    const open = rows.find(x => x.id === v.open);
    return `<table class="t-vt t-vlist"><tr>${L.cols.map(([h]) => `<th>${esc(h ? t(h) : "")}</th>`).join("")}</tr>
      ${rows.map(x => `<tr data-row="${esc(x.id)}" class="${x.id === v.open ? "on" : ""}">${L.cols.map(([, f]) => `<td>${f(x, d)}</td>`).join("")}</tr>`).join("")
        || `<tr><td colspan="${L.cols.length}" class="muted">${esc(t("v_empty"))}</td></tr>`}</table>
      ${open ? `<div class="t-vdet"><h3>${icon(VNAV_ICON[page], 20)}${esc(open.name || open.group || open.id)}<span class="mono muted">${esc(open.id)}</span>
        <button class="ghost t-close" data-v="unopen" aria-label="${esc(t("close"))}">✕</button></h3>${L.det(open, d)}</div>`
        : `<div class="t-vhint">${esc(t("v_pick"))}</div>`}`;
  }

  function vpcSummary(d) {
    const x = d.vpc, chip = (k, v) => `<div class="t-vchip"><span>${esc(k)}</span><b>${v}</b></div>`;
    return `<div class="t-vsum">${chip(t("th_state"), st(x.state))}${chip("IPv4 CIDR", mono(x.cidrs.join(", ") || x.cidr))}
      ${chip(t("v_dns_host"), yn(x.dns_hostnames))}${chip(t("v_dns_res"), yn(x.dns_support))}
      ${chip(t("v_main_rt"), vgo("rts", x.main_rt))}${chip(t("v_main_nacl"), vgo("nacls", x.main_nacl))}
      ${chip(t("v_dhcp"), x.dhcp && x.dhcp !== "default" ? vgo("dhcp", x.dhcp) : esc(x.dhcp || "–"))}${chip(t("f_default"), yn(x.default))}</div>`;
  }
  function vpcDetailsHTML(d) {
    const x = d.vpc;
    return `<div class="t-vph"><h2>${icon("vpc", 24)}${esc(x.name || x.id)}</h2></div>
      <div class="t-vdet wide">${kv("VPC ID", mono(x.id))}${kv(t("th_state"), st(x.state))}${kv(t("f_default"), yn(x.default))}
        ${kv(t("v_dns_host"), yn(x.dns_hostnames))}${kv(t("v_dns_res"), yn(x.dns_support))}${kv(t("v_tenancy"), esc(x.tenancy))}
        ${kv(t("v_dhcp"), x.dhcp && x.dhcp !== "default" ? vgo("dhcp", x.dhcp) : esc(x.dhcp || "–"))}
        ${kv(t("v_main_rt"), vgo("rts", x.main_rt))}${kv(t("v_main_nacl"), vgo("nacls", x.main_nacl))}${kv(t("v_owner"), mono(x.owner))}
        <div class="sec">${esc(t("v_cidrs"))}</div>${tbl(["CIDR", "v_af"], [...x.cidrs.map(c => `<tr><td class="mono">${esc(c)}</td><td>IPv4</td></tr>`),
          ...x.ipv6.map(c => `<tr><td class="mono">${esc(c)}</td><td>IPv6</td></tr>`)])}</div>`;
  }

  // ---- 리소스 맵: 서브넷(AZ 별) → 라우팅 테이블 → 네트워크 연결. 마우스를 올리면 이어진 경로만 밝게
  function vpcConns(d) {
    const short = (s) => s.split(".").slice(-1)[0];
    return [...d.igws.map(g => ({ id: g.id, ic: "igw", name: g.name || g.id, sub: t("k.igw"), page: "igws" })),
      ...d.eigws.map(g => ({ id: g.id, ic: "eigw", name: g.name || g.id, sub: t("v_eigws"), page: "eigws" })),
      ...d.nats.map(n => ({ id: n.id, ic: "nat", name: n.name || n.id, sub: `NAT · ${n.connectivity}${n.ip ? " · " + n.ip : ""}`, page: "nats" })),
      ...d.eps.map(e => ({ id: e.id, ic: "ep", name: e.name || short(e.service), sub: `${e.type} · ${short(e.service)}`, page: "eps" })),
      ...d.pcxs.map(p => ({ id: p.id, ic: "pcx", name: p.name || p.id, sub: `${t("k.pcx")} · ${p.status}`, page: "pcxs" })),
      ...d.atts.map(a => ({ id: a.tgw, ic: "tgw", name: a.tgw, sub: `${t("k.att")} · ${a.state}`, page: "atts", open: a.id }))];
  }
  function vpcEdges(d) {
    const conns = new Set(vpcConns(d).map(c => c.id)), out = [];
    d.subnets.forEach(s => s.rt && out.push([s.id, s.rt]));
    d.rts.forEach(r => [...new Set(r.routes.map(x => x.target))].forEach(tg => conns.has(tg) && out.push([r.id, tg])));
    return out;
  }
  function vpcMapHTML(d) {
    const card = (id, ic, name, sub, page, open, extra = "") =>
      `<div class="t-vcard" data-m="${esc(id)}" data-vgo="${page}:${esc(open || id)}">${icon(ic, 22)}<div class="t-vct"><b>${esc(name)}</b><span class="mono">${esc(sub)}</span></div>${extra}</div>`;
    const byAz = {};
    d.subnets.forEach(s => (byAz[s.az] ||= []).push(s));
    const conns = vpcConns(d), col = (title, n, body) => `<div class="t-vcol"><div class="t-vcol-h">${esc(title)} <span class="muted">(${n})</span></div>${body || `<div class="muted t-vnone">${esc(t("none_"))}</div>`}</div>`;
    return `<div class="t-vph"><h2>${esc(t("v_map"))}</h2><span class="sp"></span><span class="muted" style="font-size:12px">${esc(t("v_hover"))}</span></div>
      <div class="t-vmap" id="tVmap"><svg id="tVlines"></svg><div class="t-vcols">
      ${col("VPC", 1, card(d.vpc.id, "vpc", d.vpc.name || d.vpc.id, d.vpc.cidrs.join(", ") || d.vpc.cidr, "vpc"))}
      ${col(t("v_subnets"), d.subnets.length, Object.keys(byAz).sort().map(az => `<div class="t-vaz">${esc(az)}</div>${byAz[az].map(s =>
        card(s.id, s.public ? "pub" : "priv", s.name || s.id, s.cidr, "subnets", null, pubBadge(s.public))).join("")}`).join(""))}
      ${col(t("v_rts"), d.rts.length, d.rts.map(r => card(r.id, "rt", r.name || r.id, r.main ? `main · ${r.id}` : r.id, "rts")).join(""))}
      ${col(t("v_conns"), conns.length, conns.map(c => card(c.id, c.ic, c.name, c.sub, c.page, c.open)).join(""))}
      </div></div>`;
  }
  function drawVpcLines() {
    const map = $t("tVmap"), svg = $t("tVlines"), d = S.vpcv?.data;
    if (!map || !d) return;
    const base = map.getBoundingClientRect();
    svg.setAttribute("width", map.scrollWidth); svg.setAttribute("height", map.scrollHeight);
    const pos = (id) => {
      const el = map.querySelector(`[data-m="${CSS.escape(id)}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left - base.left, r: r.right - base.left, y: r.top - base.top + r.height / 2 };
    };
    svg.innerHTML = vpcEdges(d).map(([a, b]) => {
      const p = pos(a), q = pos(b);
      if (!p || !q) return "";
      const dx = Math.max(30, (q.l - p.r) / 2);
      return `<path data-a="${esc(a)}" data-b="${esc(b)}" d="M${p.r} ${p.y} C${p.r + dx} ${p.y} ${q.l - dx} ${q.y} ${q.l} ${q.y}"/>`;
    }).join("");
  }
  function vpcHover(id) {
    const map = $t("tVmap"), d = S.vpcv?.data;
    if (!map || !d) return;
    map.classList.toggle("hl", !!id);
    const on = new Set();
    if (id) {
      const edges = vpcEdges(d), walk = (from, dir) => {  // dir 0 = 왼쪽(앞), 1 = 오른쪽(뒤)으로만 따라간다
        edges.forEach(e => { if (e[dir ? 0 : 1] === from && !on.has(e[dir])) { on.add(e[dir]); walk(e[dir], dir); } });
      };
      on.add(id); walk(id, 0); walk(id, 1);
    }
    map.querySelectorAll(".t-vcard").forEach(c => c.classList.toggle("on", on.has(c.dataset.m)));
    map.querySelectorAll("#tVlines path").forEach(p => p.classList.toggle("on", on.has(p.dataset.a) && on.has(p.dataset.b)));
  }

  $t("tVpc").addEventListener("click", (e) => {
    const v = S.vpcv;
    if (!v) return;
    const b = e.target.closest("[data-v], [data-vp], [data-vgo], tr[data-row]");
    if (!b) return;
    if (b.dataset.vp) return vpcGo(b.dataset.vp);
    if (b.dataset.vgo) { const i = b.dataset.vgo.indexOf(":"); return vpcGo(b.dataset.vgo.slice(0, i), b.dataset.vgo.slice(i + 1)); }
    if (b.dataset.row) { if (e.target.closest("a")) return; v.open = v.open === b.dataset.row ? null : b.dataset.row; $t("tVpc").querySelector(".t-vtable").innerHTML = vpcTable(v.page); return; }
    const act = b.dataset.v;
    if (act === "back") closeVpc();
    else if (act === "refresh") vpcLoad();
    else if (act === "unopen") { v.open = null; $t("tVpc").querySelector(".t-vtable").innerHTML = vpcTable(v.page); }
    else if (act === "create") {
      const tv = topoVpc(v);
      if (!tv) return toast(t("t_load_failed", { e: v.id }));
      openForm(v.page === "igws" ? "igw" : "subnet", { region: v.region, vpc: tv });
    }
  });
  $t("tVpc").addEventListener("mouseover", (e) => {
    const c = e.target.closest(".t-vcard");
    const id = c ? c.dataset.m : null;
    if (id !== S.vpcHover) { S.vpcHover = id; vpcHover(id); }
  });
  addEventListener("resize", () => { if (S.vpcv?.page === "map") drawVpcLines(); });

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
        if (S.formOpen) closeForm();
        else if (S.vpcv.open) { S.vpcv.open = null; vpcRender(); }
        else closeVpc();
        return;
      }
      if (e.code !== "Escape" && !(e.ctrlKey && ["KeyX", "KeyI", "KeyR"].includes(e.code))) return;
      closeVpc();  // Ctrl+Alt+X / I / R 은 VPC 를 닫고 그 모드로
    }
    if (e.altKey) {  // 편집기 / 요소 추가 / 삭제 모드 (index.html 이 Alt 조합 중 X·S·I·R·Y·Esc 만 넘겨준다)
      if (e.code === "Escape") { toViewer(); return; }
      if (!S.data) return;
      if (e.code === "KeyX") setEdit(e.ctrlKey);
      else if (e.code === "KeyS" && !e.ctrlKey && S.edit) saveLayout();
      else if (e.code === "KeyI" && e.ctrlKey) setPalette(!S.palette);
      else if (e.code === "KeyR" && e.ctrlKey) setDel(!S.del);
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
})();
