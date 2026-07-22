import fs from "fs";

let html = fs.readFileSync("portfolio.html", "utf8");
html = html.replaceAll("20260722-portfolio5", "20260722-portfolio6");

html = html.replace(
  /<section class="pf-toolbar"[\s\S]*?<\/section>\s*(?=<section class="pf-grid")/,
  `<section class="pf-toolbar" aria-label="포트폴리오 도구">
          <label class="pf-search">
            <span class="pf-search-ico" aria-hidden="true"></span>
            <input id="pfSearch" type="search" placeholder="작품·브랜드·소재 검색" aria-label="포트폴리오 검색" enterkeyhint="search" autocomplete="off">
          </label>
          <div class="pf-tools-actions">
            <button type="button" class="primary pf-write" id="pfWrite">글 작성하기</button>
            <span class="review-session" id="pfSession"></span>
          </div>
        </section>
        <p class="pf-status" id="pfStatus" aria-live="polite">불러오는 중…</p>

        `
);

if (!html.includes("글 작성하기") || !html.includes('id="pfStatus"')) throw new Error("patch failed");
fs.writeFileSync("portfolio.html", html);
console.log("html ok", html.includes("portfolio6"));