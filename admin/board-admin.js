(() => {
  "use strict";
  const body = document.body.dataset;
  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  const RAW = "https://raw.githubusercontent.com/saveasme1/gongbang171_temp/main";
  const type = body.boardType;
  const label = body.boardLabel;
  const draftPath = `${type}-draft.json`;
  const dataPath = `${type}-data.json`;
  const $ = (id) => document.getElementById(id);
  const els = Object.fromEntries([
    "loginShell","loginForm","usernameInput","passwordInput","loginStatus","adminApp","syncState","logoutButton",
    "publishButton","newButton","searchInput","boardSummary","postList","emptyEditor","editorForm","itemId",
    "editMode","editorTitle","publishedAtInput","titleInput","contentInput","coverPreview","coverInput","detailInput",
    "detailGrid","editorStatus","deleteButton","cancelButton","saveButton","publishDialog","changeSummary",
    "selectAllInput","bulkActions","selectionCount","bulkDeleteButton",
  ].map((id) => [id, $(id)]));
  const state = {
    draft: { version: 1, items: [] },
    published: { version: 1, items: [] },
    draftSha: "",
    publishedSha: "",
    selected: null,
    cover: { path: "", file: null },
    details: [],
    selectedIds: new Set(),
    busy: false,
    contentEditor: null,
  };

  const bytesToBase64 = (bytes) => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  };
  const textToBase64 = (value) => bytesToBase64(new TextEncoder().encode(value));
  const decodeBase64 = (value) =>
    new TextDecoder().decode(Uint8Array.from(atob(String(value || "").replace(/\s/g, "")), (char) => char.charCodeAt(0)));
  const dateLocal = (value = new Date()) =>
    window.GongbangTime ? window.GongbangTime.toDateTimeLocal(value) : "";
  const sortItems = (items) => [...items].sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
  const assetUrl = (value) => /^https?:\/\//i.test(value || "") ? value : `${RAW}/${String(value || "").replace(/^\/+/, "")}`;
  const message = (element, text, tone = "") => {
    element.textContent = text;
    element.className = `form-status ${tone}`.trim();
  };
  const normalize = (item = {}) => ({
    id: String(item.id || ""),
    title: String(item.title || ""),
    content: String(item.content || item.body || ""),
    cover: String(item.cover || item.image || ""),
    image: String(item.cover || item.image || ""),
    images: (Array.isArray(item.images) ? item.images : []).map(String).filter(Boolean),
    publishedAt: item.publishedAt || item.uploadedAt || new Date().toISOString(),
    sourceUrl: String(item.sourceUrl || ""),
    sourceExternalId: String(item.sourceExternalId || ""),
    updatedAt: item.updatedAt || new Date().toISOString(),
  });

  async function request(path, options = {}) {
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
  async function readFile(path, optional = false) {
    const params = new URLSearchParams({ path, _: Date.now() });
    if (optional) params.set("optional", "1");
    const payload = await request(`/admin/files?${params}`);
    if (!payload.file) return null;
    return { value: JSON.parse(decodeBase64(payload.file.content)), sha: payload.file.sha };
  }
  async function putFile(path, content, commitMessage, sha = "") {
    return request("/admin/files", {
      method: "PUT",
      body: JSON.stringify({ path, content, message: commitMessage, sha }),
    });
  }
  function pending() {
    return JSON.stringify(sortItems(state.draft.items).map(normalize)) !== JSON.stringify(sortItems(state.published.items).map(normalize));
  }
  function refreshStatus() {
    const changed = pending();
    els.syncState.textContent = changed ? "배포하지 않은 변경사항 있음" : `공개 데이터와 동기화 · ${state.draft.items.length}개`;
    els.syncState.classList.toggle("pending", changed);
    els.publishButton.disabled = state.busy || !changed;
  }
  function currentItems() {
    const query = els.searchInput.value.trim().toLowerCase();
    return sortItems(state.draft.items).filter((item) => !query || `${item.title} ${item.content}`.toLowerCase().includes(query));
  }
  function updateBulk() {
    [...state.selectedIds].forEach((id) => {
      if (!state.draft.items.some((item) => item.id === id)) state.selectedIds.delete(id);
    });
    const ids = currentItems().map((item) => item.id);
    const selectedVisible = ids.filter((id) => state.selectedIds.has(id));
    els.selectAllInput.checked = ids.length > 0 && selectedVisible.length === ids.length;
    els.selectAllInput.indeterminate = selectedVisible.length > 0 && selectedVisible.length < ids.length;
    els.bulkActions.hidden = state.selectedIds.size === 0;
    els.selectionCount.textContent = `${state.selectedIds.size}개 선택`;
  }
  function renderList() {
    const items = currentItems();
    els.postList.replaceChildren();
    els.boardSummary.textContent = `전체 ${state.draft.items.length}개 · 표시 ${items.length}개`;
    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = `post-card ${state.selected?.id === item.id ? "active" : ""} ${state.selectedIds.has(item.id) ? "selected" : ""}`.replace(/\s+/g, " ").trim();
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      const wrap = document.createElement("label");
      wrap.className = "post-select-wrap";
      wrap.setAttribute("aria-label", `${item.title} 선택`);
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "post-checkbox";
      checkbox.checked = state.selectedIds.has(item.id);
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.selectedIds.add(item.id);
        else state.selectedIds.delete(item.id);
        card.classList.toggle("selected", checkbox.checked);
        updateBulk();
      });
      wrap.append(checkbox);
      const thumb = document.createElement("span");
      thumb.className = "post-thumb";
      if (item.cover) thumb.style.backgroundImage = `url("${assetUrl(item.cover)}")`;
      const meta = document.createElement("span");
      meta.className = "post-meta";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const date = document.createElement("span");
      date.textContent = `${window.GongbangTime ? window.GongbangTime.formatDate(item.publishedAt) : ""} · 이미지 ${[item.cover, ...item.images].filter(Boolean).length}장`;
      meta.append(title, date);
      card.append(wrap, thumb, meta);
      card.addEventListener("click", () => openEditor(item));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openEditor(item);
        }
      });
      els.postList.append(card);
    });
    updateBulk();
  }
  async function bulkRemove() {
    if (!state.selectedIds.size) return;
    if (!confirm(`${state.selectedIds.size}개 게시글을 삭제할까요?`)) return;
    state.busy = true;
    els.bulkDeleteButton.disabled = true;
    try {
      const removeEditorOpen = state.selected && state.selectedIds.has(state.selected.id);
      state.draft.items = state.draft.items.filter((item) => !state.selectedIds.has(item.id));
      const result = await putFile(draftPath, textToBase64(JSON.stringify(state.draft)), `${type} draft: delete ${state.selectedIds.size} items`, state.draftSha);
      state.draftSha = result.content.sha;
      state.selectedIds.clear();
      if (removeEditorOpen) closeEditor();
      else renderList();
    } catch (error) {
      alert(error.message);
    } finally {
      state.busy = false;
      els.bulkDeleteButton.disabled = false;
      refreshStatus();
    }
  }
  function renderImages() {
    const cover = state.cover.file ? URL.createObjectURL(state.cover.file) : state.cover.path ? assetUrl(state.cover.path) : "";
    els.coverPreview.classList.toggle("empty", !cover);
    els.coverPreview.textContent = cover ? "" : "대표 이미지 없음";
    els.coverPreview.style.backgroundImage = cover ? `url("${cover}")` : "";
    els.detailGrid.replaceChildren();
    state.details.forEach((detail, index) => {
      const card = document.createElement("div");
      card.className = "detail-card";
      const url = detail.file ? URL.createObjectURL(detail.file) : assetUrl(detail.path);
      card.style.backgroundImage = `url("${url}")`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "detail-remove";
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        state.details.splice(index, 1);
        renderImages();
      });
      const order = document.createElement("span");
      order.className = "detail-order";
      order.textContent = String(index + 1);
      card.append(remove, order);
      els.detailGrid.append(card);
    });
  }
  function openEditor(item = null) {
    state.selected = item;
    state.cover = { path: item?.cover || "", file: null };
    state.details = (item?.images || []).map((path) => ({ path, file: null }));
    els.emptyEditor.hidden = true;
    els.editorForm.hidden = false;
    els.itemId.value = item?.id || "";
    els.editMode.textContent = item ? `POST · ${window.GongbangTime ? window.GongbangTime.formatDate(item.publishedAt) : ""}` : "NEW POST";
    els.editorTitle.textContent = item ? `${label} 수정` : `${label} 작성`;
    els.publishedAtInput.value = dateLocal(item?.publishedAt || new Date());
    els.titleInput.value = item?.title || "";
    els.contentInput.value = item?.content || "";
    if (!state.contentEditor) {
      state.contentEditor = window.GongbangHtmlEditor?.mount(els.contentInput) || null;
    }
    state.contentEditor?.setMode(
      item?.content && window.GongbangHtmlEditor?.looksLikeHtml?.(item.content) ? "source" : "text"
    );
    els.deleteButton.hidden = !item;
    message(els.editorStatus, "");
    renderImages();
    if (window.innerWidth < 881) {
      els.editorForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function closeEditor() {
    state.selected = null;
    els.editorForm.hidden = true;
    els.emptyEditor.hidden = false;
    renderList();
  }
  async function upload(file, id, role, index = 0) {
    if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: 8MB 이하 이미지만 업로드할 수 있습니다.`);
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type] || "jpg";
    const suffix = index ? `-${index}` : "";
    const path = `${type}/uploads/${id}/${role}${suffix}-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await putFile(path, bytesToBase64(bytes), `${type}: upload ${id} ${role}${suffix}`);
    return path;
  }
  async function save(event) {
    event.preventDefault();
    if (!state.cover.path && !state.cover.file) return message(els.editorStatus, "대표 이미지를 선택해 주세요.", "error");
    if (state.details.length > 8) return message(els.editorStatus, "추가 이미지는 최대 8장입니다.", "error");
    state.busy = true;
    els.saveButton.disabled = true;
    try {
      const id = state.selected?.id || `admin-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      let cover = state.cover.path;
      if (state.cover.file) {
        message(els.editorStatus, "대표 이미지 업로드 중…");
        cover = await upload(state.cover.file, id, "cover");
      }
      const images = [];
      for (let index = 0; index < state.details.length; index += 1) {
        const detail = state.details[index];
        if (detail.file) {
          message(els.editorStatus, `추가 이미지 업로드 중 ${index + 1} / ${state.details.length}`);
          images.push(await upload(detail.file, id, "detail", index + 1));
        } else if (detail.path) images.push(detail.path);
      }
      const item = normalize({
        ...(state.selected || {}),
        id,
        title: els.titleInput.value.trim(),
        content: els.contentInput.value.trim(),
        cover,
        images,
        publishedAt: window.GongbangTime ? window.GongbangTime.fromDateTimeLocal(els.publishedAtInput.value) : new Date(els.publishedAtInput.value).toISOString(),
        updatedAt: window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString(),
      });
      const index = state.draft.items.findIndex((entry) => entry.id === id);
      if (index >= 0) state.draft.items[index] = item;
      else state.draft.items.unshift(item);
      state.draft.items = sortItems(state.draft.items.map(normalize));
      const result = await putFile(draftPath, textToBase64(JSON.stringify(state.draft)), `${type} draft: save ${id}`, state.draftSha);
      state.draftSha = result.content.sha;
      state.selected = item;
      renderList();
      openEditor(item);
      message(els.editorStatus, "초안 저장 완료 · 배포하기 전에는 공개되지 않습니다.", "success");
    } catch (error) {
      message(els.editorStatus, error.message, "error");
    } finally {
      state.busy = false;
      els.saveButton.disabled = false;
      refreshStatus();
    }
  }
  async function remove() {
    if (!state.selected || !confirm(`“${state.selected.title}” 게시글을 삭제할까요?`)) return;
    state.draft.items = state.draft.items.filter((item) => item.id !== state.selected.id);
    const result = await putFile(draftPath, textToBase64(JSON.stringify(state.draft)), `${type} draft: delete ${state.selected.id}`, state.draftSha);
    state.draftSha = result.content.sha;
    closeEditor();
    refreshStatus();
  }
  async function publish() {
    if (!pending()) return;
    state.busy = true;
    try {
      const published = {
        version: 1,
        publishedAt: window.GongbangTime ? window.GongbangTime.nowIso() : new Date().toISOString(),
        items: sortItems(state.draft.items.map(normalize)),
      };
      const result = await putFile(dataPath, textToBase64(JSON.stringify(published)), `${type}: publish ${published.items.length} items`, state.publishedSha);
      state.published = structuredClone(published);
      state.publishedSha = result.content.sha;
      els.publishDialog.close();
      els.syncState.textContent = `배포 완료 · ${published.items.length}개`;
    } finally {
      state.busy = false;
      refreshStatus();
    }
  }
  async function loadAdmin() {
    const me = await request("/auth/me");
    if (!me.member || me.member.role !== "admin") throw new Error("관리자 로그인이 필요합니다.");
    const [published, draft] = await Promise.all([readFile(dataPath, true), readFile(draftPath, true)]);
    const empty = { version: 1, items: [] };
    state.published = { ...(published?.value || empty), items: (published?.value?.items || []).map(normalize) };
    state.publishedSha = published?.sha || "";
    state.draft = { ...(draft?.value || published?.value || empty), items: (draft?.value?.items || published?.value?.items || []).map(normalize) };
    state.draftSha = draft?.sha || "";
    els.loginShell.hidden = true;
    els.adminApp.hidden = false;
    renderList();
    refreshStatus();
    const editId = new URLSearchParams(location.search).get("edit");
    if (editId) {
      const item = state.draft.items.find((entry) => entry.id === editId);
      if (item) openEditor(item);
    }
  }
  async function login(event) {
    event.preventDefault();
    try {
      const payload = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: els.usernameInput.value.trim(), password: els.passwordInput.value }),
      });
      if (payload.accessToken) sessionStorage.setItem(TOKEN_KEY, payload.accessToken);
      await loadAdmin();
    } catch (error) {
      message(els.loginStatus, error.message, "error");
    }
  }

  els.loginForm.addEventListener("submit", login);
  els.logoutButton.addEventListener("click", async () => {
    await request("/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
    sessionStorage.removeItem(TOKEN_KEY);
    location.replace("/admin/");
  });
  els.newButton.addEventListener("click", () => openEditor());
  els.searchInput.addEventListener("input", renderList);
  els.selectAllInput.addEventListener("change", () => {
    const items = currentItems();
    if (els.selectAllInput.checked) items.forEach((item) => state.selectedIds.add(item.id));
    else items.forEach((item) => state.selectedIds.delete(item.id));
    renderList();
  });
  els.bulkDeleteButton.addEventListener("click", () => bulkRemove().catch((error) => alert(error.message)));
  els.editorForm.addEventListener("submit", save);
  els.deleteButton.addEventListener("click", remove);
  els.cancelButton.addEventListener("click", closeEditor);
  els.publishButton.addEventListener("click", () => {
    els.changeSummary.textContent = `초안 ${state.draft.items.length}개 게시글을 공개 데이터로 배포합니다.`;
    els.publishDialog.showModal();
  });
  els.publishDialog.addEventListener("close", () => {
    if (els.publishDialog.returnValue === "confirm") publish().catch((error) => alert(error.message));
  });
  els.coverInput.addEventListener("change", () => {
    state.cover.file = els.coverInput.files[0] || null;
    renderImages();
  });
  els.detailInput.addEventListener("change", () => {
    const remaining = Math.max(0, 8 - state.details.length);
    const files = [...els.detailInput.files];
    if (files.length > remaining) alert(`추가 이미지는 최대 8장입니다. ${remaining}장만 더 추가할 수 있습니다.`);
    state.details.push(...files.slice(0, remaining).map((file) => ({ path: "", file })));
    els.detailInput.value = "";
    renderImages();
  });
  loadAdmin().catch(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    location.replace("/admin/");
  });
})();
