// 구글 시트 "웹에 게시 → CSV" 주소를 여기에 넣으면 시트 값이 지도에 반영된다.
// 비워 두면 같은 폴더의 data.csv를 읽는다.
const SHEET_CSV_URL = "";
const TARGET = 30;  // 목표 동의율(%) — 30% 이상 가산점
const MIN_RATE = 10; // 신청 가능 기준(%)

const NS = "http://www.w3.org/2000/svg";
// 구역 구분 색(초록은 동의율 배지 전용이라 뺀다)
const AREA_COLORS = ["#3d6be6", "#d9408a", "#d8701e", "#8f4fd6", "#1597c4"];
const $ = (id) => document.getElementById(id);

function parseCsv(text) {
  return text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [id, total, agree, date, memo] = line.split(",").map((s) => s.trim());
    return { id, total: Number(total) || 0, agree: Number(agree) || 0, date: date || "", memo: memo || "" };
  }).filter((r) => r.id);
}

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

// 자료 있음 = 소유자 수가 있고 한 번이라도 갱신됨.
const has = (r) => !!r && r.total > 0 && (!!r.date || DEMO);
// 소유자가 적은 구역에서 0%나 100%면 모두의 제출 여부가 드러나므로 그때만 가린다.
const SMALL = 10;
const shown = (r) => has(r) && !(r.total < SMALL && (r.agree === 0 || r.agree >= r.total));
// 동의율은 초록 한 가지 색의 진하기로만 나타낸다.
const color = (r) => (!shown(r) ? "var(--g0)" : pct(r) < MIN_RATE ? "var(--g1)" : pct(r) < TARGET ? "var(--g2)" : "var(--g3)");
const rateText = (r) => (!has(r) ? "–" : !shown(r) ? "비공개" : fmt(pct(r)));
const name = (id) => id;
const pct = (r) => (r.total ? (r.agree / r.total) * 100 : 0);
const fmt = (n) => (Math.round(n * 10) / 10).toString() + "%";
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
  Object.entries(blocks.labels).forEach(([id, [x, y]]) => {
    const r = byId[id];
    const g = el("g", { class: "badge", "data-id": id });
    g.dataset.x = x; g.dataset.y = y;
    g.append(el("rect", { x: -BADGE[0] / 2, y: -BADGE[1] / 2, width: BADGE[0], height: BADGE[1], rx: 7 }),
      el("text", { class: "lbl-name", y: -3 }, name(id)),
      el("text", { class: "lbl-pct" + (shown(r) ? "" : " muted"), y: 14 }, rateText(r)));
    g.addEventListener("click", () => select(id));
    svg.appendChild(g);
  });
  fitBadges(1);
}

// 확대해도 배지 글씨는 화면에서 같은 크기로 보이게 한다.
function fitBadges(s) {
  const q = VB[0] / ($("map-view").clientWidth * s);
  document.querySelectorAll(".badge").forEach((g) =>
    g.setAttribute("transform", `translate(${g.dataset.x} ${g.dataset.y}) scale(${q})`));
}

// 지도 번지나 목록을 누르면 지도·배지·목록에서 그 번지만 강조한다. 다시 누르면 해제.
let ACTIVE = null;
function select(id) {
  ACTIVE = ACTIVE === id ? null : id;
  $("map-svg").classList.toggle("has-on", !!ACTIVE);
  document.querySelectorAll(".grp, .badge, .rank li").forEach((e) => e.classList.toggle("on", e.dataset.id === ACTIVE));
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
    const left = need ? `30%까지 ${need}명 더` : "30% 달성";
    sub.textContent = (!has(r) ? "소유자 수·접수 숫자 필요"
      : !shown(r) ? `소유자 ${r.total}명 · 인원이 적어 비공개`
      : `${r.agree} / ${r.total}명 · ${left}`) + (r.memo ? ` · ${r.memo}` : "");
    mid.append(bar, sub);
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
  $("total-count").textContent = total ? `${agree} / ${total}` : "–";
  $("to-target").textContent = total ? `${Math.max(0, Math.ceil((total * TARGET) / 100) - agree)}명` : "–";
  const dates = rows.map((r) => r.date).filter(Boolean).sort();
  $("updated").textContent = DEMO ? "데모 화면 · 실제 데이터가 아닙니다"
    : dates.length ? `마지막 갱신 ${dates[dates.length - 1]}` : "아직 입력된 동의 현황이 없습니다";
}

async function load() {
  try {
    const [blocks, csv] = await Promise.all([
      fetch("blocks.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch(SHEET_CSV_URL ? `${SHEET_CSV_URL}${SHEET_CSV_URL.includes("?") ? "&" : "?"}t=${Date.now()}` : `data.csv?t=${Date.now()}`).then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }),
    ]);
    let rows = parseCsv(csv);
    if (DEMO) rows = applyDemo(rows);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    drawSummary(rows);
    drawMap(blocks, byId);
    drawRank(rows);
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
  window.addEventListener("resize", apply);
}

const VB = [960, 720];
const BADGE = [58, 36]; // 배지 크기(화면 px). 바꾸면 blocks.json 배지 위치도 다시 계산해야 겹치지 않는다.
setupZoom();
load();
