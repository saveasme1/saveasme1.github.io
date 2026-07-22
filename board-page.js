(() => {
  "use strict";
  const type = document.body.dataset.boardType;
  const dataPath = `${type}-data.json`;
  const list = document.getElementById("boardList");
  const search = document.getElementById("boardSearch");
  const dialog = document.getElementById("boardDialog");
  const close = document.getElementById("boardClose");
  const title = document.getElementById("detailTitle");
  const date = document.getElementById("detailDate");
  const content = document.getElementById("detailContent");
  const images = document.getElementById("detailImages");
  const actions = document.getElementById("detailActions");
  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  let items = [];
  let currentItem = null;
  let currentMember = null;
  let slideIndex = 0;
  let slideCount = 0;

  const assetUrl = (value) => String(value || "").replace(/^\/+/, "");
  const bytesToBase64 = (bytes) => {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  };
  const textToBase64 = (value) => bytesToBase64(new TextEncoder().encode(value));
  const decodeBase64 = (value) =>
    new TextDecoder().decode(Uint8Array.from(atob(String(value || "").replace(/\s/g, "")), (char) => char.charCodeAt(0)));
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
  async function readManagedJson(path) {
    const payload = await api(`/admin/files?${new URLSearchParams({ path, _: Date.now() })}`);
    return {
      value: JSON.parse(decodeBase64(payload.file.content)),
      sha: payload.file.sha,
    };
  }
  async function writeManagedJson(path, value, sha) {
    return api("/admin/files", {
      method: "PUT",
      body: JSON.stringify({
        path,
        sha,
        content: textToBase64(JSON.stringify(value)),
        message: `${type}: delete ${currentItem.id}`,
      }),
    });
  }
  const formatDate = (value) => (window.GongbangTime ? window.GongbangTime.formatDate(value) : "");
  function updateCarousel() {
    const viewport = images.querySelector(".board-carousel-viewport");
    const track = images.querySelector(".board-carousel-track");
    const counter = images.querySelector(".board-carousel-counter");
    const prev = images.querySelector("[data-slide='prev']");
    const next = images.querySelector("[data-slide='next']");
    if (!track) return;
    track.style.transform = `translateX(-${slideIndex * 100}%)`;
    if (counter) counter.textContent = `${slideIndex + 1} / ${slideCount}`;
    if (prev) prev.disabled = slideIndex <= 0;
    if (next) next.disabled = slideIndex >= slideCount - 1;
    if (window.GongbangBoardMeta?.syncCarouselHeight) {
      window.GongbangBoardMeta.syncCarouselHeight(viewport, track, slideIndex);
    }
  }
  function renderCarousel(item) {
    images.replaceChildren();
    const seen = new Set();
    const paths = [item.cover || item.image, ...(item.images || [])]
      .filter(Boolean)
      .filter((path) => {
        const key = String(path);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    slideIndex = 0;
    slideCount = paths.length;
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
          slideIndex += direction === "prev" ? -1 : 1;
          slideIndex = Math.max(0, Math.min(slideIndex, slideCount - 1));
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
        slideIndex += distance < 0 ? 1 : -1;
        slideIndex = Math.max(0, Math.min(slideIndex, slideCount - 1));
        updateCarousel();
      }, { passive: true });
    }
    images.append(carousel);
    updateCarousel();
  }
  function openDetail(item) {
    currentItem = item;
    window.GongbangTime.renderPostTitle(title, item.title, item.publishedAt);
    date.textContent = formatDate(item.publishedAt);
    content.textContent = item.content || "";
    renderCarousel(item);
    renderActions();
    dialog.classList.add("open");
    dialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("dialog-open");
  }
  function closeDetail() {
    dialog.classList.remove("open");
    dialog.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dialog-open");
    images.replaceChildren();
    slideIndex = 0;
    slideCount = 0;
    currentItem = null;
  }
  function renderActions() {
    if (!actions) return;
    actions.replaceChildren();
    actions.hidden = !(currentMember && currentMember.role === "admin" && currentItem);
    if (actions.hidden) return;
    const edit = document.createElement("a");
    edit.className = "detail-action";
    edit.href = `/admin/${type}/?edit=${encodeURIComponent(currentItem.id)}`;
    edit.textContent = "수정";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "detail-action danger";
    remove.textContent = "삭제";
    remove.addEventListener("click", async () => {
      if (!confirm(`“${currentItem.title}” 게시글을 삭제할까요?`)) return;
      remove.disabled = true;
      try {
        const [published, draft] = await Promise.all([
          readManagedJson(`${type}-data.json`),
          readManagedJson(`${type}-draft.json`),
        ]);
        published.value.items = (published.value.items || []).filter((item) => item.id !== currentItem.id);
        draft.value.items = (draft.value.items || []).filter((item) => item.id !== currentItem.id);
        await writeManagedJson(`${type}-draft.json`, draft.value, draft.sha);
        await writeManagedJson(`${type}-data.json`, published.value, published.sha);
        items = items.filter((item) => item.id !== currentItem.id);
        closeDetail();
        render();
      } catch (error) {
        alert(error.message);
        remove.disabled = false;
      }
    });
    actions.append(edit, remove);
  }
  function render() {
    list.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const filtered = items.filter((item) => !query || `${item.title} ${item.content}`.toLowerCase().includes(query));
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "board-empty";
      empty.textContent = query ? "검색 결과가 없습니다." : "등록된 게시글이 없습니다.";
      list.append(empty);
      return;
    }
    filtered.forEach((item, index) => {
      const row = document.createElement("button");
      row.type = "button";
      if (type === "shipping") {
        row.className = "shipping-card";
        const img = document.createElement("img");
        img.src = assetUrl(item.cover || item.image);
        img.alt = "";
        img.loading = "lazy";
        const heading = document.createElement("strong");
        window.GongbangTime.renderPostTitle(heading, item.title, item.publishedAt);
        const published = document.createElement("span");
        published.textContent = formatDate(item.publishedAt);
        row.append(img, heading, published);
      } else {
        row.className = "notice-row";
        const number = document.createElement("span");
        number.textContent = String(filtered.length - index);
        const heading = document.createElement("strong");
        window.GongbangTime.renderPostTitle(heading, item.title, item.publishedAt);
        const published = document.createElement("span");
        published.textContent = formatDate(item.publishedAt);
        row.append(number, heading, published);
      }
      row.addEventListener("click", () => openDetail(item));
      list.append(row);
    });
  }
  search.addEventListener("input", render);
  close.addEventListener("click", closeDetail);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDetail();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetail();
  });
  fetch(`${dataPath}?v=${Date.now()}`, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("게시판 데이터를 불러오지 못했습니다.");
      return response.json();
    })
    .then((payload) => {
      items = (payload.items || []).sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
      render();
    })
    .catch((error) => {
      list.innerHTML = `<p class="board-empty">${error.message}</p>`;
    });
  api("/auth/me")
    .then((payload) => {
      currentMember = payload.member;
      if (currentItem) renderActions();
    })
    .catch(() => {
      currentMember = null;
    });
})();
