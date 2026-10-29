// 동의 현황 페이지(app.js)와 홈 첫 화면의 '우리 집 동의율 찾기'가 같이 쓰는 집계·주소 판정.
// 화면을 그리는 코드는 넣지 않는다.

// 봉사자가 입력하는 구글 시트(링크 공유)의 CSV 내보내기 주소. 시트를 고치면 새로고침 때 바로 반영된다.
// 비워 두거나 시트를 못 읽으면 같은 폴더의 data.csv를 읽는다.
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1yUVzLTEaM0V595PcRu2vUfJWPJzQBDn40beLnsTZO88/export?format=csv&gid=0";
const TARGET = 30;  // 목표 동의율(%) — 30% 이상 가산점

// 여러 사람이 손으로 입력하는 시트라 값을 너그럽게 읽는다: 따옴표 안 쉼표, "12명"·"1,234" 같은 숫자, "346 a"·"346a번지" 같은 번지.
function splitCsvLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}
const num = (v) => Number(String(v || "").replace(/[^\d.]/g, "")) || 0;
const normId = (v) => String(v || "").replace(/\s|번지/g, "").toUpperCase().replace(/^(\d+)([A-Z])$/, "$1-$2");
// 시트 위쪽에 제목·안내 줄이 있어도 되게, "번지"로 시작하는 줄을 머리글로 찾아 칸 이름으로 읽는다.
function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/).map(splitCsvLine);
  const h = lines.findIndex((c) => c[0] === "번지");
  if (h < 0) return [];
  const head = lines[h];
  const col = (f) => head.findIndex(f);
  const ci = { total: col((t) => t.startsWith("소유자")), agree: col((t) => t === "동의"),
    date: col((t) => t.startsWith("갱신")), memo: col((t) => t.startsWith("메모")) };
  const at = (c, i) => (i >= 0 ? c[i] || "" : "");
  return lines.slice(h + 1).map((c) => ({ id: normId(c[0]), total: num(at(c, ci.total)), agree: num(at(c, ci.agree)),
    date: at(c, ci.date), memo: at(c, ci.memo) })).filter((r) => r.id);
}
// 공개 집계 시트를 읽는다. 못 읽으면 base 폴더(동의 현황 페이지 기준 상대 경로)의 data.csv로 대신한다.
function fetchSheet(base) {
  const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); });
  const local = () => get(`${base}data.csv?t=${Date.now()}`);
  return SHEET_CSV_URL ? get(`${SHEET_CSV_URL}${SHEET_CSV_URL.includes("?") ? "&" : "?"}t=${Date.now()}`).catch(local) : local();
}

// 자료 있음 = 소유자 수가 있고 한 번이라도 갱신됨.
const has = (r) => !!r && r.total > 0; // 소유자 수가 들어오면 그때부터 동의율 표시
// 소유자가 적은 구역에서 0%나 100%면 모두의 제출 여부가 드러나므로 그때만 가린다.
const SMALL = 10;
const shown = (r) => has(r) && !(r.total < SMALL && (r.agree === 0 || r.agree >= r.total));
const pct = (r) => (r.total ? (r.agree / r.total) * 100 : 0);
const fmt = (n) => (Math.round(n * 10) / 10).toString() + "%";

// 우리 집 동의율 찾기: 지번이나 도로명 주소 → 구역(addr.json 대응표) → 그 구역 동의율(공개 집계 시트).
// 집별 동의 여부는 다루지 않고, 소유자가 적은 구역의 0%·100%는 지도와 똑같이 가린다.
const BASES = ["343", "344", "345", "346", "347", "348", "422", "423", "426"];
function resolveAddr(q, addr) {
  if (!addr) return { warn: "주소 자료를 불러오는 중입니다. 잠시 후 다시 눌러 주세요." };
  const raw = q.replace(/\(.*?\)/g, " ").replace(/서울특별시|서울시|서울|강서구|화곡제1동|화곡1동|화곡동|번지/g, " ").trim();
  const s = raw.replace(/\s+/g, "");
  if (!s) return { warn: "지번(예: 346-85)이나 도로명 주소(예: 곰달래로19나길 15)를 넣어 주세요." };
  let lot = null, how = "";
  if (/[로길]/.test(s)) {
    // "곰달래로 19나길 5-13 302호" → 도로명(곰달래로19나길) + 건물번호(5-13). 뒤의 호수는 무시
    const t = raw.replace(/(로|길)\s+(?=\d+[가-힣]*길)/g, "$1");
    const m = t.match(/([가-힣\d]+(?:로|길))\s*(\d+)(?:\s*-\s*(\d+))?(?![\d가-힣])/);
    if (m) {
      lot = addr.roads[m[1] + m[2] + (m[3] ? "-" + m[3] : "")] || addr.roads[m[1] + m[2]] || null;
      how = m[1] + " " + m[2] + (m[3] ? "-" + m[3] : "");
    }
    if (!lot) return { warn: how ? how + "는 우리 구역 도로명 목록에 없습니다. 지번으로 다시 찾아보시거나 추진위원장님께 문의해 주세요." : "도로명 뒤에 건물 번호까지 넣어 주세요. (예: 곰달래로19나길 15)" };
  } else {
    const m = raw.match(/(\d{3})\s*[-\s]\s*(\d{1,3})/) || s.match(/^(\d{3})-(\d{1,3})$/);
    if (!m) {
      const b = s.match(/^(\d{3})$/);
      if (b && BASES.includes(b[1])) {
        const zs = [...new Set(Object.values(addr.lots).filter((z) => z === b[1] || z.startsWith(b[1] + "-")))].sort();
        return { base: b[1], zones: zs };
      }
      const byName = findByName(raw, addr);
      if (byName) return byName;
      return { warn: "지번은 '346-85'처럼 앞번호와 뒷번호를 함께 넣어 주세요. 건물 이름(예: 다솜)으로도 찾을 수 있습니다." };
    }
    lot = m[1] + "-" + Number(m[2]);
    how = lot;
  }
  const zone = addr.lots[lot];
  // 다른 건물이 함께 쓰는 땅(건축물대장 부속지번)이면 그 건물을 같이 알려 준다. 예: 347-17 → 다솜(422-3) 땅
  const main = (addr.atch || {})[lot];
  if (zone) return { lot, how, zone, pending: (addr.pending || []).includes(lot), main: main ? bldLabel(main, addr) : "" };
  if ((addr.excluded || []).includes(lot)) return { warn: lot + "는 사업구역에서 제외된 필지입니다." };
  if ((addr.out || []).includes(lot)) return { warn: lot + "는 사업구역 밖입니다. (구역도 기준)" };
  if (BASES.includes(lot.split("-")[0])) return { warn: lot + "는 구역 목록에서 찾지 못했습니다. 등기부등본의 지번을 확인하시거나 추진위원장님께 문의해 주세요." };
  return { warn: lot + "는 우리 구역(화곡1동 343~348·422·423·426번지) 지번이 아닙니다." };
}
// 건물 이름(건축물대장 기준, addr.json names)으로 찾기. 호수·층·숫자·띄어쓰기는 빼고 비교한다.
// 똑같은 이름이 있으면 그것만, 없으면 이름 일부가 겹치는 건물을 모은다.
function findByName(raw, addr) {
  const norm = (v) => v.replace(/[\s\d\-]|호|층/g, "");
  const s = norm(raw);
  if (s.length < 2 || !addr.names) return null;
  const all = Object.keys(addr.names);
  let hit = all.filter((n) => norm(n) === s);
  if (!hit.length) hit = all.filter((n) => { const k = norm(n); return k.length >= 2 && (s.includes(k) || k.includes(s)); });
  if (!hit.length) return { warn: "'" + raw.trim() + "' 이름의 건물을 찾지 못했습니다. 지번(예: 346-85)이나 도로명 주소(예: 곰달래로19나길 15)로 찾아 주세요." };
  const lots = [...new Set(hit.flatMap((n) => addr.names[n]))];
  const zones = [...new Set(lots.map((l) => addr.lots[l]).filter(Boolean))];
  if (zones.length === 1) return { lot: lots[0], how: hit.length === 1 ? hit[0] : raw.trim(), zone: zones[0], pending: (addr.pending || []).includes(lots[0]) };
  if (hit.length === 1) return { warn: hit[0] + "은(는) 여러 구역(" + zones.join("·") + ")에 걸쳐 있습니다. 지번(" + lots.join(", ") + ")으로 찾아 주세요." };
  if (hit.length > 6) return { warn: "'" + raw.trim() + "'(이)가 들어간 건물이 많습니다. 건물 이름을 조금 더 길게 넣어 주세요." };
  return { warn: "이름이 비슷한 건물이 여러 곳입니다: " + hit.map((n) => n + "(" + addr.names[n].join("·") + ")").join(", ") + ". 지번이나 도로명 주소로 다시 찾아 주세요." };
}
// '다솜(422-3, 강서로15길 58)' 처럼 건물 이름(대표 지번, 도로명)
function bldLabel(lot, addr) {
  const name = Object.keys(addr.names || {}).find((n) => addr.names[n].includes(lot));
  const road = Object.keys(addr.roads || {}).find((r) => addr.roads[r] === lot);
  const where = [lot, road ? road.replace(/(\d+(?:-\d+)?)$/, " $1") : ""].filter(Boolean).join(", ");
  return (name || "") + "(" + where + ")";
}
function rateLines(r) {
  if (!has(r)) return ["아직 자료가 없습니다."];
  if (!shown(r)) return ["소유자가 적은 구역이라 동의율은 비공개입니다."];
  const need = Math.max(0, Math.ceil((r.total * TARGET) / 100) - r.agree);
  return [fmt(pct(r)), "동의 " + r.agree + "명 / 소유자 " + r.total + "명 · " + (need ? "30% 넘기려면 " + need + "명 더" : "30% 달성")];
}
// 조회 결과를 화면에 쓸 줄 목록 [[글, 칸 이름], …]으로 바꾼다. rowOf(구역) = 그 구역의 집계 줄
function addrLines(res, rowOf) {
  if (res.warn) return [[res.warn]];
  if (res.base) {
    return [[res.base + "번지는 " + (res.zones.length > 1 ? "여러 구역으로 나뉘어 있습니다. 뒷번호까지 넣으시면 정확한 구역이 나옵니다." : "한 구역입니다.")]]
      .concat(res.zones.map((z) => { const [a, b] = rateLines(rowOf(z)); return [z + " · " + a + (b ? " (" + b + ")" : "")]; }));
  }
  const [a, b] = rateLines(rowOf(res.zone));
  const out = [[res.how + (res.how === res.lot ? "" : " (" + res.lot + ")") + " → " + res.zone + " 구역"]];
  if (res.main) out.push([res.lot + "은(는) " + res.main + " 건물이 함께 쓰는 땅입니다. 동의율은 그 건물이 들어 있는 " + res.zone + " 구역 기준입니다."]);
  out.push([a, b ? "big" : ""]);
  if (b) out.push([b]);
  if (res.pending) out.push(["※ 이 건물은 아직 현황 집계에 들어가 있지 않아 추가할 예정입니다. 위 숫자는 같은 구역의 다른 집 기준입니다."]);
  return out;
}
