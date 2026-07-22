import { execSync } from "child_process";

const css = await fetch(
  "https://hand-made.kr/mypage.css?v=20260722-mp18&_=" + Date.now(),
  { cache: "no-store" }
).then((r) => r.text());
console.log("live mypage.css", css.length, "1280", css.includes("1280"));

const js = await fetch(
  "https://hand-made.kr/mypage.js?v=20260722-mp18&_=" + Date.now(),
  { cache: "no-store" }
).then((r) => r.text());
console.log("live mypage.js", js.length);
try {
  new Function(js);
  console.log("js OK");
} catch (e) {
  console.log("js FAIL", e.message);
}

const nav = await fetch(
  "https://hand-made.kr/site-nav.css?v=20260722-mp18&_=" + Date.now(),
  { cache: "no-store" }
).then((r) => r.text());
console.log("live site-nav.css", nav.length);

const diff = execSync("git show 6b45ed0 -- site-nav.css", { encoding: "utf8" });
console.log(diff.slice(0, 2500));
