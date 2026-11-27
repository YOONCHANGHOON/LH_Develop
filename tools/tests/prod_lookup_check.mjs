// 운영 사이트 점검(읽기만): addr.json 의 모든 번지 호 목록 + 페이지·API 응답. 머지 후 배포 확인용.
// 사용: node tools/tests/prod_lookup_check.mjs [주소(기본 운영)] [결과 저장 json]
// 호 목록 조회(GET)는 횟수 제한·기록이 없고, POST 는 번호 형식이 틀린 요청 하나만 보낸다(시도 횟수 안 셈).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const H = process.argv[2] || "https://hwagok-c-zone.hwagok1.workers.dev";
const addr = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "volunteer", "addr.json"), "utf8"));
const lots = Object.keys(addr.lots);
let pass = 0, fail = 0;
const ok = (n, c, i) => { if (c) { pass++; console.log("  PASS  " + n); } else { fail++; console.log("  FAIL  " + n + (i !== undefined ? "  → " + JSON.stringify(i) : "")); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const st = await (await fetch(H + "/api/lookup?status=1")).json();
console.log("status:", JSON.stringify(st));
const all = {};
for (const lot of lots) {
  const d = await (await fetch(H + "/api/lookup?lot=" + lot)).json();
  all[lot] = d.buildings || [];
  await sleep(120);
}
const multi = lots.filter((l) => all[l].length > 1);
ok("P1 건물 둘 이상인 번지 = 346-82·346-86 두 곳뿐(실제로 동이 다른 곳)", JSON.stringify(multi.sort()) === JSON.stringify(["346-82", "346-86"]), multi);
const nameless = lots.flatMap((l) => all[l].filter((b) => /^\(/.test(b.b) && all[l].length > 1).map((b) => l + " " + b.b));
ok("P2 다른 건물과 나란히 나오는 '주소만 있는' 건물 없음", nameless.length === 0, nameless);
const keys = lots.flatMap((l) => all[l].flatMap((b) => b.units.map((u) => u.key)));
ok("P3 호 열쇠 겹침 없음", new Set(keys).size === keys.length, keys.length - new Set(keys).size);
ok("P4 열쇠의 건물 표기 = 묶인 건물 이름", lots.every((l) => all[l].every((b) => b.units.every((u) => u.key.startsWith(l + "|" + b.b + "|")))));
const b = all["348-8"];
ok("P5 348-8 = 삼원빌라 1건물 14호, 지층비01·02호가 맨 앞", b.length === 1 && b[0].b === "삼원빌라(강서로 61-5)" && b[0].units.length === 14 && b[0].units[0].ho === "지층비01호" && b[0].units[1].ho === "지층비02호", b.map((x) => x.b + ":" + x.units.map((u) => u.ho)));
const g = all["346-91"];
ok("P6 346-91 = 귀빈빌라 1건물 6호, 지층1·2호 맨 앞", g.length === 1 && g[0].units.length === 6 && g[0].units[0].ho === "지층1호" && g[0].units[1].ho === "지층2호", g.map((x) => x.b + ":" + x.units.map((u) => u.ho)));
const basement = /^(지층|지하|B|비)/i;
const bLots = lots.filter((l) => all[l].some((x) => x.units.some((u) => basement.test(u.ho))));
const bUnits = lots.reduce((n, l) => n + all[l].reduce((m, x) => m + x.units.filter((u) => basement.test(u.ho)).length, 0), 0);
console.log("  info  지층·지하 호가 있는 번지 " + bLots.length + "곳, 지층·지하 호 " + bUnits + "개 (모두 목록에 나옴)");
// 지층 호가 위층 호보다 뒤에 정렬된 건물이 있는지
const badOrder = lots.flatMap((l) => all[l].filter((x) => { const i = x.units.findIndex((u) => !basement.test(u.ho) && u.ho); const j = x.units.map((u) => basement.test(u.ho)).lastIndexOf(true); return i >= 0 && j > i; }).map((x) => l + " " + x.b));
ok("P7 모든 건물에서 지층·지하 호가 위층보다 앞", badOrder.length === 0, badOrder);
// 호 목록이 빈 번지: 부속 땅(addr.atch)이면 화면이 본 건물로 안내하니 괜찮다. 그 밖의 번지는 "집 목록이 없습니다"가 나온다.
const empty = lots.filter((l) => !all[l].length);
const atch = addr.atch || {};
const atchBad = empty.filter((l) => atch[l] && !(all[atch[l]] || []).length);
ok("P8 빈 번지 중 부속 땅은 본 건물에 호 목록이 있음", atchBad.length === 0, atchBad);
const bare = empty.filter((l) => !atch[l]);
console.log("  info  호 목록이 빈 번지 " + empty.length + "곳 (부속 땅 " + (empty.length - bare.length) + "곳은 본 건물로 안내)" + (bare.length ? ", 안내 없이 '집 목록이 없습니다'로 나오는 번지: " + bare.join(", ") : ""));
const total = lots.reduce((n, l) => n + all[l].reduce((m, x) => m + x.units.length, 0), 0);
console.log("  info  번지 " + lots.length + "곳 호 합계 " + total + " / 서버 전체 " + st.units + " · 명부 " + st.roster + "줄, 연결 " + st.linked + ", 미연결 " + st.unresolved + ", 명부 날짜 " + st.asof);
ok("P9 번지별 호 합계 = 서버 전체 집 수", total === st.units, { total, units: st.units });

// 페이지·API
for (const p of ["/", "/check/", "/volunteer/", "/cheer/", "/schedule/", "/flyer/", "/volunteer/addr.json", "/volunteer/core.js", "/check/app.js"]) {
  const r = await fetch(H + p, { redirect: "manual" });
  ok("P10 " + p + " → " + r.status, r.status === 200, r.status);
  await sleep(150);
}
for (const p of ["/api/trend", "/api/schedule"]) {
  const r = await fetch(H + p);
  let j = null; try { j = await r.json(); } catch (e) {}
  ok("P11 " + p + " → " + r.status + " JSON", r.status === 200 && j !== null, r.status);
}
const bad = await fetch(H + "/api/lookup", { method: "PUT" });
ok("P12 /api/lookup 잘못된 방식(PUT) → 405", bad.status === 405, bad.status);
const badPhone = await fetch(H + "/api/lookup", { method: "POST", body: JSON.stringify({ unit: "x", phone: "123" }) });
ok("P13 번호 형식 틀림 → 400 (시도 횟수 안 셈)", badPhone.status === 400, badPhone.status);
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(all));
console.log("  = " + pass + " 통과 / " + fail + " 실패");
process.exitCode = fail ? 1 : 0;
