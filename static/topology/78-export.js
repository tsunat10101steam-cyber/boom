  // ------------------------------------------------------------ 아이콘 보기 · 그림으로 내보내기
  // 아이콘 보기 (Ctrl+Alt+V): AWS 아키텍처 그림처럼 큰 아이콘 + 이름만. ID · 상태 · 라우팅 테이블 칩은 숨기고 서브넷은 Public 초록 · Private 파랑.
  // 보기마다 요소 크기가 달라서 편집기 배치도 따로 저장한다 (layoutKey)
  function setIcons(on) {
    if (S.icons === on) return;
    setEdit(false);
    S.icons = on;
    try { store.set("topoIcons", on ? "1" : ""); } catch { /* 기억 못 해도 지금 화면은 바꾼다 */ }
    $t("topo").classList.toggle("icons", on);
    $t("tIcons").classList.toggle("on", on);
    S.offsets = readLayout();
    if (S.data) render();
  }
  try { S.icons = store.get("topoIcons") === "1"; } catch { S.icons = false; }
  $t("topo").classList.toggle("icons", S.icons);
  $t("tIcons").classList.toggle("on", S.icons);
  $t("tIcons").onclick = () => setIcons(!S.icons);

  // 내보내기: 화면에 보이는 그대로(아이콘 보기 · 초안 포함) 내용이 있는 부분만 잘라 SVG 로 만들고, PNG 는 그것을 2배로 그린다.
  // 패널 · 메뉴 · 미니맵 같은 화면 위 UI 는 빼고 지도 그림(#topoWorld)만
  function exportBounds() {
    measure();
    const rs = [...S.regionRects.filter(r => !r.slot), ...[...S.rects].filter(([id]) => id.startsWith("ext:")).map(([, r]) => r)];
    if (!rs.length) return null;
    const P = 40, x0 = Math.min(...rs.map(r => r.x)) - P, y0 = Math.min(...rs.map(r => r.y)) - P;
    const x1 = Math.max(...rs.map(r => r.x + r.w)) + P, y1 = Math.max(...rs.map(r => r.y + r.h)) + P;
    return { x: Math.max(0, x0), y: Math.max(0, y0), w: Math.ceil(x1 - Math.max(0, x0)), h: Math.ceil(y1 - Math.max(0, y0)) };
  }
  function exportSVG() {
    const b = exportBounds();
    if (!b) return null;
    const world = $t("topoWorld").cloneNode(true);
    world.style.transform = `translate(${-b.x}px, ${-b.y}px)`;
    world.style.willChange = "auto";
    world.querySelectorAll(".sel, .t-moving, .t-drop, .t-del, .t-ltgt").forEach(e => e.classList.remove("sel", "t-moving", "t-drop", "t-del", "t-ltgt"));
    // 마우스를 올리거나 고른 요소 때문에 잠깐 보이는 라우팅 선은 그림에서 뺀다 ('라우팅 전체'를 켠 경우만 남김)
    if (!S.showRoutes) world.querySelectorAll("#topoLines .t-l.route").forEach(p => p.parentElement.remove());
    world.querySelectorAll(".t-ulg.on").forEach(g => g.classList.remove("on"));
    const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join("\n"); } catch { return ""; } }).join("\n");
    const root = getComputedStyle(document.documentElement), body = getComputedStyle(document.body), vars = [];
    for (const p of root) if (p.startsWith("--")) vars.push(`${p}:${root.getPropertyValue(p).trim()}`);
    const wrap = document.createElement("div");
    wrap.id = "topo";
    wrap.className = ["icons", "draft"].filter(c => $t("topo").classList.contains(c)).join(" ");
    wrap.setAttribute("style", `${vars.join(";")};position:relative;inset:auto;width:${b.w}px;height:${b.h}px;overflow:hidden;` +
      `font-family:${body.fontFamily};font-size:${body.fontSize};color:${body.color}`);
    const style = document.createElement("style");
    style.textContent = css;
    wrap.append(style, world);
    const xhtml = new XMLSerializer().serializeToString(wrap);
    return { w: b.w, h: b.h, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${b.w}" height="${b.h}" viewBox="0 0 ${b.w} ${b.h}">` +
      `<foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>` };
  }
  function saveFile(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function exportImage(fmt) {
    const r = exportSVG();
    if (!r) return toast(t("ex_empty"));
    const d = new Date(), pad = (n) => String(n).padStart(2, "0");
    const name = `boom-topology-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const svgBlob = new Blob([r.svg], { type: "image/svg+xml;charset=utf-8" });
    if (fmt === "svg") { saveFile(svgBlob, name + ".svg"); return toast(t("ex_done", { f: name + ".svg" })); }
    try {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(r.svg);
      await img.decode();
      const k = Math.min(2, 16000 / Math.max(r.w, r.h), Math.sqrt(60e6 / (r.w * r.h)));  // 캔버스 한계 안에서 최대 2배
      const c = document.createElement("canvas");
      c.width = Math.round(r.w * k); c.height = Math.round(r.h * k);
      const g = c.getContext("2d");
      g.scale(k, k); g.drawImage(img, 0, 0);
      const png = await new Promise((res, rej) => c.toBlob(bl => bl ? res(bl) : rej(new Error("empty")), "image/png"));
      saveFile(png, name + ".png");
      toast(t("ex_done", { f: name + ".png" }));
    } catch {  // 브라우저가 이 그림을 PNG 로 못 바꾸면 SVG 로라도
      saveFile(svgBlob, name + ".svg");
      toast(t("ex_png_failed", { f: name + ".svg" }));
    }
  }
  $t("tExport").onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.left, r.bottom + 6, t("t_export"), [item(t("ex_png"), () => exportImage("png")), item(t("ex_svg"), () => exportImage("svg"))]);
  };

