(() => {
  "use strict";

  const DRAFT_PATH = "portfolio-draft.json";
  const CATEGORIES = ["C", "B", "VCA", "BO", "CM", "C&H", "CL", "G", "H", "P", "F", "ETC"];
  const documentRoot = document.getElementById("previewDocument");
  const status = document.getElementById("previewStatus");

  function decodeBase64Utf8(value) {
    const binary = atob(String(value || "").replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  }

  function sortNewest(items) {
    return [...items].sort((a, b) => {
      const aTime = Date.parse(a.sortAt || a.uploadedAt || 0) || 0;
      const bTime = Date.parse(b.sortAt || b.uploadedAt || 0) || 0;
      return bTime - aTime || String(b.id || "").localeCompare(String(a.id || ""));
    });
  }

  function normalizeItem(item = {}) {
    const image = String(item.cover || item.image || "");
    return {
      ...item,
      id: String(item.id || ""),
      category: CATEGORIES.includes(item.category) ? item.category : "ETC",
      title: String(item.title || ""),
      content: String(item.content || "").replace(/\s*<div\s+class="?[\s"]*$/i, "").trim(),
      image,
      images: (Array.isArray(item.images) ? item.images : [])
        .map(String)
        .filter(Boolean)
        .filter((path) => path !== image),
    };
  }

  function imageUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `/${String(path).split("/").map(encodeURIComponent).join("/")}`;
  }

  function chunks(items, size) {
    const result = [];
    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }
    return result;
  }

  function makePage(className = "") {
    const page = document.createElement("section");
    page.className = `pdf-page${className ? ` ${className}` : ""}`;
    return page;
  }

  function makeImage(path, alt) {
    const image = document.createElement("img");
    image.src = imageUrl(path);
    image.alt = alt;
    image.loading = "lazy";
    image.decoding = "async";
    return image;
  }

  function groupByCategory(items, categoryOrder) {
    const map = new Map();
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    }
    const groups = [];
    for (const category of categoryOrder) {
      if (!map.has(category)) continue;
      groups.push({ category, items: map.get(category) });
      map.delete(category);
    }
    for (const [category, groupItems] of map) groups.push({ category, items: groupItems });
    return groups;
  }

  function renderCover(items, groups) {
    const page = makePage("cover-page");
    const title = document.createElement("h2");
    title.textContent = "HERITAGE";
    const subtitle = document.createElement("p");
    subtitle.className = "cover-subtitle";
    subtitle.textContent = "PORTFOLIO";
    const line = document.createElement("div");
    line.className = "cover-line";
    const categories = document.createElement("p");
    categories.className = "cover-categories";
    categories.textContent = groups
      .map((group) => `${group.category} ${group.items.length}`)
      .join("   ");
    const total = document.createElement("p");
    total.className = "cover-total";
    total.textContent = `총 ${items.length}점 · ${window.GongbangTime ? window.GongbangTime.formatYmd() : new Date().toISOString().slice(0, 10)}`;
    page.append(title, subtitle, line, categories, total);
    return page;
  }

  function renderCategoryPages(group) {
    return chunks(group.items, 9).map((pageItems) => {
      const page = makePage("category-page");
      const heading = document.createElement("header");
      heading.className = "page-heading";
      const title = document.createElement("h2");
      title.textContent = group.category;
      const count = document.createElement("span");
      count.textContent = `${group.items.length} items`;
      heading.append(title, count);

      const grid = document.createElement("div");
      grid.className = "portfolio-grid";
      for (const item of pageItems) {
        const card = document.createElement("article");
        card.className = "portfolio-card";
        const cardTitle = document.createElement("h3");
        cardTitle.textContent = item.title;
        card.append(makeImage(item.image, item.title), cardTitle);
        if (item.content) {
          const content = document.createElement("p");
          content.textContent = item.content;
          card.append(content);
        }
        grid.append(card);
      }
      page.append(heading, grid);
      return page;
    });
  }

  function renderDetailPages(group) {
    const pages = [];
    for (const item of group.items.filter((entry) => entry.images.length)) {
      const imagePages = chunks([item.image, ...item.images].filter(Boolean), 4);
      imagePages.forEach((paths, pageIndex) => {
        const page = makePage("detail-page");
        const heading = document.createElement("header");
        heading.className = "detail-heading";
        const title = document.createElement("h2");
        title.textContent = item.title;
        heading.append(title);
        if (item.content) {
          const content = document.createElement("p");
          content.textContent = item.content;
          heading.append(content);
        }
        const grid = document.createElement("div");
        grid.className = "detail-grid";
        paths.forEach((path, index) => {
          grid.append(makeImage(path, `${item.title} ${pageIndex * 4 + index + 1}`));
        });
        const footer = document.createElement("span");
        footer.className = "detail-category";
        footer.textContent = `${group.category} · ${pageIndex + 1} / ${imagePages.length}`;
        page.append(heading, grid, footer);
        pages.push(page);
      });
    }
    return pages;
  }

  function renderManifest(manifest) {
    const items = sortNewest((manifest.items || []).map(normalizeItem)).filter((item) => item.image);
    const groups = groupByCategory(items, manifest.categories || CATEGORIES);
    const fragment = document.createDocumentFragment();
    fragment.append(renderCover(items, groups));
    for (const group of groups) {
      renderCategoryPages(group).forEach((page) => fragment.append(page));
      renderDetailPages(group).forEach((page) => fragment.append(page));
    }
    documentRoot.replaceChildren(fragment);
    const pages = [...documentRoot.querySelectorAll(".pdf-page")];
    pages.slice(1).forEach((page, index) => {
      const number = document.createElement("span");
      number.className = "pdf-page-number";
      number.textContent = `${index + 2} / ${pages.length}`;
      page.append(number);
    });
    const imageCount = items.reduce((sum, item) => sum + 1 + item.images.length, 0);
    status.textContent = `${items.length}개 게시글 · ${imageCount}장 · 예상 ${pages.length}페이지`;
    document.title = `헤리티지 PDF 미리보기 · ${pages.length}페이지`;
  }

  async function loadManifest() {
    const snapshot = sessionStorage.getItem("gongbang171PortfolioPreview");
    if (snapshot) return JSON.parse(snapshot);

    const api = (window.HANDMADE_API_BASE || "https://app.0-1.co.kr/api/handmade/v1").replace(/\/$/, "");
    const params = new URLSearchParams({ path: DRAFT_PATH, _: String(Date.now()) });
    const response = await fetch(`${api}/admin/files?${params}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`초안 조회 실패 (${response.status})`);
    const payload = await response.json();
    return JSON.parse(decodeBase64Utf8(payload.file.content));
  }

  document.getElementById("closeButton").addEventListener("click", () => window.close());
  document.getElementById("printButton").addEventListener("click", () => window.print());

  loadManifest()
    .then(renderManifest)
    .catch((error) => {
      console.error(error);
      status.textContent = "미리보기 로드 실패";
      documentRoot.replaceChildren(
        document.getElementById("errorTemplate").content.cloneNode(true)
      );
    });
})();
