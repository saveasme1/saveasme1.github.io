import { execSync } from "child_process";
import fs from "fs";

const t = fs.readFileSync("site-nav.js", "utf8");
console.log("local always", t.includes("always shows all 5"));
console.log("local hide", t.includes("li.hidden = !loggedIn"));
console.log("local css bust", t.match(/site-nav\.css\?v=[^"'`]+/)?.[0]);

const html = fs.readFileSync("landing.html", "utf8");
console.log("html busts", [...new Set(html.match(/20260722-mp\d+/g) || [])]);

const builds = JSON.parse(
  execSync("gh api repos/saveasme1/gongbang171_temp/pages/builds", {
    encoding: "utf8",
  })
);
console.log(
  "pages",
  builds.slice(0, 2).map((b) => ({
    status: b.status,
    at: b.created_at,
    err: b.error?.message || null,
  }))
);

const live = await fetch(
  "https://hand-made.kr/site-nav.js?v=" + Date.now(),
  { cache: "no-store" }
).then((r) => r.text());
console.log("live len", live.length);
console.log("live always", live.includes("always shows all 5"));
console.log("live hide", live.includes("li.hidden = !loggedIn"));
try {
  new Function(live);
  console.log("live syntax OK");
} catch (e) {
  console.log("live syntax FAIL", e.message);
}
