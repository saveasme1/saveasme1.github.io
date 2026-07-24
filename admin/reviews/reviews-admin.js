(() => {
  "use strict";
  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  const $ = (id) => document.getElementById(id);
  const els = Object.fromEntries([
    "loginShell","loginForm","usernameInput","passwordInput","loginStatus","adminApp","syncState","logoutButton",
    "refreshMembersButton","memberStatus","approvalList","newButton","searchInput","boardSummary","postList",
    "emptyEditor","editorForm","itemId","editMode","editorTitle","publishedAtInput","titleInput","contentInput",
    "coverPreview","coverInput","detailInput","detailGrid","editorStatus","deleteButton","cancelButton","saveButton",
    "selectAllInput","bulkActions","selectionCount","bulkDeleteButton",
  ].map((id) => [id, $(id)]));
  const state = { reviews: [], selected: null, page: 1, query: "", cover: null, details: [], selectedIds: new Set() };

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
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
  const dateLocal = (value = new Date()) => {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const imageUrl = (value) => /^https?:\/\//i.test(value || "") ? value : `${new URL(API).origin}${value || ""}`;
  const message = (element, text, type = "") => {
    element.textContent = text;
    element.className = `form-status ${type}`.trim();
  };

  function renderImages(review = null) {
    const cover = state.cover ? URL.createObjectURL(state.cover) : review?.images?.[0]?.url ? imageUrl(review.images[0].url) : "";
    els.coverPreview.classList.toggle("empty", !cover);
    els.coverPreview.textContent = cover ? "" : "대표 이미지 없음";
    els.coverPreview.style.backgroundImage = cover ? `url("${cover}")` : "";
    els.detailGrid.replaceChildren();
    const existing = state.details.length ? state.details.map((file) => ({ file })) : (review?.images || []).slice(1);
    existing.forEach((entry, index) => {
      const card = document.createElement("div");
      card.className = "detail-card";
      const url = entry.file ? URL.createObjectURL(entry.file) : imageUrl(entry.url);
      card.style.backgroundImage = `url("${url}")`;
      const order = document.createElement("span");
      order.className = "detail-order";
      order.textContent = String(index + 2);
      card.append(order);
      els.detailGrid.append(card);
    });
  }

  function openEditor(review = null) {
    state.selected = review;
    state.cover = null;
    state.details = [];
    els.emptyEditor.hidden = true;
    els.editorForm.hidden = false;
    els.itemId.value = review?.id || "";
    els.editMode.textContent = review ? `REVIEW #${review.id}` : "NEW REVIEW";
    els.editorTitle.textContent = review ? "리얼후기 수정" : "리얼후기 작성";
    els.publishedAtInput.value = dateLocal(review?.publishedAt || new Date());
    els.titleInput.value = review?.title || "";
    els.contentInput.value = review?.body || "";
    els.deleteButton.hidden = !review;
    message(els.editorStatus, review ? "이미지를 바꾸지 않으면 기존 이미지가 유지됩니다." : "");
    renderImages(review);
    if (window.innerWidth < 881) {
      els.editorForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function closeEditor() {
    state.selected = null;
    state.cover = null;
    state.details = [];
    els.editorForm.hidden = true;
    els.emptyEditor.hidden = false;
  }

  function currentReviews() {
    const query = els.searchInput.value.trim().toLowerCase();
    return state.reviews.filter((item) => !query || `${item.title} ${item.body}`.toLowerCase().includes(query));
  }
  function updateBulk() {
    [...state.selectedIds].forEach((id) => {
      if (!state.reviews.some((item) => item.id === id)) state.selectedIds.delete(id);
    });
    const ids = currentReviews().map((item) => item.id);
    const selectedVisible = ids.filter((id) => state.selectedIds.has(id));
    els.selectAllInput.checked = ids.length > 0 && selectedVisible.length === ids.length;
    els.selectAllInput.indeterminate = selectedVisible.length > 0 && selectedVisible.length < ids.length;
    els.bulkActions.hidden = state.selectedIds.size === 0;
    els.selectionCount.textContent = `${state.selectedIds.size}개 선택`;
  }
  function renderList() {
    els.postList.replaceChildren();
    const filtered = currentReviews();
    els.boardSummary.textContent = `전체 ${state.reviews.length}개 · 표시 ${filtered.length}개`;
    filtered.forEach((review) => {
      const card = document.createElement("div");
      card.className = `post-card ${state.selected?.id === review.id ? "active" : ""} ${state.selectedIds.has(review.id) ? "selected" : ""}`.replace(/\s+/g, " ").trim();
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      const wrap = document.createElement("label");
      wrap.className = "post-select-wrap";
      wrap.setAttribute("aria-label", `${review.title} 선택`);
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "post-checkbox";
      checkbox.checked = state.selectedIds.has(review.id);
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.selectedIds.add(review.id);
        else state.selectedIds.delete(review.id);
        card.classList.toggle("selected", checkbox.checked);
        updateBulk();
      });
      wrap.append(checkbox);
      const thumb = document.createElement("span");
      thumb.className = "post-thumb";
      if (review.images?.[0]) thumb.style.backgroundImage = `url("${imageUrl(review.images[0].url)}")`;
      const meta = document.createElement("span");
      meta.className = "post-meta";
      const title = document.createElement("strong");
      title.textContent = review.title;
      const info = document.createElement("span");
      info.textContent = `${review.author || "공방171"} · ${new Date(review.publishedAt).toLocaleDateString("ko-KR")}`;
      meta.append(title, info);
      card.append(wrap, thumb, meta);
      card.addEventListener("click", () => openEditor(review));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openEditor(review);
        }
      });
      els.postList.append(card);
    });
    updateBulk();
  }
  async function bulkRemove() {
    if (!state.selectedIds.size) return;
    if (!confirm(`${state.selectedIds.size}개 후기를 삭제할까요?`)) return;
    els.bulkDeleteButton.disabled = true;
    try {
      for (const id of [...state.selectedIds]) {
        await request(`/reviews/${id}`, { method: "DELETE" });
      }
      state.selectedIds.clear();
      if (state.selected) closeEditor();
      await loadReviews();
    } catch (error) {
      alert(error.message);
    } finally {
      els.bulkDeleteButton.disabled = false;
    }
  }

  async function loadReviews() {
    els.syncState.textContent = "후기 불러오는 중…";
    const first = await request(`/reviews?page=1&pageSize=48&q=${encodeURIComponent(state.query)}`);
    const pages = Math.max(1, first.pagination?.pages || 1);
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) =>
        request(`/reviews?page=${index + 2}&pageSize=48&q=${encodeURIComponent(state.query)}`)
      )
    );
    state.reviews = [first, ...rest].flatMap((payload) => payload.reviews || []);
    renderList();
    els.syncState.textContent = `후기 ${first.pagination.total}개`;
  }
  async function loadMembers() {
    if (!els.memberStatus || !els.approvalList) return;
    message(els.memberStatus, "승인 대기 목록 불러오는 중…");
    try {
      const payload = await request("/admin/members?status=pending");
      els.approvalList.replaceChildren();
      message(els.memberStatus, payload.members.length ? `${payload.members.length}명이 승인을 기다리고 있습니다.` : "승인 대기 회원이 없습니다.");
      payload.members.forEach((member) => {
        const row = document.createElement("div");
        row.className = "approval-member";
        const name = document.createElement("span");
        name.textContent = member.username;
        const approve = document.createElement("button");
        approve.className = "button compact primary";
        approve.textContent = "승인";
        const reject = document.createElement("button");
        reject.className = "button compact danger";
        reject.textContent = "거절";
        const act = async (action) => {
          await request(`/admin/members/${member.id}/${action}`, { method: "POST", body: "{}" });
          loadMembers();
        };
        approve.addEventListener("click", () => act("approve"));
        reject.addEventListener("click", () => act("reject"));
        row.append(name, approve, reject);
        els.approvalList.append(row);
      });
    } catch (error) {
      message(els.memberStatus, error.message, "error");
    }
  }
  async function enterAdmin() {
    const me = await request("/auth/me");
    if (!me.member || me.member.role !== "admin") throw new Error("관리자 로그인이 필요합니다.");
    els.loginShell.hidden = true;
    els.adminApp.hidden = false;
    await loadReviews();
  }
  async function login(event) {
    event.preventDefault();
    try {
      const payload = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: els.usernameInput.value.trim(), password: els.passwordInput.value }),
      });
      if (payload.accessToken) sessionStorage.setItem(TOKEN_KEY, payload.accessToken);
      await enterAdmin();
    } catch (error) {
      message(els.loginStatus, error.message, "error");
    }
  }
  async function save(event) {
    event.preventDefault();
    const editing = Boolean(state.selected);
    if (!editing && !state.cover) return message(els.editorStatus, "대표 이미지를 선택해 주세요.", "error");
    if (state.details.length > 8) return message(els.editorStatus, "추가 이미지는 최대 8장입니다.", "error");
    const form = new FormData();
    form.set("title", els.titleInput.value.trim());
    form.set("body", els.contentInput.value.trim());
    form.set("publishedAt", new Date(els.publishedAtInput.value).toISOString());
    if (state.cover) form.set("cover", state.cover);
    state.details.forEach((file) => form.append("images", file));
    try {
      els.saveButton.disabled = true;
      message(els.editorStatus, "후기 저장 중…");
      await request(editing ? `/admin/reviews/${state.selected.id}` : "/reviews", {
        method: editing ? "PUT" : "POST",
        body: form,
      });
      closeEditor();
      await loadReviews();
    } catch (error) {
      message(els.editorStatus, error.message, "error");
    } finally {
      els.saveButton.disabled = false;
    }
  }
  async function remove() {
    if (!state.selected || !confirm(`“${state.selected.title}” 후기를 삭제할까요?`)) return;
    await request(`/reviews/${state.selected.id}`, { method: "DELETE" });
    closeEditor();
    await loadReviews();
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
    const items = currentReviews();
    if (els.selectAllInput.checked) items.forEach((item) => state.selectedIds.add(item.id));
    else items.forEach((item) => state.selectedIds.delete(item.id));
    renderList();
  });
  els.bulkDeleteButton.addEventListener("click", () => bulkRemove().catch((error) => alert(error.message)));
  if (els.refreshMembersButton) els.refreshMembersButton.addEventListener("click", loadMembers);
  els.editorForm.addEventListener("submit", save);
  els.deleteButton.addEventListener("click", remove);
  els.cancelButton.addEventListener("click", closeEditor);
  els.coverInput.addEventListener("change", () => {
    state.cover = els.coverInput.files[0] || null;
    renderImages(state.selected);
  });
  els.detailInput.addEventListener("change", () => {
    state.details = [...els.detailInput.files];
    renderImages(state.selected);
  });
  enterAdmin().catch(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    location.replace("/admin/");
  });
})();
