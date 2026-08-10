(() => {
  "use strict";

  const API = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
  const PAGES_ASSET_ORIGIN = "https://saveasme1.github.io";
  const params = new URLSearchParams(location.search);
  const noticeId = String(params.get("id") || "").trim();

  const els = {
    status: document.getElementById("noticeViewStatus"),
    title: document.getElementById("noticeViewTitle"),
    meta: document.getElementById("noticeViewMeta"),
    images: document.getElementById("noticeViewImages"),
    content: document.getElementById("noticeViewContent"),
    back: document.getElementById("noticeViewBack"),
  };

  function listHref() {
    const q = new URLSearchParams();
    if (params.get("app") === "1" || document.documentElement.classList.contains("is-pwa")) {
      q.set("app", "1");
    }
    const pwa = params.get("_pwa");
    if (pwa) q.set("_pwa", pwa);
    const s = q.toString();
    return `./notices.html${s ? `?${s}` : ""}`;
  }

  function assetUrl(value) {
    const path = String(value || "").trim();
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const clean = path.replace(/^\/+/, "");
    if (/^(shipping|groupbuy|portfolio|notices)\//i.test(clean)) {
      return `${PAGES_ASSET_ORIGIN}/${clean}`;
    }
    if (/^uploads\//i.test(clean)) {
      return `https://app.0-1.co.kr/${clean}`;
    }
    return `/${clean}`;
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text || "";
  }

  async function fetchNotice(id) {
    const liveUrl = `${API}/boards/notices/live?v=${Date.now()}`;
    const res = await fetch(liveUrl, { credentials: "include", cache: "no-store" });
    const payload = await res.json().catch(() => ({}));
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];
    let hit = items.find((x) => String(x?.id || "") === id);
    if (hit) return hit;
    try {
      const git = await fetch(`./notices-data.json?v=${Date.now()}`, { cache: "no-store" });
      const data = await git.json().catch(() => ({}));
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      hit = list.find((x) => String(x?.id || "") === id);
    } catch (_) {}
    return hit || null;
  }

  function render(item) {
    const title = item.title || item.subject || "공지";
    document.title = `본 헤리티지 · ${title}`;
    if (els.title) {
      if (window.GongbangTime?.renderPostTitle) {
        window.GongbangTime.renderPostTitle(els.title, title, item.publishedAt);
      } else {
        els.title.textContent = title;
      }
    }
    if (els.meta) {
      const dateText = window.GongbangTime?.formatDate
        ? window.GongbangTime.formatDate(item.publishedAt)
        : "";
      if (window.GongbangBoardMeta?.renderMetaRow) {
        window.GongbangBoardMeta.renderMetaRow(els.meta, {
          dateText,
          viewCount: item.viewCount,
          hideViews: true,
        });
      } else {
        els.meta.textContent = dateText || "";
      }
    }
    if (els.content) {
      if (window.GongbangHtmlEditor?.renderSafe) {
        window.GongbangHtmlEditor.renderSafe(els.content, item.content || "");
      } else {
        els.content.textContent = item.content || "";
      }
    }
    if (els.images) {
      els.images.replaceChildren();
      const seen = new Set();
      const paths = [item.cover || item.image, ...(item.images || [])]
        .filter(Boolean)
        .filter((path) => {
          const key = String(path);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      const stack = document.createElement("div");
      stack.className = "notice-view-stack";
      paths.forEach((path, index) => {
        const img = document.createElement("img");
        img.src = assetUrl(path);
        img.alt = title;
        img.loading = index === 0 ? "eager" : "lazy";
        img.decoding = "async";
        if (window.GongbangProtectImage) window.GongbangProtectImage(img);
        stack.append(img);
      });
      els.images.append(stack);
    }
  }

  async function boot() {
    if (els.back) {
      els.back.addEventListener("click", () => {
        location.href = listHref();
      });
    }
    if (!noticeId) {
      setStatus("잘못된 접근입니다. 목록으로 이동합니다.");
      location.replace(listHref());
      return;
    }
    setStatus("불러오는 중…");
    try {
      const item = await fetchNotice(noticeId);
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'post-fix',hypothesisId:'NP3',location:'notice-view.js:boot',message:'notice-view page boot',data:{id:noticeId,found:Boolean(item),path:location.pathname,search:location.search,vw:window.innerWidth,pwa:document.documentElement.classList.contains('is-pwa')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!item) {
        setStatus("글을 찾을 수 없습니다.");
        return;
      }
      if (window.GongbangBoardMeta?.bumpView) {
        try {
          item.viewCount = await window.GongbangBoardMeta.bumpView("notices", item.id);
        } catch (_) {}
      }
      render(item);
      setStatus("");
    } catch (err) {
      setStatus("불러오기에 실패했습니다.");
      // #region agent log
      fetch('http://127.0.0.1:7719/ingest/981fe459-55aa-4b6a-b93e-29a4ea52759b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'eef336'},body:JSON.stringify({sessionId:'eef336',runId:'post-fix',hypothesisId:'NP3',location:'notice-view.js:boot',message:'notice-view boot fail',data:{id:noticeId,error:String(err?.message||err||'').slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
