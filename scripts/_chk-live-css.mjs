import https from "https";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data, headers: res.headers }));
      })
      .on("error", reject);
  });
}

const urls = [
  "https://hand-made.kr/landing.css?v=20260722-mp10",
  "https://hand-made.kr/portfolio-board.css?v=20260722-mp10",
  "https://hand-made.kr/landing.html",
];

for (const url of urls) {
  const { status, data } = await get(url);
  console.log("===", url, status, data.length);
  if (url.includes("landing.css")) {
    const i = data.indexOf("/* Inline portfolio");
    console.log(data.slice(i, i + 2200));
  }
  if (url.includes("portfolio-board.css")) {
    console.log("196px count", (data.match(/grid-template-columns:\s*196px/g) || []).length);
    const deck = data.match(/\.pf-deck\s*\{[^}]+\}/g);
    console.log(deck);
  }
  if (url.includes("landing.html")) {
    console.log(
      data.match(/guide-build[^>]+>|landing\.css\?v=[^"]+|portfolio-board\.css\?v=[^"]+/g)
    );
  }
}
