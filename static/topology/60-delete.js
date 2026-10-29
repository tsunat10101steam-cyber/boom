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
    if (on && S.draftOn) return toast(t("dr_no_delete"));  // 초안은 그림일 뿐 — 실제 리소스를 지우는 모드는 막는다
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
    const on = S.edit || S.del || S.draftOn;
    $t("tEditBadge").classList.toggle("hidden", !on);
    $t("tEditBadge").classList.toggle("del", S.del);
    $t("tEditBadge").classList.toggle("draft", S.draftOn && !S.del);
    $t("tModeName").textContent = !on ? "" : S.del ? t("d_mode") : [S.draftOn && t("dr_mode"), S.edit && t("e_mode")].filter(Boolean).join(" · ");
    $t("tReset").classList.toggle("hidden", !S.edit);
    markUnsaved(S.edit && S.unsaved);
  }
  // Alt+Esc: 편집기·요소 추가·삭제 모드를 모두 끄고 곧바로 일반 토폴로지 화면으로
  function toViewer() {
    cancelPaletteDrag();
    if (S.edrag) endElementDrag();
    setEdit(false); setPalette(false); setDel(false); setDraft(false);
    closeVpc(); closeForm(); closeMenu();
  }
