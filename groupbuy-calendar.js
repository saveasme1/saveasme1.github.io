(() => {
  "use strict";

  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(
    /\/$/,
    ""
  );
  const LIVE_API = `${API}/boards/groupbuy/live`;
  const PAGES_ASSET_ORIGIN = "https://saveasme1.github.io";
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
    const [res, liveRes] = await Promise.all([
      fetch(url.href, { cache: "no-store", credentials: "omit" }),
      fetch(`${LIVE_API}?v=${Date.now()}`, { cache: "no-store", credentials: "omit" }).catch(() => null),
    ]);
    if (!res.ok) throw new Error(`공동구매 데이터를 불러오지 못했습니다 (${res.status})`);
    const data = await res.json();
    let liveItems = [];
    if (liveRes && liveRes.ok) {
      try {
        const livePayload = await liveRes.json();
        liveItems = Array.isArray(livePayload?.items) ? livePayload.items : [];
      } catch (_) {
        liveItems = [];
      }
    }
    const map = new Map();
    (Array.isArray(data.items) ? data.items : []).forEach((item) => {
      if (item?.id) map.set(String(item.id), item);
    });
    liveItems.forEach((item) => {
      if (item?.id) map.set(String(item.id), item);
    });
    return [...map.values()];
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
    const isVideo = window.GongbangBoardMedia?.isVideoFile?.(file);
    if (isVideo) {
      if (file.size > 50 * 1024 * 1024) throw new Error("동영상은 50MB 이하여야 합니다.");
    } else if (file.size > 8 * 1024 * 1024) {
      throw new Error(`${file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
    }
    const ext = isVideo
      ? ({ "video/webm": "webm", "video/quicktime": "mov" }[file.type] || "mp4")
      : ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type] || "jpg");
    const suffix = index ? `-${index}` : "";
    const path = `groupbuy/uploads/${id}/${role}${suffix}-${Date.now()}.${ext}`;
    const content = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    await putManaged(path, content, `groupbuy: upload ${id} ${role}${suffix}`);
    return path;
  }

  async function detectAdmin() {
    try {
      const cached = window.GongbangAuth?.getMember?.() || window.getGongbangMember?.();
      if (cached && cached.role === "admin") return cached;
    } catch (_) {}
    try {
      if (window.GongbangAuth?.fetchMe) {
        const payload = await window.GongbangAuth.fetchMe();
        const user = payload?.member || payload?.user || null;
        if (user && user.role === "admin") return user;
      }
    } catch (_) {}
    try {
      const me = await api("/auth/me");
      const user = me.user || me.member || me;
      if (user && user.role === "admin") return user;
    } catch (_) {}
    return null;
  }

  function hasAuthToken() {
    try {
      return Boolean(sessionStorage.getItem(TOKEN_KEY));
    } catch (_) {
      return false;
    }
  }

  const runtime = {
    admin: null,
    onSaved: null,
  };

  function normalizeItem(item) {
    const start = String(item.startDate || item.start || "").slice(0, 10);
    const end = String(item.endDate || item.end || start).slice(0, 10);
    return {
      ...item,
      startDate: start,
      endDate: end || start,
      cover: item.cover || item.image || "",
      images: Array.isArray(item.images) ? item.images : [],
      title: String(item.title || "").trim() || "일정",
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

  const KAKAO_URL =
    (window.GongbangBoardMeta && window.GongbangBoardMeta.KAKAO_URL) ||
    "http://qr.kakao.com/talk/rOLSrSFZxCmHy7mWrkgwuNMH49w-";

  // Soft pastel capsule palette — readable on light paper calendar.
  const EVENT_COLORS = [
    { bg: "#B7C9DE", ink: "#243652", name: "#3d5570" },
    { bg: "#E0B8C4", ink: "#5a3040", name: "#7a4858" },
    { bg: "#B5D2C7", ink: "#2a4a42", name: "#3f6a5e" },
    { bg: "#E2D2B0", ink: "#5a4a28", name: "#7a6640" },
    { bg: "#C9BDD8", ink: "#3f3458", name: "#5a4c78" },
    { bg: "#BCD4B4", ink: "#2f4a30", name: "#4a6a48" },
    { bg: "#E0C4B4", ink: "#5a3c30", name: "#7a5848" },
    { bg: "#B4CCD6", ink: "#2a4554", name: "#3f6270" },
  ];

  function coverBox(coverEl) {
    const left = Number.parseFloat(coverEl.style.left) || 0;
    const top = Number.parseFloat(coverEl.style.top) || 0;
    const size = Number.parseFloat(coverEl.style.width) || 0;
    return {
      left: left - size / 2,
      right: left + size / 2,
      top,
      bottom: top + size,
    };
  }

  function nameRect(nameEl) {
    const left = Number.parseFloat(nameEl.style.left) || 0;
    const top = Number.parseFloat(nameEl.style.top) || 0;
    const width = Number.parseFloat(nameEl.style.width) || 0;
    const height = Number.parseFloat(nameEl.style.height) || 0;
    const pad = Number.parseFloat(nameEl.style.paddingLeft) || 0;
    return {
      left: left + pad,
      right: left + width,
      top,
      bottom: top + height,
      rawLeft: left,
      width,
      pad,
    };
  }

  function boxesOverlap(a, b, margin = 2) {
    return !(
      a.right + margin < b.left ||
      a.left - margin > b.right ||
      a.bottom + margin < b.top ||
      a.top - margin > b.bottom
    );
  }

  function nameHitsForeignCover(nameEl, covers, ownKey) {
    const box = nameRect(nameEl);
    return covers.some((coverEl) => {
      if ((coverEl.dataset.eventKey || "") === ownKey) return false;
      return boxesOverlap(box, coverBox(coverEl));
    });
  }

  function applyNameBase(nameEl) {
    nameEl.style.left = nameEl.dataset.baseLeft || "0";
    nameEl.style.top = nameEl.dataset.baseTop || "0";
    nameEl.style.width = nameEl.dataset.baseWidth || "0";
    nameEl.style.paddingLeft = nameEl.dataset.basePad || "0";
    nameEl.style.textAlign = nameEl.dataset.baseAlign || "center";
    nameEl.classList.remove("is-relocated");
  }

  function resolveCoverNameCollisions(namesEl, coversEl, host) {
    const names = [...namesEl.children];
    const covers = [...coversEl.children];
    if (!names.length) return;

    const nameH =
      Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-name-h")) || 10;
    const stackGap =
      Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-stack-gap")) || 2;
    const laneStep = nameH + stackGap + 4;
    const maxW = namesEl.getBoundingClientRect().width || 9999;

    names.forEach((nameEl) => {
      const ownKey = nameEl.dataset.eventKey || "";
      applyNameBase(nameEl);
      if (!nameHitsForeignCover(nameEl, covers, ownKey)) return;

      const baseLeft = Number.parseFloat(nameEl.dataset.baseLeft) || 0;
      const baseTop = Number.parseFloat(nameEl.dataset.baseTop) || 0;
      const baseWidth = Number.parseFloat(nameEl.dataset.baseWidth) || 0;
      const slotW = Math.min(baseWidth, Math.max(72, baseWidth * 0.42));
      const endLeft = Math.max(0, baseLeft + baseWidth - slotW);

      const trySlot = (left, top, width, align, pad = "0") => {
        nameEl.style.left = `${left}px`;
        nameEl.style.top = `${top}px`;
        nameEl.style.width = `${width}px`;
        nameEl.style.paddingLeft = pad;
        nameEl.style.textAlign = align;
        return !nameHitsForeignCover(nameEl, covers, ownKey);
      };

      // 1) Bar end (right side)
      if (trySlot(endLeft, baseTop, slotW, "right")) {
        nameEl.classList.add("is-relocated");
        return;
      }

      // 2) One row lower, original alignment
      if (
        trySlot(
          baseLeft,
          baseTop + laneStep,
          baseWidth,
          nameEl.dataset.baseAlign || "center",
          nameEl.dataset.basePad || "0"
        )
      ) {
        nameEl.classList.add("is-relocated");
        return;
      }

      // 3) One row lower + bar end
      if (trySlot(endLeft, baseTop + laneStep, slotW, "right")) {
        nameEl.classList.add("is-relocated");
        return;
      }

      // 4) Skip past blocking covers on the same row
      let shiftLeft = baseLeft;
      covers.forEach((coverEl) => {
        if ((coverEl.dataset.eventKey || "") === ownKey) return;
        const cover = coverBox(coverEl);
        applyNameBase(nameEl);
        if (!boxesOverlap(nameRect(nameEl), cover)) return;
        shiftLeft = Math.max(shiftLeft, cover.right + 5);
      });
      const shiftedW = Math.max(40, baseLeft + baseWidth - shiftLeft);
      if (trySlot(Math.min(shiftLeft, maxW - 40), baseTop, shiftedW, "left")) {
        nameEl.classList.add("is-relocated");
        return;
      }

      // 5) Skip past covers, lower row
      if (trySlot(Math.min(shiftLeft, maxW - 40), baseTop + laneStep, shiftedW, "left")) {
        nameEl.classList.add("is-relocated");
      }
    });
  }

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
    root.innerHTML = `<div class="gb-cal-sheet__card" role="dialog" aria-modal="true" aria-label="일정 상세"></div>`;
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

  async function openDetail(item) {
    if (!runtime.admin && hasAuthToken()) {
      runtime.admin = await detectAdmin();
    }
    const root = createSheet();
    const card = root.querySelector(".gb-cal-sheet__card");
    const images = [item.cover, ...(item.images || [])].filter(Boolean);
    const uniq = [...new Set(images.map(String))];
    let active = 0;
    const isAdmin = Boolean(runtime.admin);
    const multi = uniq.length > 1;

    const setActive = (next) => {
      if (!uniq.length) return;
      active = ((next % uniq.length) + uniq.length) % uniq.length;
      paint();
    };

    const paint = () => {
      const hero = uniq[active] || "";
      card.className = "gb-cal-sheet__card board-detail";
      card.innerHTML =
        `<button type="button" class="gb-cal-sheet__close board-close" aria-label="닫기">×</button>` +
        `<div class="gb-cal-sheet__scroll board-detail-body">` +
        `<div class="gb-cal-sheet__hero detail-images${multi ? " has-nav" : ""}" data-hero>` +
        (multi
          ? `<button type="button" class="gb-cal-sheet__nav prev" data-prev aria-label="이전 이미지">‹</button>`
          : "") +
        `<div class="gb-cal-sheet__hero-frame">` +
        (hero
          ? (window.GongbangBoardMedia?.isVideoUrl?.(hero)
              ? `<video class="board-carousel-video" src="${assetUrl(hero)}" muted playsinline loop autoplay></video>`
              : `<img src="${assetUrl(hero)}" alt="">`)
          : "") +
        `</div>` +
        (multi
          ? `<button type="button" class="gb-cal-sheet__nav next" data-next aria-label="다음 이미지">›</button>`
          : "") +
        (multi
          ? `<span class="gb-cal-sheet__counter">${active + 1} / ${uniq.length}</span>`
          : "") +
        `</div>` +
        (multi
          ? `<div class="gb-cal-sheet__rail">${uniq
              .map(
                (src, i) =>
                  `<button type="button" class="${i === active ? "is-on" : ""}" data-i="${i}">` +
                  (window.GongbangBoardMedia?.isVideoUrl?.(src)
                    ? `<span class="pf-writer-video-badge">VIDEO</span>`
                    : `<img src="${assetUrl(src)}" alt="">`) +
                  `</button>`
              )
              .join("")}</div>`
          : "") +
        `<div class="gb-cal-sheet__body detail-copy">` +
        `<div class="detail-meta-row post-meta-row gb-cal-sheet__meta">` +
        `<span class="gb-cal-sheet__badge">${formatRangeLabel(item.startDate, item.endDate)}</span>` +
        `</div>` +
        `<h2></h2>` +
        `<div class="html-content gb-cal-sheet__content"><p></p></div>` +
        `<div class="detail-actions" ${isAdmin ? "" : "hidden"}>` +
        (isAdmin
          ? `<button type="button" class="detail-action" data-edit>수정</button>` +
            `<button type="button" class="detail-action danger" data-delete>삭제</button>`
          : "") +
        `</div>` +
        `</div>` +
        `</div>` +
        `<div class="gb-cal-sheet__foot">` +
        `<button type="button" class="post-meta-share gb-cal-sheet__share" data-share aria-label="공유하기" title="공유하기"></button>` +
        `<a class="gb-cal-sheet__join" href="${KAKAO_URL}" target="_blank" rel="noopener noreferrer">공동구매 참여하기</a>` +
        `</div>`;
      card.querySelector("h2").textContent = item.title;
      card.querySelector(".gb-cal-sheet__content p").textContent = item.content || "";
      const shareBtn = card.querySelector("[data-share]");
      if (shareBtn && window.GongbangBoardMeta?.createShareButton) {
        const built = window.GongbangBoardMeta.createShareButton({
          board: "groupbuy",
          itemId: item.id,
          shareTitle: item.title || "",
        });
        shareBtn.replaceWith(built);
        built.classList.add("gb-cal-sheet__share");
      } else if (shareBtn) {
        shareBtn.textContent = "공유하기";
        shareBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const url = `${location.origin}/groupbuy.html?id=${encodeURIComponent(item.id || "")}`;
          try {
            if (navigator.share) await navigator.share({ title: item.title || "", url });
            else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
          } catch (_) {}
        });
      }      const heroFrame = card.querySelector(".gb-cal-sheet__hero-frame");
      if (heroFrame && hero && window.GongbangBoardMedia?.isVideoUrl?.(hero)) {
        const poster =
          item.coverPoster && String(hero) === String(item.cover || "")
            ? assetUrl(item.coverPoster)
            : "";
        heroFrame.replaceChildren(
          window.GongbangBoardMedia.createSlideMedia(assetUrl(hero), {
            eager: true,
            poster,
          })
        );
        const video = heroFrame.querySelector("video");
        if (video) {
          video.muted = true;
          const play = video.play();
          if (play && typeof play.catch === "function") play.catch(() => {});
        }
      }
      card.querySelector(".gb-cal-sheet__close")?.addEventListener("click", closeSheet);
      card.querySelector("[data-prev]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        setActive(active - 1);
      });
      card.querySelector("[data-next]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        setActive(active + 1);
      });
      card.querySelectorAll(".gb-cal-sheet__rail button").forEach((btn) => {
        btn.addEventListener("click", () => {
          setActive(Number(btn.dataset.i) || 0);
        });
      });
      const heroEl = card.querySelector("[data-hero]");
      if (heroEl && multi) {
        let startX = 0;
        let startY = 0;
        let tracking = false;
        heroEl.addEventListener(
          "touchstart",
          (e) => {
            const t = e.changedTouches[0];
            if (!t) return;
            startX = t.clientX;
            startY = t.clientY;
            tracking = true;
          },
          { passive: true }
        );
        heroEl.addEventListener(
          "touchend",
          (e) => {
            if (!tracking) return;
            tracking = false;
            const t = e.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy)) return;
            setActive(dx < 0 ? active + 1 : active - 1);
          },
          { passive: true }
        );
        let pointerX = 0;
        let dragging = false;
        heroEl.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "touch") return;
          if (e.target.closest("button, .board-video-bar, .board-video-seek")) return;
          dragging = true;
          pointerX = e.clientX;
          heroEl.setPointerCapture?.(e.pointerId);
        });
        heroEl.addEventListener("pointerup", (e) => {
          if (!dragging) return;
          dragging = false;
          const dx = e.clientX - pointerX;
          if (Math.abs(dx) < 48) return;
          setActive(dx < 0 ? active + 1 : active - 1);
        });
      }
      card.querySelector("[data-edit]")?.addEventListener("click", () => {
        closeSheet();
        const dlg = createWriterDialog(runtime.onSaved);
        dlg._openEdit(item);
      });
      card.querySelector("[data-delete]")?.addEventListener("click", async () => {
        if (!confirm(`“${item.title}” 공동구매를 삭제할까요?`)) return;
        const btn = card.querySelector("[data-delete]");
        if (btn) btn.disabled = true;
        try {
          const items = await deleteGroupbuyItem(item.id);
          closeSheet();
          if (typeof runtime.onSaved === "function") runtime.onSaved(items);
        } catch (err) {
          alert(err.message || String(err));
          if (btn) btn.disabled = false;
        }
      });
    };
    paint();
    root.hidden = false;
    // #region agent log
    requestAnimationFrame(() => {
      const card = root.querySelector(".gb-cal-sheet__card");
      const r = card ? card.getBoundingClientRect() : null;
      const cs = card ? getComputedStyle(card) : null;
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'ui-layout',hypothesisId:'H2',location:'groupbuy-calendar.js:openDetail',message:'detail sheet computed size',data:{vw:window.innerWidth,vh:window.innerHeight,rectW:r?Math.round(r.width):null,rectH:r?Math.round(r.height):null,cssWidth:cs?cs.width:null,cssMaxWidth:cs?cs.maxWidth:null,cls:card?card.className:null},timestamp:Date.now()})}).catch(()=>{});
    });
    // #endregion
  }

  async function deleteGroupbuyItem(id) {
    if (!id) return;
    await api(`/admin/boards/groupbuy/${encodeURIComponent(id)}`, { method: "DELETE" });
    return fetchPublicItems().then((items) => items.map(normalizeItem));
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
      `<div class="gb-cal-sheet__body"><h3>이 날의 일정</h3></div>` +
      `<div class="gb-cal-sheet__list"></div>`;
    card.querySelector(".gb-cal-sheet__close")?.addEventListener("click", closeSheet);
    const list = card.querySelector(".gb-cal-sheet__list");
    hits.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gb-cal-sheet__item";
      btn.innerHTML =
        (it.coverPoster || it.cover ? `<img src="${assetUrl(it.coverPoster || it.cover)}" alt="">` : "<span></span>") +
        `<span><strong></strong><span></span></span>`;
      btn.querySelector("strong").textContent = it.title;
      btn.querySelector("span > span").textContent = formatRangeLabel(it.startDate, it.endDate);
      btn.addEventListener("click", () => openDetail(it));
      list.append(btn);
    });
    root.hidden = false;
  }

  function createWriterDialog(onSaved) {
    if (typeof onSaved === "function") runtime.onSaved = onSaved;
    let dlg = document.getElementById("gbCalWriter");
    if (dlg && (!dlg.querySelector(".pf-writer-fields") || !dlg.querySelector(".pf-writer-gb-range") || !dlg.querySelector(".pf-writer-title"))) {
      dlg.remove();
      dlg = null;
    }
    if (dlg) {
      dlg._onSaved = runtime.onSaved;
      return dlg;
    }
    dlg = document.createElement("dialog");
    dlg.id = "gbCalWriter";
    dlg.className = "gb-cal-writer review-dialog write-dialog gb-write-dialog pf-write-dialog";
    dlg.innerHTML =
      `<form id="gbCalWriterForm">` +
      `<h2 data-writer-title>공동구매 작성</h2>` +
      `<div class="pf-writer-fields">` +
      `<div class="gb-cal-range pf-writer-gb-range" id="gbCalRange">` +
      `<span class="pf-writer-label">공동구매 기간</span>` +
      `<p class="gb-cal-range__hint">시작일을 탭한 뒤 종료일을 탭하세요. 같은 날이면 하루 일정입니다.</p>` +
      `<div class="gb-cal-range__meta"><b data-start>—</b><b data-end>—</b></div>` +
      `<div class="gb-cal-range__nav">` +
      `<button type="button" data-rm="-1">‹</button>` +
      `<strong data-rm-label></strong>` +
      `<button type="button" data-rm="1">›</button>` +
      `</div>` +
      `<div class="gb-cal-range__week">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div>` +
      `<div class="gb-cal-range__grid" id="gbCalRangeGrid"></div>` +
      `</div>` +
      `<label class="pf-writer-title">제목<input name="title" type="text" minlength="2" maxlength="160" required placeholder="제목을 입력해 주세요"></label>` +
      `<label class="pf-writer-content">내용<textarea name="content" minlength="2" maxlength="20000" required placeholder="내용을 입력해 주세요"></textarea></label>` +
      `</div>` +
      `<section class="pf-writer-images" aria-label="이미지">` +
      `<div class="pf-writer-block pf-writer-cover-block">` +
      `<div class="pf-writer-heading"><strong>대표 이미지</strong><span>목록에 가장 먼저 보이는 이미지</span></div>` +
      `<div class="pf-writer-cover-row">` +
      `<div class="pf-writer-cover is-empty" id="gbCalWriterGallery" data-gallery>대표 이미지 없음</div>` +
      `<label class="pf-writer-file" data-cover-label>대표 이미지 선택<input name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.gif"></label>` +
      `</div>` +
      `</div>` +
      `<div class="pf-writer-block pf-writer-detail-block">` +
      `<div class="pf-writer-heading"><strong>추가 이미지</strong><span>클릭하여 이미지 추가</span></div>` +
      `<label class="pf-writer-file compact">클릭하여 사진 추가<input name="images" type="file" accept="image/jpeg,image/png,image/webp,image/gif,.gif" multiple></label>` +
      `<div class="pf-writer-grid" id="gbCalWriterDetailGrid"></div>` +
      `</div>` +
      `</section>` +
      `<div class="pf-writer-footer">` +
      `<p class="review-image-help">대표 이미지를 올려 주세요.</p>` +
      `<p class="review-dialog-status" id="gbCalWriterStatus" aria-live="polite"></p>` +
      `<div class="review-dialog-actions">` +
      `<button type="button" id="gbCalWriterCancel">취소</button>` +
      `<button type="submit" class="primary" id="gbCalWriterSubmit">등록하기</button>` +
      `</div>` +
      `</div>` +
      `</form>`;
    document.body.appendChild(dlg);
    dlg._onSaved = runtime.onSaved;

    // #region agent log
    fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'ui-layout',hypothesisId:'H4',location:'groupbuy-calendar.js:createWriterDialog',message:'writer shell created',data:{hasPf:Boolean(dlg.querySelector('.pf-writer-fields')),hasRange:Boolean(dlg.querySelector('#gbCalRange')),cls:dlg.className},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const form = dlg.querySelector("form");
    const status = dlg.querySelector("#gbCalWriterStatus");
    const titleEl = dlg.querySelector("[data-writer-title]");
    const coverInput = form.elements.cover;
    const coverLabel = dlg.querySelector("[data-cover-label]");
    const submitBtn = dlg.querySelector("#gbCalWriterSubmit");
    const gallery = dlg.querySelector("#gbCalWriterGallery");
    const detailGrid = dlg.querySelector("#gbCalWriterDetailGrid");
    const rangeState = {
      year: kstParts().year,
      month: kstParts().month,
      start: "",
      end: "",
    };
    const mediaState = {
      id: null,
      cover: { path: "", file: null, preview: "" },
      details: [],
      publishedAt: "",
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

    function clearCoverPreview() {
      if (mediaState.cover.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaState.cover.preview);
      }
      mediaState.cover = { path: mediaState.cover.path || "", file: null, preview: "" };
    }

    function clearDetails(keepPaths = false) {
      mediaState.details.forEach((detail) => {
        if (detail.preview?.startsWith("blob:")) URL.revokeObjectURL(detail.preview);
      });
      if (keepPaths) {
        mediaState.details = mediaState.details
          .filter((d) => d.path)
          .map((d) => ({ path: d.path, file: null, preview: "" }));
      } else {
        mediaState.details = [];
      }
    }

    function renderGallery() {
      const coverUrl =
        mediaState.cover.displayPreview ||
        mediaState.cover.posterPreview ||
        mediaState.cover.preview ||
        (mediaState.cover.path ? assetUrl(mediaState.cover.path) : "");
      const coverKind =
        mediaState.cover.kind ||
        (mediaState.cover.file && window.GongbangBoardMedia?.isVideoFile?.(mediaState.cover.file)
          ? "video"
          : window.GongbangBoardMedia?.isVideoUrl?.(mediaState.cover.preview || mediaState.cover.path)
            ? "video"
            : "image");
      gallery.replaceChildren();
      gallery.classList.toggle("is-empty", !coverUrl);
      gallery.style.backgroundImage = "";
      if (!coverUrl) {
        gallery.textContent = "대표 이미지 없음";
      } else {
        gallery.textContent = "";
        if (window.GongbangBoardMedia?.paintWriterThumb) {
          window.GongbangBoardMedia.paintWriterThumb(
            gallery,
            coverUrl,
            coverKind,
            mediaState.cover.posterPreview || ""
          );
        } else {
          gallery.style.backgroundImage = `url("${coverUrl}")`;
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "pf-writer-remove";
        remove.setAttribute("aria-label", "대표 이미지 삭제");
        remove.textContent = "×";
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.GongbangBoardMedia?.revokeMediaPreview?.(mediaState.cover);
          mediaState.cover = { path: "", file: null, preview: "" };
          coverInput.required = !mediaState.id;
          coverInput.value = "";
          renderGallery();
        });
        gallery.append(remove);
      }

      detailGrid.replaceChildren();
      if (!mediaState.details.length) {
        detailGrid.replaceChildren();
      } else {
        mediaState.details.forEach((detail, index) => {
          const card = document.createElement("div");
          card.className = "pf-writer-thumb";
          const url = detail.preview || (detail.path ? assetUrl(detail.path) : "");
          const kind =
            detail.kind ||
            (detail.file && window.GongbangBoardMedia?.isVideoFile?.(detail.file)
              ? "video"
              : window.GongbangBoardMedia?.isVideoUrl?.(url)
                ? "video"
                : "image");
          if (window.GongbangBoardMedia?.paintWriterThumb) {
            window.GongbangBoardMedia.paintWriterThumb(
              card,
              detail.displayPreview || detail.posterPreview || url,
              kind,
              detail.posterPreview || ""
            );
          } else {
            card.style.backgroundImage = url ? `url("${detail.posterPreview || url}")` : "";
          }
          const order = document.createElement("span");
          order.className = "pf-writer-order";
          order.textContent = String(index + 1);
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "pf-writer-remove";
          remove.setAttribute("aria-label", `${index + 1}번 미디어 삭제`);
          remove.textContent = "×";
          remove.addEventListener("click", () => {
            const [removed] = mediaState.details.splice(index, 1);
            window.GongbangBoardMedia?.revokeMediaPreview?.(removed);
            renderGallery();
          });
          card.append(order, remove);
          detailGrid.append(card);
        });
      }
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

    coverInput.addEventListener("change", async () => {
      const file = coverInput.files?.[0];
      if (!file) return;
      try {
        if (
          window.GongbangBoardMedia?.isVideoFile?.(file) &&
          !window.GongbangBoardMedia?.videoUploadEnabled?.()
        ) {
          throw new Error("지금은 사진만 올릴 수 있습니다.");
        }
        status.textContent =
          window.GongbangBoardMedia?.isVideoFile?.(file) &&
          window.GongbangBoardMedia?.videoUploadEnabled?.()
            ? "영상 썸네일 추출 중…"
            : "";
        const prepared = window.GongbangBoardMedia?.prepareLocalMedia
          ? await window.GongbangBoardMedia.prepareLocalMedia(file)
          : (() => {
              if (/\.(mp4|webm|mov)$/i.test(file.name || "") || String(file.type || "").startsWith("video/")) {
                throw new Error("지금은 사진만 올릴 수 있습니다.");
              }
              return {
                file,
                kind: "image",
                preview: URL.createObjectURL(file),
                posterFile: null,
                posterPreview: "",
                displayPreview: URL.createObjectURL(file),
              };
            })();
        window.GongbangBoardMedia?.revokeMediaPreview?.(mediaState.cover);
        mediaState.cover = { path: mediaState.cover.path || "", ...prepared };
        coverInput.value = "";
        coverInput.required = false;
        status.textContent = "";
        renderGallery();
      } catch (error) {
        status.textContent = error.message || String(error);
        coverInput.value = "";
      }
    });

    form.elements.images.addEventListener("change", async () => {
      const files = [...(form.elements.images.files || [])];
      for (const file of files) {
        try {
          if (
            window.GongbangBoardMedia?.isVideoFile?.(file) &&
            !window.GongbangBoardMedia?.videoUploadEnabled?.()
          ) {
            throw new Error("지금은 사진만 올릴 수 있습니다.");
          }
          if (
            window.GongbangBoardMedia?.isVideoFile?.(file) &&
            window.GongbangBoardMedia?.videoUploadEnabled?.()
          ) {
            status.textContent = "영상 썸네일 추출 중…";
          }
          const prepared = window.GongbangBoardMedia?.prepareLocalMedia
            ? await window.GongbangBoardMedia.prepareLocalMedia(file)
            : (() => {
                if (/\.(mp4|webm|mov)$/i.test(file.name || "") || String(file.type || "").startsWith("video/")) {
                  throw new Error("지금은 사진만 올릴 수 있습니다.");
                }
                return {
                  file,
                  kind: "image",
                  preview: URL.createObjectURL(file),
                  posterFile: null,
                  posterPreview: "",
                  displayPreview: URL.createObjectURL(file),
                };
              })();
          mediaState.details.push({ path: "", ...prepared });
          status.textContent = "";
        } catch (error) {
          status.textContent = error.message || String(error);
        }
      }
      form.elements.images.value = "";
      renderGallery();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const coverFile = mediaState.cover.file;
      const detailFiles = mediaState.details.filter((d) => d.file).map((d) => d.file);
      const editing = Boolean(mediaState.id);
      if (!coverFile && !mediaState.cover.path) {
        status.textContent = "대표 이미지가 필요합니다.";
        return;
      }
      if (!rangeState.start) {
        status.textContent = "시작일을 선택해 주세요.";
        return;
      }
      const startDate = rangeState.start;
      const endDate = rangeState.end || rangeState.start;
      if (mediaState.details.length > 8) {
        status.textContent = "추가 미디어는 최대 8개까지입니다.";
        return;
      }
      submitBtn.disabled = true;
      try {
        const id = editing
          ? mediaState.id
          : `gb-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const token = sessionStorage.getItem(TOKEN_KEY) || "";
        const mediaApi = window.GongbangBoardMedia;
        const uploadOne = async (file, role, label) => {
          if (!mediaApi?.uploadFiles) throw new Error("미디어 업로더를 불러오지 못했습니다.");
          status.textContent = `${label} 업로드 중…`;
          const uploaded = await mediaApi.uploadFiles(API, token, "groupbuy", id, [file], {
            roles: [role],
            onProgress: (pct) => {
              status.textContent = `${label} 업로드 ${pct}%`;
            },
          });
          const url = uploaded[0]?.url;
          if (!url) throw new Error(`${label} 업로드에 실패했습니다.`);
          return url;
        };
        let cover = mediaState.cover.path;
        let coverPoster = editing ? (mediaState.coverPoster || "") : "";
        if (coverFile) {
          await mediaApi?.assertMediaFile?.(coverFile);
          const isVid = mediaApi?.isVideoFile?.(coverFile);
          cover = await uploadOne(coverFile, "cover", isVid ? "대표 영상" : "대표 이미지");
          if (isVid) {
            status.textContent = "대표 영상 썸네일 업로드 중…";
            const poster =
              mediaState.cover.posterFile || (await mediaApi.captureVideoPoster(coverFile));
            coverPoster = await uploadOne(poster, "coverPoster", "대표 썸네일");
          } else {
            coverPoster = "";
          }
        }
        const images = mediaState.details.filter((d) => d.path).map((d) => d.path);
        for (let i = 0; i < detailFiles.length; i += 1) {
          const file = detailFiles[i];
          await mediaApi?.assertMediaFile?.(file);
          const kind = mediaApi?.isVideoFile?.(file) ? "동영상" : "이미지";
          images.push(await uploadOne(file, "detail", `추가 ${kind} ${i + 1}`));
        }
        status.textContent = "저장 중…";
        const now = window.GongbangTime?.nowIso?.() || new Date().toISOString();
        const item = {
          id,
          title: form.elements.title.value.trim(),
          content: form.elements.content.value.trim(),
          cover: cover || "",
          image: cover || "",
          coverPoster: coverPoster || "",
          images: images.filter((path) => path && path !== cover),
          startDate,
          endDate,
          publishedAt: editing ? mediaState.publishedAt || now : now,
          updatedAt: now,
          origin: "admin",
        };
        const published = await api("/admin/boards/groupbuy/publish", {
          method: "PUT",
          body: JSON.stringify({ item, assets: [] }),
        });
                const saved = published.item || item;
        status.textContent = editing ? "수정되었습니다." : "등록되었습니다.";
        form.reset();
        rangeState.start = "";
        rangeState.end = "";
        mediaState.id = null;
        if (mediaState.cover.preview?.startsWith("blob:")) URL.revokeObjectURL(mediaState.cover.preview);
        mediaState.details.forEach((d) => {
          if (d.preview?.startsWith("blob:")) URL.revokeObjectURL(d.preview);
        });
        mediaState.cover = { path: "", file: null, preview: "" };
        mediaState.details = [];
        mediaState.publishedAt = "";
        dlg.close();
        const cb = dlg._onSaved || runtime.onSaved;
        if (typeof cb === "function") {
          const prev = await fetchPublicItems().catch(() => []);
          const map = new Map(prev.map((e) => [String(e.id), e]));
          map.set(String(saved.id), saved);
          cb([...map.values()].map(normalizeItem));
        }
      } catch (err) {
        status.textContent = err.message || String(err);
      } finally {
        submitBtn.disabled = false;
      }
    });

    function prepareShell(mode) {
      const editing = mode === "edit";
      titleEl.textContent = editing ? "공동구매 수정" : "공동구매 작성";
      submitBtn.textContent = editing ? "수정하기" : "등록하기";
      const labelText = editing ? "대표 이미지 교체" : "대표 이미지 선택";
      [...coverLabel.childNodes].forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          node.textContent = labelText;
        }
      });
      coverInput.required = !editing;
      status.textContent = "";
      form.reset();
    }

    dlg._open = () => {
      prepareShell("create");
      const t = kstParts();
      rangeState.year = t.year;
      rangeState.month = t.month;
      rangeState.start = "";
      rangeState.end = "";
      mediaState.id = null;
      if (mediaState.cover.preview?.startsWith("blob:")) URL.revokeObjectURL(mediaState.cover.preview);
      mediaState.details.forEach((d) => {
        if (d.preview?.startsWith("blob:")) URL.revokeObjectURL(d.preview);
      });
      mediaState.cover = { path: "", file: null, preview: "" };
      mediaState.details = [];
      mediaState.publishedAt = "";
      renderGallery();
      renderRangeGrid();
      window.GongbangBoardMedia?.syncWriterMediaUi?.(dlg);
      if (!dlg.open) dlg.showModal();
      // #region agent log
      requestAnimationFrame(() => {
        const r = dlg.getBoundingClientRect();
        const cs = getComputedStyle(dlg);
        fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'ui-layout',hypothesisId:'H1',location:'groupbuy-calendar.js:_open',message:'writer open computed size',data:{vw:window.innerWidth,vh:window.innerHeight,rectW:Math.round(r.width),rectH:Math.round(r.height),cssWidth:cs.width,cssMaxWidth:cs.maxWidth,cls:dlg.className},timestamp:Date.now()})}).catch(()=>{});
      });
      // #endregion
    };

    dlg._openEdit = (item) => {
      const normalized = normalizeItem(item);
      prepareShell("edit");
      form.elements.title.value = normalized.title;
      form.elements.content.value = normalized.content;
      mediaState.id = normalized.id;
      if (mediaState.cover.preview?.startsWith("blob:")) URL.revokeObjectURL(mediaState.cover.preview);
      mediaState.details.forEach((d) => {
        if (d.preview?.startsWith("blob:")) URL.revokeObjectURL(d.preview);
      });
      mediaState.cover = {
        path: normalized.cover || "",
        file: null,
        preview: "",
      };
      mediaState.details = [...(normalized.images || [])]
        .filter((path) => path && path !== mediaState.cover.path)
        .map((path) => ({ path, file: null, preview: "" }));
      mediaState.publishedAt = normalized.publishedAt || "";
      rangeState.start = normalized.startDate;
      rangeState.end =
        normalized.endDate && normalized.endDate !== normalized.startDate
          ? normalized.endDate
          : "";
      const startParts = parseKey(normalized.startDate) || kstParts();
      rangeState.year = startParts.year;
      rangeState.month = startParts.month;
      coverInput.required = !mediaState.cover.path;
      renderGallery();
      renderRangeGrid();
      window.GongbangBoardMedia?.syncWriterMediaUi?.(dlg);
      if (!dlg.open) dlg.showModal();
      // #region agent log
      requestAnimationFrame(() => {
        const r = dlg.getBoundingClientRect();
        const cs = getComputedStyle(dlg);
        fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'ui-layout',hypothesisId:'H1',location:'groupbuy-calendar.js:_openEdit',message:'writer edit computed size',data:{vw:window.innerWidth,vh:window.innerHeight,rectW:Math.round(r.width),rectH:Math.round(r.height),cssWidth:cs.width,cssMaxWidth:cs.maxWidth,cls:dlg.className},timestamp:Date.now()})}).catch(()=>{});
      });
      // #endregion
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
    host.setAttribute("aria-label", "일정 달력");
    host.innerHTML =
      `<div class="gb-cal__head">` +
      `<div class="gb-cal__title-wrap">` +
      `<h2 class="gb-cal__title"><span data-ym></span></h2>` +
      `</div>` +
      `<div class="gb-cal__tools">` +
      `<div class="gb-cal__nav">` +
      `<button type="button" data-nav="-1" aria-label="이전 달">◀</button>` +
      `<button type="button" data-nav="1" aria-label="다음 달">▶</button>` +
      `</div>` +
      `<button type="button" class="gb-cal__write primary" data-write hidden>글 작성하기</button>` +
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
        const dateGap =
          Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-date-gap")) || 3;
        const eventStack =
          Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-event-stack")) ||
          barH + nameH + stackGap + 2;
        const capPeek =
          Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-cap-peek")) || 10;
        const indexOf = new Map(cells.map((c, i) => [c.key, i]));
        const segs = labelSegments(state.items, cells);
        const filledDays = new Set();
        if (gridWrap) gridWrap.classList.toggle("has-events", segs.length > 0);

        const barTopByStart = new Map();
        const coverLane = new Map();

        // 1) Capsule behind date numbers + product name below.
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
          const cellLeft = sr.left - gridRect.left + padX;
          let left = cellLeft;
          let width = er.right - sr.left - padX * 2;
          let coverSize = 0;
          if (seg.roundLeft && (seg.item.coverPoster || seg.item.cover)) {
            coverSize = Math.min(thumbSize, 48);
            const peek = Math.min(capPeek, 6);
            left = cellLeft - peek;
            width = er.right - gridRect.left - left - padX;
          }
          const laneStep = barH + nameH + stackGap + 4;
          const top =
            numRect.top -
            gridRect.top +
            (numRect.height - barH) / 2 +
            seg.lane * laneStep;
          bar.style.left = `${left}px`;
          bar.style.width = `${Math.max(barH, width)}px`;
          bar.style.top = `${top}px`;
          bar.style.height = `${barH}px`;
          barsEl.append(bar);

          for (let i = seg.startIdx; i <= seg.endIdx; i += 1) {
            filledDays.add(i);
          }

          if (seg.roundLeft) {
            barTopByStart.set(seg.item.startDate, {
              top,
              left,
              width,
              barH,
              coverSize,
              startIdx: seg.startIdx,
            });
          }

          if (!seg.roundLeft) return;
          const name = document.createElement("div");
          name.className = "gb-cal__name";
          name.dataset.eventKey = eventKey(seg.item);
          name.textContent = seg.label;
          name.style.color = color.name || color.bg;
          const nameLeft = Math.max(0, left);
          const nameWidth = Math.max(32, width);
          const nameTop = top + barH + stackGap;
          name.style.left = `${nameLeft}px`;
          name.style.width = `${nameWidth}px`;
          name.style.top = `${nameTop}px`;
          name.style.height = `${nameH}px`;
          name.dataset.baseLeft = String(nameLeft);
          name.dataset.baseTop = String(nameTop);
          name.dataset.baseWidth = String(nameWidth);
          name.dataset.basePad = "0";
          name.dataset.baseAlign = "center";
          if ((seg.item.coverPoster || seg.item.cover) && coverSize) {
            const namePad = Math.min(Math.round(coverSize * 0.45), Math.max(18, width * 0.34));
            name.style.paddingLeft = `${namePad}px`;
            name.style.textAlign = "left";
            name.style.boxSizing = "border-box";
            name.dataset.basePad = String(namePad);
            name.dataset.baseAlign = "left";
          }
          namesEl.append(name);
        });

        filledDays.forEach((i) => {
          const num = dayBtns[i] && dayBtns[i].querySelector(".gb-cal__num");
          if (num) num.classList.add("is-filled");
        });

        // 2) Cover in gutter before start day; kept above name row.
        state.items.forEach((it) => {
          if (!it.cover) return;
          const idx = indexOf.get(it.startDate);
          if (idx == null) return;
          const dayBtn = dayBtns[idx];
          const cell = cells[idx];
          if (!dayBtn || !cell || cell.out) return;
          const stack = coverLane.get(it.startDate) || 0;
          coverLane.set(it.startDate, stack + 1);
          const anchor = barTopByStart.get(it.startDate);
          if (!anchor) return;
          const size = anchor.coverSize || Math.min(thumbSize, 48);
          const barCross =
            Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-bar-cross")) || 0.4;
          const gutterBias =
            Number.parseFloat(getComputedStyle(host).getPropertyValue("--gb-gutter-bias")) || 0.68;
          const br = dayBtn.getBoundingClientRect();
          const prevBtn = dayBtns[idx - 1];
          let coverX;
          if (prevBtn && Math.floor(idx / 7) === Math.floor((idx - 1) / 7)) {
            const pr = prevBtn.getBoundingClientRect();
            const g0 = pr.right - gridRect.left;
            const g1 = br.left - gridRect.left;
            coverX = g0 + (g1 - g0) * gutterBias;
          } else {
            coverX = br.left - gridRect.left - size * 0.12;
          }
          coverX -= stack * 6;
          const half = size / 2;
          const minX = half + 2;
          const maxX = Math.max(minX, gridRect.width - half - 2);
          const clampedX = Math.min(maxX, Math.max(minX, coverX));
          const top = anchor.top - size * (1 - barCross) + stack * 8;
          const cover = document.createElement("div");
          cover.className = "gb-cal__cover";
          cover.dataset.eventKey = eventKey(it);
          const ring = colorMap.get(eventKey(it)) || EVENT_COLORS[0];
          cover.style.setProperty("--gb-cover-ring", ring.bg);
          cover.style.borderColor = ring.bg;
          const img = document.createElement("img");
          img.src = assetUrl(it.coverPoster || it.cover);
          img.alt = "";
          img.loading = "lazy";
          cover.append(img);
          cover.style.left = `${clampedX}px`;
          cover.style.top = `${Math.max(0, top)}px`;
          cover.style.width = `${size}px`;
          cover.style.height = `${size}px`;
          coversEl.append(cover);
          // #region agent log
          if (Math.abs(clampedX - coverX) > 0.5 || clampedX <= minX + 0.5) {
            fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'cal-layout',hypothesisId:'H7',location:'groupbuy-calendar.js:coverClamp',message:'cover position clamped',data:{title:String(it.title||'').slice(0,40),coverX:Math.round(coverX),clampedX:Math.round(clampedX),size:Math.round(size),gridW:Math.round(gridRect.width),vw:window.innerWidth},timestamp:Date.now()})}).catch(()=>{});
          }
          // #endregion
        });

        resolveCoverNameCollisions(namesEl, coversEl, host);
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
      if (!state.admin && !hasAuthToken()) return;
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
        setStatus(
          state.items.length ? `공동구매 ${state.items.length}건` : "등록된 공동구매가 없습니다."
        );
        render();
      } catch (err) {
        setStatus(err.message || "불러오기 실패");
        render();
      }
    }

    function applyAdmin(admin) {
      state.admin = admin;
      runtime.admin = admin;
      writeBtn.hidden = !admin;
    }

    // Show write CTA immediately when a session token exists (confirm via /auth/me).
    if (hasAuthToken()) writeBtn.hidden = false;

    detectAdmin().then((admin) => {
      applyAdmin(admin);
    });

    window.addEventListener("gongbang:auth-changed", (event) => {
      const member = event.detail?.member || event.detail?.user || null;
      if (member && member.role === "admin") applyAdmin(member);
      else if (!hasAuthToken()) applyAdmin(null);
      else detectAdmin().then(applyAdmin);
    });

    runtime.onSaved = (items) => {
      state.items = items;
      setStatus(state.items.length ? `공동구매 ${state.items.length}건` : "등록된 공동구매가 없습니다.");
      render();
    };

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
    openWriter(onSaved) {
      const dlg = createWriterDialog(onSaved);
      dlg._open();
      return dlg;
    },
    refreshAll() {
      document.querySelectorAll("[data-gb-cal-root]").forEach((el) => {
        if (el._gbCal) el._gbCal.refresh();
      });
    },
  };
})();
