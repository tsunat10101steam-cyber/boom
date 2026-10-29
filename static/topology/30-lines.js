  // ------------------------------------------------------------ 좌표 측정 / 연결선
  function measure() {
    const wr = $t("topoWorld").getBoundingClientRect();
    const toWorld = (el) => {
      const r = el.getBoundingClientRect();
      return { x: (r.left - wr.left) / S.s, y: (r.top - wr.top) / S.s, w: r.width / S.s, h: r.height / S.s };
    };
    S.rects.clear();
    document.querySelectorAll("#topoRegions [data-node]").forEach(n => {  // 숨긴 요소(아이콘 보기의 칩 등)는 자리가 없으니 빼고
      if (!S.rects.has(n.dataset.node) && shown(n)) S.rects.set(n.dataset.node, toWorld(n));
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

  // CloudFront 원본 도메인 → 지도의 노드 id. bucket.s3(.region).amazonaws.com → 버킷, name-123.region.elb.amazonaws.com → LB 이름
  function cfOrigin(domain) {
    const m = /^(.+?)\.s3[.-]/.exec(domain);
    if (m) return m[1];
    if (/\.elb\.amazonaws\.com$/.test(domain)) return domain.split(".")[0].replace(/^internal-/, "").replace(/-\d+$/, "");
    return domain;
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
    for (const [id, n] of S.nodes) {  // CloudFront 배포 → 원본 (S3 버킷 · 로드 밸런서)
      if (n.kind !== "res" || n.data.type !== "CloudFront") continue;
      const a = S.rects.get(id);
      for (const o of n.data.origins || []) {
        const b = S.rects.get(cfOrigin(o));
        if (a && b) out.push(`<g style="color:#a855f7">${line(a, b, "t-l cf", "")}</g>`);
      }
      const cert = n.data.cert && S.rects.get(n.data.cert);  // 쓰는 ACM 인증서
      if (a && cert) out.push(`<g style="color:#DD344C">${line(a, cert, "t-l cf acm", "")}</g>`);
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
    out.push(annotLinesSVG());  // 초안에서 직접 그은 연결선
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
      case "ext":
        return `<h4>${esc(d.label)}</h4><div class="kind">${esc(t("el." + d.kind))} · ${esc(t("k.ext"))}</div>
          <div class="muted" style="font-size:12px">${esc(t("i_ext"))}</div>`;
      case "global": {
        const c = (k) => (d[k] || []).length;
        return `<h4>${esc(t("t_global"))}</h4><div class="kind">${esc(t("t_global_kind"))}</div>
          ${kv("Route 53", c("zones"))}${kv("CloudFront", c("dists"))}${kv(t("t_iam_users"), c("users"))}${kv(t("t_iam_roles"), c("roles"))}
          ${d.hidden_roles ? `<div class="muted" style="font-size:12px;margin-top:6px">${esc(t("t_hidden_roles", { n: d.hidden_roles }))}</div>` : ""}`;
      }
      default:
        return `<h4>${esc(d.name || id)}</h4><div class="kind">${esc(d.type)} · ${esc(stateText(d.state))}</div>
          ${kv("ID", `<span class="mono">${esc(id)}</span>`)}${kv(t("col_detail"), esc(d.detail))}
          ${kv(t("f_priv_ip"), esc(d.private_ip))}${kv(t("f_pub_ip"), esc(d.public_ip))}
          ${kv(t("f_sgs"), d.sgs?.length ? esc(d.sgs.join(", ")) : "")}
          ${d.managed ? kv(t("f_managed"), managedBadge(d.managed)) : ""}
          ${n.region ? kv(t("f_creator"), S.creators[id] ? whoText(S.creators[id]) : `<a class="t-link" data-who="${esc(id)}">${esc(t("lookup_ct"))}</a>`) : ""}
          ${badgesOf(d).length ? kv(t("sw_title"), badgesOf(d).map(b => esc(swInfo(b)[1])).join(", ")) : ""}
          ${d.asg ? kv("Auto Scaling", esc(d.asg)) : ""}
          ${d.origins?.length ? kv(t("t_cf_origins"), d.origins.map(o => S.nodes.has(cfOrigin(o)) ? goNode(cfOrigin(o)) : esc(o)).join("<br>")) : ""}
          ${n.subnet ? kv(t("k.subnet"), goNode(n.subnet)) : ""}${n.vpc ? kv("VPC", goNode(n.vpc)) : ""}
          ${kv(t("k.region"), n.global ? esc(t("t_global")) : esc(regionName(n.region)))}`;
    }
  }

  async function lookupWho(id) {
    const n = S.nodes.get(id);
    S.creators[id] = { loading: true }; select(id);
    try { S.creators[id] = await api("/api/creator", { region: n.region, id, type: n.data.type }); }
    catch (e) { S.creators[id] = { error: e.message }; }
    if (S.sel === id) select(id);
  }
