const fs = require("fs");
const path = require("path");
const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const write = (f, t) => fs.writeFileSync(path.join(root, f), t);

// ---- board-meta.js: add setupContentClamp ----
{
  let t = read("board-meta.js");
  if (!t.includes("setupContentClamp")) {
    t = t.replace(
      "window.GongbangBoardMeta = {\n    KAKAO_URL,\n    formatViews,\n    fetchViews,\n    bumpView,\n    renderMetaRow,\n    syncCarouselHeight,\n  };",
      `function setupContentClamp(contentEl) {
    if (!contentEl) return;
    const parent = contentEl.parentElement;
    if (!parent) return;
    let btn = parent.querySelector(":scope > .content-more-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "content-more-btn";
      btn.textContent = "자세히보기";
      contentEl.insertAdjacentElement("afterend", btn);
    }
    contentEl.classList.remove("is-expanded");
    contentEl.classList.add("is-clamped");
    btn.hidden = true;
    btn.textContent = "자세히보기";
    btn.onclick = () => {
      contentEl.classList.remove("is-clamped");
      contentEl.classList.add("is-expanded");
      btn.hidden = true;
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const needs = contentEl.scrollHeight > contentEl.clientHeight + 2;
        if (needs) btn.hidden = false;
        else contentEl.classList.remove("is-clamped");
      });
    });
  }

  window.GongbangBoardMeta = {
    KAKAO_URL,
    formatViews,
    fetchViews,
    bumpView,
    renderMetaRow,
    syncCarouselHeight,
    setupContentClamp,
  };`
    );
    write("board-meta.js", t);
    console.log("board-meta.js ok");
  } else console.log("board-meta already");
}

// ---- wire clamp after renderSafe ----
function wireClamp(file, needle, insertAfterNeedle) {
  let t = read(file);
  if (t.includes("setupContentClamp(dialog.content)") || t.includes("setupContentClamp(els.content)") || t.includes("setupContentClamp(els.viewText)")) {
    // may partially exist
  }
  if (!t.includes("GongbangBoardMeta?.setupContentClamp") && !t.includes("GongbangBoardMeta.setupContentClamp")) {
    // landing-boards
    if (file === "landing-boards.js") {
      t = t.replace(
        `if (window.GongbangHtmlEditor) {
      window.GongbangHtmlEditor.renderSafe(dialog.content, item.content || "");
    } else {
      dialog.content.textContent = item.content || "";
    }
    renderCarousel(item);`,
        `if (window.GongbangHtmlEditor) {
      window.GongbangHtmlEditor.renderSafe(dialog.content, item.content || "");
    } else {
      dialog.content.textContent = item.content || "";
    }
    window.GongbangBoardMeta?.setupContentClamp?.(dialog.content);
    renderCarousel(item);`
      );
    }
    if (file === "portfolio-board.js") {
      t = t.replace(
        `if (window.GongbangHtmlEditor) {
      window.GongbangHtmlEditor.renderSafe(els.content, safeContent);
    } else {
      els.content.textContent = safeContent;
    }
    renderCarousel(item);`,
        `if (window.GongbangHtmlEditor) {
      window.GongbangHtmlEditor.renderSafe(els.content, safeContent);
    } else {
      els.content.textContent = safeContent;
    }
    window.GongbangBoardMeta?.setupContentClamp?.(els.content);
    renderCarousel(item);`
      );
    }
    if (file === "handmade-reviews.js") {
      t = t.replace(
        `if (window.GongbangHtmlEditor) {
        window.GongbangHtmlEditor.renderSafe(els.viewText, review.body);
      } else {
        els.viewText.textContent = review.body;
      }
      renderReviewActions(review);`,
        `if (window.GongbangHtmlEditor) {
        window.GongbangHtmlEditor.renderSafe(els.viewText, review.body);
      } else {
        els.viewText.textContent = review.body;
      }
      window.GongbangBoardMeta?.setupContentClamp?.(els.viewText);
      renderReviewActions(review);`
      );
    }
    write(file, t);
    console.log(file, "wired");
  } else console.log(file, "already wired");
}
wireClamp("landing-boards.js");
wireClamp("portfolio-board.js");
wireClamp("handmade-reviews.js");

// ---- HTML: wrap board-detail body ----
function wrapDetail(file) {
  let t = read(file);
  if (t.includes("board-detail-body")) {
    console.log(file, "already wrapped");
    return;
  }
  t = t.replace(
    /<article class="board-detail">\s*<button class="board-close"[^>]*>×<\/button>\s*<div class="detail-images" id="detailImages"><\/div>\s*<div class="detail-copy">([\s\S]*?)<\/div>\s*<\/article>/,
    `<article class="board-detail">
      <button class="board-close" id="boardClose" aria-label="닫기">×</button>
      <div class="board-detail-body">
      <div class="detail-images" id="detailImages"></div>
      <div class="detail-copy">$1</div>
      </div>
    </article>`
  );
  // review view wrap
  if (t.includes('id="reviewView"') && !t.includes("review-view-body-scroll")) {
    t = t.replace(
      /<div class="review-view-panel">\s*<button type="button" class="review-view-close"[^>]*>×<\/button>\s*<div class="review-view-images" id="reviewViewImages"><\/div>\s*<div class="review-view-body">/,
      `<div class="review-view-panel">
      <button type="button" class="review-view-close" id="reviewViewClose" aria-label="닫기">×</button>
      <div class="review-view-scroll">
      <div class="review-view-images" id="reviewViewImages"></div>
      <div class="review-view-body">`
    );
    t = t.replace(
      /(<div class="review-detail-actions" id="reviewViewActions" hidden><\/div>\s*<\/div>\s*)<\/div>\s*<\/div>\s*\n\s*<div class="board-dialog"/,
      `$1</div>\n      </div>\n    </div>\n\n  <div class="board-dialog"`
    );
  }
  write(file, t);
  console.log(file, "html updated");
}
wrapDetail("landing.html");
wrapDetail("portfolio.html");

console.log("done scripts");
