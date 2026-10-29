  // ------------------------------------------------------------ 아이콘 바꾸기
  // 우클릭 > '아이콘 바꾸기…' 로 요소의 그림을 소프트웨어(OpenVPN · Spring Boot · Nginx · React ...) · AWS · 기타 아이콘으로.
  // 그림에서만 바뀌고(AWS 와 무관) 계정별로 저장된다. 상표 로고 대신 그 소프트웨어 색의 자체 그림
  const SW_GLYPH = {
    nginx: '<path d="M12 3.5l7.5 4.3v8.4L12 20.5 4.5 16.2V7.8z"/><path d="M9.5 15.5v-7l5 7v-7"/>',
    apache: '<path d="M17.5 4.5c-5 1-9 6-10.5 14.5M17.5 4.5c-1 4-3.5 7-7.5 9M14 9.5H9.5M12.5 12.5H8.6"/>',
    tomcat: '<path d="M6 9l-1-4.5 4 2.5h6l4-2.5-1 4.5c1 1.2 1.5 2.6 1.5 4 0 3.6-3.4 6-7.5 6S4.5 16.6 4.5 13c0-1.4.5-2.8 1.5-4z"/><path d="M9.5 12.5h.01M14.5 12.5h.01M11 15.5h2"/>',
    node: '<path d="M12 3.5l7.5 4.3v8.4L12 20.5 4.5 16.2V7.8z"/><path d="M12 8l3.8 2.2v4.6L12 17l-3.8-2.2v-4.6z"/>',
    react: '<ellipse cx="12" cy="12" rx="8.5" ry="3.3"/><ellipse cx="12" cy="12" rx="8.5" ry="3.3" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8.5" ry="3.3" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.3" fill="#fff"/>',
    vue: '<path d="M4 5h4l4 7 4-7h4l-8 14z"/><path d="M8.5 5l3.5 6 3.5-6"/>',
    angular: '<path d="M12 3.5l8 3-1.3 10.5L12 20.5 5.3 17 4 6.5z"/><path d="M9 15.5l3-8 3 8M10 13h4"/>',
    spring: '<path d="M18.5 5.5C11 5 6 9 6 14.5c0 2.2 1.2 4 3 4.5C15 19 19 13 18.5 5.5z"/><path d="M6.5 18.5c2-4 5-7 9-9.5"/>',
    django: '<path d="M10 4.5v12.8c-3 .6-5-.5-5-3.2S7 10.4 10 11M15 9v8.5c0 2-1 3-3 3M15 5.5v.5"/>',
    flask: '<path d="M10 4h4M10.5 4v5L5.5 18a1.5 1.5 0 0 0 1.3 2.2h10.4a1.5 1.5 0 0 0 1.3-2.2L13.5 9V4M7.5 14.5h9"/>',
    php: '<ellipse cx="12" cy="12" rx="9" ry="5.5"/><path d="M7.5 14.5l1-5h1.8a1.3 1.3 0 0 1 0 2.6H8.6M14.5 14.5l1-5h1.8a1.3 1.3 0 0 1 0 2.6h-1.7M12 9.5l-1 5"/>',
    python: '<path d="M12 4c-4 0-4 1.8-4 3v2h4.5M8 9H6c-1.5 0-2.5 1-2.5 3.5S4.5 16 6 16h1.5v-2.5c0-1.5 1-2.5 2.5-2.5h4c1.5 0 2.5-1 2.5-2.5V7c0-1.5-1.5-3-4.5-3zM12 20c4 0 4-1.8 4-3v-2h-4.5M16 15h2c1.5 0 2.5-1 2.5-3.5S19.5 8 18 8h-1.5"/>',
    java: '<path d="M6 10h10v4a4.5 4.5 0 0 1-4.5 4.5h-1A4.5 4.5 0 0 1 6 14zM16 11h1.5a2 2 0 0 1 0 4H16M5 20.5h12M9.5 3.5c-1 1.2 1 2 0 3.3M12.5 3.5c-1 1.2 1 2 0 3.3"/>',
    docker: '<path d="M3.5 12.5h15c.5-1 1.5-1.5 2.5-1.3-.3 4.8-4 8.3-9.5 8.3-4.5 0-7-2.8-8-7z"/><path d="M6 12.5V10h2.5v2.5M8.5 12.5V10H11v2.5M11 12.5V10h2.5v2.5M8.5 10V7.5H11V10M11 10V7.5h2.5V10"/>',
    mysql: '<ellipse cx="12" cy="6.5" rx="6" ry="2.5"/><path d="M6 6.5v11c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-11M6 12c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5"/>',
    postgres: '<path d="M8 19.5c-1-3-1.5-6.5-1-9.5C7.5 6 10 4.5 12.5 4.5c3.5 0 6 2.5 6 6 0 2.8-1.5 4.8-3.5 5.5M12.5 4.5c-1.5 2-2 4.5-1.5 7.5.4 2.5 2 4 4 4M15 16v3.5"/>',
    redis: '<path d="M4 9l8-3.5L20 9l-8 3.5zM4 12.5l8 3.5 8-3.5M4 16l8 3.5 8-3.5"/>',
    mongodb: '<path d="M12 3.5c3.5 3.5 5 6.5 5 9.5s-2.2 5.5-5 6.5c-2.8-1-5-3.5-5-6.5s1.5-6 5-9.5zM12 6v15.5"/>',
    openvpn: '<circle cx="12" cy="11" r="7.5"/><circle cx="12" cy="9.5" r="2.2"/><path d="M11 11.5l-1 7h4l-1-7"/>',
    jenkins: '<circle cx="12" cy="9" r="5"/><path d="M5.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M10 9h.01M14 9h.01M10.5 11.5c1 .7 2 .7 3 0"/>',
    wordpress: '<circle cx="12" cy="12" r="8.5"/><path d="M6.5 8.5l3.5 9 2-6 2 6 3.5-9M5.5 8.5h3M15.5 8.5h3"/>',
    kafka: '<circle cx="12" cy="5.5" r="2"/><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="18.5" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="18" cy="15" r="2"/><path d="M12 7.5v2M12 14.5v2M14.2 11l2-1.2M14.2 13l2 1.2"/>',
  };
  SOFTWARE.forEach(([k, , color]) => { if (SW_GLYPH[k]) ICONS["sw_" + k] = [color, SW_GLYPH[k]]; });
  const AWS_PICK = [["ec2", "EC2"], ["rds", "RDS"], ["s3", "S3"], ["elb", "ELB"], ["nat", "NAT"], ["lambda", "Lambda"], ["ecs", "ECS"],
    ["apigw", "API Gateway"], ["ep", "Endpoint"], ["igw", "IGW"], ["tgw", "TGW"], ["r53", "Route 53"], ["cf", "CloudFront"], ["acm", "ACM"], ["iamu", "IAM"]];
  const iconKey = () => "topoIconMap:" + (identity?.account || "-");
  function readIcons() { try { return JSON.parse(store.get(iconKey()) || "{}") || {}; } catch { return {}; } }
  const iconOf = (id, base) => (S.iconMap?.[id] && ICONS[S.iconMap[id]]) ? S.iconMap[id] : base;

  function openIconPicker(id) {
    const n = S.nodes.get(id);
    if (!n) return;
    closeMenu();
    const base = n.kind === "ext" ? n.data.kind : TYPE_ICON[n.data.type], cur = iconOf(id, base);
    const tile = ([key, label]) => `<button type="button" class="t-icpick ${key === cur ? "on" : ""}" data-ic="${esc(key)}">${icon(key, 34)}<span>${esc(label)}</span></button>`;
    const group = (title, list) => `<div class="t-sec"><div class="t-sec-h">${esc(title)}</div><div class="t-icgrid">${list.map(tile).join("")}</div></div>`;
    const wrap = $t("tForm");
    wrap.dataset.mode = "icon";
    wrap.innerHTML = `<div class="t-form">
      <div class="t-form-h"><h3>${icon(cur, 24)}<span>${esc(t("ic_title"))}</span></h3>
        <button type="button" class="ghost t-close" id="tFormX" aria-label="${esc(t("close"))}">✕</button></div>
      <div class="sub">${esc(n.data.name || n.data.label || id)}</div>
      <div class="t-form-b">
        ${group(t("ic_sw"), SOFTWARE.filter(([k]) => SW_GLYPH[k]).map(([k, nm]) => ["sw_" + k, nm]))}
        ${group("AWS", AWS_PICK)}
        ${group(t("ic_other"), EXT_KINDS.filter(([k]) => !["group", "note"].includes(k)).map(([k]) => [k, t("el." + k)]))}
        <div class="note">${esc(t("ic_note"))}</div>
      </div>
      <div class="t-form-f"><div class="btns"><button type="button" id="tIcReset" ${S.iconMap[id] ? "" : "disabled"}>${esc(t("ic_reset"))}</button>
        <button type="button" class="primary" id="tFormCancel">${esc(t("close"))}</button></div></div></div>`;
    wrap.classList.remove("hidden");
    wrap.classList.remove("in"); void wrap.offsetWidth; wrap.classList.add("in");
    S.formOpen = true;
    const set = (key) => {
      if (!key || key === base) delete S.iconMap[id]; else S.iconMap[id] = key;
      store.set(iconKey(), JSON.stringify(S.iconMap));
      closeForm();
      render();
    };
    wrap.querySelectorAll("[data-ic]").forEach(b => { b.onclick = () => set(b.dataset.ic); });
    $t("tIcReset").onclick = () => set(null);
    $t("tFormCancel").onclick = closeForm; $t("tFormX").onclick = closeForm;
  }

