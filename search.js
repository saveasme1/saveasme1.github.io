(() => {
  const API_BASE =
    window.JEWELRY_SEARCH_API ||
    "https://app.0-1.co.kr/api/jewelry/v1";

  const els = {
    status: document.getElementById("status"),
    results: document.getElementById("results"),
    related: document.getElementById("related"),
    relatedGrid: document.getElementById("relatedGrid"),
    fileInput: document.getElementById("fileInput"),
    photoPreview: document.getElementById("photoPreview"),
    textForm: document.getElementById("textForm"),
    textQuery: document.getElementById("textQuery"),
    filterBrand: document.getElementById("filterBrand"),
    filterCategory: document.getElementById("filterCategory"),
    filterMaterial: document.getElementById("filterMaterial"),
    cameraVideo: document.getElementById("cameraVideo"),
    cameraCanvas: document.getElementById("cameraCanvas"),
    cameraStart: document.getElementById("cameraStart"),
    cameraShot: document.getElementById("cameraShot"),
  };

  let cameraStream = null;

  const RECENT_KEY = "heritage_ai_recent";
  const FAV_KEY = "heritage_ai_favs";

  function loadList(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  }
  function saveList(key, list) {
    localStorage.setItem(key, JSON.stringify(list.slice(0, 24)));
  }
  function pushRecent(q) {
    const list = loadList(RECENT_KEY).filter((x) => x !== q);
    list.unshift(q);
    saveList(RECENT_KEY, list);
    renderRecent();
  }
  function toggleFav(id, btn) {
    const list = loadList(FAV_KEY);
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.unshift(id);
    saveList(FAV_KEY, list);
    if (btn) btn.classList.toggle("is-fav", list.includes(id));
  }
  function renderRecent() {
    let box = document.getElementById("recentBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "recentBox";
      box.className = "js-recent";
      els.status.before(box);
    }
    box.replaceChildren();
    loadList(RECENT_KEY).slice(0, 8).forEach((q) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = q;
      b.addEventListener("click", () => {
        els.textQuery.value = q;
        document.querySelector('[data-tab="text"]')?.click();
        els.textForm.requestSubmit();
      });
      box.append(b);
    });
  }


  function setStatus(message, isError = false) {
    els.status.textContent = message;
    els.status.style.color = isError ? "#ff8f8f" : "";
  }

  function filters() {
    return {
      brand: els.filterBrand.value || "ALL",
      category: els.filterCategory.value || "ALL",
      material: els.filterMaterial.value || "ALL",
    };
  }

  function fillSelect(select, values) {
    const current = select.value;
    select.replaceChildren();
    (values || ["ALL"]).forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      select.append(opt);
    });
    if ([...select.options].some((o) => o.value === current)) {
      select.value = current;
    }
  }

  async function loadFilters() {
    try {
      const res = await fetch(`${API_BASE}/meta/filters`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "필터를 불러오지 못했습니다.");
      fillSelect(els.filterBrand, data.brands);
      fillSelect(els.filterCategory, data.categories);
      fillSelect(els.filterMaterial, data.materials);
    } catch (error) {
      setStatus(error.message || "API에 연결하지 못했습니다. 배포 후 다시 시도하세요.", true);
    }
  }

  function scoreLabel(score) {
    const pct = Math.max(0, Math.min(100, Math.round(Number(score) * 100)));
    return `유사도 ${pct}%`;
  }

  function renderCards(container, rows) {
    container.replaceChildren();
    rows.forEach((row, index) => {
      const a = document.createElement("a");
      a.className = "js-card";
      a.href = row.detailUrl || `./landing.html?open=portfolio&id=${encodeURIComponent(row.id)}`;
      a.style.animationDelay = `${Math.min(index, 12) * 0.03}s`;
      const img = document.createElement("img");
      img.src = row.coverUrl || "";
      img.alt = row.title || "";
      img.loading = index < 6 ? "eager" : "lazy";
      const title = document.createElement("strong");
      title.textContent = row.title || row.id;
      const meta = document.createElement("span");
      meta.textContent = [row.brand, row.category].filter(Boolean).join(" · ");
      const score = document.createElement("em");
      score.textContent = scoreLabel(row.score);
      const fav = document.createElement("button");
      fav.type = "button";
      fav.className = "js-fav" + (loadList(FAV_KEY).includes(row.id) ? " is-fav" : "");
      fav.textContent = "♥";
      fav.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleFav(row.id, fav);
      });
      a.append(img, title, meta, score, fav);
      container.append(a);
    });
  }

  async function showRelated(itemId) {
    try {
      const res = await fetch(`${API_BASE}/items/${encodeURIComponent(itemId)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.related?.length) {
        els.related.hidden = true;
        return;
      }
      renderCards(els.relatedGrid, data.related);
      els.related.hidden = false;
    } catch (_error) {
      els.related.hidden = true;
    }
  }

  async function handleResults(payload) {
    const rows = payload.results || [];
    renderCards(els.results, rows);
    if (!rows.length) {
      setStatus("비슷한 작품을 찾지 못했습니다. 다른 사진이나 키워드를 시도해 보세요.");
      els.related.hidden = true;
      return;
    }
    setStatus(`${rows.length}건 · ${payload.backend || "clip"}`);
    await showRelated(rows[0].id);
  }

  async function searchText(q) {
    pushRecent(q);
    setStatus("텍스트 검색 중…");
    els.results.replaceChildren();
    const f = filters();
    const res = await fetch(`${API_BASE}/search/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q,
        limit: 24,
        brand: f.brand === "ALL" ? null : f.brand,
        category: f.category === "ALL" ? null : f.category,
        material: f.material === "ALL" ? null : f.material,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.detail || data.message || "검색 실패");
    await handleResults(data);
  }

  async function searchImage(file) {
    setStatus("이미지 검색 중…");
    els.results.replaceChildren();
    const f = filters();
    const body = new FormData();
    body.append("file", file, file.name || "query.jpg");
    const qs = new URLSearchParams({
      limit: "24",
      brand: f.brand,
      category: f.category,
      material: f.material,
    });
    const res = await fetch(`${API_BASE}/search/image?${qs}`, {
      method: "POST",
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.detail || data.message || "이미지 검색 실패");
    await handleResults(data);
  }

  function showPhotoPreview(file) {
    const url = URL.createObjectURL(file);
    els.photoPreview.hidden = false;
    els.photoPreview.replaceChildren();
    const img = document.createElement("img");
    img.src = url;
    img.alt = "선택한 사진";
    els.photoPreview.append(img);
  }

  document.querySelectorAll(".js-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".js-tabs button").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll(".js-tabpane").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.getElementById(`pane-${btn.dataset.tab}`)?.classList.add("is-active");
      if (btn.dataset.tab !== "camera" && cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        cameraStream = null;
        els.cameraVideo.srcObject = null;
        els.cameraShot.disabled = true;
      }
    });
  });

  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatus("이미지는 10MB 이하여야 합니다.", true);
      return;
    }
    showPhotoPreview(file);
    try {
      await searchImage(file);
    } catch (error) {
      setStatus(error.message || "검색 실패", true);
    }
  });

  els.textForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const q = els.textQuery.value.trim();
    if (!q) return;
    try {
      await searchText(q);
    } catch (error) {
      setStatus(error.message || "검색 실패", true);
    }
  });

  els.cameraStart.addEventListener("click", async () => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      els.cameraVideo.srcObject = cameraStream;
      await els.cameraVideo.play();
      els.cameraShot.disabled = false;
      setStatus("카메라를 맞춘 뒤 촬영하세요.");
    } catch (error) {
      setStatus("카메라 권한이 필요합니다.", true);
    }
  });

  els.cameraShot.addEventListener("click", async () => {
    const video = els.cameraVideo;
    if (!video.videoWidth) return;
    const canvas = els.cameraCanvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setStatus("촬영에 실패했습니다.", true);
      return;
    }
    const file = new File([blob], "camera.jpg", { type: "image/jpeg" });
    showPhotoPreview(file);
    try {
      await searchImage(file);
    } catch (error) {
      setStatus(error.message || "검색 실패", true);
    }
  });

  ["filterBrand", "filterCategory", "filterMaterial"].forEach((id) => {
    els[id].addEventListener("change", () => {
      if (els.results.children.length) {
        setStatus("필터가 바뀌었습니다. 다시 검색해 주세요.");
      }
    });
  });

  loadFilters();
  renderRecent();
})();
