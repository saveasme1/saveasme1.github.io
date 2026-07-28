(() => {
  "use strict";

  const API_BASE = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const API_ORIGIN = new URL(API_BASE).origin;
  const TOKEN_KEY = "gongbang171.adminToken";
  const BOARDS = [
    { board: "portfolio", label: "포트폴리오" },
    { board: "reviews", label: "고객후기" },
    { board: "shipping", label: "출고확인" },
    { board: "notices", label: "공지사항" },
  ];
  const $ = (id) => document.getElementById(id);

  const els = {
    status: $("mpStatus"),
    list: $("mpList"),
    tabs: $("mpTabs"),
    pager: $("mpPager"),
    likedStatus: $("mpLikedStatus"),
    likedList: $("mpLikedList"),
    likedPager: $("mpLikedPager"),
    dialog: $("mpEditDialog"),
    form: $("mpEditForm"),
    formStatus: $("mpEditStatus"),
    cancel: $("mpEditCancel"),
  };

  const state = {
    member: null,
    items: [],
    tab: "all",
    page: 1,
    liked: [],
    likedPage: 1,
  };
  let htmlEditor = null;

  const PAGE_SIZE = 5;

  function pageSize() {
    return PAGE_SIZE;
  }

  function ensureEditor() {
    if (htmlEditor || !els.form?.elements.body) return htmlEditor;
    htmlEditor = window.GongbangHtmlEditor?.mount(els.form.elements.body) || null;
    return htmlEditor;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : options.body ? { "Content-Type": "application/json" } : {}),
        ...(sessionStorage.getItem(TOKEN_KEY) ? { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `요청 실패 (${response.status})`);
    return payload;
  }

  function imageUrl(value) {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (String(value).startsWith("/uploads/")) return `${API_ORIGIN}${value}`;
    return `/${String(value).replace(/^\/+/, "")}`;
  }

  function formatDate(value) {
    return window.GongbangTime ? window.GongbangTime.formatDate(value) : "";
  }

  function toast(message, tone = "success") {
    if (typeof window.showGongbangToast === "function") {
      window.showGongbangToast(message, { tone, duration: 2600 });
      return;
    }
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    const node = document.createElement("div");
    node.className = `toast ${tone}`;
    node.textContent = message;
    stack.appendChild(node);
    window.setTimeout(() => node.remove(), 2600);
  }

  async function loadBoardJson(type) {
    const response = await fetch(`/${type}-data.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.items) ? payload.items : Array.isArray(payload) ? payload : [];
  }

  function mapManagedItems(type, label, items) {
    return items.map((item) => ({
      board: type,
      boardLabel: label,
      id: item.id,
      title: item.title,
      date: item.publishedAt || item.updatedAt || item.createdAt || item.uploadedAt || item.sortAt,
      cover: item.cover || item.image || item.images?.[0]?.url || item.images?.[0] || "",
      editHref: `/admin/${type}/?edit=${encodeURIComponent(item.id)}`,
    }));
  }

  async function loadMyReviews(memberId) {
    const mine = [];
    let page = 1;
    let pages = 1;
    do {
      const payload = await api(`/reviews?page=${page}&pageSize=50`);
      const reviews = payload.reviews || [];
      pages = Math.max(1, payload.pagination?.pages || 1);
      reviews.forEach((review) => {
        if (Number(review.memberId) !== Number(memberId)) return;
        mine.push({
          board: "reviews",
          boardLabel: "고객후기",
          id: review.id,
          title: review.title,
          date: review.publishedAt,
          cover: review.images?.[0]?.url || "",
          raw: review,
        });
      });
      page += 1;
    } while (page <= pages && page <= 20);
    return mine;
  }

  async function loadManagedBoards(isAdmin) {
    if (!isAdmin) return [];
    const [portfolio, shipping, notices] = await Promise.all([
      loadBoardJson("portfolio"),
      loadBoardJson("shipping"),
      loadBoardJson("notices"),
    ]);
    return [
      ...mapManagedItems("portfolio", "포트폴리오", portfolio),
      ...mapManagedItems("shipping", "출고확인", shipping),
      ...mapManagedItems("notices", "공지사항", notices),
    ];
  }

  async function loadLikedPortfolios() {
    const liked = await api("/portfolio/likes/mine?limit=400");
    const ids = (liked.items || []).map((row) => String(row.portfolioId));
    if (!ids.length) return [];
    const portfolio = await loadBoardJson("portfolio");
    const byId = new Map(portfolio.map((item) => [String(item.id), item]));
    return ids
      .map((id) => {
        const item = byId.get(id);
        if (!item) {
          return {
            id,
            title: "삭제되었거나 비공개된 작품",
            cover: "",
            category: "",
            date: "",
            missing: true,
          };
        }
        return {
          id: item.id,
          title: item.title,
          cover: item.cover || item.image || item.images?.[0] || "",
          category: item.category || "",
          date: item.sortAt || item.uploadedAt || item.publishedAt || "",
          missing: false,
        };
      })
      .filter((row) => !row.missing);
  }

  function filteredItems() {
    if (state.tab === "all") return state.items;
    return state.items.filter((item) => item.board === state.tab);
  }

  function renderTabs() {
    if (!els.tabs) return;
    els.tabs.replaceChildren();
    const tabs = [{ board: "all", label: "전체" }, ...BOARDS];
    tabs.forEach((tab) => {
      const count =
        tab.board === "all"
          ? state.items.length
          : state.items.filter((item) => item.board === tab.board).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mp-tab${state.tab === tab.board ? " is-active" : ""}`;
      button.textContent = `${tab.label} ${count}`;
      button.addEventListener("click", () => {
        state.tab = tab.board;
        state.page = 1;
        renderMine();
      });
      els.tabs.append(button);
    });
  }

  function renderPager(el, totalPages, currentPage, onPage) {
    if (!el) return;
    el.replaceChildren();
    if (totalPages <= 1) return;
    const add = (label, page, disabled = false, active = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      if (active) button.classList.add("is-active");
      button.addEventListener("click", () => onPage(page));
      el.append(button);
    };
    add("‹", Math.max(1, currentPage - 1), currentPage <= 1);
    const windowSize = 5;
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    for (let page = start; page <= end; page += 1) {
      add(String(page), page, false, page === currentPage);
    }
    add("›", Math.min(totalPages, currentPage + 1), currentPage >= totalPages);
  }

  function renderMineList() {
    const items = filteredItems();
    const size = pageSize();
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * size;
    const pageItems = items.slice(start, start + size);

    els.list.replaceChildren();
    if (!pageItems.length) {
      const empty = document.createElement("p");
      empty.className = "mp-empty";
      empty.textContent = "작성한 글이 없습니다.";
      els.list.append(empty);
    } else {
      pageItems.forEach((item) => {
        const row = document.createElement("article");
        row.className = "mp-row";

        const thumb = document.createElement("div");
        thumb.className = "mp-thumb";
        if (item.cover) {
          const img = document.createElement("img");
          img.src = imageUrl(item.cover);
          img.alt = "";
          img.loading = "lazy";
          thumb.append(img);
        }

        const body = document.createElement("div");
        body.className = "mp-body";
        const main = document.createElement("div");
        main.className = "mp-main";

        const titleWrap = document.createElement("div");
        titleWrap.className = "mp-title-wrap";
        const title = document.createElement("strong");
        title.className = "mp-title";
        title.textContent = item.title || "(제목 없음)";
        title.title = item.title || "";
        const meta = document.createElement("span");
        meta.className = "mp-meta";
        meta.textContent = `${item.boardLabel || ""} · ${formatDate(item.date)}`.replace(/^ · /, "");
        titleWrap.append(title, meta);

        const actions = document.createElement("div");
        actions.className = "mp-actions";
        const edit = document.createElement(item.editHref ? "a" : "button");
        edit.className = "mp-btn";
        edit.textContent = "수정";
        if (item.editHref) {
          edit.href = item.editHref;
          edit.target = "_blank";
          edit.rel = "noopener noreferrer";
        } else {
          edit.type = "button";
          edit.addEventListener("click", () => openEdit(item));
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "mp-btn danger";
        remove.textContent = "삭제";
        remove.addEventListener("click", () => removeItem(item, remove));
        actions.append(edit, remove);

        main.append(titleWrap, actions);
        body.append(main);
        row.append(thumb, body);
        els.list.append(row);
      });
    }

    els.status.textContent = `${items.length}`;
    renderPager(els.pager, totalPages, state.page, (page) => {
      state.page = page;
      renderMineList();
    });
  }

  function renderLikedList() {
    if (!els.likedList) return;
    const items = state.liked;
    const size = pageSize();
    const totalPages = Math.max(1, Math.ceil(items.length / size) || 1);
    if (state.likedPage > totalPages) state.likedPage = totalPages;
    const start = (state.likedPage - 1) * size;
    const pageItems = items.slice(start, start + size);

    els.likedList.replaceChildren();
    if (!pageItems.length) {
      const empty = document.createElement("p");
      empty.className = "mp-empty";
      empty.textContent = "좋아요 누른 포트폴리오가 없습니다.";
      els.likedList.append(empty);
    } else {
      pageItems.forEach((item) => {
        const row = document.createElement("a");
        row.className = "mp-row mp-row--link";
        row.href = `/portfolio.html?id=${encodeURIComponent(item.id)}`;

        const thumb = document.createElement("div");
        thumb.className = "mp-thumb";
        if (item.cover) {
          const img = document.createElement("img");
          img.src = imageUrl(item.cover);
          img.alt = "";
          img.loading = "lazy";
          thumb.append(img);
        }

        const body = document.createElement("div");
        body.className = "mp-body";
        const main = document.createElement("div");
        main.className = "mp-main";

        const titleWrap = document.createElement("div");
        titleWrap.className = "mp-title-wrap";
        const title = document.createElement("strong");
        title.className = "mp-title";
        title.textContent = item.title || "(제목 없음)";
        const meta = document.createElement("span");
        meta.className = "mp-meta";
        const bits = [item.category, formatDate(item.date)].filter(Boolean);
        meta.textContent = bits.join(" · ");
        titleWrap.append(title, meta);

        const heart = document.createElement("span");
        heart.className = "mp-liked-mark";
        heart.textContent = "♥";
        heart.setAttribute("aria-hidden", "true");

        main.append(titleWrap, heart);
        body.append(main);
        row.append(thumb, body);
        els.likedList.append(row);
      });
    }

    if (els.likedStatus) {
      els.likedStatus.textContent = items.length ? `${items.length}` : "0";
    }
    renderPager(els.likedPager, totalPages, state.likedPage, (page) => {
      state.likedPage = page;
      renderLikedList();
    });
  }

  function renderMine() {
    renderTabs();
    renderMineList();
  }

  function openEdit(item) {
    if (item.board !== "reviews") return;
    ensureEditor();
    els.form.reset();
    els.form.elements.id.value = String(item.id);
    els.form.elements.title.value = item.raw?.title || item.title || "";
    els.form.elements.body.value = item.raw?.body || "";
    htmlEditor?.setMode(window.GongbangHtmlEditor?.looksLikeHtml?.(item.raw?.body) ? "source" : "text");
    els.formStatus.textContent = "";
    els.dialog.showModal();
  }

  async function removeItem(item, button) {
    if (!confirm(`“${item.title}” 글을 삭제할까요?`)) return;
    button.disabled = true;
    try {
      if (item.board === "reviews") {
        await api(`/reviews/${item.id}`, { method: "DELETE" });
      } else {
        const url = item.editHref || `/admin/${item.board}/`;
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      state.items = state.items.filter(
        (row) => !(row.board === item.board && String(row.id) === String(item.id))
      );
      renderMine();
      toast("삭제되었습니다.");
    } catch (error) {
      toast(error.message || String(error), "error");
      button.disabled = false;
    }
  }

  async function submitEdit(event) {
    event.preventDefault();
    const id = els.form.elements.id.value;
    if (!id) return;
    els.formStatus.textContent = "저장 중…";
    try {
      await api(`/reviews/${id}`, {
        method: "PUT",
        body: new FormData(els.form),
      });
      els.dialog.close();
      toast("수정되었습니다.");
      await boot(false);
    } catch (error) {
      els.formStatus.className = "review-dialog-status error";
      els.formStatus.textContent = error.message || String(error);
    }
  }

  async function boot(showLoading = true) {
    if (showLoading && els.status) els.status.textContent = "불러오는 중…";
    try {
      const me = await api("/auth/me");
      if (!me.member) throw new Error("로그인이 필요합니다.");
      state.member = me.member;
      document.body.dataset.authState = "in";
      window.dispatchEvent(new CustomEvent("gongbang:auth-changed", { detail: { member: me.member } }));

      const isAdmin = me.member.role === "admin";
      const [reviews, managed, liked] = await Promise.all([
        loadMyReviews(me.member.id),
        loadManagedBoards(isAdmin),
        loadLikedPortfolios().catch(() => []),
      ]);
      state.items = [...reviews, ...managed].sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
      );
      state.liked = liked;
      state.page = 1;
      state.likedPage = 1;
      renderMine();
      renderLikedList();
    } catch (error) {
      document.body.dataset.authState = "out";
      location.replace("/landing.html?open=mypage");
    }
  }

  els.cancel?.addEventListener("click", () => els.dialog.close());
  els.form?.addEventListener("submit", submitEdit);
  boot();
})();
