// worker.js 를 그대로 불러와 가짜 시트(이름·번호 전부 지어낸 값)로 /api/lookup 을 끝까지 돌려 본다.
// 사용: node tools/tests/lookup_e2e.mjs [worker.js 경로] [이름표]   (경로를 안 주면 레포의 worker.js)
// 바깥 네트워크로는 아무것도 나가지 않는다(fetch 를 가로채고, 모르는 주소는 오류). 실패가 있으면 종료 코드 1.
// 휴대폰 번호는 모두 아직 나눠 주지 않는 010-0XXX 대역의 지어낸 값이다.
import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const workerPath = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "worker.js");
const label = process.argv[3] || "worker";

// ---------- 가짜 시트 ----------
const HEAD = ["지번", "건물", "호", "이름", "연락처", "소유자 수", "제출"];
const csv = (rows) => rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n");
const T = {
  "348-B": [
    ["348-8", "삼원빌라(강서로 61-5)", "1층101호", "가일", "010-0111-0101", 1, "FALSE"],
    ["348-8", "삼원빌라(강서로 61-5)", "1층102호", "가이", "010-0111-0102", 1, "TRUE"],
    ["348-8", "삼원빌라(강서로 61-5)", "1층103호", "가삼", "010-0111-0103", 1, "FALSE"],
    ["348-8", "(강서로 61-5)", "지층비01호", "지일", "010-0111-0001", 1, "TRUE"],
    ["348-8", "(강서로 61-5)", "지층비02호", "지이", "010-0111-0002", 1, "FALSE"],
    ["348-8", "(강서로 61-5)", "1층104호", "가사", "010-0111-0104", 1, "FALSE"],
    ["348-8", "(강서로 61-5)", "2층201호", "나일", "", 1, "FALSE"],
    ["348-8", "(강서로 61-5)", "4층402호", "라이", "010-0111-0402", 1, "FALSE"],
    // 같은 호가 두 표기에 다 있음 → 한 집(공동명의)으로 합쳐져야 함
    ["348-99", "나빌라(길 9)", "101호", "공일", "010-0222-0001", 2, "TRUE"],
    ["348-99", "(길 9)", "101호", "공이", "010-0222-0002", 2, "FALSE"],
  ],
  "346-A": [
    ["346-91", "귀빈빌라(곰달래로19나길 15-23)", "지층2호", "귀이", "010-0444-0002", 1, "FALSE"],
    ["346-91", "귀빈빌라(곰달래로19나길 15-23)", "1층101호", "귀삼", "010-0444-0101", 1, "FALSE"],
    ["346-91", "(곰달래로19나길 15-23)귀빈빌라", "지층1호", "귀일", "010-0444-0001", 1, "FALSE"],
    ["346-82", "엠펠리체 비동 (곰달래로19나길 15-12)", "201", "엠일", "010-0555-0201", 1, "FALSE"],
    ["346-82", "엠펠리체 에이동 (곰달래로19나길 15-12)", "201", "엠이", "010-0555-1201", 1, "FALSE"],
    ["346-86", "우성 101동 (강서로15길 53)", "201", "우일", "010-0666-0201", 1, "FALSE"],
    ["346-86", "우성 102동 (강서로15길 53)", "201", "우이", "010-0666-1201", 1, "FALSE"],
  ],
  "426": [
    ["999-1", "가동 (길 1)", "101", "가", "", 1, "FALSE"],
    ["999-1", "나동 (길 1)", "201", "나", "", 1, "FALSE"],
    ["999-1", "(길 1)", "B01", "다", "", 1, "FALSE"],         // 이름 둘인 주소 → 안 묶임
    ["999-3", "엠펠리체 비동 (길 3)", "201", "라", "", 1, "FALSE"],
    ["999-3", "엠펠리체비동(길 3)", "301", "마", "", 1, "FALSE"], // 띄어쓰기만 다름 → 묶임
    ["999-4", "단독주택", "", "바", "010-0777-0001", 1, "TRUE"], // 괄호 없음 → 그대로
    ["999-4", "", "", "사", "", 1, "FALSE"],
    ["999-5", "가빌라(길 1)", "101", "아", "", 1, "FALSE"],
    ["999-5", "가빌라(길 2)", "101", "자", "", 1, "FALSE"],    // 주소 다름 → 안 묶임
    ["999-6", "차빌라(길 1)", "101", "차", "", 1, "FALSE"],
    ["999-6", "(길 2)", "B01", "카", "", 1, "FALSE"],          // 다른 주소의 이름 없는 줄 → 안 묶임
    // 정렬: 346-58 꼴(층이 앞에 적힌 101호) · 347-8 꼴(B101 과 101) · 348-13 꼴(1호·2호)
    ["999-7", "(길 7)", "1층101호", "", "", 1, "FALSE"],
    ["999-7", "(길 7)", "2층101호", "", "", 1, "FALSE"],
    ["999-7", "(길 7)", "지층101호", "", "", 1, "FALSE"],
    ["999-7", "(길 7)", "1층102호", "", "", 1, "FALSE"],
    ["999-7", "(길 7)", "지층102호", "", "", 1, "FALSE"],
    ["999-8", "타워(길 8)", "101", "", "", 1, "FALSE"],
    ["999-8", "타워(길 8)", "B101", "", "", 1, "FALSE"],
    ["999-8", "타워(길 8)", "1001", "", "", 1, "FALSE"],
    ["999-8", "타워(길 8)", "201", "", "", 1, "FALSE"],
    ["999-8", "타워(길 8)", "B02", "", "", 1, "FALSE"],
    ["999-9", "(길 9)", "1층1호", "", "", 1, "FALSE"],
    ["999-9", "(길 9)", "2층1호", "", "", 1, "FALSE"],
    ["999-9", "(길 9)", "지층1호", "", "", 1, "FALSE"],
    ["999-9", "(길 9)", "1층2호", "", "", 1, "FALSE"],
  ],
};
const ROSTER = [
  ["순번", "성명", "연락처", "날짜", "기타", "시트 연결"],
  [1, "명일", "010-0333-0001", "11/26", "", "348-8 지층비02"],
  [2, "명이", "010-0333-0002", "11/26", "", "348-8 201 (삼원빌라)"],
  [3, "명삼", "010-0333-0003", "11/27", "보완", "346-91 지층1 (귀빈빌라)"],
  [4, "명사", "010-0333-0004", "11/27", "", "348-8 999"],
  [5, "명오", "010-0333-0005", "11/27", "", ""],
];

// worker.js 의 탭 번호표를 읽어서 탭 이름 → gid
const src = fs.readFileSync(workerPath, "utf8");
const tabsSrc = src.match(/const LOOKUP_TABS = (\{[\s\S]*?\});/)[1];
const LOOKUP_TABS = Function("return " + tabsSrc)();
const ROSTER_GID = String(src.match(/const ROSTER_GID = (\d+)/)[1]);
const gidCsv = {};
for (const [name, gid] of Object.entries(LOOKUP_TABS)) gidCsv[String(gid)] = csv([HEAD, ...(T[name] || [])]);

// ---------- fetch 가로채기 ----------
const formPosts = [];
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url));
  if (u.hostname === "docs.google.com" && u.pathname.includes("/export")) {
    const gid = u.searchParams.get("gid");
    const sheet = u.pathname.split("/")[3];
    if (sheet === "ROSTER" && gid === ROSTER_GID) return new Response(csv(ROSTER));
    if (sheet === "DETAIL" && gidCsv[gid] != null) return new Response(gidCsv[gid]);
    return new Response("no", { status: 404 });
  }
  if (u.hostname === "docs.google.com" && u.pathname.endsWith("/formResponse")) {
    formPosts.push(Object.fromEntries(new URLSearchParams(String(init.body))));
    return new Response("ok");
  }
  throw new Error("테스트 중 바깥 요청 시도: " + url);
};

// ---------- D1 흉내 ----------
const tries = new Map();
const stmt = (sql) => {
  let a = [];
  const s = {
    bind: (...x) => { a = x; return s; },
    first: async (col) => {
      if (/SELECT n FROM lookup_tries/.test(sql)) { const v = tries.get(a[0] + "|" + a[1]); return v == null ? null : col ? v : { n: v }; }
      return null;
    },
    run: async () => {
      if (/INSERT INTO lookup_tries/.test(sql)) tries.set(a[0] + "|" + a[1], (tries.get(a[0] + "|" + a[1]) || 0) + 1);
      return { success: true };
    },
    all: async () => ({ results: [] }),
  };
  return s;
};
const env = { DETAIL_SHEET_ID: "DETAIL", ROSTER_SHEET_ID: "ROSTER", DB: { prepare: stmt, batch: async (xs) => Promise.all(xs.map((x) => x.run())) } };
const ctx = { waitUntil: (p) => Promise.resolve(p).catch(() => {}) };

// 파일을 임시로 복사해 ESM 으로 불러온다(원본 폴더의 다른 파일은 읽지 않음)
const tmp = path.join(os.tmpdir(), "lh-e2e-" + process.pid + "-" + label + ".mjs");
fs.writeFileSync(tmp, src);
const worker = (await import(pathToFileURL(tmp).href)).default;
fs.unlinkSync(tmp);

const H = "https://test.local";
const get = async (q) => (await worker.fetch(new Request(H + "/api/lookup?" + q), env, ctx)).json();
const post = async (body, ip = "1.1.1.1") =>
  (await worker.fetch(new Request(H + "/api/lookup", { method: "POST", body: JSON.stringify(body), headers: { "CF-Connecting-IP": ip, "content-type": "application/json" } }), env, ctx)).json();

// ---------- 시험 ----------
let pass = 0, fail = 0;
const ok = (name, cond, info) => {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (info !== undefined ? "  → " + JSON.stringify(info) : "")); }
};
const B = async (lot) => (await get("lot=" + lot)).buildings;
const keyOf = (bs, ho) => { for (const b of bs) for (const u of b.units) if (u.ho === ho) return u.key; return null; };

console.log("[" + label + "]");
const b348 = await B("348-8");
ok("T1 348-8 건물 1개로 나옴", b348.length === 1, b348.map((b) => b.b));
ok("T2 348-8 건물 이름 = 삼원빌라(강서로 61-5)", b348[0] && b348[0].b === "삼원빌라(강서로 61-5)", b348[0] && b348[0].b);
ok("T3 348-8 호 8개 전부(지층비01·02 포함)", b348.length === 1 && b348[0].units.length === 8, b348.map((b) => b.units.length));
ok("T4 348-8 호 순서: 지층비01·지층비02가 맨 앞", b348[0] && b348[0].units[0].ho === "지층비01호" && b348[0].units[1].ho === "지층비02호", b348[0] && b348[0].units.map((u) => u.ho));

const kB01 = keyOf(b348, "지층비01호");
ok("T5 지층비01호 + 맞는 번호 → 등록 확인(ok)", (await post({ unit: kB01, phone: "010-0111-0001" })).r === "ok");
const near = await post({ unit: kB01, phone: "010-0111-0011" });
ok("T6 지층비01호 + 한 자리 다른 번호 → ok + 가린 번호(near)", near.r === "ok" && !!near.near, near);
ok("T7 지층비01호 + 틀린 번호 → none", (await post({ unit: kB01, phone: "010-0999-8888" })).r === "none");
ok("T8 지층비02호(시트 미제출) + 명부 '348-8 지층비02' 번호 → ok", (await post({ unit: keyOf(b348, "지층비02호"), phone: "010-0333-0001" })).r === "ok");
ok("T9 2층201호 + 명부 '348-8 201 (삼원빌라)' 번호 → ok (건물 이름 힌트로 연결)", (await post({ unit: keyOf(b348, "2층201호"), phone: "010-0333-0002" })).r === "ok");
ok("T10 옛 열쇠('(강서로 61-5)|지층비01호') → none (배포 직전에 페이지 연 사람만 해당)", (await post({ unit: "348-8|(강서로 61-5)|지층비01호", phone: "010-0111-0001" })).r === "none");

const b346_91 = await B("346-91");
ok("T11 346-91 귀빈빌라 1개 건물, 지층1호 포함 3호", b346_91.length === 1 && b346_91[0].units.length === 3 && !!keyOf(b346_91, "지층1호"), b346_91.map((b) => b.b + ":" + b.units.map((u) => u.ho)));
ok("T12 346-91 대표 이름 = 귀빈빌라(곰달래로19나길 15-23)", b346_91[0] && b346_91[0].b === "귀빈빌라(곰달래로19나길 15-23)", b346_91[0] && b346_91[0].b);
ok("T13 346-91 지층1호 + 명부 '보완' 줄 번호 → sup", (await post({ unit: keyOf(b346_91, "지층1호"), phone: "010-0333-0003" })).r === "sup");

ok("T14 346-82 엠펠리체 에이동·비동 2개 그대로", (await B("346-82")).length === 2);
ok("T15 346-86 우성 101동·102동 2개 그대로", (await B("346-86")).length === 2);
ok("T16 999-1 이름 둘인 주소의 이름 없는 줄은 따로", (await B("999-1")).length === 3);
const b9993 = await B("999-3");
ok("T17 999-3 띄어쓰기만 다른 표기는 하나로(먼저 나온 표기)", b9993.length === 1 && b9993[0].b === "엠펠리체 비동 (길 3)", b9993.map((b) => b.b));
ok("T18 999-4 괄호 없는 이름·빈 이름은 그대로 2개", (await B("999-4")).length === 2);
ok("T19 999-5 이름 같고 주소 다르면 따로", (await B("999-5")).length === 2);
ok("T20 999-6 다른 주소의 이름 없는 줄은 안 붙음", (await B("999-6")).length === 2);

const b99 = await B("348-99");
ok("T21 348-99 같은 호가 두 표기에 → 한 집", b99.length === 1 && b99[0].units.length === 1, b99);
const k99 = b99[0] && b99[0].units[0].key;
ok("T22 348-99 제출한 공동명의자 번호 → ok", (await post({ unit: k99, phone: "010-0222-0001" })).r === "ok");
ok("T23 348-99 미제출 공동명의자 번호 → none", (await post({ unit: k99, phone: "010-0222-0002" })).r === "none");

const st = await get("status=1");
ok("T24 status: 명부 5줄·연결 3·미연결 1", st.roster === 5 && st.linked === 3 && st.unresolved === 1, st);
ok("T25 status: asof = 11/27", st.asof === "11/27", st.asof);
ok("T26 없는 번지 → 빈 목록", (await B("111-1")).length === 0);

// 이름 수정 요청: 설문지에 가는 집 표기가 합쳐진 건물 이름으로
const rn = await post({ action: "rename", unit: kB01, phone: "010-0111-0001", name: "새이름" });
const home = formPosts.length ? Object.values(formPosts[formPosts.length - 1]).find((v) => String(v).startsWith("348-8")) : null;
ok("T27 이름 수정 요청 → renamed, 집 = '348-8 / 삼원빌라(강서로 61-5) / 지층비01호'", rn.r === "renamed" && home === "348-8 / 삼원빌라(강서로 61-5) / 지층비01호", { rn, home });

// 하루 제한: 같은 집 틀린 번호 5번 → limit
const kB02 = keyOf(b348, "4층402호");
for (let i = 0; i < 5; i++) await post({ unit: kB02, phone: "010-0900-000" + i }, "2.2.2." + i);
ok("T28 한 집 틀린 번호 5번 뒤 → limit", (await post({ unit: kB02, phone: "010-0111-0402" }, "3.3.3.3")).r === "limit");

const hos = async (lot) => (await B(lot)).flatMap((b) => b.units.map((u) => u.ho)).join(",");
const o7 = await hos("999-7"), o8 = await hos("999-8"), o9 = await hos("999-9");
ok("T29 층이 앞에 적힌 호: 지층 → 1층 → 2층", o7 === "지층101호,지층102호,1층101호,1층102호,2층101호", o7);
ok("T30 B101·B02 는 101 앞, 1001 은 맨 뒤", o8 === "B02,B101,101,201,1001", o8);
ok("T31 1호·2호 꼴: 지층1호 → 1층1호 → 1층2호 → 2층1호", o9 === "지층1호,1층1호,1층2호,2층1호", o9);

console.log("  = " + pass + " 통과 / " + fail + " 실패");
process.exitCode = fail ? 1 : 0;
