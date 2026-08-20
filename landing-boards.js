(() => {
  "use strict";

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
  const SHIPPING_CATEGORIES = ["C", "B", "VCA", "BO", "CM", "C&H", "CL", "G", "H", "P", "F", "ETC"];
  const writer = {
    root: $("boardWriteDialog"),
    form: $("boardWriteForm"),
    title: $("boardWriteTitle"),
    status: $("boardWriteStatus"),
    submit: $("boardWriteSubmit"),
    cancel: $("boardWriteCancel"),
    help: $("boardWriteHelp"),
    coverPreview: $("boardCoverPreview"),
    detailGrid: $("boardDetailGrid"),
    shippingMeta: $("boardShippingMeta"),
    shipCatChips: $("boardShipCatChips"),
    cover: { path: "", file: null, preview: "" },
    details: [],
    editing: null,
  };
  const writerHtmlEditor = window.GongbangHtmlEditor?.mount(writer.form?.elements.content);

  if (!dialog.root) return;
  const noticesOnly = /notices\.html(?:$|\?)/i.test(location.pathname + location.search) ||
    /\/notices\.html$/i.test(location.pathname);
  if (noticesOnly) {
    if (!boards.notices.section) return;
  } else if (!boards.shipping.section || !boards.notices.section) {
    return;
  }
  if (!writer.root || !writer.form) return;

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

  // Serve board images from this site (hand-made.kr / github.io), not private raw.githubusercontent.
  const PAGES_ASSET_ORIGIN = "https://saveasme1.github.io";
  const assetUrl = (value) => {
    const path = String(value || "").trim();
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const clean = path.replace(/^\/+/, "");
    if (/^(shipping|groupbuy|portfolio|notices)\//i.test(clean)) {
      return `${PAGES_ASSET_ORIGIN}/${clean}`;
    }
    return `/${clean}`;
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
      // Standalone pages (notices.html) omit other panels — never touch null sections.
      if (board.section) board.section.hidden = true;
    });
    if (!except) state.active = "";
    const gb = document.getElementById("groupbuyPanel");
    if (gb && except !== "groupbuy") gb.hidden = true;
  }

  function closeDetail() {
    window.GongbangBoardMedia?.pauseAll?.(dialog.images);
    dialog.root.classList.remove("open");
    dialog.root.setAttribute("aria-hidden", "true");
    dialog.root.removeAttribute("data-board-type");
    document.body.classList.remove("dialog-open", "notice-page-view");
    dialog.images.replaceChildren();
    state.slideIndex = 0;
    state.slideCount = 0;
    state.current = null;
    state.currentType = "";
  }

  function noticesListQuery() {
    const out = new URLSearchParams();
    const cur = new URLSearchParams(location.search);
    if (cur.get("app") === "1" || document.documentElement.classList.contains("is-pwa")) {
      out.set("app", "1");
    }
    const pwa = cur.get("_pwa");
    if (pwa) out.set("_pwa", pwa);
    return out.toString();
  }

  function noticeDetailHref(id) {
    const q = new URLSearchParams(noticesListQuery());
    q.set("id", String(id || "").trim());
    return `./notice-view.html?${q.toString()}`;
  }

  function navigateNoticeDetail(item) {
    const id = String(item?.id || "").trim();
    if (!id) return;
    // Dedicated notice detail page (not same-page overlay).
    location.href = noticeDetailHref(id);
    // #region agent log
    fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'post-fix',hypothesisId:'NP3',location:'landing-boards.js:navigateNoticeDetail',message:'navigate to notice-view.html',data:{id,href:noticeDetailHref(id),from:location.pathname},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    fitNoticeCarousel(viewport, track);
    window.GongbangBoardMedia?.syncPlayback?.(dialog.images, state.slideIndex);
  }

  /** Notices: viewport height = active slide image only (no black void from taller siblings). */
  function fitNoticeCarousel(viewport, track) {
    if (state.currentType !== "notices") return;
    const vp = viewport || dialog.images.querySelector(".board-carousel-viewport");
    const tr = track || dialog.images.querySelector(".board-carousel-track");
    if (!vp || !tr) return;
    const slides = [...tr.children];
    const active = slides[state.slideIndex];
    const media = active?.querySelector("img, video");
    if (!media) return;

    const apply = () => {
      const boxW = Math.max(
        0,
        (dialog.images?.clientWidth || 0) ||
          vp.clientWidth ||
          vp.getBoundingClientRect().width ||
          0
      );
      const natW = media.naturalWidth || media.videoWidth || 0;
      const natH = media.naturalHeight || media.videoHeight || 0;
      if (!natW || !natH) return;
      // Never upscale past natural pixel width (stops blurry PC blow-ups).
      let displayW = Math.max(1, Math.min(boxW || natW, natW));
      let displayH = Math.round((natH * displayW) / natW);
      const maxH =
        window.innerWidth >= 1100
          ? Math.min(Math.round(window.innerHeight * 0.62), 560)
          : Number.POSITIVE_INFINITY;
      if (displayH > maxH) {
        displayH = Math.round(maxH);
        displayW = Math.max(1, Math.round((natW * displayH) / natH));
      }
      if (displayH < 8) return;
      media.style.setProperty("width", `${displayW}px`, "important");
      media.style.setProperty("max-width", "100%", "important");
      media.style.setProperty("height", "auto", "important");
      media.style.setProperty("margin", "0 auto", "important");
      media.style.setProperty("display", "block", "important");
      vp.style.setProperty("height", `${displayH}px`, "important");
      vp.style.setProperty("overflow", "hidden", "important");
      tr.style.setProperty("height", `${displayH}px`, "important");
      tr.style.setProperty("align-items", "flex-start", "important");
      slides.forEach((slide, index) => {
        slide.style.setProperty("height", index === state.slideIndex ? `${displayH}px` : "auto", "important");
        slide.style.setProperty("overflow", "hidden", "important");
        slide.style.setProperty("display", "block", "important");
        slide.style.setProperty("text-align", "center", "important");
      });
      const di = dialog.images;
      if (di) di.style.setProperty("height", `${displayH}px`, "important");
      const car = vp.closest(".board-carousel");
      if (car) car.style.setProperty("height", `${displayH}px`, "important");
    };

    const ready =
      (media.tagName === "VIDEO" && media.videoWidth) ||
      (media.tagName === "IMG" && media.complete && media.naturalWidth);
    if (ready) {
      requestAnimationFrame(apply);
    } else {
      media.addEventListener(
        media.tagName === "VIDEO" ? "loadedmetadata" : "load",
        () => requestAnimationFrame(apply),
        { once: true }
      );
      media.addEventListener(
        "error",
        () => {
          vp.style.height = "0px";
        },
        { once: true }
      );
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

    // Notice page view: stack tall images vertically (full-page scroll, no modal carousel).
    if (
      state.currentType === "notices" &&
      document.body.classList.contains("notice-page-view")
    ) {
      const stack = document.createElement("div");
      stack.className = "notice-page-stack";
      paths.forEach((path, index) => {
        const media = window.GongbangBoardMedia?.createSlideMedia
          ? window.GongbangBoardMedia.createSlideMedia(assetUrl(path), { eager: index === 0 })
          : (() => {
              const img = document.createElement("img");
              img.src = assetUrl(path);
              img.alt = "";
              img.loading = index === 0 ? "eager" : "lazy";
              return img;
            })();
        if (media.tagName === "IMG" && window.GongbangProtectImage) window.GongbangProtectImage(media);
        stack.append(media);
      });
      dialog.images.append(stack);
      return;
    }

    const carousel = document.createElement("div");
    carousel.className = "board-carousel";
    const viewport = document.createElement("div");
    viewport.className = "board-carousel-viewport";
    const track = document.createElement("div");
    track.className = "board-carousel-track";
    paths.forEach((path, index) => {
      const slide = document.createElement("div");
      slide.className = "board-carousel-slide";
      const media = window.GongbangBoardMedia?.createSlideMedia
        ? window.GongbangBoardMedia.createSlideMedia(assetUrl(path), { eager: index === 0 })
        : (() => {
            const img = document.createElement("img");
            img.src = assetUrl(path);
            img.alt = "";
            img.loading = index === 0 ? "eager" : "lazy";
            return img;
          })();
      if (media.tagName === "IMG" && window.GongbangProtectImage) window.GongbangProtectImage(media);
      slide.append(media);
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
        makeButton("prev", "이전", "‹"),
        makeButton("next", "다음", "›"),
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

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "detail-action";
    edit.textContent = "수정";
    edit.addEventListener("click", () => {
      const type = state.currentType;
      const item = state.current;
      if (!type || !item) return;
      openWriter(type, item);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "detail-action danger";
    remove.textContent = "삭제";
    remove.addEventListener("click", async () => {
      if (!confirm(`“${state.current.title}” 게시글을 삭제할까요?`)) return;
      remove.disabled = true;
      const startedAt = Date.now();
      try {
        const type = state.currentType;
        const id = state.current.id;
        if (type === "shipping" || type === "notices") {
          // #region agent log
          fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'delete-fix',hypothesisId:'D',location:'landing-boards.js:remove',message:'board delete start',data:{type,id,title:state.current?.title||''},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          const result = await api(`/admin/boards/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: "DELETE" });
          // #region agent log
          fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'delete-fix',hypothesisId:'D',location:'landing-boards.js:remove',message:'board delete ok',data:{type,id,removed:result?.removed,liveCount:result?.liveCount,serverMs:result?.ms,totalMs:Date.now()-startedAt,via:result?.via},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          state[type] = (state[type] || []).filter((item) => item.id !== id);
          if (type === "shipping") window.removeGongbangShippingItem?.(id);
          else renderList(type);
          closeDetail();
          if (typeof window.showGongbangToast === "function") {
            window.showGongbangToast("게시글을 삭제했습니다.", { tone: "success", duration: 1800 });
          }
          return;
        }
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
        // #region agent log
        fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'delete-fix',hypothesisId:'D',location:'landing-boards.js:remove',message:'delete fail',data:{error:String(error?.message||error||'').slice(0,200),totalMs:Date.now()-startedAt},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        alert(error.message);
        remove.disabled = false;
      }
    });
    dialog.actions.append(edit, remove);
  }

  async function openDetail(type, item) {
    state.current = item;
    state.currentType = type;
    if (dialog.root) dialog.root.dataset.boardType = type;
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
    if (document.body.classList.contains("notice-page-view")) {
      // Full page notice: never lock body scroll like a modal.
      document.body.classList.remove("dialog-open");
      applyNoticePageLayout();
    } else {
      document.body.classList.add("dialog-open");
    }
    // #region agent log
    requestAnimationFrame(() => {
      const img = dialog.images?.querySelector?.("img");
      const body = dialog.root?.querySelector?.(".board-detail-body");
      const slide = dialog.images?.querySelector?.(".board-carousel-slide");
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'notice-img',hypothesisId:'N1',location:'landing-boards.js:openDetail',message:'notice detail image metrics',data:{type,id:item?.id||'',imgNatW:img?.naturalWidth||0,imgNatH:img?.naturalHeight||0,imgCssH:img?Math.round(img.getBoundingClientRect().height):0,slideH:slide?Math.round(slide.getBoundingClientRect().height):0,bodyScrollH:body?.scrollHeight||0,bodyClientH:body?.clientHeight||0,canScroll:Boolean(body&&body.scrollHeight>body.clientHeight+8),boardType:dialog.root?.dataset?.boardType||'',pageView:document.body.classList.contains('notice-page-view'),dialogOpen:document.body.classList.contains('dialog-open')},timestamp:Date.now()})}).catch(()=>{});
    });
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'pre-fix',hypothesisId:'A',location:'landing-boards.js:putManaged',message:'put start',data:{path,shaLen:String(sha||'').length,contentLen:String(content||'').length,message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      const result = await api("/admin/files", {
        method: "PUT",
        body: JSON.stringify({ path, content, message, sha }),
      });
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'pre-fix',hypothesisId:'A',location:'landing-boards.js:putManaged',message:'put ok',data:{path,hasContent:Boolean(result?.content),hasPublic:Boolean(result?.publicCommit)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return result;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'pre-fix',hypothesisId:'B',location:'landing-boards.js:putManaged',message:'put fail',data:{path,shaLen:String(sha||'').length,error:String(error?.message||error||'')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw error;
    }
  }

  async function putManagedFresh(path, content, message, sha = "") {
    try {
      return await putManaged(path, content, message, sha);
    } catch (error) {
      const msg = String(error?.message || error || "");
      if (!/409|422|sha|conflict|already|존재|충돌|is at|expected/i.test(msg)) throw error;
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'pre-fix',hypothesisId:'C',location:'landing-boards.js:putManagedFresh',message:'sha retry',data:{path,error:msg.slice(0,180)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const fresh = await readManaged(path, true);
      return putManaged(path, content, message, fresh?.sha || "");
    }
  }

  async function putManagedBatch(files, message) {
    const startedAt = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'speed-fix',hypothesisId:'S',location:'landing-boards.js:putManagedBatch',message:'batch start',data:{fileCount:files.length,paths:files.map((f)=>f.path),message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      const result = await api("/admin/files/batch", {
        method: "PUT",
        body: JSON.stringify({ files, message }),
      });
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'speed-fix',hypothesisId:'S',location:'landing-boards.js:putManagedBatch',message:'batch ok',data:{fileCount:files.length,ms:Date.now()-startedAt,serverMs:result?.ms||null,via:result?.via||null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return result;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'speed-fix',hypothesisId:'S',location:'landing-boards.js:putManagedBatch',message:'batch fail',data:{fileCount:files.length,ms:Date.now()-startedAt,error:String(error?.message||error||'').slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw error;
    }
  }

  async function prepareImageFile(type, file, id, role, index = 0) {
    const prepared = await compressImageFile(file);
    if (prepared.size > 8 * 1024 * 1024) {
      throw new Error(`${file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
    }
    const ext =
      prepared.type === "image/png" ? "png" : prepared.type === "image/webp" ? "webp" : "jpg";
    const suffix = index ? `-${index}` : "";
    const path = `${type}/uploads/${id}/${role}${suffix}-${Date.now()}.${ext}`;
    const content = bytesToBase64(new Uint8Array(await prepared.arrayBuffer()));
    // #region agent log
    fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'speed-fix',hypothesisId:'S',location:'landing-boards.js:prepareImageFile',message:'prepared image',data:{path,role,srcSize:file.size,outSize:prepared.size,outType:prepared.type},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { path, content };
  }

  async function compressImageFile(file, maxSide = 1200, quality = 0.72) {
    if (!file || !file.type || !file.type.startsWith("image/")) return file;
    try {
      const bmp = await createImageBitmap(file);
      const w = bmp.width;
      const h = bmp.height;
      const m = Math.max(w, h);
      const scale = Math.min(1, maxSide / Math.max(1, m));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(bmp, 0, 0, cw, ch);
      bmp.close();

      // Transparent PNG/WebP must stay PNG — JPEG fills alpha with black.
      // Skip full-pixel alpha scan (slow on phones); keep source alpha formats as PNG.
      const keepLossless = file.type === "image/png" || file.type === "image/webp";
      const base = String(file.name || "image").replace(/\.[^.]+$/, "") || "image";
      if (keepLossless) {
        const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
        if (!blob) return file;
        // #region agent log
        fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'speed-test',hypothesisId:'S',location:'landing-boards.js:compressImageFile',message:'keep png fast',data:{srcType:file.type,srcSize:file.size,outSize:blob.size,w:cw,h:ch},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return new File([blob], `${base}.png`, { type: "image/png" });
      }

      // Opaque photos → JPEG on white (avoids black fringe from cleared canvas).
      const flat = document.createElement("canvas");
      flat.width = cw;
      flat.height = ch;
      const fctx = flat.getContext("2d");
      fctx.fillStyle = "#ffffff";
      fctx.fillRect(0, 0, cw, ch);
      fctx.drawImage(canvas, 0, 0);
      const blob = await new Promise((resolve) => flat.toBlob((b) => resolve(b), "image/jpeg", quality));
      if (!blob) return file;
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'speed-test',hypothesisId:'S',location:'landing-boards.js:compressImageFile',message:'jpeg opaque',data:{srcType:file.type,srcSize:file.size,outSize:blob.size,w:cw,h:ch},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
    } catch (_) {
      return file;
    }
  }

  async function uploadImage(type, file, id, role, index = 0) {
    const prepared = await compressImageFile(file);
    if (prepared.size > 8 * 1024 * 1024) {
      throw new Error(`${file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
    }
    const ext =
      prepared.type === "image/png" ? "png" : prepared.type === "image/webp" ? "webp" : "jpg";
    const suffix = index ? `-${index}` : "";
    const path = `${type}/uploads/${id}/${role}${suffix}-${Date.now()}.${ext}`;
    // #region agent log
    fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'post-fix',hypothesisId:'D',location:'landing-boards.js:uploadImage',message:'upload path',data:{path,type,role,srcSize:file.size,outSize:prepared.size,outType:prepared.type,assetPreview:`/${path}`},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const content = bytesToBase64(new Uint8Array(await prepared.arrayBuffer()));
    await putManagedFresh(path, content, `${type}: upload ${id} ${role}${suffix}`, "");
    return path;
  }

  function setShippingCategory(category) {
    const next = SHIPPING_CATEGORIES.includes(category) ? category : "ETC";
    const input = writer.form?.elements?.namedItem?.("category") || writer.form?.querySelector?.('[name="category"]');
    if (input) input.value = next;
    writer.shipCatChips?.querySelectorAll(".pf-writer-cat-chip").forEach((chip) => {
      const active = chip.dataset.cat === next;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function renderShippingCategoryChips() {
    const host = writer.shipCatChips;
    if (!host || host.dataset.ready === "1") return;
    host.replaceChildren();
    SHIPPING_CATEGORIES.forEach((category) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "pf-writer-cat-chip";
      chip.dataset.cat = category;
      chip.setAttribute("role", "option");
      chip.textContent = category;
      chip.addEventListener("click", () => setShippingCategory(category));
      host.append(chip);
    });
    host.dataset.ready = "1";
  }

  function clearWriterMedia() {
    if (writer.cover?.preview?.startsWith("blob:")) URL.revokeObjectURL(writer.cover.preview);
    (writer.details || []).forEach((detail) => {
      if (detail.preview?.startsWith("blob:")) URL.revokeObjectURL(detail.preview);
    });
    writer.cover = { path: "", file: null, preview: "" };
    writer.details = [];
  }

  function renderWriterCover() {
    const preview = writer.coverPreview;
    if (!preview) return;
    const url = writer.cover.preview || (writer.cover.path ? assetUrl(writer.cover.path) : "");
    preview.classList.toggle("is-empty", !url);
    preview.classList.toggle("pf-writer-cover", true);
    if (!url) {
      preview.textContent = "대표 이미지 없음";
      preview.style.backgroundImage = "";
      preview.replaceChildren();
      return;
    }
    preview.textContent = "";
    if (window.GongbangBoardMedia?.paintWriterThumb) {
      window.GongbangBoardMedia.paintWriterThumb(preview, url, "image");
    } else {
      preview.style.backgroundImage = `url("${url}")`;
    }
  }

  function renderWriterDetails() {
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
      const kind =
        detail.kind ||
        (detail.file && window.GongbangBoardMedia?.isVideoFile?.(detail.file)
          ? "video"
          : window.GongbangBoardMedia?.isVideoUrl?.(url)
            ? "video"
            : "image");
      if (window.GongbangBoardMedia?.paintWriterThumb) {
        window.GongbangBoardMedia.paintWriterThumb(card, url, kind);
      } else {
        card.style.backgroundImage = url ? `url("${url}")` : "";
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
        const [removed] = writer.details.splice(index, 1);
        if (removed?.preview?.startsWith("blob:")) URL.revokeObjectURL(removed.preview);
        renderWriterDetails();
      });
      card.append(order, remove);
      grid.append(card);
    });
  }

  function openWriter(type, editItem = null) {
    if (!state.member || state.member.role !== "admin") {
      if (typeof window.showGongbangToast === "function") {
        window.showGongbangToast("글쓰기 권한이 없습니다.", { tone: "error", duration: 2600 });
      }
      return;
    }
    const editing = editItem && typeof editItem === "object" ? editItem : null;
    writer.editing = editing;
    writer.form.reset();
    clearWriterMedia();
    writer.form.elements.boardType.value = type;

    const coverInput = writer.form.elements.namedItem("cover") || writer.form.querySelector('[name="cover"]');
    const titleEl = writer.form.elements.namedItem("title") || writer.form.querySelector('[name="title"]');
    const contentEl = writer.form.elements.namedItem("content") || writer.form.querySelector('[name="content"]');

    if (editing) {
      writer.title.textContent = type === "shipping" ? "최종검수 수정" : "공지사항 수정";
      if (writer.submit) writer.submit.textContent = "수정하기";
      if (writer.help) {
        writer.help.textContent = "미디어를 바꾸지 않으면 기존 파일이 유지됩니다. 동영상은 추가 미디어로 올려 주세요.";
      }
      if (titleEl) titleEl.value = editing.title || "";
      if (contentEl) contentEl.value = editing.content || "";
      const coverPath = String(editing.cover || editing.image || "").trim();
      writer.cover = { path: coverPath, file: null, preview: "" };
      if (coverInput) {
        coverInput.required = !coverPath;
        coverInput.value = "";
      }
      const rawImages = Array.isArray(editing.images) ? editing.images : [];
      writer.details = rawImages
        .map((entry) => {
          if (!entry) return null;
          if (typeof entry === "string") return { path: entry, file: null, preview: "" };
          const path = String(entry.path || entry.url || "").trim();
          return path ? { path, file: null, preview: "" } : null;
        })
        .filter(Boolean)
        .filter((row) => row.path !== coverPath);
    } else {
      writer.title.textContent = type === "shipping" ? "최종검수 작성" : "공지사항 작성";
      if (writer.submit) writer.submit.textContent = "등록하기";
      if (writer.help) {
        writer.help.textContent = type === "shipping"
          ? "카테고리·게시일을 선택한 뒤 대표 사진과 추가 사진/동영상을 올려 주세요."
          : "대표 사진은 필수, 추가 동영상은 최대 30초·50MB(mp4/webm)입니다.";
      }
      if (coverInput) coverInput.required = true;
    }

    const shippingMeta = writer.shippingMeta;
    if (shippingMeta) shippingMeta.hidden = type !== "shipping";
    if (type === "shipping") {
      renderShippingCategoryChips();
      const cat = editing
        ? String(editing.category || "").trim() || detectShippingCategory(editing.title, editing.content)
        : "ETC";
      setShippingCategory(SHIPPING_CATEGORIES.includes(cat) ? cat : "ETC");
      const publishedAtEl = writer.form.elements.namedItem("publishedAt") || writer.form.querySelector('[name="publishedAt"]');
      if (publishedAtEl) {
        publishedAtEl.required = true;
        const iso = editing?.publishedAt || (window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString());
        publishedAtEl.value = window.GongbangTime
          ? window.GongbangTime.toDateTimeLocal(iso)
          : "";
      }
    } else {
      const publishedAtEl = writer.form.elements.namedItem("publishedAt") || writer.form.querySelector('[name="publishedAt"]');
      if (publishedAtEl) publishedAtEl.required = false;
    }

    writer.status.textContent = "";
    writer.submit.disabled = false;
    if (editing) {
      writerHtmlEditor?.setMode?.(
        window.GongbangHtmlEditor?.looksLikeHtml?.(editing.content) ? "source" : "text"
      );
      if (contentEl) contentEl.value = editing.content || "";
    } else {
      writerHtmlEditor?.reset?.();
    }
    renderWriterCover();
    renderWriterDetails();
    writer.root.classList.add("gb-write-dialog");
    writer.root.showModal();
  }

  async function submitWriter(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const typeEl = form.elements.namedItem("boardType") || form.querySelector('[name="boardType"]');
    const titleEl = form.elements.namedItem("title") || form.querySelector('[name="title"]');
    const contentEl = form.elements.namedItem("content") || form.querySelector('[name="content"]');
    const type = String(typeEl?.value || "").trim();
    const title = String(titleEl?.value || "").trim();
    const content = String(contentEl?.value || "").trim();
    if (!boards[type]) return;
    if (!title) {
      writer.status.textContent = "제목을 입력해 주세요.";
      titleEl?.focus?.();
      return;
    }
    if (!content) {
      writer.status.textContent = "내용을 입력해 주세요.";
      contentEl?.focus?.();
      return;
    }
    if (!writer.cover.file && !writer.cover.path) {
      writer.status.textContent = "대표 이미지를 선택해 주세요.";
      return;
    }
    writer.submit.disabled = true;
    try {
      const editing = writer.editing;
      const id = editing?.id || `admin-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const now = window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString();
      let publishedAt = now;
      let category;
      if (type === "shipping") {
        const categoryEl = form.elements.namedItem("category") || form.querySelector('[name="category"]');
        const publishedAtEl = form.elements.namedItem("publishedAt") || form.querySelector('[name="publishedAt"]');
        const picked = String(categoryEl?.value || "").trim();
        category = SHIPPING_CATEGORIES.includes(picked)
          ? picked
          : detectShippingCategory(title, content);
        publishedAt = window.GongbangTime && publishedAtEl?.value
          ? window.GongbangTime.fromDateTimeLocal(publishedAtEl.value)
          : (publishedAtEl?.value ? new Date(publishedAtEl.value).toISOString() : now);
      }

      const submitStartedAt = Date.now();
      const token = sessionStorage.getItem(TOKEN_KEY) || "";
      const mediaApi = window.GongbangBoardMedia;

      writer.status.textContent = "업로드 준비 중…";
      let cover = writer.cover.path || "";
      const keepImages = [];

      const uploadOne = async (file, role, label) => {
        if (!mediaApi?.uploadFiles) throw new Error("미디어 업로더를 불러오지 못했습니다.");
        writer.status.textContent = `${label} 업로드 중…`;
        const assets = await mediaApi.uploadFiles(API, token, type, id, [file], {
          roles: [role],
          onProgress: (pct) => {
            writer.status.textContent = `${label} 업로드 ${pct}%`;
          },
        });
        const url = assets[0]?.url;
        if (!url) throw new Error(`${label} 업로드에 실패했습니다.`);
        return url;
      };

      if (writer.cover.file) {
        await mediaApi?.assertMediaFile?.(writer.cover.file, { cover: true, allowVideo: false });
        cover = await uploadOne(writer.cover.file, "cover", "대표 이미지");
      } else if (!cover) {
        throw new Error("대표 이미지를 선택해 주세요.");
      }

      for (let index = 0; index < writer.details.length; index += 1) {
        const detail = writer.details[index];
        if (detail.file) {
          await mediaApi?.assertMediaFile?.(detail.file, { allowVideo: true });
          const kind = mediaApi?.isVideoFile?.(detail.file) ? "동영상" : "이미지";
          keepImages.push(await uploadOne(detail.file, "detail", `추가 ${kind} ${index + 1}`));
        } else if (detail.path) {
          keepImages.push(detail.path);
        }
      }

      writer.status.textContent = "저장 중…";
      const published = await api(`/admin/boards/${encodeURIComponent(type)}/publish`, {
        method: "PUT",
        body: JSON.stringify({
          item: {
            ...(editing || {}),
            id,
            title,
            content,
            cover,
            images: keepImages.filter((path) => path && path !== cover),
            publishedAt,
            category,
            origin: editing?.origin || "admin",
            updatedAt: now,
          },
          assets: [],
        }),
      });
      const item = published.item;

      state[type] = [item, ...(state[type] || []).filter((entry) => entry.id !== id)];
      if (boards[type]) boards[type].page = 1;
      if (type === "shipping") {
        window.openGongbangShippingPanel?.();
        window.prependGongbangShippingItem?.(item, { clearFilters: !editing });
      } else {
        renderList(type);
      }

      if (editing && state.current?.id === id) {
        state.current = item;
        renderCarousel(item);
        window.GongbangTime.renderPostTitle(dialog.title, item.title, item.publishedAt);
        if (window.GongbangHtmlEditor) {
          window.GongbangHtmlEditor.renderSafe(dialog.content, item.content || "");
        } else {
          dialog.content.textContent = item.content || "";
        }
      }

      writer.editing = null;
      clearWriterMedia();
      writer.root.close();
      form.reset();
      writer.status.textContent = "";
      if (writer.submit) writer.submit.textContent = "등록하기";
      if (typeof window.showGongbangToast === "function") {
        window.showGongbangToast(
          editing ? "게시글이 수정되었습니다." : "게시글이 등록되었습니다.",
          { tone: "success", duration: 2200 }
        );
      }
    } catch (error) {
      const message = error.message || String(error);
      writer.status.textContent = message;
      if (typeof window.showGongbangToast === "function") {
        window.showGongbangToast(message, { tone: "error", duration: 4200 });
      }
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
    if (!board) return;
    // Standalone shipping.html owns its own list UI via shipping-board.js.
    if (!board.list) {
      if (type === "shipping") window.refreshGongbangShippingBoard?.();
      return;
    }
    const query = String(board.search?.value || "").trim().toLowerCase();
    const filtered = state[type].filter(
      (item) => !query || `${item.title} ${item.content || ""}`.toLowerCase().includes(query)
    );
    const items = type === "shipping"
      ? filtered.slice((board.page - 1) * board.pageSize, board.page * board.pageSize)
      : filtered;
    board.list.replaceChildren();
    if (board.status) {
      board.status.textContent = query
        ? `검색 결과 ${filtered.length}개`
        : `전체 ${state[type].length}개`;
    }
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
        if (window.GongbangProtectImage) window.GongbangProtectImage(img);
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
        row.addEventListener("click", () => {
          if (type === "notices") navigateNoticeDetail(item);
          else openDetail(type, item);
        });
        board.list.append(row);
      }
    });
  }

  async function loadBoard(type) {
    const board = boards[type];
    board.status.textContent = "불러오는 중…";
    try {
      const liveUrl = `${API}/boards/${encodeURIComponent(type)}/live?v=${Date.now()}`;
      let liveItems = [];
      let liveOk = false;
      let liveStatus = 0;
      let gitItems = [];
      let gitOk = false;
      let gitStatus = 0;
      // Contabo live first — git JSON is legacy fallback only.
      try {
        const liveRes = await fetch(liveUrl, { cache: "no-store", credentials: "include" });
        liveStatus = liveRes.status;
        liveOk = liveRes.ok;
        if (liveRes.ok) {
          const livePayload = await liveRes.json();
          liveItems = Array.isArray(livePayload?.items) ? livePayload.items : [];
        }
      } catch (_) {
        liveOk = false;
      }
      if (board.dataPath) {
        try {
          const response = await fetch(`${board.dataPath}?v=${Date.now()}`, { cache: "no-store" });
          gitStatus = response.status;
          gitOk = response.ok;
          if (response.ok) {
            const payload = await response.json();
            gitItems = Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload)
                ? payload
                : [];
          }
        } catch (_) {
          gitOk = false;
        }
      }
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'notices-load',hypothesisId:'H1',location:'landing-boards.js:loadBoard',message:'board load sources',data:{type,liveOk,liveStatus,liveCount:liveItems.length,gitOk,gitStatus,gitCount:gitItems.length,api:API,path:location.pathname,pwa:document.documentElement.classList.contains('is-pwa')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!liveOk && !gitOk) throw new Error("게시판 데이터를 불러오지 못했습니다.");
      const map = new Map();
      // Prefer Contabo: seed git first, then overwrite with live.
      gitItems.forEach((item) => {
        if (item?.id) map.set(String(item.id), item);
      });
      liveItems.forEach((item) => {
        if (item?.id) map.set(String(item.id), item);
      });
      // If Contabo has data, drop pure-git-only merge noise for notices (live is source of truth).
      if (type === "notices" && liveItems.length) {
        state[type] = liveItems.slice().sort(
          (a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0)
        );
      } else {
        state[type] = [...map.values()].sort(
          (a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0)
        );
      }
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'notices-load',hypothesisId:'H2',location:'landing-boards.js:loadBoard',message:'board load result',data:{type,finalCount:state[type].length,firstId:state[type][0]?.id||'',firstCover:String(state[type][0]?.cover||'').slice(0,80)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'notices-load',hypothesisId:'H3',location:'landing-boards.js:loadBoard',message:'board load fail',data:{type,error:String(error?.message||error||'').slice(0,200),path:location.pathname},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
    if (board.section) board.section.hidden = false;
    // #region agent log
    fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'notices-fix',hypothesisId:'H6',location:'landing-boards.js:openBoard',message:'openBoard after null-safe panels',data:{type,hasSection:Boolean(board.section),hasList:Boolean(board.list),path:location.pathname,host:location.host},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    if (type === "notices" && /notices\.html$/i.test(location.pathname)) {
      const q = /[?&]app=1(?:&|$)/.test(location.search) ? "?app=1" : "";
      location.href = `./landing.html${q}`;
      return;
    }
    if (boards[type]?.section) boards[type].section.hidden = true;
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
  window.openGongbangBoardDetail = (type, item) => {
    if (type === "notices") navigateNoticeDetail(item);
    else openDetail(type, item);
  };
  window.closeGongbangNoticesPanel = (options = {}) => closeBoard("notices", options);

  function detectShippingCategory(title, content) {
    const titleText = String(title || "");
    const bodyText = String(content || "");
    const code = window.HeritageBrandCodes?.extractPortfolioCode?.(titleText) || "";
    if (code === "T&C" || code === "L" || code === "D") return "ETC";
    if (code && ["C","B","VCA","BO","CM","C&H","CL","G","H","P","F"].includes(code)) return code;
    const lead = titleText.trim().match(/^([A-Za-z0-9&]+)/);
    if (lead) {
      const token = lead[1].toUpperCase().replace(/\s+/g, "");
      const leadMap = {
        "C&H": "C&H", CH: "C&H", VCA: "VCA", VC: "VCA", BO: "BO", CM: "CM", CL: "CL",
        BV: "B", "T&C": "ETC", "T&CO": "ETC", TCO: "ETC", FR: "F",
        C: "C", B: "B", G: "G", H: "H", P: "P", F: "F", L: "ETC", D: "ETC", ETC: "ETC",
      };
      if (leadMap[token]) return leadMap[token];
    }
    const rules = [
      [/\bC\s*&\s*H\b|C&H|크롬하츠/i, "C&H"],
      [/\bVCA\b|반클리프|알함브라/i, "VCA"],
      [/\bBO\b|부쉐론|Boucheron/i, "BO"],
      [/\bCM\b|쇼메|쇼매|Chaumet/i, "CM"],
      [/\bCL\b|샤넬|Chanel/i, "CL"],
      [/\bT\s*&\s*C(?:O)?\b|T&C|티파니|Tiffany/i, "ETC"],
      [/\bC\b|까르띠에|Cartier/i, "C"],
      [/\bB\b|불가리|Bulgari|BVLGARI/i, "B"],
      [/\bG\b|구찌|Gucci/i, "G"],
      [/\bH\b|에르메스|Hermes|Hermès/i, "H"],
      [/\bP\b|프라다|Prada/i, "P"],
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
    if (board.open) {
      if (type === "notices" && String(board.open.tagName || "").toLowerCase() === "a") {
        const q = /[?&]app=1(?:&|$)/.test(location.search) || document.documentElement.classList.contains("is-pwa")
          ? "?app=1"
          : "";
        board.open.setAttribute("href", `./notices.html${q}`);
      }
      board.open.addEventListener("click", (event) => {
        // Notices is a standalone page (like portfolio/shipping), not an inline landing panel.
        if (type === "notices") {
          const tag = String(board.open.tagName || "").toLowerCase();
          if (tag === "a" && board.open.getAttribute("href")) return;
          event.preventDefault();
          const q = /[?&]app=1(?:&|$)/.test(location.search) ? "?app=1" : "";
          location.href = `./notices.html${q}`;
          return;
        }
        openBoard(type);
      });
    }
    if (board.close) board.close.addEventListener("click", () => closeBoard(type));
    if (board.search) board.search.addEventListener("input", () => {
      board.page = 1;
      renderList(type);
    });
    if (board.write) board.write.addEventListener("click", () => openWriter(type));
  });
  writer.form.addEventListener("submit", async (event) => {
    const typeBefore = String(
      writer.form?.elements?.namedItem?.("boardType")?.value ||
        writer.form?.querySelector?.('[name="boardType"]')?.value ||
        ""
    );
    await submitWriter(event);
    // Shipping already prepends locally; hard reload can briefly hide new posts on CDN lag.
    if (typeBefore && typeBefore !== "shipping") {
      window.refreshGongbangShippingBoard?.();
    }
  });
  writer.cancel.addEventListener("click", () => {
    writer.editing = null;
    if (writer.submit) writer.submit.textContent = "등록하기";
    writer.root.close();
  });
  writer.form.elements.cover?.addEventListener("change", async () => {
    const file = writer.form.elements.cover.files?.[0];
    if (!file) return;
    try {
      await window.GongbangBoardMedia?.assertMediaFile?.(file, { cover: true, allowVideo: false });
    } catch (error) {
      writer.status.textContent = error.message || String(error);
      writer.form.elements.cover.value = "";
      return;
    }
    if (writer.cover.preview?.startsWith("blob:")) URL.revokeObjectURL(writer.cover.preview);
    writer.cover = { path: writer.cover.path, file, preview: URL.createObjectURL(file), kind: "image" };
    writer.form.elements.cover.value = "";
    writer.status.textContent = "";
    renderWriterCover();
  });
  writer.form.elements.images?.addEventListener("change", async () => {
    const files = [...(writer.form.elements.images.files || [])];
    for (const file of files) {
      try {
        const kind = (await window.GongbangBoardMedia?.assertMediaFile?.(file, { allowVideo: true })) || "image";
        writer.details.push({
          path: "",
          file,
          preview: URL.createObjectURL(file),
          kind,
        });
      } catch (error) {
        writer.status.textContent = error.message || String(error);
      }
    }
    writer.form.elements.images.value = "";
    renderWriterDetails();
  });
  renderWriterCover();
  renderWriterDetails();

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
  // Legacy: notices.html?id= → dedicated notice-view page
  if (noticesOnly) {
    const legacyId = new URLSearchParams(location.search).get("id");
    if (legacyId) {
      const q = new URLSearchParams(noticesListQuery());
      q.set("id", legacyId);
      location.replace(`./notice-view.html?${q.toString()}`);
    } else {
      openBoard("notices");
    }
  } else if (wanted === "notices") {
    const q = /[?&]app=1(?:&|$)/.test(location.search) ? "?app=1" : "";
    location.replace(`./notices.html${q}`);
  } else if (wanted === "shipping") {
    openBoard("shipping");
  }
})();
