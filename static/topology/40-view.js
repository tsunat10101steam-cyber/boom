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
  // 요소 추가 바가 열려 있으면 그 오른쪽만 지도 자리로 친다 (맞춰 보기 · 가운데 맞춤에서 바 밑에 깔리지 않게)
  const leftInset = () => S.palette && !S.vpcv ? Math.round($t("tPal").getBoundingClientRect().right) + 12 : 0;
  function clampView() {
    const fitAxis = (v, start, view, size) => (size <= view - start ? start + (view - start - size) / 2 : Math.min(start, Math.max(view - size, v)));
    S.x = fitAxis(S.x, leftInset(), innerWidth, S.W * S.s);
    S.y = fitAxis(S.y, 0, innerHeight, S.H * S.s);
  }
  function fit(instant) {
    const L = leftInset(), w = innerWidth - L;
    const s = Math.max(0.12, Math.min(1, Math.min(w / S.W, (innerHeight - 60) / S.H)));
    const g = { s, x: L + (w - S.W * s) / 2, y: (innerHeight - S.H * s) / 2 + 30 };
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
