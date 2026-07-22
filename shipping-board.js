(() => {
  "use strict";

  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  const DATA_PATH = "shipping-data.json";
  const BOARD = "shipping";
  const PAGE_SIZE = 12;
  const DEFAULT_CATEGORIES = ["C", "B", "VCA", "BO", "CM", "C&H", "CL", "G", "H", "P", "F", "ETC"];
  const HOLIDAY_CACHE_KEY = "heritage.krHolidays.v1";
  const $ = (id) => document.getElementById(id);

  const els = {
    panel: $("shippingPanel"),
    openButton: $("shippingOpen"),
    closeButton: $("shippingClose"),
    cats: $("shipCats"),
    search: $("shippingSearch"),
    status: $("shippingStatus"),
    count: $("shippingCount"),
    grid: $("shippingList"),
    pager: $("shippingPager"),
    write: $("shippingWrite"),
    session: $("shippingSession"),
    cal: $("shipCal"),
    strip: $("shipDateStrip"),
    dialog: $("boardDialog"),
  };

  if (!els.panel || !els.grid) return;

  const state = {
    items: [],
    categories: [...DEFAULT_CATEGORIES],
    category: "ALL",
    page: 1,
    member: null,
    opened: false,
    loaded: false,
    selectedDate: "", // YYYY-MM-DD KST
    holidays: new Set(),
    holidayNames: {},
    anchorDate: null,
  };

  const assetUrl = (value) => {
    const path = String(value || "").trim();
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return `/${path.replace(/^\/+/, "")}`;
  };

  const brandText = (value) => String(value || "")
    .replace(/GONGBANG\s*171/gi, "HERITAGE")
    .replace(/Gongbang\s*171/gi, "Heritage")
    .replace(/공방\s*171/g, "헤리티지");

  function kstParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    return {
      y: Number(parts.year),
      m: Number(parts.month),
      d: Number(parts.day),
      weekday: parts.weekday, // Mon Tue ...
      key: `${parts.year}-${parts.month}-${parts.day}`,
    };
  }

  function dateKeyFromIso(value) {
    if (!value) return "";
    return kstParts(new Date(value)).key;
  }

  function addDaysKey(key, delta) {
    const [y, m, d] = key.split("-").map(Number);
    const utc = Date.UTC(y, m - 1, d) + delta * 86400000;
    return kstParts(new Date(utc)).key;
  }

  function weekdayIndex(key) {
    const [y, m, d] = key.split("-").map(Number);
    // Use noon UTC to avoid DST edge; KST weekday via formatter
    return kstParts(new Date(Date.UTC(y, m - 1, d, 12))).weekday;
  }

  function showToast(message, options = {}) {
    if (typeof window.showGongbangToast === "function") {
      window.showGongbangToast(message, options);
      return;
    }
  }

  function isAdmin() {
    return Boolean(state.member && state.member.role === "admin");
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
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

  function renderSession() {
    if (els.session) els.session.replaceChildren();
    if (els.write) {
      els.write.hidden = !isAdmin();
      els.write.textContent = "글 작성하기";
    }
    const actions = els.write?.closest(".pf-tools-actions");
    if (actions) actions.hidden = !isAdmin();
  }

  function placeShippingTools() {
    const head = els.panel?.querySelector(".pf-rail-head");
    const toolbar = els.panel?.querySelector(".pf-toolbar");
    const search = els.search?.closest("label.pf-search");
    const actions = els.panel?.querySelector(".pf-tools-actions");
    if (!head || !toolbar || !search || !actions) return;
    const mobile = window.matchMedia("(max-width: 1099px)").matches;
    if (mobile) {
      if (search.parentElement !== head) head.append(search);
      if (actions.parentElement !== head) head.append(actions);
      return;
    }
    if (search.parentElement !== toolbar) toolbar.append(search);
    if (actions.parentElement !== toolbar) toolbar.append(actions);
  }

  function filteredItems() {
    const query = (els.search?.value || "").trim().toLowerCase();
    return state.items.filter((item) => {
      if (state.category !== "ALL" && item.category !== state.category) return false;
      if (state.selectedDate && dateKeyFromIso(item.publishedAt) !== state.selectedDate) return false;
      if (!query) return true;
      const hay = `${item.title || ""} ${item.content || ""} ${item.category || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }

  function postsByDateKey() {
    const map = new Map();
    state.items.forEach((item) => {
      if (state.category !== "ALL" && item.category !== state.category) return;
      const key = dateKeyFromIso(item.publishedAt);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }

  function quickScrollToY(top) {
    const start = window.scrollY || window.pageYOffset || 0;
    const end = Math.max(0, top);
    const delta = end - start;
    if (Math.abs(delta) < 4) return;
    const duration = Math.min(420, Math.max(240, Math.abs(delta) * 0.28));
    const t0 = performance.now();
    const easeOutCubic = (t) => 1 - (1 - t) ** 3;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      window.scrollTo(0, start + delta * easeOutCubic(p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function scrollToFirstCard() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const card = els.grid?.querySelector(".pf-card");
        const target = card || els.grid;
        if (!target) return;
        const topBrand = document.querySelector(".gb-top-brand");
        const topH = topBrand
          ? topBrand.getBoundingClientRect().height
          : Number.parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue("--gb-top-h")
            ) || 0;
        const rail = els.panel?.querySelector(".pf-rail");
        const mobile = window.matchMedia("(max-width: 1099px)").matches;
        const railH = mobile && rail ? rail.getBoundingClientRect().height : 0;
        const y = target.getBoundingClientRect().top + window.scrollY - (topH + railH + 10);
        quickScrollToY(y);
      });
    });
  }

  function renderCats() {
    if (!els.cats) return;
    els.cats.replaceChildren();
    ["ALL", ...state.categories].forEach((cat) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pf-cat${state.category === cat ? " is-active" : ""}`;
      button.dataset.cat = cat;
      button.textContent = cat === "ALL" ? "ALL" : cat;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", state.category === cat ? "true" : "false");
      button.addEventListener("click", () => {
        state.category = cat;
        state.page = 1;
        renderCats();
        renderCalendar();
        renderDateStrip();
        renderList();
        scrollToFirstCard();
      });
      els.cats.append(button);
    });
  }

  function renderPager(total) {
    if (!els.pager) return;
    els.pager.replaceChildren();
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const add = (label, page, disabled, active = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      button.classList.toggle("is-active", active);
      button.addEventListener("click", () => {
        state.page = page;
        renderList();
        els.panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      els.pager.append(button);
    };
    add("‹", state.page - 1, state.page <= 1);
    const first = Math.max(1, state.page - 2);
    const last = Math.min(pages, first + 4);
    for (let page = first; page <= last; page += 1) add(String(page), page, false, page === state.page);
    add("›", state.page + 1, state.page >= pages);
  }

  function openDetail(item) {
    if (typeof window.openGongbangBoardDetail === "function") {
      window.openGongbangBoardDetail("shipping", item);
      return;
    }
    location.href = `/admin/shipping/?edit=${encodeURIComponent(item.id)}`;
  }

  function observeCards() {
    if (!els.grid) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.grid.querySelectorAll(".pf-card").forEach((card) => card.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    els.grid.querySelectorAll(".pf-card").forEach((card) => io.observe(card));
  }

  function renderList() {
    const filtered = filteredItems();
    const pageItems = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const query = (els.search?.value || "").trim();
    const label = query || state.category !== "ALL" || state.selectedDate
      ? `${filtered.length.toLocaleString("ko-KR")} posts`
      : `${state.items.length.toLocaleString("ko-KR")} posts`;
    if (els.count) els.count.textContent = label;
    if (els.status) {
      const bits = [];
      if (state.selectedDate) bits.push(state.selectedDate);
      if (state.category !== "ALL") bits.push(state.category);
      if (query) bits.push(`“${query}”`);
      els.status.textContent = bits.length
        ? `필터 ${bits.join(" · ")} · ${filtered.length.toLocaleString("ko-KR")}개`
        : `전체 ${state.items.length.toLocaleString("ko-KR")}개 · 사진을 눌러 상세를 확인하세요`;
    }
    renderPager(filtered.length);
    els.grid.replaceChildren();

    if (!pageItems.length) {
      const empty = document.createElement("p");
      empty.className = "pf-empty";
      empty.textContent = "조건에 맞는 출고 게시글이 없습니다.";
      els.grid.append(empty);
      return;
    }

    pageItems.forEach((item) => {
      const article = document.createElement("article");
      article.className = "pf-card";

      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "pf-thumb";
      thumb.setAttribute("aria-label", `${brandText(item.title)} 상세 보기`);
      if (item.category) {
        const tag = document.createElement("span");
        tag.className = "pf-cat-tag";
        tag.textContent = item.category;
        thumb.append(tag);
      }
      const cover = item.cover || item.image || item.images?.[0];
      if (cover) {
        const img = document.createElement("img");
        img.src = assetUrl(typeof cover === "string" ? cover : cover.url);
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        thumb.append(img);
      }
      thumb.addEventListener("click", () => openDetail(item));

      const title = document.createElement("strong");
      title.className = "pf-card-title";
      if (window.GongbangTime?.renderPostTitle) {
        window.GongbangTime.renderPostTitle(title, brandText(item.title), item.publishedAt);
      } else {
        title.textContent = brandText(item.title);
      }

      article.append(thumb, title);
      els.grid.append(article);
    });
    observeCards();
  }

  function setSelectedDate(key) {
    state.selectedDate = state.selectedDate === key ? "" : key;
    state.page = 1;
    renderCalendar();
    renderDateStrip();
    renderList();
  }

  function renderCalendar() {
    if (!els.cal) return;
    const today = kstParts();
    const y = today.y;
    const m = today.m;
    const firstWeekday = weekdayIndex(`${y}-${String(m).padStart(2, "0")}-01`);
    const weekMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const offset = weekMap[firstWeekday] ?? 0;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const postMap = postsByDateKey();

    els.cal.replaceChildren();
    const head = document.createElement("div");
    head.className = "ship-cal__head";
    const title = document.createElement("strong");
    title.className = "ship-cal__title";
    title.textContent = `${y}년 ${m}월`;
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "ship-cal__clear";
    clear.textContent = state.selectedDate ? "날짜 해제" : "전체";
    clear.addEventListener("click", () => {
      state.selectedDate = "";
      state.page = 1;
      renderCalendar();
      renderDateStrip();
      renderList();
    });
    head.append(title, clear);

    const week = document.createElement("div");
    week.className = "ship-cal__week";
    ["일", "월", "화", "수", "목", "금", "토"].forEach((label, i) => {
      const cell = document.createElement("span");
      cell.className = `ship-cal__wd${i === 0 ? " is-sun" : i === 6 ? " is-sat" : ""}`;
      cell.textContent = label;
      week.append(cell);
    });

    const grid = document.createElement("div");
    grid.className = "ship-cal__grid";
    for (let i = 0; i < offset; i += 1) {
      const blank = document.createElement("button");
      blank.type = "button";
      blank.className = "ship-cal__day";
      blank.disabled = true;
      blank.textContent = "";
      grid.append(blank);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const wd = weekdayIndex(key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ship-cal__day";
      button.textContent = String(day);
      if (wd === "Sat") button.classList.add("is-sat");
      if (wd === "Sun") button.classList.add("is-sun");
      if (state.holidays.has(key)) {
        button.classList.add("is-holiday");
        button.title = state.holidayNames[key] || "공휴일";
      }
      if (key === today.key) button.classList.add("is-today");
      if (key === state.selectedDate) button.classList.add("is-selected");
      if (postMap.get(key)) button.classList.add("has-posts");
      button.addEventListener("click", () => setSelectedDate(key));
      grid.append(button);
    }
    els.cal.append(head, week, grid);
  }

  function renderDateStrip() {
    if (!els.strip) return;
    const today = kstParts();
    const postMap = postsByDateKey();
    els.strip.replaceChildren();

    const month = document.createElement("span");
    month.className = "ship-date-month";
    month.textContent = `${today.m}월`;
    month.setAttribute("aria-hidden", "true");
    els.strip.append(month);

    for (let delta = -3; delta <= 5; delta += 1) {
      const key = addDaysKey(today.key, delta);
      const wd = weekdayIndex(key);
      const dayNum = Number(key.slice(-2));
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ship-date-chip";
      chip.setAttribute("aria-label", key);
      if (wd === "Sat") chip.classList.add("is-sat");
      if (wd === "Sun") chip.classList.add("is-sun");
      if (state.holidays.has(key)) {
        chip.classList.add("is-holiday");
        chip.title = state.holidayNames[key] || "공휴일";
      }
      if (key === today.key) chip.classList.add("is-today");
      if (key === state.selectedDate) {
        chip.classList.add("is-selected");
        chip.classList.add("is-active");
      }
      if (postMap.get(key)) chip.classList.add("has-posts");

      const mark = document.createElement("i");
      mark.className = "ship-date-dot";
      mark.setAttribute("aria-hidden", "true");
      const strong = document.createElement("strong");
      strong.textContent = String(dayNum);
      chip.append(mark, strong);
      chip.addEventListener("click", () => setSelectedDate(key));
      els.strip.append(chip);
    }
  }

  async function loadHolidays() {
    const today = kstParts();
    const years = [today.y, today.y + 1];
    let cached = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(HOLIDAY_CACHE_KEY) || "null");
    } catch (_) {
      cached = null;
    }
    const need = years.filter((year) => !cached?.years?.[year]);
    const map = { ...(cached?.years || {}) };
    await Promise.all(
      need.map(async (year) => {
        try {
          const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`, {
            cache: "no-store",
          });
          if (!res.ok) return;
          const rows = await res.json();
          map[year] = (rows || []).map((row) => ({
            date: String(row.date || "").slice(0, 10),
            name: row.localName || row.name || "공휴일",
          }));
        } catch (_) {}
      })
    );
    try {
      sessionStorage.setItem(
        HOLIDAY_CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), years: map })
      );
    } catch (_) {}
    state.holidays = new Set();
    state.holidayNames = {};
    Object.values(map).forEach((rows) => {
      (rows || []).forEach((row) => {
        if (!row.date) return;
        state.holidays.add(row.date);
        state.holidayNames[row.date] = row.name;
      });
    });
  }

  async function loadData() {
    if (els.status) els.status.textContent = "불러오는 중…";
    try {
      const response = await fetch(`${DATA_PATH}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("출고 데이터를 불러오지 못했습니다.");
      const payload = await response.json();
      state.categories =
        Array.isArray(payload.categories) && payload.categories.length
          ? payload.categories
          : [...DEFAULT_CATEGORIES];
      state.items = (payload.items || [])
        .slice()
        .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
      if (window.GongbangBoardMeta?.fetchViews && state.items.length) {
        const views = await window.GongbangBoardMeta.fetchViews(
          BOARD,
          state.items.map((item) => item.id)
        );
        state.items.forEach((item) => {
          item.viewCount = Number(views[String(item.id)]) || 0;
        });
      }
      state.loaded = true;
      renderCats();
      renderCalendar();
      renderDateStrip();
      renderList();
    } catch (error) {
      if (els.status) els.status.textContent = error.message || "불러오기 실패";
      els.grid.innerHTML = `<p class="pf-empty">${error.message || "불러오기 실패"}</p>`;
    }
  }

  function closeOtherPanels() {
    if (typeof window.closeGongbangPortfolioPanel === "function") {
      window.closeGongbangPortfolioPanel({ skipNav: true });
    }
    if (typeof window.closeGongbangReviewsPanel === "function") {
      window.closeGongbangReviewsPanel({ skipNav: true });
    }
    if (typeof window.closeGongbangNoticesPanel === "function") {
      window.closeGongbangNoticesPanel({ skipNav: true });
    }
  }

  function openShippingPanel() {
    closeOtherPanels();
    els.panel.hidden = false;
    state.opened = true;
    placeShippingTools();
    if (window.GongbangSiteNav?.setActiveNav) window.GongbangSiteNav.setActiveNav("shipping");
    if (typeof window.GongbangScrollToElement === "function") {
      window.GongbangScrollToElement(els.panel);
    } else {
      els.panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (!state.loaded) loadData();
    else {
      renderCalendar();
      renderDateStrip();
      renderList();
    }
  }

  function closeShippingPanel(options = {}) {
    els.panel.hidden = true;
    state.opened = false;
    if (!options.skipNav && window.GongbangSiteNav?.setActiveNav) {
      window.GongbangSiteNav.setActiveNav(window.GongbangSiteNav.detectActivePanel?.() || "home");
    }
  }

  function refreshDayBoundUi() {
    const today = kstParts();
    const prev = state.anchorDate;
    if (prev === today.key) return;
    state.anchorDate = today.key;
    renderCalendar();
    renderDateStrip();
  }

  async function bootSession() {
    try {
      const payload = await api("/auth/me");
      if (payload.member) {
        state.member = payload.member;
        if (payload.accessToken) sessionStorage.setItem(TOKEN_KEY, payload.accessToken);
      }
    } catch (_) {
      state.member = null;
    }
    renderSession();
  }

  window.openGongbangShippingPanel = openShippingPanel;
  window.closeGongbangShippingPanel = closeShippingPanel;
  window.refreshGongbangShippingBoard = () => {
    if (state.opened) loadData();
  };

  els.openButton?.addEventListener("click", openShippingPanel);
  els.closeButton?.addEventListener("click", () => closeShippingPanel());
  els.search?.addEventListener("input", () => {
    state.page = 1;
    renderList();
  });
  els.write?.addEventListener("click", () => {
    if (typeof window.openGongbangBoardWriter === "function") {
      window.openGongbangBoardWriter("shipping");
      return;
    }
    showToast("글쓰기 권한이 없습니다.", { tone: "error" });
  });
  window.addEventListener("resize", placeShippingTools);
  window.addEventListener("gongbang:auth-changed", (event) => {
    state.member = event.detail?.member || null;
    renderSession();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshDayBoundUi();
  });
  window.setInterval(refreshDayBoundUi, 60 * 1000);

  placeShippingTools();
  bootSession();
  loadHolidays().then(() => {
    state.anchorDate = kstParts().key;
    if (state.opened || state.loaded) {
      renderCalendar();
      renderDateStrip();
    }
  });

  if (new URLSearchParams(location.search).get("open") === "shipping") {
    openShippingPanel();
  }
})();
