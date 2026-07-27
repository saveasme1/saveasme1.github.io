const fs = require("fs");

fs.writeFileSync(
  "app-build.json",
  JSON.stringify(
    {
      build: "20260727-pwa25",
      version: "v1.9.5",
      notes: [
        "코디 피드: 일일 검증 허용목록만 송출",
        "자동 플리커 라벨링 폐기 · 오매칭 시 빈 화면",
        "하루 1회 GitHub Action 갱신",
      ],
    },
    null,
    2
  ) + "\n",
  "utf8"
);

let s = fs.readFileSync("pwa-register.js", "utf8");
s = s.replace(/const APP_BUILD = "[^"]+";/, 'const APP_BUILD = "20260727-pwa25";');
s = s.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "v1.9.5";');
s = s.replace(
  /const RELEASE_NOTES = \[[\s\S]*?\];/,
  `const RELEASE_NOTES = [
    "코디 피드: 일일 검증 허용목록만 송출",
    "자동 플리커 라벨링 폐기 · 오매칭 시 빈 화면",
    "하루 1회 GitHub Action 갱신",
  ];`
);
fs.writeFileSync("pwa-register.js", s, "utf8");
console.log("fixed");
