// 동의서 등록 확인: 우리 집 찾기(volunteer/core.js 의 resolveAddr) → 호 고르기(GET /api/lookup?lot=) → 번호 확인(POST /api/lookup)
// 홈 첫 화면 칸(#check)과 check/ 페이지가 같이 쓴다. 화면 요소는 모두 id 'lk-…'.
// 판정은 전부 Worker(worker.js '동의서 접수 확인')가 한다. 이 화면은 이름·번호 원문을 받지도 갖지도 않는다.
(() => {
  const SMS = "010-8367-2346";
  const $ = (id) => document.getElementById(id);
  if (!$("lk-find") || typeof resolveAddr !== "function") return;
  let addr = null, lot = null, buildings = [], asof = null;

  fetch("/volunteer/addr.json?v=20261029a").then((r) => r.json()).then((d) => {
    addr = d;
    if (document.activeElement === $("lk-q") && $("lk-q").value.trim()) acUpdate(); // 자료가 늦게 와도 치던 글자로 후보를 띄움
  }).catch(() => {});

  const show = (id, on) => { $(id).hidden = !on; };
  const msg = (text, err) => { const m = $("lk-find-msg"); m.textContent = text; m.className = "lk-msg" + (err ? " lk-err" : ""); m.hidden = !text; };
  const hoLabel = (h) => (/^\d+$/.test(h) || /^B\d+$/i.test(h) ? h + "호" : h);
  const NOT_LISTED = "목록에 우리 집 호가 없어요";

  // ── 자동완성(11-11): 치는 동안 입력 칸 바로 아래에 후보 집을 한 줄씩(지번 · 건물 이름, 오른쪽에 도로명).
  // 자료는 addr.json(구역 안 지번·도로명·건축물대장 건물 이름, 공개 정보)만 쓴다. 고르면 그 지번으로 바로 찾는다.
  const AC_SHOW = 5; // 처음 보여 주는 후보 수(휴대폰 키보드 위에 들어가는 만큼). 나머지는 '더 보기'
  const qIn = $("lk-q"), acBox = $("lk-ac");
  let acIdx = null, acRes = { items: [], pre: "", by: "" }, acActive = -1, acAll = false;

  function acIndex() {
    if (acIdx || !addr) return acIdx;
    const by = {};
    Object.keys(addr.lots).forEach((l) => { by[l] = { lot: l, names: [], roads: [] }; });
    Object.entries(addr.names || {}).forEach(([n, ls]) => ls.forEach((l) => by[l] && by[l].names.push(n)));
    Object.entries(addr.roads || {}).forEach(([r, l]) => by[l] && by[l].roads.push(r.replace(/(\D)(\d+(?:-\d+)?)$/, "$1 $2")));
    const num = (l) => l.split("-").map(Number);
    acIdx = Object.values(by).sort((a, b) => { const x = num(a.lot), y = num(b.lot); return x[0] - y[0] || x[1] - y[1]; });
    return acIdx;
  }

  // 지번(345-1 · 345 1 · 3451 · 34515)이면 앞부분이 같은 지번, 아니면 건물 이름·도로명에 그 글자가 들어간 집
  function acFind(text) {
    const idx = acIndex();
    const none = { items: [], pre: "", by: "" };
    if (!idx) return none;
    const raw = text.replace(/\(.*?\)/g, " ").replace(/서울특별시|서울시|서울|강서구|화곡제1동|화곡1동|화곡동|번지/g, " ").trim();
    // '로·길'이 있으면 도로명(건물 번호의 숫자를 지번으로 읽지 않게, resolveAddr 와 같은 순서)
    const m = /[로길]/.test(raw) ? null : raw.match(/(\d{3})(?:\s*-\s*|\s+)(\d{0,3})/) || raw.match(/^(\d{3})(\d{0,3})$/);
    if (m) {
      const pre = m[1] + (m[2] || /-/.test(raw) ? "-" + m[2] : "");
      return { items: idx.filter((e) => e.lot.startsWith(pre)), pre, by: "lot" };
    }
    const nameKey = raw.replace(/[\s\d-]|호|층/g, ""), roadKey = raw.replace(/\s/g, "");
    if (nameKey.length < 2) return none;
    const nm = (n) => { const k = n.replace(/[\s\d-]/g, ""); return k.length >= 2 && (k.includes(nameKey) || nameKey.includes(k)); };
    const byName = idx.filter((e) => e.names.some(nm));
    const byRoad = idx.filter((e) => !byName.includes(e) && e.roads.some((r) => r.replace(/\s/g, "").includes(roadKey)));
    return { items: byName.concat(byRoad), pre: "", by: byName.length ? "name" : "road" };
  }

  const acShown = () => acRes.items.slice(0, acAll ? 200 : AC_SHOW);
  function acOpen(on) {
    acBox.hidden = !on;
    qIn.setAttribute("aria-expanded", on ? "true" : "false");
    if (!on) qIn.removeAttribute("aria-activedescendant");
  }
  function acUpdate() {
    acRes = acFind(qIn.value);
    acAll = false;
    acActive = acRes.items.length ? 0 : -1;
    acDraw();
  }
  function acDraw() {
    acBox.innerHTML = "";
    if (!acRes.items.length) return acOpen(false);
    const em = (t) => { const b = document.createElement("b"); b.className = "lk-ac-m"; b.textContent = t; return b; };
    acShown().forEach((e, i) => {
      const li = document.createElement("li"), main = document.createElement("span"), sub = document.createElement("span");
      li.id = "lk-ac-" + i;
      li.setAttribute("role", "option");
      li.dataset.i = i;
      if (i === acActive) { li.className = "is-active"; li.setAttribute("aria-selected", "true"); qIn.setAttribute("aria-activedescendant", li.id); }
      if (acRes.pre) main.append(em(e.lot.slice(0, acRes.pre.length)), e.lot.slice(acRes.pre.length)); else main.append(e.lot);
      if (e.names.length) { main.append(" · "); main.append(acRes.by === "name" ? em(e.names.join(", ")) : e.names.join(", ")); }
      sub.className = "lk-ac-sub";
      if (acRes.by === "road") sub.append(em(e.roads[0] || "")); else sub.textContent = e.roads[0] || "";
      li.append(main, sub);
      acBox.appendChild(li);
    });
    if (!acAll && acRes.items.length > AC_SHOW) {
      const li = document.createElement("li");
      li.className = "lk-ac-more";
      li.dataset.more = "1";
      li.textContent = acRes.items.length - AC_SHOW + "곳 더 보기";
      acBox.appendChild(li);
    }
    acOpen(true);
    acReveal();
  }
  // 휴대폰: 키보드가 화면 아래 절반을 덮으면 브라우저는 입력 칸만 키보드 바로 위로 올려서 그 아래 후보 목록이 통째로 가려진다
  // (11-12 실측: 보이는 높이 554px에서 목록 0px 보임) → 목록이 보이는 화면 밖으로 나가면 입력 칸을 화면 위쪽(메뉴 아래)으로 올린다
  function acReveal() {
    const vv = window.visualViewport;
    const top = vv ? vv.offsetTop : 0, bottom = top + (vv ? vv.height : window.innerHeight);
    const q = qIn.getBoundingClientRect(), a = acBox.getBoundingClientRect();
    if (a.bottom > bottom - 8 && q.top > top + 80) window.scrollBy({ top: q.top - top - 76, behavior: "smooth" });
  }
  if (window.visualViewport) window.visualViewport.addEventListener("resize", () => { if (!acBox.hidden) acReveal(); });
  function acPick(i) {
    const e = acShown()[i];
    if (!e) return;
    qIn.value = e.lot + (e.names.length ? " (" + e.names[0] + ")" : ""); // 괄호 안은 resolveAddr 가 무시
    acOpen(false);
    qIn.blur(); // 휴대폰 키보드를 내려 2단계가 보이게
    const f = $("lk-find");
    if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event("submit", { cancelable: true }));
  }
  qIn.addEventListener("input", () => {
    // 주소를 새로 치기 시작하면 앞서 찾은 집의 호·번호·결과는 접는다(다른 집 것이 남아 헷갈리지 않게)
    show("lk-unit", false); show("lk-phone", false); show("lk-result", false); msg("");
    acUpdate();
  });
  qIn.addEventListener("focus", () => { if (qIn.value.trim() && acBox.hidden) acUpdate(); });
  qIn.addEventListener("keydown", (ev) => {
    if (acBox.hidden) return;
    const n = acShown().length;
    if (ev.key === "ArrowDown") { ev.preventDefault(); acActive = (acActive + 1) % n; acDraw(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); acActive = (acActive - 1 + n) % n; acDraw(); }
    else if (ev.key === "Enter" && acActive >= 0) { ev.preventDefault(); acPick(acActive); }
    else if (ev.key === "Escape") acOpen(false);
  });
  acBox.addEventListener("mousedown", (ev) => ev.preventDefault()); // PC: 누르는 순간 입력 칸이 포커스를 잃지 않게
  acBox.addEventListener("click", (ev) => {
    const li = ev.target.closest("li");
    if (!li) return;
    if (li.dataset.more) { acAll = true; acDraw(); return; }
    acPick(+li.dataset.i);
  });
  // 입력 칸·후보 목록 밖을 누르면 닫는다(휴대폰은 blur 가 누르기보다 먼저 와서 blur 로 닫지 않음)
  document.addEventListener("pointerdown", (ev) => { if (!acBox.hidden && !ev.target.closest("#lk-ac, #lk-q")) acOpen(false); });

  $("lk-find").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    acOpen(false);
    show("lk-unit", false); show("lk-phone", false); show("lk-result", false);
    const res = resolveAddr($("lk-q").value, addr);
    if (res.warn) return msg(res.warn, true);
    if (res.base) return msg(res.base + "번지는 뒷번호까지 넣어 주세요. (예: " + res.base + "-12)", true);
    lot = res.lot;
    msg("찾는 중…");
    try {
      const r = await fetch("/api/lookup?lot=" + encodeURIComponent(lot));
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.status);
      buildings = d.buildings; asof = d.asof;
    } catch (e) {
      return msg("잠시 후 다시 시도해 주세요. (" + e.message + ")", true);
    }
    if (!buildings.length) return msg(lot + "는 아직 명단에 집 목록이 없습니다. 추진위원장님께 문자로 문의해 주세요.", true);
    msg((res.how && res.how !== lot ? res.how + " → " : "") + lot + " 을(를) 찾았습니다.");
    const bs = $("lk-bsel");
    bs.innerHTML = "";
    buildings.forEach((b, i) => bs.add(new Option(b.b || "(건물 이름 없음)", i)));
    bs.hidden = buildings.length < 2;
    pickBuilding(0);
    show("lk-unit", true);
  });

  $("lk-bsel").addEventListener("change", (ev) => pickBuilding(+ev.target.value));

  function pickBuilding(i) {
    const b = buildings[i];
    $("lk-bname").textContent = buildings.length < 2 ? (b.b || "(건물 이름 없음)") : "";
    $("lk-bname").hidden = buildings.length > 1;
    const withHo = b.units.filter((u) => u.ho);
    const blank = b.units.find((u) => !u.ho);
    const us = $("lk-usel");
    us.innerHTML = "";
    if (!withHo.length) {
      // 호 없이 소유자만 적힌 건물(다가구 등) — 고를 것 없이 번호로만 확인
      us.add(new Option("호 구분 없음", blank.key));
      us.hidden = true;
      show("lk-uhint", true);
    } else {
      us.add(new Option("호를 골라 주세요", ""));
      withHo.forEach((u) => us.add(new Option(hoLabel(u.ho), u.key)));
      us.add(new Option(NOT_LISTED, blank ? blank.key : "-"));
      us.hidden = false;
      show("lk-uhint", false);
    }
    show("lk-phone", true);
    show("lk-result", false);
  }

  // 4자리 채우면 다음 칸으로
  $("lk-p1").addEventListener("input", (ev) => {
    ev.target.value = ev.target.value.replace(/\D/g, "").slice(0, 4);
    if (ev.target.value.length === 4) $("lk-p2").focus();
  });
  $("lk-p2").addEventListener("input", (ev) => { ev.target.value = ev.target.value.replace(/\D/g, "").slice(0, 4); });

  $("lk-phone").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const unit = $("lk-usel").value;
    const p1 = $("lk-p1").value, p2 = $("lk-p2").value;
    const err = $("lk-perr");
    err.hidden = true;
    if (!unit) { err.textContent = "호를 먼저 골라 주세요."; err.hidden = false; return; }
    if (p1.length !== 4 || p2.length !== 4) { err.textContent = "휴대폰 번호 8자리(010 뒤)를 모두 넣어 주세요."; err.hidden = false; return; }
    if (unit === "-") return render({ r: "none", asof });
    $("lk-go").disabled = true;
    try {
      const r = await fetch("/api/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unit, phone: "010" + p1 + p2 }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.status);
      render(d);
    } catch (e) {
      render({ r: "error", msg: e.message });
    } finally {
      $("lk-go").disabled = false;
    }
  });

  function where() {
    const b = buildings[$("lk-bsel").hidden ? 0 : +$("lk-bsel").value] || {};
    const opt = $("lk-usel").selectedOptions[0];
    const ho = opt && !$("lk-usel").hidden && opt.value && opt.value !== "-" && opt.text !== NOT_LISTED ? opt.text : "";
    return [lot, (b.b || "").replace(/\s*\(.*$/, ""), ho].filter(Boolean).join(" ");
  }

  function smsLink(text) {
    const a = document.createElement("a");
    a.className = "lk-sms";
    a.href = "sms:" + SMS + "?&body=" + encodeURIComponent("동의서 등록 확인 부탁드립니다.\n주소: " + where() + "\n성함: ");
    a.dataset.track = "check-sms-result";
    a.textContent = text;
    return a;
  }

  function render(d) {
    const box = $("lk-result");
    box.innerHTML = "";
    const add = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; box.appendChild(e); return e; };
    const since = d.asof ? "명부 " + d.asof + " 접수분까지 반영되어 있습니다." : "";
    box.className = "lk-result " + (d.r === "ok" && d.near ? "near" : d.r);
    if (d.r === "ok") {
      add("p", "✅ 등록 확인됨", "lk-rt");
      add("p", (d.name ? d.name + " 님 이름으로 " : "") + "동의서가 등록되어 있습니다.");
      if (d.near) {
        add("p", "다만 명단에 적힌 번호가 입력하신 번호와 조금 다릅니다:").style.marginTop = "10px";
        add("span", d.near, "lk-stored");
        add("p", "● = 입력하신 번호와 다른 자리. 명단의 번호가 잘못 적혔으면 위원장님께 알려 주세요.");
        box.appendChild(smsLink("위원장님께 번호 수정 요청 문자"));
      }
      if (since) add("p", since, "lk-hint");
    } else if (d.r === "sup") {
      add("p", "⚠️ 등록됐지만 서류 보완이 필요합니다", "lk-rt");
      add("p", (d.name ? d.name + " 님 동의서가 " : "동의서가 ") + "등록되어 있지만 보완할 서류가 있습니다. 위원장님께 문자로 문의해 주세요.");
      box.appendChild(smsLink("위원장님께 문자 보내기"));
    } else if (d.r === "limit") {
      add("p", "오늘은 더 확인할 수 없습니다", "lk-rt");
      add("p", "확인 횟수를 넘었습니다. 내일 다시 해 보시거나 위원장님께 문자로 문의해 주세요.");
      box.appendChild(smsLink("위원장님께 문자 보내기"));
    } else if (d.r === "error") {
      add("p", "잠시 후 다시 시도해 주세요", "lk-rt");
      add("p", d.msg || "");
    } else {
      add("p", "확인되지 않았습니다", "lk-rt");
      add("p", "고르신 집과 번호로는 등록 기록을 찾지 못했습니다.");
      const ul = add("ul");
      ["오늘 내셨다면 저녁 9시 이후에 다시 확인해 주세요. 받은 동의서는 추진위원회가 매일 저녁에 합산합니다." + (since ? " (" + since + ")" : ""),
        "동의서에 다른 번호(가족 번호 등)를 적으셨다면 그 번호로도 해 보세요.",
        "그래도 안 되면 위원장님께 문자로 확인해 주세요."].forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
      box.appendChild(smsLink("위원장님께 문자 보내기"));
    }
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
})();
