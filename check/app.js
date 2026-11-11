// 동의서 접수 확인: 우리 집 찾기(volunteer/core.js 의 resolveAddr) → 호 고르기(GET /api/lookup?lot=) → 번호 확인(POST /api/lookup)
// 판정은 전부 Worker(worker.js '동의서 접수 확인')가 한다. 이 화면은 이름·번호 원문을 받지도 갖지도 않는다.
const SMS = "010-8367-2346";
const $ = (id) => document.getElementById(id);
let addr = null, lot = null, buildings = [], asof = null;

fetch("../volunteer/addr.json?v=20261029a").then((r) => r.json()).then((d) => { addr = d; }).catch(() => {});

function show(id, on) { $(id).hidden = !on; }
function msg(text, err) { const m = $("find-msg"); m.textContent = text; m.className = "msg" + (err ? " err" : ""); m.hidden = !text; }
const hoLabel = (h) => (/^\d+$/.test(h) || /^B\d+$/i.test(h) ? h + "호" : h);

$("f-find").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  show("s-unit", false); show("f-phone", false); show("result", false);
  const res = resolveAddr($("q").value, addr);
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
  const bs = $("b-sel");
  bs.innerHTML = "";
  buildings.forEach((b, i) => bs.add(new Option(b.b || "(건물 이름 없음)", i)));
  bs.hidden = buildings.length < 2;
  pickBuilding(0);
  show("s-unit", true);
});

$("b-sel").addEventListener("change", (ev) => pickBuilding(+ev.target.value));

function pickBuilding(i) {
  const b = buildings[i];
  $("b-name").textContent = buildings.length < 2 ? (b.b || "(건물 이름 없음)") : "";
  $("b-name").hidden = buildings.length > 1;
  const withHo = b.units.filter((u) => u.ho);
  const blank = b.units.find((u) => !u.ho);
  const us = $("u-sel");
  us.innerHTML = "";
  if (!withHo.length) {
    // 호 없이 소유자만 적힌 건물(다가구 등) — 고를 것 없이 번호로만 확인
    us.add(new Option("호 구분 없음", blank.key));
    us.hidden = true;
    show("u-hint", true);
  } else {
    us.add(new Option("호를 골라 주세요", ""));
    withHo.forEach((u) => us.add(new Option(hoLabel(u.ho), u.key)));
    us.add(new Option("목록에 우리 집 호가 없어요", blank ? blank.key : "-"));
    us.hidden = false;
    show("u-hint", false);
  }
  show("f-phone", true);
  show("result", false);
}

// 4자리 채우면 다음 칸으로
$("p1").addEventListener("input", (ev) => {
  ev.target.value = ev.target.value.replace(/\D/g, "").slice(0, 4);
  if (ev.target.value.length === 4) $("p2").focus();
});
$("p2").addEventListener("input", (ev) => { ev.target.value = ev.target.value.replace(/\D/g, "").slice(0, 4); });

$("f-phone").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const unit = $("u-sel").value;
  const p1 = $("p1").value, p2 = $("p2").value;
  const err = $("p-err");
  err.hidden = true;
  if (!unit) { err.textContent = "호를 먼저 골라 주세요."; err.hidden = false; return; }
  if (p1.length !== 4 || p2.length !== 4) { err.textContent = "휴대폰 번호 8자리(010 뒤)를 모두 넣어 주세요."; err.hidden = false; return; }
  if (unit === "-") return render({ r: "none", asof });
  $("go").disabled = true;
  try {
    const r = await fetch("/api/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unit, phone: "010" + p1 + p2 }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || r.status);
    render(d);
  } catch (e) {
    render({ r: "error", msg: e.message });
  } finally {
    $("go").disabled = false;
  }
});

function where() {
  const bi = $("b-sel").hidden ? 0 : +$("b-sel").value;
  const b = buildings[bi] || {};
  const opt = $("u-sel").selectedOptions[0];
  const ho = opt && opt.value && opt.value !== "-" && !$("u-sel").hidden && opt.text !== "목록에 우리 집 호가 없어요" ? opt.text : "";
  return [lot, (b.b || "").replace(/\s*\(.*$/, ""), ho].filter(Boolean).join(" ");
}

function smsLink(text) {
  const body = "동의서 접수 확인 부탁드립니다.\n주소: " + where() + "\n성함: ";
  const a = document.createElement("a");
  a.className = "sms";
  a.href = "sms:" + SMS + "?&body=" + encodeURIComponent(body);
  a.dataset.track = "check-sms-result";
  a.textContent = text;
  return a;
}

function render(d) {
  const box = $("result");
  box.innerHTML = "";
  const add = (tag, text) => { const e = document.createElement(tag); if (text != null) e.textContent = text; box.appendChild(e); return e; };
  const since = d.asof ? "명부 " + d.asof + " 접수분까지 반영되어 있습니다." : "";
  box.className = "result " + (d.r === "ok" && d.near ? "near" : d.r);
  if (d.r === "ok") {
    add("h3", "✅ 접수 확인됨");
    add("p", (d.name ? d.name + " 님 이름으로 " : "") + "동의서가 접수되어 있습니다.");
    if (d.near) {
      const p = add("p", "다만 명단에 적힌 번호가 입력하신 번호와 조금 다릅니다:");
      add("span", d.near).className = "stored";
      add("p", "● = 입력하신 번호와 다른 자리. 명단의 번호가 잘못 적혔으면 위원장님께 알려 주세요.");
      box.appendChild(smsLink("위원장님께 번호 수정 요청 문자"));
      p.style.marginTop = "10px";
    }
  } else if (d.r === "sup") {
    add("h3", "⚠️ 접수됐지만 서류 보완이 필요합니다");
    add("p", (d.name ? d.name + " 님 동의서가 " : "동의서가 ") + "접수되어 있지만 보완할 서류가 있습니다. 위원장님께 문자로 문의해 주세요.");
    box.appendChild(smsLink("위원장님께 문자 보내기"));
  } else if (d.r === "limit") {
    add("h3", "오늘은 더 확인할 수 없습니다");
    add("p", "확인 횟수를 넘었습니다. 내일 다시 해 보시거나 위원장님께 문자로 문의해 주세요.");
    box.appendChild(smsLink("위원장님께 문자 보내기"));
  } else if (d.r === "error") {
    add("h3", "잠시 후 다시 시도해 주세요");
    add("p", d.msg || "");
  } else {
    add("h3", "확인되지 않았습니다");
    add("p", "고르신 집과 번호로는 접수 기록을 찾지 못했습니다.");
    const ul = add("ul");
    ["최근에 내셨다면 아직 명단에 옮겨 적기 전일 수 있습니다." + (since ? " (" + since + ")" : ""),
      "동의서에 다른 번호(가족 번호 등)를 적으셨다면 그 번호로도 해 보세요.",
      "그래도 안 되면 위원장님께 문자로 확인해 주세요."].forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
    box.appendChild(smsLink("위원장님께 문자 보내기"));
  }
  if (d.r === "ok" && since) add("p", since).className = "hint";
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
