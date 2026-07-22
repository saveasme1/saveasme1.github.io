(() => {
  "use strict";

  const API_BASE = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const API_ORIGIN = new URL(API_BASE).origin;
  const RAW = "https://raw.githubusercontent.com/saveasme1/gongbang171_temp/main";
  const TOKEN_KEY = "gongbang171.adminToken";
  const PAGE_SIZE = 10;
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
  };
  let htmlEditor = null;

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
    return `${RAW}/${String(value).replace(/^\/+/, "")}`;
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
    const response = await fetch(`${RAW}/${type}-data.json?t=${Date.now()}`, { cache: "no-store" });
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

  function filteredItems() {
    if (state.tab === "all") return state.items;
    return state.items.filter((item) => item.board === state.tab);
  }

  function renderTabs() {
    if (!els.tabs) return;
    els.tabs.replaceChildren();
    const tabs = [{ board: "all", label: "전체" }, ...BOARDS];
    tabs.forEach((tab) => {
      const count = tab.board === "all"
        ? state.items.length
        : state.items.filter((item) => item.board === tab.board).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mp-tab${state.tab === tab.board ? " is-active" : ""}`;
      button.textContent = `${tab.label} ${count}`;
      button.addEventListener("click", () => {
        state.tab = tab.board;
        state.page = 1;
        render();
      });
      els.tabs.append(button);
    });
  }

  function renderPager(totalPages) {
    if (!els.pager) return;
    els.pager.replaceChildren();
    if (totalPages <= 1) return;
    const add = (label, page, disabled = false, active = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      if (active) button.classList.add("is-active");
      button.addEventListener("click", () => {
        state.page = page;
        renderListOnly();
      });
      els.pager.append(button);
    };
    add("‹", Math.max(1, state.page - 1), state.page <= 1);
    const windowSize = 5;
    let start = Math.max(1, state.page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    for (let page = start; page <= end; page += 1) {
      add(String(page), page, false, page === state.page);
    }
    add("›", Math.min(totalPages, state.page + 1), state.page >= totalPages);
  }

  function renderListOnly() {
    const items = filteredItems();
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);

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
        meta.textContent = formatDate(item.date);
        titleWrap.append(title, meta);

        const actions = document.createElement("div");
        actions.className = "mp-actions";
        const edit = document.createElement(item.editHref ? "a" : "button");
        edit.className = "mp-btn";
        edit.textContent = "수정";
        if (item.editHref) edit.href = item.editHref;
        else {
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

    els.status.textContent = `내 글 ${items.length}개`;
    renderPager(totalPages);
  }

  function render() {
    renderTabs();
    renderListOnly();
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
        location.href = item.editHref || `/admin/${item.board}/`;
        return;
      }
      state.items = state.items.filter((row) => !(row.board === item.board && String(row.id) === String(item.id)));
      render();
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
    if (showLoading) els.status.textContent = "불러오는 중…";
    try {
      const me = await api("/auth/me");
      if (!me.member) throw new Error("로그인이 필요합니다.");
      state.member = me.member;
      document.body.dataset.authState = "in";
      window.dispatchEvent(new CustomEvent("gongbang:auth-changed", { detail: { member: me.member } }));

      const isAdmin = me.member.role === "admin";
      const [reviews, managed] = await Promise.all([
        loadMyReviews(me.member.id),
        loadManagedBoards(isAdmin),
      ]);
      state.items = [...reviews, ...managed].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      state.page = 1;
      render();
    } catch (error) {
      document.body.dataset.authState = "out";
      location.replace("/landing.html?open=mypage");
    }
  }

  els.cancel?.addEventListener("click", () => els.dialog.close());
  els.form?.addEventListener("submit", submitEdit);
  boot();
})();
