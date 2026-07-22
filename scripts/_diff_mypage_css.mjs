import fs from "fs";

const local = fs.readFileSync("mypage.css", "utf8").replace(/\r\n/g, "\n");
const live = await fetch(
  "https://hand-made.kr/mypage.css?v=20260722-mp18&_=" + Date.now(),
  { cache: "no-store" }
).then((r) => r.text()).then((t) => t.replace(/\r\n/g, "\n"));

console.log("local", local.length, "live", live.length, "equal", local === live);
if (local !== live) {
  const a = local.split("\n");
  const b = live.split("\n");
  console.log("lines", a.length, b.length);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.log("diff at", i + 1);
      console.log("L:", JSON.stringify(a[i]));
      console.log("R:", JSON.stringify(b[i]));
      if (i > 5) break;
    }
  }
}

// Check site-nav top auth layout on mypage - read compact/auth sizes
const nav = fs.readFileSync("site-nav.css", "utf8");
const auth = nav.match(/\.gb-top-brand__auth[\s\S]{0,400}/);
const btn = nav.match(/\.gb-top-auth-btn \{[\s\S]{0,350}/);
console.log("auth", auth?.[0]?.slice(0, 300));
console.log("btn", btn?.[0]?.slice(0, 300));
