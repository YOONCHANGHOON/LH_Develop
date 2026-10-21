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

const color = (r) => (r.total === 0 || r.agree === 0 && !r.date && !DEMO ? "var(--c-none)"
  : pct(r) < MIN_RATE ? "var(--c-low)" : pct(r) < TARGET ? "var(--c-mid)" : "var(--c-high)");
const pct = (r) => (r.total ? (r.agree / r.total) * 100 : 0);
const fmt = (n) => (Math.round(n * 10) / 10).toString() + "%";
const DEMO = new URLSearchParams(location.search).has("demo");

function centroid(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
const area = (pts) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
};

function el(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== undefined) e.textContent = text;
  return e;
}

function drawMap(blocks, byId) {
  const svg = $("map-svg");
  svg.replaceChildren();
  blocks.areas.forEach((a) => {
    const r = byId[a.id];
    const p = el("polygon", { class: "area", "data-id": a.id, points: a.pts.map((q) => q.join(",")).join(" ") });
    p.style.fill = r ? color(r) : "var(--c-none)";
    p.addEventListener("click", () => highlight(a.id));
    svg.appendChild(p);
  });
  const done = new Set();
  blocks.areas.slice().sort((a, b) => area(b.pts) - area(a.pts)).forEach((a) => {
    if (done.has(a.id)) return;
    done.add(a.id);
    const [x, y] = centroid(a.pts);
    const r = byId[a.id];
    const t = el("text", { class: "lbl", x, y: y - 2 }, a.id);
    const s = el("text", { class: "lbl lbl-sub", x, y: y + 16 }, r && (r.date || DEMO) ? fmt(pct(r)) : "–");
    svg.append(t, s);
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
    const no = document.createElement("span"); no.className = "no"; no.textContent = r.id;
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
      document.querySelectorAll(".area").forEach((a) => a.classList.toggle("on", a.dataset.id === r.id));
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
      fetch("blocks.json").then((r) => r.json()),
      fetch(SHEET_CSV_URL ? `${SHEET_CSV_URL}${SHEET_CSV_URL.includes("?") ? "&" : "?"}t=${Date.now()}` : "data.csv").then((r) => {
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
load();
