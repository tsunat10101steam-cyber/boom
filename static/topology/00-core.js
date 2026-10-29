// 토폴로지(아키텍처) 뷰.
// 리전(세계지도 위 실제 위치) > VPC > AZ > 서브넷 > 리소스, 그리고 피어링/TGW/라우팅 연결선.
// 마우스를 화면 가장자리에 대면 그 방향으로 이동, 휠 = 확대/축소, 드래그 = 이동.
// index.html 의 전역(api, esc, checked, identity, TYPE_COLORS)을 사용한다.
//
// 이 폴더(static/topology/)의 *.js 는 한 파일을 구역별로 나눈 조각이다. app.py 의 /topology.js 가 이름 순서대로 이어 붙여
// "use strict"; (() => { ... })(); 하나로 감싸서 보내므로, 조각끼리 S · icon · openForm 같은 이름을 그대로 함께 쓴다.
// 불러올 때 바로 실행되는 코드는 앞 조각의 이름만 쓸 수 있으니 번호(순서)를 함부로 바꾸지 않는다.

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
    global: ["#0ea5e9", '<circle cx="12" cy="12" r="7.5"/><path d="M4.5 12h15M12 4.5c3 3 3 12 0 15M12 4.5c-3 3-3 12 0 15M6 7.5c3.5 1.6 8.5 1.6 12 0M6 16.5c3.5-1.6 8.5-1.6 12 0"/>'],
    r53: [C.net, '<circle cx="12" cy="12" r="7"/><path d="M9 15.5V8.5l6 7V8.5"/>'],
    cf: [C.net, '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 5v4.8M12 14.2V19M5 12h4.8M14.2 12H19"/>'],
    iamu: ["#DD344C", '<circle cx="12" cy="9" r="3.2"/><path d="M6 19c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2"/>'],
    iamr: ["#DD344C", '<circle cx="9.5" cy="9.5" r="3"/><path d="M4.5 18.5c.5-3 2.4-4.6 5-4.6M14 13.5h6M17 10.5v6"/>'],
    priv: [C.priv,'<rect x="7" y="11" width="10" height="8" rx="1.5"/><path d="M9 11V8.5a3 3 0 0 1 6 0V11"/>'],
  };
  const TYPE_ICON = { "EC2": "ec2", "S3": "s3", "RDS": "rds", "NAT Gateway": "nat", "ELB": "elb", "VPC Endpoint": "ep",
                      "Route 53 Zone": "r53", "CloudFront": "cf", "IAM User": "iamu", "IAM Role": "iamr" };
  const GLOBAL_AT = [79, -150];  // 글로벌 상자를 놓을 [위도, 경도] — 어느 리전에도 속하지 않으니 지도 왼쪽 위(북극해)
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
    // 설계 초안 (Ctrl+Alt+E): draft = 초안에 넣은 실제 리소스 id 들 (계정별 저장). 켜져 있으면 지도에 이것만 그린다
    draftOn: false, draft: null,
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
    setEdit(false); setPalette(false); setDel(false); closeVpc(); setDraft(false);
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
