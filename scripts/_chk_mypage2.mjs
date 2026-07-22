import fs from "fs";

const html = await fetch("https://hand-made.kr/mypage.html?_=" + Date.now(), {
  cache: "no-store",
}).then((r) => r.text());
console.log(
  "css",
  [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((m) => m[1])
);
console.log(
  "js",
  [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1])
);

// Fetch landing.css live and check if mp- unrelated huge rules could apply
const land = await fetch(
  "https://hand-made.kr/landing.css?v=20260722-mp18&_=" + Date.now(),
  { cache: "no-store" }
).then((r) => r.text());
console.log(
  "live landing write font",
  land.includes("font-size: 10px !important")
);
console.log("live landing len", land.length);
