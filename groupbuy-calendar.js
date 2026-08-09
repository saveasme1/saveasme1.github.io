(() => {
  "use strict";

  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(
    /\/$/,
    ""
  );
  const TOKEN_KEY = "gongbang171.adminToken";
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const FONT_LINK_ID = "gb-cal-fonts";

  function ensureFonts() {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&display=swap";
    document.head.appendChild(link);
  }

  function assetUrl(value) {
    const path = String(value || "").trim();
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    // Same-origin on hand-made.kr / github.io (mirrors private gongbang uploads).
    return `/${path.replace(/^\/+/, "")}`;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function kstParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
    );
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      weekday: parts.weekday,
    };
  }

  function todayKey() {
    const t = kstParts();
    return `${t.year}-${pad2(t.month)}-${pad2(t.day)}`;
  }

  function ymKey(year, month) {
    return `${year}-${pad2(month)}`;
  }

  function dayKey(year, month, day) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  function parseKey(key) {
    const [y, m, d] = String(key || "")
      .split("-")
      .map(Number);
    if (!y || !m || !d) return null;
    return { year: y, month: m, day: d };
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function weekdaySunForKey(key) {
    const ms = Date.parse(`${key}T12:00:00+09:00`);
    return new Date(ms).getDay();
  }

  function addMonths(year, month, delta) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }

  function eachDateKey(start, end) {
    const a = parseKey(start);
    const b = parseKey(end || start);
    if (!a || !b) return [];
    const keys = [];
    let cur = Date.parse(`${a.year}-${pad2(a.month)}-${pad2(a.day)}T12:00:00+09:00`);
    const last = Date.parse(`${b.year}-${pad2(b.month)}-${pad2(b.day)}T12:00:00+09:00`);
    if (Number.isNaN(cur) || Number.isNaN(last) || cur > last) return [];
    while (cur <= last) {
      const p = kstParts(new Date(cur));
      keys.push(dayKey(p.year, p.month, p.day));
      cur += 24 * 60 * 60 * 1000;
    }
    return keys;
  }

  function formatRangeLabel(start, end) {
    const a = parseKey(start);
    const b = parseKey(end || start);
    if (!a) return "";
    if (!b || start === end) return `${a.month}.${pad2(a.day)}`;
    if (a.month === b.month) return `${a.month}.${pad2(a.day)}–${pad2(b.day)}`;
    return `${a.month}.${pad2(a.day)}–${b.month}.${pad2(b.day)}`;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  function textToBase64(value) {
    return bytesToBase64(new TextEncoder().encode(value));
  }

  function decodeBase64(value) {
    return new TextDecoder().decode(
      Uint8Array.from(atob(String(value || "").replace(/\s/g, "")), (c) => c.charCodeAt(0))
    );
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(sessionStorage.getItem(TOKEN_KEY)
          ? { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` }
          : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `요청 실패 (${response.status})`);
    return payload;
  }

  async function fetchPublicItems() {
    const url = new URL("./groupbuy-data.json", location.href);
    url.searchParams.set("v", String(Date.now()));
    const res = await fetch(url.href, { cache: "no-store", credentials: "omit" });
    if (!res.ok) throw new Error(`공동구매 데이터를 불러오지 못했습니다 (${res.status})`);
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  }

  async function readManaged(path, optional = false) {
    const params = new URLSearchParams({ path, _: Date.now() });
    if (optional) params.set("optional", "1");
    const payload = await api(`/admin/files?${params}`);
    if (!payload.file) return null;
    return {
      value: JSON.parse(decodeBase64(payload.file.content)),
      sha: payload.file.sha,
    };
  }

  async function putManaged(path, content, message, sha = "") {
    return api("/admin/files", {
      method: "PUT",
      body: JSON.stringify({ path, content, message, sha }),
    });
  }

  async function uploadImage(file, id, role, index = 0) {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error(`${file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
    }
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type] || "jpg";
    const suffix = index ? `-${index}` : "";
    const path = `groupbuy/uploads/${id}/${role}${suffix}-${Date.now()}.${ext}`;
    const content = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    await putManaged(path, content, `groupbuy: upload ${id} ${role}${suffix}`);
    return path;
  }

  async function detectAdmin() {
    try {
      if (window.GongbangAuth?.me) {
        const me = await window.GongbangAuth.me();
        if (me && me.role === "admin") return me;
      }
    } catch (_) {}
    try {
      const me = await api("/auth/me");
      const user = me.user || me.member || me;
      if (user && user.role === "admin") return user;
    } catch (_) {}
    return null;
  }

  function normalizeItem(item) {
    const start = String(item.startDate || item.start || "").slice(0, 10);
    const end = String(item.endDate || item.end || start).slice(0, 10);
    return {
      ...item,
      startDate: start,
      endDate: end || start,
      cover: item.cover || item.image || "",
      images: Array.isArray(item.images) ? item.images : [],
      title: String(item.title || "").trim() || "공동구매",
      content: String(item.content || ""),
    };
  }

  function itemsForDay(items, key) {
    return items.filter((it) => {
      const keys = eachDateKey(it.startDate, it.endDate);
      return keys.includes(key);
    });
  }

  function buildMonthCells(year, month) {
    const dim = daysInMonth(year, month);
    const firstKey = dayKey(year, month, 1);
    const lead = weekdaySunForKey(firstKey);
    const cells = [];
    const prev = addMonths(year, month, -1);
    const prevDim = daysInMonth(prev.year, prev.month);
    for (let i = lead - 1; i >= 0; i -= 1) {
      const day = prevDim - i;
      cells.push({
        key: dayKey(prev.year, prev.month, day),
        day,
        out: true,
        sun: weekdaySunForKey(dayKey(prev.year, prev.month, day)) === 0,
      });
    }
    for (let day = 1; day <= dim; day += 1) {
      const key = dayKey(year, month, day);
      cells.push({
        key,
        day,
        out: false,
        sun: weekdaySunForKey(key) === 0,
      });
    }
    while (cells.length % 7 !== 0) {
      const next = addMonths(year, month, 1);
      const day = cells.length - (lead + dim) + 1;
      const key = dayKey(next.year, next.month, day);
      cells.push({ key, day, out: true, sun: weekdaySunForKey(key) === 0 });
    }
    return cells;
  }

  // Date-fill capsules (solid, white day numbers).
  const EVENT_COLORS = [
    { bg: "#e07a54", ink: "#fff", name: "#b85a38" },
    { bg: "#5b7c99", ink: "#fff", name: "#3d5f7a" },
    { bg: "#c96b7a", ink: "#fff", name: "#a34f5d" },
    { bg: "#6a9a82", ink: "#fff", name: "#4a7560" },
    { bg: "#9a8268", ink: "#fff", name: "#75604a" },
    { bg: "#7a6b9e", ink: "#fff", name: "#5c5080" },
    { bg: "#d4925c", ink: "#fff", name: "#a86f3a" },
    { bg: "#5a8fa8", ink: "#fff", name: "#3d7088" },
  ];

  function seededShuffle(list, seed) {
    const arr = list.slice();
    let s = seed >>> 0;
    for (let i = arr.length - 1; i > 0; i -= 1) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function monthOverlaps(it, year, month) {
    const keys = eachDateKey(it.startDate, it.endDate);
    const prefix = `${year}-${pad2(month)}-`;
    return keys.some((k) => k.startsWith(prefix));
  }

  function eventKey(it) {
    return String(it.id || `${it.startDate}|${it.endDate}|${it.title}`);
  }

  function colorsForMonth(items, year, month) {
    const visible = items
      .filter((it) => monthOverlaps(it, year, month))
      .slice()
      .sort(
        (a, b) =>
          String(a.startDate).localeCompare(String(b.startDate)) ||
          eventKey(a).localeCompare(eventKey(b))
      );
    const palette = seededShuffle(EVENT_COLORS, year * 100 + month + visible.length * 17);
    const map = new Map();
    visible.forEach((it, index) => {
      map.set(eventKey(it), palette[index % palette.length]);
    });
    return map;
  }

  function labelSegments(items, cells) {
    const indexOf = new Map(cells.map((c, i) => [c.key, i]));
    const segs = [];
    const laneBusy = [];

    function takeLane(startIdx, endIdx) {
      for (let lane = 0; lane < 8; lane += 1) {
        if (!laneBusy[lane]) laneBusy[lane] = [];
        const clash = laneBusy[lane].some(([a, b]) => !(endIdx < a || startIdx > b));
        if (!clash) {
          laneBusy[lane].push([startIdx, endIdx]);
          return lane;
        }
      }
      return 0;
    }

    items.forEach((it) => {
      const keys = eachDateKey(it.startDate, it.endDate).filter((k) => indexOf.has(k));
      if (!keys.length) return;
      let runStart = null;
      let runEnd = null;
      let prevIdx = null;
      const flush = () => {
        if (runStart == null) return;
        const startIdx = indexOf.get(runStart);
        const endIdx = indexOf.get(runEnd);
        const lane = takeLane(startIdx, endIdx);
        const roundLeft = runStart === it.startDate;
        const roundRight = runEnd === it.endDate;
        segs.push({
          item: it,
          startIdx,
          endIdx,
          lane,
          label: it.title,
          roundLeft,
          roundRight,
        });
        runStart = null;
        runEnd = null;
        prevIdx = null;
      };
      keys.forEach((key) => {
        const idx = indexOf.get(key);
        if (runStart == null) {
          runStart = key;
          runEnd = key;
          prevIdx = idx;
          return;
        }
        // Keep bar continuous through weekdays/holidays; only break on week wrap.
        if (idx === prevIdx + 1 && Math.floor(idx / 7) === Math.floor(prevIdx / 7)) {
          runEnd = key;
          prevIdx = idx;
          return;
        }
        flush();
        runStart = key;
        runEnd = key;
        prevIdx = idx;
      });
      flush();
    });
    return segs;
  }

  function createSheet() {
    let root = document.getElementById("gbCalSheet");
    if (root) return root;
    root = document.createElement("div");
    root.id = "gbCalSheet";
    root.className = "gb-cal-sheet";
    root.hidden = true;
    root.innerHTML = `<div class="gb-cal-sheet__card" role="dialog" aria-modal="true" aria-label="공동구매 상세"></div>`;
    root.addEventListener("click", (e) => {
      if (e.target === root) closeSheet();
    });
    document.body.appendChild(root);
    return root;
  }

  function closeSheet() {
    const root = document.getElementById("gbCalSheet");
    if (!root) return;
    root.hidden = true;
    root.querySelector(".gb-cal-sheet__card").replaceChildren();
  }

  function openDetail(item) {
    const root = createSheet();
    const card = root.querySelector(".gb-cal-sheet__card");
    const images = [item.cover, ...(item.images || [])].filter(Boolean);
    const uniq = [...new Set(images.map(String))];
    let active = 0;

    const paint = () => {
      const hero = uniq[active] || "";
      card.innerHTML =
        `<div class="gb-cal-sheet__top">` +
        `<span class="gb-cal-sheet__badge">${formatRangeLabel(item.startDate, item.endDate)}</span>` +
        `<button type="button" class="gb-cal-sheet__close" aria-label="닫기">×</button>` +
        `</div>` +
        `<div class="gb-cal-sheet__hero">${
          hero ? `<img src="${assetUrl(hero)}" alt="">` : ""
        }</div>` +
        (uniq.length > 1
          ? `<div class="gb-cal-sheet__rail">${uniq
              .map(
                (src, i) =>
                  `<button type="button" class="${i === active ? "is-on" : ""}" data-i="${i}">` +
                  `<img src="${assetUrl(src)}" alt=""></button>`
              )
              .join("")}</div>`
          : "") +
        `<div class="gb-cal-sheet__body">` +
        `<h3></h3><p></p></div>`;
      card.querySelector("h3").textContent = item.title;
      card.querySelector("p").textContent = item.content || "";
      card.querySelector(".gb-cal-sheet__close")?.addEventListener("click", closeSheet);
      card.querySelectorAll(".gb-cal-sheet__rail button").forEach((btn) => {
        btn.addEventListener("click", () => {
          active = Number(btn.dataset.i) || 0;
          paint();
        });
      });
    };
    paint();
    root.hidden = false;
  }

  function openDayPicker(items, key) {
    const hits = itemsForDay(items, key);
    if (!hits.length) return;
    if (hits.length === 1) {
      openDetail(hits[0]);
      return;
    }
    const root = createSheet();
    const card = root.querySelector(".gb-cal-sheet__card");
    card.innerHTML =
      `<div class="gb-cal-sheet__top">` +
      `<span class="gb-cal-sheet__badge">${key}</span>` +
      `<button type="button" class="gb-cal-sheet__close" aria-label="닫기">×</button>` +
      `</div>` +
      `<div class="gb-cal-sheet__body"><h3>이 날의 공동구매</h3></div>` +
      `<div class="gb-cal-sheet__list"></div>`;
    card.querySelector(".gb-cal-sheet__close")?.addEventListener("click", closeSheet);
    const list = card.querySelector(".gb-cal-sheet__list");
    hits.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gb-cal-sheet__item";
      btn.innerHTML =
        (it.cover ? `<img src="${assetUrl(it.cover)}" alt="">` : "<span></span>") +
        `<span><strong></strong><span></span></span>`;
      btn.querySelector("strong").textContent = it.title;
      btn.querySelector("span > span").textContent = formatRangeLabel(it.startDate, it.endDate);
      btn.addEventListener("click", () => openDetail(it));
      list.append(btn);
    });
    root.hidden = false;
  }

  function createWriterDialog(onSaved) {
    let dlg = document.getElementById("gbCalWriter");
    if (dlg) {
      dlg._onSaved = onSaved;
      return dlg;
    }
    dlg = document.createElement("dialog");
    dlg.id = "gbCalWriter";
    dlg.className = "gb-cal-writer";
    dlg.innerHTML =
      `<form class="gb-cal-writer__form" id="gbCalWriterForm">` +
      `<h2>공동구매 글쓰기</h2>` +
      `<label>제목<input name="title" type="text" minlength="2" maxlength="160" required placeholder="예: [앵콜] 알함브라"></label>` +
      `<label>내용<textarea name="content" minlength="2" maxlength="20000" required placeholder="공동구매 안내를 적어 주세요"></textarea></label>` +
      `<div class="gb-cal-range" id="gbCalRange">` +
      `<p class="gb-cal-range__hint">시작일을 탭한 뒤 종료일을 탭하세요. 같은 날이면 하루 일정입니다.</p>` +
      `<div class="gb-cal-range__meta"><b data-start>—</b><b data-end>—</b></div>` +
      `<div class="gb-cal-range__nav" style="display:flex;gap:8px;margin-bottom:8px">` +
      `<button type="button" data-rm="-1">‹</button>` +
      `<strong data-rm-label style="flex:1;text-align:center;font-size:14px"></strong>` +
      `<button type="button" data-rm="1">›</button>` +
      `</div>` +
      `<div class="gb-cal-range__week">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div>` +
      `<div class="gb-cal-range__grid" id="gbCalRangeGrid"></div>` +
      `</div>` +
      `<label>대표 이미지<input name="cover" type="file" accept="image/jpeg,image/png,image/webp" required></label>` +
      `<label>추가 이미지<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>` +
      `<p class="gb-cal-writer__status" id="gbCalWriterStatus" aria-live="polite"></p>` +
      `<div class="gb-cal-writer__actions">` +
      `<button type="button" id="gbCalWriterCancel">취소</button>` +
      `<button type="submit" class="primary" id="gbCalWriterSubmit">등록·공개</button>` +
      `</div>` +
      `</form>`;
    document.body.appendChild(dlg);
    dlg._onSaved = onSaved;

    const form = dlg.querySelector("form");
    const status = dlg.querySelector("#gbCalWriterStatus");
    const rangeState = {
      year: kstParts().year,
      month: kstParts().month,
      start: "",
      end: "",
    };

    function syncMeta() {
      dlg.querySelector("[data-start]").textContent = rangeState.start
        ? `시작 ${rangeState.start}`
        : "시작일 선택";
      dlg.querySelector("[data-end]").textContent = rangeState.end
        ? `종료 ${rangeState.end}`
        : rangeState.start
          ? "종료일 선택"
          : "—";
    }

    function renderRangeGrid() {
      const grid = dlg.querySelector("#gbCalRangeGrid");
      const cells = buildMonthCells(rangeState.year, rangeState.month);
      dlg.querySelector("[data-rm-label]").textContent = `${rangeState.year}.${pad2(
        rangeState.month
      )}`;
      grid.replaceChildren();
      cells.forEach((cell) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = String(cell.day);
        if (cell.out) btn.classList.add("is-out");
        const inRange =
          rangeState.start &&
          rangeState.end &&
          cell.key >= rangeState.start &&
          cell.key <= rangeState.end;
        const isEdge = cell.key === rangeState.start || cell.key === rangeState.end;
        if (inRange) btn.classList.add("is-in");
        if (isEdge) btn.classList.add("is-edge");
        btn.addEventListener("click", () => {
          if (cell.out) return;
          if (!rangeState.start || (rangeState.start && rangeState.end)) {
            rangeState.start = cell.key;
            rangeState.end = "";
          } else if (cell.key < rangeState.start) {
            rangeState.end = rangeState.start;
            rangeState.start = cell.key;
          } else {
            rangeState.end = cell.key;
          }
          syncMeta();
          renderRangeGrid();
        });
        grid.append(btn);
      });
      syncMeta();
    }

    dlg.querySelectorAll("[data-rm]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = addMonths(rangeState.year, rangeState.month, Number(btn.dataset.rm));
        rangeState.year = next.year;
        rangeState.month = next.month;
        renderRangeGrid();
      });
    });

    dlg.querySelector("#gbCalWriterCancel").addEventListener("click", () => dlg.close());

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const coverFile = form.elements.cover.files[0];
      const detailFiles = [...form.elements.images.files];
      if (!coverFile) {
        status.textContent = "대표 이미지가 필요합니다.";
        return;
      }
      if (!rangeState.start) {
        status.textContent = "시작일을 선택해 주세요.";
        return;
      }
      const startDate = rangeState.start;
      const endDate = rangeState.end || rangeState.start;
      if (detailFiles.length > 8) {
        status.textContent = "추가 이미지는 최대 8장까지입니다.";
        return;
      }
      const submit = dlg.querySelector("#gbCalWriterSubmit");
      submit.disabled = true;
      try {
        const id = `gb-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        status.textContent = "대표 이미지 업로드 중…";
        const cover = await uploadImage(coverFile, id, "cover");
        const images = [];
        for (let i = 0; i < detailFiles.length; i += 1) {
          status.textContent = `추가 이미지 업로드 중 ${i + 1} / ${detailFiles.length}`;
          images.push(await uploadImage(detailFiles[i], id, "detail", i + 1));
        }
        status.textContent = "공개 반영 중…";
        const [publishedFile, draftFile] = await Promise.all([
          readManaged("groupbuy-data.json", true),
          readManaged("groupbuy-draft.json", true),
        ]);
        const now = window.GongbangTime?.nowIso?.() || new Date().toISOString();
        const item = {
          id,
          title: form.elements.title.value.trim(),
          content: form.elements.content.value.trim(),
          cover,
          image: cover,
          images,
          startDate,
          endDate,
          publishedAt: now,
          updatedAt: now,
        };
        const baseItems = publishedFile?.value?.items || [];
        const published = {
          version: 1,
          publishedAt: now,
          items: [item, ...baseItems.filter((e) => e.id !== id)],
        };
        const draftItems = draftFile?.value?.items || baseItems;
        const draft = {
          version: 1,
          items: [item, ...draftItems.filter((e) => e.id !== id)],
        };
        await putManaged(
          "groupbuy-draft.json",
          textToBase64(JSON.stringify(draft)),
          `groupbuy draft: create ${id}`,
          draftFile?.sha || ""
        );
        await putManaged(
          "groupbuy-data.json",
          textToBase64(JSON.stringify(published)),
          `groupbuy: publish ${id}`,
          publishedFile?.sha || ""
        );
        status.textContent = "등록되었습니다.";
        form.reset();
        rangeState.start = "";
        rangeState.end = "";
        dlg.close();
        if (typeof dlg._onSaved === "function") dlg._onSaved(published.items.map(normalizeItem));
      } catch (err) {
        status.textContent = err.message || String(err);
      } finally {
        submit.disabled = false;
      }
    });

    dlg._open = () => {
      const t = kstParts();
      rangeState.year = t.year;
      rangeState.month = t.month;
      rangeState.start = "";
      rangeState.end = "";
      status.textContent = "";
      form.reset();
      renderRangeGrid();
      if (!dlg.open) dlg.showModal();
    };

    return dlg;
  }

  function mount(host, options = {}) {
    if (!host) return null;
    ensureFonts();
    const state = {
      year: kstParts().year,
      month: kstParts().month,
      items: [],
      admin: null,
      status: "불러오는 중…",
    };

    host.classList.add("gb-cal");
    host.setAttribute("aria-label", "공동구매 달력");
    host.innerHTML =
      `<div class="gb-cal__head">` +
      `<div class="gb-cal__title-wrap">` +
      `<p class="gb-cal__eyebrow">공동구매</p>` +
      `<h2 class="gb-cal__title"><span data-ym></span></h2>` +
      `</div>` +
      `<div class="gb-cal__tools">` +
      `<div class="gb-cal__nav">` +
      `<button type="button" data-nav="-1" aria-label="이전 달">◀</button>` +
      `<button type="button" data-nav="1" aria-label="다음 달">▶</button>` +
      `</div>` +
      `<button type="button" class="gb-cal__write" data-write hidden>글쓰기</button>` +
      `</div></div>` +
      `<div class="gb-cal__rule"></div>` +
      `<div class="gb-cal__week">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div>` +
      `<div class="gb-cal__grid-wrap">` +
      `<div class="gb-cal__grid" data-grid></div>` +
      `<div class="gb-cal__bars" data-bars aria-hidden="true"></div>` +
      `<div class="gb-cal__covers" data-covers aria-hidden="true"></div>` +
      `<div class="gb-cal__names" data-names aria-hidden="true"></div>` +
      `</div>`;

    const gridEl = host.querySelector("[data-grid]");
    const barsEl = host.querySelector("[data-bars]");
    const coversEl = host.querySelector("[data-covers]");
    const namesEl = host.querySelector("[data-names]");
    const gridWrap = host.querySelector(".gb-cal__grid-wrap");
    const ymEl = host.querySelector("[data-ym]");
    const writeBtn = host.querySelector("[data-write]");

    function setStatus(msg) {
      state.status = msg || "";
    }

    function render() {
      ymEl.textContent = `${state.year}.${pad2(state.month)}`;
      const cells = buildMonthCells(state.year, state.month);
      const today = todayKey();
      const colorMap = colorsForMonth(state.items, state.year, state.month);
      const eventDays = new Set();
      state.items.forEach((it) => {
        eachDateKey(it.startDate, it.endDate).forEach((k) => eventDays.add(k));
      });
      gridEl.replaceChildren();
      cells.forEach((cell) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "gb-cal__day";
        if (cell.out) btn.classList.add("is-out");
        if (cell.sun) btn.classList.add("is-sun");
        if (cell.key === today) btn.classList.add("is-today");
        if (!cell.out && eventDays.has(cell.key)) btn.classList.add("has-event");
        btn.innerHTML = `<span class="gb-cal__num">${cell.day}</span>`;
        btn.addEventListener("click", () => {
          if (cell.out) return;
          openDayPicker(state.items, cell.key);
        });
        gridEl.append(btn);
      });

      barsEl.replaceChildren();
      coversEl.replaceChildren();
      namesEl.replaceChildren();
      requestAnimationFrame(() => {
        const gridRect = gridEl.getBoundingClientRect();
        const dayBtns = [...gridEl.children];
        if (!dayBtns.length) return;
        const barH =
          Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-bar-h")) || 20;
        const nameH =
          Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-name-h")) || 11;
        const thumbSize =
          Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-thumb")) || 36;
        const stackGap =
          Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-stack-gap")) || 3;
        const indexOf = new Map(cells.map((c, i) => [c.key, i]));
        const segs = labelSegments(state.items, cells);
        const filledDays = new Set();
        if (gridWrap) gridWrap.classList.toggle("has-events", segs.length > 0);

        const barTopByStart = new Map();
        const coverLane = new Map();

        // 1) Capsule bars on date numbers + product name directly below.
        segs.forEach((seg) => {
          const startBtn = dayBtns[seg.startIdx];
          const endBtn = dayBtns[seg.endIdx];
          if (!startBtn || !endBtn) return;
          const sr = startBtn.getBoundingClientRect();
          const er = endBtn.getBoundingClientRect();
          const numEl = startBtn.querySelector(".gb-cal__num");
          const numRect = numEl ? numEl.getBoundingClientRect() : sr;
          const color = colorMap.get(eventKey(seg.item)) || EVENT_COLORS[0];
          const bar = document.createElement("div");
          bar.className = "gb-cal__bar";
          if (seg.roundLeft) bar.classList.add("is-round-left");
          if (seg.roundRight) bar.classList.add("is-round-right");
          if (seg.roundLeft && seg.roundRight) bar.classList.add("is-solo");
          bar.style.background = color.bg;
          const padX = 1;
          const left = sr.left - gridRect.left + padX;
          const width = er.right - sr.left - padX * 2;
          const top =
            numRect.top -
            gridRect.top +
            (numRect.height - barH) / 2 +
            seg.lane * (barH + nameH + stackGap + 4);
          bar.style.left = `${Math.max(0, left)}px`;
          bar.style.width = `${Math.max(barH, width)}px`;
          bar.style.top = `${Math.max(0, top)}px`;
          bar.style.height = `${barH}px`;
          barsEl.append(bar);

          for (let i = seg.startIdx; i <= seg.endIdx; i += 1) {
            filledDays.add(i);
          }

          if (seg.roundLeft) {
            barTopByStart.set(seg.item.startDate, { top, left, width, barH });
          }

          if (!seg.roundLeft) return;
          const name = document.createElement("div");
          name.className = "gb-cal__name";
          name.textContent = seg.label;
          name.style.color = color.name || color.bg;
          name.style.left = `${Math.max(0, left)}px`;
          name.style.width = `${Math.max(32, width)}px`;
          name.style.top = `${top + barH + stackGap}px`;
          name.style.height = `${nameH}px`;
          namesEl.append(name);
        });

        filledDays.forEach((i) => {
          const num = dayBtns[i] && dayBtns[i].querySelector(".gb-cal__num");
          if (num) num.classList.add("is-filled");
        });

        // 2) Small circle cover left of start date — must not shift the date grid.
        state.items.forEach((it) => {
          if (!it.cover) return;
          const idx = indexOf.get(it.startDate);
          if (idx == null) return;
          const dayBtn = dayBtns[idx];
          const cell = cells[idx];
          if (!dayBtn || !cell || cell.out) return;
          const stack = coverLane.get(it.startDate) || 0;
          coverLane.set(it.startDate, stack + 1);
          const br = dayBtn.getBoundingClientRect();
          const anchor = barTopByStart.get(it.startDate);
          const barTop =
            anchor?.top ??
            (() => {
              const numEl = dayBtn.querySelector(".gb-cal__num");
              const numRect = numEl ? numEl.getBoundingClientRect() : br;
              return numRect.top - gridRect.top + (numRect.height - barH) / 2;
            })();
          const size = Math.min(thumbSize, 38);
          const prevBtn = dayBtns[idx - 1];
          const cellLeft = br.left - gridRect.left;
          let coverX = cellLeft - size * 0.08;
          if (prevBtn && Math.floor(idx / 7) === Math.floor((idx - 1) / 7)) {
            const pr = prevBtn.getBoundingClientRect();
            const gutterMid = (pr.right + br.left) / 2 - gridRect.left;
            coverX = Math.min(cellLeft - size * 0.06, gutterMid);
          } else {
            coverX = cellLeft - size * 0.22;
          }
          coverX -= stack * 6;
          const cover = document.createElement("div");
          cover.className = "gb-cal__cover";
          const img = document.createElement("img");
          img.src = assetUrl(it.cover);
          img.alt = it.title || "";
          img.loading = "lazy";
          cover.append(img);
          const top = barTop + (barH - size) / 2 + stack * 6;
          cover.style.left = `${coverX}px`;
          cover.style.top = `${Math.max(0, top)}px`;
          cover.style.width = `${size}px`;
          cover.style.height = `${size}px`;
          coversEl.append(cover);
        });
      });
    }

    host.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = addMonths(state.year, state.month, Number(btn.dataset.nav));
        state.year = next.year;
        state.month = next.month;
        render();
      });
    });

    writeBtn.addEventListener("click", () => {
      if (!state.admin) return;
      const dlg = createWriterDialog((items) => {
        state.items = items;
        setStatus(`공동구매 ${state.items.length}건`);
        render();
      });
      dlg._open();
    });

    async function refresh() {
      setStatus("불러오는 중…");
      try {
        state.items = (await fetchPublicItems()).map(normalizeItem);
        setStatus(state.items.length ? `공동구매 ${state.items.length}건` : "등록된 공동구매가 없습니다.");
        render();
      } catch (err) {
        setStatus(err.message || "불러오기 실패");
        render();
      }
    }

    detectAdmin().then((admin) => {
      state.admin = admin;
      writeBtn.hidden = !admin;
    });

    if (options.year && options.month) {
      state.year = options.year;
      state.month = options.month;
    }

    refresh();
    window.addEventListener("resize", () => render());

    return {
      refresh,
      destroy() {
        closeSheet();
        host.replaceChildren();
      },
    };
  }

  window.GroupbuyCalendar = {
    mount,
    refreshAll() {
      document.querySelectorAll("[data-gb-cal-root]").forEach((el) => {
        if (el._gbCal) el._gbCal.refresh();
      });
    },
  };
})();
