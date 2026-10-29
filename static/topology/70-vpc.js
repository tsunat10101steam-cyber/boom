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
    cancelPaletteDrag();
    if (S.edrag) endElementDrag();
    setEdit(false); setPalette(false); setDel(false); closeForm(); closeMenu(); select(null);  // 초안 모드는 그대로 둔다
    S.vpcv = { region, id, page: "map", data: null, err: null, open: null, filter: "" };
    $t("topo").classList.add("vpcv");
    $t("tVpc").classList.remove("hidden");
    vpcLoad();
  }
  function closeVpc() {
    if (!S.vpcv) return;
    if (S.palette) setPalette(false);
    S.vpcv = null;
    closeForm();
    $t("tVpc").classList.add("hidden"); $t("tVpc").innerHTML = "";
    $t("topo").classList.remove("vpcv");
    if (S.draftOn) setPalette(true);  // 초안으로 돌아오면 요소 추가 바를 다시
  }
  async function vpcLoad() {
    const v = S.vpcv;
    v.data = null; v.err = null; vpcRender();
    try {
      const d = await api("/api/vpc_detail", { region: v.region, vpc: v.id });
      if (S.vpcv === v) { v.data = d; if (v.after) { [v.page, v.open] = v.after; v.after = null; v.filter = ""; } }
    }
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
        <span class="sp"></span><button data-v="pal" class="${S.palette ? "on" : ""}">＋ ${esc(t("v_add"))} <span class="t-kbd">Ctrl+Alt+I</span></button>
        <span class="t-kbd">Esc</span>
        <button data-v="refresh">${esc(t("t_refresh"))}</button></header>
      <div class="t-vbody"><nav class="t-vnav">${nav}</nav><main class="t-vmain" id="tVmain">${vpcPage()}</main></div>`;
    box.dataset.page = v.page;
    if (keepPage === v.page) $t("tVmain").scrollTop = keepScroll;
    const f = box.querySelector(".t-vfilter");
    if (f) f.oninput = () => { v.filter = f.value; box.querySelector(".t-vtable").innerHTML = vpcTable(v.page); };
    if (v.page === "map" && d) requestAnimationFrame(drawVpcLines);
    if (v.open) requestAnimationFrame(() => box.querySelector(`tr[data-row="${CSS.escape(v.open)}"]`)?.scrollIntoView({ block: "center" }));
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
        ${create ? `<button class="primary" data-v="create">${esc(t("v_create_x", { x: t("el." + create) }))}</button>` : ""}</div>
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
      rows: (d) => d.subnets, create: () => "subnet",
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
      rows: (d) => d.rts, create: () => "rt",
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
      rows: (d) => d.igws, create: (d) => d.igws.length ? null : "igw",
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
      rows: (d) => d.eips, create: () => "eip", note: () => t("v_eip_note"),
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
      rows: (d) => d.nats, create: (d) => d.subnets.length ? "nat" : null,
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
      rows: (d) => d.sgs, create: () => "sg",
      cols: [["v_group", (g) => esc(g.group)], ["ID", (g) => mono(g.id)], ["fm_name", nm], ["v_desc", (g) => esc(g.desc)],
        ["v_in", (g) => esc(g.in.length)], ["v_out", (g) => esc(g.out.length)]],
      det: (g) => `${kv("ID", mono(g.id))}${kv(t("v_group"), esc(g.group))}${kv(t("v_desc"), esc(g.desc))}${kv(t("v_owner"), mono(g.owner))}
        <div class="sec">${esc(t("v_in"))}</div>${sgTbl(g.in, "in")}<div class="sec">${esc(t("v_out"))}</div>${sgTbl(g.out, "out")}`,
    },
    eps: {
      rows: (d) => d.eps, create: () => "ep",
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
      `<div class="t-vcard" data-m="${esc(id)}" data-k="${page}" data-vgo="${page}:${esc(open || id)}">${icon(ic, 22)}<div class="t-vct"><b>${esc(name)}</b><span class="mono">${esc(sub)}</span></div>${extra}</div>`;
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
    else if (act === "pal") setPalette(!S.palette);
    else if (act === "create") {
      const tv = topoVpc(v);
      if (!tv) return toast(t("err.vpc_gone", { id: v.id }));
      openForm(VLIST[v.page].create(v.data), { region: v.region, vpc: tv, locked: true });
    }
  });
  $t("tVpc").addEventListener("mouseover", (e) => {
    const c = e.target.closest(".t-vcard");
    const id = c ? c.dataset.m : null;
    if (id !== S.vpcHover) { S.vpcHover = id; vpcHover(id); }
  });
  addEventListener("resize", () => { if (S.vpcv?.page === "map") drawVpcLines(); });
