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
