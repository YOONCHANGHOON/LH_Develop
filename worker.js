// 방문·클릭 전수 집계. Cloudflare 방문 통계(Web Analytics)는 10건 중 1건만 표본으로 남겨서 따로 센다.
// D1 데이터베이스 hwagok-stats 의 hits 테이블에 한 줄씩 쌓는다. 조회는 대시보드 D1 > Console 에서 SQL로.
// IP·전체 브라우저 정보는 저장하지 않는다 — 기기 종류(휴대폰/PC)·앱 종류·국가만 남긴다.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/hit") {
      if (request.method === "POST") {
        const body = await request.text();
        ctx.waitUntil(record(body, request, env, url.host).catch(() => {}));
      }
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/api/schedule") {
      return schedule(request, env, url.host).catch(
        (e) => json({ error: "잠시 후 다시 시도해 주세요" }, 500)
      );
    }
    // 검색 사이트 소유 확인 파일(google….html·naver….html)은 정적 파일 처리가 .html 없는 주소로
    // 307 이동시켜서 확인이 실패할 수 있다 → .html 주소 그대로 200으로 내준다.
    if (/^\/(google|naver)[0-9a-z]+\.html$/.test(url.pathname)) {
      const res = await env.ASSETS.fetch(new Request(new URL(url.pathname.slice(0, -5), url), request));
      return new Response(res.body, { status: res.status, headers: res.headers });
    }
    if (url.pathname === "/api/lookup") {
      return lookupApi(request, env, ctx, url.host).catch((e) => {
        console.error("lookup:", e && e.message);
        return json({ error: "잠시 후 다시 시도해 주세요" }, 500);
      });
    }
    if (url.pathname === "/api/trend") {
      return trend(env).catch(() => json({ error: "잠시 후 다시 시도해 주세요" }, 500));
    }
    return env.ASSETS.fetch(request);
  },
  // 매일 밤 동의 수를 저장한다(wrangler.jsonc 의 triggers.crons)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(saveAgree(env));
  },
};

// ─── 동의율 추이 (/volunteer/ 그래프) ───
// 공개 집계 시트의 동의 수 합계를 하루 한 번 읽어, 마지막 값과 다를 때만 한 줄 남긴다. 번지별 숫자와 개인정보는 저장하지 않는다.
// 소유자 수도 저장하지 않는다: 그래프가 모든 날을 지금 소유자 수로 나눠서, 분모가 바뀌어도 선이 튀지 않게 한다.
const SHEET_CSV = "https://docs.google.com/spreadsheets/d/1yUVzLTEaM0V595PcRu2vUfJWPJzQBDn40beLnsTZO88/export?format=csv&gid=0"; // volunteer/core.js 의 SHEET_CSV_URL 과 같아야 한다
// 자동 저장을 시작하기 전 값. 10/28·10/29는 시트 기록, 10/30~11/01은 명부 날짜별로 새로 체크된 수를 더한 값이다.
// 10/27은 새 명부 반영 직전 시트 값이고, 그 전 숫자는 4월 제출분을 옮겨 적은 것이라 증가로 보이지 않게 넣지 않는다.
const TREND_SEED = [["2026-10-27", 219], ["2026-10-28", 227], ["2026-10-29", 236], ["2026-10-30", 245], ["2026-10-31", 255], ["2026-11-01", 266]];

let trendReady = null;
function ensureTrend(env) {
  trendReady ||= env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS trend (day TEXT PRIMARY KEY, agree INTEGER)"),
    ...TREND_SEED.map(([day, agree]) => env.DB.prepare("INSERT OR REPLACE INTO trend (day, agree) VALUES (?, ?)").bind(day, agree)),
  ]).catch((e) => {
    trendReady = null;
    throw e;
  });
  return trendReady;
}

async function trend(env) {
  await ensureTrend(env);
  const { results } = await env.DB.prepare("SELECT day, agree FROM trend ORDER BY day").all();
  return new Response(JSON.stringify({ points: results }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}

async function saveAgree(env) {
  const res = await fetch(SHEET_CSV);
  const agree = res.ok ? sumAgree(await res.text()) : null;
  if (agree === null) {
    console.error("trend: 공개 집계 시트를 읽지 못함", res.status);
    return;
  }
  await ensureTrend(env);
  const last = await env.DB.prepare("SELECT agree FROM trend ORDER BY day DESC LIMIT 1").first();
  if (last && last.agree === agree) return;
  await env.DB.prepare("INSERT OR REPLACE INTO trend (day, agree) VALUES (?, ?)").bind(kstDay(0), agree).run();
}

// '번지' 머리글 아래 번지 줄의 '동의' 칸을 더한다('합계' 줄은 번지가 아니라서 빠진다). 형식이 다르면 null.
function sumAgree(csv) {
  const lines = csv.split(/\r?\n/).map((l) => l.split(","));
  const head = lines.findIndex((c) => c[0].trim() === "번지");
  if (head < 0) return null;
  const col = lines[head].findIndex((t) => t.trim() === "동의");
  if (col < 0) return null;
  const rows = lines.slice(head + 1).filter((c) => /^\d{3}/.test(c[0].trim()));
  return rows.length ? rows.reduce((s, c) => s + (Number(String(c[col]).replace(/\D/g, "")) || 0), 0) : null;
}

async function record(body, request, env, host) {
  let d;
  try {
    d = JSON.parse(body);
  } catch (e) {
    return;
  }
  if (!d || (d.k !== "view" && d.k !== "click")) return;
  const ua = request.headers.get("user-agent") || "";
  if (/bot|crawler|spider/i.test(ua)) return;
  const cut = (v, n) => String(v ?? "").slice(0, n);
  await env.DB.prepare(
    "INSERT INTO hits (ts, host, kind, name, path, sid, device, app, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      new Date().toISOString(),
      host,
      d.k,
      cut(d.n, 60),
      cut(d.p, 60),
      cut(d.s, 16),
      /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
      appOf(ua),
      (request.cf && request.cf.country) || ""
    )
    .run();
}

// 어느 앱·브라우저로 열었는지만 대략 나눈다(카톡 안 브라우저 비율을 보려는 목적).
function appOf(ua) {
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/NAVER\(/.test(ua)) return "naver";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/; wv\)/.test(ua)) return "webview";
  if (/Edg\//.test(ua)) return "edge";
  if (/CriOS|Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

// ─── 봉사 일정 (/schedule/ 페이지) ───
// shifts: 봉사자가 직접 넣는 예약(1시간 단위, OPEN~CLOSE시 = 10~22시). 취소용 숫자 4자리는 소금+해시로만 저장.
// presence: 위원장님·부동산 대표님이 계신 시간. day = 'w0'~'w6'(매주 요일 기본) 또는 'YYYY-MM-DD'(그날만).
//   그날만 값이 있으면 요일 기본보다 우선. start=end=0 은 '안 계심'.
// host 로 나눠서 미리보기 주소에서 시험한 예약이 실제 사이트에 섞이지 않게 한다.
// 위원장·대표 시간 고치기와 아무 예약 지우기는 Worker 비밀값 ADMIN_KEY 가 있어야 한다.
const TASKS = ["접수 안내", "전단", "전화", "가가호호 방문"];
const BOOK_DAYS = 21; // 오늘부터 며칠 뒤까지 예약 가능
const OPEN = 10, CLOSE = 22; // 봉사 시간 10~22시(저녁 10시까지 봉사함). schedule/app.js 의 H0·H1 과 같아야 한다
// 홈페이지 '접수 장소' 안내 문구 기준(위원장님 월·화·목·금 11:30부터, 대표님 오후 3시경).
// 그 밖의 요일(일요일 등)은 비워 두고 위원장님이 #admin 에서 직접 정한다.
const PRESENCE_SEED = [
  ["chair", "w1", 11.5, 19], ["chair", "w2", 11.5, 19], ["chair", "w4", 11.5, 19], ["chair", "w5", 11.5, 19],
  ["owner", "w1", 15, 19], ["owner", "w2", 15, 19], ["owner", "w3", 15, 19],
  ["owner", "w4", 15, 19], ["owner", "w5", 15, 19], ["owner", "w6", 15, 19],
];

let tablesReady = null;
function ensureTables(env) {
  tablesReady ||= env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, host TEXT, day TEXT, start INTEGER, end INTEGER, name TEXT, task TEXT, pin TEXT, fails INTEGER DEFAULT 0, created TEXT)"
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS presence (host TEXT, who TEXT, day TEXT, start REAL, end REAL, PRIMARY KEY (host, who, day))"
    ),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY)"),
  ]).then(() => migrate(env)).catch((e) => {
    tablesReady = null;
    throw e;
  });
  return tablesReady;
}

// 한 번만 하는 데이터 정리. meta 에 이름을 남겨서 다시 돌지 않게 한다(한 batch = 한 트랜잭션).
function migrate(env) {
  return env.DB.batch([
    // 10/29: 처음 넣었던 위원장님 일요일 16~19시 기본값은 근거가 없어 지운다 → 위원장님이 직접 설정
    env.DB.prepare(
      "DELETE FROM presence WHERE who = 'chair' AND day = 'w0' AND start = 16 AND end = 19 AND NOT EXISTS (SELECT 1 FROM meta WHERE k = 'drop-chair-sunday-seed')"
    ),
    env.DB.prepare("INSERT OR IGNORE INTO meta (k) VALUES ('drop-chair-sunday-seed')"),
  ]);
}

async function schedule(request, env, host) {
  await ensureTables(env);
  const today = kstDay(0);
  if (request.method === "GET") {
    let presence = (await env.DB.prepare("SELECT who, day, start, end FROM presence WHERE host = ?").bind(host).all()).results;
    if (!presence.length) {
      await env.DB.batch(
        PRESENCE_SEED.map((r) =>
          env.DB.prepare("INSERT OR IGNORE INTO presence (host, who, day, start, end) VALUES (?, ?, ?, ?, ?)").bind(host, ...r)
        )
      );
      presence = PRESENCE_SEED.map(([who, day, start, end]) => ({ who, day, start, end }));
    }
    const shifts = (
      await env.DB.prepare("SELECT id, day, start, end, name, task FROM shifts WHERE host = ? AND day >= ? ORDER BY day, start, id")
        .bind(host, today)
        .all()
    ).results;
    return json({ today, bookDays: BOOK_DAYS, tasks: TASKS, presence, shifts });
  }
  if (request.method !== "POST") return json({ error: "잘못된 요청" }, 405);

  let d;
  try {
    d = await request.json();
  } catch (e) {
    return json({ error: "잘못된 요청" }, 400);
  }
  if (!d || typeof d !== "object") return json({ error: "잘못된 요청" }, 400);
  const isAdmin = !!env.ADMIN_KEY && d.key === env.ADMIN_KEY;

  if (d.op === "check") return isAdmin ? json({ ok: true }) : json({ error: "관리 비밀번호가 맞지 않습니다" }, 403);

  if (d.op === "add") {
    const name = String(d.name ?? "").trim().slice(0, 20);
    const start = Number(d.start), end = Number(d.end);
    if (!validDay(d.day, today, BOOK_DAYS)) return json({ error: "신청할 수 없는 날짜입니다" }, 400);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < OPEN || end > CLOSE || start >= end)
      return json({ error: "시간을 다시 골라 주세요" }, 400);
    // 오늘 이미 지난 시간은 받지 않는다(지금 시각이 든 칸부터 신청 가능 — 화면의 회색 칸 기준과 같음)
    if (d.day === today && start < kstHour()) return json({ error: "이미 지난 시간입니다. 시간을 다시 골라 주세요" }, 400);
    if (!name) return json({ error: "이름을 적어 주세요" }, 400);
    if (!TASKS.includes(d.task)) return json({ error: "할 일을 골라 주세요" }, 400);
    if (!/^\d{4}$/.test(String(d.pin ?? ""))) return json({ error: "취소용 번호는 숫자 4자리입니다" }, 400);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM shifts WHERE host = ? AND day = ?").bind(host, d.day).first("n");
    if (n >= 40) return json({ error: "이 날은 신청이 너무 많습니다. 위원장님께 문의해 주세요" }, 400);
    await env.DB.prepare("INSERT INTO shifts (host, day, start, end, name, task, pin, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(host, d.day, start, end, name, d.task, await hashPin(String(d.pin)), new Date().toISOString())
      .run();
    return json({ ok: true });
  }

  if (d.op === "cancel") {
    const row = await env.DB.prepare("SELECT id, pin, fails FROM shifts WHERE host = ? AND id = ?").bind(host, Number(d.id)).first();
    if (!row) return json({ ok: true }); // 이미 지워짐
    if (!isAdmin) {
      if (row.fails >= 5) return json({ error: "번호를 여러 번 틀려 잠겼습니다. 위원장님께 문의해 주세요" }, 403);
      if (!(await checkPin(String(d.pin ?? ""), row.pin))) {
        await env.DB.prepare("UPDATE shifts SET fails = fails + 1 WHERE id = ?").bind(row.id).run();
        return json({ error: "취소용 번호가 맞지 않습니다" }, 403);
      }
    }
    await env.DB.prepare("DELETE FROM shifts WHERE id = ?").bind(row.id).run();
    return json({ ok: true });
  }

  if (d.op === "presence") {
    if (!isAdmin) return json({ error: "관리 비밀번호가 맞지 않습니다" }, 403);
    if (d.who !== "chair" && d.who !== "owner") return json({ error: "잘못된 요청" }, 400);
    const day = String(d.day ?? "");
    if (!/^w[0-6]$/.test(day) && !validDay(day, today, 60)) return json({ error: "날짜를 다시 골라 주세요" }, 400);
    if (d.start === null) {
      // 그날만 바꾼 값을 지우고 요일 기본으로 되돌림
      await env.DB.prepare("DELETE FROM presence WHERE host = ? AND who = ? AND day = ?").bind(host, d.who, day).run();
      return json({ ok: true });
    }
    const start = Number(d.start), end = Number(d.end);
    const half = (v) => Number.isInteger(v * 2);
    const off = start === 0 && end === 0;
    if (!off && (!half(start) || !half(end) || start < OPEN || end > CLOSE || start >= end))
      return json({ error: "시간을 다시 골라 주세요" }, 400);
    await env.DB.prepare("INSERT OR REPLACE INTO presence (host, who, day, start, end) VALUES (?, ?, ?, ?, ?)")
      .bind(host, d.who, day, start, end)
      .run();
    return json({ ok: true });
  }

  return json({ error: "잘못된 요청" }, 400);
}

// 한국 시간 기준 날짜 'YYYY-MM-DD' (offset 일 뒤)
function kstDay(offset) {
  return new Date(Date.now() + 9 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);
}

// 한국 시간 기준 지금 몇 시(0~23)
function kstHour() {
  return new Date(Date.now() + 9 * 3600e3).getUTCHours();
}

function validDay(day, today, maxDays) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(day)) && day >= today && day <= kstDay(maxDays);
}

async function hashPin(pin, salt = crypto.randomUUID()) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin));
  return salt + ":" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkPin(pin, stored) {
  const salt = String(stored).split(":")[0];
  return (await hashPin(pin, salt)) === stored;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// ─── 동의서 접수 확인 (/check/ 페이지) ───
// 집(지번·건물·호)을 고르고 휴대폰 번호를 넣으면, 그 집에 적힌 번호와 맞을 때만 접수 여부를 알려 준다.
// 자료 = 상세 시트(번지 탭 14개: 건물·호·이름·연락처·[제출] 체크) + 명부(붙임2-1 동의자 명부, '시트 연결' 칸으로 집과 이어진 줄).
//   두 원본을 10분마다 새로 읽어 그 자리에서 합친다 — 합친 사본을 따로 두지 않으니 시트를 고치면 다음 갱신 때 그대로 반영된다.
// 개인정보 원칙:
//   · 두 시트 주소는 저장소가 공개라 코드에 넣지 않는다 → Worker 비밀값 DETAIL_SHEET_ID·ROSTER_SHEET_ID.
//   · 시트 내용은 D1에 저장하지 않고 Worker 메모리에만 잠깐 둔다. D1 에는 하루 시도 횟수만, 그것도 해시 키로 남긴다.
//   · 응답에는 이름·주소·번호 원문을 넣지 않는다. 맞았을 때만 이름 첫 글자(윤**), 번호가 조금 다르면 다른 자리를 가린 번호.
//   · '미제출'과 '번호 불일치'·'명단에 없음'은 똑같이 '확인되지 않음'으로 답한다(그 집 소유 여부가 드러나지 않게).
//   · 연락처 칸의 '(2023 등기)' 뒤 번호는 전 집주인 번호일 수 있어 비교에서 뺀다.
const LOOKUP_TABS = { "343": 2060731743, "344": 1510790180, "345": 649958558, "346-A": 1074727924, "346-B": 119422283,
  "346-C": 1874828370, "346-D": 1937372043, "346-E": 1830351254, "347": 768421041, "348-A": 187265445,
  "348-B": 914512928, "422": 1484932507, "423": 1347792618, "426": 584053891 }; // 상세 시트 탭 이름: gid
const ROSTER_GID = 532487739; // 명부 탭
const LOOKUP_TTL = 10 * 60e3;   // 시트를 다시 읽는 간격
const LOOKUP_STALE = 6 * 3600e3; // 시트를 못 읽을 때 직전 자료를 계속 쓰는 한도
const MAX_EDITS = 2;  // 번호가 이만큼(숫자 바꾸기·빼기·넣기·이웃 순서 바꿈 횟수)까지 달라도 같은 번호로 본다
const UNIT_FAILS = 5; // 한 집에 하루 '확인되지 않음'이 이만큼 나오면 그날은 막는다(번호 짐작 막기)
const IP_TRIES = 30;  // 한 접속 주소의 하루 확인 횟수
// 이름 수정 요청(11-12): 받는 곳 = 구글 설문지 '이름 수정 요청 (등록 조회)'(rkfmvk1117) → 연결된 응답 시트 '이름 수정 요청 (등록 조회) 응답'(소유자만 열람).
// 설문지 주소는 공개 저장소에 보이므로 누가 직접 아무 값이나 넣을 수는 있다 — 사이트를 거친 요청은 번호·집이 맞은 사람만 보냄.
const RENAME_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSdlQRpq_92xEBJ4WOExZrlzBPnhgg2dqvf9vosFdAz3J5M8hg/formResponse";
const RENAME_FIELDS = { home: "entry.1714666651", masked: "entry.1024022375", name: "entry.1257609288", last4: "entry.714049435" };
const RENAME_PER_DAY = 3; // 한 집에서 하루 보낼 수 있는 이름 수정 요청 수

const SHEET_TIMEOUT = 10e3; // 시트 한 장 읽기 제한 시간 — 구글 응답 하나가 멈춰도 모든 조회가 같이 멈추지 않게(11-11 미리보기에서 실제로 멈춤)

let lookupIndex = null, lookupLoading = null, lookupLoadingAt = 0;

async function lookupApi(request, env, ctx, host) {
  if (!env.DETAIL_SHEET_ID || !env.ROSTER_SHEET_ID) return json({ error: "준비 중입니다" }, 503);
  const url = new URL(request.url);
  const idx = await loadLookup(env);
  if (request.method === "GET") {
    if (url.searchParams.has("status")) {
      return json({ units: idx.units.size, roster: idx.roster, linked: idx.linked, unresolved: idx.unresolved, asof: idx.asof, at: new Date(idx.at).toISOString() });
    }
    const lot = String(url.searchParams.get("lot") || "").trim();
    return json({ asof: idx.asof, buildings: unitsOfLot(idx, lot) });
  }
  if (request.method !== "POST") return json({ error: "잘못된 요청" }, 405);
  let d;
  try { d = await request.json(); } catch (e) { return json({ error: "잘못된 요청" }, 400); }
  const phone = String((d && d.phone) || "").replace(/\D/g, "");
  if (!/^010\d{8}$/.test(phone)) return json({ error: "휴대폰 번호 11자리(010-0000-0000)를 넣어 주세요." }, 400);
  const unitKey = String((d && d.unit) || "").slice(0, 200);
  if (d && d.action === "rename") return renameRequest(d, phone, unitKey, idx, env, ctx, request, host);
  const day = kstDay(0);
  await ensureLookupTables(env);
  const ipKey = "ip:" + (await sha256(env.DETAIL_SHEET_ID + "|" + host + "|" + (request.headers.get("CF-Connecting-IP") || "")));
  const uKey = "unit:" + (await sha256(env.DETAIL_SHEET_ID + "|" + host + "|" + unitKey));
  const [ipN, uN] = await Promise.all([tries(env, ipKey, day), tries(env, uKey, day)]);
  let out;
  if (ipN >= IP_TRIES || uN >= UNIT_FAILS) out = { r: "limit" };
  else {
    const unit = idx.units.get(unitKey);
    const best = unit ? bestRecord(unit, phone) : null;
    if (!best || (!best.rec.ok && !best.rec.sup)) out = { r: "none" };
    else {
      out = { r: best.rec.ok ? "ok" : "sup", name: maskName(best.rec.names[0] || "") };
      if (best.d > 0) out.near = maskedStored(phone, best.p);
    }
    await bump(env, ipKey, day);
    if (out.r === "none") await bump(env, uKey, day);
  }
  out.asof = idx.asof;
  ctx.waitUntil(record(JSON.stringify({ k: "click", n: "lookup-" + out.r + (out.near ? "-near" : ""), p: "/check/", s: "" }), request, env, host).catch(() => {}));
  return json(out);
}

// 이름 수정 요청: 집·번호가 다시 맞아야(등록 확인된 사람만) 설문지로 보낸다.
// 응답 시트에 남는 것 = 집(지번 / 건물 / 호), 지금 명단 이름(가림), 바꿀 이름, 맞은 번호 끝 4자리(같은 집 공동명의자 구분용)
async function renameRequest(d, phone, unitKey, idx, env, ctx, request, host) {
  const name = String((d && d.name) || "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!/^[가-힣a-zA-Z ]{2,20}$/.test(name)) return json({ error: "이름은 한글이나 영문 2~20자로 적어 주세요." }, 400);
  const day = kstDay(0);
  await ensureLookupTables(env);
  const rKey = "rename:" + (await sha256(env.DETAIL_SHEET_ID + "|" + host + "|" + unitKey));
  if ((await tries(env, rKey, day)) >= RENAME_PER_DAY) return json({ r: "limit" });
  const unit = idx.units.get(unitKey);
  const best = unit ? bestRecord(unit, phone) : null;
  if (!best || (!best.rec.ok && !best.rec.sup)) return json({ r: "none" });
  const body = new URLSearchParams({
    [RENAME_FIELDS.home]: [unit.lot, unit.b, unit.ho].filter(Boolean).join(" / "),
    [RENAME_FIELDS.masked]: maskName(best.rec.names[0] || ""),
    [RENAME_FIELDS.name]: name,
    [RENAME_FIELDS.last4]: best.p.slice(-4),
  });
  const res = await fetch(RENAME_FORM, { method: "POST", body, signal: AbortSignal.timeout(SHEET_TIMEOUT) });
  if (!res.ok) {
    console.error("rename: 설문지 전송 실패", res.status);
    return json({ error: "잠시 후 다시 시도해 주세요" }, 502);
  }
  await bump(env, rKey, day);
  ctx.waitUntil(record(JSON.stringify({ k: "click", n: "lookup-rename", p: "/check/", s: "" }), request, env, host).catch(() => {}));
  return json({ r: "renamed" });
}

// 상세 시트 번지 탭 + 명부를 읽어 집 목록을 만든다. 10분 안에 다시 부르면 들고 있던 것을 쓴다.
async function loadLookup(env) {
  if (lookupIndex && Date.now() - lookupIndex.at < LOOKUP_TTL) return lookupIndex;
  // 읽는 중이면 같이 기다리되, 제한 시간을 넘긴(멈춘) 읽기는 버리고 새로 읽는다
  if (!lookupLoading || Date.now() - lookupLoadingAt > SHEET_TIMEOUT * 2) {
    lookupLoadingAt = Date.now();
    const p = buildLookup(env).then((idx) => (lookupIndex = idx)).finally(() => { if (lookupLoading === p) lookupLoading = null; });
    lookupLoading = p;
  }
  try {
    return await lookupLoading;
  } catch (e) {
    console.error("lookup: 시트를 읽지 못함", e && e.message);
    if (lookupIndex && Date.now() - lookupIndex.at < LOOKUP_STALE) return lookupIndex;
    throw e;
  }
}

async function buildLookup(env) {
  const get = async (sheet, gid) => {
    // gviz 주소는 한 열에 숫자·글자가 섞이면 적은 쪽 값을 빈칸으로 만들어서(호·연락처가 빠짐) 원본 그대로인 내보내기 주소를 쓴다
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheet}/export?format=csv&gid=${gid}`, { signal: AbortSignal.timeout(SHEET_TIMEOUT) });
    if (!res.ok) throw new Error("sheet " + gid + " " + res.status);
    return parseCsvRows(await res.text());
  };
  // 비밀값을 명령줄로 넣으면 끝에 줄바꿈이 붙을 수 있어 앞뒤 공백을 지운다
  const detailId = String(env.DETAIL_SHEET_ID).trim(), rosterId = String(env.ROSTER_SHEET_ID).trim();
  const tabs = await Promise.all(Object.values(LOOKUP_TABS).map((gid) => get(detailId, gid)));
  const roster = await get(rosterId, ROSTER_GID);
  const units = new Map(), byLot = new Map();
  // 번지 탭은 모두 같은 열 순서(A 지번·B 건물·C 호·D 이름·E 연락처·F 소유자 수·G 제출)라 위치로 읽는다.
  // 머리글 글자는 손으로 고치다 밀리기도 해서(346-E의 B·C) 이름·연락처·제출 칸만 맞는지 확인한다.
  const c = { b: 1, ho: 2, name: 3, ph: 4, chk: 6 };
  tabs.forEach((rows, t) => {
    const h = rows.findIndex((r) => (r[0] || "").trim() === "지번");
    const head = rows[h] || [];
    if (h < 0 || !(head[c.name] || "").startsWith("이름") || !(head[c.ph] || "").startsWith("연락처") || (head[c.chk] || "").trim() !== "제출") {
      throw new Error("tab " + Object.keys(LOOKUP_TABS)[t] + " 열 순서가 다름");
    }
    for (const r of rows.slice(h + 1)) {
      const lot = (r[0] || "").trim(), b = (r[c.b] || "").trim(), ho = (r[c.ho] || "").trim();
      if (!/^\d{3}-\d{1,3}$/.test(lot) || !(b || ho || (r[c.name] || "").trim() || (r[c.ph] || "").trim())) continue;
      const key = lot + "|" + b + "|" + ho;
      let u = units.get(key);
      if (!u) {
        u = { key, lot, b, ho, recs: [] };
        units.set(key, u);
        if (!byLot.has(lot)) byLot.set(lot, []);
        byLot.get(lot).push(u);
      }
      u.recs.push({ ph: phonesOf(r[c.ph]), names: namesOf(r[c.name]), ok: r[c.chk] === "TRUE", sup: false });
    }
  });
  // 명부: '시트 연결' 칸(예: "345-1 202", "346-91", "345-1 202 (강서빌아트)")이 있는 줄만 그 집에 붙인다.
  const rh = roster[0] || [];
  const rc = { name: rh.indexOf("성명"), ph: rh.indexOf("연락처"), date: rh.indexOf("날짜"), etc: rh.indexOf("기타"), link: rh.indexOf("시트 연결") };
  let rosterN = 0, linked = 0, unresolved = 0, asof = null;
  for (const r of roster.slice(1)) {
    const name = (r[rc.name] || "").trim();
    if (!name) continue;
    rosterN++;
    const link = rc.link >= 0 ? (r[rc.link] || "").trim() : "";
    if (!link) continue;
    const u = resolveLink(link, byLot);
    if (!u) { unresolved++; continue; }
    linked++;
    const sup = /보완(?!\s*완료)/.test(r[rc.etc] || "");
    const rec = { ph: phonesOf(r[rc.ph]), names: [name], ok: !sup, sup };
    const same = u.recs.find((x) => x.names.includes(name) || x.ph.some((p) => rec.ph.some((q) => editDist(p, q).n <= MAX_EDITS))) ||
      (u.ho && u.recs.length === 1 ? u.recs[0] : null);
    if (same) {
      for (const p of rec.ph) if (!same.ph.includes(p)) same.ph.push(p);
      same.ok = same.ok || rec.ok;
      same.sup = (same.sup || rec.sup) && !same.ok;
      if (!same.names.length) same.names.push(name);
    } else u.recs.push(rec);
    const m = String(r[rc.date] || "").match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (m) { const v = [+m[1], +m[2]]; if (!asof || v[0] > asof[0] || (v[0] === asof[0] && v[1] > asof[1])) asof = v; }
  }
  return { at: Date.now(), units, byLot, roster: rosterN, linked, unresolved, asof: asof ? asof[0] + "/" + asof[1] : null };
}

// 지번 하나에 있는 건물·호 목록(건축물대장 수준의 공개 정보만). 호 없이 소유자만 적힌 건물은 ho "" 하나로 묶인다.
function unitsOfLot(idx, lot) {
  const by = new Map();
  for (const u of idx.byLot.get(lot) || []) {
    if (!by.has(u.b)) by.set(u.b, []);
    by.get(u.b).push({ key: u.key, ho: u.ho });
  }
  const order = (h) => normHo(h).replace(/^B/, "0");
  return [...by].map(([b, us]) => ({ b, units: us.sort((x, y) => order(x.ho).localeCompare(order(y.ho), "ko", { numeric: true })) }));
}

function resolveLink(link, byLot) {
  const m = link.match(/^(\d{3}-\d{1,3})\s*([^()]*?)\s*(?:\(([^)]*)\))?\s*$/);
  if (!m) return null;
  const hint = (m[3] || "").trim();
  const cand = (byLot.get(m[1]) || []).filter((u) => normHo(u.ho) === normHo(m[2]) && (!hint || u.b.includes(hint)));
  return cand.length === 1 ? cand[0] : null;
}

// 연락처 칸 → 휴대폰 번호 목록. 적는 방식이 여러 가지라(쉼표·빗금·띄어쓰기·하이픈 없음·가족 표기) 휴대폰 모양만 골라낸다.
// '?'는 손글씨에서 안 보이는 숫자(한 번호에 2개까지) — 아무 숫자와 같은 것으로 본다.
function phonesOf(s) {
  const t = String(s || "").replace(/\(\s*\d{4}\s*등기\s*\)[^/]*/g, "");
  const out = [];
  for (const m of t.matchAll(/(?<![0-9])01[0-9?][-. /]?[0-9?]{3,4}[-. /]?[0-9?]{4}(?![0-9])/g)) {
    const p = m[0].replace(/[^0-9?]/g, "");
    if ((p.match(/\?/g) || []).length <= 2 && !out.includes(p)) out.push(p);
  }
  return out;
}

function namesOf(s) {
  return String(s || "").replace(/\(\s*\d{4}\s*등기:.*?\)/g, "").split(/[,/]/).map((n) => n.trim().replace(/[A-Z]$/, "")).filter(Boolean);
}

// '지층비01호'·'B01'·'비01' → B01, '1층101호' → 101 처럼 같은 호를 같은 글자로
function normHo(h) {
  return String(h || "").toUpperCase().replace(/\s|호/g, "").replace(/^(지층비|지층B|지하비|지하|지층|비)/, "B").replace(/^\d+[층충](?=\d{1,3}$)/, "");
}

// 편집 거리(바꾸기·빼기·넣기·이웃 순서 바꿈). '?'는 아무 숫자와 같다. 표(d)도 돌려줘서 가린 번호를 만들 때 쓴다.
function editDist(a, b) {
  const eq = (x, y) => x === y || x === "?" || y === "?";
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (eq(a[i - 1], b[j - 1]) ? 0 : 1));
      if (i > 1 && j > 1 && eq(a[i - 1], b[j - 2]) && eq(a[i - 2], b[j - 1])) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return { d, n: d[a.length][b.length] };
}

function bestRecord(unit, phone) {
  let best = null;
  for (const rec of unit.recs) {
    for (const p of rec.ph) {
      const n = editDist(phone, p).n;
      if (n <= MAX_EDITS && (!best || n < best.d || (n === best.d && rec.ok && !best.rec.ok))) best = { d: n, p, rec };
    }
  }
  return best;
}

// 시트에 적힌 번호를 보여 주되, 입력한 번호와 다른 자리(와 '?')는 ●로 가린다 → 새로 알려 주는 숫자는 없다.
function maskedStored(input, stored) {
  const { d } = editDist(input, stored);
  const out = [];
  let i = input.length, j = stored.length;
  while (j > 0) {
    if (i > 0 && input[i - 1] === stored[j - 1] && d[i][j] === d[i - 1][j - 1]) { out.unshift(stored[j - 1]); i--; j--; }
    else if (i > 1 && j > 1 && input[i - 1] === stored[j - 2] && input[i - 2] === stored[j - 1] && d[i][j] === d[i - 2][j - 2] + 1) { out.unshift("●", "●"); i -= 2; j -= 2; }
    else if (i > 0 && d[i][j] === d[i - 1][j - 1] + 1) { out.unshift("●"); i--; j--; }
    else if (d[i][j] === d[i][j - 1] + 1) { out.unshift("●"); j--; }
    else if (i > 0) i--;
    else { out.unshift("●"); j--; }
  }
  const s = out.join("");
  return s.length === 11 ? s.slice(0, 3) + "-" + s.slice(3, 7) + "-" + s.slice(7) : s.length === 10 ? s.slice(0, 3) + "-" + s.slice(3, 6) + "-" + s.slice(6) : s;
}

// 가운데 글자만 가린다(11-12 사용자 요청): 윤창민 → 윤*민, 남궁민수 → 남**수. 두 글자는 끝 글자를 가림(윤민 → 윤*)
function maskName(n) {
  const s = [...String(n || "").trim()];
  if (!s.length) return "";
  if (s.length <= 2) return s[0] + "*";
  return s[0] + "*".repeat(s.length - 2) + s[s.length - 1];
}

// 따옴표 안의 쉼표·줄바꿈까지 읽는 CSV 읽기(구글 시트 내보내기용)
function parseCsvRows(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

let lookupTablesReady = null;
function ensureLookupTables(env) {
  lookupTablesReady ||= env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS lookup_tries (k TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, day))"),
    env.DB.prepare("DELETE FROM lookup_tries WHERE day < ?").bind(kstDay(-3)),
  ]).catch((e) => {
    lookupTablesReady = null;
    throw e;
  });
  return lookupTablesReady;
}

async function tries(env, k, day) {
  return (await env.DB.prepare("SELECT n FROM lookup_tries WHERE k = ? AND day = ?").bind(k, day).first("n")) || 0;
}

async function bump(env, k, day) {
  await env.DB.prepare("INSERT INTO lookup_tries (k, day, n) VALUES (?, ?, 1) ON CONFLICT (k, day) DO UPDATE SET n = n + 1").bind(k, day).run();
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
