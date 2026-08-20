(() => {
  "use strict";

  /**
   * Customer preview gate — set true to re-enable video upload + “동영상” copy.
   * Restore: VIDEO_UPLOAD_ENABLED = true → deploy.
   */
  const VIDEO_UPLOAD_ENABLED = false;

  const VIDEO_EXT = /\.(mp4|webm|mov)(?:$|\?)/i;
  const IMAGE_EXT = /\.(jpe?g|png|webp|gif)(?:$|\?)/i;
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  const MAX_VIDEO_SECONDS = 30;
  const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp";
  const ACCEPT_VIDEO = ",video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
  const ACCEPT = ACCEPT_IMAGE + (VIDEO_UPLOAD_ENABLED ? ACCEPT_VIDEO : "");

  function videoUploadEnabled() {
    return VIDEO_UPLOAD_ENABLED;
  }

  function writerCopy() {
    if (VIDEO_UPLOAD_ENABLED) {
      return {
        coverLabel: "대표 사진·동영상 선택",
        detailsTitle: "추가 사진·동영상",
        detailsHint: "사진 또는 동영상(최대 30초·50MB)",
        detailsBtn: "클릭하여 사진·동영상 추가",
        helpEdit: "미디어를 바꾸지 않으면 기존 파일이 유지됩니다. 동영상은 추가 미디어로 올려 주세요.",
        helpShipping: "카테고리·게시일을 선택한 뒤 대표 사진과 추가 사진/동영상을 올려 주세요.",
        helpNotice: "대표 사진은 필수, 추가 동영상은 최대 30초·50MB(mp4/webm)입니다.",
      };
    }
    return {
      coverLabel: "대표 사진 선택",
      detailsTitle: "추가 사진",
      detailsHint: "클릭하여 사진 추가",
      detailsBtn: "클릭하여 사진 추가",
      helpEdit: "미디어를 바꾸지 않으면 기존 파일이 유지됩니다.",
      helpShipping: "카테고리·게시일을 선택한 뒤 대표 사진과 추가 사진을 올려 주세요.",
      helpNotice: "대표 사진은 필수입니다.",
    };
  }

  /** Apply accept + writer labels for current VIDEO_UPLOAD_ENABLED. */
  function syncWriterMediaUi(root = document) {
    if (!root || !root.querySelectorAll) return;
    const copy = writerCopy();
    root.querySelectorAll('input[type="file"][name="cover"], input[type="file"][name="images"]').forEach((input) => {
      input.setAttribute("accept", ACCEPT);
      const label = input.closest("label");
      if (!label) return;
      for (const node of label.childNodes) {
        if (node.nodeType === 3 && String(node.textContent || "").trim()) {
          node.textContent =
            input.getAttribute("name") === "cover" ? copy.coverLabel : copy.detailsBtn;
        }
      }
    });
    root.querySelectorAll("strong, span, p, small, label").forEach((el) => {
      if (el.querySelector && el.querySelector('input[type="file"]')) return;
      const t = String(el.textContent || "").trim();
      if (!t) return;
      if (
        t === "추가 사진·동영상" ||
        t === "추가 사진" ||
        t === "추가 이미지" ||
        /^추가 사진/.test(t)
      ) {
        if (el.tagName === "STRONG" || el.classList?.contains?.("pf-writer-section-title")) {
          el.textContent = copy.detailsTitle;
        }
      }
      if (
        t.includes("사진 또는 동영상") ||
        t.includes("최대 30초") ||
        t === "클릭하여 사진·동영상 추가" ||
        t === "클릭하여 사진 추가"
      ) {
        if (el.tagName === "SPAN" || el.tagName === "SMALL" || el.tagName === "P") {
          el.textContent = t.startsWith("클릭") ? copy.detailsBtn : copy.detailsHint;
        }
      }
      if (t === "대표 사진·동영상 선택" || t === "대표 사진 선택" || t === "대표 이미지 선택") {
        if (!el.querySelector?.('input[type="file"]')) el.textContent = copy.coverLabel;
      }
    });
  }
  function isVideoFile(file) {
    if (!file) return false;
    const type = String(file.type || "").toLowerCase();
    if (type.startsWith("video/")) return true;
    return VIDEO_EXT.test(String(file.name || ""));
  }

  function isImageFile(file) {
    if (!file) return false;
    const type = String(file.type || "").toLowerCase();
    if (type.startsWith("image/")) return true;
    return IMAGE_EXT.test(String(file.name || ""));
  }

  function isVideoUrl(url) {
    return VIDEO_EXT.test(String(url || "").split("#")[0]);
  }

  /** List/card thumb: never feed a video URL into <img>. */
  function thumbUrl(item) {
    if (!item || typeof item !== "object") return "";
    const poster = String(item.coverPoster || "").trim();
    if (poster) return poster;
    const cover = String(item.cover || item.image || "").trim();
    if (cover && !isVideoUrl(cover)) return cover;
    const images = Array.isArray(item.images) ? item.images : [];
    for (const entry of images) {
      const path = typeof entry === "string" ? entry : entry?.path || entry?.url || "";
      if (path && !isVideoUrl(path)) return String(path).trim();
    }
    return "";
  }

  function readVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const done = (err, duration) => {
        URL.revokeObjectURL(url);
        video.removeAttribute("src");
        video.load();
        if (err) reject(err);
        else resolve(duration);
      };
      video.onloadedmetadata = () => {
        const duration = Number(video.duration);
        if (!Number.isFinite(duration) || duration <= 0) {
          done(new Error("영상 길이를 확인할 수 없습니다."));
          return;
        }
        done(null, duration);
      };
      video.onerror = () => done(new Error("영상 파일을 읽을 수 없습니다."));
      video.src = url;
    });
  }

  /** Capture a JPEG still (~1s or first frame) for list thumbnails. */
  function captureVideoPoster(file, seekTo = 0.8) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        video.removeAttribute("src");
        video.load();
      };
      const fail = (err) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err || "썸네일 생성 실패")));
      };
      video.onerror = () => fail(new Error("영상 썸네일을 만들 수 없습니다."));
      video.onloadeddata = () => {
        try {
          const duration = Number(video.duration) || 0;
          const target = duration > 1 ? Math.min(seekTo, duration * 0.25) : 0;
          if (target > 0.05) video.currentTime = target;
          else snap();
        } catch (error) {
          fail(error);
        }
      };
      const snap = () => {
        try {
          const w = video.videoWidth || 720;
          const h = video.videoHeight || 720;
          if (!w || !h) return fail(new Error("영상 프레임을 읽을 수 없습니다."));
          const maxSide = 1200;
          const scale = Math.min(1, maxSide / Math.max(w, h));
          const cw = Math.max(1, Math.round(w * scale));
          const ch = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, cw, ch);
          canvas.toBlob(
            (blob) => {
              cleanup();
              if (!blob) return reject(new Error("썸네일 인코딩에 실패했습니다."));
              const base = String(file.name || "cover").replace(/\.[^.]+$/, "") || "cover";
              resolve(new File([blob], `${base}-poster.jpg`, { type: "image/jpeg" }));
            },
            "image/jpeg",
            0.82
          );
        } catch (error) {
          fail(error);
        }
      };
      video.onseeked = snap;
      video.src = url;
    });
  }

  async function assertMediaFile(file, { allowVideo = VIDEO_UPLOAD_ENABLED } = {}) {
    if (!file) throw new Error("파일을 선택해 주세요.");
    if (isVideoFile(file)) {
      if (!allowVideo) throw new Error("지금은 사진만 올릴 수 있습니다.");
      if (file.size > MAX_VIDEO_BYTES) {
        throw new Error(`${file.name}: 동영상은 50MB 이하여야 합니다.`);
      }
      const duration = await readVideoDuration(file);
      if (duration > MAX_VIDEO_SECONDS + 0.05) {
        throw new Error(
          `${file.name}: 동영상은 ${MAX_VIDEO_SECONDS}초 이하여야 합니다. (현재 ${Math.ceil(duration)}초)`
        );
      }
      return "video";
    }
    if (isImageFile(file)) {
      if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name}: 이미지는 8MB 이하여야 합니다.`);
      return "image";
    }
    throw new Error(`${file.name}: jpeg/png/webp 또는 mp4/webm만 지원합니다.`);
  }

  /** Validate + (for video) extract poster immediately on file pick. */
  async function prepareLocalMedia(file, { allowVideo = VIDEO_UPLOAD_ENABLED } = {}) {
    const kind = await assertMediaFile(file, { allowVideo });
    const preview = URL.createObjectURL(file);
    if (kind !== "video") {
      return {
        file,
        kind,
        preview,
        posterFile: null,
        posterPreview: "",
        displayPreview: preview,
      };
    }
    const posterFile = await captureVideoPoster(file);
    const posterPreview = URL.createObjectURL(posterFile);
    return {
      file,
      kind,
      preview,
      posterFile,
      posterPreview,
      displayPreview: posterPreview,
    };
  }

  function revokeMediaPreview(entry) {
    if (!entry || typeof entry !== "object") return;
    if (entry.preview?.startsWith?.("blob:")) {
      try {
        URL.revokeObjectURL(entry.preview);
      } catch (_) {}
    }
    if (entry.posterPreview?.startsWith?.("blob:")) {
      try {
        URL.revokeObjectURL(entry.posterPreview);
      } catch (_) {}
    }
  }

  function formatClock(sec) {
    const n = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(n / 60);
    const s = n % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function attachVideoChrome(video) {
    const wrap = document.createElement("div");
    wrap.className = "board-video-wrap";

    const bar = document.createElement("div");
    bar.className = "board-video-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "영상 재생");

    const seek = document.createElement("div");
    seek.className = "board-video-seek";
    seek.setAttribute("role", "slider");
    seek.setAttribute("aria-valuemin", "0");
    seek.setAttribute("aria-valuemax", "100");
    seek.setAttribute("aria-valuenow", "0");
    seek.tabIndex = 0;

    const fill = document.createElement("div");
    fill.className = "board-video-seek__fill";
    const knob = document.createElement("div");
    knob.className = "board-video-seek__knob";
    seek.append(fill, knob);

    const time = document.createElement("span");
    time.className = "board-video-time";
    time.textContent = "0:00 / 0:00";

    bar.append(seek, time);
    wrap.append(video, bar);

    let dragging = false;

    const syncUi = () => {
      const duration = Number(video.duration) || 0;
      const current = Number(video.currentTime) || 0;
      const pct = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
      fill.style.width = `${pct}%`;
      knob.style.left = `${pct}%`;
      seek.setAttribute("aria-valuenow", String(Math.round(pct)));
      time.textContent = `${formatClock(current)} / ${formatClock(duration)}`;
    };

    const seekFromClientX = (clientX) => {
      const rect = seek.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const duration = Number(video.duration) || 0;
      if (!(duration > 0)) return;
      try {
        video.currentTime = ratio * duration;
      } catch (_) {}
      syncUi();
    };

    video.addEventListener("timeupdate", syncUi);
    video.addEventListener("loadedmetadata", syncUi);
    video.addEventListener("durationchange", syncUi);
    video.addEventListener("seeked", syncUi);

    const onPointerDown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      seek.classList.add("is-dragging");
      seekFromClientX(event.clientX);
      try {
        seek.setPointerCapture(event.pointerId);
      } catch (_) {}
    };
    const onPointerMove = (event) => {
      if (!dragging) return;
      event.preventDefault();
      seekFromClientX(event.clientX);
    };
    const onPointerUp = (event) => {
      if (!dragging) return;
      dragging = false;
      seek.classList.remove("is-dragging");
      seekFromClientX(event.clientX);
      try {
        seek.releasePointerCapture(event.pointerId);
      } catch (_) {}
    };

    seek.addEventListener("pointerdown", onPointerDown);
    seek.addEventListener("pointermove", onPointerMove);
    seek.addEventListener("pointerup", onPointerUp);
    seek.addEventListener("pointercancel", onPointerUp);
    seek.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    seek.addEventListener("keydown", (event) => {
      const duration = Number(video.duration) || 0;
      if (!(duration > 0)) return;
      const step = Math.max(0.5, duration * 0.05);
      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        video.currentTime = Math.min(duration, (video.currentTime || 0) + step);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        video.currentTime = Math.max(0, (video.currentTime || 0) - step);
      }
    });

    // Don't let carousel swipe steal scrub gestures.
    bar.addEventListener("pointerdown", (event) => event.stopPropagation());
    bar.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });

    syncUi();
    return wrap;
  }

  function createSlideMedia(url, { eager = false, poster = "" } = {}) {
    const src = String(url || "");
    if (isVideoUrl(src)) {
      const video = document.createElement("video");
      video.className = "board-carousel-video";
      video.src = src;
      if (poster) video.poster = poster;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.loop = true;
      video.preload = eager ? "auto" : "metadata";
      video.setAttribute("controlslist", "nodownload noplaybackrate");
      video.disablePictureInPicture = true;
      video.controls = false;
      return attachVideoChrome(video);
    }
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    return img;
  }

  function pauseAll(root) {
    if (!root) return;
    root.querySelectorAll("video").forEach((video) => {
      try {
        video.pause();
        video.currentTime = 0;
      } catch (_) {}
    });
  }

  function syncPlayback(root, index) {
    if (!root) return;
    const slides = root.querySelectorAll(".board-carousel-slide, .review-carousel-slide");
    slides.forEach((slide, i) => {
      const video = slide.querySelector("video");
      if (!video) return;
      if (i === index) {
        video.muted = true;
        const play = video.play();
        if (play && typeof play.catch === "function") play.catch(() => {});
      } else {
        try {
          video.pause();
          video.currentTime = 0;
        } catch (_) {}
      }
    });
  }

  function paintWriterThumb(el, url, kind, posterUrl = "") {
    if (!el) return;
    el.replaceChildren();
    el.style.backgroundImage = "";
    const isVideo = kind === "video" || isVideoUrl(url);
    if (!url && !posterUrl) return;
    if (isVideo) {
      el.classList.add("is-video");
      const still = posterUrl || (!isVideoUrl(url) ? url : "");
      if (still) {
        el.style.backgroundImage = `url("${still}")`;
      } else {
        const video = document.createElement("video");
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute("playsinline", "");
        el.append(video);
      }
      const badge = document.createElement("span");
      badge.className = "pf-writer-video-badge";
      badge.textContent = "VIDEO";
      el.append(badge);
      return;
    }
    el.classList.remove("is-video");
    el.style.backgroundImage = `url("${url}")`;
  }

  async function uploadFiles(apiBase, token, board, id, files, { roles = [], onProgress } = {}) {
    const list = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!list.length) return [];
    const form = new FormData();
    const roleList = [];
    list.forEach((file, index) => {
      form.append("files", file, file.name || `media-${index}`);
      roleList.push(roles[index] || "detail");
    });
    form.append("roles", roleList.join(","));

    const url = `${String(apiBase || "").replace(/\/$/, "")}/admin/boards/${encodeURIComponent(board)}/${encodeURIComponent(id)}/media`;
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.withCredentials = true;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || typeof onProgress !== "function") return;
        onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
      };
      xhr.onload = () => {
        let payload = {};
        try {
          payload = JSON.parse(xhr.responseText || "{}");
        } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300 && payload.ok !== false) resolve(payload);
        else reject(new Error(payload.message || `업로드 실패 (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("네트워크 오류로 업로드에 실패했습니다."));
      xhr.send(form);
    });
    return Array.isArray(result.assets) ? result.assets : [];
  }

  let activeHoverPreview = null;

  function stopHoverPreview(entry) {
    if (!entry) return;
    entry.thumb?.classList?.remove("is-previewing");
    const video = entry.video;
    if (!video) return;
    try {
      video.pause();
      video.currentTime = 0;
    } catch (_) {}
  }

  /**
   * List-card hover preview (muted loop) for video covers — desktop hover / coarse tap-hold.
   */
  function bindListHoverPreview(thumb, item, toUrl = (u) => String(u || "")) {
    if (!VIDEO_UPLOAD_ENABLED) return;
    if (!thumb || !item) return;
    const cover = String(item.cover || item.image || "").trim();
    if (!isVideoUrl(cover)) return;

    thumb.classList.add("is-video-thumb");
    if (!thumb.querySelector(".pf-writer-video-badge, .pf-video-badge")) {
      const badge = document.createElement("span");
      badge.className = "pf-video-badge";
      badge.textContent = "VIDEO";
      thumb.append(badge);
    }

    const poster = thumbUrl(item);
    let video = null;
    let touchTimer = 0;
    const entry = { thumb, video: null };

    const ensureVideo = () => {
      if (video) return video;
      video = document.createElement("video");
      video.className = "pf-thumb-preview";
      video.src = toUrl(cover);
      if (poster) video.poster = toUrl(poster);
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.loop = true;
      video.preload = "metadata";
      video.setAttribute("controlslist", "nodownload noplaybackrate");
      video.disablePictureInPicture = true;
      video.controls = false;
      video.setAttribute("aria-hidden", "true");
      thumb.append(video);
      entry.video = video;
      return video;
    };

    const start = () => {
      if (activeHoverPreview && activeHoverPreview !== entry) {
        stopHoverPreview(activeHoverPreview);
      }
      activeHoverPreview = entry;
      const v = ensureVideo();
      thumb.classList.add("is-previewing");
      try {
        if (v.readyState < 2) v.load();
        v.currentTime = 0;
      } catch (_) {}
      const play = v.play();
      if (play && typeof play.catch === "function") play.catch(() => {});
    };

    const stop = () => {
      if (activeHoverPreview === entry) activeHoverPreview = null;
      stopHoverPreview(entry);
    };

    thumb.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      start();
    });
    thumb.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch") return;
      stop();
    });
    thumb.addEventListener(
      "touchstart",
      () => {
        window.clearTimeout(touchTimer);
        touchTimer = window.setTimeout(start, 280);
      },
      { passive: true }
    );
    thumb.addEventListener(
      "touchend",
      () => {
        window.clearTimeout(touchTimer);
        stop();
      },
      { passive: true }
    );
    thumb.addEventListener(
      "touchcancel",
      () => {
        window.clearTimeout(touchTimer);
        stop();
      },
      { passive: true }
    );
  }

  window.GongbangBoardMedia = {
    VIDEO_UPLOAD_ENABLED,
    videoUploadEnabled,
    writerCopy,
    syncWriterMediaUi,
    ACCEPT,
    MAX_IMAGE_BYTES,
    MAX_VIDEO_BYTES,
    MAX_VIDEO_SECONDS,
    isVideoFile,
    isImageFile,
    isVideoUrl,
    thumbUrl,
    readVideoDuration,
    captureVideoPoster,
    assertMediaFile,
    prepareLocalMedia,
    revokeMediaPreview,
    createSlideMedia,
    pauseAll,
    syncPlayback,
    paintWriterThumb,
    bindListHoverPreview,
    uploadFiles,
  };

  const bootSync = () => syncWriterMediaUi(document);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSync);
  } else {
    bootSync();
  }
})();
