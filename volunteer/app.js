// 시트 읽기·집계·주소 판정(SHEET_CSV_URL, TARGET, parseCsv, has, shown, pct, fmt, resolveAddr …)은 core.js
const MIN_RATE = 10; // 신청 가능 기준(%)

const NS = "http://www.w3.org/2000/svg";
// 구역 구분 색(초록은 동의율 배지 전용이라 뺀다)
const AREA_COLORS = ["#3d6be6", "#d9408a", "#d8701e", "#8f4fd6", "#1597c4"];
const $ = (id) => document.getElementById(id);

// 홈 첫 화면의 ④ 현황에 끼워 넣어 보일 때는 '홈페이지로' 버튼을 숨긴다(누르면 칸 안에 홈이 또 열리므로)
if (window.top !== window.self) document.documentElement.classList.add("framed");

// ?demo 로 열면 화면 확인용 임의 값을 채운다 (실제 데이터 아님).
// 데모 소유자 수 = 구역 안 필지 수(대응표 기준)
const DEMO_TOTAL = { "343": 30, "344": 14, "345": 15, "346-A": 29, "346-B": 33, "346-C": 21, "346-D": 16, "346-E": 15,
  "347": 15, "348-A": 17, "348-B": 16, "422": 6, "426": 5, "423": 27 };
function applyDemo(rows) {
  const seed = [0.05, 0.2, 0.35, 0.12, 0.4, 0.08, 0.5, 0.25, 0.0];
  return rows.map((r, i) => {
    const total = r.total || DEMO_TOTAL[r.id] || 10;
    return { ...r, total, agree: Math.round(total * seed[i % seed.length]), memo: "데모 값" };
  });
}

// 동의율은 초록 한 가지 색의 진하기로만 나타낸다.
const color = (r) => (!shown(r) ? "var(--g0)" : pct(r) < MIN_RATE ? "var(--g1)" : pct(r) < TARGET ? "var(--g2)" : "var(--g3)");
const rateText = (r) => (!has(r) ? "–" : !shown(r) ? "비공개" : fmt(pct(r)));
const name = (id) => id;
// 현장 건물에는 지번이 아니라 도로명 번호판이 붙어 있어, 구역마다 주요 도로를 함께 보여 준다 (건축물대장 기준)
const ROADS = {
  "343": "강서로13길 9~47, 곰달래로23길 5~23, 강서로 47",
  "344": "곰달래로19나길 32~50, 곰달래로 109",
  "345": "곰달래로19나길 10~28, 곰달래로 91·95",
  "346-A": "곰달래로19나길 5·15, 강서로15길 47~53",
  "346-B": "곰달래로19나길 15~25, 곰달래로21길 19~31",
  "346-C": "곰달래로21길 18~24, 곰달래로19나길 31~43",
  "346-D": "곰달래로19나길 43, 강서로13길 38·42",
  "346-E": "강서로13길 8~22, 강서로15길 7~19, 곰달래로19나길 43",
  "347": "강서로15길 40~56, 강서로17길 51·53",
  "348-A": "강서로15길 24~38, 강서로17길 15",
  "348-B": "강서로 61, 강서로17길 9·15, 강서로15길 10·16",
  "422": "강서로15길 58, 강서로17길 57",
  "423": "곰달래로19길 14~38, 곰달래로19나길 5, 강서로15길 61·63",
  "426": "곰달래로19나길 6",
};
const DEMO = new URLSearchParams(location.search).has("demo");

function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
}

function drawMap(blocks, byId) {
  const svg = $("map-svg");
  svg.replaceChildren();
  // 구역 색: 범위 구분용. 경계를 맞댄 이웃끼리는 다른 색이 되도록 순서대로 고른다.
  const nb = {};
  blocks.lines.forEach((l) => l.ids.forEach((a) => (nb[a] = (nb[a] || []).concat(l.ids.filter((b) => b !== a)))));
  const pick = {};
  blocks.groups.forEach((gp) => {
    const used = (nb[gp.id] || []).map((n) => pick[n]);
    pick[gp.id] = AREA_COLORS.findIndex((_, i) => !used.includes(i));
  });
  blocks.groups.forEach((gp) => {
    const d = gp.polys.map((q) => "M" + q.map((pt) => pt.join(",")).join("L") + "Z").join("");
    const path = el("path", { class: "grp", "data-id": gp.id, d, "fill-rule": "evenodd", "vector-effect": "non-scaling-stroke" });
    path.style.fill = AREA_COLORS[pick[gp.id]];
    path.addEventListener("click", () => select(gp.id));
    svg.appendChild(path);
  });
  // 구역 사이 경계선: 이웃 구역이 공유하는 변(blocks.lines)만 한 번씩 그린다.
  // 바깥 경계는 지도의 빨간 점선을 그대로 쓴다. 346 안의 작업 구분(sub)은 옅은 점선.
  const ln = (cls, l) => el("line", { class: cls + " " + l.kind, x1: l.a[0], y1: l.a[1], x2: l.b[0], y2: l.b[1], "vector-effect": "non-scaling-stroke" });
  blocks.lines.forEach((l) => svg.appendChild(ln("bd-halo", l)));
  blocks.lines.forEach((l) => svg.appendChild(ln("bd", l)));
  // 배지: 지도에 인쇄된 파란 번지 글자 위에 놓여 그 글자를 대신한다. 모든 배지는 같은 크기·같은 모양.
  // 휴대폰처럼 좁은 화면에서는 배지가 지도를 덮지 않게 동의율만 있는 작은 딱지로 그린다(구역 이름은 누르면 아래에 표시).
  COMPACT = isCompact();
  Object.entries(blocks.labels).forEach(([id, [x, y]]) => {
    const r = byId[id];
    const g = el("g", { class: "badge" + (COMPACT ? " compact" : ""), "data-id": id });
    g.dataset.x = x; g.dataset.y = y;
    if (COMPACT) {
      const t = shown(r) ? fmt(pct(r)) : has(r) ? "비공개" : "–";
      const w = t.length > 4 ? 42 : 36;
      g.append(el("rect", { x: -w / 2, y: -9, width: w, height: 18, rx: 5 }),
        el("text", { class: "lbl-pct" + (shown(r) ? "" : " muted"), y: 4 }, t));
    } else {
      g.append(el("rect", { x: -BADGE[0] / 2, y: -BADGE[1] / 2, width: BADGE[0], height: BADGE[1], rx: 7 }),
        el("text", { class: "lbl-name", y: -3 }, name(id)),
        el("text", { class: "lbl-pct" + (shown(r) ? "" : " muted"), y: 14 }, rateText(r)));
    }
    g.addEventListener("click", () => select(id));
    svg.appendChild(g);
  });
  // 구역마다 지도상 범위(주소 찾기 때 그 구역으로 확대하는 데 씀)
  blocks.groups.forEach((gp) => {
    const pts = gp.polys.flat();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    BBOX[gp.id] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });
  LASTDRAW = [blocks, byId];
  fitBadges(ZS);
  markActive();
}
let COMPACT = false, LASTDRAW = null;
const BBOX = {};
const isCompact = () => $("map-view").clientWidth < 560;

// 확대해도 배지 글씨는 화면에서 같은 크기로 보이게 한다. ZS = 지금 확대 배율(다시 그릴 때 유지)
let ZS = 1;
function fitBadges(s) {
  ZS = s;
  const q = VB[0] / ($("map-view").clientWidth * s);
  document.querySelectorAll(".badge").forEach((g) =>
    g.setAttribute("transform", `translate(${g.dataset.x} ${g.dataset.y}) scale(${q})`));
}

// 지도 번지나 목록을 누르면 지도·배지·목록에서 그 번지만 강조한다. 다시 누르면 해제.
let ACTIVE = null;
function select(id) {
  ACTIVE = ACTIVE === id ? null : id;
  markActive();
}
function markActive() {
  $("map-svg").classList.toggle("has-on", !!ACTIVE);
  document.querySelectorAll(".grp, .badge, .rank li").forEach((e) => e.classList.toggle("on", e.dataset.id === ACTIVE));
  const pick = $("map-pick"), r = ACTIVE && BYID[ACTIVE];
  if (!pick) return;
  pick.hidden = !ACTIVE;
  if (ACTIVE) {
    const need = r && has(r) ? Math.max(0, Math.ceil((r.total * TARGET) / 100) - r.agree) : 0;
    pick.textContent = ACTIVE + " · " + (!has(r) ? "자료 없음" : !shown(r) ? "소유자가 적어 비공개"
      : fmt(pct(r)) + " · 동의 " + r.agree + "/" + r.total + " · " + (need ? "30% 넘기려면 " + need + "명 더" : "30% 달성"));
  }
}

function drawRank(rows) {
  const ol = $("rank");
  ol.replaceChildren();
  // 공개 구역은 동의율 낮은 순, 그 뒤에 비공개·자료 없음 구역(비공개를 섞으면 값이 드러난다)
  const rank = (r) => (shown(r) ? 0 : has(r) ? 1 : 2);
  rows.slice().sort((a, b) => rank(a) - rank(b) || (rank(a) ? 0 : pct(a) - pct(b))).forEach((r) => {
    const li = document.createElement("li");
    li.dataset.id = r.id;
    const no = document.createElement("span"); no.className = "no";
    no.append(name(r.id));
    const mid = document.createElement("div");
    const bar = document.createElement("div"); bar.className = "bar";
    const fill = document.createElement("b"); fill.style.width = (shown(r) ? Math.min(100, pct(r)) : 0) + "%"; fill.style.background = color(r);
    bar.appendChild(fill);
    const sub = document.createElement("div"); sub.className = "sub";
    const need = Math.max(0, Math.ceil((r.total * TARGET) / 100) - r.agree);
    const left = need ? `30% 넘기려면 ${need}명 더` : "30% 달성";
    sub.textContent = (!has(r) ? "소유자 수·접수 숫자 필요"
      : !shown(r) ? `소유자 ${r.total}명 · 인원이 적어 비공개`
      : `${r.agree} / ${r.total}명 · ${left}`) + (r.memo ? ` · ${r.memo}` : "");
    const road = document.createElement("div"); road.className = "road"; road.textContent = ROADS[r.id] || "";
    mid.append(bar, sub, road);
    const p = document.createElement("span"); p.className = "pct" + (shown(r) ? "" : " muted"); p.textContent = shown(r) ? fmt(pct(r)) : "–";
    li.append(no, mid, p);
    li.addEventListener("click", () => select(r.id));
    ol.appendChild(li);
  });
}

function drawSummary(rows) {
  rows = rows.filter(has);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const agree = rows.reduce((s, r) => s + r.agree, 0);
  $("total-rate").textContent = total ? fmt((agree / total) * 100) : "–";
  if ($("goal-fill")) $("goal-fill").style.width = total ? Math.min(100, ((agree / total) * 100 / TARGET) * 100) + "%" : "0";
  $("total-count").textContent = total ? `${agree} / ${total}` : "–";
  $("to-target").textContent = total ? `${Math.max(0, Math.ceil((total * TARGET) / 100) - agree)}명` : "–";
  const dates = rows.map((r) => r.date).filter(Boolean).sort();
  $("updated").textContent = DEMO ? "데모 화면 · 실제 데이터가 아닙니다"
    : !rows.length ? "아직 입력된 동의 현황이 없습니다"
    : dates.length ? `마지막 갱신 ${dates[dates.length - 1]}`
    : SHEET_CSV_URL ? `시트 입력이 30초 안에 자동 반영됩니다 · 마지막 확인 ${new Date().toTimeString().slice(0, 5)}` : "";
}

// ─── 전체 동의율 추이 ───
// 저장된 점(/api/trend: 동의 수가 바뀐 날만)에 지금 시트 값을 끝점으로 붙여 그린다. 못 읽으면 칸 전체를 숨긴 채 둔다.
// 모든 점을 지금 소유자 수로 나눠서, 분모가 바뀌어도 선이 튀지 않는다.
const TREND_END = "2026-11-19"; // 접수 마감
let TREND = null, TREND_ROWS = null, TREND_KEY = "";
const TREND_READY = DEMO ? Promise.resolve() : fetch("../api/trend").then((r) => r.json()).then((d) => { TREND = d.points; }).catch(() => {});
const shortDay = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
function mk(name, attrs, text) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  return e;
}

function drawTrend(rows) {
  TREND_ROWS = rows;
  rows = rows.filter(has);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const agree = rows.reduce((s, r) => s + r.agree, 0);
  if (!TREND || !TREND.length || !total) return;
  $("trend").hidden = false;
  const plot = $("trend-plot");
  const W = plot.clientWidth || 340, H = 176;
  const key = [agree, total, W].join();
  if (key === TREND_KEY) return; // 30초마다 다시 읽어도 값이 같으면 그대로 둔다
  TREND_KEY = key;

  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const pts = TREND.map((p) => ({ ...p }));
  const end = pts[pts.length - 1];
  if (end.agree !== agree) {
    if (end.day === today) end.agree = agree;
    else pts.push({ day: today, agree });
  }
  const rate = (p) => (p.agree / total) * 100;
  const ms = (d) => Date.parse(d + "T00:00:00Z");
  const L = 36, R = 12, T = 22, B = 24;
  const x0 = ms(pts[0].day), x1 = Math.max(ms(TREND_END), ms(pts[pts.length - 1].day));
  const X = (t) => L + ((t - x0) / (x1 - x0)) * (W - L - R);
  const yMin = 10, yMax = Math.max(TARGET, Math.ceil(Math.max(...pts.map(rate)) / 10) * 10);
  const Y = (v) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  const first = pts[0], lastP = pts[pts.length - 1];
  const svg = mk("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", tabindex: 0,
    "aria-label": `전체 동의율 추이. ${shortDay(first.day)} ${fmt(rate(first))}에서 ${shortDay(lastP.day)} ${fmt(rate(lastP))}. 1차 목표 ${TARGET}%.` });

  for (let v = yMin; v <= yMax; v += 10) {
    const goal = v === TARGET;
    svg.append(mk("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: goal ? "goal-line" : "grid" }));
    svg.append(mk("text", { x: L - 6, y: Y(v) + 4, "text-anchor": "end" }, `${v}%`));
    if (goal) svg.append(mk("text", { x: W - R, y: Y(v) - 6, "text-anchor": "end" }, "1차 목표"));
  }
  const DAY = 864e5;
  for (let t = x0; X(t) < W - R - 90; t += 7 * DAY) { // 오른쪽 끝 날짜 글자와 겹치지 않는 데까지
    svg.append(mk("text", { x: X(t), y: H - 6, "text-anchor": t === x0 ? "start" : "middle" }, shortDay(new Date(t).toISOString().slice(0, 10))));
  }
  const endLabel = shortDay(new Date(x1).toISOString().slice(0, 10)) + (x1 === ms(TREND_END) ? " 마감" : "");
  svg.append(mk("text", { x: W - R, y: H - 6, "text-anchor": "end" }, endLabel));

  const px = (p) => X(ms(p.day)), py = (p) => Y(rate(p));
  // 앞 기록보다 늘어난 인원. 하루 넘게 비어 있으면 며칠 치인지 같이 적는다
  const gain = (i) => {
    if (!i) return "";
    const g = pts[i].agree - pts[i - 1].agree, days = Math.round((ms(pts[i].day) - ms(pts[i - 1].day)) / DAY);
    return `${g > 0 ? "+" : ""}${g}명${days > 1 ? ` (${days}일)` : ""}`;
  };
  svg.append(mk("polyline", { class: "line", points: pts.map((p) => `${px(p)},${py(p)}`).join(" ") }));
  // 기록이 있는 날마다 점. 하루 간격이 12px 남짓이라 흰 테두리 없이 작게 찍고, 끝점만 크게
  pts.slice(0, -1).forEach((p) => svg.append(mk("circle", { class: "pt", cx: px(p), cy: py(p), r: 3 })));
  svg.append(mk("circle", { class: "dot", cx: px(lastP), cy: py(lastP), r: 4 }));
  // 시작점과 끝점에만 숫자를 붙인다. 끝점 오른쪽에 자리가 없으면 왼쪽 위로
  if (pts.length > 1) svg.append(mk("text", { x: px(first), y: py(first) + 18 }, fmt(rate(first))));
  const roomy = px(lastP) + 96 < W - R;
  const endY = roomy ? py(lastP) + 5 : Math.max(14, py(lastP) - 28);
  const endText = mk("text", { x: px(lastP) + (roomy ? 10 : -6), y: endY, "text-anchor": roomy ? "start" : "end", class: "end" }, fmt(rate(lastP)));
  endText.append(mk("tspan", { class: "sub", dx: 5 }, `${lastP.agree}명`));
  svg.append(endText);
  // 그 아래 줄에 가장 최근에 늘어난 날과 인원
  let up = pts.length - 1;
  while (up > 0 && pts[up].agree <= pts[up - 1].agree) up--;
  if (up > 0) {
    svg.append(mk("text", { x: endText.getAttribute("x"), y: endY + 18, "text-anchor": endText.getAttribute("text-anchor"), class: "gain" }, `${shortDay(pts[up].day)} ${gain(up)}`));
  }

  // 가리키면 가장 가까운 날의 값을 보여 준다. 같은 값은 끝점 숫자와 아래 표로도 볼 수 있다
  const cross = mk("line", { class: "cross", y1: T, y2: H - B, visibility: "hidden" });
  const mark = mk("circle", { class: "dot", r: 4, visibility: "hidden" });
  const tip = mk("g", { visibility: "hidden" });
  const tipBg = mk("rect", { class: "tip-bg", rx: 6 });
  const tipText = mk("text", { class: "tip" });
  tip.append(tipBg, tipText);
  svg.append(cross, mark, tip);
  let cur = -1;
  const hide = () => { cur = -1; [cross, mark, tip].forEach((e) => e.setAttribute("visibility", "hidden")); };
  const show = (i) => {
    cur = i;
    const p = pts[i], x = px(p);
    cross.setAttribute("x1", x); cross.setAttribute("x2", x);
    mark.setAttribute("cx", x); mark.setAttribute("cy", py(p));
    [cross, mark].forEach((e) => e.setAttribute("visibility", "visible"));
    tipText.textContent = fmt(rate(p));
    tipText.append(mk("tspan", { class: "sub", dx: 6 }, `${p.agree}명 · ${shortDay(p.day)}${i ? " · " + gain(i) : ""}`));
    tip.setAttribute("visibility", "visible");
    const box = tipText.getBBox();
    const tx = Math.max(L + 8, Math.min(W - R - box.width - 8, x - box.width / 2));
    const ty = py(p) - 16 > T + 8 ? py(p) - 16 : py(p) + 28;
    tipText.setAttribute("x", tx); tipText.setAttribute("y", ty);
    const b = tipText.getBBox();
    tipBg.setAttribute("x", b.x - 7); tipBg.setAttribute("y", b.y - 4);
    tipBg.setAttribute("width", b.width + 14); tipBg.setAttribute("height", b.height + 8);
  };
  const nearest = (e) => {
    const x = e.clientX - svg.getBoundingClientRect().left;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(px(p) - x) < Math.abs(px(pts[best]) - x)) best = i; });
    return best;
  };
  svg.addEventListener("pointermove", (e) => show(nearest(e)));
  svg.addEventListener("pointerdown", (e) => show(nearest(e)));
  // 손가락은 떼는 순간 pointerleave 가 와서, 휴대폰에선 다른 곳을 누를 때(blur)까지 값을 남겨 둔다
  svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
  svg.addEventListener("pointercancel", hide);
  svg.addEventListener("blur", hide);
  svg.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    show(cur < 0 ? pts.length - 1 : Math.max(0, Math.min(pts.length - 1, cur + d)));
  });
  plot.replaceChildren(svg);

  const body = $("trend-rows");
  body.textContent = "";
  pts.map((p, i) => [shortDay(p.day), `${p.agree}명`, gain(i) || "–", fmt(rate(p))]).reverse().forEach((cells) => {
    const tr = body.insertRow();
    cells.forEach((v) => { tr.insertCell().textContent = v; });
  });
}
window.addEventListener("resize", () => { if (TREND_ROWS) drawTrend(TREND_ROWS); });

async function load() {
  try {
    const [blocks, csv] = await Promise.all([
      fetch("blocks.json", { cache: "no-cache" }).then((r) => r.json()),
      fetchSheet(""),
    ]);
    // 지도에 있는 구역만 쓰고, 시트에 빠진 구역은 빈 줄로 채운다
    const got = Object.fromEntries(parseCsv(csv).map((r) => [r.id, r]));
    let rows = Object.keys(blocks.labels).sort().map((id) => got[id] || { id, total: 0, agree: 0, date: "", memo: "" });
    if (DEMO) rows = applyDemo(rows);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    BYID = byId;
    if (LAST) showAddr(LAST, false); // 열어 둔 조회 결과도 새 숫자로(확대 위치는 그대로)
    drawSummary(rows);
    TREND_READY.then(() => drawTrend(rows));
    drawMap(blocks, byId);
    drawRank(rows);
    markActive(); // 새로 그려도 선택한 번지 강조 유지
    // 홈 첫 화면에서 찾고 '지도에서 보기'로 넘어온 주소(?q=)는 처음 그릴 때 한 번 바로 보여 준다
    if (Q && !LAST) { await ADDR_READY; $("addr-input").value = Q; findAddr(Q); }
  } catch (e) {
    $("updated").textContent = "데이터를 불러오지 못했습니다. 새로고침해 주세요.";
    console.error(e);
  }
}

// 지도 확대/이동: 휠, 두 손가락 핀치, 끌기, 더블클릭, 버튼
function setupZoom() {
  const view = $("map-view"), box = $("map-box");
  const MAX = 6;
  let s = 1, x = 0, y = 0, moved = false;
  const pts = new Map();
  let pinch = null;

  function apply() {
    const W = view.clientWidth, H = view.clientHeight;
    x = Math.min(0, Math.max(W - W * s, x));
    y = Math.min(0, Math.max(H - H * s, y));
    box.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    view.classList.toggle("zoomed", s > 1.01);
    fitBadges(s);
  }
  function zoomAt(cx, cy, ns) {
    ns = Math.min(MAX, Math.max(1, ns));
    x = cx - ((cx - x) / s) * ns;
    y = cy - ((cy - y) / s) * ns;
    s = ns;
    apply();
  }
  const local = (e) => { const r = view.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  view.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [cx, cy] = local(e);
    zoomAt(cx, cy, s * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
  }, { passive: false });

  view.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".zoom-ctl")) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    moved = false;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s };
    }
  });
  view.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const r = view.getBoundingClientRect();
      const cx = (a[0] + b[0]) / 2 - r.left, cy = (a[1] + b[1]) / 2 - r.top;
      zoomAt(cx, cy, pinch.s * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d));
      moved = true;
    } else if (pts.size === 1 && s > 1.01) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      if (Math.abs(dx) + Math.abs(dy) > 0) { x += dx; y += dy; moved = true; view.classList.add("dragging"); apply(); }
    }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) view.classList.remove("dragging"); };
  view.addEventListener("pointerup", up);
  view.addEventListener("pointercancel", up);
  // 끌고 난 뒤 손을 뗄 때 번지가 눌리지 않게 한다
  view.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

  const mid = () => [view.clientWidth / 2, view.clientHeight / 2];
  $("zoom-in").addEventListener("click", () => zoomAt(...mid(), s * 1.5));
  $("zoom-out").addEventListener("click", () => zoomAt(...mid(), s / 1.5));
  $("zoom-reset").addEventListener("click", () => { s = 1; x = y = 0; apply(); });
  window.addEventListener("resize", () => { if (LASTDRAW && isCompact() !== COMPACT) drawMap(...LASTDRAW); apply(); });
  // 지도 좌표(viewBox) 범위가 화면에 꽉 차게 확대·이동한다 (주소 찾기 결과용)
  zoomToBox = (b) => {
    const W = view.clientWidth, H = view.clientHeight, k = W / VB[0];
    const bw = Math.max(40, b[2] - b[0]) * k, bh = Math.max(40, b[3] - b[1]) * k;
    s = Math.min(MAX, Math.max(1, Math.min((W * 0.85) / bw, (H * 0.85) / bh)));
    x = W / 2 - ((b[0] + b[2]) / 2) * k * s;
    y = H / 2 - ((b[1] + b[3]) / 2) * k * s;
    apply();
  };
}

// 우리 집 동의율 찾기(판정은 core.js의 resolveAddr·addrLines). 찾은 구역으로 지도를 확대하고 강조한다.
let BYID = {}, ADDR = null, LAST = null, zoomToBox = null;
const ADDR_READY = fetch("addr.json?v=20261029a").then((r) => r.json()).then((d) => { ADDR = d; }).catch(() => {});
// 홈 첫 화면에서 넘어온 주소(volunteer/?q=곰달래로19나길 15)
const Q = (new URLSearchParams(location.search).get("q") || "").trim();
function showAddr(res, zoom = true) {
  LAST = res;
  const box = $("addr-result");
  box.replaceChildren();
  const p = (t, cls) => { const e = document.createElement("p"); if (cls) e.className = cls; e.textContent = t; box.appendChild(e); return e; };
  box.classList.toggle("warn", !!res.warn);
  addrLines(res, (z) => BYID[z]).forEach(([t, cls]) => p(t, cls));
  if (res.zone) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.textContent = "지도에서 보기";
    btn.addEventListener("click", () => { ACTIVE = res.zone; markActive(); $("map-view").scrollIntoView({ behavior: "smooth", block: "center" }); });
    box.appendChild(btn);
  }
  box.hidden = false;
  // 찾은 구역(346만 넣었으면 346-A~E 전체)으로 지도를 확대
  const ids = res.zone ? [res.zone] : res.zones || [];
  const bs = ids.map((z) => BBOX[z]).filter(Boolean);
  if (zoom && zoomToBox && bs.length) zoomToBox([Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))]);
}
function findAddr(q) {
  const res = resolveAddr(q, ADDR);
  showAddr(res);
  if (res.zone) { ACTIVE = res.zone; markActive(); }
}
$("addr-form").addEventListener("submit", (e) => {
  e.preventDefault();
  findAddr($("addr-input").value);
});

const VB = [960, 720];
const BADGE = [58, 36]; // 배지 크기(화면 px). 바꾸면 blocks.json 배지 위치도 다시 계산해야 겹치지 않는다.
setupZoom();
load();
// 시트에 입력한 값이 새로고침 없이 보이도록: 30초마다, 그리고 다른 앱에서 돌아왔을 때 다시 읽는다.
setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });
