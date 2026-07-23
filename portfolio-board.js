(() => {
  "use strict";

  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  const DATA_PATH = "portfolio-data.json";
  const BOARD = "portfolio";
  const PAGE_SIZE = 12;
  const $ = (id) => document.getElementById(id);

  const els = {
    panel: $("portfolioPanel"),
    openButton: $("portfolioOpen"),
    closeButton: $("portfolioClose"),
    cats: $("pfCats"),
    search: $("pfSearch"),
    status: $("pfStatus"),
    count: $("pfCount"),
    grid: $("pfGrid"),
    pager: $("pfPager"),
    write: $("pfWrite"),
    session: $("pfSession"),
    dialog: $("boardDialog"),
    close: $("boardClose"),
    title: $("detailTitle"),
    meta: $("detailMeta"),
    content: $("detailContent"),
    images: $("detailImages"),
    actions: $("detailActions"),
  };

  if (!els.grid || !els.dialog) return;

  const state = {
    items: [],
    categories: [],
    category: "ALL",
    page: 1,
    member: null,
    current: null,
    slideIndex: 0,
    slideCount: 0,
    opened: false,
    loaded: false,
  };

  const assetUrl = (value) => {
    const path = String(value || "").trim();
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return `/${path.replace(/^\/+/, "")}`;
  };

  const formatDate = (value) => (window.GongbangTime ? window.GongbangTime.formatDate(value) : "");

  const brandText = (value) => String(value || "")
    .replace(/GONGBANG\s*171/gi, "HERITAGE")
    .replace(/Gongbang\s*171/gi, "Heritage")
    .replace(/gongbang\s*171/gi, "Heritage")
    .replace(/공방\s*171/g, "헤리티지")
    .replace(/헤리티지는/g, "헤리티지는")
    .replace(/헤리티지를/g, "헤리티지를")
    .replace(/헤리티지와/g, "헤리티지와");


  function showToast(message, options = {}) {
    if (typeof window.showGongbangToast === "function") {
      window.showGongbangToast(message, options);
      return;
    }
    let toast = document.querySelector(".pf-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "pf-toast";
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(options.tone === "error"));
    toast.classList.add("is-on");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.remove("is-on"), options.duration || 2600);
  }

  function openAuth(mode = "login") {
    if (typeof window.openGongbangAuth === "function") {
      window.openGongbangAuth(mode === "register" ? "register" : "login");
      return;
    }
    location.href = "/landing.html?open=mypage";
  }

  function applyAuthMember(member, accessToken) {
    if (accessToken) {
      try { sessionStorage.setItem(TOKEN_KEY, accessToken); } catch (_) {}
    }
    state.member = member || null;
    renderSession();
    if (state.current) renderActions();
  }

  function closeOtherLandingPanels() {
    if (typeof window.closeGongbangBoardPanels === "function") {
      window.closeGongbangBoardPanels({ skipNav: true });
    }
    if (typeof window.closeGongbangReviewsPanel === "function") {
      window.closeGongbangReviewsPanel({ skipNav: true });
    }
  }

  function openPortfolioPanel() {
    closeOtherLandingPanels();
    if (els.panel) els.panel.hidden = false;
    state.opened = true;
    placePortfolioTools();
    if (window.GongbangSiteNav?.setActiveNav) window.GongbangSiteNav.setActiveNav("portfolio");
    const target = els.panel || els.grid;
    if (typeof window.GongbangScrollToElement === "function") {
      window.GongbangScrollToElement(target);
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (!state.loaded) loadData();
    else renderList();
  }

  function closePortfolioPanel(options = {}) {
    if (els.panel) els.panel.hidden = true;
    state.opened = false;
    closeDetail();
    if (!options.skipNav && window.GongbangSiteNav?.setActiveNav) {
      window.GongbangSiteNav.setActiveNav(window.GongbangSiteNav.detectActivePanel?.() || "home");
    }
  }

  window.openGongbangPortfolioPanel = openPortfolioPanel;
  window.closeGongbangPortfolioPanel = closePortfolioPanel;

  function isAdmin() {
    return Boolean(state.member && state.member.role === "admin");
  }

  function openWriter() {
    if (!isAdmin()) {
      showToast("글쓰기 권한이 없습니다.", { tone: "error" });
      return;
    }
    location.href = "/admin/portfolio/";
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

  function publishedAt(item) {
    return item.sortAt || item.publishedAt || item.uploadedAt || "";
  }

  function filteredItems() {
    const query = (els.search.value || "").trim().toLowerCase();
    return state.items.filter((item) => {
      if (state.category !== "ALL" && item.category !== state.category) return false;
      if (!query) return true;
      return `${item.title} ${item.content || ""} ${item.category || ""}`.toLowerCase().includes(query);
    });
  }

  function observeCards() {
    if (!("IntersectionObserver" in window)) {
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
        const rail = (els.panel || document).querySelector?.(".pf-rail");
        const mobile = window.matchMedia("(max-width: 1099px)").matches;
        const railH = mobile && rail ? rail.getBoundingClientRect().height : 0;
        const y = target.getBoundingClientRect().top + window.scrollY - (topH + railH + 10);
        quickScrollToY(y);
      });
    });
  }

  function renderCats() {
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
        renderList();
        scrollToFirstCard();
      });
      els.cats.append(button);
    });
  }

  function imageCount(item) {
    const seen = new Set();
    return [item.cover || item.image, ...(item.images || [])]
      .filter(Boolean)
      .filter((path) => {
        const key = String(path);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).length;
  }

  function renderPager(total) {
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
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      els.pager.append(button);
    };
    add("‹", state.page - 1, state.page <= 1);
    const first = Math.max(1, state.page - 2);
    const last = Math.min(pages, first + 4);
    for (let page = first; page <= last; page += 1) {
      add(String(page), page, false, page === state.page);
    }
    add("›", state.page + 1, state.page >= pages);
  }

  function renderList() {
    const filtered = filteredItems();
    const pageItems = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const query = (els.search.value || "").trim();
    const label = query || state.category !== "ALL"
      ? `${filtered.length.toLocaleString("ko-KR")} works`
      : `${state.items.length.toLocaleString("ko-KR")} works`;
    if (els.count) els.count.textContent = label;
    els.status.textContent = query || state.category !== "ALL"
      ? `필터 결과 ${filtered.length.toLocaleString("ko-KR")}개 · ${state.page}페이지`
      : `전체 ${state.items.length.toLocaleString("ko-KR")}개 · 사진을 눌러 추가 컷을 확인하세요`;
    renderPager(filtered.length);
    els.grid.replaceChildren();

    if (!pageItems.length) {
      const empty = document.createElement("p");
      empty.className = "pf-empty";
      empty.textContent = query
        ? "검색 결과가 없습니다.\n다른 키워드나 카테고리를 선택해 보세요."
        : "등록된 포트폴리오가 없습니다.";
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

      const img = document.createElement("img");
      img.src = assetUrl(item.cover || item.image);
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      thumb.append(img);

      const shots = imageCount(item);
      if (shots > 1) {
        const badge = document.createElement("span");
        badge.className = "pf-shots";
        badge.textContent = String(shots);
        badge.title = `사진 ${shots}장`;
        thumb.append(badge);
      }

      const title = document.createElement("strong");
      title.className = "pf-card-title";
      const safeTitle = brandText(item.title);
      if (window.GongbangTime?.renderPostTitle) {
        window.GongbangTime.renderPostTitle(title, safeTitle, publishedAt(item));
      } else {
        title.textContent = safeTitle;
      }

      const meta = document.createElement("span");
      meta.className = "pf-card-meta";
      const viewsText = window.GongbangBoardMeta
        ? window.GongbangBoardMeta.formatViews(item.viewCount)
        : `조회 ${Number(item.viewCount) || 0}`;
      meta.textContent = `${formatDate(publishedAt(item))} · ${viewsText}`;

      thumb.addEventListener("click", () => openDetail(item));
      article.append(thumb, title, meta);
      els.grid.append(article);
    });

    observeCards();
  }

  function updateCarousel() {
    const viewport = els.images.querySelector(".board-carousel-viewport");
    const track = els.images.querySelector(".board-carousel-track");
    const counter = els.images.querySelector(".board-carousel-counter");
    const prev = els.images.querySelector("[data-slide='prev']");
    const next = els.images.querySelector("[data-slide='next']");
    if (!track) return;
    track.style.transform = `translateX(-${state.slideIndex * 100}%)`;
    if (counter) counter.textContent = `${state.slideIndex + 1} / ${state.slideCount}`;
    if (prev) prev.disabled = state.slideIndex <= 0;
    if (next) next.disabled = state.slideIndex >= state.slideCount - 1;
    if (window.GongbangBoardMeta?.syncCarouselHeight) {
      window.GongbangBoardMeta.syncCarouselHeight(viewport, track, state.slideIndex);
    }
  }

  function renderCarousel(item) {
    els.images.replaceChildren();
    const seen = new Set();
    const paths = [item.cover || item.image, ...(item.images || [])]
      .filter(Boolean)
      .filter((path) => {
        const key = String(path);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    state.slideIndex = 0;
    state.slideCount = paths.length;
    if (!paths.length) return;

    const carousel = document.createElement("div");
    carousel.className = "board-carousel";
    const viewport = document.createElement("div");
    viewport.className = "board-carousel-viewport";
    const track = document.createElement("div");
    track.className = "board-carousel-track";

    paths.forEach((path, index) => {
      const slide = document.createElement("div");
      slide.className = "board-carousel-slide";
      const img = document.createElement("img");
      img.src = assetUrl(path);
      img.alt = item.title;
      img.loading = index === 0 ? "eager" : "lazy";
      img.decoding = "async";
      slide.append(img);
      track.append(slide);
    });
    viewport.append(track);
    carousel.append(viewport);

    if (paths.length > 1) {
      const makeButton = (direction, label, text) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `board-carousel-nav ${direction}`;
        button.dataset.slide = direction;
        button.setAttribute("aria-label", label);
        button.textContent = text;
        button.addEventListener("click", () => {
          state.slideIndex += direction === "prev" ? -1 : 1;
          state.slideIndex = Math.max(0, Math.min(state.slideIndex, state.slideCount - 1));
          updateCarousel();
        });
        return button;
      };
      const counter = document.createElement("span");
      counter.className = "board-carousel-counter";
      carousel.append(
        makeButton("prev", "이전 이미지", "‹"),
        makeButton("next", "다음 이미지", "›"),
        counter
      );

      let touchStartX = 0;
      viewport.addEventListener("touchstart", (event) => {
        touchStartX = event.touches[0]?.clientX || 0;
      }, { passive: true });
      viewport.addEventListener("touchend", (event) => {
        const distance = (event.changedTouches[0]?.clientX || 0) - touchStartX;
        if (Math.abs(distance) < 45) return;
        state.slideIndex += distance < 0 ? 1 : -1;
        state.slideIndex = Math.max(0, Math.min(state.slideIndex, state.slideCount - 1));
        updateCarousel();
      }, { passive: true });
    }

    els.images.append(carousel);
    updateCarousel();
  }

  function renderActions() {
    els.actions.replaceChildren();
    const canManage = state.member && state.member.role === "admin" && state.current;
    els.actions.hidden = !canManage;
    if (!canManage) return;

    const edit = document.createElement("a");
    edit.className = "detail-action";
    edit.href = `/admin/portfolio/?edit=${encodeURIComponent(state.current.id)}`;
    edit.textContent = "수정";

    const manage = document.createElement("a");
    manage.className = "detail-action";
    manage.href = "/admin/portfolio/";
    manage.textContent = "관리자";

    els.actions.append(edit, manage);
  }

  async function openDetail(item) {
    state.current = item;
    let viewCount = Number(item.viewCount) || 0;
    if (window.GongbangBoardMeta?.bumpView) {
      viewCount = await window.GongbangBoardMeta.bumpView(BOARD, item.id);
      item.viewCount = viewCount;
    }
    const safeTitle = brandText(item.title);
    const safeContent = brandText(item.content || "");
    if (window.GongbangTime?.renderPostTitle) {
      window.GongbangTime.renderPostTitle(els.title, safeTitle, publishedAt(item));
    } else {
      els.title.textContent = safeTitle;
    }
    if (window.GongbangBoardMeta?.renderMetaRow) {
      const cover = item.cover || item.image || (item.images && item.images[0]) || "";
      const path = String(cover).replace(/^\/+/, "");
      const imageAbs = /^https?:\/\//i.test(cover)
        ? cover
        : `${location.origin}/${path}`;
      window.GongbangBoardMeta.renderMetaRow(els.meta, {
        dateText: formatDate(publishedAt(item)),
        viewCount,
        board: "portfolio",
        tryOn: {
          id: item.id,
          title: brandText(item.title || ""),
          category: item.category || "",
          path,
          image: imageAbs,
        },
      });
    }
    if (window.GongbangHtmlEditor) {
      window.GongbangHtmlEditor.renderSafe(els.content, safeContent);
    } else {
      els.content.textContent = safeContent;
    }
    window.GongbangBoardMeta?.setupContentClamp?.(els.content);
    renderCarousel(item);
    renderActions();
    els.dialog.classList.add("open");
    els.dialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("dialog-open");
    renderList();
  }

  function closeDetail() {
    els.dialog.classList.remove("open");
    els.dialog.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dialog-open");
    els.images.replaceChildren();
    state.slideIndex = 0;
    state.slideCount = 0;
    state.current = null;
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


  async function loadViews(items) {
    if (!window.GongbangBoardMeta?.fetchViews || !items.length) return;
    const ids = items.map((item) => item.id);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const views = await window.GongbangBoardMeta.fetchViews(BOARD, chunk);
      chunk.forEach((id) => {
        const item = items.find((row) => String(row.id) === String(id));
        if (item) item.viewCount = Number(views[String(id)]) || 0;
      });
    }
  }

  async function loadData() {
    els.status.textContent = "불러오는 중…";
    try {
      const response = await fetch(`${DATA_PATH}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("포트폴리오 데이터를 불러오지 못했습니다.");
      const payload = await response.json();
      state.categories = Array.isArray(payload.categories) && payload.categories.length
        ? payload.categories
        : [...new Set((payload.items || []).map((item) => item.category).filter(Boolean))];
      state.items = (payload.items || [])
        .slice()
        .sort((a, b) => Date.parse(publishedAt(b) || 0) - Date.parse(publishedAt(a) || 0));
      await loadViews(state.items);
      state.loaded = true;
      renderCats();
      renderList();
    } catch (error) {
      els.status.textContent = error.message || "불러오기 실패";
      els.grid.replaceChildren();
      const empty = document.createElement("p");
      empty.className = "pf-empty";
      empty.textContent = "포트폴리오를 불러오지 못했습니다.";
      els.grid.append(empty);
    }
  }

  async function bootSession() {
    try {
      const payload = await api("/auth/me");
      if (payload.member) {
        state.member = payload.member;
        if (payload.accessToken) sessionStorage.setItem(TOKEN_KEY, payload.accessToken);
      }
    } catch (_error) {
      state.member = null;
    }
    renderSession();
  }

  function placePortfolioTools() {
    const head = document.querySelector(".pf-rail-head");
    const toolbar = document.querySelector(".pf-toolbar");
    const search = document.querySelector(".pf-search");
    const actions = document.querySelector(".pf-tools-actions");
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

  els.search?.addEventListener("input", () => {
    state.page = 1;
    renderList();
  });
  els.close?.addEventListener("click", closeDetail);
  els.dialog.addEventListener("click", (event) => {
    if (event.target === els.dialog) closeDetail();
  });
  document.addEventListener("keydown", (event) => {
    const tag = (event.target?.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || event.target?.isContentEditable;
    if (event.key === "/" && !typing && !els.dialog.classList.contains("open")) {
      event.preventDefault();
      els.search?.focus();
      els.search?.select?.();
      return;
    }
    if (!els.dialog.classList.contains("open")) return;
    if (event.key === "Escape") closeDetail();
    if (event.key === "ArrowLeft" && state.slideIndex > 0) {
      state.slideIndex -= 1;
      updateCarousel();
    }
    if (event.key === "ArrowRight" && state.slideIndex < state.slideCount - 1) {
      state.slideIndex += 1;
      updateCarousel();
    }
  });
  els.write?.addEventListener("click", openWriter);
  els.openButton?.addEventListener("click", openPortfolioPanel);
  els.closeButton?.addEventListener("click", () => closePortfolioPanel());
  window.addEventListener("gongbang:auth-changed", (event) => {
    state.member = event.detail?.member || null;
    renderSession();
    if (state.current) renderActions();
  });

  if (!window.openGongbangAuth) {
    window.openGongbangAuth = (mode) => openAuth(mode || "login");
  }
  if (!window.getGongbangMember) {
    window.getGongbangMember = () => state.member;
  }

  bootSession();
  placePortfolioTools();
  window.addEventListener("resize", placePortfolioTools);
  if (!els.panel || !els.panel.hidden) {
    state.opened = !els.panel || !els.panel.hidden;
    loadData();
  }
  async function openFromQuery() {
    const params = new URLSearchParams(location.search);
    if (params.get("open") !== "portfolio" || !els.panel) return;
    openPortfolioPanel();
    const itemId = params.get("id");
    if (!itemId) return;
    const waitReady = async () => {
      const started = Date.now();
      while (!state.loaded && Date.now() - started < 15000) {
        await new Promise((r) => setTimeout(r, 80));
      }
    };
    await waitReady();
    const item = state.items.find((row) => String(row.id) === String(itemId));
    if (item) await openDetail(item);
  }
  openFromQuery();
})();
