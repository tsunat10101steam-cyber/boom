  // ------------------------------------------------------------ 우클릭 메뉴
  // 짧게 누름 = 메뉴, 꾹 누르거나(HOLD_MS) 누른 채 움직이면 = 화면 이동
  const HOLD_MS = 220;
  const SEP = { sep: true };
  const item = (label, fn, ic) => ({ label, fn, ic });
  const copyId = (id) => navigator.clipboard.writeText(id).then(() => toast(t("copied", { id })), () => toast(t("copy_failed")));

  function menuItems(id, n, region) {
    const view = [item(t("m_details"), () => select(id)), item(t("m_goto"), () => focus(id)), item(t("m_copy_id"), () => copyId(id))];
    if (n?.kind === "region" && n.block) return [item(t("m_details"), () => select(id))];
    if (S.draftOn) return draftMenu(id, n, region, view);
    if (n?.kind === "ext") return extMenu(id, n);
    if (n?.kind === "global" || n?.global || (!n && region === "global"))  // 글로벌 상자 안: 보기만
      return n ? view : [item(t("m_fit"), () => fit()), item(t("m_refresh"), () => load())];
    if (!n || n.kind === "region") {
      return [item(t("m_create_vpc"), () => openForm("vpc", { region }), "vpc"), SEP,
        item(t("m_fit"), () => fit()), item(t("m_refresh"), () => load()),
        item(t(S.showDefault ? "m_hide_default" : "m_show_default"), () => $t("tDefault").click()),
        item(t(S.showRoutes ? "m_hide_routes" : "m_show_routes"), () => $t("tRoutes").click())];
    }
    if (n.kind === "vpc") {
      return [item(t("m_enter_vpc"), () => openVpc(region, id), "vpc"), SEP,
        item(t("m_create_subnet"), () => openForm("subnet", { region, vpc: n.data }), "priv"),
        item(t("m_create_instance"), () => openForm("instance", { region, vpc: n.data }), "ec2"),
        ...(n.data.igw ? [] : [item(t("m_create_igw"), () => openForm("igw", { region, vpc: n.data }), "igw")]),
        SEP, ...view];
    }
    if (n.kind === "res" && n.data.type === "EC2") return [item(t("sw_edit"), () => openBadges(id), "ec2"), SEP, ...view];
    if (n.kind === "subnet") {
      const vpc = S.nodes.get(n.vpc).data;
      return [item(t("m_create_instance"), () => openForm("instance", { region, vpc, subnet: n.data }), "ec2"),
        item(t("m_create_subnet"), () => openForm("subnet", { region, vpc }), "priv"), SEP, ...view];
    }
    return view;
  }

  function openMenu(x, y, target) {
    const el = target.closest?.("#topoRegions [data-node]") || target.closest?.("#topoRegions .t-region.slot");
    const id = el?.dataset.node || el?.dataset.region, n = id ? S.nodes.get(id) : null;
    const region = n?.region || target.closest?.(".t-region")?.dataset.region || null;
    const items = menuItems(id, n, region);
    const title = n ? `${n.kind === "res" ? n.data.type : t("k." + n.kind)} · ${n.kind === "region" ? regionName(id) : (n.data.name || n.data.label || id)}` :
      (region ? regionName(region) : t("topology"));
    showMenu(x, y, title, items);
  }
  function showMenu(x, y, title, items) {  // 우클릭 메뉴 · HUD 단추 메뉴가 함께 쓴다
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
  const regionLabel = (r) => `${regionName(r)} (${r})`;
  const field = (label, html, desc) => `<label class="row"><span>${label}</span>${desc ? `<small>${esc(desc)}</small>` : ""}${html}</label>`;

  // 오른쪽 'OO 추가' 창 (AWS 콘솔의 만들기 화면처럼: 위치 → 설정 → 만들기). 우클릭 메뉴와 요소 추가 바가 함께 쓴다.
  // add = 요소 추가 바에서 끌어 놓은 경우 (제목이 'OO 추가'). 위치(리전·VPC)를 바꾸면 창을 다시 그린다
  const FORM_ICON = { region: "region", vpc: "vpc", subnet: "priv", igw: "igw", instance: "ec2", bucket: "s3",
                      rt: "rt", nat: "nat", sg: "sg", eip: "eip", ep: "ep" };
  const MENU_TITLE = { vpc: "m_create_vpc", subnet: "m_create_subnet", igw: "m_create_igw", instance: "m_create_instance" };
  const VPC_OK = { igw: (v) => !v.igw, instance: (v) => v.subnets.length > 0, subnet: () => true,
                   rt: () => true, nat: (v) => v.subnets.length > 0, sg: () => true, eip: () => true, ep: () => true };
  const SG_PRESETS = [["ssh", "SSH", 22], ["http", "HTTP", 80], ["https", "HTTPS", 443], ["rdp", "RDP", 3389]];
  const AMIS = [["al2023", "Amazon Linux 2023"], ["ubuntu24", "Ubuntu 24.04 LTS"], ["ubuntu22", "Ubuntu 22.04 LTS"], ["win2022", "Windows Server 2022"]];

  // 인스턴스 창의 키 페어 · 보안 그룹 칸: 목록을 받아 온 뒤에 채운다 (그동안 만들기 버튼은 잠가 둔다)
  async function fillLaunchOpts(f, region, vpc) {
    const box = f.querySelector("#tLaunchOpts"), btn = f.querySelector("button[type=submit]");
    btn.disabled = true;
    let o;
    try { o = await api("/api/launch_options", { region, vpc: vpc.id }); }
    catch (e) { o = { keys: [], sgs: [], err: e.message }; }
    if (!f.isConnected) return;
    const newKey = `boom-${Math.random().toString(36).slice(2, 6)}`;
    box.innerHTML = `${o.err ? `<div class="err" style="margin-bottom:10px">${esc(t("fm_opts_failed", { e: o.err }))}</div>` : ""}
      ${field(esc(t("fm_key")), `<select name="key_sel">${o.keys.map(k => `<option value="k:${esc(k.name)}">${esc(k.name)}${k.type ? ` · ${esc(k.type)}` : ""}</option>`).join("")}
          <option value="new" ${o.keys.length ? "" : "selected"}>${esc(t("fm_key_new"))}</option><option value="none">${esc(t("fm_key_none"))}</option></select>
        <input type="text" name="new_key" class="mono" value="${newKey}" aria-label="${esc(t("fm_key_name"))}">`, t("fm_key_d"))}
      <div class="row"><span>${esc(t("fm_sg"))}</span>
        <label class="chk"><input type="radio" name="sg_mode" value="new" checked> ${esc(t("fm_sg_new"))}</label>
        <div class="t-opts" data-for="new">${SG_PRESETS.map(([k, label, port]) =>
          `<label class="chk"><input type="checkbox" name="rule_${k}" ${k === "ssh" ? "checked" : ""}> ${label} <span class="mono muted">TCP ${port}</span></label>`).join("")}</div>
        <label class="chk"><input type="radio" name="sg_mode" value="existing" ${o.sgs.length ? "" : "disabled"}> ${esc(t("fm_sg_existing"))}</label>
        <div class="t-opts" data-for="existing">${o.sgs.map(g =>
          `<label class="chk"><input type="checkbox" name="sgid_${esc(g.id)}" ${g.name === "default" ? "checked" : ""}> ${esc(g.name)}
            <span class="mono muted">${esc(g.id)}${g.in.length ? ` · ${esc(g.in.join(", "))}` : ""}</span></label>`).join("")}</div></div>`;
    const sync = () => {
      const mode = f.querySelector("input[name=sg_mode]:checked").value;
      f.querySelectorAll(".t-opts").forEach(d => {
        d.classList.toggle("off", d.dataset.for !== mode);
        d.querySelectorAll("input").forEach(i => { i.disabled = d.dataset.for !== mode; });
      });
      f.elements.new_key.classList.toggle("hidden", f.elements.key_sel.value !== "new");
      f.elements.ami_id.classList.toggle("hidden", f.elements.ami.value !== "custom");
    };
    f.querySelectorAll("input[name=sg_mode]").forEach(r => { r.onchange = sync; });
    f.elements.key_sel.onchange = sync;
    f.elements.ami.onchange = () => {  // Windows 는 SSH 대신 RDP 로 접속
      const win = f.elements.ami.value === "win2022";
      if (f.elements.rule_ssh && f.elements.rule_rdp) { f.elements.rule_rdp.checked = win; f.elements.rule_ssh.checked = !win; }
      sync();
    };
    sync();
    btn.disabled = false;
  }
  // 새로 만든 키 페어의 개인 키 (.pem) — AWS 에서 다시 받을 수 없으니 곧바로 파일로 내려 준다
  function savePem(name, material) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([material], { type: "application/x-pem-file" }));
    a.download = `${name}.pem`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const vpcsIn = (region) => S.data.regions.find(r => r.region === region)?.vpcs || [];

  function openForm(kind, ctx, add, keep = {}) {
    closeMenu();
    const regions = S.data.regions.map(r => r.region);
    let region = regions.includes(ctx.region) ? ctx.region : regions[0];
    let vpc = ctx.vpc || null;
    const needVpc = !!VPC_OK[kind];
    if (needVpc && !vpc) {  // 놓은 곳에 VPC 가 없으면: 이 리전의 알맞은 VPC → 없으면 알맞은 VPC 가 있는 첫 리전
      const ok = VPC_OK[kind];
      const r = [S.data.regions.find(r => r.region === region), ...S.data.regions].find(r => r?.vpcs.some(ok));
      if (r) { region = r.region; vpc = r.vpcs.find(ok); }
      else vpc = vpcsIn(region)[0] || null;
    }
    const regionSel = (list, cur) => `<select name="region">${list.map(r => `<option value="${esc(r)}" ${r === cur ? "selected" : ""}>${esc(regionLabel(r))}</option>`).join("")}</select>`;
    const vpcLabel = (v) => `${v.name || (v.default ? t("t_default_vpc") : v.id)} · ${v.cidr}`;
    const place = [], set = [];
    let note = "", ok = true, sub = "";
    if (kind === "region") {
      const optin = Object.entries(S.data.region_status || {}).filter(([, s]) => s === "not-opted-in").map(([r]) => r).sort();
      if (optin.length) place.push(field(esc(t("fm_region_pick")), regionSel(optin, optin.includes(ctx.optin) ? ctx.optin : optin[0]).replace('name="region"', 'name="optin"')));
      else { place.push(`<div class="err">${esc(t("fm_no_optin"))}</div>`); ok = false; }
      note = t("fm_region_note");
    } else if (ctx.locked && vpc) {  // VPC 연결 화면에서 연 창: 위치는 그 VPC 로 고정
      place.push(field(esc(t("k.region")), `<div class="t-fixed">${esc(regionLabel(region))}</div>`),
        field("VPC", `<div class="t-fixed">${esc(vpcLabel(vpc))}</div>`));
    } else {
      place.push(field(esc(t("k.region")), regionSel(regions, region)));
      if (needVpc) place.push(vpc ? field("VPC", `<select name="vpc">${vpcsIn(region).map(v =>
        `<option value="${esc(v.id)}" ${v.id === vpc.id ? "selected" : ""}>${esc(vpcLabel(v))}</option>`).join("")}</select>`)
        : `<div class="err">${esc(t("fm_no_vpc"))}</div>`);
      if (needVpc && !vpc) ok = false;
    }
    if (kind === "vpc") {
      sub = t("fm_vpc_sub");
      set.push(field(esc(t("fm_name")), `<input type="text" name="name" placeholder="my-vpc">`, t("d_name")),
        field(esc(t("fm_cidr")), `<input type="text" name="cidr" class="mono" value="${suggestVpcCidr(region)}">`, t("d_vpc_cidr")),
        `<label class="chk"><input type="checkbox" name="with_igw" checked> ${esc(t("fm_with_igw"))}</label>`,
        `<label class="chk"><input type="checkbox" name="public_subnet" checked> ${esc(t("fm_public_subnet"))}</label>`);
    } else if (kind === "subnet" && vpc) {
      const azs = S.data.regions.find(r => r.region === region)?.azs || [];
      set.push(field(esc(t("fm_az")), `<select name="az">${azs.map(a => `<option ${a === ctx.az ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>`),
        field(esc(t("fm_name")), `<input type="text" name="name" placeholder="private-a">`, t("d_name")),
        field(esc(t("fm_cidr")), `<input type="text" name="cidr" class="mono" value="${freeCidr(vpc.cidr, vpc.subnets.map(s => s.cidr), 24)}">`, t("d_sub_cidr")),
        `<label class="chk"><input type="checkbox" name="public" ${vpc.igw ? "checked" : "disabled"}> ${esc(t("fm_sub_public"))}</label>`);
      note = vpc.igw ? t("fm_sub_public_note") : t("fm_sub_no_igw");
    } else if (kind === "igw" && vpc) {
      set.push(field(esc(t("fm_name")), `<input type="text" name="name" value="${esc((vpc.name || "vpc") + "-igw")}">`, t("d_name")));
      note = vpc.igw ? `${t("k.igw")} · ${vpc.igw}` : t("fm_igw_note");
      if (vpc.igw) ok = false;
    } else if (kind === "instance" && vpc) {
      const pick = vpc.subnets.find(s => s.id === ctx.subnet?.id) || vpc.subnets[0];
      set.push(vpc.subnets.length ? field(esc(t("fm_subnet")), `<select name="subnet">${vpc.subnets.map(s =>
          `<option value="${esc(s.id)}" data-public="${s.public}" ${s.id === pick?.id ? "selected" : ""}>${esc(s.name || s.id)} · ${esc(s.az)} · ${s.public ? "Public" : "Private"}</option>`).join("")}</select>`)
          : `<div class="err">${esc(t("fm_no_subnet"))}</div>`,
        field(esc(t("fm_name")), `<input type="text" name="name" placeholder="web-1">`, t("d_name")),
        field(esc(t("fm_ami")), `<select name="ami">${AMIS.map(([k, label]) => `<option value="${k}">${esc(label)}</option>`).join("")}
          <option value="custom">${esc(t("fm_ami_custom"))}</option></select>
          <input type="text" name="ami_id" class="mono hidden" placeholder="ami-0123456789abcdef0">`, t("fm_ami_d")),
        field(esc(t("fm_type")), `<select name="instance_type">${["t3.micro", "t3.small", "t3.medium", "t3.large", "m5.large"].map(ty => `<option>${ty}</option>`).join("")}</select>`),
        `<div id="tLaunchOpts"><div class="muted t-opts-wait">${esc(t("fm_opts_loading"))}</div></div>`,
        `<label class="chk"><input type="checkbox" name="public_ip" ${pick?.public ? "checked" : ""}> ${esc(t("fm_public_ip"))}</label>`);
      note = t("fm_inst_note");
      if (!vpc.subnets.length) ok = false;
    } else if (kind === "rt" && vpc) {
      set.push(field(esc(t("fm_name")), `<input type="text" name="name" placeholder="private-rt">`, t("d_name")),
        field(esc(t("fm_rt_assoc")), `<select name="assoc_subnet"><option value="">${esc(t("fm_none_opt"))}</option>${vpc.subnets.map(s =>
          `<option value="${esc(s.id)}" ${s.id === ctx.subnet?.id ? "selected" : ""}>${esc(s.name || s.id)} · ${esc(s.az)} · ${esc(s.cidr)}</option>`).join("")}</select>`));
      note = t("fm_rt_note");
    } else if (kind === "nat" && vpc) {
      const pick = vpc.subnets.find(s => s.id === ctx.subnet?.id) || vpc.subnets.find(s => s.public) || vpc.subnets[0];
      set.push(field(esc(t("fm_subnet")), `<select name="subnet">${vpc.subnets.map(s =>
          `<option value="${esc(s.id)}" ${s.id === pick?.id ? "selected" : ""}>${esc(s.name || s.id)} · ${esc(s.az)} · ${s.public ? "Public" : "Private"}</option>`).join("")}</select>`),
        field(esc(t("fm_name")), `<input type="text" name="name" placeholder="nat-a">`, t("d_name")),
        field(esc(t("v_conn_type")), `<select name="connectivity"><option value="public">Public</option><option value="private">Private</option></select>`, t("fm_nat_conn_d")));
      note = t("fm_nat_note");
    } else if (kind === "sg" && vpc) {
      set.push(field(esc(t("fm_sg_name")), `<input type="text" name="name" placeholder="web-sg">`),
        field(esc(t("v_desc")), `<input type="text" name="desc" value="Created by Boom">`, t("fm_sg_desc_d")),
        `<div class="row"><span>${esc(t("fm_sg_in"))}</span>${SG_PRESETS.map(([k, label, port]) =>
          `<label class="chk"><input type="checkbox" name="rule_${k}"> ${label} <span class="mono muted">TCP ${port}</span></label>`).join("")}</div>`);
      note = t("fm_sg_note");
    } else if (kind === "eip" && vpc) {
      const insts = vpc.subnets.flatMap(s => s.resources.filter(x => x.type === "EC2" && !/terminat|shutting/.test(x.state)));
      set.push(field(esc(t("fm_name")), `<input type="text" name="name" placeholder="web-eip">`, t("d_name")),
        field(esc(t("fm_eip_inst")), `<select name="instance"><option value="">${esc(t("fm_none_opt"))}</option>${insts.map(i =>
          `<option value="${esc(i.id)}">${esc(i.name || i.id)} · ${esc(i.id)} · ${esc(i.state)}</option>`).join("")}</select>`));
      note = t("fm_eip_note");
    } else if (kind === "ep" && vpc) {
      set.push(field(esc(t("v_service")), `<select name="service"><option value="s3">S3 · com.amazonaws.${esc(region)}.s3</option>
          <option value="dynamodb">DynamoDB · com.amazonaws.${esc(region)}.dynamodb</option></select>`),
        field(esc(t("fm_name")), `<input type="text" name="name" placeholder="s3-endpoint">`, t("d_name")),
        `<div class="row"><span>${esc(t("v_rts"))}</span>${vpc.route_tables.map(r =>
          `<label class="chk"><input type="checkbox" name="rt_${esc(r.id)}" ${!ctx.rt || ctx.rt === r.id ? "checked" : ""}> ${esc(r.name || r.id)}${r.main ? " (main)" : ""}</label>`).join("")}</div>`);
      note = t("fm_ep_note");
    } else if (kind === "bucket") {
      set.push(field(esc(t("fm_bucket_name")), `<input type="text" name="name" class="mono" value="boom-${esc(identity?.account || "")}-${Math.random().toString(36).slice(2, 7)}">`, t("err.bad_bucket")));
      note = t("fm_bucket_note");
    }
    if (vpc && needVpc) sub = `${vpcLabel(vpc)} · ${regionLabel(region)}`;
    const title = add || !MENU_TITLE[kind] ? t("add_x", { x: t("el." + kind) }) : t(MENU_TITLE[kind]);
    const wrap = $t("tForm");
    delete wrap.dataset.mode;
    wrap.innerHTML = `<form class="t-form" autocomplete="off">
      <div class="t-form-h"><h3>${icon(FORM_ICON[kind], 24)}<span>${esc(title)}</span></h3>
        <button type="button" class="ghost t-close" id="tFormX" aria-label="${esc(t("close"))}">✕</button></div>
      ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
      <div class="t-form-b">
        <div class="t-sec"><div class="t-sec-h">${esc(t("fs_place"))}</div>${place.join("")}</div>
        ${set.length ? `<div class="t-sec"><div class="t-sec-h">${esc(t("fs_settings"))}</div>${set.join("")}</div>` : ""}
        ${note ? `<div class="note">${esc(note)}</div>` : ""}
      </div>
      <div class="t-form-f"><div class="err" id="tFormErr"></div>
        <div class="btns"><button type="button" id="tFormCancel">${esc(t("cancel"))}</button>
        <button type="submit" class="primary" ${ok ? "" : "disabled"}>${esc(t(kind === "region" ? "enable" : "create"))}</button></div></div></form>`;
    wrap.classList.remove("hidden");
    wrap.classList.remove("in"); void wrap.offsetWidth; wrap.classList.add("in");
    S.formOpen = true;
    select(null);
    const f = wrap.querySelector("form");
    if (keep.name != null && f.elements.name) f.elements.name.value = keep.name;
    const reopen = (patch) => openForm(kind, { ...ctx, ...patch }, add, { name: f.elements.name?.value });
    if (kind !== "region" && f.elements.region) f.elements.region.onchange = () => reopen({ region: f.elements.region.value, vpc: null, subnet: null });
    if (f.elements.vpc) f.elements.vpc.onchange = () => reopen({ region, vpc: vpcsIn(region).find(v => v.id === f.elements.vpc.value), subnet: null });
    const subSel = f.elements.subnet;
    if (f.elements.with_igw) f.elements.with_igw.onchange = () => {
      f.elements.public_subnet.disabled = !f.elements.with_igw.checked;
      f.elements.public_subnet.checked = f.elements.with_igw.checked;
    };
    if (kind === "subnet" && f.elements.public && !f.elements.public.disabled) {
      const pub = f.elements.public, nm = f.elements.name, sync = () => {
        f.querySelector(".note").textContent = t(pub.checked ? "fm_sub_public_note" : "fm_subnet_note");
        if (/^(public|private)-a$/.test(nm.placeholder)) nm.placeholder = pub.checked ? "public-a" : "private-a";
      };
      pub.onchange = sync; sync();
    }
    if (subSel && f.elements.public_ip) subSel.onchange = () => { f.elements.public_ip.checked = subSel.selectedOptions[0].dataset.public === "true"; };
    if (kind === "instance" && vpc && vpc.subnets.length) fillLaunchOpts(f, region, vpc);
    $t("tFormCancel").onclick = closeForm; $t("tFormX").onclick = closeForm;
    (f.querySelector("input[type=text]") || f.querySelector("select"))?.focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const val = (k) => f.elements[k]?.type === "checkbox" ? f.elements[k].checked : f.elements[k]?.value;
      const body = kind === "region" ? { kind, region: val("optin") } :
        { kind, region: val("region") || region, name: val("name"), cidr: val("cidr"), with_igw: val("with_igw"), public_subnet: val("public_subnet"), public: val("public"),
          az: val("az"), vpc: vpc?.id, subnet: val("subnet"), instance_type: val("instance_type"), public_ip: val("public_ip"),
          assoc_subnet: val("assoc_subnet"), connectivity: val("connectivity"), desc: val("desc"), instance: val("instance"), service: val("service"),
          rules: SG_PRESETS.map(([k]) => k).filter(k => f.elements["rule_" + k]?.checked),
          rts: [...f.querySelectorAll('input[name^="rt_"]:checked')].map(i => i.name.slice(3)) };
      if (kind === "instance") {
        const ks = val("key_sel") || "none";
        Object.assign(body, { ami: val("ami") === "custom" ? (val("ami_id") || "").trim() : val("ami"),
          key_mode: ks === "new" ? "new" : ks === "none" ? "none" : "existing",
          key_name: ks === "new" ? (val("new_key") || "").trim() : ks.slice(2),
          sg_mode: f.querySelector("input[name=sg_mode]:checked")?.value || "default", sg_rules: body.rules,
          sg_ids: [...f.querySelectorAll('input[name^="sgid_"]:checked')].map(i => i.name.slice(5)) });
      }
      if (((kind === "instance" || kind === "nat") && !body.subnet) || !body.region) return;
      const btn = f.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = t("creating"); $t("tFormErr").textContent = "";
      try {
        const res = await api("/api/create", body);
        closeForm();
        if (kind === "region") { toast(t("region_requested", { r: regionName(res.id) })); return; }
        if (res.key_material) savePem(res.key_name, res.key_material);
        toast(t("created", { id: res.id }) + (res.key_material ? ` · ${t("key_saved", { f: res.key_name + ".pem" })}` : ""));
        S.pendingFocus = res.id;
        load();
        if (S.vpcv) {  // VPC 안에서 만들었으면 그 항목 화면으로 가서 펼쳐 준다
          S.vpcv.after = [AFTER_PAGE[kind], kind === "instance" ? body.subnet : res.id];
          vpcLoad();
        }
      } catch (err) {
        $t("tFormErr").textContent = err.message;
        btn.disabled = false; btn.textContent = t(kind === "region" ? "enable" : "create");
      }
    };
  }
  const AFTER_PAGE = { subnet: "subnets", rt: "rts", igw: "igws", nat: "nats", sg: "sgs", eip: "eips", ep: "eps", instance: "subnets" };
  function closeForm() {
    if (S.selLink) { S.selLink = null; S.linesDirty = true; } $t("tForm").classList.add("hidden"); $t("tForm").innerHTML = ""; delete $t("tForm").dataset.mode; S.formOpen = false; }
