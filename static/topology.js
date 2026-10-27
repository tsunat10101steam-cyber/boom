"use strict";
// 토폴로지(아키텍처) 뷰.
// 리전(경도순 가로 배치) > VPC > AZ > 서브넷 > 리소스, 그리고 피어링/TGW/라우팅 연결선.
// 마우스를 화면 가장자리에 대면 그 방향으로 이동, 휠 = 확대/축소, 드래그 = 이동.
// index.html 의 전역(api, esc, checked, identity, TYPE_COLORS)을 사용한다.
(() => {
  // 리전 이름과 대략적인 경도 (왼쪽=서쪽 → 오른쪽=동쪽 순으로 배치)
  const REGIONS = {
    "us-west-1": ["캘리포니아 북부", -122], "us-west-2": ["오레곤", -120], "us-gov-west-1": ["GovCloud 서부", -119],
    "ca-west-1": ["캘거리", -114], "mx-central-1": ["멕시코", -100], "us-east-2": ["오하이오", -83],
    "us-east-1": ["버지니아 북부", -78], "us-gov-east-1": ["GovCloud 동부", -77], "ca-central-1": ["캐나다 중부", -73],
    "sa-east-1": ["상파울루", -46], "eu-west-1": ["아일랜드", -6], "eu-south-2": ["스페인", -1],
    "eu-west-2": ["런던", 0], "eu-west-3": ["파리", 2], "eu-central-1": ["프랑크푸르트", 8.7],
    "eu-central-2": ["취리히", 8.5], "eu-south-1": ["밀라노", 9], "eu-north-1": ["스톡홀름", 18],
    "af-south-1": ["케이프타운", 18.4], "il-central-1": ["텔아비브", 34.8], "me-south-1": ["바레인", 50.5],
    "me-central-1": ["UAE", 54], "ap-south-1": ["뭄바이", 72.8], "ap-south-2": ["하이데라바드", 78.5],
    "ap-southeast-7": ["태국", 100.5], "ap-southeast-5": ["말레이시아", 101.7], "ap-southeast-1": ["싱가포르", 103.8],
    "ap-southeast-3": ["자카르타", 106.8], "cn-northwest-1": ["닝샤", 106], "cn-north-1": ["베이징", 116.4],
    "ap-east-1": ["홍콩", 114.2], "ap-east-2": ["타이베이", 121.5], "ap-northeast-2": ["서울", 127],
    "ap-northeast-3": ["오사카", 135.5], "ap-northeast-1": ["도쿄", 139.7], "ap-southeast-4": ["멜버른", 144.9],
    "ap-southeast-2": ["시드니", 151.2], "ap-southeast-6": ["뉴질랜드", 174.8],
  };
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
      if (!r.ok) return toast(`테두리 없는 창으로 바꾸지 못했습니다 · ${r.reason || "알 수 없는 이유"}`);
      // Edge 가 직접 그리는 제목 표시줄/가장자리가 남아 있으면 그 두께만큼 창을 화면 밖으로 밀어낸다
      await new Promise(res => setTimeout(res, 250));
      const dpr = devicePixelRatio || 1;
      const side = Math.max(0, Math.round((outerWidth - innerWidth) / 2 * dpr));
      const top = Math.max(0, Math.round((outerHeight - innerHeight) * dpr) - side);
      if (S.on && (side || top)) await windowMode("borderless", { left: side, top, right: side, bottom: side });
    }, (e) => toast(`테두리 없는 창으로 바꾸지 못했습니다 · ${e.message}`));
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
    msg("네트워크 구조를 불러오는 중…");
    $t("tRefresh").disabled = true;
    try {
      S.data = await api("/api/topology", { regions: checked("#regions") });
      render();
    } catch (e) {
      msg(identity ? "불러오지 못했습니다\n" + e.message : "먼저 AWS 계정에 연결하세요");
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
    const regions = [...S.data.regions].sort((a, b) => (REGIONS[a.region]?.[1] ?? 0) - (REGIONS[b.region]?.[1] ?? 0));
    const html = regions.map(regionHTML).join("");
    $t("topoRegions").innerHTML = html;

    let nv = 0, ns = 0, ni = 0, nr = 0, nb = 0;
    for (const [, n] of S.nodes) {
      if (n.kind === "vpc") nv++; else if (n.kind === "subnet") ns++;
      else if (n.kind === "region") nr++;
      else if (n.kind === "res" && n.data.type === "EC2") ni++;
      else if (n.kind === "res" && n.data.type === "S3") nb++;
    }
    $t("tStats").textContent = `리전 ${nr} · VPC ${nv} · 서브넷 ${ns} · 인스턴스 ${ni} · S3 ${nb} · 피어링 ${S.peerings.length} · ${S.data.as_of}`;
    $t("tWarn").textContent = S.data.warnings.length ? `경고 ${S.data.warnings.length}건` : "";
    $t("tWarn").title = S.data.warnings.join("\n");
    msg(html ? "" : (S.showDefault ? "VPC 가 없습니다" : "기본 VPC 말고는 아무것도 없어요\n'기본 VPC' 를 켜면 보입니다"));
    if (S.sel && !S.nodes.has(S.sel)) select(null);

    requestAnimationFrame(() => {
      measure();
      if (!S.fitted && html) { fit(true); S.fitted = true; }
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
    const name = REGIONS[r.region]?.[0] || r.region;
    const azs = r.azs?.length ? r.azs : [...new Set(vpcs.flatMap(v => v.subnets.map(s => s.az)))].sort();
    r.tgws.forEach(t => reg(t.id, "tgw", t, { region: r.region }));
    buckets.forEach(b => reg(b.id, "res", b, { region: r.region }));
    return `<section class="t-region" data-region="${esc(r.region)}">
      <header>${icon("region", 22)}<span class="t-rname">${esc(name)}</span><span class="t-rcode mono">${esc(r.region)}</span>
        <span class="t-azlist">${azs.map(a => `<span class="t-tag">${esc(a)}</span>`).join("")}</span></header>
      <div class="t-vpcs">${vpcs.map(v => vpcHTML(r, v)).join("")}</div>
      ${r.tgws.length ? `<div class="t-tgws">${r.tgws.map(t =>
        `<span class="t-node t-tgw" data-node="${esc(t.id)}">${icon("tgw")}Transit Gateway · ${esc(t.name || t.id)}</span>`).join("")}</div>` : ""}
      ${buckets.length ? `<div class="t-svcs"><div class="t-svcs-h">리전 서비스 (VPC 밖)</div>${buckets.map(resHTML).join("")}</div>` : ""}
    </section>`;
  }

  function vpcHTML(r, v) {
    reg(v.id, "vpc", v, { region: r.region });
    if (v.igw) reg(v.igw, "igw", { id: v.igw, vpc: v.id }, { region: r.region, vpc: v.id });
    v.route_tables.forEach(rt => reg(rt.id, "rt", rt, { region: r.region, vpc: v.id }));
    v.tgw_attachments.forEach(a => reg(a.id, "att", a, { region: r.region, vpc: v.id }));
    v.gateway_endpoints.forEach(e => reg(e.id, "res", e, { region: r.region, vpc: v.id }));
    const byAz = {};
    v.subnets.forEach(s => (byAz[s.az] ||= []).push(s));
    const peers = S.peerings.filter(p => p.a.vpc === v.id || p.b.vpc === v.id);
    const title = v.name || (v.default ? "기본 VPC" : v.id);
    return `<div class="t-vpc ${v.default ? "default" : ""}" data-node="${esc(v.id)}">
      ${v.igw ? `<span class="t-node t-igw" data-node="${esc(v.igw)}">${icon("igw")}IGW</span>` : ""}
      <div class="t-vpc-h">${icon("vpc", 20)}<b>${esc(title)}</b><span class="mono muted">${esc(v.cidr)}</span>
        ${v.default ? '<span class="t-tag">default</span>' : ""}<span class="mono muted t-id">${esc(v.id)}</span></div>
      <div class="t-azs">${Object.keys(byAz).sort().map(az => `<div class="t-az"><div class="t-az-h">${esc(az)}</div>
        ${byAz[az].map(s => subnetHTML(r, v, s)).join("")}</div>`).join("") || '<span class="muted">서브넷 없음</span>'}</div>
      <div class="t-vpc-f">
        ${v.route_tables.map(rt => `<span class="t-node t-rt" data-node="${esc(rt.id)}">${icon("rt", 16)}${esc(rt.name || rt.id)}${rt.main ? " · main" : ""}</span>`).join("")}
        ${v.gateway_endpoints.map(resHTML).join("")}
        ${peers.map(p => `<span class="t-node t-pcx ${esc(p.status)}" data-node="${esc(p.id)}">${icon("pcx", 16)}${esc(p.name || p.id)} · ${esc(p.status)}</span>`).join("")}
        ${v.tgw_attachments.map(a => `<span class="t-node t-att" data-node="${esc(a.id)}">${icon("tgw", 16)}TGW 연결 · ${esc(a.state)}</span>`).join("")}
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
        ? `<span class="t-rsp" title="${esc(x.managed.by)} 가 관리 · 지워도 다시 생김">↻</span>` : ""}</div>`;
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
    S.regionRects = [...document.querySelectorAll("#topoRegions .t-region")].map(n => ({ ...toWorld(n), code: n.dataset.region }));
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
    box.innerHTML = `<button class="ghost t-close" id="tInspClose" aria-label="닫기">✕</button>` + inspectHTML(id);
    box.classList.remove("hidden");
    $t("tInspClose").onclick = () => select(null);
  }
  const kv = (k, v) => (v == null || v === "" ? "" : `<div class="t-kv"><span>${k}</span><span>${v}</span></div>`);
  const go = (id, label) => `<a class="t-link" data-go="${esc(id)}">${esc(label || id)}</a>`;
  const goNode = (id) => { const n = S.nodes.get(id); return go(id, n?.data?.name || id); };

  function routesTable(rt, vpcId) {
    return `<table><tr><th>대상</th><th>타깃</th><th>상태</th></tr>${rt.routes.map(r => {
      const t = routeTarget(r.target, vpcId);
      return `<tr><td class="mono">${esc(r.dest)}</td><td>${S.nodes.has(t) ? goNode(t) : esc(r.target)}</td>
        <td class="${r.state === "blackhole" ? "err" : ""}">${esc(r.state)}</td></tr>`;
    }).join("")}</table>`;
  }

  function inspectHTML(id) {
    const n = S.nodes.get(id), d = n.data;
    switch (n.kind) {
      case "region":
        return `<h4>${esc(REGIONS[id]?.[0] || id)}</h4><div class="kind">리전 · ${esc(id)}</div>
          ${kv("VPC", d.vpcs.length)}${kv("Transit Gateway", d.tgws.length)}`;
      case "vpc": {
        const peers = S.peerings.filter(p => p.a.vpc === id || p.b.vpc === id);
        return `<h4>${esc(d.name || id)}</h4><div class="kind">VPC · ${esc(n.region)}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv("CIDR", `<span class="mono">${esc(d.cidr)}</span>`)}
          ${kv("기본 VPC", d.default ? "예" : "아니오")}${kv("인터넷 게이트웨이", d.igw ? go(d.igw) : "없음")}
          ${kv("서브넷", d.subnets.length)}
          <div class="sec">라우팅 테이블</div>${d.route_tables.map(rt => `<div class="t-kv"><span>${go(rt.id, rt.name || rt.id)}${rt.main ? " (main)" : ""}</span><span>서브넷 ${rt.subnets.length}개</span></div>`).join("")}
          ${peers.length ? `<div class="sec">피어링</div>${peers.map(p => `<div class="t-kv"><span>${go(p.id, p.name || p.id)}</span><span>${esc(p.status)}</span></div>`).join("")}` : ""}
          ${d.tgw_attachments.length ? `<div class="sec">Transit Gateway</div>${d.tgw_attachments.map(a => `<div class="t-kv"><span>${goNode(a.tgw)}</span><span>${esc(a.state)}</span></div>`).join("")}` : ""}
          ${d.gateway_endpoints.length ? `<div class="sec">게이트웨이 엔드포인트</div>${d.gateway_endpoints.map(e => `<div class="t-kv"><span>${go(e.id, e.name)}</span><span>${esc(e.state)}</span></div>`).join("")}` : ""}`;
      }
      case "subnet": {
        const rt = S.nodes.get(d.rt)?.data;
        return `<h4>${esc(d.name || id)}</h4><div class="kind">서브넷 · ${d.public ? "Public" : "Private"} · ${esc(d.az)}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv("CIDR", `<span class="mono">${esc(d.cidr)}</span>`)}
          ${kv("VPC", goNode(n.vpc))}${kv("남은 IP", d.free_ips)}
          ${kv("라우팅 테이블", rt ? `${go(rt.id, rt.name || rt.id)}${rt.main && !rt.subnets.includes(id) ? " (main, 암시적)" : ""}` : "-")}
          ${rt ? `<div class="sec">라우트</div>${routesTable(rt, n.vpc)}` : ""}
          ${d.resources.length ? `<div class="sec">리소스 ${d.resources.length}개</div>${d.resources.map(x => `<div class="t-kv"><span>${go(x.id, x.name || x.id)}</span><span>${esc(x.type)} · ${esc(x.state)}</span></div>`).join("")}` : ""}`;
      }
      case "rt":
        return `<h4>${esc(d.name || id)}</h4><div class="kind">라우팅 테이블${d.main ? " · main" : ""}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv("VPC", goNode(n.vpc))}
          <div class="sec">라우트</div>${routesTable(d, n.vpc)}
          <div class="sec">연결된 서브넷</div>
          ${d.subnets.length ? d.subnets.map(s => `<div class="t-kv"><span>${goNode(s)}</span><span>명시적</span></div>`).join("") : ""}
          ${d.main ? `<div class="muted" style="font-size:12px;margin-top:6px">main 테이블 — 명시적 연결이 없는 서브넷은 모두 이 테이블을 씁니다</div>` : ""}`;
      case "pcx":
        return `<h4>${esc(d.name || id)}</h4><div class="kind">VPC 피어링 · ${esc(d.status)}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}
          <div class="sec">요청자</div>${kv("VPC", S.nodes.has(d.a.vpc) ? goNode(d.a.vpc) : esc(d.a.vpc))}${kv("리전", esc(d.a.region))}${kv("CIDR", esc(d.a.cidr))}${kv("계정", esc(d.a.owner))}
          <div class="sec">수락자</div>${kv("VPC", S.nodes.has(d.b.vpc) ? goNode(d.b.vpc) : esc(d.b.vpc))}${kv("리전", esc(d.b.region))}${kv("CIDR", esc(d.b.cidr))}${kv("계정", esc(d.b.owner))}`;
      case "tgw": {
        const atts = [...S.nodes.values()].filter(x => x.kind === "att" && x.data.tgw === id);
        return `<h4>${esc(d.name || id)}</h4><div class="kind">Transit Gateway · ${esc(d.state)}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}
          <div class="sec">연결된 VPC</div>${atts.map(a => `<div class="t-kv"><span>${goNode(a.vpc)}</span><span>${esc(a.data.state)}</span></div>`).join("") || '<div class="muted">없음</div>'}`;
      }
      case "att":
        return `<h4>TGW 연결</h4><div class="kind">${esc(d.state)}</div>${kv("ID", `<span class="mono">${esc(id)}</span>`)}
          ${kv("Transit Gateway", S.nodes.has(d.tgw) ? goNode(d.tgw) : esc(d.tgw))}${kv("VPC", goNode(n.vpc))}`;
      case "igw":
        return `<h4>인터넷 게이트웨이</h4><div class="kind">IGW</div>${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv("VPC", goNode(n.vpc))}`;
      default:
        return `<h4>${esc(d.name || id)}</h4><div class="kind">${esc(d.type)} · ${esc(d.state)}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv("상세", esc(d.detail))}
          ${kv("사설 IP", esc(d.private_ip))}${kv("공인 IP", esc(d.public_ip))}
          ${kv("보안 그룹", d.sgs?.length ? esc(d.sgs.join(", ")) : "")}
          ${d.managed ? kv("관리 주체", managedBadge(d.managed)) : ""}
          ${n.region ? kv("만든 사람", S.creators[id] ? whoText(S.creators[id]) : `<a class="t-link" data-who="${esc(id)}">CloudTrail 에서 조회</a>`) : ""}
          ${n.subnet ? kv("서브넷", goNode(n.subnet)) : ""}${kv("VPC", goNode(n.vpc))}${kv("리전", esc(n.region))}`;
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
    g.fillStyle = v("--panel2"); g.strokeStyle = C.region;
    for (const r of S.regionRects) { g.fillRect(ox + r.x * m, oy + r.y * m, r.w * m, r.h * m); g.strokeRect(ox + r.x * m, oy + r.y * m, r.w * m, r.h * m); }
    g.globalAlpha = 0.4; g.fillStyle = C.vpc;
    for (const r of S.vpcRects) g.fillRect(ox + r.x * m, oy + r.y * m, r.w * m, r.h * m);
    g.globalAlpha = 1; g.fillStyle = v("--mute"); g.font = "10px Segoe UI, sans-serif";
    for (const r of S.regionRects) {
      const w = r.w * m - 6;
      let t = REGIONS[r.code]?.[0] || r.code;
      if (w < 14) continue;
      while (t.length > 1 && g.measureText(t).width > w) t = t.slice(0, -1);
      g.fillText(t, ox + r.x * m + 3, oy + r.y * m + 11);
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
  const copyId = (id) => navigator.clipboard.writeText(id).then(() => toast(`복사됨 · ${id}`), () => toast("복사하지 못했습니다"));

  function menuItems(id, n, region) {
    const view = [item("상세 보기", () => select(id)), item("여기로 이동", () => focus(id)), item("ID 복사", () => copyId(id))];
    if (!n || n.kind === "region") {
      return [item("VPC 생성", () => openForm("vpc", { region }), "vpc"), SEP,
        item("전체 보기", () => fit()), item("새로고침", () => load()),
        item(S.showDefault ? "기본 VPC 숨기기" : "기본 VPC 표시", () => $t("tDefault").click()),
        item(S.showRoutes ? "라우팅 전체 숨기기" : "라우팅 전체 표시", () => $t("tRoutes").click())];
    }
    if (n.kind === "vpc") {
      return [item("서브넷 생성", () => openForm("subnet", { region, vpc: n.data }), "priv"),
        item("인스턴스 생성", () => openForm("instance", { region, vpc: n.data }), "ec2"),
        ...(n.data.igw ? [] : [item("인터넷 게이트웨이 생성·연결", () => openForm("igw", { region, vpc: n.data }), "igw")]),
        SEP, ...view];
    }
    if (n.kind === "subnet") {
      const vpc = S.nodes.get(n.vpc).data;
      return [item("인스턴스 생성", () => openForm("instance", { region, vpc, subnet: n.data }), "ec2"),
        item("서브넷 생성", () => openForm("subnet", { region, vpc }), "priv"), SEP, ...view];
    }
    return view;
  }

  function openMenu(x, y, target) {
    const el = target.closest?.("#topoRegions [data-node]");
    const id = el?.dataset.node, n = id ? S.nodes.get(id) : null;
    const region = n?.region || target.closest?.(".t-region")?.dataset.region || null;
    const items = menuItems(id, n, region);
    const title = n ? `${{ region: "리전", vpc: "VPC", subnet: "서브넷", rt: "라우팅 테이블", pcx: "피어링", tgw: "Transit Gateway",
      att: "TGW 연결", igw: "인터넷 게이트웨이" }[n.kind] || n.data.type} · ${n.data.name || id}` :
      (region ? `${REGIONS[region]?.[0] || region}` : "토폴로지");
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
  const regionName = (r) => `${REGIONS[r]?.[0] || r} (${r})`;
  const field = (label, html) => `<label class="row"><span>${label}</span>${html}</label>`;

  function openForm(kind, ctx) {
    closeMenu();
    const regions = S.data.regions.map(r => r.region);
    const region = ctx.region || regions[0];
    let title, sub, body, note = "";
    if (kind === "vpc") {
      title = [icon("vpc", 22), "VPC 생성"]; sub = "새 VPC 를 만듭니다";
      body = field("리전", `<select name="region">${regions.map(r => `<option value="${esc(r)}" ${r === region ? "selected" : ""}>${esc(regionName(r))}</option>`).join("")}</select>`) +
        field("이름", `<input type="text" name="name" placeholder="my-vpc">`) +
        field("IPv4 CIDR", `<input type="text" name="cidr" class="mono" value="${suggestVpcCidr(region)}">`) +
        `<label class="chk"><input type="checkbox" name="with_igw" checked> 인터넷 게이트웨이도 만들어서 연결</label>`;
    } else if (kind === "subnet") {
      const azs = S.data.regions.find(r => r.region === region)?.azs || [];
      title = [icon("priv", 22), "서브넷 생성"]; sub = `${ctx.vpc.name || ctx.vpc.id} · ${ctx.vpc.cidr}`;
      body = field("가용 영역 (AZ)", `<select name="az">${azs.map(a => `<option>${esc(a)}</option>`).join("")}</select>`) +
        field("이름", `<input type="text" name="name" placeholder="private-a">`) +
        field("IPv4 CIDR", `<input type="text" name="cidr" class="mono" value="${freeCidr(ctx.vpc.cidr, ctx.vpc.subnets.map(s => s.cidr), 24)}">`);
      note = "새 서브넷은 VPC 의 main 라우팅 테이블을 씁니다.";
    } else if (kind === "igw") {
      title = [icon("igw", 22), "인터넷 게이트웨이 생성·연결"]; sub = `${ctx.vpc.name || ctx.vpc.id}`;
      body = field("이름", `<input type="text" name="name" value="${esc((ctx.vpc.name || "vpc") + "-igw")}">`);
      note = "IGW 만 연결됩니다. 서브넷을 Public 으로 쓰려면 라우팅 테이블에 0.0.0.0/0 → IGW 경로가 필요합니다.";
    } else {
      const subnets = ctx.vpc.subnets;
      const pick = ctx.subnet || subnets[0];
      title = [icon("ec2", 22), "인스턴스 생성"]; sub = `${ctx.vpc.name || ctx.vpc.id} · ${regionName(region)}`;
      body = (subnets.length ? field("서브넷", `<select name="subnet">${subnets.map(s =>
          `<option value="${esc(s.id)}" data-public="${s.public}" ${s.id === pick?.id ? "selected" : ""}>${esc(s.name || s.id)} · ${esc(s.az)} · ${s.public ? "Public" : "Private"}</option>`).join("")}</select>`)
          : `<div class="err" style="margin-bottom:12px">이 VPC 에 서브넷이 없습니다. 서브넷부터 만드세요.</div>`) +
        field("이름", `<input type="text" name="name" placeholder="web-1">`) +
        field("인스턴스 유형", `<select name="instance_type">${["t3.micro", "t3.small", "t3.medium", "t3.large", "m5.large"].map(t => `<option>${t}</option>`).join("")}</select>`) +
        `<label class="chk"><input type="checkbox" name="public_ip" ${pick?.public ? "checked" : ""}> 공인 IP 할당</label>`;
      note = "Amazon Linux 2023 최신 AMI · VPC 기본 보안 그룹으로 시작합니다. 실행 중에는 요금이 발생합니다.";
    }
    const wrap = $t("tForm");
    wrap.innerHTML = `<form class="t-form" autocomplete="off"><h3>${title.join("")}</h3><div class="sub">${esc(sub)}</div>
      ${body}${note ? `<div class="note">${esc(note)}</div>` : ""}<div class="err" id="tFormErr" style="font-size:12.5px;margin-bottom:10px"></div>
      <div class="btns"><button type="button" id="tFormCancel">취소</button><button type="submit" class="primary">만들기</button></div></form>`;
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
      btn.disabled = true; btn.textContent = "만드는 중…"; $t("tFormErr").textContent = "";
      try {
        const res = await api("/api/create", body);
        closeForm();
        toast(`만들었습니다 · ${res.id}`);
        S.pendingFocus = res.id;
        load();
      } catch (err) {
        $t("tFormErr").textContent = err.message;
        btn.disabled = false; btn.textContent = "만들기";
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
    select(n ? n.dataset.node : null);
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

  window.Topology = { enter, exit, key, get on() { return S.on; } };
})();
