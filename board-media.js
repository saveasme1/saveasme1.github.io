(() => {
  "use strict";

  const VIDEO_EXT = /\.(mp4|webm|mov)(?:$|\?)/i;
  const IMAGE_EXT = /\.(jpe?g|png|webp|gif)(?:$|\?)/i;
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  const MAX_VIDEO_SECONDS = 30;
  const ACCEPT =
    "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

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

  async function assertMediaFile(file, { allowVideo = true, cover = false } = {}) {
    if (!file) throw new Error("파일을 선택해 주세요.");
    if (cover && isVideoFile(file)) {
      throw new Error("대표(커버)는 이미지만 사용할 수 있습니다. 동영상은 추가 미디어로 올려 주세요.");
    }
    if (isVideoFile(file)) {
      if (!allowVideo) throw new Error("이 위치에는 동영상을 올릴 수 없습니다.");
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

  function createSlideMedia(url, { eager = false } = {}) {
    const src = String(url || "");
    if (isVideoUrl(src)) {
      const video = document.createElement("video");
      video.className = "board-carousel-video";
      video.src = src;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.loop = true;
      video.preload = eager ? "auto" : "metadata";
      video.setAttribute("controlslist", "nodownload noplaybackrate");
      video.disablePictureInPicture = true;
      video.controls = false;
      return video;
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

  function paintWriterThumb(el, url, kind) {
    if (!el) return;
    el.replaceChildren();
    el.style.backgroundImage = "";
    const isVideo = kind === "video" || isVideoUrl(url);
    if (!url) return;
    if (isVideo) {
      el.classList.add("is-video");
      const video = document.createElement("video");
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("playsinline", "");
      el.append(video);
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

  window.GongbangBoardMedia = {
    ACCEPT,
    MAX_IMAGE_BYTES,
    MAX_VIDEO_BYTES,
    MAX_VIDEO_SECONDS,
    isVideoFile,
    isImageFile,
    isVideoUrl,
    readVideoDuration,
    assertMediaFile,
    createSlideMedia,
    pauseAll,
    syncPlayback,
    paintWriterThumb,
    uploadFiles,
  };
})();
