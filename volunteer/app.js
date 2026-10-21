// 구글 시트 "웹에 게시 → CSV" 주소를 여기에 넣으면 시트 값이 지도에 반영된다.
// 비워 두면 같은 폴더의 data.csv를 읽는다.
const SHEET_CSV_URL = "";
const TARGET = 30;  // 목표 동의율(%) — 30% 이상 가산점
const MIN_RATE = 10; // 신청 가능 기준(%)

const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);

function parseCsv(text) {
  return text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [id, total, agree, date, memo] = line.split(",").map((s) => s.trim());
    return { id, total: Number(total) || 0, agree: Number(agree) || 0, date: date || "", memo: memo || "" };
  }).filter((r) => r.id);
}

// ?demo 로 열면 화면 확인용 임의 값을 채운다 (실제 데이터 아님).
function applyDemo(rows) {
  const seed = [0.05, 0.2, 0.35, 0.12, 0.4, 0.08, 0.5, 0.25, 0.0];
  return rows.map((r, i) => ({ ...r, agree: Math.round(r.total * seed[i % seed.length]), memo: "데모 값" }));
}

// 동의율 상태색: 막대·배지 점에 쓴다. 지도 면 색은 번지 구분용(blocks.colors)이다.
const color = (r) => (r.total === 0 || r.agree === 0 && !r.date && !DEMO ? "var(--c-none)"
  : pct(r) < MIN_RATE ? "var(--c-low)" : pct(r) < TARGET ? "var(--c-mid)" : "var(--c-high)");
const name = (id) => id.replace("-", " ");
let COLORS = {};
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
  // 번지마다 외곽선 하나로 묶은 모양(blocks.json의 groups)을 한 덩어리로 그린다.
  blocks.groups.forEach((gp) => {
    const r = byId[gp.id];
    const d = gp.polys.map((q) => "M" + q.map((pt) => pt.join(",")).join("L") + "Z").join("");
    const path = el("path", { class: "grp", "data-id": gp.id, d, "fill-rule": "evenodd" });
    path.style.fill = path.style.stroke = COLORS[gp.id] || "#999";
    path.addEventListener("click", () => highlight(gp.id));
    svg.appendChild(path);
  });
  // 라벨: 진한 배지에 번지 이름과 동의율, 동의율 상태는 색 점으로 표시한다.
  Object.entries(blocks.labels).forEach(([id, [x, y]]) => {
    const r = byId[id];
    const g = el("g", { class: "badge" });
    const label = name(id);
    const wd = Math.max(54, label.length * 9 + 22);
    g.append(el("rect", { x: x - wd / 2, y: y - 21, width: wd, height: 42, rx: 8 }));
    g.append(el("text", { class: "lbl", x, y: y - 4 }, label));
    const has = r && (r.date || DEMO);
    const dot = el("circle", { cx: x - 20, cy: y + 11, r: 5 });
    dot.style.fill = has ? color(r) : "var(--c-none)";
    g.append(dot, el("text", { class: "lbl lbl-sub", x: x + 6, y: y + 16 }, has ? fmt(pct(r)) : "–"));
    svg.appendChild(g);
  });
}

function highlight(id) {
  document.querySelectorAll(".rank li").forEach((li) => li.classList.toggle("hl", li.dataset.id === id));
  const li = document.querySelector(`.rank li[data-id="${id}"]`);
  if (li) li.scrollIntoView({ behavior: "smooth", block: "center" });
}

function drawRank(rows) {
  const ol = $("rank");
  ol.replaceChildren();
  rows.slice().sort((a, b) => pct(a) - pct(b)).forEach((r) => {
    const li = document.createElement("li");
    li.dataset.id = r.id;
    const no = document.createElement("span"); no.className = "no";
    const sw = document.createElement("i"); sw.style.background = COLORS[r.id] || "#999";
    no.append(sw, name(r.id));
    const mid = document.createElement("div");
    const bar = document.createElement("div"); bar.className = "bar";
    const fill = document.createElement("b"); fill.style.width = Math.min(100, pct(r)) + "%"; fill.style.background = color(r);
    bar.appendChild(fill);
    const sub = document.createElement("div"); sub.className = "sub";
    const need = Math.max(0, Math.ceil((r.total * TARGET) / 100) - r.agree);
    sub.textContent = `${r.agree} / ${r.total}필지 · 30%까지 ${need}필지 더` + (r.memo ? ` · ${r.memo}` : "");
    mid.append(bar, sub);
    const p = document.createElement("span"); p.className = "pct"; p.textContent = fmt(pct(r));
    li.append(no, mid, p);
    li.addEventListener("click", () => {
      document.querySelectorAll(".grp").forEach((a) => a.classList.toggle("on", a.dataset.id === r.id));
    });
    ol.appendChild(li);
  });
}

function drawSummary(rows) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const agree = rows.reduce((s, r) => s + r.agree, 0);
  $("total-rate").textContent = total ? fmt((agree / total) * 100) : "–";
  $("total-count").textContent = `${agree} / ${total}`;
  $("to-target").textContent = `${Math.max(0, Math.ceil((total * TARGET) / 100) - agree)}필지`;
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
    COLORS = blocks.colors;
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
  view.addEventListener("dblclick", (e) => { const [cx, cy] = local(e); zoomAt(cx, cy, s > 1.5 ? 1 : 2.5); });

  const mid = () => [view.clientWidth / 2, view.clientHeight / 2];
  $("zoom-in").addEventListener("click", () => zoomAt(...mid(), s * 1.5));
  $("zoom-out").addEventListener("click", () => zoomAt(...mid(), s / 1.5));
  $("zoom-reset").addEventListener("click", () => { s = 1; x = y = 0; apply(); });
  window.addEventListener("resize", apply);
}

setupZoom();
load();
