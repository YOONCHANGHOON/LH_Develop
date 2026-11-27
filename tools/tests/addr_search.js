// core.js 의 resolveAddr(주소·이름 판정)를 그대로 꺼내 addr.json 으로 입력 예시를 돌린다.
// 사용: node tools/tests/addr_search.js [core.js 경로] [addr.json 경로]   (안 주면 레포의 volunteer/ 파일)
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const corePath = process.argv[2] || path.join(root, "volunteer", "core.js");
const addrPath = process.argv[3] || path.join(root, "volunteer", "addr.json");
const src = fs.readFileSync(corePath, "utf8");
const grab = (n) => { const m = src.match(new RegExp("function " + n + "\\([\\s\\S]*?\\r?\\n}\\r?\\n")); if (!m) throw new Error(n); return m[0]; };
const bases = src.match(/const BASES = \[[^\]]*\];/)[0];
const resolveAddr = new Function(bases + grab("resolveAddr") + grab("findByName") + "return resolveAddr;")();
const addr = JSON.parse(fs.readFileSync(addrPath, "utf8"));
let pass = 0, fail = 0;
const cases = [
  ["삼원빌라", "348-8"], ["삼원", "348-8"], ["삼원빌라 지층비01호", "348-8"], ["삼원 빌라", "348-8"],
  ["귀빈빌라", "346-91"], ["귀빈", "346-91"], ["귀빈빌라 지층1호", "346-91"],
  ["348-8", "348-8"], ["348-8 지층", "348-8"], ["화곡동 348-8번지", "348-8"], ["강서로 61-5", "348-8"], ["곰달래로19나길 15-23", "346-91"],
  // 예전 이름 검색이 그대로인지
  ["다솜", "422-3"], ["문화타운", "346-87"], ["감성하이츠", "347-8"],
  ["엠펠리체", "346-75"] /* 346-75·346-82 둘 다 346-B 구역 → 첫 번지(기존 동작) */, ["빌라", null],
];
for (const [q, want] of cases) {
  const r = resolveAddr(q, addr);
  const got = r.lot || null;
  const good = want ? got === want : !r.lot;
  good ? pass++ : fail++;
  console.log("  " + (good ? "PASS" : "FAIL") + "  '" + q + "' → " + (r.lot ? r.lot + " (" + r.zone + ")" : "안내: " + (r.warn || "").slice(0, 60)));
}
console.log("  = " + pass + " 통과 / " + fail + " 실패");
process.exitCode = fail ? 1 : 0;
