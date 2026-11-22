// 동의율 30% 축하 (11-22): 맨 위 축하 띠 · 박수 → 밤 축제 · 축하 한마디(별명·내 까치) · 전깃줄 까치 전체 보기.
// 전체 동의율이 30% 이상일 때만 보인다(첫 화면 '지금 N%'와 같은 계산, index.html 이 window.CONSENT 로 넘겨줌).
// 미리보기 주소에서는 ?cheer=1 로 30% 전에도 띄워 볼 수 있다(운영 주소에서는 무시).
// 글·박수는 worker.js 의 /api/cheer (D1 cheers·claps). 그림 원본: hw_fix/tools/cel_*.py 시안의 까치·한복 까치.
(function () {
  'use strict';
  var ART = {"HEAD": "<circle cx=\"50\" cy=\"36\" r=\"16\" fill=\"#111\" stroke=\"#5a6170\" stroke-width=\"1.5\"/><circle cx=\"56\" cy=\"33\" r=\"4.4\" fill=\"#fff\"/><circle cx=\"57.2\" cy=\"33.4\" r=\"2.1\" fill=\"#111\"/><path d=\"M65 36 78 39.5 65 43Z\" fill=\"#9aa0a6\"/><circle cx=\"57\" cy=\"44\" r=\"3.4\" fill=\"#ff8fa3\" opacity=\".85\"/>", "ACC": ["", "<path d=\"M42 21 44 13h12l2 8Z\" fill=\"#1a1a1a\" stroke=\"#c9a96b\"/><circle cx=\"46\" cy=\"12\" r=\"2\" fill=\"#e5484d\"/><circle cx=\"50\" cy=\"10\" r=\"2.2\" fill=\"#ffc83d\"/><circle cx=\"54\" cy=\"12\" r=\"2\" fill=\"#2fa36b\"/>", "<ellipse cx=\"50\" cy=\"22\" rx=\"25\" ry=\"4.5\" fill=\"#333\" fill-opacity=\".9\"/><path d=\"M41 21 42 6Q50 2 58 6L59 21Z\" fill=\"#1a1a1a\" stroke=\"#555\"/>", "<path d=\"M35 27Q50 7 65 27Z\" fill=\"#222\"/><circle cx=\"41\" cy=\"22\" r=\"3\" fill=\"#ff6b8b\"/><circle cx=\"59\" cy=\"22\" r=\"3\" fill=\"#ffc83d\"/><path d=\"M50 11V4\" stroke=\"#222\" stroke-width=\"2\"/><circle cx=\"50\" cy=\"4\" r=\"3\" fill=\"#fff\"/>", "<g transform=\"translate(41 21)\"><circle cx=\"4.0\" cy=\"0.0\" r=\"3.2\" fill=\"#ff8fb1\"/><circle cx=\"1.2\" cy=\"3.8\" r=\"3.2\" fill=\"#ff8fb1\"/><circle cx=\"-3.2\" cy=\"2.4\" r=\"3.2\" fill=\"#ff8fb1\"/><circle cx=\"-3.2\" cy=\"-2.4\" r=\"3.2\" fill=\"#ff8fb1\"/><circle cx=\"1.2\" cy=\"-3.8\" r=\"3.2\" fill=\"#ff8fb1\"/><circle r=\"2.4\" fill=\"#ffd23f\"/></g>", "<circle cx=\"57\" cy=\"33\" r=\"6.2\" fill=\"none\" stroke=\"#333\" stroke-width=\"1.8\"/><path d=\"M51 32 40 30\" stroke=\"#333\" stroke-width=\"1.8\"/>", "<path d=\"M50 20 41 14 41 26ZM50 20 59 14 59 26Z\" fill=\"#e5484d\"/><circle cx=\"50\" cy=\"20\" r=\"2.6\" fill=\"#b71c1c\"/>", "<path d=\"M35 30Q36 12 50 12Q64 12 65 30Z\" fill=\"#3b82f6\"/><rect x=\"34\" y=\"27\" width=\"32\" height=\"6\" rx=\"3\" fill=\"#93c5fd\"/><circle cx=\"50\" cy=\"11\" r=\"4\" fill=\"#fff\"/>", "<path d=\"M36 27Q50 14 64 27\" stroke=\"#ff7aa2\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/>"], "DA": "<svg class=\"dz\" viewBox=\"0 0 100 140\"><g class=\"swayA\"><path d=\"M60 98 97 116 95 124 57 109Z\" fill=\"#1d2a44\" stroke=\"#3d4a6a\" stroke-width=\"1\"/><path d=\"M44 121v14M56 121v14M44 135h-5M56 135h5\" stroke=\"#bbb\" stroke-width=\"3.2\" stroke-linecap=\"round\"/><path d=\"M32 74Q50 70 68 74L82 124Q50 132 18 124Z\" fill=\"#e03e52\"/><path d=\"M20 120Q50 128 80 120\" stroke=\"#ffc83d\" stroke-width=\"3\" fill=\"none\"/><g class=\"armL\"><rect x=\"10.0\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#e5484d\"/><rect x=\"14.6\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#ffc83d\"/><rect x=\"19.2\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#2fa36b\"/><rect x=\"23.8\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#3b82f6\"/><rect x=\"28.4\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#f472b6\"/><path d=\"M10 59 2 64.5 10 70Z\" fill=\"#111\" stroke=\"#5a6170\"/><g transform=\"translate(4 63) scale(1 1)\"><path d=\"M0 0-12-17A21 21 0 0 1 12-17Z\" fill=\"#ff7a93\" stroke=\"#c0392b\" stroke-width=\"1\"/><path d=\"M0 0-6-19M0 0 0-21M0 0 6-19\" stroke=\"#fff\" stroke-width=\".8\"/></g></g><g class=\"armR\"><rect x=\"67.0\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#e5484d\"/><rect x=\"71.6\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#ffc83d\"/><rect x=\"76.2\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#2fa36b\"/><rect x=\"80.8\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#3b82f6\"/><rect x=\"85.4\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#f472b6\"/><path d=\"M90 59 98 64.5 90 70Z\" fill=\"#111\" stroke=\"#5a6170\"/><g transform=\"translate(96 63) scale(-1 1)\"><path d=\"M0 0-12-17A21 21 0 0 1 12-17Z\" fill=\"#ff7a93\" stroke=\"#c0392b\" stroke-width=\"1\"/><path d=\"M0 0-6-19M0 0 0-21M0 0 6-19\" stroke=\"#fff\" stroke-width=\".8\"/></g></g><path d=\"M31 56Q50 50 69 56L70 79Q50 85 30 79Z\" fill=\"#ffd23f\"/><path d=\"M44 55 50 66 56 55\" stroke=\"#fff\" stroke-width=\"3\" fill=\"none\"/><path d=\"M50 68q-5 8-3 16M50 68q7 7 8 15\" stroke=\"#e03e52\" stroke-width=\"3.4\" fill=\"none\" stroke-linecap=\"round\"/><g class=\"headA\"><circle cx=\"50\" cy=\"36\" r=\"16\" fill=\"#111\" stroke=\"#5a6170\" stroke-width=\"1.5\"/><circle cx=\"56\" cy=\"33\" r=\"4.4\" fill=\"#fff\"/><circle cx=\"57.2\" cy=\"33.4\" r=\"2.1\" fill=\"#111\"/><path d=\"M65 36 78 39.5 65 43Z\" fill=\"#9aa0a6\"/><circle cx=\"57\" cy=\"44\" r=\"3.4\" fill=\"#ff8fa3\" opacity=\".85\"/><path d=\"M42 21 44 13h12l2 8Z\" fill=\"#1a1a1a\" stroke=\"#c9a96b\"/><circle cx=\"46\" cy=\"12\" r=\"2\" fill=\"#e5484d\"/><circle cx=\"50\" cy=\"10\" r=\"2.2\" fill=\"#ffc83d\"/><circle cx=\"54\" cy=\"12\" r=\"2\" fill=\"#2fa36b\"/></g></g></svg>", "DB": "<svg class=\"dz\" viewBox=\"0 0 100 140\"><g class=\"bobB\"><path d=\"M60 98 97 116 95 124 57 109Z\" fill=\"#1d2a44\" stroke=\"#3d4a6a\" stroke-width=\"1\"/><path d=\"M44 121v14M56 121v14M44 135h-5M56 135h5\" stroke=\"#bbb\" stroke-width=\"3.2\" stroke-linecap=\"round\"/><path d=\"M32 76H68L71 122H53L50 97 47 122H29Z\" fill=\"#2b3f7a\"/><g class=\"armL\"><rect x=\"10.0\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#e5484d\"/><rect x=\"14.6\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#ffc83d\"/><rect x=\"19.2\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#2fa36b\"/><rect x=\"23.8\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#3b82f6\"/><rect x=\"28.4\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#f472b6\"/><path d=\"M10 59 2 64.5 10 70Z\" fill=\"#111\" stroke=\"#5a6170\"/></g><g class=\"armR\"><rect x=\"67.0\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#e5484d\"/><rect x=\"71.6\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#ffc83d\"/><rect x=\"76.2\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#2fa36b\"/><rect x=\"80.8\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#3b82f6\"/><rect x=\"85.4\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#f472b6\"/><path d=\"M90 59 98 64.5 90 70Z\" fill=\"#111\" stroke=\"#5a6170\"/></g><path d=\"M31 56Q50 50 69 56L70 79Q50 85 30 79Z\" fill=\"#8ec9f5\"/><path d=\"M44 55 50 66 56 55\" stroke=\"#fff\" stroke-width=\"3\" fill=\"none\"/><path d=\"M50 68q-5 8-3 16M50 68q7 7 8 15\" stroke=\"#2b3f7a\" stroke-width=\"3.4\" fill=\"none\" stroke-linecap=\"round\"/><g class=\"headB\"><circle cx=\"50\" cy=\"36\" r=\"16\" fill=\"#111\" stroke=\"#5a6170\" stroke-width=\"1.5\"/><circle cx=\"56\" cy=\"33\" r=\"4.4\" fill=\"#fff\"/><circle cx=\"57.2\" cy=\"33.4\" r=\"2.1\" fill=\"#111\"/><path d=\"M65 36 78 39.5 65 43Z\" fill=\"#9aa0a6\"/><circle cx=\"57\" cy=\"44\" r=\"3.4\" fill=\"#ff8fa3\" opacity=\".85\"/><g class=\"hatB\"><ellipse cx=\"50\" cy=\"22\" rx=\"27\" ry=\"4.5\" fill=\"#333\" fill-opacity=\".9\"/><path d=\"M41 21 42 6Q50 2 58 6L59 21Z\" fill=\"#1a1a1a\" stroke=\"#555\"/><path d=\"M27 23Q36 50 50 54Q64 50 73 23\" stroke=\"#c99a5a\" stroke-width=\"1.6\" stroke-dasharray=\"2 2\" fill=\"none\"/></g></g></g></svg>", "DC": "<svg class=\"dz\" viewBox=\"0 0 100 140\"><g class=\"jumpC\"><path d=\"M60 98 97 116 95 124 57 109Z\" fill=\"#1d2a44\" stroke=\"#3d4a6a\" stroke-width=\"1\"/><path d=\"M44 121v14M56 121v14M44 135h-5M56 135h5\" stroke=\"#bbb\" stroke-width=\"3.2\" stroke-linecap=\"round\"/><path d=\"M32 76H68L71 122H53L50 97 47 122H29Z\" fill=\"#efece2\"/><g class=\"armL\"><rect x=\"10.0\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#e5484d\"/><rect x=\"14.6\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#ffc83d\"/><rect x=\"19.2\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#2fa36b\"/><rect x=\"23.8\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#3b82f6\"/><rect x=\"28.4\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#f472b6\"/><path d=\"M10 59 2 64.5 10 70Z\" fill=\"#111\" stroke=\"#5a6170\"/></g><g class=\"armR\"><rect x=\"67.0\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#e5484d\"/><rect x=\"71.6\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#ffc83d\"/><rect x=\"76.2\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#2fa36b\"/><rect x=\"80.8\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#3b82f6\"/><rect x=\"85.4\" y=\"59\" width=\"5.0\" height=\"11\" fill=\"#f472b6\"/><path d=\"M90 59 98 64.5 90 70Z\" fill=\"#111\" stroke=\"#5a6170\"/></g><path d=\"M31 56Q50 50 69 56L70 79Q50 85 30 79Z\" fill=\"#fbfaf5\"/><path d=\"M44 55 50 66 56 55\" stroke=\"#fff\" stroke-width=\"3\" fill=\"none\"/><path d=\"M50 68q-5 8-3 16M50 68q7 7 8 15\" stroke=\"#e03e52\" stroke-width=\"3.4\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M32 58 68 80\" stroke=\"#e03e52\" stroke-width=\"4\"/><path d=\"M33 64 64 82\" stroke=\"#3b82f6\" stroke-width=\"3\"/><path d=\"M34 70 58 83\" stroke=\"#ffc83d\" stroke-width=\"3\"/><g class=\"headC\"><circle cx=\"50\" cy=\"36\" r=\"16\" fill=\"#111\" stroke=\"#5a6170\" stroke-width=\"1.5\"/><circle cx=\"56\" cy=\"33\" r=\"4.4\" fill=\"#fff\"/><circle cx=\"57.2\" cy=\"33.4\" r=\"2.1\" fill=\"#111\"/><path d=\"M65 36 78 39.5 65 43Z\" fill=\"#9aa0a6\"/><circle cx=\"57\" cy=\"44\" r=\"3.4\" fill=\"#ff8fa3\" opacity=\".85\"/><path d=\"M35 27Q50 7 65 27Z\" fill=\"#222\"/><circle cx=\"41\" cy=\"22\" r=\"3\" fill=\"#ff6b8b\"/><circle cx=\"59\" cy=\"22\" r=\"3\" fill=\"#ffc83d\"/><path d=\"M50 11V3\" stroke=\"#222\" stroke-width=\"2\"/><g class=\"sangmo\"><path d=\"M50 3C70-8 92 6 118-4\" stroke=\"#fff\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\"/></g></g></g></svg>", "MAGPIE": "<svg class=\"mp\" viewBox=\"0 0 120 60\"><path d=\"M70 30 118 21 120 28 73 37Z\" fill=\"#1d2a44\"/><ellipse cx=\"55\" cy=\"32\" rx=\"20\" ry=\"11\" fill=\"#111\"/><ellipse cx=\"57\" cy=\"37\" rx=\"12\" ry=\"5.5\" fill=\"#fff\"/><circle cx=\"33\" cy=\"26\" r=\"9\" fill=\"#111\"/><path d=\"M24 24 14 27 24 29Z\" fill=\"#333\"/><circle cx=\"30\" cy=\"24\" r=\"1.7\" fill=\"#fff\"/><g class=\"wing\" style=\"\"><path d=\"M50 29 80 3 90 7 63 31Z\" fill=\"#161616\"/><path d=\"M60 24 75 11 80 14 64 27Z\" fill=\"#fff\"/><path d=\"M80 3 90 7 86 11 77 7Z\" fill=\"#2b4a7a\"/></g></svg>", "KICON": "<svg viewBox=\"0 0 40 32\"><path d=\"M4 26 0 31 3 32 8 28Z\" fill=\"#2b4a7a\"/><ellipse cx=\"13\" cy=\"23\" rx=\"9\" ry=\"6.5\" fill=\"#111\"/><ellipse cx=\"15\" cy=\"25\" rx=\"5\" ry=\"3\" fill=\"#fff\"/><circle cx=\"18\" cy=\"13\" r=\"8\" fill=\"#111\"/><circle cx=\"21\" cy=\"11\" r=\"2.2\" fill=\"#fff\"/><circle cx=\"21.6\" cy=\"11.3\" r=\"1\" fill=\"#111\"/><path d=\"M25 12 31 14 25 16Z\" fill=\"#9aa0a6\"/><g transform=\"rotate(-8 33 17)\"><rect x=\"27\" y=\"13\" width=\"12\" height=\"9\" rx=\"1\" fill=\"#fff\" stroke=\"#c9a96b\"/><path d=\"M27 13 33 18 39 13\" stroke=\"#c9a96b\" fill=\"none\"/></g></svg>"};
  var PROD = 'hwagok-c-zone.hwagok1.workers.dev';
  var GOAL = 30;
  var FORCE = /[?&]cheer=1\b/.test(location.search) && location.host !== PROD;
  var REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var NICKS = ['웃는 까치', '춤추는 까치', '반가운 이웃', '신난 까치', '박수 치는 까치', '노래하는 까치', '까치산 산책러', '곰달래 이웃', '화곡 새내기'];
  var CHIPS = ['고생 많으셨어요', '감사합니다 🙇', '끝까지 함께해요', '화곡동 화이팅!', '축하해요 🎉'];
  var BG = ['#fff3c4', '#ffe3ea', '#e3f2fd', '#e8f5e9', '#fff3e0', '#f3e5f5', '#e0f7fa', '#fce4ec', '#ede7f6'];
  var VEST = ['#ffd23f', '#e5484d', '#3b82f6', '#2fa36b', '#ff7aa2', '#c084fc', '#ff9f43', '#14b8a6', '#9aa0a6'];
  var MAX_NICK = 12, MAX_MSG = 150;

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(k, d) { try { var v = localStorage.getItem('cheer.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem('cheer.' + k, JSON.stringify(v)); } catch (e) { /* 저장 안 되는 브라우저 */ } }
  function track(name) { if (typeof window.hit === 'function') window.hit('click', name); }
  var cid = get('cid', '');
  if (!/^[0-9a-z]{12,24}$/.test(cid)) { cid = (Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 20); put('cid', cid); }

  var data = { count: 0, claps: 0, items: [] };
  var mine = get('mine', []);            // 내가 쓴 글 번호
  var started = false;

  // ── 그림 ──
  var uid = 0;
  function kachi(av, size, own) {
    var id = 'ckc' + (++uid);
    return '<svg class="ck-av' + (own ? ' own' : '') + '" width="' + size + '" height="' + size + '" viewBox="24 2 52 52" aria-hidden="true" focusable="false">' +
      '<clipPath id="' + id + '"><circle cx="50" cy="28" r="26"/></clipPath><g clip-path="url(#' + id + ')"><rect x="0" y="-10" width="100" height="80" fill="' + BG[av % 9] + '"/>' +
      '<path d="M26 60Q50 44 74 60Z" fill="#111"/><ellipse cx="56" cy="55" rx="9" ry="4.5" fill="#fff"/>' + ART.HEAD + ART.ACC[av % 9] + '</g></svg>';
  }
  function perch(vest) {
    return '<svg class="ck-perch" viewBox="0 0 80 60" aria-hidden="true" focusable="false"><path d="M16 34 2 46 5 50 19 40Z" fill="#1d2a44" stroke="#3d4a6a"/>' +
      '<path d="M25 43v10M32 43v10" stroke="#999" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="28" cy="34" rx="13" ry="10" fill="#111" stroke="#5a6170"/>' +
      '<path d="M17 30Q28 24 39 30L38 41Q28 45 18 41Z" fill="' + vest + '"/><circle cx="38" cy="20" r="9" fill="#111" stroke="#5a6170"/>' +
      '<circle cx="41" cy="18" r="2.6" fill="#fff"/><circle cx="41.7" cy="18.3" r="1.2" fill="#111"/><path d="M46 19 54 21 46 23Z" fill="#9aa0a6"/><circle cx="41" cy="24" r="1.8" fill="#ff8fa3"/>' +
      '<path d="M26 31 40 35 37 39 24 35Z" fill="#161616" stroke="#5a6170" stroke-width=".8"/></svg>';
  }
  function isMine(it) { return mine.indexOf(it.id) >= 0; }
  function ago(t) {
    var m = (Date.now() - Date.parse(t)) / 60e3;
    if (!(m >= 0)) return '';
    if (m < 1) return '방금';
    if (m < 60) return Math.floor(m) + '분 전';
    if (m < 1440) return Math.floor(m / 60) + '시간 전';
    var d = new Date(Date.parse(t) + 9 * 3600e3);
    return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일';
  }
  var MINE_TAG = '<i class="ck-me">내 글</i>';

  // ── 서버 ──
  function api(body) {
    return fetch('/api/cheer', body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ cid: cid }, body)) } : { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || '잠시 후 다시 시도해 주세요'); return j; }); });
  }
  function load() {
    return api().then(function (d) { data = d; render(); }).catch(function () { /* 못 읽으면 띠만 둔다 */ });
  }

  // ── 공통: 겹쳐 뜨는 화면(축제·쓰기·전체 보기)은 휴대폰 '뒤로'로도 닫힌다 ──
  var layers = [], wall = null;
  // replace: 축제 → 쓰기처럼 바로 이어 열 때는 기록을 하나 더 쌓지 않는다(뒤로 한 번에 홈)
  function openLayer(el, name, replace) {
    document.body.appendChild(el);
    layers.push(el);
    document.documentElement.classList.add('cheer-lock');
    try { history[replace ? 'replaceState' : 'pushState']({ cheer: name }, ''); } catch (e) { /* 무시 */ }
  }
  function dropTop() {
    var el = layers.pop();
    if (el === wall) wall = null;
    if (el) el.remove();
    if (!layers.length) document.documentElement.classList.remove('cheer-lock');
  }
  function closeTop() { if (layers.length) { if (history.state && history.state.cheer) history.back(); else dropTop(); } }
  window.addEventListener('popstate', function () { if (layers.length) dropTop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && layers.length) closeTop(); });
  function closeBtn(label) { return '<button type="button" class="cx" data-close aria-label="' + (label || '닫고 홈으로') + '"><i>✕</i><small>닫기</small></button>'; }

  var toastEl = null, toastT = 0;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'cheer-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }

  // ── 맨 위 축하 띠 ──
  var band, rollTimer = 0, rollAt = 0;
  function buildBand() {
    band = $('#cheer');
    if (!band) return;
    var first = !get('seen', false) && !REDUCE;
    band.innerHTML =
      '<div class="cb-in' + (first ? ' cb-anim' : '') + '"><div class="cb-wrap">' +
      '<div class="cb-r1"><p class="cb-t">동의율 30%가 넘었습니다</p>' +
      '<button type="button" class="cb-clap' + (get('clapped', false) || REDUCE ? '' : ' nudge') + '" data-track="cheer-clap" aria-label="축하 박수 보내기"><i class="cb-hand" aria-hidden="true">👏</i> <b class="cb-cn">0</b></button>' +
      '<button type="button" class="cb-box" data-track="cheer-box" aria-label="축하 한마디 전체 보기">' + ART.KICON + '<b class="cb-bn">0</b></button>' +
      '<button type="button" class="cb-x" aria-label="축하 띠 닫기">✕</button></div>' +
      '<p class="cb-m2">사전의향률 가산점: 기존 <span class="cb-o">+5.5점</span>에서 <b class="cb-s9">+9.5점</b>으로 <span class="cb-chip">+4점</span> 예상</p>' +
      '<button type="button" class="cb-roll" data-track="cheer-roll" aria-label="축하 한마디 전체 보기"><span class="cb-rin"></span></button>' +
      '</div></div>' +
      (first ? '<div class="cb-pull" aria-hidden="true">' + ART.MAGPIE + '<i class="cb-rope"></i><i class="cb-scroll"></i></div>' : '') +
      (get('wallSeen', false) ? '' : '<p class="cb-coach">까치를 누르면 한마디 <b>전체 보기</b></p>');
    band.hidden = false;
    if (first) put('seen', true);
    $('.cb-clap', band).addEventListener('click', clap);
    $('.cb-box', band).addEventListener('click', openWall);
    $('.cb-roll', band).addEventListener('click', function () { if (data.items.length) openWall(); else openWrite(); });
    $('.cb-x', band).addEventListener('click', function () { band.hidden = true; try { sessionStorage.setItem('cheer.hide', '1'); } catch (e) { /* 무시 */ } });
  }
  function renderBand() {
    if (!band) return;
    $('.cb-cn', band).textContent = data.claps;
    $('.cb-bn', band).textContent = data.count;
    var items = data.items.slice(0, 8);
    var rin = $('.cb-rin', band);
    rin.innerHTML = items.length
      ? items.map(function (it) { return '<span class="cb-ri' + (isMine(it) ? ' mine' : '') + '">💬 ' + (isMine(it) ? MINE_TAG : '') + '<b>' + esc(it.nick) + '</b> ' + esc(it.msg) + '</span>'; }).join('')
      : '<span class="cb-ri">✍️ 첫 축하 한마디를 남겨 주세요</span>';
    rollAt = 0; rin.style.transform = '';
    clearInterval(rollTimer);
    if (items.length > 1 && !REDUCE) rollTimer = setInterval(function () {
      rollAt = (rollAt + 1) % items.length;
      rin.style.transform = 'translateY(' + (-20 * rollAt) + 'px)';
    }, 3200);
  }

  // ── 첫 화면 '이웃들의 축하 한마디' 칸 ──
  var card;
  function buildCard() {
    card = $('#cheer-list');
    if (!card) return;
    card.innerHTML = '<div class="cc-h"><p class="quick-title">' + ART.KICON + ' 이웃들의 축하 한마디</p><span><b class="cc-n">0</b>개</span></div>' +
      '<button type="button" class="cc-write" data-track="cheer-write-card">✍️ 나도 축하 한마디 남기기</button><div class="cc-l"></div>' +
      '<button type="button" class="cc-all" data-track="cheer-all-card">까치가 전하는 한마디 전체 보기 ›</button>';
    card.hidden = false;
    $('.cc-write', card).addEventListener('click', openWrite);
    $('.cc-all', card).addEventListener('click', openWall);
  }
  function row(it, size) {
    var m = isMine(it);
    return '<div class="ck-row' + (m ? ' mine' : '') + '" data-id="' + it.id + '">' + kachi(it.av, size, m) +
      '<div class="ck-body"><p class="ck-nm"><b>' + esc(it.nick) + '</b>' + (m ? MINE_TAG : '') + '<small>' + ago(it.t) + '</small></p><p class="ck-msg">' + esc(it.msg) + '</p></div></div>';
  }
  function renderCard() {
    if (!card) return;
    $('.cc-n', card).textContent = data.count;
    $('.cc-l', card).innerHTML = data.items.slice(0, 3).map(function (it) { return row(it, 34); }).join('') ||
      '<p class="cc-empty">아직 한마디가 없어요. 첫 한마디를 남겨 주세요!</p>';
    $('.cc-all', card).hidden = !data.items.length;
  }

  function render() { renderBand(); renderCard(); if (wall) renderWall(); }

  // ── 박수 → 밤 축제 ──
  function clap(ev) {
    var btn = ev.currentTarget;
    btn.classList.remove('nudge', 'pop'); void btn.offsetWidth; btn.classList.add('pop');
    for (var i = 0; i < 4; i++) {
      var p = document.createElement('i');
      p.className = 'cb-fly'; p.textContent = '👏';
      p.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px');
      p.style.animationDelay = (i * 90) + 'ms';
      btn.appendChild(p);
      setTimeout(p.remove.bind(p), 1400);
    }
    if (!get('clapped', false)) {
      put('clapped', true);
      data.claps += 1; renderBand();
      api({ a: 'clap' }).then(function (d) { data.claps = d.claps; renderBand(); }).catch(function () {});
    }
    setTimeout(openFest, REDUCE ? 0 : 450);
  }
  function lanterns() {
    var g = '';
    for (var i = 0, x = 30; x < 360; x += 60, i++) {
      var y = i % 2 ? 2 : 8;
      g += '<g class="cf-ln" style="transform-origin:' + x + 'px 10px;animation-delay:-' + (i * 0.3).toFixed(1) + 's"><path d="M' + x + ' ' + (6 + y) + 'v8" stroke="#c9a96b" stroke-width="1.2"/>' +
        '<rect x="' + (x - 9) + '" y="' + (14 + y) + '" width="18" height="11" rx="4" fill="#2a4fa8"/><rect x="' + (x - 9) + '" y="' + (25 + y) + '" width="18" height="11" rx="4" fill="#d0343f"/>' +
        '<ellipse cx="' + x + '" cy="' + (25 + y) + '" rx="13" ry="10" fill="#ffd27a" opacity=".22"/></g>';
    }
    return '<svg class="cf-lns" viewBox="0 0 360 50" preserveAspectRatio="xMidYMin slice" aria-hidden="true"><path d="M0 6Q180 22 360 6" fill="none" stroke="#c9a96b" stroke-width="1.2"/>' + g + '</svg>';
  }
  function fireworks() {
    if (REDUCE) return '';
    var cols = ['#ffc83d', '#ff6b8b', '#6fe3a0', '#7cb7ff', '#ffffff', '#ff9f43', '#c084fc'], out = '';
    for (var b = 0; b < 9; b++) {
      var r = 48 + Math.random() * 22, c = cols[b % cols.length], d = (0.25 + b * 0.55).toFixed(2), parts = '';
      for (var k = 0; k < 18; k++) {
        var a = k / 18 * Math.PI * 2;
        parts += '<i style="--dx:' + (r * Math.cos(a)).toFixed(0) + 'px;--dy:' + (r * Math.sin(a) + 18).toFixed(0) + 'px;background:' + c + ';color:' + c + ';animation-delay:' + d + 's"></i>';
      }
      for (var k2 = 0; k2 < 8; k2++) {
        var a2 = (k2 + 0.5) / 8 * Math.PI * 2;
        parts += '<i style="--dx:' + (r * 0.55 * Math.cos(a2)).toFixed(0) + 'px;--dy:' + (r * 0.55 * Math.sin(a2) + 12).toFixed(0) + 'px;background:#fff6d6;color:#fff6d6;animation-delay:' + d + 's"></i>';
      }
      out += '<span class="cf-b" style="left:' + (8 + Math.random() * 84).toFixed(0) + '%;top:' + (70 + Math.random() * 150).toFixed(0) + 'px">' + parts + '</span>';
    }
    return '<div class="cf-fw" aria-hidden="true">' + out + '</div>';
  }
  function openFest() {
    var el = document.createElement('div');
    el.className = 'cf' + (REDUCE ? ' reduce' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '동의율 30% 축하');
    var stars = '';
    for (var i = 0; i < 26; i++) stars += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 320).toFixed(0) + 'px;animation-delay:' + (Math.random() * 1.2).toFixed(1) + 's"></i>';
    el.innerHTML = '<div class="cf-sky" aria-hidden="true">' + stars + '</div>' + lanterns() + fireworks() +
      '<div class="cf-top"><p class="cf-t">동의율 30% 돌파!</p><p class="cf-s">함께해 주신 봉사자분들과 주민 여러분께 감사합니다 🙇</p></div>' +
      '<div class="cf-btns"><button type="button" class="cf-write" data-track="cheer-write-fest">✍️ 나도 축하 한마디</button><button type="button" class="cf-close" data-close>닫기</button></div>' +
      '<div class="cf-stage" aria-hidden="true"><i class="cf-floor"></i>' +
      '<div class="cf-d"><span class="cf-bub" style="--d:1.6s">좋다~</span>' + ART.DA + '</div>' +
      '<div class="cf-d"><span class="cf-bub" style="--d:1.1s">얼쑤!</span>' + ART.DB + '</div>' +
      '<div class="cf-d"><span class="cf-bub" style="--d:2.2s">지화자!</span>' + ART.DC + '</div></div>' + closeBtn('축제 닫기');
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeTop();
      else if (e.target.closest('.cf-write')) { dropTop(); openWrite(true); }
    });
    openLayer(el, 'fest');
  }

  // ── 쓰기 ──
  function openWrite(replace) {
    var el = document.createElement('div');
    el.className = 'cw-wrap';
    var av = get('av', Math.floor(Math.random() * 9)), nick = get('nick', '') || NICKS[Math.floor(Math.random() * NICKS.length)];
    var avs = '';
    for (var i = 0; i < 9; i++) avs += '<button type="button" class="cw-av' + (i === av ? ' on' : '') + '" data-av="' + i + '" aria-label="까치 ' + (i + 1) + '번" aria-pressed="' + (i === av) + '">' + kachi(i, 40) + '</button>';
    el.innerHTML = '<div class="cw-dim" data-close></div><form class="cw" role="dialog" aria-modal="true" aria-label="축하 한마디 남기기" novalidate>' +
      '<i class="cw-grab" aria-hidden="true"></i><div class="cw-h"><b>축하 한마디 남기기</b>' + closeBtn('쓰기 닫기') + '</div>' +
      '<label class="cw-lb" for="cw-nick">별명 <small>실명 대신 별명으로 보여요</small></label>' +
      '<div class="cw-nick"><input id="cw-nick" name="nick" maxlength="' + MAX_NICK + '" autocomplete="off" value="' + esc(nick) + '"><button type="button" class="cw-dice">🎲 추천</button></div>' +
      '<p class="cw-lb">내 까치 고르기</p><div class="cw-avs">' + avs + '</div>' +
      '<label class="cw-lb" for="cw-msg">한마디 <span class="cw-cnt">0/' + MAX_MSG + '</span></label>' +
      '<div class="cw-chips">' + CHIPS.map(function (c) { return '<button type="button" class="cw-chip">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<textarea id="cw-msg" name="msg" maxlength="' + MAX_MSG + '" rows="3" placeholder="축하 한마디를 남겨 주세요"></textarea>' +
      '<p class="cw-note">⚠️ 실명·동·호수·전화번호는 적지 말아 주세요. 욕설·비방·광고 글은 숨겨질 수 있어요.</p>' +
      '<p class="cw-err" role="alert" hidden></p><button type="submit" class="cw-go" data-track="cheer-send" disabled>등록하기</button></form>';
    var form = $('.cw', el), msg = $('#cw-msg', el), nickIn = $('#cw-nick', el), go = $('.cw-go', el), err = $('.cw-err', el);
    function upd() {
      var n = Array.from(msg.value.trim()).length;
      $('.cw-cnt', el).textContent = n + '/' + MAX_MSG;
      go.disabled = n < 2 || !nickIn.value.trim();
    }
    msg.addEventListener('input', upd); nickIn.addEventListener('input', upd);
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-close]')) { closeTop(); return; }
      if (t.closest('.cw-dice')) { var cur = nickIn.value, nn = cur; while (nn === cur) nn = NICKS[Math.floor(Math.random() * NICKS.length)]; nickIn.value = nn; upd(); return; }
      var a = t.closest('.cw-av');
      if (a) { av = +a.dataset.av; el.querySelectorAll('.cw-av').forEach(function (b) { b.classList.toggle('on', b === a); b.setAttribute('aria-pressed', String(b === a)); }); return; }
      var c = t.closest('.cw-chip');
      if (c) { var v = msg.value.trim(); msg.value = (v ? v + ' ' : '') + c.textContent; msg.value = msg.value.slice(0, MAX_MSG); upd(); msg.focus(); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (go.disabled) return;
      go.disabled = true; go.textContent = '올리는 중…'; err.hidden = true;
      api({ a: 'write', nick: nickIn.value.trim(), av: av, msg: msg.value.trim() }).then(function (d) {
        put('nick', nickIn.value.trim()); put('av', av);
        mine.push(d.item.id); put('mine', mine.slice(-50));
        data.items.unshift(d.item); data.count = Math.max(data.count + 1, d.n);
        closeTop(); render();
        toast('🎉 ' + d.n + '번째 축하 한마디가 올라갔어요');
      }).catch(function (x) {
        err.textContent = x.message; err.hidden = false; go.textContent = '등록하기'; upd();
      });
    });
    openLayer(el, 'write', replace === true);
    upd();
    setTimeout(function () { try { msg.focus({ preventScroll: true }); } catch (x) { /* 무시 */ } }, 300);
  }

  // ── 전체 보기: 전깃줄 까치 ──
  function openWall() {
    put('wallSeen', true);
    var c = band && $('.cb-coach', band); if (c) c.remove();
    var el = document.createElement('div');
    el.className = 'cv';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '축하 한마디 전체 보기');
    el.innerHTML = '<div class="cv-h"><div class="cv-tt"><b>' + ART.KICON + '까치가 전하는 축하 한마디</b><small><span class="cv-n">0</span>개 · 최신순</small></div>' + closeBtn() + '</div>' +
      '<div class="cv-wire"><svg class="cv-wsv" viewBox="0 0 360 120" preserveAspectRatio="none" aria-hidden="true"><path d="M-5 70Q180 92 365 70" stroke="#333" stroke-width="1.6" fill="none"/></svg>' +
      '<div class="cv-birds"></div><p class="cv-wl">새 한마디가 오면 까치가 내려앉아요 · 까치를 누르면 그 글로</p></div>' +
      '<div class="cv-list"><button type="button" class="cv-write" data-track="cheer-write-wall">✍️ 나도 축하 한마디 남기기</button><div class="cv-cards"></div>' +
      '<button type="button" class="cv-more" hidden>지난 한마디 더 보기</button></div>';
    el.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-close]')) { closeTop(); return; }
      if (t.closest('.cv-write')) { openWrite(); return; }
      if (t.closest('.cv-more')) { more(t.closest('.cv-more')); return; }
      var b = t.closest('.cv-bird');
      if (b) jumpTo(b);
    });
    wall = el;
    openLayer(el, 'wall');
    renderWall(true);
    load();
  }
  function renderWall(landing) {
    if (!wall) return;
    $('.cv-n', wall).textContent = data.count;
    $('.cv-cards', wall).innerHTML = data.items.map(function (it) { return row(it, 40); }).join('') || '<p class="cc-empty">아직 한마디가 없어요. 첫 한마디를 남겨 주세요!</p>';
    var seen = {}, birds = [];
    data.items.forEach(function (it) { if (birds.length < 7 && !seen[it.nick]) { seen[it.nick] = 1; birds.push(it); } });
    var xs = [8, 58, 108, 158, 208, 258, 308];
    $('.cv-birds', wall).innerHTML = birds.map(function (it, i) {
      var y = 50 + Math.round(12 * Math.sin((xs[i] + 22) / 360 * Math.PI));
      var m = isMine(it);
      return '<button type="button" class="cv-bird' + (m ? ' mine' : '') + (landing && i === 0 && !REDUCE ? ' land' : '') + '" data-id="' + it.id + '" style="left:' + xs[i] + 'px;top:' + y + 'px;animation-delay:' + (i * 0.23).toFixed(2) + 's" aria-label="' + esc(it.nick) + '의 한마디로">' +
        perch(m ? '#ffd54f' : VEST[it.av % 9]) + (m ? '<small>내 까치</small>' : '') + '<span class="cv-tip">' + esc(it.nick) + '</span></button>';
    }).join('');
    $('.cv-more', wall).hidden = data.items.length >= data.count;
  }
  function jumpTo(b) {
    wall.querySelectorAll('.cv-bird.tip').forEach(function (x) { x.classList.remove('tip'); });
    b.classList.add('tip');
    var r = $('.cv-cards .ck-row[data-id="' + b.dataset.id + '"]', wall);
    if (!r) return;
    r.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'center' });
    r.classList.remove('hl'); void r.offsetWidth; r.classList.add('hl');
  }
  function more(btn) {
    var last = data.items[data.items.length - 1];
    if (!last) return;
    btn.disabled = true;
    fetch('/api/cheer?before=' + last.id, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      data.items = data.items.concat(d.items || []); data.count = d.count; render();
    }).catch(function () {}).then(function () { btn.disabled = false; });
  }

  // ── 시작: 전체 동의율이 30% 이상일 때만 ──
  function start() {
    if (started) return;
    started = true;
    var hide = false;
    try { hide = sessionStorage.getItem('cheer.hide') === '1'; } catch (e) { /* 무시 */ }
    buildBand();
    if (hide && band) band.hidden = true;
    buildCard();
    render();
    load();
  }
  function check() {
    var c = window.CONSENT;
    if (FORCE || (c && c.t > 0 && (c.a / c.t) * 100 >= GOAL)) start();
  }
  if (FORCE) start();
  else if (window.CONSENT) check();
  else window.addEventListener('consent-rate', check);
})();
