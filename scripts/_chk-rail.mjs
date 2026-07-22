import https from "https";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

const html = await get("https://hand-made.kr/landing.html");
const i = html.indexOf('id="portfolioPanel"');
console.log(html.slice(i, i + 1600));

const css = await get("https://hand-made.kr/landing.css?v=20260722-mp11");
const j = css.indexOf("@media (min-width: 1100px)");
console.log("\n--- landing 1100 ---\n", css.slice(j, j + 900));

const pcss = await get("https://hand-made.kr/portfolio-board.css?v=20260722-mp11");
// find all rules mentioning pf-rail padding or min-height
const matches = [...pcss.matchAll(/\.pf-rail[^{]*\{[^}]+\}/g)].map((m) => m[0]);
console.log("\n--- pf-rail rules ---\n", matches.join("\n\n"));
const cats = [...pcss.matchAll(/\.pf-cats[^{]*\{[^}]+\}/g)].map((m) => m[0]);
console.log("\n--- pf-cats ---\n", cats.join("\n\n"));
