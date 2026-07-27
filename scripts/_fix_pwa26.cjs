const fs = require("fs");

fs.writeFileSync(
  "app-build.json",
  JSON.stringify(
    {
      build: "20260727-pwa26",
      version: "v1.9.6",
      notes: [
        "발견 탭: 해외 주얼리 풍성 피드",
        "착용·뮤지엄·아카이브 + 한글 요약·원문 링크",
        "포폴 SKU 강제 매칭 폐기",
      ],
    },
    null,
    2
  ) + "\n",
  "utf8"
);

let s = fs.readFileSync("pwa-register.js", "utf8");
s = s.replace(/const APP_BUILD = "[^"]+";/, 'const APP_BUILD = "20260727-pwa26";');
s = s.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "v1.9.6";');
s = s.replace(
  /const RELEASE_NOTES = \[[\s\S]*?\];/,
  `const RELEASE_NOTES = [
    "발견 탭: 해외 주얼리 풍성 피드",
    "착용·뮤지엄·아카이브 + 한글 요약·원문 링크",
    "포폴 SKU 강제 매칭 폐기",
  ];`
);
fs.writeFileSync("pwa-register.js", s, "utf8");

const files = [
  "discover.html",
  "landing.html",
  "portfolio.html",
  "mypage.html",
  "search.html",
  "install.html",
  "index.html",
  "sw.js",
  "heritage-gold/index.html",
];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let t = fs.readFileSync(f, "utf8");
  const n = t.replace(/20260727-pwa25/g, "20260727-pwa26");
  if (n !== t) fs.writeFileSync(f, n, "utf8");
}
console.log("pwa26 ok");
