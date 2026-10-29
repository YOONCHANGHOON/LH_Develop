// 봉사 일정: 데이터는 Worker의 /api/schedule (D1 shifts·presence 테이블, worker.js 참고)
const SHOW_DAYS = 14; // 화면에 보여 주는 날 수
const H0 = 10, H1 = 19; // 10~19시, 1시간 칸
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const WHO = { chair: "위원장님", owner: "부동산 대표님" };
const $ = (id) => document.getElementById(id);

let data = null;
let adminKey = localStorage.getItem("schedKey") || "";
let openCancel = null; // 취소 번호 입력칸을 연 예약 id

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// 'YYYY-MM-DD' 날짜 계산은 시간대 영향을 받지 않게 UTC로만 한다.
const toUtc = (day) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const addDays = (day, n) => new Date(toUtc(day) + n * 86400e3).toISOString().slice(0, 10);
const weekday = (day) => new Date(toUtc(day)).getUTCDay();
const label = (day) => `${+day.slice(5, 7)}/${+day.slice(8, 10)}(${WD[weekday(day)]})`;
const hm = (v) => (v % 1 ? `${Math.floor(v)}:30` : `${v}`);
const nowKstHour = () => new Date(Date.now() + 9 * 3600e3).getUTCHours();

// 그날만 바꾼 값 → 없으면 매주 요일 기본. start=end=0 은 '안 계심'
function presenceFor(who, day) {
  const p = data.presence.find((r) => r.who === who && r.day === day) ||
    data.presence.find((r) => r.who === who && r.day === "w" + weekday(day));
  return p && !(p.start === 0 && p.end === 0) ? p : null;
}
const isOverride = (who, day) => data.presence.some((r) => r.who === who && r.day === day);

const shiftsOn = (day) => data.shifts.filter((s) => s.day === day);
const countAt = (list, h) => list.filter((s) => s.start <= h && h < s.end).length;
// 이미 지난 시간(오늘)은 빈 시간으로 세지 않는다
const isPast = (day, h) => day === data.today && h < nowKstHour();

// 봉사자 0명인 시간을 이어진 구간으로 묶는다 → ['10~12시', '15~19시']
function gaps(day) {
  const list = shiftsOn(day);
  const out = [];
  let s = null;
  for (let h = H0; h <= H1; h++) {
    const empty = h < H1 && !isPast(day, h) && countAt(list, h) === 0;
    if (empty && s === null) s = h;
    if (!empty && s !== null) {
      out.push(`${s}~${h}시`);
      s = null;
    }
  }
  return out;
}

function render() {
  const box = $("days");
  box.textContent = "";
  if (adminKey) box.appendChild(adminBar());
  else if (location.hash === "#admin") box.appendChild(adminLogin());
  for (let i = 0; i < SHOW_DAYS; i++) box.appendChild(dayCard(addDays(data.today, i), i));
}

function dayCard(day, i) {
  const card = el("section", "day");
  const h2 = el("h2");
  const wd = weekday(day);
  h2.appendChild(el("span", wd === 0 ? "sun" : wd === 6 ? "sat" : "", label(day)));
  if (i < 2) h2.appendChild(el("span", "tag", i === 0 ? "오늘" : "내일"));
  card.appendChild(h2);

  const g = gaps(day);
  const closed = day === data.today && nowKstHour() >= H1;
  card.appendChild(el("p", "gap" + (g.length ? "" : " full"),
    closed ? "오늘 접수 시간이 끝났습니다" : g.length ? `봉사자 없는 시간: ${g.join(", ")}` : "모든 시간에 봉사자가 있습니다"));

  // 시간표: 1행 시각, 2행 위원장님, 3행 대표님, 4행 봉사자
  const grid = el("div", "grid");
  const put = (node, row, col) => {
    node.style.gridRow = row;
    if (col) node.style.gridColumn = col;
    grid.appendChild(node);
    return node;
  };
  put(el("span", "lab", ""), 1, "1");
  for (let h = H0; h < H1; h++) put(el("span", "hr", String(h)), 1, `${(h - H0) * 2 + 2} / span 2`);
  ["chair", "owner"].forEach((who, k) => {
    put(el("span", "lab", who === "chair" ? "위원장" : "대표"), k + 2, "1");
    const p = presenceFor(who, day);
    if (p) put(el("span", "bar " + who, `${hm(p.start)}~${hm(p.end)}`), k + 2, `${(p.start - H0) * 2 + 2} / ${(p.end - H0) * 2 + 2}`);
    else put(el("span", "none", "안 계심"), k + 2, `2 / ${(H1 - H0) * 2 + 2}`);
  });
  put(el("span", "lab", "봉사자"), 4, "1");
  const list = shiftsOn(day);
  for (let h = H0; h < H1; h++) {
    const n = countAt(list, h);
    const past = isPast(day, h);
    const b = el("button", "cell v" + Math.min(n, 2), n ? `${n}명` : "없음");
    b.type = "button";
    b.setAttribute("aria-label", `${h}시~${h + 1}시 봉사자 ${n}명${past ? "" : ", 눌러서 신청"}`);
    b.setAttribute("data-track", "schedule-cell");
    if (past) {
      b.disabled = true;
      b.style.opacity = ".35";
    } else b.onclick = () => openSheet(day, h);
    put(b, 4, `${(h - H0) * 2 + 2} / span 2`);
  }
  card.appendChild(grid);

  if (list.length) {
    const ul = el("ul", "shifts");
    list.forEach((s) => ul.appendChild(shiftItem(s)));
    card.appendChild(ul);
  }

  const acts = el("div", "acts");
  const book = el("button", "book", "이 날 봉사 신청");
  book.type = "button";
  book.setAttribute("data-track", "schedule-book-day");
  book.onclick = () => openSheet(day, null);
  acts.appendChild(book);
  if (g.length) {
    const copy = el("button", "copy", "단톡방 문구 복사");
    copy.type = "button";
    copy.setAttribute("data-track", "schedule-copy");
    copy.onclick = () => copyText(`[봉사 일정] ${label(day)} 유림부동산에 봉사자가 없는 시간: ${g.join(", ")}\n나와 주실 수 있는 분은 아래에서 시간을 신청해 주세요.\n${location.origin}/schedule/`);
    acts.appendChild(copy);
  }
  card.appendChild(acts);

  if (adminKey) card.appendChild(adminDay(day));
  return card;
}

function shiftItem(s) {
  const li = el("li");
  li.appendChild(el("span", "t", `${s.start}~${s.end}시`));
  li.appendChild(el("span", "", s.name));
  li.appendChild(el("span", "task", s.task));
  const x = el("button", "link", adminKey ? "삭제" : "취소");
  x.type = "button";
  x.onclick = () => {
    openCancel = openCancel === s.id ? null : s.id;
    render();
  };
  li.appendChild(x);
  if (openCancel === s.id) {
    const row = el("div", "pinrow");
    const pin = el("input");
    pin.type = "password";
    pin.inputMode = "numeric";
    pin.maxLength = 4;
    pin.placeholder = "신청할 때 정한 숫자 4자리";
    const ok = el("button", "", adminKey ? "삭제 확인" : "취소하기");
    ok.type = "button";
    ok.onclick = () =>
      post({ op: "cancel", id: s.id, pin: pin.value, key: adminKey })
        .then(() => {
          openCancel = null;
          toast("취소되었습니다");
          load();
        })
        .catch((e) => toast(e.message));
    if (!adminKey) row.appendChild(pin);
    row.appendChild(ok);
    li.appendChild(row);
  }
  return li;
}

// ─── 신청서 ───
function openSheet(day, h) {
  const fd = $("f-day");
  fd.textContent = "";
  for (let i = 0; i <= data.bookDays; i++) {
    const d = addDays(data.today, i);
    const o = el("option", "", label(d) + (i === 0 ? " 오늘" : i === 1 ? " 내일" : ""));
    o.value = d;
    fd.appendChild(o);
  }
  fd.value = day || data.today;
  const fs = $("f-start"), fe = $("f-end");
  fs.textContent = "";
  fe.textContent = "";
  for (let k = H0; k < H1; k++) fs.appendChild(Object.assign(el("option", "", `${k}시`), { value: k }));
  for (let k = H0 + 1; k <= H1; k++) fe.appendChild(Object.assign(el("option", "", `${k}시`), { value: k }));
  const start = h ?? Math.max(H0, Math.min(H1 - 1, day === data.today ? nowKstHour() + 1 : H0));
  fs.value = start;
  fe.value = Math.min(start + 2, H1);
  const ft = $("f-tasks");
  ft.textContent = "";
  data.tasks.forEach((t, i) => {
    const lab = el("label");
    const r = el("input");
    r.type = "radio";
    r.name = "task";
    r.value = t;
    r.checked = i === 0;
    lab.appendChild(r);
    lab.appendChild(document.createTextNode(t));
    ft.appendChild(lab);
  });
  $("f-name").value = localStorage.getItem("schedName") || "";
  $("f-pin").value = "";
  $("f-err").hidden = true;
  $("sheet").hidden = $("sheet-bg").hidden = false;
}
function closeSheet() {
  $("sheet").hidden = $("sheet-bg").hidden = true;
}
$("f-start").onchange = () => {
  if (+$("f-end").value <= +$("f-start").value) $("f-end").value = +$("f-start").value + 1;
};
$("f-close").onclick = closeSheet;
$("sheet-bg").onclick = closeSheet;
$("book-top").onclick = () => openSheet(null, null);
$("sheet").onsubmit = (ev) => {
  ev.preventDefault();
  const task = document.querySelector('input[name="task"]:checked');
  const body = {
    op: "add",
    day: $("f-day").value,
    start: +$("f-start").value,
    end: +$("f-end").value,
    name: $("f-name").value.trim(),
    task: task ? task.value : "",
    pin: $("f-pin").value,
  };
  const err = (m) => {
    $("f-err").textContent = m;
    $("f-err").hidden = false;
  };
  if (body.end <= body.start) return err("끝나는 시간을 시작 시간보다 뒤로 골라 주세요");
  if (!body.name) return err("이름을 적어 주세요");
  if (!/^\d{4}$/.test(body.pin)) return err("취소용 번호는 숫자 4자리로 적어 주세요");
  post(body)
    .then(() => {
      localStorage.setItem("schedName", body.name);
      closeSheet();
      toast(`${label(body.day)} ${body.start}~${body.end}시 신청되었습니다`);
      load();
    })
    .catch((e) => err(e.message));
};

// ─── 관리(위원장님·운영자): 주소 끝에 #admin 을 붙여 열고 관리 비밀번호 입력 ───
function adminLogin() {
  const box = el("div", "admin");
  box.appendChild(el("b", "", "관리 비밀번호"));
  const row = el("div", "row");
  const pw = el("input");
  pw.type = "password";
  const ok = el("button", "", "확인");
  ok.type = "button";
  ok.onclick = () =>
    post({ op: "check", key: pw.value })
      .then(() => {
        adminKey = pw.value;
        localStorage.setItem("schedKey", adminKey);
        render();
      })
      .catch((e) => toast(e.message));
  row.appendChild(pw);
  row.appendChild(ok);
  box.appendChild(row);
  return box;
}

function adminBar() {
  const box = el("div", "admin");
  box.appendChild(el("span", "", "관리 모드: 날짜마다 위원장님·대표님 시간을 고치고, 아무 신청이나 지울 수 있습니다. "));
  const out = el("button", "", "관리 끝내기");
  out.type = "button";
  out.onclick = () => {
    adminKey = "";
    localStorage.removeItem("schedKey");
    render();
  };
  box.appendChild(out);
  return box;
}

function adminDay(day) {
  const box = el("div", "admin");
  ["chair", "owner"].forEach((who) => {
    const row = el("div", "row");
    row.appendChild(el("b", "", WHO[who]));
    const p = presenceFor(who, day);
    const s = el("select"), e = el("select");
    s.appendChild(Object.assign(el("option", "", "안 계심"), { value: "0" }));
    for (let v = H0; v < H1; v += 0.5) s.appendChild(Object.assign(el("option", "", hm(v)), { value: v }));
    for (let v = H0 + 0.5; v <= H1; v += 0.5) e.appendChild(Object.assign(el("option", "", hm(v)), { value: v }));
    s.value = p ? p.start : "0";
    e.value = p ? p.end : H1;
    row.appendChild(s);
    row.appendChild(document.createTextNode("~"));
    row.appendChild(e);
    const save = (target) => {
      const off = s.value === "0";
      post({ op: "presence", key: adminKey, who, day: target, start: off ? 0 : +s.value, end: off ? 0 : +e.value })
        .then(() => {
          toast("저장했습니다");
          load();
        })
        .catch((x) => toast(x.message));
    };
    const b1 = el("button", "", "이 날만");
    b1.type = "button";
    b1.onclick = () => save(day);
    const b2 = el("button", "", `매주 ${WD[weekday(day)]}요일`);
    b2.type = "button";
    b2.onclick = () => save("w" + weekday(day));
    row.appendChild(b1);
    row.appendChild(b2);
    if (isOverride(who, day)) {
      const b3 = el("button", "", "이 날만 바꾼 것 되돌리기");
      b3.type = "button";
      b3.onclick = () =>
        post({ op: "presence", key: adminKey, who, day, start: null })
          .then(() => load())
          .catch((x) => toast(x.message));
      row.appendChild(b3);
    }
    box.appendChild(row);
  });
  return box;
}

// ─── 공통 ───
function post(body) {
  return fetch("/api/schedule", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) =>
    r.json().then((j) => {
      if (!r.ok) throw new Error(j.error || "잠시 후 다시 시도해 주세요");
      return j;
    })
  );
}

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

// 카톡 안 브라우저는 clipboard API가 막힐 때가 있어 textarea 복사로 한 번 더 시도한다(홈페이지 공유 버튼과 같은 방식)
function copyText(text) {
  const done = () => toast("복사했습니다. 단톡방에 붙여 넣어 주세요");
  const fallback = () => {
    const ta = el("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {
      toast("복사하지 못했습니다");
    }
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

function load() {
  return fetch("/api/schedule", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => {
      if (j.error) throw new Error(j.error);
      data = j;
      render();
    })
    .catch(() => {
      $("days").textContent = "일정을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.";
    });
}

// 다른 분이 신청한 것을 보려고 앱으로 돌아올 때 다시 읽는다(주기적으로 읽지는 않음)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && data) load();
});
window.addEventListener("hashchange", () => data && render());
load();
