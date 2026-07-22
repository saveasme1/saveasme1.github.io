(() => {
  "use strict";

  const API_BASE = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const API_ORIGIN = new URL(API_BASE).origin;
  const TOKEN_KEY = "gongbang171.adminToken";
  const $ = (id) => document.getElementById(id);
  const els = {
    section: $("reviews"),
    openButton: $("reviewsOpen"),
    closeButton: $("reviewsClose"),
    grid: $("reviewsGrid"),
    pager: $("reviewsPager"),
    search: $("reviewsSearch"),
    write: $("reviewWrite"),
    session: $("reviewSession"),
    status: $("reviewsStatus"),
    count: $("reviewsCount"),
    view: $("reviewView"),
    viewImages: $("reviewViewImages"),
    viewMeta: $("reviewViewMeta"),
    viewTitle: $("reviewViewTitle"),
    viewText: $("reviewViewText"),
    viewClose: $("reviewViewClose"),
  };
  if (!els.section || !els.grid) return;

  const state = {
    member: null,
    page: 1,
    pages: 1,
    query: "",
    busy: false,
    opened: false,
    slideIndex: 0,
    slideCount: 0,
    currentReview: null,
  };

  function ensureToastStack() {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    return stack;
  }

  function showToast(message, options = {}) {
    const stack = ensureToastStack();
    const toast = document.createElement("div");
    toast.className = `toast ${options.tone || "success"}`;
    toast.textContent = message;
    stack.appendChild(toast);
    window.setTimeout(() => toast.remove(), options.duration || 2800);
  }
  window.showGongbangToast = showToast;

  let authRedirect = "";

  function applyAuthMember(member, accessToken) {
    if (accessToken) {
      try { sessionStorage.setItem(TOKEN_KEY, accessToken); } catch (_) {}
    }
    state.member = member || null;
    renderSession();
    notifyAuthChanged();
    if (state.opened) loadReviews(true);
  }

  function canWrite() {
    return state.member && (state.member.role === "admin" || state.member.status === "approved");
  }

  function showMemberGate() {
    els.grid.replaceChildren();
    els.pager.replaceChildren();
    const gate = document.createElement("div");
    gate.className = "review-gate";
    gate.innerHTML = `
      <strong>인증된 회원만 볼 수 있습니다</strong>
      <p>실시간 리얼후기는 회원가입 후 로그인하신 회원만 확인할 수 있습니다.</p>
      <div class="review-gate-actions">
        <button type="button" class="primary" data-gate="register">회원가입</button>
        <button type="button" data-gate="login">로그인</button>
      </div>`;
    gate.querySelector('[data-gate="register"]').addEventListener("click", () => openAuth("register"));
    gate.querySelector('[data-gate="login"]').addEventListener("click", () => openAuth("login"));
    els.grid.append(gate);
    els.status.textContent = "인증된 회원만 볼 수 있습니다.";
  }

  function openReviewsPanel() {
    if (typeof window.closeGongbangPortfolioPanel === "function") {
      window.closeGongbangPortfolioPanel({ skipNav: true });
    }
    if (typeof window.closeGongbangBoardPanels === "function") {
      window.closeGongbangBoardPanels();
    }
    els.section.hidden = false;
    state.opened = true;
    if (window.GongbangSiteNav?.setActiveNav) window.GongbangSiteNav.setActiveNav("reviews");
    if (typeof window.GongbangScrollToElement === "function") {
      window.GongbangScrollToElement(els.section);
    } else {
      els.section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    loadReviews(true);
  }
  window.openGongbangReviewsPanel = openReviewsPanel;

  function closeReviewsPanel(options = {}) {
    els.section.hidden = true;
    state.opened = false;
    closeReview();
    if (!options.skipNav && window.GongbangSiteNav?.setActiveNav) {
      window.GongbangSiteNav.setActiveNav(window.GongbangSiteNav.detectActivePanel?.() || "home");
    }
  }
  window.closeGongbangReviewsPanel = closeReviewsPanel;
  window.openGongbangAuth = (mode, options = {}) => openAuth(mode || "login", options);
  window.refreshGongbangAuthUI = () => renderSession();
  window.getGongbangMember = () => state.member;

  function notifyAuthChanged() {
    window.dispatchEvent(new CustomEvent("gongbang:auth-changed", { detail: { member: state.member } }));
  }

  function imageUrl(value) {
    if (!value) return "";
    return /^https?:\/\//i.test(value) ? value : `${API_ORIGIN}${value}`;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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

  function formatDate(value) {
    return window.GongbangTime ? window.GongbangTime.formatDate(value) : "";
  }

  function renderSession() {
    if (els.session) els.session.replaceChildren();
    const allowed = Boolean(canWrite());
    if (els.write) {
      els.write.hidden = !allowed;
      els.write.textContent = "글 작성하기";
    }
    const actions = els.write?.closest(".reviews-toolbar-actions");
    if (actions) actions.hidden = !allowed;
  }

  function renderReviews(reviews) {
    els.grid.replaceChildren();
    if (!reviews.length) {
      const empty = document.createElement("p");
      empty.className = "review-empty";
      empty.textContent = state.query ? "검색 결과가 없습니다." : "등록된 후기가 없습니다.";
      els.grid.append(empty);
      return;
    }
    for (const review of reviews) {
      const article = document.createElement("article");
      article.className = "review-card";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "review-thumb";
      button.setAttribute("aria-label", `${review.title} 상세 보기`);
      const cover = review.images && review.images[0];
      if (cover) {
        const img = document.createElement("img");
        img.src = imageUrl(cover.url);
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        button.append(img);
      }
      button.addEventListener("click", () => openReview(review.id));
      const title = document.createElement("p");
      title.className = "review-title";
      window.GongbangTime.renderPostTitle(title, review.title, review.publishedAt);
      const meta = document.createElement("p");
      meta.className = "review-card-meta";
      const viewsText = window.GongbangBoardMeta
        ? window.GongbangBoardMeta.formatViews(review.viewCount)
        : `조회 ${Number(review.viewCount) || 0}`;
      meta.textContent = `${formatDate(review.publishedAt)} · ${viewsText}`;
      article.append(button, title, meta);
      els.grid.append(article);
    }
  }

  function renderPager() {
    els.pager.replaceChildren();
    if (state.pages <= 1) return;
    const add = (label, page, disabled, active = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => {
        state.page = page;
        loadReviews(true);
      });
      els.pager.append(button);
    };
    add("‹", state.page - 1, state.page <= 1);
    const first = Math.max(1, state.page - 2);
    const last = Math.min(state.pages, first + 4);
    for (let page = first; page <= last; page += 1) add(String(page), page, false, page === state.page);
    add("›", state.page + 1, state.page >= state.pages);
  }

  async function loadReviews(scroll = false) {
    if (state.busy) return;
    state.busy = true;
    els.status.textContent = "후기를 불러오는 중…";
    try {
      const params = new URLSearchParams({ page: String(state.page), pageSize: "12" });
      if (state.query) params.set("q", state.query);
      const payload = await api(`/reviews?${params}`);
      state.pages = Math.max(1, payload.pagination.pages || 1);
      const reviews = payload.reviews || [];
      if (window.GongbangBoardMeta?.fetchViews && reviews.length) {
        const views = await window.GongbangBoardMeta.fetchViews(
          "reviews",
          reviews.map((item) => item.id)
        );
        reviews.forEach((item) => {
          item.viewCount = Number(views[String(item.id)]) || 0;
        });
      }
      renderReviews(reviews);
      renderPager();
      const total = Number(payload.pagination?.total) || reviews.length;
      if (els.count) {
        els.count.textContent = state.query
          ? `${total.toLocaleString("ko-KR")} found`
          : `${total.toLocaleString("ko-KR")} posts`;
      }
      els.status.textContent = `전체 ${total}개의 리얼후기`;
      if (scroll) els.section.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      els.status.textContent = error.message;
      renderReviews([]);
    } finally {
      state.busy = false;
    }
  }

  function updateCarousel() {
    const viewport = els.viewImages.querySelector(".review-carousel-viewport");
    const track = els.viewImages.querySelector(".review-carousel-track");
    const counter = els.viewImages.querySelector(".review-carousel-counter");
    const prev = els.viewImages.querySelector("[data-carousel='prev']");
    const next = els.viewImages.querySelector("[data-carousel='next']");
    if (!track) return;
    track.style.transform = `translateX(-${state.slideIndex * 100}%)`;
    if (counter) counter.textContent = `${state.slideIndex + 1} / ${state.slideCount}`;
    if (prev) prev.disabled = state.slideIndex <= 0;
    if (next) next.disabled = state.slideIndex >= state.slideCount - 1;
    if (window.GongbangBoardMeta?.syncCarouselHeight) {
      window.GongbangBoardMeta.syncCarouselHeight(viewport, track, state.slideIndex);
    }
  }

  function buildCarousel(images, title) {
    els.viewImages.replaceChildren();
    state.slideIndex = 0;
    state.slideCount = images.length;
    if (!images.length) return;

    const wrap = document.createElement("div");
    wrap.className = "review-carousel";

    const viewport = document.createElement("div");
    viewport.className = "review-carousel-viewport";
    const track = document.createElement("div");
    track.className = "review-carousel-track";
    images.forEach((image, index) => {
      const slide = document.createElement("div");
      slide.className = "review-carousel-slide";
      const img = document.createElement("img");
      img.src = imageUrl(image.url);
      img.alt = title;
      img.loading = index === 0 ? "eager" : "lazy";
      img.decoding = "async";
      slide.append(img);
      track.append(slide);
    });
    viewport.append(track);
    wrap.append(viewport);

    if (images.length > 1) {
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "review-carousel-nav prev";
      prev.dataset.carousel = "prev";
      prev.setAttribute("aria-label", "이전 사진");
      prev.textContent = "‹";
      prev.addEventListener("click", () => {
        if (state.slideIndex > 0) {
          state.slideIndex -= 1;
          updateCarousel();
        }
      });

      const next = document.createElement("button");
      next.type = "button";
      next.className = "review-carousel-nav next";
      next.dataset.carousel = "next";
      next.setAttribute("aria-label", "다음 사진");
      next.textContent = "›";
      next.addEventListener("click", () => {
        if (state.slideIndex < state.slideCount - 1) {
          state.slideIndex += 1;
          updateCarousel();
        }
      });

      const counter = document.createElement("div");
      counter.className = "review-carousel-counter";
      wrap.append(prev, next, counter);
    }

    els.viewImages.append(wrap);
    updateCarousel();
  }

  function canManageReview(review) {
    if (!state.member || !review) return false;
    return state.member.role === "admin" || Number(review.memberId) === Number(state.member.id);
  }

  function renderReviewActions(review) {
    const actions = $("reviewViewActions");
    if (!actions) return;
    actions.replaceChildren();
    actions.hidden = !canManageReview(review);
    if (actions.hidden) return;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "review-detail-action";
    edit.textContent = "수정";
    edit.addEventListener("click", () => openReviewEditor(review));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "review-detail-action danger";
    remove.textContent = "삭제";
    remove.addEventListener("click", async () => {
      if (!confirm(`“${review.title}” 후기를 삭제할까요?`)) return;
      remove.disabled = true;
      try {
        await api(`/reviews/${review.id}`, { method: "DELETE" });
        closeReview();
        await loadReviews();
        showToast("후기가 삭제되었습니다.");
      } catch (error) {
        alert(error.message);
        remove.disabled = false;
      }
    });
    actions.append(edit, remove);
  }

  function openReviewEditor(review) {
    ensureDialogs();
    const form = $("reviewWriteForm");
    form.dataset.reviewId = String(review.id);
    form.elements.title.value = review.title;
    form.elements.body.value = review.body;
    form.elements.cover.required = false;
    form._htmlEditor?.setMode(
      window.GongbangHtmlEditor?.looksLikeHtml?.(review.body) ? "source" : "text"
    );
    $("reviewWriteTitle").textContent = "리얼후기 수정";
    $("reviewImageHelp").textContent = "이미지를 바꾸지 않으면 기존 이미지가 유지됩니다.";
    $("reviewWriteSubmit").textContent = "수정 저장";
    $("reviewWriteStatus").textContent = "";
    closeReview();
    $("reviewWriteDialog").showModal();
  }

  function openNewReviewEditor() {
    ensureDialogs();
    const form = $("reviewWriteForm");
    form.reset();
    delete form.dataset.reviewId;
    form.elements.cover.required = true;
    form._htmlEditor?.reset?.();
    $("reviewWriteTitle").textContent = "리얼후기 작성";
    $("reviewImageHelp").textContent = "대표 이미지는 필수이며 추가 이미지는 최대 8장입니다.";
    $("reviewWriteSubmit").textContent = "등록하기";
    $("reviewWriteStatus").textContent = "";
    $("reviewWriteDialog").showModal();
  }

  async function openReview(id) {
    try {
      const { review } = await api(`/reviews/${id}`);
      state.currentReview = review;
      buildCarousel(review.images || [], review.title);
      if (window.GongbangBoardMeta?.renderMetaRow) {
        window.GongbangBoardMeta.renderMetaRow(els.viewMeta, {
          dateText: formatDate(review.publishedAt),
          viewCount: review.viewCount,
        });
      }
      window.GongbangTime.renderPostTitle(els.viewTitle, review.title, review.publishedAt);
      if (window.GongbangHtmlEditor) {
        window.GongbangHtmlEditor.renderSafe(els.viewText, review.body);
      } else {
        els.viewText.textContent = review.body;
      }
      window.GongbangBoardMeta?.setupContentClamp?.(els.viewText);
      renderReviewActions(review);
      els.view.hidden = false;
      els.view.classList.add("open");
      els.view.setAttribute("aria-hidden", "false");
      document.body.classList.add("review-lock");
    } catch (error) {
      alert(error.message);
    }
  }

  function closeReview() {
    els.view.classList.remove("open");
    els.view.hidden = true;
    els.view.setAttribute("aria-hidden", "true");
    document.body.classList.remove("review-lock");
    els.viewImages.replaceChildren();
    state.currentReview = null;
    state.slideIndex = 0;
    state.slideCount = 0;
  }

  function ensureDialogs() {
    if ($("reviewAuthDialog")) return;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<dialog class="review-dialog auth-dialog" id="reviewAuthDialog">
        <form id="reviewAuthForm" data-mode="login">
          <div class="auth-tabs" role="tablist">
            <button type="button" class="auth-tab is-active" data-auth-tab="login" role="tab">로그인</button>
            <button type="button" class="auth-tab" data-auth-tab="register" role="tab">회원가입</button>
          </div>
          <div class="auth-panel" data-auth-panel="login">
            <h2 id="reviewAuthTitleLogin">로그인</h2>
            <p class="auth-desc">가입하신 아이디로 로그인하세요.</p>
          </div>
          <div class="auth-panel" data-auth-panel="register" hidden>
            <h2 id="reviewAuthTitleRegister">회원가입</h2>
            <p class="auth-desc">새 계정을 만들고 관리자 승인을 기다려 주세요.</p>
            <p class="auth-notice">가입 신청 후 관리자 승인이 완료되어야 후기를 작성할 수 있습니다. 가입승인이 늦어질 경우 카카오톡 add68로 따로 가입승인 문의주세요.</p>
          </div>
          <label class="auth-field">아이디
            <input id="reviewUsername" autocomplete="username" minlength="4" maxlength="30" required placeholder="아이디 입력">
          </label>
          <label class="auth-field">비밀번호
            <input id="reviewPassword" type="password" autocomplete="current-password" minlength="12" maxlength="128" required placeholder="비밀번호 입력">
          </label>
          <p class="review-dialog-status" id="reviewAuthStatus" aria-live="polite"></p>
          <div class="review-dialog-actions auth-actions">
            <button type="button" data-close>취소</button>
            <button class="primary" type="submit" id="reviewAuthSubmit">로그인</button>
          </div>
        </form>
      </dialog>
      <dialog class="review-dialog write-dialog" id="reviewWriteDialog">
        <form id="reviewWriteForm">
          <h2 id="reviewWriteTitle">리얼후기 작성</h2>
          <label>제목<input name="title" minlength="2" maxlength="160" required placeholder="후기 제목"></label>
          <label>내용<textarea name="body" minlength="2" maxlength="20000" required placeholder="후기 내용을 입력해 주세요"></textarea></label>
          <label>대표 이미지<input name="cover" type="file" accept="image/jpeg,image/png,image/webp" required></label>
          <label>추가 이미지 (최대 8장)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
          <p class="review-image-help" id="reviewImageHelp">대표 이미지는 필수이며 추가 이미지는 최대 8장입니다.</p>
          <p class="review-dialog-status" id="reviewWriteStatus" aria-live="polite"></p>
          <div class="review-dialog-actions">
            <button type="button" data-close>취소</button>
            <button class="primary" type="submit" id="reviewWriteSubmit">등록하기</button>
          </div>
        </form>
      </dialog>`
    );
    document.querySelectorAll(".review-dialog [data-close]").forEach((button) =>
      button.addEventListener("click", () => button.closest("dialog").close())
    );
    document.querySelectorAll("[data-auth-tab]").forEach((button) =>
      button.addEventListener("click", () => openAuth(button.dataset.authTab))
    );
    $("reviewAuthForm").addEventListener("submit", submitAuth);
    $("reviewWriteForm").addEventListener("submit", submitReview);
    $("reviewWriteForm")._htmlEditor = window.GongbangHtmlEditor?.mount(
      $("reviewWriteForm").elements.body
    );
  }

  function openAuth(mode, options = {}) {
    const next = mode === "register" ? "register" : "login";
    authRedirect = typeof options.redirect === "string" ? options.redirect : "";
    ensureDialogs();
    const form = $("reviewAuthForm");
    const dialog = $("reviewAuthDialog");
    form.dataset.mode = next;
    dialog.dataset.mode = next;
    document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.authTab === next);
    });
    document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.authPanel !== next;
    });
    $("reviewPassword").autocomplete = next === "login" ? "current-password" : "new-password";
    $("reviewPassword").placeholder = next === "login" ? "비밀번호 입력" : "12자 이상 비밀번호";
    $("reviewAuthSubmit").textContent = next === "login" ? "로그인" : "가입 신청하기";
    $("reviewAuthStatus").textContent = "";
    $("reviewAuthStatus").className = "review-dialog-status";
    if (!dialog.open) dialog.showModal();
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("reviewAuthStatus");
    const mode = form.dataset.mode;
    status.className = "review-dialog-status";
    status.textContent = mode === "login" ? "로그인 중…" : "가입 신청 중…";
    try {
      const payload = await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ username: $("reviewUsername").value, password: $("reviewPassword").value }),
      });
      if (mode === "register") {
        $("reviewAuthDialog").close();
        form.reset();
        form.dataset.mode = "login";
        authRedirect = "";
        showToast("가입신청이 완료되었습니다. 관리자 승인을 기다려주세요.");
        return;
      }
      applyAuthMember(payload.member, payload.accessToken);
      $("reviewAuthDialog").close();
      const nextUrl = authRedirect;
      authRedirect = "";
      if (nextUrl) {
        location.href = nextUrl;
        return;
      }
    } catch (error) {
      status.className = "review-dialog-status error";
      status.textContent = error.message;
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("reviewWriteStatus");
    const imageFiles = [...form.elements.images.files];
    const coverFile = form.elements.cover.files[0];
    if (imageFiles.length > 8) {
      status.textContent = "추가 이미지는 최대 8장까지 등록할 수 있습니다.";
      return;
    }
    const reviewId = form.dataset.reviewId;
    if (reviewId && imageFiles.length && !coverFile) {
      status.textContent = "사진을 교체하려면 대표 이미지도 선택해 주세요.";
      return;
    }
    status.textContent = reviewId ? "후기를 수정하는 중…" : "이미지를 안전하게 처리하고 후기를 등록하는 중…";
    try {
      await api(reviewId ? `/reviews/${reviewId}` : "/reviews", {
        method: reviewId ? "PUT" : "POST",
        body: new FormData(form),
      });
      form.reset();
      delete form.dataset.reviewId;
      $("reviewWriteDialog").close();
      state.page = 1;
      await loadReviews(true);
    } catch (error) {
      status.className = "review-dialog-status error";
      status.textContent = error.message;
    }
  }

  async function loadMe() {
    try {
      const payload = await api("/auth/me");
      state.member = payload.member;
    } catch {
      state.member = null;
    }
    renderSession();
    notifyAuthChanged();
  }

  window.addEventListener("gongbang:auth-changed", (event) => {
    if (!event.detail || !Object.prototype.hasOwnProperty.call(event.detail, "member")) return;
    const next = event.detail.member || null;
    const prevId = state.member?.id || state.member?.username || "";
    const nextId = next?.id || next?.username || "";
    if (!!state.member === !!next && prevId === nextId) return;
    state.member = next;
    renderSession();
    if (state.opened) loadReviews();
  });

  let searchTimer;
  if (els.search) {
    els.search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = els.search.value.trim();
        state.page = 1;
        loadReviews();
      }, 250);
    });
  }
  if (els.openButton) {
    els.openButton.addEventListener("click", openReviewsPanel);
  }
  if (els.closeButton) {
    els.closeButton.addEventListener("click", closeReviewsPanel);
  }
  if (els.write) {
    els.write.addEventListener("click", () => {
      if (!canWrite()) {
        showToast("글쓰기 권한이 없습니다.", { tone: "error", duration: 2600 });
        return;
      }
      openNewReviewEditor();
    });
  }
  if (els.viewClose) els.viewClose.addEventListener("click", closeReview);
  if (els.view) {
    els.view.addEventListener("click", (event) => {
      if (event.target === els.view) closeReview();
    });
  }
  window.addEventListener("keydown", (event) => {
    if (!els.view || !els.view.classList.contains("open")) return;
    if (event.key === "Escape") closeReview();
    if (event.key === "ArrowLeft" && state.slideIndex > 0) {
      state.slideIndex -= 1;
      updateCarousel();
    }
    if (event.key === "ArrowRight" && state.slideIndex < state.slideCount - 1) {
      state.slideIndex += 1;
      updateCarousel();
    }
  });

  loadMe().then(() => {
    const wantOpen = new URLSearchParams(location.search).get("open");
    if (wantOpen === "reviews") openReviewsPanel();
    else if (wantOpen === "mypage") openAuth("login", { redirect: "/mypage.html" });
    else if (!els.section.hidden) {
      state.opened = true;
      loadReviews();
    }
  });
})();
