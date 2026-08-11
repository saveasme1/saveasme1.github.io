(() => {

  "use strict";



  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");

  const TOKEN_KEY = "gongbang171.adminToken";

  const DATA_PATH = "portfolio-data.json";
  const LIVE_API = `${(window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "")}/boards/portfolio/live`;

  const DRAFT_PATH = "portfolio-draft.json";

  const BOARD = "portfolio";

  const PAGE_SIZE_MOBILE = 6;
  const PAGE_SIZE_TABLET = 8;
  const PAGE_SIZE_DESKTOP = 12;

  function pageSizeForViewport() {
    const w = window.innerWidth || 0;
    if (w >= 1024) return PAGE_SIZE_DESKTOP;
    if (w >= 768) return PAGE_SIZE_TABLET;
    return PAGE_SIZE_MOBILE;
  }

  let PAGE_SIZE = pageSizeForViewport(); // show full list (was 5 — looked like TEMP cap)

  const CATEGORIES = ["C", "B", "VCA", "BO", "CM", "C&H", "CL", "G", "H", "P", "F", "ETC"];

  /**

   * TEMP hide (not delete): max items shown per brand category.

   * Restore later: set TEMP_PER_BRAND_LIMIT = 0 (or Infinity).

   */

  const TEMP_PER_BRAND_LIMIT = 0; // unlocked: show all items per brand // full portfolio restored // full portfolio restored

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

    priceMount: $("priceTrendMount"),

  };



  if (!els.grid || !els.dialog) return;



  const state = {

    items: [],

    categories: [],

    category: "ALL",

    page: 1,

    member: null,

    current: null,

    pricePanel: null,

    slideIndex: 0,

    slideCount: 0,

    opened: false,

    loaded: false,

    likes: {},

  };



  const assetUrl = (value) => {

    const path = String(value || "").trim();

    if (!path) return "";

    if (/^https?:\/\//i.test(path)) return path;

    // Prefer same-origin absolute URL so SW cache keys match reliably

    try {

      return new URL(path.replace(/^\/+/, ""), location.origin + "/").href;

    } catch (_) {

      return `/${path.replace(/^\/+/, "")}`;

    }

  };



  function bindImgFallback(img) {

    if (!img || img.dataset.pwaProtect === "1") return;

    if (typeof window.GongbangProtectImage === "function") {

      window.GongbangProtectImage(img);

      return;

    }

    img.dataset.pwaProtect = "1";

    img.addEventListener("error", () => {

      if (img.dataset.pwaFallback === "1") return;

      img.dataset.pwaFallback = "1";

      img.removeAttribute("srcset");

      img.src =

        "data:image/svg+xml;charset=utf-8," +

        encodeURIComponent(

          '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="#2a2724"/><text x="320" y="320" text-anchor="middle" fill="#c4bdb4" font-size="28" font-family="sans-serif">이미지 준비 중</text></svg>'

        );

    });

  }



  const formatDate = (value) => (window.GongbangTime ? window.GongbangTime.formatDate(value) : "");



  const brandText = (value) => String(value || "")

    .replace(/GONGBANG\s*171/gi, "HERITAGE")

    .replace(/Gongbang\s*171/gi, "Heritage")

    .replace(/gongbang\s*171/gi, "Heritage")

    .replace(/공방\s*171/g, "본 헤리티지")

    .replace(/본 헤리티지는/g, "본 헤리티지는")

    .replace(/본 헤리티지를/g, "본 헤리티지를")

    .replace(/본 헤리티지와/g, "본 헤리티지와");





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



  function openAuth(mode = "login", options = {}) {

    const next = mode === "register" ? "register" : "login";

    if (window.GongbangAuth?.open) {

      window.GongbangAuth.open(next, options);

      return;

    }

    if (typeof window.openGongbangAuth === "function" && window.openGongbangAuth !== openAuth) {

      window.openGongbangAuth(next, options);

      return;

    }

    const params = new URLSearchParams({ open: "mypage" });

    if (next === "register") params.set("auth", "register");

    location.href = `/landing.html?${params}`;

  }



  function openAdminWindow(url, name = "heritageAdminPortfolio") {

    const width = Math.min(1120, Math.max(720, (window.screen?.availWidth || 1200) - 80));

    const height = Math.min(920, Math.max(640, (window.screen?.availHeight || 900) - 80));

    const left = Math.max(0, Math.round((window.screenX || 0) + ((window.outerWidth || width) - width) / 2));

    const top = Math.max(0, Math.round((window.screenY || 0) + ((window.outerHeight || height) - height) / 2));

    const features =

      `popup=yes,width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;

    let win = null;

    try {

      win = window.open(url, name, features);

    } catch (_) {

      win = null;

    }

    if (win) {

      try {

        win.focus();

      } catch (_) {}

      return win;

    }

    // Keep current page; open a new tab if popup is blocked

    return window.open(url, "_blank", "noopener,noreferrer");

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

    if (els.panel && !/\/portfolio\.html$/i.test(location.pathname)) {

      const q = /[?&]app=1(?:&|$)/.test(location.search) ? "?app=1" : "";

      location.href = `./portfolio.html${q}`;

      return;

    }

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



  const decodeBase64 = (value) =>

    new TextDecoder().decode(Uint8Array.from(atob(String(value || "").replace(/\s/g, "")), (char) => char.charCodeAt(0)));

  const bytesToBase64 = (bytes) => {

    let binary = "";

    for (let i = 0; i < bytes.length; i += 0x8000) {

      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));

    }

    return btoa(binary);

  };

  const textToBase64 = (value) => bytesToBase64(new TextEncoder().encode(value));



  function clearWriterMedia(writer) {

    if (!writer) return;

    if (writer.cover?.preview?.startsWith("blob:")) URL.revokeObjectURL(writer.cover.preview);

    (writer.details || []).forEach((detail) => {

      if (detail.preview?.startsWith("blob:")) URL.revokeObjectURL(detail.preview);

    });

    writer.cover = { path: "", file: null, preview: "" };

    writer.details = [];

  }



  function renderWriterCover(writer) {

    const preview = writer.coverPreview;

    if (!preview) return;

    const url = writer.cover.preview || (writer.cover.path ? assetUrl(writer.cover.path) : "");

    preview.classList.toggle("is-empty", !url);

    preview.textContent = url ? "" : "대표 이미지 없음";

    preview.style.backgroundImage = url ? `url("${url}")` : "";

  }



  function renderWriterDetails(writer) {

    const grid = writer.detailGrid;

    if (!grid) return;

    grid.replaceChildren();

    if (!writer.details.length) {
      return;
    }

    writer.details.forEach((detail, index) => {

      const card = document.createElement("div");

      card.className = "pf-writer-thumb";

      const url = detail.preview || (detail.path ? assetUrl(detail.path) : "");

      card.style.backgroundImage = url ? `url("${url}")` : "";



      const order = document.createElement("span");

      order.className = "pf-writer-order";

      order.textContent = String(index + 1);



      const remove = document.createElement("button");

      remove.type = "button";

      remove.className = "pf-writer-remove";

      remove.setAttribute("aria-label", `${index + 1}번 이미지 삭제`);

      remove.textContent = "×";

      remove.addEventListener("click", () => {

        const [removed] = writer.details.splice(index, 1);

        if (removed?.preview?.startsWith("blob:")) URL.revokeObjectURL(removed.preview);

        renderWriterDetails(writer);

      });



      card.append(order, remove);

      grid.append(card);

    });

  }



  function ensureWriter() {

    if (

      state.writer?.root?.isConnected &&

      state.writer.coverPreview &&

      state.writer.detailGrid &&

      state.writer.root.querySelector(".pf-writer-fields") &&

      state.writer.root.querySelector(".pf-writer-cats") &&

      state.writer.root.querySelector(".pf-writer-cover-row")

    ) {

      return state.writer;

    }

    state.writer?.root?.remove?.();

    state.writer = null;



    const root = document.createElement("dialog");

    root.id = "portfolioWriteDialog";

    root.className = "review-dialog write-dialog pf-write-dialog";

    root.innerHTML = `

      <form id="portfolioWriteForm">

        <input type="hidden" name="editId" value="">

        <h2 id="portfolioWriteTitle">포트폴리오 작성</h2>

        <div class="pf-writer-fields">

          <div class="pf-writer-cat">

            <span class="pf-writer-label">카테고리</span>

            <input type="hidden" name="category" required value="C">

            <div class="pf-writer-cats" id="portfolioCatChips" role="listbox" aria-label="카테고리 선택"></div>

          </div>

          <label class="pf-writer-title">제목<input name="title" minlength="2" maxlength="160" required placeholder="게시글/상품 제목"></label>

          <label class="pf-writer-content">내용<textarea name="content" minlength="2" maxlength="20000" required placeholder="상품 설명이나 작업 내용을 입력하세요."></textarea></label>

        </div>

        <section class="pf-writer-images" aria-label="이미지">

          <div class="pf-writer-block pf-writer-cover-block">

            <div class="pf-writer-heading">

              <strong>대표 이미지</strong>

              <span>목록에 가장 먼저 보이는 이미지</span>

            </div>

            <div class="pf-writer-cover-row">

              <div class="pf-writer-cover" id="portfolioCoverPreview">대표 이미지 없음</div>

              <label class="pf-writer-file">대표 이미지 선택<input name="cover" type="file" accept="image/jpeg,image/png,image/webp"></label>

            </div>

          </div>

          <div class="pf-writer-block pf-writer-detail-block">

            <div class="pf-writer-heading">

              <strong>추가 이미지</strong>

              <span>클릭하여 이미지 추가</span>

            </div>

            <label class="pf-writer-file compact">클릭하여 이미지 추가<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>

            <div class="pf-writer-grid" id="portfolioDetailGrid"></div>

          </div>

        </section>

        <div class="pf-writer-footer">

          <p class="review-image-help" id="portfolioWriteHelp">대표 이미지를 올려 주세요.</p>

          <p class="review-dialog-status" id="portfolioWriteStatus" aria-live="polite"></p>

          <div class="review-dialog-actions">

            <button type="button" id="portfolioWriteCancel">취소</button>

            <button class="primary" type="submit" id="portfolioWriteSubmit">등록하기</button>

          </div>

        </div>

      </form>`;

    document.body.append(root);



    const form = root.querySelector("#portfolioWriteForm");

    const writer = {

      root,

      form,

      title: root.querySelector("#portfolioWriteTitle"),

      status: root.querySelector("#portfolioWriteStatus"),

      submit: root.querySelector("#portfolioWriteSubmit"),

      cancel: root.querySelector("#portfolioWriteCancel"),

      help: root.querySelector("#portfolioWriteHelp"),

      coverPreview: root.querySelector("#portfolioCoverPreview"),

      detailGrid: root.querySelector("#portfolioDetailGrid"),

      catChips: root.querySelector("#portfolioCatChips"),

      htmlEditor: window.GongbangHtmlEditor?.mount(form?.elements?.content),

      editing: null,

      cover: { path: "", file: null, preview: "" },

      details: [],

    };



    function setCategory(value) {

      const cats = state.categories.length ? state.categories : CATEGORIES;

      const next = cats.includes(value) ? value : cats[0] || "C";

      form.elements.category.value = next;

      writer.catChips?.querySelectorAll("[data-cat]").forEach((chip) => {

        chip.classList.toggle("is-active", chip.dataset.cat === next);

        chip.setAttribute("aria-selected", chip.dataset.cat === next ? "true" : "false");

      });

    }



    function renderCategoryChips() {

      if (!writer.catChips) return;

      const cats = state.categories.length ? state.categories : CATEGORIES;

      writer.catChips.replaceChildren();

      cats.forEach((category) => {

        const chip = document.createElement("button");

        chip.type = "button";

        chip.className = "pf-writer-cat-chip";

        chip.dataset.cat = category;

        chip.setAttribute("role", "option");

        chip.textContent = category;

        chip.addEventListener("click", () => setCategory(category));

        writer.catChips.append(chip);

      });

      setCategory(form.elements.category.value || cats[0] || "C");

    }



    writer.renderCategoryChips = renderCategoryChips;

    writer.setCategory = setCategory;

    renderCategoryChips();



    writer.cancel.addEventListener("click", () => writer.root.close());

    writer.root.addEventListener("close", () => {

      // keep media until reopen clears — reopen calls clear/setup

    });

    form.elements.cover.addEventListener("change", () => {

      const file = form.elements.cover.files?.[0];

      if (!file) return;

      if (writer.cover.preview?.startsWith("blob:")) URL.revokeObjectURL(writer.cover.preview);

      writer.cover = { path: writer.cover.path, file, preview: URL.createObjectURL(file) };

      form.elements.cover.value = "";

      renderWriterCover(writer);

    });

    form.elements.images.addEventListener("change", () => {

      const files = [...(form.elements.images.files || [])];

      files.forEach((file) => {

        writer.details.push({ path: "", file, preview: URL.createObjectURL(file) });

      });

      form.elements.images.value = "";

      renderWriterDetails(writer);

    });

    form.addEventListener("submit", submitWriter);

    state.writer = writer;

    return writer;

  }



  function openWriter(editItem = null) {

    if (!isAdmin()) {

      showToast("글쓰기 권한이 없습니다.", { tone: "error" });

      return;

    }

    const writer = ensureWriter();

    const form = writer.form;

    form.reset();

    writer.htmlEditor?.reset?.();

    clearWriterMedia(writer);

    writer.editing = editItem || null;

    writer.status.textContent = "";

    writer.submit.disabled = false;

    writer.renderCategoryChips?.();



    if (editItem) {

      writer.title.textContent = "포트폴리오 수정";

      writer.submit.textContent = "저장하기";

      writer.help.textContent = "이미지를 새로 고르면 교체·추가됩니다. ×로 삭제할 수 있습니다.";

      form.elements.editId.value = editItem.id || "";

      writer.setCategory?.(editItem.category);

      form.elements.title.value = editItem.title || "";

      form.elements.content.value = editItem.content || "";

      writer.cover = {

        path: String(editItem.image || editItem.cover || ""),

        file: null,

        preview: "",

      };

      writer.details = (Array.isArray(editItem.images) ? editItem.images : [])

        .map(String)

        .filter(Boolean)

        .filter((path) => path !== writer.cover.path)

        .map((path) => ({ path, file: null, preview: "" }));

      if (writer.htmlEditor?.setMode) {

        writer.htmlEditor.setMode(

          window.GongbangHtmlEditor?.looksLikeHtml?.(editItem.content) ? "source" : "text"

        );

      }

    } else {

      writer.title.textContent = "포트폴리오 작성";

      writer.submit.textContent = "등록하기";

      writer.help.textContent = "대표 이미지를 올려 주세요.";

      form.elements.editId.value = "";

      writer.setCategory?.(CATEGORIES[0] || "C");

    }



    renderWriterCover(writer);

    renderWriterDetails(writer);

    writer.root.showModal();

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




  async function preparePortfolioAsset(file, role, index = 0) {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error(`${file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
    }
    return {
      role,
      index: index || undefined,
      mime: file.type || "image/jpeg",
      content: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
    };
  }

  async function uploadPortfolioImage(file, id, role, index = 0) {

    if (file.size > 8 * 1024 * 1024) {

      throw new Error(`${file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);

    }

    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type] || "jpg";

    const suffix = index ? `-${index}` : "";

    const path = `portfolio/uploads/${id}/${role}${suffix}-${Date.now()}.${ext}`;

    const content = bytesToBase64(new Uint8Array(await file.arrayBuffer()));

    await putManaged(path, content, `portfolio: upload ${id} ${role}${suffix}`);

    return path;

  }



  function sortNewest(items) {

    return [...items].sort((a, b) => {

      const aTime = Date.parse(a.sortAt || a.uploadedAt || 0) || 0;

      const bTime = Date.parse(b.sortAt || b.uploadedAt || 0) || 0;

      return bTime - aTime || String(b.id).localeCompare(String(a.id));

    });

  }



  function toPublishedItem(item) {

    const cover = String(item.cover || item.image || "");

    return {

      id: String(item.id || ""),

      category: CATEGORIES.includes(item.category) ? item.category : "ETC",

      title: String(item.title || ""),

      content: String(item.content || ""),

      image: cover,

      images: (Array.isArray(item.images) ? item.images : []).map(String).filter(Boolean).filter((path) => path !== cover),

      uploadedAt: item.uploadedAt || item.createdAt || new Date().toISOString(),

      sortAt: item.sortAt || item.uploadedAt || item.createdAt || new Date().toISOString(),

    };

  }



  async function submitWriter(event) {

    event.preventDefault();

    const writer = ensureWriter();

    const form = event.currentTarget;

    const editing = writer.editing;

    if (!editing && !writer.cover.file && !writer.cover.path) {

      writer.status.textContent = "대표 이미지를 선택해 주세요.";

      return;

    }

    writer.submit.disabled = true;

    try {

      const id = editing?.id || `admin-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;


      const assets = [];
      let cover = writer.cover.path || "";
      if (writer.cover.file) {
        writer.status.textContent = "대표 이미지 준비 중…";
        assets.push(await preparePortfolioAsset(writer.cover.file, "cover"));
      }
      const keepImages = [];
      for (let index = 0; index < writer.details.length; index += 1) {
        const detail = writer.details[index];
        if (detail.file) {
          writer.status.textContent = `추가 이미지 준비 중 ${index + 1} / ${writer.details.length}`;
          assets.push(await preparePortfolioAsset(detail.file, "detail", index + 1));
        } else if (detail.path) {
          keepImages.push(detail.path);
        }
      }

      writer.status.textContent = "저장 중…";
      const now = window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString();
      const existing = editing || (state.items || []).find((entry) => entry.id === id);
      const draftItem = toPublishedItem({
        ...(existing || {}),
        id,
        category: form.elements.category.value,
        title: form.elements.title.value.trim(),
        content: form.elements.content.value.trim(),
        image: cover,
        cover,
        images: keepImages.filter((path) => path && path !== cover),
        uploadedAt: existing?.uploadedAt || now,
        sortAt: now,
        updatedAt: now,
        origin: existing?.origin || "admin",
      });

      const published = await api("/admin/boards/portfolio/publish", {
        method: "PUT",
        body: JSON.stringify({
          item: draftItem,
          assets,
          meta: {
            version: 3,
            categories: state.categories.length ? state.categories : CATEGORIES,
          },
        }),
      });
      const item = toPublishedItem(published.item || draftItem);

      state.items = sortNewest([item, ...(state.items || []).filter((entry) => entry.id !== id)]);

      state.page = 1;

      renderCats();

      renderList();

      if (editing && state.current?.id === id) {

        state.current = item;

        openDetail(item);

      }

      clearWriterMedia(writer);

      writer.root.close();

      form.reset();

      writer.editing = null;

      showToast(editing ? "포트폴리오가 수정되었습니다." : "포트폴리오가 등록되었습니다.", { tone: "success" });

      api("/admin/portfolio/pdf/build", { method: "POST", body: "{}" }).catch(() => {});

    } catch (error) {

      writer.status.textContent = error.message || "저장에 실패했습니다.";

    } finally {

      writer.submit.disabled = false;

    }

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



  async function requireMember() {

    let member = state.member || window.getGongbangMember?.() || null;

    if (!member) {

      try {

        const payload = window.GongbangAuth?.fetchMe

          ? await window.GongbangAuth.fetchMe()

          : await api("/auth/me");

        member = payload.member || null;

        if (member) {

          state.member = member;

          if (payload.accessToken) sessionStorage.setItem(TOKEN_KEY, payload.accessToken);

          window.dispatchEvent(

            new CustomEvent("gongbang:auth-changed", { detail: { member } })

          );

        }

      } catch (_) {}

    }

    if (member) return member;

    if (typeof window.openGongbangAuth === "function") window.openGongbangAuth("login");

    throw new Error("login_required");

  }



  async function syncLikesForItems(items) {

    const ids = [...new Set(items.map((item) => String(item.id || "")).filter(Boolean))].slice(0, 80);

    if (!ids.length) return;

    try {

      const data = await api(`/portfolio/likes/stats?ids=${ids.map(encodeURIComponent).join(",")}`);

      const likes = data.likes || {};

      ids.forEach((id) => {

        const row = likes[id] || { likeCount: 0, likedByMe: false };

        state.likes[id] = {

          likeCount: Number(row.likeCount || 0),

          likedByMe: !!row.likedByMe,

        };

      });

    } catch (_) {

      /* keep prior */

    }

  }



  function likeStateOf(id) {

    return state.likes[String(id)] || { likeCount: 0, likedByMe: false };

  }



  function paintLikeButton(btn, id) {

    if (!btn) return;

    const info = likeStateOf(id);

    btn.classList.toggle("is-on", !!info.likedByMe);

    btn.setAttribute("aria-pressed", info.likedByMe ? "true" : "false");

    const count = btn.querySelector(".pf-like__count");

    if (count) count.textContent = info.likeCount > 0 ? String(info.likeCount) : "";

  }



  async function togglePortfolioLike(id, btn) {

    try {

      await requireMember();

      const result = await api(`/portfolio/${encodeURIComponent(id)}/like`, {

        method: "POST",

        body: "{}",

      });

      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'like-fix',hypothesisId:'H1',location:'portfolio-board.js:togglePortfolioLike',message:'like ok',data:{id:String(id),likeCount:result.likeCount,likedByMe:!!result.likedByMe},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      state.likes[String(id)] = {

        likeCount: Number(result.likeCount || 0),

        likedByMe: !!result.likedByMe,

      };

      paintLikeButton(btn, id);

    } catch (error) {

      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'like-fix',hypothesisId:'H1',location:'portfolio-board.js:togglePortfolioLike',message:'like fail',data:{id:String(id),error:String(error?.message||error||'').slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (error.message !== "login_required") {

        alert(error.message || "좋아요 실패");

      }

    }

  }



  function publishedAt(item) {

    return item.sortAt || item.uploadedAt || item.createdAt || item.publishedAt || "";

  }



  /** Newest-first list already — hide extras per brand without removing source data. */

  function capPerBrand(items) {
    // TEMP brand cap removed — full catalog like PDF
    return items;
  }
  function filteredItems() {

    const query = ((els.search && els.search.value) || "").trim().toLowerCase();

    return capPerBrand(state.items).filter((item) => {

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

        scrollToFirstCard();

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

    if (!els.grid) return;

    const filtered = filteredItems();

    const pageItems = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    const query = ((els.search && els.search.value) || "").trim();

    const label = query || state.category !== "ALL"

      ? `${filtered.length.toLocaleString("ko-KR")} works`

      : `${state.items.length.toLocaleString("ko-KR")} works`;

    if (els.count) els.count.textContent = label;

    if (els.status) {

      els.status.textContent = query || state.category !== "ALL"

        ? `필터 결과 ${filtered.length.toLocaleString("ko-KR")}개 · ${state.page}페이지`

        : `전체 ${state.items.length.toLocaleString("ko-KR")}개 · 사진을 눌러 추가 컷을 확인하세요`;

    }

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



    syncLikesForItems(pageItems).then(() => {

      els.grid.querySelectorAll(".pf-like[data-id]").forEach((btn) => {

        paintLikeButton(btn, btn.dataset.id);

      });

    });



    pageItems.forEach((item) => {

      const article = document.createElement("article");

      article.className = "pf-card";



      const thumb = document.createElement("div");

      thumb.className = "pf-thumb";

      thumb.setAttribute("role", "button");

      thumb.tabIndex = 0;

      thumb.setAttribute("aria-label", `${brandText(item.title)} 상세 보기`);



      if (item.category) {

        const tag = document.createElement("span");

        tag.className = "pf-cat-tag";

        tag.textContent = item.category;

        thumb.append(tag);

      }



      const likeBtn = document.createElement("button");

      likeBtn.type = "button";

      likeBtn.className = "pf-like";

      likeBtn.dataset.id = String(item.id);

      likeBtn.setAttribute("aria-label", "좋아요");

      likeBtn.innerHTML = `<span class="pf-like__icon" aria-hidden="true">♥</span><span class="pf-like__count"></span>`;

      paintLikeButton(likeBtn, item.id);

      likeBtn.addEventListener("click", (event) => {

        event.preventDefault();

        event.stopPropagation();

        togglePortfolioLike(item.id, likeBtn);

      });

      thumb.append(likeBtn);



      const img = document.createElement("img");

      img.src = assetUrl(item.cover || item.image);

      img.alt = "";

      img.loading = "lazy";

      img.decoding = "async";

      bindImgFallback(img);

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



      const open = () => openDetail(item);

      thumb.addEventListener("click", open);

      thumb.addEventListener("keydown", (event) => {

        if (event.key === "Enter" || event.key === " ") {

          event.preventDefault();

          open();

        }

      });

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

      bindImgFallback(img);

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



  async function deletePortfolioItem(item) {
    const id = item?.id;
    if (!id) return;
    if (!confirm(`"${item.title || "이 글"}" 포트폴리오를 삭제할까요?`)) return;

    await api(`/admin/boards/portfolio/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.items = (state.items || []).filter((entry) => entry.id !== id);

    state.page = 1;

    closeDetail();

    renderCats();

    renderList();

    showToast("포트폴리오가 삭제되었습니다.", { tone: "success" });

    api("/admin/portfolio/pdf/build", { method: "POST", body: "{}" }).catch(() => {});

  }



  function renderActions() {

    els.actions.replaceChildren();

    const canManage = state.member && state.member.role === "admin" && state.current;

    els.actions.hidden = !canManage;

    if (!canManage) return;



    const edit = document.createElement("button");

    edit.type = "button";

    edit.className = "detail-action";

    edit.textContent = "수정";

    edit.addEventListener("click", () => {

      openWriter(state.current);

    });



    const remove = document.createElement("button");

    remove.type = "button";

    remove.className = "detail-action danger";

    remove.textContent = "삭제";

    remove.addEventListener("click", async () => {

      remove.disabled = true;

      try {

        await deletePortfolioItem(state.current);

      } catch (error) {

        alert(error.message || String(error));

        remove.disabled = false;

      }

    });



    const manage = document.createElement("button");

    manage.type = "button";

    manage.className = "detail-action";

    manage.textContent = "전체관리";

    manage.addEventListener("click", () => {

      // Same tab keeps PWA/session cookies; popup opens a bare browser without login

      location.assign("/admin/portfolio/");

    });



    els.actions.append(edit, remove, manage);

  }




  function ensurePricePanel() {

    if (state.pricePanel) return state.pricePanel;

    if (!els.priceMount) {

      const mount = document.createElement("div");

      mount.id = "priceTrendMount";

      if (els.content && els.content.parentElement) {

        els.content.insertAdjacentElement("afterend", mount);

      } else if (els.meta && els.meta.parentElement) {

        els.meta.parentElement.append(mount);

      } else {

        return null;

      }

      els.priceMount = mount;

    }

    if (!window.HeritagePriceTrendPanel) return null;

    state.pricePanel = new window.HeritagePriceTrendPanel(els.priceMount, {

      getProduct: () => {

        const item = state.current;

        if (!item) return null;

        const cover = item.cover || item.image || (item.images && item.images[0]) || "";

        const imageAbs = /^https?:\/\//i.test(cover)

          ? cover

          : `${location.origin}/${String(cover).replace(/^\/+/, "")}`;

        return {

          id: item.id,

          title: brandText(item.title || ""),

          brand:

            item.brand ||

            window.HeritageBrandCodes?.resolveBrand?.(item.title, item.category)?.ko ||

            "",

          category: item.category || window.HeritageBrandCodes?.extractPortfolioCode?.(item.title) || "",

          imageUrl: imageAbs,

        };

      },

    });

    return state.pricePanel;

  }



  function loadPriceTrendAssets() {

    if (window.HeritagePriceTrendPanel) return Promise.resolve(true);

    if (!window.JEWELRY_PRICE_API) {

      window.JEWELRY_PRICE_API = "https://app.0-1.co.kr/api/jewelry-price/v1";

    }

    const bust = "20260728-pwa88";

    if (!document.querySelector('link[href*="price-trend-panel.css"]')) {

      const link = document.createElement("link");

      link.rel = "stylesheet";

      link.href = `./price-trend-panel.css?v=${bust}`;

      document.head.appendChild(link);

    }

    if (!document.querySelector('script[src*="price-trend-panel.js"]')) {

      return new Promise((resolve) => {

        const s = document.createElement("script");

        s.src = `./price-trend-panel.js?v=${bust}`;

        s.onload = () => resolve(!!window.HeritagePriceTrendPanel);

        s.onerror = () => resolve(false);

        document.head.appendChild(s);

      });

    }

    return Promise.resolve(!!window.HeritagePriceTrendPanel);

  }



  async function togglePriceTrend() {

    if (!window.HeritagePriceTrendPanel) {

      const ok = await loadPriceTrendAssets();

      if (!ok) {

        showToast("가격추세 모듈을 불러오지 못했습니다. 앱을 새로고침 해 주세요.", { tone: "error" });

        return false;

      }

    }

    const live = ensurePricePanel();

    if (!live) {

      showToast("가격추세 패널을 열 수 없습니다.", { tone: "error" });

      return false;

    }

    return live.toggle();

  }



  async function openDetail(item) {

    state.current = item;

    try {

      if (window.HxStore?.pushRecent) {

        window.HxStore.pushRecent(item);

      } else {

        const key = "hx.pwa.recent";

        const prev = JSON.parse(localStorage.getItem(key) || "[]");

        const id = String(item.id);

        const next = [

          { id, cover: item.cover || item.image || "", title: item.title || "", category: item.category || "" },

        ].concat((Array.isArray(prev) ? prev : []).filter((x) => x && String(x.id) !== id));

        localStorage.setItem(key, JSON.stringify(next.slice(0, 40)));

      }

    } catch (_) {}

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

    const panel = ensurePricePanel();

    if (panel) {

      panel.resetForProduct(item.id);

      panel.setExpanded(false);

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

        onPriceTrend: () => togglePriceTrend(),

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

    if (state.pricePanel) state.pricePanel.setExpanded(false);

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

    // Only hydrate first pages — never block the grid on full catalog views

    const limit = Math.min(ids.length, PAGE_SIZE * 3);

    for (let i = 0; i < limit; i += 200) {

      const chunk = ids.slice(i, i + 200);

      const views = await Promise.race([

        window.GongbangBoardMeta.fetchViews(BOARD, chunk),

        new Promise((resolve) => setTimeout(() => resolve({}), 2500)),

      ]);

      chunk.forEach((id) => {

        const item = items.find((row) => String(row.id) === String(id));

        if (item) item.viewCount = Number(views[String(id)]) || 0;

      });

    }

  }



  async function loadData() {

    if (els.status) els.status.textContent = "불러오는 중…";

    try {

      const [response, liveRes] = await Promise.all([
        fetch(`${DATA_PATH}?v=${Date.now()}`, { cache: "no-store" }),
        fetch(`${LIVE_API}?v=${Date.now()}`, { cache: "no-store" }).catch(() => null),
      ]);

      if (!response.ok) throw new Error("포트폴리오 데이터를 불러오지 못했습니다.");

      const payload = await response.json();
      let liveItems = [];
      if (liveRes && liveRes.ok) {
        try {
          const livePayload = await liveRes.json();
          liveItems = Array.isArray(livePayload?.items) ? livePayload.items : [];
          if (Array.isArray(livePayload?.categories) && livePayload.categories.length) {
            payload.categories = livePayload.categories;
          }
        } catch (_) {
          liveItems = [];
        }
      }

      state.categories = Array.isArray(payload.categories) && payload.categories.length

        ? payload.categories

        : [...new Set((payload.items || []).map((item) => item.category).filter(Boolean))];

      const map = new Map();
      (payload.items || []).forEach((entry) => { if (entry?.id) map.set(String(entry.id), entry); });
      liveItems.forEach((entry) => { if (entry?.id) map.set(String(entry.id), entry); });
      state.items = [...map.values()]

        .slice()

        .sort((a, b) => Date.parse(publishedAt(b) || 0) - Date.parse(publishedAt(a) || 0));

      state.loaded = true;

      try {

        const params = new URLSearchParams(location.search);

        const cat = params.get("cat") || sessionStorage.getItem("hx.portfolio.cat") || "";

        if (cat === "ALL" || (cat && state.categories.includes(cat))) {

          state.category = cat;

        }

        sessionStorage.removeItem("hx.portfolio.cat");

      } catch (_) {}

      // Paint list first — views API must never stall the catalog

      renderCats();

      renderList();

      loadViews(state.items)

        .then(() => {

          if (state.opened || !els.panel) renderList();

        })

        .catch(() => {});

    } catch (error) {

      if (els.status) els.status.textContent = error.message || "불러오기 실패";

      if (els.grid) {

        els.grid.replaceChildren();

        const empty = document.createElement("p");

        empty.className = "pf-empty";

        empty.textContent = "포트폴리오를 불러오지 못했습니다.";

        els.grid.append(empty);

      }

    }

  }



  async function bootSession() {

    try {

      const payload = window.GongbangAuth?.fetchMe

        ? await window.GongbangAuth.fetchMe()

        : await api("/auth/me");

      if (payload.member) {

        state.member = payload.member;

        if (payload.accessToken) sessionStorage.setItem(TOKEN_KEY, payload.accessToken);

        window.dispatchEvent(

          new CustomEvent("gongbang:auth-changed", { detail: { member: state.member } })

        );

      }

    } catch (_error) {

      // Keep prior member if auth-changed already confirmed login

      if (!state.member) state.member = window.getGongbangMember?.() || null;

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

  els.write?.addEventListener("click", () => openWriter());

  els.openButton?.addEventListener("click", openPortfolioPanel);

  els.closeButton?.addEventListener("click", () => closePortfolioPanel());

  window.addEventListener("gongbang:auth-changed", (event) => {

    state.member = event.detail?.member || null;

    renderSession();

    if (state.current) renderActions();

  });



  // Do not register a recursive openGongbangAuth stub — gongbang-auth.js owns it

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

    const itemId = params.get("id");

    const onPortfolioPage = /\/portfolio\.html$/i.test(location.pathname);

    // App shell: portfolio is its own page, not an overlay panel

    const isApp =

      document.documentElement.classList.contains("is-pwa") ||

      /[?&]app=1(?:&|$)/.test(location.search) ||

      (window.matchMedia &&

        (window.matchMedia("(display-mode: standalone)").matches ||

          window.matchMedia("(display-mode: fullscreen)").matches ||

          window.matchMedia("(display-mode: minimal-ui)").matches)) ||

      window.navigator.standalone === true;

    if (isApp && els.panel && params.get("open") === "portfolio") {

      const q = new URLSearchParams();

      if (params.get("app") === "1") q.set("app", "1");

      if (itemId) q.set("id", itemId);

      if (params.get("cat")) q.set("cat", params.get("cat"));

      const qs = q.toString();

      location.replace(`./portfolio.html${qs ? `?${qs}` : ""}`);

      return;

    }



    const waitReady = async () => {

      if (!state.loaded && (!els.panel || els.panel.hidden === false || onPortfolioPage)) {

        // ensure data load started

        if (!state.opened) {

          state.opened = true;

          loadData();

        }

      }

      const started = Date.now();

      while (!state.loaded && Date.now() - started < 15000) {

        await new Promise((r) => setTimeout(r, 80));

      }

    };



    // Landing overlay: ?open=portfolio&id=

    if (params.get("open") === "portfolio" && els.panel) {

      openPortfolioPanel();

      if (!itemId) return;

      await waitReady();

      const item = state.items.find((row) => String(row.id) === String(itemId));

      if (item) await openDetail(item);

      return;

    }



    // Standalone portfolio.html?id= (and optional cat)

    if (onPortfolioPage && itemId) {

      await waitReady();

      const item = state.items.find((row) => String(row.id) === String(itemId));

      if (item) await openDetail(item);

    }

  }

  
  // Responsive page size: mobile 6 / tablet 8 / desktop 12
  if (!window.__hxPageSizeResizeBound) {
    window.__hxPageSizeResizeBound = true;
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const next = pageSizeForViewport();
        if (next === PAGE_SIZE) return;
        PAGE_SIZE = next;
        state.page = 1;
        if (typeof render === "function") render();
        else if (typeof renderGrid === "function") renderGrid();
      }, 120);
    });
  }

  openFromQuery();

})();

