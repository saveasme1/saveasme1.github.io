# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"F:/공방171포폴프로젝트/_pwa_push/groupbuy-calendar.js")
text = p.read_text(encoding="utf-8")

old_media = '''    const mediaState = {
      id: null,
      coverPath: "",
      images: [],
      publishedAt: "",
    };

    function syncMeta() {
      dlg.querySelector("[data-start]").textContent = rangeState.start
        ? `시작 ${rangeState.start}`
        : "시작일 선택";
      dlg.querySelector("[data-end]").textContent = rangeState.end
        ? `종료 ${rangeState.end}`
        : rangeState.start
          ? "종료일 선택"
          : "—";
    }

    function renderGallery() {
      if (mediaState.coverPath) {
        gallery.classList.remove("is-empty");
        gallery.innerHTML =
          `<img alt="">` +
          `<button type="button" class="pf-writer-remove gb-cal-writer__thumb-remove" aria-label="이미지 삭제">×</button>`;
        gallery.querySelector("img").src = assetUrl(mediaState.coverPath);
        gallery.querySelector("button").addEventListener("click", () => {
          mediaState.coverPath = "";
          coverInput.required = !mediaState.id || !mediaState.coverPath;
          renderGallery();
        });
      } else {
        gallery.classList.add("is-empty");
        gallery.textContent = "대표 이미지 없음";
      }
      detailGrid.replaceChildren();
      mediaState.images.forEach((path, index) => {
        const card = document.createElement("div");
        card.className = "pf-writer-thumb";
        card.innerHTML =
          `<img alt=""><span class="pf-writer-order">${index + 1}</span>` +
          `<button type="button" class="pf-writer-remove" aria-label="이미지 삭제">×</button>`;
        card.querySelector("img").src = assetUrl(path);
        card.querySelector("button").addEventListener("click", () => {
          mediaState.images = mediaState.images.filter((p) => p !== path);
          renderGallery();
        });
        detailGrid.append(card);
      });
    }'''

new_media = '''    const mediaState = {
      id: null,
      cover: { path: "", file: null, preview: "" },
      details: [],
      publishedAt: "",
    };

    function syncMeta() {
      dlg.querySelector("[data-start]").textContent = rangeState.start
        ? `시작 ${rangeState.start}`
        : "시작일 선택";
      dlg.querySelector("[data-end]").textContent = rangeState.end
        ? `종료 ${rangeState.end}`
        : rangeState.start
          ? "종료일 선택"
          : "—";
    }

    function clearCoverPreview() {
      if (mediaState.cover.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaState.cover.preview);
      }
      mediaState.cover = { path: mediaState.cover.path || "", file: null, preview: "" };
    }

    function clearDetails(keepPaths = false) {
      mediaState.details.forEach((detail) => {
        if (detail.preview?.startsWith("blob:")) URL.revokeObjectURL(detail.preview);
      });
      if (keepPaths) {
        mediaState.details = mediaState.details
          .filter((d) => d.path)
          .map((d) => ({ path: d.path, file: null, preview: "" }));
      } else {
        mediaState.details = [];
      }
    }

    function renderGallery() {
      const coverUrl =
        mediaState.cover.preview ||
        (mediaState.cover.path ? assetUrl(mediaState.cover.path) : "");
      gallery.replaceChildren();
      gallery.classList.toggle("is-empty", !coverUrl);
      gallery.style.backgroundImage = coverUrl ? `url("${coverUrl}")` : "";
      if (!coverUrl) {
        gallery.textContent = "대표 이미지 없음";
      } else {
        gallery.textContent = "";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "pf-writer-remove";
        remove.setAttribute("aria-label", "대표 이미지 삭제");
        remove.textContent = "×";
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (mediaState.cover.preview?.startsWith("blob:")) {
            URL.revokeObjectURL(mediaState.cover.preview);
          }
          mediaState.cover = { path: "", file: null, preview: "" };
          coverInput.required = !mediaState.id;
          coverInput.value = "";
          renderGallery();
        });
        gallery.append(remove);
      }

      detailGrid.replaceChildren();
      if (!mediaState.details.length) {
        const empty = document.createElement("p");
        empty.className = "pf-writer-empty";
        empty.textContent = "추가 이미지 없음 · +로 계속 추가";
        detailGrid.append(empty);
      } else {
        mediaState.details.forEach((detail, index) => {
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
            const [removed] = mediaState.details.splice(index, 1);
            if (removed?.preview?.startsWith("blob:")) URL.revokeObjectURL(removed.preview);
            renderGallery();
          });
          card.append(order, remove);
          detailGrid.append(card);
        });
      }

      // #region agent log
      requestAnimationFrame(() => {
        const gr = gallery.getBoundingClientRect();
        const imgChild = gallery.querySelector("img");
        const thumbs = detailGrid.querySelectorAll(".pf-writer-thumb").length;
        fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'img-preview',hypothesisId:'H6',location:'groupbuy-calendar.js:renderGallery',message:'writer media preview metrics',data:{coverUrl:Boolean(coverUrl),coverW:Math.round(gr.width),coverH:Math.round(gr.height),hasImgChild:Boolean(imgChild),imgNaturalW:imgChild?imgChild.naturalWidth:null,detailCount:mediaState.details.length,thumbCount:thumbs,bg:gallery.style.backgroundImage?gallery.style.backgroundImage.slice(0,48):''},timestamp:Date.now()})}).catch(()=>{});
      });
      // #endregion
    }'''

if old_media not in text:
    raise SystemExit("media block not found")
text = text.replace(old_media, new_media, 1)

old_cover_change = '''    coverInput.addEventListener("change", () => {
      const file = coverInput.files?.[0];
      if (!file) return;
      gallery.classList.remove("is-empty");
      gallery.innerHTML = `<img alt="">`;
      gallery.querySelector("img").src = URL.createObjectURL(file);
    });'''

new_cover_change = '''    coverInput.addEventListener("change", () => {
      const file = coverInput.files?.[0];
      if (!file) return;
      if (mediaState.cover.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(mediaState.cover.preview);
      }
      mediaState.cover = {
        path: mediaState.cover.path || "",
        file,
        preview: URL.createObjectURL(file),
      };
      coverInput.value = "";
      coverInput.required = false;
      renderGallery();
    });

    form.elements.images.addEventListener("change", () => {
      const files = [...(form.elements.images.files || [])];
      files.forEach((file) => {
        mediaState.details.push({ path: "", file, preview: URL.createObjectURL(file) });
      });
      form.elements.images.value = "";
      renderGallery();
    });'''

if old_cover_change not in text:
    raise SystemExit("cover change not found")
text = text.replace(old_cover_change, new_cover_change, 1)

old_submit_start = '''    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const coverFile = coverInput.files[0];
      const detailFiles = [...form.elements.images.files];
      const editing = Boolean(mediaState.id);
      if (!coverFile && !mediaState.coverPath) {
        status.textContent = "대표 이미지가 필요합니다.";
        return;
      }
      if (!rangeState.start) {
        status.textContent = "시작일을 선택해 주세요.";
        return;
      }
      const startDate = rangeState.start;
      const endDate = rangeState.end || rangeState.start;
      if (mediaState.images.length + detailFiles.length > 8) {
        status.textContent = "추가 이미지는 최대 8장까지입니다.";
        return;
      }
      submitBtn.disabled = true;
      try {
        const id = editing
          ? mediaState.id
          : `gb-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const assets = [];
        let cover = mediaState.coverPath;
        if (coverFile) {
          status.textContent = "대표 이미지 준비 중…";
          if (coverFile.size > 8 * 1024 * 1024) throw new Error("8MB 이하 이미지만 업로드할 수 있습니다.");
          assets.push({
            role: "cover",
            mime: coverFile.type || "image/jpeg",
            content: bytesToBase64(new Uint8Array(await coverFile.arrayBuffer())),
          });
        }
        const images = [...mediaState.images];
        for (let i = 0; i < detailFiles.length; i += 1) {
          status.textContent = `추가 이미지 준비 중 ${i + 1} / ${detailFiles.length}`;
          const file = detailFiles[i];
          if (file.size > 8 * 1024 * 1024) throw new Error("8MB 이하 이미지만 업로드할 수 있습니다.");
          assets.push({
            role: "detail",
            index: images.length + i + 1,
            mime: file.type || "image/jpeg",
            content: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
          });
        }
        status.textContent = "저장 중…";
        const now = window.GongbangTime?.nowIso?.() || new Date().toISOString();
        const item = {
          id,
          title: form.elements.title.value.trim(),
          content: form.elements.content.value.trim(),
          cover: cover || "",
          image: cover || "",
          images,
          startDate,
          endDate,
          publishedAt: editing ? mediaState.publishedAt || now : now,
          updatedAt: now,
          origin: "admin",
        };
        const published = await api("/admin/boards/groupbuy/publish", {
          method: "PUT",
          body: JSON.stringify({ item, assets }),
        });
        const saved = published.item || item;
        status.textContent = editing ? "수정되었습니다." : "등록되었습니다.";
        form.reset();
        rangeState.start = "";
        rangeState.end = "";
        mediaState.id = null;
        mediaState.coverPath = "";
        mediaState.images = [];
        mediaState.publishedAt = "";
        dlg.close();'''

new_submit_start = '''    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const coverFile = mediaState.cover.file;
      const detailFiles = mediaState.details.filter((d) => d.file).map((d) => d.file);
      const editing = Boolean(mediaState.id);
      if (!coverFile && !mediaState.cover.path) {
        status.textContent = "대표 이미지가 필요합니다.";
        return;
      }
      if (!rangeState.start) {
        status.textContent = "시작일을 선택해 주세요.";
        return;
      }
      const startDate = rangeState.start;
      const endDate = rangeState.end || rangeState.start;
      if (mediaState.details.length > 8) {
        status.textContent = "추가 이미지는 최대 8장까지입니다.";
        return;
      }
      submitBtn.disabled = true;
      try {
        const id = editing
          ? mediaState.id
          : `gb-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        const assets = [];
        let cover = mediaState.cover.path;
        if (coverFile) {
          status.textContent = "대표 이미지 준비 중…";
          if (coverFile.size > 8 * 1024 * 1024) throw new Error("8MB 이하 이미지만 업로드할 수 있습니다.");
          assets.push({
            role: "cover",
            mime: coverFile.type || "image/jpeg",
            content: bytesToBase64(new Uint8Array(await coverFile.arrayBuffer())),
          });
        }
        const images = mediaState.details.filter((d) => d.path).map((d) => d.path);
        for (let i = 0; i < detailFiles.length; i += 1) {
          status.textContent = `추가 이미지 준비 중 ${i + 1} / ${detailFiles.length}`;
          const file = detailFiles[i];
          if (file.size > 8 * 1024 * 1024) throw new Error("8MB 이하 이미지만 업로드할 수 있습니다.");
          assets.push({
            role: "detail",
            index: images.length + i + 1,
            mime: file.type || "image/jpeg",
            content: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
          });
        }
        status.textContent = "저장 중…";
        const now = window.GongbangTime?.nowIso?.() || new Date().toISOString();
        const item = {
          id,
          title: form.elements.title.value.trim(),
          content: form.elements.content.value.trim(),
          cover: cover || "",
          image: cover || "",
          images,
          startDate,
          endDate,
          publishedAt: editing ? mediaState.publishedAt || now : now,
          updatedAt: now,
          origin: "admin",
        };
        const published = await api("/admin/boards/groupbuy/publish", {
          method: "PUT",
          body: JSON.stringify({ item, assets }),
        });
        const saved = published.item || item;
        status.textContent = editing ? "수정되었습니다." : "등록되었습니다.";
        form.reset();
        rangeState.start = "";
        rangeState.end = "";
        mediaState.id = null;
        if (mediaState.cover.preview?.startsWith("blob:")) URL.revokeObjectURL(mediaState.cover.preview);
        mediaState.details.forEach((d) => {
          if (d.preview?.startsWith("blob:")) URL.revokeObjectURL(d.preview);
        });
        mediaState.cover = { path: "", file: null, preview: "" };
        mediaState.details = [];
        mediaState.publishedAt = "";
        dlg.close();'''

if old_submit_start not in text:
    raise SystemExit("submit block not found")
text = text.replace(old_submit_start, new_submit_start, 1)

old_open = '''      mediaState.id = null;
      mediaState.coverPath = "";
      mediaState.images = [];
      mediaState.publishedAt = "";
      renderGallery();'''

new_open = '''      mediaState.id = null;
      if (mediaState.cover.preview?.startsWith("blob:")) URL.revokeObjectURL(mediaState.cover.preview);
      mediaState.details.forEach((d) => {
        if (d.preview?.startsWith("blob:")) URL.revokeObjectURL(d.preview);
      });
      mediaState.cover = { path: "", file: null, preview: "" };
      mediaState.details = [];
      mediaState.publishedAt = "";
      renderGallery();'''

if old_open not in text:
    raise SystemExit("open reset not found")
text = text.replace(old_open, new_open, 1)

old_edit = '''      mediaState.id = normalized.id;
      mediaState.coverPath = normalized.cover || "";
      mediaState.images = [...(normalized.images || [])].filter(
        (path) => path && path !== mediaState.coverPath
      );
      mediaState.publishedAt = normalized.publishedAt || "";
      rangeState.start = normalized.startDate;
      rangeState.end =
        normalized.endDate && normalized.endDate !== normalized.startDate
          ? normalized.endDate
          : "";
      const startParts = parseKey(normalized.startDate) || kstParts();
      rangeState.year = startParts.year;
      rangeState.month = startParts.month;
      coverInput.required = !mediaState.coverPath;
      renderGallery();'''

new_edit = '''      mediaState.id = normalized.id;
      if (mediaState.cover.preview?.startsWith("blob:")) URL.revokeObjectURL(mediaState.cover.preview);
      mediaState.details.forEach((d) => {
        if (d.preview?.startsWith("blob:")) URL.revokeObjectURL(d.preview);
      });
      mediaState.cover = {
        path: normalized.cover || "",
        file: null,
        preview: "",
      };
      mediaState.details = [...(normalized.images || [])]
        .filter((path) => path && path !== mediaState.cover.path)
        .map((path) => ({ path, file: null, preview: "" }));
      mediaState.publishedAt = normalized.publishedAt || "";
      rangeState.start = normalized.startDate;
      rangeState.end =
        normalized.endDate && normalized.endDate !== normalized.startDate
          ? normalized.endDate
          : "";
      const startParts = parseKey(normalized.startDate) || kstParts();
      rangeState.year = startParts.year;
      rangeState.month = startParts.month;
      coverInput.required = !mediaState.cover.path;
      renderGallery();'''

if old_edit not in text:
    raise SystemExit("edit reset not found")
text = text.replace(old_edit, new_edit, 1)

# ensure cover has overflow hidden for remove button positioning
p.write_text(text, encoding="utf-8")
print("js patched ok")
# sanity
for needle in ["mediaState.coverPath", "gallery.innerHTML = `<img", "mediaState.images"]:
    print(needle, text.count(needle))
