  // ------------------------------------------------------------ 설계 초안 (Ctrl+Alt+E)
  // 빈 지도에서 시작해 이 계정의 실제 리소스를 골라 넣으며 아키텍처 그림을 만든다. AWS 에는 아무것도 만들거나 지우지 않는다.
  // 넣은 것(id)은 계정별로 저장되고, 배치는 편집기(Ctrl+Alt+X · Alt+S)로 일반 화면과 따로 저장된다.
  // 요소 추가 바에서 끌어 놓으면 그 자리(리전 · VPC · 서브넷)의 실제 리소스 목록이 오른쪽에 나온다
  const DRAFT_KINDS = [["region", "region"], ["global", "global"], ["vpc", "vpc"], ["subnet", "priv"], ["instance", "ec2"],
    ["res", "nat"], ["bucket", "s3"], ["svc", "lambda"], ["tgw", "tgw"], ["r53", "r53"], ["cf", "cf"], ["acm", "acm"], ["iam", "iamu"]];
  const DRAFT_DROP = { region: ".t-region:not(.t-global)", global: ".t-region", vpc: ".t-region:not(.slot):not(.t-global)",
    subnet: ".t-vpc", instance: ".t-subnet, .t-vpc", res: ".t-subnet, .t-vpc", bucket: ".t-region:not(.slot):not(.t-global)",
    tgw: ".t-region:not(.slot):not(.t-global)", svc: ".t-region:not(.slot):not(.t-global)",
    r53: ".t-global", cf: ".t-global", acm: ".t-global", iam: ".t-global" };
  const DRAFT_ICON = Object.fromEntries(DRAFT_KINDS);
  const draftKey = () => "topoDraft:" + (identity?.account || "-");
  function readDraft() { try { return new Set(JSON.parse(store.get(draftKey()) || "[]")); } catch { return new Set(); } }
  function saveDraft() { store.set(draftKey(), JSON.stringify([...S.draft])); }

  function setDraft(on) {
    if (on === S.draftOn) return;
    if (on) { setDel(false); closeVpc(); }
    setEdit(false);  // 저장 안 한 편집기 이동은 되돌리고 (배치 저장 위치가 바뀌므로)
    S.draftOn = on;
    S.draft = on ? readDraft() : null;
    S.annot = on ? readAnnot() : null;
    if (!on) setLinkMode(false);
    S.offsets = readLayout();
    view.classList.toggle("draft", on);
    select(null); closeForm(); closeMenu();
    setPalette(on);  // 빈 화면에서 시작하니 요소 추가 바를 열어 둔다
    updateBadge();
    toast(t(on ? "dr_on" : "dr_off"));
    if (!S.data) return;
    S.fitted = false;
    if (S.on) render(); else S.needRender = true;
  }

  // 초안에 넣은 것만 남긴 데이터 (render 가 그대로 그린다). VPC 의 IGW · 라우팅 테이블 · 엔드포인트 칩은 VPC 와 함께 따라온다
  function draftView(d) {
    const has = (id) => S.draft.has(id);
    const regions = d.regions.filter(r => has(r.region)).map(r => ({
      ...r,
      vpcs: r.vpcs.filter(v => has(v.id)).map(v => ({ ...v,
        subnets: v.subnets.filter(s => has(s.id)).map(s => ({ ...s, resources: s.resources.filter(x => has(x.id)) })) })),
      tgws: r.tgws.filter(x => has(x.id)), buckets: (r.buckets || []).filter(b => has(b.id)), services: (r.services || []).filter(x => has(x.id)),
      peerings: r.peerings.filter(p => has(p.a.vpc) && has(p.b.vpc)),
    }));
    const g = d.global || {}, gf = (k) => (g[k] || []).filter(x => has(x.id));
    return { ...d, regions, global: has("global") ? { zones: gf("zones"), dists: gf("dists"), users: gf("users"), roles: gf("roles"),
                                                      certs: gf("certs"), hidden_roles: 0 } : null };
  }

  // 어떤 요소를 빼면 그 안의 것도 함께 뺀다
  function draftKids(id) {
    const out = [];
    const subKids = (s) => s.resources.map(x => x.id);
    const vpcKids = (v) => v.subnets.flatMap(s => [s.id, ...subKids(s)]);
    if (id === "global") { const g = S.data.global || {}; return ["zones", "dists", "users", "roles", "certs"].flatMap(k => (g[k] || []).map(x => x.id)); }
    for (const r of S.data.regions) {
      if (r.region === id) return [...r.vpcs.flatMap(v => [v.id, ...vpcKids(v)]), ...r.tgws.map(x => x.id), ...(r.buckets || []).map(b => b.id),
                                   ...(r.services || []).map(x => x.id)];
      for (const v of r.vpcs) {
        if (v.id === id) return vpcKids(v);
        for (const s of v.subnets) if (s.id === id) return subKids(s);
      }
    }
    return out;
  }
  function addToDraft(ids, at = ids[ids.length - 1]) {
    const before = S.draft.size;
    ids.forEach(id => S.draft.add(id));
    saveDraft();
    if (!before) S.fitted = false;  // 빈 화면에 처음 넣으면 거기로 맞춰 보기
    else if (S.data.regions.some(r => r.region === at) || at === "global") {
      requestAnimationFrame(() => requestAnimationFrame(() => focusBox(at)));  // 화면 밖에 생겼을 수 있으니 그리로
    } else S.pendingFocus = at;
    render();
    toast(t("dr_added", { n: S.draft.size - before }));
  }
  function focusBox(code) {  // 리전·글로벌 상자는 data-node 가 없어서 focus() 대신 상자 가운데로
    const r = S.regionRects.find(b => b.code === code);
    if (!r) return;
    const s = Math.min(Math.max(S.s, 0.35), 1);
    S.goal = { s, x: innerWidth / 2 - (r.x + r.w / 2) * s, y: innerHeight / 2 - (r.y + r.h / 2) * s };
  }
  function removeFromDraft(id) {
    [id, ...draftKids(id)].forEach(x => S.draft.delete(x));
    saveDraft();
    select(null);
    render();
    toast(t("dr_removed"));
  }

  function draftDrop(kind, tg, e) {
    if (EXT_SET.has(kind)) return addExt(kind, e);  // AWS 밖 요소는 놓은 자리에 바로
    const region = tg?.closest(".t-region")?.dataset.region;
    if (kind === "global") return addToDraft(["global"]);
    if (kind === "region" && region) return addToDraft([region]);
    const ctx = { region: kind === "region" ? null : region,
                  vpc: ["subnet", "instance", "res"].includes(kind) ? tg?.closest(".t-vpc")?.dataset.node : null,
                  subnet: ["instance", "res"].includes(kind) && tg?.classList.contains("t-subnet") ? tg.dataset.node : null };
    openPicker(kind, ctx);
  }

  // 그 자리(빈 곳이면 계정 전체)에 넣을 수 있는 실제 리소스: {id, name, sub, ic, up: 함께 넣을 상위 id, kids: '안의 것도' 고르면 함께 넣을 id}
  function draftCandidates(kind, ctx) {
    const out = [];
    if (["r53", "cf", "acm", "iam"].includes(kind)) {
      const g = S.data.global || {};
      const list = kind === "r53" ? g.zones : kind === "cf" ? g.dists : kind === "acm" ? g.certs : [...(g.users || []), ...(g.roles || [])];
      (list || []).forEach(x => out.push({ id: x.id, name: x.name, sub: `${x.type} · ${x.detail}`, ic: TYPE_ICON[x.type], up: ["global"], kids: [] }));
      return out;
    }
    const regions = ctx.region && kind !== "region" ? S.data.regions.filter(r => r.region === ctx.region) : S.data.regions;
    for (const r of regions) {
      if (kind === "region") { out.push({ id: r.region, name: regionName(r.region), sub: r.region, ic: "region", up: [], kids: draftKids(r.region) }); continue; }
      if (kind === "bucket") (r.buckets || []).forEach(b => out.push({ id: b.id, name: b.name, sub: `S3 · ${b.detail || ""}`, ic: "s3", up: [r.region], kids: [] }));
      if (kind === "svc") (r.services || []).forEach(x => out.push({ id: x.id, name: x.name, sub: `${x.type} · ${x.detail || ""}`, ic: TYPE_ICON[x.type], up: [r.region], kids: [] }));
      if (kind === "tgw") r.tgws.forEach(x => out.push({ id: x.id, name: x.name || x.id, sub: `Transit Gateway · ${x.state}`, ic: "tgw", up: [r.region], kids: [] }));
      for (const v of r.vpcs.filter(v => !ctx.vpc || v.id === ctx.vpc)) {
        if (kind === "vpc") out.push({ id: v.id, name: v.name || (v.default ? t("t_default_vpc") : v.id), sub: `${v.cidr} · ${v.id}`,
                                       ic: "vpc", up: [r.region], kids: draftKids(v.id) });
        for (const s of v.subnets.filter(s => !ctx.subnet || s.id === ctx.subnet)) {
          if (kind === "subnet") out.push({ id: s.id, name: s.name || s.id, sub: `${s.az} · ${s.cidr} · ${s.public ? "Public" : "Private"}`,
                                            ic: s.public ? "pub" : "priv", up: [r.region, v.id], kids: draftKids(s.id) });
          if (kind === "instance" || kind === "res")
            s.resources.filter(x => (x.type === "EC2") === (kind === "instance")).forEach(x => out.push({
              id: x.id, name: x.name || x.id, sub: `${x.type} · ${s.name || s.id} · ${stateText(x.state)}`, ic: TYPE_ICON[x.type], up: [r.region, v.id, s.id], kids: [] }));
        }
      }
    }
    if (!ctx.region && kind !== "region") {  // 빈 곳에 놓아 계정 전체에서 고를 때: 어느 리전 것인지 보이게, 기본 VPC 는 뒤로
      out.forEach(c => { c.sub = `${regionName(c.up[0])} · ${c.sub}`; });
      if (kind === "vpc") out.sort((a, b) => (a.name === t("t_default_vpc")) - (b.name === t("t_default_vpc")));
    }
    return out;
  }

  // 오른쪽 'OO 추가' 창: 실제 리소스 목록에서 고르기 (이미 넣은 것은 표시만)
  function openPicker(kind, ctx) {
    closeMenu();
    const list = draftCandidates(kind, ctx);
    const nodeName = (id) => S.data.regions.flatMap(r => r.vpcs.flatMap(v => [v, ...v.subnets])).find(x => x.id === id)?.name || id;
    const where = [ctx.region && regionName(ctx.region), ctx.vpc && nodeName(ctx.vpc), ctx.subnet && nodeName(ctx.subnet)].filter(Boolean).join(" › ");
    const kidsOpt = ["region", "vpc", "subnet"].includes(kind) && list.some(c => c.kids.length);
    const wrap = $t("tForm");
    wrap.dataset.mode = "draft";
    wrap.innerHTML = `<div class="t-form">
      <div class="t-form-h"><h3>${icon(DRAFT_ICON[kind], 24)}<span>${esc(t("add_x", { x: t("el." + kind) }))}</span></h3>
        <button type="button" class="ghost t-close" id="tFormX" aria-label="${esc(t("close"))}">✕</button></div>
      <div class="sub">${esc(where || t("dr_whole_account"))} · ${esc(t("dr_pick_sub"))}</div>
      <div class="t-form-b">
        ${list.length ? `<label class="chk t-pick-all"><input type="checkbox" id="tPickAll"> ${esc(t("dr_all"))} <span class="muted">(${list.length})</span></label>
          <div class="t-pick">${list.map((c, i) => { const inn = S.draft.has(c.id); return `<label class="t-pick-i ${inn ? "in" : ""}">
            <input type="checkbox" data-i="${i}" ${inn ? "checked disabled" : ""}>${icon(c.ic, 20)}
            <span class="t-dtxt"><b>${esc(c.name)}</b><span class="mono">${esc(c.sub)}</span></span>${inn ? `<span class="t-pick-in">${esc(t("dr_already"))}</span>` : ""}</label>`; }).join("")}</div>`
          : `<div class="note">${esc(t("dr_none", { x: t("el." + kind) }))}</div>`}
        ${kidsOpt ? `<label class="chk" style="margin-top:12px"><input type="checkbox" id="tPickKids"> ${esc(t("dr_with_kids"))}</label>` : ""}
        <div class="note">${esc(t("dr_note"))}</div>
      </div>
      <div class="t-form-f"><div class="btns"><button type="button" id="tFormCancel">${esc(t("cancel"))}</button>
        <button type="button" class="primary" id="tPickGo" disabled>${esc(t("dr_add"))}</button></div></div></div>`;
    wrap.classList.remove("hidden");
    wrap.classList.remove("in"); void wrap.offsetWidth; wrap.classList.add("in");
    S.formOpen = true;
    select(null);
    const boxes = [...wrap.querySelectorAll(".t-pick input:not(:disabled)")], go = $t("tPickGo");
    const sync = () => {
      const n = boxes.filter(b => b.checked).length;
      go.disabled = !n; go.textContent = n ? `${t("dr_add")} (${n})` : t("dr_add");
      const all = $t("tPickAll"); if (all) all.checked = boxes.length > 0 && n === boxes.length;
    };
    boxes.forEach(b => { b.onchange = sync; });
    if ($t("tPickAll")) $t("tPickAll").onchange = (e) => { boxes.forEach(b => { b.checked = e.target.checked; }); sync(); };
    if (boxes.length === 1) { boxes[0].checked = true; sync(); }  // 하나뿐이면 미리 골라 둔다
    $t("tFormCancel").onclick = closeForm; $t("tFormX").onclick = closeForm;
    go.onclick = () => {
      const kids = $t("tPickKids")?.checked, ids = [];
      const chosen = boxes.filter(b => b.checked).map(b => list[+b.dataset.i]);
      chosen.forEach(c => ids.push(...c.up, c.id, ...(kids ? c.kids : [])));
      closeForm();
      addToDraft(ids, chosen[0].id);
    };
  }

  // 초안에서의 우클릭 메뉴: 실제 리소스를 만들거나 지우는 항목 없이 '초안에서 빼기'와 보기만
  function draftMenu(id, n, region, viewItems) {
    if (n?.kind === "ext") return [item(t(n.data.kind === "note" ? "note_edit" : "dr_rename"), () => renameExt(id), n.data.kind === "note" ? "note" : "web"),
      item(t("dr_remove"), () => removeExt(id), "trash"),
      SEP, item(t("m_details"), () => select(id))];
    const items = [];
    if (n?.kind === "vpc") items.push(item(t("m_enter_vpc"), () => openVpc(n.region, id), "vpc"));
    if (n?.kind === "res" && n.data.type === "EC2") items.push(item(t("sw_edit"), () => openBadges(id), "ec2"));
    if (n?.kind === "region" && n.slot) items.push(item(t("dr_add_region"), () => addToDraft([id]), "region"));
    const removable = n && !n.slot && (["region", "vpc", "subnet", "tgw", "global"].includes(n.kind) || (n.kind === "res" && S.draft.has(id)));
    if (removable) items.push(item(t("dr_remove"), () => removeFromDraft(id), "trash"));
    if (items.length) items.push(SEP);
    if (n && !n.slot) items.push(...viewItems);
    else items.push(item(t("m_fit"), () => fit()), item(t("m_refresh"), () => load()));
    return items;
  }

  $t("tPal").addEventListener("click", (e) => {
    if (!e.target.closest("[data-draft-clear]") || !S.draftOn) return;
    if ((!S.draft.size && !S.annot.items.length && !S.annot.links.length) || !confirm(t("dr_clear_q"))) return;
    S.draft.clear(); saveDraft(); S.annot = { items: [], links: [] }; saveAnnot(); select(null); render();
    toast(t("dr_cleared"));
  });

