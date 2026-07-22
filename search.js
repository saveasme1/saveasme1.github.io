(() => {
  const API_BASE =
    window.JEWELRY_SEARCH_API ||
    "https://app.0-1.co.kr/api/jewelry/v1";

  const els = {
    status: document.getElementById("status"),
    loading: document.getElementById("loading"),
    loadingText: document.getElementById("loadingText"),
    results: document.getElementById("results"),
    related: document.getElementById("related"),
    relatedGrid: document.getElementById("relatedGrid"),
    fileInput: document.getElementById("fileInput"),
    photoDrop: document.getElementById("photoDrop"),
    photoPreview: document.getElementById("photoPreview"),
    photoClear: document.getElementById("photoClear"),
    photoSearch: document.getElementById("photoSearch"),
    cameraVideo: document.getElementById("cameraVideo"),
    cameraPreview: document.getElementById("cameraPreview"),
    cameraCanvas: document.getElementById("cameraCanvas"),
    cameraStart: document.getElementById("cameraStart"),
    cameraCapture: document.getElementById("cameraCapture"),
    cameraSearch: document.getElementById("cameraSearch"),
  };

  let cameraStream = null;
  let photoFile = null;
  let cameraFile = null;
  let photoObjectUrl = null;
  let cameraObjectUrl = null;

  const FAV_KEY = "heritage_ai_favs";

  function loadList(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }

  function saveList(key, list) {
    localStorage.setItem(key, JSON.stringify(list.slice(0, 24)));
  }

  function toggleFav(id, btn) {
    const list = loadList(FAV_KEY);
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.unshift(id);
    saveList(FAV_KEY, list);
    if (btn) btn.classList.toggle("is-fav", list.includes(id));
  }

  function setStatus(message, isError = false) {
    els.status.textContent = message;
    els.status.style.color = isError ? "#ff8f8f" : "";
  }

  function setLoading(on, text = "이미지 검색 중…") {
    els.loading.hidden = !on;
    if (els.loadingText) els.loadingText.textContent = text;
    document.body.classList.toggle("is-searching", on);
  }

  async function loadHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error("API 연결 실패");
      if (!data.indexReady) {
        setStatus("검색 인덱스를 준비 중입니다.", true);
        return;
      }
      setStatus("사진을 선택한 뒤 검색을 눌러 주세요.");
    } catch (error) {
      setStatus(error.message || "API에 연결하지 못했습니다.", true);
    }
  }

  function scoreLabel(score) {
    const pct = Math.max(0, Math.min(100, Math.round(Number(score) * 100)));
    return `유사도 ${pct}%`;
  }

  function displayTitle(title) {
    // hide parsed English brand labels if they leak into UI strings
    return String(title || "")
      .replace(/\b(Cartier|Bulgari|Bvlgari|Tiffany|Chanel|Hermes|Hermès|Piaget|Graff|Dior|Chopard|Boucheron|Chaumet)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function renderCards(container, rows) {
    container.replaceChildren();
    rows.forEach((row, index) => {
      const a = document.createElement("a");
      a.className = "js-card";
      a.href =
        row.detailUrl ||
        `./landing.html?open=portfolio&id=${encodeURIComponent(row.id)}`;
      a.style.animationDelay = `${Math.min(index, 12) * 0.03}s`;
      const img = document.createElement("img");
      img.src = row.coverUrl || "";
      img.alt = displayTitle(row.title) || "";
      img.loading = index < 6 ? "eager" : "lazy";
      const title = document.createElement("strong");
      title.textContent = displayTitle(row.title) || row.id;
      const score = document.createElement("em");
      score.textContent = scoreLabel(row.score);
      const fav = document.createElement("button");
      fav.type = "button";
      fav.className =
        "js-fav" + (loadList(FAV_KEY).includes(row.id) ? " is-fav" : "");
      fav.textContent = "♥";
      fav.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleFav(row.id, fav);
      });
      a.append(img, title, score, fav);
      container.append(a);
    });
  }

  async function showRelated(itemId) {
    try {
      const res = await fetch(`${API_BASE}/items/${encodeURIComponent(itemId)}`, {
        cache: "no-store",
      });
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
      setStatus("비슷한 작품을 찾지 못했습니다. 다른 사진을 시도해 보세요.");
      els.related.hidden = true;
      return;
    }
    setStatus(`${rows.length}건 찾았습니다.`);
    await showRelated(rows[0].id);
  }

  async function searchImage(file) {
    if (!file) {
      setStatus("검색할 사진이 없습니다.", true);
      return;
    }
    setLoading(true, "이미지 검색 중…");
    setStatus("");
    els.results.replaceChildren();
    els.related.hidden = true;
    try {
      const body = new FormData();
      body.append("file", file, file.name || "query.jpg");
      const res = await fetch(`${API_BASE}/search/image?limit=24`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const detail = data.detail || data.message || "이미지 검색 실패";
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      await handleResults(data);
    } finally {
      setLoading(false);
    }
  }

  function setPhotoSelected(file) {
    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    photoFile = file || null;
    if (!photoFile) {
      els.photoPreview.hidden = true;
      els.photoPreview.replaceChildren();
      els.photoDrop.hidden = false;
      els.photoClear.hidden = true;
      els.photoSearch.disabled = true;
      photoObjectUrl = null;
      return;
    }
    photoObjectUrl = URL.createObjectURL(photoFile);
    els.photoDrop.hidden = true;
    els.photoPreview.hidden = false;
    els.photoPreview.replaceChildren();
    const img = document.createElement("img");
    img.src = photoObjectUrl;
    img.alt = "선택한 사진";
    els.photoPreview.append(img);
    els.photoClear.hidden = false;
    els.photoSearch.disabled = false;
    setStatus("검색 버튼을 눌러 주세요.");
  }

  function setCameraCaptured(file) {
    if (cameraObjectUrl) URL.revokeObjectURL(cameraObjectUrl);
    cameraFile = file || null;
    if (!cameraFile) {
      els.cameraPreview.hidden = true;
      els.cameraPreview.replaceChildren();
      els.cameraSearch.disabled = true;
      cameraObjectUrl = null;
      els.cameraVideo.hidden = false;
      return;
    }
    cameraObjectUrl = URL.createObjectURL(cameraFile);
    els.cameraPreview.hidden = false;
    els.cameraPreview.replaceChildren();
    const img = document.createElement("img");
    img.src = cameraObjectUrl;
    img.alt = "촬영한 사진";
    els.cameraPreview.append(img);
    els.cameraVideo.hidden = true;
    els.cameraSearch.disabled = false;
    setStatus("촬영된 사진이 준비되었습니다. 촬영 후 검색을 눌러 주세요.");
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    els.cameraVideo.srcObject = null;
    els.cameraCapture.disabled = true;
  }

  document.querySelectorAll(".js-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".js-tabs button").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll(".js-tabpane").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.getElementById(`pane-${btn.dataset.tab}`)?.classList.add("is-active");
      if (btn.dataset.tab !== "camera") stopCamera();
    });
  });

  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatus("이미지는 10MB 이하여야 합니다.", true);
      els.fileInput.value = "";
      return;
    }
    setPhotoSelected(file);
  });

  els.photoClear.addEventListener("click", () => {
    els.fileInput.value = "";
    setPhotoSelected(null);
    setStatus("사진을 선택해 주세요.");
  });

  els.photoSearch.addEventListener("click", async () => {
    if (!photoFile) {
      setStatus("먼저 사진을 선택해 주세요.", true);
      return;
    }
    els.photoSearch.disabled = true;
    try {
      await searchImage(photoFile);
    } catch (error) {
      setStatus(error.message || "검색 실패", true);
    } finally {
      els.photoSearch.disabled = !photoFile;
    }
  });

  els.cameraStart.addEventListener("click", async () => {
    try {
      stopCamera();
      setCameraCaptured(null);
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      els.cameraVideo.srcObject = cameraStream;
      els.cameraVideo.hidden = false;
      await els.cameraVideo.play();
      els.cameraCapture.disabled = false;
      els.cameraSearch.disabled = true;
      setStatus("카메라를 맞춘 뒤 촬영을 눌러 주세요.");
    } catch (error) {
      setStatus("카메라 권한이 필요합니다.", true);
      els.cameraCapture.disabled = true;
      els.cameraSearch.disabled = true;
    }
  });

  els.cameraCapture.addEventListener("click", async () => {
    const video = els.cameraVideo;
    if (!video.srcObject || !video.videoWidth) {
      setStatus("카메라가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.", true);
      return;
    }
    try {
      const canvas = els.cameraCanvas;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.");
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("촬영에 실패했습니다."))),
          "image/jpeg",
          0.92
        );
      });
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      setCameraCaptured(file);
    } catch (error) {
      setStatus(error.message || "촬영에 실패했습니다.", true);
    }
  });

  els.cameraSearch.addEventListener("click", async () => {
    if (!cameraFile) {
      setStatus("먼저 촬영 버튼을 눌러 사진을 저장해 주세요.", true);
      return;
    }
    els.cameraSearch.disabled = true;
    try {
      await searchImage(cameraFile);
    } catch (error) {
      setStatus(error.message || "검색 실패", true);
    } finally {
      els.cameraSearch.disabled = !cameraFile;
    }
  });

  loadHealth();
})();
