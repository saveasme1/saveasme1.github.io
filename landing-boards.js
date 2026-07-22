(() => {
  "use strict";

  const RAW = "https://raw.githubusercontent.com/saveasme1/gongbang171_temp/main";
  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  const $ = (id) => document.getElementById(id);

  const boards = {
    shipping: {
      open: null,
      close: null,
      section: $("shippingPanel"),
      search: null,
      status: null,
      count: null,
      list: null,
      pager: null,
      write: null,
      dataPath: "shipping-data.json",
      empty: "등록된 출고 게시글이 없습니다.",
      adminPath: "/admin/shipping/",
      page: 1,
      pageSize: 12,
    },
    notices: {
      open: $("noticesOpen"),
      close: $("noticesClose"),
      section: $("noticesPanel"),
      search: $("noticesSearch"),
      status: $("noticesStatus"),
      count: $("noticesCount"),
      list: $("noticesList"),
      write: $("noticesWrite"),
      dataPath: "notices-data.json",
      empty: "등록된 공지사항이 없습니다.",
      adminPath: "/admin/notices/",
    },
  };

  const dialog = {
    root: $("boardDialog"),
    close: $("boardClose"),
    title: $("detailTitle"),
    meta: $("detailMeta"),
    content: $("detailContent"),
    images: $("detailImages"),
    actions: $("detailActions"),
  };
  const writer = {
    root: $("boardWriteDialog"),
    form: $("boardWriteForm"),
    title: $("boardWriteTitle"),
    status: $("boardWriteStatus"),
    submit: $("boardWriteSubmit"),
    cancel: $("boardWriteCancel"),
  };
  const writerHtmlEditor = window.GongbangHtmlEditor?.mount(writer.form?.elements.content);

  if (!boards.shipping.section || !boards.notices.section || !dialog.root) return;

  const state = {
    shipping: [],
    notices: [],
    active: "",
    current: null,
    currentType: "",
    member: null,
    slideIndex: 0,
    slideCount: 0,
  };

  const assetUrl = (value) => {
    const path = String(value || "").replace(/^\/+/, "");
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return `${RAW}/${path}`;
  };
  const formatDate = (value) => (window.GongbangTime ? window.GongbangTime.formatDate(value) : "");
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

  function closeReviewsPanel() {
    if (typeof window.closeGongbangReviewsPanel === "function") {
      window.closeGongbangReviewsPanel();
    } else {
      const reviews = $("reviews");
      if (reviews) reviews.hidden = true;
    }
  }

  function closeBoardPanels(except = "") {
    Object.entries(boards).forEach(([type, board]) => {
      if (type === except) return;
      board.section.hidden = true;
    });
    if (!except) state.active = "";
  }

  function closeDetail() {
    dialog.root.classList.remove("open");
    dialog.root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dialog-open");
    dialog.images.replaceChildren();
    state.slideIndex = 0;
    state.slideCount = 0;
    state.current = null;
    state.currentType = "";
  }

  function updateCarousel() {
    const viewport = dialog.images.querySelector(".board-carousel-viewport");
    const track = dialog.images.querySelector(".board-carousel-track");
    const counter = dialog.images.querySelector(".board-carousel-counter");
    const prev = dialog.images.querySelector("[data-slide='prev']");
    const next = dialog.images.querySelector("[data-slide='next']");
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
    dialog.images.replaceChildren();
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

    dialog.images.append(carousel);
    updateCarousel();
  }

  function renderActions() {
    if (!dialog.actions) return;
    dialog.actions.replaceChildren();
    const canManage = state.member && state.member.role === "admin" && state.current && state.currentType;
    dialog.actions.hidden = !canManage;
    if (!canManage) return;

    const edit = document.createElement("a");
    edit.className = "detail-action";
    edit.href = `${boards[state.currentType].adminPath}?edit=${encodeURIComponent(state.current.id)}`;
    edit.textContent = "수정";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "detail-action danger";
    remove.textContent = "삭제";
    remove.addEventListener("click", async () => {
      if (!confirm(`“${state.current.title}” 게시글을 삭제할까요?`)) return;
      remove.disabled = true;
      try {
        const type = state.currentType;
        const id = state.current.id;
        const [published, draft] = await Promise.all([
          api(`/admin/files?${new URLSearchParams({ path: `${type}-data.json`, _: Date.now() })}`),
          api(`/admin/files?${new URLSearchParams({ path: `${type}-draft.json`, _: Date.now() })}`),
        ]);
        const publishedValue = JSON.parse(decodeBase64(published.file.content));
        const draftValue = JSON.parse(decodeBase64(draft.file.content));
        publishedValue.items = (publishedValue.items || []).filter((item) => item.id !== id);
        draftValue.items = (draftValue.items || []).filter((item) => item.id !== id);
        await api("/admin/files", {
          method: "PUT",
          body: JSON.stringify({
            path: `${type}-draft.json`,
            sha: draft.file.sha,
            content: textToBase64(JSON.stringify(draftValue)),
            message: `${type}: delete ${id}`,
          }),
        });
        await api("/admin/files", {
          method: "PUT",
          body: JSON.stringify({
            path: `${type}-data.json`,
            sha: published.file.sha,
            content: textToBase64(JSON.stringify(publishedValue)),
            message: `${type}: delete ${id}`,
          }),
        });
        state[type] = state[type].filter((item) => item.id !== id);
        closeDetail();
        renderList(type);
      } catch (error) {
        alert(error.message);
        remove.disabled = false;
      }
    });
    dialog.actions.append(edit, remove);
  }

  async function openDetail(type, item) {
    state.current = item;
    state.currentType = type;
    let viewCount = Number(item.viewCount) || 0;
    if (window.GongbangBoardMeta?.bumpView) {
      viewCount = await window.GongbangBoardMeta.bumpView(type, item.id);
      item.viewCount = viewCount;
    }
    window.GongbangTime.renderPostTitle(dialog.title, item.title, item.publishedAt);
    if (window.GongbangBoardMeta?.renderMetaRow) {
      window.GongbangBoardMeta.renderMetaRow(dialog.meta, {
        dateText: formatDate(item.publishedAt),
        viewCount,
      });
    }
    if (window.GongbangHtmlEditor) {
      window.GongbangHtmlEditor.renderSafe(dialog.content, item.content || "");
    } else {
      dialog.content.textContent = item.content || "";
    }
    window.GongbangBoardMeta?.setupContentClamp?.(dialog.content);
    renderCarousel(item);
    renderActions();
    dialog.root.classList.add("open");
    dialog.root.setAttribute("aria-hidden", "false");
    document.body.classList.add("dialog-open");
    if (boards[type]) renderList(type);
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

  async function uploadImage(type, file, id, role, index = 0) {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error(`${file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
    }
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type] || "jpg";
    const suffix = index ? `-${index}` : "";
    const path = `${type}/uploads/${id}/${role}${suffix}-${Date.now()}.${ext}`;
    const content = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    await putManaged(path, content, `${type}: upload ${id} ${role}${suffix}`);
    return path;
  }

  function openWriter(type) {
    if (!state.member || state.member.role !== "admin") {
      if (typeof window.showGongbangToast === "function") {
        window.showGongbangToast("글쓰기 권한이 없습니다.", { tone: "error", duration: 2600 });
      }
      return;
    }
    writer.form.reset();
    writer.form.elements.boardType.value = type;
    writer.title.textContent = type === "shipping" ? "실시간 출고 작성" : "공지사항 작성";
    writer.status.textContent = "";
    writer.submit.disabled = false;
    writerHtmlEditor?.reset?.();
    writer.root.showModal();
  }

  async function submitWriter(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const type = form.elements.boardType.value;
    const coverFile = form.elements.cover.files[0];
    const detailFiles = [...form.elements.images.files];
    if (!boards[type] || !coverFile) return;
    if (detailFiles.length > 8) {
      writer.status.textContent = "추가 이미지는 최대 8장까지 등록할 수 있습니다.";
      return;
    }
    writer.submit.disabled = true;
    try {
      const id = `admin-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      writer.status.textContent = "대표 이미지 업로드 중…";
      const cover = await uploadImage(type, coverFile, id, "cover");
      const images = [];
      for (let index = 0; index < detailFiles.length; index += 1) {
        writer.status.textContent = `추가 이미지 업로드 중 ${index + 1} / ${detailFiles.length}`;
        images.push(await uploadImage(type, detailFiles[index], id, "detail", index + 1));
      }

      writer.status.textContent = "게시글을 저장하고 공개하는 중…";
      const [publishedFile, draftFile] = await Promise.all([
        readManaged(`${type}-data.json`, true),
        readManaged(`${type}-draft.json`, true),
      ]);
      const now = window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString();
      const item = {
        id,
        title: form.elements.title.value.trim(),
        content: form.elements.content.value.trim(),
        cover,
        image: cover,
        images,
        publishedAt: now,
        updatedAt: now,
        category:
          type === "shipping"
            ? detectShippingCategory(form.elements.title.value, form.elements.content.value)
            : undefined,
      };
      const baseItems = publishedFile?.value?.items || [];
      const published = {
        version: 1,
        publishedAt: now,
        items: [item, ...baseItems.filter((entry) => entry.id !== id)],
      };
      const draftItems = draftFile?.value?.items || baseItems;
      const draft = {
        version: 1,
        items: [item, ...draftItems.filter((entry) => entry.id !== id)],
      };
      await putManaged(
        `${type}-draft.json`,
        textToBase64(JSON.stringify(draft)),
        `${type} draft: create ${id}`,
        draftFile?.sha || ""
      );
      await putManaged(
        `${type}-data.json`,
        textToBase64(JSON.stringify(published)),
        `${type}: publish ${id}`,
        publishedFile?.sha || ""
      );
      state[type] = published.items;
      boards[type].page = 1;
      renderList(type);
      writer.root.close();
      form.reset();
    } catch (error) {
      writer.status.textContent = error.message;
    } finally {
      writer.submit.disabled = false;
    }
  }

  function renderPager(type, total) {
    const board = boards[type];
    if (!board.pager) return;
    board.pager.replaceChildren();
    const pages = Math.max(1, Math.ceil(total / board.pageSize));
    board.page = Math.min(board.page, pages);
    const add = (label, page, disabled, active = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      button.classList.toggle("is-active", active);
      button.addEventListener("click", () => {
        board.page = page;
        renderList(type);
        board.section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      board.pager.append(button);
    };
    add("‹", board.page - 1, board.page <= 1);
    const first = Math.max(1, board.page - 2);
    const last = Math.min(pages, first + 4);
    for (let page = first; page <= last; page += 1) {
      add(String(page), page, false, page === board.page);
    }
    add("›", board.page + 1, board.page >= pages);
  }

  function renderList(type) {
    const board = boards[type];
    const query = board.search.value.trim().toLowerCase();
    const filtered = state[type].filter(
      (item) => !query || `${item.title} ${item.content || ""}`.toLowerCase().includes(query)
    );
    const items = type === "shipping"
      ? filtered.slice((board.page - 1) * board.pageSize, board.page * board.pageSize)
      : filtered;
    board.list.replaceChildren();
    board.status.textContent = query
      ? `검색 결과 ${filtered.length}개`
      : `전체 ${state[type].length}개`;
    if (board.count) {
      board.count.textContent = query
        ? `${filtered.length.toLocaleString("ko-KR")} found`
        : `${state[type].length.toLocaleString("ko-KR")} posts`;
    }
    renderPager(type, filtered.length);

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "board-empty";
      empty.textContent = query ? "검색 결과가 없습니다." : board.empty;
      board.list.append(empty);
      return;
    }

    items.forEach((item, index) => {
      const row = document.createElement("button");
      row.type = "button";
      if (type === "shipping") {
        const article = document.createElement("article");
        article.className = "review-card";
        row.className = "review-thumb";
        row.setAttribute("aria-label", `${item.title} 상세 보기`);
        const img = document.createElement("img");
        img.src = assetUrl(item.cover || item.image);
        img.alt = "";
        img.loading = "lazy";
        row.append(img);
        const heading = document.createElement("strong");
        heading.className = "review-title";
        window.GongbangTime.renderPostTitle(heading, item.title, item.publishedAt);
        const published = document.createElement("span");
        published.className = "review-card-meta";
        const viewsText = window.GongbangBoardMeta
          ? window.GongbangBoardMeta.formatViews(item.viewCount)
          : `조회 ${Number(item.viewCount) || 0}`;
        published.textContent = `${formatDate(item.publishedAt)} · ${viewsText}`;
        row.addEventListener("click", () => openDetail(type, item));
        article.append(row, heading, published);
        board.list.append(article);
      } else {
        row.className = "notice-row";
        const number = document.createElement("span");
        number.textContent = String(items.length - index);
        const heading = document.createElement("strong");
        window.GongbangTime.renderPostTitle(heading, item.title, item.publishedAt);
        const published = document.createElement("span");
        published.className = "notice-meta";
        const viewsText = window.GongbangBoardMeta
          ? window.GongbangBoardMeta.formatViews(item.viewCount)
          : `조회 ${Number(item.viewCount) || 0}`;
        published.textContent = `${formatDate(item.publishedAt)} · ${viewsText}`;
        row.append(number, heading, published);
      }
      if (type !== "shipping") {
        row.addEventListener("click", () => openDetail(type, item));
        board.list.append(row);
      }
    });
  }

  async function loadBoard(type) {
    const board = boards[type];
    board.status.textContent = "불러오는 중…";
    try {
      const response = await fetch(`${board.dataPath}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("게시판 데이터를 불러오지 못했습니다.");
      const payload = await response.json();
      state[type] = (payload.items || []).sort(
        (a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0)
      );
      if (window.GongbangBoardMeta?.fetchViews && state[type].length) {
        const views = await window.GongbangBoardMeta.fetchViews(
          type,
          state[type].map((item) => item.id)
        );
        state[type].forEach((item) => {
          item.viewCount = Number(views[String(item.id)]) || 0;
        });
      }
      renderList(type);
    } catch (error) {
      state[type] = [];
      board.list.innerHTML = `<p class="board-empty">${error.message}</p>`;
      board.status.textContent = error.message;
    }
  }

  async function openBoard(type) {
    if (type === "shipping") {
      if (typeof window.openGongbangShippingPanel === "function") {
        window.openGongbangShippingPanel();
      }
      return;
    }
    if (typeof window.closeGongbangPortfolioPanel === "function") {
      window.closeGongbangPortfolioPanel({ skipNav: true });
    }
    if (typeof window.closeGongbangShippingPanel === "function") {
      window.closeGongbangShippingPanel({ skipNav: true });
    }
    closeReviewsPanel();
    closeBoardPanels(type);
    closeDetail();
    state.active = type;
    const board = boards[type];
    board.page = 1;
    board.section.hidden = false;
    if (window.GongbangSiteNav?.setActiveNav) window.GongbangSiteNav.setActiveNav(type);
    if (typeof window.GongbangScrollToElement === "function") {
      window.GongbangScrollToElement(board.section);
    } else {
      board.section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    await loadBoard(type);
  }

  function closeBoard(type, options = {}) {
    if (type === "shipping") {
      if (typeof window.closeGongbangShippingPanel === "function") {
        window.closeGongbangShippingPanel(options);
      }
      return;
    }
    boards[type].section.hidden = true;
    if (state.active === type) state.active = "";
    if (state.currentType === type) closeDetail();
    if (!options.skipNav && window.GongbangSiteNav?.setActiveNav) {
      window.GongbangSiteNav.setActiveNav(window.GongbangSiteNav.detectActivePanel?.() || "home");
    }
  }

  window.closeGongbangBoardPanels = (options = {}) => {
    if (typeof window.closeGongbangShippingPanel === "function") {
      window.closeGongbangShippingPanel({ skipNav: true });
    }
    closeBoardPanels();
    closeDetail();
    if (!options.skipNav && window.GongbangSiteNav?.setActiveNav) {
      const next = window.GongbangSiteNav.detectActivePanel?.() || "home";
      window.GongbangSiteNav.setActiveNav(next);
    }
  };
  window.openGongbangBoardPanel = openBoard;
  window.openGongbangBoardWriter = openWriter;
  window.openGongbangBoardDetail = (type, item) => openDetail(type, item);
  window.closeGongbangNoticesPanel = (options = {}) => closeBoard("notices", options);

  function detectShippingCategory(title, content) {
    const titleText = String(title || "");
    const bodyText = String(content || "");
    const lead = titleText.trim().match(/^([A-Za-z0-9&]+)/);
    if (lead) {
      const token = lead[1].toUpperCase().replace(/\s+/g, "");
      const leadMap = {
        "C&H": "C&H", CH: "C&H", VCA: "VCA", VC: "VCA", BO: "BO", CM: "CM", CL: "CL",
        BV: "B", "T&CO": "ETC", TCO: "ETC", FR: "F", DC: "ETC", CD: "ETC",
        C: "C", B: "B", G: "G", H: "H", P: "P", F: "F", ETC: "ETC",
      };
      if (leadMap[token]) return leadMap[token];
    }
    const rules = [
      [/\bC\s*&\s*H\b|C&H/i, "C&H"],
      [/\bVCA\b|반클리프|알함브라/i, "VCA"],
      [/\bBO\b|불가리|Bulgari|BVLGARI/i, "BO"],
      [/\bCM\b|샤넬|Chanel/i, "CM"],
      [/\bCL\b|셀린|Celine/i, "CL"],
      [/\bBV\b|보테가/i, "B"],
      [/\bT\s*&\s*CO\b|T&CO|티파니|Tiffany/i, "ETC"],
      [/\bFR\b|프레드|Fred\b/i, "F"],
      [/\bC\b|까르띠에|Cartier/i, "C"],
      [/\bB\b|부쉐론|Boucheron/i, "B"],
      [/\bG\b|구찌|Gucci/i, "G"],
      [/\bH\b|에르메스|Hermes|Hermès/i, "H"],
      [/\bP\b|피아제|Piaget/i, "P"],
      [/\bF\b|프레드|Fred\b/i, "F"],
    ];
    for (const [re, cat] of rules) if (re.test(titleText)) return cat;
    for (const [re, cat] of rules) if (re.test(bodyText)) return cat;
    return "ETC";
  }

  function renderBoardSession() {
    const allowed = Boolean(state.member && state.member.role === "admin");
    Object.values(boards).forEach((board) => {
      if (board.write) {
        board.write.hidden = !allowed;
        board.write.textContent = "글 작성하기";
      }
      const actions = board.write?.closest(".reviews-toolbar-actions, .pf-tools-actions");
      if (actions) actions.hidden = !allowed;
    });
    ["noticesSession"].forEach((id) => {
      const host = $(id);
      if (host) host.replaceChildren();
    });
    if (state.current) renderActions();
  }

  Object.entries(boards).forEach(([type, board]) => {
    if (type === "shipping") return;
    if (board.open) board.open.addEventListener("click", () => openBoard(type));
    if (board.close) board.close.addEventListener("click", () => closeBoard(type));
    if (board.search) board.search.addEventListener("input", () => {
      board.page = 1;
      renderList(type);
    });
    if (board.write) board.write.addEventListener("click", () => openWriter(type));
  });
  writer.form.addEventListener("submit", async (event) => {
    await submitWriter(event);
    if (writer.form.elements.boardType.value === "shipping") {
      window.refreshGongbangShippingBoard?.();
    }
  });
  writer.cancel.addEventListener("click", () => writer.root.close());

  dialog.close.addEventListener("click", closeDetail);
  dialog.root.addEventListener("click", (event) => {
    if (event.target === dialog.root) closeDetail();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetail();
  });

  api("/auth/me")
    .then((payload) => {
      state.member = payload.member;
      renderBoardSession();
    })
    .catch(() => {
      state.member = null;
      renderBoardSession();
    });

  window.addEventListener("gongbang:auth-changed", (event) => {
    state.member = event.detail?.member || null;
    renderBoardSession();
  });

  const wanted = new URLSearchParams(location.search).get("open");
  if (wanted === "shipping" || wanted === "notices") {
    openBoard(wanted);
  }
})();
