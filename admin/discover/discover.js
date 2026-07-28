(() => {
  "use strict";

  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const TOKEN_KEY = "gongbang171.adminToken";
  const $ = (id) => document.getElementById(id);

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
    if (response.status === 401 || response.status === 403) {
      location.href = "/admin/";
      throw new Error("관리자 로그인이 필요합니다.");
    }
    if (!response.ok) throw new Error(payload.message || `요청 실패 (${response.status})`);
    return payload;
  }

  function msg(el, text, type = "") {
    el.textContent = text;
    el.className = `form-status${type ? ` ${type}` : ""}`;
  }

  async function ensureAdmin() {
    const me = await request("/auth/me");
    if (!me.member || me.member.role !== "admin") {
      location.href = "/admin/";
      return null;
    }
    $("adminIdentity").textContent = me.member.username;
    return me.member;
  }

  async function loadStats() {
    const s = await request("/discover/stats");
    const box = $("stats");
    box.replaceChildren();
    const total = document.createElement("div");
    total.className = "disc-stat";
    total.innerHTML = `<strong>전체</strong> ${s.total || 0}`;
    box.append(total);
    (s.byPlatform || []).forEach((row) => {
      const d = document.createElement("div");
      d.className = "disc-stat";
      d.innerHTML = `<strong>${row.platform}</strong> ${row.c}`;
      box.append(d);
    });
  }

  async function loadPlatforms() {
    const data = await request("/discover/platforms");
    const box = $("platformList");
    box.replaceChildren();
    (data.platforms || []).forEach((p) => {
      const row = document.createElement("div");
      row.className = "plat-row";
      row.innerHTML = `<div><strong>${p.label || p.id}</strong><div class="disc-meta">auto=${p.auto_sync ? "ON" : "OFF"} · last=${p.last_sync_at || "-"} · ${p.last_sync_message || ""}</div></div>`;
      const btn = document.createElement("button");
      btn.className = "button compact";
      btn.textContent = p.enabled ? "사용중" : "꺼짐";
      btn.addEventListener("click", async () => {
        await request(`/admin/discover/platforms/${p.id}`, {
          method: "PATCH",
          body: JSON.stringify({ enabled: !p.enabled }),
        });
        loadPlatforms();
      });
      row.append(btn);
      box.append(row);
    });
  }

  async function loadBrands() {
    const data = await request("/discover/brands?all=1");
    const box = $("brandList");
    const select = $("filterBrand");
    box.replaceChildren();
    select.innerHTML = `<option value="all">브랜드 전체</option>`;
    (data.brands || []).forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.code;
      opt.textContent = `${b.code} · ${b.nameKo || b.nameEn}`;
      select.append(opt);

      const row = document.createElement("div");
      row.className = "brand-row";
      row.innerHTML = `<div><strong>${b.code}</strong> ${b.nameEn}<div class="disc-meta">IG @${b.igHandle || "-"} · YT @${b.ytHandle || "-"} · Pin ${b.pinterestUser || "-"}</div></div>`;
      const btn = document.createElement("button");
      btn.className = "button compact";
      btn.textContent = b.enabled ? "ON" : "OFF";
      btn.addEventListener("click", async () => {
        await request(`/admin/discover/brands/${encodeURIComponent(b.code)}`, {
          method: "PATCH",
          body: JSON.stringify({ enabled: !b.enabled }),
        });
        loadBrands();
      });
      row.append(btn);
      box.append(row);
    });
  }

  async function loadPosts() {
    msg($("postStatus"), "불러오는 중…");
    const platform = $("filterPlatform").value;
    const brand = $("filterBrand").value;
    const q = new URLSearchParams({ platform, brand, limit: "60", includeHidden: "1" });
    const data = await request(`/admin/discover/posts?${q}`);
    const box = $("postList");
    box.replaceChildren();
    msg($("postStatus"), `${data.total || 0}건`, "success");
    (data.items || []).forEach((item) => {
      const card = document.createElement("article");
      card.className = "disc-card";
      card.innerHTML = `
        <img src="${item.image || item.thumbnail || ""}" alt="">
        <div>
          <strong>${item.platform} · ${item.brandCode || "-"}</strong>
          <div class="disc-meta">@${item.handle || "-"} · ${item.publishedAt || ""}</div>
          <p>${(item.caption || "").slice(0, 160)}</p>
          <div class="disc-actions"></div>
        </div>`;
      const actions = card.querySelector(".disc-actions");
      const mk = (label, patch) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "button compact";
        b.textContent = label;
        b.addEventListener("click", async () => {
          await request(`/admin/discover/posts/${item.dbId}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          });
          loadPosts();
          loadStats();
        });
        actions.append(b);
      };
      mk(item.isHidden ? "표시" : "숨김", { isHidden: !item.isHidden });
      mk(item.isFeatured ? "추천해제" : "추천", { isFeatured: !item.isFeatured });
      mk(item.isPinned ? "고정해제" : "고정", { isPinned: !item.isPinned });
      const del = document.createElement("button");
      del.className = "button compact danger";
      del.textContent = "삭제";
      del.addEventListener("click", async () => {
        if (!confirm("삭제할까요?")) return;
        await request(`/admin/discover/posts/${item.dbId}`, { method: "DELETE" });
        loadPosts();
        loadStats();
      });
      actions.append(del);
      const open = document.createElement("a");
      open.className = "button compact";
      open.href = item.permalink;
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = "원문";
      actions.append(open);
      box.append(card);
    });
  }

  async function sync(platform) {
    msg($("syncStatus"), "동기화 중…");
    try {
      const body = platform && platform !== "all" ? { platform } : {};
      const result = await request("/discover/sync", {
        method: "POST",
        body: JSON.stringify(body),
      });
      msg($("syncStatus"), JSON.stringify(result.results || result).slice(0, 400), "success");
      await loadStats();
      await loadPosts();
      await loadPlatforms();
    } catch (e) {
      msg($("syncStatus"), e.message || "동기화 실패");
    }
  }

  async function boot() {
    await ensureAdmin();
    $("logoutButton").addEventListener("click", async () => {
      try {
        await request("/auth/logout", { method: "POST" });
      } catch (_) {}
      sessionStorage.removeItem(TOKEN_KEY);
      location.href = "/admin/";
    });
    document.querySelectorAll("[data-sync]").forEach((btn) => {
      btn.addEventListener("click", () => sync(btn.getAttribute("data-sync")));
    });
    $("refreshPosts").addEventListener("click", loadPosts);
    $("filterPlatform").addEventListener("change", loadPosts);
    $("filterBrand").addEventListener("change", loadPosts);
    await loadStats();
    await loadPlatforms();
    await loadBrands();
    await loadPosts();
  }

  boot().catch((e) => {
    msg($("syncStatus"), e.message || "초기화 실패");
  });
})();
