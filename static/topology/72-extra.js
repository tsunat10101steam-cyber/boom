  // ------------------------------------------------------------ 부가 서비스 · 소프트웨어 배지
  // 부가 서비스 (ACM · Auto Scaling · Lambda · API Gateway · ECS): 지도를 먼저 그린 뒤 따로 불러와 끼워 넣는다 (지도 로딩이 느려지지 않게).
  //   VPC 안의 Lambda · ECS 서비스 = 그 서브넷, 나머지 = 리전 서비스, ASG = VPC 칩 + 속한 인스턴스에 표시,
  //   CloudFront 가 쓰는 ACM 인증서 = 글로벌 상자 (CloudFront 와 선으로)
  // 소프트웨어 배지: EC2 태그 App · Apps · Software · Stack 에 적은 것 + 우클릭 > '소프트웨어 배지' 로 직접 고른 것 (계정별 저장)
  Object.assign(ICONS, {
    acm: ["#DD344C", '<rect x="4.5" y="5" width="15" height="10" rx="1"/><path d="M8 8.5h8M8 11.5h5"/><circle cx="15.5" cy="15.5" r="2.5"/><path d="M14.3 17.6l-.8 3 2-1 2 1-.8-3"/>'],
    lambda: [C.compute, '<path d="M7 19l5-9M12 10l-2.5-5H7M12 10l4.5 9H19"/>'],
    apigw: ["#E7157B", '<path d="M8 5l-4 7 4 7M16 5l4 7-4 7M10.5 12h.5M13 12h.5"/>'],
    ecs: [C.compute, '<path d="M12 4l7 4v8l-7 4-7-4V8z"/><path d="M12 8l3.5 2v4L12 16l-3.5-2v-4z"/>'],
    asg: [C.compute, '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'],
  });
  Object.assign(TYPE_ICON, { "ACM": "acm", "Lambda": "lambda", "API Gateway": "apigw", "ECS Service": "ecs", "ASG": "asg" });

  async function loadExtra() {
    const data = S.data;  // 그 사이 새로고침하면 이 결과는 버린다
    try {
      const x = await api("/api/topology_extra", { regions: [] });
      if (S.data !== data) return;
      mergeExtra(x);
      if (S.on) render(); else S.needRender = true;
    } catch { /* 부가 서비스는 못 받아도 지도는 그대로 */ }
  }
  function mergeExtra(x) {
    const g = S.data.global || (S.data.global = { zones: [], dists: [], users: [], roles: [], hidden_roles: 0 });
    const cfCerts = new Set((g.dists || []).map(d => d.cert).filter(Boolean));
    g.certs = [];
    for (const r of S.data.regions) {
      const ex = x.regions?.[r.region];
      if (!ex) continue;
      const inCF = (i) => i.type === "ACM" && cfCerts.has(i.id);
      r.services = ex.region_items.filter(i => !inCF(i));
      g.certs.push(...ex.region_items.filter(inCF));
      const asgOf = new Map();
      ex.asgs.forEach(a => a.instances.forEach(id => asgOf.set(id, a.name)));
      for (const v of r.vpcs) {
        v.asgs = ex.asgs.filter(a => a.subnets.some(sid => v.subnets.some(s => s.id === sid)));
        for (const s of v.subnets) {
          s.resources = s.resources.filter(i => !i.extra).concat((ex.subnet_items[s.id] || []).map(i => ({ ...i, extra: true })));
          s.resources.forEach(i => { if (i.type === "EC2") i.asg = asgOf.get(i.id) || null; });
        }
      }
    }
  }
  const asgChip = (a) => `<span class="t-node t-asg" data-node="${esc(a.id)}">${icon("asg", 16)}Auto Scaling · ${esc(a.name)} · ${esc(a.detail)}</span>`;

  // ---- 소프트웨어 배지 (로고 대신 그 소프트웨어 색의 작은 이름표)
  const SOFTWARE = [["nginx", "Nginx", "#009639"], ["apache", "Apache", "#D22128"], ["tomcat", "Tomcat", "#C8961C"], ["node", "Node.js", "#5FA04E"],
    ["react", "React", "#1EA7C8"], ["vue", "Vue", "#42B883"], ["angular", "Angular", "#DD0031"], ["spring", "Spring Boot", "#6DB33F"],
    ["django", "Django", "#0C4B33"], ["flask", "Flask", "#555"], ["php", "PHP", "#777BB4"], ["python", "Python", "#3776AB"],
    ["java", "Java", "#E76F00"], ["docker", "Docker", "#2496ED"], ["mysql", "MySQL", "#00758F"], ["postgres", "PostgreSQL", "#336791"],
    ["redis", "Redis", "#DC382D"], ["mongodb", "MongoDB", "#47A248"], ["openvpn", "OpenVPN", "#EA7E20"], ["jenkins", "Jenkins", "#D24939"],
    ["wordpress", "WordPress", "#21759B"], ["kafka", "Kafka", "#444"]];
  const SW = new Map(SOFTWARE.map(s => [s[0], s]));
  const SW_ALIAS = { "node.js": "node", nodejs: "node", springboot: "spring", "spring-boot": "spring", postgresql: "postgres", pg: "postgres",
    mongo: "mongodb", httpd: "apache", reactjs: "react", vuejs: "vue", wp: "wordpress", vpn: "openvpn" };
  const badgeKey = () => "topoBadges:" + (identity?.account || "-");
  function readBadges() { try { return JSON.parse(store.get(badgeKey()) || "{}") || {}; } catch { return {}; } }
  const tagBadges = (x) => [...new Set((x.apps || []).map(a => SW_ALIAS[a] || a))];
  const badgesOf = (x) => [...new Set([...tagBadges(x), ...(S.badges?.[x.id] || [])])];
  const swInfo = (id) => SW.get(id) || [id, id, "#64748b"];  // 목록에 없는 태그 값은 회색 이름표로
  function badgeHTML(x) {
    const b = badgesOf(x);
    return b.length ? `<span class="t-sws">${b.map(id => { const [, nm, c] = swInfo(id); return `<span class="t-sw" style="--sw:${c}">${esc(nm)}</span>`; }).join("")}</span>` : "";
  }
  function openBadges(id) {
    const x = S.nodes.get(id)?.data;
    if (!x) return;
    closeMenu();
    const fromTag = new Set(tagBadges(x)), mine = new Set(S.badges[id] || []);
    const wrap = $t("tForm");
    wrap.dataset.mode = "badges";
    wrap.innerHTML = `<form class="t-form" autocomplete="off">
      <div class="t-form-h"><h3>${icon("ec2", 24)}<span>${esc(t("sw_title"))}</span></h3>
        <button type="button" class="ghost t-close" id="tFormX" aria-label="${esc(t("close"))}">✕</button></div>
      <div class="sub">${esc(x.name || id)} · ${esc(id)}</div>
      <div class="t-form-b"><div class="t-swgrid">${SOFTWARE.map(([k, nm, c]) => `<label class="t-swpick">
          <input type="checkbox" name="${k}" ${fromTag.has(k) || mine.has(k) ? "checked" : ""} ${fromTag.has(k) ? "disabled" : ""}>
          <span class="t-sw" style="--sw:${c}">${esc(nm)}</span>${fromTag.has(k) ? `<span class="muted">${esc(t("sw_tag"))}</span>` : ""}</label>`).join("")}</div>
        <div class="note">${esc(t("sw_note"))}</div></div>
      <div class="t-form-f"><div class="btns"><button type="button" id="tFormCancel">${esc(t("cancel"))}</button>
        <button type="submit" class="primary">${esc(t("sw_save"))}</button></div></div></form>`;
    wrap.classList.remove("hidden");
    wrap.classList.remove("in"); void wrap.offsetWidth; wrap.classList.add("in");
    S.formOpen = true;
    const f = wrap.querySelector("form");
    $t("tFormCancel").onclick = closeForm; $t("tFormX").onclick = closeForm;
    f.onsubmit = (e) => {
      e.preventDefault();
      const chosen = SOFTWARE.map(([k]) => k).filter(k => f.elements[k].checked && !fromTag.has(k));
      if (chosen.length) S.badges[id] = chosen; else delete S.badges[id];
      store.set(badgeKey(), JSON.stringify(S.badges));
      closeForm();
      render();
    };
  }

