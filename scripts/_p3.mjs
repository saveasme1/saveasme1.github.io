import fs from "fs";

let pjs = fs.readFileSync("portfolio-board.js", "utf8").replace(/\r\n/g, "\n");
if (!pjs.includes("window.openGongbangAuth")) {
  pjs = pjs.replace(
    /bootSession\(\);\n\s*loadData\(\);/,
    'window.openGongbangAuth = (mode) => openAuth(mode || "login");\n  window.getGongbangMember = () => state.member;\n\n  bootSession();\n  loadData();'
  );
}
fs.writeFileSync("portfolio-board.js", pjs.replace(/\n/g, "\r\n"));
console.log("pjs", pjs.includes("window.openGongbangAuth"));

let nav = fs.readFileSync("site-nav.js", "utf8").replace(/\r\n/g, "\n");
nav = nav.replace("site-nav.css?v=20260722-mp4", "site-nav.css?v=20260722-mp5");

const portPath = "/" + "portfolio.html";

if (!nav.includes("isPortfolioPage")) {
  nav = nav.replace(
    "function isMyPage() {\n    return /\\/mypage\\.hhtl%/i.test(location.pathname);\n  }",
    "function isMyPage() {\n    return /\\/!.html$/i.test(location.pathname);\n  }\n\n  function isPortfolioPage() {\n    return /\\/portfolio\\.html$/i.test(location.pathname);\n  }"
  );
  // fix the accidental broken mypage replace
  nav = nav.replace(
    "function isMyPage() {\n    return /\\/!.html$/i.test(location.pathname);\n  }",
    "function isMyPage() {\n    return /\\/mypage\\.html$/i.test(location.pathname);\n  }"
  );
}

if (!nav.includes('if (isPortfolioPage() return "portfolio"')) {
  nav = nav.replace(
    'function detectActivePanel() {\n    if (isMyPage()) return "mypage";',
    'function detectActivePanel() {\n    if (isMyPage()) return "mypage";\n    if (isPortfolioPage()) return "portfolio";\'
  );
}

const marker = 'if (name === "portfolio") {
        if (typeof window.closeGongbangBoardPanels === "function") {';
if (nav.includes(marker) && !nav.includes(portPath)) {
  const start = nav.indexOf(marker);
  const endKey = 'else location.href = HOME;';
  const end = nav.indexOf(endKey, start) + endKey.length;
  const replacement = `if (name === "portfolio") {\n        location.href = "${portPath}";\n        return;\n      }\n    }\n    if (name === "portfolio") {\n      if (isPortfolioPage()) {\n        setActiveNav("portfolio");\n        window.scrollTo({ top: 0, behavior: "smooth" });\n        return;\n      }\n      location.href = "${portPath}";\n    } else if (name === "reviews") location.href = `${HOME}?open=reviews`;\n    else if (name === "shipping") location.href = `${HOME}?open=shipping`;\n    else location.href = HOME;`;
  nav = nav.slice(0, start) + replacement + nav.slice(end);
}

fs.writeFileSync("site-nav.js", nav.replace(/\n/g, "\r\n"));

let landing = fs.readFileSync("landing.html", "utf8");
landing = landing.replaceAll("site-nav.js?v=20260722-mp4", "site-nav.js?v=20260722-mp5");
landing = landing.replaceAll("site-nav.css?v=20260722-mp4", "site-nav.css?v=20260722-mp5");
fs.writeFileSync("landing.html", landing);

console.log({
  auth: pjs.includes("window.openGongbangAuth"),
  folioFn: nav.includes("isPortfolioPage"),
  folioHref: nav.includes(portPath),
  detect: nav.includes('return "portfolio"'),
});
