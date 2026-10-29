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
    return env.ASSETS.fetch(request);
  },
};

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
// shifts: 봉사자가 직접 넣는 예약(1시간 단위, 10~19시). 취소용 숫자 4자리는 소금+해시로만 저장.
// presence: 위원장님·부동산 대표님이 계신 시간. day = 'w0'~'w6'(매주 요일 기본) 또는 'YYYY-MM-DD'(그날만).
//   그날만 값이 있으면 요일 기본보다 우선. start=end=0 은 '안 계심'.
// host 로 나눠서 미리보기 주소에서 시험한 예약이 실제 사이트에 섞이지 않게 한다.
// 위원장·대표 시간 고치기와 아무 예약 지우기는 Worker 비밀값 ADMIN_KEY 가 있어야 한다.
const TASKS = ["접수 안내", "전단", "전화", "가가호호 방문"];
const BOOK_DAYS = 21; // 오늘부터 며칠 뒤까지 예약 가능
// 홈페이지 '접수 장소' 안내 문구 기준(위원장님 월·화·목·금 11:30부터, 대표님 오후 3시경, 위원장님 일요일 16시부터)
const PRESENCE_SEED = [
  ["chair", "w1", 11.5, 19], ["chair", "w2", 11.5, 19], ["chair", "w4", 11.5, 19], ["chair", "w5", 11.5, 19],
  ["chair", "w0", 16, 19],
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
  ]).catch((e) => {
    tablesReady = null;
    throw e;
  });
  return tablesReady;
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
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 10 || end > 19 || start >= end)
      return json({ error: "시간을 다시 골라 주세요" }, 400);
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
    if (!off && (!half(start) || !half(end) || start < 10 || end > 19 || start >= end))
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
