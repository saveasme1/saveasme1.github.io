(() => {
  "use strict";

  const HANDMADE_API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  const OWNER = "saveasme1";
  const REPO = "gongbang171_temp";
  const BRANCH = "main";
  const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;
  const DRAFT_PATH = "portfolio-draft.json";
  const PUBLISHED_PATH = "portfolio-data.json";
  const CATEGORIES = ["C", "B", "VCA", "BO", "CM", "C&H", "CL", "G", "H", "P", "F", "ETC"];
  const MAX_FILE_SIZE = 8 * 1024 * 1024;

  const $ = (id) => document.getElementById(id);
  const els = {
    loginShell: $("loginShell"),
    loginForm: $("loginForm"),
    usernameInput: $("usernameInput"),
    passwordInput: $("passwordInput"),
    loginStatus: $("loginStatus"),
    adminApp: $("adminApp"),
    syncState: $("syncState"),
    logoutButton: $("logoutButton"),
    publishButton: $("publishButton"),
    previewButton: $("previewButton"),
    newButton: $("newButton"),
    categoryFilter: $("categoryFilter"),
    searchInput: $("searchInput"),
    boardSummary: $("boardSummary"),
    selectAllInput: $("selectAllInput"),
    bulkActions: $("bulkActions"),
    selectionCount: $("selectionCount"),
    bulkMoveButton: $("bulkMoveButton"),
    bulkCopyButton: $("bulkCopyButton"),
    bulkDeleteButton: $("bulkDeleteButton"),
    postList: $("postList"),
    emptyEditor: $("emptyEditor"),
    editorForm: $("editorForm"),
    itemId: $("itemId"),
    editMode: $("editMode"),
    editorTitle: $("editorTitle"),
    dirtyBadge: $("dirtyBadge"),
    categoryInput: $("categoryInput"),
    uploadedAtInput: $("uploadedAtInput"),
    titleInput: $("titleInput"),
    contentInput: $("contentInput"),
    coverPreview: $("coverPreview"),
    coverInput: $("coverInput"),
    detailInput: $("detailInput"),
    detailGrid: $("detailGrid"),
    editorStatus: $("editorStatus"),
    deleteButton: $("deleteButton"),
    cancelButton: $("cancelButton"),
    saveButton: $("saveButton"),
    publishDialog: $("publishDialog"),
    changeSummary: $("changeSummary"),
    moveDialog: $("moveDialog"),
    moveDialogCopy: $("moveDialogCopy"),
    moveCategoryInput: $("moveCategoryInput"),
  };

  const state = {
    draft: null,
    published: null,
    draftSha: "",
    publishedSha: "",
    selectedId: "",
    dirty: false,
    busy: false,
    cover: { path: "", file: null, preview: "" },
    details: [],
    dragIndex: -1,
    selectedIds: new Set(),
    contentEditor: null,
  };

  function decodeBase64Utf8(value) {
    const binary = atob(String(value || "").replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  }

  function bytesToBase64(bytes) {
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function textToBase64(value) {
    return bytesToBase64(new TextEncoder().encode(value));
  }

  function encodePath(path) {
    return String(path).split("/").map(encodeURIComponent).join("/");
  }

  async function readGithubJson(path, optional = false) {
    const params = new URLSearchParams({ path, _: String(Date.now()) });
    if (optional) params.set("optional", "1");
    const response = await fetch(`${HANDMADE_API}/admin/files?${params}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`서버 조회 실패 (${response.status}) ${message.slice(0, 160)}`);
    }
    const payload = await response.json();
    if (!payload.file) return null;
    return {
      value: JSON.parse(decodeBase64Utf8(payload.file.content)),
      sha: payload.file.sha,
    };
  }

  async function putGithubFile(path, content, message, sha = "") {
    const response = await fetch(`${HANDMADE_API}/admin/files`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content, message, sha }),
    });
    if (!response.ok) {
      const payload = await response.text();
      if (response.status === 409 || response.status === 422) {
        throw new Error("다른 작업으로 데이터가 변경되었습니다. 새로고침 후 다시 시도해 주세요.");
      }
      throw new Error(`서버 저장 실패 (${response.status}) ${payload.slice(0, 180)}`);
    }
    return response.json();
  }

  function normalizeItem(item = {}) {
    const cover = String(item.cover || item.image || "");
    return {
      ...item,
      id: String(item.id || ""),
      category: CATEGORIES.includes(item.category) ? item.category : "ETC",
      title: String(item.title || ""),
      content: String(item.content || "").replace(/\s*<div\s+class="?[\s"]*$/i, "").trim(),
      image: cover,
      cover,
      images: (Array.isArray(item.images) ? item.images : [])
        .map(String)
        .filter(Boolean)
        .filter((path) => path !== cover),
      sourceUrl: String(item.sourceUrl || ""),
      uploadedAt: item.uploadedAt || item.createdAt || new Date(0).toISOString(),
      sortAt: item.sortAt || item.uploadedAt || item.createdAt || new Date(0).toISOString(),
      updatedAt: item.updatedAt || item.uploadedAt || new Date(0).toISOString(),
      origin: item.origin || "admin",
    };
  }

  function sortNewest(items) {
    return [...items].sort((a, b) => {
      const aTime = Date.parse(a.sortAt || a.uploadedAt || 0) || 0;
      const bTime = Date.parse(b.sortAt || b.uploadedAt || 0) || 0;
      return bTime - aTime || String(b.id).localeCompare(String(a.id));
    });
  }

  function normalizeManifest(manifest = {}) {
    return {
      ...manifest,
      version: 3,
      categories: CATEGORIES,
      items: sortNewest((Array.isArray(manifest.items) ? manifest.items : []).map(normalizeItem)),
    };
  }

  function toPublishedItem(item) {
    const normalized = normalizeItem(item);
    return {
      id: normalized.id,
      category: normalized.category,
      title: normalized.title,
      content: normalized.content,
      image: normalized.image,
      images: normalized.images,
      uploadedAt: normalized.uploadedAt,
      sortAt: normalized.sortAt,
    };
  }

  function comparableItems(manifest) {
    return JSON.stringify(
      sortNewest((manifest && manifest.items) || []).map((item) => {
        const normalized = normalizeItem(item);
        return {
          id: normalized.id,
          category: normalized.category,
          title: normalized.title,
          content: normalized.content,
          image: normalized.image,
          images: normalized.images,
          uploadedAt: normalized.uploadedAt,
          sortAt: normalized.sortAt,
        };
      })
    );
  }

  function hasPendingChanges() {
    return comparableItems(state.draft) !== comparableItems(state.published);
  }

  function changeCounts() {
    const draftMap = new Map(state.draft.items.map((item) => [item.id, normalizeItem(item)]));
    const publishedMap = new Map(state.published.items.map((item) => [item.id, normalizeItem(item)]));
    let added = 0;
    let edited = 0;
    let removed = 0;
    for (const [id, item] of draftMap) {
      if (!publishedMap.has(id)) added += 1;
      else if (JSON.stringify(item) !== JSON.stringify(publishedMap.get(id))) edited += 1;
    }
    for (const id of publishedMap.keys()) {
      if (!draftMap.has(id)) removed += 1;
    }
    return { added, edited, removed };
  }

  function setMessage(element, message, type = "") {
    element.textContent = message;
    element.className = `form-status${type ? ` ${type}` : ""}`;
  }

  function setBusy(busy, message = "") {
    state.busy = busy;
    [
      els.publishButton,
      els.newButton,
      els.saveButton,
      els.deleteButton,
      els.cancelButton,
      els.logoutButton,
      els.bulkMoveButton,
      els.bulkCopyButton,
      els.bulkDeleteButton,
    ].forEach((button) => {
      if (button) button.disabled = busy;
    });
    if (message) setMessage(els.editorStatus, message);
  }

  function imageUrl(path) {
    if (!path) return "";
    if (/^(?:https?:|blob:|data:)/i.test(path)) return path;
    return `${RAW_BASE}/${encodePath(path)}?v=${Date.now()}`;
  }

  function formatDate(value) {
    return window.GongbangTime ? window.GongbangTime.formatDateShort(value) : "";
  }

  function toDateTimeLocal(value) {
    return window.GongbangTime ? window.GongbangTime.toDateTimeLocal(value) : "";
  }

  function fromDateTimeLocal(value) {
    return window.GongbangTime ? window.GongbangTime.fromDateTimeLocal(value) : ((window.GongbangTime && window.GongbangTime.nowIso()) || new Date().toISOString());
  }

  function setDirty(dirty) {
    state.dirty = dirty;
    els.dirtyBadge.hidden = !dirty;
    refreshSyncState();
  }

  function refreshSyncState() {
    const pending = state.draft && state.published && hasPendingChanges();
    els.syncState.textContent = state.dirty
      ? "저장하지 않은 입력 있음"
      : pending
        ? "포트폴리오 변경사항 있음"
        : "공개 데이터와 동기화됨";
    els.syncState.classList.toggle("pending", state.dirty || pending);
    els.publishButton.disabled = state.busy || !pending || state.dirty;
  }

  function renderFilters() {
    const options = CATEGORIES.map(
      (category) => `<option value="${category.replace("&", "&amp;")}">${category}</option>`
    ).join("");
    els.categoryFilter.insertAdjacentHTML("beforeend", options);
    els.categoryInput.innerHTML = options;
    els.moveCategoryInput.innerHTML = options;
  }

  function visibleItems() {
    const category = els.categoryFilter.value;
    const query = els.searchInput.value.trim().toLocaleLowerCase("ko");
    return sortNewest(state.draft.items).filter((item) => {
      if (category && item.category !== category) return false;
      if (!query) return true;
      return `${item.title} ${item.content}`.toLocaleLowerCase("ko").includes(query);
    });
  }

  function renderList() {
    if (!state.draft) return;
    const items = visibleItems();
    els.boardSummary.textContent = `표시 ${items.length}개 · 초안 전체 ${state.draft.items.length}개 · 최신 게시일 순`;
    els.postList.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const card = document.createElement("div");
      card.className = [
        "post-card",
        item.id === state.selectedId ? "active" : "",
        state.selectedIds.has(item.id) ? "selected" : "",
      ].filter(Boolean).join(" ");
      card.dataset.id = item.id;
      card.setAttribute("role", "button");
      card.tabIndex = 0;

      const selectWrap = document.createElement("label");
      selectWrap.className = "post-select-wrap";
      selectWrap.setAttribute("aria-label", `${item.title} 선택`);
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "post-checkbox";
      checkbox.checked = state.selectedIds.has(item.id);
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.selectedIds.add(item.id);
        else state.selectedIds.delete(item.id);
        renderList();
      });
      selectWrap.append(checkbox);
      selectWrap.addEventListener("click", (event) => event.stopPropagation());

      const thumb = document.createElement("span");
      thumb.className = "post-thumb";
      if (item.image) thumb.style.backgroundImage = `url("${imageUrl(item.image)}")`;

      const meta = document.createElement("span");
      meta.className = "post-meta";
      const title = document.createElement("strong");
      title.textContent = item.title || "(제목 없음)";
      const info = document.createElement("span");
      const category = document.createElement("span");
      category.className = "post-category";
      category.textContent = item.category;
      info.append(category, document.createTextNode(`${formatDate(item.uploadedAt)} · 이미지 ${1 + item.images.length}장`));
      meta.append(title, info);
      card.append(selectWrap, thumb, meta);
      card.addEventListener("click", () => selectItem(item.id));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectItem(item.id);
        }
      });
      fragment.append(card);
    }
    els.postList.append(fragment);
    renderBulkSelection(items);
  }

  function renderBulkSelection(visible) {
    const visibleIds = visible.map((item) => item.id);
    const selectedVisible = visibleIds.filter((id) => state.selectedIds.has(id)).length;
    els.selectAllInput.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    els.selectAllInput.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    els.selectAllInput.disabled = !visibleIds.length || state.busy;
    const total = state.selectedIds.size;
    els.bulkActions.hidden = total === 0;
    els.selectionCount.textContent = `${total}개 선택`;
  }

  function clearObjectUrls() {
    if (state.cover.preview && state.cover.preview.startsWith("blob:")) {
      URL.revokeObjectURL(state.cover.preview);
    }
    for (const detail of state.details) {
      if (detail.preview && detail.preview.startsWith("blob:")) URL.revokeObjectURL(detail.preview);
    }
  }

  function openEditor(item = null) {
    clearObjectUrls();
    const isNew = !item;
    state.selectedId = item ? item.id : "";
    const normalized = normalizeItem(item || {});
    els.emptyEditor.hidden = true;
    els.editorForm.hidden = false;
    els.itemId.value = normalized.id;
    els.editMode.textContent = isNew ? "NEW POST" : `${normalized.category} · ${formatDate(normalized.uploadedAt)}`;
    els.editorTitle.textContent = isNew ? "새 포트폴리오 작성" : "포트폴리오 편집";
    els.categoryInput.value = normalized.category || "C";
    els.uploadedAtInput.value = toDateTimeLocal(isNew ? ((window.GongbangTime && window.GongbangTime.nowIso()) || new Date().toISOString()) : normalized.uploadedAt);
    els.titleInput.value = normalized.title;
    els.contentInput.value = normalized.content;
    if (!state.contentEditor) {
      state.contentEditor = window.GongbangHtmlEditor?.mount(els.contentInput) || null;
    }
    state.contentEditor?.setMode(
      window.GongbangHtmlEditor?.looksLikeHtml?.(normalized.content) ? "source" : "text"
    );
    state.cover = { path: normalized.image, file: null, preview: "" };
    state.details = normalized.images.map((path) => ({ path, file: null, preview: "" }));
    els.coverInput.value = "";
    els.detailInput.value = "";
    els.deleteButton.hidden = isNew;
    setMessage(els.editorStatus, "");
    setDirty(false);
    renderCover();
    renderDetails();
    renderList();
    if (window.innerWidth < 881) els.editorForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeEditor() {
    clearObjectUrls();
    state.selectedId = "";
    state.cover = { path: "", file: null, preview: "" };
    state.details = [];
    els.editorForm.hidden = true;
    els.emptyEditor.hidden = false;
    setDirty(false);
    renderList();
  }

  function selectItem(id) {
    if (state.busy) return;
    if (state.dirty && !confirm("저장하지 않은 입력이 있습니다. 다른 게시글로 이동할까요?")) return;
    const item = state.draft.items.find((entry) => entry.id === id);
    if (item) openEditor(item);
  }

  function renderCover() {
    const url = state.cover.preview || imageUrl(state.cover.path);
    els.coverPreview.classList.toggle("empty", !url);
    els.coverPreview.textContent = url ? "" : "대표 이미지 없음";
    els.coverPreview.style.backgroundImage = url ? `url("${url}")` : "";
  }

  function renderDetails() {
    els.detailGrid.replaceChildren();
    if (!state.details.length) {
      const empty = document.createElement("p");
      empty.className = "form-status";
      empty.textContent = "추가 이미지가 없습니다.";
      els.detailGrid.append(empty);
      return;
    }
    state.details.forEach((detail, index) => {
      const card = document.createElement("div");
      card.className = "detail-card";
      card.draggable = true;
      card.dataset.index = String(index);
      card.style.backgroundImage = `url("${detail.preview || imageUrl(detail.path)}")`;

      const order = document.createElement("span");
      order.className = "detail-order";
      order.textContent = String(index + 1);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "detail-remove";
      remove.setAttribute("aria-label", `${index + 1}번 이미지 삭제`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        const [removed] = state.details.splice(index, 1);
        if (removed.preview && removed.preview.startsWith("blob:")) URL.revokeObjectURL(removed.preview);
        setDirty(true);
        renderDetails();
      });

      card.addEventListener("dragstart", () => {
        state.dragIndex = index;
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("dragover", (event) => event.preventDefault());
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        if (state.dragIndex < 0 || state.dragIndex === index) return;
        const [moved] = state.details.splice(state.dragIndex, 1);
        state.details.splice(index, 0, moved);
        state.dragIndex = -1;
        setDirty(true);
        renderDetails();
      });
      card.append(order, remove);
      els.detailGrid.append(card);
    });
  }

  function validateFiles(files) {
    const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge) throw new Error(`${tooLarge.name}: 한 장당 8MB 이하만 업로드할 수 있습니다.`);
  }

  function safeExtension(file) {
    return {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[file.type] || "jpg";
  }

  async function uploadImage(file, id, role, index = 0) {
    const suffix = index ? `-${index}` : "";
    const path = `portfolio/uploads/${id}/${role}${suffix}-${Date.now()}.${safeExtension(file)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await putGithubFile(path, bytesToBase64(bytes), `portfolio: upload ${id} ${role}${suffix}`);
    return path;
  }

  async function saveDraftManifest(message) {
    state.draft.version = 3;
    state.draft.categories = CATEGORIES;
    state.draft.items = sortNewest(state.draft.items.map(normalizeItem));
    state.draft.updatedAt = ((window.GongbangTime && window.GongbangTime.nowIso()) || new Date().toISOString());
    state.draft.draftSavedAt = state.draft.updatedAt;
    const result = await putGithubFile(
      DRAFT_PATH,
      textToBase64(JSON.stringify(state.draft)),
      message,
      state.draftSha
    );
    state.draftSha = result.content.sha;
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (state.busy) return;
    const title = els.titleInput.value.trim();
    if (!title) return setMessage(els.editorStatus, "제목을 입력해 주세요.", "error");
    if (!state.cover.path && !state.cover.file) {
      return setMessage(els.editorStatus, "대표 이미지를 선택해 주세요.", "error");
    }

    try {
      const files = [
        ...(state.cover.file ? [state.cover.file] : []),
        ...state.details.filter((detail) => detail.file).map((detail) => detail.file),
      ];
      validateFiles(files);
      setBusy(true, "초안 저장 준비 중…");

      const existing = state.draft.items.find((item) => item.id === state.selectedId);
      const id = existing
        ? existing.id
        : `admin-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      let coverPath = state.cover.path;
      if (state.cover.file) {
        setMessage(els.editorStatus, "대표 이미지 업로드 중…");
        coverPath = await uploadImage(state.cover.file, id, "cover");
      }

      const detailPaths = [];
      let uploadIndex = 0;
      for (const detail of state.details) {
        if (detail.file) {
          uploadIndex += 1;
          setMessage(els.editorStatus, `추가 이미지 업로드 중 ${uploadIndex} / ${files.length - (state.cover.file ? 1 : 0)}`);
          detailPaths.push(await uploadImage(detail.file, id, "detail", uploadIndex));
        } else if (detail.path) {
          detailPaths.push(detail.path);
        }
      }

      const now = ((window.GongbangTime && window.GongbangTime.nowIso()) || new Date().toISOString());
      const item = normalizeItem({
        ...(existing || {}),
        id,
        category: els.categoryInput.value,
        title,
        content: els.contentInput.value.trim(),
        image: coverPath,
        cover: coverPath,
        images: detailPaths,
        uploadedAt: fromDateTimeLocal(els.uploadedAtInput.value),
        sortAt: fromDateTimeLocal(els.uploadedAtInput.value),
        updatedAt: now,
        origin: existing ? existing.origin : "admin",
        sourceUrl: existing ? existing.sourceUrl : "",
      });

      const index = state.draft.items.findIndex((entry) => entry.id === id);
      if (index >= 0) state.draft.items[index] = item;
      else state.draft.items.unshift(item);

      setMessage(els.editorStatus, "초안 데이터 저장 중…");
      await saveDraftManifest(`portfolio draft: ${existing ? "update" : "add"} ${id}`);
      state.selectedId = id;
      setDirty(false);
      renderList();
      openEditor(item);
      setMessage(els.editorStatus, "저장 완료 · 포트폴리오 배포 전까지 공개 PDF에는 반영되지 않습니다.", "success");
    } catch (error) {
      setMessage(els.editorStatus, error.message || String(error), "error");
    } finally {
      setBusy(false);
      refreshSyncState();
    }
  }

  async function deleteSelected() {
    if (!state.selectedId || state.busy) return;
    const item = state.draft.items.find((entry) => entry.id === state.selectedId);
    if (!item) return;
    if (!confirm(`“${item.title}” 게시글을 초안에서 삭제할까요?\n배포하기 전까지 공개 PDF에는 남아 있습니다.`)) return;
    try {
      setBusy(true, "삭제 내용 저장 중…");
      state.draft.items = state.draft.items.filter((entry) => entry.id !== item.id);
      await saveDraftManifest(`portfolio draft: delete ${item.id}`);
      closeEditor();
      renderList();
      refreshSyncState();
    } catch (error) {
      setMessage(els.editorStatus, error.message || String(error), "error");
    } finally {
      setBusy(false);
    }
  }

  function canRunBulkAction() {
    if (!state.selectedIds.size || state.busy) return false;
    if (state.dirty) {
      alert("작성 중인 게시글을 먼저 저장하거나 작성 취소해 주세요.");
      return false;
    }
    return true;
  }

  async function bulkDelete() {
    if (!canRunBulkAction()) return;
    const ids = new Set(state.selectedIds);
    if (!confirm(`선택한 ${ids.size}개 게시글을 삭제할까요?\n포트폴리오 배포 전까지 공개 PDF에는 남아 있습니다.`)) return;
    const before = structuredClone(state.draft.items);
    try {
      setBusy(true);
      els.syncState.textContent = `${ids.size}개 게시글 삭제 저장 중…`;
      state.draft.items = state.draft.items.filter((item) => !ids.has(item.id));
      await saveDraftManifest(`portfolio draft: bulk delete ${ids.size} items`);
      if (ids.has(state.selectedId)) closeEditor();
      state.selectedIds.clear();
      renderList();
    } catch (error) {
      state.draft.items = before;
      alert(error.message || String(error));
    } finally {
      setBusy(false);
      renderList();
      refreshSyncState();
    }
  }

  async function bulkCopy() {
    if (!canRunBulkAction()) return;
    const originals = state.draft.items.filter((item) => state.selectedIds.has(item.id));
    const before = structuredClone(state.draft.items);
    try {
      setBusy(true);
      els.syncState.textContent = `${originals.length}개 게시글 복사 중…`;
      const now = Date.now();
      const copies = originals.map((item, index) => {
        const timestamp = new Date(now + index).toISOString();
        return normalizeItem({
          ...structuredClone(item),
          id: `copy-${now}-${crypto.randomUUID().slice(0, 8)}`,
          uploadedAt: timestamp,
          sortAt: timestamp,
          updatedAt: timestamp,
          origin: "admin-copy",
          sourceUrl: "",
        });
      });
      state.draft.items = [...copies, ...state.draft.items];
      await saveDraftManifest(`portfolio draft: bulk copy ${copies.length} items`);
      state.selectedIds = new Set(copies.map((item) => item.id));
      renderList();
    } catch (error) {
      state.draft.items = before;
      alert(error.message || String(error));
    } finally {
      setBusy(false);
      renderList();
      refreshSyncState();
    }
  }

  function openMoveDialog() {
    if (!canRunBulkAction()) return;
    els.moveDialogCopy.textContent = `선택한 ${state.selectedIds.size}개 게시글을 이동할 카테고리를 선택하세요.`;
    const first = state.draft.items.find((item) => state.selectedIds.has(item.id));
    els.moveCategoryInput.value = first ? first.category : CATEGORIES[0];
    els.moveDialog.showModal();
  }

  async function bulkMove() {
    if (!state.selectedIds.size || state.busy) return;
    const category = els.moveCategoryInput.value;
    const ids = new Set(state.selectedIds);
    const before = structuredClone(state.draft.items);
    try {
      setBusy(true);
      els.syncState.textContent = `${ids.size}개 게시글을 ${category} 카테고리로 이동 중…`;
      const now = ((window.GongbangTime && window.GongbangTime.nowIso()) || new Date().toISOString());
      state.draft.items = state.draft.items.map((item) =>
        ids.has(item.id) ? normalizeItem({ ...item, category, updatedAt: now }) : item
      );
      await saveDraftManifest(`portfolio draft: move ${ids.size} items to ${category}`);
      if (ids.has(state.selectedId)) {
        const selected = state.draft.items.find((item) => item.id === state.selectedId);
        if (selected) openEditor(selected);
      }
      renderList();
    } catch (error) {
      state.draft.items = before;
      alert(error.message || String(error));
    } finally {
      setBusy(false);
      renderList();
      refreshSyncState();
    }
  }

  async function publishDraft() {
    if (!hasPendingChanges() || state.dirty || state.busy) return;
    try {
      setBusy(true);
      els.syncState.textContent = "공개 데이터 배포 중…";
      const now = ((window.GongbangTime && window.GongbangTime.nowIso()) || new Date().toISOString());
      const published = {
        version: 3,
        updatedAt: now,
        publishedAt: now,
        source: state.draft.source || "",
        categories: CATEGORIES,
        items: sortNewest(state.draft.items).map(toPublishedItem),
      };
      els.publishButton.textContent = "배포 데이터 전송 중…";
      const result = await putGithubFile(
        PUBLISHED_PATH,
        textToBase64(JSON.stringify(published)),
        `portfolio: publish ${published.items.length} items`,
        state.publishedSha
      );
      state.published = structuredClone(published);
      state.publishedSha = result.content.sha;
      renderList();
      refreshSyncState();
      els.syncState.textContent = `배포 완료 · ${published.items.length}개 · PDF 갱신 요청 중…`;
      handmadeRequest("/admin/portfolio/pdf/build", {
        method: "POST",
        body: "{}",
      })
        .then(() => {
          els.syncState.textContent = `배포 완료 · ${published.items.length}개 · PDF 백그라운드 갱신 중`;
        })
        .catch(() => {
          els.syncState.textContent = `배포 완료 · ${published.items.length}개 · 기존 PDF 유지`;
          els.syncState.classList.add("pending");
        });
    } catch (error) {
      els.syncState.textContent = error.message || String(error);
      els.syncState.classList.add("pending");
    } finally {
      els.publishButton.textContent = "포트폴리오 배포하기";
      setBusy(false);
      refreshSyncState();
    }
  }

  function openPublishConfirm() {
    if (state.dirty) {
      alert("현재 작성 중인 내용을 먼저 초안 저장해 주세요.");
      return;
    }
    const { added, edited, removed } = changeCounts();
    els.changeSummary.textContent = `신규 ${added}개 · 수정 ${edited}개 · 삭제 ${removed}개 · 배포 후 총 ${state.draft.items.length}개`;
    els.publishDialog.showModal();
  }

  function openPreview() {
    if (state.dirty) {
      alert("현재 작성 중인 내용을 먼저 저장해 주세요.");
      return;
    }
    try {
      sessionStorage.setItem(
        "gongbang171PortfolioPreview",
        JSON.stringify({
          version: 3,
          generatedAt: ((window.GongbangTime && window.GongbangTime.nowIso()) || new Date().toISOString()),
          categories: CATEGORIES,
          items: sortNewest(state.draft.items.map(normalizeItem)),
        })
      );
      const preview = window.open("/admin/preview.html", "_blank");
      if (!preview) alert("팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.");
    } catch (error) {
      alert(`미리보기를 준비하지 못했습니다: ${error.message || error}`);
    }
  }

  async function handmadeRequest(path, options = {}) {
    const response = await fetch(`${HANDMADE_API}${path}`, {
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

  async function loadAdmin() {
    setMessage(els.loginStatus, "관리자 데이터 확인 중…");
    const [publishedResult, draftResult] = await Promise.all([
      readGithubJson(PUBLISHED_PATH),
      readGithubJson(DRAFT_PATH, true),
    ]);
    state.published = normalizeManifest(publishedResult.value);
    state.publishedSha = publishedResult.sha;
    state.draft = normalizeManifest(draftResult ? draftResult.value : publishedResult.value);
    state.draftSha = draftResult ? draftResult.sha : "";

    els.loginShell.hidden = true;
    els.adminApp.hidden = false;
    renderList();
    refreshSyncState();
    if (!draftResult) {
      els.syncState.textContent = "초안 파일 없음 · 첫 저장 시 생성됩니다";
      els.syncState.classList.add("pending");
    }
  }

  async function login(event) {
    event.preventDefault();
    try {
      const payload = await handmadeRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: els.usernameInput.value.trim(),
          password: els.passwordInput.value,
        }),
      });
      if (payload.accessToken) sessionStorage.setItem(TOKEN_KEY, payload.accessToken);
      await loadAdmin();
      els.passwordInput.value = "";
    } catch (error) {
      setMessage(els.loginStatus, error.message || String(error), "error");
    }
  }

  async function logout() {
    if (state.dirty && !confirm("저장하지 않은 입력을 버리고 로그아웃할까요?")) return;
    await handmadeRequest("/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
    sessionStorage.removeItem(TOKEN_KEY);
    location.replace("/admin/");
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", login);
    els.logoutButton.addEventListener("click", logout);
    els.newButton.addEventListener("click", () => {
      if (state.dirty && !confirm("저장하지 않은 입력을 버리고 새 글을 작성할까요?")) return;
      openEditor();
    });
    els.categoryFilter.addEventListener("change", renderList);
    els.searchInput.addEventListener("input", renderList);
    els.selectAllInput.addEventListener("change", () => {
      const ids = visibleItems().map((item) => item.id);
      if (els.selectAllInput.checked) ids.forEach((id) => state.selectedIds.add(id));
      else ids.forEach((id) => state.selectedIds.delete(id));
      renderList();
    });
    els.bulkDeleteButton.addEventListener("click", bulkDelete);
    els.bulkCopyButton.addEventListener("click", bulkCopy);
    els.bulkMoveButton.addEventListener("click", openMoveDialog);
    els.editorForm.addEventListener("submit", saveEditor);
    els.deleteButton.addEventListener("click", deleteSelected);
    els.cancelButton.addEventListener("click", () => {
      if (state.dirty && !confirm("저장하지 않은 입력을 버릴까요?")) return;
      closeEditor();
    });
    [els.categoryInput, els.uploadedAtInput, els.titleInput, els.contentInput].forEach((input) => {
      input.addEventListener("input", () => setDirty(true));
      input.addEventListener("change", () => setDirty(true));
    });
    els.coverInput.addEventListener("change", () => {
      const [file] = els.coverInput.files;
      if (!file) return;
      if (state.cover.preview.startsWith("blob:")) URL.revokeObjectURL(state.cover.preview);
      state.cover = { path: state.cover.path, file, preview: URL.createObjectURL(file) };
      setDirty(true);
      renderCover();
    });
    els.detailInput.addEventListener("change", () => {
      const files = [...els.detailInput.files];
      for (const file of files) {
        state.details.push({ path: "", file, preview: URL.createObjectURL(file) });
      }
      els.detailInput.value = "";
      if (files.length) setDirty(true);
      renderDetails();
    });
    els.publishButton.addEventListener("click", openPublishConfirm);
    els.publishDialog.addEventListener("close", () => {
      if (els.publishDialog.returnValue === "confirm") publishDraft();
    });
    els.moveDialog.addEventListener("close", () => {
      if (els.moveDialog.returnValue === "confirm") bulkMove();
    });
    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  renderFilters();
  bindEvents();
  handmadeRequest("/auth/me")
    .then((payload) => {
      if (payload.member && payload.member.role === "admin") return loadAdmin();
      sessionStorage.removeItem(TOKEN_KEY);
      location.replace("/admin/");
      return null;
    })
    .catch(() => {
      sessionStorage.removeItem(TOKEN_KEY);
      location.replace("/admin/");
    });
})();
