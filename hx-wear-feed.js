(() => {
  "use strict";

  const CACHE_KEY = "hx.discover.feed.v17";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const TOKEN_KEY = "gongbang171.adminToken";
  const TYPE_KO = {
    ring: "반지",
    bracelet: "브레이슬릿",
    necklace: "목걸이",
    earring: "귀걸이",
  };
  const PLATFORM_LABEL = {
    instagram: "IG",
    pinterest: "Pin",
    youtube: "YT",
    tiktok: "TT",
    web: "Web",
  };
  const FALLBACK_BRAND_ORDER = [
    "C", "B", "VCA", "BO", "CM", "C&H", "CL", "G", "H", "P", "F", "T&C", "L", "D",
  ];
  const BRAND_AVATAR = {
    C: "cartier",
    B: "bvlgari",
    VCA: "vancleefarpels",
    BO: "boucheron",
    CM: "chaumetofficial",
    "C&H": "chromeheartsofficial",
    CL: "chanelofficial",
    G: "gucci",
    H: "hermes",
    P: "prada",
    F: "fredjewelry",
    "T&C": "tiffanyandco",
    L: "louisvuitton",
    D: "damianiofficial",
  };

  const state = {
    member: null,
    meLoaded: false,
  };

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(path, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    try {
      const tok = sessionStorage.getItem(TOKEN_KEY);
      if (tok) headers.Authorization = `Bearer ${tok}`;
    } catch (_) {}
    const res = await fetch(`${apiBase()}${path}`, {
      credentials: "include",
      mode: "cors",
      ...options,
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function ensureMember({ force = false } = {}) {
    if (state.meLoaded && !force) return state.member;
    try {
      const data = await api("/auth/me");
      state.member = data.member || null;
    } catch (_) {
      state.member = null;
    }
    state.meLoaded = true;
    return state.member;
  }

  function ensureAuthDialog() {
    if (document.getElementById("hxDiscoverAuthDialog")) return;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<dialog class="review-dialog auth-dialog" id="hxDiscoverAuthDialog" data-mode="login">
        <form id="hxDiscoverAuthForm" data-mode="login">
          <div class="auth-tabs" role="tablist">
            <button type="button" class="auth-tab is-active" data-hx-auth-tab="login" role="tab">로그인</button>
            <button type="button" class="auth-tab" data-hx-auth-tab="register" role="tab">회원가입</button>
          </div>
          <div class="auth-panel" data-hx-auth-panel="login">
            <h2>로그인</h2>
            <p class="auth-desc">하트·댓글은 로그인 후 이용할 수 있어요.</p>
          </div>
          <div class="auth-panel" data-hx-auth-panel="register" hidden>
            <h2>회원가입</h2>
            <p class="auth-desc">가입 후 관리자 승인이 필요할 수 있어요.</p>
          </div>
          <label class="auth-field">아이디
            <input id="hxDiscoverUsername" autocomplete="username" minlength="4" maxlength="30" required placeholder="아이디">
          </label>
          <label class="auth-field">비밀번호
            <input id="hxDiscoverPassword" type="password" autocomplete="current-password" minlength="12" maxlength="128" required placeholder="비밀번호">
          </label>
          <p class="review-dialog-status" id="hxDiscoverAuthStatus" aria-live="polite"></p>
          <div class="review-dialog-actions auth-actions">
            <button type="button" data-hx-auth-close>취소</button>
            <button class="primary" type="submit" id="hxDiscoverAuthSubmit">로그인</button>
          </div>
        </form>
      </dialog>`
    );
    const dlg = document.getElementById("hxDiscoverAuthDialog");
    const form = document.getElementById("hxDiscoverAuthForm");
    dlg.querySelectorAll("[data-hx-auth-close]").forEach((b) =>
      b.addEventListener("click", () => dlg.close())
    );
    dlg.querySelectorAll("[data-hx-auth-tab]").forEach((b) =>
      b.addEventListener("click", () => openDiscoverAuth(b.getAttribute("data-hx-auth-tab")))
    );
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const mode = form.dataset.mode || "login";
      const status = document.getElementById("hxDiscoverAuthStatus");
      const username = document.getElementById("hxDiscoverUsername").value.trim();
      const password = document.getElementById("hxDiscoverPassword").value;
      status.textContent = "처리 중…";
      status.classList.remove("error");
      try {
        const path = mode === "register" ? "/auth/register" : "/auth/login";
        const data = await api(path, {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        state.member = data.member || null;
        state.meLoaded = true;
        if (data.accessToken) {
          try {
            sessionStorage.setItem(TOKEN_KEY, data.accessToken);
          } catch (_) {}
        }
        status.textContent = mode === "register" ? "가입 신청 완료" : "로그인 완료";
        dlg.close();
        window.dispatchEvent(new CustomEvent("gongbang:auth-changed", { detail: { member: state.member } }));
      } catch (e) {
        status.textContent = e.message || "실패";
        status.classList.add("error");
      }
    });
  }

  function openDiscoverAuth(mode = "login") {
    if (typeof window.openGongbangAuth === "function") {
      window.openGongbangAuth(mode);
      return;
    }
    ensureAuthDialog();
    const dlg = document.getElementById("hxDiscoverAuthDialog");
    const form = document.getElementById("hxDiscoverAuthForm");
    const next = mode === "register" ? "register" : "login";
    form.dataset.mode = next;
    dlg.dataset.mode = next;
    dlg.querySelectorAll("[data-hx-auth-tab]").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-hx-auth-tab") === next);
    });
    dlg.querySelectorAll("[data-hx-auth-panel]").forEach((p) => {
      p.hidden = p.getAttribute("data-hx-auth-panel") !== next;
    });
    document.getElementById("hxDiscoverAuthSubmit").textContent =
      next === "register" ? "가입하기" : "로그인";
    document.getElementById("hxDiscoverAuthStatus").textContent = "";
    dlg.showModal();
  }

  async function requireMember() {
    let m = state.member;
    if (!m) m = await ensureMember({ force: true });
    if (m) return m;
    openDiscoverAuth("login");
    throw new Error("login_required");
  }

  function dbIdOf(item) {
    if (item.dbId) return Number(item.dbId);
    const n = Number(String(item.id || "").replace(/^disc-/i, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function apiBase() {
    return String(window.HX_WEAR_FEED_API || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  }

  function absUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    try {
      return new URL(String(path).replace(/^\.\//, ""), location.href).href;
    } catch (_) {
      return path;
    }
  }

  function profileUrl(platform, handle) {
    const h = String(handle || "").replace(/^@/, "").trim();
    if (!h) return "";
    if (platform === "youtube") return `https://www.youtube.com/@${encodeURIComponent(h)}`;
    if (platform === "pinterest") return `https://www.pinterest.com/${encodeURIComponent(h)}/`;
    if (platform === "tiktok") return `https://www.tiktok.com/@${encodeURIComponent(h)}`;
    return `https://www.instagram.com/${encodeURIComponent(h)}/`;
  }

  function relativeTimeKo(iso) {
    const ms = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(ms)) return "";
    const diff = Math.max(60 * 1000, Date.now() - ms);
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${Math.max(1, min)}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}일 전`;
    const mon = Math.floor(day / 30);
    if (mon < 12) return `${mon}개월 전`;
    return `${Math.floor(mon / 12)}년 전`;
  }

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const row = JSON.parse(raw);
      if (!row?.exp || Date.now() > row.exp || !Array.isArray(row.items)) return null;
      return row;
    } catch (_) {
      return null;
    }
  }

  function cacheSet(key, items) {
    try {
      localStorage.setItem(key, JSON.stringify({ exp: Date.now() + CACHE_TTL_MS, items }));
    } catch (_) {}
  }

  function isScrapedAnonProfile(platform, primaryUrl, source) {
    const p = String(platform || "").toLowerCase();
    const s = String(source || "").toLowerCase();
    if (p === "instagram" || p === "youtube" || p === "tiktok") return false;
    if (p === "web") return true;
    if (/^web_/.test(s) || /web_(ddg|bing|google|search)/i.test(s)) return true;
    if (p === "pinterest" && !String(primaryUrl || "").trim()) return true;
    return false;
  }

  function paintBlankAvatar(av) {
    av.classList.remove("hx-ig__avatar--letter");
    av.classList.add("hx-ig__avatar--blank");
    av.textContent = "";
    av.innerHTML = "";
  }

  function setAvatar(av, handle, primaryUrl, platform, brandCode, source) {
    const h = String(handle || "").replace(/^@/, "").trim().toLowerCase();
    // Web / random-site scrapes: blank white only — never invent brand or post thumbs as profile
    if (isScrapedAnonProfile(platform, primaryUrl, source)) {
      paintBlankAvatar(av);
      return;
    }

    const brandHandle = String(BRAND_AVATAR[brandCode] || "").toLowerCase();
    const handles = [...new Set([h, brandHandle].filter(Boolean))];
    const candidates = [];
    // Prefer server-stored / API profile photo first
    if (primaryUrl) candidates.push(primaryUrl);
    if (h && (platform === "instagram" || !platform)) {
      candidates.push(`${apiBase()}/ig-avatar?u=${encodeURIComponent(h)}`);
    }
    handles.forEach((name) => {
      candidates.push(absUrl(`./wear-media/avatars/ig-real/${name}.jpg`));
      candidates.push(absUrl(`./wear-media/avatars/${name}.jpg`));
      candidates.push(absUrl(`./wear-media/avatars/ig-real/${name}.png`));
      candidates.push(absUrl(`./wear-media/avatars/${name}.png`));
      if (name !== h) {
        candidates.push(`${apiBase()}/ig-avatar?u=${encodeURIComponent(name)}`);
      }
    });

    const tryNext = (i) => {
      if (i >= candidates.length) {
        paintBlankAvatar(av);
        return;
      }
      av.classList.remove("hx-ig__avatar--letter", "hx-ig__avatar--blank");
      av.textContent = "";
      av.innerHTML = `<img alt="" width="36" height="36" loading="lazy" decoding="async" src="${candidates[i]}">`;
      const img = av.querySelector("img");
      if (!img) return tryNext(i + 1);
      img.addEventListener("error", () => tryNext(i + 1), { once: true });
    };
    tryNext(0);
  }

  function openUrl(url) {
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (_) {
      location.href = url;
    }
  }

  function youtubeId(permalink) {
    const u = String(permalink || "");
    let m = u.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i);
    if (m) return m[1];
    m = u.match(/[?&]v=([A-Za-z0-9_-]{6,})/i);
    if (m) return m[1];
    m = u.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
    return m ? m[1] : "";
  }

  function tiktokEmbed(permalink) {
    const u = String(permalink || "").split("?")[0];
    if (!/tiktok\.com\//i.test(u)) return "";
    return `https://www.tiktok.com/embed/v2/${(u.match(/\/video\/(\d+)/) || [])[1] || ""}`;
  }

  async function loadBrandMap() {
    const map = {};
    try {
      const res = await fetch(`./brand-codes.json?v=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      Object.assign(map, data.codes || {});
    } catch (_) {}
    try {
      const res = await fetch(`${apiBase()}/discover/brands`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        (data.brands || []).forEach((b) => {
          map[b.code] = { en: b.nameEn, ko: b.nameKo, ...(map[b.code] || {}) };
        });
      }
    } catch (_) {}
    return map;
  }

  async function loadDiscoverApi(brand) {
    const q = new URLSearchParams({
      brand: brand || "all",
      limit: "120",
      sort: "latest",
    });
    const res = await fetch(`${apiBase()}/discover/feed?${q}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      mode: "cors",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`discover feed ${res.status}`);
    const data = await res.json();
    if (data.member) state.member = data.member;
    return data;
  }

  async function loadLegacyFallback() {
    const items = [];
    try {
      const res = await fetch(`./hx-ig-wear.json?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return items;
      const data = await res.json();
      (data.items || []).forEach((row) => {
        items.push({
          id: row.id,
          platform: "instagram",
          brandCode: row.brandCode,
          displayName: row.displayName,
          handle: row.handle,
          caption: row.captionKo || row.titleKo,
          image: absUrl(row.image),
          avatar: absUrl(row.avatar),
          permalink: row.permalink,
          publishedAt: row.publishedAt,
          mediaType: "image",
          type: row.type,
          productType: row.type,
        });
      });
    } catch (_) {}
    return items;
  }

  function igShortcode(permalink, externalId) {
    const fromExt = String(externalId || "").trim();
    if (/^[A-Za-z0-9_-]{5,}$/.test(fromExt) && !/^\d+$/.test(fromExt)) return fromExt;
    const m = String(permalink || "").match(/\/(?:p|reel|tv)\/([^/?#]+)/i);
    return m ? m[1] : "";
  }

  function localIgPostImage(shortcode) {
    if (!shortcode) return "";
    return absUrl(`./wear-media/posts/${shortcode}.jpg`);
  }

  function normalizeItem(row) {
    const platform = String(row.platform || "instagram").toLowerCase();
    const permalink = String(row.permalink || "").trim();
    const shortcode = igShortcode(permalink, row.externalId);
    let image = absUrl(row.image || row.thumbnail || "");
    // Instagram CDN /media/?size=l is blocked — prefer local wear-media cache
    if (platform === "instagram" && shortcode) {
      const local = localIgPostImage(shortcode);
      if (!image || /instagram\.com\/.+\/media/i.test(image) || /cdninstagram|fbcdn\.net/i.test(image)) {
        image = local;
      }
    }
    if (!permalink || !image) return null;
    const type = String(row.productType || row.type || "").toLowerCase();
    const handle = String(row.handle || row.profileUsername || "").replace(/^@/, "");
    // Prefer known jewelry types; keep unclassified jewelry if server already filtered
    if (type && !TYPE_KO[type] && type !== "jewelry") return null;
    return {
      id: row.id || `${platform}-${row.externalId || Math.random().toString(36).slice(2)}`,
      platform,
      brandCode: row.brandCode || "",
      displayName: row.displayName || row.profileName || row.brandName || handle,
      handle,
      caption: row.captionKo || row.caption || row.titleKo || "",
      captionKo: row.captionKo || row.caption || "",
      captionOriginal: row.captionOriginal || "",
      captionKoSource: row.captionKoSource || "",
      translated: !!(
        row.translated ||
        (row.captionKoSource && row.captionKoSource !== "already_ko")
      ),
      image,
      imageFallbacks:
        platform === "instagram" && shortcode
          ? [localIgPostImage(shortcode), absUrl(row.thumbnail || ""), absUrl(row.image || "")].filter(
              (u, i, a) => u && a.indexOf(u) === i
            )
          : [image],
      avatar: row.avatar || row.profileImage || "",
      profilePictureUrl: row.profilePictureUrl || row.profileImage || "",
      source: row.source || "",
      permalink,
      publishedAt: row.publishedAt || "",
      mediaType: row.mediaType || "image",
      type,
      typeKo: TYPE_KO[type] || "",
      externalId: row.externalId || shortcode || youtubeId(permalink),
      dbId: row.dbId || Number(String(row.id || "").replace(/^disc-/i, "")) || null,
      likeCount: Number(row.likeCount || 0),
      commentCount: Number(row.commentCount || 0),
      likedByMe: !!row.likedByMe,
    };
  }

  async function buildFeed(force, brand) {
    const cacheKey = `${CACHE_KEY}:${brand || "all"}`;
    if (!force) {
      const hit = cacheGet(cacheKey);
      if (hit?.items?.length) return hit.items;
    }
    let raw = [];
    try {
      const data = await loadDiscoverApi(brand || "all");
      raw = data.items || [];
    } catch (_) {
      raw = [];
    }
    if (!raw.length && (!brand || brand === "all")) {
      raw = await loadLegacyFallback();
    }
    const items = raw.map(normalizeItem).filter(Boolean);
    cacheSet(cacheKey, items);
    return items;
  }

  function targetPostId() {
    try {
      const q = new URLSearchParams(location.search).get("post");
      if (q) return q;
      const m = String(location.hash || "").match(/^#(?:post-|hx-post-)?(.+)$/);
      return m ? decodeURIComponent(m[1]) : "";
    } catch (_) {
      return "";
    }
  }

  function scrollToPost(feedRoot) {
    const postId = targetPostId();
    if (!postId || !feedRoot) return;
    const safe = postId.replace(/[^a-zA-Z0-9_-]/g, "_");
    let node = document.getElementById("hx-post-" + safe);
    if (!node) {
      node = Array.from(feedRoot.querySelectorAll("[data-post-id]")).find(
        (el) => el.getAttribute("data-post-id") === postId
      );
    }
    if (!node) return;
    const run = () => {
      const topOffset =
        (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gb-top-h")) || 48) +
        72;
      const y = node.getBoundingClientRect().top + window.scrollY - topOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      node.classList.add("is-target");
      setTimeout(() => node.classList.remove("is-target"), 2200);
    };
    requestAnimationFrame(() => setTimeout(run, 120));
  }

  function playInline(mediaEl, item) {
    const isVideo = /video|reel|short/i.test(item.mediaType);
    if (!isVideo) {
      openUrl(item.permalink);
      return;
    }
    if (mediaEl.dataset.playing === "1") return;
    mediaEl.dataset.playing = "1";
    mediaEl.classList.add("hx-ig__media--playing");

    if (item.platform === "youtube") {
      const vid = youtubeId(item.permalink) || item.externalId;
      if (!vid) {
        openUrl(item.permalink);
        return;
      }
      mediaEl.innerHTML = `<iframe class="hx-ig__embed" title="youtube" src="https://www.youtube.com/embed/${encodeURIComponent(
        vid
      )}?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
      return;
    }

    if (item.platform === "tiktok") {
      const id = (String(item.permalink).match(/\/video\/(\d+)/) || [])[1];
      if (!id) {
        openUrl(item.permalink);
        return;
      }
      mediaEl.innerHTML = `<iframe class="hx-ig__embed" title="tiktok" src="https://www.tiktok.com/embed/v2/${id}" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>`;
      return;
    }

    // IG reels / other: keep in-tab poster + open source only via 원문 button
    mediaEl.innerHTML =
      `<img alt="" src="${item.image}"><span class="hx-ig__play" aria-hidden="true"></span>` +
      `<div class="hx-ig__inline-note">탭에서 미리보기 · 원문으로 재생</div>`;
    mediaEl.addEventListener(
      "click",
      () => {
        openUrl(item.permalink);
      },
      { once: true }
    );
  }

  function cardNode(item) {
    const a = el("article", "hx-ig__card");
    const postId = String(item.id || "");
    const dbId = dbIdOf(item);
    a.dataset.brand = item.brandCode || "";
    a.dataset.platform = item.platform;
    a.dataset.media = item.mediaType;
    if (dbId) a.dataset.dbId = String(dbId);
    if (postId) {
      a.dataset.postId = postId;
      a.id = "hx-post-" + postId.replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    const rawHandle = String(item.handle || item.platform || "").replace(/^@/, "");
    const handle = rawHandle.replace(/_[a-f0-9]{4,8}$/i, "") || rawHandle;
    const profile = profileUrl(item.platform, handle) || item.permalink;
    const plat = PLATFORM_LABEL[item.platform] || item.platform;

    const head = el("button", "hx-ig__head");
    head.type = "button";
    const av = el("div", "hx-ig__avatar");
    setAvatar(
      av,
      handle,
      item.profilePictureUrl || item.avatar,
      item.platform,
      item.brandCode,
      item.source
    );

    const meta = el("div", "hx-ig__meta");
    meta.innerHTML = `<strong>${escapeHtml(handle || plat)}</strong>`;
    const time = el("time", "hx-ig__time", relativeTimeKo(item.publishedAt));
    head.append(av, meta, time);
    head.addEventListener("click", () => openUrl(profile));

    const media = el("button", "hx-ig__media");
    media.type = "button";
    const isVideo = /video|reel|short/i.test(item.mediaType);
    media.innerHTML =
      `<img alt="" loading="lazy" decoding="async" src="${item.image}">` +
      (isVideo ? `<span class="hx-ig__play" aria-hidden="true"></span>` : "");
    const imgEl = media.querySelector("img");
    if (imgEl) {
      let fb = 0;
      const fallbacks = (item.imageFallbacks || [item.image]).filter(Boolean);
      imgEl.addEventListener("error", () => {
        fb += 1;
        if (fb < fallbacks.length && fallbacks[fb] && fallbacks[fb] !== imgEl.src) {
          imgEl.src = fallbacks[fb];
          return;
        }
        media.classList.add("hx-ig__media--ph");
        media.innerHTML = `<div class="hx-ig__ph"><b>${escapeHtml(handle || plat)}</b><em>원문 보기</em></div>`;
      });
    }
    media.addEventListener("click", () => playInline(media, item));

    const actions = el("div", "hx-ig__actions");
    const likeBtn = el("button", "hx-ig__like" + (item.likedByMe ? " is-on" : ""));
    likeBtn.type = "button";
    likeBtn.setAttribute("aria-label", "좋아요");
    likeBtn.innerHTML = `<span class="hx-ig__heart" aria-hidden="true"></span><b class="hx-ig__like-count">${Number(
      item.likeCount || 0
    )}</b>`;
    const cmtBtn = el("button", "hx-ig__cmt-toggle");
    cmtBtn.type = "button";
    cmtBtn.innerHTML = `<span aria-hidden="true">💬</span><b class="hx-ig__cmt-count">${Number(
      item.commentCount || 0
    )}</b>`;
    const moreBtn = el("button", "hx-ig__more");
    moreBtn.type = "button";
    moreBtn.textContent = "원문 보기";
    moreBtn.addEventListener("click", () => openUrl(item.permalink));
    actions.append(likeBtn, cmtBtn, moreBtn);

    likeBtn.addEventListener("click", async () => {
      try {
        await requireMember();
        const r = await api(`/discover/posts/${dbId}/like`, { method: "POST", body: "{}" });
        likeBtn.classList.toggle("is-on", !!r.likedByMe);
        likeBtn.querySelector(".hx-ig__like-count").textContent = String(r.likeCount || 0);
        item.likedByMe = !!r.likedByMe;
        item.likeCount = r.likeCount || 0;
      } catch (e) {
        if (e.message !== "login_required") alert(e.message || "좋아요 실패");
      }
    });

    const foot = el("div", "hx-ig__foot");
    const likesLine = el("p", "hx-ig__likes-line");
    likesLine.textContent = `좋아요 ${Number(item.likeCount || 0)}개`;
    const capRow = el("div", "hx-ig__cap-row");
    const cap = el("p", "hx-ig__caption");
    const body = escapeHtml(item.captionKo || item.caption || "");
    const who = escapeHtml(handle || "");
    cap.innerHTML = (who ? `<strong>${who}</strong> ` : "") + `<span class="hx-ig__seed">${body}</span>`;
    const note =
      item.translated || (item.captionKoSource && item.captionKoSource !== "already_ko")
        ? el(
            "p",
            "hx-ig__ai-note",
            "이 글은 자체 AI 시스템에 의해서 번역되었습니다."
          )
        : null;
    capRow.append(cap);
    if (note) capRow.append(note);

    const comments = el("div", "hx-ig__comments");
    comments.hidden = true;
    const cmtList = el("div", "hx-ig__cmt-list");
    const cmtForm = el("form", "hx-ig__cmt-form");
    cmtForm.innerHTML =
      `<input name="body" maxlength="500" placeholder="댓글 달기…" autocomplete="off">` +
      `<button type="submit">게시</button>`;

    async function refreshComments() {
      try {
        const data = await api(`/discover/posts/${dbId}/comments?limit=40`);
        cmtList.replaceChildren();
        (data.items || []).forEach((c) => {
          const row = el("div", "hx-ig__cmt");
          row.dataset.id = String(c.id);
          row.innerHTML =
            `<strong>${escapeHtml(c.username || "")}</strong> ` +
            `<span class="hx-ig__cmt-body">${escapeHtml(c.body)}</span>`;
          if (c.mine || (state.member && Number(c.memberId) === Number(state.member.id))) {
            const tools = el("span", "hx-ig__cmt-tools");
            const edit = el("button", "hx-ig__cmt-edit");
            edit.type = "button";
            edit.textContent = "수정";
            const del = el("button", "hx-ig__cmt-del");
            del.type = "button";
            del.textContent = "삭제";
            edit.addEventListener("click", async () => {
              const next = prompt("댓글 수정", c.body);
              if (next == null) return;
              try {
                await requireMember();
                await api(`/discover/comments/${c.id}`, {
                  method: "PUT",
                  body: JSON.stringify({ body: next }),
                });
                await refreshComments();
              } catch (e) {
                if (e.message !== "login_required") alert(e.message || "수정 실패");
              }
            });
            del.addEventListener("click", async () => {
              if (!confirm("이 댓글을 삭제할까요?")) return;
              try {
                await requireMember();
                await api(`/discover/comments/${c.id}`, { method: "DELETE" });
                item.commentCount = Math.max(0, Number(item.commentCount || 1) - 1);
                cmtBtn.querySelector(".hx-ig__cmt-count").textContent = String(item.commentCount);
                await refreshComments();
              } catch (e) {
                if (e.message !== "login_required") alert(e.message || "삭제 실패");
              }
            });
            tools.append(edit, del);
            row.append(tools);
          }
          cmtList.append(row);
        });
        item.commentCount = (data.items || []).length;
        cmtBtn.querySelector(".hx-ig__cmt-count").textContent = String(item.commentCount);
        likesLine.textContent = `좋아요 ${Number(item.likeCount || 0)}개`;
      } catch (_) {}
    }

    cmtBtn.addEventListener("click", async () => {
      comments.hidden = !comments.hidden;
      if (!comments.hidden) await refreshComments();
    });

    cmtForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const input = cmtForm.querySelector("input");
      const text = String(input.value || "").trim();
      if (!text) return;
      try {
        await requireMember();
        await api(`/discover/posts/${dbId}/comments`, {
          method: "POST",
          body: JSON.stringify({ body: text }),
        });
        input.value = "";
        item.commentCount = Number(item.commentCount || 0) + 1;
        cmtBtn.querySelector(".hx-ig__cmt-count").textContent = String(item.commentCount);
        comments.hidden = false;
        await refreshComments();
      } catch (e) {
        if (e.message !== "login_required") alert(e.message || "댓글 실패");
      }
    });

    comments.append(cmtList, cmtForm);
    foot.append(likesLine, capRow, comments);
    a.append(head, media, actions, foot);
    return a;
  }

  async function renderWearFeed(root) {
    if (!root) return false;
    root.replaceChildren();

    let activeBrand = "all";
    const chips = el("div", "hx-chips hx-ig-filters");
    const feed = el("div", "hx-ig");
    const status = el("p", "hx-empty", "불러오는 중…");
    root.append(chips, status, feed);

    let brands = {};
    let items = [];

    function paint() {
      feed.replaceChildren();
      const frag = document.createDocumentFragment();
      items.forEach((item) => {
        try {
          frag.append(cardNode(item));
        } catch (_) {
          /* skip bad card */
        }
      });
      feed.append(frag);
      try {
        scrollToPost(feed);
      } catch (_) {}
    }

    function syncChipState() {
      chips.querySelectorAll("button").forEach((btn) => {
        btn.classList.toggle("is-on", btn.dataset.id === activeBrand);
      });
    }

    function buildChips() {
      chips.replaceChildren();
      const mk = (id, label) => {
        const b = el("button", "", label);
        b.type = "button";
        b.dataset.id = id;
        b.addEventListener("click", () => {
          activeBrand = id;
          syncChipState();
          reload();
        });
        return b;
      };
      chips.append(mk("all", "ALL"));
      const order = [...FALLBACK_BRAND_ORDER];
      Object.keys(brands).forEach((c) => {
        if (!order.includes(c)) order.push(c);
      });
      order.forEach((code) => {
        if (brands[code] || FALLBACK_BRAND_ORDER.includes(code)) chips.append(mk(code, code));
      });
      syncChipState();
    }

    async function reload() {
      status.textContent = "불러오는 중…";
      status.hidden = false;
      let showedCache = false;
      try {
        const cached = await buildFeed(false, activeBrand);
        if (cached.length) {
          items = cached;
          paint();
          status.hidden = true;
          showedCache = true;
        }
      } catch (_) {}
      try {
        items = await buildFeed(true, activeBrand);
      } catch (_) {
        if (!showedCache) {
          items = await loadLegacyFallback().then((rows) => rows.map(normalizeItem).filter(Boolean));
        }
      }
      paint();
      if (!items.length) {
        status.hidden = false;
        status.textContent = "표시할 착용컷이 없습니다.";
      } else {
        status.hidden = true;
      }
    }

    brands = await loadBrandMap().catch(() => ({}));
    await ensureMember().catch(() => null);
    buildChips();
    await reload();
    return true;
  }

  window.HxWearFeed = { renderWearFeed, buildFeed };
})();
